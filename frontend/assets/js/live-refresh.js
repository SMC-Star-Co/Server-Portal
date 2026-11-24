/* Small dependency-free DOM reconciler and SSE frame parser. */
(function(root){
  'use strict';
  const key = node => node.nodeType===1 ? (node.getAttribute('data-refresh-key') || node.id || '') : '';
  const compatible = (a,b) => a && a.nodeType===b.nodeType && (a.nodeType!==1 || (a.localName===b.localName && a.namespaceURI===b.namespaceURI && key(a)===key(b)));
  function patchNode(old,next){
    if(old.isEqualNode(next))return;
    if(old.nodeType!==1){if(old.nodeValue!==next.nodeValue)old.nodeValue=next.nodeValue;return;}
    // The icon renderer owns the injected SVG inside icon placeholders.
    if(old.hasAttribute('data-portal-icon') && old.getAttribute('data-portal-icon')===next.getAttribute('data-portal-icon') && old.getAttribute('data-portal-icon-ready')==='1')return;
    for(const attr of Array.from(old.attributes))if(!next.hasAttributeNS(attr.namespaceURI,attr.localName))old.removeAttributeNS(attr.namespaceURI,attr.localName);
    for(const attr of Array.from(next.attributes))if(old.getAttributeNS(attr.namespaceURI,attr.localName)!==attr.value)old.setAttributeNS(attr.namespaceURI,attr.name,attr.value);
    // Never reconcile editable values or a live file input.
    if(/^(input|textarea|select)$/.test(old.localName))return;
    patchChildren(old,next);
  }
  function patchChildren(parent,desired){
    const incoming=Array.from(desired.childNodes);
    const wanted=new Set(incoming.map(key).filter(Boolean));
    for(const old of Array.from(parent.childNodes))if(key(old)&&!wanted.has(key(old)))old.remove();
    const keyed=new Map(Array.from(parent.childNodes).filter(n=>key(n)).map(n=>[key(n),n]));
    let cursor=parent.firstChild;
    for(const next of incoming){
      let old=key(next)?keyed.get(key(next)):cursor;
      if(!compatible(old,next))old=null;
      if(!old){
        old=next.cloneNode(true);
        parent.insertBefore(old,cursor);
      }else{
        if(old!==cursor)parent.insertBefore(old,cursor);
        patchNode(old,next);
      }
      cursor=old.nextSibling;
    }
    while(cursor){const next=cursor.nextSibling;cursor.remove();cursor=next;}
  }
  function patchHtml(container,html){
    if(!container)return;
    const template=container.ownerDocument.createElement('template');
    template.innerHTML=html;
    const x=container.scrollLeft,y=container.scrollTop;
    patchChildren(container,template.content);
    if(container.scrollLeft!==x)container.scrollLeft=x;
    if(container.scrollTop!==y)container.scrollTop=y;
  }
  function createSseParser(onEvent){
    let buffer='';
    return chunk=>{
      buffer+=chunk;
      if(buffer.length>1024*1024)throw Error('SSE frame too large');
      let match;
      while((match=/\r?\n\r?\n/.exec(buffer))){
        const frame=buffer.slice(0,match.index);buffer=buffer.slice(match.index+match[0].length);
        const data=frame.split(/\r?\n/).filter(line=>line.startsWith('data:')).map(line=>line.slice(5).replace(/^ /,'')).join('\n');
        if(!data)continue;
        let event;try{event=JSON.parse(data);}catch{continue;}
        if(event&&typeof event.type==='string')onEvent(event);
      }
    };
  }
  function sameData(a,b){return JSON.stringify(a)===JSON.stringify(b);}
  const api={patchHtml,patchChildren,createSseParser,sameData};
  if(typeof module==='object'&&module.exports)module.exports=api;else root.PortalLiveRefresh=api;
})(typeof globalThis!=='undefined'?globalThis:this);
