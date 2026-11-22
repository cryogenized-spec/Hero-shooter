/* Hero Shooter: exact exported Sophia from the submitted online creator link.
 * All art, skin, hair, clothing, 53-bone rig and animation come from that
 * single CC0 GLB. Original-source walk is restored each frame before any
 * optional runtime inward-foot correction. No appearance changes are made.
 */
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {dressWithGothicDetails} from './sophia-gothic-accents.js';

const params=new URLSearchParams(location.search);
const look=params.get('look')==='dress'?'dress':'street';
let accessories=null;
const $=selector=>document.querySelector(selector);
const scene=new THREE.Scene();scene.background=new THREE.Color('#292d37');
const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure=1.70;
renderer.setPixelRatio(Math.min(devicePixelRatio||1,2));
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
renderer.localClippingEnabled=true;
renderer.setSize(innerWidth,innerHeight);
$('#stage').appendChild(renderer.domElement);
const camera=new THREE.PerspectiveCamera(35,innerWidth/innerHeight,.05,50);
camera.position.set(0,1.20,3.7);
const orbit=new OrbitControls(camera,renderer.domElement);
orbit.target.set(0,.9,0);orbit.enableDamping=true;orbit.minDistance=1.8;orbit.maxDistance=8;
orbit.update();
scene.add(new THREE.HemisphereLight(0xd8e2f2,0x6e5c59,2.6));
scene.add(new THREE.AmbientLight(0xffe6d6,.9));
const sun=new THREE.DirectionalLight(0xffe6d3,3.0);
sun.position.set(-3,5,5);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);
sun.shadow.camera.left=-4;sun.shadow.camera.right=4;sun.shadow.camera.top=4;sun.shadow.camera.bottom=-4;
scene.add(sun);
const rim=new THREE.DirectionalLight(0xa2b3ce,1.3);rim.position.set(4,4,-3);scene.add(rim);
const ground=new THREE.Mesh(new THREE.PlaneGeometry(30,30),new THREE.MeshStandardMaterial({color:'#474454',roughness:1}));
ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;scene.add(ground);
const clamp=THREE.MathUtils.clamp;
const pose={degrees:clamp(Number(params.get('stance')??2)||0,0,5),model:null,mixer:null,clip:null,action:null,bones:null,base:null,
  phase:params.has('phase')?clamp(Number(params.get('phase'))||0,0,.999):null};
