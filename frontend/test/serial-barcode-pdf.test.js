const test=require('node:test');
const assert=require('node:assert/strict');
const {code128,makePdf,filename}=require('../assets/js/serial-barcode-pdf.js');
class MockPdf {
  constructor(options){this.options=options;this.pages=[[]];this.font='';this.fill='';}
  addFileToVFS(name,value){this.embedded={name,value};}
  addFont(){}
  setProperties(){}
  setR2L(){}
  setFont(font){this.font=font;}
  setFontSize(){}
  setTextColor(){}
  setDrawColor(){}
  setFillColor(color){this.fill=color;}
  setLineWidth(){}
  addPage(){this.pages.push([]);}
  text(value,x,y,options){this.pages.at(-1).push({kind:'text',value,x,y,options,font:this.font});}
  rect(x,y,w,h,style){this.pages.at(-1).push({kind:'rect',x,y,w,h,style,fill:this.fill});}
  roundedRect(){}
  line(){}
}
const assets={jsPDF:MockPdf,font:'test-font'};
test('Code 128 checksum, quiet zones and stop',()=>{
  const r=code128('AB');assert.deepEqual(r.symbols,[104,33,34,102,106]);assert.equal(r.bars[0].offset,10);assert.equal(r.modules-r.bars.at(-1).offset-r.bars.at(-1).width,10);assert.equal(r.bars.at(-1).width,2);
  assert.throws(()=>code128(''));assert.throws(()=>code128('سریال'));
});
test('Persian labels and grid, 35 serials in order, black vector bars',()=>{
  const serials=Array.from({length:35},(_,i)=>'SER_'+String(i+1).padStart(3,'0'));
  const pdf=makePdf(serials,'42451',assets);assert.equal(pdf.pages.length,3);assert.equal(pdf.embedded.value,'test-font');
  const text=pdf.pages.flat().filter(x=>x.kind==='text');
  assert.deepEqual(text.filter(x=>serials.includes(x.value)).map(x=>x.value),serials);
  for(const page of pdf.pages){
    assert.ok(page.some(x=>x.value==='شماره فاکتور'&&x.font==='PortalPersian'));
    assert.ok(page.some(x=>x.value==='تعداد سرورها'&&x.font==='PortalPersian'));
    assert.ok(!page.some(x=>x.value==='SERVER SERIAL NUMBERS'));
    assert.ok(page.some(x=>x.kind==='rect'&&x.style==='S'));
    assert.ok(page.some(x=>x.kind==='rect'&&x.fill==='#000000'&&x.w>=.749&&x.h===36));
  }
});
test('Filename, page orientation and width safeguards',()=>{
  assert.equal(filename('42451'),'42451 - Serials.pdf');
  assert.equal(filename('A/01'),'A-01 - Serials.pdf');
  assert.equal(makePdf(['SER-001'],'1',assets).options.orientation,'portrait');
  assert.equal(makePdf(['A'.repeat(39)],'1',assets).options.orientation,'landscape');
  assert.throws(()=>makePdf(['A'.repeat(100)],'1',assets));assert.throws(()=>makePdf([],'1',assets));
});
