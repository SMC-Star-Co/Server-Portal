// Technical attachments: original bytes only, streamed uploads/downloads; no image conversion.
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { Transform } = require('node:stream');
const { pipeline } = require('node:stream/promises');
const { randomUUID, randomBytes, createHash } = require('node:crypto');
const { spawn } = require('node:child_process');

const MEDIA_ROOT = process.env.PORTAL_MEDIA_DIR || '/app/media';
const MAX_BYTES = 500 * 1024 * 1024;
const MEDIA_QUOTA = 100 * 1024 * 1024 * 1024;
const RESERVE_BYTES = 2 * 1024 * 1024 * 1024;
const TRANSFER_TTL = 120000;
const transferTickets = new Map();
const TYPE_MAP = Object.freeze({
  jpg:'image/jpeg', jpeg:'image/jpeg', png:'image/png', webp:'image/webp',
  heic:'image/heic', heif:'image/heif', gif:'image/gif', bmp:'image/bmp',
  tif:'image/tiff', tiff:'image/tiff',
  mp4:'video/mp4', m4v:'video/mp4', mov:'video/quicktime', webm:'video/webm',
  pdf:'application/pdf', doc:'application/msword',
  docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls:'application/vnd.ms-excel',
  xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt:'application/vnd.ms-powerpoint',
  pptx:'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  txt:'text/plain', csv:'text/csv', log:'text/plain', rtf:'application/rtf',
  odt:'application/vnd.oasis.opendocument.text',
  ods:'application/vnd.oasis.opendocument.spreadsheet'
});
const ZIP_TYPES = new Set(['docx','xlsx','pptx','odt','ods']);
const OLE_TYPES = new Set(['doc','xls','ppt']);
const TEXT_TYPES = new Set(['txt','csv','log','rtf']);
function isTechnician(user) {
  return Array.isArray(user?.roles) ? user.roles.includes('technician') : user?.role === 'technician';
}
function validId(value) {
  const n = Number(value);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}
