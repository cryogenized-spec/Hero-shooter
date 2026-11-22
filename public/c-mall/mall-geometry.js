/* Hero Shooter / Golden Dragon shop — original code-only 3D environment.
 * Ground +X east, +Y north, +Z up. Source "Chinese shop in a mall"
 * context: Chapter 1, Level 1, Sandton Mall, ~07:00, power outage.
 * Shop and mall geometry are a self-contained new scene, not Home & More.
 */
import * as THREE from 'three';
const m={
  floor:new THREE.MeshStandardMaterial({color:0x92827f,roughness:.73}),
  wall:new THREE.MeshStandardMaterial({color:0x483a42,roughness:.88}),
  trim:new THREE.MeshStandardMaterial({color:0x2a232b,metalness:.3,roughness:.57}),
  gold:new THREE.MeshStandardMaterial({color:0xc5a06a,metalness:.5,roughness:.35}),
  red:new THREE.MeshStandardMaterial({color:0x9b3e46,roughness:.7}),
  timber:new THREE.MeshStandardMaterial({color:0x533329,roughness:.67}),
  shelving:new THREE.MeshStandardMaterial({color:0x716668,metalness:.21,roughness:.7}),
  charcoal:new THREE.MeshStandardMaterial({color:0x23252c,roughness:.85}),
  paper:new THREE.MeshStandardMaterial({color:0xd0b69a,roughness:.9}),
  ceramic:new THREE.MeshStandardMaterial({color:0xe1d8cc,roughness:.43}),
  productGreen:new THREE.MeshStandardMaterial({color:0x50675a,roughness:.66}),
  productBlue:new THREE.MeshStandardMaterial({color:0x536279,roughness:.65}),
  lit:new THREE.MeshBasicMaterial({color:0xffd59b}),
  glass:new THREE.MeshPhysicalMaterial({color:0xbee3e6,transparent:true,opacity:.24,roughness:.12,metalness:.12,depthWrite:false,side:THREE.DoubleSide})
};
export function buildGoldenDragon(scene){
 const root=new THREE.Group();root.name='GoldenDragonMallLevel1';scene.add(root);
 const obstacles=[],events=[],lights=[];
 let seed=51923;
 const rand=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;};
 const cube=(mat,w,d,h,x,y,z)=>{
   const o=new THREE.Mesh(new THREE.BoxGeometry(w,d,h),mat);
   o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;root.add(o);return o;
 };
 const cylinder=(mat,r,h,x,y,z)=>{
   const o=new THREE.Mesh(new THREE.CylinderGeometry(r,r,h,12),mat);
   o.rotation.x=Math.PI/2;o.position.set(x,y,z);o.castShadow=true;root.add(o);return o;
 };
 const obstacle=(x,y,w,h,pad=.16)=>obstacles.push([x-w/2-pad,x+w/2+pad,y-h/2-pad,y+h/2+pad]);
 const interest=(name,x,y,r,description)=>events.push({name,x,y,r,description});
 const rng=[m.red,m.paper,m.productGreen,m.productBlue,m.gold,m.charcoal];
 function product(x,y,z,k){
  const mat=rng[k%rng.length];
  if(k%4===0)cylinder(mat,.075,.25,x,y,z);
  else cube(mat,.18+.08*rand(),.18+.06*rand(),.27,x,y,z);
 }
 function title(text,width,height,fontSize,x,y,z,faceOut=false){
   const cn=document.createElement('canvas');cn.width=1024;cn.height=192;
   const ct=cn.getContext('2d');
   ct.fillStyle='#652c38';ct.fillRect(0,0,1024,192);
   ct.lineWidth=7;ct.strokeStyle='#e3ba78';ct.strokeRect(13,12,998,166);
   ct.font='bold '+fontSize+'px Georgia, serif';ct.textAlign='center';ct.textBaseline='middle';
   ct.fillStyle='#ffe3b8';ct.shadowColor='#ffbf6a';ct.shadowBlur=12;
   ct.fillText(text,512,98,966);
   const map=new THREE.CanvasTexture(cn);map.colorSpace=THREE.SRGBColorSpace;
   const mesh=new THREE.Mesh(new THREE.PlaneGeometry(width,height),new THREE.MeshBasicMaterial({map,side:THREE.DoubleSide}));
   mesh.rotation.x=Math.PI/2; // Correct readable front-facing lettering, no mirror.
   mesh.position.set(x,y,z);root.add(mesh);return mesh;
 }
 function floor(w,h,x,y,z,tint){
  const c=document.createElement('canvas');c.width=256;c.height=256;
  const ctx=c.getContext('2d');ctx.fillStyle=tint;ctx.fillRect(0,0,256,256);
  for(let i=0;i<4;i++)for(let j=0;j<4;j++){
   ctx.fillStyle='rgba(255,238,213,'+(.026+rand()*.075)+')';
   ctx.fillRect(i*64+2,j*64+2,60,60);
  }
  ctx.strokeStyle='rgba(42,23,27,.27)';ctx.lineWidth=2;
  for(let i=0;i<=256;i+=64){
   ctx.beginPath();ctx.moveTo(i,0);ctx.lineTo(i,256);ctx.stroke();
   ctx.beginPath();ctx.moveTo(0,i);ctx.lineTo(256,i);ctx.stroke();
  }
  const tx=new THREE.CanvasTexture(c);tx.colorSpace=THREE.SRGBColorSpace;
  tx.wrapS=tx.wrapT=THREE.RepeatWrapping;tx.repeat.set(w/5,h/5);
  const mesh=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshStandardMaterial({map:tx,roughness:.69}));
  mesh.position.set(x,y,z);mesh.receiveShadow=true;root.add(mesh);
 }
 function light(x,y,z,color=0xffce9d,power=1.7){
  cube(m.trim,.88,.18,.075,x,y,z);
  cube(m.lit,.80,.14,.018,x,y,z-.055);
  const l=new THREE.PointLight(color,power,6.5,1.6);l.position.set(x,y,z-.18);scene.add(l);lights.push(l);
 }
 function shelf(x,y,length=3.45){
  const width=1.02,zmax=1.66;
  for(const sx of [-width/2,width/2]){
   for(const sy of [-length/2,length/2])cube(m.trim,.055,.055,zmax,sx+x,sy+y,zmax/2);
  }
  for(const z of [.16,.56,.95,1.34,1.65]){
   cube(m.shelving,width+.02,length+.05,.055,x,y,z);
  }
  for(const z of [.28,.70,1.09,1.46]){
   for(const sx of [-.25,.25]){
    for(let i=0;i<9;i++){
     const py=y-length/2+.26+i*(length-.52)/8;
     product(x+sx,py,z+.12,i+Math.floor(rand()*8));
    }
   }
  }
  obstacle(x,y,width,length,.28);
 }
 function decorativeLantern(x,y,z){
  cylinder(m.red,.19,.32,x,y,z);
  cylinder(m.gold,.20,.035,x,y,z+.18);
  cylinder(m.gold,.20,.035,x,y,z-.18);
  cube(m.gold,.015,.015,.24,x,y,z-.33);
  const l=new THREE.PointLight(0xff6e50,.65,3,1.5);l.position.set(x,y,z);scene.add(l);lights.push(l);
 }
 // Floors and full shell; top is left open for the camera.
 floor(18,16,0,0,.03,'#a39493');
 floor(33,7,0,-11.65,.023,'#726773');
 cube(m.wall,18.35,.28,3.1,0,8.03,1.55);
 cube(m.wall,.30,16.3,3.1,-9.05,0,1.55);
 cube(m.wall,.30,16.3,3.1,9.05,0,1.55);
 title('GOLDEN DRAGON',9.0,.93,100,0,7.79,2.49);
 // Storefront glass and open door 4.6 metres wide.
 for(const sign of [-1,1]){
  const x=sign*5.72;
  cube(m.trim,6.55,.15,2.60,x,-8.01,1.35);
  const gla=new THREE.Mesh(new THREE.PlaneGeometry(5.95,2.13),m.glass);
  gla.rotation.x=Math.PI/2;gla.position.set(x,-8.16,1.35);root.add(gla);
  obstacle(x,-8.01,6.55,.15,.18);
 }
 title('GOLDEN DRAGON',7.0,.58,97,0,-8.11,2.78,true);
 cube(m.gold,5.05,.16,.14,0,-8.05,2.96);
 decorativeLantern(-7.6,-7.48,2.24);decorativeLantern(7.6,-7.48,2.24);
 // Independent shop geometry: Chinese imported-goods aisles.
 for(const x of [-6.4,-3.8,-1.2,1.4])shelf(x,1.3,3.28);
 shelf(4.7,2.9,2.12);
 // Homewares and electronics endcaps along rear wall.
 for(let i=0;i<12;i++){
  const x=-8.0+i*1.4;
  const y=6.93;
  cube(rng[i%rng.length],.59,.45,.65,x,y,.41);
 }
 // Rear-left stockroom with open but blocked door.
 cube(m.timber,4.5,.20,2.5,-6.5,6.32,1.25);
 cube(m.trim,1.55,.21,2.45,-4.20,6.32,1.23);
 obstacle(-6.50,6.30,5.8,.25,.15);
 title('STOCK / STAFF',3.1,.40,65,-6.4,6.16,2.66);
 // Two checkout tills by right-hand/front side of entrance.
 cube(m.timber,3.12,1.18,1.05,6.59,-5.18,.53);
 cube(m.paper,3.18,1.22,.07,6.59,-5.18,1.08);
 obstacle(6.59,-5.18,3.12,1.18,.18);
 for(const x of [5.65,7.30]){
  cube(m.charcoal,.33,.24,.31,x,-4.98,1.32);
  cube(m.productBlue,.31,.03,.22,x,-5.13,1.4);
 }
 interest('Checkout',6.3,-6.75,1.4,'Two tills are offline, but a portable scanner still glows.');
 // Low checkout queue rail, not a physical barrier to movement.
 cube(m.gold,2.15,.06,.05,4.38,-7.19,.87);
 for(const x of [3.37,5.43])cylinder(m.trim,.045,.85,x,-7.19,.43);
 for(const x of [-6.8,-3.5,0,3.5,7])light(x,-3.72,2.88);
 for(const x of [-6,0,6])light(x,4.55,2.88,0xffdaab,1.35);
 // Mall passage under emergency lighting, dim neighbouring storefronts.
 cube(m.trim,33,.28,.36,0,-15.03,.2);
 for(const x of [-15.1,-10.3,10.3,15.1]){
  cylinder(m.trim,.38,3.1,x,-12.4,1.55);
  cylinder(m.gold,.44,.15,x,-12.4,.11);
 }
 for(const x of [-12,12]){
  cube(m.wall,4.30,.24,2.5,x,-14.81,1.25);
  const glass=new THREE.Mesh(new THREE.PlaneGeometry(4.02,2.1),m.glass);
  glass.rotation.x=Math.PI/2;glass.position.set(x,-14.98,1.43);root.add(glass);
 }
 title('LEVEL 1 · MALL CONCOURSE',10,.65,75,0,-14.96,2.41,true);
 for(const x of [-12,-7,-2,3,8,13])light(x,-12.6,3.32,0xc9b5b1,1.06);
 // Distant escalator is scenery only; do not mark elevated space walkable.
 for(let i=0;i<6;i++)cube(m.charcoal,.55,2.8,.14,-15.7+i*.54,-10.12,.22+i*.14);
 // Safe visual details: dropped merchandise and small broken tile shards.
 for(let i=0;i<14;i++){
  const p=cube(i%2?m.ceramic:m.paper,.04+rand()*.14,.05+rand()*.16,.012,-1.8+rand()*4.1,-7.3-rand()*.5,.055);
  p.rotation.z=rand()*6.28;
 }
 interest('Front shutter',0,-7.15,1.5,'The shop shutter stopped halfway up when the power failed.');
 interest('Stockroom',-6.3,5.24,1.7,'The receiving room is locked. Cartons block the passage.');
 interest('Display shelves',-4.2,-1.05,1.55,'Imported household goods, batteries, lanterns and small electronics.');
 interest('Mall concourse',0,-11.25,2.1,'The mall is almost dark. Only emergency lighting remains.');
 function walkable(x,y,r=.34){
  if(y< -14.48||y>7.58)return false;
  if(y> -8.23?Math.abs(x)>8.73:Math.abs(x)>16.10)return false;
  for(const [xmin,xmax,ymin,ymax] of obstacles){
   if(x+r>xmin&&x-r<xmax&&y+r>ymin&&y-r<ymax)return false;
  }
  return true;
 }
 if(!walkable(0,-6.50))throw Error('Golden Dragon spawn blocked');
 return {root,walkable,events,lights,shopSpawn:{x:0,y:-6.50,z:.04},chenSpawn:{x:6.4,y:-3.65,z:0}};
}
