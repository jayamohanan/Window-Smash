'use strict';
/* ---------- levels ---------- */
/* Pane fields: x,y,w,h on the wall plane; prop+wall = room behind (house only);
   shutter:{phase} = roller shutter on a loop; armor:1 = wooden boards (one kick each); hp:2 = wired glass (cracks first);
   sky:true = skylight in the porch roof (needs porch:true).
   rail:{amp,speed,phase} = stand window sliding on a rail; hang:true = hangs from the gantry;
   back/roof:true = greenhouse back wall / roof glass.
   Level fields: board = sliding barrier, hedges = soft blockers, wind = sideways push (m/s²), tut = hand tutorial,
   mill = windmill on the house front, gantry = overhead beam, island = two-step island hop (first = the glass frames on the near island; panes = the house on the far one), bonus = no fail (greenhouse), free = unlimited balls and no ball row (onboarding levels),
   switch = bullseye that unlocks shutter:{lock:true} windows, cat = a cat on one window's sill blocks it and hops between windows, pads = bounce pads, gwall = garden wall, night = lighthouse night (memory level), layout = function returning fresh panes on each attempt, towers = mansion towers, wheel = solid disc with one gap on the house front.
   type:'field' = free-standing panes placed by a builder (field:'stack' | 'carousel' | 'behind' | 'aquarium' | 'tunnel').
   tunnel:{mx,zm,w0,h0,gap,s1,rc,turn,s2} = deep frame: a row of empty window frames (gap m apart) along a curve; the first frame (w0×h0)
     stands at x mx / z zm, then s1 m straight back, an arc of radius rc turning left by turn°, s2 m straight; they shrink to the pane's size.
   carousel.items: {empty:true} = frame only, {inner:true} = mesh outside, glass facing the centre; inner = windows standing inside the circle.
   spin:[pane indexes] (house) = spin boards on poles in front of those windows; type field + field:'flip' + flip:{bar,w,h,items,win|glass} = panels on a bar that tip over when kicked high.
   awn:true (house pane) = wire mesh over it, awning below that springs the ball up into the gap; revolver = revolving door with 4 glass wings.
   garage:{x,w,h,btn:{x,y}} (house) = garage with a closed roller shutter; the push button beside it opens it, and the parked SUV's rear window is a target. */
