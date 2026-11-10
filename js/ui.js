'use strict';
/* ---------- UI ---------- */
function chips(){
  document.querySelectorAll('[data-mode]').forEach(b=>b.classList.toggle('on',b.dataset.mode===S.mode));
  document.querySelectorAll('[data-lvl]').forEach(b=>b.classList.toggle('on',!sandbox&&+b.dataset.lvl===level));
  $('sandbox').classList.toggle('on',sandbox);
  $('sound').textContent=S.sound?'Sound on':'Sound off';
}
$('lvlRow').innerHTML=LV.map((L,i)=>'<button class="chip" data-lvl="'+i+'" title="'+L.name+'">'+(i+1)+'</button>').join('');
function buildSliders(){
  const vis=SL.filter(a=>!a[5]||a[5]===(S.mode==='live'?'live':'old'));
  $('sliders').innerHTML=vis.map(a=>'<label for="s_'+a[0]+'"><span>'+a[1]+'</span><output id="o_'+a[0]+'"></output><input id="s_'+a[0]+'" type="range" min="'+a[2]+'" max="'+a[3]+'" step="'+a[4]+'"></label>').join('');
  vis.forEach(a=>{const i=$('s_'+a[0]),o=$('o_'+a[0]);i.value=S[a[0]];o.textContent=S[a[0]];i.oninput=()=>{S[a[0]]=+i.value;o.textContent=i.value;save()}});
}
$('gear').onclick=()=>{$('panel').hidden=!$('panel').hidden};
document.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>{S.mode=b.dataset.mode;save();buildSliders();chips()});
document.querySelectorAll('[data-lvl]').forEach(b=>b.onclick=()=>{failing=false;loadLevel(+b.dataset.lvl)});
$('sandbox').onclick=()=>{failing=false;loadSandbox()};
$('sound').onclick=()=>{initAudio();S.sound=!S.sound;save();chips()};
$('reset').onclick=()=>{S=Object.assign({},DEF);save();buildSliders();chips()};
$('copy').onclick=()=>{const txt=JSON.stringify(S),box=$('copyBox');const fb=()=>{box.hidden=false;box.value=txt;box.select()};$('copy').textContent='Copied';setTimeout(()=>$('copy').textContent='Copy values',1100);try{navigator.clipboard.writeText(txt).catch(fb)}catch(e){fb()}};
$('next').onclick=()=>{initAudio();loadLevel(level+1)};
addEventListener('keydown',e=>{if(e.key==='m'||e.key==='M'){const o=['live','aim','shape'];S.mode=o[(o.indexOf(S.mode)+1)%3];save();buildSliders();failing=false;reloadLevel();pop('Control: '+S.mode,0,4,0,true)}else if(e.key==='r'||e.key==='R'){failing=false;reloadLevel()}else if((e.key===' '||e.key==='Enter')&&!$('card').hidden){e.preventDefault();loadLevel(level+1)}});
addEventListener('resize',layout);

buildSliders();
layout();
loadLevel(0);
requestAnimationFrame(frame);
/* Loading screen: fade it out once the first frames are drawn (shown at least ~0.8 s so it doesn't flash). */
requestAnimationFrame(()=>requestAnimationFrame(()=>setTimeout(()=>{const l=$('loader');if(!l)return;l.classList.add('done');setTimeout(()=>l.remove(),500)},Math.max(0,800-performance.now()))));
window.__ws={get panes(){return panes},get level(){return level},get sandbox(){return sandbox},get won(){return won},get ballsLeft(){return ballsLeft},get cur(){return !!cur},get balls(){return balls},ballPx,scr:toScreen,S};

