const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const {parseVideoRange,sendVideoRange,createVideoPreviewCache,__test}=require('../src/video-preview');
test('video byte ranges support open-ended, suffix, clamped and invalid requests',()=>{
  assert.deepEqual(parseVideoRange('bytes=0-99',1000),{start:0,end:99});
  assert.deepEqual(parseVideoRange('bytes=900-',1000),{start:900,end:999});
  assert.deepEqual(parseVideoRange('bytes=-20',1000),{start:980,end:999});
  assert.deepEqual(parseVideoRange('bytes=950-2000',1000),{start:950,end:999});
  assert.equal(parseVideoRange('bytes=1000-',1000),false);
  assert.equal(parseVideoRange('bytes=9-2',1000),false);
  assert.equal(parseVideoRange('bytes=-0',1000),false);
  assert.equal(parseVideoRange('bytes=0-1,4-6',1000),null);
  assert.equal(parseVideoRange(undefined,1000),null);
});
test('video streaming returns exactly requested bytes, 416 and HEAD without body',async()=>{
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'video-range-'));
  try{
    const file=path.join(dir,'sample.mp4');await fs.writeFile(file,Buffer.from('0123456789'));
    const reply=()=>({status:200,headers:{},code(n){this.status=n;return this;},header(k,v){this.headers[k]=v;return this;},send(data){this.data=data;return this;}});
    const part=reply();await sendVideoRange({method:'GET',headers:{range:'bytes=2-5'}},part,file,'video/mp4','sample');
    assert.equal(part.status,206);assert.equal(part.headers['Content-Range'],'bytes 2-5/10');assert.equal(part.headers['Content-Length'],'4');
    const chunks=[];for await(const chunk of part.data)chunks.push(chunk);assert.equal(Buffer.concat(chunks).toString(),'2345');
    const bad=reply();await sendVideoRange({method:'GET',headers:{range:'bytes=12-'}},bad,file,'video/mp4','sample');
    assert.equal(bad.status,416);assert.equal(bad.headers['Content-Range'],'bytes */10');assert.equal(bad.data,undefined);
    const head=reply();await sendVideoRange({method:'HEAD',headers:{}},head,file,'video/mp4','sample');
    assert.equal(head.headers['Content-Length'],'10');assert.equal(head.data,undefined);
  }finally{await fs.rm(dir,{recursive:true,force:true});}
});
test('compatibility encoding is bounded and preserves the original',()=>{
  const args=__test.conversionArgs('/original.mov','/copy.mp4');
  assert.ok(args.includes('libx264'));assert.ok(args.includes('aac'));assert.ok(args.includes('yuv420p'));
  assert.ok(args.includes('+faststart'));assert.ok(args.includes('-fs'));assert.equal(args.at(-1),'/copy.mp4');
  assert.equal(__test.durationFromProbe('{"format":{"duration":"12.5"}}'),12.5);
  assert.throws(()=>__test.durationFromProbe('{"format":{}}'));
});
test('cache reuses existing copy and removes it without modifying original',async()=>{
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'video-cache-'));
  try{
    const stored='a1234567-aaaa-4bbb-8ccc-123456789abc.mov',original=path.join(dir,stored);
    await fs.writeFile(original,'original');
    await fs.mkdir(path.join(dir,'.video-preview'));
    await fs.writeFile(path.join(dir,'.video-preview',stored+'.preview.mp4'),'compatibility');
    const cache=createVideoPreviewCache(dir,()=>{throw Error('must not encode cached file');});
    assert.deepEqual(await cache.prepare(stored,original),{status:'ready'});
    await cache.remove(stored);assert.equal(await cache.existing(stored),null);
    assert.equal(await fs.readFile(original,'utf8'),'original');
  }finally{await fs.rm(dir,{recursive:true,force:true});}
});

test('video cache serializes conversions, shares pending status and reuses result',async()=>{
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'video-cache-queue-'));
  try{
    const first='a1234567-aaaa-4bbb-8ccc-123456789abc.mov',second='b1234567-aaaa-4bbb-8ccc-123456789abc.webm';
    const a=path.join(dir,first),b=path.join(dir,second);
    await fs.writeFile(a,'original A');await fs.writeFile(b,'original B');
    let release,started;
    const entered=new Promise(resolve=>{started=resolve;});
    const gate=new Promise(resolve=>{release=resolve;});
    let conversions=0;
    const cache=createVideoPreviewCache(dir,async(program,args)=>{
      if(program==='ffprobe')return '{"format":{"duration":"2"}}';
      conversions++;started();await gate;await fs.writeFile(args.at(-1),'valid copy');
    });
    assert.deepEqual(await cache.prepare(first,a),{status:'processing'});
    await entered;
    assert.deepEqual(await cache.prepare(first,a),{status:'processing'});
    assert.deepEqual(await cache.prepare(second,b),{status:'busy'});
    release();
    let result;
    for(let i=0;i<100;i++){result=await cache.prepare(first,a);if(result.status==='ready')break;await new Promise(resolve=>setTimeout(resolve,10));}
    assert.deepEqual(result,{status:'ready'});assert.equal(conversions,1);
    assert.equal(await fs.readFile(a,'utf8'),'original A');
  }finally{await fs.rm(dir,{recursive:true,force:true});}
});