const GX=[-4.5,-1.5,1.5,4.5];
const ghPanes=()=>[...GX.map(x=>({x,y:1.7,w:2.8,h:2.2})),...GX.map(x=>({x,y:4,w:2.8,h:2.2})),...GX.map(x=>({x,y:2.9,w:2.8,h:4.4,back:true})),...GX.map(x=>({x,w:2.8,h:2.3,roof:true}))];
const two=()=>[{x:-3.9,y:2.8,w:2.6,h:2.3,prop:'tv',wall:0xffe6b0},{x:3.9,y:2.8,w:2.6,h:2.3,prop:'vase',wall:0xcfe8d5}];
const four=()=>[{x:-3.9,y:2.5,w:2.4,h:2.1,prop:'fish',wall:0xcfe0f0},{x:3.9,y:2.5,w:2.4,h:2.1,prop:'cake',wall:0xffd7c8},{x:-3.9,y:6.1,w:2.4,h:2.1,prop:'vase',wall:0xe3d6f2},{x:3.9,y:6.1,w:2.4,h:2.1,prop:'tv',wall:0xd9efc6}];
const isle1=()=>[{x:-2.9,y:2.3,w:2,h:1.8},{x:0,y:3.4,w:2,h:1.8},{x:2.9,y:2.7,w:2,h:1.8}];
const LV=[
 {name:'First Kick',type:'stand',balls:3,free:true,tut:true,panes:[{x:0,y:3,w:4.4,h:3.4}]},
 {name:'Three Stands',type:'stand',balls:5,free:true,panes:[{x:-5.4,y:2.3,w:2.3,h:2},{x:0,y:4.4,w:2.3,h:2},{x:5.4,y:3.2,w:2.3,h:2}]},
 {name:'Deep Frame',type:'field',field:'tunnel',balls:3,tunnel:{mx:3.5,zm:3,w0:3,h0:2.6,gap:.7,s1:3,rc:4.5,turn:120,s2:1},panes:[{x:0,y:1,w:1.3,h:1.1}]},
 {name:'First House',type:'house',H:5.2,G:2.3,W:7,balls:4,panes:[{x:-3.9,y:2.8,w:2.6,h:2.3,prop:'tv',wall:0xffe6b0},{x:3.9,y:2.8,w:2.6,h:2.3,prop:'vase',wall:0xcfe8d5}]},
 {name:'Four Windows',type:'house',H:8.2,G:2.2,W:7,balls:6,panes:[{x:-3.9,y:2.5,w:2.4,h:2.1,prop:'fish',wall:0xcfe0f0},{x:3.9,y:2.5,w:2.4,h:2.1,prop:'cake',wall:0xffd7c8},{x:-3.9,y:6.1,w:2.4,h:2.1,prop:'vase',wall:0xe3d6f2},{x:3.9,y:6.1,w:2.4,h:2.1,prop:'tv',wall:0xd9efc6}]},
 {name:'Stacked Windows',type:'field',field:'stack',balls:5,layout:()=>stackPanes(),panes:[]},
 {name:'Sliding Board',type:'house',H:5.2,G:2.3,W:7,balls:5,board:{z:2.4,w:6,amp:4.2,speed:1.25},panes:[{x:-3.9,y:2.8,w:2.6,h:2.3,prop:'tv',wall:0xffe6b0},{x:3.9,y:2.8,w:2.6,h:2.3,prop:'vase',wall:0xcfe8d5}]},
 {name:'Shutters',type:'house',H:5.2,G:2.3,W:7,balls:5,panes:[{x:-3.9,y:2.8,w:2.6,h:2.3,prop:'tv',wall:0xffe6b0,shutter:{phase:0}},{x:3.9,y:2.8,w:2.6,h:2.3,prop:'vase',wall:0xcfe8d5,shutter:{phase:.5}}]},
 {name:'Boarded Up',type:'house',H:5.2,G:2.3,W:7,balls:6,panes:[{x:-3.9,y:2.8,w:2.6,h:2.3,prop:'tv',wall:0xffe6b0,armor:1},{x:3.9,y:2.8,w:2.6,h:2.3,prop:'vase',wall:0xcfe8d5,hp:2}]},
 {name:'Over the Hedge',type:'house',H:5.8,G:2.3,W:7,balls:6,porch:true,hedges:[{x:-4.2,z:2.1,w:3.8,h:2.5},{x:4.2,z:2.1,w:3.8,h:2.5}],
   panes:[{x:-4.2,y:3.75,w:2.4,h:2.1,prop:'fish',wall:0xcfe0f0},{x:4.2,y:3.75,w:2.4,h:2.1,prop:'cake',wall:0xffd7c8},{sky:true,w:2.2,h:1.8}]},
 {name:'Garage',type:'house',H:8.2,G:2.2,W:7.5,balls:7,garage:{x:3.9,w:4,h:3.3,btn:{x:6.7,y:1.9}},
   panes:[{x:-3.9,y:2.5,w:2.4,h:2.1,prop:'tv',wall:0xffe6b0},{x:3.9,y:6.1,w:2.4,h:2.1,prop:'vase',wall:0xcfe8d5}]},
 {name:'Windy Day',type:'house',H:8.2,G:2.2,W:7,balls:7,wind:7,panes:four()},
 {name:'Spin Board',type:'house',H:5.2,G:2.3,W:7,balls:5,spin:[0,1],panes:two()},
 {name:'Bonus: Greenhouse',type:'greenhouse',bonus:true,balls:12,panes:ghPanes()},
 {name:'Windmill',type:'house',H:5.2,G:2.3,W:7,balls:5,mill:{x:0,y:4.4,z:1.6,len:4.2,speed:.9},panes:[{x:-3.4,y:2.8,w:2.5,h:2.3,prop:'tv',wall:0xffe6b0},{x:3.4,y:2.8,w:2.5,h:2.3,prop:'vase',wall:0xcfe8d5}]},
 {name:'Rail Riders',type:'stand',balls:5,gantry:{x:8,y:7.2},panes:[{x:0,y:2.4,w:2.5,h:2.1,rail:{amp:4.8,speed:.95}},{x:0,y:5.3,w:2.3,h:1.9,hang:true,rail:{amp:4.8,speed:1.35,phase:Math.PI}}]},
 {name:'Carousel',type:'field',field:'carousel',balls:10,carousel:{r:5.6,z:-1.5,speed:.4,items:[{y:2.8,w:2.6,h:2.3},{y:2.8,w:2.6,h:2.3,hp:2},{y:2.8,w:2.6,h:2.3},{y:2.8,w:2.6,h:2.3,hp:2},{y:2.8,w:2.6,h:2.3}]},panes:[]},
 {name:'Inner Ring',type:'field',field:'carousel',balls:9,carousel:{r:5.6,z:-1.5,speed:.36,items:[{y:2.8,w:2.6,h:2.3},{y:2.8,w:2.6,h:2.3,empty:true},{y:2.8,w:2.6,h:2.3},{y:2.8,w:2.6,h:2.3,empty:true},{y:2.8,w:2.6,h:2.3},{y:2.8,w:2.6,h:2.3,empty:true}]},inner:[{x:-2.6,y:2.4,z:-1.5,w:2.1,h:1.9},{x:0,y:3.4,z:-1.5,w:2.1,h:1.9},{x:2.6,y:2.4,z:-1.5,w:2.1,h:1.9}],panes:[]},
 {name:'Mind the Cat',type:'house',H:8.2,G:2.2,W:7,balls:7,cat:true,panes:[{x:-3.9,y:2.5,w:2.4,h:2.1,prop:'fish',wall:0xcfe0f0},{x:3.9,y:2.5,w:2.4,h:2.1,prop:'cake',wall:0xffd7c8},
   {x:-4.6,y:6.1,w:2.2,h:2.1,prop:'vase',wall:0xe3d6f2},{x:0,y:6.1,w:2.2,h:2.1,prop:'cake',wall:0xffe6b0},{x:4.6,y:6.1,w:2.2,h:2.1,prop:'tv',wall:0xd9efc6}]},
 {name:'Aquarium',type:'field',field:'aquarium',balls:9,panes:[]},
 {name:'Island Hop',type:'house',H:5.2,G:2.3,W:7,balls:9,island:true,first:isle1(),panes:two()},
 {name:'Stormy Mill',type:'house',H:8.2,G:2.2,W:7,balls:8,wind:-6,mill:{x:0,y:4.6,z:1.6,len:4.5,speed:1.1},panes:four()},
 {name:'Tip Over',type:'field',field:'flip',balls:8,flip:{bar:{y:3,z:2.5},w:2.7,h:2.5,items:[{x:-4.6},{x:0},{x:4.6}],win:{y:4.35,z:-1,w:2,h:1.8}},panes:[]},
 {name:'Flip Side',type:'field',field:'flip',balls:8,flip:{bar:{y:3.1,z:1.5},w:2.6,h:2.5,items:[{x:-4.4},{x:0},{x:4.4}],glass:true},panes:[]},
 {name:'Through the Gap',type:'house',H:8.2,G:2.2,W:7,balls:8,wheel:{x:0,y:4.6,z:1.6,r:6.2,gap:Math.PI/2,speed:.45},panes:four()},
 {name:'Revolving Door',type:'house',H:5.2,G:2.3,W:7,balls:9,revolver:{z:0,r:1.2,h:3,wall:true},panes:two()},
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
  grump=null;door=null;grumpT=-1;obs=[];movers=[];lt=0;wind=0;hop=null;sw=null;pads=[];padWall=null;tunnel=null;hinges=[];catS=null;wheel=null;behind=null;revolver=null;pond=null;garage=null;camOff.set(0,0,0);spot.visible=true;
}
function makeFrame(p,parent,c){const f=.2,z=.1;
  box(p.w+f*2,f,.34,c,p.x,p.y+p.h/2+f/2,z,parent);box(p.w+f*2,f,.34,c,p.x,p.y-p.h/2-f/2,z,parent);
  box(f,p.h,.34,c,p.x-p.w/2-f/2,p.y,z,parent);box(f,p.h,.34,c,p.x+p.w/2+f/2,p.y,z,parent)}
