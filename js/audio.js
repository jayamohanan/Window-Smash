'use strict';
/* ---------- audio ---------- */
let ac=null,master,noiseBuf;
function buildAudio(){const C=window.AudioContext||window.webkitAudioContext;if(!C)return;ac=new C();const comp=ac.createDynamicsCompressor();comp.connect(ac.destination);master=ac.createGain();master.gain.value=.8;master.connect(comp);noiseBuf=ac.createBuffer(1,ac.sampleRate,ac.sampleRate);const d=noiseBuf.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1}
/* Called on every tap. iOS Safari can leave the context 'suspended' or 'interrupted' (or dead) after the phone is locked:
   resume it, and if it still won't run, build a fresh one (inside the tap, so iOS allows it to start). */
function initAudio(){
  if(!ac){buildAudio();return}
  if(ac.state==='running')return;
  const old=ac;let p=null;try{p=old.resume()}catch(e){}
  const rebuild=()=>{if(ac!==old||ac.state==='running')return;try{old.close()}catch(e){}ac=null;buildAudio();try{ac&&ac.resume()}catch(e){}};
  if(p&&p.then)p.then(()=>{if(old.state!=='running')rebuild()},rebuild);else rebuild();
  setTimeout(rebuild,400); /* a resume that never settles counts as failed */
}
/* Coming back to the page: try to resume (no rebuild here; outside a tap a new context would start suspended). */
function wakeAudio(){if(ac&&ac.state!=='running'&&document.visibilityState!=='hidden'){try{const p=ac.resume();if(p&&p.catch)p.catch(()=>{})}catch(e){}}}
document.addEventListener('visibilitychange',wakeAudio);addEventListener('pageshow',wakeAudio);addEventListener('focus',wakeAudio);
function env(g,t,a,dec){g.gain.setValueAtTime(a,t);g.gain.exponentialRampToValueAtTime(.0008,t+dec)}
function noise(t,type,f,q,a,dec){const s=ac.createBufferSource();s.buffer=noiseBuf;s.loop=true;const b=ac.createBiquadFilter();b.type=type;b.frequency.value=f;b.Q.value=q;const g=ac.createGain();env(g,t,a,dec);s.connect(b);b.connect(g);g.connect(master);s.start(t,Math.random()*.8);s.stop(t+dec+.02)}
function tone(t,type,f0,f1,a,dec){const o=ac.createOscillator();o.type=type;o.frequency.setValueAtTime(f0,t);if(f1!==f0)o.frequency.exponentialRampToValueAtTime(f1,t+dec);const g=ac.createGain();env(g,t,a,dec);o.connect(g);g.connect(master);o.start(t);o.stop(t+dec+.02)}
let tinkAt=-1;
const can=()=>S.sound&&ac&&noiseBuf;
const sfx={
  kick(){if(!can())return;const t=ac.currentTime;tone(t,'sine',170,52,.9,.13);noise(t,'lowpass',1800,.6,.35,.05)},
  glass(){if(!can())return;const t=ac.currentTime,p=rnd(.92,1.1);
    noise(t,'highpass',2200*p,.7,.8,.11);noise(t,'bandpass',4200*p,.9,.55,.22);tone(t,'sine',135,48,.7,.16);
    for(let i=0;i<10;i++){const q=Math.pow(Math.random(),1.6)*.45;tone(t+.02+q,Math.random()<.5?'triangle':'sine',rnd(2600,7600),rnd(2400,7200),rnd(.05,.13)*(1-q),rnd(.04,.1))}},
  /* falling shards: at most 3 per window, at least 0.12 s apart, so breaks don't chain into noise */
  tink(p){if(!can())return;const t=ac.currentTime;if(t-tinkAt<.12)return;if(p){p.tinks=(p.tinks||0)+1;if(p.tinks>3)return}tinkAt=t;tone(t,'triangle',rnd(3000,6500),rnd(2800,6000),.08,.07);tone(t+.05,'sine',rnd(4000,7500),4000,.045,.05)},
  thud(){if(!can())return;const t=ac.currentTime;tone(t,'sine',120,46,.8,.16);noise(t,'lowpass',620,.8,.5,.09)},
  clang(){if(!can())return;const t=ac.currentTime;tone(t,'square',760,740,.16,.2);tone(t,'triangle',1240,1190,.2,.3);noise(t,'bandpass',2100,2,.25,.05)},
  prop(k){if(!can())return;const t=ac.currentTime;
    if(k==='tv'){noise(t,'bandpass',900,1,.9,.16);tone(t,'sawtooth',900,60,.3,.22);for(let i=0;i<12;i++)noise(t+.03+i*.035,'highpass',5000,1,.32*(1-i/14),.018)}
    else if(k==='fish'){noise(t,'highpass',2600,.7,.65,.08);noise(t+.02,'lowpass',1300,1,.85,.55);for(let i=0;i<7;i++)tone(t+.1+i*.05,'sine',rnd(400,900),rnd(900,1500),.13,.06)}
    else if(k==='cake'){noise(t,'lowpass',500,1,.9,.2);tone(t,'sine',200,60,.5,.22)}
    else{noise(t,'bandpass',2400,1.3,.8,.12);for(let i=0;i<10;i++)tone(t+.02+i*.03,'triangle',rnd(1200,3200),rnd(1000,2600),.16,.07)}},
  rustle(){if(!can())return;const t=ac.currentTime;noise(t,'bandpass',2600,.6,.55,.26);noise(t+.04,'highpass',4200,.8,.3,.18);noise(t,'lowpass',400,.8,.4,.08)},
  crack(){if(!can())return;const t=ac.currentTime;noise(t,'highpass',3000,.8,.9,.07);tone(t,'triangle',2400,1800,.3,.09);tone(t,'sine',300,90,.45,.1);for(let i=0;i<6;i++)tone(t+.02+i*.02,'triangle',rnd(3000,6000),rnd(2500,5000),.08,.04)},
  wood(){if(!can())return;const t=ac.currentTime;noise(t,'bandpass',900,1.2,1,.13);tone(t,'triangle',220,90,.6,.14);for(let i=0;i<5;i++)noise(t+.03+i*.03,'bandpass',rnd(1200,2400),2,.35,.05)},
  /* the cat: a tiny, quiet rolled chirp, not a full meow */
  mrrp(){if(!can())return;const t=ac.currentTime,o=ac.createOscillator(),l=ac.createOscillator(),d=ac.createGain(),b=ac.createBiquadFilter(),g=ac.createGain();o.type='triangle';o.frequency.setValueAtTime(420,t);o.frequency.linearRampToValueAtTime(640,t+.06);o.frequency.exponentialRampToValueAtTime(470,t+.17);b.type='lowpass';b.frequency.value=1500;g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(.15,t+.025);g.gain.exponentialRampToValueAtTime(.001,t+.19);l.frequency.value=30;d.gain.value=.05;l.connect(d);d.connect(g.gain);o.connect(b);b.connect(g);g.connect(master);o.start(t);l.start(t);o.stop(t+.21);l.stop(t+.21)},
  splash(){if(!can())return;const t=ac.currentTime;noise(t,'lowpass',900,.8,.9,.35);noise(t+.02,'bandpass',2200,.7,.4,.22);tone(t,'sine',320,110,.4,.18)},
  whoosh(){if(!can())return;const t=ac.currentTime;noise(t,'bandpass',500,.7,.35,1.1);noise(t+.25,'bandpass',900,.7,.25,.8)},
  ding(){if(!can())return;const t=ac.currentTime;tone(t,'sine',1320,1320,.5,1.2);tone(t,'triangle',2640,2630,.18,.8);tone(t,'sine',1980,1975,.12,1)},
  boing(){if(!can())return;const t=ac.currentTime;tone(t,'sine',140,520,.7,.32);tone(t,'triangle',280,900,.15,.25)},
  lost(){if(!can())return;const t=ac.currentTime;tone(t,'triangle',392,370,.32,.22);tone(t+.22,'triangle',330,311,.32,.22);tone(t+.46,'triangle',262,196,.34,.55)},
  boom(){if(!can())return;const t=ac.currentTime;tone(t,'sine',96,30,1,.55);noise(t,'lowpass',260,.9,.5,.4)},
  win(){if(!can())return;const t=ac.currentTime;[523,659,784,1047].forEach((f,i)=>{tone(t+i*.11,'triangle',f,f,.3,.26);tone(t+i*.11,'sine',f*2,f*2,.1,.2)});tone(t+.44,'sine',1568,1568,.14,.7)},
  star(i){if(!can())return;const t=ac.currentTime,f=[880,1109,1319][i]||1319;tone(t,'triangle',f,f,.32,.3);tone(t,'sine',f*2,f*2,.12,.24)}
};


