'use strict';
/* ---------- level mechanics ----------
   Solid obstacles (oriented boxes the ball bounces off), movers (per-frame animation),
   shutters, wooden boards, wired glass, the porch skylight and wind. */
let obs=[],movers=[],lt=0,wind=0;
const _lp=new T.Vector3(),_n=new T.Vector3(),_rv=new T.Vector3(),_wp=new T.Vector3();

/* Bounce per material: e = restitution along the normal, f = friction kept along the surface. */
const OBK={wood:{e:.45,f:.75,snd:'wood'},roof:{e:.3,f:.82,snd:'thud'},wall:{e:.35,f:.7,snd:'thud'},metal:{e:.5,f:.8,snd:'clang'},hedge:{e:.1,f:.3,snd:'rustle'}};
/* Register a box() mesh as a solid. Meshes used as solids must not be scaled. */
function addOb(m,kind){const g=m.geometry.parameters;obs.push({m,kind,h:new T.Vector3(g.width/2,g.height/2,g.depth/2),inv:new T.Matrix4(),q:new T.Quaternion(),vel:new T.Vector3(),last:null});return m}
function updateObs(dt){
  if(group)group.updateMatrixWorld(true);
  obs.forEach(o=>{o.m.getWorldPosition(_wp);
    if(o.last){if(dt>0)o.vel.copy(_wp).sub(o.last).divideScalar(dt)}else o.last=new T.Vector3();
    o.last.copy(_wp);o.inv.copy(o.m.matrixWorld).invert();o.m.getWorldQuaternion(o.q)});
}
function mechTick(dt){lt+=dt;movers.forEach(f=>f(lt,dt));updateObs(dt)}

/* Sphere vs oriented box, in the box's local frame. Moving solids hand their velocity to the ball. */
function hitObs(b){
  if(b.ghost)return;
  for(const o of obs){
    _lp.copy(b.p).applyMatrix4(o.inv);const h=o.h;
    let nx=_lp.x-clamp(_lp.x,-h.x,h.x),ny=_lp.y-clamp(_lp.y,-h.y,h.y),nz=_lp.z-clamp(_lp.z,-h.z,h.z),d=Math.hypot(nx,ny,nz);
    if(d>=R)continue;
    if(d<1e-4){const px=h.x-Math.abs(_lp.x),py=h.y-Math.abs(_lp.y),pz=h.z-Math.abs(_lp.z);
      if(px<py&&px<pz){_n.set(Math.sign(_lp.x)||1,0,0);d=-px}else if(py<pz){_n.set(0,Math.sign(_lp.y)||1,0);d=-py}else{_n.set(0,0,Math.sign(_lp.z)||1);d=-pz}}
    else _n.set(nx/d,ny/d,nz/d);
    _n.applyQuaternion(o.q);b.p.addScaledVector(_n,R-d+.004);
    _rv.copy(b.v).sub(o.vel);const vn=_rv.dot(_n);
    if(vn<0){const k=OBK[o.kind];_rv.addScaledVector(_n,-vn).multiplyScalar(k.f).addScaledVector(_n,-vn*k.e);b.v.copy(_rv).add(o.vel);obHit(b,o,-vn)}
  }
}
function obHit(b,o,imp){
  if(b.live){b.live=false}
  b.a.set(0,-S.gravity,0);
  if(b.state==='fly'||b.state==='ground'){b.state='bounce';b.age=Math.min(b.age,.4)}
  if(imp<2.5)return;
  const k=OBK[o.kind];sfx[k.snd]();addShake(Math.min(.25,imp*.012));
  if(o.kind==='hedge'){for(let i=0;i<26;i++)dust.emit(b.p.x,b.p.y,b.p.z,rnd(-2.5,2.5),rnd(-.5,3),rnd(-1,2.5),rnd(.4,.9),Math.random()<.5?[.3,.6,.25]:[.45,.75,.3],5);if(imp>6)pop('RUSTLE',b.p.x,b.p.y+.6,b.p.z,true)}
  else{for(let i=0;i<12;i++)dust.emit(b.p.x,b.p.y,b.p.z,rnd(-2,2),rnd(-1,2.4),rnd(0,2),rnd(.25,.5),[.92,.8,.6],2);if(imp>8&&Math.random()<.6)pop(o.kind==='metal'?'CLANG':'BONK',b.p.x,b.p.y+.5,b.p.z,true)}
}