const axis=new THREE.Vector3(),quat=new THREE.Quaternion(),parentQ=new THREE.Quaternion(),rootQ=new THREE.Quaternion();
const leftPos=new THREE.Vector3(),rightPos=new THREE.Vector3();
const bonesToCorrect=['thigh_l','calf_l','foot_l','thigh_r','calf_r','foot_r'];
function restore(){
 if(!pose.base)return;
 for(const key of bonesToCorrect)pose.bones[key].quaternion.copy(pose.base[key]);
 pose.model.updateMatrixWorld(true);
}
function snapshot(){
 pose.base=Object.fromEntries(bonesToCorrect.map(key=>[key,pose.bones[key].quaternion.clone()]));
}
function gap(){
 pose.model.updateMatrixWorld(true);
 pose.bones.foot_l.getWorldPosition(leftPos);
 pose.bones.foot_r.getWorldPosition(rightPos);
 return Math.abs(leftPos.x-rightPos.x);
}
function rotation(bone,angle,worldAxis){
 bone.parent.getWorldQuaternion(parentQ);
 const local=worldAxis.clone().applyQuaternion(parentQ.invert());
 bone.quaternion.premultiply(quat.setFromAxisAngle(local.normalize(),angle));
 bone.updateMatrixWorld(true);
}
function candidate(deg,flip){
 const z=axis.set(0,0,1).applyQuaternion(pose.model.getWorldQuaternion(rootQ)).normalize();
 const t=THREE.MathUtils.degToRad(deg);
 for(const [suffix,side] of [['_l',1],['_r',-1]]){
   const sign=flip?-side:side;
   rotation(pose.bones['thigh'+suffix],sign*t*.72,z);
   rotation(pose.bones['calf'+suffix],sign*t*.28,z);
   rotation(pose.bones['foot'+suffix],-sign*t,z);
 }
}
function correction(){
 const original=gap();
 if(pose.degrees<=0||original<.09)return {original,updated:original};
 let best={value:original,deg:0,flip:false};
 for(const deg of [pose.degrees,pose.degrees*.5]){
  for(const flip of [false,true]){
   restore();candidate(deg,flip);
   const width=gap();
   if(width>=.08&&width<best.value-.001)best={value:width,deg,flip};
  }
 }
 restore();
 if(best.deg)candidate(best.deg,best.flip);
 return {original,updated:gap()};
}
function status(s){$('#status').textContent=s;}
function chooseView(name){
 const targets={front:[0,1.24,3.0],threequarter:[2.05,1.7,2.55],profile:[2.9,1.25,0],back:[0,1.25,-3]};
 camera.position.set(...(targets[name]||targets.front));orbit.target.set(0,.92,0);orbit.update();
}
function chooseMotion(name){
 if(!pose.mixer)return;
 pose.animation=name;
 pose.mixer.stopAllAction();
 pose.clip=pose.clips.find(a=>a.name.toLowerCase().includes(name));
 if(!pose.clip)return;
 pose.action=pose.mixer.clipAction(pose.clip).reset().setEffectiveTimeScale(.65).play();
 document.querySelectorAll('[data-motion]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.motion===name)));
}
document.querySelectorAll('[data-look]').forEach(btn=>{
 btn.setAttribute('aria-pressed',String(btn.dataset.look===look));
 btn.addEventListener('click',()=>{
   params.set('look',btn.dataset.look);
   location.search=params.toString();
 });
});
const slider=$('#stance');slider.value=String(pose.degrees);
function chooseStance(value){
 pose.degrees=clamp(Number(value)||0,0,5);
 slider.value=String(pose.degrees);
 $('#degrees').textContent=pose.degrees.toFixed(1)+'°';
}
chooseStance(pose.degrees);
slider.addEventListener('input',()=>chooseStance(slider.value));
$('#original').addEventListener('click',()=>chooseStance(0));
$('#narrow').addEventListener('click',()=>chooseStance(2));
document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>chooseView(b.dataset.view)));
document.querySelectorAll('[data-motion]').forEach(b=>b.addEventListener('click',()=>chooseMotion(b.dataset.motion)));
$('#snapshot').addEventListener('click',()=>{
 renderer.render(scene,camera);
 const a=document.createElement('a');a.download='sophia_gothic_'+look+'_stance_'+pose.degrees+'.png';
 a.href=renderer.domElement.toDataURL('image/png');a.click();
});
addEventListener('resize',()=>{
 renderer.setPixelRatio(Math.min(devicePixelRatio||1,2));renderer.setSize(innerWidth,innerHeight);
 camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();
});
async function init(){
 try{
  const source='./play/assets/procedural/sophia_prefab/sophia_gothic_'+look+'.glb';
  const gltf=await new GLTFLoader().loadAsync(source);
  pose.model=gltf.scene;scene.add(pose.model);
  pose.model.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});
  // The original site already exported baked shape, skin colour and fitted
  // garments. NO replacement materials, sculpt or clothing proxy is applied.
  const rig=[];pose.model.traverse(o=>{if(o.isSkinnedMesh)rig.push(o);});
  if(!rig.length)throw Error('Exported character lacks a skinned mesh');
  const bones=rig[0].skeleton.bones;
  pose.bones=Object.fromEntries(bonesToCorrect.map(k=>[k,bones.find(b=>b.name===k)]));
  if(Object.values(pose.bones).some(v=>!v))throw Error('Exported character missing a required leg joint');
  pose.clips=gltf.animations;
  if(!pose.clips.find(c=>c.name==='walk'))throw Error('Missing source walk animation');
  const box=new THREE.Box3().setFromObject(pose.model);
  pose.model.position.y-=box.min.y;
  // GPU-side hem cropping preserves original garment geometry and skinning.
  const hem=new THREE.Plane(new THREE.Vector3(0,1,0),-.72);
  const jacketHem=new THREE.Plane(new THREE.Vector3(0,1,0),-1.00);
  const fittings=[];
  pose.model.traverse(o=>{
    if(!o.isMesh)return;
    const name=o.name.toLowerCase();
    // The stock knee-length skirt is replaced in the 3D preview by a compact
    // original pleated overskirt; no source GLB or binding is altered.
    if(look==='street'&&name.includes('cloth_skirt')){o.visible=false;fittings.push(o.name+' (hidden)');return;}
    const plane=name.includes('cloth_jacket')?jacketHem:null;
    if(!plane)return;
    o.material=Array.isArray(o.material)?o.material.map(m=>m.clone()):o.material.clone();
    for(const m of Array.isArray(o.material)?o.material:[o.material]){
      m.clippingPlanes=[plane];m.clipShadows=true;m.side=THREE.DoubleSide;
    }
    fittings.push(o.name);
  });
  window.__sophiaOutfitHemNames=fittings;
  const pelvis=pose.model.getObjectByName('pelvis');
  accessories=dressWithGothicDetails(pose.model,look);
  accessories.fitHems=()=>{
    if(!pelvis)return;
    const y=pelvis.getWorldPosition(new THREE.Vector3()).y;
    hem.constant=-(y-.17);
    jacketHem.constant=-(y+.035);
  };
  accessories.fitHems();
  pose.mixer=new THREE.AnimationMixer(pose.model);
  chooseMotion(params.get('motion')||'walk');
  chooseView(params.get('view')||'front');
  $('#loading').hidden=true;
  status('Original body/skin/hair kept; '+(look==='dress'?'gothic dress':'skirt and jacket')+' + crescent, chains and fishnets');
  window.__sharedSophiaReady=true;
 }catch(e){
  window.__sharedSophiaError=String(e);
  $('#loading').textContent='Unable to load exact creator export: '+e.message;
  status(String(e));
  console.error(e);
 }
}
init();
let last=performance.now();
function loop(now){
 const dt=Math.min(.05,(now-last)/1000);last=now;
 if(pose.mixer){
  restore();
  if(pose.phase!==null&&pose.clip)pose.mixer.setTime(pose.phase*pose.clip.duration);
  else pose.mixer.update(dt);
  snapshot();
  const widths=pose.animation==='walk'?correction():{original:gap(),updated:gap()};
  window.__sharedSophiaMetric={beforeGapM:widths.original,afterGapM:widths.updated,degrees:pose.degrees,
   animation:pose.animation,clip:pose.clip?.name};
  $('#gap').textContent=(widths.original*100).toFixed(1)+' cm → '+(widths.updated*100).toFixed(1)+' cm';
 }
 accessories?.update();
 accessories?.fitHems?.();
 orbit.update();renderer.render(scene,camera);
 requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
