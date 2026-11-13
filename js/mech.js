'use strict';
/* ---------- level mechanics ----------
   Solid obstacles (oriented boxes the ball bounces off), movers (per-frame animation),
   shutters, wooden boards, wired glass, the porch skylight and wind. */
let obs=[],movers=[],lt=0,wind=0;
const _lp=new T.Vector3(),_lq=new T.Vector3(),_ld=new T.Vector3(),_n=new T.Vector3(),_rv=new T.Vector3(),_wp=new T.Vector3();

/* Bounce per material: e = restitution along the normal, f = friction kept along the surface. */
const OBK={wood:{e:.45,f:.75,snd:'wood'},roof:{e:.3,f:.82,snd:'thud'},wall:{e:.35,f:.7,snd:'thud'},metal:{e:.5,f:.8,snd:'clang'},tramp:{e:.6,f:.8,snd:'boing'},hedge:{e:.1,f:.3,snd:'rustle'}};
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
  if(b.ghost||b.rebound)return; /* a rebounding ball is on a set path to its glass */
  for(const o of obs){
    if(o.skip&&o.skip(b))continue;
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
  if(o.hit)o.hit(b);
  if(b.live){b.live=false}
  b.a.set(0,-S.gravity,0);
  if(b.state==='fly'||b.state==='ground'){b.state='bounce';b.age=Math.min(b.age,.4)}
  if(imp<2.5)return;
  const k=OBK[o.kind];sfx[k.snd]();addShake(Math.min(.25,imp*.012));
  if(o.kind==='metal')for(let i=0;i<16;i++)spark.emit(b.p.x,b.p.y,b.p.z,rnd(-4,4),rnd(-2,4),rnd(-1,4),rnd(.15,.35),[1,.85,.45],6);
  if(o.kind==='hedge'){for(let i=0;i<26;i++)dust.emit(b.p.x,b.p.y,b.p.z,rnd(-2.5,2.5),rnd(-.5,3),rnd(-1,2.5),rnd(.4,.9),Math.random()<.5?[.3,.6,.25]:[.45,.75,.3],5)}
  else{for(let i=0;i<12;i++)dust.emit(b.p.x,b.p.y,b.p.z,rnd(-2,2),rnd(-1,2.4),rnd(0,2),rnd(.25,.5),[.92,.8,.6],2)}
}

/* Build every mechanic a level lists. Runs after buildHouse/buildStand. */
function buildMech(L){
  if(L.island)buildIslands(L);
  if(L.field==='stack')buildStacks(L);else if(L.field==='carousel')buildCarousel(L);else if(L.field==='behind')buildBehind(L);else if(L.field==='aquarium')buildAquarium(L);else if(L.field==='tunnel')buildTunnel(L);else if(L.field==='flip')buildFlips(L);
  if(L.revolver)buildRevolver(L.revolver);
  if(L.garage)buildGarage(L);
  panes.forEach(p=>{if(p.awn)buildAwning(p)});
  panes.forEach(p=>{if(p.shutter)buildShutter(p);if(p.armor)buildBoards(p);if(p.hp>1)buildWired(p)});
  if(L.mill)buildMill(L.mill);
  if(L.wheel)buildWheel(L.wheel);
  if(L.gantry)buildGantry(L.gantry);
  if(L.switch)buildSwitch(L.switch);
  if(L.pads)L.pads.forEach(buildPad);
  if(L.gwall)buildGardenWall(L);
  if(L.towers)buildTowers(L);
  if(L.spin)buildSpins(L);
  if(L.night)buildNight(L);
  if(L.roam)buildRoam();
  if(L.board)buildBoard(L.board);
  (L.hedges||[]).forEach(buildHedge);
  if(L.porch)buildPorch();
  if(wind)buildWind();
  updateObs(0);
  if(hop){hop.house=panes;panes=hop.first} /* island levels: the near island's frames are the targets until the hop */
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
    /* locked shutters stay shut until the switch is hit, then roll up for good */
    const lk=p.shutter.lock,f=lk?(p.unlockT===undefined?1:1-clamp((t-p.unlockT)/.8,0,1)):shutAmt(t,p.shutter.phase),yb=top-f*p.h;p.shutF=f;p.shutY=yb;
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
  const wm=new T.Mesh(new T.PlaneGeometry(p.w,p.h),new T.MeshBasicMaterial({map:t,transparent:true,depthWrite:false}));wm.position.set(p.x,p.y,p.sg?.05:.015);wm.renderOrder=4;(p.sg||group).add(wm);
  const c=document.createElement('canvas');c.width=256;c.height=Math.round(256*p.h/p.w);const ct=new T.CanvasTexture(c);
  const cm=new T.Mesh(new T.PlaneGeometry(p.w,p.h),new T.MeshBasicMaterial({map:ct,transparent:true,depthWrite:false}));cm.position.set(p.x,p.y,p.sg?.06:.03);cm.renderOrder=5;(p.sg||group).add(cm);
  p.extra=[wm,cm];p.crackCv=c;p.crackTex=ct;
}
function crackPane(p,b,lh){
  p.hp--;const c=p.crackCv,g=c.getContext('2d'),k=c.width/p.w,src=lh||b.p;
  const lx=(clamp(src.x-p.x,-p.w/2,p.w/2)+p.w/2)*k,ly=(p.h/2-clamp(src.y-p.y,-p.h/2,p.h/2))*k,lines=[];
  for(let i=0;i<12;i++){const a=i/12*Math.PI*2+rnd(-.2,.2),L=rnd(70,190);let x=lx,y=ly;const pts=[[x,y]];for(let s=0;s<6;s++){const ang=a+rnd(-.4,.4);x+=Math.cos(ang)*L/6;y+=Math.sin(ang)*L/6;pts.push([x,y])}lines.push(pts)}
  const rings=[1,3].map(r=>lines.map(l=>l[r]));
  const stroke=(col,wd)=>{g.strokeStyle=col;g.lineWidth=wd;g.lineCap=g.lineJoin='round';lines.forEach(l=>{g.beginPath();l.forEach((q,i)=>i?g.lineTo(q[0],q[1]):g.moveTo(q[0],q[1]));g.stroke()});
    rings.forEach(r=>{g.beginPath();r.forEach((q,i)=>i?g.lineTo(q[0]+rnd(-3,3),q[1]+rnd(-3,3)):g.moveTo(q[0],q[1]));g.closePath();g.stroke()})};
  stroke('rgba(35,48,74,.45)',4.5);stroke('rgba(255,255,255,.95)',2);
  p.crackTex.needsUpdate=true;
  for(let i=0;i<30;i++)spark.emit(b.p.x,b.p.y,p.sg?b.p.z:.2,rnd(-4,4),rnd(-3,5),rnd(0,5),rnd(.15,.45),[.85,.95,1],8);
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
  const dk=new T.Mesh(new T.PlaneGeometry(p.w,p.h),bmat(0x2b2230));dk.position.z=.012;sg.add(dk);p.dark=dk;
  makeFrame(p,sg,0xfffaf0);makePane(p,sg);p.mesh.position.z=.03;
  g.updateMatrixWorld(true);p.xf=sg.matrixWorld.clone();p.inv=p.xf.clone().invert();p.q=sg.getWorldQuaternion(new T.Quaternion());
}
/* Glass first: the glass counts from the moment the ball touches the frame's front face (frame front z .27 + ball radius),
   and it is checked before the frames, so a ball whose centre is over the glass breaks it even if its side clips the frame.
   Only a ball centred on the frame or outside it bounces off the wood (same rule as house windows). */
