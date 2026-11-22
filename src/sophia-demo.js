/* Hero Shooter / Sophia's 3D scrapyard sandbox
 * Real WebGL render of the approved Sophia v3.3 articulated VTK character,
 * plus the original procedural scrapyard GLB. No 2D sprites or 2D engine.
 * Coordinate convention here: world +Z up, +Y north, +X east.
 */
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';

const $=id=>document.getElementById(id);
const stage=$('stage'), overlay=$('loading'), status=$('status'), hud=$('hud');
const rootPath='./play/assets/procedural/';
const loader=new GLTFLoader();
const scene=new THREE.Scene();
scene.background=new THREE.Color(0x1c2530);
scene.fog=new THREE.FogExp2(0x222a34,.011);
const renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure=1.35;
renderer.shadowMap.enabled=true;
renderer.shadowMap.type=THREE.PCFSoftShadowMap;
const maxPixelRatio=1.6; // preserve detail on GTX 1060 without forcing 4K shadows
const resize=()=>{
 renderer.setPixelRatio(Math.min(devicePixelRatio||1,maxPixelRatio));
 renderer.setSize(innerWidth,innerHeight);
 camera.aspect=innerWidth/innerHeight;
 camera.updateProjectionMatrix();
};
stage.appendChild(renderer.domElement);
renderer.domElement.setAttribute('aria-label','Playable 3D scrapyard with Sophia');
const camera=new THREE.PerspectiveCamera(50,innerWidth/innerHeight,.06,160);
camera.up.set(0,0,1);
const controls=new OrbitControls(camera,renderer.domElement);
controls.enableDamping=true;controls.dampingFactor=.07;
controls.minDistance=2.8;controls.maxDistance=24;
controls.maxPolarAngle=Math.PI/2.08;controls.minPolarAngle=.28;
controls.enablePan=false;
resize();addEventListener('resize',resize);
scene.add(new THREE.HemisphereLight(0xb1d4f5,0x48352e,1.95));
const sun=new THREE.DirectionalLight(0xffe1b2,2.5);
sun.position.set(-15,-7,24);sun.castShadow=true;
sun.shadow.mapSize.set(2048,2048);
sun.shadow.camera.left=-40;sun.shadow.camera.right=40;
sun.shadow.camera.top=40;sun.shadow.camera.bottom=-40;
sun.shadow.camera.near=.1;sun.shadow.camera.far=95;
sun.shadow.normalBias=.025;scene.add(sun);
const rim=new THREE.DirectionalLight(0x88b0d8,.85);
rim.position.set(10,18,17);scene.add(rim);
const up=new THREE.Vector3(0,0,1);
const clamp=THREE.MathUtils.clamp, mix=THREE.MathUtils.lerp;
const wrap=(v)=>((v%1)+1)%1;
const smooth=t=>{t=clamp(t,0,1);return t*t*(3-2*t);};

