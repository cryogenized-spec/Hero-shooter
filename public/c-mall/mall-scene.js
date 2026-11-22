/* Hero Shooter — C V8.1 Golden Dragon Chapter 1 retail mall level.
 * Reuses the complete V8.1 art mesh, V6 approved pink pistol mesh, and existing VTK scrapyard.
 * C's arm poses are vertex deformation approximations because V8.1 is NOT skeleton-rigged.
 * Source coordinates: X right/east, Y north, Z up; C's anatomical front = -Y.
 * The 15-round magazine is a selectable real G26 optional magazine, not its 10-round standard.
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { buildGoldenDragon } from './mall-geometry.js';

const $ = id => document.getElementById(id);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x201923);
scene.fog = new THREE.FogExp2(0x2f212b, .013);
const renderer = new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.6));
renderer.setSize(innerWidth,innerHeight);
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure=1.4;
renderer.shadowMap.enabled=true;
renderer.shadowMap.type=THREE.PCFSoftShadowMap;
$('stage').appendChild(renderer.domElement);
const camera = new THREE.PerspectiveCamera(53,innerWidth/innerHeight,.05,180);
camera.up.set(0,0,1);
const orbit = new OrbitControls(camera,renderer.domElement);
orbit.enableDamping=true;orbit.dampingFactor=.075;
orbit.minDistance=2.4;orbit.maxDistance=22;
orbit.enablePan=false;
orbit.maxPolarAngle=Math.PI/2.08;orbit.minPolarAngle=.25;
// LMB is reserved exclusively for shooting; camera orbit is RMB drag only.
// Disabling LEFT here, rather than mapping it to PAN, prevents OrbitControls
// from taking pointer capture or responding to any left-mouse drag.
orbit.mouseButtons={LEFT:null,MIDDLE:THREE.MOUSE.DOLLY,RIGHT:THREE.MOUSE.ROTATE};
addEventListener('resize',()=>{renderer.setSize(innerWidth,innerHeight);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();});
scene.add(new THREE.HemisphereLight(0xabc9ec,0x49342a,1.8));
const sun=new THREE.DirectionalLight(0xffebce,2.35);sun.position.set(-13,-9,27);
sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);
sun.shadow.camera.left=-37;sun.shadow.camera.right=37;sun.shadow.camera.top=37;sun.shadow.camera.bottom=-37;
sun.shadow.camera.near=.1;sun.shadow.camera.far=85;sun.shadow.normalBias=.03;scene.add(sun);
scene.add(new THREE.DirectionalLight(0x83b8d8,.75));

const loader=new GLTFLoader();
async function readCompressedModel(name){
 const url='../c/assets/'+name+'.glb.gz';
 const response=await fetch(url);
 if(!response.ok)throw new Error('Missing character asset: '+url);
 if(!('DecompressionStream' in window))throw new Error('This browser needs gzip DecompressionStream support');
 const data=await new Response(response.body.pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
 return new Promise((resolve,reject)=>loader.parse(data,'',resolve,reject));
}
const up=new THREE.Vector3(0,0,1),raycaster=new THREE.Raycaster();
const mall=buildGoldenDragon(scene); // Distinct mall/shop level, not the scrapyard or Home & More.
const poseNames=['side','low','aim'];
const magazineMax=15,spareMagazineMax=2;
const playShotSound=()=>{}; // No combat/audio inside Mr Chen's story shop.
const state={ready:false,hero:null,visual:null,yard:null,navgrid:null,layout:null,bodyArms:null,
 weaponHolder:null,muzzleLight:null,muzzleFlash:null,pose:'low',poseBlend:1,
 mag:magazineMax,spares:spareMagazineMax,shots:0,reloading:false,fireUntil:0,flashTime:0,
 cameraMode:'follow',walkPhase:0,elapsed:0,jumpHeight:0,jumpVelocity:0,hit:0};
const pressed=new Set(),virtual=new Set();
const setStatus=msg=>$('status').textContent=msg;
const clamp=THREE.MathUtils.clamp;
const smooth=t=>{t=clamp(t,0,1);return t*t*(3-2*t);};
function updateHUD(){
 document.querySelectorAll('[data-pose]').forEach(b=>b.classList.toggle('active',b.dataset.pose===state.pose));
 if($('gunPose'))$('gunPose').textContent='Equipment: '+(state.pose==='side'?'at side':state.pose==='low'?'low ready':'raised');
}
function setPose(pose){
 if(!poseNames.includes(pose))return;
 state.pose=pose;updateHUD();setStatus('Pistol: '+({'side':'at side','low':'two-handed low ready','aim':'raised / aimed'}[pose]));
}
const shoulderZ=1.36;
const shoulderX=.207;
const poseHands={
 side:{right:[-.27,-.075,.87],left:[.27,-.075,.87],angle:1.25},
 low:{right:[-.045,-.46,1.15],left:[.045,-.43,1.15],angle:.62},
 aim:{right:[-.045,-.61,1.39],left:[.045,-.57,1.38],angle:0}
};
const shoulderRot=(sign,target)=>{
 const shoulder=new THREE.Vector3(sign*shoulderX,-.065,shoulderZ);
 const axis=new THREE.Vector3(sign,0,-.08).normalize();
 const targetAxis=new THREE.Vector3(...target).sub(shoulder).normalize();
 return new THREE.Quaternion().setFromUnitVectors(axis,targetAxis);
};
function prepareArms(root){
 const node=root.getObjectByName('Quaternius_Soldier_Body_2');
 if(!node?.isMesh)throw new Error('V8.1 arm mesh missing; no substitute body permitted');
 node.geometry=node.geometry.clone();
 const position=node.geometry.getAttribute('position');
 const base=Float32Array.from(position.array);
 const target={};
 for(const [name,hands] of Object.entries(poseHands)){
   const values=Float32Array.from(base);
   const qLeft=shoulderRot(1,hands.left),qRight=shoulderRot(-1,hands.right);
   const v=new THREE.Vector3(),shoulder=new THREE.Vector3(),original=new THREE.Vector3();
   for(let i=0;i<position.count;i++){
     const x=base[3*i],y=base[3*i+1],z=base[3*i+2];
     const side=Math.sign(x);
     const influence=smooth((Math.abs(x)-.16)/.16);
     if(!influence)continue;
     shoulder.set(side*shoulderX,-.065,shoulderZ);
     original.set(x,y,z);
     v.copy(original).sub(shoulder).applyQuaternion(side>0?qLeft:qRight).add(shoulder);
     values[3*i]=THREE.MathUtils.lerp(x,v.x,influence);
     values[3*i+1]=THREE.MathUtils.lerp(y,v.y,influence);
     values[3*i+2]=THREE.MathUtils.lerp(z,v.z,influence);
   }
   target[name]=values;
 }
 state.bodyArms={node,position,base,target};
}
function animateArms(dt){
 const a=state.bodyArms;
 if(!a)return;
 const target=a.target[state.pose];
 const speed=Math.min(1,dt*10);
 for(let i=0;i<a.position.array.length;i++)a.position.array[i]+=(target[i]-a.position.array[i])*speed;
 a.position.needsUpdate=true;
 a.node.geometry.computeVertexNormals();
}
function makeMuzzleFlash(){
 const group=new THREE.Group();group.visible=false;
 const yellow=new THREE.MeshBasicMaterial({color:0xfff2bd,transparent:true,opacity:.95,depthWrite:false});
 const orange=new THREE.MeshBasicMaterial({color:0xff8b27,transparent:true,opacity:.87,depthWrite:false});
 const spike=new THREE.Mesh(new THREE.ConeGeometry(.055,.19,6),orange);
 spike.rotation.z=Math.PI;spike.position.y=-.085;group.add(spike);
 const core=new THREE.Mesh(new THREE.SphereGeometry(.035,8,6),yellow);core.position.y=-.015;group.add(core);
 group.position.set(0,-.18,.01);
 return group;
}
function setupHero(character,pistol,spawn){
 const group=new THREE.Group();
 const visual=character.scene;
 visual.traverse(n=>{if(n.isMesh){n.castShadow=true;n.receiveShadow=true;}});
 prepareArms(visual);
 group.add(visual);
 const weaponHolder=new THREE.Group();weaponHolder.add(pistol.scene);
 pistol.scene.traverse(n=>{if(n.isMesh){n.castShadow=true;}});
 const muzzleFlash=makeMuzzleFlash();weaponHolder.add(muzzleFlash);
 const muzzleLight=new THREE.PointLight(0xffb45e,0,2.8);muzzleLight.position.set(0,-.22,.01);weaponHolder.add(muzzleLight);
 visual.add(weaponHolder);
 state.weaponHolder=weaponHolder;state.muzzleFlash=muzzleFlash;state.muzzleLight=muzzleLight;
 group.position.set(spawn.x,spawn.y,spawn.z||0);
 scene.add(group);state.hero=group;state.visual=visual;
 updateWeaponPose(1);
}
function updateWeaponPose(dt){
 const p=poseHands[state.pose];
 if(!state.weaponHolder)return;
 const h=state.weaponHolder;
 const target=new THREE.Vector3(...p.right);
 // The pistol's imported mesh is centred at the grip. Attach at the right wrist.
 h.position.lerp(target,Math.min(1,dt*12));
 h.rotation.x=THREE.MathUtils.lerp(h.rotation.x,p.angle,Math.min(1,dt*12));
 h.rotation.z=THREE.MathUtils.lerp(h.rotation.z,state.pose==='side'?-0.12:0,Math.min(1,dt*12));
}
function muzzleWorld(){
 state.weaponHolder.updateWorldMatrix(true,false);
 return state.weaponHolder.localToWorld(new THREE.Vector3(0,-.19,.01));
}
function forwardWorld(){
 const v=new THREE.Vector3(0,-1,0);
 v.applyQuaternion(state.weaponHolder.getWorldQuaternion(new THREE.Quaternion()));
 return v.normalize();
}
const effects=[];
function addImpact(pos,bright=false){
 const color=bright?0xffd26f:0xe9b7a1;
 const mat=new THREE.MeshBasicMaterial({color,transparent:true,opacity:.9});
 const obj=new THREE.Mesh(new THREE.SphereGeometry(.035,6,4),mat);
 obj.position.copy(pos);scene.add(obj);
 effects.push({mesh:obj,life:.24,initial:.24});
}
function ejectCasing(){
 const brass=new THREE.Mesh(new THREE.CylinderGeometry(.008,.008,.024,6),new THREE.MeshStandardMaterial({color:0xc99741,metalness:.7,roughness:.3}));
 brass.rotation.x=Math.PI/2;
 state.weaponHolder.localToWorld(brass.position.set(.055,-.02,.015));
 scene.add(brass);
 const side=new THREE.Vector3(1,0,0).applyQuaternion(state.hero.quaternion);
 effects.push({mesh:brass,life:1.15,initial:1.15,vel:side.multiplyScalar(2.2).add(new THREE.Vector3(0,0,1.3)),spin:9});
}
function shoot(){
 if(!state.ready||state.reloading)return;
 const now=performance.now();
 if(now<state.fireUntil)return;
 if(!state.mag){setStatus('MAGAZINE EMPTY · Press R to reload');return;}
 // Side carry comes up automatically for a safe-looking game animation.
 if(state.pose==='side')setPose('aim');
 state.mag--;state.shots++;state.fireUntil=now+165;state.flashTime=.085;
 state.muzzleFlash.visible=true;state.muzzleLight.intensity=3.7;
 playShotSound();ejectCasing();updateHUD();
 const origin=muzzleWorld(),direction=forwardWorld();
 const t=raycaster; t.set(origin,direction); t.far=100;
 // Impact marks against the real environment, not invented ballistic damage.
 if(state.yard){
   const hits=t.intersectObject(state.yard,true);
   if(hits.length){addImpact(hits[0].point);state.hit++;}
 }
 setStatus(state.mag?'Fired · '+state.mag+' rounds remaining':'Magazine empty · R to reload');
}
function reload(){
 if(!state.ready||state.reloading||state.mag===magazineMax||state.spares===0)return;
 state.reloading=true;setStatus('Reloading extended magazine…');updateHUD();
 setTimeout(()=>{
   state.mag=magazineMax;state.spares--;
   state.reloading=false;updateHUD();setStatus('New 15-round magazine seated');
 },1250);
}
function updateEffects(dt){
 if(state.flashTime>0){state.flashTime-=dt;
  const active=state.flashTime>0;
  state.muzzleFlash.visible=active;
  state.muzzleLight.intensity=active?(1.6+Math.random()*2.0):0;
  state.muzzleFlash.scale.setScalar(active?.6+Math.random()*.7:1);
 }
 for(let i=effects.length-1;i>=0;i--){
   const p=effects[i];p.life-=dt;
   if(p.vel){p.vel.z-=9.81*dt;p.mesh.position.addScaledVector(p.vel,dt);p.mesh.rotation.y+=dt*p.spin;
    if(p.mesh.position.z<.014){p.mesh.position.z=.014;p.vel.multiplyScalar(.25);p.vel.z=0;}}
   if(p.mesh.material?.opacity!==undefined)p.mesh.material.opacity=Math.max(0,p.life/p.initial);
   if(p.life<=0){scene.remove(p.mesh);p.mesh.geometry.dispose();p.mesh.material.dispose();effects.splice(i,1);}
 }
}
function walkable(x,y){return mall.walkable(x,y);}
function moveGround(dx,dy){
 const p=state.hero.position,x=p.x,y=p.y;
 if(walkable(x+dx,y+dy)){p.x+=dx;p.y+=dy;return true;}
 if(walkable(x+dx,y)){p.x+=dx;return true;}
 if(walkable(x,y+dy)){p.y+=dy;return true;}
 return false;
}
function cameraFollow(snap=false){
 if(!state.hero)return;
 const p=state.hero.position;
 const t=new THREE.Vector3(p.x,p.y,1.18+state.jumpHeight*.45);
 if(snap){orbit.target.copy(t);camera.position.copy(t).add(new THREE.Vector3(3,-6.6,5.1));}
 else{
  const shift=t.sub(orbit.target).multiplyScalar(.12);
  orbit.target.add(shift);camera.position.add(shift);
 }
 orbit.update();
}
function toggleCamera(){
 state.cameraMode=state.cameraMode==='follow'?'overhead':'follow';
 if(state.cameraMode==='overhead'){
  const p=state.hero.position;orbit.target.set(p.x,p.y,0);
  camera.position.set(p.x,p.y-1.0,13);
 }else cameraFollow(true);
 setStatus('Camera: '+state.cameraMode);
}
function respawn(){
 if(!state.ready)return;
 const p=mall.shopSpawn;
 state.hero.position.set(p.x,p.y,p.z);
 state.hero.rotation.z=Math.PI;
 state.jumpHeight=state.jumpVelocity=0;
 cameraFollow(true);
 setStatus('Returned to Golden Dragon entrance.');
}
function aimFromMouse(e){
 if(!state.hero||mallUI.dialogue)return;
 const rect=renderer.domElement.getBoundingClientRect();
 const pointer=new THREE.Vector2((e.clientX-rect.left)/rect.width*2-1,-((e.clientY-rect.top)/rect.height)*2+1);
 raycaster.setFromCamera(pointer,camera);
 const plane=new THREE.Plane(new THREE.Vector3(0,0,1),-1.05);
 const hit=new THREE.Vector3();
 if(!raycaster.ray.intersectPlane(plane,hit))return;
 const delta=hit.sub(state.hero.position);delta.z=0;
 if(delta.lengthSq()<.05)return;
 const yaw=Math.atan2(delta.x,-delta.y);
 state.hero.rotation.z=yaw;state.aimLast=performance.now();
}
const movements=new Set(['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright','shift',' ']);
function keydown(e){
 const key=e.key.toLowerCase();
 if(movements.has(key))e.preventDefault();
 if(e.repeat&&['1','2','3','r','v','home'].includes(key))return;
 pressed.add(key);
 if(poseNames[Number(key)-1])setPose(poseNames[Number(key)-1]);
 if(key==='r')respawn();
 if(key==='e')interact();
 if(key==='escape'&&mallUI.dialogue)closeDialogue();
 if(key==='v'&&state.ready)toggleCamera();
 if(key==='home')respawn();
 if(key===' '&&state.ready&&!mallUI.dialogue&&state.jumpHeight===0)state.jumpVelocity=4.3;
 if(key==='h')$('hud').hidden=!$('hud').hidden;
}
addEventListener('keydown',keydown);
addEventListener('keyup',e=>pressed.delete(e.key.toLowerCase()));
addEventListener('blur',()=>{pressed.clear();virtual.clear();});
// Keep the right mouse button available to OrbitControls instead of browser menus.
renderer.domElement.addEventListener('contextmenu',e=>e.preventDefault());
renderer.domElement.addEventListener('pointerdown',e=>{
 if(e.button!==0)return;
 e.preventDefault();aimFromMouse(e);interact();
});
// A held right button must never steer C: it manipulates only the camera.
renderer.domElement.addEventListener('pointermove',e=>{if(e.buttons===0)aimFromMouse(e);});
document.querySelectorAll('[data-pose]').forEach(btn=>btn.onclick=()=>setPose(btn.dataset.pose));
$('interactBtn').onclick=interact;
$('viewBtn').onclick=()=>state.ready&&toggleCamera();
$('resetBtn').onclick=respawn;
$('dialogueNext').onclick=advanceDialogue;
$('dialogueClose').onclick=closeDialogue;
$('mobileInteract').onclick=interact;
$('mobileView').onclick=()=>state.ready&&toggleCamera();
$('mobileReset').onclick=respawn;
document.querySelectorAll('[data-key]').forEach(btn=>{
 const k=btn.dataset.key;
 btn.addEventListener('pointerdown',e=>{e.preventDefault();btn.setPointerCapture(e.pointerId);virtual.add(k);});
 for(const event of ['pointerup','pointercancel','lostpointercapture'])btn.addEventListener(event,()=>virtual.delete(k));
});
const mallUI={dialogue:false,index:0,nearest:null,noticeUntil:0,area:'shop'};
const dialogue=[
 ['C','Mr. Chen? The lights are out across the mall.'],
 ['MR. CHEN','Little C. The power failed before the shutters finished closing.'],
 ['C','The passage is deserted. Have you seen anyone outside?'],
 ['MR. CHEN','Stay near the shop for now. I have never seen it so quiet.'],
 ['C','Understood. I will check the entrance and come back.']
];
function displayLine(){
 const [speaker,words]=dialogue[mallUI.index];
 $('dialogueName').textContent=speaker;
 $('dialogueText').textContent=words;
 $('dialogueNext').textContent=mallUI.index===dialogue.length-1?'Finish':'Continue';
}
function beginDialogue(){
 mallUI.dialogue=true;mallUI.index=0;
 $('dialogue').hidden=false;displayLine();
}
function advanceDialogue(){
 if(!mallUI.dialogue)return;
 if(++mallUI.index>=dialogue.length){closeDialogue();return;}
 displayLine();
}
function closeDialogue(){
 mallUI.dialogue=false;$('dialogue').hidden=true;
 setStatus('Speak to Mr. Chen again or continue exploring.');
}
function nearby(){
 if(!state.hero)return;
 const p=state.hero.position;let nearest=null,distance=Infinity;
 for(const entry of mall.events){
  const d=Math.hypot(entry.x-p.x,entry.y-p.y);
  if(d<entry.r&&d<distance){nearest=entry;distance=d;}
 }
 mallUI.nearest=nearest;
 $('prompt').textContent=nearest?'Press E · '+nearest.name:'Explore Golden Dragon · Find Mr. Chen';
 $('prompt').classList.toggle('available',!!nearest);
 const area=p.y< -8.15?'concourse':'shop';
 if(area!==mallUI.area){
  mallUI.area=area;
  setStatus(area==='concourse'?'The Level 1 concourse is in emergency lighting.':'Inside Golden Dragon · Mr. Chen is by the tills.');
 }
}
function interact(){
 if(!state.ready)return;
 if(mallUI.dialogue){advanceDialogue();return;}
 nearby();
 const f=mallUI.nearest;
 if(!f){setStatus('Walk up to Mr. Chen or a shop display.');return;}
 if(f.name==='Mr. Chen'){beginDialogue();return;}
 setStatus(f.description);$('notice').textContent=f.description;
 $('notice').classList.add('show');mallUI.noticeUntil=performance.now()+4000;
}
function fallbackChen(){
 const g=new THREE.Group();
 const coat=new THREE.MeshStandardMaterial({color:0x503b37,roughness:.85});
 const skin=new THREE.MeshStandardMaterial({color:0xb78964});
 const dark=new THREE.MeshStandardMaterial({color:0x1d1d28});
 const mk=(mat,w,d,h,x,y,z)=>{
  const obj=new THREE.Mesh(new THREE.BoxGeometry(w,d,h),mat);
  obj.position.set(x,y,z);obj.castShadow=true;g.add(obj);
 };
 mk(coat,.55,.33,.94,0,0,.95);
 mk(skin,.30,.25,.37,0,-.015,1.58);
 mk(dark,.37,.13,.61,0,.10,.39);
 for(const x of [-.14,.14])mk(dark,.13,.05,.055,x,-.155,1.61);
 return g;
}
async function loadMrChen(){
 let chen;
 try{
  const gltf=await loader.loadAsync('../play/assets/procedural/mr_chen_hybrid_face_v2.glb');
  chen=gltf.scene;
  chen.rotation.x=Math.PI/2; // VTK glTF Y-up => Z-up in the C/arena stage.
  chen.updateMatrixWorld(true);
  const bounds=new THREE.Box3().setFromObject(chen),height=bounds.max.z-bounds.min.z;
  if(!(height>.4&&height<5))throw Error('Mr Chen mesh height invalid');
  chen.scale.multiplyScalar(1.68/height);
  chen.position.z= -bounds.min.z*(1.68/height);
  chen.traverse(n=>{if(n.isMesh){n.castShadow=true;n.receiveShadow=true;}});
 }catch(e){
  console.warn('Original Mr Chen GLB unavailable, using fallback figure',e);
  chen=fallbackChen();
 }
 chen.position.x=mall.chenSpawn.x;chen.position.y=mall.chenSpawn.y;
 scene.add(chen);state.chen=chen;
 mall.events.push({name:'Mr. Chen',x:6.32,y:-3.65,r:2.30,
  description:'Mr. Chen is tending the shop through the blackout.'});
}
async function init(){
 try{
  const [model,gun]=await Promise.all([
   readCompressedModel('C_V8_1_skull_refined_with_vest'),
   readCompressedModel('C_pink_compact_pistol')
  ]);
  // Keep C's approved 3D V8.1 art and equipment model, no new low-poly proxy.
  setupHero(model,gun,mall.shopSpawn);
  state.hero.rotation.z=Math.PI;
  await loadMrChen();
  state.ready=true;$('loading').hidden=true;
  cameraFollow(true);updateHUD();nearby();
  setPose('side');
  setStatus('07:00 · Golden Dragon · Sandton Mall Level 1. Find Mr. Chen.');
  window.__goldenDragonReady=true;
 }catch(e){
  $('loading').textContent='Golden Dragon could not load: '+e.message;
  setStatus(e.message);console.error('Golden Dragon bootstrap error',e);
  window.__goldenDragonError=String(e);
 }
}

// Stable read-only testing handle; gameplay mutation is still confined to the scene.
window.__goldenDragonTest={state,mall,nearby,interact,respawn};
init();
let last=performance.now(),frames=0,framed=0;
function tick(now){
 const dt=Math.min(.046,Math.max(0,(now-last)/1000));last=now;
 if(state.ready){
  state.elapsed+=dt;
  if(!mallUI.dialogue)nearby();
  if(mallUI.noticeUntil&&now>mallUI.noticeUntil){$('notice').classList.remove('show');mallUI.noticeUntil=0;}
  const forward=camera.getWorldDirection(new THREE.Vector3());forward.z=0;
  if(forward.lengthSq()<.0001)forward.set(0,-1,0);else forward.normalize();
  const right=new THREE.Vector3().crossVectors(forward,up).normalize();
  const f=+(pressed.has('w')||pressed.has('arrowup')||virtual.has('w'))-+(pressed.has('s')||pressed.has('arrowdown')||virtual.has('s'));
  const s=+(pressed.has('d')||pressed.has('arrowright')||virtual.has('d'))-+(pressed.has('a')||pressed.has('arrowleft')||virtual.has('a'));
  const direction=forward.multiplyScalar(f).addScaledVector(right,s);
  const moving=direction.lengthSq()>.00001;
  if(moving&&!mallUI.dialogue){
   direction.normalize();const run=pressed.has('shift');
   moveGround(direction.x*dt*(run?3.7:2.3),direction.y*dt*(run?3.7:2.3));
   state.walkPhase+=dt*(run?2.0:1.25);
   if(!state.aimLast||now-state.aimLast>900){
    const yaw=Math.atan2(direction.x,-direction.y);
    state.hero.rotation.z=THREE.MathUtils.lerp(state.hero.rotation.z,yaw,Math.min(1,dt*9));
   }
  }else state.walkPhase=0;
  if(!mallUI.dialogue&&(state.jumpVelocity||state.jumpHeight)){
   state.jumpVelocity-=11*dt;state.jumpHeight+=state.jumpVelocity*dt;
   if(state.jumpHeight<0)state.jumpHeight=state.jumpVelocity=0;
  }
  const bob=moving&&!mallUI.dialogue?.022*(1-Math.cos(state.walkPhase*Math.PI*4)):0;
  state.visual.position.z=bob+state.jumpHeight;
  state.visual.rotation.z=moving&&!mallUI.dialogue?.01*Math.sin(state.walkPhase*Math.PI*2):0;
  animateArms(dt);updateWeaponPose(dt);
  if(state.cameraMode==='follow'||state.cameraMode==='overhead')cameraFollow();
 }
 orbit.update();renderer.render(scene,camera);
 frames++;framed+=dt;
 if(framed>.75){$('fps').textContent=Math.round(frames/framed)+' FPS';frames=0;framed=0;}
 requestAnimationFrame(tick);
}
requestAnimationFrame(tick);