function parseSerials(value) {
  return String(value || '').split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
}
function sanitizeName(name) {
  return String(name || 'file').replace(/[\x00-\x1f\x7f\/\\]/g, '_').slice(0, 180) || 'file';
}
function extension(name) {
  return String(name).toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] || '';
}
function canonicalSerial(serial) {
  const value = String(serial || '').trim().toUpperCase();
  return /^[A-Z0-9_-]{1,100}$/.test(value) ? value : '';
}
function storedPath(name) {
  if (!/^[0-9a-f]{8}-[0-9a-f-]{27,40}\.[a-z0-9]{2,6}$/.test(name) &&
      !/^[a-f0-9-]{36}(?:-thumb)?\.(?:webp|jpg|png|mp4|webm|mov)$/.test(name)) {
    throw new Error('Invalid stored name');
  }
  return path.join(MEDIA_ROOT, name);
}
function looksLike(ext, bytes) {
  const b = bytes;
  const ascii = (from, to) => b.toString('ascii', from, to);
  if (ext === 'jpg' || ext === 'jpeg') return b[0] === 255 && b[1] === 216 && b[2] === 255;
  if (ext === 'png') return b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
  if (ext === 'webp') return ascii(0,4) === 'RIFF' && ascii(8,12) === 'WEBP';
  if (ext === 'gif') return ascii(0,6) === 'GIF87a' || ascii(0,6) === 'GIF89a';
  if (ext === 'bmp') return ascii(0,2) === 'BM';
  if (ext === 'tif' || ext === 'tiff') return ascii(0,4) === 'II*\0' || ascii(0,4) === 'MM\0*';
  if (ext === 'heic' || ext === 'heif') return ascii(4,8) === 'ftyp' && /^(heic|heix|hevc|hevx|mif1|msf1)$/.test(ascii(8,12));
  if (ext === 'mp4' || ext === 'm4v' || ext === 'mov') return ascii(4,8) === 'ftyp';
  if (ext === 'webm') return b.subarray(0,4).equals(Buffer.from([26,69,223,163]));
  if (ext === 'pdf') return ascii(0,5) === '%PDF-';
  if (ZIP_TYPES.has(ext)) return ascii(0,2) === 'PK';
  if (OLE_TYPES.has(ext)) return b.subarray(0,8).equals(Buffer.from([208,207,17,224,161,177,26,225]));
  if (TEXT_TYPES.has(ext)) return !b.includes(0);
  return false;
}
function downloadName(invoice,scope,serial,seq,ext) {
  const base = String(invoice || '').trim().replace(/[^0-9A-Za-z_-]/g, '_').slice(0, 80);
  const number = String(seq).padStart(2, '0');
  return (base || 'invoice') + (scope === 'serial' ? '-' + serial : '') + '-' + number + '.' + ext;
}
async function cleanMedia(rows) {
  for (const item of rows || []) for (const name of [item.stored_name,item.thumbnail_name]) {
    if (name) await fsp.unlink(storedPath(name)).catch(err => {
      if (err.code !== 'ENOENT') console.error('Media cleanup:',err);
    });
  }
}
async function initMediaTable(client) {
  await client.query("CREATE TABLE IF NOT EXISTS invoice_media (" +
    "id BIGSERIAL PRIMARY KEY, order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE," +
    "stored_name TEXT NOT NULL UNIQUE, thumbnail_name TEXT, original_name TEXT NOT NULL," +
    "mime_type TEXT NOT NULL, original_bytes BIGINT NOT NULL, stored_bytes BIGINT NOT NULL," +
    "thumbnail_bytes BIGINT NOT NULL DEFAULT 0, source_hash TEXT NOT NULL," +
    "compression_mode TEXT NOT NULL, uploaded_by INTEGER, uploader_name TEXT," +
    "created_at TIMESTAMP NOT NULL DEFAULT NOW())");
  await client.query("ALTER TABLE invoice_media ADD COLUMN IF NOT EXISTS media_scope TEXT NOT NULL DEFAULT 'invoice'");
  await client.query("ALTER TABLE invoice_media ADD COLUMN IF NOT EXISTS serial_number TEXT");
  await client.query("ALTER TABLE invoice_media ADD COLUMN IF NOT EXISTS sequence_number INTEGER NOT NULL DEFAULT 0");
  await client.query("ALTER TABLE invoice_media ADD COLUMN IF NOT EXISTS download_name TEXT");
  await client.query("CREATE INDEX IF NOT EXISTS invoice_media_order_idx ON invoice_media(order_id,id)");
  await client.query("CREATE UNIQUE INDEX IF NOT EXISTS invoice_media_scope_sequence_idx ON invoice_media(order_id,media_scope,COALESCE(serial_number,''),sequence_number) WHERE sequence_number > 0");
}
function attachmentsForOrder(client, id) {
  return client.query("SELECT id,original_name,COALESCE(download_name,original_name) AS download_name," +
    "mime_type,stored_bytes,original_bytes,uploader_name,created_at,media_scope,serial_number,sequence_number," +
    "thumbnail_name IS NOT NULL AS has_thumbnail FROM invoice_media WHERE order_id=$1 ORDER BY id", [id]);
}
function cleanupTickets() {
  const now = Date.now();
  for (const [key, ticket] of transferTickets) if (ticket.expires < now) transferTickets.delete(key);
}
function issueTicket(payload) {
  cleanupTickets();
  const token = randomBytes(32).toString('hex');
  transferTickets.set(token, {...payload, expires:Date.now()+TRANSFER_TTL});
  return token;
}
function fail(reply,code,message) { return reply.code(code).send({error:message}); }
function safeDisposition(name) {
  return "attachment; filename=\"download\"; filename*=UTF-8''" + encodeURIComponent(sanitizeName(name));
}
function registerInvoiceMedia(fastify,{pool,requirePermission,writeActivityLog,broadcastRealtimeEvent}) {
  // Keep the request as a stream: a 500-MB upload must not be buffered in Node memory.
  fastify.addContentTypeParser('application/octet-stream', (request, payload, done) => done(null,payload));
  fastify.get('/api/orders/:id/media', async(request,reply) => {
    if(!requirePermission(request,reply,'orders.view'))return;
    const id=validId(request.params.id);
    if(!id)return fail(reply,400,'شناسه فاکتور معتبر نیست.');
    const order=await pool.query('SELECT invoice_number,serials FROM orders WHERE id=$1',[id]);
    if(!order.rowCount)return fail(reply,404,'فاکتور یافت نشد.');
    const result=await attachmentsForOrder(pool,id);
    return {invoice_number:order.rows[0].invoice_number,serials:parseSerials(order.rows[0].serials),
      files:result.rows,can_manage:isTechnician(request.user)};
  });

  fastify.post('/api/orders/:id/media',{bodyLimit:MAX_BYTES},async(request,reply) => {
    if(!requirePermission(request,reply,'orders.view'))return;
    if(!isTechnician(request.user))return fail(reply,403,'فقط تکنسین فنی اجازه آپلود دارد.');
    const id=validId(request.params.id);
    if(!id)return fail(reply,400,'شناسه فاکتور معتبر نیست.');
    const scope=request.headers['x-media-scope']==='serial'?'serial':'invoice';
    const serial=scope==='serial'?canonicalSerial(request.headers['x-media-serial']):null;
    if(scope==='serial'&&!serial)return fail(reply,400,'سریال معتبر انتخاب نشده است.');
    let original='file';
    try{original=sanitizeName(decodeURIComponent(String(request.headers['x-file-name']||'file')));}
    catch{return fail(reply,400,'نام فایل نامعتبر است.');}
    const ext=extension(original),mime=TYPE_MAP[ext];
    if(!mime)return fail(reply,415,'نوع فایل مجاز نیست. عکس، ویدیو، PDF، Word، Excel، PowerPoint و فایل متنی پذیرفته می‌شود.');
    const headerLength=Number(request.headers['content-length']||0);
    if(Number.isFinite(headerLength)&&headerLength>MAX_BYTES)return fail(reply,413,'حداکثر حجم هر فایل ۵۰۰ مگابایت است.');
    const order=await pool.query('SELECT invoice_number,serials FROM orders WHERE id=$1',[id]);
    if(!order.rowCount)return fail(reply,404,'فاکتور یافت نشد.');
    if(serial&&!parseSerials(order.rows[0].serials).includes(serial))return fail(reply,409,'سریال انتخاب‌شده در فاکتور ثبت نشده است.');
    await fsp.mkdir(MEDIA_ROOT,{recursive:true});
    const disk=await fsp.statfs(MEDIA_ROOT);
    if(Number(disk.bavail)*Number(disk.bsize)<RESERVE_BYTES+Math.max(headerLength,MAX_BYTES))
      return fail(reply,507,'فضای آزاد دیسک کافی نیست.');
    const token=randomUUID();
    const temp=path.join(MEDIA_ROOT,'.'+token+'.upload');
    const finalName=token+'.'+ext;
    let bytes=0,header=Buffer.alloc(0);
    const hash=createHash('sha256');
    const monitor=new Transform({transform(chunk,encoding,callback){
      bytes+=chunk.length;
      if(bytes>MAX_BYTES){callback(new Error('FILE_TOO_LARGE'));return;}
      if(header.length<32)header=Buffer.concat([header,chunk.subarray(0,32-header.length)]);
      hash.update(chunk);callback(null,chunk);
    }});
    try {
      await pipeline(request.body,monitor,fs.createWriteStream(temp,{flags:'wx',mode:0o600}));
      if(bytes<1)return fail(reply,400,'فایل خالی است.');
      if(!looksLike(ext,header))return fail(reply,415,'محتوای فایل با نوع انتخاب‌شده مطابقت ندارد.');
      const client=await pool.connect();
      let saved=false;
      try{
        await client.query('BEGIN');
        await client.query('SELECT pg_advisory_xact_lock($1)',[472901]);
        const current=await client.query('SELECT serials,invoice_number FROM orders WHERE id=$1 FOR UPDATE',[id]);
        if(!current.rowCount)throw new Error('INVOICE_MISSING');
        if(serial&&!parseSerials(current.rows[0].serials).includes(serial))throw new Error('SERIAL_MISSING');
        const duplicate=await client.query('SELECT id FROM invoice_media WHERE order_id=$1 AND media_scope=$2 AND COALESCE(serial_number,\'\')=$3 AND source_hash=$4 LIMIT 1',[id,scope,serial||'',hash.digest('hex')]);
        if(duplicate.rowCount){
          await client.query('COMMIT');
          return {success:true,duplicate:true,media_id:duplicate.rows[0].id};
        }
        const total=await client.query('SELECT COALESCE(SUM(stored_bytes+thumbnail_bytes),0)::bigint AS total FROM invoice_media');
        if(Number(total.rows[0].total)+bytes>MEDIA_QUOTA)throw new Error('QUOTA_EXCEEDED');
        const next=await client.query('SELECT COALESCE(MAX(sequence_number),0)+1 AS seq FROM invoice_media WHERE order_id=$1 AND media_scope=$2 AND COALESCE(serial_number,\'\')=$3',[id,scope,serial||'']);
        const seq=Number(next.rows[0].seq);
        const name=downloadName(current.rows[0].invoice_number,scope,serial,seq,ext);
        await fsp.rename(temp,storedPath(finalName));
        saved=true;
        const inserted=await client.query('INSERT INTO invoice_media (order_id,stored_name,original_name,download_name,mime_type,original_bytes,stored_bytes,source_hash,compression_mode,uploaded_by,uploader_name,media_scope,serial_number,sequence_number) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING id',
          [id,finalName,original,name,mime,bytes,bytes,hash.copy?null:null,'original',request.user.id,request.user.full_name||request.user.username,scope,serial,seq]);
        await client.query('COMMIT');
        await writeActivityLog({request,action_type:'order.media_uploaded',entity_type:'order',entity_id:String(id),
          invoice_number:current.rows[0].invoice_number,message:'فایل فنی به فاکتور اضافه شد.',
          details:{filename:name,scope,serial,stored_bytes:bytes}});
        broadcastRealtimeEvent('orders.changed',{order_id:id});
        return {success:true,media_id:inserted.rows[0].id,download_name:name,stored_bytes:bytes};
      }catch(e){
        await client.query('ROLLBACK').catch(()=>{});
        if(saved)await fsp.unlink(storedPath(finalName)).catch(()=>{});
        if(e.message==='QUOTA_EXCEEDED')return fail(reply,413,'سهمیه فایل‌های فنی تکمیل شده است.');
        if(e.message==='SERIAL_MISSING')return fail(reply,409,'این سریال دیگر در فاکتور موجود نیست.');
        throw e;
      }finally{client.release();}
    }catch(error){
      request.log.error(error);
      if(error.message==='FILE_TOO_LARGE')return fail(reply,413,'حداکثر حجم هر فایل ۵۰۰ مگابایت است.');
      return fail(reply,500,'ذخیره فایل ناموفق بود.');
    }finally{await fsp.unlink(temp).catch(()=>{});}
  });

  fastify.delete('/api/orders/:id/media/:mediaId',async(request,reply)=>{
    if(!requirePermission(request,reply,'orders.view'))return;
    if(!isTechnician(request.user))return fail(reply,403,'فقط تکنسین فنی اجازه حذف دارد.');
    const id=validId(request.params.id),mid=validId(request.params.mediaId);
    if(!id||!mid)return fail(reply,400,'شناسه نامعتبر است.');
    const result=await pool.query('DELETE FROM invoice_media WHERE id=$1 AND order_id=$2 RETURNING *',[mid,id]);
    if(!result.rowCount)return fail(reply,404,'فایل یافت نشد.');
    await cleanMedia(result.rows);
    const invoice=await pool.query('SELECT invoice_number FROM orders WHERE id=$1',[id]);
    await writeActivityLog({request,action_type:'order.media_deleted',entity_type:'order',entity_id:String(id),
      invoice_number:invoice.rows[0]?.invoice_number,message:'فایل فنی از فاکتور حذف شد.',details:{filename:result.rows[0].download_name}});
    broadcastRealtimeEvent('orders.changed',{order_id:id});
    return {success:true};
  });

  fastify.post('/api/orders/:id/media/ticket',async(request,reply)=>{
    if(!requirePermission(request,reply,'orders.view'))return;
    const id=validId(request.params.id);
    if(!id)return fail(reply,400,'شناسه فاکتور نامعتبر است.');
    const order=await pool.query('SELECT serials FROM orders WHERE id=$1',[id]);
    if(!order.rowCount)return fail(reply,404,'فاکتور یافت نشد.');
    const body=request.body||{};
    let payload;
    if(body.kind==='file'){
      const fileId=validId(body.file_id);
      if(!fileId)return fail(reply,400,'فایل معتبر نیست.');
      const found=await pool.query('SELECT id FROM invoice_media WHERE order_id=$1 AND id=$2',[id,fileId]);
      if(!found.rowCount)return fail(reply,404,'فایل یافت نشد.');
      payload={kind:'file',orderId:id,fileId,inline:body.inline===true};
    }else if(body.kind==='zip'&&(body.scope==='invoice'||body.scope==='serial')){
      const scope=body.scope,serial=scope==='serial'?canonicalSerial(body.serial_number):null;
      if(scope==='serial'&&(!serial||!parseSerials(order.rows[0].serials).includes(serial)))return fail(reply,400,'سریال انتخاب‌شده معتبر نیست.');
      const found=await pool.query('SELECT 1 FROM invoice_media WHERE order_id=$1 AND media_scope=$2 AND COALESCE(serial_number,\'\')=$3 LIMIT 1',[id,scope,serial||'']);
      if(!found.rowCount)return fail(reply,404,'فایلی برای دانلود وجود ندارد.');
      payload={kind:'zip',orderId:id,scope,serial};
    }else return fail(reply,400,'نوع درخواست نامعتبر است.');
    const ticket=issueTicket(payload);
    return {url:'/api/media-transfer/'+ticket,expires_in:120};
  });

  // Short-lived unguessable tickets let the browser stream large files directly to disk,
  // without loading a 500-MB Blob into the browser or exposing the user's login token.
  fastify.get('/api/media-transfer/:ticket',async(request,reply)=>{
    cleanupTickets();
    const ticket=transferTickets.get(String(request.params.ticket||''));
    if(!ticket||ticket.expires<Date.now())return fail(reply,404,'لینک دانلود منقضی شده است.');
    const id=ticket.orderId;
    if(ticket.kind==='file'){
      const r=await pool.query('SELECT * FROM invoice_media WHERE order_id=$1 AND id=$2',[id,ticket.fileId]);
      if(!r.rowCount)return fail(reply,404,'فایل یافت نشد.');
      const file=r.rows[0];
      const filepath=storedPath(file.stored_name);
      try{await fsp.access(filepath);}catch{return fail(reply,404,'فایل روی دیسک موجود نیست.');}
      const showInline=ticket.inline && /^(image\/(jpeg|png|webp|gif|bmp)|video\/(mp4|webm|quicktime)|application\/pdf)$/.test(file.mime_type);
      return reply.header('Content-Type',file.mime_type).header('X-Content-Type-Options','nosniff')
        .header('Referrer-Policy','no-referrer').header('Cache-Control','private, no-store')
        .header('Content-Disposition',showInline?'inline':safeDisposition(file.download_name||file.original_name))
        .send(fs.createReadStream(filepath));
    }
    const files=await pool.query('SELECT stored_name,COALESCE(download_name,original_name) AS name FROM invoice_media WHERE order_id=$1 AND media_scope=$2 AND COALESCE(serial_number,\'\')=$3 ORDER BY sequence_number,id',[id,ticket.scope,ticket.serial||'']);
    if(!files.rowCount)return fail(reply,404,'فایلی برای دانلود وجود ندارد.');
    const temp=await fsp.mkdtemp(path.join(os.tmpdir(),'portal-zip-'));
    try{
      const names=[];
      for(const file of files.rows){
        const name=sanitizeName(file.name);
        await fsp.access(storedPath(file.stored_name));
        await fsp.symlink(storedPath(file.stored_name),path.join(temp,name));
        names.push(name);
      }
      const order=await pool.query('SELECT invoice_number FROM orders WHERE id=$1',[id]);
      const archive=sanitizeName(String(order.rows[0]?.invoice_number||'invoice')+(ticket.scope==='serial'?'-'+ticket.serial:'')+'.zip');
      const proc=spawn('zip',['-0','-q','-j','-',...names],{cwd:temp,stdio:['ignore','pipe','pipe'],shell:false});
      proc.stderr.on('data',e=>request.log.error('Zip: '+e.toString().slice(0,250)));
      proc.on('close',()=>fsp.rm(temp,{recursive:true,force:true}).catch(()=>{}));
      proc.on('error',err=>{request.log.error(err);fsp.rm(temp,{recursive:true,force:true}).catch(()=>{});});
      reply.raw.on('close',()=>{if(proc.exitCode===null)proc.kill();});
      return reply.header('Content-Type','application/zip').header('Content-Disposition',safeDisposition(archive))
        .header('Cache-Control','private, no-store').header('X-Content-Type-Options','nosniff')
        .header('Referrer-Policy','no-referrer').send(proc.stdout);
    }catch(e){
      await fsp.rm(temp,{recursive:true,force:true}).catch(()=>{});
      request.log.error(e);
      return fail(reply,500,'ساخت فایل ZIP ناموفق بود.');
    }
  });
}
module.exports={registerInvoiceMedia,initMediaTable,cleanMedia,__test:{isTechnician,parseSerials,canonicalSerial,downloadName,looksLike,extension,storedPath}};