let navgrid,layout,yard,hero;
let npcs=[],npcVisible=true;
let ready=false,elapsed=0,last=performance.now(),accFPS=0,fpsFrames=0;
let cameraMode='follow',debugGrid=false;
let jumpVelocity=0,jumpHeight=0,jumpCount=0;
let phase=0,aimed=false,throwing=false,throwPhase=0;
const stones=[];
const keys=new Set();
const virtual={up:false,down:false,left:false,right:false,run:false};
let pointerDownRight=false;
function walkable(x,y) {
 if(!navgrid)return false;
 const cell=navgrid.tile_size_m;
 const col=Math.floor((x+navgrid.width_cells*cell/2)/cell);
 const row=Math.floor((navgrid.height_cells*cell/2-y)/cell);
 return row>=0 && row<navgrid.height_cells && col>=0 &&
  col<navgrid.width_cells && navgrid.rows[row]?.charAt(col)==='1';
}
function moveGround(group,dx,dy,delta){
 const x=group.position.x,y=group.position.y;
 let nx=x+dx*delta,ny=y+dy*delta;
 if(walkable(nx,ny)){group.position.x=nx;group.position.y=ny;return true;}
 if(walkable(nx,y)){group.position.x=nx;return true;}
 if(walkable(x,ny)){group.position.y=ny;return true;}
 return false;
}
function respawn() {
 if(!ready)return;
 const spawn=layout.spawn_points.find(p=>p.id==='south_gate');
 hero.group.position.set(spawn.x,spawn.y,spawn.z);
 hero.facing=0;hero.group.rotation.z=0;
 phase=0;jumpVelocity=jumpHeight=0;jumpCount=0;
 camFollowing(true);
 setStatus('Sophia returned to the south gate');
}
function setStatus(message){status.textContent=message;}
function makeHero(gltf,spawn){
 const group=new THREE.Group();
 const model=gltf.scene;group.add(model);
 model.traverse(part=>{if(part.isMesh){part.castShadow=true;part.receiveShadow=true;}});
 const needed=['left_leg','right_leg','left_boot','right_boot','left_arm','right_arm'];
 const joints={};
 for(const name of needed){
   joints[name]=model.getObjectByName(name);
   if(!joints[name])throw new Error('Sophia GLB has no articulated joint: '+name);
 }
 const gunParts=[];
 model.traverse(node=>{if(node.name.includes('__prop_'))gunParts.push(node);});
 group.position.set(spawn.x,spawn.y,spawn.z);
 scene.add(group);
 return {group,model,joints,gunParts,facing:0,walkSpeed:2.2,runSpeed:4.3};
}
function animateSophia(dt,moveState) {
 const {model,joints}=hero, moving=moveState!=='idle',running=moveState==='run';
 if(moving)phase=wrap(phase+dt*(running?2.0:1.32));
 else phase=0; // important: stopped feet never keep moving
 const s=moving?Math.sin(phase*Math.PI*2):0;
 const amp=running?.54:.33;
 joints.left_leg.rotation.x=amp*s;
 joints.right_leg.rotation.x=-amp*s;
 joints.left_boot.rotation.x=moving?-.24*Math.max(0,s):0;
 joints.right_boot.rotation.x=moving?-.24*Math.max(0,-s):0;
 const armSwing=running?.48:.27;
 joints.left_arm.rotation.x=moving?-armSwing*s:0;
 joints.right_arm.rotation.x=moving?armSwing*s:0;
 if(aimed||pointerDownRight){
   joints.left_arm.rotation.x=1.15 + (moving?.06*s:0);
   joints.left_arm.rotation.z=-.16;
 }else joints.left_arm.rotation.z=0;
 if(throwing){
   throwPhase+=dt/.62;
   const t=clamp(throwPhase,0,1);
   joints.right_arm.rotation.x=-2.1*smooth(t/.45)+2.3*smooth((t-.45)/.48);
   if(t>.53 && !throwingReleased){throwingReleased=true;spawnStone();}
   if(t>=1)throwing=false;
 }
 model.position.z=(moving?(running?.036:.018)*(1-Math.cos(4*Math.PI*phase)):0)+jumpHeight;
 model.rotation.z=moving?.025*Math.sin(2*Math.PI*phase):0;
}
let throwingReleased=false;
function throwStone() {
 if(!ready||throwing)return;
 throwing=true;throwingReleased=false;throwPhase=0;
}
function spawnStone() {
 const rock=new THREE.Mesh(new THREE.IcosahedronGeometry(.075,1),
   new THREE.MeshStandardMaterial({color:0x827b6e,roughness:1}));
 rock.castShadow=true;
 const pos=hero.group.position.clone();
 pos.z+=1.32+jumpHeight;
 const forward=new THREE.Vector3(-Math.sin(hero.facing),Math.cos(hero.facing),0);
 pos.addScaledVector(forward,.34);
 rock.position.copy(pos);scene.add(rock);
 stones.push({mesh:rock,vel:forward.multiplyScalar(6.5).add(new THREE.Vector3(0,0,3.1)),age:0});
}
function animateStones(dt) {
 for(let i=stones.length-1;i>=0;i--){
   const b=stones[i];b.age+=dt;b.vel.z-=9.81*dt;
   b.mesh.position.addScaledVector(b.vel,dt);
   b.mesh.rotation.x+=dt*8;b.mesh.rotation.y+=dt*4;
   if(b.mesh.position.z<=.13 || b.age>3){
      scene.remove(b.mesh);b.mesh.geometry.dispose();b.mesh.material.dispose();
      stones.splice(i,1);
   }
 }
}
function npcMotion(n,dt,t) {
 if(!npcVisible){n.group.visible=false;return;}
 n.group.visible=true;
 if(n.nextChange<=0){
   n.nextChange=2+Math.random()*3;
   n.direction+=Math.PI*(Math.random()-.5);
 }
 n.nextChange-=dt;
 const dx=Math.cos(n.direction),dy=Math.sin(n.direction);
 const moved=moveGround(n.group,dx,dy,dt*n.speed);
 if(!moved)n.nextChange=0;
 n.group.rotation.z=Math.atan2(-dx,dy);
 n.phase=wrap(n.phase+dt*1.17);
 const s=Math.sin(n.phase*Math.PI*2);
 n.joints.thigh_l.rotation.x=.32*s;
 n.joints.thigh_r.rotation.x=-.32*s;
 n.joints.shin_l.rotation.x=-.22*Math.max(0,s);
 n.joints.shin_r.rotation.x=-.22*Math.max(0,-s);
 n.joints.arm_l.rotation.x=-.25*s;
 n.joints.arm_r.rotation.x=.25*s;
}
function camFollowing(snap=false){
 if(!hero)return;
 const p=hero.group.position;
 const target=new THREE.Vector3(p.x,p.y,1.22+jumpHeight*.5);
 if(snap){
   controls.target.copy(target);
   camera.position.copy(target).add(new THREE.Vector3(0,-6.5,4.4));
 }else{
   const shift=target.sub(controls.target).multiplyScalar(.12);
   controls.target.add(shift);camera.position.add(shift);
 }
 controls.update();
}
function toggleCamera() {
 cameraMode=cameraMode==='follow'?'overhead':'follow';
 if(cameraMode==='overhead'){
   const p=hero.group.position;
   controls.target.set(p.x,p.y,0);
   camera.position.set(p.x,p.y-2,12);
 }else camFollowing(true);
 controls.update();
 setStatus('Camera: '+(cameraMode==='follow'?'third-person':'overhead'));
}
function toggleNpcs(){
 npcVisible=!npcVisible;
 setStatus(npcVisible?'Walking test NPCs enabled':'Walking test NPCs hidden');
}
function keyDown(e) {
 const key=e.key.toLowerCase();
 if([' ','arrowup','arrowdown','arrowleft','arrowright'].includes(key))e.preventDefault();
 if(e.repeat&&[' ','j','v','r','n','q','f'].includes(key))return;
 keys.add(key);
 if(key===' '&&ready&&jumpCount===0){jumpVelocity=4.35;jumpCount=1;}
 if(key==='r')respawn();
 if(key==='v'&&ready)toggleCamera();
 if(key==='n')toggleNpcs();
 if(key==='f')aimed=!aimed;
 if(key==='j')throwStone();
 if(key==='h')hud.classList.toggle('hidden');
 if(key==='q')setStatus('Collision checks '+(navgrid?'active (0.5 m grid)':'loading'));
}
addEventListener('keydown',keyDown);
addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));
addEventListener('blur',()=>{
 keys.clear();
 Object.keys(virtual).forEach(k=>virtual[k]=false);
 pointerDownRight=false;
});
renderer.domElement.addEventListener('contextmenu',e=>e.preventDefault());
renderer.domElement.addEventListener('pointerdown',e=>{if(e.button===2)pointerDownRight=true;});
addEventListener('pointerup',e=>{if(e.button===2)pointerDownRight=false;});
document.querySelectorAll('[data-control]').forEach(button=>{
 const action=button.dataset.control;
 const down=e=>{
   e.preventDefault();button.setPointerCapture(e.pointerId);
   if(action==='jump'){if(ready&&jumpCount===0){jumpVelocity=4.35;jumpCount=1;}}
   else if(action==='throw')throwStone();
   else if(action==='aim')aimed=!aimed;
   else virtual[action]=true;
 };
 const release=e=>{e.preventDefault();if(action in virtual)virtual[action]=false;};
 button.addEventListener('pointerdown',down);
 button.addEventListener('pointerup',release);
 button.addEventListener('pointercancel',release);
 button.addEventListener('lostpointercapture',release);
});
$('respawn').addEventListener('click',respawn);
$('cameraMode').addEventListener('click',()=>{if(ready)toggleCamera();});
$('npcToggle').addEventListener('click',toggleNpcs);

