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
function shopMap(){
 blocks.length=0;props.length=0;
 rect(0,0,W,H,'#29242f');
 // Level-one shopping mall concourse, following the source's 2D pixel style.
 rect(0,626,W,274,'#544b58');
 for(let x=0;x<W;x+=32)for(let y=627;y<H;y+=32){
  rect(x+1,y+1,30,30,(Math.floor(x/32)+Math.floor(y/32))%2?'#685f6b':'#776d79');
  rect(x+2,y+2,26,1,'#9e9091');
 }
 rect(0,648,W,7,'#3f3541');
 for(const x of [55,166,1210,1321]){
  rect(x-15,666,30,142,'#403543');
  rect(x-10,670,20,132,'#82767c');
  rect(x-15,670,30,6,'#d4b388');
  rect(x-15,798,30,7,'#c8ad83');
 }
 rect(517,774,366,35,'#39313e');
 label('LEVEL 1  ·  SANDTON MALL',538,797,'#ecd5b2',14);
 // Golden Dragon floor tiles, subtle grout and scuffs.
 rect(140,86,1102,541,'#b4a09c');
 for(let x=147;x<1235;x+=32)for(let y=92;y<624;y+=32){
  const n=random();
  rect(x+1,y+1,30,30,n<.29?'#a18f8d':n<.65?'#ab9996':'#b8a5a0');
  rect(x+3,y+3,24,1,'#d1bdb1');
  if(n>.94)rect(x+11,y+23,6,2,'#8c7b81');
 }
 // Three walled sides; rear doors, windows, and central open frontage.
 furnishing(122,71,1132,20,'#48333d','#cf9f6d');
 furnishing(122,71,20,570,'#514049','#c69c76');
 furnishing(1234,71,20,570,'#514049','#c69c76');
 furnishing(141,615,423,18,'#513741','#e2b77c');
 furnishing(810,615,444,18,'#513741','#e2b77c');
 rect(565,618,244,4,'#f6d4a5');
 for(let x=151;x<553;x+=36){rect(x,592,28,7,'#6b929b');rect(x+2,592,23,1,'#b4d1c9')}
 for(let x=820;x<1243;x+=36){rect(x,592,28,7,'#6b929b');rect(x+2,592,23,1,'#b4d1c9')}
 // Signboard and Chinese-shop identity.
 rect(463,99,458,47,'#5e2a39');rect(468,104,448,5,'#deb476');
 label('金 龍  ·  GOLDEN DRAGON',482,133,'#ffdf9e',18);
 rect(474,646,443,36,'#572b3c');rect(481,650,428,4,'#ddae71');
 label('GOLDEN DRAGON · CHINESE SHOP',503,673,'#f7d79d',15);
 label('OPEN  /  LEVEL 1',627,701,'#eee0ce',11);
 for(const x of [221,1124])lantern(x,129);
 for(const x of [256,466,666,866,1087])lamp(x,554);
 // Back-left storeroom and stock cartons.
 furnishing(158,173,280,15,'#57434c','#b99c85');
 furnishing(158,173,16,140,'#57434c','#b99c85');
 furnishing(422,173,16,140,'#57434c','#b99c85');
 rect(253,304,100,10,'#c3936b');
 label('STOCKROOM',257,293,'#5a3b42',11);
 for(let i=0;i<18;i++){
  const px=181+(i%6)*36,py=195+Math.floor(i/6)*31;
  rect(px,py,29,22,'#927253');rect(px+2,py+2,25,3,'#c4a281');
 }
 spot('Stockroom',298,342,57,'The stockroom is locked. Stacked cartons block the doorway.');
 // Repeated stock shelves: source-style, overhead canvas, not 3D proxies.
 shelf(298,242,60,206);shelf(460,242,60,206);
 shelf(622,242,60,206);shelf(784,242,60,206);
 ['Batteries','Torches','Imports','Porcelain'].forEach((name,i)=>{
  spot(name,281+i*162,475,65,[
   'Batteries and battery-operated gadgets sit in neat rows.',
   'Flashlights, lanterns and household torches.',
   'Small imported goods and tools, still on their shelves.',
   'Porcelain and ceramic homewares in padded boxes.'
  ][i]);
 });
 // Checkout counter, with space for Mr Chen behind the registers.
 furnishing(940,364,235,64,'#775148','#ddae7a');
 rect(949,371,215,9,'#3f3039');
 for(const px of [975,1080]){
  rect(px,381,36,27,'#29242b');
  rect(px+3,384,30,16,'#748a89');
  rect(px+4,404,28,3,'#c4b1a1');
 }
 label('CHECKOUT',1014,422,'#ffe3bd',11);
 spot('Checkout counter',1015,440,75,'The registers are offline. An emergency torch is still glowing.');
 // Front merchandising with a path to the stockroom and shop counter.
 furnishing(151,492,109,57,'#5f494c','#cc9e78');
 furnishing(1128,479,101,64,'#6c5350','#d6a47a');
 for(let i=0;i<5;i++)for(let k=0;k<2;k++){
  productBox(159+i*18,500+k*19,goods[(i+k)%6]);
  productBox(1137+i*17,486+k*18,goods[(i+k+3)%6]);
 }
 spot('Display windows',1108,565,68,'New imports are displayed facing the shopping-mall passage.');
 // Emergency lights outside the shop and a jammed front shutter.
 rect(575,732,230,11,'#4a383f');
 for(let i=0;i<12;i++)rect(582+i*19,736,12,2,'#b7997f');
 label('SHUTTER  /  POWER OUT',582,724,'#cdb4ae',11);
 spot('Entrance shutter',680,611,88,'The powered entrance shutter is jammed halfway. The concourse is accessible.');
 spot('Mall concourse',692,777,69,'Most shops are deserted; emergency lighting remains on.');
 for(let i=0;i<86;i++){
  const x=182+random()*1020,y=171+random()*391;
  rect(x,y,1+random()*2,1,random()>.5?'#a38a89':'#d0b6a6');
 }
}
const originalDrawFighter=drawFighter;
drawFighter=function(p,hero,fall){
 originalDrawFighter(p,hero,fall);
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
 if(weapon==='beretta'){rect(10,1,6,3,'#bc507d');rect(11,1,5,1,'#f097b6')}
};
castLooks.hero=Object.assign({},castLooks.hero,{
 coat:'#292531',edge:'#8d7166',shade:'#3c313b',boot:'#4b332d',
 trim:'#c9aa7a',skin:'#cc8766',hair:'#753e2e',shine:'#dd9e6e',
 head:'part',kit:'armour'
});
const chen={
 x:1090,y:328,a:-Math.PI/2,hp:1,motion:0,step:0,fall:0,
 role:'civilian',look:'chen',civilian:{
  skin:'#bb8b68',hair:'#322e35',coat:'#4b454b',light:'#988879',
  pants:'#31313c',shoes:'#26262f',cut:'longcoat',head:'part',item:'none'
 }
};
chen.civilian.frames=makeCivilianFrames(chen.civilian);
const clerk={
 x:231,y:566,a:0,hp:1,motion:0,step:0,fall:0,role:'civilian',
 civilian:{skin:'#a66b50',hair:'#3a2931',coat:'#436067',light:'#95a8a2',
 pants:'#393640',shoes:'#362931',cut:'vest',head:'part',item:'none'}
};
clerk.civilian.frames=makeCivilianFrames(clerk.civilian);
people.push(chen,clerk);
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
 if(near(player,chen)<158)return {name:'Mr. Chen',x:chen.x,y:chen.y,r:158};
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
  if(item.name==='Entrance shutter'&&quest.stage==='check_shutter'){
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
 g.fillText('C · GOLDEN DRAGON / L1',14,canvas.height-14);
}
function drawStoryActors(){
 for(const p of props){
  if(near(player,p)<125){
   g.save();g.globalAlpha=.20+.07*Math.sin(elapsed*5);
   circle(p.x,p.y,14,'#ffe2a7');g.restore();
   if(near(player,p)<p.r){rect(p.x-9,p.y-34,18,14,'#2d2430');label('E',p.x-3,p.y-23,'#ffe1b1',12)}
  }
 }
 for(const person of people){
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
 player={x:867,y:489,a:-Math.PI/2,hp:3,step:0,flash:0,look:'hero',motion:0,travel:-Math.PI/2};
 enemies=[];loot=[];particles=[];fx=[];prints=[];drop=null;
 run=crouch=held=press=confirm=false;keys.clear();
 quest.stage='find_chen';quest.dialogue=null;quest.index=0;
 quest.message='Speak to Mr. Chen by the checkout';quest.messageTime=5;
 quest.shutter=quest.seenChen=quest.finished=false;elapsed=0;
 document.getElementById('dialogue').hidden=true;
 camera();hud();
}
function shopHud(){
 document.querySelector('output').textContent='CHAPTER 1 · GOLDEN DRAGON · '+objective()+
  '  |  '+(reload?'RELOADING':rounds+' / '+spares+' SPARE')+
  '  ·  '+(run?'RUN':'WALK')+(crouch?' / CROUCH':'');
}
function shopStep(dt){
 effects(dt);
 elapsed+=dt;
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
 const target=Math.atan2(aim.y+view.y-player.y,aim.x+view.x-player.x);
 player.a+=Math.atan2(Math.sin(target-player.a),Math.cos(target-player.a))*Math.min(1,dt*16);
 if(reload){reload=Math.max(0,reload-dt);if(!reload){rounds=8;spares=Math.max(0,spares-1);hud()}}
 if(press&&!cool&&!reload&&rounds&&!quest.dialogue){
  rounds--;fire(player,true);cool=.21;hud();
 }
 press=false;
 for(const p of people){p.motion=0;p.step=0;p.flash=0;}
}
function shopRender(){
 g.save();g.translate(-Math.round(view.x),-Math.round(view.y));
 g.drawImage(floor,0,0);
 drawStoryActors();
 for(const c of fx){
  g.save();g.translate(c.x,c.y-c.z);g.rotate(c.a);
  if(c.kind==='brass')rect(0,0,3,1,'#e4bc70');
  else rect(0,0,3,5,'#3b3340');g.restore();
 }
 sprite(player,true);
 for(const p of particles)rect(p.x,p.y,2,2,p.type==='spark'?'#ffe5ab':'#b97580');
 g.restore();
 drawStoryHUD();
}
function keydown(e){
 if(!['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','KeyQ','KeyC','KeyR','KeyE','Tab','Enter','Escape'].includes(e.code))return;
 e.preventDefault();keys.add(e.code);unlock();
 if(e.repeat)return;
 if(e.code==='KeyE'||e.code==='Enter')interact();
 if(e.code==='Escape')closeConversation();
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
 shopReset();
 window.__goldenDragon2D={
   get status(){return {stage:quest.stage,player:{x:player.x,y:player.y},dialogue:!!quest.dialogue,props:props.length,blockers:blocks.length,people:people.length}},
   interact,nearby:nearest,reset:shopReset
 };
}
init();
})();