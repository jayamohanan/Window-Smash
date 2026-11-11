'use strict';
/* ---------- levels ---------- */
/* Pane fields: x,y,w,h on the wall plane; prop+wall = room behind (house only);
   shutter:{phase} = roller shutter on a loop; armor:1 = wooden boards (one kick each); hp:2 = wired glass (cracks first);
   sky:true = skylight in the porch roof (needs porch:true).
   rail:{amp,speed,phase} = stand window sliding on a rail; hang:true = hangs from the gantry;
   back/roof:true = greenhouse back wall / roof glass.
   Level fields: board = sliding barrier, hedges = soft blockers, wind = sideways push (m/s²), tut = hand tutorial,
   mill = windmill on the house front, gantry = overhead beam, island = two-step island hop (first = the glass frames on the near island; panes = the house on the far one), bonus = no fail (greenhouse),
   switch = bullseye that unlocks shutter:{lock:true} windows, cat = a cat on one window's sill blocks it and hops between windows, pads = bounce pads, gwall = garden wall, night = lighthouse night (memory level), layout = function returning fresh panes on each attempt, towers = mansion towers, wheel = solid disc with one gap on the house front.
   type:'field' = free-standing panes placed by a builder (field:'stack' | 'carousel' | 'behind' | 'aquarium').
   carousel.items: {empty:true} = frame only, {inner:true} = mesh outside, glass facing the centre; inner = windows standing inside the circle.
   awn:true (house pane) = wire mesh over it, awning below that springs the ball up into the gap; revolver = revolving door with 4 glass wings. */
