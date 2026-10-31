const fs = require('node:fs/promises');
const fss = require('node:fs');
const path = require('node:path');
const { randomUUID, createHash } = require('node:crypto');
const { spawn } = require('node:child_process');

const ROOT = process.env.PORTAL_MEDIA_DIR || '/app/media';
const MAX_FILE = 16 * 1024 * 1024;
const QUOTA = 100 * 1024 * 1024 * 1024;
const isTech = user => Array.isArray(user?.roles) ? user.roles.includes('technician') : user?.role === 'technician';
function diskPath(name) {
  if (!/^[0-9a-f-]{36}(?:-thumb)?\.(?:webp|png|jpg|mp4|webm|mov)$/.test(name)) throw new Error('Invalid name');
  return path.join(ROOT, name);
}
async function cleanMedia(rows) {
  for (const row of rows || []) for (const key of ['stored_name', 'thumbnail_name']) {
    if (row[key]) await fs.unlink(diskPath(row[key])).catch(e => { if (e.code !== 'ENOENT') console.error(e); });
  }
}
async function initMediaTable(client) {
  await client.query('CREATE TABLE IF NOT EXISTS invoice_media (' +
    'id BIGSERIAL PRIMARY KEY, order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,' +
    'stored_name TEXT NOT NULL UNIQUE, thumbnail_name TEXT, original_name TEXT NOT NULL,' +
    'mime_type TEXT NOT NULL, original_bytes BIGINT NOT NULL, stored_bytes BIGINT NOT NULL,' +
    'thumbnail_bytes BIGINT NOT NULL DEFAULT 0, source_hash TEXT NOT NULL,' +
    'compression_mode TEXT NOT NULL, uploaded_by INTEGER, uploader_name TEXT,' +
    'created_at TIMESTAMP NOT NULL DEFAULT NOW())');
  await client.query('CREATE INDEX IF NOT EXISTS invoice_media_order_idx ON invoice_media(order_id,id)');
}
function sniff(b) {
  if (b[0]===255 && b[1]===216 && b[2]===255) return { ext:'jpg', mime:'image/jpeg', image:true };
  if (b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) return { ext:'png', mime:'image/png', image:true };
  if (b.toString('ascii',0,4)==='RIFF' && b.toString('ascii',8,12)==='WEBP') return { ext:'webp', mime:'image/webp', image:true };
  if (b.toString('ascii',4,8)==='ftyp') {
    const brand = b.toString('ascii',8,12);
    if (/^(heic|heix|hevc|hevx|mif1|msf1)$/i.test(brand)) return { ext:'heic', mime:'image/heic', image:true };
    if (brand==='qt  ') return { ext:'mov', mime:'video/quicktime', image:false };
    return { ext:'mp4', mime:'video/mp4', image:false };
  }
  if (b.subarray(0,4).equals(Buffer.from([26,69,223,163]))) return { ext:'webm', mime:'video/webm', image:false };
  return null;
}
function magick(args, timeout=90000) {
  return new Promise((resolve,reject)=>{
    const child=spawn('magick',args,{stdio:['ignore','pipe','pipe'],shell:false,env:{
      ...process.env,MAGICK_MEMORY_LIMIT:'192MiB',MAGICK_MAP_LIMIT:'384MiB',
      MAGICK_DISK_LIMIT:'512MiB',MAGICK_THREAD_LIMIT:'2'
    }});
    let out='',err='';
    const timer=setTimeout(()=>child.kill('SIGKILL'),timeout);
    child.stdout.on('data',b=>{if(out.length<4096)out+=b.toString()});
    child.stderr.on('data',b=>{if(err.length<4096)err+=b.toString()});
    child.on('error',e=>{clearTimeout(timer);reject(e)});
    child.on('close',code=>{clearTimeout(timer);code===0?resolve(out.trim()):reject(new Error(err.slice(0,300)||'Conversion failed'))});
  });
}
async function optimize(input,base,format,mode) {
  const info=await magick(['-ping',input+'[0]','-format','%w %h','info:']);
  const [w,h]=info.split(/\s+/).map(Number);
  if (!Number.isInteger(w)||!Number.isInteger(h)||w<1||h<1||w*h>60000000) throw new Error('Image dimensions invalid');
  const webp=base+'.webp';
  const lossless=mode==='detail'||format.ext==='png';
  const args=[input+'[0]','-auto-orient','-strip','-define','webp:method=5'];
  if(lossless)args.push('-define','webp:lossless=true','-quality','100');
  else args.push('-quality','95');
  await magick([...args,diskPath(webp)]);
  const sourceBytes=(await fs.stat(input)).size, webpBytes=(await fs.stat(diskPath(webp))).size;
  if(!webpBytes)throw new Error('Empty image output');
  const keepOriginal=format.ext!=='heic' && sourceBytes<=webpBytes;
  const stored=keepOriginal?base+'.'+format.ext:webp;
  if(keepOriginal) {await fs.rename(input,diskPath(stored));await fs.unlink(diskPath(webp))}
  const thumb=base+'-thumb.webp';
  let thumbBytes=0;
  try {
    await magick([diskPath(stored)+'[0]','-thumbnail','320x320>','-strip','-quality','76',diskPath(thumb)],30000);
    thumbBytes=(await fs.stat(diskPath(thumb))).size;
  } catch(e){console.warn('Thumbnail failed:',e.message)}
  return {stored_name:stored,thumbnail_name:thumbBytes?thumb:null,
    stored_bytes:keepOriginal?sourceBytes:webpBytes,thumbnail_bytes:thumbBytes,
    mime_type:keepOriginal?format.mime:'image/webp',
    compression_mode:keepOriginal?'original':lossless?'lossless':'high-quality'};
}
function safeName(name){return String(name||'file').replace(/[\x00-\x1f\x7f\/\\]/g,'_').slice(0,180)||'file'}
function numeric(value){const n=Number(value);return Number.isSafeInteger(n)&&n>0?n:null}
function registerInvoiceMedia(fastify,{pool,requirePermission,writeActivityLog,broadcastRealtimeEvent}){
  fastify.addContentTypeParser('application/octet-stream',
    {parseAs:'buffer',bodyLimit:MAX_FILE},(request,body,done)=>done(null,body));
  fastify.get('/api/orders/:id/media',async(request,reply)=>{
    if(!requirePermission(request,reply,'orders.view'))return;
    const id=numeric(request.params.id);
    if(!id)return reply.code(400).send({error:'شناسه فاکتور نامعتبر است.'});
    const exists=await pool.query('SELECT 1 FROM orders WHERE id=$1',[id]);
    if(!exists.rowCount)return reply.code(404).send({error:'فاکتور پیدا نشد.'});
    const rows=await pool.query('SELECT id,original_name,mime_type,original_bytes,stored_bytes,compression_mode,uploader_name,created_at,thumbnail_name IS NOT NULL AS has_thumbnail FROM invoice_media WHERE order_id=$1 ORDER BY id DESC',[id]);
    return {files:rows.rows,can_manage:isTech(request.user)};
  });
  fastify.post('/api/orders/:id/media',{bodyLimit:MAX_FILE},async(request,reply)=>{
    if(!requirePermission(request,reply,'orders.view'))return;
    if(!isTech(request.user))return reply.code(403).send({error:'فقط تکنسین فنی مجاز به آپلود است.'});
    const id=numeric(request.params.id),input=request.body;
    if(!id)return reply.code(400).send({error:'شناسه فاکتور نامعتبر است.'});
    if(!Buffer.isBuffer(input)||!input.length||input.length>MAX_FILE)return reply.code(400).send({error:'حداکثر حجم هر فایل ۱۶ مگابایت است.'});
    const format=sniff(input);
    if(!format)return reply.code(415).send({error:'نوع فایل پشتیبانی نمی‌شود. JPG/PNG/WebP/HEIC/MP4/MOV/WebM'});
    const order=await pool.query('SELECT invoice_number FROM orders WHERE id=$1',[id]);
    if(!order.rowCount)return reply.code(404).send({error:'فاکتور پیدا نشد.'});
    const hash=createHash('sha256').update(input).digest('hex');
    const duplicate=await pool.query('SELECT id FROM invoice_media WHERE order_id=$1 AND source_hash=$2 LIMIT 1',[id,hash]);
    if(duplicate.rowCount)return {success:true,duplicate:true};
    const used=await pool.query('SELECT COALESCE(SUM(stored_bytes + thumbnail_bytes),0) AS total FROM invoice_media');
    if(Number(used.rows[0].total)+input.length>QUOTA)return reply.code(413).send({error:'سهمیه فایل‌های فنی تکمیل است.'});
    await fs.mkdir(ROOT,{recursive:true});
    const disk=await fs.statfs(ROOT);
    if(Number(disk.bavail)*Number(disk.bsize)<(2*1024**3+3*input.length))return reply.code(507).send({error:'فضای خالی دیسک کافی نیست.'});
    const base=randomUUID(),temp=path.join(ROOT,'.'+base+'.upload');
    let output=null;
    try {
      await fs.writeFile(temp,input,{flag:'wx'});
      if(format.image)output=await optimize(temp,base,format,request.headers['x-image-mode']==='detail'?'detail':'balanced');
      else {
        const stored=base+'.'+format.ext;
        await fs.rename(temp,diskPath(stored));
        output={stored_name:stored,thumbnail_name:null,stored_bytes:input.length,thumbnail_bytes:0,
          mime_type:format.mime,compression_mode:'original'};
      }
      const usageAfter=await pool.query('SELECT COALESCE(SUM(stored_bytes + thumbnail_bytes),0) AS total FROM invoice_media');
      if(Number(usageAfter.rows[0].total)+output.stored_bytes+output.thumbnail_bytes>QUOTA)throw new Error('Media quota exceeded');
      let original='file.'+format.ext;
      try{original=safeName(decodeURIComponent(String(request.headers['x-file-name']||original)))}catch{}
      const db=await pool.query('INSERT INTO invoice_media (order_id,stored_name,thumbnail_name,original_name,mime_type,original_bytes,stored_bytes,thumbnail_bytes,source_hash,compression_mode,uploaded_by,uploader_name) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id',
        [id,output.stored_name,output.thumbnail_name,original,output.mime_type,input.length,output.stored_bytes,output.thumbnail_bytes,hash,output.compression_mode,request.user.id,request.user.full_name||request.user.username]);
      await writeActivityLog({request,action_type:'order.media_uploaded',entity_type:'order',entity_id:String(id),
        invoice_number:order.rows[0].invoice_number,message:'فایل فنی به فاکتور اضافه شد.',
        details:{filename:original,original_bytes:input.length,stored_bytes:output.stored_bytes}});
      broadcastRealtimeEvent('orders.changed',{order_id:id});
      return {success:true,media_id:db.rows[0].id,original_bytes:input.length,stored_bytes:output.stored_bytes,
        compression_mode:output.compression_mode};
    } catch(e){
      await cleanMedia(output?[output]:[{stored_name:base+'.webp',thumbnail_name:base+'-thumb.webp'}]);
      request.log.error(e);
      return reply.code(422).send({error:'آپلود یا تبدیل تصویر ناموفق بود؛ پشتیبانی HEIC روی Docker بررسی شود.'});
    } finally{await fs.unlink(temp).catch(()=>{})}
  });
  fastify.get('/api/orders/:id/media/:mediaId/file',async(request,reply)=>{
    if(!requirePermission(request,reply,'orders.view'))return;
    const id=numeric(request.params.id),mid=numeric(request.params.mediaId);
    if(!id||!mid)return reply.code(400).send({error:'شناسه نامعتبر است.'});
    const db=await pool.query('SELECT * FROM invoice_media WHERE id=$1 AND order_id=$2',[mid,id]);
    if(!db.rowCount)return reply.code(404).send({error:'فایل پیدا نشد.'});
    const row=db.rows[0],thumbnail=request.query?.thumbnail==='1'&&row.thumbnail_name;
    const name=thumbnail?row.thumbnail_name:row.stored_name;
    try{
      await fs.access(diskPath(name));
      const disposition=request.query?.download==='1'?"attachment; filename=\"file\"; filename*=UTF-8''"+encodeURIComponent(safeName(row.original_name)):'inline';
      return reply.header('Content-Type',thumbnail?'image/webp':row.mime_type)
        .header('Content-Disposition',disposition).header('Cache-Control','no-store')
        .send(fss.createReadStream(diskPath(name)));
    }catch{return reply.code(404).send({error:'فایل روی دیسک پیدا نشد.'})}
  });
  fastify.delete('/api/orders/:id/media/:mediaId',async(request,reply)=>{
    if(!requirePermission(request,reply,'orders.view'))return;
    if(!isTech(request.user))return reply.code(403).send({error:'حذف فقط برای تکنسین فنی مجاز است.'});
    const id=numeric(request.params.id),mid=numeric(request.params.mediaId);
    if(!id||!mid)return reply.code(400).send({error:'شناسه نامعتبر است.'});
    const db=await pool.query('DELETE FROM invoice_media WHERE id=$1 AND order_id=$2 RETURNING *',[mid,id]);
    if(!db.rowCount)return reply.code(404).send({error:'فایل پیدا نشد.'});
    await cleanMedia(db.rows);
    const order=await pool.query('SELECT invoice_number FROM orders WHERE id=$1',[id]);
    await writeActivityLog({request,action_type:'order.media_deleted',entity_type:'order',
      entity_id:String(id),invoice_number:order.rows[0]?.invoice_number,message:'فایل فنی حذف شد.',
      details:{filename:db.rows[0].original_name}});
    broadcastRealtimeEvent('orders.changed',{order_id:id});
    return {success:true};
  });
}
module.exports={registerInvoiceMedia,initMediaTable,cleanMedia, __test:{sniff,isTech,diskPath}};