/* Build every mechanic a level lists. Runs after buildHouse/buildStand. */
function buildMech(L){
  panes.forEach(p=>{if(p.shutter)buildShutter(p);if(p.armor)buildBoards(p);if(p.hp>1)buildWired(p)});
  if(L.board)buildBoard(L.board);
  (L.hedges||[]).forEach(buildHedge);
  if(L.porch)buildPorch();
  if(wind)buildWind();
  updateObs(0);
}

/* ---------- roller shutter: rolls down over the glass and back up on a loop ---------- */
const SH_T=4.2;
function shutAmt(t,ph){const u=((t/SH_T+ph)%1+1)%1;let f=u<.4?0:u<.48?(u-.4)/.08:u<.92?1:1-(u-.92)/.08;return f*f*(3-2*f)}
function buildShutter(p){
  const top=p.y+p.h/2,bh=.26,n=Math.ceil(p.h/bh)+1,bars=[];
  for(let j=0;j<n;j++){const m=box(p.w+.12,bh*.95,.07,j%2?0x9aa6b8:0x8793a6,p.x,top,.3,group,false);m.visible=false;bars.push(m)}
  const hous=box(p.w+.5,.46,.56,0x5f6b80,p.x,top+.2,.36,group);
  p.shutF=0;p.shutY=top;
  movers.push(t=>{if(p.broken){hous.visible=false;bars.forEach(m=>m.visible=false);p.shutF=0;return}
    const f=shutAmt(t,p.shutter.phase),yb=top-f*p.h;p.shutF=f;p.shutY=yb;
    bars.forEach((m,j)=>{const cy=yb+(j+.5)*bh;m.position.y=cy;m.visible=f>.003&&cy-bh/2<top})});
}

/* ---------- wooden boards nailed over a window: one kick breaks them, the next breaks the glass ---------- */
function buildBoards(p){
  const bg=new T.Group();bg.position.set(p.x,p.y,.44);group.add(bg);p.boards=bg;p.planks=[];
  const n=Math.max(3,Math.round(p.h/.56)),sp=p.h/n;
  for(let i=0;i<n;i++){const y=-p.h/2+sp*(i+.5),c=i%2?0x9a663a:0xb07a46,m=box(p.w+.6,sp*.9,.1,c,0,y,0,bg);m.rotation.z=(i%2?-1:1)*.045;p.planks.push({y,c,w:p.w+.6,h:sp*.9});
    [-1,1].forEach(s=>box(.09,.09,.04,0x3a3a44,s*(p.w/2+.05),y,.07,bg,false))}
}
function breakBoards(p,b){
  p.armor--;p.boards.visible=false;
  p.planks.forEach(k=>[-1,1].forEach(s=>{const m=new T.Mesh(sharedDebris,mat(k.c));m.scale.set(k.w/2,k.h,.1);m.position.set(p.x+s*k.w/4,p.y+k.y,.5);scene.add(m);
    debris.push({m,v:new T.Vector3(s*rnd(1.5,4.5),rnd(2,6),rnd(2.5,7)),w:new T.Vector3(rnd(-8,8),rnd(-8,8),rnd(-8,8)),floor:.06,zMin:.4,zMax:40,xMin:-40,xMax:40,age:0,rest:false})}));
  for(let i=0;i<40;i++)dust.emit(b.p.x,b.p.y,.5,rnd(-4,4),rnd(-2,5),rnd(0,5),rnd(.3,.7),[.75,.55,.32],7);
  sfx.wood();addShake(.4);freezeT=.05;
}