const GX=[-4.5,-1.5,1.5,4.5];
const ghPanes=()=>[...GX.map(x=>({x,y:1.7,w:2.8,h:2.2})),...GX.map(x=>({x,y:4,w:2.8,h:2.2})),...GX.map(x=>({x,y:2.9,w:2.8,h:4.4,back:true})),...GX.map(x=>({x,w:2.8,h:2.3,roof:true}))];
const two=()=>[{x:-3.9,y:2.8,w:2.6,h:2.3,prop:'tv',wall:0xffe6b0},{x:3.9,y:2.8,w:2.6,h:2.3,prop:'vase',wall:0xcfe8d5}];
const four=()=>[{x:-3.9,y:2.5,w:2.4,h:2.1,prop:'fish',wall:0xcfe0f0},{x:3.9,y:2.5,w:2.4,h:2.1,prop:'cake',wall:0xffd7c8},{x:-3.9,y:6.1,w:2.4,h:2.1,prop:'vase',wall:0xe3d6f2},{x:3.9,y:6.1,w:2.4,h:2.1,prop:'tv',wall:0xd9efc6}];
const isle1=()=>[{x:-2.9,y:2.3,w:2,h:1.8},{x:0,y:3.4,w:2,h:1.8},{x:2.9,y:2.7,w:2,h:1.8}];
const LV=[
 {name:'First Kick',type:'stand',balls:3,tut:true,panes:[{x:0,y:3.1,w:3.1,h:2.6}]},
 {name:'Three Stands',type:'stand',balls:5,panes:[{x:-5.4,y:2.3,w:2.3,h:2},{x:0,y:4.4,w:2.3,h:2},{x:5.4,y:3.2,w:2.3,h:2}]},
 {name:'First House',type:'house',H:5.2,G:2.3,W:7,balls:4,panes:[{x:-3.9,y:2.8,w:2.6,h:2.3,prop:'tv',wall:0xffe6b0},{x:3.9,y:2.8,w:2.6,h:2.3,prop:'vase',wall:0xcfe8d5}]},
 {name:'Four Windows',type:'house',H:8.2,G:2.2,W:7,balls:6,panes:[{x:-3.9,y:2.5,w:2.4,h:2.1,prop:'fish',wall:0xcfe0f0},{x:3.9,y:2.5,w:2.4,h:2.1,prop:'cake',wall:0xffd7c8},{x:-3.9,y:6.1,w:2.4,h:2.1,prop:'vase',wall:0xe3d6f2},{x:3.9,y:6.1,w:2.4,h:2.1,prop:'tv',wall:0xd9efc6}]},
 {name:'Stacked Windows',type:'field',field:'stack',balls:10,layout:()=>stackPanes(),panes:[]},
 {name:'Sliding Board',type:'house',H:5.2,G:2.3,W:7,balls:5,board:{z:2.4,w:6,amp:4.2,speed:1.25},panes:[{x:-3.9,y:2.8,w:2.6,h:2.3,prop:'tv',wall:0xffe6b0},{x:3.9,y:2.8,w:2.6,h:2.3,prop:'vase',wall:0xcfe8d5}]},
 {name:'Shutters',type:'house',H:5.2,G:2.3,W:7,balls:5,panes:[{x:-3.9,y:2.8,w:2.6,h:2.3,prop:'tv',wall:0xffe6b0,shutter:{phase:0}},{x:3.9,y:2.8,w:2.6,h:2.3,prop:'vase',wall:0xcfe8d5,shutter:{phase:.5}}]},
 {name:'Boarded Up',type:'house',H:5.2,G:2.3,W:7,balls:6,panes:[{x:-3.9,y:2.8,w:2.6,h:2.3,prop:'tv',wall:0xffe6b0,armor:1},{x:3.9,y:2.8,w:2.6,h:2.3,prop:'vase',wall:0xcfe8d5,hp:2}]},
 {name:'Over the Hedge',type:'house',H:5.8,G:2.3,W:7,balls:6,porch:true,hedges:[{x:-4.2,z:2.1,w:3.8,h:2.5},{x:4.2,z:2.1,w:3.8,h:2.5}],
   panes:[{x:-4.2,y:3.75,w:2.4,h:2.1,prop:'fish',wall:0xcfe0f0},{x:4.2,y:3.75,w:2.4,h:2.1,prop:'cake',wall:0xffd7c8},{sky:true,w:2.2,h:1.8}]},
 {name:'Windy Day',type:'house',H:8.2,G:2.2,W:7,balls:7,wind:7,panes:four()},
 {name:'Bonus: Greenhouse',type:'greenhouse',bonus:true,balls:12,panes:ghPanes()},
 {name:'Windmill',type:'house',H:5.2,G:2.3,W:7,balls:5,mill:{x:0,y:4.4,z:1.6,len:4.2,speed:.9},panes:[{x:-3.4,y:2.8,w:2.5,h:2.3,prop:'tv',wall:0xffe6b0},{x:3.4,y:2.8,w:2.5,h:2.3,prop:'vase',wall:0xcfe8d5}]},
 {name:'Rail Riders',type:'stand',balls:5,gantry:{x:8,y:7.2},panes:[{x:0,y:2.4,w:2.5,h:2.1,rail:{amp:4.8,speed:.95}},{x:0,y:5.3,w:2.3,h:1.9,hang:true,rail:{amp:4.8,speed:1.35,phase:Math.PI}}]},
 {name:'Carousel',type:'field',field:'carousel',balls:10,carousel:{r:5.6,z:-1.5,speed:.4,items:[{y:2.8,w:2.6,h:2.3},{y:2.8,w:2.6,h:2.3,hp:2},{y:2.8,w:2.6,h:2.3},{y:2.8,w:2.6,h:2.3,hp:2},{y:2.8,w:2.6,h:2.3}]},panes:[]},
 {name:'{y:2.8,w:2.6,h:2.3nner Ring',type:'field',field:'carousel',balls:9,carousel:{r:5.6,z:-1.5,speed:.36,items:[{y:2.8,w:2.6,h:2.3},{y:2.8,w:2.6,h:2.3,empty:true},{y:2.8,w:2.6,h:2.3},{y:2.8,w:2.6,h:2.3,empty:true},{y:2.8,w:2.6,h:2.3},{y:2.8,w:2.6,h:2.3,empty:true}]},inner:[{x:-2.6,y:2.4,z:-1.5,w:2.1,h:1.9},{x:0,y:3.4,z:-1.5,w:2.1,h:1.9},{x:2.6,y:2.4,z:-1.5,w:2.1,h:1.9}],panes:[]},
 {name:'Mind the Cat',type:'house',H:8.2,G:2.2,W:7,balls:7,cat:true,panes:[{x:-3.9,y:2.5,w:2.4,h:2.1,prop:'fish',wall:0xcfe0f0},{x:3.9,y:2.5,w:2.4,h:2.1,prop:'cake',wall:0xffd7c8},
   {x:-4.6,y:6.1,w:2.2,h:2.1,prop:'vase',wall:0xe3d6f2},{x:0,y:6.1,w:2.2,h:2.1,prop:'cake',wall:0xffe6b0},{x:4.6,y:6.1,w:2.2,h:2.1,prop:'tv',wall:0xd9efc6}]},
 {name:'Aquarium',type:'field',field:'aquarium',balls:9,panes:[]},
 {name:'Island Hop',type:'house',H:5.2,G:2.3,W:7,balls:9,island:true,first:isle1(),panes:two()},
 {name:'Stormy Mill',type:'house',H:8.2,G:2.2,W:7,balls:8,wind:-6,mill:{x:0,y:4.6,z:1.6,len:4.5,speed:1.1},panes:four()},
 {name:'Through the Gap',type:'house',H:8.2,G:2.2,W:7,balls:8,wheel:{x:0,y:4.6,z:1.6,r:6.2,gap:Math.PI/2,speed:.45},panes:four()},
 {name:'Revolving Door',type:'house',H:5.2,G:2.3,W:7,balls:9,revolver:{z:1.5,r:1.2},panes:two()},
 {name:'Bullseye',type:'house',H:5.2,G:2.3,W:7,balls:5,switch:{x:0,y:6.1,z:.3},panes:two().map(p=>Object.assign(p,{shutter:{lock:true}}))},
 {name:'Bounce Pads',type:'house',H:8.2,G:2.2,W:7,balls:7,gwall:{z:3,h:3.2},pads:[{x:-3.9,z:6.8},{x:3.9,z:6.8}],panes:four()},
 {name:'Awnings',type:'house',H:8.2,G:2.2,W:7,balls:8,panes:four().map((p,i)=>i>1?Object.assign(p,{awn:true}):p)},
 {name:'From Behind',type:'field',field:'behind',balls:10,panes:[{x:-4.6,y:1.9,w:2.4,h:1.8},{x:0,y:1.9,w:2.4,h:1.8},{x:4.6,y:1.9,w:2.4,h:1.8}]},
 {name:'Mesh Backs',type:'field',field:'carousel',balls:9,carousel:{r:5.6,z:-1.5,speed:.32,items:[{y:2.8,w:2.6,h:2.3,inner:true},{y:2.8,w:2.6,h:2.3},{y:2.8,w:2.6,h:2.3,inner:true},{y:2.8,w:2.6,h:2.3},{y:2.8,w:2.6,h:2.3,inner:true}]},panes:[]},
 {name:'Lighthouse Night',type:'house',H:8.2,G:2.2,W:7,balls:7,night:true,layout:()=>nightLayout(),panes:four()},
 {name:'Shielded Isle',type:'house',H:5.2,G:2.3,W:7,balls:12,island:true,first:isle1(),panes:two().map((p,i)=>Object.assign(p,i?{hp:2}:{armor:1}))},
 {name:'Boss Mansion',type:'house',H:8.2,G:2.4,W:8.5,balls:11,towers:true,cat:true,board:{z:2.6,w:4,amp:5.6,speed:1.1},panes:[
   {x:-5.4,y:2.5,w:2.4,h:2.1,prop:'fish',wall:0xcfe0f0},{x:5.4,y:2.5,w:2.4,h:2.1,prop:'cake',wall:0xffd7c8,hp:2},
   {x:-5.4,y:6.1,w:2.4,h:2.1,prop:'vase',wall:0xe3d6f2,shutter:{phase:0}},{x:0,y:6.1,w:2.2,h:2.1,prop:'tv',wall:0xffe6b0},{x:5.4,y:6.1,w:2.4,h:2.1,prop:'tv',wall:0xd9efc6,armor:1}]}
];

