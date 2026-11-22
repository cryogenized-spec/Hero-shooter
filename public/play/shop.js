/* Hero Shooter / Home & More. A data-driven, non-combat store-opening scene.
   Tiled JSON in maps/home-and-more.tmj is the sole source of floor geometry. Short isiZulu barks are provisional and will be AI cross-checked. */
(function (root) {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const props = (o) => Object.fromEntries((o.properties || []).map(p => [p.name,p.value]));
  const clamp = (n,a,b) => Math.min(b,Math.max(a,n));
  const distance = (a,b) => Math.hypot(a.x-b.x,a.y-b.y);
  const palettes = {
    wall:['#3b4653','#1a2430'],
    shelf:['#59636c','#9da8b3'],
    furniture:['#5e6b5f','#b0b3a4'],
    till:['#455a66','#99b8bb'],
    'glass-counter':['#264a57','#8fbbc5'],
    counter:['#645b52','#9d8674'],
    display:['#596c68','#96b1a1'],
    trolley:['#4a595d','#a3afb4'],
    pallet:['#64513f','#b39a76'],
    sacks:['#89847a','#c7bdad'],
    desk:['#655a54','#a79781'],
    lift:['#45515d','#a6b7c6'],
    table:['#786454','#c2a68a'],
    chairs:['#52646a','#a2b4b7'],
    cabinet:['#4c6068','#8eabb3'],
    stairs:['#5c646c','#cbd1d4'],
    window:['#284f67','#80a9bb'],
    'pallet-jack':['#b8864b','#e9b566'],
    water:['#548895','#c1f3fb']
  };
  const chitChat = [
    'Yebo, ngiyabona.', 'Kulungile, ngiyeza.', 'Ake sibheke.',
    'Ubonile lokhu?', 'Hhayi bo!', 'Ngizobuya manje.',
    'Kanti uthini?', 'Kulungile, sisi.'
  ];
  let state = null;
  let joystick = {left:false,right:false,up:false,down:false};
  let frameNumber = 0;
  const SAVE_KEY='hero-shooter:home-and-more-save-v1';
  const roomNames={shop:'Sales floor',office:'Mrs. Chen’s office',owner:'Mr. Chen’s office',boardroom:'Boardroom',stairwell:'Mezzanine stairs'};
  const roomImages={};
  function roomImage(floor) {
    if (!roomImages[floor]) {
      const img=new Image(); img.src='./maps/chen-'+floor+'.svg'; roomImages[floor]=img;
    }
    return roomImages[floor];
  }
  const entrances={
    owner:['owner',970,795,-Math.PI/2],shopOwner:['shop',840,292,Math.PI/2],
    boardroom:['boardroom',408,621,0],officeBoard:['office',1130,621,Math.PI],
    lower:['stairwell',815,798,-Math.PI/2],upper:['stairwell',690,798,-Math.PI/2],
    shopStairs:['shop',2068,1450,Math.PI],office:['office',968,785,-Math.PI/2]
  };
  function enterRoom(destination) {
    const [floor,x,y,angle]=entrances[destination];
    state.floor=floor; Object.assign(state.player,{x,y,angle,walkBlend:0,walkAngle:angle});
    state.chosen=null;state.rotateIndex=0;
    if(floor==='office')state.visitedOffice=true;
    ensureClearPlayerPosition();setNotice(roomNames[floor]);saveProgress();
  }
  function drawStairs(ctx) {
    const upper=state.player.x<750;
    function flight(x,active) {
      ctx.fillStyle=active?'#554b46':'#242126';
      const length=active?398:54;
      ctx.fillRect(x,425,98,length);
      for(let y=431;y<425+length;y+=17){
        ctx.fillStyle=active?'#b19c82':'#363137';ctx.fillRect(x+3,y,92,3);
        ctx.fillStyle=active?'#39363a':'#201e23';ctx.fillRect(x+3,y+4,92,4);
      }
      ctx.fillStyle=active?'#bb9461':'#383035';ctx.fillRect(x,425,3,length);ctx.fillRect(x+95,425,3,length);
    }
    flight(766,!upper);flight(640,upper);
    ctx.fillStyle='#776756';ctx.fillRect(640,355,224,70);
    ctx.fillStyle='#bfaa88';ctx.fillRect(640,355,224,3);
  }
  function saveProgress() {
    if (!state || !state.loaded) return;
    const fields=['floor','assigned','envelopes','delivered','hasWater','waterOffered','visitedOffice','visitedStockroom','ownerReturned','elapsed'];
    const data=Object.fromEntries(fields.map(k=>[k,state[k]]));
    data.player={x:state.player.x,y:state.player.y,angle:state.player.angle};
    try { root.localStorage.setItem(SAVE_KEY,JSON.stringify(data)); } catch { /* Offline private mode. */ }
  }
  function restoreProgress() {
    const query=new URLSearchParams(root.location.search);
    if(query.get('fresh')==='1') {
      try { root.localStorage.removeItem(SAVE_KEY); } catch {}
      return;
    }
    if(query.get('resume')!=='1')return;
    try {
      const data=JSON.parse(root.localStorage.getItem(SAVE_KEY));
      if(!data || !Object.hasOwn(roomNames,data.floor) || !data.player)return;
      const entries=['assigned','envelopes','delivered','hasWater','waterOffered','visitedOffice','visitedStockroom','ownerReturned','elapsed'];
      for(const k of entries)if(data[k]!==undefined)state[k]=data[k];
      state.floor=data.floor;
      if(Number.isFinite(data.player.x)&&Number.isFinite(data.player.y)){
        state.player.x=data.player.x;state.player.y=data.player.y;
        if(Number.isFinite(data.player.angle))state.player.angle=data.player.angle;
      }
      setNotice(state.floor==='office'?'MEZZANINE OFFICE · CONTINUED':'SUNDAY · HOME & MORE · CONTINUED');
      setObjective(state.assigned && state.delivered.length<4?'Deliver the remaining sealed payslips.':'Explore the shop and speak with the Chen family.');
    } catch { /* Corrupted saves are ignored. */ }
  }

  function setNotice(message) {
    const el = $('shopNotice');
    if (el) el.textContent = message;
  }
  function setObjective(message) {
    const el = $('shopObjective');
    if (el) el.textContent = message;
  }
  function loadState(map) {
    if (!map || map.type !== 'map' || map.orientation !== 'orthogonal')
      throw new Error('Invalid Home & More map');
    const list = (name) => {
      const layer = map.layers.find(l => l.name === name);
      if (!layer || layer.type !== 'objectgroup') throw new Error('Missing map layer: '+name);
      return layer.objects.map(o => Object.assign({},o,{meta:props(o)}));
    };
    const geometry = {
      walls:list('Architecture'),fixtures:list('Fixtures'),zones:list('Zones'),
      points:list('Interactables'),actors:list('Actors'),lights:list('Lighting')
    };
    const mapSettings=props(map);
    const entryX=Number.isFinite(mapSettings.entryX)?mapSettings.entryX:1200;
    const entryY=Number.isFinite(mapSettings.entryY)?mapSettings.entryY:1610;
    const actors = geometry.actors.map(o => {
      const nodes = String(o.meta.route||'').split(';').filter(Boolean)
        .map(s=>s.split(',').map(Number)).filter(x=>x.length===2 && x.every(Number.isFinite));
      return Object.assign(o,{
        homeX:o.x,homeY:o.y,route:nodes,index:0,speech:'',speechTime:0,
        speechDelay:5+o.id%6,activity:o.type==='worker'?'packing':'idle',step:0,
        radius:14,angle:-Math.PI/2,walkAngle:-Math.PI/2,walkPhase:0,walkBlend:0,gait:'idle',woundedSpeedFactor:1
      });
    });
    return {
      map,geometry,actors,loaded:true,floor:'shop',
      player:{x:entryX,y:entryY,angle:-Math.PI/2,radius:15,walkAngle:-Math.PI/2,walkPhase:0,walkBlend:0,isSneaking:false,hasMolleVest:false,weaponVisible:false,flashlightOn:false},
      camera:{x:0,y:0},dialogue:false,chosen:null,rotateIndex:0,
      envelopes:[],assigned:false,delivered:[],hasWater:false,waterOffered:false,
      visitedOffice:false,visitedStockroom:false,elapsed:0,
      hint:'WASD to explore · E to talk · Tab to choose between nearby people'
    };
  }

  async function start() {
    root.document.body.classList.add('shop-mode');
    $('shopLayer').hidden=false;
    $('shopConversation').hidden=true;
    setNotice('SUNDAY · 06:55 · STAFF PREPARING STOCK');
    setObjective('Get acquainted with the shop. Speak with Wei Chen or visit the upstairs office.');
    state={loaded:false,error:null,elapsed:0};
    const epoch=++frameNumber;
    try {
      const response=await fetch('./maps/home-and-more.tmj',{cache:'no-cache'});
      if (!response.ok) throw new Error('HTTP '+response.status);
      const map=await response.json();
      if(epoch!==frameNumber) return;
      state=loadState(map);
      restoreProgress();
      // Existing saves can be inside shelving after a map revision. Never trap C.
      if (ensureClearPlayerPosition()) saveProgress();
    } catch (error) {
      if(epoch===frameNumber) {
        state={loaded:false,error:error.message};
        setNotice('Could not load the shop map: '+error.message);
      }
    }
  }
  function stop() {
    saveProgress();
    frameNumber++;
    state=null;
    root.document.body.classList.remove('shop-mode');
    if ($('shopLayer')) $('shopLayer').hidden=true;
    if ($('shopConversation')) $('shopConversation').hidden=true;
    Object.keys(joystick).forEach(k=>joystick[k]=false);
  }

  function floorObjects(list) {
    return list.filter(o=>o.meta.floor===(state&&state.floor));
  }
  function collisionAt(x,y) {
    if(state.floor==='stairwell')return !(x>=655&&x<=849&&y>=370&&y<=813&&(y<=410||x<=723||x>=781));
    const r=15;
    const walls=floorObjects(state.geometry.walls);
    const solidTypes=new Set(['shelf','till','glass-counter','counter','display','pallet','sacks','furniture',
      'desk','lift','table','chairs','cabinet','trolley','pallet-jack']);
    const blockers=walls.concat(floorObjects(state.geometry.fixtures).filter(o=>solidTypes.has(o.type)));
    for(const o of blockers) {
      const nearX=clamp(x,o.x,o.x+o.width),nearY=clamp(y,o.y,o.y+o.height);
      if ((x-nearX)**2+(y-nearY)**2<r*r) return true;
    }
    // Indoors: keep actors inside the intended playable store or upstairs office.
    if(state.floor==='shop') return x<285||x>2300||y<225||y>1709;
    return x<365||x>1190||y<287||y>842;
  }

  function ensureClearPlayerPosition() {
    if (!state || !state.loaded || !collisionAt(state.player.x,state.player.y)) return false;
    const originX=state.player.x,originY=state.player.y;
    // Search expanding rings for the nearest walkable centre. This is a
    // recovery path for old saves and map changes, not normal collision movement.
    for (let radius=8;radius<=320;radius+=8) {
      for (let n=0;n<32;n++) {
        const angle=(Math.PI*2*n)/32;
        const x=originX+Math.cos(angle)*radius;
        const y=originY+Math.sin(angle)*radius;
        if (!collisionAt(x,y)) {
          state.player.x=x;
          state.player.y=y;
          console.warn('[Home & More] Moved C to a clear position after an obstructed spawn.',
            {from:[originX,originY],to:[x,y]});
          return true;
        }
      }
    }
    // A completely invalid map should not leave the player permanently stuck.
    throw new Error('No walkable space was found near C’s starting position');
  }

  function movePlayer(dt,input) {
    let x=0,y=0;
    if(input && input.leftStick && input.leftStick.active) {
      x=input.leftStick.dx;
      y=input.leftStick.dy;
    } else {
      const keys=input&&input.keys||{};
      if(keys.KeyA||keys.ArrowLeft||joystick.left)x--;
      if(keys.KeyD||keys.ArrowRight||joystick.right)x++;
      if(keys.KeyW||keys.ArrowUp||joystick.up)y--;
      if(keys.KeyS||keys.ArrowDown||joystick.down)y++;
    }
    state.player.gait='idle';
    const beforeX=state.player.x,beforeY=state.player.y;
    const mag=Math.hypot(x,y);
    if(mag<0.01) {
      root.HeroSprites.updateWalk(state.player,beforeX,beforeY,dt,88,18);
      return;
    }
    x/=mag;y/=mag;
    const delta=Math.atan2(y,x)-state.player.angle;
    const turn=Math.atan2(Math.sin(delta),Math.cos(delta))*(1-Math.exp(-16*dt));
    state.player.angle+=clamp(turn,-9*dt,9*dt);
    const k=(input&&input.keys&&(input.keys.ShiftLeft||input.keys.ShiftRight))?1.36:1;
    const speed=250*k*dt;
    const nx=state.player.x+x*speed,ny=state.player.y+y*speed;
    if(!collisionAt(nx,state.player.y))state.player.x=nx;
    if(!collisionAt(state.player.x,ny))state.player.y=ny;
    if(Math.hypot(state.player.x-beforeX,state.player.y-beforeY)>0.01) state.player.gait=k>1?'run':'walk';
    root.HeroSprites.updateWalk(state.player,beforeX,beforeY,dt,k>1?102:78,speed);
  }

  function animateActors(dt) {
    for(const a of state.actors) {
      if(a.type==='family-father' && state.ownerReturned && a.meta.floor==='shop'){a.meta.floor='owner';a.x=704;a.y=429;}
      if(a.meta.floor!==state.floor)continue;
      const beforeX=a.x,beforeY=a.y;
      if(a.route.length && a.type==='worker') {
        const goal=a.route[a.index % a.route.length];
        let dx=goal[0]-a.x,dy=goal[1]-a.y;
        const d=Math.hypot(dx,dy);
        if(d<4) a.index=(a.index+1)%a.route.length;
        else { const dist=Math.min(d,dt*(a.meta.pair==='receiving'?22:30));
          a.x+=dx/d*dist;a.y+=dy/d*dist;a.step+=dt*9;
          a.angle=Math.atan2(dy,dx); }
      }
      // Derive gait from displacement rather than the slowly decaying walkBlend.
      a.gait=Math.hypot(a.x-beforeX,a.y-beforeY)>0.01?'walk':'idle';
      root.HeroSprites.updateWalk(a,beforeX,beforeY,dt,110,40*dt);
      a.speechDelay-=dt;
      if(a.speechTime>0)a.speechTime-=dt;
      if(a.speechDelay<=0 && a.type==='worker' && !state.dialogue) {
        a.speech=chitChat[(a.id+Math.floor(state.elapsed/8))%chitChat.length];
        a.speechTime=2.4;
        a.speechDelay=9+a.id%7;
      }
    }
  }

  function focusOptions() {
    if(!state||!state.loaded)return [];
    const arr=floorObjects(state.geometry.points).concat(state.actors.filter(a=>a.meta.floor===state.floor));
    const within=arr.filter(o=>distance(state.player,o)<95).sort((a,b)=>{
      const da=distance(state.player,a),db=distance(state.player,b);
      const angleA=Math.atan2(a.y-state.player.y,a.x-state.player.x);
      const angleB=Math.atan2(b.y-state.player.y,b.x-state.player.x);
      const faceA=Math.cos(angleA-state.player.angle);
      const faceB=Math.cos(angleB-state.player.angle);
      return (da-faceA*18)-(db-faceB*18);
    });
    return within;
  }
  function target() {
    const options=focusOptions();
    if(!options.length)return null;
    if(state.chosen && options.some(o=>o.id===state.chosen)) return options.find(o=>o.id===state.chosen);
    state.chosen=options[0].id;
    return options[0];
  }
  function cycleTarget() {
    if(!state||!state.loaded||state.dialogue)return;
    const list=focusOptions();if(list.length<2)return;
    const i=list.findIndex(o=>o.id===state.chosen);
    state.chosen=list[(i+1)%list.length].id;
  }

  function showDialogue(name,line,choices) {
    state.dialogue=true;
    $('shopConversation').hidden=false;
    $('shopSpeaker').textContent=name;
    $('shopDialogue').textContent=line;
    const portrait=$('shopNPCPortrait');
    const monologue=name==='C';
    $('shopConversation').classList.toggle('is-monologue',monologue);
    portrait.hidden=monologue;
    if(!monologue){
      const portraits={
        'Mr. Chen':'../assets/portraits/chen-family/mr-chen-portrait-4x5.png',
        'Mrs. Chen':'../assets/portraits/chen-family/mrs-chen-portrait-4x5.png',
        'Wei Chen':'../assets/portraits/chen-family/wei-portrait-4x5.png'
      };
      const initials=name.split(/\s+/).map(w=>w[0]).slice(0,2).join('');
      portrait.textContent=initials;
      if(portraits[name]){
        const image=document.createElement('img');
        image.src=portraits[name];
        image.alt='';
        image.decoding='async';
        image.onerror=()=>{if(portrait.firstChild===image)portrait.textContent=initials;};
        portrait.replaceChildren(image);
      }
    }
    $('shopChoices').replaceChildren();
    const choicesToShow=choices&&choices.length?choices:[['All right.',closeDialogue]];
    for(const [label,callback] of choicesToShow) {
      const b=document.createElement('button');
      b.type='button';
      b.textContent=label;
      b.addEventListener('click',callback);
      $('shopChoices').appendChild(b);
    }
  }
  function closeDialogue() {
    if(!state)return;
    state.dialogue=false;
    $('shopConversation').hidden=true;
    saveProgress();
  }
  function addWater() {
    state.hasWater=true;
    showDialogue('C','A paper cup of water. I can take this up to Mrs. Chen.',[['Carry it',closeDialogue]]);
  }
  function acceptPayslips() {
    state.assigned=true;
    state.envelopes=['Sibusiso Mkhize','Thandeka Dlamini','Bongani Cele','Mandla Khumalo'];
    setObjective('Optional: give each of the four volunteers the correctly named sealed envelope.');
    showDialogue('Mrs. Chen','Thank you. Their names are written on the front. Keep the envelopes sealed.',[['I will see to it.',closeDialogue]]);
  }
  function offerWater() {
    state.hasWater=false;state.waterOffered=true;
    showDialogue('Mrs. Chen','Thank you, dear. Put it here beside the keyboard. It has been a long morning.',[['You are welcome.',closeDialogue]]);
  }
  function talkMother() {
    state.visitedOffice=true;
    const choices=[];
    if(!state.assigned)choices.push(['Is there anything I can help with?',acceptPayslips]);
    if(state.hasWater&&!state.waterOffered)choices.push(['I brought you a cup of water.',offerWater]);
    choices.push(['I will leave you to it.',closeDialogue]);
    showDialogue('Mrs. Chen',
      state.waterOffered?'I appreciate the water. I am just finishing these payments.'
       :'Hello, C. I am finishing the payroll while the others move the stock. Did Wei send you?',
      choices);
  }
  function handPayslip(worker) {
    if(!state.assigned) {
      showDialogue(worker.name,'Morning, C. We are trying to get the stock together before the driver arrives.',[['Thanks. Carry on.',closeDialogue]]);
      return;
    }
    if(state.delivered.includes(worker.name)) {
      showDialogue(worker.name,'Thank you again for bringing that envelope.',[['No problem.',closeDialogue]]);
      return;
    }
    const choices=state.envelopes.filter(n=>!state.delivered.includes(n)).map(n=>[
      'Envelope: '+n,()=> {
        if(n!==worker.name) {
          showDialogue(worker.name,'That is not my name. Mine is '+worker.name+'.',[['Check the names again.',()=>handPayslip(worker)]]);
          return;
        }
        state.delivered.push(n);
        if(state.delivered.length===4)setObjective('All four payslips delivered. Walk around, or talk to Wei Chen.');
        showDialogue(worker.name,'Thank you, C. Please thank Mrs. Chen for me.',[['Take care.',closeDialogue]]);
      }
    ]);
    choices.push(['Not right now.',closeDialogue]);
    showDialogue(worker.name,'My name is '+worker.name+'. Mrs. Chen said there may be a payslip for me.',choices);
  }
  function talkActor(actor) {
    if(actor.name==='Mrs. Chen')return talkMother();
    if(actor.type==='worker')return handPayslip(actor);
    if(actor.type==='family-son' && state.delivered.length===4 && !state.ownerReturned) {
      return showDialogue('Wei Chen','Dad just called. People are coming through the mall doors. He’s going to his office. I’ll keep my phone on me.',[['Understood.',()=>{state.ownerReturned=true;saveProgress();closeDialogue();}]]);
    }
    if(actor.type==='family-father' && state.ownerReturned)return showDialogue('Mr. Chen','Close the door behind you, C. I need the company papers from the safe.',[['All right.',closeDialogue]]);
    if(actor.type==='family-son')return showDialogue('Wei Chen',
      'I’m checking the purchase orders on my phone. I choose what we carry. Mum deals with the manufacturers in China, tracks deliveries and balances the books.',
      [['Is the delivery truck here?',()=>showDialogue('Wei Chen','It came early. The people downstairs are moving what they can. We may stop if things get worse.',[['Understood.',closeDialogue]])],
       ['I will check on your mother.',()=>showDialogue('Wei Chen','She is upstairs in the office, above the tills. You can use the U-turn staircase near the front.',[['I know the way.',closeDialogue]])],
       ['Carry on.',closeDialogue]]);
    if(actor.type==='family-father')return showDialogue('Mr. Chen',
      'Good morning, C. I am talking to the other shopkeepers. We will decide soon. No point taking chances.',
      [['Are the staff all right?',()=>showDialogue('Mr. Chen','They volunteered to help today. I will not keep them here if it becomes unsafe.',[['Of course.',closeDialogue]])],
       ['I will check on them.',closeDialogue]]);
  }

  function doInteraction() {
    if(!state||!state.loaded)return;
    if(state.dialogue){closeDialogue();return;}
    const o=target();if(!o)return;
    if(o.type==='worker'||o.type==='family-son'||o.type==='family-father'||o.type==='family-mother'){
      talkActor(o);return;
    }
    switch(o.type) {
      case 'stairs':enterRoom(state.floor==='shop'?'lower':'upper');break;
      case 'office-door':enterRoom(o.meta.destination);break;
      case 'water':addWater();break;
      case 'payslips':
        showDialogue('C','Four sealed pay envelopes are sitting on the desk. Mrs. Chen is still working.',
          [['Speak to Mrs. Chen',()=>talkMother()],['Leave them alone',closeDialogue]]);
        break;
      case 'cup':
        showDialogue('C',state.waterOffered?'The cup is beside Mrs. Chen\'s keyboard.':'A clear space beside the paperwork.',[['All right.',closeDialogue]]);
        break;
      case 'door':state.visitedStockroom=true;
        showDialogue('C',o.name==='canteen door'?'The staff canteen. Somebody left a chair pulled out.':'Beyond the doorway are wrapped pallets, loose cartons and stock awaiting the lift.',[['Continue',closeDialogue]]);break;
      case 'sign':showDialogue('C','HOME & MORE. Tracked folding entrance doors, with a separate motorised steel shutter outside. The mall is still quiet.',[['Continue',closeDialogue]]);break;
      default:break;
    }
  }

  function drawLabel(ctx,str,x,y,scale=1) {
    // Developer map legends do not belong on the shop floor during gameplay.
    if(root.HERO_DEBUG_MAP_LABELS!==true)return;
    ctx.save();ctx.font='bold '+Math.round(13*scale)+'px ui-monospace,monospace';
    ctx.textAlign='center';ctx.fillStyle='rgba(238,244,240,0.8)';
    ctx.fillText(str,x,y);ctx.restore();
  }
  function drawFixture(ctx,o) {
    const pair=palettes[o.type]||['#50606a','#91a4ab'];
    ctx.save();
    ctx.shadowColor='rgba(0,0,0,.45)';ctx.shadowBlur=9;ctx.shadowOffsetY=4;
    ctx.fillStyle=pair[0];ctx.fillRect(o.x,o.y,o.width,o.height);
    ctx.shadowBlur=0;ctx.shadowOffsetY=0;
    ctx.strokeStyle=pair[1];ctx.lineWidth=2;ctx.strokeRect(o.x+1,o.y+1,o.width-2,o.height-2);
    if(o.type==='shelf') {
      const vertical=o.height>o.width;
      for(let i=0;i<8;i++) {
        ctx.fillStyle=['#a2a0a1','#d6b881','#9aa9af','#adb491','#c1a4a8'][i%5];
        if(vertical)ctx.fillRect(o.x+7,o.y+12+i*(o.height-20)/8,o.width-14,9);
        else ctx.fillRect(o.x+8+i*(o.width-16)/8,o.y+8,(o.width-16)/10,o.height-16);
      }
    } else if(['pallet','sacks','furniture','display','glass-counter'].includes(o.type)){
      for(let i=0;i<6;i++){
        const w=Math.max(11,(o.width-22)/6);
        ctx.fillStyle=pair[1];ctx.globalAlpha=0.45+(i%2)*0.15;
        ctx.fillRect(o.x+8+i*w,o.y+8,w-6,Math.max(8,o.height-16));
      }ctx.globalAlpha=1;
    } else if(o.type==='stairs'){
      for(let j=0;j<8;j++){ctx.strokeStyle='#d9d7d0';ctx.beginPath();ctx.moveTo(o.x+8,o.y+10+j*(o.height-20)/8);ctx.lineTo(o.x+o.width-8,o.y+10+j*(o.height-20)/8);ctx.stroke()}
    } else if(o.type==='till'){drawLabel(ctx,'TILL',o.x+o.width/2,o.y+o.height/2+4,.9)}
    else if(o.type==='lift'){drawLabel(ctx,'FREIGHT',o.x+o.width/2,o.y+o.height/2-5,.9);drawLabel(ctx,'LIFT',o.x+o.width/2,o.y+o.height/2+18,.9)}
    else if(o.type==='water'){drawLabel(ctx,'H₂O',o.x+o.width/2,o.y+o.height/2+5,.8)}
    else if(o.type==='folding-door'){
      ctx.fillStyle='rgba(118,190,214,.25)';ctx.fillRect(o.x,o.y,o.width,o.height);
      for(let x=o.x;x<o.x+o.width;x+=34){ctx.strokeStyle='#b6c3c6';ctx.beginPath();ctx.moveTo(x,o.y);ctx.lineTo(x+24,o.y+o.height);ctx.stroke()}
    } else if(o.type==='shutter-track'){
      ctx.fillStyle='rgba(177,192,199,.55)';ctx.fillRect(o.x,o.y,o.width,o.height);
    }
    ctx.restore();
  }
  function drawActor(ctx,a) {
    // Codex's original procedural body/leg silhouettes, not placeholder circles.
    const looks=a.meta.sprite || (a.type==='worker' ? (a.name==='Thandeka Dlamini'?'cashier':'assistant') : a.type);
    const prop=a.type==='worker' && a.meta.pair==='receiving' ? 'crate' : 'none';
    root.HeroSprites.drawNpc(ctx,a,looks,prop);
    ctx.save();ctx.font='bold 11px system-ui';ctx.textAlign='center';
    if(root.HERO_DEBUG_MAP_LABELS===true){
      ctx.fillStyle='#f4f5ec';ctx.fillText(a.name,a.x,a.y-29);
    }
    if(a.speechTime>0&&a.speech){
      ctx.font='12px system-ui';const w=ctx.measureText(a.speech).width+16;
      ctx.fillStyle='#dce5d9';ctx.fillRect(a.x-w/2,a.y-68,w,23);
      ctx.fillStyle='#20373c';ctx.fillText(a.speech,a.x,a.y-51);
    }
    ctx.restore();
  }
  function drawScene(ctx,w,h) {
    if(!state)return;
    ctx.save();ctx.setTransform(1,0,0,1,0,0);ctx.fillStyle='#0a111a';ctx.fillRect(0,0,w,h);
    if(!state.loaded){
      ctx.textAlign='center';ctx.font='18px system-ui';ctx.fillStyle='#e8d9bd';
      ctx.fillText(state.error||'Loading Home & More…',w/2,h/2);ctx.restore();return;
    }
    const zoom=clamp(Math.min(w/980,h/620),.68,1.0);
    const cx=state.player.x,cy=state.player.y;
    state.camera={x:cx-w/(2*zoom),y:cy-h/(2*zoom),zoom};
    ctx.scale(zoom,zoom);ctx.translate(-state.camera.x,-state.camera.y);
    const floor=state.floor;
    if(floor==='stairwell'){
      ctx.fillStyle='#060608';ctx.fillRect(state.camera.x,state.camera.y,w/zoom,h/zoom);
      drawStairs(ctx);
    }
    const bounds=floor==='shop'?{x:250,y:180,w:2090,h:1500}:{x:330,y:250,w:900,h:640};
    if(floor!=='stairwell'){
    ctx.fillStyle=floor==='shop'?'#383f42':'#3a3736';ctx.fillRect(bounds.x,bounds.y,bounds.w,bounds.h);
    ctx.strokeStyle='rgba(217,220,211,.075)';ctx.lineWidth=1;
    for(let x=bounds.x;x<bounds.x+bounds.w;x+=40){ctx.beginPath();ctx.moveTo(x,bounds.y);ctx.lineTo(x,bounds.y+bounds.h);ctx.stroke()}
    for(let y=bounds.y;y<bounds.y+bounds.h;y+=40){ctx.beginPath();ctx.moveTo(bounds.x,y);ctx.lineTo(bounds.x+bounds.w,y);ctx.stroke()}
    if(floor==='shop'){
      ctx.fillStyle='#43484a';ctx.fillRect(250,1710,2090,210);
      if(root.HERO_DEBUG_MAP_LABELS===true){
        ctx.fillStyle='#e8c48b';ctx.font='bold 38px system-ui';ctx.textAlign='center';ctx.fillText('HOME & MORE',1187,1620);
        ctx.font='12px ui-monospace';ctx.fillStyle='#e6ddd1';ctx.fillText('HOUSEHOLD · LIGHTS · TOOLS · GENERAL GOODS',1187,1642);
      }
    } else {
      ctx.fillStyle='#2a4d5a';ctx.fillRect(470,250,520,18);
      ctx.strokeStyle='#afc1c2';for(let x=480;x<990;x+=18){ctx.beginPath();ctx.moveTo(x,251);ctx.lineTo(x,267);ctx.stroke()}
      drawLabel(ctx,'WINDOWS & BLINDS · SALES FLOOR BELOW',745,330,.95);
    }
    for(const o of floorObjects(state.geometry.fixtures))drawFixture(ctx,o);
    for(const o of floorObjects(state.geometry.walls)) {
      ctx.fillStyle='#1b2631';ctx.fillRect(o.x,o.y,o.width,o.height);
      ctx.strokeStyle='#74808b';ctx.lineWidth=2;ctx.strokeRect(o.x,o.y,o.width,o.height);
    }
    // Subtle incomplete LED lighting: a cached/cheap overlay would eventually replace this.
    ctx.fillStyle='rgba(3,8,15,0.33)';ctx.fillRect(bounds.x,bounds.y,bounds.w,bounds.h);
    for(const l of floorObjects(state.geometry.lights)) {
      const x=l.x+l.width/2,y=l.y+l.height/2,r=235;
      const g=ctx.createRadialGradient(x,y,12,x,y,r);
      g.addColorStop(0,'rgba(235,245,216,'+((l.meta.power||.7)*.18)+')');
      g.addColorStop(1,'rgba(235,245,216,0)');
      ctx.fillStyle=g;ctx.fillRect(x-r,y-r,r*2,r*2);
      ctx.strokeStyle='rgba(240,247,234,.75)';ctx.lineWidth=5;
      ctx.beginPath();ctx.moveTo(l.x,l.y);ctx.lineTo(l.x+l.width,l.y);ctx.stroke();
    }
    if(floor!=='shop'){
      const art=roomImage(floor);
      if(art.complete && art.naturalWidth)ctx.drawImage(art,330,250,900,640);
    } else {
      drawLabel(ctx,'OWNER’S OFFICE',848,242,.8);
    }
    }
    for(const a of state.actors)if(a.meta.floor===floor)drawActor(ctx,a);
    // C uses the authentic procedural olive-flannel figure from Codex PR #8.
    // She keeps her compact pistol concealed during the peaceful opening.
    const p=state.player;
    root.HeroSprites.drawC(ctx,p);
    drawLabel(ctx,'C',p.x,p.y-29);
    const current=target();
    if(current&&!state.dialogue){
      ctx.strokeStyle='#f6da81';ctx.lineWidth=2;ctx.beginPath();ctx.arc(current.x+7,current.y+7,27,0,Math.PI*2);ctx.stroke();
      ctx.fillStyle='#efd48d';ctx.fillRect(current.x-7,current.y-45,30,24);
      ctx.font='bold 15px system-ui';ctx.fillStyle='#222a2c';ctx.textAlign='center';ctx.fillText('E',current.x+8,current.y-27);
    }
    if(floor==='shop'){
      drawLabel(ctx,'STOCKHOLDING',1700,606,1.1);
      drawLabel(ctx,'CANTEEN',515,578,.9);
      drawLabel(ctx,'10 AISLES · CROSS-PASSAGES',1300,760,1);
      drawLabel(ctx,'TILLS & FRONT COUNTER',1850,1440,.9);
      drawLabel(ctx,'UP TO OFFICE',2180,1270,.8);
    }
    ctx.restore();
    if($('shopPrompt'))$('shopPrompt').textContent=current&&!state.dialogue?'[E] '+current.name+'  ·  [TAB] switch':'';
    if($('shopFloor'))$('shopFloor').textContent=roomNames[floor];
  }
  function frame(dt,context) {
    if(!state)return;
    if(state.loaded){
      if(!state.dialogue) {
        movePlayer(dt,context.input);
        state.elapsed+=dt;
        animateActors(dt);
        if(Math.floor(state.elapsed/3)!==Math.floor((state.elapsed-dt)/3))saveProgress();
      }
    }
    drawScene(context.ctx,context.width,context.height);
  }
  function keydown(code) {
    if(!state||!state.loaded)return;
    if(code==='Escape'){if(state.dialogue)closeDialogue();return;}
    if(state.dialogue)return;
    if(code==='KeyE'||code==='Enter')doInteraction();
    if(code==='Tab')cycleTarget();
  }
  root.HeroShop={start,stop,frame,keydown,interact:doInteraction,cycleTarget};
  root.addEventListener('DOMContentLoaded',()=>{
    const action=$('shopMobileAction');
    if(action)action.addEventListener('click',()=>doInteraction());
    const cycle=$('shopMobileCycle');
    if(cycle)cycle.addEventListener('click',()=>cycleTarget());
    const controls={shopUp:'up',shopDown:'down',shopLeft:'left',shopRight:'right'};
    for(const [id,direction] of Object.entries(controls)) {
      const b=$(id);if(!b)continue;
      b.addEventListener('pointerdown',e=>{e.preventDefault();joystick[direction]=true;b.setPointerCapture(e.pointerId)});
      for(const ev of ['pointerup','pointercancel','lostpointercapture'])b.addEventListener(ev,()=>joystick[direction]=false);
    }
  });
})(window);