const GLASS_REACH=.27+R+.02;
/* Free-pane hit test (skylight, greenhouse back wall and roof): the ball touches the glass from its front side. */
/* prev = where the ball was a substep ago, so a fast ball can't skip over the thin hit zone */
function skyHit(b,prev){
  if(b.ghost)return;
  for(const p of panes){if(!p.inv||p.broken||p.locked)continue;_lp.copy(b.p).applyMatrix4(p.inv);const z1=_lp.z,z0=prev?_lq.copy(prev).applyMatrix4(p.inv).z:z1;
    const lo=p.inner?-R:p.oneWay?-.05:-.5,hi=p.inner?.05:GLASS_REACH;
    /* angled glass: judge by where the ball's path will pierce the glass, not where its centre is now, so a ball sweeping
       along a slanted pane isn't caught by the far frame bar on its way in (straight-on hits land on the same spot) */
    if(!p.inner&&z1>0&&z1<hi){_ld.copy(b.v).transformDirection(p.inv);if(_ld.z<-.05){const t=z1/-_ld.z;_lp.x+=_ld.x*t;_lp.y+=_ld.y*t}}
    if(Math.abs(_lp.x)<=p.w/2+.08&&Math.abs(_lp.y)<=p.h/2+.08&&Math.min(z0,z1)<hi&&Math.max(z0,z1)>lo){
      if(p.hp>1){crackPane(p,b,_lp.clone());stopBall(b);return}
      smash(p,b,_lp.clone());return}}
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

/* ---------- free pane: glass at any position and tilt, hit-tested in its own frame (see skyHit) ---------- */
function freePane(p,pos,rx,col){
  const sg=new T.Group();sg.position.copy(pos);sg.rotation.x=rx||0;group.add(sg);p.x=0;p.y=0;
  makeFrame(p,sg,col);makePane(p,sg);p.mesh.position.z=.03;
  group.updateMatrixWorld(true);p.xf=sg.matrixWorld.clone();p.inv=p.xf.clone().invert();p.q=sg.getWorldQuaternion(new T.Quaternion());p.c=pos.clone();
  return sg;
}

/* ---------- greenhouse (bonus): glass front, glass back wall and a glass roof facing the camera.
   A ball that breaks a front pane flies on and can break the back wall or the roof too. ---------- */
const GH={hw:6.2,top:5.3,back:-4,rise:1.85,run:2};
function buildGreenhouse(L){
  const g=group,F=0xfffaf0,{hw,top,back,rise,run}=GH,a=Math.atan2(rise,run),slope=Math.hypot(rise,run),base=0x5f8f5a;
  const fl=new T.Mesh(new T.PlaneGeometry(hw*2,-back),mat(0xb9a27a));fl.rotation.x=-Math.PI/2;fl.position.set(0,.02,back/2);fl.receiveShadow=true;g.add(fl);
  box(hw*2+.3,.5,.4,base,0,.25,.02,g);box(hw*2+.3,.5,.4,base,0,.25,back,g);
  [-1,1].forEach(s=>{box(.4,.5,-back,base,s*hw,.25,back/2,g);
    [0,back].forEach(z=>box(.22,top,.22,F,s*hw,top/2,z,g));box(.2,.2,-back,F,s*hw,top,back/2,g);box(.12,.12,-back,F,s*hw,2.45,back/2,g,false);
    const sgl=new T.Mesh(new T.PlaneGeometry(-back,top-.5),glassMat);sgl.rotation.y=Math.PI/2;sgl.position.set(s*hw,.5+(top-.5)/2,back/2);sgl.renderOrder=2;g.add(sgl);
    const tri=new T.Shape();tri.moveTo(0,0);tri.lineTo(-back,0);tri.lineTo(run,rise);tri.closePath();
    const gab=new T.Mesh(new T.ShapeGeometry(tri),glassMat);gab.rotation.y=Math.PI/2;gab.position.set(s*hw,top,0);gab.renderOrder=2;g.add(gab)});
  box(hw*2+.3,.22,.22,F,0,top+rise,-run,g);box(hw*2+.3,.2,.2,F,0,top,0,g);box(hw*2+.3,.2,.2,F,0,top,back,g);
  const bs=Math.hypot(rise,-back-run);
  [-hw,-3,0,3,hw].forEach(x=>{const r=box(.14,.14,slope,F,x,top+rise/2,-run/2,g,false);r.rotation.x=a;
    const r2=box(.14,.14,bs,F,x,top+rise/2,(back-run)/2,g,false);r2.rotation.x=-Math.atan2(rise,-back-run)});
  const bk=new T.Mesh(new T.PlaneGeometry(hw*2,bs),glassMat);bk.rotation.x=-Math.PI/2-Math.atan2(rise,-back-run);bk.position.set(0,top+rise/2,(back-run)/2);bk.renderOrder=2;g.add(bk);
  /* plants: a bench of pots along the back and two big shrubs in the middle */
  box(hw*2-1,.12,.9,0x8a5f3b,0,.95,back+.9,g);[-5,-1.7,1.7,5].forEach(x=>box(.12,.9,.8,0x704b2c,x,.45,back+.9,g));
  const ico=new T.IcosahedronGeometry(1,1);
  for(let i=0;i<11;i++){const x=-5+i;box(.42,.4,.42,0xc8693a,x,1.21,back+.9,g);const m=new T.Mesh(ico,mat(i%3?0x4fa04a:0x3f8f3e));m.scale.setScalar(rnd(.32,.45));m.position.set(x,1.65,back+.9);g.add(m);
    if(i%2===0){const f=new T.Mesh(new T.IcosahedronGeometry(.11,0),mat(i%4?0xf35f7d:0xffd34d));f.position.set(x+.15,1.95,back+1.1);g.add(f)}}
  [-3,3].forEach(x=>{box(.8,.7,.8,0xc8693a,x,.37,-2,g);[[0,1.4,0,.75],[-.35,1.05,.2,.5],[.35,1.15,-.2,.55],[0,1.9,.1,.5]].forEach(l=>{const m=new T.Mesh(ico,mat(0x47984a));m.scale.setScalar(l[3]);m.position.set(x+l[0],l[1],-2+l[2]);m.castShadow=true;g.add(m)})});
  panes.forEach(p=>{
    if(p.roof)freePane(p,new T.Vector3(p.x,top+rise/2,-run/2),a-Math.PI/2,F);
    else if(p.back)freePane(p,new T.Vector3(p.x,p.y,back),0,F);
    else{makeFrame(p,g,F);makePane(p,g)}});
}

/* ---------- windmill on the house front: big sails turn in front of the windows ---------- */
const sailTex=canvasTex(64,256,(g,w,h)=>{g.fillStyle='#f4ead2';g.fillRect(0,0,w,h);g.strokeStyle='#8a5f3b';g.lineWidth=5;g.strokeRect(2,2,w-4,h-4);g.lineWidth=3;for(let i=1;i<8;i++){g.beginPath();g.moveTo(0,i*h/8);g.lineTo(w,i*h/8);g.stroke()}g.beginPath();g.moveTo(w/2,0);g.lineTo(w/2,h);g.stroke()});
sailTex.rotation=Math.PI/2;sailTex.center.set(.5,.5);
function buildMill(o){
  const g=group,len=o.len,n=o.n||4,sail=new T.MeshLambertMaterial({map:sailTex});
  box(1.1,1.1,.14,0x6b4a2c,o.x,o.y,.22,g);
  addOb(box(.34,.34,o.z-.16,0x6b4a2c,o.x,o.y,(o.z+.16)/2,g),'wood');
  const rot=new T.Group();rot.position.set(o.x,o.y,o.z);g.add(rot);
  const hub=new T.Mesh(new T.CylinderGeometry(.42,.48,.45,16),mat(0xb8432f));hub.rotation.x=Math.PI/2;hub.castShadow=true;rot.add(hub);
  const cap=new T.Mesh(new T.SphereGeometry(.22,12,8),mat(0xffc53a));cap.position.z=.26;rot.add(cap);
  for(let k=0;k<n;k++){const arm=new T.Group();arm.rotation.z=k*Math.PI*2/n;rot.add(arm);
    addOb(box(len,.17,.17,0x6b4a2c,len/2,0,0,arm),'wood');
    addOb(box(len-.6,.9,.07,sail,(len+.6)/2,.5,.02,arm),'wood')}
  const dir=wind<0?1:-1; /* the tops of the sails move with the wind; no wind turns clockwise */
  movers.push(t=>{rot.rotation.z=dir*t*o.speed});
}

/* ---------- gap wheel: one solid disc on the house front with a single quarter-circle cut-out, the only way to the windows.
   Its bottom runs below the ground. It sinks out of the way when the level ends, so the owner and the windows can be seen. ---------- */
let wheel=null;
function sector(q,r0,r1,a0,a1){q.absarc(0,0,r1,a0,a1,false);q.absarc(0,0,r0,a1,a0,true);q.closePath();return q}
const wheelTex=canvasTex(128,128,(g,w,h)=>{g.fillStyle='#e9dcc0';g.fillRect(0,0,w,h);g.strokeStyle='#c9b48e';g.lineWidth=3;for(let i=0;i<4;i++){g.beginPath();g.moveTo(0,i*h/4+8);g.lineTo(w,i*h/4+8);g.stroke();g.beginPath();g.moveTo(i*w/4+8,0);g.lineTo(i*w/4+8,h);g.stroke()}});
wheelTex.wrapS=wheelTex.wrapT=T.RepeatWrapping;wheelTex.repeat.set(.32,.32);
function buildWheel(o){
  const g=group,r=o.r,r0=1.15,r1=r-.55,ha=o.gap/2;
  box(1.1,1.1,.14,0x6b4a2c,o.x,o.y,.22,g);addOb(box(.34,.34,o.z-.16,0x6b4a2c,o.x,o.y,(o.z+.16)/2,g),'wood');
  const rot=new T.Group();rot.position.set(o.x,o.y,o.z);g.add(rot);
  const sh=new T.Shape();sh.absarc(0,0,r,0,Math.PI*2,false);sh.holes.push(sector(new T.Path(),r0,r1,-ha,ha));
  const disc=new T.Mesh(new T.ExtrudeGeometry(sh,{depth:.16,bevelEnabled:false,curveSegments:56}),[new T.MeshLambertMaterial({map:wheelTex}),mat(0x8a5f3b)]);disc.position.z=-.08;disc.castShadow=true;rot.add(disc);
  /* a bright border so the gap is easy to follow */
  const bs=sector(new T.Shape(),r0-.2,r1+.2,-ha-.05,ha+.05);bs.holes.push(sector(new T.Path(),r0,r1,-ha,ha));
  const bd=new T.Mesh(new T.ExtrudeGeometry(bs,{depth:.04,bevelEnabled:false,curveSegments:32}),mat(0xffc53a));bd.position.z=.08;rot.add(bd);
  const rim=new T.Mesh(new T.TorusGeometry(r,.13,8,72),mat(0x6b4a2c));rot.add(rim);
  const hub=new T.Mesh(new T.CylinderGeometry(.42,.48,.45,16),mat(0xb8432f));hub.rotation.x=Math.PI/2;hub.position.z=.2;rot.add(hub);
  const cap=new T.Mesh(new T.SphereGeometry(.22,12,8),mat(0xffc53a));cap.position.z=.46;rot.add(cap);
  wheel={x:o.x,y:o.y,z:o.z,r,r0,r1,ha,rot,gone:false,last:performance.now()};
  movers.push(t=>{rot.rotation.z=-t*o.speed;const now=performance.now(),rd=Math.min(.05,(now-wheel.last)/1000);wheel.last=now;
    if(won||failT>=0){wheel.gone=true;rot.position.y=Math.max(-r-1,rot.position.y-15*rd)}});
}
function wheelHit(b){
  const w=wheel;if(!w||w.gone||b.ghost||b.v.z>=0)return;const t=.08+R*.6;if(b.p.z>w.z+t||b.p.z<w.z-t)return;
  const dx=b.p.x-w.x,dy=b.p.y-w.y,r=Math.hypot(dx,dy);if(r>w.r+R*.4)return;
  let a=Math.atan2(dy,dx)-w.rot.rotation.z;a=Math.atan2(Math.sin(a),Math.cos(a));
  const mg=R*.45;if(r>w.r0+mg&&r<w.r1-mg&&Math.abs(a)<w.ha-mg/r)return; /* through the gap */
  b.p.z=w.z+t+.01;b.v.z=Math.abs(b.v.z)*.35;b.v.x*=.6;b.v.y*=.6;b.live=false;b.a.set(0,-S.gravity,0);if(b.state==='fly'||b.state==='ground'){b.state='bounce';b.age=Math.min(b.age,.4)}
  sfx.wood();addShake(.14);for(let i=0;i<14;i++)dust.emit(b.p.x,b.p.y,b.p.z,rnd(-2,2),rnd(-1,2.4),rnd(0,2),rnd(.25,.5),[.92,.8,.6],2);
}

/* ---------- free-standing panes: glass at any position and turn, with a solid frame, hit-tested in their own frame (see skyHit) ---------- */
function solidFrame(p,sg,c){const f=.2;[[p.w+f*2,f,0,p.h/2+f/2],[p.w+f*2,f,0,-p.h/2-f/2],[f,p.h,-p.w/2-f/2,0],[f,p.h,p.w/2+f/2,0]].forEach(a=>addOb(box(a[0],a[1],.34,c,a[2],a[3],.1,sg),'wood'))}
function syncPane(p){p.sg.updateWorldMatrix(true,false);p.xf=(p.xf||new T.Matrix4()).copy(p.sg.matrixWorld);p.inv=(p.inv||new T.Matrix4()).copy(p.xf).invert();p.q=p.sg.getWorldQuaternion(p.q||new T.Quaternion());p.c=p.sg.getWorldPosition(p.c||new T.Vector3())}
function freeStand(p,pos,col){const sg=new T.Group();sg.position.copy(pos);group.add(sg);p.x=0;p.y=0;solidFrame(p,sg,col||0xfffaf0);makePane(p,sg);p.mesh.position.z=.03;p.sg=sg;syncPane(p);return sg}
/* Stacked line: after a break the ball flies on to the next window in the same line (no gravity on the way). */
function chainTo(b,q){const sp=Math.max(b.v.length()*.9,16);b.live=false;b.state='fly';b.age=0;b.a.set(0,0,0);b.v.copy(q.c).sub(b.p).normalize().multiplyScalar(sp)}
/* The ball is used up on the glass: it knocks back and drops, so it can't also break the window behind. */
function stopBall(b){b.live=false;b.ghost=true;b.state='passed';b.age=Math.min(b.age,1.2);b.a.set(0,-S.gravity,0);b.v.set(b.v.x*.2,2.5,-Math.sign(b.v.z||-1)*Math.abs(b.v.z)*.22)}

/* ---------- stacked windows: stands with windows one behind another, lined up along the kick so each break reveals the next ---------- */
function stackPanes(){
  const zs=[3.6,2.1,.6],a=[];
  [{x:-4,y:2.7,n:2},{x:0,y:3.3,n:3},{x:4,y:2.7,n:2}].forEach(s=>{for(let i=0;i<s.n;i++)a.push({x:s.x*(D-zs[i])/(D-zs[0]),y:s.y,z:zs[i],w:2.4,h:2.2,frontIdx:i?a.length-1:undefined})});
  return a;
}
function buildStacks(){
  const c=0x8a5f3b,ps=panes,ends=[];
  ps.forEach(p=>{const x=p.x,y=p.y;p.stop=true;if(p.frontIdx!==undefined){p.front=ps[p.frontIdx];p.front.back=p}; /* back: one ball chains through the whole line */freeStand(p,new T.Vector3(x,y,p.z));
    [-1,1].forEach(s=>box(.22,y-p.h/2,.22,c,x+s*(p.w/2+.1),(y-p.h/2)/2,p.z+.1,group));ends.push({x,z:p.z,f:p.frontIdx})});
  /* base rails along each stack, from its front window to its back window */
  ends.forEach((e,i)=>{if(e.f===undefined)return;const a=ends[e.f],dx=e.x-a.x,dz=e.z-a.z,len=Math.hypot(dx,dz)+1.2,ry=Math.atan2(dx,dz);
    [-1,1].forEach(s=>{const m=box(.26,.14,len,0x704b2c,(e.x+a.x)/2+s*(ps[i].w/2+.1),.07,(e.z+a.z)/2+.1,group);m.rotation.y=ry})});
}

/* ---------- carousel: windows on a circular track, widest at the front and back of the loop, edge-on at the sides.
   Items can be empty frames, or have a mesh on the outside with the glass facing the centre (break those on the far side,
   through a gap). Windows can also stand still inside the circle. ---------- */
/* metal grille: light bars with a dark outline, drawn solid (alphaTest + depth) so it sorts properly against the glass */
const meshTex=canvasTex(64,64,(g,w,h)=>{const bars=(c,lw)=>{g.strokeStyle=c;g.lineWidth=lw;g.beginPath();for(let i=0;i<=2;i++){g.moveTo(i*32,0);g.lineTo(i*32,h);g.moveTo(0,i*32);g.lineTo(w,i*32)}g.stroke()};bars('#2b3344',9);bars('#b9c3d1',4.5)});
meshTex.wrapS=meshTex.wrapT=T.RepeatWrapping;
function meshMat(w,h){const t=meshTex.clone();t.needsUpdate=true;t.repeat.set(w/.42,h/.42);return new T.MeshBasicMaterial({map:t,alphaTest:.5,side:T.DoubleSide})}
function buildCarousel(L){
  const o=L.carousel,c=0x8a5f3b,its=[],n=o.items.length;panes=[];
  const ring=new T.Mesh(new T.RingGeometry(o.r-.24,o.r+.24,72),mat(0x8d8577));ring.rotation.x=-Math.PI/2;ring.position.set(0,.03,o.z);ring.receiveShadow=true;group.add(ring);
  if(!L.inner){const hub=new T.Mesh(new T.CylinderGeometry(.55,.75,.5,16),mat(0xb8432f));hub.position.set(0,.25,o.z);hub.castShadow=true;group.add(hub)}
  o.items.forEach((d,i)=>{const p=Object.assign({},d),y=p.y,o0=obs.length;let sg;
    if(p.empty){sg=new T.Group();sg.position.set(0,y,o.z);group.add(sg);p.x=0;p.y=0;solidFrame(p,sg,0xfffaf0)}
    else{p.stop=true;p.moving=true;sg=freeStand(p,new T.Vector3(0,y,o.z));panes.push(p);
      if(p.inner){addOb(box(p.w+.3,p.h+.3,.05,meshMat(p.w+.3,p.h+.3),0,0,.24,sg,false),'metal');
        const mw=p.w+.44,mh=p.h+.44;[[mw,.14,0,mh/2],[mw,.14,0,-mh/2],[.14,mh,-mw/2,0],[.14,mh,mw/2,0]].forEach(a=>box(a[0],a[1],.1,0x7d8798,a[2],a[3],.26,sg,false))}}
    obs.slice(o0).forEach(ob=>{if(ob.kind==='wood')ob.hit=carouselDeflect});
    [-1,1].forEach(s=>{box(.22,y-p.h/2,.22,c,s*(p.w/2+.1),-(y+p.h/2)/2,.1,sg);box(.24,.14,1.2,0x704b2c,s*(p.w/2+.1),-y+.07,.1,sg)});
    its.push({p,sg,th:i/n*Math.PI*2})});
  (L.inner||[]).forEach(d=>{const p=Object.assign({},d),x=p.x,y=p.y;p.stop=true;freeStand(p,new T.Vector3(x,y,p.z));panes.push(p);
    [-1,1].forEach(s=>{box(.22,y-p.h/2,.22,c,x+s*(p.w/2+.1),(y-p.h/2)/2,p.z+.1,group);box(.24,.14,1.2,0x704b2c,x+s*(p.w/2+.1),.07,p.z+.1,group)})});
  const at=t=>its.forEach(it=>{const th=it.th+t*o.speed,sn=Math.sin(th),cs=Math.cos(th),p=it.p;it.sg.position.set(o.r*sn,it.sg.position.y,o.z+o.r*cs);it.sg.rotation.y=th;
    if(p.empty)return;p.vx=o.r*o.speed*cs;p.narrow=Math.abs(cs)<.5;p.aimOff=!!p.inner&&cs>-.5;syncPane(p)});
  at(0);movers.push(at);
}

/* A ball that clips a carousel frame gets a lucky break half the time (one roll per ball): it is sent into the circle
   at an unbroken inner window (or, with none, a ring window facing the player), so it breaks a window it wasn't aimed at. */
function carouselDeflect(b){
  if(b.defl!==undefined||b.rebound)return;b.defl=Math.random()<.5;if(!b.defl)return;
  const inner=panes.filter(p=>!p.broken&&!p.moving),ring=panes.filter(p=>!p.broken&&p.moving&&!p.narrow&&!p.aimOff),pool=inner.length?inner:ring;
  if(!pool.length)return;
  const q=pool[Math.floor(Math.random()*pool.length)],c=q.c,g=S.gravity,Tt=clamp(b.p.distanceTo(c)/15,.3,.7),tx=c.x+(q.vx||0)*Tt;
  b.rebound=true;b.v.set((tx-b.p.x)/Tt,(c.y-b.p.y+.5*g*Tt*Tt)/Tt,(c.z-b.p.z)/Tt);
}

/* ---------- revolving door: 4 glass wings that keep turning. With o.wall it is the house entrance: centred on the wall, so the back
   half turns into the house. ---------- */
let revolver=null;
function buildRevolver(o){
  const g=group,rot=new T.Group();rot.position.set(0,0,o.z);g.add(rot);
  const wh=o.h||2.2,top=.22+wh+.2; /* wing height; top of the wing frames */
  const cap=new T.Mesh(new T.CylinderGeometry(o.r+.2,o.r+.2,.3,32),mat(0x5f6b80));cap.position.set(0,top+.15,o.z);cap.castShadow=true;g.add(cap);
  const base=new T.Mesh(new T.CylinderGeometry(o.r+.2,o.r+.25,.08,32),mat(0x8d8577));base.position.set(0,.04,o.z);base.receiveShadow=true;g.add(base);
  if(!o.wall)[-1,1].forEach(s=>box(.18,top,.18,0x5f6b80,s*(o.r+.12),top/2,o.z,g)); /* free-standing: side posts; in the wall the doorway frames it */
  const pole=new T.Mesh(new T.CylinderGeometry(.08,.08,top,10),mat(0x3a3a44));pole.position.y=top/2;rot.add(pole);
  const wings=[];
  for(let k=0;k<4;k++){const a=k*Math.PI/2,arm=new T.Group();arm.rotation.y=a;rot.add(arm);
    const p={w:o.r-.2,h:wh,stop:true,moving:true,x:0,y:0},sg=new T.Group();sg.position.set(.12+p.w/2,.22+wh/2,0);arm.add(sg);
    const n0=obs.length;solidFrame(p,sg,0x5f6b80);for(let i=n0;i<obs.length;i++){obs[i].kind='metal';obs[i].hit=b=>{if(b.state!=='ground'&&b.v.length()>8)revPush()}}
    makePane(p,sg);p.mesh.position.z=0;p.sg=sg;syncPane(p);panes.push(p);wings.push({p,a,was:false})}
  /* it drifts round at REV.base rad/s (about one turn per 11 s); a ball hitting a wing pushes it faster for a moment */
  revolver={rot,om:REV.base,wings};
  movers.push((t,dt)=>{const R2=revolver;
    wings.forEach(w=>{if(w.p.broken&&!w.was){w.was=true;revPush()}});
    R2.om+=(REV.base-R2.om)*Math.min(1,dt*REV.ease);rot.rotation.y+=R2.om*dt;
    wings.forEach(w=>{syncPane(w.p);w.p.narrow=Math.abs(Math.cos(w.a+rot.rotation.y))<.5})});
}
const REV={base:.55,push:1.3,max:2.4,ease:1.6};
/* V deflection: when the two front wings make a V toward the player (each 20-70 deg from facing), a ball that breaks one of them
   on its inner half (toward the pole) glances off the corner and flies on into the other one (a set path, like the Stacked chain).
   A ball into the middle of the V, where it would clip the metal at the pole, counts as an inner-half hit on the wing on its side.
   V.cosLo/cosHi: the angle range (as |cos| of the wing angle); V.inner: hits left of this (pane-local x, 0 = wing middle) deflect;
   V.r / V.reach: the pocket around the pole (sideways / distance), checked before either wing's glass zone. */
const V={cosLo:.34,cosHi:.94,inner:.1,r:.45,reach:1.05};
function revFront(){const rv=revolver;if(!rv)return[];
  const f=rv.wings.filter(w=>{const t=w.a+rv.rot.rotation.y,cs=Math.abs(Math.cos(t));return -Math.sin(t)>0&&cs>=V.cosLo&&cs<=V.cosHi});
  return f.length===2?f:[]}
/* The wing the ball deflects into after breaking p at local hit point lh, or null. */
function revOther(p,lh){
  if(!revolver||!p.moving||!lh||lh.x>V.inner)return null;
  const f=revFront(),w=f.find(w=>w.p===p);if(!w)return null;
  const o=f.find(x=>x!==w);return o&&!o.p.broken?o.p:null}
/* Fly on to the outer half of the other wing (clear of the metal at the pole); a set path, so frames don't stop it. */
function revChain(b,q){const y=clamp(b.p.y-q.c.y,-q.h/2+.3,q.h/2-.3);chainTo(b,{c:new T.Vector3(.18,y,0).applyMatrix4(q.xf)});b.rebound=true}
function revPocket(b){
  const rv=revolver;if(!rv||b.ghost||b.rebound||b.v.z>=0)return;
  const c=rv.rot.position,dx=b.p.x-c.x,dz=b.p.z-c.z;
  if(dz<=0||Math.abs(dx)>V.r||Math.hypot(dx,dz)>V.reach)return;
  const w0=rv.wings[0].p;if(Math.abs(b.p.y-w0.c.y)>w0.h/2)return;
  const f=revFront();if(!f.length)return;
  const side=w=>Math.cos(w.a+rv.rot.rotation.y)*dx>=0; /* the wing on the ball's side of the pole */
  const w=f.find(w=>side(w)&&!w.p.broken)||f.find(w=>!w.p.broken);if(!w)return;
  smash(w.p,b,new T.Vector3(-w.p.w/2+.2,clamp(b.p.y-w.p.c.y,-w.p.h/2,w.p.h/2),0));
}
function revPush(){if(revolver)revolver.om=Math.min(REV.max,revolver.om+REV.push)}

/* ---------- awning + mesh: the upstairs window is behind a wire mesh hinged at the top of the window. A ball that lands on
   the awning below springs up into the gap behind the mesh, glances off its inside and into the glass (a set path). ---------- */
const awnTex=canvasTex(128,64,(g,w,h)=>{for(let i=0;i<8;i++){g.fillStyle=i%2?'#fff8e8':'#d9503f';g.fillRect(i*w/8,0,w/8,h)}});
function buildAwning(p){
  const g=group,top=p.y+p.h/2,bot=p.y-p.h/2,mw=p.w+.3,L=2.35,th=.36,gv=()=>S.gravity;
  const mp=new T.Group();mp.position.set(p.x,top+.18,.26);mp.rotation.x=-th;g.add(mp);
  addOb(box(mw,L,.05,meshMat(mw,L),0,-L/2,0,mp,false),'metal');obs[obs.length-1].skip=b=>b.meshOk===p;
  obs[obs.length-1].hit=b=>{if(b.awn!==p||p.broken)return;const Tt=.2;b.v.set((p.x-b.p.x)/Tt,(p.y-b.p.y+.5*gv()*Tt*Tt)/Tt,(ZF-.25-b.p.z)/Tt);b.awn=null;b.awnT=0;b.meshOk=p};
  box(mw+.1,.09,.09,0x3a3a44,0,-L,0,mp,false);[-1,1].forEach(s=>box(.09,L,.09,0x3a3a44,s*mw/2,-L/2,0,mp,false));
  box(mw+.3,.16,.16,0x3a3a44,p.x,top+.18,.26,g);
  /* where the sprung ball meets the inside of the mesh */
  const s=L*.7,inY=-Math.sin(th),inZ=-Math.cos(th),aim=new T.Vector3(p.x,top+.18-s*Math.cos(th)+inY*R*.5,.26+s*Math.sin(th)+inZ*R*.5);
  const ap=new T.Group();ap.position.set(p.x,bot-.32,.2);ap.rotation.x=.38;g.add(ap);
  const am=new T.MeshLambertMaterial({map:awnTex});
  /* the gap's mouth, just under the mesh's bottom edge */
  const mouth=new T.Vector3(p.x,top+.18-L*Math.cos(th)-.3,.62);
  addOb(box(p.w+.7,.08,1.5,am,0,0,.75,ap),'wood');obs[obs.length-1].skip=b=>b.awn===p||b.meshOk===p;
  obs[obs.length-1].hit=b=>{if(p.broken||b.awn===p)return;const Tt=.14;b.awn=p;b.awnAim=aim;b.awnT=Tt;b.v.set((mouth.x-b.p.x)/Tt,(mouth.y-b.p.y+.5*gv()*Tt*Tt)/Tt,(mouth.z-b.p.z)/Tt);sfx.boing();p.awnT=0};
  box(p.w+.7,.3,.04,am,0,-.15,1.5,ap,false);
  [-1,1].forEach(s=>{const r=box(.05,.05,1.6,0x3a3a44,s*(p.w/2+.3),.5,.85,g,false);r.position.set(p.x+s*(p.w/2+.3),bot-.32-.05,.95);r.rotation.x=-.2});
  p.awnT=9;movers.push((t,dt)=>{p.awnT+=dt;ap.rotation.x=.38+(p.awnT<.6?Math.sin(p.awnT*30)*Math.exp(-p.awnT*6)*.12:0)});
}

/* Sprung ball, second step: from the gap's mouth straight up to the inside of the mesh. */
function awnStep(b,h){if(!b.awn||!(b.awnT>0))return;b.awnT-=h;if(b.awnT>0)return;const a=b.awnAim,Tt=.16;b.v.set((a.x-b.p.x)/Tt,(a.y-b.p.y+.5*S.gravity*Tt*Tt)/Tt,(a.z-b.p.z)/Tt)}
/* ---------- aquarium on a stand in a pond: break a compartment and its fish drop into the pond and swim off ---------- */
let pond=null;
function fishMesh(col){const f=new T.Group(),b=new T.Mesh(new T.SphereGeometry(.2,10,8),mat(col));b.scale.set(1.1,.62,.42);f.add(b);
  const tl=new T.Group();tl.position.x=-.2;f.add(tl);const c=new T.Mesh(new T.ConeGeometry(.13,.2,4),mat(col));c.rotation.z=Math.PI/2;c.position.x=-.08;tl.add(c);
  const e=new T.Mesh(new T.SphereGeometry(.035,6,4),bmat(0x23304a));e.position.set(.12,.04,.07);f.add(e);f.userData.tail=tl;return f}
function buildAquarium(L){
  /* level with the house walls, compartments about house-window size: the aquarium is the variety, not tight aim */
  /* 1.5x size (2026-11-12): compartments 3.3x2.4; the glass is clearer than house glass so the fish show */
  const g=group,cx=0,cz=0,rx=10.4,rz=5,yb=1.2,cw=3.3,ch=2.4,gp=.33,fz=cz+.62,TW=3*cw+2*gp+.7,FS=1.5;
  const aqGlass=glassMat.clone();aqGlass.opacity=.38;
  const wt=waterTex.clone();wt.needsUpdate=true;wt.repeat.set(5,2.6);
  const water=new T.Mesh(new T.CircleGeometry(1,56),new T.MeshLambertMaterial({map:wt}));water.scale.set(rx,rz,1);water.rotation.x=-Math.PI/2;water.position.set(cx,.025,cz);water.receiveShadow=true;g.add(water);
  const rim=new T.Mesh(new T.RingGeometry(1,1.05,56),mat(0xbfb3a0));rim.scale.set(rx,rz,1);rim.rotation.x=-Math.PI/2;rim.position.set(cx,.035,cz);g.add(rim);
  addOb(box(4.8,yb,1.4,0xbfb3a0,cx,yb/2,cz,g),'wall');
  /* the tank: back, sides, sand, lid; one solid body behind the glass */
  const top=yb+.15+2*ch+gp+.6;
  box(TW,top-yb,.1,0x2f7fb0,cx,(top+yb)/2,cz-.62,g);[-1,1].forEach(s=>box(.14,top-yb,1.3,0x23304a,cx+s*(TW/2-.05),(top+yb)/2,cz,g));
  box(TW,.15,1.3,0xe8d29a,cx,yb+.08,cz,g);box(TW+.2,.22,1.5,0x23304a,cx,top+.1,cz,g);
  const body=box(TW-.2,top-yb,1.15,0x2f7fb0,cx,(top+yb)/2,cz-.06,g,false);body.visible=false;addOb(body,'wall');
  for(let i=0;i<14;i++){const wd=box(.09,rnd(.9,2.1),.09,0x3f8f3e,cx+rnd(-TW/2+.4,TW/2-.4),yb+.6,cz-.45,g,false);wd.rotation.z=rnd(-.2,.2)}
  pond={cx,cz,rx,rz,fish:[]};
  const cols=[0xff8a1f,0xffc53a,0xf35f7d];
  for(let r=0;r<2;r++)for(let k=0;k<3;k++){const p={x:cx+(k-1)*(cw+gp),y:yb+.25+ch/2+r*(ch+gp),w:cw,h:ch,stop:true},x=p.x,y=p.y;
    freeStand(p,new T.Vector3(x,y,fz));p.mesh.material=aqGlass;panes.push(p);
    const wm=new T.Mesh(new T.BoxGeometry(cw+.1,ch+.1,1.1),new T.MeshBasicMaterial({color:0x53bdf0,transparent:true,opacity:.26,depthWrite:false}));wm.position.set(x,y,cz-.02);g.add(wm);p.water=wm;
    p.fishes=[0,1].map(j=>{const f=fishMesh(cols[(r*3+k+j)%3]);f.scale.setScalar(1.3*FS);f.position.set(x+rnd(-.5,.5)*FS,y+rnd(-.35,.35)*FS,cz+rnd(-.2,.3));g.add(f);return{f,ph:rnd(0,6),x0:x,state:'tank'}})}
  movers.push((t,dt)=>{wt.offset.set(t*.012,t*.006);
    panes.forEach(p=>{
      if(p.broken&&!p.spilled){p.spilled=true;p.drain=0;for(let i=0;i<70;i++)spark.emit(p.x,p.y,fz,rnd(-3,3),rnd(-1,4),rnd(1,5),rnd(.4,.9),[.3,.65,1],12);sfx.splash();
        p.fishes.forEach(o=>{o.state='fall';o.v=new T.Vector3(rnd(-1.4,1.4),rnd(1,2.6),rnd(.8,2))})}
      if(p.drain!==undefined&&p.drain<1){p.drain=Math.min(1,p.drain+dt*2.2);p.water.scale.y=Math.max(.001,1-p.drain);p.water.position.y=p.y-(ch+.1)/2*p.drain}
      p.fishes.forEach(o=>{const f=o.f;
        if(o.state==='tank'){f.position.x=o.x0+Math.sin(t*.9+o.ph)*.62*FS;f.rotation.y=Math.cos(t*.9+o.ph)>0?0:Math.PI;f.userData.tail.rotation.y=Math.sin(t*10+o.ph)*.4}
        else if(o.state==='fall'){o.v.y-=16*dt;f.position.addScaledVector(o.v,dt);f.rotation.z+=dt*8;
          if(f.position.y<=.08){f.position.y=.06;f.rotation.z=0;
            let a=Math.atan2((f.position.z-cz)/rz,(f.position.x-cx)/rx),q=Math.hypot((f.position.x-cx)/rx,(f.position.z-cz)/rz);
            o.a=a;o.q=clamp(q,.45,.85);o.sp=(Math.random()<.5?-1:1)*rnd(.35,.6);o.state='swim';
            for(let i=0;i<10;i++)spark.emit(f.position.x,.1,f.position.z,rnd(-1.5,1.5),rnd(1,3),rnd(-1.5,1.5),rnd(.3,.6),[.75,.9,1],10)}}
        else{o.a+=o.sp*dt;const x=cx+Math.cos(o.a)*rx*o.q,z=cz+Math.sin(o.a)*rz*o.q;f.position.x=lerp(f.position.x,x,Math.min(1,dt*3));f.position.z=lerp(f.position.z,z,Math.min(1,dt*3));
          f.rotation.y=-Math.atan2(Math.cos(o.a)*rz*o.sp,-Math.sin(o.a)*rx*o.sp);f.userData.tail.rotation.y=Math.sin(t*12+o.ph)*.5}})})});
}
/* A ball that comes down in the pond sinks. */
function pondTouch(b){if(b.sunk)return true;const a=(b.p.x-pond.cx)/pond.rx,c=(b.p.z-pond.cz)/pond.rz;if(a*a+c*c>1)return false;sinkBall(b);return true}

/* ---------- from behind: panels with glass on one side and wood on the other. They turn their wood to the player at the start.
   High on the wall behind each panel is a glass window; break it and a trampoline springs out, tilted slightly down.
   A ball that hits the trampoline comes back and breaks the panel's glass from behind. All 6 panes count. ---------- */
let behind=null,behindSeen=-1;
function buildBehind(L){
  const g=group,wins=panes.slice(),t=brickTex.clone();t.needsUpdate=true;t.repeat.set(10,8);
  addOb(box(20,8,.5,new T.MeshLambertMaterial({map:t}),0,4,-.25,g),'wall');box(20.3,.2,.7,0xbfb3a0,0,8.1,-.25,g);
  const first=behindSeen!==level;behindSeen=level;
  behind={t:0,hold:first?.7:.2,turn:first?1:.5,done:false,reb:[]};
  const ry=5.3,gw=2.6,gh=2.1,tilt=.3;
  wins.forEach(p=>{const x=p.x,y=p.y,z=3.8;p.stop=true;p.oneWay=true;p.moving=true;const sg=freeStand(p,new T.Vector3(x,y,z));
    /* the backing: pale behind the glass, wood on the side that turns to the player */
    p.backing=new T.MeshLambertMaterial({color:0xcfe8f8});const wood=mat(0xb07a46);
    addOb(box(p.w+.4,p.h+.4,.1,[wood,wood,wood,wood,p.backing,wood],0,0,-.14,sg),'wood');
    [-.5,.05,.55].forEach(k=>box(p.w+.4,.05,.02,0x8a5f3b,0,k,-.2,sg,false));
    const ph=y-p.h/2-.2;box(.3,ph,.3,0x8a5f3b,x,ph/2,z,g);box(1.6,.14,1.6,0x704b2c,x,.07,z,g);
    /* the wall window: a dark recess with glass in front */
    const dk=new T.Mesh(new T.PlaneGeometry(gw,gh),bmat(0x2b2230));dk.position.set(x,ry,.01);g.add(dk);
    const q={w:gw,h:gh,stop:true,slot:true};freePane(q,new T.Vector3(x,ry,.62),0,0xfffaf0);panes.push(q);
    box(gw+.7,.18,.5,0xbfb3a0,x,ry-gh/2-.29,.3,g); /* sill */
    /* the trampoline, hidden until its glass breaks: red rim, dark mat, springs, tilted to face down at the panel */
    const tg=new T.Group();tg.position.set(x,ry,.3);tg.rotation.x=tilt;tg.scale.setScalar(.001);tg.visible=false;g.add(tg);
    const tw=gw-.3,th=gh-.3;
    [[tw+.24,.16,0,th/2+.08],[tw+.24,.16,0,-th/2-.08],[.16,th,-tw/2-.08,0],[.16,th,tw/2+.08,0]].forEach(a=>box(a[0],a[1],.14,0xd9503f,a[2],a[3],0,tg,false));
    const pad=box(tw-.3,th-.3,.06,0x3b8fe0,0,0,.02,tg,false);box(tw-.9,.08,.07,0xffffff,0,0,.03,tg,false);box(.08,th-.9,.07,0xffffff,0,0,.03,tg,false); /* blue mat with a white cross */
    const solid=box(tw,th,.16,0x23304a,0,0,0,tg,false);solid.visible=false;addOb(solid,'tramp');
    obs[obs.length-1].hit=b=>{if(p.broken||!q.broken)return;const Tt=.62,gv=S.gravity,c=p.c;b.rebound=true;b.v.set((c.x-b.p.x)/Tt,(c.y-b.p.y+.5*gv*Tt*Tt)/Tt,(c.z-b.p.z)/Tt);
      tg.userData.wob=0;for(let i=0;i<30;i++)spark.emit(b.p.x,b.p.y,b.p.z,rnd(-4,4),rnd(-4,4),rnd(0,5),rnd(.2,.5),[1,.85,.3],6)};
    tg.userData.pad=pad;
    behind.reb.push({x,y:ry,w:gw,h:gh,p,q,tg})});
  movers.push((t,dt)=>{const B=behind;
    if(!B.done){B.t+=dt;const k=clamp((B.t-B.hold)/B.turn,0,1),e=k*k*(3-2*k);if(k>0&&!B.turning){B.turning=true;sfx.whoosh()}wins.forEach(p=>p.sg.rotation.y=Math.PI*e);if(k>=1){B.done=true;wins.forEach(syncPane);spawnBall()}}
    /* a broken panel turns back to show its empty frame */
    wins.forEach(p=>{if(!p.broken)return;p.backT=(p.backT||0)+dt;const k=clamp((p.backT-.4)/.45,0,1),e=k*k*(3-2*k);p.sg.rotation.y=Math.PI*(1-e);if(k>0)p.backing.color.setHex(0x3a4152)});
    /* trampolines spring out once their glass is gone, and wobble when hit */
    B.reb.forEach(r=>{const u=r.tg.userData;if(!r.q.broken)return;
      if(u.t===undefined){u.t=0;r.tg.visible=true;sfx.boing()}
      u.t+=dt;const k=clamp((u.t-.25)/.45,0,1),s=k<=0?.001:1+Math.sin(k*Math.PI*2.5)*(1-k)*.35;r.tg.scale.set(s,s,1);
      if(u.wob!==undefined){u.wob+=dt;u.pad.position.z=.02-Math.sin(u.wob*30)*Math.exp(-u.wob*7)*.25}})});
}

/* ---------- deep frame: a "domino" row of empty cream window frames standing along a curve. The big first frame (the mouth)
   faces the camera; the row runs back, sweeps left in one gradual arc (o.turn degrees) and shrinks to a small window with glass,
   which faces mostly sideways (a hard direct shot). Two low wooden rails join the frames. A ball that goes in at the mouth follows
   the curve along the outer side (gravity off, 14–20 m/s), visible through the gaps; each frame it brushes wobbles with a knock,
   and it always smashes the glass. Balls outside bounce off the frames. ---------- */
let tunnel=null;
const _tv=new T.Vector3(),_ty=new T.Vector3(0,1,0),_tu=new T.Vector3(0,0,1),_tx=new T.Vector3(1,0,0),_tq=new T.Quaternion();
function buildTunnel(L){
  const o=L.tunnel,p=panes[0],g=group,turn=o.turn*Math.PI/180,skip=b=>b.tun>0,bar=.16,cream=0xfffaf0,wood=0x8a5f3b;
  /* centre line on the ground: straight back from the mouth, an arc of radius rc turning left, a short straight */
  const flat=[],cx=o.mx-o.rc,cz=o.zm-o.s1;
  for(let i=0;i<=4;i++)flat.push(new T.Vector3(o.mx,0,o.zm-o.s1*i/4));
  for(let i=1;i<=24;i++){const f=turn*i/24;flat.push(new T.Vector3(cx+o.rc*Math.cos(f),0,cz-o.rc*Math.sin(f)))}
  const dEnd=new T.Vector3(-Math.sin(turn),0,-Math.cos(turn)),last=flat[flat.length-1];
  for(let i=1;i<=3;i++)flat.push(last.clone().addScaledVector(dEnd,o.s2*i/3));
  const curve=new T.CurvePath();for(let i=1;i<flat.length;i++)curve.add(new T.LineCurve3(flat[i-1],flat[i]));
  const tot=curve.getLength(),ease=t=>{const k=clamp((t-.12)/.8,0,1);return k*k*(3-2*k)};
  const fw=t=>lerp(o.w0,p.w,ease(t)),fh=t=>lerp(o.h0,p.h,ease(t)),fy=t=>fh(t)/2+bar; /* frame opening size and centre height */
  /* the frames: each in its own group standing on the ground, facing along the curve */
  const frames=[],n=Math.round(tot/o.gap);
  for(let i=0;i<n;i++){const t=i/n,w=fw(t),h=fh(t),fg=new T.Group();fg.position.copy(curve.getPointAt(t));
    fg.quaternion.setFromUnitVectors(_tu,_tv.copy(curve.getTangentAt(t)).negate());g.add(fg);
    const bw=i===0?bar*1.5:bar;
    [[w+bw*2,bw,0,h+bw*1.5],[w+bw*2,bw,0,bw/2],[bw,h,-w/2-bw/2,h/2+bw],[bw,h,w/2+bw/2,h/2+bw]].forEach(a=>{addOb(box(a[0],a[1],.2,cream,a[2],a[3],0,fg),'wood');obs[obs.length-1].skip=skip});
    frames.push({fg,t,q0:fg.quaternion.clone(),wob:-1})}
  /* two low rails joining the frame feet */
  for(let i=0;i<n;i++){const t0=i/n,t1=Math.min(1,(i+1)/n);[-1,1].forEach(s=>{
    const a=curve.getPointAt(t0),c=curve.getPointAt(t1),ta=curve.getTangentAt(t0),tc=curve.getTangentAt(t1);
    const A=a.clone().addScaledVector(_tv.crossVectors(ta,_tx.set(0,1,0)).normalize(),s*(fw(t0)/2+bar/2)),C=c.clone().addScaledVector(_tv.crossVectors(tc,_tx.set(0,1,0)).normalize(),s*(fw(t1)/2+bar/2));
    const m=box(.14,.1,A.distanceTo(C)+.06,wood,(A.x+C.x)/2,.05,(A.z+C.z)/2,g);m.quaternion.setFromUnitVectors(_tu,_tv.copy(C).sub(A).normalize())})}
  _tx.set(1,0,0);
  /* the last, small frame holds the glass */
  const E=curve.getPointAt(1).setY(fy(1));
  freeStand(p,E,cream);p.sg.rotation.y=Math.atan2(dEnd.x,dEnd.z);syncPane(p);p.aimOff=true;
  tunnel={x:o.mx,cy:fy(0),w:o.w0,h:o.h0,zm:o.zm,curve,fw,fh,fy,frames,dEnd,E,p};
  movers.push((tt,dt)=>frames.forEach(f=>{if(f.wob<0)return;f.wob+=dt;const a=Math.sin(f.wob*22)*Math.exp(-f.wob*5)*.07;
    f.fg.quaternion.copy(f.q0).multiply(_tq.setFromAxisAngle(_tx,a));if(f.wob>1.4){f.wob=-1;f.fg.quaternion.copy(f.q0)}}));
}
function tunnelBump(tn,t){sfx.wood();addShake(.05);let best=null,bd=1e9;tn.frames.forEach(f=>{const d=Math.abs(f.t-t);if(d<bd){bd=d;best=f}});if(best)best.wob=0}
function tunnelHit(b){
  const tn=tunnel;if(!tn||b.ghost)return;
  if(b.tun===1){
    if(tn.p.broken){b.tun=2;b.a.set(0,-S.gravity,0);return}
    const q=b.path[b.wp];if(!q||_tv.copy(q).sub(b.p).dot(b.v)>0)return;
    b.p.copy(q);if(b.pk[b.wp]>=0)tunnelBump(tn,b.pk[b.wp]);b.wp++;const n=b.path[b.wp];
    if(n)b.v.copy(n).sub(q).setLength(b.spd);else{b.tun=2;b.a.set(0,-S.gravity,0)}
    return}
  if(b.tun||tn.p.broken||b.v.z>=0||b.p.z>tn.zm+R+.1||b.p.z<tn.zm-1.5)return;
  if(Math.abs(b.p.x-tn.x)>tn.w/2-R*.5||Math.abs(b.p.y-tn.cy)>tn.h/2-R*.5)return;
  /* the path: from the entry point toward the outer side of the curve, brushing a few frames, then out through the glass */
  const path=[],pk=[],side=new T.Vector3(),up=new T.Vector3(0,1,0),bumps=[.4+rnd(-.05,.05),.64+rnd(-.05,.05),.84];
  for(let t=.06;t<.97;t+=.045){const c=tn.curve.getPointAt(t),tg=tn.curve.getTangentAt(t);side.crossVectors(tg,up).normalize(); /* right = outer side of a left turn */
    const bump=bumps.findIndex(x=>Math.abs(x-t)<.0225),half=tn.fw(t)/2-R-.06,out=t<.25?lerp((b.p.x-tn.x)/(tn.w/2),.55,t/.25):bump>=0?1:.7;
    c.addScaledVector(side,out*half);c.y=lerp(clamp(b.p.y,R+.3,tn.cy+tn.h/2-R),tn.fy(t)-tn.fh(t)*.15,clamp(t/.3,0,1));
    path.push(c);pk.push(bump>=0?t:-1)}
  path.push(tn.E.clone().addScaledVector(tn.dEnd,.6));pk.push(-1);
  b.tun=1;b.live=false;b.state='fly';b.age=0;b.a.set(0,0,0);b.path=path;b.pk=pk;b.wp=0;b.spd=clamp(b.v.length(),14,20);
  b.v.copy(path[0]).sub(b.p).setLength(b.spd);
}

/* ---------- hinged blockers: the force of the kick swings them out of the way ----------
   Spin board: a board on a vertical pole in front of a house window. A kick away from the pole swings it 90° and it stays open
   (edge-on); a kick near the pole only makes it wobble.
   Flip panel: a panel standing on a horizontal bar. A kick on its top half tips it over backwards, and it ends up hanging below
   the bar. It uncovers a window behind (cover), or shows glass on its own back (back glass). A kick low on it only wobbles it. */
let hinges=[];
const _hv=new T.Vector3();
function hingeHit(hg,b){
  if(hg.open)return;
  _hv.copy(b.p);hg.pg.worldToLocal(_hv);
  const k=hg.axis==='y'?Math.abs(_hv.x)/(hg.w/2):_hv.y/hg.h; /* where on the board it was hit: 0 = at the hinge, 1 = far edge */
  if(k<hg.need){hg.wob=0;return}
  hg.open=true;hg.t=0;if(hg.axis==='y')hg.dir=Math.sign(_hv.x)||1;else{hg.phi=0;hg.om=-3.2;hg.crossed=false}sfx.whoosh();
}
function addHinge(hg){
  hinges.push(hg);
  addOb(hg.solid,'wood');obs[obs.length-1].hit=b=>hingeHit(hg,b);
  movers.push((t,dt)=>{
    if(hg.open&&hg.axis==='y'&&hg.t<1){hg.t=Math.min(1,hg.t+dt/hg.dur);
      hg.pg.rotation.y=hg.dir*Math.PI/2*(1-Math.pow(1-hg.t,3)*Math.cos(hg.t*5));if(hg.t>=1)hg.done&&hg.done()}
    else if(hg.open&&hg.axis==='x'&&!hg.rest){swingStep(hg,dt)}
    else if(!hg.open&&hg.wob!==undefined){hg.wob+=dt;const w=Math.sin(hg.wob*18)*Math.exp(-hg.wob*5)*.12;if(hg.axis==='y')hg.pg.rotation.y=w;else hg.pg.rotation.x=-Math.abs(w)}
    hg.sync&&hg.sync()});
}
/* Flip panel as a pendulum: phi 0 = standing, -PI = hanging. It falls over the top and its momentum carries it through the bottom
   and up toward the player (about 86°, then 55°, 36°, 12°…), settling in about 5 s. Light friction while the swings are big, more once
   they are small. Its glass/window is usable from the first pass through the bottom. */
const SWING={k:14,damp:.9,dampSmall:2.5,small:40*Math.PI/180};
function swingStep(hg,dt){
  const n=Math.max(1,Math.ceil(dt/.004)),h=dt/n;
  for(let i=0;i<n;i++){const c=hg.crossed&&hg.amp<SWING.small?SWING.dampSmall:SWING.damp,om0=hg.om;
    hg.om+=(SWING.k*Math.sin(hg.phi)-c*hg.om)*h;hg.phi+=hg.om*h;
    if(!hg.crossed&&hg.phi<=-Math.PI){hg.crossed=true;hg.amp=9;sfx.wood();hg.done&&hg.done()}
    if(hg.crossed&&om0*hg.om<=0)hg.amp=Math.abs(hg.phi+Math.PI)} /* each turning point sets the current swing size */
  if(hg.crossed&&Math.abs(hg.phi+Math.PI)<.025&&Math.abs(hg.om)<.1){hg.phi=-Math.PI;hg.rest=true}
  hg.pg.rotation.x=hg.phi;
}
/* house level: spin boards in front of the windows listed in L.spin (pane indexes) */
function buildSpins(L){
  L.spin.forEach(i=>{const p=panes[i],z=1.7,w=p.w+.9,h=p.h+.7;p.aimOff=true;
    const pg=new T.Group();pg.position.set(p.x,p.y,z);group.add(pg);
    const solid=box(w,h,.16,0xb07a46,0,0,0,pg);[-1,1].forEach(s=>{box(w-.2,.06,.02,0x8a5f3b,0,s*h*.3,.09,pg,false);const d=new T.Mesh(new T.CircleGeometry(.24,20),bmat(0xffc53a));d.position.set(s*(w/2-.42),0,.09);pg.add(d)}); /* yellow spots near the edges: hit here */
    const pole=new T.Mesh(new T.CylinderGeometry(.1,.1,p.y+h/2+.5,10),mat(0x5f6b80));pole.position.set(p.x,(p.y+h/2+.5)/2,z);pole.castShadow=true;group.add(pole);
    [-1,1].forEach(s=>{const bolt=new T.Mesh(new T.CylinderGeometry(.2,.2,.24,12),mat(0x3a3a44));bolt.position.set(0,s*h/2,0);pg.add(bolt)});
    addHinge({axis:'y',pg,solid,w,h,need:.3,dur:.55,aim:{x:p.x+w*.3,y:p.y,z:z+.1,w:w*.4,h:h*.8,vx:0},done:()=>{p.aimOff=false}})});
}
/* field level: panels on one bar. L.flip:{bar:{y,z},items:[{x}],w,h,win:{y,z,w,h} (a window behind each panel) | glass:true (glass on the back)} */
function buildFlips(L){
  const o=L.flip,by=o.bar.y,bz=o.bar.z,w=o.w,h=o.h,xs=o.items.map(a=>a.x),x0=Math.min(...xs)-w/2-.6,x1=Math.max(...xs)+w/2+.6;panes=[];
  const bar=new T.Mesh(new T.CylinderGeometry(.13,.13,x1-x0,12),mat(0x5f6b80));bar.rotation.z=Math.PI/2;bar.position.set((x0+x1)/2,by,bz);bar.castShadow=true;group.add(bar);
  [x0,x1].forEach(x=>{box(.26,by+.2,.26,0x8a5f3b,x,(by+.2)/2,bz,group);box(.3,.14,1.6,0x704b2c,x,.07,bz,group)});
  const zc=23; /* camera distance: each hidden window is lined up with its panel as seen from the camera */
  o.items.forEach(it=>{
    const pg=new T.Group();pg.position.set(it.x,by,bz);group.add(pg);
    const solid=box(w,h,.16,0xb07a46,0,h/2,0,pg);[.25,.5,.75].forEach(k=>box(w-.16,.06,.02,0x8a5f3b,0,h*k,.09,pg,false));
    const d=new T.Mesh(new T.CircleGeometry(.26,20),bmat(0xffc53a));d.position.set(0,h-.45,.09);pg.add(d); /* hit here: near the top */
    [-1,1].forEach(s=>box(.3,.3,.3,0x3a3a44,s*(w/2-.3),0,0,pg)); /* hinge knuckles on the bar */
    const hg={axis:'x',pg,solid,w,h,need:.45,aim:{x:it.x,y:by+h*.72,z:bz+.1,w:w*.8,h:h*.4,vx:0}};
    if(o.glass){const q={w:w-.5,h:h-.5,stop:true,locked:true},sg=new T.Group();sg.position.set(0,h/2,-.1);sg.rotation.y=Math.PI;pg.add(sg);
      q.x=0;q.y=0;makeFrame(q,sg,0xfffaf0);makePane(q,sg);q.mesh.position.z=.03;q.sg=sg;syncPane(q);panes.push(q);
      hg.sync=()=>syncPane(q);hg.done=()=>{q.locked=false;syncPane(q)}}
    else{const v=o.win,q={w:v.w,h:v.h,stop:true,aimOff:true},wx=it.x*(zc-v.z)/(zc-bz),pos=new T.Vector3(wx,v.y,v.z);freeStand(q,pos);panes.push(q);
      [-1,1].forEach(s=>{box(.22,v.y-v.h/2,.22,0x8a5f3b,wx+s*(v.w/2+.1),(v.y-v.h/2)/2,v.z+.1,group);box(.24,.14,1.2,0x704b2c,wx+s*(v.w/2+.1),.07,v.z+.1,group)});
      hg.done=()=>{q.aimOff=false}}
    addHinge(hg)});
}

/* ---------- Shutters level only: on the very first kick of the session's first attempt, if the ball is really headed for
   the open left window, its shutter comes down just in time (a one-off gotcha). After that the cycle runs as normal. ---------- */
let shutTrickSeen=false,shutTrick=false;
function armShutTrick(L){shutTrick=false;if(L.name!=='Shutters'||shutTrickSeen)return;shutTrickSeen=true;shutTrick=true}
function shutTrickStep(b){
  if(!shutTrick||used>1){shutTrick=false;return}
  if(b.state!=='fly'||b.v.z>-1||b.p.z>D*.7)return;
  const p=panes[0],tA=(b.p.z-ZF)/-b.v.z,g=S.gravity,px=b.p.x+b.v.x*tA,py=b.p.y+b.v.y*tA-.5*g*tA*tA;
  shutTrick=false; /* decided once, on this ball */
  if(p.broken||!p.shutter||p.shutF>0||Math.abs(px-p.x)>p.w/2+.2||Math.abs(py-p.y)>p.h/2+.2)return;
  const u=.48-Math.max(0,tA-.08)/SH_T;p.shutter=Object.assign({},p.shutter,{phase:u-lt/SH_T}); /* fully shut just before the ball arrives (a copy: the level data stays as it is for retries) */
}

/* ---------- gantry: a beam on two poles that hanging rail windows ride along ---------- */
function buildGantry(o){
  const g=group,c=0x5f6b80;
  [-1,1].forEach(s=>{addOb(box(.36,o.y,.36,c,s*o.x,o.y/2,.1,g),'metal');box(1.4,.14,1.4,0x4a5466,s*o.x,.07,.1,g)});
  addOb(box(o.x*2+.36,.34,.34,c,0,o.y,.1,g),'metal');
}

/* ---------- roaming shutter: one roller shutter that covers one window at a time (a ball that reaches it clangs off).
   Every window has a housing; the shutter moves only when a window breaks: it rolls up, then comes down over another
   unbroken window. With one window left it rolls up and stays up. Windows with their own shutter are left alone. ---------- */
let roam=null;
const roamOn=p=>!!roam&&p.rf>0;
const ROAM={wait:.45,up:.45,down:.45};
function buildRoam(){
  const list=panes.filter(p=>!p.xf&&!p.shutter);
  list.forEach(p=>{
    const top=p.y+p.h/2,bh=.26,n=Math.ceil(p.h/bh)+1,bars=[];
    for(let j=0;j<n;j++){const m=box(p.w+.12,bh*.95,.07,j%2?0x9aa6b8:0x8793a6,p.x,top,.3,group,false);m.visible=false;bars.push(m)}
    p.rHous=box(p.w+.5,.46,.56,0x5f6b80,p.x,top+.2,.36,group);p.rBars=bars;p.rf=0;p.shutF=0;p.shutY=top});
  roam={list,pane:null,next:null,phase:'idle',t:0,broken:0,again:false};
  const start=roamPick(null);if(start){start.rf=1;roam.pane=start}
  movers.push((t,dt)=>{const r=roam;
    const bc=panes.filter(p=>p.broken).length;
    if(bc!==r.broken){r.broken=bc;if(r.phase==='idle'){r.phase='wait';r.t=0}else r.again=true}
    if(r.phase!=='idle'){r.t+=dt;
      if(r.phase==='wait'&&r.t>=ROAM.wait){r.phase='up';r.t=0;if(r.pane&&!r.pane.broken&&!won)sfx.rattleS()}
      else if(r.phase==='up'){if(r.pane)r.pane.rf=Math.max(0,1-r.t/ROAM.up);
        if(r.t>=ROAM.up){if(r.pane)r.pane.rf=0;const prev=r.pane;r.pane=null;r.next=won?null:roamPick(prev);r.phase=r.next?'down':'idle';r.t=0;if(r.next)sfx.rattleS()}}
      else if(r.phase==='down'){r.next.rf=Math.min(1,r.t/ROAM.down);if(r.t>=ROAM.down){r.next.rf=1;r.pane=r.next;r.next=null;r.phase='idle'}}
      if(r.phase==='idle'&&r.again){r.again=false;r.phase='wait';r.t=0}}
    list.forEach(p=>{const top=p.y+p.h/2,bh=.26;
      if(p.broken){p.rHous.visible=false;p.rBars.forEach(m=>m.visible=false);p.shutF=0;return}
      const e=p.rf*p.rf*(3-2*p.rf),yb=top-e*p.h;p.shutF=e;p.shutY=yb;
      p.rBars.forEach((m,j)=>{const cy=yb+(j+.5)*bh;m.position.y=cy;m.visible=e>.003&&cy-bh/2<top})});
  });
}
/* Next window for the shutter: a random unbroken one other than where it was; none when only one window is left. */
function roamPick(prev){
  if(panes.filter(p=>!p.broken).length<2&&prev)return null;
  const c=roam.list.filter(p=>!p.broken&&p!==prev&&!(p.armor>0));
  const pool=c.length?c:roam.list.filter(p=>!p.broken&&p!==prev);
  return pool.length?pool[(Math.random()*pool.length)|0]:null;
}

/* ---------- island hop, in two steps: break the glass frames on the near island; each frame clears away with its glass;
   once they're all gone, input pauses and the view flies to that island, then kick at the house on the far one.
   Built in final (stage 2) coordinates; during stage 1 the whole level group sits hop.S further back. ---------- */
const waterTex=canvasTex(128,128,(g,w,h)=>{g.fillStyle='#3aa6d8';g.fillRect(0,0,w,h);g.strokeStyle='rgba(255,255,255,.3)';g.lineWidth=3;g.lineCap='round';
  for(let i=0;i<9;i++){const x=Math.random()*w,y=Math.random()*h;g.beginPath();g.moveTo(x,y);g.quadraticCurveTo(x+10,y-6,x+22,y);g.stroke()}});
waterTex.wrapS=waterTex.wrapT=T.RepeatWrapping;waterTex.repeat.set(70,70);
let hop=null;
const hopBusy=()=>(!!hop&&hop.stage>1&&hop.stage<2)||(!!behind&&!behind.done); /* input is paused during the flight and the From Behind intro */
function palm(x,z,s,par){
  const g=new T.Group();g.position.set(x,0,z);g.scale.setScalar(s);g.rotation.y=rnd(0,6);par.add(g);
  for(let i=0;i<6;i++){const m=new T.Mesh(new T.CylinderGeometry(.17-i*.012,.2-i*.012,.7,8),mat(i%2?0x9a6b43:0x8a5f3b));m.position.set(i*i*.025,.35+i*.66,0);m.rotation.z=-i*.05;m.castShadow=true;g.add(m)}
  const top=new T.Vector3(.9,4.05,0);
  for(let k=0;k<7;k++){const f=new T.Group();f.position.copy(top);f.rotation.y=k/7*Math.PI*2;g.add(f);const l=box(1.9,.06,.5,k%2?0x4fa04a:0x3f8f3e,.9,0,0,f);l.rotation.z=-.42}
}
function buildIslands(L){
  const g=group,S2=D+1;
  const water=new T.Mesh(new T.PlaneGeometry(420,420),new T.MeshLambertMaterial({map:waterTex}));water.rotation.x=-Math.PI/2;water.position.set(0,-.08,-60);water.receiveShadow=true;g.add(water);
  const isl=[{x:0,z:D+S2,r:3.6,s:3.6},{x:0,z:D,r:4.6,s:4.6},{x:0,z:-3,r:11,s:6.5}],cg=new T.CylinderGeometry(1,1.15,1,40);
  isl.forEach(i=>{const sd=new T.Mesh(cg,mat(0xf0d9a0));sd.scale.set(i.r+.6,.6,i.s+.6);sd.position.set(i.x,-.295,i.z);sd.receiveShadow=true;g.add(sd);
    const gr=new T.Mesh(cg,mat(0x62ac47));gr.scale.set(i.r,.6,i.s);gr.position.set(i.x,-.29,i.z);gr.receiveShadow=true;g.add(gr)});
  /* the near island's glass frames, built so they stand on the wall plane (world z 0) during step one */
  const first=(L.first||[]).map(p=>Object.assign({},p));
  first.forEach(p=>{const sg=new T.Group();sg.position.set(p.x,0,S2);g.add(sg);const x=p.x;p.x=0;makeFrame(p,sg,0xfffaf0);makePane(p,sg);p.x=x;standLegs(p,sg);p.sg=sg;p.clearT=0});
  palm(-9,-1,1.1,g);palm(9.2,-2.5,1.25,g);palm(-7,-7,1,g);palm(-3.3,D-2.4,.8,g);palm(4.2,D-1.8,.7,g);palm(-3.4,D+S2-1.8,.7,g);
  hop={stage:1,S:S2,isl,t:0,first,house:null};g.position.z=-S2;
  movers.push((t,dt)=>{
    waterTex.offset.set(t*.01,t*.004);
    /* a frame whose glass is gone tips over backwards and clears away, so the island is free to stand on */
    first.forEach(p=>{if(!p.broken||!p.sg.visible)return;p.clearT+=dt;const k=clamp((p.clearT-.5)/.4,0,1);if(k<=0)return;
      if(!p.cleared){p.cleared=true;shards.forEach(s=>{if(s.pane===p&&s.delay>0)s.delay=.001});for(let i=0;i<22;i++)dust.emit(p.x+rnd(-1,1),.2,rnd(-.8,.2),rnd(-2,2),rnd(.4,2.4),rnd(-2,1),rnd(.3,.6),[.92,.8,.6],3);sfx.wood()}
      p.sg.rotation.x=-k*k*1.45;p.sg.scale.setScalar(Math.max(.001,1-Math.max(0,k-.6)/.4));if(k>=1)p.sg.visible=false});
    if(hop.stage===1.4){hop.t+=dt;if(hop.t<1.05)return;
      balls.forEach(removeBallMesh);balls.length=0;if(cur){removeBallMesh(cur);cur=null}
      hop.stage=1.5;hop.t=0;spot.visible=false;sfx.whoosh()}
    if(hop.stage!==1.5)return;
    hop.t+=dt;const k=clamp(hop.t/1.5,0,1),e=k<.5?2*k*k:1-Math.pow(2-2*k,2)/2;
    const nz=-S2*(1-e),dz=nz-g.position.z;g.position.z=nz;camOff.y=Math.sin(Math.PI*k)*2.4;shards.forEach(s=>{s.m.position.z+=dz;s.m.scale.setScalar(Math.max(.001,1-k))}); /* the broken glass rides along and shrinks away, leaving the island clear */
    if(k>=1){shards.forEach(s=>{scene.remove(s.m);s.m.geometry.dispose()});shards.length=0;hop.stage=2;panes=hop.house;camOff.y=0;spot.visible=true;spawnBall()}
  });
}
/* Which island is under (x,z)? -1 means water. */
function isleAt(x,z){const gz=group.position.z;return hop.isl.findIndex(i=>{const a=(x-i.x)/(i.r+.5),c=(z-i.z-gz)/(i.s+.5);return a*a+c*c<=1})}
/* Called when a ball reaches the ground on the island level. Returns true when the ball went into the water. */
function isleTouch(b){
  if(b.sunk)return true;
  const i=isleAt(b.p.x,b.p.z);
  if(i<0){sinkBall(b);return true}
  return false;
}
function sinkBall(b){b.sunk=true;b.live=false;b.state='sunk';b.age=Math.max(b.age,1.3);b.v.set(b.v.x*.1,-.9,b.v.z*.1);b.a.set(0,-1.2,0);
  for(let k=0;k<44;k++)dust.emit(b.p.x,0,b.p.z,rnd(-2.6,2.6),rnd(2,6.5),rnd(-2.6,2.6),rnd(.4,.8),[.85,.95,1],13);sfx.splash()}
/* All the near island's glass is broken: pause input and start the flight (the mover above runs it). */
function hopStart(){hop.stage=1.4;hop.t=0;if(drag){drag=null;hidePreview()}if(cur){removeBallMesh(cur);cur=null}}

/* ---------- aim help targets: open windows, plus the switch while it is still up ---------- */
let sw=null,pads=[];
function aimTargets(){
  const a=[];
  panes.forEach(p=>{if(p.broken||p.locked||p.sky||p.oneWay||p.narrow||p.aimOff||p.awn||(p.front&&!p.front.broken)||roamOn(p)||(p.shutter&&p.shutter.lock&&p.unlockT===undefined))return;
    if(revolver&&p.moving&&p.c){_tv.copy(p.c).sub(revolver.rot.position).applyAxisAngle(_ty,revolver.om*.55).add(revolver.rot.position);a.push({x:_tv.x,y:_tv.y,z:_tv.z,w:p.w,h:p.h,vx:0});return} /* revolving door: lead the wing by ~0.55 s of turn */
    a.push({x:p.c?p.c.x:p.x,y:p.c?p.c.y:p.y,z:p.c?p.c.z:ZF,w:p.w,h:p.h,vx:p.vx||0})});
  if(revolver){const f=revFront();if(f.some(w=>!w.p.broken)){const c=revolver.rot.position,w0=revolver.wings[0].p;a.push({x:c.x,y:w0.c.y,z:c.z+.5,w:.9,h:w0.h,vx:0})}} /* open V: pull toward its corner */
  if(sw&&!sw.done)a.push({x:sw.x,y:sw.y,z:sw.z+.3,w:1.7,h:1.7,vx:0});
  if(garage&&!garage.pressed)a.push({x:garage.btn.x,y:garage.btn.y,z:.7,w:1.3,h:1.3,vx:0}); /* the garage button */
  hinges.forEach(hg=>{if(!hg.open&&hg.aim)a.push(hg.aim)}); /* a closed blocker: aim at the spot that swings it */
  if(tunnel&&!tunnel.p.broken)a.push({x:tunnel.x,y:tunnel.cy,z:tunnel.zm,w:tunnel.w,h:tunnel.h,vx:0}); /* deep frame: aim at the mouth */
  panes.forEach(p=>{if(p.awn&&!p.broken)a.push({x:p.x,y:p.y-p.h/2-.8,z:1,w:p.w+.7,h:.9,vx:0})}); /* awnings: aim at the awning, not the meshed glass */
  if(behind)behind.reb.forEach(r=>{if(!r.p.broken&&r.q.broken)a.push({x:r.x,y:r.y,z:.4,w:r.w,h:r.h,vx:0})}); /* an open trampoline */
  return a;
}

/* ---------- switch: a bullseye on the gable. Hit it and the locked shutters roll up. ---------- */
function buildSwitch(o){
  const g=group,face=new T.Group();face.position.set(o.x,o.y,o.z+.11);g.add(face);
  sw=Object.assign({done:false,face},o);
  const solid=box(1.8,1.8,.2,0xfff8e8,o.x,o.y,o.z,g);solid.visible=false;addOb(solid,'wood');obs[obs.length-1].hit=hitSwitch;
  [[.9,0xfff8e8],[.72,0xd9503f],[.52,0xfff8e8],[.32,0xd9503f],[.13,0xfff8e8]].forEach((r,i)=>{const m=new T.Mesh(new T.CircleGeometry(r[0],36),bmat(r[1]));m.position.z=i*.004;face.add(m)});
  const rim=new T.Mesh(new T.TorusGeometry(.9,.07,8,36),mat(0x23304a));face.add(rim);
}
function hitSwitch(b){
  if(sw.done)return;sw.done=true;
  sfx.ding();addShake(.25);
  for(let i=0;i<50;i++)spark.emit(sw.x,sw.y,sw.z+.4,rnd(-5,5),rnd(-3,6),rnd(0,5),rnd(.3,.7),[1,.85,.3],6);
  sw.face.children.forEach((m,i)=>{if(m.material.color&&i%2===1)m.material=bmat(0x4fbf5a)});
  panes.forEach(p=>{if(p.shutter&&p.shutter.lock)p.unlockT=lt+.25});
}

/* ---------- garage: a closed roller shutter with a big push button beside it. Kick the button (any time) and the shutter
   rolls up and the light comes on: an SUV is parked nose-in, and its big rear window is the last target. Nothing hints
   at the car before that. The interior uses unlit materials like the rooms, dim until the light comes on. ---------- */
let garage=null;
const hazardTex=canvasTex(64,64,(c,w,h)=>{c.fillStyle='#ffc53a';c.fillRect(0,0,w,h);c.fillStyle='#23304a';c.save();c.translate(w/2,h/2);c.rotate(-Math.PI/4);for(let i=-5;i<=5;i++)c.fillRect(i*14,-w,7,w*2);c.restore()});
function buildGarage(L){
  const g=group,o=L.garage,gx=o.x,gw=o.w,gh=o.h,dp=6.2,x0=gx-gw/2,x1=gx+gw/2,zc=-.2-dp/2;
  const ga={x:gx,w:gw,h:gh,f:1,shutY:0,openT:-1,pressed:false,btn:o.btn,lit:[],litDone:false};garage=ga;
  const im=c=>{const m=new T.MeshBasicMaterial({color:c});m.userData.c=new T.Color(c);m.color.multiplyScalar(.2);ga.lit.push(m);return m};
  /* inside: floor, back wall, side walls, ceiling, a shelf with paint tins, the ceiling light */
  const fl=new T.Mesh(new T.PlaneGeometry(gw,dp),im(0x8d8f94));fl.rotation.x=-Math.PI/2;fl.position.set(gx,.015,zc);g.add(fl);
  box(gw,gh,.1,im(0xb9b4aa),gx,gh/2,-.2-dp,g,false);
  [x0,x1].forEach((x,i)=>addOb(box(.1,gh,dp,im(i?0xc9c3b6:0xa9a397),x+(i?-.05:.05),gh/2,zc,g,false),'wall'));
  addOb(box(gw,.1,dp,im(0x9d978b),gx,gh+.05,zc,g,false),'wall');
  box(.4,.06,2.2,im(0x7a5a3a),x0+.3,1.7,-3.4,g,false);
  [[0xd9503f,-2.7],[0x2f6fd0,-3.2],[0xffc53a,-3.9]].forEach(([c,z])=>{const t=new T.Mesh(new T.CylinderGeometry(.13,.13,.3,12),im(c));t.position.set(x0+.3,1.88,z);g.add(t)});
  box(1.8,.08,.16,im(0xfffbe8),gx,gh-.06,-2.8,g,false);
  /* driveway in front */
  const dw=new T.Mesh(new T.PlaneGeometry(gw+.4,4.2),mat(0xb8b4ac));dw.rotation.x=-Math.PI/2;dw.position.set(gx,.012,2.1);dw.receiveShadow=true;g.add(dw);
  /* the shutter: slats roll up into the housing */
  const bh=.28,n=Math.ceil(gh/bh)+1,bars=[];
  for(let j=0;j<n;j++)bars.push(box(gw+.1,bh*1.08,.08,j%2?0xa7b0bf:0x95a0b2,gx,0,j%2?.27:.26,g,false)); /* overlapping, no gaps: nothing of the car may show through */
  box(.7,.09,.09,0x3a3a44,0,-.02,.07,bars[0],false); /* handle on the bottom slat */
  box(gw+.5,.5,.56,0x5f6b80,gx,gh+.25,.34,g);
  [x0-.07,x1+.07].forEach(x=>box(.14,gh,.2,0x5f6b80,x,gh/2,.24,g));
  /* the push button: hazard plate, collar, red dome */
  const B=o.btn,bg=new T.Group();bg.position.set(B.x,B.y,.16);g.add(bg);
  box(1.3,1.3,.1,0x23304a,0,0,.05,bg);
  const plate=new T.Mesh(new T.PlaneGeometry(1.16,1.16),new T.MeshLambertMaterial({map:hazardTex}));plate.position.z=.105;bg.add(plate);
  const col=new T.Mesh(new T.CylinderGeometry(.42,.46,.2,24),mat(0x23304a));col.rotation.x=Math.PI/2;col.position.z=.2;bg.add(col);
  const dome=new T.Mesh(new T.SphereGeometry(.36,20,12,0,Math.PI*2,0,Math.PI/2),mat(0xe0352b));dome.rotation.x=Math.PI/2;dome.position.z=.3;bg.add(dome);
  const solid=box(1.3,1.3,.5,0x000000,B.x,B.y,.41,g,false);solid.visible=false;addOb(solid,'metal');
  obs[obs.length-1].hit=()=>{if(ga.pressed)return;ga.pressed=true;ga.openT=lt+.35;
    dome.material=mat(0x4fbf5a);dome.position.z=.2;sfx.click();sfx.ding();later(.35,()=>sfx.rattle());addShake(.2);
    for(let i=0;i<40;i++)spark.emit(B.x,B.y,.7,rnd(-4,4),rnd(-2,5),rnd(0,4),rnd(.3,.6),[1,.85,.3],6)};
  /* the SUV, parked nose-in: z 0 of its group is the tailgate */
  const car=new T.Group();car.position.set(gx,0,-.6);g.add(car);const red=0xc8372d,blk=0x23232b;
  addOb(box(2.5,1,4.6,red,0,.85,-2.3,car),'metal');
  box(2.62,.3,.28,blk,0,.5,.06,car);
  [-1,1].forEach(s=>{box(.34,.52,.06,bmat(0xff3b30),s*1.02,1.08,.03,car,false);box(.34,.12,.06,bmat(0xffb03a),s*1.02,.76,.03,car,false);
    box(.16,1.42,.18,red,s*1.13,2.05,-.12,car);addOb(box(.12,1.4,3.3,red,s*1.19,2.05,-1.85,car),'metal');
    [-.95,-3.7].forEach(z=>{const w=new T.Mesh(new T.CylinderGeometry(.46,.46,.34,18),mat(blk));w.rotation.z=Math.PI/2;w.position.set(s*1.16,.46,z);car.add(w)})});
  box(.9,.26,.04,0xf7f3e3,0,.86,.03,car,false);
  box(2.42,.16,.2,red,0,2.74,-.16,car);addOb(box(2.4,.12,3.3,red,0,2.76,-1.85,car),'metal');
  box(2.3,.08,.36,blk,0,2.86,-.16,car);
  /* inside the cabin: dark lining, rear seat with headrests (stops a ball that goes through the broken window) */
  const lin=new T.Mesh(new T.PlaneGeometry(2.3,1.4),bmat(0x1c1d26));lin.position.set(0,2.05,-3.45);car.add(lin);
  addOb(box(2.2,.95,.45,0x34353f,0,1.82,-1.5,car),'wall');[-.6,.6].forEach(x=>box(.5,.32,.22,0x34353f,x,2.45,-1.5,car));
  /* the rear window: a free pane, tilted back a little; locked (not hittable, not aimed at) until the shutter is up */
  const p={x:0,y:0,w:2.1,h:1.3,locked:true,miss:{x:B.x,y:B.y,w:1.3,h:1.3}},sg=new T.Group();sg.position.set(0,2.02,-.12);sg.rotation.x=-.12;car.add(sg);
  [[0,.69,2.26,.08],[0,-.69,2.26,.08],[-1.09,0,.08,1.3],[1.09,0,.08,1.3]].forEach(([x,y,w,h])=>box(w,h,.06,0x15151b,x,y,-.01,sg,false));
  makePane(p,sg);p.mesh.position.z=.01;
  const wip=box(1,.05,.04,0x15151b,-.1,-.5,.05,sg,false);wip.rotation.z=.22;p.extra=[wip];
  p.sg=sg;syncPane(p);panes.push(p);ga.car=p;
  movers.push(t=>{
    let f=1;if(ga.openT>=0){const u=clamp((t-ga.openT)/1.6,0,1);f=1-u*u*(3-2*u)}
    ga.f=f;const yb=gh-f*gh;ga.shutY=yb;
    bars.forEach((m,j)=>{const cy=yb+(j+.5)*bh;m.position.y=cy;m.visible=f>.003&&cy-bh/2<gh});
    if(p.locked&&f<.6)p.locked=false;
    if(ga.openT>=0&&!ga.litDone){const k=clamp((t-ga.openT-.3)/.6,0,1),fk=k<1&&Math.sin(t*55)>.3?.35:1,v=.2+.8*k*fk;
      ga.lit.forEach(m=>m.color.copy(m.userData.c).multiplyScalar(v));if(k>=1)ga.litDone=true}});
}
/* A ball reaching the wall plane in the garage opening: the shutter clangs it back, or it flies on inside. */
function garageCross(b,x,y){const ga=garage;if(Math.abs(x-ga.x)>ga.w/2||y>ga.h)return false;
  if(y>ga.shutY-R*.3)wallHit(b,'clang');return true}

/* ---------- bounce pad: a ball that lands on it is launched at the lowest open window in its lane ---------- */
function buildPad(o){
  const g=group,pg=new T.Group();pg.position.set(o.x,0,o.z);g.add(pg);
  const r=o.r||1.15,top=.45;
  for(let k=0;k<6;k++){const a=k/6*Math.PI*2;box(.1,top,.1,0x3a3a44,Math.cos(a)*r*.92,top/2,Math.sin(a)*r*.92,pg)}
  const rim=new T.Mesh(new T.TorusGeometry(r,.11,8,32),mat(0xd9503f));rim.rotation.x=Math.PI/2;rim.position.y=top;rim.castShadow=true;pg.add(rim);
  const matM=new T.Mesh(new T.CircleGeometry(r-.08,32),mat(0x2f6fd0));matM.rotation.x=-Math.PI/2;matM.position.y=top-.01;pg.add(matM);
  const st=new T.Mesh(new T.RingGeometry(.35,.5,24),bmat(0xffc53a));st.rotation.x=-Math.PI/2;st.position.y=top;pg.add(st);
  const pd={x:o.x,z:o.z,r,top,t:9,mat:matM,st};pads.push(pd);
  movers.push((t,dt)=>{pd.t+=dt;const k=pd.t<.5?Math.sin(pd.t*28)*Math.exp(-pd.t*7):0;matM.position.y=top-.01-k*.18;st.position.y=matM.position.y+.01;st.material.color.setHex(Math.sin(t*6)>0?0xffc53a:0xfff8e8)});
}
/* The whole lane of a pad counts: a ball lined up with a pad (left-right) that would drop short of the wall, or that hits the wall,
   is sent onto the pad. Balls that clear the wall, or are outside both lanes, are left alone. */
let padWall=null;
const padLane=b=>pads.find(pd=>Math.abs(b.p.x-pd.x)<=pd.r+.3);
function padAim(b,pd,Tt){const g=S.gravity;b.live=false;b.a.set(0,-g,0);b.padLock=pd;b.v.set((pd.x-b.p.x)/Tt,(pd.top+R-b.p.y+.5*g*Tt*Tt)/Tt,(pd.z-b.p.z)/Tt)}
function padWallHit(b){if(!pads.length||b.padded)return;const pd=padLane(b);if(pd)padAim(b,pd,.75)}
function padCatch(b){
  if(b.padded||b.padLock||!padWall||b.v.y>=0||b.p.z<padWall.z+R||b.p.z>pads[0].z+4.5)return;
  const pd=padLane(b);if(!pd)return;const g=S.gravity,vz=b.v.z;
  if(vz<-.1){const t=(b.p.z-padWall.z)/-vz;if(b.p.y+b.v.y*t-.5*g*t*t>padWall.top+R)return} /* clears the wall: it's going for the upper windows */
  const dy=b.p.y-pd.top-R;if(dy<=0)return;
  padAim(b,pd,Math.max(.15,(b.v.y+Math.sqrt(b.v.y*b.v.y+2*g*dy))/g));
}
function padHit(b){
  if(!pads.length||b.ghost||b.sunk||b.state==='inside'||b.state==='dead')return;
  padCatch(b);if(b.v.y>1)return;
  for(const pd of pads){const dx=b.p.x-pd.x,dz=b.p.z-pd.z;if(dx*dx+dz*dz>pd.r*pd.r||b.p.y>pd.top+R)continue;
    let best=null;panes.forEach(p=>{if(p.broken||roamOn(p)||p.xf||Math.abs(p.x-pd.x)>3)return;if(!best||p.y<best.y)best=p});
    const g=S.gravity,Tt=1.3;b.p.y=pd.top+R;b.live=false;b.state='fly';b.age=0;b.a.set(0,-g,0);b.padded=true;b.padLock=null;
    if(best)b.v.set((best.x-b.p.x)/Tt,(best.y-b.p.y+.5*g*Tt*Tt)/Tt,(ZF-.3-b.p.z)/Tt);else b.v.set(b.v.x*.5,13,Math.min(b.v.z,-4));
    pd.t=0;sfx.boing();for(let i=0;i<16;i++)dust.emit(b.p.x,pd.top,b.p.z,rnd(-2,2),rnd(.5,2),rnd(-2,2),rnd(.2,.4),[.95,.95,1],2);
    return}
}

/* ---------- garden wall in front of the house: hides the lower windows, so they need the pads ---------- */
const brickTex=canvasTex(128,64,(g,w,h)=>{g.fillStyle='#d8d0c0';g.fillRect(0,0,w,h);g.fillStyle='#b9553f';for(let r=0;r<4;r++)for(let c=-1;c<4;c++)g.fillRect(c*32+(r%2?16:0)+2,r*16+2,28,12)});
brickTex.wrapS=brickTex.wrapT=T.RepeatWrapping;
function buildGardenWall(L){
  const o=L.gwall,w=L.W*2+4,t=brickTex.clone();t.needsUpdate=true;t.repeat.set(w/2,o.h/1);
  addOb(box(w,o.h,.5,new T.MeshLambertMaterial({map:t}),0,o.h/2,o.z,group),'wall');obs[obs.length-1].hit=padWallHit;padWall={z:o.z+.25,top:o.h};
  box(w+.3,.18,.7,0xbfb3a0,0,o.h+.09,o.z,group);
}

/* ---------- mansion towers at both sides ---------- */
function buildTowers(L){
  [-1,1].forEach(s=>{const x=s*(L.W+1.3),h=L.H-.4;
    addOb(box(2.4,h,2.4,0xe9c08f,x,h/2,-1.2,group),'wall');
    const c=new T.Mesh(new T.ConeGeometry(2,2.6,4),mat(0x6d4a8f));c.rotation.y=Math.PI/4;c.position.set(x,h+1.3,-1.2);c.castShadow=true;group.add(c);
    box(.08,1.2,.08,0x23304a,x,h+3.1,-1.2,group,false);box(.7,.4,.03,0xffc53a,x+.35,h+3.5,-1.2,group,false);
    [h*.35,h*.7].forEach(y=>{box(.7,1,.1,0x2b2230,x,y,.03,group,false);box(.9,.12,.2,0xfffaf0,x,y-.56,.05,group,false)})});
}

/* ---------- night (memory level): the house is near-black, a lighthouse in front of it at the left sweeps its beam
   across the front every few seconds and the windows only show while the beam is on them. Remember where they are.
   The first sweep is slow so the player gets a fair first look. A broken window's room stays lit. ---------- */
const dayBg=scene.background,nightBg=canvasTex(8,256,(g,w,h)=>{const a=g.createLinearGradient(0,0,0,h);a.addColorStop(0,'#070b22');a.addColorStop(.6,'#1b2550');a.addColorStop(.78,'#3b3f6e');g.fillStyle=a;g.fillRect(0,0,w,h)});
const starPts=(function(){const n=260,pos=new Float32Array(n*3);for(let i=0;i<n;i++){const a=rnd(-1.4,1.4),e=rnd(.12,1.1);pos[i*3]=Math.sin(a)*Math.cos(e)*150;pos[i*3+1]=Math.sin(e)*150;pos[i*3+2]=-Math.cos(a)*Math.cos(e)*150}
  const g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(pos,3));const p=new T.Points(g,new T.PointsMaterial({color:0xffffff,size:1.1,map:dot,transparent:true,depthWrite:false}));p.visible=false;scene.add(p);return p})();
