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
  if(o.hit)o.hit(b);
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
  if(L.island)buildIslands(L);
  panes.forEach(p=>{if(p.shutter)buildShutter(p);if(p.armor)buildBoards(p);if(p.hp>1)buildWired(p);if(p.safe)buildCat(p)});
  if(L.mill)buildMill(L.mill);
  if(L.gantry)buildGantry(L.gantry);
  if(L.switch)buildSwitch(L.switch);
  if(L.pads)L.pads.forEach(buildPad);
  if(L.gwall)buildGardenWall(L);
  if(L.towers)buildTowers(L);
  if(L.night)buildNight(L);
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
/* Free-pane hit test (skylight, greenhouse back wall and roof): the ball touches the glass from its front side. */
function skyHit(b){
  if(b.ghost)return;
  for(const p of panes){if(!p.inv||p.broken)continue;_lp.copy(b.p).applyMatrix4(p.inv);
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
  movers.push(t=>{rot.rotation.z=-t*o.speed});
}

/* ---------- gantry: a beam on two poles that hanging rail windows ride along ---------- */
function buildGantry(o){
  const g=group,c=0x5f6b80;
  [-1,1].forEach(s=>{addOb(box(.36,o.y,.36,c,s*o.x,o.y/2,.1,g),'metal');box(1.4,.14,1.4,0x4a5466,s*o.x,.07,.1,g)});
  addOb(box(o.x*2+.36,.34,.34,c,0,o.y,.1,g),'metal');
}

/* ---------- protected window: a cat on the sill. Breaking this glass fails the level. ---------- */
function buildCat(p){
  const g=group,O=0xf29a3a,y0=p.y-p.h/2;
  box(p.w,.1,.7,0xfffaf0,p.x,y0-.05,-.55,g);
  const c=new T.Group();c.position.set(p.x,y0,-.6);g.add(c);
  const sp=(r,col,x,y,z,sx,sy,sz,par)=>{const m=new T.Mesh(new T.SphereGeometry(r,14,10),mat(col));m.position.set(x,y,z);m.scale.set(sx,sy,sz);(par||c).add(m);return m};
  sp(.4,O,0,.38,0,1,1.05,.85);sp(.24,0xfff3e0,0,.34,.2,1,1.1,.6);
  [-1,1].forEach(s=>sp(.13,0xfff3e0,s*.17,.08,.27,1,.6,1.2));
  [-.1,.08].forEach(y=>box(.5,.05,.05,0xc9762a,0,.52+y,-.3,c,false));
  const hd=new T.Group();hd.position.set(0,.92,.05);c.add(hd);
  sp(.3,O,0,0,0,1.1,.95,1,hd);sp(.12,0xfff3e0,0,-.1,.23,1.3,.8,.8,hd);
  [-1,1].forEach(s=>{const e=new T.Mesh(new T.ConeGeometry(.11,.24,4),mat(O));e.position.set(s*.17,.27,0);e.rotation.z=-s*.28;hd.add(e);
    const ey=new T.Mesh(new T.SphereGeometry(.055,8,6),bmat(0x23304a));ey.position.set(s*.11,.04,.27);hd.add(ey);
    [-1,1].forEach(k=>{const w=box(.3,.014,.014,0x23304a,s*.27,-.08+k*.035,.22,hd,false);w.rotation.z=s*k*.18})});
  sp(.045,0xff8fa8,0,-.03,.31,1,1,1,hd);
  const tail=new T.Group();tail.position.set(.3,.12,-.2);c.add(tail);box(.1,.8,.1,O,0,.4,0,tail,false);
  movers.push((t,dt)=>{
    if(p.scared===undefined){hd.rotation.y=Math.sin(t*.8)*.45;hd.rotation.z=Math.sin(t*.5)*.08;tail.rotation.z=-.45+Math.sin(t*2.6)*.35;return}
    p.scared+=dt;const k=p.scared;c.position.y=y0+k*6-k*k*10;c.position.z=-.6-k*5;c.rotation.x=-k*4;tail.rotation.z=-1.4;if(k>.7)c.visible=false});
}
function catScare(p){
  p.scared=0;won=true;failing=true;if(drag){drag=null;hidePreview()}
  sfx.meow();const t=$('toast');t.textContent='Not the cat!';t.hidden=false;
  for(let i=0;i<30;i++)dust.emit(p.x,p.y-p.h/2+.6,-.5,rnd(-2,2),rnd(0,3),rnd(-1,1.5),rnd(.4,.8),[.95,.62,.25],3);
  later(1.6,()=>{failing=false;loadLevel(level)});
}

/* ---------- island hop: kick onto the middle island, the view flies there, then kick at the house.
   Built in final (stage 2) coordinates; during stage 1 the whole level group sits hop.S further back. ---------- */
const waterTex=canvasTex(128,128,(g,w,h)=>{g.fillStyle='#3aa6d8';g.fillRect(0,0,w,h);g.strokeStyle='rgba(255,255,255,.3)';g.lineWidth=3;g.lineCap='round';
  for(let i=0;i<9;i++){const x=Math.random()*w,y=Math.random()*h;g.beginPath();g.moveTo(x,y);g.quadraticCurveTo(x+10,y-6,x+22,y);g.stroke()}});
waterTex.wrapS=waterTex.wrapT=T.RepeatWrapping;waterTex.repeat.set(70,70);
let hop=null;
const hopBusy=()=>!!hop&&hop.stage>1&&hop.stage<2;
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
  /* landing target on the middle island, with a flag to aim at */
  const pad=new T.Group();pad.position.set(0,0,D);g.add(pad);
  [[2.1,2.4,0xffc53a],[1.3,1.6,0xfff8e8]].forEach(a=>{const r=new T.Mesh(new T.RingGeometry(a[0],a[1],40),bmat(a[2]));r.rotation.x=-Math.PI/2;r.position.y=.04;pad.add(r)});
  box(.12,4.2,.12,0xfffaf0,2.9,2.1,-1.2,pad);const fl=box(1.2,.75,.04,0xffc53a,3.5,3.75,-1.2,pad,false);
  palm(-9,-1,1.1,g);palm(9.2,-2.5,1.25,g);palm(-7,-7,1,g);palm(-3.3,D-2.4,.8,g);palm(4.2,D-1.8,.7,g);palm(-3.4,D+S2-1.8,.7,g);
  hop={stage:1,S:S2,isl,t:0,pad};g.position.z=-S2;
  movers.push((t,dt)=>{
    waterTex.offset.set(t*.01,t*.004);fl.rotation.y=Math.sin(t*3)*.25;
    if(hop.stage===1.4){hop.t+=dt;if(hop.t<.45)return;
      balls.forEach(removeBallMesh);balls.length=0;if(cur){removeBallMesh(cur);cur=null}
      hop.stage=1.5;hop.t=0;spot.visible=false;sfx.whoosh()}
    if(hop.stage!==1.5)return;
    hop.t+=dt;const k=clamp(hop.t/1.5,0,1),e=k<.5?2*k*k:1-Math.pow(2-2*k,2)/2;
    g.position.z=-S2*(1-e);camOff.y=Math.sin(Math.PI*k)*2.4;
    if(k>=1){hop.stage=2;camOff.y=0;pad.visible=false;spot.visible=true;spawnBall()}
  });
}
/* Which island is under (x,z)? -1 means water. */
function isleAt(x,z){const gz=group.position.z;return hop.isl.findIndex(i=>{const a=(x-i.x)/(i.r+.5),c=(z-i.z-gz)/(i.s+.5);return a*a+c*c<=1})}
/* Called when a ball reaches the ground on the island level. Returns true when the ball went into the water. */
function isleTouch(b){
  if(b.sunk)return true;
  const i=isleAt(b.p.x,b.p.z);
  if(i<0){b.sunk=true;b.live=false;b.state='sunk';b.age=Math.max(b.age,1.3);b.v.set(b.v.x*.1,-.9,b.v.z*.1);b.a.set(0,-1.2,0);
    for(let k=0;k<44;k++)dust.emit(b.p.x,0,b.p.z,rnd(-2.6,2.6),rnd(2,6.5),rnd(-2.6,2.6),rnd(.4,.8),[.85,.95,1],13);sfx.splash();return true}
  if(i===1&&hop.stage===1){hop.stage=1.4;hop.t=0}
  return false;
}

