'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const frontend = path.join(__dirname,'..');
const read = file=>fs.readFileSync(path.join(frontend,file),'utf8');
const html = read('index.html');
const design = read('assets/css/enterprise.css');
const script = read('assets/js/enterprise.js');

test('all main pages, sign-in and technical operations retain identifiers',()=>{
  const ids=['loginPage','loginForm','loginUsername','loginPassword','appShell',
    'globalSearch','groupedTableContainer','homePage','usersPage','lookupsPage',
    'archivePage','reportsPage','logsPage','accountPage','opsModal','serialModal',
    'invoiceMediaModal','invoiceMediaSerialSelect','invoiceMediaReplaceDialog'];
  for (const id of ids){
    assert.equal((html.match(new RegExp('id="'+id+'"','g'))||[]).length,1,id);
  }
});
test('enterprise assets load after existing styles and functional scripts',()=>{
  const css = html.indexOf('./assets/css/enterprise.css');
  assert.ok(css>html.indexOf('./assets/css/invoice-media.css'));
  const js=html.indexOf('./assets/js/enterprise.js');
  assert.ok(js>html.indexOf('./assets/js/app.js'));
  assert.ok(js>html.indexOf('./assets/js/invoice-media.js'));
  assert.ok(html.includes('name="viewport"'));
});
test('legacy functional code and new UI scripts compile as JavaScript',()=>{
  for(const file of ['assets/js/app.js','assets/js/invoice-media.js','assets/js/enterprise.js']){
    assert.doesNotThrow(()=>new vm.Script(read(file),{filename:file}),file);
  }
});
test('light and dark tokens have proper contrast-oriented semantic aliases',()=>{
  for(const token of ['--ep-canvas','--ep-surface','--ep-ink','--ep-strong',
    '--ep-line','--ep-nav','--ep-accent','--ep-input','--ep-danger']){
    assert.ok(design.includes(token+':'),token);
  }
  assert.ok(design.includes('html[data-theme="dark"]'));
  assert.ok(design.includes('html[data-theme="light"]'));
  assert.ok(design.includes('prefers-reduced-motion'));
});
test('responsive layout covers tablet and phone and keeps order tables horizontally scrollable',()=>{
  assert.match(design, /@media\(max-width:900px\)/);
  assert.match(design, /@media\(max-width:700px\)/);
  assert.match(design, /\.table-scroll-shell[\s\S]*?overflow/);
  assert.match(design, /\.ep-mobile-nav-open/);
});
test('enterprise controls persist only cosmetic user preferences',()=>{
  for(const value of ['theme','density','sidebar']) assert.ok(script.includes(value));
  assert.ok(script.includes('portal.enterprise.'));
  assert.ok(script.includes("key.toLowerCase()==='k'"));
  assert.ok(script.includes('MutationObserver'));
  assert.ok(!script.includes('fetch('),'UI layer does not require API');
});
test('no external font or javascript CDN is required by enterprise layer',()=>{
  assert.ok(!/https?:\/\//.test(design.replace(/\/\*[\s\S]*?\*\//g,'')));
  assert.ok(!/https?:\/\//.test(script.replace(/\/\*[\s\S]*?\*\//g,'')));
});
