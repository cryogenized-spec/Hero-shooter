// Both built Pages (/training/) and repository-root Pages (/public/training/) are supported.
const sourcePublished=import.meta.url.includes('/public/training/');
const {drawArmedC, armedFacing}=await import(sourcePublished?'../../src/armed-c.js':'../src/armed-c.js');

const canvas = document.querySelector('canvas');
const ctx = canvas.getContext('2d');
const score = document.querySelector('#score');
const yard = new Image();
yard.src = './scrapyard.webp';
// Target bounds and clean donor coordinates are in the original artwork's pixels.
const targets = [
 [341,152,34,40,309,152],[385,151,34,40,309,152],[429,150,35,40,309,152],
 [960,130,32,39,925,130],[993,125,31,41,925,128],[1025,134,32,39,925,130],
 [1334,243,30,40,1300,247],[797,291,28,46,827,291],
 [1098,129,22,24,1079,129],[1127,122,22,25,1147,122],
 [1155,119,23,26,1207,119],[1182,123,23,25,1207,123],
 [1436,341,24,36,1410,341],[1472,341,24,36,1410,341],[1507,338,24,36,1410,341],
 [1244,104,27,48,1220,104],[1154,382,29,51,1131,382],
 [539,606,28,52,510,606],[594,606,28,52,568,606],[652,611,29,52,622,611]
];
const solids = [[39,96,244,137],[213,254,164,64],[461,206,125,41],[610,245,352,133],
 [961,222,73,87],[1018,299,84,38],[1161,206,239,91],[1280,292,124,46],[1454,87,173,177],
 [36,355,161,210],[339,347,156,67],[516,430,321,86],[400,473,101,83],[1018,392,83,65],
 [1070,455,160,55],[1190,352,41,107],[1356,393,99,39],[1319,475,273,119],
 [500,597,228,65],[830,559,58,123],[881,557,214,68],[951,678,232,71],[369,679,135,74]];
const player = {gender:'mall', angle:0, walkPhase:0, walkBlend:0};
const weapon = {id:'glock26'};
const keys = new Set();
const broken = new Set();
let particles = [], last, aim;
const casings = [];
// Barrel positions relative to the sprite anchor, clockwise from south.
const muzzleOffsets = [[2,8],[-13,3],[-16,0],[-16,-1],[0,-10],[13,0],[15,2],[15,4]];
let flash;

function fireEffects() {
 const [dx,dy] = muzzleOffsets[armedFacing(player.angle)];
 const x = player.x + dx, y = player.y + dy;
 flash = {x, y, angle:player.angle, life:.06};
 const side = player.angle + Math.PI/2 + (Math.random()-.5)*.6;
 const speed = 90 + Math.random()*60;
 casings.push({
  x:x-4*Math.cos(player.angle), y:y-4*Math.sin(player.angle),
  vx:speed*Math.cos(side), vy:speed*Math.sin(side),
  angle:side, spin:(Math.random()-.5)*36, life:.38
 });
}

