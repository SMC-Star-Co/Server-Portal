// Technical media UI: isolated from invoice details, serial editing and existing permissions.
const invoiceMedia = {
  orderId: null, invoice: '', canUpload: false, canEdit: false, canDelete: false, serials: [], files: [],
  generation: 0, uploading: false, uploadScope: 'serial', view: 'serial',
  urls: new Set(), thumbnailObserver: null, activeSerial: null,
  pending: {serial:[], invoice:[]}, pendingSerial: null,
  abortController: null, uploadCancelled: false, editingFile: null, editSaving: false
};

function mediaSize(value) {
  const n = Number(value) || 0;
  return n >= 1048576 ? (n / 1048576).toFixed(2) + ' MB' : (n / 1024).toFixed(0) + ' KB';
}
function mediaElement(id) { return document.getElementById(id); }
const MEDIA_MAX_BYTES = 500 * 1024 * 1024;
const MEDIA_EXTENSIONS = new Set('jpg jpeg png webp heic heif gif bmp tif tiff mp4 m4v mov webm pdf doc docx xls xlsx ppt pptx txt csv log rtf odt ods'.split(' '));
function mediaExt(name) { return String(name||'').toLowerCase().split('.').pop(); }
function mediaDate(file) {
  return file?.created_at_jalali || 'زمان نامشخص';
}
function mediaSerialLabel(serial) {
  const index=invoiceMedia.serials.indexOf(serial);
  return index>=0 ? (index+1)+'. '+serial : serial;
}
function mediaServerName(file) {
  return file.download_name || 'فایل';
}
function mediaFilteredFiles(files) {
  return [...files].sort((a,b)=>Number(b.id)-Number(a.id));
}
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
  invoiceMedia.pending = {serial:[],invoice:[]};
  invoiceMedia.pendingSerial = null;
}
function openInvoiceMediaFromOps() {
  const id = mediaElement('edit_order_id')?.value;
  if (!id) return;
  invoiceMedia.orderId = String(id);
  invoiceMedia.invoice = '';
  invoiceMedia.canUpload = false;
  invoiceMedia.canEdit = false;
  invoiceMedia.canDelete = false;
  invoiceMedia.files = [];
  invoiceMedia.serials = [];
  invoiceMedia.activeSerial = null;
  invoiceMedia.pending = {serial:[],invoice:[]};
  invoiceMedia.pendingSerial = null;
  for (const id of ['invoiceMediaSerialFiles','invoiceMediaInvoiceFiles']) {
    const input=mediaElement(id);
    if(input) input.value='';
  }
  mediaElement('invoiceMediaUploader').hidden = true;
  mediaElement('invoiceMediaProgress').textContent = '';
  mediaElement('invoiceMediaProgressWrap').hidden = true;
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
  invoiceMedia.pending = {serial:[],invoice:[]};
  invoiceMedia.pendingSerial = null;
  closeInvoiceMediaEdit();
  invoiceMedia.generation++;
  releaseMediaThumbnails();
  const preview = mediaElement('invoiceMediaPreview');
  if (preview?.open) preview.close();
  closeInvoiceMediaPreview();
}
function updateInvoiceMediaTarget() {
  const select = mediaElement('invoiceMediaSerialSelect');
  const serial = select?.value || '';
  if(invoiceMedia.pending.serial.length && invoiceMedia.pendingSerial !== serial) {
    invoiceMedia.pending.serial = [];
    showAppToast('سریال تغییر کرد؛ فایل‌های انتخابی قبلی برای جلوگیری از ثبت اشتباه کنار گذاشته شدند.');
  }
  invoiceMedia.pendingSerial = serial;
  updateInvoiceMediaSelection();
}
function setInvoiceMediaUploadScope(scope) {
  if(invoiceMedia.uploading) return;
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
  drawInvoiceMedia();
}
function chooseInvoiceMediaFiles() {
  if (!invoiceMedia.canUpload || invoiceMedia.uploading) return;
  if (invoiceMedia.uploadScope === 'serial' && !mediaElement('invoiceMediaSerialSelect')?.value) {
    showAppToast('ابتدا سریال سرور را انتخاب کنید.'); return;
  }
  const input = mediaElement(invoiceMedia.uploadScope === 'serial' ? 'invoiceMediaSerialFiles' : 'invoiceMediaInvoiceFiles');
  input?.click();
}
function removePendingMediaFile(index) {
  if(invoiceMedia.uploading) return;
  invoiceMedia.pending[invoiceMedia.uploadScope].splice(index,1);
  renderPendingMediaFiles();
}
function updateInvoiceMediaSelection() {
  // Invoked only by file picker change or drop: copy the File objects into the queue.
  // Never upload directly from the input because a removed file must stay removed.
  const scope=invoiceMedia.uploadScope;
  const input=mediaElement(scope==='serial'?'invoiceMediaSerialFiles':'invoiceMediaInvoiceFiles');
  const selected=Array.from(input?.files || []);
  if(scope==='serial') {
    const current=mediaElement('invoiceMediaSerialSelect')?.value || '';
    if(invoiceMedia.pending.serial.length && invoiceMedia.pendingSerial !== current) invoiceMedia.pending.serial=[];
    invoiceMedia.pendingSerial=current;
  }
  for(const file of selected){
    addPendingMediaFile(file,scope);
  }
  if(input)input.value='';
  renderPendingMediaFiles();
}
function addPendingMediaFile(file,scope) {
  if(!file || !invoiceMedia.canUpload) return;
  if(!invoiceMedia.pending[scope].some(old=>old.name===file.name && old.size===file.size && old.lastModified===file.lastModified)) {
    invoiceMedia.pending[scope].push(file);
  }
}
function renderPendingMediaFiles() {
  const scope=invoiceMedia.uploadScope;
  const queue=invoiceMedia.pending[scope];
  const list=mediaElement('invoiceMediaPendingList');
  const summary=mediaElement('invoiceMediaSelectionSummary');
  const button=mediaElement('invoiceMediaUploadButton');
  if(!list||!summary||!button)return;
  list.replaceChildren();
  const total=queue.reduce((sum,file)=>sum+file.size,0);
  const invalid=queue.some(file=>!file.size||file.size>MEDIA_MAX_BYTES||!MEDIA_EXTENSIONS.has(mediaExt(file.name)));
  summary.textContent=queue.length ? queue.length+' فایل · '+mediaSize(total)+(invalid?' · فایل نامعتبر در صف':'') : 'هنوز فایلی انتخاب نشده است.';
  for(const [index,file] of queue.entries()){
    const row=document.createElement('div');
    row.className='invoice-media-pending-row';
    const icon=document.createElement('span');
    icon.className='invoice-media-pending-type';
    icon.textContent=(file.name.split('.').pop()||'FILE').slice(0,5).toUpperCase();
    const info=document.createElement('div');
    info.className='invoice-media-pending-info';
    const name=document.createElement('strong');
    name.textContent=file.name;
    name.title=file.name;
    const size=document.createElement('small');
    size.textContent=mediaSize(file.size)+(file.size>MEDIA_MAX_BYTES?' · بیش از ۵۰۰ مگابایت':!MEDIA_EXTENSIONS.has(mediaExt(file.name))?' · نوع فایل مجاز نیست':'');
    info.append(name,size);
    const remove=document.createElement('button');
    remove.type='button';remove.className='invoice-media-pending-remove';
    remove.textContent='×';remove.title='حذف از فهرست قبل از آپلود';
    remove.setAttribute('aria-label','حذف '+file.name);
    remove.disabled=invoiceMedia.uploading;
    remove.addEventListener('click',()=>removePendingMediaFile(index));
    row.append(icon,info,remove);
    list.append(row);
  }
  const hasSerial=scope!=='serial'||Boolean(mediaElement('invoiceMediaSerialSelect')?.value);
  button.disabled=invoiceMedia.uploading||!queue.length||invalid||!invoiceMedia.canUpload||!hasSerial;
  for(const id of ['invoiceMediaScopeInvoice','invoiceMediaScopeSerial','invoiceMediaSerialSelect']){
    const element=mediaElement(id);
    if(element)element.disabled=invoiceMedia.uploading || (id==='invoiceMediaSerialSelect'&&!invoiceMedia.serials.length);
  }
}

