'use strict';
// Isolated, read-only container, no external network or original media mount.
const http=require('node:http'),fs=require('node:fs'),fsp=require('node:fs/promises'),path=require('node:path');
const {Transform}=require('node:stream'),{pipeline}=require('node:stream/promises'),{spawn}=require('node:child_process'),{pathToFileURL}=require('node:url');
const allowed=new Set('doc docx xls xlsx ppt pptx rtf odt ods'.split(' ')),limit=64*1024*1024;
let busy=false;
function run(args,signal){
  return new Promise((resolve,reject)=>{
    const child=spawn('soffice',args,{detached:true,stdio:'ignore',env:{...process.env,HOME:'/tmp',SAL_USE_VCLPLUGIN:'svp'}});
    const kill=()=>{try{process.kill(-child.pid,'SIGKILL');}catch{}};
    const timer=setTimeout(kill,80000);
    const done=()=>{clearTimeout(timer);signal.removeEventListener('abort',kill);};
    child.once('error',error=>{done();reject(error);});
    child.once('close',code=>{done();code===0&&!signal.aborted?resolve():reject(Error('Conversion failed'));});
    signal.addEventListener('abort',kill,{once:true});if(signal.aborted)kill();
  });
}
const server=http.createServer(async(req,res)=>{
  const ext=req.url.match(/^\/convert\/([a-z0-9]+)$/)?.[1],size=Number(req.headers['content-length']);
  const error=code=>{if(res.destroyed)return;if(!res.headersSent){res.writeHead(code);res.end();}else res.destroy();};
  if(req.method!=='POST'||!allowed.has(ext))return error(404);
  if(!Number.isSafeInteger(size)||size<1||size>limit)return error(413);
  if(busy)return error(503);
  busy=true;let dir;
  const controller=new AbortController();
  res.once('close',()=>{if(!res.writableFinished)controller.abort();});
  try{
    dir=await fsp.mkdtemp('/tmp/portal-doc-');
    const source=path.join(dir,'document.'+ext),profile=path.join(dir,'profile');
    await fsp.mkdir(path.join(profile,'user'),{recursive:true});
    await fsp.writeFile(path.join(profile,'user','registrymodifications.xcu'),'<?xml version="1.0" encoding="UTF-8"?><oor:items xmlns:oor="http://openoffice.org/2001/registry"><item oor:path="/org.openoffice.Office.Common/Security/Scripting"><prop oor:name="MacroSecurityLevel" oor:op="fuse"><value>3</value></prop></item><item oor:path="/org.openoffice.Office.Writer/Content/Update"><prop oor:name="Link" oor:op="fuse"><value>0</value></prop></item></oor:items>');
    let count=0;
    await pipeline(req,new Transform({transform(chunk,enc,cb){count+=chunk.length;cb(count>limit?Error('size'):null,chunk);}}),fs.createWriteStream(source,{flags:'wx'}),{signal:controller.signal});
    if(count!==size)throw Error('Incomplete input');
    await run(['-env:UserInstallation='+pathToFileURL(profile).href,'--headless','--invisible','--nologo','--nodefault','--norestore','--nolockcheck','--convert-to','pdf','--outdir',dir,source],controller.signal);
    const output=path.join(dir,'document.pdf'),stat=await fsp.stat(output);
    if(!stat.isFile()||!stat.size||stat.size>limit)throw Error('Output limit');
    res.writeHead(200,{'Content-Type':'application/pdf','Content-Length':stat.size,'Cache-Control':'no-store'});
    await pipeline(fs.createReadStream(output),res,{signal:controller.signal});
  }catch{error(422);}finally{if(dir)await fsp.rm(dir,{recursive:true,force:true}).catch(()=>{});busy=false;}
});
server.requestTimeout=100000;server.headersTimeout=15000;
server.listen(3001,'0.0.0.0');
