'use strict';
/* Windows that must break. */
const targets=()=>panes;
let winAt=0,leaving=false;
function checkWin(){
  if(won||sandbox||targets().some(p=>!p.broken))return;
  if(hop&&hop.stage<2){if(hop.stage===1)hopStart();return} /* near island cleared: on to the house */
  winNow();
}
/* Win: "SMASHED!" with confetti and the jingle, then the next level loads by itself (a tap skips ahead).
   The fade before the next level is the spot for a future ad break. */
function winNow(){
  won=true;winAt=performance.now();$('hint').hidden=true;$('balls').classList.remove('last');$('retryBtn').hidden=true;
  if(drag){drag=null;hidePreview()}
  const house=LVL.type==='house',final=level===LV.length-1;
  later(.6,()=>{burstConfetti();sfx.win();$('winWord').textContent=final?'ALL SMASHED!':'SMASHED!';$('win').hidden=false;if(final)later(.8,()=>{$('again').hidden=false})});
  if(house)later(1.15,()=>{grumpT=0;grump.visible=true;$('bubble').hidden=false;returnBalls()});
  if(!final)later(house?Math.min(4.2,Math.max(3,1.9+Math.min(inBalls,8)*.28)):2,advance);
}
function advance(){if(leaving||!won||level===LV.length-1)return;leaving=true;$('wipe').classList.add('on');later(.2,()=>loadLevel(level+1))}
let failing=false,spawnWait=0,failT=-1,retrying=false;
/* a ball that can still break something: in flight, on a scripted path (tunnel), rolling into a room, a bounce that's still headed in,
   or (field levels) a ball that broke a pane and flies on toward the next one */
function inPlay(){return balls.some(b=>b.tun===1||b.state==='fly'||b.state==='inside'||(b.state==='bounce'&&(b.rebound||b.awn||b.meshOk||(b.v.z<-1&&b.p.z>ZF)))||(LVL.type==='field'&&b.state==='passed'&&!b.ghost&&b.p.y>R+.05))||hopBusy()}
function checkFail(){
  if(won||failing||ballsLeft>0||cur)return;
  if(inPlay())return;
  if(!targets().some(p=>!p.broken))return;
  if(LVL.bonus){winNow();return} /* bonus level: no fail; it ends with the same win as any level */
  failing=true;later(.45,showFail);
}
/* Out of balls: play winds down under a dark overlay, the windows still standing pulse, and a tap restarts. */
function showFail(){
  if(won||cur||inPlay()){failing=false;return} /* a ball got back into play during the delay: checkFail tries again later */
  const near=hop&&hop.stage<2,left=(near?[...panes,...hop.house]:panes).filter(p=>!p.broken).length;
  $('failLeft').textContent=left+(left>1?' windows':' window')+' left';
  $('missed').innerHTML=panes.filter(p=>!p.broken).map(()=>'<i></i>').join('');
  $('balls').classList.remove('last');$('fail').hidden=false;failT=0;placeMissed();sfx.lost();
}
function retry(){if(failT<.3||retrying)return;retrying=true;$('wipe').classList.add('on');later(.2,()=>loadLevel(level))}
/* Retry button: restart the level at any time, with a full set of balls (same quick fade) */
function restart(){if(retrying||won||leaving)return;retrying=true;$('wipe').classList.add('on');later(.2,reloadLevel)}
/* Keep the pulsing outlines on the windows still standing (screen space, above the overlay). */
const _c=new T.Vector3();
function placeMissed(){
  const el=$('missed').children;let n=0;
  panes.forEach(p=>{if(p.broken)return;const e=el[n++];if(!e)return;let x0=1e9,x1=-1e9,y0=1e9,y1=-1e9;
    const m=p.locked&&p.miss; /* a target still hidden (the car behind the closed shutter): outline what opens it instead */
    [[-1,-1],[1,-1],[1,1],[-1,1]].forEach(([a,b])=>{if(m)_c.set(m.x+a*m.w/2,m.y+b*m.h/2,.5);else{_c.set(p.x+a*p.w/2,p.y+b*p.h/2,0);if(p.xf)_c.applyMatrix4(p.xf)}const s=toScreen(_c.x,_c.y,_c.z);x0=Math.min(x0,s[0]);x1=Math.max(x1,s[0]);y0=Math.min(y0,s[1]);y1=Math.max(y1,s[1])});
    e.style.cssText='left:'+(x0-5)+'px;top:'+(y0-5)+'px;width:'+(x1-x0+10)+'px;height:'+(y1-y0+10)+'px'});
}