const moon=new T.Mesh(new T.CircleGeometry(6,32),bmat(0xfff6d8));moon.position.set(45,52,-140);moon.visible=false;scene.add(moon);
function setNight(on){
  scene.background=on?nightBg:dayBg;starPts.visible=moon.visible=on;clouds.forEach(c=>c.visible=!on);
  hemi.intensity=on?.12:.72;hemi.color.setHex(on?0x8090c8:0xffffff);sun.intensity=on?.07:.72;sun.castShadow=!on; /* hidden sills would still cast shadows and give windows away */sun.color.setHex(on?0x9fb0ff:0xfff1d6);
}
/* beam texture: soft across its width, fading along its length */
const beamTex=canvasTex(64,128,(g,w,h)=>{const im=g.createImageData(w,h);for(let y=0;y<h;y++)for(let x=0;x<w;x++){const u=(x+.5)/w,v=(y+.5)/h,a=Math.pow(Math.sin(Math.PI*u),1.6)*(1-.6*v),k=(y*w+x)*4;im.data[k]=255;im.data[k+1]=242;im.data[k+2]=190;im.data[k+3]=a*255}g.putImageData(im,0,0)});
const poolTex=canvasTex(128,128,(g,w,h)=>{const a=g.createRadialGradient(64,64,0,64,64,64);a.addColorStop(0,'rgba(255,240,190,.9)');a.addColorStop(.5,'rgba(255,236,180,.45)');a.addColorStop(1,'rgba(255,230,170,0)');g.fillStyle=a;g.fillRect(0,0,w,h)});
const NIGHT={first:4.5,period:4,sweep:2.6,x0:-12.5,x1:12.5,y:4.2};
/* Where the beam is at time t: u in 0..1 across the house, or null while it points away. */
function beamAt(t){const N=NIGHT;if(t<N.first)return t/N.first;const c=(t-N.first)%N.period;return c<N.sweep?c/N.sweep:null}
function buildNight(L){
  const g=group,lx=-12.5,lz=3.2,lh=10.2;
  for(let i=0;i<5;i++){const m=new T.Mesh(new T.CylinderGeometry(1.15-i*.09,1.25-i*.09,2,16),mat(i%2?0xd9503f:0xfff8e8));m.position.set(lx,1+i*2,lz);m.castShadow=true;g.add(m)}
  box(1.8,.25,1.8,0x23304a,lx,lh-.45,lz,g);
  const lamp=new T.Mesh(new T.SphereGeometry(.5,14,10),bmat(0xfff2b0));lamp.position.set(lx,lh,lz);g.add(lamp);
  const cap=new T.Mesh(new T.ConeGeometry(1.05,1.2,12),mat(0x23304a));cap.position.set(lx,lh+1,lz);g.add(cap);
  const glow=new T.Sprite(new T.SpriteMaterial({map:dot,color:0xfff2b0,transparent:true,depthWrite:false,blending:T.AdditiveBlending}));glow.position.set(lx,lh,lz);glow.scale.setScalar(4.5);g.add(glow);
  /* the beam: a flat strip from the lamp to the wall, turned each frame to face the camera */
  const bg=new T.BufferGeometry(),bp=new Float32Array(12);bg.setAttribute('position',new T.BufferAttribute(bp,3));bg.setAttribute('uv',new T.BufferAttribute(new Float32Array([0,1,1,1,0,0,1,0]),2));bg.setIndex([0,2,1,1,2,3]);
  const beam=new T.Mesh(bg,new T.MeshBasicMaterial({map:beamTex,transparent:true,depthWrite:false,blending:T.AdditiveBlending,side:T.DoubleSide}));beam.frustumCulled=false;g.add(beam);
  const pool=new T.Mesh(new T.PlaneGeometry(5.6,4.6),new T.MeshBasicMaterial({map:poolTex,transparent:true,depthWrite:false,blending:T.AdditiveBlending}));pool.position.z=.3;pool.renderOrder=6;g.add(pool);
  const sl=new T.SpotLight(0xfff2c0,2.6,70,.24,1,1);sl.position.set(lx,lh,lz);g.add(sl);g.add(sl.target);
  const kl=new T.PointLight(0xffd9a0,.9,11);kl.position.set(0,3.2,D+1);g.add(kl);
  /* lights off: an unlit room is dark behind its glass and the glass dims; the frame stays faintly visible.
     Nothing sits in front of the window, so nothing looks like it should stop the ball. */
  panes.forEach(p=>{if(p.xf)return;p.mesh.material=glassMat.clone();
    const dk=new T.Mesh(new T.PlaneGeometry(p.w,p.h),new T.MeshBasicMaterial({color:0x05070f,transparent:true,opacity:.9,depthWrite:false}));dk.position.set(p.x,p.y,-.03);dk.renderOrder=2;g.add(dk);p.dark=dk});
  const A=new T.Vector3(lx,lh,lz),B=new T.Vector3(),dir=new T.Vector3(),side=new T.Vector3(),view=new T.Vector3();
  movers.push(t=>{
    const u=beamAt(t),on=u!==null,I=on?clamp(Math.min(u,1-u)/.07,0,1):0,bx=on?lerp(NIGHT.x0,NIGHT.x1,u):-99;
    B.set(bx,NIGHT.y,.2);sl.target.position.copy(B);sl.intensity=2.6*I;
    beam.visible=pool.visible=I>0;
    if(I>0){dir.subVectors(B,A);view.subVectors(camera.position,A);side.crossVectors(dir,view).normalize();
      const w0=.32,w1=2.5;[[A,-w0],[A,w0],[B,-w1],[B,w1]].forEach((q,i)=>{bp[i*3]=q[0].x+side.x*q[1];bp[i*3+1]=q[0].y+side.y*q[1];bp[i*3+2]=q[0].z+side.z*q[1]});
      bg.attributes.position.needsUpdate=true;beam.material.opacity=.55*I;
      pool.position.x=bx;pool.position.y=NIGHT.y;pool.material.opacity=.42*I}
    panes.forEach(p=>{if(!p.dark)return;const lit=p.broken?1:I*Math.exp(-Math.pow((p.x-bx)/2.8,2));p.dark.material.opacity=.9*(1-lit);p.dark.visible=lit<.995;p.mesh.material.color.setScalar(.18+.82*lit)});
  });
}
/* A new 4-window layout on every attempt (two rows; rooms behind windows must not overlap). */
let nightKey='';
function nightLayout(){
  const slots=[...[-4.7,-2.4,2.4,4.7].map(x=>({x,y:2.5})),...[-4.6,-2.3,0,2.3,4.6].map(x=>({x,y:6}))];
  let pick=[],key='';
  for(let n=0;n<40;n++){pick=[];const all=slots.slice().sort(()=>Math.random()-.5);
    for(const s of all){if(pick.length===4)break;if(pick.some(q=>q.y===s.y&&Math.abs(q.x-s.x)<4.3))continue;pick.push(s)}
    key=pick.map(q=>q.x+','+q.y).sort().join('|');if(pick.length===4&&key!==nightKey)break}
  nightKey=key;
  const props=[['fish',0xcfe0f0],['cake',0xffd7c8],['vase',0xe3d6f2],['tv',0xd9efc6]].sort(()=>Math.random()-.5);
  return pick.map((q,i)=>({x:q.x,y:q.y,w:2.1,h:2,prop:props[i][0],wall:props[i][1]}));
}
