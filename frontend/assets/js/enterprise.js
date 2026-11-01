/**
 * Enterprise UI E1 — a progressive enhancement layer.
 * Does not intercept / change authorization, API calls, forms, invoice data or order state.
 * User preferences are local to this browser; no private data is stored.
 */
(function enterpriseUI() {
  'use strict';
  const root=document.documentElement;
  const prefix='portal.enterprise.';
  const NAV={
    home:['میز کار','نمای کلی فاکتورها و پیگیری سفارش‌ها'],
    users:['مدیریت کاربران','مدیریت دسترسی‌ها و حساب‌های کاربری'],
    lookups:['اطلاعات پایه','تنظیم داده‌های مرجع و فهرست‌های سیستم'],
    archive:['بایگانی','جستجو و بازیابی سوابق فاکتورها'],
    reports:['گزارش‌های مدیریتی','بررسی عملکرد و شاخص‌های عملیاتی'],
    logs:['سوابق فعالیت','ردیابی رویدادها و تغییرات ثبت‌شده'],
    account:['حساب کاربری','مشخصات حساب و تنظیمات امنیتی']
  };
  const icons={
    moon:'<path d="M20.985 12.486A9 9 0 0 1 11.514 3.015a9 9 0 1 0 9.47 9.47Z"/>',
    sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42"/>',
    compact:'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 9h10m-10 3h10m-10 3h10"/>',
    expand:'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 8h10m-10 5h10"/>',
    menu:'<path d="M4 7h16M4 12h16M4 17h16"/>',
    sidebar:'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16"/>',
    date:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 10h18"/>'
  };
  const svg=name=>'<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.9">'+icons[name]+'</svg>';
  const read=(name)=>{try{return localStorage.getItem(prefix+name)}catch{return null}};
  const store=(name,value)=>{try{localStorage.setItem(prefix+name,value)}catch{}};
  function getTheme() {
    const stored=read('theme');
    if(stored==='dark'||stored==='light')return stored;
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches?'dark':'light';
  }
  let theme=getTheme();
  function setTheme(next,save=true){
    theme=next==='dark'?'dark':'light';
    root.dataset.theme=theme;
    if(save)store('theme',theme);
    for(const button of document.querySelectorAll('[data-enterprise-theme]')){
      button.innerHTML=svg(theme==='dark'?'sun':'moon')+
        '<span class="ep-theme-label">'+(theme==='dark'?'حالت روشن':'حالت تاریک')+'</span>';
      button.setAttribute('aria-label',theme==='dark'?'فعال‌کردن حالت روشن':'فعال‌کردن حالت تاریک');
      button.title=theme==='dark'?'تغییر به ظاهر روشن':'تغییر به ظاهر تاریک';
      button.setAttribute('aria-pressed',String(theme==='dark'));
    }
  }
  function setDensity(next,save=true){
    const compact=next==='compact';
    root.classList.toggle('ep-density-compact',compact);
    if(save)store('density',compact?'compact':'comfortable');
    for(const button of document.querySelectorAll('[data-enterprise-density]')){
      button.innerHTML=svg(compact?'expand':'compact')+
        '<span class="ep-density-label">'+(compact?'نمایش عادی':'نمایش فشرده')+'</span>';
      button.title=compact?'نمایش با فاصله عادی':'نمایش فشرده‌تر';
      button.setAttribute('aria-pressed',String(compact));
    }
  }
  function setSidebar(next,save=true){
    const collapsed=next==='collapsed';
    root.classList.toggle('ep-sidebar-collapsed',collapsed);
    if(save)store('sidebar',collapsed?'collapsed':'expanded');
    for(const button of document.querySelectorAll('[data-enterprise-sidebar]')){
      button.setAttribute('aria-label',collapsed?'بازکردن منوی کناری':'جمع‌کردن منوی کناری');
      button.setAttribute('aria-pressed',String(collapsed));
      button.title=collapsed?'بازکردن منوی کناری':'جمع‌کردن منوی کناری';
    }
  }
  function makeButton(attribute,cls,label,onClick) {
    const btn=document.createElement('button');
    btn.type='button';btn.className=cls;btn.setAttribute(attribute,'');
    btn.setAttribute('aria-label',label);btn.title=label;
    btn.addEventListener('click',onClick);
    return btn;
  }
  function ensureToolbar(){
    const actions=document.querySelector('.top-header .top-actions');
    if(actions && !actions.querySelector('[data-enterprise-theme]')){
      const controls=document.createElement('div');
      controls.className='ep-toolbar-controls';
      const themeBtn=makeButton('data-enterprise-theme','ep-theme-toggle','تغییر حالت روشن و تاریک',()=>setTheme(theme==='dark'?'light':'dark'));
      const densityBtn=makeButton('data-enterprise-density','ep-density-toggle','تنظیم تراکم نمایش',()=>{
        setDensity(root.classList.contains('ep-density-compact')?'comfortable':'compact');
      });
      const menuBtn=makeButton('data-enterprise-menu','ep-mobile-menu','بازکردن فهرست',()=>{
        const open=root.classList.toggle('ep-mobile-nav-open');
        menuBtn.setAttribute('aria-expanded',String(open));
      });
      menuBtn.innerHTML=svg('menu');
      const sidebarBtn=makeButton('data-enterprise-sidebar','ep-sidebar-toggle','جمع‌کردن منوی کناری',()=>{
        setSidebar(root.classList.contains('ep-sidebar-collapsed')?'expanded':'collapsed');
      });
      sidebarBtn.innerHTML=svg('sidebar');
      controls.append(menuBtn,sidebarBtn,themeBtn,densityBtn);
      const search=actions.querySelector('.top-search-wrap');
      if(search)actions.insertBefore(controls,search);
      else actions.prepend(controls);
    }
    const authHead=document.querySelector('.auth-head');
    if(authHead&&!authHead.querySelector('[data-enterprise-theme]')){
      const btn=makeButton('data-enterprise-theme','ep-theme-toggle ep-login-theme','تغییر حالت ظاهر',()=>setTheme(theme==='dark'?'light':'dark'));
      authHead.append(btn);
    }
    setTheme(theme,false);setDensity(read('density')==='compact'?'compact':'comfortable',false);
    setSidebar(read('sidebar')==='collapsed'?'collapsed':'expanded',false);
    const side=document.querySelector('#appShell .side-menu');
    if(side&&!side.querySelector('.ep-sidebar-caption')){
      const caption=document.createElement('div');
      caption.className='ep-sidebar-caption';
      caption.textContent='بخش‌های سامانه / WORKSPACE';
      side.prepend(caption);
    }
  }
  function ensurePageContext(){
    const main=document.querySelector('#appShell main.table-area');
    if(!main)return;
    if(main.querySelector('.ep-page-context')) {
      const stamp=document.getElementById('epTodayDate');
      if(stamp) {
        try{stamp.textContent=new Intl.DateTimeFormat('fa-IR-u-ca-persian',{year:'numeric',month:'long',day:'numeric'}).format(new Date());}
        catch{stamp.textContent=new Date().toLocaleDateString('fa-IR');}
      }
      return;
    }
    const context=document.createElement('div');
    context.className='ep-page-context';
    context.innerHTML='<div class="ep-page-identity"><span class="enterprise-kicker">SERVER MANAGEMENT PLATFORM</span><h2 id="epPageTitle">میز کار</h2><p id="epPageDescription">نمای کلی فاکتورها و پیگیری سفارش‌ها</p></div>';
    const right=document.createElement('div');right.className='ep-page-actions';
    const date=document.createElement('span');date.className='ep-context-date';
    date.innerHTML=svg('date');
    const stamp=document.createElement('span');
    stamp.id='epTodayDate';
    try{stamp.textContent=new Intl.DateTimeFormat('fa-IR-u-ca-persian',{year:'numeric',month:'long',day:'numeric'}).format(new Date());}
    catch{stamp.textContent=new Date().toLocaleDateString('fa-IR');}
    date.append(stamp);right.append(date);
    context.append(right);
    main.prepend(context);
  }
  function activeView(){
    const active=document.querySelector('.side-menu .page-nav-btn.active-page');
    const lookup={
      navHomeBtn:'home',navUsersBtn:'users',navLookupsBtn:'lookups',
      navArchiveBtn:'archive',navReportsBtn:'reports',
      navLogsBtn:'logs',navAccountBtn:'account'
    };
    return lookup[active?.id]||'home';
  }
  function updateActiveContext(){
    const key=activeView();
    const match=NAV[key]||NAV.home;
    const title=document.getElementById('epPageTitle');
    const desc=document.getElementById('epPageDescription');
    if(title)title.textContent=match[0];
    if(desc)desc.textContent=match[1];
    document.querySelectorAll('.side-menu .page-nav-btn').forEach(btn=>{
      const label=btn.querySelector('.nav-label');
      if(label)btn.title=label.textContent.trim();
      if(btn.classList.contains('active-page'))btn.setAttribute('aria-current','page');
      else btn.removeAttribute('aria-current');
    });
    root.classList.remove('ep-mobile-nav-open');
    document.querySelector('[data-enterprise-menu]')?.setAttribute('aria-expanded','false');
  }
  function keyboard(event){
    if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='k'){
      const search=document.getElementById('globalSearch');
      const shell=document.getElementById('appShell');
      if(search&&shell&&getComputedStyle(shell).display!=='none'){
        event.preventDefault();search.focus();search.select();
      }
    }
    if(event.key==='Escape'){
      root.classList.remove('ep-mobile-nav-open');
      document.querySelector('[data-enterprise-menu]')?.setAttribute('aria-expanded','false');
    }
    if(event.altKey&&event.shiftKey&&event.key.toLowerCase()==='d'){
      event.preventDefault();setTheme(theme==='dark'?'light':'dark');
    }
  }
  function initialize(){
    ensureToolbar();ensurePageContext();updateActiveContext();
    const sidebar=document.querySelector('.side-menu');
    if(sidebar){
      const observer=new MutationObserver(updateActiveContext);
      observer.observe(sidebar,{attributes:true,subtree:true,attributeFilter:['class']});
      sidebar.addEventListener('click',event=>{
        if(event.target.closest('.page-nav-btn'))root.classList.remove('ep-mobile-nav-open');
      });
    }
    document.addEventListener('keydown',keyboard);
    document.addEventListener('click',event=>{
      if(root.classList.contains('ep-mobile-nav-open') &&
         !event.target.closest('.side-menu,.ep-mobile-menu')){
        root.classList.remove('ep-mobile-nav-open');
      }
    });
    const media=window.matchMedia?.('(prefers-color-scheme: dark)');
    if(media?.addEventListener)media.addEventListener('change',()=>{
      if(read('theme')===null)setTheme(media.matches?'dark':'light',false);
    });
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initialize,{once:true});
  else initialize();
})();
