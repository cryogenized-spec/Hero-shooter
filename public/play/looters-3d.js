/* Hero Shooter / real-time GLB character stage.
 * Native WebGL resolution, not 32x48 sprite upscaling. Models produced by
 * tools/render/export_articulated_looters.py with named limb joint groups.
 * 3D world +Z up, default character forward -Y. Separate props are attached
 * to the right shoulder's articulated group. Independent of C's female gait.
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const root = document.body;
const status = document.querySelector('#status');
const loaderNotice = document.querySelector('#load');
const renderer = new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));
renderer.setSize(window.innerWidth,window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.45;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.domElement.setAttribute('aria-label','Interactive full-resolution three-dimensional looter scene');
root.insertBefore(renderer.domElement,root.firstChild);

const scene = new THREE.Scene();
scene.background = new THREE.Color('#232936');
scene.fog = new THREE.Fog('#232936',38,75);
const camera = new THREE.PerspectiveCamera(46,window.innerWidth/window.innerHeight,0.08,150);
camera.up.set(0,0,1);
camera.position.set(8,-15,12);
const orbit = new OrbitControls(camera,renderer.domElement);
orbit.target.set(0,0,1.2);
orbit.minDistance=3.5;
orbit.maxDistance=42;
orbit.maxPolarAngle=Math.PI/2.12;
orbit.enableDamping=true;
orbit.update();

scene.add(new THREE.HemisphereLight(0xbcd5ff,0x503d34,2.15));
const sun=new THREE.DirectionalLight(0xffe8ca,3.1);
sun.position.set(-7,-10,17);sun.castShadow=true;
sun.shadow.mapSize.set(2048,2048);
sun.shadow.camera.left=-28;sun.shadow.camera.right=28;
sun.shadow.camera.top=28;sun.shadow.camera.bottom=-28;
sun.shadow.normalBias=.02;
scene.add(sun);
const rim=new THREE.DirectionalLight(0x8fb3e4,1.2);
rim.position.set(6,9,10);scene.add(rim);

const MAT={
 floor:new THREE.MeshStandardMaterial({color:'#77736e',roughness:1}),
 metal:new THREE.MeshStandardMaterial({color:'#343e49',metalness:.48,roughness:.57}),
 orange:new THREE.MeshStandardMaterial({color:'#8c5740',metalness:.43,roughness:.67}),
 cement:new THREE.MeshStandardMaterial({color:'#878580',roughness:.95}),
 dark:new THREE.MeshStandardMaterial({color:'#24282d',roughness:.9}),
 rust:new THREE.MeshStandardMaterial({color:'#704a31',roughness:.85}),
 yellow:new THREE.MeshStandardMaterial({color:'#d4a24f',roughness:.8})
};
function box(name,x,y,z,w,d,h,mat,cast=true){
 const item=new THREE.Mesh(new THREE.BoxGeometry(w,d,h),mat);
 item.name=name;item.position.set(x,y,z);item.castShadow=cast;item.receiveShadow=true;
 scene.add(item);return item;
}
// A modest training yard gives the GLBs readable scale, shadows and movement
// while leaving the previously approved map and the Canvas 2D shop untouched.
box('ground',0,0,-.13,42,31,.24,MAT.floor,false);
for(let x=-19;x<=19;x+=3){
 const pts=[new THREE.Vector3(x,-14.4,.02),new THREE.Vector3(x+1,-14.4,.02)];
 const mark=new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),new THREE.LineBasicMaterial({color:'#b19460'}));
 scene.add(mark);
}
for(const x of [-20.5,20.5]){
 for(let y=-15;y<=15;y+=3)box('fence post',x,y,1.15,.085,.085,2.3,MAT.metal);
 box('fence rail',x,0,2.1,.07,30,.07,MAT.metal);
}
for(const y of [-15,15]){
 for(let x=-20;x<=20;x+=3)box('fence post',x,y,1.15,.085,.085,2.3,MAT.metal);
 box('fence rail',0,y,2.1,40,.07,.07,MAT.metal);
}
for(const [x,y,z,w,d,h] of [
 [-12,9,.75,5.4,2.6,1.5],[-12,9,2.25,5.4,2.6,1.5],
 [12,10,.75,5.0,2.5,1.5],[11,-9,.8,3.5,1.9,1.6]]) {
 box('cargo container',x,y,z,w,d,h,MAT.orange);
 for(let a=-w/2+.3;a<w/2;a+=.45)box('corrugation',x+a,y-d/2-.035,z,.04,.08,h-.09,MAT.rust);
}
for(const [x,y,w,angle] of [[-7,-6,2.9,.2],[7,-4,2.4,-.4],[-5,5,3.1,.7],[6,7,2.7,-.3]]){
 const b=box('concrete cover',x,y,.43,w,.62,.86,MAT.cement);
 b.rotation.z=angle;
}
for(const [x,y] of [[-10,2],[10,2],[-8,10],[8,-10]]){
 const drum=new THREE.Mesh(new THREE.CylinderGeometry(.32,.32,.7,32),MAT.rust);
 drum.rotation.x=Math.PI/2; // cylinder default Y-axis, lay along ground depth
 drum.rotation.x=0;
 drum.position.set(x,y,.35);drum.castShadow=true;drum.receiveShadow=true;
 // Turn upright cylinder so it stands along the world's Z axis.
 drum.rotation.x=Math.PI/2;
 scene.add(drum);
}
for(const x of [-13,13]) {
 const p=box('light column',x,-11,2.7,.11,.11,5.4,MAT.metal);
 const light=new THREE.PointLight(0xffb064,34,11,2.1);light.position.set(x,-11,5.0);scene.add(light);
 box('lamp',x,-11,5.36,.65,.35,.16,MAT.yellow);
}

const ASSET_BASE='./assets/procedural/looters/';
const configs=[
 {id:'looter_23',age:23,stride:.52,cadence:112,build:'lean'},
 {id:'looter_27',age:27,stride:.60,cadence:105,build:'average'},
 {id:'looter_35',age:35,stride:.57,cadence:92,build:'stocky'}
];
const loadGLB=new GLTFLoader();
let actors=[],selected=0,gear='none',loadedProps=new Map(), projectiles=[];
const keys=new Set();
const smooth=x=>x*x*(3-2*x);
function clamp(x,a,b){return Math.min(b,Math.max(a,x));}
function ikPos(ph,stride,run,scale){
 if(ph<.60){
  const u=ph/.60;
  return {front:-stride*.5+stride*u, lift:0, roll:-.07+u*.25};
 }
 const u=(ph-.60)/.40,e=smooth(u);
 return {front:stride*.5-stride*e,lift:(run?.13:.092)*scale*Math.sin(Math.PI*u),roll:.18*(1-u)-.10*u};
}
function updateRig(actor,dt,movement){
 const cfg=actor.cfg,run=movement==='run',active=movement!=='idle';
 if(active)actor.phase=(actor.phase+dt*cfg.cadence/(2*60)*(run?1.35:1))%1;
 else actor.phase=0;
 const phase=actor.phase,scale=cfg.id==='looter_23'?cfg.id&&1.75/1.8:cfg.id==='looter_27'?1.81/1.8:1.84/1.8;
 const hip=.98*scale,thigh=.435*scale,shin=.43*scale,rest=hip-thigh-shin;
 const bob=active?.01*scale*(1-Math.cos(4*Math.PI*phase)):0;
 const sway=active?.013*scale*Math.sin(2*Math.PI*phase):0;
 actor.model.position.set(sway,0,bob);
 for(const side of ['l','r']){
  const leg=actor.joints,ph=(phase+(side==='r'?.5:0))%1;
  let A=0,B=0,roll=0;
  if(active){
   const target=ikPos(ph,cfg.stride*(run?1.38:1)*(run?1.12:1),run,scale);
   const dy=target.front,dz=(rest+target.lift)-hip-bob;
   const dist=clamp(Math.hypot(dy,dz),.001,(thigh+shin)*.998);
   const a=(thigh*thigh-shin*shin+dist*dist)/(2*dist);
   const h=Math.sqrt(Math.max(0,thigh*thigh-a*a));
   const vy=dy/(Math.hypot(dy,dz)||1),vz=dz/(Math.hypot(dy,dz)||1);
   const ky=a*vy+h*vz,kz=a*vz-h*vy;
   A=Math.atan2(ky,-kz);
   B=Math.atan2(dy-ky,-(dz-kz));
   roll=target.roll;
  }
  leg['thigh_'+side].rotation.x=A;
  leg['shin_'+side].rotation.x=B-A;
  leg['foot_'+side].rotation.x=-B+roll;
  const amp=(run?.59:.38)*(cfg.build==='stocky'?.72:1);
  leg['arm_'+side].rotation.x=active?(side==='l'?-1:1)*amp*Math.cos(2*Math.PI*phase):0;
 }
 if(actor.attack){
   actor.attack.time+=dt;
   const t=clamp(actor.attack.time/.75,0,1);
   const arm=actor.joints.arm_r;
   if(actor.attack.type==='overhand') {
      arm.rotation.x=-2.5*smooth(clamp(t/.35,0,1))+
        2.15*smooth(clamp((t-.35)/.36,0,1))+
        .35*smooth(clamp((t-.71)/.29,0,1));
   } else if(actor.attack.type==='throw') {
      arm.rotation.x=-2.0*smooth(clamp(t/.38,0,1))+
        2.05*smooth(clamp((t-.38)/.29,0,1));
      if(t>.55&&!actor.attack.released){
         actor.attack.released=true;
         const template=loadedProps.get(actor.gear);
         if(template) {
           const instance=template.clone(true);
           const hand=new THREE.Vector3(.02,-.03,-.5);
           actor.joints.arm_r.localToWorld(hand);
           instance.position.copy(hand);
           scene.add(instance);
           projectiles.push({object:instance,age:0,yaw:actor.facing,
                             forward:4.5,initialZ:hand.z});
           if(actor.held)actor.held.visible=false;
         }
      }
   }
   if(t>=1){actor.attack=null;if(actor.held)actor.held.visible=true;}
 }
}
function setEquipped(actor,kind) {
 if(actor.held)actor.joints.arm_r.remove(actor.held);
 actor.held=null;actor.gear=kind;
 if(kind==='none')return;
 const item=loadedProps.get(kind).clone(true);
 actor.held=item;
 actor.joints.arm_r.add(item);
 item.scale.setScalar(1);
 item.position.set(.025,-.048,-.50);
 if(kind==='knife')item.rotation.x=Math.PI/2;
 item.traverse(x=>{if(x.isMesh){x.castShadow=true;}});
}
function refreshGear(){
 actors.forEach((a,i)=>setEquipped(a,i===selected?gear:'none'));
 document.querySelectorAll('[data-gear]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.gear===gear)));
}
function useCharacter(index){
 selected=index;
 document.querySelectorAll('[data-id]').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.id)===index)));
 refreshGear();
}
document.querySelectorAll('[data-id]').forEach(b=>b.addEventListener('click',()=>useCharacter(Number(b.dataset.id))));
document.querySelectorAll('[data-gear]').forEach(b=>b.addEventListener('click',()=>{
 gear=b.dataset.gear;refreshGear();
}));
function startAttack(type){
 const actor=actors[selected];
 if(!actor||actor.attack)return;
 if(type==='throw'&&!['brick','stone'].includes(actor.gear)) {
   status.textContent='Equip a half brick or stone before throwing.';return;
 }
 if(type==='overhand'&&actor.gear!=='knife') {
   status.textContent='Equip the knife for the overhand animation.';return;
 }
 actor.attack={type,time:0,released:false};
}
window.addEventListener('keydown',e=>{
 const key=e.key.toLowerCase();
 if(['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright','shift','j','k'].includes(key))e.preventDefault();
 keys.add(key);
 if(e.repeat)return;
 if(key==='1'||key==='2'||key==='3')useCharacter(Number(key)-1);
 if(key==='j')startAttack('throw');
 if(key==='k')startAttack('overhand');
});
window.addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));
window.addEventListener('blur',()=>keys.clear());
window.addEventListener('resize',()=>{
 camera.aspect=window.innerWidth/window.innerHeight;camera.updateProjectionMatrix();
 renderer.setSize(window.innerWidth,window.innerHeight);
 renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));
});

async function initialize(){
 try{
  const [a,b,c,brick,stone,knife]=await Promise.all([
   ...configs.map(cfg=>loadGLB.loadAsync(ASSET_BASE+cfg.id+'/'+cfg.id+'_articulated.glb')),
   ...['brick','stone','knife'].map(kind=>loadGLB.loadAsync(ASSET_BASE+'props/'+kind+'.glb'))
  ]);
  for(const [name,gltf] of [['brick',brick],['stone',stone],['knife',knife]])loadedProps.set(name,gltf.scene);
  for(const [i,source] of [a,b,c].entries()){
   const cfg=configs[i],base=new THREE.Group();
   const model=source.scene;
   base.add(model);
   base.position.set(-3+i*3,0,0);
   model.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});
   const joints={};
   for(const name of ['thigh_l','shin_l','foot_l','thigh_r','shin_r','foot_r','arm_l','arm_r']){
     joints[name]=model.getObjectByName(name);
     if(!joints[name])throw new Error(cfg.id+' GLB is missing articulated joint '+name);
   }
   scene.add(base);
   actors.push({cfg,base,model,joints,phase:0,facing:0,attack:null,gear:'none',held:null,wasWalking:false});
  }
  refreshGear();
  loaderNotice.classList.add('hidden');
  status.textContent='Three articulated VTK characters loaded. WASD to walk, Shift to run.';
 }catch(error){
  loaderNotice.textContent='3D stage could not load: '+error.message;
  loaderNotice.style.color='#ffc3a4';
  status.textContent='See browser console for model/WebGL loading error.';
  console.error(error);
 }
}
initialize();
let prev=performance.now(),lastHud=0;
function step(now){
 const dt=Math.min(.045,Math.max(0,(now-prev)/1000));prev=now;
 for(let i=0;i<actors.length;i++){
  const a=actors[i];
  let dx=0,dy=0,motion='idle';
  if(i===selected){
    if(keys.has('w')||keys.has('arrowup'))dy-=1;
    if(keys.has('s')||keys.has('arrowdown'))dy+=1;
    if(keys.has('a')||keys.has('arrowleft'))dx-=1;
    if(keys.has('d')||keys.has('arrowright'))dx+=1;
    if(dx||dy){
      const length=Math.hypot(dx,dy);dx/=length;dy/=length;
      motion=keys.has('shift')?'run':'walk';
    }
  }else{
    // Small patrol loops keep the extra figures alive for gameplay inspection.
    dx=Math.sin(now*.00029+i);dy=Math.cos(now*.00039+i*1.9);
    const length=Math.hypot(dx,dy);dx/=length;dy/=length;motion='walk';
  }
  if(motion!=='idle'){
    const speed=motion==='run'?3.1:1.38;
    a.base.position.x=clamp(a.base.position.x+dx*speed*dt,-17.5,17.5);
    a.base.position.y=clamp(a.base.position.y+dy*speed*dt,-12,12);
    a.facing=Math.atan2(dx,-dy);
    a.base.rotation.z=a.facing;
  }
  updateRig(a,dt,motion);
 }
 for(let i=projectiles.length-1;i>=0;i--){
   const p=projectiles[i];p.age+=dt;
   p.object.position.x+=Math.sin(p.yaw)*p.forward*dt;
   p.object.position.y-=Math.cos(p.yaw)*p.forward*dt;
   const t=p.age/0.85;
   p.object.position.z=p.initialZ+1.1*Math.sin(Math.PI*clamp(t,0,1))-.9*t;
   p.object.rotation.x+=dt*9;p.object.rotation.z+=dt*6;
   if(t>=1){scene.remove(p.object);projectiles.splice(i,1);}
 }
 if(now-lastHud>360&&actors.length){
   const a=actors[selected];
   const gearLabel=a.gear==='none'?'unarmed':a.gear;
   const action=a.attack?' · '+a.attack.type:'';
   status.textContent='Looter '+a.cfg.age+' · '+gearLabel+action+
     ' · full resolution '+renderer.domElement.width+' × '+renderer.domElement.height+
     ' · real 3D geometry';
   lastHud=now;
 }
 orbit.update();renderer.render(scene,camera);
 requestAnimationFrame(step);
}
requestAnimationFrame(step);
