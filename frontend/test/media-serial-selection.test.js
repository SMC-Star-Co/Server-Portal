const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../assets/js/invoice-media.js'),'utf8');
function setup(){
  const nodes=new Map();
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
  const context=vm.createContext({document,window:{},showAppToast:()=>{},URL:{revokeObjectURL(){}}});
  vm.runInContext(source+`
    invoiceMedia.serials=['A','B'];invoiceMedia.canUpload=true;invoiceMedia.canDelete=true;
    invoiceMedia.files=[{id:1,media_scope:'serial',serial_number:'B'}];
    drawMediaRows=()=>{};drawMediaSelectionControls=()=>null;updateInvoiceMediaSelection=()=>{};
    globalThis.mediaTest={invoiceMedia,drawInvoiceMedia,renderMediaUploadSerialOptions,updateInvoiceMediaTarget,setInvoiceMediaView,selectMediaSerialGallery};
  `,context);
  return {...context.mediaTest,element:id=>document.getElementById(id)};
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
