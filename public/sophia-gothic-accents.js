/* Sophia gothic costume fittings for the user's actual CC0 rigged character.
 * All details below are original lightweight procedural geometry; the premade
 * garments, face, hair and 53-bone skinned body in the GLB remain untouched.
 * Accessories are positioned in WORLD space from bone positions every frame.
 */
import * as THREE from 'three';

const silver=new THREE.MeshStandardMaterial({color:0x9c9da5,metalness:.72,roughness:.32,side:THREE.DoubleSide});
const leather=new THREE.MeshStandardMaterial({color:0x1b101b,roughness:.75,side:THREE.DoubleSide});
const corsetMaterial=new THREE.MeshStandardMaterial({color:0x190f1c,roughness:.86,side:THREE.DoubleSide});
const netMaterial=new THREE.LineBasicMaterial({color:0x140d12,opacity:.7,transparent:true,depthWrite:false});
const UP=new THREE.Vector3(0,1,0);
const vv=()=>new THREE.Vector3();
function add(root,mesh){root.add(mesh);mesh.castShadow=true;return mesh;}
function pipe(root,coords,mat,r=.0017){
 return add(root,new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(coords.map(v=>new THREE.Vector3(...v))),30,r,5,false),mat));
}
function hoop(root,r=.016,wire=.0024,mat=silver){
 const m=new THREE.Mesh(new THREE.TorusGeometry(r,wire,6,32),mat);
 return add(root,m);
}
function crescent(root){
 const sh=new THREE.Shape(),outer=[],inner=[];
 for(let i=0;i<=30;i++){const a=(-.75+1.5*i/30)*Math.PI;outer.push([.026*Math.cos(a),.038*Math.sin(a)]);}
 for(let i=30;i>=0;i--){const a=(-.75+1.5*i/30)*Math.PI;inner.push([.019*Math.cos(a)+.013,.029*Math.sin(a)]);}
 sh.moveTo(...outer[0]);for(const p of [...outer.slice(1),...inner])sh.lineTo(...p);sh.closePath();
 return add(root,new THREE.Mesh(new THREE.ExtrudeGeometry(sh,{depth:.002,bevelEnabled:true,bevelSize:.0005,bevelThickness:.0005}),silver));
}
function diamondNet(r0,r1){
 const vertices=[],ns=20,nrings=13;
 const pt=(t,angle)=>{
  const r=r0+(r1-r0)*t;
  return [r*Math.cos(angle),.5-t,r*Math.sin(angle)];
 };
 for(let i=0;i<nrings;i++){
  const t=i/nrings,u=(i+1)/nrings;
  for(let n=0;n<ns;n++){
   const a=2*Math.PI*n/ns;
   vertices.push(...pt(t,a),...pt(u,a+Math.PI/ns));
   vertices.push(...pt(t,a),...pt(u,a-Math.PI/ns));
  }
 }
 const g=new THREE.BufferGeometry();
 g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
 return g;
}
function segment(mesh,a,b){
 const delta=b.clone().sub(a),length=delta.length();
 mesh.visible=length>.03;
 if(!mesh.visible)return;
 mesh.position.copy(a).addScaledVector(delta,.5);
 mesh.quaternion.setFromUnitVectors(UP,delta.normalize());
 mesh.scale.y=length;
}
export function dressWithGothicDetails(model,look='street'){
 const world=model.parent;
 if(!world)throw Error('Gothic wardrobe requires attached model');
 const required=['head','neck_01','spine_03','pelvis','thigh_l','thigh_r','calf_l','calf_r','foot_l','foot_r'];
 const bone={};
 model.traverse(o=>{if(required.includes(o.name))bone[o.name]=o;});
 for(const name of required)if(!bone[name])throw Error('Missing gothic rig bone '+name);
 const pos=Object.fromEntries(required.map(k=>[k,vv()]));
 const created=[];
 const own=(o)=>{created.push(o);return o;};
 const ear=[own(hoop(world)),own(hoop(world))];
 const chok=own(hoop(world,.071,.009,leather));chok.rotation.x=Math.PI/2;
 const moon=own(crescent(world));
 const neckChain=own(pipe(world,[[-.10,.025,0],[-.06,-.035,.01],[0,-.11,.014],[.06,-.035,.01],[.10,.025,0]],silver,.0018));
 const bodyStraps=[own(hoop(world,.145,.008,leather)),own(hoop(world,.14,.008,leather))];
 bodyStraps.forEach(o=>o.rotation.x=Math.PI/2);
 const clasp=[0,1].map(()=>own(add(world,new THREE.Mesh(new THREE.BoxGeometry(.034,.032,.007),silver))));
 const hipChains=[
  own(pipe(world,[[-.18,.02,.11],[-.13,-.05,.15],[-.03,-.10,.16],[.09,-.09,.15],[.17,.02,.09]],silver,.0020)),
  own(pipe(world,[[-.18,.02,.11],[-.12,-.09,.15],[.015,-.13,.16],[.17,.02,.09]],silver,.0019))
 ];
 // A fitted dark leather corset shell is the only garment supplement;
 // the long-sleeve jacket/skirt and boots remain ready-made CC0 assets.
 const corset=own(add(world,new THREE.Mesh(
  new THREE.CylinderGeometry(.146,.136,.33,40,1,true,-Math.PI/2,Math.PI),corsetMaterial)));
 const net={},buckles={};
 for(const side of ['l','r']){
  const thigh=own(new THREE.LineSegments(diamondNet(.072,.059),netMaterial));
  const shin=own(new THREE.LineSegments(diamondNet(.062,.053),netMaterial));
  thigh.frustumCulled=false;shin.frustumCulled=false;world.add(thigh,shin);
  net[side]={thigh,shin};
  buckles[side]=[];
  for(let i=0;i<3;i++){
   const ring=own(hoop(world,.075,.009,leather));
   const plate=own(add(world,new THREE.Mesh(new THREE.BoxGeometry(.028,.024,.008),silver)));
   buckles[side].push({ring,plate});
  }
 }
 function update(){
  model.updateMatrixWorld(true);
  for(const [key,b] of Object.entries(bone))b.getWorldPosition(pos[key]);
  const head=pos.head,neck=pos.neck_01,chest=pos.spine_03,pelvis=pos.pelvis;
  const fwd=.012;
  for(let i=0;i<2;i++){
   ear[i].position.set(head.x+(i? .082:-.082),head.y+.040,head.z+.018);
  }
  chok.position.set(neck.x,neck.y+.011,neck.z);
  // Anchor jewelry above the bust (not at the waist).
  const pendantY=chest.y+.075;
  moon.position.set(chest.x,pendantY,chest.z+.170);
  neckChain.position.set(chest.x,pendantY+.097,chest.z+.139);
  for(let i=0;i<2;i++){
   const y=pelvis.y+.18-i*.08;
   bodyStraps[i].position.set(pelvis.x,y,pelvis.z);
   clasp[i].position.set(pelvis.x+.061,y,pelvis.z+.153);
  }
  hipChains.forEach(c=>c.position.set(pelvis.x,pelvis.y-.055,pelvis.z));
  corset.position.set(pelvis.x,pelvis.y+.205,pelvis.z);
  for(const side of ['l','r']){
   const hip=pos['thigh_'+side],knee=pos['calf_'+side],ankle=pos['foot_'+side];
   const ab=(a,b,t)=>a.clone().lerp(b,t);
   segment(net[side].thigh,ab(hip,knee,look==='dress'?.86:.42),ab(hip,knee,.93));
   segment(net[side].shin,ab(knee,ankle,.08),ab(knee,ankle,.46));
   for(let i=0;i<3;i++){
    const p=ab(knee,ankle,.43+i*.16);
    const set=buckles[side][i];set.ring.position.copy(p);
    set.ring.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),ankle.clone().sub(knee).normalize());
    set.plate.position.copy(p);set.plate.position.z+=.078;
   }
  }
 }
 update();
 return {variant:look,update,dispose(){
  for(const obj of created){obj.parent?.remove(obj);obj.geometry?.dispose();}
 }};
}
