'use strict';
/* ---------- renderer and scene ---------- */
const canvas=$('gl'), fx=$('fx'), fctx=fx.getContext('2d');
const renderer=new T.WebGLRenderer({canvas,antialias:true});
renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));
renderer.shadowMap.enabled=true; renderer.shadowMap.type=T.PCFSoftShadowMap;
const scene=new T.Scene(), camera=new T.PerspectiveCamera(46,1,.1,400);
function canvasTex(w,h,draw){const c=document.createElement('canvas');c.width=w;c.height=h;draw(c.getContext('2d'),w,h);return new T.CanvasTexture(c)}
scene.background=canvasTex(8,256,(g,w,h)=>{const a=g.createLinearGradient(0,0,0,h);a.addColorStop(0,'#3f9fdf');a.addColorStop(.55,'#9bd6ef');a.addColorStop(.75,'#ffe9bf');g.fillStyle=a;g.fillRect(0,0,w,h)});
scene.add(new T.HemisphereLight(0xffffff,0x93b56a,.72));
const sun=new T.DirectionalLight(0xfff1d6,.72); sun.position.set(-11,20,17); sun.castShadow=true;
sun.shadow.mapSize.set(1024,1024); Object.assign(sun.shadow.camera,{left:-22,right:22,top:24,bottom:-16,near:1,far:70}); scene.add(sun);

const mats={};
const mat=c=>mats[c]||(mats[c]=new T.MeshLambertMaterial({color:c,flatShading:true}));
const bmats={};
const bmat=c=>bmats[c]||(bmats[c]=new T.MeshBasicMaterial({color:c}));
function box(w,h,d,c,x,y,z,p,shadow){const m=new T.Mesh(new T.BoxGeometry(w,h,d),typeof c==='number'?mat(c):c);m.position.set(x,y,z);if(shadow!==false){m.castShadow=true;m.receiveShadow=true}p.add(m);return m}

/* ---------- static yard ---------- */
const world=new T.Group(); scene.add(world);
(function yard(){
  const tex=canvasTex(256,256,(g,w,h)=>{for(let i=0;i<4;i++){g.fillStyle=i%2?'#6bb64f':'#62ac47';g.fillRect(i*w/4,0,w/4,h)}for(let i=0;i<1400;i++){g.fillStyle=Math.random()<.5?'rgba(255,255,190,.05)':'rgba(20,70,20,.06)';g.fillRect(Math.random()*w,Math.random()*h,2,5)}});
  tex.wrapS=tex.wrapT=T.RepeatWrapping; tex.repeat.set(16,16); tex.anisotropy=4;
  const ground=new T.Mesh(new T.PlaneGeometry(320,320),new T.MeshLambertMaterial({map:tex}));
  ground.rotation.x=-Math.PI/2; ground.receiveShadow=true; world.add(ground);
  [[-70,-95,46,15,0x7fb86a],[20,-110,70,22,0x6fab60],[85,-90,44,13,0x86bf70],[-20,-130,90,30,0x8fbf86]].forEach(a=>{const m=new T.Mesh(new T.SphereGeometry(1,14,8),mat(a[4]));m.scale.set(a[2],a[3],30);m.position.set(a[0],0,a[1]);world.add(m)});
  const tree=(x,z,s,c)=>{const g=new T.Group();box(.55,3,.55,0x7a5532,0,1.5,0,g);[[0,3.8,0,2],[-.9,3.2,.3,1.35],[.9,3.3,-.2,1.45],[0,5,0,1.3]].forEach(l=>{const m=new T.Mesh(new T.IcosahedronGeometry(l[3],1),mat(c));m.position.set(l[0],l[1],l[2]);m.castShadow=true;g.add(m)});g.position.set(x,0,z);g.scale.setScalar(s);world.add(g)};
  [[-15,-5,1.5,0x4f9a45],[15.5,-6,1.65,0x459040],[-23,-14,2,0x5ba84e],[24,-15,2.1,0x4f9a45],[-9,-20,2.3,0x66ae55],[10,-24,2.5,0x5ba84e],[-32,-6,1.7,0x459040],[33,-5,1.6,0x66ae55]].forEach(a=>tree(...a));
  const n=70, geo=new T.BoxGeometry(.28,1.5,.1), pick=new T.InstancedMesh(geo,mat(0xfaf3e3),n), d=new T.Object3D();
  for(let i=0;i<n;i++){const s=i<n/2?-1:1,k=i<n/2?i:i-n/2;d.position.set(s*(8+k*.62),.75,-1.4);d.updateMatrix();pick.setMatrixAt(i,d.matrix)}pick.castShadow=true;world.add(pick);
  [-1,1].forEach(s=>[.5,1.1].forEach(y=>box(22,.12,.06,0xefe6d2,s*19,y,-1.48,world,false)));
})();
const clouds=[];
for(let i=0;i<6;i++){const g=new T.Group();for(let k=0;k<4;k++){const m=new T.Mesh(new T.IcosahedronGeometry(rnd(2.5,5),1),bmat(0xffffff));m.position.set(k*4-6,rnd(-1,1),rnd(-1,1));m.scale.y=.62;g.add(m)}g.position.set(rnd(-90,90),rnd(26,44),-110);g.userData.s=rnd(.5,1.2);clouds.push(g);scene.add(g)}

