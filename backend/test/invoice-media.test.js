const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { Readable } = require('node:stream');
const mediaTestRoot=fs.mkdtempSync(path.join(os.tmpdir(),'portal-media-test-'));
process.env.PORTAL_MEDIA_DIR=mediaTestRoot;
require('node:test').after(()=>fs.rmSync(mediaTestRoot,{recursive:true,force:true}));
const {
  __test: { canMedia, validDisplayName, parseSerials, canonicalSerial, downloadName, looksLike, extension, storedPath }
} = require('../src/invoice-media');

const { normalizePermissions, PERMISSION_CATALOG } = require('../src/security/permissions');
test('one management permission controls upload, edit and delete', () => {
  for (const role of ['sales','technician','admin']) {
    const reader = {roles:[role],permissions:{'orders.media':false}};
    const manager = {roles:[role],permissions:{'orders.media':true}};
    for (const action of ['upload','edit','delete']) {
      assert.equal(canMedia(reader,action),false);
      assert.equal(canMedia(manager,action),true);
    }
  }
  assert.equal(canMedia({roles:['sales'],permissions:{'media.upload':true}},'upload'),false);
});
test('management permission appears under order operations with correct defaults', () => {
  assert.equal(PERMISSION_CATALOG.find(x=>x.code==='orders.media')?.group,'عملیات فاکتور');
  assert.equal(PERMISSION_CATALOG.some(x=>x.code.startsWith('media.')),false);
  assert.equal(normalizePermissions(['technician'],{})['orders.media'],true);
  assert.equal(normalizePermissions(['sales'],{})['orders.media'],false);
  assert.equal(normalizePermissions(['admin'],{})['orders.media'],true);
  assert.equal(normalizePermissions(['sales'],{'orders.media':true})['orders.media'],true);
  assert.equal(normalizePermissions(['technician'],{'orders.media':false})['orders.media'],false);
});
test('legacy upload/edit/delete permissions are migrated without privilege escalation', () => {
  const all={'media.upload':true,'media.edit':true,'media.delete':true};
  assert.equal(normalizePermissions(['technician'],all)['orders.media'],true);
  assert.equal(normalizePermissions(['sales'],all)['orders.media'],true);
  assert.equal(normalizePermissions(['technician'],{...all,'media.delete':false})['orders.media'],false);
  assert.equal(normalizePermissions(['admin'],{'media.upload':false})['orders.media'],false);
  assert.equal(normalizePermissions(['sales'],{'media.upload':true})['orders.media'],false);
  assert.equal(normalizePermissions(['technician'],{...all,'orders.media':false})['orders.media'],false);
});
test('metadata rename validation keeps file extension and prevents dangerous names',()=>{
  assert.equal(validDisplayName('گزارش سرور.pdf','pdf'),'گزارش سرور.pdf');
  assert.equal(validDisplayName('report.exe','pdf'),'');
  assert.equal(validDisplayName('../server.pdf','pdf'),'');
  assert.equal(validDisplayName('  ','pdf'),'');
  assert.equal(validDisplayName('report.pdf','pdf'),'report.pdf');
});
test('serial list preserves the exact order from serial management', () => {
  assert.deepEqual(parseSerials('2M201002KG, 3Q001, 1A002'),['2M201002KG','3Q001','1A002']);
  assert.deepEqual(parseSerials(''),[]);
});
test('serial validation accepts real hardware serials and rejects path injection', () => {
  assert.equal(canonicalSerial('2m201002kg'),'2M201002KG');
  assert.equal(canonicalSerial('..\\\\file'),'');
  assert.equal(canonicalSerial('../etc'),'');
});
test('invoice attachments use invoice prefix and sequence', () => {
  assert.equal(downloadName('40428','invoice',null,1,'jpg'),'40428-01.jpg');
  assert.equal(downloadName('40428','invoice',null,2,'pdf'),'40428-02.pdf');
  assert.equal(downloadName('40428','invoice',null,101,'docx'),'40428-101.docx');
});
test('server attachments use serial prefix and sequence, not invoice prefix', () => {
  assert.equal(downloadName('40428','serial','2M201002KG',1,'jpg'),'2M201002KG-01.jpg');
  assert.equal(downloadName('40428','serial','2M201002KG',2,'pdf'),'2M201002KG-02.pdf');
  assert.equal(downloadName('40428','serial','2M201002KG',3,'mp4'),'2M201002KG-03.mp4');
});
test('format signatures reject mismatched extensions', () => {
  const jpg = Buffer.from([255,216,255,224,0,16]);
  assert.equal(looksLike('jpg',jpg),true);
  assert.equal(looksLike('pdf',jpg),false);
  assert.equal(looksLike('pdf',Buffer.from('%PDF-1.7')),true);
  assert.equal(looksLike('docx',Buffer.from('PK\u0003\u0004')),true);
  assert.equal(looksLike('mp4',Buffer.from('0000ftypisom')),true);
  assert.equal(looksLike('heic',Buffer.from('0000ftypheic')),true);
  assert.equal(extension('Server.PDF'),'pdf');
});
test('stored file paths cannot escape media directory', () => {
  assert.throws(()=>storedPath('../private.txt'));
  assert.throws(()=>storedPath('../../etc/passwd'));
  assert.match(storedPath('a1234567-aaaa-4bbb-8ccc-123456789abc.pdf'),/\.pdf$/);
});

