'use strict';
/* ---------- swipe ---------- */
let drag=null;
const prevDots=[];
for(let i=0;i<16;i++){const m=new T.Mesh(new T.SphereGeometry(.11,10,8),new T.MeshBasicMaterial({color:0xffffff,transparent:true}));m.visible=false;scene.add(m);prevDots.push(m)}
function shotFrom(d){
  const a=d.pts[0],e=d.pts[d.pts.length-1],t=new T.Vector3();
  if(S.mode==='aim'){ndc.set(e.x/W_*2-1,1-e.y/H_*2);ray.setFromCamera(ndc,camera);if(!ray.ray.intersectPlane(plane,hitV))hitV.set(0,3,ZF);t.copy(hitV)}
  else{const u=Math.min(W_,H_);t.set((e.x-a.x)/u*26,.4+(a.y-e.y)/u*15,ZF)}
  t.x=clamp(t.x,-16,16);t.y=clamp(t.y,.35,13);t.z=ZF;
  let best=null,bd=1e9;panes.forEach(p=>{if(p.broken||p.xf||catOn(p))return;const dd=Math.hypot(t.x-p.x,t.y-p.y),r=Math.hypot(p.w,p.h)/2+1.4;if(dd<r&&dd<bd){bd=dd;best=p}});
  if(best&&S.snap>0){t.x=lerp(t.x,best.x,S.snap);t.y=lerp(t.y,best.y,S.snap)}
  let bend=0;const dx=e.x-a.x,dy=e.y-a.y,len=Math.hypot(dx,dy);
  if(len>40){let mx=0;d.pts.forEach(q=>{const c=(dx*(q.y-a.y)-dy*(q.x-a.x))/len;if(Math.abs(c)>Math.abs(mx))mx=c});const r=mx/len;if(Math.abs(r)>.07)bend=clamp(r,-.5,.5)}
  const p0=new T.Vector3(0,R,D),TT=p0.distanceTo(t)/S.speed,ax=-8*(bend*S.curve*BULGE)/(TT*TT),acc=new T.Vector3(ax,-G,0);
  const v0=t.clone().sub(p0).sub(acc.clone().multiplyScalar(.5*TT*TT)).divideScalar(TT);
  return{p0,v0,acc,T:TT,len};
}
function showPreview(s){
  const n=prevDots.length;
  prevDots.forEach((m,i)=>{const f=(i+1)/n,t=s.T*S.preview*f;m.visible=true;m.position.copy(s.p0).addScaledVector(s.v0,t).addScaledVector(s.acc,.5*t*t);const k=lerp(1.15,.55,f);m.scale.setScalar(k);m.material.opacity=lerp(.95,.08,f*f)});
}
const hidePreview=()=>prevDots.forEach(m=>m.visible=false);
function point(e){const r=canvas.getBoundingClientRect();return{x:e.clientX-r.left,y:e.clientY-r.top,t:performance.now()}}
canvas.addEventListener('pointerdown',e=>{initAudio();$('panel').hidden=true;if(won){if(performance.now()-winAt>350)advance();return}if(isLive()){liveDown(e);return}if(!cur||won||cur.born<.12)return;try{canvas.setPointerCapture(e.pointerId)}catch(x){}drag={pts:[point(e)],id:e.pointerId}});
canvas.addEventListener('pointermove',e=>{if(!drag||e.pointerId!==drag.id)return;if(isLive()){liveMove(e);return}drag.pts.push(point(e));if(drag.pts.length>120)drag.pts.splice(1,1);const s=shotFrom(drag);if(s.len>18)showPreview(s);else hidePreview()});
function release(e){initAudio();if(!drag||e.pointerId!==drag.id)return;if(isLive()){if(drag.go)firePlus(drag);drag=null;return}const d=drag;drag=null;hidePreview();const s=shotFrom(d);if(s.len<30||!cur)return;kick(s)}
canvas.addEventListener('pointerup',release);canvas.addEventListener('pointercancel',()=>{drag=null;hidePreview()});
addEventListener('touchend',initAudio,{passive:true}); /* iOS only counts a finger lifting (not going down) as permission to start audio */
/* Live swipe, modelled on the input observed in World Soccer Champions: the kick fires mid-drag, the ball flies forward on its own clock, and pointer movement steers it. */
function ballPx(){const s=toScreen(0,R,D),t=toScreen(0,R*2,D);return{x:s[0],y:s[1],r:Math.max(10,Math.abs(s[1]-t[1]))}}
function segDist(a,b,c){const dx=b.x-a.x,dy=b.y-a.y,l=dx*dx+dy*dy||1,t=clamp(((c.x-a.x)*dx+(c.y-a.y)*dy)/l,0,1);return Math.hypot(a.x+dx*t-c.x,a.y+dy*t-c.y)}
function liveDown(e){
  if(won||hopBusy())return;const pt=point(e),f=balls.find(b=>b.live&&b.state==='fly');
  if(!f&&(!cur||cur.born<.12))return;
  try{canvas.setPointerCapture(e.pointerId)}catch(x){}
  if(f){drag={id:e.pointerId,pts:[pt],last:pt,top:pt.y,steer:f};return}
  const bp=ballPx();drag={id:e.pointerId,pts:[pt],last:pt,top:pt.y,topX:pt.x,armed:Math.hypot(pt.x-bp.x,pt.y-bp.y)<=bp.r*S.grab};
}
/* Steering after the kick nudges the ball's velocity (aftertouch); the flight stays a real arc.
   Lift is budgeted per kick so a weak kick still falls short. */
