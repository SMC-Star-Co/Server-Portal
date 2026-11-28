// Technical media UI: isolated from invoice details, serial editing and existing permissions.
const invoiceMedia = {
  orderId: null, invoice: '', canUpload: false, canEdit: false, canDelete: false, serials: [], files: [],
  generation: 0, uploading: false, uploadScope: 'serial', view: 'serial',
  urls: new Set(), thumbnailObserver: null, activeSerial: null,
  pending: {serial:[], invoice:[]}, pendingSerial: null,
  abortController: null, uploadCancelled: false, editingFile: null, editSaving: false,
  deleting: false, selectedIds: new Set()
};

function mediaSize(value) {
  const n = Number(value) || 0;
  return n >= 1073741824 ? (n / 1073741824).toFixed(2) + ' GB' : n >= 1048576 ? (n / 1048576).toFixed(2) + ' MB' : (n / 1024).toFixed(0) + ' KB';
}
function mediaGroupDownloadLabel(files) {
  const total=files.reduce((sum,file)=>sum+(Math.max(0,Number(file.stored_bytes)||0)),0);
  return 'دانلود همه (ZIP) · '+mediaSize(total);
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
  // Each group has its own immutable sequence. Old unnumbered rows retain insertion order.
  const sequence=file=>{
    const n=Number(file.sequence_number);
    if(Number.isSafeInteger(n)&&n>0)return n;
    const match=String(file.download_name||'').match(/-(\d+)\.[^.]+$/);
    const fallback=match?Number(match[1]):0;
    return Number.isSafeInteger(fallback)&&fallback>0?fallback:0;
  };
  return [...files].sort((a,b)=>sequence(a)-sequence(b)||Number(a.id)-Number(b.id));
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
  closeInvoiceMediaModal(true);
  invoiceMedia.orderId = null;
  invoiceMedia.activeSerial = null;
  invoiceMedia.selectedIds.clear();
  invoiceMedia.invoice = '';
  invoiceMedia.serials = [];
  invoiceMedia.files = [];
  invoiceMedia.pending = {serial:[],invoice:[]};
  invoiceMedia.pendingSerial = null;
}
function openInvoiceMediaFromOps() {
  if (invoiceMedia.deleting) return;
  invoiceMedia.selectedIds.clear();
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
  renderMediaUploadSerialOptions('');
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
function closeInvoiceMediaModal(force = false) {
  if (invoiceMedia.deleting && !force) {
    showAppToast('پس از پایان حذف فایل‌ها می‌توانید این پنجره را ببندید.');
    return;
  }
  if (invoiceMedia.uploading) {
    showAppToast('پس از پایان آپلود می‌توانید این پنجره را ببندید.');
    return;
  }
  const modal = mediaElement('invoiceMediaModal');
  if (modal) modal.style.display = 'none';
  invoiceMedia.activeSerial = null;
  invoiceMedia.selectedIds.clear();
  invoiceMedia.pending = {serial:[],invoice:[]};
  invoiceMedia.pendingSerial = null;
  closeInvoiceMediaEdit();
  invoiceMedia.generation++;
  releaseMediaThumbnails();
  const preview = mediaElement('invoiceMediaPreview');
  if (preview?.open) preview.close();
  closeInvoiceMediaPreview();
}
function updateInvoiceMediaTarget(fromUser = false) {
  const select = mediaElement('invoiceMediaSerialSelect');
  if (fromUser && (invoiceMedia.uploading || invoiceMedia.deleting)) {
    if (select) select.value = invoiceMedia.pendingSerial || '';
    return;
  }
  const serial = select?.value || '';
  if(invoiceMedia.pending.serial.length && invoiceMedia.pendingSerial !== serial) {
    invoiceMedia.pending.serial = [];
    showAppToast('سریال تغییر کرد؛ فایل‌های انتخابی قبلی برای جلوگیری از ثبت اشتباه کنار گذاشته شدند.');
  }
  invoiceMedia.pendingSerial = serial;
  updateInvoiceMediaSelection();
  if (fromUser && invoiceMedia.uploadScope === 'serial') selectMediaSerialGallery(serial);
}
function renderMediaUploadSerialOptions(previous = '') {
  const select = mediaElement('invoiceMediaSerialSelect');
  if (!select) return;
  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = invoiceMedia.serials.length ? 'انتخاب سریال سرور...' : 'سریالی ثبت نشده است';
  select.replaceChildren(placeholder);
  for (const serial of invoiceMedia.serials) {
    const option = document.createElement('option');
    option.value = serial; option.textContent = mediaSerialLabel(serial); select.append(option);
  }
  select.value = invoiceMedia.serials.includes(previous) ? previous : '';
  select.disabled = invoiceMedia.uploading || invoiceMedia.deleting || !invoiceMedia.serials.length;
}
function selectMediaSerialGallery(serial, fromGallery = false) {
  if (invoiceMedia.deleting || (fromGallery && invoiceMedia.uploading)) return;
  const next = serial || null;
  if (next && !invoiceMedia.serials.includes(next) && !invoiceMedia.files.some(file=>file.media_scope==='serial' && file.serial_number===next)) return;
  if (invoiceMedia.activeSerial !== next) invoiceMedia.selectedIds.clear();
  invoiceMedia.activeSerial = next;
  // A user-selected gallery also sets the upload destination. Archived serials
  // may still have files, but must not become valid destinations for new files.
  if (fromGallery && invoiceMedia.canUpload) {
    const select = mediaElement('invoiceMediaSerialSelect');
    if (select) {
      select.value = invoiceMedia.serials.includes(next) ? next : '';
      // Reuse the existing queue safety checks; no synthetic change event or recursion.
      setInvoiceMediaUploadScope('serial');
    }
  }
  setInvoiceMediaView('serial');
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
  if (invoiceMedia.deleting) return;
  const next = view === 'serial' ? 'serial' : 'invoice';
  if (invoiceMedia.view !== next) invoiceMedia.selectedIds.clear();
  invoiceMedia.view = next;
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
  if (!invoiceMedia.canUpload || invoiceMedia.uploading || invoiceMedia.deleting) return;
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
  if(!file || !invoiceMedia.canUpload || invoiceMedia.deleting) return;
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
    if(element)element.disabled=invoiceMedia.uploading || invoiceMedia.deleting || (id==='invoiceMediaSerialSelect'&&!invoiceMedia.serials.length);
  }
}