/* ---------- wired glass: needs two kicks; the first leaves cracks ---------- */
const wireTex=canvasTex(128,128,(g,w,h)=>{g.strokeStyle='rgba(70,90,110,.55)';g.lineWidth=2;for(let i=-4;i<8;i++){g.beginPath();g.moveTo(i*32,0);g.lineTo(i*32+h,h);g.stroke();g.beginPath();g.moveTo(i*32+h,0);g.lineTo(i*32,h);g.stroke()}});
wireTex.wrapS=wireTex.wrapT=T.RepeatWrapping;
function buildWired(p){
  const t=wireTex.clone();t.needsUpdate=true;t.repeat.set(p.w/.9,p.h/.9);
  const wm=new T.Mesh(new T.PlaneGeometry(p.w,p.h),new T.MeshBasicMaterial({map:t,transparent:true,depthWrite:false}));wm.position.set(p.x,p.y,.015);wm.renderOrder=4;group.add(wm);
  const c=document.createElement('canvas');c.width=256;c.height=Math.round(256*p.h/p.w);const ct=new T.CanvasTexture(c);
  const cm=new T.Mesh(new T.PlaneGeometry(p.w,p.h),new T.MeshBasicMaterial({map:ct,transparent:true,depthWrite:false}));cm.position.set(p.x,p.y,.03);cm.renderOrder=5;group.add(cm);
  p.extra=[wm,cm];p.crackCv=c;p.crackTex=ct;
}
function crackPane(p,b){
  p.hp--;const c=p.crackCv,g=c.getContext('2d'),k=c.width/p.w;
  const lx=(clamp(b.p.x-p.x,-p.w/2,p.w/2)+p.w/2)*k,ly=(p.h/2-clamp(b.p.y-p.y,-p.h/2,p.h/2))*k,lines=[];
  for(let i=0;i<12;i++){const a=i/12*Math.PI*2+rnd(-.2,.2),L=rnd(70,190);let x=lx,y=ly;const pts=[[x,y]];for(let s=0;s<6;s++){const ang=a+rnd(-.4,.4);x+=Math.cos(ang)*L/6;y+=Math.sin(ang)*L/6;pts.push([x,y])}lines.push(pts)}
  const rings=[1,3].map(r=>lines.map(l=>l[r]));
  const stroke=(col,wd)=>{g.strokeStyle=col;g.lineWidth=wd;g.lineCap=g.lineJoin='round';lines.forEach(l=>{g.beginPath();l.forEach((q,i)=>i?g.lineTo(q[0],q[1]):g.moveTo(q[0],q[1]));g.stroke()});
    rings.forEach(r=>{g.beginPath();r.forEach((q,i)=>i?g.lineTo(q[0]+rnd(-3,3),q[1]+rnd(-3,3)):g.moveTo(q[0],q[1]));g.closePath();g.stroke()})};
  stroke('rgba(35,48,74,.45)',4.5);stroke('rgba(255,255,255,.95)',2);
  p.crackTex.needsUpdate=true;
  for(let i=0;i<30;i++)spark.emit(b.p.x,b.p.y,.2,rnd(-4,4),rnd(-3,5),rnd(0,5),rnd(.15,.45),[.85,.95,1],8);
  sfx.crack();addShake(.32);freezeT=.05;
}

/* ---------- sliding board: a wooden barrier on a ground rail, sliding across the windows ---------- */
const boardTex=canvasTex(256,192,(g,w,h)=>{g.fillStyle='#c58a52';g.fillRect(0,0,w,h);g.fillStyle='#9a6438';for(let i=1;i<8;i++)g.fillRect(i*w/8-1,0,3,h);
  g.fillStyle='rgba(255,255,255,.07)';for(let i=0;i<8;i++)g.fillRect(i*w/8+6,0,8,h);
  for(let i=-2;i<18;i++){g.fillStyle=i%2?'#23304a':'#ffc53a';g.beginPath();g.moveTo(i*16,0);g.lineTo(i*16+16,0);g.lineTo(i*16+36,20);g.lineTo(i*16+20,20);g.closePath();g.fill()}
  g.fillStyle='#23304a';g.fillRect(0,20,w,3)});
function buildBoard(o){
  const bw=o.w||3.2;box(o.amp*2+bw+1.2,.08,.36,0x8d8577,0,.04,o.z,group,false);
  const bd=new T.Group();bd.position.set(0,0,o.z);group.add(bd);
  addOb(box(bw,4.2,.26,new T.MeshLambertMaterial({map:boardTex}),0,2.55,0,bd),'wood');
  addOb(box(bw+.2,.24,.7,0x6b4a2c,0,.46,0,bd),'wood');
  const wg=new T.CylinderGeometry(.3,.3,.16,14);[-bw*.38,bw*.38].forEach(x=>[-1,1].forEach(s=>{const w=new T.Mesh(wg,mat(0x2b2230));w.rotation.x=Math.PI/2;w.position.set(x,.3,s*.4);w.castShadow=true;bd.add(w)}));
  movers.push(t=>{bd.position.x=o.amp*Math.sin(t*o.speed)});
}

/* ---------- hedge: soft, the ball sinks in and drops ---------- */
function buildHedge(hd){
  addOb(box(hd.w,hd.h+.25,1.3,0x3f8f3e,hd.x,(hd.h+.25)/2,hd.z,group),'hedge');
  const n=Math.max(3,Math.round(hd.w/.62)),ico=new T.IcosahedronGeometry(1,1);
  for(let i=0;i<n;i++){const m=new T.Mesh(ico,mat(i%2?0x4fa04a:0x3f8f3e));m.scale.setScalar(rnd(.48,.62));m.position.set(hd.x-hd.w/2+.3+i*(hd.w-.6)/(n-1),hd.h+rnd(-.05,.12),hd.z+rnd(-.3,.3));m.castShadow=true;group.add(m)}
  for(let i=0;i<n;i++){const m=new T.Mesh(ico,mat(i%3?0x47984a:0x5ba84e));m.scale.setScalar(rnd(.32,.45));m.position.set(hd.x+rnd(-hd.w/2+.3,hd.w/2-.3),rnd(.5,hd.h-.3),hd.z+.62);group.add(m)}
}