function makePane(p,parent){const m=new T.Mesh(new T.PlaneGeometry(p.w,p.h),glassMat);m.position.set(p.x,p.y,0);m.renderOrder=3;parent.add(m);p.mesh=m;p.broken=false;addGlare(p)}

/* A lit hallway behind the revolving door (built like the window rooms), so the wings turn into a room, not a black hole. */
function makeHall(g){
  const w=3.4,h=4,dp=5,c=new T.Color(0xf3d2b3),shade=k=>new T.MeshBasicMaterial({color:c.clone().multiplyScalar(k),side:T.BackSide});
  const m=new T.Mesh(new T.BoxGeometry(w,h,dp),[shade(.78),shade(.78),new T.MeshBasicMaterial({color:0xfff6dc,side:T.BackSide}),new T.MeshBasicMaterial({color:0x9a6b43,side:T.BackSide}),shade(.5),shade(1)]);
  m.position.set(0,h/2,-.22-dp/2);g.add(m);
  box(1.3,.02,dp-.4,0xd9503f,0,.02,-.22-dp/2,g,false);[-1,1].forEach(s=>box(.08,.025,dp-.4,0xffc53a,s*.5,.025,-.22-dp/2,g,false)); /* runner rug */
  const bz=-.22-dp+.04;box(1.3,.95,.05,0x8a5f3b,0,2.3,bz,g,false);box(1.1,.45,.02,0x8fd0ee,0,2.48,bz+.04,g,false);box(1.1,.32,.02,0x5da845,0,2.09,bz+.04,g,false); /* picture */
  const rx=-1.35,rz=-3.2;box(.42,.06,.42,0x5a3d26,rx,.03,rz,g,false);box(.08,1.95,.08,0x5a3d26,rx,1,rz,g,false); /* coat rack */
  [[.18,0],[-.18,0],[0,.18]].forEach(o=>box(.24,.05,.05,0x5a3d26,rx+o[0]*.6,1.85,rz+o[1]*.6,g,false));
  const hat=new T.Mesh(new T.CylinderGeometry(.2,.22,.2,16),mat(0x3f6fc2));hat.position.set(rx+.16,2.02,rz);g.add(hat);
  const brim=new T.Mesh(new T.CylinderGeometry(.34,.34,.03,18),mat(0x3f6fc2));brim.position.set(rx+.16,1.93,rz);g.add(brim);
  const coat=box(.42,.8,.14,0xd9503f,rx,1.4,rz+.12,g,false);coat.rotation.y=.2;
}
/* Curtains: a cloth with vertical folds. The plane is waved in depth, and the fold light and shade is painted in the texture
   (rooms are unlit), with crests lining up with the waves. CF folds across one curtain. */