let mediaSyncRequest = 0;
function canRefreshOpenMedia() {
  return !invoiceMedia.uploading && !invoiceMedia.editSaving && !invoiceMedia.deleting &&
    !mediaElement('invoiceMediaPreview')?.open && !mediaElement('invoiceMediaEditModal')?.open &&
    !invoiceMedia.pending.serial.length && !invoiceMedia.pending.invoice.length;
}
async function refreshOpenInvoiceMediaSilently() {
  if (!invoiceMedia.orderId || !mediaElement('invoiceMediaModal')?.getClientRects().length) return true;
  if (!canRefreshOpenMedia()) return false;
  return refreshInvoiceMedia(true);
}
async function refreshInvoiceMedia(silent = false, afterDelete = false) {
  if (invoiceMedia.deleting && !afterDelete) return false;
  const id = invoiceMedia.orderId;
  if (!id) return;
  const requestId = ++mediaSyncRequest;
  const generation = silent ? invoiceMedia.generation : ++invoiceMedia.generation;
  const root = mediaElement('invoiceMediaSerialGroups');
  if (root && !silent) root.textContent = 'در حال بارگذاری فهرست فایل‌ها...';
  try {
    const response = await apiFetch(API_URL + '/orders/' + id + '/media',{cache:'no-store'});
    if (!response.ok) throw new Error('بارگذاری فهرست فایل‌های فاکتور ناموفق بود.');
    const data = await response.json();
    if (invoiceMedia.generation !== generation || invoiceMedia.orderId !== id || requestId !== mediaSyncRequest) return true;
    if (silent && !canRefreshOpenMedia()) return false;
    const nextSerials = Array.isArray(data.serials) ? data.serials : [];
    const nextFiles = Array.isArray(data.files) ? data.files : [];
    if (silent && PortalLiveRefresh.sameData(invoiceMedia.serials,nextSerials) && PortalLiveRefresh.sameData(invoiceMedia.files,nextFiles) &&
        invoiceMedia.invoice === String(data.invoice_number || '') && invoiceMedia.canUpload === Boolean(data.can_upload) &&
        invoiceMedia.canEdit === Boolean(data.can_edit) && invoiceMedia.canDelete === Boolean(data.can_delete)) return true;
    if (silent) invoiceMedia.generation++;
    const scrollRoot = mediaElement('invoiceMediaModal')?.querySelector('.invoice-media-browser');
    const scrollTop = scrollRoot?.scrollTop || 0;
    invoiceMedia.invoice = String(data.invoice_number || '');
    invoiceMedia.serials = Array.isArray(data.serials) ? data.serials : [];
    invoiceMedia.files = Array.isArray(data.files) ? data.files : [];
    invoiceMedia.canUpload = Boolean(data.can_upload);
    invoiceMedia.canEdit = Boolean(data.can_edit);
    invoiceMedia.canDelete = Boolean(data.can_delete);
    if (!invoiceMedia.canDelete) invoiceMedia.selectedIds.clear();
    mediaElement('invoiceMediaModalTitle').textContent = 'فایل‌های فاکتور ' + invoiceMedia.invoice;
    mediaElement('invoiceMediaUploader').hidden = !invoiceMedia.canUpload;
    mediaElement('invoiceMediaPermissionHint').hidden = invoiceMedia.canUpload || invoiceMedia.canEdit || invoiceMedia.canDelete;
    renderMediaUploadSerialOptions(mediaElement('invoiceMediaSerialSelect').value);
    const count = invoiceMedia.files.filter(f => f.media_scope === 'serial').length;
    mediaElement('invoiceMediaInvoiceCount').textContent = invoiceMedia.files.length - count;
    mediaElement('invoiceMediaSerialCount').textContent = count;
    updateInvoiceMediaTarget();
    drawInvoiceMedia();
    if (silent && scrollRoot) scrollRoot.scrollTop = scrollTop;
    return true;
  } catch(error) {
    if (!silent && requestId === mediaSyncRequest && generation === invoiceMedia.generation) {
      if(root) root.textContent='بارگذاری فایل‌ها ناموفق بود؛ دوباره تلاش کنید.';
      if(root) root.textContent = error.message || 'خطا در بارگذاری اطلاعات';
    }
    return true; // Retry on the next event or periodic sync, not in a tight loop.
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
const MEDIA_DOCUMENT_EXTENSIONS=new Set('pdf doc docx xls xlsx ppt pptx txt csv log rtf odt ods'.split(' '));
function mediaDocumentExtension(file){
  if(file.mime_type==='application/pdf')return 'pdf';
  const ext=mediaExt(file.download_name||file.original_name);
  return MEDIA_DOCUMENT_EXTENSIONS.has(ext)?ext:'';
}
function mediaPreviewable(file) {
  return Boolean(mediaDocumentExtension(file))||['image/jpeg','image/png','image/webp','image/gif','image/bmp',
    'video/mp4','video/webm','video/quicktime'].includes(file.mime_type);
}
// File selection belongs only to the visible invoice group or the current serial.
function mediaGroupFiles(scope,serial) {
  return invoiceMedia.files.filter(file=>scope==='serial'
    ? Boolean(serial) && file.media_scope==='serial' && file.serial_number===serial
    : file.media_scope!=='serial');
}
function isCurrentMediaGroup(scope,serial) {
  return invoiceMedia.view===scope && (scope==='invoice'||Boolean(serial)&&invoiceMedia.activeSerial===serial);
}
function pruneMediaSelection() {
  const ids=new Set(mediaGroupFiles(invoiceMedia.view,invoiceMedia.activeSerial).map(file=>String(file.id)));
  for(const id of invoiceMedia.selectedIds)if(!invoiceMedia.canDelete||!ids.has(id))invoiceMedia.selectedIds.delete(id);
}
function mediaSelectedFiles(scope,serial) {
  if(!invoiceMedia.canDelete||!isCurrentMediaGroup(scope,serial))return [];
  return mediaGroupFiles(scope,serial).filter(file=>invoiceMedia.selectedIds.has(String(file.id)));
}
function updateMediaGroupSelection(scope,serial,files,checked) {
  if(!invoiceMedia.canDelete||invoiceMedia.deleting||!isCurrentMediaGroup(scope,serial))return;
  const allowed=new Set(mediaGroupFiles(scope,serial).map(file=>String(file.id)));
  for(const file of files){
    const id=String(file.id);
    if(!allowed.has(id))continue;
    if(checked)invoiceMedia.selectedIds.add(id);else invoiceMedia.selectedIds.delete(id);
  }
}
function drawMediaSelectionControls(root,files,scope,serial) {
  root.replaceChildren();
  root.hidden=!invoiceMedia.canDelete||!files.length;
  if(root.hidden)return null;
  const controls=document.createElement('div');controls.className='invoice-media-bulk-controls';
  const label=document.createElement('label');label.className='invoice-media-select-all';
  const all=document.createElement('input');all.type='checkbox';
  const caption=document.createElement('span');caption.textContent='انتخاب همه';
  label.append(all,caption);
  const count=document.createElement('span');count.className='invoice-media-selected-count';count.setAttribute('aria-live','polite');
  const remove=mediaButton('حذف انتخاب‌شده‌ها','invoice-media-bulk-delete',()=>deleteSelectedInvoiceMedia(scope,serial));
  const entries=[];
  function sync(){
    const selected=new Set(mediaSelectedFiles(scope,serial).map(file=>String(file.id)));
    const total=files.filter(file=>selected.has(String(file.id))).length;
    const inactive=invoiceMedia.deleting||!isCurrentMediaGroup(scope,serial);
    all.checked=total>0&&total===files.length;
    all.indeterminate=total>0&&total<files.length;
    all.disabled=inactive;
    remove.disabled=inactive||!total;
    remove.textContent=invoiceMedia.deleting?'در حال حذف...':'حذف انتخاب‌شده‌ها';
    count.textContent=total.toLocaleString('fa-IR')+' از '+files.length.toLocaleString('fa-IR')+' فایل انتخاب شده';
    for(const {file,card,input} of entries){
      input.checked=selected.has(String(file.id));input.disabled=inactive;
      card.classList.toggle('is-media-selected',input.checked);
    }
  }
  all.addEventListener('change',()=>{updateMediaGroupSelection(scope,serial,files,all.checked);sync();});
  controls.append(label,count,remove);root.append(controls);sync();
  return {
    attach(file,card,actions){
      const holder=document.createElement('label');holder.className='invoice-media-file-select';holder.title='انتخاب '+mediaServerName(file);
      const input=document.createElement('input');input.type='checkbox';input.setAttribute('aria-label','انتخاب '+mediaServerName(file));
      holder.append(input);actions.append(holder);entries.push({file,card,input});
      input.addEventListener('change',()=>{updateMediaGroupSelection(scope,serial,[file],input.checked);sync();});
    },
    sync
  };
}
function drawMediaRows(container,files,selection = null) {
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
      if(mediaPreviewable(file)){
        visual.classList.add('is-previewable');visual.setAttribute('role','button');visual.tabIndex=0;
        visual.setAttribute('aria-label','پیش‌نمایش '+mediaServerName(file));
        visual.addEventListener('click',()=>previewInvoiceMedia(file));
        visual.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();previewInvoiceMedia(file);}});
      }
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
    const nameRow=document.createElement('div');nameRow.className='invoice-media-file-heading';
    const sub=document.createElement('div');sub.className='invoice-media-file-detail';
    const size=document.createElement('span');size.className='invoice-media-file-size';size.dir='ltr';size.textContent=mediaSize(file.stored_bytes);
    const date=document.createElement('time');date.className='invoice-media-file-date';date.dir='ltr';date.textContent=mediaDate(file);
    if(file.created_at)date.dateTime=String(file.created_at);
    nameRow.append(name,size);
    const by=document.createElement('small');by.className='invoice-media-uploaded-by';
    by.textContent=file.uploader_name||'نامشخص';by.title=by.textContent;
    sub.append(date,by);meta.append(nameRow,sub);
    const actions=document.createElement('div');actions.className='invoice-media-file-actions';
    selection?.attach(file,card,actions);
    if(mediaPreviewable(file))actions.append(mediaButton('نمایش','invoice-media-action-view',()=>previewInvoiceMedia(file)));
    actions.append(mediaButton('دانلود','invoice-media-action-download',()=>downloadInvoiceMedia(file)));
    if(invoiceMedia.canEdit)actions.append(mediaButton('ویرایش','invoice-media-action-edit',()=>openInvoiceMediaEdit(file)));
    if(invoiceMedia.canDelete)actions.append(mediaButton('حذف','invoice-media-action-delete',()=>deleteInvoiceMedia(file)));
    card.append(visual,meta,actions);container.append(card);
  }
  selection?.sync();
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
  if (invoiceMedia.activeSerial && !invoiceMedia.serials.includes(invoiceMedia.activeSerial) &&
      !files.some(file=>file.media_scope==='serial' && file.serial_number===invoiceMedia.activeSerial)) {
    if(invoiceMedia.view==='serial')invoiceMedia.selectedIds.clear();
    invoiceMedia.activeSerial=null;
  }
  pruneMediaSelection();
  const invoiceFiltered=mediaFilteredFiles(invoiceAll);
  const invoiceSelection=drawMediaSelectionControls(mediaElement('invoiceMediaInvoiceSelection'),invoiceFiltered,'invoice',null);
  drawMediaRows(mediaElement('invoiceMediaInvoiceList'),invoiceFiltered,invoiceSelection);
  if(mediaPreviewNavigation)updateMediaPreviewNavigation();
  const invoiceDownload=mediaElement('invoiceMediaInvoiceDownloadAll');
  invoiceDownload.hidden=!invoiceAll.length;
  invoiceDownload.textContent=mediaGroupDownloadLabel(invoiceAll);
  invoiceDownload.title='مجموع حجم فایل‌های اصلی این بخش، پیش از بسته‌بندی ZIP';
  const groups=mediaElement('invoiceMediaSerialGroups');groups.replaceChildren();
  const serials=invoiceMedia.serials.slice();
  for(const file of files)if(file.media_scope==='serial' && file.serial_number && !serials.includes(file.serial_number))serials.push(file.serial_number);
  const serialFiles=files.filter(f=>f.media_scope==='serial');
  if(!serials.length){
    const empty=document.createElement('div');empty.className='invoice-media-empty';
    empty.innerHTML='<span class="invoice-media-empty-icon">◈</span><strong>سریالی برای این فاکتور ثبت نشده است.</strong><small>از بخش مدیریت سریال‌ها می‌توانید سرور اضافه کنید.</small>';
    groups.append(empty);
  }else{
    const selector=document.createElement('div');selector.className='invoice-media-serial-selector';selector.dir='ltr';
    selector.setAttribute('role','group');selector.setAttribute('aria-label','انتخاب پرونده سرور');
    serials.forEach(serial=>{
      const count=serialFiles.filter(file=>file.serial_number===serial).length;
      const button=document.createElement('button');button.type='button';button.className='invoice-media-serial-chip';
      button.classList.toggle('is-active',serial===invoiceMedia.activeSerial);
      button.setAttribute('aria-pressed',String(serial===invoiceMedia.activeSerial));button.title=mediaSerialLabel(serial);
      const name=document.createElement('strong');name.dir='ltr';name.textContent=mediaSerialLabel(serial);
      const badge=document.createElement('span');badge.className='invoice-media-serial-total';badge.dir='rtl';badge.textContent=count.toLocaleString('fa-IR')+' فایل';
      button.append(name,badge);
      button.addEventListener('click',()=>{
        if(invoiceMedia.deleting||invoiceMedia.uploading)return;
        selectMediaSerialGallery(serial,true);
      });selector.append(button);
    });
    groups.append(selector);
    const selected=invoiceMedia.activeSerial;
    if(selected){
      const selectedAll=serialFiles.filter(file=>file.serial_number===selected);
      const selectedFiles=mediaFilteredFiles(selectedAll);
      const panel=document.createElement('div');panel.className='invoice-media-serial-file-panel';
      const top=document.createElement('div');top.className='invoice-media-serial-file-header';
      const description=document.createElement('div');description.className='invoice-media-serial-file-label';
      const label=document.createElement('span');label.textContent='پرونده سرور';
      const current=document.createElement('strong');current.textContent=mediaSerialLabel(selected);
      description.append(label,current);
      if(selectedAll.length){
        const download=mediaButton(mediaGroupDownloadLabel(selectedAll),'secondary-btn',()=>downloadInvoiceMediaGroup('serial',selected));
        download.title='مجموع حجم فایل‌های اصلی این سرور، پیش از بسته‌بندی ZIP';
        top.append(download);
      }
      top.append(description);
      const controls=document.createElement('div');
      const selection=drawMediaSelectionControls(controls,selectedFiles,'serial',selected);
      const gallery=document.createElement('div');gallery.className='invoice-media-list';drawMediaRows(gallery,selectedFiles,selection);
      panel.append(top,controls,gallery);groups.append(panel);
    }
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
  if(!res.ok || !data.url)throw new Error(data.error||'امکان ساخت لینک دانلود وجود ندارد.');
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
  catch(error){showAppToast(error.message||'خطا در دانلود فایل')}
}
async function downloadInvoiceMediaGroup(scope,serial) {
  try{followMediaLink(await requestMediaTicket({kind:'zip',scope,serial_number:scope==='serial'?serial:undefined}),true)}
  catch(error){showAppToast(error.message||'خطا در دانلود گروهی')}
}
// Click to zoom at the pointer; drag a zoomed image without toggling zoom.
function bindMediaImageZoom(stage,img) {
  let scale=1,offsetX=0,offsetY=0,fit=1,baseWidth=0,baseHeight=0,drag=null;
  let disposed=false;
  const clamp=(value,min,max)=>Math.min(max,Math.max(min,value));
  function render(){
    const limitX=Math.max(0,(baseWidth*scale-stage.clientWidth)/2);
    const limitY=Math.max(0,(baseHeight*scale-stage.clientHeight)/2);
    offsetX=clamp(offsetX,-limitX,limitX);
    offsetY=clamp(offsetY,-limitY,limitY);
    img.style.transform='translate(-50%, -50%) translate('+offsetX+'px, '+offsetY+'px) scale('+scale+')';
    stage.classList.toggle('is-zoomed',scale>1);
    stage.classList.toggle('is-panning',Boolean(drag?.moved));
    img.setAttribute('aria-pressed',String(scale>1));
  }
  function layout(){
    if(disposed||!img.naturalWidth||!img.naturalHeight||!stage.clientWidth||!stage.clientHeight)return;
    fit=Math.min(1,Math.max(1,stage.clientWidth-16)/img.naturalWidth,Math.max(1,stage.clientHeight-16)/img.naturalHeight);
    baseWidth=img.naturalWidth*fit;baseHeight=img.naturalHeight*fit;
    img.style.width=baseWidth+'px';img.style.height=baseHeight+'px';
    render();
  }
  function toggle(clientX,clientY){
    if(!baseWidth||!baseHeight)return;
    if(scale>1){scale=1;offsetX=0;offsetY=0;}
    else{
      const next=Math.min(5,Math.max(2,1/fit));
      const rect=stage.getBoundingClientRect();
      const x=clientX-rect.left-stage.clientWidth/2;
      const y=clientY-rect.top-stage.clientHeight/2;
      scale=next;offsetX=x*(1-next);offsetY=y*(1-next);
    }
    render();
  }
  function down(e){
    if(e.isPrimary===false||e.button!==0||!baseWidth)return;
    e.preventDefault();
    drag={id:e.pointerId,x:e.clientX,y:e.clientY,startX:offsetX,startY:offsetY,moved:false};
    img.setPointerCapture?.(e.pointerId);
  }
  function move(e){
    if(!drag||drag.id!==e.pointerId)return;
    const dx=e.clientX-drag.x,dy=e.clientY-drag.y;
    if(Math.hypot(dx,dy)>4)drag.moved=true;
    if(scale>1&&drag.moved){offsetX=drag.startX+dx;offsetY=drag.startY+dy;render();}
  }
  function up(e){
    if(!drag||drag.id!==e.pointerId)return;
    const moved=drag.moved||Math.hypot(e.clientX-drag.x,e.clientY-drag.y)>4;
    drag=null;
    if(img.hasPointerCapture?.(e.pointerId))img.releasePointerCapture(e.pointerId);
    if(!moved)toggle(e.clientX,e.clientY);
    else render();
  }
  function cancel(e){
    if(drag&&drag.id===e.pointerId){drag=null;render();}
  }
  function key(e){
    if(e.key!=='Enter'&&e.key!==' ')return;
    e.preventDefault();
    const rect=stage.getBoundingClientRect();
    toggle(rect.left+stage.clientWidth/2,rect.top+stage.clientHeight/2);
  }
  img.draggable=false;img.tabIndex=0;img.setAttribute('role','button');
  img.setAttribute('aria-label',(img.alt||'تصویر')+'؛ کلیک برای بزرگنمایی یا بازگشت');
  img.setAttribute('aria-pressed','false');
  img.addEventListener('load',layout);
  img.addEventListener('pointerdown',down);img.addEventListener('pointermove',move);
  img.addEventListener('pointerup',up);img.addEventListener('pointercancel',cancel);
  img.addEventListener('lostpointercapture',cancel);img.addEventListener('keydown',key);
  const observer=typeof ResizeObserver==='function'?new ResizeObserver(layout):null;
  if(observer)observer.observe(stage);else window.addEventListener('resize',layout);
  if(img.complete)layout();
  return ()=>{
    disposed=true;drag=null;
    observer?.disconnect();if(!observer)window.removeEventListener('resize',layout);
    img.removeEventListener('load',layout);
    img.removeEventListener('pointerdown',down);img.removeEventListener('pointermove',move);
    img.removeEventListener('pointerup',up);img.removeEventListener('pointercancel',cancel);
    img.removeEventListener('lostpointercapture',cancel);img.removeEventListener('keydown',key);
  };
}
// Render each PDF page as an authenticated PNG from the server; no browser PDF plug-in required.
// Browser-side PDF renderer; Office files are converted to temporary PDFs in a separate service.
let mediaPdfLibrary=null;
function loadMediaPdfLibrary(){
  if(!mediaPdfLibrary){
    const css=new Promise((resolve,reject)=>{
      const old=document.getElementById('invoiceMediaPdfStyles');if(old){resolve();return;}
      const link=document.createElement('link');link.id='invoiceMediaPdfStyles';link.rel='stylesheet';link.href='/pdfjs/web/pdf_viewer.css';
      link.onload=resolve;link.onerror=()=>{link.remove();reject(Error('بارگذاری نمایشگر سند ناموفق بود.'));};document.head.append(link);
    });
    mediaPdfLibrary=Promise.all([import('/pdfjs/legacy/build/pdf.mjs'),css]).then(([lib])=>{
      lib.GlobalWorkerOptions.workerSrc='/pdfjs/legacy/build/pdf.worker.mjs';return lib;
    }).catch(error=>{mediaPdfLibrary=null;throw error;});
  }
  return mediaPdfLibrary;
}
// Fetch PDF bytes explicitly, never navigate to a file URL. Keep large PDFs range-based.
// JSON transport keeps document preview separate from browser/IDM file downloads.
const MEDIA_PDF_CHUNK=512*1024,MEDIA_PDF_LIMIT=500*1024*1024;
function mediaPdfSignature(bytes){
  const head=bytes.subarray(0,1024);
  for(let i=0;i+4<head.length;i++)if(head[i]===37&&head[i+1]===80&&head[i+2]===68&&head[i+3]===70&&head[i+4]===45)return true;
  return false;
}
function decodeMediaDocument(value,expected){
  if(typeof value!=='string'||!Number.isSafeInteger(expected)||expected<1||value.length!==4*Math.ceil(expected/3))throw Error('طول داده سند معتبر نیست.');
  const binary=atob(value);
  if(binary.length!==expected)throw Error('داده سند ناقص است.');
  const bytes=new Uint8Array(expected);
  for(let i=0;i<expected;i++)bytes[i]=binary.charCodeAt(i);
  return bytes;
}
async function requestMediaDocumentData(endpoint,body,signal){
  const response=await apiFetch(endpoint,{method:'POST',cache:'no-store',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify(body),signal});
  const data=await response.json().catch(()=>null);
  if(response.status!==200||!data)throw Error(data?.error||'پاسخ نامعتبر نمایشگر سند ('+response.status+'). پس از به‌روزرسانی سرور دوباره تلاش کنید.');
  return data;
}
async function loadMediaPdfSource(lib,file,endpoint,signal,onFailure){
  let total=null,version=null;
  async function read(offset,length){
    if(signal.aborted)throw new DOMException('Aborted','AbortError');
    const body={offset,length};if(version!==null)body.version=version;
    const value=await requestMediaDocumentData(endpoint,body,signal);
    if(value.kind!=='pdf-chunk'||value.offset!==offset||!Number.isSafeInteger(value.total)||value.total<1||value.total>MEDIA_PDF_LIMIT||typeof value.version!=='string'||!/^[a-f0-9]{64}$/.test(value.version))throw Error('پاسخ داده PDF معتبر نیست.');
    if(total!==null&&(total!==value.total||version!==value.version))throw Error('نسخه سند تغییر کرده است؛ دوباره آن را باز کنید.');
    total=value.total;version=value.version;
    if(offset>=total)throw Error('محدوده داده سند معتبر نیست.');
    const bytes=decodeMediaDocument(value.data,Math.min(length,total-offset));
    if(offset===0&&!mediaPdfSignature(bytes))throw Error('محتوای PDF معتبر نیست.');
    return bytes;
  }
  const first=await read(0,MEDIA_PDF_CHUNK);
  if(first.length===total)return {data:first};
  const range=new lib.PDFDataRangeTransport(total,first,true);
  let aborted=false;
  range.abort=()=>{aborted=true;};
  range.requestDataRange=async(begin,end)=>{
    if(aborted||signal.aborted)return;
    try{
      if(!Number.isSafeInteger(begin)||!Number.isSafeInteger(end)||begin<0||end>total||end<=begin)throw Error('محدوده درخواست PDF معتبر نیست.');
      const bytes=new Uint8Array(end-begin);
      for(let offset=begin;offset<end;){
        if(aborted||signal.aborted)return;
        const chunk=await read(offset,Math.min(MEDIA_PDF_CHUNK,end-offset));
        bytes.set(chunk,offset-begin);offset+=chunk.length;
      }
      if(!aborted&&!signal.aborted)range.onDataRange(begin,bytes);
    }catch(error){if(!aborted&&!signal.aborted){aborted=true;onFailure(error);}}
  };
  return {range,disableStream:true,disableAutoFetch:true,rangeChunkSize:MEDIA_PDF_CHUNK};
}
async function openMediaDocumentPreview(file,dialog,body,request){
  const ext=mediaDocumentExtension(file),plain=['txt','log','csv'].includes(ext);
  const endpoint=API_URL+'/orders/'+invoiceMedia.orderId+'/media/'+file.id+'/document-data';
  const controller=new AbortController();
  let closed=false,task=null,pdf=null,renderTask=null,textLayer=null,revision=0,current=1,total=0,zoom=1,fit=false,lib=null,text=null,lastScale=1;
  const active=()=>!closed&&request===mediaPreviewRequest;
  const shell=document.createElement('div');shell.className='invoice-media-pdf-view';
  const toolbar=document.createElement('div');toolbar.className='invoice-media-pdf-toolbar';toolbar.dir='rtl';
  const stage=document.createElement('div');stage.className='invoice-media-document-stage';
  const status=document.createElement('div');status.className='invoice-media-document-status';status.setAttribute('role','status');
  const previous=mediaButton('صفحه قبل','secondary-btn',()=>{if(current>1){current--;stage.scrollTop=0;render();}});
  const next=mediaButton('صفحه بعد','secondary-btn',()=>{if(current<total){current++;stage.scrollTop=0;render();}});
  const number=document.createElement('span');number.className='invoice-media-pdf-page-number';number.setAttribute('aria-live','polite');
  const minus=mediaButton('−','secondary-btn',()=>setZoom(-.25));minus.setAttribute('aria-label','کوچک‌نمایی');
  const plus=mediaButton('+','secondary-btn',()=>setZoom(.25));plus.setAttribute('aria-label','بزرگ‌نمایی');
  const zoomLabel=document.createElement('span');zoomLabel.className='invoice-media-document-zoom';
  const fitButton=mediaButton('تناسب با عرض','secondary-btn',()=>{fit=!plain;zoom=1;render();});
  toolbar.append(previous,number,next,minus,zoomLabel,plus,fitButton);shell.append(toolbar,stage);body.append(shell);body.classList.add('is-pdf-preview');
  function message(value){stage.replaceChildren(status);status.textContent=value;}
  function sync(){
    previous.hidden=next.hidden=number.hidden=plain;
    previous.disabled=!pdf||current<=1;next.disabled=!pdf||current>=total;
    minus.disabled=plus.disabled=fitButton.disabled=!pdf&&text===null;
    number.textContent=total?'صفحه '+current+' از '+total:'سند';
    zoomLabel.textContent=fit?'خودکار':Math.round(zoom*100)+'%';
  }
  function setZoom(delta){if(!pdf&&text===null)return;if(fit){fit=false;zoom=lastScale;}zoom=Math.max(.25,Math.min(3,zoom+delta));render();}
  async function render(){
    if(!active())return;
    const id=++revision;renderTask?.cancel();textLayer?.cancel();renderTask=null;textLayer=null;sync();
    if(plain&&text!==null){const pre=document.createElement('pre');pre.className='invoice-media-document-text';pre.dir='auto';pre.style.fontSize=(14*zoom)+'px';pre.textContent=text;stage.replaceChildren(pre);return;}
    if(!pdf)return;
    try{
      const page=await pdf.getPage(current);if(!active()||id!==revision)return;
      const unit=page.getViewport({scale:1});
      const scale=fit?Math.max(.25,Math.min(2,(stage.clientWidth-32)/unit.width)):zoom;lastScale=scale;
      const viewport=page.getViewport({scale});
      const ratio=Math.min(window.devicePixelRatio||1,2,Math.sqrt(12000000/(viewport.width*viewport.height)));
      const sheet=document.createElement('div');sheet.className='invoice-media-document-page';
      sheet.style.width=viewport.width+'px';sheet.style.height=viewport.height+'px';
      sheet.style.setProperty('--total-scale-factor',String(scale*(page.userUnit||1)));sheet.style.setProperty('--scale-round-x','1px');sheet.style.setProperty('--scale-round-y','1px');
      const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.floor(viewport.width*ratio));canvas.height=Math.max(1,Math.floor(viewport.height*ratio));canvas.style.width=viewport.width+'px';canvas.style.height=viewport.height+'px';
      const layer=document.createElement('div');layer.className='textLayer';sheet.append(canvas,layer);stage.replaceChildren(sheet);
      renderTask=page.render({canvas,canvasContext:canvas.getContext('2d'),viewport,transform:[ratio,0,0,ratio,0,0]});await renderTask.promise;
      if(!active()||id!==revision)return;
      textLayer=new lib.TextLayer({textContentSource:page.streamTextContent(),container:layer,viewport});await textLayer.render();
    }catch(error){if(active()&&id===revision&&error.name!=='RenderingCancelledException'&&error.name!=='AbortException')message('نمایش این صفحه ممکن نیست.');}
  }
  let resizeTimer=null;
  const observer=typeof ResizeObserver==='function'?new ResizeObserver(()=>{if(fit&&pdf){clearTimeout(resizeTimer);resizeTimer=setTimeout(render,100);}}):null;
  observer?.observe(stage);
  mediaPreviewCleanup=()=>{closed=true;++revision;controller.abort();clearTimeout(resizeTimer);observer?.disconnect();renderTask?.cancel();textLayer?.cancel();if(task)Promise.resolve(task.destroy()).catch(()=>{});};
  if(!dialog.open)dialog.showModal();sync();message('در حال آماده‌سازی سند…');
  try{
    if(plain){const result=await requestMediaDocumentData(endpoint,{},controller.signal);if(result.kind!=='text'||typeof result.text!=='string')throw Error('محتوای سند متنی معتبر نیست.');text=result.text;if(active())render();return;}
    lib=await loadMediaPdfLibrary();if(!active())return;
    const options={cMapUrl:'/pdfjs/cmaps/',cMapPacked:true,standardFontDataUrl:'/pdfjs/standard_fonts/',wasmUrl:'/pdfjs/wasm/',iccUrl:'/pdfjs/iccs/',isEvalSupported:false,enableXfa:false};
    if(ext==='pdf'){
      const source=await loadMediaPdfSource(lib,file,endpoint,controller.signal,error=>{
        if(!active())return;
        controller.abort();pdf=null;message(error.message||'بارگذاری سند ممکن نیست.');sync();
        if(task)Promise.resolve(task.destroy()).catch(()=>{});
      });
      if(!active())return;
      task=lib.getDocument({...options,...source});
    }else{
      const result=await requestMediaDocumentData(endpoint,{},controller.signal);
      if(!active())return;
      if(result.kind!=='office'||!Number.isSafeInteger(result.total)||result.total<1||result.total>64*1024*1024)throw Error('خروجی پیش‌نمایش سند معتبر نیست.');
      const data=decodeMediaDocument(result.data,result.total);
      if(!mediaPdfSignature(data))throw Error('خروجی پیش‌نمایش سند معتبر نیست.');
      task=lib.getDocument({...options,data});
    }
    pdf=await task.promise;if(!active())return;total=pdf.numPages;await render();
  }catch(error){if(active()&&error.name!=='AbortError'){message('نمایش سند ممکن نیست. '+(error.message||'فایل اصلی قابل دانلود است.'));sync();}}
}
// Local player UI. Native browser decoding keeps server CPU/RAM use minimal.
function mediaVideoClock(seconds){
  const value=Number(seconds);
  const n=Number.isFinite(value)?Math.max(0,Math.floor(value)):0;
  const h=Math.floor(n/3600),m=Math.floor(n%3600/60),s=n%60;
  return (h?h+':':'')+String(m).padStart(2,'0')+':'+String(s).padStart(2,'0');
}
async function openMediaVideoPreview(file,dialog,body,request){
  const orderId=invoiceMedia.orderId;
  const endpoint=API_URL+'/orders/'+orderId+'/media/'+file.id+'/video-preview';
  let closed=false,run=0,controller=null,pollTimer=null,resolvePoll=null,compatible=false,loading=false,seeking=false,autoAttempted=false,restoreTime=0,shouldResume=false,sourceReady=false;
  const active=()=>!closed&&request===mediaPreviewRequest;
  const shell=document.createElement('div');shell.className='invoice-media-video-player';shell.dir='ltr';
  const stage=document.createElement('div');stage.className='invoice-media-video-stage';
  const video=document.createElement('video');video.preload='metadata';video.playsInline=true;video.controls=false;video.tabIndex=0;
  video.setAttribute('aria-label','پخش ویدیو');
  const status=document.createElement('div');status.className='invoice-media-video-status';status.dir='rtl';status.setAttribute('role','status');
  const bar=document.createElement('div');bar.className='invoice-media-video-controls';
  const seek=document.createElement('input');seek.type='range';seek.min='0';seek.max='1';seek.step='0.1';seek.value='0';seek.disabled=true;seek.className='invoice-media-video-seek';seek.setAttribute('aria-label','زمان پخش');
  const controls=document.createElement('div');controls.className='invoice-media-video-buttons';
  const button=(label,handler)=>{const b=mediaButton(label,'invoice-media-video-button',handler);b.setAttribute('aria-label',label);return b;};
  const play=button('پخش',togglePlay);play.classList.add('invoice-media-video-toggle');
  const playIcon='<svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor" aria-hidden="true" focusable="false"><path d="M8 5.5v13l11-6.5z"/></svg>';
  const pauseIcon='<svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor" aria-hidden="true" focusable="false"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>';
  const clock=document.createElement('span');clock.className='invoice-media-video-clock';clock.textContent='00:00 / 00:00';
  const svg=path=>'<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+path+'</svg>';
  const soundIcon=svg('<path d="M11 5 6 9H3v6h3l5 4z"/><path d="M15 9a4 4 0 0 1 0 6m3-9a8 8 0 0 1 0 12"/>');
  const mutedIcon=svg('<path d="M11 5 6 9H3v6h3l5 4zM16 9l5 6m0-6-5 6"/>');
  const enterIcon=svg('<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/>');
  const exitIcon=svg('<path d="M3 8h5V3m13 5h-5V3M8 21v-5H3m13 5v-5h5"/>');
  const mute=button('قطع صدا',()=>{if(video.volume===0){video.volume=1;video.muted=false;}else video.muted=!video.muted;});
  mute.classList.add('invoice-media-video-icon');
  const full=button('تمام صفحه',toggleFullscreen);full.classList.add('invoice-media-video-icon');
  let fadeTimer=null,simulatedFullscreen=false,keyboardMode=false;
  const inFullscreen=()=>document.fullscreenElement===shell||simulatedFullscreen;
  function showControls(){
    clearTimeout(fadeTimer);shell.classList.remove('controls-hidden');
    if(inFullscreen()&&!video.paused&&!video.ended)
      fadeTimer=setTimeout(()=>{if(inFullscreen()&&!video.paused&&!video.ended&&!bar.matches(':hover')&&!(keyboardMode&&bar.matches(':focus-within')))shell.classList.add('controls-hidden');},2200);
  }
  function fullscreenChanged(){
    const enabled=inFullscreen();full.innerHTML=enabled?exitIcon:enterIcon;
    full.title=enabled?'خروج از تمام صفحه':'تمام صفحه';full.setAttribute('aria-label',full.title);
    full.setAttribute('aria-pressed',String(enabled));showControls();
  }
  async function toggleFullscreen(){
    try{
      if(document.fullscreenElement===shell){await document.exitFullscreen();return;}
      if(simulatedFullscreen){simulatedFullscreen=false;dialog.classList.remove('invoice-media-simulated-fullscreen');fullscreenChanged();return;}
      if(shell.requestFullscreen){try{await shell.requestFullscreen();return;}catch{}}
      simulatedFullscreen=true;dialog.classList.add('invoice-media-simulated-fullscreen');fullscreenChanged();
    }catch{showAppToast('نمایش تمام صفحه ممکن نیست.');}
  }
  const volume=document.createElement('input');volume.type='range';volume.min='0';volume.max='1';volume.step='0.05';volume.value='1';volume.className='invoice-media-video-volume';volume.setAttribute('aria-label','حجم صدا');
  stage.append(video,status);controls.append(play,clock,mute,volume,full);bar.append(seek,controls);shell.append(stage,bar);body.append(shell);body.classList.add('is-video-preview');
  function setStatus(text){status.textContent=text||'';status.hidden=!text;}
  function clearPoll(){if(pollTimer!==null){clearTimeout(pollTimer);pollTimer=null;}if(resolvePoll){const done=resolvePoll;resolvePoll=null;done();}}
  function wait(){return new Promise(resolve=>{resolvePoll=resolve;pollTimer=setTimeout(()=>{pollTimer=null;resolvePoll=null;resolve();},3000);});}
  function sync(){
    const duration=Number.isFinite(video.duration)&&video.duration>0?video.duration:0;
    const time=Number.isFinite(video.currentTime)?video.currentTime:0;
    if(!seeking){seek.max=String(duration||1);seek.value=String(Math.min(time,duration));}
    seek.disabled=!duration||loading||!sourceReady;
    play.disabled=loading||!sourceReady;
    const paused=video.paused||video.ended;
    if(play.dataset.paused!==String(paused)){
      play.innerHTML=paused?playIcon:pauseIcon;play.dataset.paused=String(paused);
    }
    play.setAttribute('aria-label',paused?'پخش':'توقف');play.title=paused?'پخش':'توقف';
    const silent=video.muted||video.volume===0;
    if(mute.dataset.silent!==String(silent)){mute.innerHTML=silent?mutedIcon:soundIcon;mute.dataset.silent=String(silent);}
    mute.title=silent?'وصل صدا':'قطع صدا';mute.setAttribute('aria-label',mute.title);mute.setAttribute('aria-pressed',String(silent));
    volume.value=String(video.muted?0:video.volume);
    clock.textContent=mediaVideoClock(time)+' / '+mediaVideoClock(duration);
  }
  async function togglePlay(){
    if(!sourceReady||loading)return;
    if(!video.paused){video.pause();return;}
    if(video.ended)video.currentTime=0;
    shouldResume=true;
    try{await video.play();shouldResume=false;}catch(error){
      if(active()&&sourceReady&&!loading&&error.name!=='AbortError'&&error.name!=='NotSupportedError'){
        shouldResume=false;setStatus('برای پخش دوباره روی علامت پخش کلیک کنید.');
      }
    }
  }
  function jump(delta){if(Number.isFinite(video.duration)&&video.duration>0)video.currentTime=Math.max(0,Math.min(video.duration,video.currentTime+delta));}
  async function start(useCompatible){
    if(!active())return;
    const local=++run;
    controller?.abort();clearPoll();controller=new AbortController();
    const signal=controller.signal;
    restoreTime=Math.max(restoreTime,Number(video.currentTime)||0);
    shouldResume=shouldResume||!video.paused;
    loading=true;sourceReady=false;video.pause();video.removeAttribute('src');video.load();
    compatible=useCompatible;
    sync();
    setStatus(useCompatible?'در حال آماده‌سازی نسخه سازگار ویدیو…':'در حال اتصال به ویدیو…');
    try{
      const deadline=Date.now()+16*60*1000;
      while(active()&&local===run){
        const res=await apiFetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},cache:'no-store',signal,
          body:JSON.stringify({compatible:useCompatible})});
        const data=await res.json().catch(()=>({}));
        if(!active()||local!==run)return;
        if(!res.ok)throw Error(data.error||'آماده‌سازی ویدیو ناموفق بود.');
        if(data.status==='ready'&&data.url){
          loading=false;sourceReady=true;video.src=data.url;video.load();sync();return;
        }
        if(data.status!=='processing'&&data.status!=='busy')throw Error('پاسخ نمایشگر ویدیو معتبر نیست.');
        if(Date.now()>deadline)throw Error('زمان آماده‌سازی طولانی شد؛ دوباره تلاش کنید.');
        setStatus(data.status==='busy'?'در انتظار آماده‌سازی ویدیو…':'در حال آماده‌سازی ویدیو…');
        await wait();
      }
    }catch(error){
      if(active()&&local===run&&error.name!=='AbortError'){loading=false;sourceReady=false;setStatus(error.message||'پخش ویدیو ناموفق بود.');sync();}
    }
  }
  const events=[];
  function on(target,event,handler){target.addEventListener(event,handler);events.push([target,event,handler]);}
  for(const name of ['timeupdate','durationchange','play','pause','ended','volumechange'])on(video,name,sync);
  on(video,'loadedmetadata',()=>{
    if(!sourceReady)return;
    if(restoreTime&&Number.isFinite(video.duration))video.currentTime=Math.min(restoreTime,Math.max(0,video.duration-.1));
    restoreTime=0;setStatus('');sync();
    if(shouldResume){shouldResume=false;video.play().catch(()=>{});}
  });
  on(video,'waiting',()=>{if(sourceReady&&!video.paused)setStatus('در حال بارگذاری ویدیو…');});
  on(video,'playing',()=>setStatus(''));
  on(video,'canplay',()=>{if(sourceReady)setStatus('');});
  on(video,'error',()=>{
    if(!active()||loading||!sourceReady||!video.error)return;
    const code=video.error.code;
    if(!compatible&&!autoAttempted&&(code===3||code===4)){autoAttempted=true;start(true);return;}
    sourceReady=false;setStatus('پخش این ویدیو امکان‌پذیر نیست. پیش‌نمایش را دوباره باز کنید یا فایل را از مدیریت فایل‌ها دانلود کنید.');sync();
  });
  on(document,'fullscreenchange',fullscreenChanged);
  on(shell,'pointermove',showControls);on(shell,'pointerdown',()=>{keyboardMode=false;showControls();});
  on(shell,'keydown',()=>{keyboardMode=true;showControls();});
  on(bar,'pointerleave',showControls);on(bar,'focusin',showControls);
  on(video,'play',showControls);on(video,'pause',showControls);on(video,'ended',showControls);
  on(dialog,'cancel',event=>{if(simulatedFullscreen){event.preventDefault();toggleFullscreen();}});
  on(video,'click',togglePlay);
  on(video,'keydown',e=>{
    if(e.key===' '||e.key==='Enter'){e.preventDefault();togglePlay();}
    else if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();jump(e.key==='ArrowRight'?10:-10);}
  });
  on(seek,'input',()=>{seeking=true;clock.textContent=mediaVideoClock(Number(seek.value))+' / '+mediaVideoClock(video.duration);});
  on(seek,'change',()=>{if(Number.isFinite(video.duration))video.currentTime=Number(seek.value);seeking=false;sync();});
  on(volume,'input',()=>{video.muted=false;video.volume=Number(volume.value);});
  mediaPreviewCleanup=()=>{
    closed=true;++run;controller?.abort();clearPoll();clearTimeout(fadeTimer);
    simulatedFullscreen=false;dialog.classList.remove('invoice-media-simulated-fullscreen');
    if(document.fullscreenElement===shell)document.exitFullscreen().catch(()=>{});
    for(const [target,event,handler] of events)target.removeEventListener(event,handler);
    video.pause();video.removeAttribute('src');video.load();
  };
  sync();fullscreenChanged();
  if(!dialog.open)dialog.showModal();
  await start(false);
}