test('image and video thumbnail names remain inside media directory', () => {
  const webp = storedPath('a1234567-aaaa-4bbb-8ccc-123456789abc-thumb.webp');
  const jpg = storedPath('a1234567-aaaa-4bbb-8ccc-123456789abc-thumb.jpg');
  assert.match(webp, /-thumb\.webp$/);
  assert.match(jpg, /-thumb\.jpg$/);
  assert.throws(() => storedPath('../image-thumb.webp'));
});

function mockMediaApp() {
  const handlers=new Map();
  const app={addContentTypeParser(){}};
  for(const method of ['get','post','patch','put','delete']){
    app[method]=(route,opts,handler)=>handlers.set(method.toUpperCase()+' '+route,handler||opts);
  }
  const queries=[];
  const pool={query:async(sql,args=[])=>{
    queries.push({sql,args});
    if(sql.includes('SELECT invoice_number,serials FROM orders'))return {rowCount:1,rows:[{invoice_number:'12345',serials:'SER1,SER2'}]};
    if(sql.includes('SELECT serials FROM orders'))return {rowCount:1,rows:[{serials:'SER1,SER2'}]};
    if(sql.includes('SELECT id,original_name,COALESCE(download_name'))return {rowCount:1,rows:[{
      id:5,original_name:'old.pdf',download_name:'SER1-01.pdf',mime_type:'application/pdf',stored_bytes:1000,media_scope:'serial',serial_number:'SER1',created_at:new Date('2026-10-28T06:53:00Z')
    }]};
    if(sql.includes('SELECT original_name,download_name FROM invoice_media'))return {rowCount:1,rows:[{original_name:'old.pdf',download_name:'SER1-01.pdf'}]};
    if(sql.includes('UPDATE invoice_media SET original_name='))return {rowCount:1,rows:[{id:5,original_name:args[0]}]};
    if(sql.includes('SELECT invoice_number FROM orders'))return {rowCount:1,rows:[{invoice_number:'12345'}]};
    if(sql.includes('SELECT id FROM invoice_media WHERE order_id=$1 AND id=$2'))return {rowCount:1,rows:[{id:5}]};
    return {rowCount:0,rows:[]};
  }};
  const requirePermission=(req,reply,code)=>{
    if(req.user?.permissions?.[code])return true;
    reply.code(403).send({error:'Forbidden'});return false;
  };
  const {registerInvoiceMedia}=require('../src/invoice-media');
  const actions=[],events=[];
  registerInvoiceMedia(app,{pool,requirePermission,writeActivityLog:async log=>actions.push(log),broadcastRealtimeEvent:(...args)=>events.push(args)});
  return {handlers,queries,actions,events};
}
function mockReply() {
  return {statusCode:200,data:undefined,code(status){this.statusCode=status;return this;},send(body){this.data=body;return body;}};
}
test('all authenticated categories can list attachments without technician or order-edit privileges',async()=>{
  const {handlers}=mockMediaApp();
  for(const role of ['sales','technician','admin']){
    const user={role,roles:[role],permissions:{'orders.view':false}};
    const response=await handlers.get('GET /api/orders/:id/media')({user,params:{id:'2'}},mockReply());
    assert.equal(response.files.length,1);
    assert.equal(response.can_upload,false);
    assert.equal(response.can_edit,false);
    assert.equal(response.can_delete,false);
    assert.deepEqual(response.serials,['SER1','SER2']);
    const {toJalaliDateTime}=require('../src/utils/jalali-date');
    assert.equal(response.files[0].created_at_jalali,toJalaliDateTime(new Date('2026-10-28T06:53:00Z')));
    assert.match(response.files[0].created_at_jalali,/^\d{4}\/\d{2}\/\d{2} - \d{2}:\d{2}$/);
  }
});
test('backend blocks upload, edit, replace and delete when permission is revoked',async()=>{
  const {handlers,queries}=mockMediaApp();
  const request={user:{roles:['technician'],permissions:{}},params:{id:'2',mediaId:'5'},body:{original_name:'new.pdf'}};
  for(const [method,route] of [
    ['POST','/api/orders/:id/media'],
    ['PATCH','/api/orders/:id/media/:mediaId'],
    ['PUT','/api/orders/:id/media/:mediaId/content'],
    ['DELETE','/api/orders/:id/media/:mediaId']
  ]){
    const reply=mockReply();
    await handlers.get(method+' '+route)(request,reply);
    assert.equal(reply.statusCode,403,method+' '+route);
  }
  assert.equal(queries.length,0,'denied operations never access the database or filesystem');
});
test('read-only users can list and download files without the management right',async()=>{
  const {handlers}=mockMediaApp();
  const user={role:'sales',roles:['sales'],permissions:{'orders.media':false}};
  const listing=await handlers.get('GET /api/orders/:id/media')({user,params:{id:'2'}},mockReply());
  assert.equal(listing.files.length,1);
  for(const name of ['can_upload','can_edit','can_delete','can_manage'])assert.equal(listing[name],false);
  const response=await handlers.get('POST /api/orders/:id/media/ticket')({
    user,params:{id:'2'},body:{kind:'file',file_id:5}
  },mockReply());
  assert.match(response.url,/^\/api\/media-transfer\//);
});

test('a non-technician with management permission can rename a file without activity logging',async()=>{
  const {handlers,queries,actions,events}=mockMediaApp();
  const request={user:{role:'sales',roles:['sales'],permissions:{'orders.media':true}},params:{id:'2',mediaId:'5'},body:{original_name:'گزارش جدید.pdf'}};
  const reply=mockReply();
  const result=await handlers.get('PATCH /api/orders/:id/media/:mediaId')(request,reply);
  assert.equal(result.success,true);
  assert.equal(result.media.original_name,'گزارش جدید.pdf');
  assert.ok(queries.some(q=>q.sql.includes('UPDATE invoice_media SET original_name=')));
  assert.equal(actions.length,0);
  assert.deepEqual(events,[['orders.changed',{order_id:2}]]);
  const bad=mockReply();
  await handlers.get('PATCH /api/orders/:id/media/:mediaId')({...request,body:{original_name:'bad.exe'}},bad);
  assert.equal(bad.statusCode,400);
});


test('replacement preserves group/ID, removes old bytes after commit and skips activity logging', async()=>{
  const oldStored='a1234567-aaaa-4bbb-8ccc-123456789abc.pdf';
  fs.writeFileSync(storedPath(oldStored),'old content');
  const current={id:5,order_id:2,stored_name:oldStored,thumbnail_name:null,thumbnail_bytes:0,
    original_name:'old.pdf',download_name:'SER1-01.pdf',original_bytes:11,stored_bytes:11,
    media_scope:'serial',serial_number:'SER1',sequence_number:1};
  let updateArgs=null,committed=false;
  const client={
    query:async(sql,args=[])=>{
      if(sql.includes('SELECT * FROM invoice_media WHERE id=$1 AND order_id=$2 FOR UPDATE'))return {rowCount:1,rows:[current]};
      if(sql.includes('AND source_hash=$4 AND id<>$5'))return {rowCount:0,rows:[]};
      if(sql.includes('SELECT COALESCE(SUM(stored_bytes+thumbnail_bytes)'))return {rowCount:1,rows:[{total:11}]};
      if(sql.includes('SELECT invoice_number FROM orders'))return {rowCount:1,rows:[{invoice_number:'12345'}]};
      if(sql.includes('UPDATE invoice_media SET stored_name='))updateArgs=args;
      if(sql==='COMMIT')committed=true;
      return {rowCount:1,rows:[]};
    },release:()=>{}
  };
  const pool={query:async(sql)=>({rowCount:1,rows:[{id:5}]}),connect:async()=>client};
  const {registerInvoiceMedia}=require('../src/invoice-media');
  const handlers=new Map(),app={addContentTypeParser(){}};
  for(const method of ['get','post','put','patch','delete'])app[method]=(route,opts,callback)=>handlers.set(method.toUpperCase()+' '+route,callback||opts);
  const actions=[],events=[];
  registerInvoiceMedia(app,{pool,requirePermission:(req,reply,perm)=>Boolean(req.user.permissions[perm]),
    writeActivityLog:async log=>actions.push(log),broadcastRealtimeEvent:(...args)=>events.push(args)});
  const bytes=Buffer.from('%PDF-1.7\nReplacement contents\n');
  const request={params:{id:'2',mediaId:'5'},user:{id:9,username:'agent',full_name:'کارشناس فروش',permissions:{'orders.media':true}},
    headers:{'x-file-name':encodeURIComponent('new.pdf'),'x-display-name':encodeURIComponent('گزارش نهایی.pdf'),'content-length':String(bytes.length)},
    body:Readable.from([bytes]),log:{error:e=>{throw e}}};
  const reply=mockReply();
  const result=await handlers.get('PUT /api/orders/:id/media/:mediaId/content')(request,reply);
  assert.equal(result.success,true);
  assert.equal(committed,true);
  assert.equal(result.media_id,5);
  assert.equal(result.download_name,'SER1-01.pdf');
  assert.equal(updateArgs[1],'گزارش نهایی.pdf');
  assert.equal(updateArgs[8],5);
  assert.deepEqual(fs.readFileSync(storedPath(updateArgs[0])),bytes);
  assert.equal(fs.existsSync(storedPath(oldStored)),false);
  assert.equal(actions.length,0);
  assert.deepEqual(events,[['orders.changed',{order_id:2}]]);
});

test('PDF viewer uses authenticated media routes, validates pages and returns PNG without changing originals',async()=>{
  const stored='b1234567-aaaa-4bbb-8ccc-123456789abc.pdf';
  const original=Buffer.from('%PDF-1.7\nexample\n');
  fs.writeFileSync(storedPath(stored),original);
  const png=Buffer.from([137,80,78,71,13,10,26,10,0,0,0,0]);
  const handlers=new Map(),app={addContentTypeParser(){}};
  for(const method of ['get','post','put','patch','delete'])app[method]=(route,opts,callback)=>handlers.set(method.toUpperCase()+' '+route,callback||opts);
  const calls=[];
  const pool={query:async(sql,args)=>({rowCount:args[0]===2&&args[1]===5?1:0,rows:[{stored_name:stored,mime_type:'application/pdf'}]})};
  const {registerInvoiceMedia}=require('../src/invoice-media');
  registerInvoiceMedia(app,{pool,requirePermission:()=>false,writeActivityLog:async()=>{},broadcastRealtimeEvent:()=>{},
    pdfCommand:async(program,args)=>{calls.push({program,args});return program==='pdfinfo'?Buffer.from('Pages: 3\n'):png;}});
  const meta=handlers.get('GET /api/orders/:id/media/:mediaId/pdf-preview');
  const page=handlers.get('GET /api/orders/:id/media/:mediaId/pdf-preview/:page');
  const request={params:{id:'2',mediaId:'5',page:'2'},user:{permissions:{}},log:{warn(){}}};
  const makeReply=()=>Object.assign(mockReply(),{headers:{},header(key,value){this.headers[key]=value;return this;}});
  assert.deepEqual(await meta(request,makeReply()),{pages:3});
  const reply=makeReply();await page(request,reply);
  assert.equal(reply.headers['Content-Type'],'image/png');assert.deepEqual(reply.data,png);
  assert.ok(calls.some(x=>x.program==='pdftoppm'&&x.args.includes('2')&&x.args.includes('-singlefile')));
  const bad=makeReply();await page({...request,params:{...request.params,page:'4'}},bad);assert.equal(bad.statusCode,404);
  const invalid=makeReply();await page({...request,params:{...request.params,page:'../1'}},invalid);assert.equal(invalid.statusCode,400);
  const other=makeReply();await meta({...request,params:{...request.params,id:'3'}},other);assert.equal(other.statusCode,404);
  assert.deepEqual(fs.readFileSync(storedPath(stored)),original);
});

// All mutation handlers must remain free of activity logging, including upload and delete.
test('media mutation routes do not reference the activity logger or insert activity rows',()=>{
  const source=fs.readFileSync(require.resolve('../src/invoice-media'),'utf8');
  assert.doesNotMatch(source,/writeActivityLog|INSERT\s+INTO\s+activity_logs/i);
  const appSource=fs.readFileSync(require.resolve('../src/app'),'utf8');
  assert.doesNotMatch(appSource,/'order\.media_(?:uploaded|edited|deleted)'/);
});

// The same order/scope constraint is applied both when issuing and redeeming a selected ZIP.
test('selected ZIP validates exact IDs and never falls back to the whole group',async()=>{
  const handlers=new Map(),queries=[];
  const app={addContentTypeParser(){}};
  for(const method of ['get','post','put','patch','delete'])app[method]=(route,opts,callback)=>handlers.set(method.toUpperCase()+' '+route,callback||opts);
  const rows=[{id:5,order:2,scope:'serial',serial:'SER1'},{id:6,order:2,scope:'serial',serial:'SER1'},{id:7,order:2,scope:'serial',serial:'SER2'},{id:8,order:2,scope:'invoice',serial:''},{id:9,order:3,scope:'serial',serial:'SER1'}];
  let removed=false;
  const pool={query:async(sql,args)=>{
    queries.push({sql,args});
    if(sql.includes('SELECT serials FROM orders'))return {rowCount:1,rows:[{serials:'SER1,SER2'}]};
    const matches=rows.filter(r=>r.order===args[0]&&r.scope===args[1]&&r.serial===args[2]&&(!args[3]||args[3].includes(r.id))&&!(removed&&r.id===5));
    return {rowCount:matches.length,rows:matches};
  }};
  require('../src/invoice-media').registerInvoiceMedia(app,{pool,requirePermission:()=>false,broadcastRealtimeEvent:()=>{}});
  const issue=handlers.get('POST /api/orders/:id/media/ticket');
  const transfer=handlers.get('GET /api/media-transfer/:ticket');
  const req={params:{id:'2'},user:{permissions:{}},body:{kind:'zip',scope:'serial',serial_number:'SER1'}};
  for(const file_ids of [[],null,'5',[true],[0],[1.5],['5x'],Array(1001).fill(5)]){
    const reply=mockReply();await issue({...req,body:{...req.body,file_ids}},reply);
    assert.equal(reply.statusCode,400);
  }
  for(const file_ids of [[5,7],[5,8],[5,9],[999]]){
    const reply=mockReply();await issue({...req,body:{...req.body,file_ids}},reply);
    assert.equal(reply.statusCode,404);
  }
  const success=await issue({...req,body:{...req.body,file_ids:['5',5]}},mockReply());
  assert.match(success.url,/^\/api\/media-transfer\//);
  assert.deepEqual(queries.at(-1).args,[2,'serial','SER1',[5]]);
  assert.match(queries.at(-1).sql,/id=ANY\(\$4::bigint\[\]\)/);
  removed=true;
  const expiredSelection=mockReply();await transfer({params:{ticket:success.url.split('/').pop()}},expiredSelection);
  assert.equal(expiredSelection.statusCode,404);
  assert.deepEqual(queries.at(-1).args,[2,'serial','SER1',[5]]);
  assert.match(queries.at(-1).sql,/id=ANY\(\$4::bigint\[\]\)/);
  const all=await issue(req,mockReply());
  assert.match(all.url,/^\/api\/media-transfer\//);
  assert.equal(queries.at(-1).args.length,3);
  const invoice=await issue({...req,body:{kind:'zip',scope:'invoice',file_ids:[8]}},mockReply());
  assert.match(invoice.url,/^\/api\/media-transfer\//);
  assert.deepEqual(queries.at(-1).args,[2,'invoice','',[8]]);
});