const CF=4,foldPh=u=>u*CF*Math.PI*2+.9*Math.sin(u*7.3+.6); /* uneven fold widths, so it reads as cloth, not stripes */
const curtainTex=canvasTex(256,4,(g,w,h)=>{const lo=[168,52,40],hi=[236,112,90];for(let x=0;x<w;x++){const k=Math.pow(.5+.5*Math.cos(foldPh((x+.5)/w)),1.2);g.fillStyle='rgb('+lo.map((c,i)=>Math.round(c+(hi[i]-c)*k)).join(',')+')';g.fillRect(x,0,1,h)}});
const curtainMat=new T.MeshBasicMaterial({map:curtainTex});
/* Tied back: full width at the top, pinched to CT.pinch at the tie (CT.v of the height, from the bottom; 25%), flaring to CT.foot
   at the hem. Anchored on the window-side edge (s: -1 left curtain, 1 right), so the folds bunch toward the tie. */
const CT={v:.25,pinch:.4,foot:.6};
/* Each curtain covers at most CURT.max of the window's width (per side, as seen in the opening), so the room always shows.
   About half the windows have tied-back curtains; the rest hang straight, each side covering a different CURT.min..max.
   The choice is seeded from the window's position and the level, so a retry looks the same. */
const CURT={max:.22,min:.1,tied:.5,hidden:.08}; /* hidden: the strip of cloth tucked behind the frame */
const hash=n=>{const x=Math.sin(n)*43758.5453;return x-Math.floor(x)};
const curtainW=v=>v>=CT.v?CT.pinch+(1-CT.pinch)*Math.pow((v-CT.v)/(1-CT.v),1.4):CT.pinch+(CT.foot-CT.pinch)*Math.pow((CT.v-v)/CT.v,.8);
function curtainGeo(w,h,s,tied){const geo=new T.PlaneGeometry(w,h,CF*8,16),a=geo.attributes.position;
  for(let i=0;i<a.count;i++){const u=a.getX(i)/w+.5,v=a.getY(i)/h+.5,k=tied?curtainW(v):1,q=s<0?u:1-u; /* q: 0 at the outer edge */
    a.setX(i,s*(w/2-q*k*w));a.setZ(i,.04*Math.cos(foldPh(u))*(.6+.4*k))}a.needsUpdate=true;return geo}