function drawShotEffects(dt) {
 if (flash && flash.life > 0) {
  ctx.save();
  ctx.translate(flash.x,flash.y);
  ctx.rotate(flash.angle);
  ctx.scale(flash.life/.06,flash.life/.06);
  ctx.fillStyle='#ffae48';
  ctx.beginPath();
  ctx.moveTo(0,0);
  ctx.lineTo(4,-3);
  ctx.lineTo(11,0);
  ctx.lineTo(4,3);
  ctx.fill();
  ctx.fillStyle='#fff4c4';
  ctx.fillRect(0,-1,6,2);
  ctx.restore();
  flash.life-=dt;
 }
 const drag = Math.pow(.9,dt*60);
 for (let i=casings.length-1; i>=0; i--) {
  const c=casings[i];
  ctx.save();
  ctx.translate(c.x,c.y);
  ctx.rotate(c.angle);
  ctx.globalAlpha=Math.min(1,c.life/.12);
  ctx.fillStyle='#dfa744';
  ctx.fillRect(-2,-1,4,2);
  ctx.fillStyle='#ffdb84';
  ctx.fillRect(-2,-1,1,2);
  ctx.restore();
  c.x+=c.vx*dt;
  c.y+=c.vy*dt;
  c.vx*=drag;
  c.vy*=drag;
  c.angle+=c.spin*dt;
  c.life-=dt;
  if (c.life<=0) casings.splice(i,1);
 }
}
function updateScore(){score.value = broken.size + ' / ' + targets.length + ' broken';}
function reset(){
 Object.assign(player,{x:270,y:435,angle:0,walkPhase:0,walkBlend:0,slideTime:0});
 broken.clear(); particles=[]; flash=null; casings.length=0; aim=null; keys.clear(); updateScore();
}
function canStand(x,y){
 return x>115 && x<1570 && y>175 && y<752 &&
  !solids.some(([l,t,w,h])=>x>=l && x<=l+w && y>=t && y<=t+h);
}
function pointer(e){
 const r=canvas.getBoundingClientRect();
 return {x:(e.clientX-r.left)*canvas.width/r.width,y:(e.clientY-r.top)*canvas.height/r.height};
}
canvas.onpointermove=e=>{aim=pointer(e);};
canvas.onpointerdown=e=>{
 if(e.button!==0 || !yard.naturalWidth)return;
 aim=pointer(e);
 player.angle=Math.atan2(aim.y-player.y,aim.x-player.x);
 player.slideTime=.105;
 fireEffects();
 const i=targets.findIndex(([x,y,w,h],i)=>!broken.has(i) && aim.x>=x && aim.x<x+w && aim.y>=y && aim.y<y+h);
 if(i<0)return;
 broken.add(i); updateScore();
 for(let n=0;n<15;n++)particles.push({x:aim.x,y:aim.y,vx:(Math.random()-.5)*170,vy:-50-Math.random()*130,life:.55,color:n%2?'#e1a25a':'#514336'});
};
const movement=['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowLeft','ArrowDown','ArrowRight','ShiftLeft','ShiftRight'];
addEventListener('keydown',e=>{if(movement.includes(e.code)){e.preventDefault();keys.add(e.code);}});
addEventListener('keyup',e=>keys.delete(e.code));
addEventListener('blur',()=>keys.clear());
document.querySelector('#reset').onclick=reset;
document.querySelector('a[href="../"]').href=sourcePublished?'../../':'../';
function frame(now){
 const dt=Math.min(.05,(now-(last??now))/1000); last=now;
 const held=(a,b)=>Number(keys.has(a)||keys.has(b));
 const dx=held('KeyD','ArrowRight')-held('KeyA','ArrowLeft');
 const dy=held('KeyS','ArrowDown')-held('KeyW','ArrowUp');
 const length=Math.hypot(dx,dy);
 player.sprinting=!!held('ShiftLeft','ShiftRight');
 const step=(player.sprinting?245:145)*dt/(length||1);
 const ox=player.x, oy=player.y;
 if(canStand(player.x+dx*step,player.y))player.x+=dx*step;
 if(canStand(player.x,player.y+dy*step))player.y+=dy*step;
 const distance=Math.hypot(player.x-ox,player.y-oy);
 player.walkBlend=distance>0?1:0; player.walkPhase+=distance*.095;
 if(aim)player.angle=Math.atan2(aim.y-player.y,aim.x-player.x);
 else if(length)player.angle=Math.atan2(dy,dx);
 player.slideTime=Math.max(0,player.slideTime-dt);
 ctx.drawImage(yard,0,0);
 for(const i of broken){
  const [x,y,w,h,sx,sy]=targets[i];ctx.drawImage(yard,sx,sy,w,h,x,y,w,h);
 }
 drawArmedC(ctx,player,weapon);
 drawShotEffects(dt);
 for(const p of particles){
  p.life-=dt;p.vy+=390*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;
  ctx.fillStyle=p.color;ctx.fillRect(p.x,p.y,3,2);
 }
 particles=particles.filter(p=>p.life>0);
 requestAnimationFrame(frame);
}
reset();
yard.decode().then(()=>requestAnimationFrame(frame)).catch(()=>{score.value='Range artwork could not load. Reload to retry.';});