const spot=new T.Group();
(function(){const a=new T.Mesh(new T.CircleGeometry(1.15,28),new T.MeshLambertMaterial({color:0xa98e5c}));a.rotation.x=-Math.PI/2;a.position.y=.02;a.receiveShadow=true;spot.add(a);const r=new T.Mesh(new T.RingGeometry(.92,1.02,32),bmat(0xfff8e8));r.rotation.x=-Math.PI/2;r.position.y=.03;spot.add(r)})();
scene.add(spot);

/* ---------- camera layout ---------- */
let gainX=.02,gainHigh=.02,gainLow=.01;const KNEE=3;
const camBase=new T.Vector3();let W_=1,H_=1,camLook=new T.Vector3(0,3,0);
function layout(){
  W_=$('stage').clientWidth||innerWidth;H_=$('stage').clientHeight||innerHeight;const a=W_/H_;
  renderer.setSize(W_,H_,false);const dpr=Math.min(devicePixelRatio||1,2);fx.width=W_*dpr;fx.height=H_*dpr;fctx.setTransform(dpr,0,0,dpr,0,0);
  let fov,z;
  if(a>=1){fov=46;z=21;D=13}else{fov=62;z=Math.max(21,7.9/(Math.tan(31*Math.PI/180)*a));D=z-7.2}
  z+=2; /* camera a little further back so the ball sits higher on screen (D unchanged) */
  camera.fov=fov;camera.aspect=a;camera.updateProjectionMatrix();camBase.set(0,3.2,z);camera.position.copy(camBase);camera.lookAt(camLook);camera.updateMatrixWorld();
  gainHigh=gainX=2*Math.tan(fov/2*Math.PI/180)*z/H_;gainLow=(KNEE-R)/Math.max(60,toScreen(0,R,D)[1]-toScreen(0,KNEE,ZF)[1]);
  spot.position.set(0,0,D);if(cur){cur.p.z=D;cur.m.position.z=D;cur.sh.position.z=D}
  sun.target.position.set(0,0,4);scene.add(sun.target);updateHint();
}
const proj=new T.Vector3();
function toScreen(x,y,z){proj.set(x,y,z).project(camera);return[(proj.x+1)/2*W_,(1-proj.y)/2*H_]}
function updateHint(){
  if(!LVL)return;const show=!hintDone&&panes.length>0;$('hint').hidden=!show;$('hintText').hidden=!show;if(!show)return;
  const a=toScreen(0,.3,D),b=toScreen(panes[0].x,panes[0].y,0),h=$('hint');
  h.style.setProperty('--x0',a[0]+'px');h.style.setProperty('--y0',(a[1]-16)+'px');h.style.setProperty('--x1',b[0]+'px');h.style.setProperty('--y1',b[1]+'px');
}