function applySteer(b,dx,dy){
  if(b.p.y<=R+.02)return;
  const tr=clamp((b.p.z-ZF)/Math.max(.1,-b.v.z),.2,1.2);
  b.v.x=clamp(b.v.x+dx*gainX*S.side/tr,-30,30);
  const dv=clamp(-dy*gainHigh*S.lift/tr,-b.P-b.lift,b.P*.25-b.lift);b.lift+=dv;b.vn+=dv;
}
function liveMove(e){
  const d=drag,pt=point(e);d.pts.push(pt);if(d.pts.length>120)d.pts.splice(0,1);if(pt.y<d.top){d.top=pt.y;d.topX=pt.x}
  if(d.steer){const b=d.steer;if(b.plus){d.last=pt;return} /* Live+: no aftertouch */
    if(pt.y<b.topY)b.topY=pt.y;
    if(b.live&&b.state==='fly')applySteer(b,pt.x-d.last.x,pt.y-d.last.y);d.last=pt;return}
  if(d.go){const sp=Math.hypot(...Object.values(swipeVel(d)));d.go.pk=Math.max(d.go.pk,sp);
    if(sp<d.go.pk*.3&&pt.t-d.go.t>40)firePlus(d);d.last=pt;return}
  if(cur&&cur.born>=.12){const bp=ballPx();
    if(!d.armed&&segDist(d.last,pt,bp)<=bp.r*S.grab)d.armed=true;
    if(d.armed&&pt.y<bp.y&&Math.hypot(pt.x-bp.x,pt.y-bp.y)>=bp.r*S.ring){
      if(S.mode==='livep'){const sv=swipeVel(d);d.go={t:pt.t,pk:Math.hypot(sv.x,sv.y)};setTimeout(()=>{if(drag===d&&d.go)firePlus(d)},400)}
      else kickLive(bp,pt,d);}}
  d.last=pt;
}
/* Live+: the kick fires at the end of the flick (finger lifts, nearly stops, or 0.4 s after leaving the ring), so the
   whole swipe is known: its peak speed decides kick vs dribble, its highest point decides where the ball goes (kickPlus). */
