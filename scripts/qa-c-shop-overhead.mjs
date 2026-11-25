import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const browser=await chromium.launch({headless:true,
 args:['--no-sandbox','--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--disable-gpu-sandbox']});
const output='c-shop-screenshots';
await mkdir(output,{recursive:true});
const checks=[];
try{
 const page=await browser.newPage({viewport:{width:1400,height:960},deviceScaleFactor:1});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 const res=await page.goto('http://127.0.0.1:8732/c-shop/',{waitUntil:'domcontentloaded',timeout:50000});
 assert.equal(res.status(),200);
 await page.waitForFunction(()=>Boolean(window.__homeMore2D),null,{timeout:25000});
 const get=()=>page.evaluate(()=>window.__homeMore2D.status);
 const initial=await get();
 assert.equal(initial.stage,'find_chen');
 assert.equal(initial.level,'retail');
 assert.equal(initial.people,3);
 assert.ok(initial.props>=20,'not enough real Home & More areas');
 assert.ok(initial.blockers>=35,'approved aisles/walls not collidable');
 assert.ok(initial.doors.length>=7,'distinct rooms or doors not modelled');
 assert.equal(initial.equipment.drawn,false,'C must start holstered');
 checks.push({test:'boot',data:initial});
 await page.screenshot({path:output+'/home_more_shop_overhead.png',animations:'disabled'});
 // Real keyboard movement through the exact original Pine Ridge engine.
 await page.keyboard.down('d');await page.waitForTimeout(430);await page.keyboard.up('d');
 const afterMove=await get();
 assert.ok(afterMove.player.x>initial.player.x+8,
  'C did not move with WASD in approved shop topology '+JSON.stringify(afterMove.player));
 checks.push({test:'movement',data:afterMove.player});
 // Holstered by default: toggles are intentionally independent.
 await page.keyboard.press('f');assert.equal((await get()).equipment.light,false);
 await page.keyboard.press('g');assert.equal((await get()).equipment.drawn,true);
 await page.keyboard.press('f');assert.equal((await get()).equipment.light,true);
 await page.keyboard.press('t');assert.equal((await get()).equipment.strobe,true);
 await page.keyboard.press('v');assert.equal((await get()).equipment.vision,'nvg');
 // Cosmetic aiming line appears only while RMB is held with weapon drawn.
 const rect=await page.locator('canvas').boundingBox();
 await page.mouse.move(rect.x+rect.width*.63,rect.y+rect.height*.52);
 await page.mouse.down({button:'right'});
 assert.equal((await get()).equipment.aiming,true);
 // The guide must start from the visible pistol tip, not C's face/centre.
 const guideOffset=()=>page.evaluate(()=>{
  const origin=window.__homeMore2D.aimGuideOrigin();
  const dx=origin.x-player.x,dy=origin.y-player.y;
  const c=Math.cos(player.a),s=Math.sin(player.a);
  return {forward:dx*c+dy*s,side:-dx*s+dy*c};
 });
 const standingGuide=await guideOffset();
 assert.ok(Math.abs(standingGuide.forward-17)<.2,'Standing guide is not at pistol muzzle');
 assert.ok(Math.abs(standingGuide.side-3)<.2,'Standing guide has incorrect pistol-side offset');
 await page.screenshot({path:output+'/home_more_cosmetic_aim_light.png'});
 await page.keyboard.press('c');
 const crouchingGuide=await guideOffset();
 assert.ok(Math.abs(crouchingGuide.forward-14.62)<.2,'Crouch guide is not aligned with scaled pistol');
 assert.ok(Math.abs(crouchingGuide.side-2.7)<.2,'Crouch guide side offset is not scaled');
 await page.keyboard.press('c');
 checks.push({test:'cosmetic_barrel_anchor',data:{standingGuide,crouchingGuide}});
 await page.mouse.up({button:'right'});
 assert.equal((await get()).equipment.aiming,false);
 await page.keyboard.press('g');
 const holstered=await get();
 assert.equal(holstered.equipment.drawn,false);
 assert.equal(holstered.equipment.light,false);
 assert.equal(holstered.equipment.strobe,false);
 checks.push({test:'equipment_state',data:holstered.equipment});
 // Distinct physical doors: staff access, L1 office, both toilets, staff room.
 const doors=[
  ['staffAccess',322,445],['office',252,579],
  ['toilet1',251,686],['toilet2',250,725],
  ['staffRoom',252,806],['receiving',253,334],['stairs',251,438]
 ];
 for(const [id,x,y] of doors){
  await page.evaluate(([px,py])=>{player.x=px;player.y=py;window.__homeMore2D.interact()},[x,y]);
  const entry=(await get()).doors.find(d=>d.id===id);
  assert.equal(entry?.open,true,'Door not independently operable: '+id);
 }
 checks.push({test:'seven_distinct_doors',ids:doors.map(x=>x[0])});

 // Check that all six L1 destination areas connect through *walkable* space,
 // not merely through decorative drawing or teleport-only interaction tests.
 const connectivity=await page.evaluate(()=>{
  const spacing=8,width=Math.ceil(W/spacing),height=Math.ceil(H/spacing);
  const start=[835,835],targets={
   receiving:[118,247],office:[113,584],wc1:[116,688],
   wc2:[116,727],staffRoom:[145,831],stairRoom:[122,449]
  };
  const index=(x,y)=>Math.round(y/spacing)*width+Math.round(x/spacing);
  const visited=new Uint8Array(width*height);
  const sx=Math.round(start[0]/spacing),sy=Math.round(start[1]/spacing);
  const stack=[sy*width+sx];visited[stack[0]]=1;
  for(let pos=0;pos<stack.length;pos++){
   const n=stack[pos],x=n%width,y=Math.floor(n/width);
   for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
    const nx=x+dx,ny=y+dy,ni=ny*width+nx;
    if(nx<1||ny<1||nx>=width-1||ny>=height-1||visited[ni])continue;
    if(solid(nx*spacing,ny*spacing,7))continue;
    visited[ni]=1;stack.push(ni);
   }
  }
  return {reachable:Object.fromEntries(Object.entries(targets)
   .map(([name,[x,y]])=>[name,Boolean(visited[index(x,y)])])),
   visited:stack.length};
 });
 assert.ok(Object.values(connectivity.reachable).every(Boolean),
   'Room circulation broken: '+JSON.stringify(connectivity));
 checks.push({test:'architectural_circulation',data:connectivity});
 // Capture a full-resolution topological overview, including the door leaves.
 const full=await page.evaluate(()=>{
  const previous=g;g=floor.getContext('2d');window.HomeMoreMap.paint({rect,label});
  g=previous;return floor.toDataURL('image/png').split(',')[1];
 });
 await writeFile(output+'/home_more_entire_l1_floorplan.png',Buffer.from(full,'base64'));

 // Visit the separate upstairs room: not Mrs Chen's office.
 await page.evaluate(()=>{player.x=123;player.y=448;window.__homeMore2D.interact()});
 assert.equal((await get()).level,'upper');
 await page.screenshot({path:output+'/home_more_upstairs_family_room.png'});
 await page.evaluate(()=>{player.x=820;player.y=831;window.__homeMore2D.interact()});
 assert.equal((await get()).level,'retail');
 // Mr Chen, storefront, return chapter objective.
 await page.evaluate(()=>{player.x=1230;player.y=837;window.__homeMore2D.interact()});
 let current=await get();
 assert.equal(current.stage,'check_shutter');
 assert.equal(current.dialogue,true);
 await page.screenshot({path:output+'/home_more_chen_conversation.png'});
 for(let i=0;i<5;i++)await page.click('#nextDialogue');
 assert.equal((await get()).dialogue,false);
 await page.evaluate(()=>{player.x=839;player.y=870;window.__homeMore2D.interact()});
 assert.equal((await get()).stage,'return');
 for(let i=0;i<2;i++)await page.click('#nextDialogue');
 await page.evaluate(()=>{player.x=1230;player.y=837;window.__homeMore2D.interact()});
 assert.equal((await get()).stage,'finished');
 for(let i=0;i<3;i++)await page.click('#nextDialogue');
 await page.screenshot({path:output+'/home_more_quest_complete.png'});
 // The originally supplied prototype is retained verbatim in a separate URL.
 const original=await browser.newPage();
 const r=await original.goto('http://127.0.0.1:8732/c-shop/pine-ridge-original.html',{timeout:30000});
 assert.equal(r.status(),200);assert.match(await original.title(),/Pine Ridge/);
 await original.close();
 assert.deepEqual(errors,[],'Console/page errors detected');
 checks.push({test:'story_completion',data:await get()});
 await writeFile(output+'/qa-report.json',JSON.stringify({passed:true,checks},null,2));
 console.log(JSON.stringify({passed:true,checks:checks.map(x=>x.test)}));
}finally{await browser.close();}
