'use strict';
function checkWin(){
  if(won||sandbox||panes.some(p=>!p.broken))return;won=true;$('hint').hidden=true;
  if(drag){drag=null;hidePreview()}
  const house=LVL.type==='house';
  if(house)later(.75,()=>{grumpT=0;grump.visible=true;sfx.hey();$('bubble').hidden=false});
  later(house?2.1:1.15,showCard);
}
function showCard(){
  const n=panes.length,st=used<=n?3:used===n+1?2:1;
  $('cardTitle').textContent=st===3?'Perfect smash!':'Smashed!';
  $('stars').innerHTML='<b>'+'★'.repeat(st)+'</b>'+'★'.repeat(3-st);
  $('cardText').textContent=n+(n>1?' windows':' window')+' with '+used+(used>1?' balls':' ball');
  $('next').textContent=level===LV.length-1?'Play again':'Next';
  $('card').hidden=false;
}
let failing=false,spawnWait=0;
function checkFail(){
  if(won||failing||ballsLeft>0||cur)return;
  if(balls.some(b=>b.state==='fly'||b.state==='inside'))return;
  if(!panes.some(p=>!p.broken))return;
  failing=true;const t=$('toast');t.textContent='Out of balls';t.hidden=false;
  later(.95,()=>{failing=false;loadLevel(level)});
}


/* ---------- ball step ---------- */
function wallHit(b,kind){
  b.p.z=ZF+R*.5;b.v.z*=-.42;b.v.x*=.55;b.v.y*=.55;b.a.x=0;b.state='bounce';b.age=Math.min(b.age,.3);
  for(let i=0;i<20;i++)dust.emit(b.p.x,b.p.y,.3,rnd(-2.2,2.2),rnd(-1,2.4),rnd(0,2.2),rnd(.25,.55),[.92,.76,.56],2);
  addShake(.16);if(kind==='clang')sfx.clang();else sfx.thud();
  if(Math.random()<.5)pop(kind==='clang'?'CLANG':'BONK',b.p.x,b.p.y+.5,0,true);
}
function crossPlane(b){
  if(b.live){b.live=false;b.a.set(0,-S.gravity,0)}
  const x=b.p.x,y=b.p.y;
  for(const p of panes){if(Math.abs(x-p.x)<=p.w/2+.06&&Math.abs(y-p.y)<=p.h/2+.06){
    if(!p.broken){smash(p,b);return}
    if(p.room){b.state='dead';b.a.set(0,-G,0);b.floor=p.room.floor+R;b.pane=p;b.age=0}else b.state='passed';
    return}}
  if(LVL.type==='sandbox')return;
  if(LVL.type==='stand'){const p=panes[0],f=.3;
    if(Math.abs(x-p.x)<=p.w/2+f&&Math.abs(y-p.y)<=p.h/2+f){wallHit(b,'clang');return}
    if(Math.abs(Math.abs(x-p.x)-(p.w/2+.1))<.26&&y<p.y){wallHit(b,'clang');return}
    return}
  const W=LVL.W,H=LVL.H,Gb=LVL.G,top=Math.abs(x)<=W?H+Gb*(1-Math.abs(x)/W):-1;
  if(Math.abs(x)<=W&&y<=top+.1)wallHit(b,'thud');
}
function stepBall(b,dt){
  b.age+=dt;if(b.live&&b.state==='fly')flyLive(b,dt);const sub=4,h=dt/sub;
  for(let i=0;i<sub;i++){
    const z0=b.p.z;b.v.addScaledVector(b.a,h);b.p.addScaledVector(b.v,h);
    if((b.state==='fly'||b.state==='ground')&&z0>ZF&&b.p.z<=ZF){crossPlane(b);if(b.state==='fly'||b.state==='ground'){b.state='passed'}}
    if(b.state==='inside'&&b.pane&&!b.pane.room.hit&&b.p.distanceTo(b.pane.room.target)<.62){propSmash(b.pane,b)}
    const fl=b.floor!==undefined?b.floor:R;
    if(b.p.y<fl){b.p.y=fl;
      if(b.live){ /* live kick that falls short: bounce, roll on the grass, stop */
        if(b.state==='fly'){b.state='ground';b.age=0;b.a.set(0,-S.gravity,0)}
        if(b.v.y<-1.5){if(b.v.y<-3)sfx.thud();b.v.y*=-.45;b.v.x*=.85;b.v.z*=.85}
        else{b.v.y=0;const f=Math.exp(-2.2*h);b.v.x*=f;b.v.z*=f;if(Math.hypot(b.v.x,b.v.z)<.4&&b.age<1.6)b.age=1.6}}
      else{if(b.v.y<0){if(b.v.y<-3&&b.state!=='dead')sfx.thud();b.v.y*=-.48}b.v.x*=.88;b.v.z*=.88}}
    if(b.state==='dead'&&b.pane){b.p.z=clamp(b.p.z,-5.2,-.4)}
  }
  const sp=b.v.length();if(sp>.05)b.m.rotateOnWorldAxis(b.spin,sp/R*dt*.75);
  b.sh.position.x=b.p.x;b.sh.position.z=b.p.z;b.sh.material.opacity=clamp(1-b.p.y/9,.15,1);b.sh.visible=b.state!=='inside'&&b.state!=='dead';
  if(b.state==='fly'&&Math.random()<.9)spark.emit(b.p.x,b.p.y,b.p.z,0,0,0,b.live?.42:.2,b.live?[.8,.8,.8]:[.55,.55,.55],0);
  const done=b.age>(b.state==='fly'?3:b.state==='inside'?1.6:2.2)||b.p.z<-16;
  if(done){if(b.state==='fly')b.state='gone';removeBallMesh(b);return false}
  return true;
}