/* ---------- ball step ---------- */
function wallHit(b,kind){ /* kind: 'thud' | 'clang' | 'soft' (no sound or word; the caller makes its own) */
  b.p.z=ZF+R*.5;b.v.z*=-.42;b.v.x*=.55;b.v.y*=.55;b.a.x=0;b.state='bounce';b.age=Math.min(b.age,.3);
  for(let i=0;i<20;i++)dust.emit(b.p.x,b.p.y,.3,rnd(-2.2,2.2),rnd(-1,2.4),rnd(0,2.2),rnd(.25,.55),[.92,.76,.56],2);
  if(kind==='soft')return;
  addShake(.16);if(kind==='clang')sfx.clang();else sfx.thud();
}
function crossPlane(b){
  if(b.live){b.live=false;b.a.set(0,-S.gravity,0)}
  const x=b.p.x,y=b.p.y;
  for(const p of panes){if(p.xf)continue;if(Math.abs(x-p.x)<=p.w/2+.06&&Math.abs(y-p.y)<=p.h/2+.06){
    if(!p.broken){
      if(p.shutF>0&&y>p.shutY-R*.3){wallHit(b,'clang');return}
      if(p.awn&&b.meshOk!==p){wallHit(b,'clang');return} /* behind its mesh: only the awning route gets in */
      if(p.armor>0){breakBoards(p,b);wallHit(b,'soft');return}
      if(p.hp>1){crackPane(p,b);wallHit(b,'soft');return}
      smash(p,b);return}
    if(p.room){b.state='dead';b.a.set(0,-G,0);b.floor=p.room.floor+R;b.pane=p;b.age=0;inBalls++}else b.state='passed';
    return}}
  if(garage&&garageCross(b,x,y))return;
  if(LVL.type==='sandbox'||LVL.type==='field')return;
  const near=hop&&hop.stage<2; /* island hop, step one: only the glass frames are here, the house is still far away */
  if(LVL.type==='stand'||near){const f=.3;for(const p of panes){if(near&&p.broken)continue;
    if(Math.abs(x-p.x)<=p.w/2+f&&Math.abs(y-p.y)<=p.h/2+f){wallHit(b,'thud');return}
    if(!p.hang&&Math.abs(Math.abs(x-p.x)-(p.w/2+.1))<.26&&y<p.y){wallHit(b,'thud');return}}
    return}
  if(LVL.type==='greenhouse'){if(Math.abs(x)<=GH.hw+.1&&y<=GH.top+.1)wallHit(b,'thud');return}
  const W=LVL.W,H=LVL.H,Gb=LVL.G,top=Math.abs(x)<=W?H+Gb*(1-Math.abs(x)/W):-1;
  if(Math.abs(x)<=W&&y<=top+.1)wallHit(b,'thud');
}
const _pp=new T.Vector3();
function stepBall(b,dt){
  b.age+=dt;if(b.live&&b.state==='fly')flyLive(b,dt);const sub=4,h=dt/sub;
  /* wind pushes any ball that is in the air outside the house */
  if(wind&&!b.ghost&&b.p.y>R+.05&&(b.state==='fly'||b.state==='passed'||b.state==='bounce'))b.v.x+=wind*dt;
  for(let i=0;i<sub;i++){
    const z0=b.p.z;_pp.copy(b.p);awnStep(b,h);b.v.addScaledVector(b.a,h);b.p.addScaledVector(b.v,h);
    const was=b.state;
    if((was==='fly'||was==='ground'||was==='bounce')&&!b.ghost&&b.tun!==1&&z0>ZF&&b.p.z<=ZF){crossPlane(b);if(b.state===was&&!(was==='bounce'&&b.v.z>0)&&LVL.type!=='field')b.state='passed'} /* field levels have no house wall at ZF: the ball is still in flight */
    if(b.state!=='inside'&&b.state!=='dead'){revPocket(b);skyHit(b,_pp);tunnelHit(b);shutTrickStep(b);hitObs(b);padHit(b);catHit(b);wheelHit(b)}
    if(b.state==='inside'&&b.pane&&!b.pane.room.hit&&b.p.distanceTo(b.pane.room.target)<.62){propSmash(b.pane,b)}
    const fl=b.floor!==undefined?b.floor:R;
    if(b.p.y<fl){if(hop&&b.floor===undefined&&isleTouch(b))continue;if(pond&&b.floor===undefined&&pondTouch(b))continue;b.p.y=fl;
      if(b.live){ /* live kick that falls short: bounce, roll on the grass, stop */
        if(b.state==='fly'){b.state='ground';b.age=0;b.a.set(0,-S.gravity,0)}
        if(b.v.y<-1.5){if(b.v.y<-3)sfx.thud();b.v.y*=-.45;b.v.x*=.85;b.v.z*=.85}
        else{b.v.y=0;const f=Math.exp(-2.2*h);b.v.x*=f;b.v.z*=f;if(Math.hypot(b.v.x,b.v.z)<.4&&b.age<1.6)b.age=1.6}}
      else{if(b.v.y<0){if(b.v.y<-3&&b.state!=='dead')sfx.thud();b.v.y*=-.48}b.v.x*=.88;b.v.z*=.88}}
    if(b.state==='dead'&&b.pane){b.p.z=clamp(b.p.z,-5.2,-.4)}
  }
  const sp=b.v.length();if(sp>.05)b.m.rotateOnWorldAxis(b.spin,sp/R*dt*.75);
  b.sh.position.x=b.p.x;b.sh.position.z=b.p.z;b.sh.material.opacity=clamp(1-b.p.y/9,.15,1);b.sh.visible=b.state!=='inside'&&b.state!=='dead'&&!b.sunk;
  if(b.state==='fly'&&Math.random()<.9)spark.emit(b.p.x,b.p.y,b.p.z,0,0,0,b.live?.42:.2,b.live?[.8,.8,.8]:[.55,.55,.55],0);
  const done=b.age>(b.state==='fly'?3:b.state==='inside'?1.6:2.2)||b.p.z<-16;
  if(done){if(b.state==='fly')b.state='gone';removeBallMesh(b);return false}
  return true;
}