function firePlus(d){const g=d.go;d.go=null;if(!cur||won)return;kickLive(ballPx(),{x:d.topX,y:d.top},d,g.pk)}
/* Swipe velocity in px/s over the last ~100 ms of the drag. */
function swipeVel(d){
  const p=d.pts,e=p[p.length-1];let a=e;
  for(let i=p.length-1;i>=0;i--){a=p[i];if(e.t-a.t>100)break}
  const dt=Math.max(.016,(e.t-a.t)/1000);return{x:(e.x-a.x)/dt,y:(e.y-a.y)/dt};
}
/* Live kick: swipe speed sets power, swipe direction sets heading, then gravity takes over.
   Forward speed is scaled by D/13 so flight time and arc height match on every screen shape. */
function kickLive(bp,pt,d,pk){
  const b=cur;cur=null;b.live=true;b.state='fly';b.age=0;
  const sv=swipeVel(d),spd=(pk===undefined?Math.hypot(sv.x,sv.y):pk)/Math.min(W_,H_);
  let P=clamp(6+spd*S.power,6,32);
  const plus=S.mode==='livep';
  if(plus){kickPlus(b,bp,pt,spd);balls.push(b);d.steer=b;kickFx();return}
  let dx=sv.x,dy=sv.y;if(plus||spd<.2||dy>-1){dx=pt.x-bp.x;dy=pt.y-bp.y}
  const rowY=toScreen(0,2.8,ZF)[1],k=(bp.y-rowY)/Math.max(1,-dy);
  let xw=0;ndc.set((bp.x+dx*k)/W_*2-1,1-rowY/H_*2);ray.setFromCamera(ndc,camera);if(ray.ray.intersectPlane(plane,hitV))xw=clamp(hitV.x,-16,16);
  b.P=P;b.lift=0;b.plus=false;b.vn=P*S.loft;b.baseY=bp.y;b.topY=Math.min(d.top,pt.y+Math.min(0,sv.y)*.08);
  b.v.set(xw*P/13,b.vn,-P*D/13);b.a.set(0,-S.gravity,0);
  balls.push(b);d.steer=b;kickFx();
}
function kickFx(){
  ballsLeft--;used++;drawBalls();sfx.kick();
  for(let i=0;i<14;i++)dust.emit(rnd(-.3,.3),.1,D+rnd(-.2,.2),rnd(-1.8,1.8),rnd(.6,2.2),rnd(-.5,1.5),rnd(.25,.5),[.72,.6,.42],3);
  addShake(.1);if(!hintDone){hintDone=true;updateHint()}
}
/* Live+: the launch is solved once, at the kick, then the ball is left to plain gravity and drag (no steering, no ceiling).
   Aim point = the swipe's highest point (× reachP from the ball) on screen; its depth is whatever the level shows there
   (first visible level mesh on that ray), else the house wall plane. The arc peaks about arcP m above that point,
   capped at pMax m/s, so high windows get a lob and low ones a drive. A slow push is a short dribble toward it. */
const _aim=new T.Vector3();
function seen(o){for(;o;o=o.parent)if(!o.visible)return false;return true}
function kickPlus(b,bp,pt,spd){
  const ax=bp.x+(pt.x-bp.x)*S.reachP,ay=bp.y+(pt.y-bp.y)*S.reachP;
  ndc.set(ax/W_*2-1,1-ay/H_*2);ray.setFromCamera(ndc,camera);
  const hit=group&&ray.intersectObject(group,true).find(h=>h.point.z<b.p.z-1.5&&seen(h.object));
  if(hit)_aim.copy(hit.point);else if(!ray.ray.intersectPlane(plane,_aim))_aim.set(0,3,ZF);
  _aim.y=Math.max(_aim.y,R+.1);
  const g=S.gravity,dx=_aim.x-b.p.x,dz=b.p.z-_aim.z,h=Math.max(.5,Math.hypot(dx,dz)),dy=_aim.y-b.p.y;
  b.plus=true;b.live=true;b.lift=0;b.a.set(0,-g,0);
  if(spd<S.flick){const P=clamp(6+spd*S.power,6,12);b.P=P;b.vn=P*.3;b.v.set(dx/h*P,b.vn,-dz/h*P);return}
  const t=Math.max(Math.sqrt(2*Math.max(dy+S.arcP,.4)/g),h/S.pMax);
  let vh=h/t,vy=(dy+.5*g*t*t)/t;
  const k=1+.004*Math.hypot(vh,vy)*t*.5;vh*=k;vy*=k; /* rough make-up for air drag */
  b.P=Math.hypot(vh,vy);b.vn=vy;b.v.set(dx/h*vh,vy,-dz/h*vh);
}
/* Screen-space ceiling: the ball may rise S.reach times as high as the finger went, measured on screen
   up from the ball's resting spot (one fixed scale for every level). A fast upward flick carries the
   finger's top on by ~0.08 s at kick time. Returns the world height at the ball's distance that projects there. */
