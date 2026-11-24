'use strict';
const fs=require('node:fs');
const fsp=require('node:fs/promises');
const path=require('node:path');
const {Readable}=require('node:stream');
const {sendVideoRange}=require('./video-preview');
const OFFICE=new Set('doc docx xls xlsx ppt pptx rtf odt ods'.split(' '));
const TEXT=new Set(['txt','log','csv']);
const OFFICE_LIMIT=64*1024*1024,TEXT_LIMIT=4*1024*1024;
const PDFJS_ROOT='/opt/portal-pdf/node_modules/pdfjs-dist';
function pdfAssetPath(name){
  // Public library assets only, never user documents or arbitrary paths.
  if(!/^(?:legacy\/build\/pdf(?:\.worker)?\.mjs|web\/pdf_viewer\.css|(?:cmaps|standard_fonts|wasm|iccs|web\/images|legacy\/build)\/[A-Za-z0-9_.-]+\.(?:bcmap|pfb|ttf|otf|wasm|icc|svg|png|mjs|js|bin))$/.test(name))return null;
  if(name.split('/').some(x=>x==='..'||x==='.'))return null;
  return path.join(PDFJS_ROOT,name);
}
function registerDocumentPreview(fastify,{pool,storedPath,validId,fail}){
  fastify.get('/pdfjs/*',async(request,reply)=>{
    const asset=String(request.params['*']||''),file=pdfAssetPath(asset);
    if(!file)return reply.code(404).send();
    try{const stat=await fsp.stat(file);if(!stat.isFile())return reply.code(404).send();
      const mime=/\.(mjs|js)$/.test(asset)?'text/javascript':asset.endsWith('.css')?'text/css':asset.endsWith('.wasm')?'application/wasm':asset.endsWith('.svg')?'image/svg+xml':asset.endsWith('.png')?'image/png':'application/octet-stream';
      return reply.header('Content-Type',mime).header('Content-Length',String(stat.size)).header('Cache-Control','public, max-age=3600').header('X-Content-Type-Options','nosniff').send(fs.createReadStream(file));
    }catch{return reply.code(404).send();}
  });
  fastify.get('/api/orders/:id/media/:mediaId/document-preview',async(request,reply)=>{
    const id=validId(request.params.id),mid=validId(request.params.mediaId);
    if(!id||!mid)return fail(reply,400,'شناسه نامعتبر است.');
    const found=await pool.query('SELECT * FROM invoice_media WHERE order_id=$1 AND id=$2',[id,mid]);
    if(!found.rowCount)return fail(reply,404,'فایل یافت نشد.');
    const file=found.rows[0],ext=String(file.stored_name).split('.').pop().toLowerCase();
    try{
      const source=storedPath(file.stored_name),stat=await fsp.stat(source);
      if(file.mime_type==='application/pdf'){
        if(!stat.isFile()||stat.size<1)return fail(reply,404,'فایل PDF روی دیسک موجود نیست.');
        if(request.headers?.range)return await sendVideoRange(request,reply,source,'application/pdf',file.stored_name);
        // Explicit 200 and real bytes for whole-file fetches; never send an empty success.
        reply.code(200).header('Content-Type','application/pdf').header('Content-Length',String(stat.size))
          .header('Content-Disposition','inline').header('Accept-Ranges','bytes')
          .header('Cache-Control','private, no-store').header('X-Content-Type-Options','nosniff')
          .header('Referrer-Policy','no-referrer');
        if(request.method==='HEAD')return reply.send();
        return reply.send(fs.createReadStream(source));
      }
      reply.header('Cache-Control','private, no-store').header('X-Content-Type-Options','nosniff');
      if(TEXT.has(ext)){
        if(stat.size>TEXT_LIMIT)return fail(reply,413,'سند متنی بیش از ۴ مگابایت است؛ فایل اصلی را دانلود کنید.');
        return reply.header('Content-Type','text/plain; charset=utf-8').send(fs.createReadStream(source));
      }
      if(!OFFICE.has(ext))return fail(reply,415,'این نوع سند پشتیبانی نمی‌شود.');
      if(stat.size>OFFICE_LIMIT)return fail(reply,413,'پیش‌نمایش اسناد Office تا ۶۴ مگابایت پشتیبانی می‌شود.');
      const origin=process.env.DOCUMENT_PREVIEW_URL||'http://document:3001';
      const controller=new AbortController();
      const abort=()=>controller.abort();
      reply.raw?.once?.('close',abort);
      let response;
      try{
        response=await fetch(origin+'/convert/'+ext,{method:'POST',headers:{'Content-Type':'application/octet-stream','Content-Length':String(stat.size)},body:fs.createReadStream(source),duplex:'half',signal:AbortSignal.any([controller.signal,AbortSignal.timeout(100000)])});
        if(!response.ok){await response.body?.cancel().catch(()=>{});return fail(reply,response.status===503?503:422,response.status===503?'نمایشگر اسناد مشغول است؛ دوباره تلاش کنید.':'پیش‌نمایش سند ممکن نیست؛ فایل اصلی قابل دانلود است.');}
        const length=Number(response.headers.get('content-length'));
        if(!response.body||!Number.isSafeInteger(length)||length<1||length>OFFICE_LIMIT){await response.body?.cancel().catch(()=>{});return fail(reply,422,'خروجی پیش‌نمایش سند معتبر نیست.');}
        return reply.header('Content-Type','application/pdf').header('Content-Length',String(length)).send(Readable.fromWeb(response.body));
      }catch(error){if(!reply.sent)reply.raw?.removeListener?.('close',abort);throw error;}
    }catch(error){request.log?.warn?.({err:error},'Document preview error');if(!reply.sent)return fail(reply,422,'نمایش سند ممکن نیست؛ فایل اصلی قابل دانلود است.');}
  });
}
module.exports={registerDocumentPreview,pdfAssetPath};
