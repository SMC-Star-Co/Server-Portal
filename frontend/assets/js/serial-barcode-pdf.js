/* Printable A4 serial report. Code 128-B, vector bars, no network or dependencies. */
(function(root){
  'use strict';
  const PATTERNS=('212222 222122 222221 121223 121322 131222 122213 122312 132212 221213 221312 231212 112232 122132 122231 113222 123122 123221 223211 221132 221231 213212 223112 312131 311222 321122 321221 312212 322112 322211 212123 212321 232121 111323 131123 131321 112313 132113 132311 211313 231113 231311 112133 112331 132131 113123 113321 133121 313121 211331 231131 213113 213311 213131 311123 311321 331121 312113 312311 332111 314111 221411 431111 111224 111422 121124 121421 141122 141221 112214 112412 122114 122411 142112 142211 241211 221114 413111 241112 134111 111242 121142 121241 114212 124112 124211 411212 421112 421211 212141 214121 412121 111143 111341 131141 114113 114311 411113 411311 113141 114131 311141 411131 211412 211214 211232 2331112').split(' ');
  const MIN_MODULE=.75,QUIET=10,MAX_MODULE=1.15;
  const fmt=n=>Number(n.toFixed(3)).toString();
  function code128(value){
    if(typeof value!=='string'||!/^[\x20-\x7e]+$/.test(value))throw Error('سریال دارای نویسه غیرقابل چاپ در بارکد Code 128 است.');
    const symbols=[104];
    let checksum=104;
    for(let i=0;i<value.length;i++){const n=value.charCodeAt(i)-32;symbols.push(n);checksum+=n*(i+1);}
    symbols.push(checksum%103,106);
    let offset=QUIET;
    const bars=[];
    for(const symbol of symbols){
      const pattern=PATTERNS[symbol];
      for(let i=0;i<pattern.length;i++){const width=Number(pattern[i]);if(i%2===0)bars.push({offset,width});offset+=width;}
    }
    return {symbols,bars,modules:offset+QUIET};
  }
  function pdfString(s){return String(s).replace(/[\\()]/g,'\\$&');}
  function invoiceText(value){
    const text=String(value||'-').replace(/[۰-۹٠-٩]/g,c=>String(c.charCodeAt(0)-(c.charCodeAt(0)>=0x6f0?0x6f0:0x660)));
    return /^[\x20-\x7e]+$/.test(text)?text.slice(0,80):'-';
  }
  function layout(records){
    // Use portrait normally, landscape only when necessary for readable long barcodes.
    for(const [width,height] of [[595.28,841.89],[841.89,595.28]]){
      const left=32,right=width-32;
      const maxChars=Math.max(...records.map(r=>r.serial.length));
      const serialWidth=Math.max(114,maxChars*6.2+12);
      const barcodeX=left+40+serialWidth,barcodeWidth=right-barcodeX-6;
      if(records.every(r=>r.code.modules*MIN_MODULE<=barcodeWidth)){
        const rowHeight=50;
        const rowsPerPage=Math.floor((height-106-46)/rowHeight);
        return {width,height,left,right,serialX:left+40,barcodeX,barcodeWidth,rowHeight,rowsPerPage};
      }
    }
    throw Error('حداقل یکی از سریال‌ها برای چاپ بارکد خوانا روی A4 بیش از حد طولانی است.');
  }
  function pageContent(rows,design,invoice,page,pages,total){
    const {width,height,left,right,serialX,barcodeX,barcodeWidth,rowHeight}=design,ops=[];
    const text=(x,y,value,size=10,font='F1')=>ops.push('BT /'+font+' '+size+' Tf 0.10 0.15 0.22 rg 1 0 0 1 '+fmt(x)+' '+fmt(y)+' Tm ('+pdfString(value)+') Tj ET');
    const rule=(y)=>ops.push('0.82 0.85 0.89 RG 0.5 w '+fmt(left)+' '+fmt(y)+' m '+fmt(right)+' '+fmt(y)+' l S');
    text(left,height-39,'SERVER SERIAL NUMBERS',16,'F2');
    text(left,height-57,'Invoice: '+invoice,10);
    text(left,height-72,'Total serials: '+total,10);
    const headerY=height-85;
    ops.push('0.93 0.95 0.97 rg '+fmt(left)+' '+fmt(headerY-19)+' '+fmt(right-left)+' 20 re f');
    text(left+7,headerY-12,'No.',9,'F2');text(serialX,headerY-12,'Serial number',9,'F2');text(barcodeX,headerY-12,'Barcode (Code 128)',9,'F2');
    rows.forEach((row,i)=>{
      const top=height-106-i*rowHeight,base=top-43;
      text(left+7,top-27,String(row.index+1),10);
      text(serialX,top-27,row.serial,10,'F3');
      // Quiet zones remain white; each rectangle is a vector bar in pure black.
      const unit=Math.min(MAX_MODULE,barcodeWidth/row.code.modules);
      const origin=barcodeX+(barcodeWidth-row.code.modules*unit)/2;
      ops.push('1 g '+fmt(barcodeX)+' '+fmt(base)+' '+fmt(barcodeWidth)+' 37 re f','0 g');
      for(const bar of row.code.bars)ops.push(fmt(origin+bar.offset*unit)+' '+fmt(base)+' '+fmt(bar.width*unit)+' 37 re');
      ops.push('f');rule(top-rowHeight);
    });
    text(left,26,'Print at actual size (100%).',9);
    text(right-87,26,'Page '+page+' / '+pages,9);
    return ops.join('\n')+'\n';
  }
  function makePdf(serials,invoice){
    if(!Array.isArray(serials)||!serials.length)throw Error('هنوز سریالی ثبت نشده است.');
    if(serials.length>10000)throw Error('تعداد سریال‌ها برای یک خروجی بیش از حد مجاز است.');
    const records=serials.map((serial,index)=>({serial,index,code:code128(serial)}));
    const design=layout(records),pages=Math.ceil(records.length/design.rowsPerPage);
    const objects=[null,'<< /Type /Catalog /Pages 2 0 R >>',null,
      '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
      '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>',
      '<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>'];
    const kids=[];
    for(let p=0;p<pages;p++){
      const pageId=objects.length,streamId=pageId+1;kids.push(pageId+' 0 R');
      const content=pageContent(records.slice(p*design.rowsPerPage,(p+1)*design.rowsPerPage),design,invoiceText(invoice),p+1,pages,records.length);
      objects.push('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 '+fmt(design.width)+' '+fmt(design.height)+'] /Resources << /Font << /F1 3 0 R /F2 4 0 R /F3 5 0 R >> >> /Contents '+streamId+' 0 R >>');
      objects.push('<< /Length '+content.length+' >>\nstream\n'+content+'endstream');
    }
    objects[2]='<< /Type /Pages /Kids ['+kids.join(' ')+'] /Count '+pages+' >>';
    // All emitted PDF syntax is ASCII; character offsets equal byte offsets.
    let pdf='%PDF-1.4\n',offsets=[0];
    for(let i=1;i<objects.length;i++){offsets[i]=pdf.length;pdf+=i+' 0 obj\n'+objects[i]+'\nendobj\n';}
    const xref=pdf.length;
    pdf+='xref\n0 '+objects.length+'\n0000000000 65535 f \n';
    for(let i=1;i<objects.length;i++)pdf+=String(offsets[i]).padStart(10,'0')+' 00000 n \n';
    pdf+='trailer\n<< /Size '+objects.length+' /Root 1 0 R >>\nstartxref\n'+xref+'\n%%EOF\n';
    return pdf;
  }
  function download(serials,invoice){
    const pdf=makePdf(serials,invoice);
    const url=URL.createObjectURL(new Blob([pdf],{type:'application/pdf'}));
    const link=document.createElement('a');
    const name=invoiceText(invoice).replace(/[^A-Za-z0-9_-]/g,'-').replace(/^-+|-+$/g,'')||'invoice';
    link.href=url;link.download='serials-'+name+'.pdf';document.body.append(link);
    try{link.click();}finally{link.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);}
  }
  const api={code128,makePdf,download};
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.SerialBarcodePdf=api;
})(typeof globalThis!=='undefined'?globalThis:this);