let level=0,LVL=null,group=null,panes=[],ballsLeft=0,used=0,won=false,cur=null,D=13,hintDone=false,door=null,grump=null,grumpT=-1;
const balls=[],shards=[],debris=[],returned=[];
let inBalls=0; /* balls that went into the house; the owner rolls them back out after the win */
let timers=[];
const later=(s,f)=>timers.push({t:s,f});

/* Intact glass reads as solid: a sky-blue reflection fading down the pane, with bold diagonal glints. It mutes the room behind until it breaks. */
const glassTex=canvasTex(256,256,(g,w,h)=>{const a=g.createLinearGradient(0,0,0,h);a.addColorStop(0,'rgba(96,180,240,.8)');a.addColorStop(1,'rgba(176,226,252,.56)');g.fillStyle=a;g.fillRect(0,0,w,h);g.fillStyle='rgba(255,255,255,.78)';g.save();g.translate(w*.5,h*.5);g.rotate(-.75);g.fillRect(-w,-74,w*2,44);g.fillRect(-w,-14,w*2,14);g.restore()});
const glassMat=new T.MeshBasicMaterial({map:glassTex,transparent:true,depthWrite:false,side:T.DoubleSide});
const shardMats=[0xd9f2ff,0xaedcf5,0xffffff].map(c=>new T.MeshPhongMaterial({color:c,specular:0xffffff,shininess:90,transparent:true,opacity:.86,side:T.DoubleSide,flatShading:true}));

