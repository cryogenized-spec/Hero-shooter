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
const state={preset:null,root:null,body:null,rig:null,clips:[],mixer:null,parts:[],mode:'gothic_dress',animation:'idle'};
function status(str){$('#status').textContent=str;}
function setCamera(mode){
 let pos;
 if(mode==='front')pos=[0,1.15,4.75];
 else if(mode==='profile')pos=[4.4,1.3,0];
 else if(mode==='back')pos=[0,1.25,-4.75];
 else if(mode==='portrait')pos=[0,1.65,2.0];
 else pos=[3.0,1.9,3.7];
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
   if(Number.isInteger(d.weight_min))w[d.weight_min]=.22;
   if(Number.isInteger(d.muscle_min))w[d.muscle_min]=.10;
   if(Number.isInteger(d.height_short))w[d.height_short]=.08;
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
 // CC0 MakeHuman body is complete. Clothing cover is rendered using
 // garment geometry; do not aggressively delete skin/morph vertices here.
 // Disabling this avoids creating neck/arm holes before the fit is QA-tested.
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
 if(filename.includes('shirt'))col=preset.clothes.colors.shirt;
 if(filename.includes('jeans'))col=preset.clothes.colors.jeans;
 if(filename.includes('jacket'))col=preset.clothes.colors.jacket;
 part.traverse(o=>{if(o.isMesh)materialTint(o,col,preset.clothes.colors.dressTrim);});
}
async function showOutfit(mode){
 if(!state.root)return;
 const plan=state.preset.clothes[mode]; if(!plan)return;
 state.mode=mode;
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
 status('CC0 prefab fitted · '+(mode==='gothic_dress'?'dark dress and boots':'jacket, shirt, jeans and boots'));
}
function animate(mode){
 state.animation=mode;
 if(state.mixer){state.mixer.stopAllAction();
   const clip=state.clips.find(c=>c.name.toLowerCase().includes(mode));
   if(clip){state.mixer.clipAction(clip).reset().play();return;}
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
$('#snapshot').addEventListener('click',()=>{
 renderer.render(scene,camera);
 const a=document.createElement('a');
 a.download='sophia-makehuman-'+state.mode+'-'+shot+'.png';
 a.href=renderer.domElement.toDataURL('image/png');a.click();
});
let initError=null;
async function init(){
 try{
  const preset=await fetch(base+'preset.json').then(r=>{if(!r.ok)throw Error('Missing preset.json');return r.json();});
  state.preset=preset;state.cached=new Map();
  const [body,hair]=await Promise.all([loadAsset(preset.base.model),loadAsset(preset.look.hair)]);
  const root=new THREE.Group();
  scene.add(root);state.root=root;
  state.body=body.scene;
  root.add(body.scene);
  applyPresetMorphs(body.scene);chooseBodySkin(body.scene,preset.base.skin);
  const skins=collectSkinned(body.scene);
  state.rig=skins.sort((a,b)=>b.geometry.attributes.position.count-a.geometry.attributes.position.count)[0];
  if(!state.rig)throw Error('CC0 body GLB contains no skinned humanoid mesh');
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
  await showOutfit(qs.get('outfit')==='practical'?'practical':'gothic_dress');
  if(qs.get('motion'))animate(qs.get('motion'));
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
 if(state.mixer)state.mixer.update(dt);
 orbit.update();renderer.render(scene,camera);
 requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
