/* C — detachable, very lightweight 3D accessories from the supplied concept.
 * Only the floral hairband and silver hoops; her original GLB and its painted
 * face, vest, auburn hair and clothing remain unchanged.
 * Source C mesh is Z-up, face towards -Y, approx 1.72 m tall.
 */
import * as THREE from 'three';
const petalMat=new THREE.MeshStandardMaterial({color:0xfff5e9,roughness:.72,side:THREE.DoubleSide});
const centerMat=new THREE.MeshStandardMaterial({color:0xe4a957,metalness:.18,roughness:.47});
const bandMat=new THREE.MeshStandardMaterial({color:0x48303b,roughness:.83});
const metalMat=new THREE.MeshStandardMaterial({color:0xb8c0c7,roughness:.28,metalness:.78});
export function attachCConceptDetails(character){
 const headband=new THREE.Group();headband.name='C_Floral_Headband_From_Reference';
 character.add(headband);
 const nodes=[
  [-.115,-.100,1.674],[-.086,-.133,1.690],[-.049,-.150,1.698],
  [-.012,-.154,1.704],[.027,-.151,1.699],[.064,-.139,1.691],[.099,-.112,1.678]
 ];
 const curve=new THREE.CatmullRomCurve3(nodes.map(p=>new THREE.Vector3(...p)));
 headband.add(new THREE.Mesh(new THREE.TubeGeometry(curve,22,.009,6,false),bandMat));
 const petalGeo=new THREE.SphereGeometry(.012,7,5);
 const dotGeo=new THREE.SphereGeometry(.009,7,5);
 nodes.forEach((p,index)=>{
  const center=new THREE.Vector3(...p);
  for(let k=0;k<5;k++){
   const a=k*Math.PI*2/5;
   const petal=new THREE.Mesh(petalGeo,petalMat);
   petal.position.set(center.x+Math.cos(a)*.018,center.y-.003,center.z+Math.sin(a)*.016);
   petal.scale.set(.92,.58,1.18);
   headband.add(petal);
  }
  const dot=new THREE.Mesh(dotGeo,centerMat);
  dot.position.copy(center);dot.position.y-=.013;
  headband.add(dot);
 });
 for(const side of [-1,1]){
  const hoop=new THREE.Mesh(new THREE.TorusGeometry(.025,.0045,6,26),metalMat);
  hoop.position.set(side*.122,-.055,1.506);hoop.rotation.x=Math.PI/2;headband.add(hoop);
 }
 return headband;
}