function clearLevel(){
  if(group){group.traverse(o=>{if(o.geometry)o.geometry.dispose()});scene.remove(group)}
  shards.forEach(s=>{scene.remove(s.m);s.m.geometry.dispose()});shards.length=0;
  debris.forEach(d=>scene.remove(d.m));debris.length=0;
  balls.forEach(removeBallMesh);balls.length=0;
  if(cur){removeBallMesh(cur);cur=null}
  spark.clear();dust.clear();timers=[];$('win').hidden=true;$('again').hidden=true;$('retryBtn').hidden=false;$('bubble').hidden=true;$('fail').hidden=true;$('wipe').classList.remove('on');
  failing=false;failT=-1;retrying=false;leaving=false;confetti.length=0;fctx.clearRect(0,0,W_,H_);
  returned.forEach(r=>scene.remove(r.m));returned.length=0;inBalls=0;
  grump=null;door=null;grumpT=-1;obs=[];movers=[];lt=0;wind=0;hop=null;sw=null;pads=[];catS=null;wheel=null;behind=null;revolver=null;pond=null;camOff.set(0,0,0);spot.visible=true;
}
function makeFrame(p,parent,c){const f=.2,z=.1;
  box(p.w+f*2,f,.34,c,p.x,p.y+p.h/2+f/2,z,parent);box(p.w+f*2,f,.34,c,p.x,p.y-p.h/2-f/2,z,parent);
  box(f,p.h,.34,c,p.x-p.w/2-f/2,p.y,z,parent);box(f,p.h,.34,c,p.x+p.w/2+f/2,p.y,z,parent)}
function makePane(p,parent){const m=new T.Mesh(new T.PlaneGeometry(p.w,p.h),glassMat);m.position.set(p.x,p.y,0);m.renderOrder=3;parent.add(m);p.mesh=m;p.broken=false}

