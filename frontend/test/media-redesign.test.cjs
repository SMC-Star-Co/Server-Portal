const { test }=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const {join}=require('node:path');
const root=join(__dirname,'..','..');
const file=p=>readFileSync(join(root,p),'utf8');
const html=file('frontend/index.html');
const js=file('frontend/assets/js/invoice-media.js');
const css=file('frontend/assets/css/invoice-media.css');
const client=file('frontend/assets/js/app.js');
const backend=file('backend/src/invoice-media.js');
const auth=file('backend/src/security/permissions.js');

test('statistics strip and unwanted text are entirely absent from media UI',()=>{
  for(const token of ['invoice-media-stat-strip','invoiceMediaTotalCount','invoiceMediaServerTotal',
    'invoiceMediaInvoiceTotal','invoiceMediaStorageTotal','فایل‌های این پرونده',
    'کتابخانه مستندات','invoiceMediaSummary','سریال ثبت‌شده · آماده دریافت'])
    assert.equal(html.includes(token),false,'Unwanted media UI: '+token);
});
test('search, type filter, sort, list/grid switches, results row are removed safely',()=>{
  for(const id of ['invoiceMediaSearch','invoiceMediaTypeFilter','invoiceMediaSort',
    'invoiceMediaGridButton','invoiceMediaListButton','invoiceMediaFilteredCount',
    'invoiceMediaClearFilters','invoice-media-toolbar','invoice-media-results-row'])
    assert.equal(html.includes(id),false,'Unwanted media toolbar: '+id);
  for(const id of ['invoiceMediaSearch','invoiceMediaTypeFilter','invoiceMediaSort',
    'invoiceMediaGridButton','invoiceMediaListButton','invoiceMediaFilteredCount',
    'invoiceMediaClearFilters','invoiceMediaSummary','setInvoiceMediaLayout','updateInvoiceMediaFilters'])
    assert.equal(js.includes(id),false,'Stale media JS: '+id);
});
test('responsive compact serial cards and thumbnail sizes are in place',()=>{
  assert.match(css,/\.invoice-media-serial-chip\s*\{[^}]*min-height:38px/);
  assert.match(css,/\.invoice-media-file-thumb\s*\{[^}]*height:86px/);
  assert.match(css,/@media\(max-width:740px\)/);
  assert.match(css,/\.invoice-media-file-thumb\s*\{height:72px/);
  assert.match(css,/grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);
  assert.ok(!js.includes("button.append(order,name,badge)"));
  assert.match(js,/button\.append\(name,badge\)/);
});
test('folder icon is inline and file reading/downloading remain in UI',()=>{
  assert.match(html,/class="portal-modal-icon" aria-hidden="true"><svg/);
  for(const id of ['invoiceMediaViewSerial','invoiceMediaViewInvoice','invoiceMediaSerialGroups',
      'invoiceMediaInvoiceList','invoiceMediaUploader','invoiceMediaPreview','invoiceMediaEditModal',
      'invoiceMediaQuickUpload','invoiceMediaPermissionHint'])assert.match(html,new RegExp('id="'+id+'"'));
  for(const fn of ['downloadInvoiceMedia(','downloadInvoiceMediaGroup(','previewInvoiceMedia(',
    'uploadInvoiceMedia(','deleteInvoiceMedia(','openInvoiceMediaEdit('])assert.ok(js.includes(fn),fn);
});
test('file administration is one order-operation permission throughout UI and API',()=>{
  assert.match(auth,/code: 'orders\.media'.*group: 'عملیات فاکتور'/);
  assert.match(client,/code: 'orders\.media'.*group: 'عملیات فاکتور'/);
  assert.match(client,/if \(\['orders\.technical', 'orders\.serials', 'orders\.media'/);
  assert.equal(backend.includes("requirePermission(request,reply,'media."),false);
  assert.equal((backend.match(/requirePermission\(request,reply,'orders\.media'\)/g)||[]).length,4);
  assert.match(auth,/'orders\.media': true/);
});
test('original media route for readers has no management gate',()=>{
  const get=backend.split("fastify.get('/api/orders/:id/media',")[1]?.split("fastify.post('/api/orders/:id/media'")[0];
  const ticket=backend.split("fastify.post('/api/orders/:id/media/ticket',")[1]?.split("fastify.get('/api/media-transfer/:ticket'")[0];
  assert.ok(get);
  assert.ok(ticket);
  assert.equal(get.includes('requirePermission'),false);
  assert.equal(ticket.includes('requirePermission'),false);
});