const ceilPlane=new T.Plane(new T.Vector3(0,0,1),0);
function ceilingY(b){
  const sx=toScreen(b.p.x,b.p.y,b.p.z)[0];ceilPlane.constant=-b.p.z;
  if(b.plus)return null;
  const ty=b.baseY-(b.baseY-b.topY)*S.reach;ndc.set(sx/W_*2-1,1-ty/H_*2);ray.setFromCamera(ndc,camera);
  return ray.ray.intersectPlane(ceilPlane,hitV)?hitV.y:null;
}
/* Per-frame forces for a live ball. b.vn is the free (uncapped) vertical speed under gravity;
   the actual vertical speed is capped so the ball decelerates exactly as gravity would and
   peaks at the finger's height. If the finger rises later, the ball can keep climbing on vn. */
function flyLive(b,dt){
  const v=b.v,sp=v.length(),c=.004,g=S.gravity;
  /* Aim help: predict where the arc meets each window's plane (moving windows are led by their speed)
     and nudge toward the nearest one. */
  if(S.snap>0&&b.p.z<D*.6&&v.z<-.5&&b.p.y>R+.02){
    let best=null,bd=1e9,bt=0,bx=0,by=0;
    aimTargets().forEach(p=>{const tr=(b.p.z-p.z)/-v.z;if(tr<.02)return;
      const py=b.p.y+b.vn*tr-.5*g*tr*tr,px=b.p.x+v.x*tr;if(py<R+.2)return;
      const tx=p.x+p.vx*tr,ty=p.y,q=Math.hypot(px-tx,py-ty);
      if(q<Math.hypot(p.w,p.h)/2+1.3&&q<bd){bd=q;best=p;bt=tr;bx=tx-px;by=ty-py}});
    if(best){const k=1-Math.exp(-S.snap*7*dt),t=Math.max(bt,.1);if(!wind)v.x+=bx*k/t;b.vn+=by*k/t}}
  const yMax=ceilingY(b),gap=yMax===null?1e9:yMax-b.p.y;
  v.y=Math.min(b.vn,gap>0?Math.sqrt(2*g*gap):0);
  /* At the ceiling, drop the leftover climb so the ball peaks there and falls at once (no flat hover).
     Below the ceiling vn is kept, so a finger that is still rising can still lift the ball. */
  if(gap<.05)b.vn=Math.min(b.vn,v.y);
  b.vn-=g*dt;
  b.a.set(-c*sp*v.x,-g,-c*sp*v.z);
  b.spin.set(0,1,0).cross(v).normalize();
}
function kick(s){
  const b=cur;cur=null;b.state='fly';b.v.copy(s.v0);b.a.copy(s.acc);b.spin.set(0,1,0).cross(b.v).normalize();b.age=0;balls.push(b);
  ballsLeft--;used++;drawBalls();sfx.kick();
  for(let i=0;i<14;i++)dust.emit(rnd(-.3,.3),.1,D+rnd(-.2,.2),rnd(-1.8,1.8),rnd(.6,2.2),rnd(-.5,1.5),rnd(.25,.5),[.72,.6,.42],3);
  addShake(.1);
  if(!hintDone){hintDone=true;updateHint()}
  later(.26,spawnBall);
}


