const test=require('node:test');
const assert=require('node:assert/strict');
const {pdfAssetPath}=require('../src/document-preview');
test('document library route allows only viewer assets and denies traversal',()=>{
  for(const asset of ['legacy/build/pdf.mjs','legacy/build/pdf.worker.mjs','web/pdf_viewer.css','cmaps/UniJIS-UTF16-H.bcmap','standard_fonts/FoxitSans.pfb','wasm/openjpeg.wasm'])assert.ok(pdfAssetPath(asset),asset);
  for(const asset of ['../package.json','web/../package.json','legacy/build/../../server.js','/etc/passwd','package.json','web/pdf_viewer.html',''])assert.equal(pdfAssetPath(asset),null,asset);
});

test('PDF document route returns real bytes with HTTP 200 and Range returns 206',async()=>{
  const fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
  const {registerDocumentPreview}=require('../src/document-preview');
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'portal-pdf-response-'));
  try{
    const stored='sample.pdf',original=Buffer.from('%PDF-1.7\nexample PDF bytes\n%%EOF\n');
    await fs.writeFile(path.join(dir,stored),original);
    const routes=new Map();
    registerDocumentPreview({get:(url,handler)=>routes.set(url,handler),post:(url,handler)=>routes.set(url,handler)},{
      pool:{query:async(sql,args)=>({rowCount:args[0]===259&&args[1]===5?1:0,rows:[{stored_name:stored,mime_type:'application/pdf'}]})},
      storedPath:name=>path.join(dir,name),validId:v=>Number.isSafeInteger(Number(v))&&Number(v)>0?Number(v):null,
      fail:(reply,code,error)=>reply.code(code).send({error})
    });
    const handler=routes.get('/api/orders/:id/media/:mediaId/document-preview');
    const response=()=>({status:0,headers:{},code(n){this.status=n;return this;},header(k,v){this.headers[k]=v;return this;},send(data){this.data=data;return this;}});
    const base={params:{id:'259',mediaId:'5'},method:'GET',headers:{}};
    const all=response();await handler(base,all);assert.equal(all.status,200);assert.equal(all.headers['Content-Type'],'application/pdf');assert.equal(all.headers['Content-Disposition'],'inline');
    const collect=async stream=>{const out=[];for await(const chunk of stream)out.push(chunk);return Buffer.concat(out);};
    assert.deepEqual(await collect(all.data),original);
    const partial=response();await handler({...base,headers:{range:'bytes=0-7'}},partial);
    assert.equal(partial.status,206);assert.equal(partial.headers['Content-Range'],'bytes 0-7/'+original.length);assert.deepEqual(await collect(partial.data),original.subarray(0,8));
    const invalid=response();await handler({...base,headers:{range:'bytes=999-'}},invalid);assert.equal(invalid.status,416);
    const missing=response();await handler({...base,params:{id:'260',mediaId:'5'}},missing);assert.equal(missing.status,404);
    const json=routes.get('/api/orders/:id/media/:mediaId/document-data');
    const first=response();await json({...base,method:'POST',body:{offset:0,length:8}},first);
    assert.equal(first.status,200);assert.equal(first.headers['Content-Type'],'application/json; charset=utf-8');assert.equal(first.headers['Content-Disposition'],undefined);
    assert.equal(first.data.kind,'pdf-chunk');assert.equal(first.data.total,original.length);assert.deepEqual(Buffer.from(first.data.data,'base64'),original.subarray(0,8));
    const rest=response();await json({...base,method:'POST',body:{offset:8,length:1024,version:first.data.version}},rest);
    assert.deepEqual(Buffer.concat([Buffer.from(first.data.data,'base64'),Buffer.from(rest.data.data,'base64')]),original);
    for(const body of [{offset:-1,length:8},{offset:0,length:1048577},{offset:0,length:0}]){
      const bad=response();await json({...base,method:'POST',body},bad);assert.equal(bad.status,400);
    }
    const changed=response();await json({...base,method:'POST',body:{offset:0,length:8,version:'old'}},changed);assert.equal(changed.status,409);
    const outside=response();await json({...base,method:'POST',body:{offset:999,length:8}},outside);assert.equal(outside.status,416);
  }finally{await fs.rm(dir,{recursive:true,force:true});}
});

test('Office JSON streaming preserves base64 across uneven chunk boundaries',async()=>{
  const {officeJsonStream}=require('../src/document-preview');
  const original=Buffer.from('%PDF-1.7\nOffice data\n');
  const source=[original.subarray(0,1),original.subarray(1,5),original.subarray(5,12),original.subarray(12)];
  let result='';for await(const value of officeJsonStream(source,original.length))result+=value;
  const obj=JSON.parse(result);assert.equal(obj.kind,'office');assert.equal(obj.total,original.length);
  assert.deepEqual(Buffer.from(obj.data,'base64'),original);
  await assert.rejects(async()=>{for await(const value of officeJsonStream(source,original.length+1)){}});
});
