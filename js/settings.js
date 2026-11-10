'use strict';
const T=THREE, $=id=>document.getElementById(id);
const rnd=(a,b)=>a+Math.random()*(b-a), clamp=(v,a,b)=>Math.min(b,Math.max(a,v)), lerp=(a,b,t)=>a+(b-a)*t;

/* ---------- settings ---------- */
const DEF={mode:'live',power:5.5,loft:.5,side:1,lift:1,gravity:16,grab:1.5,ring:3,speed:30,curve:1,snap:.2,preview:.4,freeze:85,slow:.3,shake:1,shards:1,sound:true};
const KEY='windowSmash.v3'; /* v3: live kick is now ballistic (old saved gravity/flight values no longer fit) */
let S=Object.assign({},DEF);
try{Object.assign(S,JSON.parse(localStorage.getItem(KEY)||'{}'))}catch(e){}
if(window.matchMedia&&matchMedia('(prefers-reduced-motion:reduce)').matches)S.shake=Math.min(S.shake,.2);
const save=()=>{try{localStorage.setItem(KEY,JSON.stringify(S))}catch(e){}};
const SL=[['power','Kick power (swipe speed)',2,12,.25,'live'],['loft','Kick height',.2,1,.05,'live'],['side','Steering: sideways',.2,2,.05,'live'],['lift','Steering: height',.2,2,.05,'live'],['gravity','Gravity',6,30,.5,'live'],['grab','Grab circle (× ball)',1,3,.1,'live'],['ring','Kick ring (× ball)',1.5,6,.1,'live'],['speed','Ball speed',18,50,1,'old'],['curve','Curve strength',0,2,.05,'old'],['snap','Aim help',0,1,.05],['preview','Path preview',.1,1,.05,'old'],['freeze','Freeze on hit (ms)',0,200,5],['slow','Slow-mo speed',.1,1,.05],['shake','Screen shake',0,2,.1],['shards','Glass pieces',.4,2,.1]];

