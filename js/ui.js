'use strict';
/* ---------- UI ---------- */
function chips(){
  document.querySelectorAll('[data-mode]').forEach(b=>b.classList.toggle('on',b.dataset.mode===S.mode));
  document.querySelectorAll('[data-lvl]').forEach(b=>b.classList.toggle('on',!sandbox&&+b.dataset.lvl===level));
  $('sandbox').classList.toggle('on',sandbox);
  $('glSky').classList.toggle('on',S.glSky);$('glGlint').classList.toggle('on',S.glints);
  const sb=$('soundBtn');sb.classList.toggle('muted',!S.sound);sb.setAttribute('aria-label',S.sound?'Sound on':'Sound off');
}
$('lvlRow').innerHTML=LV.map((L,i)=>'<button class="chip" data-lvl="'+i+'" title="'+L.name+'">'+(i+1)+'</button>').join('');
function buildSliders(){
  const vis=SL.filter(a=>!a[5]||a[5]===(S.mode==='live'?'live':'old'));
  $('sliders').innerHTML=vis.map(a=>'<label for="s_'+a[0]+'"><span>'+a[1]+'</span><output id="o_'+a[0]+'"></output><input id="s_'+a[0]+'" type="range" min="'+a[2]+'" max="'+a[3]+'" step="'+a[4]+'"></label>').join('');
  vis.forEach(a=>{const i=$('s_'+a[0]),o=$('o_'+a[0]);i.value=S[a[0]];o.textContent=S[a[0]];i.oninput=()=>{S[a[0]]=+i.value;o.textContent=i.value;save()}});
}
$('gear').onclick=()=>{$('panel').hidden=!$('panel').hidden};
document.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>{S.mode=b.dataset.mode;save();buildSliders();chips();failing=false;reloadLevel()});
document.querySelectorAll('[data-lvl]').forEach(b=>b.onclick=()=>{failing=false;loadLevel(+b.dataset.lvl)});
$('glSky').onclick=()=>{S.glSky=!S.glSky;save();chips()};
$('glGlint').onclick=()=>{S.glints=!S.glints;save();chips()};
$('sandbox').onclick=()=>{failing=false;loadSandbox()};
$('soundBtn').onclick=()=>{initAudio();S.sound=!S.sound;save();chips()};
$('retryBtn').onclick=()=>{initAudio();$('panel').hidden=true;restart()};
$('skipBtn').onclick=()=>{}; /* placeholder: a future rewarded-ad skip */
$('reset').onclick=()=>{S=Object.assign({},DEF);save();buildSliders();chips()};
$('copy').onclick=()=>{const txt=JSON.stringify(S),box=$('copyBox');const fb=()=>{box.hidden=false;box.value=txt;box.select()};$('copy').textContent='Copied';setTimeout(()=>$('copy').textContent='Copy values',1100);try{navigator.clipboard.writeText(txt).catch(fb)}catch(e){fb()}};
$('again').onclick=()=>{initAudio();if(leaving)return;leaving=true;$('wipe').classList.add('on');later(.2,()=>loadLevel(0))};
$('fail').addEventListener('pointerdown',()=>{initAudio();if(!$('panel').hidden){$('panel').hidden=true;return}retry()});
/* number keys jump to a level: digits within 350 ms of each other make one number (2 then 3 = level 23); unknown numbers do nothing */
let numBuf='',numT=0;
function numKey(d){numBuf+=d;clearTimeout(numT);const go=()=>{const n=+numBuf;numBuf='';if(n>=1&&n<=LV.length){failing=false;loadLevel(n-1)}};if(numBuf.length>=2)go();else numT=setTimeout(go,350)}
addEventListener('keydown',e=>{if(/^[0-9]$/.test(e.key)&&!e.ctrlKey&&!e.metaKey&&!e.altKey&&!/INPUT|TEXTAREA/.test(e.target.tagName)){numKey(e.key);return}if(e.key==='m'||e.key==='M'){const o=['live','aim','shape'];S.mode=o[(o.indexOf(S.mode)+1)%3];save();buildSliders();failing=false;reloadLevel();pop('Control: '+S.mode,0,4,0,true)}else if(e.key==='r'||e.key==='R'){failing=false;reloadLevel()}else if((e.key===' '||e.key==='Enter')&&won&&level<LV.length-1){e.preventDefault();advance()}else if((e.key===' '||e.key==='Enter')&&failT>=0){e.preventDefault();retry()}});
addEventListener('resize',layout);

buildSliders();
layout();
loadLevel(0);
requestAnimationFrame(frame);
/* Loading screen: once the first frames are drawn (and at least ~0.8 s in, so it doesn't flash) the bar runs up to 100%, then fades out. */
requestAnimationFrame(()=>requestAnimationFrame(()=>setTimeout(()=>{window.ldDone=true;const w=()=>{const l=$('loader');if(!l)return;if(!window.ldFull)return requestAnimationFrame(w);setTimeout(()=>{l.classList.add('done');setTimeout(()=>l.remove(),500)},180)};w()},Math.max(0,800-performance.now()))));
window.__ws={get panes(){return panes},get level(){return level},get sandbox(){return sandbox},get won(){return won},get ballsLeft(){return ballsLeft},get cur(){return !!cur},get balls(){return balls},ballPx,scr:toScreen,S};

