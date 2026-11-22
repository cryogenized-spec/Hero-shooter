/* Hero Shooter — Sophia MakeHuman prefab experiment.
 * Uses CC0-exported meshes by kblood/CharacterCreator, upstream commit pinned
 * in the local preset manifest. Original code, no GPL source imported.
 * The approved Sophia v3.3 GLB remains unchanged in the playable demo.
 */
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';

const $=s=>document.querySelector(s);
const qs=new URLSearchParams(location.search);
const shot=qs.get('shot')||'threequarter';
const referenceMode=qs.get('reference')==='1';
const lockedPhase=qs.has('phase')?Math.min(.999,Math.max(0,Number(qs.get('phase'))||0)):null;
const base='./play/assets/procedural/sophia_prefab/';
const loader=new GLTFLoader();
const scene=new THREE.Scene();
scene.background=new THREE.Color('#20232b');
scene.fog=new THREE.Fog('#20232b',12,25);
const camera=new THREE.PerspectiveCamera(37,innerWidth/innerHeight,.02,50);
const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true,powerPreference:'high-performance'});
renderer.setSize(innerWidth,innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio||1,2));
renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure=1.45;
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.shadowMap.enabled=true;
renderer.shadowMap.type=THREE.PCFSoftShadowMap;
$('#stage').appendChild(renderer.domElement);
const orbit=new OrbitControls(camera,renderer.domElement);
orbit.enableDamping=true;
orbit.minDistance=1.6;orbit.maxDistance=8;
orbit.target.set(0,.99,0);
orbit.maxPolarAngle=Math.PI/2.05;
const floor=new THREE.Mesh(new THREE.CircleGeometry(12,80),
  new THREE.MeshStandardMaterial({color:'#393945',roughness:.95,metalness:.05}));
floor.rotation.x=-Math.PI/2;floor.receiveShadow=true;scene.add(floor);
scene.add(new THREE.HemisphereLight(0xa4bde7,0x3a2632,2.35));
function light(color,power,xyz){
 const obj=new THREE.DirectionalLight(color,power);
 obj.position.set(...xyz);scene.add(obj);return obj;
}
const key=light(0xffd9ba,3.0,[-4,8,4]);key.castShadow=true;
key.shadow.mapSize.set(2048,2048);key.shadow.camera.left=-5;key.shadow.camera.right=5;
key.shadow.camera.top=5;key.shadow.camera.bottom=-5;key.shadow.normalBias=.03;
light(0xb1a0d9,1.2,[4,4,-3]);light(0xffffff,.65,[0,6,5]);
const state={preset:null,root:null,body:null,rig:null,clips:[],mixer:null,parts:[],mode:'gothic_dress',animation:'idle',reference:null,stanceDegrees:2.0,activeClip:null,activeAction:null,legBones:null,gaitBase:null};
const tmpAxis=new THREE.Vector3(),tmpQ=new THREE.Quaternion(),tmpP=new THREE.Quaternion(),tmpW=new THREE.Quaternion();
const tmpL=new THREE.Vector3(),tmpR=new THREE.Vector3();
function footSeparation(){
 if(!state.legBones)return null;
 state.root.updateMatrixWorld(true);
 state.legBones.foot_l.getWorldPosition(tmpL);
 state.legBones.foot_r.getWorldPosition(tmpR);
 return Math.abs(tmpL.x-tmpR.x);
}
/**
 * Walk-clip correction only: reduce excess lateral step width by adducting
 * left and right legs toward the sagittal plane. Split the world-frame
 * correction across thigh and calf, then counter-rotate the ankle.
 * Mixer writes the pristine animation each frame; no cumulative drift.
 * Root/world transform and hip width stay unchanged.
 */
