const test=require('node:test');
const assert=require('node:assert/strict');
const {pdfAssetPath}=require('../src/document-preview');
test('document library route allows only viewer assets and denies traversal',()=>{
  for(const asset of ['legacy/build/pdf.mjs','legacy/build/pdf.worker.mjs','web/pdf_viewer.css','cmaps/UniJIS-UTF16-H.bcmap','standard_fonts/FoxitSans.pfb','wasm/openjpeg.wasm'])assert.ok(pdfAssetPath(asset),asset);
  for(const asset of ['../package.json','web/../package.json','legacy/build/../../server.js','/etc/passwd','package.json','web/pdf_viewer.html',''])assert.equal(pdfAssetPath(asset),null,asset);
});