function makeRoom(p,parent){
  const w=p.w+2.4,h=p.h+1.3,dp=5,floor=p.y-p.h/2-.45,cy=floor+h/2,c=new T.Color(p.wall);
  const shade=k=>new T.MeshBasicMaterial({color:c.clone().multiplyScalar(k),side:T.BackSide});
  const m=new T.Mesh(new T.BoxGeometry(w,h,dp),[shade(.78),shade(.78),new T.MeshBasicMaterial({color:0xfff6dc,side:T.BackSide}),new T.MeshBasicMaterial({color:0x9a6b43,side:T.BackSide}),shade(.5),shade(1)]);
  m.position.set(p.x,cy,-.22-dp/2);parent.add(m);
  {const seed=p.x*12.9898+p.y*78.233+level*3.7,tied=hash(seed)<CURT.tied,ch=p.h+.2;
  [-1,1].forEach((s,j)=>{const vis=tied?Math.min(.54,CURT.max*p.w):p.w*lerp(CURT.min,CURT.max,hash(seed+j*5.1+1)),cw=vis+CURT.hidden,cx=p.x+s*(p.w/2+CURT.hidden-cw/2);
    const cur=new T.Mesh(curtainGeo(cw,ch,s,tied),curtainMat);cur.position.set(cx,p.y,-.34);parent.add(cur);
    if(!tied)return;const tw=CT.pinch*cw+.04,tie=new T.Mesh(new T.BoxGeometry(tw,.1,.1),bmat(0xffc53a));tie.position.set(cx+s*(cw/2-tw/2+.02),p.y-ch/2+CT.v*ch,-.3);parent.add(tie)})} /* tied back low */
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
  const rv=!!L.revolver,dw=rv?1.3:.95,dh=rv?3.6:3.3; /* doorway half-width and height (wider and taller for the revolving door) */
  hole(-dw,0,dw,dh);
  if(L.garage){const o=L.garage;hole(o.x-o.w/2,0,o.x+o.w/2,o.h)}
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
  if(rv)makeHall(g);else{const dark=new T.Mesh(new T.PlaneGeometry(1.9,3.3),bmat(0x2b2230));dark.position.set(0,1.65,-.16);g.add(dark)}
  [-1,1].forEach(s=>box(.24,dh+.2,.38,0xfffaf0,s*(dw+.12),(dh+.2)/2,.1,g));box(dw*2+.48,.24,.38,0xfffaf0,0,dh+.12,.1,g);
  if(rv){door=new T.Group();g.add(door)} /* no swing door: the owner's win walk still sets door.rotation */
  else{const pivot=new T.Group();pivot.position.set(-.95,0,.16);g.add(pivot);box(1.9,3.28,.12,0x2f7e77,.95,1.64,0,pivot);box(1.3,.9,.03,0x276963,.95,2.45,.07,pivot,false);box(1.3,.9,.03,0x276963,.95,1.15,.07,pivot,false);const kn=new T.Mesh(new T.SphereGeometry(.1,10,8),mat(0xffc53a));kn.position.set(1.65,1.6,.12);pivot.add(kn);door=pivot}
  [-1,1].forEach(s=>[.7,1.5].forEach(k=>{const b=new T.Mesh(new T.IcosahedronGeometry(.9,1),mat(k<1?0x3f8f3e:0x4fa04a));b.position.set(s*(W+k*.9),.65,.9);b.castShadow=true;g.add(b)}));
  if(!L.island&&!L.gwall)for(let i=0;i<7;i++){const st=new T.Mesh(new T.CylinderGeometry(.55,.6,.05,9),mat(0xcdbb9b));st.position.set(Math.sin(i*1.5)*.22,.03,1.1+i*1.45);st.receiveShadow=true;g.add(st)}
  const n=new T.Group();
  const body=box(1,1.25,.55,0x3f6fc2,0,1.5,0,n);
  box(.36,.9,.42,0x383f55,-.24,.45,0,n);box(.36,.9,.42,0x383f55,.24,.45,0,n);
  /* head group: the face moves with the head (positions inside are relative to the head centre at y 2.55) */
  const head=new T.Group();head.position.y=2.55;n.add(head);
  const skull=new T.Mesh(new T.SphereGeometry(.47,16,12),mat(0xf0bd93));skull.castShadow=true;head.add(skull);
  const mouth=box(.72,.12,.08,0x2b2230,0,-.1,.44,head,false),brows=[];
  [-1,1].forEach(s=>{const e=box(.34,.09,.06,0x2b2230,s*.2,.25,.43,head,false);e.rotation.z=s*-.42;brows.push({e,s});const y=new T.Mesh(new T.SphereGeometry(.07,8,6),bmat(0x2b2230));y.position.set(s*.18,.11,.45);head.add(y)});
  const nose=new T.Mesh(new T.SphereGeometry(.12,8,6),mat(0xe59a78));nose.position.set(0,.01,.5);head.add(nose);
  /* arms pivot at the shoulders: the right one is raised (fist up / finger wag), the left one hangs */
  const hand=(par,y)=>{const f=new T.Mesh(new T.SphereGeometry(.24,10,8),mat(0xf0bd93));f.position.y=y;par.add(f)};
  const arm2=new T.Group();arm2.position.set(-.62,2,0);n.add(arm2);box(.28,1,.3,0x3f6fc2,0,-.45,0,arm2);hand(arm2,-1.02);
  const arm=new T.Group();arm.position.set(.62,2,0);n.add(arm);box(.28,1,.3,0x3f6fc2,0,.45,0,arm);hand(arm,1.05);
  n.position.set(0,0,-.6);n.visible=false;g.add(n);Object.assign(n.userData,{arm,arm2,head,mouth,brows,smug:false});grump=n;
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
  buildMech(LVL);armShutTrick(LVL);
  ballsLeft=LVL.free?1e9:LVL.balls;used=0;won=false;
  $('lvlNo').textContent='Level '+(level+1);
  drawBalls();spawnBall();updateHint();chips();
}
/* Dev sandbox: empty yard (no house, stand or glass) with unlimited balls, for testing kick feel and juice. */
let sandbox=false;
function loadSandbox(){
  clearLevel();sandbox=true;LVL={name:'Sandbox',type:'sandbox',balls:0,panes:[]};
  group=new T.Group();scene.add(group);panes=[];world.visible=true;setNight(false);
  buildTestPanes();
  ballsLeft=1e9;used=0;won=false;
  $('lvlNo').textContent='Sandbox';
  drawBalls();spawnBall();updateHint();chips();
}
/* Sandbox aim test: three towers, near (left, z 6) / mid (centre, z 1.5) / far (right, z -4), each with a low, middle and high
   window and a clear gap between them, so every window can be hit on its own. A broken one comes back after 2.5 s. */
