const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../assets/js/invoice-media.js'),'utf8');
function setup({realSelection=false}={}){
  const nodes=new Map(),messages=[];
  function element(tag='div'){
    const classes=new Set(),listeners={};
    return {tag,children:[],value:'',className:'',hidden:false,disabled:false,style:{},attributes:{},
      classList:{toggle:(name,on)=>on?classes.add(name):classes.delete(name),contains:name=>classes.has(name),add:name=>classes.add(name)},
      append(...children){this.children.push(...children);},
      replaceChildren(...children){this.children=children;this.value=children[0]?.value||'';},
      setAttribute(name,value){this.attributes[name]=value;},
      addEventListener(name,fn){listeners[name]=fn;},fire(name){listeners[name]?.();},
      querySelector(){return null;},querySelectorAll(){return [];}
    };
  }
  const document={getElementById:id=>{if(!nodes.has(id))nodes.set(id,element());return nodes.get(id);},createElement:tag=>element(tag)};
  const context=vm.createContext({document,window:{},showAppToast:message=>messages.push(message),URL:{revokeObjectURL(){}}});
  vm.runInContext(source+`
    invoiceMedia.serials=['A','B'];invoiceMedia.canUpload=true;invoiceMedia.canDelete=true;
    invoiceMedia.files=[{id:1,media_scope:'serial',serial_number:'B'}];
    drawMediaRows=()=>{};if(!${realSelection})drawMediaSelectionControls=()=>null;updateInvoiceMediaSelection=()=>{};
    globalThis.mediaTest={invoiceMedia,drawInvoiceMedia,renderMediaUploadSerialOptions,updateInvoiceMediaTarget,setInvoiceMediaView,selectMediaSerialGallery};
  `,context);
  return {...context.mediaTest,messages,element:id=>document.getElementById(id)};
}
test('initial render lists serials but opens no serial panel, even if one has files',()=>{
  const t=setup();t.renderMediaUploadSerialOptions();t.drawInvoiceMedia();
  assert.equal(t.invoiceMedia.activeSerial,null);
  assert.equal(t.element('invoiceMediaSerialSelect').value,'');
  const groups=t.element('invoiceMediaSerialGroups');
  assert.equal(groups.children.length,1);
  assert.equal(groups.children[0].children.length,2);
  for(const chip of groups.children[0].children)assert.equal(chip.attributes['aria-pressed'],'false');
});
test('explicit upload target selects matching serial and switches from invoice view',()=>{
  const t=setup();t.setInvoiceMediaView('invoice');t.renderMediaUploadSerialOptions();
  t.invoiceMedia.selectedIds.add('old');
  t.element('invoiceMediaSerialSelect').value='B';t.updateInvoiceMediaTarget(true);
  assert.equal(t.invoiceMedia.view,'serial');assert.equal(t.invoiceMedia.activeSerial,'B');
  assert.equal(t.invoiceMedia.selectedIds.size,0);
  const groups=t.element('invoiceMediaSerialGroups');
  assert.equal(groups.children.length,2);
  assert.equal(groups.children[0].children[1].attributes['aria-pressed'],'true');
});
test('refresh or upload scope synchronization never implicitly opens or changes gallery',()=>{
  const t=setup();t.renderMediaUploadSerialOptions('B');t.updateInvoiceMediaTarget();t.drawInvoiceMedia();
  assert.equal(t.invoiceMedia.activeSerial,null);
  t.selectMediaSerialGallery('A');t.renderMediaUploadSerialOptions('B');t.updateInvoiceMediaTarget();t.drawInvoiceMedia();
  assert.equal(t.invoiceMedia.activeSerial,'A');
  t.invoiceMedia.serials=['B'];t.drawInvoiceMedia();assert.equal(t.invoiceMedia.activeSerial,null);
});
test('manual serial selection still works and choosing blank upload target closes gallery',()=>{
  const t=setup();t.drawInvoiceMedia();t.element('invoiceMediaSerialGroups').children[0].children[0].fire('click');
  assert.equal(t.invoiceMedia.activeSerial,'A');
  t.element('invoiceMediaSerialSelect').value='';t.updateInvoiceMediaTarget(true);
  assert.equal(t.invoiceMedia.activeSerial,null);
});

