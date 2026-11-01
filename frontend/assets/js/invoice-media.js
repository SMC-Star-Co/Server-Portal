// Technical media UI: isolated from invoice details, serial editing and existing permissions.
const invoiceMedia = {
  orderId: null, invoice: '', technician: false, serials: [], files: [],
  generation: 0, uploading: false, uploadScope: 'serial', view: 'serial',
  urls: new Set(), thumbnailObserver: null, activeSerial: null,
  selectedFiles: {serial: [], invoice: []}, pendingSerial: null
};

function mediaSize(value) {
  const n = Number(value) || 0;
  return n >= 1048576 ? (n / 1048576).toFixed(2) + ' MB' : (n / 1024).toFixed(0) + ' KB';
}
function mediaElement(id) { return document.getElementById(id); }
function mediaIcon(ext) {
  const code = String(ext || '').toLowerCase();
  if (code === 'pdf') return {kind:'pdf',label:'PDF'};
  if (['doc','docx','odt','rtf'].includes(code)) return {kind:'word',label:'DOC'};
  if (['xls','xlsx','ods','csv'].includes(code)) return {kind:'excel',label:'XLS'};
  if (['ppt','pptx'].includes(code)) return {kind:'slide',label:'PPT'};
  return {kind:'other',label:(code || 'FILE').slice(0,5).toUpperCase()};
}
function releaseMediaThumbnails() {
  if (invoiceMedia.thumbnailObserver) {
    invoiceMedia.thumbnailObserver.disconnect();
    invoiceMedia.thumbnailObserver = null;
  }
  for (const url of invoiceMedia.urls) URL.revokeObjectURL(url);
  invoiceMedia.urls.clear();
}
function clearInvoiceMedia() {
  closeInvoiceMediaModal();
  invoiceMedia.orderId = null;
  invoiceMedia.invoice = '';
  invoiceMedia.serials = [];
  invoiceMedia.files = [];
  invoiceMedia.selectedFiles = {serial:[], invoice:[]};
  invoiceMedia.pendingSerial = null;
  for (const id of ['invoiceMediaSerialFiles','invoiceMediaInvoiceFiles']) {
    const input=mediaElement(id); if (input) input.value='';
  }
}
function openInvoiceMediaFromOps() {
  const id = mediaElement('edit_order_id')?.value;
  if (!id) return;
  invoiceMedia.orderId = String(id);
  invoiceMedia.activeSerial = null;
  invoiceMedia.selectedFiles = {serial:[], invoice:[]};
  invoiceMedia.pendingSerial = null;
  for (const id of ['invoiceMediaSerialFiles','invoiceMediaInvoiceFiles']) {
    const input=mediaElement(id); if(input) input.value='';
  }
  invoiceMedia.uploadScope = 'serial';
  invoiceMedia.view = 'serial';
  mediaElement('invoiceMediaModal').style.display = 'flex';
  setInvoiceMediaUploadScope('serial');
  setInvoiceMediaView('serial');
  refreshInvoiceMedia();
}
function closeInvoiceMediaModal() {
  if (invoiceMedia.uploading) {
    showAppToast('پس از پایان آپلود می‌توانید این پنجره را ببندید.');
    return;
  }
  const modal = mediaElement('invoiceMediaModal');
  if (modal) modal.style.display = 'none';
  invoiceMedia.generation++;
  releaseMediaThumbnails();
  const preview = mediaElement('invoiceMediaPreview');
  if (preview?.open) preview.close();
  closeInvoiceMediaPreview();
}
function updateInvoiceMediaTarget() {
  const select = mediaElement('invoiceMediaSerialSelect');
  const example = mediaElement('invoiceMediaNameSample');
  const prefix = invoiceMedia.uploadScope === 'serial' ? (select?.value || 'SERIAL') : (invoiceMedia.invoice || 'FACTOR');
  example.textContent = prefix + '-01.jpg';
  const serial=select?.value || '';
  if(invoiceMedia.pendingSerial && invoiceMedia.pendingSerial!==serial && invoiceMedia.selectedFiles.serial.length) {
    invoiceMedia.selectedFiles.serial=[];
    showAppToast('سریال تغییر کرد؛ فایل‌های انتخابی قبلی برای جلوگیری از ثبت اشتباه حذف شدند.');
  }
  invoiceMedia.pendingSerial=serial;
  updateInvoiceMediaSelection();
}
function setInvoiceMediaUploadScope(scope) {
  invoiceMedia.uploadScope = scope === 'serial' ? 'serial' : 'invoice';
  for (const key of ['invoice','serial']) {
    const chosen = invoiceMedia.uploadScope === key;
    const label = key === 'invoice' ? 'Invoice' : 'Serial';
    mediaElement('invoiceMediaScope' + label)?.classList.toggle('is-active',chosen);
    const panel = mediaElement('invoiceMedia' + label + 'Panel');
    if (panel) panel.hidden = !chosen;
  }
  updateInvoiceMediaTarget();
}
function setInvoiceMediaView(view) {
  invoiceMedia.view = view === 'serial' ? 'serial' : 'invoice';
  for (const key of ['invoice','serial']) {
    const selected = invoiceMedia.view === key;
    const label = key === 'invoice' ? 'Invoice' : 'Serial';
    mediaElement('invoiceMediaView' + label)?.classList.toggle('is-active', selected);
    const panel = mediaElement('invoiceMedia' + label + 'View');
    if (panel) panel.hidden = !selected;
  }
  if (invoiceMedia.files.length) drawInvoiceMedia();
}
function chooseInvoiceMediaFiles() {
  if (!invoiceMedia.technician || invoiceMedia.uploading) return;
  if (invoiceMedia.uploadScope === 'serial' && !mediaElement('invoiceMediaSerialSelect')?.value) {
    showAppToast('ابتدا سریال سرور را انتخاب کنید.'); return;
  }
  const input = mediaElement(invoiceMedia.uploadScope === 'serial' ? 'invoiceMediaSerialFiles' : 'invoiceMediaInvoiceFiles');
  input?.click();
}
function handleInvoiceMediaFileSelection(scope) {
  if (invoiceMedia.uploading) return;
  const input = mediaElement(scope === 'serial' ? 'invoiceMediaSerialFiles' : 'invoiceMediaInvoiceFiles');
  const incoming = Array.from(input?.files || []);
  if (scope === 'serial') {
    const currentSerial = mediaElement('invoiceMediaSerialSelect')?.value || '';
    if (invoiceMedia.pendingSerial && invoiceMedia.pendingSerial !== currentSerial) {
      invoiceMedia.selectedFiles.serial = [];
    }
    invoiceMedia.pendingSerial = currentSerial;
  }
  const selected = invoiceMedia.selectedFiles[scope];
  for (const file of incoming) {
    if (!selected.some(old => old.name===file.name && old.size===file.size && old.lastModified===file.lastModified)) {
      selected.push(file);
    }
  }
  if (input) input.value='';
  updateInvoiceMediaSelection();
}
function removePendingInvoiceMediaFile(index) {
  if (invoiceMedia.uploading) return;
  invoiceMedia.selectedFiles[invoiceMedia.uploadScope].splice(index,1);
  updateInvoiceMediaSelection();
}
function updateInvoiceMediaSelection() {
  const scope=invoiceMedia.uploadScope;
  const files=invoiceMedia.selectedFiles[scope];
  const summary=mediaElement('invoiceMediaSelectionSummary');
  const list=mediaElement('invoiceMediaSelectionList');
  const button=mediaElement('invoiceMediaUploadButton');
  const choose=mediaElement('invoiceMediaChooseButton');
  const invalid=files.some(file=>!file.size || file.size>500*1024*1024);
  const serialAvailable=scope!=='serial' || Boolean(mediaElement('invoiceMediaSerialSelect')?.value);
  summary.textContent=files.length ?
    files.length+' فایل انتخاب شده · '+mediaSize(files.reduce((sum,file)=>sum+file.size,0))+
    (invalid?' · فایل خارج از محدوده مجاز':'') :
    'هنوز فایلی انتخاب نشده است.';
  list.replaceChildren();
  files.forEach((file,index)=>{
    const item=document.createElement('div');
    item.className='invoice-media-pending-file';
    const ext=(file.name.split('.').pop()||'FILE').toUpperCase();
    const icon=document.createElement('span');
    icon.className='invoice-media-pending-ext';icon.textContent=ext.slice(0,5);
    const meta=document.createElement('div');
    meta.className='invoice-media-pending-meta';
    const name=document.createElement('strong');
    name.textContent=file.name;name.title=file.name;
    const size=document.createElement('small');
    size.textContent=mediaSize(file.size)+(file.size>500*1024*1024?' · بیش از ۵۰۰ مگابایت':'');
    meta.append(name,size);
    const remove=document.createElement('button');
    remove.type='button';remove.className='invoice-media-pending-remove';
    remove.textContent='×';remove.title='حذف از فهرست آپلود';remove.setAttribute('aria-label','حذف '+file.name);
    remove.disabled=invoiceMedia.uploading;
    remove.addEventListener('click',()=>removePendingInvoiceMediaFile(index));
    item.append(icon,meta,remove);list.append(item);
  });
  button.disabled=invoiceMedia.uploading || !files.length || invalid || !invoiceMedia.technician || !serialAvailable;
  if(choose)choose.disabled=invoiceMedia.uploading || !invoiceMedia.technician || !serialAvailable;
}
async function refreshInvoiceMedia() {
  const id = invoiceMedia.orderId;
  if (!id) return;
  const generation = ++invoiceMedia.generation;
  const root = mediaElement('invoiceMediaSerialGroups');
  if (root) root.textContent = 'در حال دریافت فهرست فایل‌ها...';
  try {
    const response = await apiFetch(API_URL + '/orders/' + id + '/media');
    if (!response.ok) throw new Error('دریافت فایل‌های فاکتور ناموفق بود.');
    const data = await response.json();
    if (invoiceMedia.generation !== generation || invoiceMedia.orderId !== id) return;
    invoiceMedia.invoice = String(data.invoice_number || '');
    invoiceMedia.serials = Array.isArray(data.serials) ? data.serials : [];
    invoiceMedia.files = Array.isArray(data.files) ? data.files : [];
    invoiceMedia.technician = Boolean(data.can_manage);
    mediaElement('invoiceMediaModalTitle').textContent = 'فایل‌های فاکتور ' + invoiceMedia.invoice;
    mediaElement('invoiceMediaUploader').hidden = !invoiceMedia.technician;
    const select = mediaElement('invoiceMediaSerialSelect');
    const old = select.value;
    select.replaceChildren();
    for (const serial of invoiceMedia.serials) {
      const option = document.createElement('option');
      option.value = serial; option.textContent = serial; select.append(option);
    }
    if (invoiceMedia.serials.includes(old)) select.value = old;
    if (!invoiceMedia.serials.length) {
      const option = document.createElement('option');
      option.textContent = 'سریالی ثبت نشده است'; option.value = ''; select.append(option);
    }
    select.disabled = !invoiceMedia.serials.length;
    const count = invoiceMedia.files.filter(f => f.media_scope === 'serial').length;
    mediaElement('invoiceMediaSummary').textContent = invoiceMedia.files.length + ' فایل · ' + invoiceMedia.serials.length + ' سریال ثبت‌شده';
    mediaElement('invoiceMediaInvoiceCount').textContent = invoiceMedia.files.length - count;
    mediaElement('invoiceMediaSerialCount').textContent = count;
    updateInvoiceMediaTarget();
    drawInvoiceMedia();
  } catch(error) {
    if (generation === invoiceMedia.generation) {
      if(root) root.textContent = error.message || 'خطا در دریافت اطلاعات';
      mediaElement('invoiceMediaSummary').textContent = 'بارگذاری ناموفق بود';
    }
  }
}
function mediaButton(label,css,handler) {
  const btn = document.createElement('button');
  btn.type='button'; btn.className=css; btn.textContent=label;
  btn.addEventListener('click',handler);
  return btn;
}
function fileType(file) {
  const mime = String(file.mime_type || '');
  const ext = String(file.download_name || file.original_name || '').toLowerCase().split('.').pop();
  if (mime.startsWith('video/')) return {kind:'video',ext};
  if (mime.startsWith('image/')) return {kind:'image',ext};
  return {kind:'document',ext};
}
function mediaPreviewable(file) {
  return ['image/jpeg','image/png','image/webp','image/gif','image/bmp',
    'video/mp4','video/webm','video/quicktime','application/pdf'].includes(file.mime_type);
}
function drawMediaRows(container,files) {
  container.replaceChildren();
  if (!files.length) {
    const empty=document.createElement('div');
    empty.className='invoice-media-empty';
    empty.innerHTML = '<span class="invoice-media-empty-icon">▧</span><strong>فایلی وجود ندارد</strong><small>فایل‌های جدید اینجا نمایش داده می‌شوند.</small>';
    container.append(empty); return;
  }
  for (const file of files) {
    const card=document.createElement('article');
    card.className='invoice-media-file-card';
    const type=fileType(file);
    const visual=document.createElement('div');
    visual.className='invoice-media-file-thumb';
    if (type.kind==='document') {
      const doc=mediaIcon(type.ext);
      const tile=document.createElement('div');
      tile.className='invoice-media-ext-tile invoice-media-ext-'+doc.kind;
      const icon=document.createElement('span'); icon.textContent=doc.label;
      const small=document.createElement('small'); small.textContent=type.ext.toUpperCase();
      tile.append(icon,small); visual.append(tile);
    } else {
      visual.classList.add('is-previewable');
      const placeholder=document.createElement('span');
      placeholder.className='invoice-media-image-placeholder';
      placeholder.textContent=type.kind==='video'?'▶':'▧';
      visual.append(placeholder);
      visual.dataset.mediaId=String(file.id);
      if (type.kind==='video') {
        const play=document.createElement('span');
        play.className='invoice-media-play';play.textContent='▶';visual.append(play);
      }
      if (invoiceMedia.thumbnailObserver) invoiceMedia.thumbnailObserver.observe(visual);
      if (mediaPreviewable(file)) {
        visual.setAttribute('role','button');visual.setAttribute('tabindex','0');
        visual.addEventListener('click',()=>previewInvoiceMedia(file));
        visual.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();previewInvoiceMedia(file)}});
      }
    }
    const meta=document.createElement('div');meta.className='invoice-media-file-meta';
    const name=document.createElement('strong');
    name.className='invoice-media-file-name';
    name.textContent=file.download_name||file.original_name;
    name.title=file.original_name||'';
    const sub=document.createElement('span');
    sub.textContent=mediaSize(file.stored_bytes)+(file.uploader_name?' · '+file.uploader_name:'');
    meta.append(name,sub);
    const actions=document.createElement('div');actions.className='invoice-media-file-actions';
    if (mediaPreviewable(file)) actions.append(mediaButton('نمایش','invoice-media-action-view',()=>previewInvoiceMedia(file)));
    actions.append(mediaButton('دریافت','invoice-media-action-download',()=>downloadInvoiceMedia(file)));
    if (invoiceMedia.technician) actions.append(mediaButton('حذف','invoice-media-action-delete',()=>deleteInvoiceMedia(file)));
    card.append(visual,meta,actions);
    container.append(card);
  }
}
function drawInvoiceMedia() {
  releaseMediaThumbnails();
  if ('IntersectionObserver' in window) {
    invoiceMedia.thumbnailObserver = new IntersectionObserver((entries,observer)=>{
      for(const entry of entries) if(entry.isIntersecting){
        observer.unobserve(entry.target);
        fetchMediaThumbnail(entry.target.dataset.mediaId,entry.target,invoiceMedia.generation);
      }
    },{root:mediaElement('invoiceMediaModal').querySelector('.invoice-media-modal-body'),rootMargin:'140px'});
  }
  const files=invoiceMedia.files;
  const invoiceFiles=files.filter(file => file.media_scope!=='serial');
  drawMediaRows(mediaElement('invoiceMediaInvoiceList'),invoiceFiles);
  mediaElement('invoiceMediaInvoiceDownloadAll').hidden=!invoiceFiles.length;
  const groups=mediaElement('invoiceMediaSerialGroups');
  groups.replaceChildren();
  const serials=invoiceMedia.serials.slice();
  for(const file of files) if(file.media_scope==='serial' && file.serial_number && !serials.includes(file.serial_number)) serials.push(file.serial_number);
  if (!serials.length) {
    const empty=document.createElement('div');empty.className='invoice-media-empty';
    empty.textContent='ابتدا سریال‌ها را در مدیریت سریال‌ها ثبت کنید.';groups.append(empty);
  }
  let firstWithFiles = true;
  for(const serial of serials) {
    const serialFiles=files.filter(file => file.media_scope==='serial' && file.serial_number===serial);
    const box=document.createElement('details');box.className='invoice-media-serial-group';
    box.dataset.serial=serial;
    if(invoiceMedia.expandedSerials.has(serial) || (firstWithFiles && !invoiceMedia.expandedSerials.size && serialFiles.length && invoiceMedia.view==='serial')) {
      box.open=true;
    }
    if(serialFiles.length)firstWithFiles=false;
    const summary=document.createElement('summary');
    const heading=document.createElement('span');heading.className='invoice-media-serial-label';
    const icon=document.createElement('span');icon.textContent='▤';
    const name=document.createElement('strong');name.textContent=serial;
    heading.append(icon,name);
    const badge=document.createElement('span');badge.className='invoice-media-serial-count';badge.textContent=serialFiles.length+' فایل';
    summary.append(heading,badge);
    const body=document.createElement('div');body.className='invoice-media-serial-content';
    body.hidden=!box.open;
    if(box.open)drawMediaRows(body,serialFiles);
    box.addEventListener('toggle',()=>{
      if(box.open) {
        invoiceMedia.expandedSerials.add(serial);
        body.hidden=false;
        drawMediaRows(body,serialFiles);
      } else {
        invoiceMedia.expandedSerials.delete(serial);
        body.replaceChildren();body.hidden=true;
      }
    });
    box.append(summary,body);
    if (serialFiles.length) {
      const footer=document.createElement('div');footer.className='invoice-media-group-footer';
      footer.append(mediaButton('دانلود همه فایل‌های این سریال (ZIP)','secondary-btn',
        ()=>downloadInvoiceMediaGroup('serial',serial)));
      box.append(footer);
    }
    groups.append(box);
  }
  if (!invoiceMedia.thumbnailObserver) {
    for(const target of mediaElement('invoiceMediaModal').querySelectorAll('.invoice-media-file-thumb[data-media-id]')) {
      fetchMediaThumbnail(target.dataset.mediaId,target,invoiceMedia.generation);
    }
  }
}
async function fetchMediaThumbnail(mediaId,target,generation) {
  if (!target.isConnected || !mediaId) return;
  const id=invoiceMedia.orderId;
  try {
    const res=await apiFetch(API_URL+'/orders/'+id+'/media/'+mediaId+'/thumbnail');
    if (!res.ok) return;
    const blob=await res.blob();
    if (generation!==invoiceMedia.generation || !target.isConnected || invoiceMedia.orderId!==id) return;
    const url=URL.createObjectURL(blob);invoiceMedia.urls.add(url);
    const img=document.createElement('img');
    img.src=url;img.alt='پیش‌نمایش فایل';img.loading='lazy';
    target.prepend(img);
    const placeholder=target.querySelector('.invoice-media-image-placeholder');
    if(placeholder)placeholder.remove();
  }catch(error){console.warn('Thumbnail unavailable',error)}
}
async function requestMediaTicket(payload) {
  if(!invoiceMedia.orderId)throw new Error('فاکتوری انتخاب نشده است.');
  const res=await apiFetch(API_URL+'/orders/'+invoiceMedia.orderId+'/media/ticket',{
    method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)
  });
  const data=await res.json();
  if(!res.ok || !data.url)throw new Error(data.error||'امکان دریافت لینک وجود ندارد.');
  return data.url;
}
function followMediaLink(url,download) {
  const a=document.createElement('a');
  a.href=url;a.style.display='none';
  if(download)a.download='';
  document.body.append(a);a.click();a.remove();
}
async function downloadInvoiceMedia(file) {
  try{followMediaLink(await requestMediaTicket({kind:'file',file_id:file.id,inline:false}),true)}
  catch(error){showAppToast(error.message||'خطا در دریافت فایل')}
}
async function downloadInvoiceMediaGroup(scope,serial) {
  try{followMediaLink(await requestMediaTicket({kind:'zip',scope,serial_number:scope==='serial'?serial:undefined}),true)}
  catch(error){showAppToast(error.message||'خطا در دریافت گروهی')}
}
async function previewInvoiceMedia(file) {
  const dialog=mediaElement('invoiceMediaPreview');
  const body=mediaElement('invoiceMediaPreviewBody');
  body.replaceChildren();body.classList.remove('is-actual-size');
  mediaElement('invoiceMediaPreviewTitle').textContent=file.download_name||file.original_name;
  mediaElement('invoiceMediaPreviewSubtitle').textContent=mediaSize(file.stored_bytes);
  const zoom=mediaElement('invoiceMediaActualSize');
  zoom.hidden=true;zoom.textContent='اندازه واقعی (۱۰۰٪)';
  try{
    const url=await requestMediaTicket({kind:'file',file_id:file.id,inline:true});
    const type=String(file.mime_type||'');
    let element;
    if(type.startsWith('image/')) {
      element=document.createElement('img');element.alt=file.download_name||file.original_name;
      zoom.hidden=false;
    } else if(type.startsWith('video/')) {
      element=document.createElement('video');element.controls=true;element.preload='metadata';
    } else if(type==='application/pdf') {
      element=document.createElement('iframe');element.title=file.download_name||file.original_name;
    } else return downloadInvoiceMedia(file);
    element.src=url;body.append(element);
    dialog.showModal();
  }catch(error){showAppToast(error.message||'خطا در نمایش')}
}
function toggleInvoiceMediaActualSize() {
  const body=mediaElement('invoiceMediaPreviewBody');
  const actual=body.classList.toggle('is-actual-size');
  mediaElement('invoiceMediaActualSize').textContent=actual?'تناسب با صفحه':'اندازه واقعی (۱۰۰٪)';
}
function closeInvoiceMediaPreview() {
  const body=mediaElement('invoiceMediaPreviewBody');
  if(body) {body.replaceChildren();body.classList.remove('is-actual-size')}
}
async function uploadInvoiceMedia() {
  if(!invoiceMedia.technician || !invoiceMedia.orderId || invoiceMedia.uploading)return;
  const scope=invoiceMedia.uploadScope;
  const serial=scope==='serial'?mediaElement('invoiceMediaSerialSelect').value:'';
  if(scope==='serial'&&!serial)return showAppToast('سریال انتخاب نشده است.');
  const input=mediaElement(scope==='serial'?'invoiceMediaSerialFiles':'invoiceMediaInvoiceFiles');
  const files=Array.from(input.files||[]);
  if(!files.length)return showAppToast('فایلی انتخاب نشده است.');
  const orderId=invoiceMedia.orderId;
  invoiceMedia.uploading=true;
  const button=mediaElement('invoiceMediaUploadButton');
  button.disabled=true;
  const status=mediaElement('invoiceMediaProgress');
  let successful=0;
  try{
    for(const [index,file] of files.entries()) {
      if(!file.size || file.size>500*1024*1024){
        showAppToast('حجم فایل '+file.name+' نامعتبر است یا بیش از ۵۰۰ مگابایت است.');continue;
      }
      status.textContent='در حال آپلود '+(index+1)+' از '+files.length+': '+file.name;
      try{
        const response=await apiFetch(API_URL+'/orders/'+orderId+'/media',{
          method:'POST',headers:{'Content-Type':'application/octet-stream','X-File-Name':encodeURIComponent(file.name),
            'X-Media-Scope':scope,...(serial?{'X-Media-Serial':serial}:{})},body:file
        });
        const result=await response.json();
        if(!response.ok)throw new Error(result.error||'آپلود ناموفق بود.');
        successful++;
      }catch(error){showAppToast(file.name+': '+error.message)}
    }
    input.value='';
    if(invoiceMedia.orderId===orderId) {
      invoiceMedia.view=scope;
      await refreshInvoiceMedia();
      setInvoiceMediaView(scope);
      status.textContent=successful+' فایل ثبت شد.';
    }
  }finally{
    invoiceMedia.uploading=false;
    updateInvoiceMediaSelection();
  }
}
async function deleteInvoiceMedia(file) {
  if(!invoiceMedia.technician||!invoiceMedia.orderId)return;
  if(!confirm('فایل «'+(file.download_name||file.original_name)+'» حذف شود؟'))return;
  try{
    const res=await apiFetch(API_URL+'/orders/'+invoiceMedia.orderId+'/media/'+file.id,{method:'DELETE'});
    if(!res.ok)throw new Error((await res.json()).error||'حذف ناموفق بود.');
    await refreshInvoiceMedia();
  }catch(error){showAppToast(error.message||'حذف ناموفق بود')}
}
function bindInvoiceMediaDrop() {
  const area=mediaElement('invoiceMediaDropzone');
  if(!area)return;
  for (const type of ['dragenter','dragover']) {
    area.addEventListener(type,event=>{event.preventDefault();area.classList.add('is-dragging')});
  }
  for (const type of ['dragleave','drop']) {
    area.addEventListener(type,event=>{event.preventDefault();area.classList.remove('is-dragging')});
  }
  area.addEventListener('drop',event=>{
    if(!invoiceMedia.technician || invoiceMedia.uploading)return;
    const input=mediaElement(invoiceMedia.uploadScope==='serial'?'invoiceMediaSerialFiles':'invoiceMediaInvoiceFiles');
    if(!input || (invoiceMedia.uploadScope==='serial'&&!mediaElement('invoiceMediaSerialSelect')?.value))return;
    const list=event.dataTransfer?.files;
    if(list?.length){input.files=list;updateInvoiceMediaSelection()}
  });
}
bindInvoiceMediaDrop();
mediaElement('invoiceMediaPreview')?.addEventListener('close',closeInvoiceMediaPreview);
