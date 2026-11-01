// Dedicated technical media management. Does not alter invoice or serial-save logic.
const invoiceMedia = { orderId: null, technician: false, serials: [], files: [], generation: 0, uploading: false };

function mediaSize(value) {
  const n = Number(value) || 0;
  return n >= 1048576 ? (n / 1048576).toFixed(2) + ' MB' : (n / 1024).toFixed(0) + ' KB';
}
function clearInvoiceMedia() {
  invoiceMedia.generation++;
  invoiceMedia.orderId = null;
  invoiceMedia.serials = [];
  invoiceMedia.files = [];
  closeInvoiceMediaModal();
}
function openInvoiceMediaFromOps() {
  const id = document.getElementById('edit_order_id')?.value;
  if (!id) return;
  invoiceMedia.orderId = String(id);
  const modal = document.getElementById('invoiceMediaModal');
  modal.style.display = 'flex';
  refreshInvoiceMedia();
}
function closeInvoiceMediaModal() {
  const modal = document.getElementById('invoiceMediaModal');
  if (modal) modal.style.display = 'none';
  invoiceMedia.generation++;
  const dialog = document.getElementById('invoiceMediaPreview');
  if (dialog?.open) dialog.close();
  if (typeof closeInvoiceMediaPreview === 'function') closeInvoiceMediaPreview();
}
async function refreshInvoiceMedia() {
  const id = invoiceMedia.orderId;
  if (!id) return;
  const generation = ++invoiceMedia.generation;
  const root = document.getElementById('invoiceMediaSerialGroups');
  root.textContent = 'در حال بارگذاری...';
  try {
    const response = await apiFetch(API_URL + '/orders/' + id + '/media');
    if (!response.ok) throw new Error('دریافت مدیاهای فاکتور ناموفق بود.');
    const data = await response.json();
    if (invoiceMedia.generation !== generation || invoiceMedia.orderId !== id) return;
    invoiceMedia.serials = Array.isArray(data.serials) ? data.serials : [];
    invoiceMedia.files = Array.isArray(data.files) ? data.files : [];
    invoiceMedia.technician = Boolean(data.can_manage);
    document.getElementById('invoiceMediaModalTitle').textContent = 'مدیریت مدیاهای فاکتور ' + data.invoice_number;
    document.getElementById('invoiceMediaUploader').hidden = !invoiceMedia.technician;
    document.getElementById('invoiceMediaSerialUploader').hidden = !invoiceMedia.technician;
    const selector = document.getElementById('invoiceMediaSerialSelect');
    const previous = selector.value;
    selector.replaceChildren();
    for (const serial of invoiceMedia.serials) {
      const option = document.createElement('option');
      option.value = serial; option.textContent = serial;
      selector.append(option);
    }
    if (invoiceMedia.serials.includes(previous)) selector.value = previous;
    if (!invoiceMedia.serials.length) {
      const option = document.createElement('option');
      option.textContent = 'ابتدا سریال سرور را در مدیریت سریال‌ها ثبت کنید';
      option.value = ''; selector.append(option);
    }
    selector.disabled = !invoiceMedia.serials.length;
    document.getElementById('invoiceMediaSerialFiles').disabled = !invoiceMedia.serials.length;
    drawInvoiceMedia();
  } catch (error) {
    if (invoiceMedia.generation === generation) root.textContent = error.message || 'خطا در دریافت فایل‌ها';
  }
}
function createMediaButton(label, css, handler) {
  const button = document.createElement('button');
  button.type = 'button'; button.textContent = label; button.className = css;
  button.addEventListener('click', handler);
  return button;
}
function drawMediaRows(container, files) {
  container.replaceChildren();
  if (!files.length) {
    const empty = document.createElement('div');
    empty.className = 'invoice-media-empty'; empty.textContent = 'فایلی ثبت نشده است.';
    container.append(empty); return;
  }
  for (const file of files) {
    const item = document.createElement('div');
    item.className = 'invoice-media-item';
    const icon = document.createElement('div');
    icon.className = 'invoice-media-icon';
    icon.textContent = file.mime_type?.startsWith('image/') ? '🖼️'
      : file.mime_type?.startsWith('video/') ? '🎬' : '📄';
    const details = document.createElement('div');
    details.className = 'invoice-media-details';
    const title = document.createElement('strong');
    title.textContent = file.download_name || file.original_name;
    title.title = file.original_name;
    const subtitle = document.createElement('small');
    subtitle.textContent = mediaSize(file.stored_bytes) +
      (file.uploader_name ? ' · ' + file.uploader_name : '') +
      (file.original_name ? ' · اصل: ' + file.original_name : '');
    details.append(title, subtitle);
    const actions = document.createElement('div');
    actions.className = 'invoice-media-actions';
    const browserPreview = ['image/jpeg','image/png','image/webp','image/gif','image/bmp','video/mp4','video/webm','video/quicktime','application/pdf'];
    if (browserPreview.includes(file.mime_type)) {
      actions.append(createMediaButton('نمایش', 'soft-primary-btn', () => previewInvoiceMedia(file)));
    }
    actions.append(createMediaButton('دانلود', 'secondary-btn', () => downloadInvoiceMedia(file)));
    if (invoiceMedia.technician) actions.append(createMediaButton('حذف', 'soft-danger-btn', () => deleteInvoiceMedia(file)));
    item.append(icon, details, actions);
    container.append(item);
  }
}
function drawInvoiceMedia() {
  const files = invoiceMedia.files;
  const invoiceFiles = files.filter(f => f.media_scope !== 'serial');
  drawMediaRows(document.getElementById('invoiceMediaInvoiceList'), invoiceFiles);
  document.getElementById('invoiceMediaInvoiceDownloadAll').hidden = invoiceFiles.length === 0;
  const grouped = document.getElementById('invoiceMediaSerialGroups');
  grouped.replaceChildren();
  // Match the exact order entered in "Serial Management" rather than alphabetical order.
  const serials = invoiceMedia.serials.slice();
  for (const f of files) {
    if (f.media_scope === 'serial' && f.serial_number && !serials.includes(f.serial_number)) serials.push(f.serial_number);
  }
  if (!serials.length) {
    const empty = document.createElement('div');
    empty.className = 'invoice-media-empty';
    empty.textContent = 'هنوز سریالی در مدیریت سریال‌ها ثبت نشده است.';
    grouped.append(empty);
    return;
  }
  for (const serial of serials) {
    const serialFiles = files.filter(f => f.media_scope === 'serial' && f.serial_number === serial);
    const box = document.createElement('details');
    box.className = 'invoice-media-serial-group';
    const header = document.createElement('summary');
    const name = document.createElement('strong');
    name.textContent = serial;
    const count = document.createElement('span');
    count.textContent = serialFiles.length + ' فایل';
    header.append(name, count);
    box.append(header);
    const body = document.createElement('div');
    body.className = 'invoice-media-serial-body';
    drawMediaRows(body, serialFiles);
    box.append(body);
    if (serialFiles.length) {
      const all = createMediaButton('دانلود تمام فایل‌های این سریال (ZIP)', 'secondary-btn',
        () => downloadInvoiceMediaGroup('serial', serial));
      all.classList.add('invoice-media-group-download');
      box.append(all);
    }
    grouped.append(box);
  }
}
async function requestMediaTicket(payload) {
  if (!invoiceMedia.orderId) throw new Error('فاکتور انتخاب نشده است.');
  const response = await apiFetch(API_URL + '/orders/' + invoiceMedia.orderId + '/media/ticket', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
  });
  const result = await response.json();
  if (!response.ok || !result.url) throw new Error(result.error || 'ساخت لینک دانلود ناموفق بود.');
  return result.url;
}
function activateMediaLink(url, asDownload) {
  const anchor = document.createElement('a');
  anchor.href = url; anchor.style.display = 'none';
  if (asDownload) anchor.download = '';
  document.body.append(anchor); anchor.click(); anchor.remove();
}
async function downloadInvoiceMedia(file) {
  try {
    const url = await requestMediaTicket({kind:'file',file_id:file.id,inline:false});
    activateMediaLink(url, true);
  } catch (error) { showAppToast(error.message || 'دانلود ناموفق بود'); }
}
async function downloadInvoiceMediaGroup(scope, serial) {
  try {
    const url = await requestMediaTicket({
      kind:'zip',scope:scope,serial_number:scope==='serial'?serial:undefined
    });
    activateMediaLink(url, true);
  } catch(error) { showAppToast(error.message || 'دانلود گروهی ناموفق بود'); }
}
async function previewInvoiceMedia(file) {
  const dialog = document.getElementById('invoiceMediaPreview');
  const body = document.getElementById('invoiceMediaPreviewBody');
  body.replaceChildren();
  document.getElementById('invoiceMediaPreviewTitle').textContent = file.download_name || file.original_name;
  try {
    const url = await requestMediaTicket({kind:'file',file_id:file.id,inline:true});
    const mime = String(file.mime_type || '');
    let element;
    if (mime.startsWith('image/')) {
      element = document.createElement('img');
      element.alt = file.download_name || file.original_name;
    } else if (mime.startsWith('video/')) {
      element = document.createElement('video'); element.controls = true;
      element.preload = 'metadata';
    } else if (mime === 'application/pdf') {
      element = document.createElement('iframe');
      element.title = file.download_name || file.original_name;
      element.style.width='min(85vw,980px)'; element.style.height='75vh'; element.style.border='none';
    } else {
      return downloadInvoiceMedia(file);
    }
    element.src = url;
    body.append(element);
    dialog.showModal();
  } catch(error) { showAppToast(error.message || 'نمایش فایل ناموفق بود'); }
}
function closeInvoiceMediaPreview() {
  const body = document.getElementById('invoiceMediaPreviewBody');
  if (body) body.replaceChildren();
}
async function uploadInvoiceMedia(scope) {
  if (!invoiceMedia.technician || !invoiceMedia.orderId || invoiceMedia.uploading) return;
  const serial = scope === 'serial' ? document.getElementById('invoiceMediaSerialSelect').value : '';
  if (scope === 'serial' && !serial) return showAppToast('سریال سرور را انتخاب کنید.');
  const input = document.getElementById(scope === 'serial' ? 'invoiceMediaSerialFiles' : 'invoiceMediaInvoiceFiles');
  const files = Array.from(input.files || []);
  if (!files.length) return showAppToast('فایلی انتخاب نشده است.');
  const id = invoiceMedia.orderId;
  invoiceMedia.uploading = true;
  const buttons = document.querySelectorAll('#invoiceMediaModal button');
  buttons.forEach(b => b.disabled = true);
  const progress = document.getElementById('invoiceMediaProgress');
  let done=0;
  try {
    for (const [index, file] of files.entries()) {
      if (file.size > 500*1024*1024 || !file.size) {
        showAppToast('حجم فایل ' + file.name + ' نامعتبر یا بیشتر از ۵۰۰ مگابایت است.');
        continue;
      }
      progress.textContent = 'آپلود ' + (index+1) + ' از ' + files.length + ': ' + file.name;
      try {
        const response = await apiFetch(API_URL + '/orders/' + id + '/media', {
          method: 'POST', headers: {
            'Content-Type': 'application/octet-stream',
            'X-File-Name': encodeURIComponent(file.name),
            'X-Media-Scope': scope,
            ...(serial ? {'X-Media-Serial':serial} : {})
          }, body: file
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'ثبت فایل ناموفق بود.');
        done++;
      } catch(error) { showAppToast(file.name + ': ' + error.message); }
    }
    input.value = '';
    if (id === invoiceMedia.orderId) await refreshInvoiceMedia();
    progress.textContent = done + ' فایل ثبت شد.';
  } finally {
    invoiceMedia.uploading = false;
    buttons.forEach(b => b.disabled = false);
  }
}
async function deleteInvoiceMedia(file) {
  if (!invoiceMedia.technician || !invoiceMedia.orderId) return;
  if (!confirm('فایل «' + (file.download_name || file.original_name) + '» حذف شود؟')) return;
  try {
    const response = await apiFetch(API_URL+'/orders/'+invoiceMedia.orderId+'/media/'+file.id,{method:'DELETE'});
    if (!response.ok) throw new Error((await response.json()).error||'حذف ناموفق بود.');
    await refreshInvoiceMedia();
  } catch(error) { showAppToast(error.message || 'حذف ناموفق بود'); }
}
document.getElementById('invoiceMediaPreview')?.addEventListener('close', closeInvoiceMediaPreview);
