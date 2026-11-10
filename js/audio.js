'use strict';
/* ---------- audio ---------- */
let ac=null,master,noiseBuf;
function initAudio(){if(ac){if(ac.state==='suspended')ac.resume();return}const C=window.AudioContext||window.webkitAudioContext;if(!C)return;ac=new C();const comp=ac.createDynamicsCompressor();comp.connect(ac.destination);master=ac.createGain();master.gain.value=.8;master.connect(comp);noiseBuf=ac.createBuffer(1,ac.sampleRate,ac.sampleRate);const d=noiseBuf.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1}
function env(g,t,a,dec){g.gain.setValueAtTime(a,t);g.gain.exponentialRampToValueAtTime(.0008,t+dec)}
function noise(t,type,f,q,a,dec){const s=ac.createBufferSource();s.buffer=noiseBuf;s.loop=true;const b=ac.createBiquadFilter();b.type=type;b.frequency.value=f;b.Q.value=q;const g=ac.createGain();env(g,t,a,dec);s.connect(b);b.connect(g);g.connect(master);s.start(t,Math.random()*.8);s.stop(t+dec+.02)}
function tone(t,type,f0,f1,a,dec){const o=ac.createOscillator();o.type=type;o.frequency.setValueAtTime(f0,t);if(f1!==f0)o.frequency.exponentialRampToValueAtTime(f1,t+dec);const g=ac.createGain();env(g,t,a,dec);o.connect(g);g.connect(master);o.start(t);o.stop(t+dec+.02)}
const can=()=>S.sound&&ac&&noiseBuf;
const sfx={
  kick(){if(!can())return;const t=ac.currentTime;tone(t,'sine',170,52,.9,.13);noise(t,'lowpass',1800,.6,.35,.05)},
  glass(){if(!can())return;const t=ac.currentTime,p=rnd(.92,1.1);
    noise(t,'highpass',2200*p,.7,1,.13);noise(t,'bandpass',4200*p,.9,.8,.3);tone(t,'sine',135,48,.75,.16);
    for(let i=0;i<30;i++){const q=Math.pow(Math.random(),1.8)*1.05;tone(t+.025+q,Math.random()<.5?'triangle':'sine',rnd(2600,8200),rnd(2400,7800),rnd(.06,.2)*(1-q*.6),rnd(.04,.12))}},
  tink(){if(!can())return;const t=ac.currentTime;tone(t,'triangle',rnd(3000,6500),rnd(2800,6000),.13,.08);tone(t+.05,'sine',rnd(4000,7500),4000,.08,.06)},
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
  hey(){if(!can())return;const t=ac.currentTime,o=ac.createOscillator(),b=ac.createBiquadFilter(),g=ac.createGain();o.type='sawtooth';o.frequency.setValueAtTime(190,t);o.frequency.linearRampToValueAtTime(320,t+.09);o.frequency.exponentialRampToValueAtTime(150,t+.42);b.type='bandpass';b.frequency.setValueAtTime(600,t);b.frequency.linearRampToValueAtTime(1500,t+.12);b.Q.value=3;g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(.8,t+.04);g.gain.exponentialRampToValueAtTime(.001,t+.45);o.connect(b);b.connect(g);g.connect(master);o.start(t);o.stop(t+.47)}
};