async function refreshInvoiceMedia() {
  const id = invoiceMedia.orderId;
  if (!id) return;
  const generation = ++invoiceMedia.generation;
  const root = mediaElement('invoiceMediaSerialGroups');
  if (root) root.textContent = 'در حال دریافت فهرست فایل‌ها...';
  try {
    const response = await apiFetch(API_URL + '/orders/' + id + '/media',{cache:'no-store'});
    if (!response.ok) throw new Error('دریافت فایل‌های فاکتور ناموفق بود.');
    const data = await response.json();
    if (invoiceMedia.generation !== generation || invoiceMedia.orderId !== id) return;
    invoiceMedia.invoice = String(data.invoice_number || '');
    invoiceMedia.serials = Array.isArray(data.serials) ? data.serials : [];
    invoiceMedia.files = Array.isArray(data.files) ? data.files : [];
    invoiceMedia.canUpload = Boolean(data.can_upload);
    invoiceMedia.canEdit = Boolean(data.can_edit);
    invoiceMedia.canDelete = Boolean(data.can_delete);
    mediaElement('invoiceMediaModalTitle').textContent = 'فایل‌های فاکتور ' + invoiceMedia.invoice;
    mediaElement('invoiceMediaUploader').hidden = !invoiceMedia.canUpload;
    mediaElement('invoiceMediaPermissionHint').hidden = invoiceMedia.canUpload || invoiceMedia.canEdit || invoiceMedia.canDelete;
    const select = mediaElement('invoiceMediaSerialSelect');
    const old = select.value;
    select.replaceChildren();
    for (const serial of invoiceMedia.serials) {
      const option = document.createElement('option');
      option.value = serial; option.textContent = mediaSerialLabel(serial); select.append(option);
    }
    if (invoiceMedia.serials.includes(old)) select.value = old;
    if (!invoiceMedia.serials.length) {
      const option = document.createElement('option');
      option.textContent = 'سریالی ثبت نشده است'; option.value = ''; select.append(option);
    }
    select.disabled = !invoiceMedia.serials.length;
    const count = invoiceMedia.files.filter(f => f.media_scope === 'serial').length;
    mediaElement('invoiceMediaInvoiceCount').textContent = invoiceMedia.files.length - count;
    mediaElement('invoiceMediaSerialCount').textContent = count;
    updateInvoiceMediaTarget();
    drawInvoiceMedia();
  } catch(error) {
    if (generation === invoiceMedia.generation) {
      if(root) root.textContent='بارگذاری فایل‌ها ناموفق بود؛ دوباره تلاش کنید.';
      if(root) root.textContent = error.message || 'خطا در دریافت اطلاعات';

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
    empty.innerHTML='<span class="invoice-media-empty-icon">▧</span><strong>هنوز فایلی ثبت نشده است</strong><small>مدارک این بخش پس از بارگذاری در اینجا قرار می‌گیرند.</small>';
    container.append(empty); return;
  }
  for (const file of files) {
    const card=document.createElement('article');
    card.className='invoice-media-file-card';
    const type=fileType(file),doc=mediaIcon(type.ext);
    const visual=document.createElement('div');visual.className='invoice-media-file-thumb';
    if (type.kind==='document') {
      const tile=document.createElement('div');tile.className='invoice-media-ext-tile invoice-media-ext-'+doc.kind;
      const short=document.createElement('span');short.textContent=doc.label;
      const hint=document.createElement('small');hint.textContent=type.ext.toUpperCase();
      tile.append(short,hint);visual.append(tile);
    }else{
      visual.classList.add('is-previewable');
      const placeholder=document.createElement('span');placeholder.className='invoice-media-image-placeholder';
      placeholder.textContent=type.kind==='video'?'▷':'▧';visual.append(placeholder);
      visual.dataset.mediaId=String(file.id);
      if(type.kind==='video'){const play=document.createElement('span');play.className='invoice-media-play';play.textContent='▶';visual.append(play)}
      if(invoiceMedia.thumbnailObserver)invoiceMedia.thumbnailObserver.observe(visual);
      if(mediaPreviewable(file)){
        visual.setAttribute('role','button');visual.setAttribute('tabindex','0');
        visual.setAttribute('aria-label','پیش‌نمایش '+mediaServerName(file));
        visual.addEventListener('click',()=>previewInvoiceMedia(file));
        visual.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();previewInvoiceMedia(file)}});
      }
    }
    const extTag=document.createElement('span');extTag.className='invoice-media-thumb-tag';
    extTag.textContent=type.kind==='video'?'ویدیو':type.kind==='image'?'تصویر':type.ext.toUpperCase();
    visual.append(extTag);
    const meta=document.createElement('div');meta.className='invoice-media-file-meta';
    const name=document.createElement('strong');name.className='invoice-media-file-name';
    name.textContent=mediaServerName(file);name.title=mediaServerName(file);name.dir='ltr';
    const sub=document.createElement('div');sub.className='invoice-media-file-detail';
    const size=document.createElement('span');size.className='invoice-media-file-size';size.dir='ltr';size.textContent=mediaSize(file.stored_bytes);
    const date=document.createElement('time');date.className='invoice-media-file-date';date.dir='ltr';date.textContent=mediaDate(file);
    if(file.created_at)date.dateTime=String(file.created_at);
    sub.append(date,size);meta.append(name,sub);
    if(file.uploader_name){const by=document.createElement('small');by.className='invoice-media-uploaded-by';by.textContent='ثبت: '+file.uploader_name;meta.append(by)}
    const actions=document.createElement('div');actions.className='invoice-media-file-actions';
    if(mediaPreviewable(file))actions.append(mediaButton('نمایش','invoice-media-action-view',()=>previewInvoiceMedia(file)));
    actions.append(mediaButton('دریافت','invoice-media-action-download',()=>downloadInvoiceMedia(file)));
    if(invoiceMedia.canEdit)actions.append(mediaButton('ویرایش','invoice-media-action-edit',()=>openInvoiceMediaEdit(file)));
    if(invoiceMedia.canDelete)actions.append(mediaButton('حذف','invoice-media-action-delete',()=>deleteInvoiceMedia(file)));
    card.append(visual,meta,actions);container.append(card);
  }
}
function drawInvoiceMedia() {
  releaseMediaThumbnails();
  const scrollRoot=mediaElement('invoiceMediaModal').querySelector('.invoice-media-browser');
  if('IntersectionObserver' in window){
    invoiceMedia.thumbnailObserver=new IntersectionObserver((entries,observer)=>{
      for(const entry of entries)if(entry.isIntersecting){
        observer.unobserve(entry.target);
        fetchMediaThumbnail(entry.target.dataset.mediaId,entry.target,invoiceMedia.generation);
      }
    },{root:scrollRoot,rootMargin:'180px'});
  }
  const files=invoiceMedia.files;
  const invoiceAll=files.filter(file=>file.media_scope!=='serial');
  const invoiceFiltered=mediaFilteredFiles(invoiceAll);
  drawMediaRows(mediaElement('invoiceMediaInvoiceList'),invoiceFiltered);
  mediaElement('invoiceMediaInvoiceDownloadAll').hidden=!invoiceAll.length;
  const groups=mediaElement('invoiceMediaSerialGroups');groups.replaceChildren();
  const serials=invoiceMedia.serials.slice();
  for(const file of files)if(file.media_scope==='serial' && file.serial_number && !serials.includes(file.serial_number))serials.push(file.serial_number);
  const serialFiles=files.filter(f=>f.media_scope==='serial');
  if(!serials.length){
    const empty=document.createElement('div');empty.className='invoice-media-empty';
    empty.innerHTML='<span class="invoice-media-empty-icon">◈</span><strong>سریالی برای این فاکتور ثبت نشده است.</strong><small>از بخش مدیریت سریال‌ها می‌توانید سرور اضافه کنید.</small>';
    groups.append(empty);
  }else{
    const firstWithFiles=serials.find(serial=>serialFiles.some(file=>file.serial_number===serial));
    if(!invoiceMedia.activeSerial || !serials.includes(invoiceMedia.activeSerial))invoiceMedia.activeSerial=firstWithFiles||serials[0];
    const selector=document.createElement('div');selector.className='invoice-media-serial-selector';
    selector.setAttribute('role','group');selector.setAttribute('aria-label','انتخاب پرونده سرور');
    serials.forEach(serial=>{
      const count=serialFiles.filter(file=>file.serial_number===serial).length;
      const button=document.createElement('button');button.type='button';button.className='invoice-media-serial-chip';
      button.classList.toggle('is-active',serial===invoiceMedia.activeSerial);
      button.setAttribute('aria-pressed',String(serial===invoiceMedia.activeSerial));button.title=mediaSerialLabel(serial);
      const name=document.createElement('strong');name.textContent=mediaSerialLabel(serial);
      const badge=document.createElement('span');badge.className='invoice-media-serial-total';badge.textContent=count.toLocaleString('fa-IR')+' فایل';
      button.append(name,badge);
      button.addEventListener('click',()=>{invoiceMedia.activeSerial=serial;drawInvoiceMedia()});selector.append(button);
    });
    groups.append(selector);
    const selected=invoiceMedia.activeSerial;
    const selectedAll=serialFiles.filter(file=>file.serial_number===selected);
    const selectedFiles=mediaFilteredFiles(selectedAll);
    const panel=document.createElement('div');panel.className='invoice-media-serial-file-panel';
    const top=document.createElement('div');top.className='invoice-media-serial-file-header';
    const description=document.createElement('div');description.className='invoice-media-serial-file-label';
    const label=document.createElement('span');label.textContent='پرونده سرور';
    const current=document.createElement('strong');current.textContent=mediaSerialLabel(selected);
    description.append(label,current);top.append(description);
    if(selectedAll.length)top.append(mediaButton('دریافت همه (ZIP)','secondary-btn',()=>downloadInvoiceMediaGroup('serial',selected)));
    const gallery=document.createElement('div');gallery.className='invoice-media-list';drawMediaRows(gallery,selectedFiles);
    panel.append(top,gallery);groups.append(panel);
  }
  if(!invoiceMedia.thumbnailObserver){
    for(const target of mediaElement('invoiceMediaModal').querySelectorAll('.invoice-media-file-thumb[data-media-id]'))
      fetchMediaThumbnail(target.dataset.mediaId,target,invoiceMedia.generation);
  }
}
async function fetchMediaThumbnail(mediaId,target,generation) {
  if (!target.isConnected || !mediaId) return;
  const id=invoiceMedia.orderId;
  try {
    const res=await apiFetch(API_URL+'/orders/'+id+'/media/'+mediaId+'/thumbnail',{cache:'no-store'});
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
  mediaElement('invoiceMediaPreviewTitle').textContent=mediaServerName(file);
  mediaElement('invoiceMediaPreviewSubtitle').textContent=mediaDate(file)+' · '+mediaSize(file.stored_bytes);
  const zoom=mediaElement('invoiceMediaActualSize');
  zoom.hidden=true;zoom.textContent='اندازه واقعی (۱۰۰٪)';
  try{
    const url=await requestMediaTicket({kind:'file',file_id:file.id,inline:true});
    const type=String(file.mime_type||'');
    let element;
    if(type.startsWith('image/')) {
      element=document.createElement('img');element.alt=mediaServerName(file);
      zoom.hidden=false;
    } else if(type.startsWith('video/')) {
      element=document.createElement('video');element.controls=true;element.preload='metadata';
    } else if(type==='application/pdf') {
      element=document.createElement('iframe');element.title=mediaServerName(file);
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
function sendMediaBinary({method,url,file,headers={},onProgress=()=>{}}) {
  return new Promise((resolve,reject)=>{
    const xhr=new XMLHttpRequest();
    invoiceMedia.abortController=xhr;
    xhr.open(method,url,true);
    xhr.setRequestHeader('Authorization','Bearer '+authToken);
    xhr.setRequestHeader('Content-Type','application/octet-stream');
    for(const [key,value] of Object.entries(headers))xhr.setRequestHeader(key,value);
    xhr.upload.onprogress=event=>{if(event.lengthComputable)onProgress(Math.min(100,Math.round(event.loaded*100/event.total)))};
    xhr.onload=()=>{
      invoiceMedia.abortController=null;
      if(xhr.status===401)logout(false);
      let data={};
      try{data=JSON.parse(xhr.responseText||'{}')}catch{}
      if(xhr.status>=200&&xhr.status<300)return resolve(data);
      reject(new Error(data.error||'ذخیره فایل ناموفق بود.'));
    };
    xhr.onerror=()=>{invoiceMedia.abortController=null;reject(new Error('ارتباط با سرور قطع شد.'))};
    xhr.onabort=()=>{invoiceMedia.abortController=null;reject(new Error('بارگذاری لغو شد.'))};
    xhr.send(file);
  });
}
function cancelInvoiceMediaUpload(){
  if(!invoiceMedia.uploading)return;
  invoiceMedia.uploadCancelled=true;
  invoiceMedia.abortController?.abort();
}
async function uploadInvoiceMedia() {
  if(!invoiceMedia.canUpload||!invoiceMedia.orderId||invoiceMedia.uploading)return;
  const scope=invoiceMedia.uploadScope;
  const serial=scope==='serial'?mediaElement('invoiceMediaSerialSelect').value:'';
  if(scope==='serial'&&!serial)return showAppToast('ابتدا سریال مقصد را انتخاب کنید.');
  const files=invoiceMedia.pending[scope].slice();
  if(!files.length)return showAppToast('فایلی برای آپلود انتخاب نشده است.');
  if(files.some(file=>!file.size||file.size>MEDIA_MAX_BYTES||!MEDIA_EXTENSIONS.has(mediaExt(file.name))))
    return showAppToast('فایل خالی، غیرمجاز یا بزرگ‌تر از ۵۰۰ مگابایت را از صف حذف کنید.');
  const orderId=invoiceMedia.orderId;
  invoiceMedia.uploading=true;invoiceMedia.uploadCancelled=false;
  renderPendingMediaFiles();
  const status=mediaElement('invoiceMediaProgress');
  const progress=mediaElement('invoiceMediaProgressBar');
  mediaElement('invoiceMediaProgressWrap').hidden=false;
  let successful=0,duplicates=0,failures=0;
  try{
    for(const [index,file] of files.entries()){
      if(invoiceMedia.uploadCancelled)break;
      status.textContent='بارگذاری فایل '+(index+1).toLocaleString('fa-IR')+' از '+files.length.toLocaleString('fa-IR')+' · '+file.name;
      progress.style.width='0%';
      try{
        const result=await sendMediaBinary({method:'POST',url:API_URL+'/orders/'+orderId+'/media',file,
          headers:{'X-File-Name':encodeURIComponent(file.name),'X-Media-Scope':scope,
            ...(serial?{'X-Media-Serial':serial}:{})},onProgress:value=>{progress.style.width=value+'%'}});
        successful++;if(result.duplicate)duplicates++;
        const queue=invoiceMedia.pending[scope],position=queue.indexOf(file);
        if(position>=0)queue.splice(position,1);
      }catch(error){
        if(invoiceMedia.uploadCancelled)break;
        failures++;showAppToast(file.name+': '+error.message);
      }
    }
    if(invoiceMedia.orderId===orderId){
      if(scope==='serial')invoiceMedia.activeSerial=serial;
      invoiceMedia.view=scope;
      await refreshInvoiceMedia();setInvoiceMediaView(scope);
      const done=successful.toLocaleString('fa-IR')+' فایل ثبت شد';
      status.textContent=invoiceMedia.uploadCancelled?'آپلود متوقف شد. فایل‌های باقی‌مانده در صف هستند.':
        done+(duplicates?' · '+duplicates.toLocaleString('fa-IR')+' تکراری': '')+
        (failures?' · '+failures.toLocaleString('fa-IR')+' ناموفق؛ قابل تلاش مجدد':'');
      progress.style.width=invoiceMedia.uploadCancelled?'0%':'100%';
    }
  }finally{
    invoiceMedia.uploading=false;invoiceMedia.abortController=null;
    mediaElement('invoiceMediaProgressWrap').hidden=true;
    renderPendingMediaFiles();
  }
}
async function deleteInvoiceMedia(file) {
  if(!invoiceMedia.canDelete||!invoiceMedia.orderId)return;
  if(!confirm('فایل «'+mediaServerName(file)+'» برای همیشه حذف شود؟'))return;
  try{
    const res=await apiFetch(API_URL+'/orders/'+invoiceMedia.orderId+'/media/'+file.id,{method:'DELETE'});
    const data=await res.json();
    if(!res.ok)throw new Error(data.error||'حذف ناموفق بود.');
    await refreshInvoiceMedia();showAppToast('فایل حذف شد.');
  }catch(error){showAppToast(error.message||'حذف ناموفق بود')}
}
function openInvoiceMediaEdit(file) {
  if(!invoiceMedia.canEdit||invoiceMedia.editSaving)return;
  invoiceMedia.editingFile=file;
  mediaElement('invoiceMediaEditForm').reset();
  mediaElement('invoiceMediaEditCurrentName').textContent=mediaServerName(file);
  mediaElement('invoiceMediaEditHelp').textContent='فایل جدید را انتخاب کنید؛ گروه و شناسه فایل حفظ می‌شوند.';
  mediaElement('invoiceMediaEditProgress').textContent='';
  mediaElement('invoiceMediaEditModal').showModal();
  mediaElement('invoiceMediaReplaceInput').focus();
}
function onInvoiceMediaReplacementSelected() {
  const chosen=mediaElement('invoiceMediaReplaceInput').files?.[0];
  if(!chosen)return;
  mediaElement('invoiceMediaEditHelp').textContent='جایگزینی، محتوای اصلی و پیش‌نمایش را تغییر می‌دهد؛ گروه و شناسه فایل حفظ می‌شوند.';
}
function closeInvoiceMediaEdit() {
  if(invoiceMedia.editSaving)return;
  const dialog=mediaElement('invoiceMediaEditModal');
  if(dialog?.open)dialog.close();
  invoiceMedia.editingFile=null;
}
async function saveInvoiceMediaEdit() {
  if(!invoiceMedia.canEdit||invoiceMedia.editSaving||!invoiceMedia.editingFile)return;
  const file=invoiceMedia.editingFile,orderId=invoiceMedia.orderId;
  const replacement=mediaElement('invoiceMediaReplaceInput').files?.[0];
  if(!replacement)return showAppToast('ابتدا فایل جایگزین را انتخاب کنید.');
  const expectedExt=mediaExt(replacement.name);
  if(!replacement.size||replacement.size>MEDIA_MAX_BYTES||!MEDIA_EXTENSIONS.has(expectedExt)||replacement.name.length>180)
    return showAppToast('فایل جایگزین معتبر نیست یا حجم آن بیش از حد مجاز است.');
  invoiceMedia.editSaving=true;
  const button=mediaElement('invoiceMediaEditSave');button.disabled=true;
  const progress=mediaElement('invoiceMediaEditProgress');
  progress.textContent='در حال ذخیره تغییرات...';
  try{
    await sendMediaBinary({method:'PUT',url:API_URL+'/orders/'+orderId+'/media/'+file.id+'/content',file:replacement,
      headers:{'X-File-Name':encodeURIComponent(replacement.name)},
      onProgress:value=>{progress.textContent='در حال جایگزینی فایل: '+value.toLocaleString('fa-IR')+'٪'}});
    invoiceMedia.editSaving=false;closeInvoiceMediaEdit();
    await refreshInvoiceMedia();showAppToast('تغییرات فایل ذخیره شد.');
  }catch(error){progress.textContent=error.message||'ویرایش فایل ناموفق بود.';showAppToast(progress.textContent)}
  finally{invoiceMedia.editSaving=false;button.disabled=false;}
}
function bindInvoiceMediaDrop() {
  const area=mediaElement('invoiceMediaDropzone');
  if(!area)return;
  for (const type of ['dragenter','dragover']) {
    area.addEventListener(type,event=>{event.preventDefault();if(invoiceMedia.canUpload&&!invoiceMedia.uploading)area.classList.add('is-dragging')});
  }
  for (const type of ['dragleave','drop']) {
    area.addEventListener(type,event=>{event.preventDefault();area.classList.remove('is-dragging')});
  }
  area.addEventListener('drop',event=>{
    if(!invoiceMedia.canUpload || invoiceMedia.uploading)return;
    const input=mediaElement(invoiceMedia.uploadScope==='serial'?'invoiceMediaSerialFiles':'invoiceMediaInvoiceFiles');
    if(!input || (invoiceMedia.uploadScope==='serial'&&!mediaElement('invoiceMediaSerialSelect')?.value))return;
    const list=event.dataTransfer?.files;
    if(list?.length){for(const file of Array.from(list))addPendingMediaFile(file,invoiceMedia.uploadScope);renderPendingMediaFiles()}
  });
}
bindInvoiceMediaDrop();
mediaElement('invoiceMediaPreview')?.addEventListener('close',closeInvoiceMediaPreview);

mediaElement('invoiceMediaEditModal')?.addEventListener('cancel',event=>{if(invoiceMedia.editSaving)event.preventDefault();else invoiceMedia.editingFile=null});
