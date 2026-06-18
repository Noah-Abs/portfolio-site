(function(){
  var DARK={'--bg':'#0b0c0e','--bg2':'#0e0f13','--panel':'#101115','--panel2':'#15161b','--border':'#1b1e24','--border2':'#262a32','--text':'#ffffff','--text2':'#cfd4da','--text3':'#aab0b9','--muted':'#7e858f','--muted2':'#474d56'};
  var LIGHT={'--bg':'#eef1f4','--bg2':'#ffffff','--panel':'#ffffff','--panel2':'#f1f4f7','--border':'#e2e7ec','--border2':'#d4dbe2','--text':'#14181d','--text2':'#2b333b','--text3':'#48515b','--muted':'#6c757e','--muted2':'#aab0b9'};
  var ACCENT='#4aa3ff';
  function ls(k,v){try{if(v===undefined)return localStorage.getItem(k);localStorage.setItem(k,v);}catch(e){return null;}}
  function applyTheme(t){var m=t==='light'?LIGHT:DARK,r=document.documentElement;for(var k in m)r.style.setProperty(k,m[k]);r.setAttribute('data-dt-theme',t);}
  var theme=ls('dt-theme')||'dark';
  applyTheme(theme);
  document.documentElement.style.setProperty('--accent',ACCENT);
  function init(){
    if(document.querySelector('.dt-gear'))return;
    var css=document.createElement('style');
    css.textContent='.dt-gear{position:fixed;top:13px;right:13px;z-index:99999;width:38px;height:38px;border-radius:50%;border:1px solid var(--border2,#262a32);background:var(--panel2,#15161b);color:var(--text3,#aab0b9);font-size:18px;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 16px rgba(0,0,0,.45);transition:transform .3s,color .15s}'
    +'.dt-gear:hover{color:var(--accent,#4aa3ff);transform:rotate(45deg)}'
    +'.dt-pop{position:fixed;top:60px;right:13px;z-index:99999;background:var(--panel,#101115);border:1px solid var(--border2,#262a32);border-radius:12px;box-shadow:0 18px 50px rgba(0,0,0,.55);width:248px;overflow:hidden;display:none;font-family:system-ui,-apple-system,sans-serif}'
    +'.dt-pop.open{display:block}'
    +'.dt-item{padding:13px 16px;color:var(--text,#fff);font-size:14px;font-weight:500;cursor:pointer;display:flex;align-items:center;gap:10px}'
    +'.dt-item:hover{background:var(--panel2,#15161b)}'
    +'.dt-cc{display:none;padding:4px 0 12px}.dt-cc.open{display:block}'
    +'.dt-h{padding:13px 16px 7px;font-size:10.5px;letter-spacing:1.5px;text-transform:uppercase;color:var(--muted,#7e858f);font-weight:700}'
    +'.dt-row{padding:8px 16px;display:flex;align-items:center;justify-content:space-between}'
    +'.dt-row span{color:var(--text2,#cfd4da);font-size:13.5px}'
    +'.dt-tg{width:46px;height:25px;border-radius:13px;background:var(--border2,#262a32);position:relative;cursor:pointer;border:none;flex:0 0 auto}'
    +'.dt-tg:after{content:"";position:absolute;top:3px;left:3px;width:19px;height:19px;border-radius:50%;background:#fff;transition:left .2s}'
    +'.dt-tg.on{background:var(--accent,#4aa3ff)}.dt-tg.on:after{left:24px}'
    +'@media(max-width:760px){.nav .tab{flex:0 0 auto}}';
    document.head.appendChild(css);
    var gear=document.createElement('button');gear.className='dt-gear';gear.innerHTML='&#9881;';gear.setAttribute('aria-label','Settings');
    var pop=document.createElement('div');pop.className='dt-pop';
    pop.innerHTML='<div class="dt-menu"><div class="dt-item" data-act="cc">&#9881;&nbsp; Control Center</div></div>'
      +'<div class="dt-cc"><div class="dt-h">Control Center</div>'
      +'<div class="dt-row"><span>Light mode</span><button class="dt-tg" data-act="theme"></button></div></div>';
    document.body.appendChild(gear);document.body.appendChild(pop);
    var menu=pop.querySelector('.dt-menu'),cc=pop.querySelector('.dt-cc');
    function refresh(){pop.querySelector('.dt-tg').classList.toggle('on',(ls('dt-theme')||'dark')==='light');}
    gear.onclick=function(e){e.stopPropagation();var o=pop.classList.toggle('open');if(!o){cc.classList.remove('open');menu.style.display='';}refresh();};
    pop.onclick=function(e){e.stopPropagation();var t=e.target.closest('[data-act]');if(!t)return;
      var a=t.getAttribute('data-act');
      if(a==='cc'){menu.style.display='none';cc.classList.add('open');}
      else if(a==='theme'){var nt=(ls('dt-theme')||'dark')==='light'?'dark':'light';ls('dt-theme',nt);applyTheme(nt);refresh();}};
    document.addEventListener('click',function(){pop.classList.remove('open');cc.classList.remove('open');menu.style.display='';});
  }
  if(document.readyState!=='loading')init();else document.addEventListener('DOMContentLoaded',init);
})();
