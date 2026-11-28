const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../assets/js/invoice-media.js'),'utf8');
function setup({permission=true,answer=true,responses=[]}={}){
  const calls=[],messages=[],confirmations=[];
  const context=vm.createContext({
    document:{getElementById:()=>null}, API_URL:'/api',
    confirm:message=>{confirmations.push(message);return answer;},
    showAppToast:message=>messages.push(message),
    apiFetch:async(url,opts)=>{
      calls.push({url,method:opts.method});
      const status=responses.length?responses.shift():200;
      if(status==='network')throw Error('network');
      return {ok:status===200,status,json:async()=>({error:'failed'})};
    }
  });
  vm.runInContext(source+`
    invoiceMedia.orderId='22';invoiceMedia.view='serial';invoiceMedia.activeSerial='A';
    invoiceMedia.canDelete=${permission};
    invoiceMedia.files=[
      {id:1,media_scope:'serial',serial_number:'A'},
      {id:2,media_scope:'serial',serial_number:'A'},
      {id:3,media_scope:'serial',serial_number:'B'},
      {id:4,media_scope:'invoice'}
    ];
    refreshInvoiceMedia=async()=>true;drawInvoiceMedia=()=>{};renderPendingMediaFiles=()=>{};
    globalThis.mediaTest={invoiceMedia,mediaGroupFiles,mediaSelectedFiles,updateMediaGroupSelection,
      deleteSelectedInvoiceMedia,deleteInvoiceMedia,pruneMediaSelection,setInvoiceMediaView};
  `,context);
  return {...context.mediaTest,calls,messages,confirmations};
}
const ids=files=>Array.from(files,f=>f.id);
test('selection is restricted to the active serial and selecting all excludes other groups',()=>{
  const t=setup();
  t.updateMediaGroupSelection('serial','A',t.invoiceMedia.files,true);
  assert.deepEqual(ids(t.mediaSelectedFiles('serial','A')),[1,2]);
  assert.deepEqual(ids(t.mediaSelectedFiles('serial','B')),[]);
  assert.deepEqual(ids(t.mediaSelectedFiles('invoice',null)),[]);
  t.updateMediaGroupSelection('serial','A',[{id:1}],false);
  assert.deepEqual(ids(t.mediaSelectedFiles('serial','A')),[2]);
  t.invoiceMedia.files=t.invoiceMedia.files.filter(f=>f.id!==2);t.pruneMediaSelection();
  assert.equal(t.invoiceMedia.selectedIds.size,0);
});
test('bulk delete requests only selected IDs and asks once',async()=>{
  const t=setup();
  t.updateMediaGroupSelection('serial','A',t.invoiceMedia.files,true);
  await t.deleteSelectedInvoiceMedia('serial','A');
  assert.deepEqual(t.calls,[{url:'/api/orders/22/media/1',method:'DELETE'},{url:'/api/orders/22/media/2',method:'DELETE'}]);
  assert.equal(t.confirmations.length,1);
  assert.deepEqual(ids(t.invoiceMedia.files),[3,4]);
  assert.equal(t.invoiceMedia.selectedIds.size,0);
  assert.equal(t.invoiceMedia.deleting,false);
});
test('invoice group cannot select serial files; cancellation issues no DELETE',async()=>{
  const t=setup({answer:false});t.invoiceMedia.view='invoice';
  t.updateMediaGroupSelection('invoice',null,t.invoiceMedia.files,true);
  assert.deepEqual(ids(t.mediaSelectedFiles('invoice',null)),[4]);
  await t.deleteSelectedInvoiceMedia('invoice',null);
  assert.equal(t.calls.length,0);
  assert.equal(t.confirmations.length,1);
});
test('read-only users cannot select or delete; permission denial stops remaining requests',async()=>{
  const t=setup({permission:false});
  t.updateMediaGroupSelection('serial','A',t.invoiceMedia.files,true);
  await t.deleteSelectedInvoiceMedia('serial','A');await t.deleteInvoiceMedia(t.invoiceMedia.files[0]);
  assert.equal(t.calls.length,0);assert.equal(t.confirmations.length,0);
  const denied=setup({responses:[403]});
  denied.updateMediaGroupSelection('serial','A',denied.invoiceMedia.files,true);
  await denied.deleteSelectedInvoiceMedia('serial','A');
  assert.equal(denied.calls.length,1);
  assert.deepEqual(ids(denied.invoiceMedia.files),[1,2,3,4]);
});
test('partial success preserves failed selected files for retry',async()=>{
  const t=setup({responses:[200,500]});
  t.updateMediaGroupSelection('serial','A',t.invoiceMedia.files,true);
  await t.deleteSelectedInvoiceMedia('serial','A');
  assert.deepEqual(ids(t.invoiceMedia.files),[2,3,4]);
  assert.deepEqual(ids(t.mediaSelectedFiles('serial','A')),[2]);
  assert.equal(t.invoiceMedia.deleting,false);
});