/* ---------- porch over the door, with a skylight in its sloped roof ---------- */
function buildPorch(){
  const g=group,a=Math.atan2(1.4,2),n=new T.Vector3(0,Math.cos(a),Math.sin(a)),c=new T.Vector3(0,4.3,1.2);
  const slab=box(4.4,.2,2.75,0xc6473a,0,0,0,g);slab.rotation.x=a;slab.position.copy(c).addScaledVector(n,-.1);addOb(slab,'roof');
  [-1,1].forEach(s=>addOb(box(.22,3.55,.22,0xfffaf0,s*1.95,1.78,2.05,g),'wood'));
  box(4.2,.24,.26,0xfffaf0,0,3.5,2.08,g);
  const p=panes.find(q=>q.sky);if(!p)return;
  const sg=new T.Group();sg.position.copy(c);sg.rotation.x=a-Math.PI/2;g.add(sg);p.x=0;p.y=0;
  const dk=new T.Mesh(new T.PlaneGeometry(p.w,p.h),bmat(0x2b2230));dk.position.z=.012;sg.add(dk);
  makeFrame(p,sg,0xfffaf0);makePane(p,sg);p.mesh.position.z=.03;
  g.updateMatrixWorld(true);p.xf=sg.matrixWorld.clone();p.inv=p.xf.clone().invert();p.q=sg.getWorldQuaternion(new T.Quaternion());
}
/* Skylight hit test: the ball touches the glass from above. */
function skyHit(b){
  if(b.ghost)return;
  for(const p of panes){if(!p.sky||p.broken||!p.inv)continue;_lp.copy(b.p).applyMatrix4(p.inv);
    if(Math.abs(_lp.x)<=p.w/2+.08&&Math.abs(_lp.y)<=p.h/2+.08&&_lp.z<R&&_lp.z>-.5){smash(p,b,_lp.clone());return}}
}

/* ---------- wind: steady sideways push on the ball, shown with streaks, leaves and a flag ---------- */
function buildWind(){
  const g=group,dir=Math.sign(wind);
  /* flag on the roof ridge (or a tall pole beside the stand), pointing downwind */
  const L=LVL,py=L.type==='house'?L.H+L.G-.2:0,ph=L.type==='house'?2.6:7.5,px=L.type==='house'?0:-6,pz=L.type==='house'?-3:-1;
  box(.13,ph,.13,0xfffaf0,px,py+ph/2,pz,g);
  const fg=new T.PlaneGeometry(1.9,1.1,10,1);fg.translate(.95,0,0);
  const flag=new T.Mesh(fg,new T.MeshLambertMaterial({color:0xd9503f,side:T.DoubleSide}));flag.position.set(px,py+ph-.6,pz);flag.rotation.y=dir>0?0:Math.PI;g.add(flag);
  const base=fg.attributes.position.array.slice();
  const sgeo=new T.BoxGeometry(1,.045,.045),st=[];
  const seed=(s,first)=>{s.m.position.set(first?rnd(-15,15):-dir*rnd(12,16),rnd(.6,9.5),rnd(-1,D+1));s.m.scale.x=rnd(1,2.8);s.u=first?Math.random():0;s.d=rnd(1.2,2.4)};
  for(let i=0;i<38;i++){const s={m:new T.Mesh(sgeo,new T.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:0,depthWrite:false}))};g.add(s.m);seed(s,true);st.push(s)}
  let leafT=0;
  movers.push((t,dt)=>{
    const pa=fg.attributes.position;for(let i=0;i<pa.count;i++){const x=base[i*3];pa.array[i*3+2]=Math.sin(x*3.2-t*11)*.17*x/1.9}pa.needsUpdate=true;
    st.forEach(s=>{s.u+=dt/s.d;s.m.position.x+=wind*3*dt;s.m.material.opacity=Math.sin(Math.PI*clamp(s.u,0,1))*.6;if(s.u>=1)seed(s,false)});
    leafT-=dt;if(leafT<0){leafT=.1;dust.emit(-dir*rnd(9,14),rnd(1,8),rnd(-1,D),wind*rnd(1.6,2.6),rnd(-.4,.6),rnd(-.4,.4),rnd(3,5),Math.random()<.5?[.45,.72,.25]:[.95,.7,.25],.35)}
  });
}