/* ---------- the owner rolls the balls that went inside back out of the door, to stop at their feet ---------- */
function returnBalls(){
  for(let i=0;i<Math.min(inBalls,8);i++)later(.4+i*.28,()=>{
    const side=i%2?1:-1,m=new T.Mesh(ballGeo,ballMat);m.castShadow=true;m.position.set(side*.45,R,-.3);scene.add(m);
    returned.push({m,t:0,x0:side*.45,x1:side*(.75+(i>>1)*.62),z1:1.75+rnd(-.2,.25),s:side});sfx.thud();
  });
}
function stepReturned(dt){
  returned.forEach(r=>{if(r.t>=1)return;const t0=r.t;r.t=Math.min(1,r.t+dt/.75);
    const e=k=>1-Math.pow(1-k,3),d=e(r.t)-e(t0);
    const dx=(r.x1-r.x0)*d,dz=(r.z1+.3)*d;r.m.position.x+=dx;r.m.position.z+=dz;
    r.m.position.y=R+Math.abs(Math.sin(r.t*Math.PI*2))*.25*(1-r.t);
    r.m.rotateOnWorldAxis(new T.Vector3(dz,0,-dx).normalize(),Math.hypot(dx,dz)/R)});
}

/* ---------- main loop ---------- */
let last=performance.now();
function frame(now){
  requestAnimationFrame(frame);
  const real=Math.min(.05,(now-last)/1000);last=now;
  let dt=real;
  if(freezeT>0){freezeT-=real;dt=0}
  else if(failT>=0)dt=real*Math.max(0,1-failT/.35); /* play winds down under the overlay */
  else if(slowT>0){slowT-=real;dt=real*S.slow}
  tick(dt,real);
  renderer.render(scene,camera);
}
function tick(dt,real){
  const tl=timers; /* a timer can load a level, which replaces the list */
  for(let i=tl.length-1;i>=0&&tl===timers;i--){tl[i].t-=real;if(tl[i].t<=0){const f=tl[i].f;tl.splice(i,1);f()}}
  if(failT>=0){failT+=real;placeMissed()}
  mechTick(dt);glareTick(real);
  if(isLive()&&!cur&&!won&&ballsLeft>0&&!hopBusy()&&!balls.some(b=>b.state==='fly')){spawnWait+=real;if(spawnWait>.22){spawnWait=0;spawnBall()}}else spawnWait=0;
  if(cur){cur.born+=real;const s=clamp(cur.born/.14,0,1);cur.m.scale.setScalar(s<1?s*(1.25-.25*s):1);cur.p.y=R+(1-s)*.5}
  for(let i=balls.length-1;i>=0;i--)if(!stepBall(balls[i],dt))balls.splice(i,1);
  for(let i=shards.length-1;i>=0;i--){const s=shards[i];if(s.rest)continue;
    /* shards still in the frame ride along with a moving window (rail windows) until they drop */
    if(s.delay>0&&s.pane.x!==s.px){s.m.position.x+=s.pane.x-s.px;s.px=s.pane.x}
    if(s.delay>0){s.delay-=dt;if(s.stuck&&s.delay<.2)s.m.rotation.z=Math.sin(s.delay*70)*.03;if(s.delay<=0){if(s.stuck){sfx.tink(s.pane);s.v.set(rnd(-.6,.6),-.5,rnd(.2,2))}s.v.x+=s.pane.vx||0}continue}
    s.age+=dt;s.v.y-=23*dt;s.m.position.addScaledVector(s.v,dt);s.m.rotation.x+=s.w.x*dt;s.m.rotation.y+=s.w.y*dt;s.m.rotation.z+=s.w.z*dt;
    if(s.m.position.y<s.floor){
      if(hop&&hop.stage<2&&isleAt(s.m.position.x,s.m.position.z)<0){scene.remove(s.m);s.m.geometry.dispose();shards.splice(i,1);continue} /* landed in the water: gone */
      s.m.position.y=s.floor;
      if(s.v.y<-3.5&&s.w.lengthSq()>4){s.v.y*=-.26;s.v.x*=.5;s.v.z*=.5;s.w.multiplyScalar(.4);if(Math.random()<.05)sfx.tink(s.pane)}
      else{s.rest=true;s.m.rotation.set(-Math.PI/2+rnd(-.04,.04),rnd(-.04,.04),rnd(0,6.28));s.m.position.y=s.floor+rnd(0,.02)}
    }
  }
  for(let i=debris.length-1;i>=0;i--){const d=debris[i];if(d.rest)continue;d.v.y-=22*dt;d.m.position.addScaledVector(d.v,dt);d.m.rotation.x+=d.w.x*dt;d.m.rotation.y+=d.w.y*dt;
    const q=d.m.position;if(q.z<d.zMin){q.z=d.zMin;d.v.z*=-.4}if(q.z>d.zMax){q.z=d.zMax;d.v.z*=-.4}if(q.x<d.xMin){q.x=d.xMin;d.v.x*=-.4}if(q.x>d.xMax){q.x=d.xMax;d.v.x*=-.4}
    if(q.y<d.floor){q.y=d.floor;if(d.v.y<-2.5){d.v.y*=-.32;d.v.x*=.6;d.v.z*=.6}else d.rest=true}}
  for(let i=fxObjs.length-1;i>=0;i--){const f=fxObjs[i];f.t+=real;const k=f.t/f.d;if(k>=1){scene.remove(f.m);f.m.geometry.dispose();f.m.material.dispose();fxObjs.splice(i,1);continue}f.m.scale.setScalar(1+k*8);f.m.material.opacity=.5*(1-k)}
  stepReturned(real);
  spark.step(dt);dust.step(dt);
  clouds.forEach(c=>{c.position.x+=c.userData.s*real;if(c.position.x>110)c.position.x=-110});
  if(grumpT>=0){grumpT+=real;const k=clamp(grumpT/.28,0,1),e=1-Math.pow(1-k,3);door.rotation.y=-1.75*e;grump.position.z=lerp(-.6,1.1,e);const u=grump.userData;
    {const r=clamp(grumpT/.35,0,1),e=r*r*(3-2*r),bob=Math.sin(grumpT*5)*.05*e; /* both hands on his head, slowly shaking it: helpless */
      u.arm.rotation.z=.31*e+bob;u.arm2.rotation.z=2.83*e-bob;u.head.rotation.y=Math.sin(grumpT*4.5)*.32*e;u.head.rotation.z=-Math.sin(grumpT*4.5)*.06*e}
    const s=toScreen(0,3.5,1.1),bb=$('bubble');bb.style.left=s[0]+'px';bb.style.top=s[1]+'px'}
  stepConfetti(real);
  shakeA=Math.max(0,shakeA-real*2.6);zoomK=Math.max(0,zoomK-real*3.2);focusK=Math.max(0,focusK-real*1.5);
  const sx=(Math.random()-.5)*shakeA*.75,sy=(Math.random()-.5)*shakeA*.75,fk=focusK*focusK;
  camera.position.set(camBase.x+sx+focus.x*fk*.1,camBase.y+sy+focus.y*fk*.03+camOff.y,camBase.z-fk*1.5);
  const lx=lerp(camLook.x,focus.x,fk*.2),ly=lerp(camLook.y,focus.y,fk*.12)+camOff.y*.4;
  camera.lookAt(lx,ly,0);
  camera.zoom=1+zoomK*zoomK*.07;camera.updateProjectionMatrix();
  checkFail();
}


