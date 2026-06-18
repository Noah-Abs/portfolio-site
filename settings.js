(function(){
  var DARK={'--bg':'#0b0c0e','--bg2':'#0e0f13','--panel':'#101115','--panel2':'#15161b','--border':'#1b1e24','--border2':'#262a32','--text':'#ffffff','--text2':'#cfd4da','--text3':'#aab0b9','--muted':'#7e858f','--muted2':'#474d56'};
  var LIGHT={'--bg':'#eef1f4','--bg2':'#ffffff','--panel':'#ffffff','--panel2':'#f1f4f7','--border':'#e2e7ec','--border2':'#d4dbe2','--text':'#14181d','--text2':'#2b333b','--text3':'#48515b','--muted':'#6c757e','--muted2':'#aab0b9'};
  var ACCENT='#4aa3ff';
  var MAX_PLAYERS=5;
  function ls(k,v){try{if(v===undefined)return localStorage.getItem(k);localStorage.setItem(k,v);}catch(e){return null;}}
  function esc(s){return String(s==null?'':s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});}
  function applyTheme(t){var m=t==='light'?LIGHT:DARK,r=document.documentElement;for(var k in m)r.style.setProperty(k,m[k]);r.setAttribute('data-dt-theme',t);}
  var theme=ls('dt-theme')||'dark';
  applyTheme(theme);
  document.documentElement.style.setProperty('--accent',ACCENT);

  // ---- favorites: read API + change event for other pages (e.g. the homescreen dashboard) ----
  function favPlayers(){try{return JSON.parse(ls('dt-fav-players')||'[]');}catch(e){return [];}}
  window.getSettings=function(){return {theme:ls('dt-theme')||'dark',favTeam:ls('dt-fav-team')||'',favPlayers:favPlayers()};};
  function fire(){try{document.dispatchEvent(new CustomEvent('dt:settings-changed'));}catch(e){}}

  function init(){
    if(document.querySelector('.dt-gear'))return;
    var css=document.createElement('style');
    css.textContent='.dt-gear{position:fixed;top:13px;right:13px;z-index:99999;width:38px;height:38px;border-radius:50%;border:1px solid var(--border2,#262a32);background:var(--panel2,#15161b);color:var(--text3,#aab0b9);font-size:18px;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 16px rgba(0,0,0,.45);transition:transform .3s,color .15s}'
    +'.dt-gear:hover{color:var(--accent,#4aa3ff);transform:rotate(45deg)}'
    +'.dt-pop{position:fixed;top:60px;right:13px;z-index:99999;background:var(--panel,#101115);border:1px solid var(--border2,#262a32);border-radius:12px;box-shadow:0 18px 50px rgba(0,0,0,.55);width:296px;max-height:85vh;overflow-y:auto;display:none;font-family:system-ui,-apple-system,sans-serif}'
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
    +'.dt-col{padding:6px 16px 10px}'
    +'.dt-lbl{display:block;color:var(--muted,#7e858f);font-size:11px;letter-spacing:.5px;margin-bottom:6px}'
    +'.dt-sel,.dt-in{width:100%;background:var(--panel2,#15161b);color:var(--text,#fff);border:1px solid var(--border2,#2f3540);border-radius:8px;padding:8px 10px;font-size:13px;font-family:inherit;outline:none}'
    +'.dt-sel{appearance:none;-webkit-appearance:none;cursor:pointer}'
    +'.dt-in:focus,.dt-sel:focus{border-color:var(--accent,#4aa3ff)}'
    +'.dt-sugg{display:none;margin-top:6px;background:var(--panel2,#15161b);border:1px solid var(--border2,#2f3540);border-radius:8px;max-height:184px;overflow:auto}'
    +'.dt-sugg.on{display:block}'
    +'.dt-sg{padding:7px 10px;font-size:13px;color:var(--text,#fff);cursor:pointer;border-top:1px solid var(--border,#1b1e24);display:flex;justify-content:space-between;gap:8px}'
    +'.dt-sg:first-child{border-top:0}.dt-sg:hover{background:var(--panel,#101115)}.dt-sg span{color:var(--muted,#7e858f);font-size:11px;white-space:nowrap}'
    +'.dt-sg-empty{padding:8px 10px;color:var(--muted,#7e858f);font-size:12px}'
    +'.dt-chips{display:flex;flex-wrap:wrap;gap:5px;margin-top:8px}'
    +'.dt-chip{display:inline-flex;align-items:center;gap:6px;background:var(--panel2,#15161b);border:1px solid var(--border2,#2f3540);border-radius:20px;padding:4px 7px 4px 11px;font-size:12px;color:var(--text2,#cfd4da)}'
    +'.dt-chip b{cursor:pointer;color:var(--muted,#7e858f);font-weight:400;font-size:15px;line-height:1}'
    +'.dt-chip b:hover{color:#e0556a}';
    document.head.appendChild(css);
    var gear=document.createElement('button');gear.className='dt-gear';gear.innerHTML='&#9881;';gear.setAttribute('aria-label','Settings');
    var pop=document.createElement('div');pop.className='dt-pop';
    pop.innerHTML='<div class="dt-menu"><div class="dt-item" data-act="cc">&#9881;&nbsp; Control Center</div></div>'
      +'<div class="dt-cc"><div class="dt-h">Control Center</div>'
      +'<div class="dt-row"><span>Light mode</span><button class="dt-tg" data-act="theme"></button></div>'
      +'<div class="dt-h">My Team &amp; Players</div>'
      +'<div class="dt-col"><label class="dt-lbl">Favorite team</label><select class="dt-sel dt-fav-team"><option value="">None yet</option></select></div>'
      +'<div class="dt-col"><label class="dt-lbl">Favorite players</label><input class="dt-in dt-fav-search" type="text" placeholder="Search a player…" autocomplete="off"><div class="dt-sugg"></div><div class="dt-chips"></div></div>'
      +'</div>';
    document.body.appendChild(gear);document.body.appendChild(pop);
    var menu=pop.querySelector('.dt-menu'),cc=pop.querySelector('.dt-cc');
    var teamSel=pop.querySelector('.dt-fav-team'),search=pop.querySelector('.dt-fav-search'),sugg=pop.querySelector('.dt-sugg'),chips=pop.querySelector('.dt-chips');

    function refresh(){pop.querySelector('.dt-tg').classList.toggle('on',(ls('dt-theme')||'dark')==='light');}

    // favorite team (lazy-loaded once the panel opens)
    var teamsLoaded=false;
    function loadTeams(){
      if(teamsLoaded)return;teamsLoaded=true;
      var y=new Date().getFullYear();
      fetch('https://statsapi.mlb.com/api/v1/teams?sportId=1&season='+y).then(function(r){return r.ok?r.json():null;}).then(function(d){
        if(!d||!d.teams){teamsLoaded=false;return;}
        var ts=d.teams.filter(function(t){return t.sport&&t.sport.id===1;}).sort(function(a,b){return String(a.name).localeCompare(String(b.name));});
        var cur=ls('dt-fav-team')||'';
        var html='<option value="">None yet</option>';
        ts.forEach(function(t){html+='<option value="'+t.id+'"'+(String(t.id)===cur?' selected':'')+'>'+esc(t.name)+'</option>';});
        teamSel.innerHTML=html;
      }).catch(function(){teamsLoaded=false;});
    }
    teamSel.onchange=function(){ls('dt-fav-team',teamSel.value);fire();};

    // favorite players (search -> chips)
    function getP(){return favPlayers();}
    function setP(arr){ls('dt-fav-players',JSON.stringify(arr));renderChips();fire();}
    function addP(id,name){var arr=getP();if(arr.length>=MAX_PLAYERS)return;for(var i=0;i<arr.length;i++)if(arr[i].id===id)return;arr.push({id:id,name:name});setP(arr);}
    function removeP(id){setP(getP().filter(function(x){return x.id!==id;}));}
    function renderChips(){var arr=getP();chips.innerHTML=arr.map(function(p){return '<span class="dt-chip">'+esc(p.name)+'<b data-rm="'+p.id+'">×</b></span>';}).join('');}
    chips.onclick=function(e){var b=e.target.closest('[data-rm]');if(b)removeP(+b.getAttribute('data-rm'));};

    var lastSugg=[],stm=null;
    search.oninput=function(){var q=search.value.trim();clearTimeout(stm);
      if(q.length<2){sugg.classList.remove('on');sugg.innerHTML='';return;}
      stm=setTimeout(function(){
        fetch('https://statsapi.mlb.com/api/v1/people/search?names='+encodeURIComponent(q)).then(function(r){return r.ok?r.json():null;}).then(function(d){
          lastSugg=((d&&d.people)||[]).slice(0,8);
          if(!lastSugg.length){sugg.innerHTML='<div class="dt-sg-empty">No matches</div>';sugg.classList.add('on');return;}
          sugg.innerHTML=lastSugg.map(function(p,i){var pos=(p.primaryPosition&&p.primaryPosition.abbreviation)||'';return '<div class="dt-sg" data-i="'+i+'"><span style="color:inherit;white-space:normal">'+esc(p.fullName)+'</span><span>'+esc(pos)+'</span></div>';}).join('');
          sugg.classList.add('on');
        }).catch(function(){});
      },230);
    };
    sugg.onclick=function(e){var it=e.target.closest('.dt-sg');if(!it)return;var p=lastSugg[+it.getAttribute('data-i')];if(p)addP(p.id,p.fullName);search.value='';sugg.classList.remove('on');sugg.innerHTML='';};

    function openFav(){loadTeams();renderChips();}
    gear.onclick=function(e){e.stopPropagation();var o=pop.classList.toggle('open');if(!o){cc.classList.remove('open');menu.style.display='';}refresh();};
    pop.onclick=function(e){e.stopPropagation();var t=e.target.closest('[data-act]');if(!t)return;
      var a=t.getAttribute('data-act');
      if(a==='cc'){menu.style.display='none';cc.classList.add('open');openFav();}
      else if(a==='theme'){var nt=(ls('dt-theme')||'dark')==='light'?'dark':'light';ls('dt-theme',nt);applyTheme(nt);refresh();}};
    document.addEventListener('click',function(){pop.classList.remove('open');cc.classList.remove('open');menu.style.display='';});
  }
  if(document.readyState!=='loading')init();else document.addEventListener('DOMContentLoaded',init);
})();
