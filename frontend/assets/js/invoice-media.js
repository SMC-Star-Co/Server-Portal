// Invoice media UI. Existing order form logic remains unchanged.
const invoiceMedia = { orderId: null, technician: false, urls: [], seq: 0, previewUrl: null };
function mediaSize(n) { return Number(n) < 1048576 ? (Number(n)/1024).toFixed(0)+' KB' : (Number(n)/1048576).toFixed(2)+' MB'; }
function clearInvoiceMedia() {
  invoiceMedia.seq++; invoiceMedia.orderId = null;
  invoiceMedia.urls.forEach(u => URL.revokeObjectURL(u)); invoiceMedia.urls = [];
  closeInvoiceMediaPreview();
  const dialog = document.getElementById('invoiceMediaPreview');
  if (dialog && dialog.open) dialog.close();
  const root = document.getElementById('invoiceMediaList'); if (root) root.replaceChildren();
}
async function openInvoiceMedia(orderId) {
  const seq=++invoiceMedia.seq; invoiceMedia.orderId=String(orderId);
  invoiceMedia.urls.forEach(u=>URL.revokeObjectURL(u));invoiceMedia.urls=[];
  const root=document.getElementById('invoiceMediaList');
  if(!root)return;
  root.textContent='در حال بارگذاری...';
  try{
    const res=await apiFetch(API_URL+'/orders/'+orderId+'/media');
    if(!res.ok)throw new Error('دریافت فهرست فایل‌ها ناموفق بود.');
    const data=await res.json(); if(seq!==invoiceMedia.seq)return;
    invoiceMedia.technician=Boolean(data.can_manage);
    document.getElementById('invoiceMediaUploader').hidden=!invoiceMedia.technician;
    root.replaceChildren();
    if(!data.files.length)root.textContent='هنوز فایلی ثبت نشده است.';
    for(const file of data.files) {
      const item=document.createElement('div'); item.className='invoice-media-item';
      const thumb=document.createElement('div');thumb.className='invoice-media-icon';
      thumb.textContent=file.mime_type.startsWith('video/')?'🎬':'🖼️';
      const details=document.createElement('div');details.className='invoice-media-details';
      const title=document.createElement('strong');title.textContent=file.original_name;title.title=file.original_name;
      const stats=document.createElement('small');
      const saving=Number(file.original_bytes)>Number(file.stored_bytes)?
        Math.round(100*(1-Number(file.stored_bytes)/Number(file.original_bytes))):0;
      stats.textContent=mediaSize(file.stored_bytes)+(saving?' · '+saving+'٪ کاهش':'')+
        (file.compression_mode==='lossless'?' · بدون افت':'')+
        (file.uploader_name?' · '+file.uploader_name:'');
      details.append(title,stats);
      const buttons=document.createElement('div');buttons.className='invoice-media-actions';
      function btn(text,css,action){
        const el=document.createElement('button');el.type='button';el.className=css;el.textContent=text;el.onclick=action;buttons.append(el);
      }
      btn('مشاهده','soft-primary-btn',()=>previewInvoiceMedia(file));
      btn('دانلود','secondary-btn',()=>downloadInvoiceMedia(file));
      if(invoiceMedia.technician)btn('حذف','soft-danger-btn',()=>deleteInvoiceMedia(file));
      item.append(thumb,details,buttons);root.append(item);
      if(file.has_thumbnail)loadInvoiceMediaThumbnail(file,thumb,seq,String(orderId));
    }
  }catch(e){if(seq===invoiceMedia.seq)root.textContent=e.message||'خطا در بارگذاری فایل‌ها'}
}
async function loadInvoiceMediaThumbnail(file,holder,seq,orderId){
  try {
    const res=await apiFetch(API_URL+'/orders/'+orderId+'/media/'+file.id+'/file?thumbnail=1');
    if(!res.ok)return;
    const blob=await res.blob();if(seq!==invoiceMedia.seq)return;
    const url=URL.createObjectURL(blob);invoiceMedia.urls.push(url);
    const img=document.createElement('img');img.src=url;img.alt=file.original_name;
    holder.replaceChildren(img);
  }catch{}
}
async function mediaBlob(file,download=false){
  const id=invoiceMedia.orderId;if(!id)throw new Error('پنجره فاکتور بسته است.');
  const res=await apiFetch(API_URL+'/orders/'+id+'/media/'+file.id+'/file'+(download?'?download=1':''));
  if(!res.ok)throw new Error('دریافت فایل ناموفق بود.');
  return res.blob();
}
function closeInvoiceMediaPreview() {
  if(invoiceMedia.previewUrl)URL.revokeObjectURL(invoiceMedia.previewUrl);
  invoiceMedia.previewUrl=null;
  const body=document.getElementById('invoiceMediaPreviewBody');if(body)body.replaceChildren();
}
async function previewInvoiceMedia(file){
  try {
    const blob=await mediaBlob(file);
    closeInvoiceMediaPreview();
    invoiceMedia.previewUrl=URL.createObjectURL(blob);
    const el=document.createElement(file.mime_type.startsWith('video/')?'video':'img');
    el.src=invoiceMedia.previewUrl;
    if(el.tagName==='VIDEO')el.controls=true;
    el.alt=file.original_name;
    document.getElementById('invoiceMediaPreviewBody').replaceChildren(el);
    document.getElementById('invoiceMediaPreviewTitle').textContent=file.original_name;
    document.getElementById('invoiceMediaPreview').showModal();
  }catch(e){showAppToast(e.message||'نمایش فایل ناموفق بود')}
}
async function downloadInvoiceMedia(file){
  try{
    const blob=await mediaBlob(file,true);
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');a.href=url;a.download=file.original_name;
    document.body.append(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),30000);
  }catch(e){showAppToast(e.message||'دانلود ناموفق بود')}
}
async function uploadInvoiceMedia(){
  if(!invoiceMedia.technician||!invoiceMedia.orderId)return;
  const input=document.getElementById('invoiceMediaFile'),files=[...input.files];
  if(!files.length)return showAppToast('فایل انتخاب نشده است.');
  const mode=document.getElementById('invoiceMediaMode').value;
  const button=document.getElementById('invoiceMediaUploadBtn'),status=document.getElementById('invoiceMediaProgress');
  const orderId=invoiceMedia.orderId;button.disabled=true;let success=0;
  try{
    for(const [index,file] of files.entries()){
      if(file.size>16*1024*1024){showAppToast('فایل '+file.name+' بیش از ۱۶ مگابایت است.');continue}
      status.textContent='در حال آپلود '+(index+1)+' از '+files.length+' : '+file.name;
      try{
        const res=await apiFetch(API_URL+'/orders/'+orderId+'/media',{
          method:'POST',headers:{'Content-Type':'application/octet-stream',
            'X-File-Name':encodeURIComponent(file.name),'X-Image-Mode':mode},body:file});
        const data=await res.json();
        if(!res.ok)throw new Error(data.error||'آپلود ناموفق بود');
        success++;
      }catch(e){showAppToast(file.name+': '+e.message)}
    }
    input.value='';
    if(invoiceMedia.orderId===orderId){
      await openInvoiceMedia(orderId);
      status.textContent=success+' فایل ثبت شد.';
    }
  }finally{button.disabled=false}
}
async function deleteInvoiceMedia(file){
  if(!invoiceMedia.technician||!invoiceMedia.orderId)return;
  if(!confirm('فایل '+file.original_name+' حذف شود؟'))return;
  const id=invoiceMedia.orderId;
  try{
    const res=await apiFetch(API_URL+'/orders/'+id+'/media/'+file.id,{method:'DELETE'});
    if(!res.ok)throw new Error((await res.json()).error||'حذف ناموفق بود');
    await openInvoiceMedia(id);
  }catch(e){showAppToast(e.message||'حذف ناموفق بود')}
}
document.getElementById('invoiceMediaPreview')?.addEventListener('close',closeInvoiceMediaPreview);