function buildTestPanes(){
  const w=2,h=1.7,ys=[1.1,4.1,7.1];
  [[-4.8,6],[0,1.5],[7,-4]].forEach(([x,z])=>{
    ys.forEach(y=>{const p={w,h,stop:true,z};freeStand(p,new T.Vector3(x,y,z));panes.push(p)});
    const top=ys[ys.length-1]-h/2;[-1,1].forEach(s=>box(.18,top,.18,0x8a5f3b,x+s*(w/2+.1),top/2,z+.1,group))});
  movers.push((t,dt)=>panes.forEach(p=>{if(!p.broken){p.rt=0;return}p.rt=(p.rt||0)+dt;if(p.rt>2.5){p.rt=0;p.broken=false;p.mesh.visible=true;(p.extra||[]).forEach(m=>m.visible=true)}}));
}
const reloadLevel=()=>sandbox?loadSandbox():loadLevel(level);
function drawBalls(){$('balls').classList.toggle('last',!sandbox&&!LVL.bonus&&!won&&ballsLeft===1);if(sandbox||LVL.free){$('balls').innerHTML='';return}$('balls').innerHTML=Array.from({length:LVL.balls},(_,i)=>'<i class="'+(i<LVL.balls-ballsLeft?'used':'')+'"></i>').join('')}