test('clicking a serial gallery synchronizes upload dropdown and scope',()=>{
  const t=setup();t.renderMediaUploadSerialOptions();t.invoiceMedia.uploadScope='invoice';t.drawInvoiceMedia();
  t.element('invoiceMediaSerialGroups').children[0].children[1].fire('click');
  assert.equal(t.invoiceMedia.activeSerial,'B');
  assert.equal(t.element('invoiceMediaSerialSelect').value,'B');
  assert.equal(t.invoiceMedia.pendingSerial,'B');
  assert.equal(t.invoiceMedia.uploadScope,'serial');
  assert.equal(t.element('invoiceMediaSerialPanel').hidden,false);
  assert.equal(t.element('invoiceMediaInvoicePanel').hidden,true);
});
test('reverse synchronization discards only the old serial queue on target change',()=>{
  const t=setup();t.renderMediaUploadSerialOptions('A');t.updateInvoiceMediaTarget(true);
  t.invoiceMedia.pending.serial.push({name:'old.pdf'});t.invoiceMedia.pending.invoice.push({name:'invoice.pdf'});
  t.element('invoiceMediaSerialGroups').children[0].children[1].fire('click');
  assert.equal(t.invoiceMedia.pending.serial.length,0);
  assert.equal(t.invoiceMedia.pending.invoice.length,1);
  assert.equal(t.invoiceMedia.pendingSerial,'B');
  assert.equal(t.messages.length,1);
  t.invoiceMedia.pending.serial.push({name:'new.pdf'});
  t.element('invoiceMediaSerialGroups').children[0].children[1].fire('click');
  assert.equal(t.invoiceMedia.pending.serial.length,1);
  assert.equal(t.messages.length,1);
});
test('gallery selection cannot redirect a running upload or deletion',()=>{
  const t=setup();t.renderMediaUploadSerialOptions('A');t.updateInvoiceMediaTarget(true);
  for(const operation of ['uploading','deleting']){
    t.invoiceMedia[operation]=true;
    t.element('invoiceMediaSerialGroups').children[0].children[1].fire('click');
    assert.equal(t.invoiceMedia.activeSerial,'A');
    assert.equal(t.element('invoiceMediaSerialSelect').value,'A');
    t.invoiceMedia[operation]=false;
  }
});
test('historical serials remain browsable but cannot be selected as upload targets',()=>{
  const t=setup();t.renderMediaUploadSerialOptions('A');t.updateInvoiceMediaTarget(true);
  t.invoiceMedia.files.push({id:2,media_scope:'serial',serial_number:'OLD'});
  t.drawInvoiceMedia();t.element('invoiceMediaSerialGroups').children[0].children[2].fire('click');
  assert.equal(t.invoiceMedia.activeSerial,'OLD');
  assert.equal(t.element('invoiceMediaSerialSelect').value,'');
  assert.equal(t.invoiceMedia.pendingSerial,'');
});
test('read-only users can still open any gallery',()=>{
  const t=setup();t.invoiceMedia.canUpload=false;t.drawInvoiceMedia();
  t.element('invoiceMediaSerialGroups').children[0].children[1].fire('click');
  assert.equal(t.invoiceMedia.activeSerial,'B');
});

test('compact serial bulk controls sit immediately to the left of download in RTL header',()=>{
  const t=setup({realSelection:true});t.drawInvoiceMedia();
  t.element('invoiceMediaSerialGroups').children[0].children[1].fire('click');
  const panel=t.element('invoiceMediaSerialGroups').children[1];
  assert.equal(panel.children.length,2);
  const actions=panel.children[0].children[0];
  assert.equal(actions.className,'invoice-media-group-actions');
  assert.equal(actions.children[0].textContent.startsWith('دانلود همه'),true);
  const bulk=actions.children[1].children[0];
  assert.equal(bulk.className,'invoice-media-bulk-controls');
  assert.equal(bulk.children[2].textContent,'حذف انتخاب شده‌‎ها');
  const all=bulk.children[0].children[0];
  all.checked=true;all.fire('change');
  assert.equal(bulk.children[2].disabled,false);
  assert.equal(t.invoiceMedia.selectedIds.size,1);
  assert.equal(bulk.children[1].textContent,'۱ از ۱');
});
