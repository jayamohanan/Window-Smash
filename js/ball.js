'use strict';
/* ---------- football ---------- */
const ballMat=(function(){
  const p=(1+Math.sqrt(5))/2, P=[],H=[];
  [1,-1].forEach(a=>[1,-1].forEach(b=>{P.push([0,a,b*p],[a,b*p,0],[b*p,0,a])}));
  [1,-1].forEach(a=>[1,-1].forEach(b=>{[1,-1].forEach(c=>H.push([a,b,c]));H.push([0,a/p,b*p],[a/p,b*p,0],[b*p,0,a/p])}));
  const N=v=>{const l=Math.hypot(...v);return v.map(x=>x/l)}, Ps=P.map(N), Hs=H.map(N);
  const tex=canvasTex(512,256,(g,w,h)=>{const im=g.createImageData(w,h);let k=0;
    for(let y=0;y<h;y++){const th=(y+.5)/h*Math.PI,st=Math.sin(th),ct=Math.cos(th);for(let x=0;x<w;x++){const ph=(x+.5)/w*2*Math.PI,v=[st*Math.cos(ph),ct,st*Math.sin(ph)];let d1=9,d2=9,isP=false;
      const test=(c,wt,pp)=>{const d=Math.acos(clamp(v[0]*c[0]+v[1]*c[1]+v[2]*c[2],-1,1))*wt;if(d<d1){d2=d1;d1=d;isP=pp}else if(d<d2)d2=d};
      Ps.forEach(c=>test(c,1.2,true));Hs.forEach(c=>test(c,1,false));
      const seam=d2-d1<.02,c=seam?[120,128,140]:isP?[31,38,52]:[250,249,243];
      im.data[k++]=c[0];im.data[k++]=c[1];im.data[k++]=c[2];im.data[k++]=255}}
    g.putImageData(im,0,0)});
  return new T.MeshPhongMaterial({map:tex,shininess:45,specular:0x444444});
})();
const R=.3, ballGeo=new T.SphereGeometry(R,32,24);
const shadowTex=canvasTex(64,64,(g,w,h)=>{const a=g.createRadialGradient(32,32,2,32,32,32);a.addColorStop(0,'rgba(20,30,20,.55)');a.addColorStop(1,'rgba(20,30,20,0)');g.fillStyle=a;g.fillRect(0,0,w,h)});

/* ---------- balls ---------- */
function spawnBall(){
  if(ballsLeft<=0||won||cur)return;
  const m=new T.Mesh(ballGeo,ballMat);m.castShadow=true;m.position.set(0,R,D);m.scale.setScalar(.01);scene.add(m);
  const sh=new T.Mesh(new T.PlaneGeometry(1.2,1.2),new T.MeshBasicMaterial({map:shadowTex,transparent:true,depthWrite:false}));sh.rotation.x=-Math.PI/2;sh.position.set(0,.04,D);scene.add(sh);
  cur={m,sh,p:m.position,v:new T.Vector3(),a:new T.Vector3(),state:'idle',age:0,born:0,spin:new T.Vector3(1,0,0)};
}
function removeBallMesh(b){scene.remove(b.m);scene.remove(b.sh);b.sh.material.dispose()}
const plane=new T.Plane(new T.Vector3(0,0,1),-.16),ray=new T.Raycaster(),ndc=new T.Vector2(),hitV=new T.Vector3();
const ZF=.16,G=16,BULGE=5;