async function init() {
 try {
   const [yardAsset,heroAsset,grid,data]=await Promise.all([
     loader.loadAsync(rootPath+'scrapyard/scrapyard_arena.glb'),
     loader.loadAsync(rootPath+'sophia/sophia_v33_articulated.glb'),
     fetch(rootPath+'scrapyard/arena_navgrid.json').then(r=>{if(!r.ok)throw Error('Scrapyard navgrid missing');return r.json();}),
     fetch(rootPath+'scrapyard/arena_layout.json').then(r=>{if(!r.ok)throw Error('Scrapyard layout missing');return r.json();})
   ]);
   navgrid=grid;layout=data;
   if(grid.width_cells!==100||grid.height_cells!==56||data.dimension_m.width_x!==50)
     throw Error('Scrapyard collision/grid dimensions do not agree');
   yard=yardAsset.scene;
   yard.rotation.x=Math.PI/2; // Original GLB Y-up => game Z-up, with north kept north.
   yard.traverse(node=>{if(node.isMesh){node.receiveShadow=true;node.castShadow=false;}});
   scene.add(yard);
   const spawn=layout.spawn_points.find(p=>p.id==='south_gate');
   if(!spawn||!walkable(spawn.x,spawn.y))throw Error('South-gate spawn is obstructed');
   hero=makeHero(heroAsset,spawn);
   const npcSources=await Promise.allSettled([23,27,35].map(age=>
     loader.loadAsync(rootPath+'looters/looter_'+age+'/looter_'+age+'_articulated.glb')));
   const spots=['west_flank','east_flank','central_open'];
   npcSources.forEach((result,index)=>{
     if(result.status!=='fulfilled')return;
     const spot=layout.spawn_points.find(x=>x.id===spots[index]);
     if(!spot||!walkable(spot.x,spot.y))return;
     const group=new THREE.Group();group.add(result.value.scene);
     group.position.set(spot.x,spot.y,spot.z);
     const joints={};const needed=['thigh_l','thigh_r','shin_l','shin_r','arm_l','arm_r'];
     for(const j of needed)joints[j]=result.value.scene.getObjectByName(j);
     if(needed.some(j=>!joints[j]))return;
     result.value.scene.traverse(node=>{if(node.isMesh){node.castShadow=true;node.receiveShadow=true;}});
     scene.add(group);
     npcs.push({group,joints,phase:0, direction:index*1.8,nextChange:0,speed:1.0+index*.15});
   });
   ready=true;overlay.hidden=true;camFollowing(true);
   setStatus('Arena loaded. WASD move · Shift sprint · Space jump · J throw rock.');
 } catch(error) {
   overlay.textContent='Could not start the 3D demo: '+error.message;
   overlay.classList.add('error');
   setStatus(error.message);
   console.error('Sophia sandbox boot failed',error);
 }
}
init();
function frame(now){
 const dt=Math.min(.045,Math.max(0,(now-last)/1000));last=now;elapsed+=dt;
 if(ready){
   const forward=camera.getWorldDirection(new THREE.Vector3());forward.z=0;forward.normalize();
   const right=new THREE.Vector3().crossVectors(forward,up).normalize();
   let f=(keys.has('w')||keys.has('arrowup')||virtual.up?1:0)-
         (keys.has('s')||keys.has('arrowdown')||virtual.down?1:0);
   let side=(keys.has('d')||keys.has('arrowright')||virtual.right?1:0)-
            (keys.has('a')||keys.has('arrowleft')||virtual.left?1:0);
   let direction=forward.multiplyScalar(f).addScaledVector(right,side);
   const walking=direction.lengthSq()>.001;
   let state='idle';
   if(walking){
     direction.normalize();
     const running=keys.has('shift')||virtual.run;
     state=running?'run':'walk';
     const speed=running?hero.runSpeed:hero.walkSpeed;
     moveGround(hero.group,direction.x,direction.y,speed*dt);
     hero.facing=Math.atan2(-direction.x,direction.y);
     hero.group.rotation.z=mix(hero.group.rotation.z,hero.facing,Math.min(1,dt*11));
   }
   if(jumpCount){
     jumpVelocity-=12.5*dt;jumpHeight+=jumpVelocity*dt;
     if(jumpHeight<=0){jumpHeight=0;jumpVelocity=0;jumpCount=0;}
   }
   animateSophia(dt,state);
   animateStones(dt);
   npcs.forEach(n=>npcMotion(n,dt,elapsed));
   if(cameraMode==='follow'||cameraMode==='overhead')camFollowing(false);
   if(Math.floor(now/450)!==Math.floor((now-dt*1000)/450)){
     $('distance').textContent=hero.group.position.distanceTo(
       new THREE.Vector3(0,-11.8,.1)).toFixed(1)+' m from gate';
   }
 }
 controls.update();
 renderer.render(scene,camera);
 fpsFrames++;accFPS+=dt;
 if(accFPS>=.7){$('fps').textContent=Math.round(fpsFrames/accFPS)+' FPS';fpsFrames=0;accFPS=0;}
 requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