let mediaPreviewCleanup=null;
let mediaPreviewRequest=0;
async function previewInvoiceMedia(file) {
  const dialog=mediaElement('invoiceMediaPreview');
  const body=mediaElement('invoiceMediaPreviewBody');
  resetInvoiceMediaPreviewContent();
  const request=++mediaPreviewRequest;
  mediaPreviewNavigation={orderId:String(invoiceMedia.orderId),scope:file.media_scope==='serial'?'serial':'invoice',serial:file.serial_number||'',fileId:String(file.id)};
  updateMediaPreviewNavigation();
  if(!dialog.open)dialog.showModal();
  const previewTitle=mediaElement('invoiceMediaPreviewTitle');
  previewTitle.textContent=mediaServerName(file);previewTitle.title=mediaServerName(file);
  mediaElement('invoiceMediaPreviewSubtitle').textContent=mediaSize(file.stored_bytes)+' · '+mediaDate(file);
  const uploader=mediaElement('invoiceMediaPreviewUploader');
  uploader.textContent=file.uploader_name||'نامشخص';uploader.title=uploader.textContent;
  try{
    if(mediaDocumentExtension(file)){
      await openMediaDocumentPreview(file,dialog,body,request);
      return;
    }
    if(String(file.mime_type||'').startsWith('video/')){
      await openMediaVideoPreview(file,dialog,body,request);
      return;
    }
    if(!mediaPreviewable(file)){
      body.append(mediaPreviewMessage('پیش‌نمایش این فرمت در دسترس نیست. فایل اصلی از مدیریت فایل‌ها قابل دانلود است.'));
      return;
    }
    body.append(mediaPreviewMessage('در حال بارگذاری فایل…'));
    const url=await requestMediaTicket({kind:'file',file_id:file.id,inline:true});
    if(request!==mediaPreviewRequest)return;
    body.replaceChildren();
    const type=String(file.mime_type||'');
    if(type.startsWith('image/')) {
      const element=document.createElement('img');element.alt=mediaServerName(file);
      const stage=document.createElement('div');stage.className='invoice-media-image-stage';
      stage.append(element);body.append(stage);body.classList.add('is-image-preview');
      const cleanup=bindMediaImageZoom(stage,element);
      element.onerror=()=>{if(request===mediaPreviewRequest){cleanup();body.replaceChildren(mediaPreviewMessage('نمایش تصویر ممکن نیست؛ فایل اصلی قابل دانلود است.'));}};
      mediaPreviewCleanup=()=>{element.onerror=null;element.removeAttribute('src');cleanup();};
      element.src=url;
    }
  }catch(error){if(request===mediaPreviewRequest)body.replaceChildren(mediaPreviewMessage(error.message||'خطا در نمایش'))}
}
function resetInvoiceMediaPreviewContent() {
  ++mediaPreviewRequest;
  if(mediaPreviewCleanup){mediaPreviewCleanup();mediaPreviewCleanup=null;}
  const body=mediaElement('invoiceMediaPreviewBody');
  if(body){body.replaceChildren();body.classList.remove('is-image-preview','is-pdf-preview','is-video-preview');}
}
function closeInvoiceMediaPreview(){
  resetInvoiceMediaPreviewContent();
  mediaPreviewNavigation=null;
  updateMediaPreviewNavigation();
}
let mediaPreviewNavigation=null;
function mediaPreviewMessage(text){
  const status=document.createElement('div');status.className='invoice-media-document-status';status.setAttribute('role','status');status.textContent=text;return status;
}
function mediaNavigationFiles(files,nav){
  if(!nav)return [];
  return mediaFilteredFiles(files.filter(file=>nav.scope==='serial'?file.media_scope==='serial'&&String(file.serial_number||'')===nav.serial:file.media_scope!=='serial'));
}
function mediaNavigationTarget(files,nav,delta){
  const group=mediaNavigationFiles(files,nav),index=group.findIndex(file=>String(file.id)===nav?.fileId);
  return {group,index,target:index>=0?group[index+delta]||null:null};
}
function updateMediaPreviewNavigation(){
  const nav=mediaPreviewNavigation;
  const {group,index}=mediaNavigationTarget(invoiceMedia.files,nav,0);
  const previous=mediaElement('invoiceMediaPreviewPrevious'),next=mediaElement('invoiceMediaPreviewNext'),count=mediaElement('invoiceMediaPreviewPosition');
  if(previous)previous.disabled=index<=0;
  if(next)next.disabled=index<0||index>=group.length-1;
  if(count)count.textContent=index>=0?(index+1)+' / '+group.length:'';
}
function navigateInvoiceMediaPreview(delta){
  const nav=mediaPreviewNavigation;
  if(!nav||nav.orderId!==String(invoiceMedia.orderId))return;
  const {target}=mediaNavigationTarget(invoiceMedia.files,nav,delta);
  if(target)previewInvoiceMedia(target);
}
function handleMediaPreviewNavigation(event){
  if(!mediaElement('invoiceMediaPreview')?.open||!mediaPreviewNavigation||event.altKey||event.ctrlKey||event.metaKey||event.shiftKey||event.defaultPrevented)return;
  if(event.key!=='ArrowLeft'&&event.key!=='ArrowRight')return;
  if(event.target?.closest?.('input,select,textarea,[contenteditable="true"]'))return;
  event.preventDefault();event.stopPropagation();
  navigateInvoiceMediaPreview(event.key==='ArrowLeft'?-1:1);
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
  if(!invoiceMedia.canUpload||!invoiceMedia.orderId||invoiceMedia.uploading||invoiceMedia.deleting)return;
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
function setMediaDeleteBusy(busy) {
  invoiceMedia.deleting=busy;
  const modal=mediaElement('invoiceMediaModal');
  if(!modal)return;
  modal.setAttribute('aria-busy',String(busy));
  for(const el of modal.querySelectorAll('.invoice-media-head-refresh, #invoiceMediaViewSerial, #invoiceMediaViewInvoice')){
    el.disabled=busy;
  }
  if(busy){
    for(const el of modal.querySelectorAll('.invoice-media-bulk-controls input, .invoice-media-bulk-delete, .invoice-media-file-select input, .invoice-media-file-actions button, .invoice-media-serial-chip, #invoiceMediaUploadButton, #invoiceMediaSerialSelect'))el.disabled=true;
    for(const el of modal.querySelectorAll('.invoice-media-bulk-delete'))el.textContent='در حال حذف...';
  }
}
async function deleteSelectedInvoiceMedia(scope,serial) {
  if(!isCurrentMediaGroup(scope,serial))return;
  const files=mediaSelectedFiles(scope,serial);
  if(!files.length)return;
  const group=scope==='serial'?'سریال «'+serial+'»':'اسناد فاکتور';
  return deleteMediaFiles(files,scope,serial,files.length.toLocaleString('fa-IR')+' فایل انتخاب‌شده از '+group+' برای همیشه حذف شود؟');
}
async function deleteInvoiceMedia(file) {
  const scope=file.media_scope==='serial'?'serial':'invoice';
  const serial=scope==='serial'?file.serial_number:null;
  return deleteMediaFiles([file],scope,serial,'فایل «'+mediaServerName(file)+'» برای همیشه حذف شود؟');
}
async function deleteMediaFiles(files,scope,serial,message) {
  if(!invoiceMedia.canDelete||!invoiceMedia.orderId||invoiceMedia.deleting||invoiceMedia.uploading||invoiceMedia.editSaving||!isCurrentMediaGroup(scope,serial))return;
  const allowed=new Set(mediaGroupFiles(scope,serial).map(file=>String(file.id)));
  const ids=[...new Set(files.map(file=>String(file.id)).filter(id=>allowed.has(id)))];
  if(!ids.length||!confirm(message))return;
  const orderId=invoiceMedia.orderId;
  const removed=new Set();
  let firstError='',attempted=0;
  setMediaDeleteBusy(true);
  try{
    for(const id of ids){
      if(invoiceMedia.orderId!==orderId||!invoiceMedia.canDelete)break;
      attempted++;
      try{
        const res=await apiFetch(API_URL+'/orders/'+encodeURIComponent(orderId)+'/media/'+encodeURIComponent(id),{method:'DELETE'});
        if(!res.ok){
          const data=await res.json().catch(()=>({}));
          firstError ||= data.error||'حذف فایل ناموفق بود.';
          if(res.status===403)break;
          continue;
        }
        removed.add(id);
      }catch(error){
        firstError ||= error.message||'ارتباط با سرور قطع شد.';
        break;
      }
    }
    if(invoiceMedia.orderId===orderId){
      invoiceMedia.files=invoiceMedia.files.filter(file=>!removed.has(String(file.id)));
      for(const id of removed)invoiceMedia.selectedIds.delete(id);
      await refreshInvoiceMedia(false,true);
    }
  }finally{
    setMediaDeleteBusy(false);
    if(invoiceMedia.orderId===orderId&&mediaElement('invoiceMediaModal')?.style.display!=='none'){
      drawInvoiceMedia();
      renderPendingMediaFiles();
    }
  }
  if(invoiceMedia.orderId!==orderId)return;
  if(removed.size===ids.length){
    showAppToast(ids.length===1?'فایل حذف شد.':removed.size.toLocaleString('fa-IR')+' فایل حذف شد.');
  }else{
    const remaining=ids.length-removed.size;
    const skipped=ids.length-attempted;
    showAppToast(removed.size.toLocaleString('fa-IR')+' فایل حذف شد؛ '+remaining.toLocaleString('fa-IR')+' فایل حذف نشد'+(skipped?' ('+skipped.toLocaleString('fa-IR')+' بررسی نشد)':'')+(firstError?' · '+firstError:'.'));
  }
}
function openInvoiceMediaEdit(file) {
  if(!invoiceMedia.canEdit||invoiceMedia.editSaving||invoiceMedia.deleting)return;
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
  if(!invoiceMedia.canEdit||invoiceMedia.editSaving||invoiceMedia.deleting||!invoiceMedia.editingFile)return;
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
    if(!invoiceMedia.canUpload || invoiceMedia.uploading || invoiceMedia.deleting)return;
    const input=mediaElement(invoiceMedia.uploadScope==='serial'?'invoiceMediaSerialFiles':'invoiceMediaInvoiceFiles');
    if(!input || (invoiceMedia.uploadScope==='serial'&&!mediaElement('invoiceMediaSerialSelect')?.value))return;
    const list=event.dataTransfer?.files;
    if(list?.length){for(const file of Array.from(list))addPendingMediaFile(file,invoiceMedia.uploadScope);renderPendingMediaFiles()}
  });
}
bindInvoiceMediaDrop();
mediaElement('invoiceMediaPreview')?.addEventListener('close',closeInvoiceMediaPreview);
mediaElement('invoiceMediaPreview')?.addEventListener('keydown',handleMediaPreviewNavigation,true);

mediaElement('invoiceMediaEditModal')?.addEventListener('cancel',event=>{if(invoiceMedia.editSaving)event.preventDefault();else invoiceMedia.editingFile=null});
