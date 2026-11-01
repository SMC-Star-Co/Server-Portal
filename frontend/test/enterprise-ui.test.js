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


test('enterprise initialization restores settings and theme/sidebar/density buttons respond',()=>{
  class Node {
    constructor(){
      this.attrs={};this.dataset={};this.children=[];this.events={};this.style={};
      this.textContent='';this.value='';this.set=new Set();
      this.classList={
        add:k=>this.set.add(k), remove:k=>this.set.delete(k),
        contains:k=>this.set.has(k),toggle:(k,value)=>{
          const enabled=value===undefined?!this.set.has(k):value;
          if(enabled)this.set.add(k);else this.set.delete(k);
          return enabled;
        }
      };
    }
    append(...items){this.children.push(...items)}
    prepend(...items){this.children.unshift(...items)}
    insertBefore(node){this.children.unshift(node)}
    setAttribute(key,value){this.attrs[key]=String(value)}
    removeAttribute(key){delete this.attrs[key]}
    addEventListener(event,handler){this.events[event]=handler}
    querySelector(selector){return selector==='.top-search-wrap'?search:null}
    click(){this.events.click?.()}
  }
  const nodes=[];
  const instance=()=>{const n=new Node();nodes.push(n);return n};
  const root=instance(),actions=instance(),side=instance(),auth=instance();
  const main=instance(),search=instance(),title=instance(),subtitle=instance(),shell=instance(),nav=instance();
  nav.id='navHomeBtn';nav.classList.add('active-page');
  const document={
    readyState:'loading',documentElement:root,events:{},
    createElement:instance,addEventListener(event,cb){this.events[event]=cb},
    querySelector(selector){return ({
      '.top-header .top-actions':actions,'.auth-head':auth,'#appShell .side-menu':side,
      '.side-menu':side,'#appShell main.table-area':main,
      '.side-menu .page-nav-btn.active-page':nav
    })[selector]||null},
    querySelectorAll(selector){
      if(selector==='.side-menu .page-nav-btn')return [nav];
      const id={'[data-enterprise-theme]':'data-enterprise-theme',
        '[data-enterprise-density]':'data-enterprise-density',
        '[data-enterprise-sidebar]':'data-enterprise-sidebar'}[selector];
      return id?nodes.filter(node=>Object.hasOwn(node.attrs,id)):[];
    },
    getElementById(id){return ({
      epPageTitle:title,epPageDescription:subtitle,appShell:shell,globalSearch:search
    })[id]||null}
  };
  const prefs=new Map([
    ['portal.enterprise.theme','dark'],
    ['portal.enterprise.density','compact'],
    ['portal.enterprise.sidebar','collapsed']
  ]);
  const storage={getItem:key=>prefs.get(key)||null,setItem:(key,value)=>prefs.set(key,value)};
  class Observer {observe(){}}
  assert.doesNotThrow(()=>{
    vm.runInNewContext(script,{
      document,window:{matchMedia:()=>({matches:false,addEventListener(){}})},
      localStorage:storage,MutationObserver:Observer,
      getComputedStyle:()=>({display:'block'}),Intl,Date,console
    });
    document.events.DOMContentLoaded();
  });
  assert.equal(root.dataset.theme,'dark');
  assert.ok(root.classList.contains('ep-density-compact'));
  assert.ok(root.classList.contains('ep-sidebar-collapsed'));
  assert.equal(title.textContent,'میز کار');
  assert.equal(document.querySelectorAll('[data-enterprise-theme]').length,2);
  document.querySelectorAll('[data-enterprise-theme]')[0].click();
  document.querySelectorAll('[data-enterprise-density]')[0].click();
  document.querySelectorAll('[data-enterprise-sidebar]')[0].click();
  assert.equal(root.dataset.theme,'light');
  assert.equal(prefs.get('portal.enterprise.theme'),'light');
  assert.ok(!root.classList.contains('ep-density-compact'));
  assert.ok(!root.classList.contains('ep-sidebar-collapsed'));
});
