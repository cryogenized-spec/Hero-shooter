/* Hero Shooter / Sophia Gothic wardrobe details
 * Original CC0 MakeHuman body, clothing and skeleton preserved. Small original
 * procedural accessories added as render meshes (not borrowed game assets).
 */
import * as THREE from 'three';

const DARK=new THREE.MeshStandardMaterial({color:'#110e16',roughness:.7,metalness:.06,side:THREE.DoubleSide});
const LEATHER=new THREE.MeshStandardMaterial({color:'#241923',roughness:.52,metalness:.12,side:THREE.DoubleSide});
const METAL=new THREE.MeshStandardMaterial({color:'#c5c4c5',metalness:.82,roughness:.26,side:THREE.DoubleSide});
const NET=new THREE.LineBasicMaterial({color:0x120a13,transparent:true,opacity:.73,depthWrite:false});
const BONE_NAMES=['head','neck_01','spine_03','spine_02','pelvis','thigh_l','thigh_r','calf_l','calf_r','foot_l','foot_r'];
const AXIS=new THREE.Vector3(0,1,0);
const vec=()=>new THREE.Vector3();

function ring(parent,r,t,mat,x=0,y=0,z=0){
 const m=new THREE.Mesh(new THREE.TorusGeometry(r,t,7,54),mat);
 // Torus default normal +Z; make it horizontal around Y.
 m.rotation.x=Math.PI/2;
 m.position.set(x,y,z);m.castShadow=true;parent.add(m);return m;
}
function wire(parent,points,r=.0023){
 const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)));
 const m=new THREE.Mesh(new THREE.TubeGeometry(curve,32,r,6,false),METAL);
 m.castShadow=true;parent.add(m);return m;
}
function metalPlate(parent,w,h,xyz){
 const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,.008),METAL);
 m.position.set(...xyz);parent.add(m);return m;
}
function crescent(){
 // A silver pagan crescent (not a cross); outline open on the upper right.
 const shape=new THREE.Shape();
 const outer=[],inner=[];
 for(let i=0;i<=30;i++){
  const a=(-.70+1.45*i/30)*Math.PI;
  outer.push([.031*Math.cos(a),.043*Math.sin(a)]);
 }
 for(let i=30;i>=0;i--){
  const a=(-.70+1.45*i/30)*Math.PI;
  inner.push([.023*Math.cos(a)+.015,.032*Math.sin(a)]);
 }
 const points=[...outer,...inner];
 shape.moveTo(points[0][0],points[0][1]);
 for(const p of points.slice(1))shape.lineTo(p[0],p[1]);
 shape.closePath();
 return new THREE.Mesh(new THREE.ExtrudeGeometry(shape,{depth:.003,bevelEnabled:true,bevelSize:.001,bevelThickness:.001,bevelSegments:1}),METAL);
}
function fishnetGeometry(radiusTop,radiusBottom,rings=17,sides=22){
 const arr=[];const step=2*Math.PI/sides;
 const pt=(v,a)=>{
  const rad=radiusTop+(radiusBottom-radiusTop)*v;
  return [rad*Math.cos(a),.5-v,rad*Math.sin(a)];
 };
 for(let j=0;j<rings;j++){
  const y0=j/rings,y1=(j+1)/rings;
  for(let i=0;i<sides;i++){
   const a=i*step,aa=(i+.5)*step;
   arr.push(...pt(y0,a),...pt(y1,aa));
   arr.push(...pt(y0,a),...pt(y1,a-step*.5));
  }
 }
 const g=new THREE.BufferGeometry();
 g.setAttribute('position',new THREE.Float32BufferAttribute(arr,3));
 return g;
}
function dynamicSegment(root,geo,material){
 const o=new THREE.LineSegments(geo,material);o.frustumCulled=false;
 root.add(o);return o;
}
function layoutSegment(mesh,from,to){
 const d=to.clone().sub(from);
 const length=d.length();
 if(length<.03){mesh.visible=false;return;}
 mesh.visible=true;
 mesh.position.copy(from).addScaledVector(d,.5);
 mesh.quaternion.setFromUnitVectors(AXIS,d.normalize());
 mesh.scale.set(1,length,1);
}
export function dressWithGothicDetails(root,variant='street'){
 const bones={};
 root.traverse(o=>{if(BONE_NAMES.includes(o.name))bones[o.name]=o;});
 const missing=BONE_NAMES.filter(k=>!bones[k]);
 if(missing.length)throw new Error('Sophia gothic decoration missing humanoid joints: '+missing.join(', '));
 const meshes=[];
 // Small metal hoops and a dark choker follow the actual head and neck rig.
 for(const sign of [-1,1]){
   const hoop=new THREE.Mesh(new THREE.TorusGeometry(.024,.0035,8,38),METAL);
   hoop.position.set(sign*.105,.025,.023);
   bones.head.add(hoop);meshes.push(hoop);
 }
 meshes.push(ring(bones.neck_01,.079,.010,DARK,0,.012,0));
 const stud=metalPlate(bones.neck_01,.021,.017,[0,.015,.083]);meshes.push(stud);
 // Chained silver crescent pendant, suspended on chest.
 const chest=bones.spine_03;
 const moon=crescent();moon.position.set(0,-.07,.155);
 chest.add(moon);meshes.push(moon);
 meshes.push(wire(chest,[[-.095,.075,.108],[-.06,.025,.146],[0,-.02,.155],[.06,.025,.146],[.095,.075,.108]],.002));
 // Narrow dark double waist straps and brushed silver buckles.
 for(const y of [.17,.08]){
   meshes.push(ring(bones.pelvis,.156,.011,LEATHER,0,y,0));
   meshes.push(metalPlate(bones.pelvis,.049,.035,[.075,y,.16]));
 }
 meshes.push(wire(bones.pelvis,[[-.19,.065,.09],[-.15,-.05,.17],[-.06,-.10,.19],[.08,-.095,.16],[.15,.02,.08]],.0028));
 meshes.push(wire(bones.pelvis,[[-.16,.052,.11],[-.11,-.10,.18],[.01,-.15,.17],[.17,.03,.09]],.002));
 // Open-skirt variant: loose diamond-pattern fishnet tights on thigh and shin.
 // Exact cloth rig comes from the upstream GLB; the net is a decorative overlay.
 const fishnet=[];
 const A={};
 for(const side of ['l','r']){
  const thigh=dynamicSegment(root,fishnetGeometry(.097,.079),NET);
  const shin=dynamicSegment(root,fishnetGeometry(.080,.064),NET);
  A[side]={thigh,shin};fishnet.push(thigh,shin);
 }
 const points=Object.fromEntries(BONE_NAMES.map(s=>[s,vec()]));
 const lerp=(a,b,t)=>a.clone().lerp(b,t);
 function update(){
  root.updateMatrixWorld(true);
  for(const [n,b] of Object.entries(bones))b.getWorldPosition(points[n]);
  for(const s of ['l','r']){
   const hip=points['thigh_'+s],knee=points['calf_'+s],ankle=points['foot_'+s];
   const top=lerp(hip,knee,variant==='dress'?.76:.32);
   layoutSegment(A[s].thigh,top,lerp(hip,knee,.94));
   layoutSegment(A[s].shin,lerp(knee,ankle,.08),lerp(knee,ankle,.53));
  }
 }
 function dispose(){
  for(const m of [...meshes,...fishnet]){m.parent?.remove(m);m.geometry?.dispose();}
 }
 update();
 return {update,dispose,variant};
}
