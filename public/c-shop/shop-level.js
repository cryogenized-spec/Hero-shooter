/*
 * Golden Dragon — C's Chinese shop, Mall Level 1.
 *
 * This is an adaptation layer on top of the exact, unmodified
 * pine-ridge-overhead.html script in this directory. The original 640×360
 * canvas engine, 2D character renderer, audio, movement/collision and
 * mouse-aiming infrastructure remain loaded. We replace only the map,
 * story-state, NPC scene and scene-specific input/render functions.
 *
 * World coordinates +X right / +Y down.  The original Pine Ridge prototype
 * remains playable at ./pine-ridge-original.html.
 */
(()=>{
'use strict';
const props=[],people=[];
const quest={stage:'find_chen',dialogue:null,index:0,message:'',messageTime:0,shutter:false,seenChen:false,finished:false};
let elapsed=0;
const backdrop=floor.getContext('2d');

function spot(name,x,y,r,text){props.push({name,x,y,r,text});}
function obstacle(x,y,w,h){blocks.push({x,y,w,h});}
function furnishing(x,y,w,h,base='#60505a',highlight='#b29b8a'){
 obstacle(x,y,w,h);
 rect(x+4,y+5,w,h,'#332934');
 rect(x,y,w,h,base);
 rect(x+2,y+2,w-4,3,highlight);
 rect(x+3,y+h-5,w-6,2,'#3c333d');
}
function productBox(x,y,tint){
 rect(x+1,y+2,13,12,'#362e39');
 rect(x,y,13,11,tint);
 rect(x+2,y+2,8,2,'#dec9ab');
 rect(x+6,y+4,1,6,'#9a7462');
}
const goods=['#b1835c','#7c9b9a','#9a626b','#bd9c7a','#758376','#8b788c'];
function shelf(x,y,w=64,h=200){
 furnishing(x,y,w,h,'#656168','#c2a590');
 for(let z=0;z<4;z++){
  const sy=y+11+z*44;
  rect(x+4,sy,w-8,33,'#3b343f');
  for(let n=0;n<Math.floor((w-8)/15);n++)productBox(x+7+n*15,sy+3,goods[(n+z*3)%goods.length]);
  rect(x+4,sy+30,w-8,3,'#c69f76');
 }
}
function lamp(x,y){
 rect(x-19,y-8,39,17,'#403744');
 rect(x-16,y-5,34,10,'#c19b74');
 rect(x-13,y-3,28,5,'#ffe5b5');
}
function lantern(x,y){
 rect(x-12,y-17,25,36,'#49323c');
 circle(x,y,12,'#b15456');
 rect(x-9,y-4,18,8,'#d4845a');
 rect(x-10,y-12,20,3,'#f0bd80');
 rect(x-9,y+11,18,3,'#ecc68b');
 rect(x-1,y+16,2,9,'#a56b4e');
}
const equipment=window.CShopEquipment={drawn:false,aiming:false,light:false,strobe:false,vision:'normal',battery:100};
let floorName='retail',shopTime=0;
const mapArgs=()=>({rect,circle,label,random,blocks,props,spot});
function shopMap(){window.HomeMoreMap.build(mapArgs());floorName='retail';}
function goUpstairs(){
 g=backdrop;g.clearRect(0,0,W,H);window.HomeMoreMap.upper(mapArgs());
 g=ctx;g.imageSmoothingEnabled=false;floorName='upper';
 player.x=828;player.y=781;camera();
 quest.message='Upper family room — return via the stairs';quest.messageTime=3;
}
function goDownstairs(){
 g=backdrop;g.clearRect(0,0,W,H);shopMap();
 g=ctx;g.imageSmoothingEnabled=false;
 player.x=254;player.y=438;camera();
 quest.message='Home & More staff corridor';quest.messageTime=3;
}
function toggleEquipment(){
 equipment.drawn=!equipment.drawn;
 if(!equipment.drawn){equipment.aiming=false;equipment.light=false;equipment.strobe=false;}
 quest.message=equipment.drawn?'Pistol drawn — RMB to aim':'Pistol holstered';quest.messageTime=3;hud();
}
function toggleLight(){
 if(!equipment.drawn){quest.message='Draw equipment with G first';quest.messageTime=3;return;}
 if(equipment.battery<=0)return;
 equipment.light=!equipment.light;
 if(!equipment.light)equipment.strobe=false;
 quest.message=equipment.light?'Equipment light on':'Equipment light off';
 quest.messageTime=2;hud();
}
function toggleStrobe(){
 if(!equipment.drawn||equipment.battery<=0)return;
 equipment.strobe=!equipment.strobe;equipment.light=equipment.strobe||equipment.light;
 quest.message=equipment.strobe?'Strobe active':'Strobe inactive';quest.messageTime=2;hud();
}
function cycleVision(){
 equipment.vision=equipment.vision==='normal'?'nvg':equipment.vision==='nvg'?'thermal':'normal';
 quest.message='View: '+equipment.vision.toUpperCase();quest.messageTime=2;hud();
}
function aimGuide(){
 if(!equipment.drawn||!equipment.aiming||floorName!=='retail'||quest.dialogue)return;
 const a=player.a,ax=player.x+Math.cos(a)*14,ay=player.y+Math.sin(a)*14;
 const bx=ax+Math.cos(a)*430,by=ay+Math.sin(a)*430;
 const fade=g.createLinearGradient(ax,ay,bx,by);
 fade.addColorStop(0,'rgba(212,69,90,.38)');
 fade.addColorStop(.35,'rgba(195,51,79,.22)');
 fade.addColorStop(.8,'rgba(170,45,71,.06)');
 fade.addColorStop(1,'rgba(170,40,70,0)');
 g.strokeStyle=fade;g.lineWidth=1.1;g.lineCap='round';g.beginPath();
 g.moveTo(ax,ay);g.lineTo(bx,by);g.stroke();
}
function flashlightBeam(){
 if(!equipment.drawn||!equipment.light||floorName!=='retail'||equipment.battery<=0)return;
 if(equipment.strobe&&Math.floor(shopTime*12)%2)return;
 const a=player.a,ax=player.x+Math.cos(a)*13,ay=player.y+Math.sin(a)*13,d=320;
 const bx=ax+Math.cos(a)*d,by=ay+Math.sin(a)*d;
 const gradient=g.createLinearGradient(ax,ay,bx,by);
 gradient.addColorStop(0,'rgba(255,247,210,.24)');
 gradient.addColorStop(.54,'rgba(255,236,194,.11)');
 gradient.addColorStop(1,'rgba(255,224,173,0)');
 g.save();g.fillStyle=gradient;g.beginPath();g.moveTo(ax,ay);
 g.lineTo(ax+Math.cos(a-.34)*d,ay+Math.sin(a-.34)*d);
 g.quadraticCurveTo(bx,by,ax+Math.cos(a+.34)*d,ay+Math.sin(a+.34)*d);
 g.closePath();g.fill();g.restore();
}
function visionOverlay(){
 if(equipment.vision==='normal')return;
 g.save();g.fillStyle=equipment.vision==='nvg'?'rgba(25,88,44,.13)':'rgba(144,46,33,.10)';
 g.fillRect(0,0,canvas.width,canvas.height);g.restore();
}
const originalDrawFighter=drawFighter;
drawFighter=function(p,hero,fall){
 if(hero&&!equipment.drawn){
  // Source-style unarmed walk/idle: both hands free, no visible pistol.
  const look=castLooks[p.look],moving=p.motion||0;
  const bob=Math.round(moving*Math.abs(Math.sin(p.step*Math.PI/4))*1.3);
  drawBoots(p,look,hero,fall);
  g.translate(fall*4-bob,0);g.lineCap='round';g.lineJoin='round';
  drawTorso(look);
  const handSwing=moving?Math.round(Math.sin(p.step*Math.PI/4)*2):0;
  drawArm(look,-2,-5,0,-9,5+handSwing,-10);
  drawArm(look,-2,5,0,9,5-handSwing,10);
  drawHead(look);
 }else originalDrawFighter(p,hero,fall);
 if(!hero)return;
 // C's tactical-anime illustration translated into the ORIGINAL tiny overhead
 // sprite language: auburn ponytail, floral band, scarf, webbing, pouches.
 rect(-11,-4,8,8,'#632c25');rect(-9,-3,6,2,'#ba6041');
 rect(-2,-6,2,12,'#f4dfc0');
 for(const y of [-5,-1,3,5]){rect(-2,y,2,2,'#ffefe4');rect(-1,y,1,1,'#ddb874')}
 rect(-7,-5,8,10,'#302b34');
 for(const y of [-4,0,4]){rect(-5,y,4,3,'#a88a62');rect(-4,y+1,2,1,'#e6bb80')}
 rect(1,-5,3,9,'#e5e0d7');
 for(const y of [-3,0,3])rect(1,y,3,1,'#423444');
 for(const side of [-1,1]){
  rect(-12,side*3-2,5,4,'#987656');rect(-11,side*3-1,3,2,'#c3a078');
 }
 if(equipment.drawn&&weapon==='beretta'){rect(10,1,6,3,'#bc507d');rect(11,1,5,1,'#f097b6')}
};
castLooks.hero=Object.assign({},castLooks.hero,{
 coat:'#292531',edge:'#8d7166',shade:'#3c313b',boot:'#4b332d',
 trim:'#c9aa7a',skin:'#cc8766',hair:'#753e2e',shine:'#dd9e6e',
 head:'part',kit:'armour'
});
const chen={
 x:1262,y:715,a:-Math.PI/2,hp:1,motion:0,step:0,fall:0,
 role:'civilian',look:'chen',civilian:{
  skin:'#bb8b68',hair:'#322e35',coat:'#4b454b',light:'#988879',
  pants:'#31313c',shoes:'#26262f',cut:'longcoat',head:'part',item:'none'
 }
};
chen.civilian.frames=makeCivilianFrames(chen.civilian);
const clerk={
 x:530,y:386,a:0,hp:1,motion:0,step:0,fall:0,role:'civilian',
 civilian:{skin:'#a66b50',hair:'#3a2931',coat:'#436067',light:'#95a8a2',
 pants:'#393640',shoes:'#362931',cut:'vest',head:'part',item:'none'}
};
clerk.civilian.frames=makeCivilianFrames(clerk.civilian);
const mrsChen={x:112,y:588,a:-Math.PI/2,hp:1,motion:0,step:0,fall:0,role:'civilian',
 civilian:{skin:'#b08267',hair:'#3b2b38',coat:'#57404c',light:'#b7a29b',pants:'#50434f',
 shoes:'#292532',cut:'longcoat',head:'part',item:'none'}};
mrsChen.civilian.frames=makeCivilianFrames(mrsChen.civilian);
people.push(chen,clerk,mrsChen);
function closeConversation(){
 quest.dialogue=null;document.getElementById('dialogue').hidden=true;hud();
}
function showConversation(){
 const [speaker,text]=quest.dialogue[quest.index];
 document.getElementById('dialogueSpeaker').textContent=speaker;
 document.getElementById('dialogueText').textContent=text;
 document.getElementById('nextDialogue').textContent=quest.index===quest.dialogue.length-1?'Close':'Continue';
}
function beginConversation(lines){
 quest.dialogue=lines;quest.index=0;
 document.getElementById('dialogue').hidden=false;
 showConversation();
}
function continueConversation(){
 if(!quest.dialogue)return;
 quest.index++;
 if(quest.index>=quest.dialogue.length)closeConversation();
 else showConversation();
}
function nearest(){
 let found=null,distance=Infinity;
 // At the checkout, the shopkeeper takes precedence over the counter
 // display so an E press can start the conversation from the customer side.
 if(floorName==='retail'&&near(player,chen)<166)return {name:'Mr. Chen',x:chen.x,y:chen.y,r:166};
 const items=props;
 for(const item of items){
  const d=near(player,item);
  if(d<item.r&&d<distance){found=item;distance=d}
 }
 return found;
}
function interact(){
 if(quest.dialogue){continueConversation();return;}
 const item=nearest();
 if(!item){quest.message='Move near Mr. Chen or a shop display';quest.messageTime=3;return;}
 if(item.name==='Return to L1'){goDownstairs();return;}
 if(item.name==='Mezzanine stairs'){goUpstairs();return;}
 const door=window.HomeMoreMap.doors.find(d=>d.name===item.name);
 if(door){window.HomeMoreMap.open(door.id,blocks);quest.message=door.name+' opened';
   quest.messageTime=3;return;}
 if(item.name==='Mrs. Chen'){quest.message='Mrs Chen is preparing the payroll in her L1 office.';quest.messageTime=4;return;}
 if(item.name==='Mr. Chen'){
  if(quest.stage==='find_chen'){
   quest.stage='check_shutter';quest.seenChen=true;
   beginConversation([
    ['C','Mr. Chen? The lights are out across the mall.'],
    ['MR. CHEN','Little C! The power failed before the shutters finished closing.'],
    ['C','I could barely see anyone in the passage.'],
    ['MR. CHEN','Please check our entrance shutter. I will keep watch at the counter.'],
    ['C','All right. I will have a look.']
   ]);
  }else if(quest.stage==='return'){
   quest.stage='finished';quest.finished=true;
   beginConversation([
    ['C','The shutter is stuck, but the mall passage is still open.'],
    ['MR. CHEN','Thank you, C. Something strange is happening on this floor.'],
    ['C','I will stay nearby until we know more.']
   ]);
  }else beginConversation([['MR. CHEN',quest.finished?
    'Good. Let us remain near the shop.':'Please check the entrance shutter, C.']]);
 }else{
  quest.message=item.text;quest.messageTime=4.5;
  if(item.name==='Main glass doors'&&quest.stage==='check_shutter'){
   quest.stage='return';quest.shutter=true;
   beginConversation([
    ['C','The shutter mechanism has jammed, but the doorway is still accessible.'],
    ['C','I should tell Mr. Chen before going farther.']
   ]);
  }
 }
 hud();
}
function objective(){
 return quest.finished?'CHAPTER COMPLETE':quest.stage==='find_chen'?'Speak to Mr. Chen':
 quest.stage==='check_shutter'?'Inspect shop shutter':'Return to Mr. Chen';
}
function drawStoryHUD(){
 if(quest.dialogue)return;
 const item=nearest();
 const msg=quest.messageTime>0?quest.message:item?'E · '+item.name:
 'OBJECTIVE · '+objective();
 g.fillStyle='#28232e';g.fillRect(8,8,Math.min(canvas.width-16,msg.length*7+16),24);
 g.fillStyle='#ffe2b7';g.font='bold 11px monospace';g.fillText(msg,16,24);
 g.fillStyle='#241f2a';g.fillRect(8,canvas.height-27,178,19);
 g.fillStyle='#e7c59c';g.font='bold 10px monospace';
 g.fillText('C · HOME & MORE / '+(floorName==='retail'?'L1':'UPPER')+' / '+(equipment.drawn?'DRAWN':'HOLSTERED'),14,canvas.height-14);
}
function drawStoryActors(){
 for(const p of props){
  if(near(player,p)<125){
   g.save();g.globalAlpha=.20+.07*Math.sin(elapsed*5);
   circle(p.x,p.y,14,'#ffe2a7');g.restore();
   if(near(player,p)<p.r){rect(p.x-9,p.y-34,18,14,'#2d2430');label('E',p.x-3,p.y-23,'#ffe1b1',12)}
  }
 }
 for(const person of (floorName==='retail'?people:[])){
  sprite(person,false);
  if(person===chen){
   rect(person.x-24,person.y-32,49,12,'#352632');
   label('MR CHEN',person.x-22,person.y-23,'#ffe0b6',9);
  }
 }
}
function setQuestMessage(v){quest.message=v;quest.messageTime=3;}
function shopReset(){
 weapon='beretta';inventory={beretta:{rounds:8,spares:3}};
 rounds=8;spares=3;reload=cool=grace=taxi=passengers=phase=musicTime=musicStep=0;
 player={x:834,y:827,a:-Math.PI/2,hp:3,step:0,flash:0,look:'hero',motion:0,travel:-Math.PI/2};
 enemies=[];loot=[];particles=[];fx=[];prints=[];drop=null;
 run=crouch=held=press=confirm=false;keys.clear();
 quest.stage='find_chen';quest.dialogue=null;quest.index=0;
 quest.message='Speak to Mr. Chen by the checkout';quest.messageTime=5;
 quest.shutter=quest.seenChen=quest.finished=false;elapsed=0;shopTime=0;
 equipment.drawn=false;equipment.aiming=false;equipment.light=false;equipment.strobe=false;
 equipment.vision='normal';equipment.battery=100;
 g=backdrop;g.clearRect(0,0,W,H);shopMap();g=ctx;g.imageSmoothingEnabled=false;
 document.getElementById('dialogue').hidden=true;
 camera();hud();
}
function shopHud(){
 document.querySelector('output').textContent='CHAPTER 1 · HOME & MORE · '+objective()+
  '  |  '+(reload?'RELOADING':rounds+' / '+spares+' SPARE')+
  '  ·  '+(run?'RUN':'WALK')+(crouch?' / CROUCH':'')+
  ' · '+(equipment.drawn?'DRAWN':'HOLSTERED')+' · BAT '+Math.round(equipment.battery)+'%';
}
function shopStep(dt){
 effects(dt);
 elapsed+=dt;shopTime+=dt;
 if(equipment.drawn&&equipment.light){
  equipment.battery=Math.max(0,equipment.battery-dt*(equipment.strobe?2.1:.6));
  if(equipment.battery===0){equipment.light=false;equipment.strobe=false;}
 }
 if(!equipment.drawn)equipment.aiming=false;
 player.flash=Math.max(0,player.flash-dt);
 cool=Math.max(0,cool-dt);
 if(quest.messageTime>0)quest.messageTime-=dt;
 let dx=0,dy=0;
 if(!quest.dialogue){
  dx=+(keys.has('KeyD')||keys.has('ArrowRight'))-+(keys.has('KeyA')||keys.has('ArrowLeft'));
  dy=+(keys.has('KeyS')||keys.has('ArrowDown'))-+(keys.has('KeyW')||keys.has('ArrowUp'));
 }
 const mag=Math.hypot(dx,dy),speed=crouch?49:run?140:88,ox=player.x,oy=player.y;
 if(mag)move(player,dx/mag*speed*dt,dy/mag*speed*dt);
 player.step+=trackMotion(player,ox,oy,dt)/5;camera();
 const target=equipment.drawn?Math.atan2(aim.y+view.y-player.y,aim.x+view.x-player.x):(player.travel||0);
 player.a+=Math.atan2(Math.sin(target-player.a),Math.cos(target-player.a))*Math.min(1,dt*16);
 if(reload){reload=Math.max(0,reload-dt);if(!reload){rounds=8;spares=Math.max(0,spares-1);hud()}}
 if(press&&equipment.drawn&&!cool&&!reload&&rounds&&!quest.dialogue){
  rounds--;fire(player,true);cool=.21;hud();
 }
 press=false;
 for(const p of people){p.motion=0;p.step=0;p.flash=0;}
}
function shopRender(){
 g.save();g.translate(-Math.round(view.x),-Math.round(view.y));
 g.drawImage(floor,0,0);
 window.HomeMoreMap.paint({rect,label});
 flashlightBeam();
 drawStoryActors();
 for(const c of fx){
  g.save();g.translate(c.x,c.y-c.z);g.rotate(c.a);
  if(c.kind==='brass')rect(0,0,3,1,'#e4bc70');
  else rect(0,0,3,5,'#3b3340');g.restore();
 }
 sprite(player,true);
 aimGuide();
 for(const p of particles)rect(p.x,p.y,2,2,p.type==='spark'?'#ffe5ab':'#b97580');
 g.restore();
 drawStoryHUD();
 visionOverlay();
}
function keydown(e){
 if(!['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','KeyQ','KeyC','KeyR','KeyE','KeyG','KeyF','KeyT','KeyV','Tab','Enter','Escape'].includes(e.code))return;
 e.preventDefault();keys.add(e.code);unlock();
 if(e.repeat)return;
 if(e.code==='KeyE'||e.code==='Enter')interact();
 if(e.code==='Escape')closeConversation();
 if(e.code==='KeyG')toggleEquipment();
 if(e.code==='KeyF')toggleLight();
 if(e.code==='KeyT')toggleStrobe();
 if(e.code==='KeyV')cycleVision();
 if(e.code==='KeyQ'){run=!run;hud()}
 if(e.code==='KeyC'){crouch=!crouch;hud()}
 if(e.code==='Tab'){const a=document.getElementById('levelGuide');a.hidden=!a.hidden}
 if(e.code==='KeyR'&&spares&&rounds<8&&!reload&&!quest.dialogue){
  reload=1.05;playCue('mechanism',.18);hud();
 }
}
function init(){
 g=backdrop;
 backdrop.clearRect(0,0,W,H);
 shopMap();
 g=ctx;g.imageSmoothingEnabled=false;
 reset=shopReset;step=shopStep;render=shopRender;hud=shopHud;use=interact;
 window.onkeydown=keydown;
 document.getElementById('nextDialogue').onclick=continueConversation;
 document.getElementById('closeDialogue').onclick=closeConversation;
 document.getElementById('restart').onclick=shopReset;
 canvas.oncontextmenu=e=>e.preventDefault();
 const oldPointerDown=canvas.onpointerdown;
 canvas.onpointerdown=e=>{
  if(e.button===2){e.preventDefault();equipment.aiming=equipment.drawn;unlock();return;}
  if(e.button===0&&!equipment.drawn){canvas.onpointermove(e);unlock();return;}
  oldPointerDown(e);
 };
 canvas.addEventListener('pointerup',e=>{if(e.button===2)equipment.aiming=false});
 canvas.addEventListener('pointercancel',()=>{equipment.aiming=false});
 window.addEventListener('blur',()=>{equipment.aiming=false});
 shopReset();
 window.__homeMore2D=window.__goldenDragon2D={
   get status(){return {stage:quest.stage,level:floorName,player:{x:player.x,y:player.y},dialogue:!!quest.dialogue,props:props.length,blockers:blocks.length,people:people.length,doors:window.HomeMoreMap.doors.map(d=>({id:d.id,name:d.name,open:d.open})),equipment:{...equipment}}},
   interact,nearby:nearest,reset:shopReset,goUpstairs,goDownstairs
 };
}
init();
})();