function makeRoom(p,parent){
  const w=p.w+2.4,h=p.h+1.3,dp=5,floor=p.y-p.h/2-.45,cy=floor+h/2,c=new T.Color(p.wall);
  const shade=k=>new T.MeshBasicMaterial({color:c.clone().multiplyScalar(k),side:T.BackSide});
  const m=new T.Mesh(new T.BoxGeometry(w,h,dp),[shade(.78),shade(.78),new T.MeshBasicMaterial({color:0xfff6dc,side:T.BackSide}),new T.MeshBasicMaterial({color:0x9a6b43,side:T.BackSide}),shade(.5),shade(1)]);
  m.position.set(p.x,cy,-.22-dp/2);parent.add(m);
  [-1,1].forEach(s=>{const cur=new T.Mesh(new T.BoxGeometry(.5,p.h+.2,.06),bmat(s<0?0xd9503f:0xd9503f));cur.position.set(p.x+s*(p.w/2-.14),p.y,-.34);parent.add(cur)});
  const pg=new T.Group();pg.position.set(p.x,floor,-3.1);parent.add(pg);
  const b=(a,e,o,col,x,y,z)=>{const q=new T.Mesh(new T.BoxGeometry(a,e,o),bmat(col));q.position.set(x,y,z);pg.add(q);return q};
  let tY=1.4,colors,word;
  if(p.prop==='tv'){b(2.1,.75,.8,0x7a5532,0,.38,0);b(1.75,1.15,.28,0x20242e,0,1.35,0);b(1.5,.92,.05,0x47c3ff,0,1.35,.16);tY=1.35;colors=[0x20242e,0x47c3ff,0x7a5532,0x2a7ca8];word='BYE BYE TV!'}
  else if(p.prop==='vase'){b(1.7,.14,.9,0x8a5f3b,0,.98,0);[-.7,.7].forEach(x=>b(.12,.95,.7,0x704b2c,x,.48,0));
    const pts=[[.05,0],[.34,.08],[.42,.5],[.24,.95],[.17,1.2],[.28,1.36]].map(a=>new T.Vector2(a[0],a[1]));const v=new T.Mesh(new T.LatheGeometry(pts,14),new T.MeshBasicMaterial({color:0x2f6fd0,side:T.DoubleSide}));v.position.y=1.05;pg.add(v);tY=1.7;colors=[0x2f6fd0,0xffffff,0x8fb9f0,0x8a5f3b];word='THE VASE!'}
  else if(p.prop==='fish'){b(1.9,.8,.7,0x6f4e37,0,.4,0);const t=new T.Mesh(new T.BoxGeometry(1.75,1.05,.7),new T.MeshBasicMaterial({color:0x53bdf0,transparent:true,opacity:.72}));t.position.y=1.33;pg.add(t);b(.42,.24,.1,0xff8a1f,-.3,1.4,.37);b(.16,.26,.1,0xff8a1f,-.58,1.4,.37);b(.34,.2,.1,0xffc53a,.42,1.15,.37);tY=1.33;colors=[0x53bdf0,0xd6f3ff,0xff8a1f,0x6f4e37];word='SPLOOSH!'}
  else{b(1.9,.12,1,0xffffff,0,.98,0);[-.8,.8].forEach(x=>b(.12,.95,.8,0x8a5f3b,x,.48,0));const k=(r,h2,y,col)=>{const q=new T.Mesh(new T.CylinderGeometry(r,r,h2,18),bmat(col));q.position.y=y;pg.add(q)};k(.6,.34,1.22,0xff9fc0);k(.42,.3,1.54,0xfff2f6);k(.08,.26,1.82,0xd9503f);tY=1.5;colors=[0xff9fc0,0xfff2f6,0xd9503f,0x7a4a2e];word='THE CAKE!'}
  p.room={floor,group:pg,target:new T.Vector3(p.x,floor+tY,-3.1),kind:p.prop,colors,word,hit:false};
}

