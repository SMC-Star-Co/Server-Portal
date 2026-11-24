/* Printable A4 serial report. Code 128-B, vector bars, local jsPDF and embedded Persian font. */
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
  function invoiceText(value){
    return String(value??'').trim().replace(/[۰-۹٠-٩]/g,c=>String(c.charCodeAt(0)-(c.charCodeAt(0)>=0x6f0?0x6f0:0x660))).replace(/[\x00-\x1f\x7f]/g,'').slice(0,80)||'-';
  }
  function filename(invoice){
    const name=String(invoice??'').trim().replace(/[<>:"/\\|?*\x00-\x1f\x7f]/g,'-').replace(/[. ]+$/g,'').slice(0,120)||'Invoice';
    return name+' - Serials.pdf';
  }
  function layout(records){
    for(const [width,height] of [[595.28,841.89],[841.89,595.28]]){
      const left=32,right=width-32,noWidth=42,headerTop=86,headerHeight=32,rowHeight=48;
      const maxChars=records.reduce((n,r)=>Math.max(n,r.serial.length),0);
      const serialWidth=Math.max(132,maxChars*6.6+20);
      const serialX=left+noWidth,barcodeX=serialX+serialWidth,barcodeWidth=right-barcodeX-16;
      if(records.every(r=>r.code.modules*MIN_MODULE<=barcodeWidth)){
        const rowsPerPage=Math.floor((height-headerTop-headerHeight-48)/rowHeight);
        return {width,height,left,right,noWidth,serialX,serialWidth,barcodeX,barcodeWidth,headerTop,headerHeight,rowHeight,rowsPerPage};
      }
    }
    throw Error('حداقل یکی از سریال‌ها برای چاپ بارکد خوانا روی A4 بیش از حد طولانی است.');
  }
  const faOptions={align:'center',isInputVisual:false,isOutputVisual:true,isInputRtl:true,isOutputRtl:false};
  function renderPage(doc,rows,d,invoice,page,pages,total){
    const {width,height,left,right,noWidth,serialX,serialWidth,barcodeX,barcodeWidth,headerTop,headerHeight,rowHeight}=d;
    const ink='#192b43',muted='#52647b',grid='#c5ceda',header='#eaf0f6';
    const tableWidth=right-left,half=tableWidth/2,firstY=headerTop+headerHeight,bottom=firstY+rows.length*rowHeight;
    function latin(value,x,y,size=11,font='courier',style='normal',color=ink,align='center'){
      doc.setR2L(false);doc.setFont(font,style);doc.setFontSize(size);doc.setTextColor(color);
      doc.text(String(value),x,y,{align,isInputVisual:true,isOutputVisual:true,isInputRtl:false,isOutputRtl:false});
    }
    function persian(value,x,y,size=11,color=ink,align='center'){
      doc.setR2L(false);doc.setFont('PortalPersian','normal');doc.setFontSize(size);doc.setTextColor(color);
      doc.text(value,x,y,{...faOptions,align});
    }
    function info(x,label,value){
      doc.setDrawColor(grid);doc.setFillColor('#f5f7fa');doc.setLineWidth(.6);
      doc.roundedRect(x,27,half-5,42,5,5,'FD');
      persian(label,x+half-18,43,11,muted,'right');
      const valueText=String(value),size=Math.min(15,(half-26)/(Math.max(valueText.length,1)*.62));
      if(/^[\x20-\x7e]+$/.test(valueText))latin(valueText,x+half-18,60,size,'helvetica','bold',ink,'right');
      else persian(valueText,x+half-18,60,size,ink,'right');
    }
    info(left+half+5,'شماره فاکتور',invoice);
    info(left,'تعداد سرورها',total);
    doc.setFillColor(header);doc.rect(left,headerTop,tableWidth,headerHeight,'F');
    persian('ردیف',left+noWidth/2,headerTop+20,11);
    persian('شماره سریال',serialX+serialWidth/2,headerTop+20,11);
    persian('بارکد خطی',barcodeX+(right-barcodeX)/2,headerTop+13,11);
    latin('Code 128',barcodeX+(right-barcodeX)/2,headerTop+25,8,'helvetica','normal',muted);
    rows.forEach((row,i)=>{
      const y=firstY+i*rowHeight;
      if(row.index%2===1){doc.setFillColor('#f6f8fa');doc.rect(left,y,barcodeX-left,rowHeight,'F');}
      latin(row.index+1,left+noWidth/2,y+28,11,'helvetica','normal');
      latin(row.serial,serialX+serialWidth/2,y+28,11,'courier','bold');
      const unit=Math.min(MAX_MODULE,barcodeWidth/row.code.modules),origin=barcodeX+8+(barcodeWidth-row.code.modules*unit)/2;
      doc.setFillColor('#ffffff');doc.rect(barcodeX+.6,y+.6,right-barcodeX-1.2,rowHeight-1.2,'F');
      doc.setFillColor('#000000');
      for(const bar of row.code.bars)doc.rect(origin+bar.offset*unit,y+6,bar.width*unit,36,'F');
    });
    doc.setDrawColor(grid);doc.setLineWidth(.65);
    doc.rect(left,headerTop,tableWidth,bottom-headerTop,'S');
    doc.line(serialX,headerTop,serialX,bottom);doc.line(barcodeX,headerTop,barcodeX,bottom);
    for(let i=0;i<=rows.length;i++)doc.line(left,firstY+i*rowHeight,right,firstY+i*rowHeight);
    latin('Print at actual size (100%).',left,height-25,9,'helvetica','normal',muted,'left');
    latin(page+' / '+pages,right,height-25,9,'helvetica','normal',muted,'right');
  }
  function makePdf(serials,invoice,assets){
    if(!Array.isArray(serials)||!serials.length)throw Error('هنوز سریالی ثبت نشده است.');
    if(serials.length>10000)throw Error('تعداد سریال‌ها برای یک خروجی بیش از حد مجاز است.');
    const records=serials.map((serial,index)=>({serial,index,code:code128(serial)}));
    const d=layout(records),pages=Math.ceil(records.length/d.rowsPerPage);
    if(typeof assets?.jsPDF!=='function'||typeof assets.font!=='string'||!assets.font)throw Error('کتابخانه خروجی PDF بارگذاری نشده است.');
    const orientation=d.width>d.height?'landscape':'portrait';
    const doc=new assets.jsPDF({orientation,unit:'pt',format:[d.width,d.height],compress:true,putOnlyUsedFonts:true,precision:4});
    doc.addFileToVFS('PortalPersian.ttf',assets.font);
    doc.addFont('PortalPersian.ttf','PortalPersian','normal');
    doc.setProperties({title:'Invoice serials',subject:'Code 128 serial barcodes'});
    for(let p=0;p<pages;p++){
      if(p)doc.addPage([d.width,d.height],orientation);
      renderPage(doc,records.slice(p*d.rowsPerPage,(p+1)*d.rowsPerPage),d,invoiceText(invoice),p+1,pages,records.length);
    }
    return doc;
  }
  let assetPromise=null;
  function loadAssets(){
    if(root.jspdf?.jsPDF&&root.SerialReportFontBase64)return Promise.resolve({jsPDF:root.jspdf.jsPDF,font:root.SerialReportFontBase64});
    if(!assetPromise)assetPromise=new Promise((resolve,reject)=>{
      const script=document.createElement('script');script.src='/pdfjs/serial-report-assets-v1.js';script.async=true;
      script.onload=()=>{if(root.jspdf?.jsPDF&&root.SerialReportFontBase64)resolve({jsPDF:root.jspdf.jsPDF,font:root.SerialReportFontBase64});else{script.remove();reject(Error('کتابخانه یا فونت PDF در دسترس نیست.'));}};
      script.onerror=()=>{script.remove();reject(Error('بارگذاری کتابخانه PDF ناموفق بود؛ نسخه سرور را بررسی کنید.'));};
      document.head.append(script);
    }).catch(error=>{assetPromise=null;throw error;});
    return assetPromise;
  }
  async function download(serials,invoice){
    const assets=await loadAssets(),doc=makePdf(serials,invoice,assets);
    doc.save(filename(invoice));
  }
  const api={code128,makePdf,download,filename,layout};
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.SerialBarcodePdf=api;
})(typeof globalThis!=='undefined'?globalThis:this);
