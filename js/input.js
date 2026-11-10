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
  let best=null,bd=1e9;panes.forEach(p=>{if(p.broken||p.sky)return;const dd=Math.hypot(t.x-p.x,t.y-p.y),r=Math.hypot(p.w,p.h)/2+1.4;if(dd<r&&dd<bd){bd=dd;best=p}});
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
canvas.addEventListener('pointerdown',e=>{initAudio();$('panel').hidden=true;if(S.mode==='live'){liveDown(e);return}if(!cur||won||cur.born<.12)return;try{canvas.setPointerCapture(e.pointerId)}catch(x){}drag={pts:[point(e)],id:e.pointerId}});
canvas.addEventListener('pointermove',e=>{if(!drag||e.pointerId!==drag.id)return;if(S.mode==='live'){liveMove(e);return}drag.pts.push(point(e));if(drag.pts.length>120)drag.pts.splice(1,1);const s=shotFrom(drag);if(s.len>18)showPreview(s);else hidePreview()});
function release(e){if(!drag||e.pointerId!==drag.id)return;if(S.mode==='live'){drag=null;return}const d=drag;drag=null;hidePreview();const s=shotFrom(d);if(s.len<30||!cur)return;kick(s)}
canvas.addEventListener('pointerup',release);canvas.addEventListener('pointercancel',()=>{drag=null;hidePreview()});
/* Live swipe, modelled on the input observed in World Soccer Champions: the kick fires mid-drag, the ball flies forward on its own clock, and pointer movement steers it. */
function ballPx(){const s=toScreen(0,R,D),t=toScreen(0,R*2,D);return{x:s[0],y:s[1],r:Math.max(10,Math.abs(s[1]-t[1]))}}
function segDist(a,b,c){const dx=b.x-a.x,dy=b.y-a.y,l=dx*dx+dy*dy||1,t=clamp(((c.x-a.x)*dx+(c.y-a.y)*dy)/l,0,1);return Math.hypot(a.x+dx*t-c.x,a.y+dy*t-c.y)}
function liveDown(e){
  if(won)return;const pt=point(e),f=balls.find(b=>b.live&&b.state==='fly');
  if(!f&&(!cur||cur.born<.12))return;
  try{canvas.setPointerCapture(e.pointerId)}catch(x){}
  if(f){drag={id:e.pointerId,pts:[pt],last:pt,top:pt.y,steer:f};return}
  const bp=ballPx();drag={id:e.pointerId,pts:[pt],last:pt,top:pt.y,armed:Math.hypot(pt.x-bp.x,pt.y-bp.y)<=bp.r*S.grab};
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
  const d=drag,pt=point(e);d.pts.push(pt);if(d.pts.length>120)d.pts.splice(0,1);d.top=Math.min(d.top,pt.y);
  if(d.steer)d.steer.topY=Math.min(d.steer.topY,pt.y);
  if(d.steer){if(d.steer.live&&d.steer.state==='fly')applySteer(d.steer,pt.x-d.last.x,pt.y-d.last.y);d.last=pt;return}
  if(cur&&cur.born>=.12){const bp=ballPx();
    if(!d.armed&&segDist(d.last,pt,bp)<=bp.r*S.grab)d.armed=true;
    if(d.armed&&pt.y<bp.y&&Math.hypot(pt.x-bp.x,pt.y-bp.y)>=bp.r*S.ring)kickLive(bp,pt,d);}
  d.last=pt;
}
/* Swipe velocity in px/s over the last ~100 ms of the drag. */
function swipeVel(d){
  const p=d.pts,e=p[p.length-1];let a=e;
  for(let i=p.length-1;i>=0;i--){a=p[i];if(e.t-a.t>100)break}
  const dt=Math.max(.016,(e.t-a.t)/1000);return{x:(e.x-a.x)/dt,y:(e.y-a.y)/dt};
}
/* Live kick: swipe speed sets power, swipe direction sets heading, then gravity takes over.
   Forward speed is scaled by D/13 so flight time and arc height match on every screen shape. */
function kickLive(bp,pt,d){
  const b=cur;cur=null;b.live=true;b.state='fly';b.age=0;
  const sv=swipeVel(d),spd=Math.hypot(sv.x,sv.y)/Math.min(W_,H_);
  const P=clamp(6+spd*S.power,6,32);
  let dx=sv.x,dy=sv.y;if(spd<.2||dy>-1){dx=pt.x-bp.x;dy=pt.y-bp.y}
  const rowY=toScreen(0,2.8,ZF)[1],k=(bp.y-rowY)/Math.max(1,-dy);
  let xw=0;ndc.set((bp.x+dx*k)/W_*2-1,1-rowY/H_*2);ray.setFromCamera(ndc,camera);if(ray.ray.intersectPlane(plane,hitV))xw=clamp(hitV.x,-16,16);
  b.P=P;b.lift=0;b.vn=P*S.loft;b.topY=d.top;b.v.set(xw*P/13,b.vn,-P*D/13);b.a.set(0,-S.gravity,0);
  balls.push(b);d.steer=b;
  ballsLeft--;used++;drawBalls();sfx.kick();
  for(let i=0;i<14;i++)dust.emit(rnd(-.3,.3),.1,D+rnd(-.2,.2),rnd(-1.8,1.8),rnd(.6,2.2),rnd(-.5,1.5),rnd(.25,.5),[.72,.6,.42],3);
  addShake(.1);if(!hintDone){hintDone=true;updateHint()}
}
/* Screen-space ceiling: the ball should not show above the highest point the finger reached.
   Returns the world height at the ball's distance that projects to that screen height. */
const ceilPlane=new T.Plane(new T.Vector3(0,0,1),0);
function ceilingY(b){
  const sx=toScreen(b.p.x,b.p.y,b.p.z)[0];ceilPlane.constant=-b.p.z;
  ndc.set(sx/W_*2-1,1-b.topY/H_*2);ray.setFromCamera(ndc,camera);
  return ray.ray.intersectPlane(ceilPlane,hitV)?hitV.y:null;
}
/* Per-frame forces for a live ball. b.vn is the free (uncapped) vertical speed under gravity;
   the actual vertical speed is capped so the ball decelerates exactly as gravity would and
   peaks at the finger's height. If the finger rises later, the ball can keep climbing on vn. */
function flyLive(b,dt){
  const v=b.v,sp=v.length(),c=.004,g=S.gravity;
  if(S.snap>0&&b.p.z<D*.6&&v.z<-.5&&b.p.y>R+.02){
    const tr=(b.p.z-ZF)/-v.z,py=b.p.y+b.vn*tr-.5*g*tr*tr,px=b.p.x+v.x*tr;
    if(py>R+.2){let best=null,bd=1e9;panes.forEach(p=>{if(p.broken||p.sky)return;const q=Math.hypot(px-p.x,py-p.y);if(q<Math.hypot(p.w,p.h)/2+1.3&&q<bd){bd=q;best=p}});
      if(best){const k=1-Math.exp(-S.snap*7*dt),t=Math.max(tr,.1);if(!wind)v.x+=(best.x-px)*k/t;b.vn+=(best.y-py)*k/t}}}
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


