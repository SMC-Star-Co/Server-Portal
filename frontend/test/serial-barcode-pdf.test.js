const test=require('node:test');
const assert=require('node:assert/strict');
const {code128,makePdf}=require('../assets/js/serial-barcode-pdf.js');
test('Code128 B checksum, stop pattern, and quiet zones',()=>{
  const r=code128('AB');
  assert.deepEqual(r.symbols,[104,33,34,102,106]);
  assert.equal(r.bars[0].offset,10);
  assert.equal(r.modules-r.bars.at(-1).offset-r.bars.at(-1).width,10);
  assert.equal(r.bars.at(-1).width,2);
  assert.throws(()=>code128(''));
  assert.throws(()=>code128('سریال'));
});
test('PDF preserves exact serial values and order across pages; xref offsets and streams are valid',()=>{
  const serials=Array.from({length:35},(_,i)=>'SER_'+String(i+1).padStart(3,'0'));
  const pdf=makePdf(serials,'42451');
  assert.match(pdf,/\/Count 3\b/);
  let prev=-1;
  for(const serial of serials){const next=pdf.indexOf('('+serial+')');assert.ok(next>prev);prev=next;}
  const xref=Number(pdf.match(/startxref\n(\d+)/)[1]);
  const lines=pdf.slice(xref).split('\n');
  const n=Number(lines[1].split(' ')[1]);
  for(let i=1;i<n;i++)assert.ok(pdf.slice(Number(lines[i+2].slice(0,10))).startsWith(i+' 0 obj\n'));
  for(const m of pdf.matchAll(/<< \/Length (\d+) >>\nstream\n([\s\S]*?)endstream/g))assert.equal(m[2].length,Number(m[1]));
  assert.ok(/^[\x00-\x7f]*$/.test(pdf));
});
test('portrait by default, landscape for long values, rejects unprintable widths',()=>{
  assert.match(makePdf(['SER-001'],'1'),/\/MediaBox \[0 0 595\.28 841\.89\]/);
  assert.match(makePdf(['A'.repeat(39)],'1'),/\/MediaBox \[0 0 841\.89 595\.28\]/);
  assert.throws(()=>makePdf(['A'.repeat(100)],'1'));
  assert.throws(()=>makePdf([],'1'));
});