/* ---------- main loop ---------- */
let last=performance.now();
function frame(now){
  requestAnimationFrame(frame);
  const real=Math.min(.05,(now-last)/1000);last=now;
  let dt=real;
  if(freezeT>0){freezeT-=real;dt=0}
  else if(slowT>0){slowT-=real;dt=real*S.slow}
  tick(dt,real);
  renderer.render(scene,camera);
}
function tick(dt,real){
  for(let i=timers.length-1;i>=0;i--){timers[i].t-=real;if(timers[i].t<=0){const f=timers[i].f;timers.splice(i,1);f()}}
  if(S.mode==='live'&&!cur&&!won&&ballsLeft>0&&!balls.some(b=>b.state==='fly')){spawnWait+=real;if(spawnWait>.22){spawnWait=0;spawnBall()}}else spawnWait=0;
  if(cur){cur.born+=real;const s=clamp(cur.born/.14,0,1);cur.m.scale.setScalar(s<1?s*(1.25-.25*s):1);cur.p.y=R+(1-s)*.5}
  for(let i=balls.length-1;i>=0;i--)if(!stepBall(balls[i],dt))balls.splice(i,1);
  for(let i=shards.length-1;i>=0;i--){const s=shards[i];if(s.rest)continue;
    if(s.delay>0){s.delay-=dt;if(s.stuck&&s.delay<.2)s.m.rotation.z=Math.sin(s.delay*70)*.03;if(s.delay<=0&&s.stuck){sfx.tink();s.v.set(rnd(-.6,.6),-.5,rnd(.2,2));}continue}
    s.age+=dt;s.v.y-=23*dt;s.m.position.addScaledVector(s.v,dt);s.m.rotation.x+=s.w.x*dt;s.m.rotation.y+=s.w.y*dt;s.m.rotation.z+=s.w.z*dt;
    if(s.m.position.y<s.floor){
      s.m.position.y=s.floor;
      if(s.v.y<-3.5&&s.w.lengthSq()>4){s.v.y*=-.26;s.v.x*=.5;s.v.z*=.5;s.w.multiplyScalar(.4);if(Math.random()<.05)sfx.tink()}
      else{s.rest=true;s.m.rotation.set(-Math.PI/2+rnd(-.04,.04),rnd(-.04,.04),rnd(0,6.28));s.m.position.y=s.floor+rnd(0,.02)}
    }
  }
  for(let i=debris.length-1;i>=0;i--){const d=debris[i];if(d.rest)continue;d.v.y-=22*dt;d.m.position.addScaledVector(d.v,dt);d.m.rotation.x+=d.w.x*dt;d.m.rotation.y+=d.w.y*dt;
    const q=d.m.position;if(q.z<d.zMin){q.z=d.zMin;d.v.z*=-.4}if(q.z>d.zMax){q.z=d.zMax;d.v.z*=-.4}if(q.x<d.xMin){q.x=d.xMin;d.v.x*=-.4}if(q.x>d.xMax){q.x=d.xMax;d.v.x*=-.4}
    if(q.y<d.floor){q.y=d.floor;if(d.v.y<-2.5){d.v.y*=-.32;d.v.x*=.6;d.v.z*=.6}else d.rest=true}}
  for(let i=fxObjs.length-1;i>=0;i--){const f=fxObjs[i];f.t+=real;const k=f.t/f.d;if(k>=1){scene.remove(f.m);f.m.geometry.dispose();f.m.material.dispose();fxObjs.splice(i,1);continue}f.m.scale.setScalar(1+k*8);f.m.material.opacity=.5*(1-k)}
  spark.step(dt);dust.step(dt);
  clouds.forEach(c=>{c.position.x+=c.userData.s*real;if(c.position.x>110)c.position.x=-110});
  if(grumpT>=0){grumpT+=real;const k=clamp(grumpT/.28,0,1),e=1-Math.pow(1-k,3);door.rotation.y=-1.75*e;grump.position.z=lerp(-.6,1.1,e);grump.rotation.z=Math.sin(grumpT*22)*.05;grump.userData.arm.rotation.z=-.25+Math.sin(grumpT*28)*.38;
    const s=toScreen(0,3.5,1.1),bb=$('bubble');bb.style.left=s[0]+'px';bb.style.top=s[1]+'px'}
  shakeA=Math.max(0,shakeA-real*2.6);zoomK=Math.max(0,zoomK-real*3.2);focusK=Math.max(0,focusK-real*1.5);
  const sx=(Math.random()-.5)*shakeA*.75,sy=(Math.random()-.5)*shakeA*.75,fk=focusK*focusK;
  camera.position.set(camBase.x+sx+focus.x*fk*.1,camBase.y+sy+focus.y*fk*.03,camBase.z-fk*1.5);
  const lx=lerp(camLook.x,focus.x,fk*.2),ly=lerp(camLook.y,focus.y,fk*.12);
  camera.lookAt(lx,ly,0);
  camera.zoom=1+zoomK*zoomK*.07;camera.updateProjectionMatrix();
  checkFail();
}