/* ---------- aim help targets: open windows, plus the switch while it is still up ---------- */
let sw=null,pads=[];
function aimTargets(){
  const a=[];
  panes.forEach(p=>{if(p.broken||p.sky||p.safe||(p.shutter&&p.shutter.lock&&p.unlockT===undefined))return;
    a.push({x:p.c?p.c.x:p.x,y:p.c?p.c.y:p.y,z:p.c?p.c.z:ZF,w:p.w,h:p.h,vx:p.vx||0})});
  if(sw&&!sw.done)a.push({x:sw.x,y:sw.y,z:sw.z+.3,w:1.7,h:1.7,vx:0});
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
function padHit(b){
  if(!pads.length||b.ghost||b.sunk||b.state==='inside'||b.state==='dead'||b.v.y>1)return;
  for(const pd of pads){const dx=b.p.x-pd.x,dz=b.p.z-pd.z;if(dx*dx+dz*dz>pd.r*pd.r||b.p.y>pd.top+R)continue;
    let best=null;panes.forEach(p=>{if(p.broken||p.safe||p.xf||Math.abs(p.x-pd.x)>3)return;if(!best||p.y<best.y)best=p});
    const g=S.gravity,Tt=1.3;b.p.y=pd.top+R;b.live=false;b.state='fly';b.age=0;b.a.set(0,-g,0);
    if(best)b.v.set((best.x-b.p.x)/Tt,(best.y-b.p.y+.5*g*Tt*Tt)/Tt,(ZF-.3-b.p.z)/Tt);else b.v.set(b.v.x*.5,13,Math.min(b.v.z,-4));
    pd.t=0;sfx.boing();for(let i=0;i<16;i++)dust.emit(b.p.x,pd.top,b.p.z,rnd(-2,2),rnd(.5,2),rnd(-2,2),rnd(.2,.4),[.95,.95,1],2);
    return}
}

/* ---------- garden wall in front of the house: hides the lower windows, so they need the pads ---------- */
const brickTex=canvasTex(128,64,(g,w,h)=>{g.fillStyle='#d8d0c0';g.fillRect(0,0,w,h);g.fillStyle='#b9553f';for(let r=0;r<4;r++)for(let c=-1;c<4;c++)g.fillRect(c*32+(r%2?16:0)+2,r*16+2,28,12)});
brickTex.wrapS=brickTex.wrapT=T.RepeatWrapping;
function buildGardenWall(L){
  const o=L.gwall,w=L.W*2+4,t=brickTex.clone();t.needsUpdate=true;t.repeat.set(w/2,o.h/1);
  addOb(box(w,o.h,.5,new T.MeshLambertMaterial({map:t}),0,o.h/2,o.z,group),'wall');
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

/* ---------- night: dark sky, a lighthouse beam sweeps the house; windows only show while it is on them ---------- */
const dayBg=scene.background,nightBg=canvasTex(8,256,(g,w,h)=>{const a=g.createLinearGradient(0,0,0,h);a.addColorStop(0,'#070b22');a.addColorStop(.6,'#1b2550');a.addColorStop(.78,'#3b3f6e');g.fillStyle=a;g.fillRect(0,0,w,h)});
const starPts=(function(){const n=260,pos=new Float32Array(n*3);for(let i=0;i<n;i++){const a=rnd(-1.4,1.4),e=rnd(.12,1.1);pos[i*3]=Math.sin(a)*Math.cos(e)*150;pos[i*3+1]=Math.sin(e)*150;pos[i*3+2]=-Math.cos(a)*Math.cos(e)*150}
  const g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(pos,3));const p=new T.Points(g,new T.PointsMaterial({color:0xffffff,size:1.1,map:dot,transparent:true,depthWrite:false}));p.visible=false;scene.add(p);return p})();
const moon=new T.Mesh(new T.CircleGeometry(6,32),bmat(0xfff6d8));moon.position.set(45,52,-140);moon.visible=false;scene.add(moon);
function setNight(on){
  scene.background=on?nightBg:dayBg;starPts.visible=moon.visible=on;clouds.forEach(c=>c.visible=!on);
  hemi.intensity=on?.26:.72;hemi.color.setHex(on?0x8090c8:0xffffff);sun.intensity=on?.18:.72;sun.color.setHex(on?0x9fb0ff:0xfff1d6);
}
function buildNight(L){
  const g=group,lx=-11,lz=-7,lh=10.5;
  for(let i=0;i<5;i++){const m=new T.Mesh(new T.CylinderGeometry(1.25-i*.1,1.35-i*.1,2,16),mat(i%2?0xd9503f:0xfff8e8));m.position.set(lx,1+i*2,lz);m.castShadow=true;g.add(m)}
  box(1.9,.25,1.9,0x23304a,lx,lh-.4,lz,g);const lamp=new T.Mesh(new T.SphereGeometry(.55,14,10),bmat(0xfff2b0));lamp.position.set(lx,lh,lz);g.add(lamp);
  const cap=new T.Mesh(new T.ConeGeometry(1.1,1.2,12),mat(0x23304a));cap.position.set(lx,lh+1,lz);g.add(cap);
  const bg=new T.CylinderGeometry(3.2,.35,1,28,1,true);bg.translate(0,.5,0);bg.rotateX(Math.PI/2);
  const beam=new T.Mesh(bg,new T.MeshBasicMaterial({color:0xfff2b0,transparent:true,opacity:.16,depthWrite:false,blending:T.AdditiveBlending,side:T.DoubleSide}));beam.position.set(lx,lh,lz);g.add(beam);
  const sl=new T.SpotLight(0xfff2c0,2.4,80,.3,.55,1);sl.position.set(lx,lh,lz);g.add(sl);g.add(sl.target);
  const kl=new T.PointLight(0xffd9a0,.9,11);kl.position.set(0,3.2,D+1);g.add(kl);
  const pl=new T.PointLight(0xffc070,.7,7);pl.position.set(0,3.7,1.2);g.add(pl);
  /* dark cover behind each window's glass; it clears while the beam is on that window */
  panes.forEach(p=>{if(p.xf)return;const cv=new T.Mesh(new T.PlaneGeometry(p.w,p.h),new T.MeshBasicMaterial({color:0x0b1030,transparent:true,depthWrite:false}));cv.position.set(p.x,p.y,-.08);cv.renderOrder=2;g.add(cv);
    p.mesh.material=glassMat.clone();p.cover=cv});
  const tgt=new T.Vector3();
  movers.push(t=>{
    const bx=10.5*Math.sin(t*.42);tgt.set(bx,3.6,0);sl.target.position.copy(tgt);beam.lookAt(tgt);beam.scale.set(1,1,beam.position.distanceTo(tgt));
    panes.forEach(p=>{if(!p.cover)return;const lit=Math.exp(-Math.pow((p.x-bx)/2.6,2));p.lit=lit;p.cover.material.opacity=p.broken?0:.985*(1-lit);p.mesh.material.opacity=.12+.88*lit});
  });
}
