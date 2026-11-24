'use strict';
// Video originals are never modified. Compatibility copies are local, bounded and disposable.
const fs=require('node:fs/promises');
const path=require('node:path');
const {execFile}=require('node:child_process');
const {randomUUID}=require('node:crypto');
const GiB=1024**3,MiB=1024**2;
const MAX_COPY=500*MiB,CACHE_LIMIT=2*GiB,DISK_RESERVE=2*GiB;
const PROTECTED_AGE=30*60*1000,MAX_AGE=7*24*60*60*1000;
function parseVideoRange(header,size){
  if(!header)return null;
  if(!Number.isSafeInteger(size)||size<0)return false;
  const value=String(header).trim();
  // Ignore unsupported units or multiple ranges, as allowed by HTTP semantics.
  if(!/^bytes=/i.test(value)||value.includes(','))return null;
  const m=/^bytes=(\d*)-(\d*)$/i.exec(value);
  if(!m||(!m[1]&&!m[2])||size===0)return false;
  let start,end;
  if(!m[1]){
    const suffix=Number(m[2]);if(!Number.isSafeInteger(suffix)||suffix<=0)return false;
    start=Math.max(0,size-suffix);end=size-1;
  }else{
    start=Number(m[1]);end=m[2]?Number(m[2]):size-1;
    if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start>=size||end<start)return false;
    end=Math.min(end,size-1);
  }
  return {start,end};
}
async function sendVideoRange(request,reply,filepath,mime,version){
  const handle=await fs.open(filepath,'r');
  let handedOff=false;
  try{
    const stat=await handle.stat();
    const size=stat.size;
    if(!stat.isFile()||size<1)return reply.code(404).send({error:'فایل ویدیو موجود نیست.'});
    const etag='"'+version+'-'+size+'"';
    const headers=request.headers||{};
    const range=parseVideoRange(headers['if-range']&&headers['if-range']!==etag?null:headers.range,size);
    reply.header('Accept-Ranges','bytes').header('Content-Type',mime)
      .header('Content-Disposition','inline').header('Cache-Control','private, no-store')
      .header('X-Content-Type-Options','nosniff').header('Referrer-Policy','no-referrer').header('ETag',etag);
    if(range===false)return reply.code(416).header('Content-Range','bytes */'+size).header('Content-Length','0').send();
    if(range){
      reply.code(206).header('Content-Range','bytes '+range.start+'-'+range.end+'/'+size)
        .header('Content-Length',String(range.end-range.start+1));
    }else reply.code(200).header('Content-Length',String(size));
    if(request.method==='HEAD')return reply.send();
    const stream=handle.createReadStream(range||{});
    const stop=()=>stream.destroy();
    reply.raw?.once?.('close',stop);
    stream.once('close',()=>reply.raw?.removeListener?.('close',stop));
    const result=reply.send(stream);handedOff=true;return result;
  }finally{if(!handedOff)await handle.close().catch(()=>{});}
}
function command(program,args,timeout=30000){
  return new Promise((resolve,reject)=>{
    execFile(program,args,{timeout,killSignal:'SIGKILL',maxBuffer:1024*1024,encoding:'utf8',
      env:{...process.env,LC_ALL:'C'}},(error,stdout)=>error?reject(error):resolve(stdout));
  });
}
function durationFromProbe(stdout){
  const d=Number(JSON.parse(stdout).format?.duration);
  if(!Number.isFinite(d)||d<=0)throw Error('Unknown video duration');
  return d;
}
function conversionArgs(source,destination){
  return ['-nostdin','-hide_banner','-loglevel','error','-y','-threads','2','-filter_threads','1',
    '-protocol_whitelist','file,pipe','-i',source,'-map','0:v:0','-map','0:a:0?',
    '-sn','-dn','-map_metadata','-1','-map_chapters','-1',
    '-vf',"scale=w='min(1280,iw)':h='min(720,ih)':force_original_aspect_ratio=decrease:force_divisible_by=2",
    '-c:v','libx264','-preset','veryfast','-crf','24','-pix_fmt','yuv420p',
    '-maxrate','1800k','-bufsize','3600k','-threads','2','-c:a','aac','-b:a','96k','-ac','2',
    '-movflags','+faststart','-fs',String(MAX_COPY),'-f','mp4',destination];
}
function createVideoPreviewCache(root,run=command){
  const dir=path.join(root,'.video-preview');
  let active=null,failed=new Map();
  function cachePath(stored){
    if(!/^[a-f0-9-]{36}\.(?:mp4|m4v|mov|webm)$/.test(String(stored)))throw Error('Invalid video storage key');
    return path.join(dir,stored+'.preview.mp4');
  }
  async function existing(stored,touch=false){
    const file=cachePath(stored);
    try{
      const stat=await fs.stat(file);
      if(!stat.isFile()||!stat.size||stat.size>MAX_COPY)return null;
      if(touch&&Date.now()-stat.mtimeMs>60000)await fs.utimes(file,new Date(),new Date()).catch(()=>{});
      return file;
    }catch(error){if(error.code==='ENOENT')return null;throw error;}
  }
  async function makeRoom(){
    await fs.mkdir(dir,{recursive:true,mode:0o700});
    const entries=[];
    for(const entry of await fs.readdir(dir,{withFileTypes:true})){
      if(!entry.isFile())continue;
      const file=path.join(dir,entry.name);
      if(/^[a-f0-9-]{36}\.part\.mp4$/.test(entry.name)){await fs.unlink(file).catch(()=>{});continue;}
      if(!/^[a-f0-9-]{36}\.(mp4|m4v|mov|webm)\.preview\.mp4$/.test(entry.name))continue;
      try{const stat=await fs.stat(file);entries.push({file,size:stat.size,mtime:stat.mtimeMs});}catch(error){if(error.code!=='ENOENT')throw error;}
    }
    let total=entries.reduce((sum,e)=>sum+e.size,0);
    for(const entry of entries.sort((a,b)=>a.mtime-b.mtime)){
      if(Date.now()-entry.mtime<PROTECTED_AGE)continue;
      if(Date.now()-entry.mtime>MAX_AGE||total+MAX_COPY>CACHE_LIMIT){
        try{await fs.unlink(entry.file);total-=entry.size;}catch(error){if(error.code!=='ENOENT')throw error;total-=entry.size;}
      }
    }
    const disk=await fs.statfs(root);
    if(total+MAX_COPY>CACHE_LIMIT||Number(disk.bavail)*Number(disk.bsize)<DISK_RESERVE+2*MAX_COPY)
      throw Error('VIDEO_CACHE_SPACE');
  }
  async function convert(stored,source,job){
    await makeRoom();
    const target=cachePath(stored),temp=path.join(dir,randomUUID()+'.part.mp4');
    const probe=file=>run('ffprobe',['-v','error','-protocol_whitelist','file,pipe','-show_entries','format=duration','-of','json',file]);
    try{
      const duration=durationFromProbe(await probe(source));
      await run('ffmpeg',conversionArgs(source,temp),15*60*1000);
      const stat=await fs.stat(temp),outputDuration=durationFromProbe(await probe(temp));
      // Reject a truncated output caused by the disk size cap.
      if(!stat.size||stat.size>MAX_COPY||outputDuration<duration-Math.max(1,Math.min(3,duration*.02)))
        throw Error('Incomplete compatibility video');
      await fs.access(source);
      if(job.cancelled)throw Error('Video source was removed');
      await fs.rename(temp,target);
      if(job.cancelled){await fs.unlink(target).catch(()=>{});throw Error('Video source was removed');}
      return target;
    }finally{await fs.unlink(temp).catch(()=>{});}
  }
  async function prepare(stored,source,retry=false){
    const ready=await existing(stored,true);
    if(ready)return {status:'ready'};
    const now=Date.now();
    for(const [key,value] of failed)if(now-value.time>60000)failed.delete(key);
    if(active)return {status:active.stored===stored?'processing':'busy'};
    if(retry)failed.delete(stored);
    if(failed.has(stored))return {status:'failed',reason:failed.get(stored).reason};
    // Reserve before starting asynchronous work; one transcoder per app process.
    const job={stored,cancelled:false};active=job;
    job.promise=convert(stored,source,job).catch(error=>{
      if(job.cancelled)return;
      if(failed.size>=32)failed.delete(failed.keys().next().value);
      failed.set(stored,{time:Date.now(),reason:error.message==='VIDEO_CACHE_SPACE'?'space':'conversion'});
    }).finally(()=>{if(active===job)active=null;});
    return {status:'processing'};
  }
  async function remove(stored){
    if(!/^[a-f0-9-]{36}\.(?:mp4|m4v|mov|webm)$/.test(String(stored)))return;
    if(active?.stored===stored)active.cancelled=true;
    failed.delete(stored);await fs.unlink(cachePath(stored)).catch(()=>{});
  }
  return {prepare,existing,remove};
}
module.exports={parseVideoRange,sendVideoRange,createVideoPreviewCache,__test:{conversionArgs,durationFromProbe}};