function restoreLegs(){
 if(!state.legBones||!state.gaitBase)return;
 for(const [name,bone] of Object.entries(state.legBones))
   bone.quaternion.copy(state.gaitBase[name]);
 state.root.updateMatrixWorld(true);
}
function saveUnmodifiedLegs(){
 if(!state.legBones)return;
 state.gaitBase=Object.fromEntries(
   Object.entries(state.legBones).map(([name,bone])=>[name,bone.quaternion.clone()])
 );
}
function applyStanceCandidate(degrees,flipped){
 const axisWorld=tmpAxis.set(0,0,1).applyQuaternion(state.root.getWorldQuaternion(tmpW)).normalize();
 function rotateWorld(bone,angle){
   bone.parent.getWorldQuaternion(tmpP);
   const localAxis=axisWorld.clone().applyQuaternion(tmpP.invert()).normalize();
   bone.quaternion.premultiply(tmpQ.setFromAxisAngle(localAxis,angle));
   bone.updateMatrixWorld(true);
 }
 const theta=THREE.MathUtils.degToRad(degrees);
 for(const [suffix,side] of [['_l',1],['_r',-1]]){
   const sign=flipped?-side:side;
   rotateWorld(state.legBones['thigh'+suffix],sign*theta*.72);
   rotateWorld(state.legBones['calf'+suffix],sign*theta*.28);
   rotateWorld(state.legBones['foot'+suffix],-sign*theta);
 }
}
function narrowStepWidth(){
 if(state.animation!=='walk'||!state.legBones||state.stanceDegrees<=0)return;
 const originalGap=footSeparation();
 if(!(originalGap>0.09))return;
 let bestGap=originalGap, bestDeg=0,bestFlip=false;
 // Test the two coordinate-convention signs, then a half-strength candidate;
 // accept only a genuine reduction that leaves at least 8 cm between ankles.
 for(const degrees of [state.stanceDegrees,state.stanceDegrees*.5]){
   for(const flipped of [false,true]){
     restoreLegs();
     applyStanceCandidate(degrees,flipped);
     const gap=footSeparation();
     if(gap>=.08&&gap<bestGap-.001){
       bestGap=gap;bestDeg=degrees;bestFlip=flipped;
     }
   }
 }
 restoreLegs();
 if(bestDeg>0)applyStanceCandidate(bestDeg,bestFlip);
}
function status(str){$('#status').textContent=str;}
function setCamera(mode){
 let pos;
 if(mode==='front')pos=[0,1.3,3.3];
 else if(mode==='profile')pos=[3.0,1.25,0];
 else if(mode==='back')pos=[0,1.3,-3.3];
 else if(mode==='portrait')pos=[0,1.65,2.0];
 else pos=[2.45,1.75,2.85];
 camera.position.set(...pos);orbit.target.set(0,mode==='portrait'?1.52:.95,0);
 orbit.update();
}
setCamera(shot);
function materialTint(mesh,color,secondary=null){
 const materials=Array.isArray(mesh.material)?mesh.material:[mesh.material];
 mesh.material=materials.map((old,i)=>{
   const m=old.clone();
   // Preserve original CC0 textures, roughness, normals and UVs:
   // tint is just the standard base-color multiplier.
   m.color.set((i&&secondary)||color);
   const gain=Number(m.userData?.tint?.gain);
   if(Number.isFinite(gain)&&gain>0&&gain<30)m.color.multiplyScalar(gain);
   if(m.isMeshStandardMaterial){m.roughness=Math.max(.57,m.roughness||.8);}
   m.side=THREE.DoubleSide;
   return m;
 });
 if(mesh.material.length===1)mesh.material=mesh.material[0];
}
function applyPresetMorphs(root){
 root.traverse(o=>{
   if(!o.isMesh||!o.morphTargetDictionary||!o.morphTargetInfluences)return;
   const d=o.morphTargetDictionary,w=o.morphTargetInfluences;
   if(Number.isInteger(d.gender_female))w[d.gender_female]=1;
   if(Number.isInteger(d.gender_male))w[d.gender_male]=0;
   // Deliberately subtle morphs; keep the base MakeHuman anatomical forms.
   if(Number.isInteger(d.weight_min))w[d.weight_min]=.34;
   if(Number.isInteger(d.muscle_min))w[d.muscle_min]=.08;
   if(Number.isInteger(d.height_short))w[d.height_short]=.04;
   if(Number.isInteger(d.breast_cup_min))w[d.breast_cup_min]=.28;
   if(state.reference){
     for(const [k,v] of Object.entries({
       breast_cup_max:state.reference.breastSize,
       breast_firm_max:state.reference.breastFirmness,
       bdet_breast_height_incr:state.reference.breastHeight,
       bdet_breast_dist_decr:-state.reference.breastSpacing,
       bdet_breast_point_incr:state.reference.breastProjection
     }))if(Number.isInteger(d[k]))w[d[k]]=v;
     if(Number.isInteger(d.breast_cup_min))w[d.breast_cup_min]=0;
   }
   // Makeup-free CC0 MakeHuman face sculpt, using existing morph targets:
   for(const [name,value] of Object.entries({
     age_child:.09,
     face_jaw_width_decr:.34,
     face_chin_decr:.12,
     face_nose_length_decr:.13,
     face_nose_width_decr:.1,
     face_eye_size_incr:.24,
     face_cheekbones_incr:.10,
     face_lips_incr:.18
   }))if(Number.isInteger(d[name]))w[d[name]]=value;
 });
}
function mergeRig(part,sourceRig){
 const skinned=[];
 part.traverse(o=>{if(o.isSkinnedMesh)skinned.push(o);});
 const target=sourceRig?.skeleton;
 if(!target||!skinned.length)return false;
 const dest=new Map(target.bones.map((b,i)=>[b.name.replace(/[^a-z0-9]/gi,'').toLowerCase(),i]));
 for(const mesh of skinned){
   if(!mesh.skeleton||!mesh.geometry?.attributes?.skinIndex)continue;
   const sourceBones=mesh.skeleton.bones;
   const lookup=sourceBones.map(b=>dest.get(b.name.replace(/[^a-z0-9]/gi,'').toLowerCase()));
   if(lookup.some(v=>v===undefined)){
     console.warn('Clothing rig not compatible:',mesh.name);
     continue;
   }
   mesh.geometry=mesh.geometry.clone();
   const attr=mesh.geometry.attributes.skinIndex;
   for(let i=0;i<attr.count;i++){
     for(let k=0;k<4;k++)attr.setComponent(i,k,lookup[attr.getComponent(i,k)]||0);
   }
   attr.needsUpdate=true;
   // Both generated from the identical MakeHuman rest pose.
   mesh.bind(target,sourceRig.bindMatrix);
   mesh.bindMode='attached';
 }
 return true;
}
function hideCoveredBody(){
 // Source CC0 garment catalog explicitly marks which body zones should be
 // hidden when covered. Remove ONLY the fully covered body triangles.
 const catalog=state.catalog;
 if(!catalog||!state.rig)return;
 const names=state.mode==='gothic_dress'?['dress','boots']:state.mode==='reference'?['panties','bra']:['shirt','jeans','jacket','boots'];
 let mask=0;
 for(const name of names){
   const item=catalog.items.find(it=>it.id===name);
   for(const z of item?.hidesBodyZones||[])mask|=(catalog.bodyZones[z]||0);
 }
 const geo=state.rig.geometry, zones=geo.attributes._cczone;
 if(!geo.index||!zones)return;
 if(!state.originalIndex)state.originalIndex=geo.index.array.slice();
 const full=state.originalIndex, z=zones.array, kept=[];
 for(let i=0;i<full.length;i+=3){
   const a=full[i],b=full[i+1],c=full[i+2];
   if((z[a]&mask)&&(z[b]&mask)&&(z[c]&mask))continue;
   kept.push(a,b,c);
 }
 geo.setIndex(kept);
 geo.computeBoundingSphere();
}
async function loadAsset(filename){
 const gltf=await loader.loadAsync(base+filename);
 gltf.scene.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});
 return gltf;
}
function collectSkinned(root){
 let list=[];root.traverse(o=>{if(o.isSkinnedMesh)list.push(o);});
 return list;
}
function chooseBodySkin(root,skin){
 root.traverse(o=>{
   if(!o.isMesh)return;
   const n=(o.name+' '+(o.material?.name||'')).toLowerCase();
   if(/skin|body|head|neck|face|hands|arms|legs/.test(n) && !/iris|teeth|tongue|eye|lash|brow/.test(n)){
     materialTint(o,skin);
   }else if(/brow|lash/.test(n))materialTint(o,'#1d151d');
   else if(/iris/.test(n))materialTint(o,'#50383f');
 });
}
function colorGear(part,filename,preset){
 let col=preset.clothes.colors.dress;
 if(filename.includes('boots'))col=preset.clothes.colors.boots;
 if(filename.includes('panties')||filename.includes('bra'))col='#000000';
 if(filename.includes('shirt'))col=preset.clothes.colors.shirt;
 if(filename.includes('jeans'))col=preset.clothes.colors.jeans;
 if(filename.includes('jacket'))col=preset.clothes.colors.jacket;
 part.traverse(o=>{if(o.isMesh)materialTint(o,col,col);});
}
async function showOutfit(mode){
 if(!state.root)return;
 const plan=state.preset.clothes[mode]; if(!plan)return;
 state.mode=mode;
 if(state.belt)state.belt.visible=mode==='gothic_dress';
 for(const obj of state.parts){state.root.remove(obj);}
 state.parts=[];
 for(const f of plan){
   let gltf=state.cached.get(f);
   if(!gltf){gltf=await loadAsset(f);state.cached.set(f,gltf);}
   const part=gltf.scene.clone(true);
   colorGear(part,f,state.preset);
   applyPresetMorphs(part);
   mergeRig(part,state.rig);
   state.root.add(part);state.parts.push(part);
 }
 hideCoveredBody();
 document.querySelectorAll('[data-outfit]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.outfit===mode)));
 status('CC0 prefab fitted · '+(mode==='gothic_dress'?'dark dress and boots':mode==='reference'?'exact linked reference outfit':'jacket, shirt, jeans and boots'));
}
function animate(mode){
 state.animation=mode;
 if(state.mixer){state.mixer.stopAllAction();
   const clip=state.clips.find(c=>c.name.toLowerCase().includes(mode));
   if(clip){
     state.activeClip=clip;
     state.activeAction=state.mixer.clipAction(clip).reset();
     state.activeAction.setEffectiveTimeScale(state.reference?.speed||1);
     state.activeAction.play();
     return;
   }
 }
 status('Prefab loaded · '+mode+' pose (no matching baked clip)');
}
function resize(){
 camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();
 renderer.setSize(innerWidth,innerHeight);
 renderer.setPixelRatio(Math.min(devicePixelRatio||1,2));
}
addEventListener('resize',resize);
document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>setCamera(b.dataset.view)));
document.querySelectorAll('[data-outfit]').forEach(b=>b.addEventListener('click',()=>showOutfit(b.dataset.outfit)));
document.querySelectorAll('[data-motion]').forEach(b=>b.addEventListener('click',()=>animate(b.dataset.motion)));
const stance=$('#stance'),stanceLabel=$('#stanceValue');
function chooseStance(value){
 state.stanceDegrees=THREE.MathUtils.clamp(Number(value)||0,0,5);
 if(stance)stance.value=String(state.stanceDegrees);
 if(stanceLabel)stanceLabel.textContent=state.stanceDegrees.toFixed(1)+'°';
}
chooseStance(qs.has('stance')?qs.get('stance'):2);
if(stance)stance.addEventListener('input',()=>chooseStance(stance.value));
$('#snapshot').addEventListener('click',()=>{
 renderer.render(scene,camera);
 const a=document.createElement('a');
 a.download='sophia-makehuman-'+state.mode+'-'+shot+'.png';
 a.href=renderer.domElement.toDataURL('image/png');a.click();
});
let initError=null;
async function init(){
 try{
  const [preset,catalog,reference]=await Promise.all([
    fetch(base+'preset.json').then(r=>{if(!r.ok)throw Error('Missing preset.json');return r.json();}),
    fetch(base+'clothing.json').then(r=>{if(!r.ok)throw Error('Missing CC0 clothing catalog');return r.json();}),
    fetch(base+'user_sophia_reference.json').then(r=>{if(!r.ok)throw Error('Missing linked character preset');return r.json();})
  ]);
  state.preset=preset;state.catalog=catalog;state.cached=new Map();
  if(referenceMode){
    state.reference=reference;
    state.preset={...preset,base:{...preset.base,skin:reference.skin},clothes:{
      ...preset.clothes,reference:['clothing_panties.glb','clothing_bra.glb']
    }};
    const refButton=document.querySelector('[data-outfit="reference"]');
    if(refButton)refButton.hidden=false;
  }
  const [body,hair]=await Promise.all([loadAsset(preset.base.model),loadAsset(preset.look.hair)]);
  const root=new THREE.Group();
  scene.add(root);state.root=root;
  state.body=body.scene;
  root.add(body.scene);
  // A narrow belt hides the small seam between the two prefab dress meshes.
  // Garment/body/hair meshes remain the upstream CC0 assets.
  const belt=new THREE.Mesh(new THREE.CylinderGeometry(.195,.21,.095,40,1,true),
    new THREE.MeshStandardMaterial({color:'#211923',roughness:.82,side:THREE.DoubleSide}));
  belt.position.set(0,1.00,0);belt.scale.z=.83;
  belt.castShadow=true;belt.visible=false;root.add(belt);state.belt=belt;
  applyPresetMorphs(body.scene);chooseBodySkin(body.scene,state.preset.base.skin);
  const skins=collectSkinned(body.scene);
  state.rig=skins.sort((a,b)=>b.geometry.attributes.position.count-a.geometry.attributes.position.count)[0];
  if(!state.rig)throw Error('CC0 body GLB contains no skinned humanoid mesh');
  const bones=state.rig.skeleton.bones;
  state.legBones=Object.fromEntries(['thigh_l','calf_l','foot_l','thigh_r','calf_r','foot_r']
    .map(name=>[name,bones.find(b=>b.name===name)]));
  if(Object.values(state.legBones).some(b=>!b))throw Error('MakeHuman 53-bone rig missing necessary leg bones');
  const hairRoot=hair.scene;
  hairRoot.traverse(o=>{if(o.isMesh){materialTint(o,preset.look.hairColor,preset.look.hairSecondary);o.castShadow=true;}});
  mergeRig(hairRoot,state.rig);applyPresetMorphs(hairRoot);root.add(hairRoot);
  // Constrain overall dimensions for side-by-side character comparisons:
  // the original MakeHuman GLB is 1.8m; Sophia's height is 1.72m.
  root.updateMatrixWorld(true);
  const bounds=new THREE.Box3().setFromObject(root);const height=bounds.max.y-bounds.min.y;
  if(height<.8||height>2.8)throw Error('Unexpected base mesh height '+height.toFixed(2));
  root.scale.setScalar(preset.base.height_m/height);
  root.position.y=-bounds.min.y*root.scale.y;
  state.clips=body.animations||[];
  state.mixer=state.clips.length?new THREE.AnimationMixer(body.scene):null;
  await showOutfit(referenceMode?'reference':qs.get('outfit')==='practical'?'practical':'gothic_dress');
  if(referenceMode)animate(reference.clip||'walk');
  else if(qs.get('motion'))animate(qs.get('motion'));
  $('#loading').hidden=true;
  $('#source').textContent='MakeHuman CC0 · 53-bone humanoid · '+(state.clips.length?state.clips.map(c=>c.name).join(', '):'static pose');
  window.__sophiaReady=true;
 }catch(e){
  initError=e;
  console.error(e);
  $('#loading').textContent='Could not load prefab: '+e.message;
  status(e.message);
  window.__sophiaError=String(e);
 }
}
init();
let last=performance.now();
function loop(t){
 const dt=Math.min(.05,(t-last)/1000);last=t;
 if(state.mixer){
   restoreLegs();
   if(lockedPhase!=null&&state.activeClip&&state.activeAction){
     state.mixer.setTime(lockedPhase*state.activeClip.duration);
   }else state.mixer.update(dt);
   saveUnmodifiedLegs();
   const before=footSeparation();
   narrowStepWidth();
   const after=footSeparation();
   window.__sophiaStanceState={degrees:state.stanceDegrees,animation:state.animation,
     beforeGapM:before,afterGapM:after,correctionApplied:state.animation==='walk'&&state.stanceDegrees>0};
 }
 orbit.update();renderer.render(scene,camera);
 requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