function buildHouse(L){
  const g=group,W=L.W,H=L.H,G=L.G;
  const sh=new T.Shape();sh.moveTo(-W,0);sh.lineTo(W,0);sh.lineTo(W,H);sh.lineTo(0,H+G);sh.lineTo(-W,H);sh.closePath();
  const hole=(x0,y0,x1,y1)=>{const q=new T.Path();q.moveTo(x0,y0);q.lineTo(x0,y1);q.lineTo(x1,y1);q.lineTo(x1,y0);q.closePath();sh.holes.push(q)};
  panes.forEach(p=>!p.sky&&hole(p.x-p.w/2,p.y-p.h/2,p.x+p.w/2,p.y+p.h/2));
  hole(-.95,0,.95,3.3);
  const tex=canvasTex(128,128,(c,w,h)=>{c.fillStyle='#f2bd86';c.fillRect(0,0,w,h);c.fillStyle='#d99d62';for(let i=0;i<4;i++)c.fillRect(0,i*h/4,w,3);c.fillStyle='rgba(255,255,255,.08)';for(let i=0;i<4;i++)c.fillRect(0,i*h/4+6,w,10)});
  tex.wrapS=tex.wrapT=T.RepeatWrapping;tex.repeat.set(.42,.42);
  const wg=new T.ExtrudeGeometry(sh,{depth:.38,bevelEnabled:false});
  const wall=new T.Mesh(wg,[new T.MeshLambertMaterial({map:tex}),mat(0xd99d62)]);wall.position.z=-.22;wall.castShadow=true;wall.receiveShadow=true;g.add(wall);g.userData.wallTex=tex;g.userData.wall=wall;
  panes.filter(p=>!p.sky).forEach(p=>{makeRoom(p,g);makeFrame(p,g,0xfffaf0);makePane(p,g);if(p.awn)return; /* the awning's ball path runs where the sill would be */
    box(p.w+.6,.22,.55,0x8a5f3b,p.x,p.y-p.h/2-.36,.32,g);
    for(let i=0;i<8;i++){const f=new T.Mesh(new T.IcosahedronGeometry(.17,0),mat(i%3?0xf35f7d:0xffd34d));f.position.set(p.x-p.w/2+.15+i*(p.w-.3)/7,p.y-p.h/2-.16,.34);g.add(f)}});
  const slope=Math.atan2(G,W),len=Math.hypot(W+.9,G*(W+.9)/W)+.3;
  [-1,1].forEach(s=>{const r=box(len,.3,8.2,0xc6473a,s*(W+.9)/2,H+G*(1-(W+.9)/(2*W))+.14,-3,g);r.rotation.z=-s*slope;addOb(r,'roof')});
  addOb(box(1.2,2.6,1.2,0xa8513f,4,H+1.6,-3,g),'wall');box(1.45,.28,1.45,0x7c3a2d,4,H+2.9,-3,g);
  [-1,1].forEach(s=>addOb(box(.2,H,7,0xd99d62,s*W,H/2,-3.6,g),'wall'));
  const dark=new T.Mesh(new T.PlaneGeometry(1.9,3.3),bmat(0x2b2230));dark.position.set(0,1.65,-.16);g.add(dark);
  [[-1.07],[1.07]].forEach(a=>box(.24,3.5,.38,0xfffaf0,a[0],1.75,.1,g));box(2.38,.24,.38,0xfffaf0,0,3.42,.1,g);
  const pivot=new T.Group();pivot.position.set(-.95,0,.16);g.add(pivot);box(1.9,3.28,.12,0x2f7e77,.95,1.64,0,pivot);box(1.3,.9,.03,0x276963,.95,2.45,.07,pivot,false);box(1.3,.9,.03,0x276963,.95,1.15,.07,pivot,false);const kn=new T.Mesh(new T.SphereGeometry(.1,10,8),mat(0xffc53a));kn.position.set(1.65,1.6,.12);pivot.add(kn);door=pivot;
  [-1,1].forEach(s=>[.7,1.5].forEach(k=>{const b=new T.Mesh(new T.IcosahedronGeometry(.9,1),mat(k<1?0x3f8f3e:0x4fa04a));b.position.set(s*(W+k*.9),.65,.9);b.castShadow=true;g.add(b)}));
  if(!L.island&&!L.gwall)for(let i=0;i<7;i++){const st=new T.Mesh(new T.CylinderGeometry(.55,.6,.05,9),mat(0xcdbb9b));st.position.set(Math.sin(i*1.5)*.22,.03,1.1+i*1.45);st.receiveShadow=true;g.add(st)}
  const n=new T.Group();
  const body=box(1,1.25,.55,0x3f6fc2,0,1.5,0,n);
  box(.36,.9,.42,0x383f55,-.24,.45,0,n);box(.36,.9,.42,0x383f55,.24,.45,0,n);
  const head=new T.Mesh(new T.SphereGeometry(.47,16,12),mat(0xf0bd93));head.position.y=2.55;head.castShadow=true;n.add(head);
  const mouth=box(.72,.12,.08,0x2b2230,0,2.45,.44,n,false),brows=[];
  [-1,1].forEach(s=>{const e=box(.34,.09,.06,0x2b2230,s*.2,2.8,.43,n,false);e.rotation.z=s*-.42;brows.push({e,s});const y=new T.Mesh(new T.SphereGeometry(.07,8,6),bmat(0x2b2230));y.position.set(s*.18,2.66,.45);n.add(y)});
  const nose=new T.Mesh(new T.SphereGeometry(.12,8,6),mat(0xe59a78));nose.position.set(0,2.56,.5);n.add(nose);
  box(.28,1,.3,0x3f6fc2,-.65,1.5,0,n);
  const arm=new T.Group();arm.position.set(.62,2,0);n.add(arm);box(.28,1,.3,0x3f6fc2,0,.45,0,arm);const fist=new T.Mesh(new T.SphereGeometry(.24,10,8),mat(0xf0bd93));fist.position.y=1.05;arm.add(fist);
  n.position.set(0,0,-.6);n.visible=false;g.add(n);Object.assign(n.userData,{arm,head,mouth,brows,smug:false});grump=n;
}
function standLegs(p,sg){[-1,1].forEach(s=>{box(.26,p.y-p.h/2,.26,0x8a5f3b,s*(p.w/2+.1),(p.y-p.h/2)/2,.1,sg);box(.26,.14,1.8,0x704b2c,s*(p.w/2+.1),.07,.1,sg)})}
/* Each stand is its own group so rail windows can slide (p.x follows; p.vx is used by aim help). */
function buildStand(L){
  panes.forEach(p=>{const sg=new T.Group();sg.position.x=p.x;group.add(sg);const x=p.x;p.x=0;makeFrame(p,sg,0xfffaf0);makePane(p,sg);p.x=x;
    if(p.hang){const top=p.y+p.h/2+.2,gy=L.gantry.y-.17;[-1,1].forEach(s=>box(.05,gy-top,.05,0x3a3a44,s*p.w*.4,(gy+top)/2,.1,sg,false));box(.9,.3,.5,0x4a5466,0,gy-.1,.1,sg)}
    else standLegs(p,sg);
    if(!p.rail)return;const r=p.rail,ph=r.phase||0;p.x0=x;
    if(!p.hang)[-.5,.5].forEach(z=>box(r.amp*2+p.w+1.6,.06,.1,0x8d8577,x,.03,.1+z,group,false));
    const at=t=>{p.x=p.x0+r.amp*Math.sin(t*r.speed+ph);p.vx=r.amp*r.speed*Math.cos(t*r.speed+ph);sg.position.x=p.x};at(0);
    movers.push(at)});
}
function loadLevel(i){
  clearLevel();sandbox=false;level=(i+LV.length)%LV.length;LVL=LV[level];
  group=new T.Group();scene.add(group);
  panes=(LVL.layout?LVL.layout():LVL.panes).map(p=>Object.assign({},p));lt=0;wind=LVL.wind||0;
  world.visible=!LVL.island;setNight(!!LVL.night);
  if(LVL.type==='house')buildHouse(LVL);else if(LVL.type==='greenhouse')buildGreenhouse(LVL);else if(LVL.type!=='field')buildStand(LVL);
  buildMech(LVL);
  ballsLeft=LVL.balls;used=0;won=false;
  $('lvlNo').textContent='Level '+(level+1);
  drawBalls();spawnBall();updateHint();chips();
}
/* Dev sandbox: empty yard (no house, stand or glass) with unlimited balls, for testing kick feel and juice. */
let sandbox=false;
function loadSandbox(){
  clearLevel();sandbox=true;LVL={name:'Sandbox',type:'sandbox',balls:0,panes:[]};
  group=new T.Group();scene.add(group);panes=[];world.visible=true;setNight(false);
  ballsLeft=1e9;used=0;won=false;
  $('lvlNo').textContent='Sandbox';
  drawBalls();spawnBall();updateHint();chips();
}
const reloadLevel=()=>sandbox?loadSandbox():loadLevel(level);
function drawBalls(){$('balls').classList.toggle('last',!sandbox&&!LVL.bonus&&!won&&ballsLeft===1);if(sandbox){$('balls').innerHTML='';return}$('balls').innerHTML=Array.from({length:LVL.balls},(_,i)=>'<i class="'+(i<LVL.balls-ballsLeft?'used':'')+'"></i>').join('')}


