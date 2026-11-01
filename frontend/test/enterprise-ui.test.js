'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.join(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const html=read('index.html');
const core=read('assets/css/app.css');
const media=read('assets/css/invoice-media.css');
const enterprise=read('assets/js/enterprise.js');
const logic=read('assets/js/app.js');
const mediaLogic=read('assets/js/invoice-media.js');

test('functional IDs from the main workflow survive the full markup rewrite',()=>{
 const ids=['loginPage','loginForm','loginUsername','loginPassword','loginBtn',
 'appShell','globalSearch','manualRefreshBtn','currentUserPill','currentUserRolePill',
 'homePage','groupedTableContainer','navHomeBtn','navUsersBtn','navLookupsBtn',
 'navArchiveBtn','navReportsBtn','navLogsBtn','navAccountBtn',
 'usersPage','usersGroupsContainer','lookupsPage','archivePage','archiveContainer',
 'reportsPage','reportChartContainer','logsPage','logsContainer','accountPage',
 'opsModal','orderModal','serialModal','invoiceMediaModal','invoiceMediaReplaceDialog',
 'invoiceMediaSerialGroups','invoiceMediaPendingList'];
 for(const id of ids)assert.equal((html.match(new RegExp('id="'+id+'"','g'))||[]).length,1,id);
 const all=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
 assert.equal(new Set(all).size,all.length,'no duplicate IDs');
});
test('dashboard is wired to existing real order totals and status filters',()=>{
 for(const id of ['statTotal','statToday','statProgress','statCompleted',
 'filter-All','filter-Pending','filter-Waiting-Goods',
 'filter-In-Progress','filter-Completed','filter-Cancelled','filter-Returned',
 'count-All','count-Pending','count-Waiting-Goods','count-In-Progress',
 'count-Completed','count-Cancelled','count-Returned'])assert.ok(html.includes('id="'+id+'"'),id);
 assert.match(logic,/function updateStats\(\)/);
 assert.match(logic,/function setStatusFilter\(status\)/);
 assert.match(html,/onclick="setStatusFilter\('Completed'\)"/);
});
test('app stylesheets are brand-new core and media surfaces, not legacy overlay',()=>{
 assert.match(core,/SSP \/ ATLAS WORKSTATION/);
 assert.match(media,/ATLAS VAULT/);
 assert.ok(core.length>30000);
 assert.ok(media.length>12000);
 assert.ok(!fs.existsSync(path.join(root,'assets/css/enterprise.css')),'legacy overlay stylesheet deleted');
 assert.ok(!html.includes('./assets/css/enterprise.css'),'no cascading override in HTML');
});
test('all functions parse and stylesheet blocks balance',()=>{
 for(const p of ['assets/js/app.js','assets/js/invoice-media.js','assets/js/enterprise.js']){
  assert.doesNotThrow(()=>new vm.Script(read(p),{filename:p}),p);
 }
 for(const [name,css] of [['core',core],['media',media]]){
  assert.equal((css.match(/{/g)||[]).length,(css.match(/}/g)||[]).length,name);
 }
});
test('light and dark themes specify actual surfaces and accessible interaction',()=>{
 for(const token of ['--canvas','--paper','--ink','--accent','--nav','--success','--danger','--line']){
  assert.ok(core.includes(token+':'),token);
 }
 assert.match(core,/html\[data-theme="dark"\]/);
 assert.match(core,/html\[data-theme="light"\]/);
 assert.match(core,/prefers-reduced-motion/);
 assert.match(core,/:focus-visible/);
 assert.ok(!/https?:\/\//.test(core),'no external CSS dependency');
});
test('all functional modules and touch-ready viewport are present',()=>{
 assert.match(html,/name="viewport"/);
 for(const path of ['assets/css/app.css','assets/css/invoice-media.css',
 'assets/js/app.js','assets/js/invoice-media.js','assets/js/enterprise.js'])assert.ok(html.includes(path));
 for(const page of ['users','lookups','archive','reports','logs','account'])assert.ok(html.includes('id="'+page+'Page"'));
 assert.match(core,/@media\(max-width:740px\)/);
 assert.match(media,/@media\(max-width:740px\)/);
});
test('main UI interactions persist only cosmetic preferences',()=>{
 for(const p of ['theme','density','sidebar'])assert.ok(enterprise.includes("'"+p+"'"),p);
 assert.match(enterprise,/MutationObserver/);
 assert.match(enterprise,/localStorage/);
 assert.ok(!enterprise.includes('fetch('),'no UI network calls');
});
test('media flows retain original download and replacement handlers',()=>{
 for(const fn of ['downloadInvoiceMedia','uploadInvoiceMedia','submitInvoiceMediaReplacement',
 'deleteInvoiceMedia','previewInvoiceMedia','drawMediaRows'])assert.ok(mediaLogic.includes('function '+fn+'('),fn);
 assert.match(media,/invoice-media-file-card/);
 assert.match(media,/invoice-media-serial-chip/);
 assert.match(media,/invoice-media-preview-body/);
});

test('the new workspace structurally replaces old four-card dashboard',()=>{
 assert.match(html,/class="operations-stage"/);
 assert.match(html,/class="operations-prime"/);
 assert.match(html,/class="operations-details"/);
 assert.match(html,/class="worklist-filter-shell"/);
 assert.match(html,/class="workspace-shell"/);
 assert.match(html,/class="rail-workspace"/);
 assert.doesNotMatch(html,/class="stat-grid home-stat-grid"/);
 for(const id of ['epCompletionRate','epCompletionBar','epSectionLabel'])assert.ok(html.includes('id="'+id+'"'),id);
 assert.match(enterprise,/function renderCompletionMetric\(\)/);
 assert.match(enterprise,/function observeOperationalMetrics\(\)/);
});
test('every business module has a new module heading without modifying its data containers',()=>{
 const headings=(html.match(/class="module-head"/g)||[]).length;
 assert.equal(headings,6);
 for(const id of ['usersGroupsContainer','lookupTabsContainer','lookupEditorContainer','lookupsContainer',
  'archiveContainer','reportChartContainer','logsContainer','accountPasswordForm'])
  assert.ok(html.includes('id="'+id+'"'),id);
});
test('drag and drop is removed in favor of an accessible file chooser',()=>{
 assert.match(html,/<button id="invoiceMediaDropzone" type="button"/);
 assert.ok(!html.includes('انتخاب فایل یا کشیدن به اینجا'));
 assert.ok(!mediaLogic.includes('bindInvoiceMediaDrop'));
 assert.ok(!mediaLogic.includes("addEventListener('drop'"));
 assert.match(media,/invoice-media-dropzone/);
});
test('new offline icons are defined for every icon used by the static page',()=>{
 const available=read('assets/icons/lucide-icons.js');
 const names=[...new Set([...html.matchAll(/data-portal-icon="([^"]+)"/g)].map(m=>m[1]))];
 for(const name of names)assert.ok(available.includes("'"+name+"':"),name);
});


test('the app shell closes before independent user and media dialogs',()=>{
 const a=html.indexOf('<div id="appShell"');
 const b=html.indexOf('<div id="userModal"');
 assert.ok(a>=0&&b>a);
 const shell=html.slice(a,b);
 for(const tag of ['div','main','aside','header','section','nav']){
  const open=(shell.match(new RegExp('<'+tag+'(?:\\s|>)','g'))||[]).length;
  const close=(shell.match(new RegExp('</'+tag+'>','g'))||[]).length;
  assert.equal(open,close,'unbalanced '+tag);
 }
});
test('live operational completion metric understands Persian digits and leaves real data intact',()=>{
 const start=enterprise.indexOf('function renderCompletionMetric(){');
 const end=enterprise.indexOf('function observeOperationalMetrics(){',start);
 assert.ok(start>=0&&end>start);
 const nodes={
  statTotal:{textContent:'۲۰۰'},statCompleted:{textContent:'۵۰'},
  epCompletionRate:{textContent:''},
  epCompletionBar:{style:{},setAttribute(){}}
 };
 const fn=new Function('document',enterprise.slice(start,end)+';return renderCompletionMetric;')({
  getElementById:id=>nodes[id]||null
 });
 fn();
 assert.equal(nodes.epCompletionBar.style.width,'25%');
 assert.match(nodes.epCompletionRate.textContent,/۲۵/);
});
