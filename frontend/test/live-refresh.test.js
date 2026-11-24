const test=require('node:test');
const assert=require('node:assert/strict');
const {createSseParser,patchChildren,sameData}=require('../assets/js/live-refresh');
class Node {
  constructor(name,value='',children=[]){this.localName=name;this.namespaceURI='html';this.nodeType=name==='#text'?3:1;this.nodeValue=value;this.attrs={};this.childNodes=[];this.parent=null;this.writes=0;for(const child of children)this.insertBefore(child,null);}
  get attributes(){return Object.entries(this.attrs).map(([name,value])=>({namespaceURI:null,localName:name,name,value}));}
  get firstChild(){return this.childNodes[0]||null;}
  get nextSibling(){return this.parent?.childNodes[this.parent.childNodes.indexOf(this)+1]||null;}
  get id(){return this.attrs.id||'';}
  getAttribute(n){return this.attrs[n]??null;}
  getAttributeNS(ns,n){return this.getAttribute(n);}
  hasAttribute(n){return n in this.attrs;}
  hasAttributeNS(ns,n){return this.hasAttribute(n);}
  setAttributeNS(ns,n,v){this.attrs[n]=v;this.writes++;}
  removeAttributeNS(ns,n){delete this.attrs[n];this.writes++;}
  remove(){if(this.parent){const p=this.parent;p.childNodes.splice(p.childNodes.indexOf(this),1);this.parent=null;p.writes++;}}
  insertBefore(n,ref){if(n===ref)return;n.remove();const i=ref?this.childNodes.indexOf(ref):this.childNodes.length;if(i<0)throw Error('bad ref');this.childNodes.splice(i,0,n);n.parent=this;this.writes++;}
  cloneNode(deep){const n=new Node(this.localName,this.nodeValue,deep?this.childNodes.map(x=>x.cloneNode(true)):[]);n.attrs={...this.attrs};return n;}
  isEqualNode(n){return this.localName===n.localName&&this.nodeValue===n.nodeValue&&sameData(this.attrs,n.attrs)&&this.childNodes.length===n.childNodes.length&&this.childNodes.every((c,i)=>c.isEqualNode(n.childNodes[i]));}
}
function row(id,value){const r=new Node('tr','',[new Node('td','',[new Node('#text',value)])]);r.attrs['data-refresh-key']=id;return r;}
test('SSE parser accepts fragmented events and ignores malformed data',()=>{
  const received=[],parse=createSseParser(x=>received.push(x.type));
  parse('event: portal-update\r\ndata: {"type":"con');parse('nected"}\r\n\r\n: heartbeat\n\ndata: bad\n\ndata: {"type":"orders.changed"}\n\n');
  assert.deepEqual(received,['connected','orders.changed']);
});
test('unchanged rows keep identity; update one cell without replacing unrelated rows',()=>{
  const a=row('1','old'),b=row('2','same'),root=new Node('tbody','',[a,b]);
  const baseline=root.writes,cell=a.firstChild,text=cell.firstChild;
  patchChildren(root,new Node('tbody','',[row('1','old'),row('2','same')]));
  assert.equal(root.writes,baseline);
  patchChildren(root,new Node('tbody','',[row('1','new'),row('2','same')]));
  assert.equal(root.childNodes[0],a);assert.equal(root.childNodes[1],b);
  assert.equal(a.firstChild,cell);assert.equal(cell.firstChild,text);assert.equal(text.nodeValue,'new');assert.equal(root.writes,baseline);
});
test('inserts deletes and reorders preserve surviving keyed rows',()=>{
  const a=row('1','a'),b=row('2','b'),c=row('3','c'),root=new Node('tbody','',[a,b,c]);
  patchChildren(root,new Node('tbody','',[row('3','c'),row('4','d'),row('1','a')]));
  assert.deepEqual(root.childNodes.map(x=>x.getAttribute('data-refresh-key')),['3','4','1']);
  assert.equal(root.firstChild,c);assert.equal(root.childNodes[2],a);assert.equal(b.parent,null);
});
