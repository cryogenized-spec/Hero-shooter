import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
const browser=await chromium.launch({
  headless:true,
  args:['--no-sandbox','--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--disable-gpu-sandbox']
});
const report={};
await mkdir('c-shop-screenshots',{recursive:true});
try{
 const page=await browser.newPage({viewport:{width:1380,height:950},deviceScaleFactor:1});
 const errors=[];
 page.on('pageerror',e=>errors.push('pageerror '+e.message));
 page.on('console',msg=>{if(msg.type()==='error')errors.push('console '+msg.text());});
 await page.goto('http://127.0.0.1:8732/c-shop/',{waitUntil:'domcontentloaded',timeout:45000});
 await page.waitForFunction(()=>Boolean(window.__goldenDragon2D),null,{timeout:30000});
 const initial=await page.evaluate(()=>window.__goldenDragon2D.status);
 assert.equal(initial.stage,'find_chen');
 assert.equal(initial.people,2);
 assert.ok(initial.props>=7,'shop fixtures missing');
 assert.ok(initial.blockers>=10,'walkable geometry not generated');
 report.initial=initial;
 // Verify Pine Ridge movement code is actually reused and directional keys
 // change the position on the new map, rather than just rotating in place.
 await page.keyboard.down('d');
 await page.waitForTimeout(420);
 await page.keyboard.up('d');
 const moved=await page.evaluate(()=>window.__goldenDragon2D.status.player);
 assert.ok(moved.x>initial.player.x+10,'Character did not move under D');
 report.movement=moved;
 await page.screenshot({path:'c-shop-screenshots/golden_dragon_shop_overhead.png'});
 // Original reference page must be reachable independently and untouched.
 const ref=await browser.newPage();
 const rr=await ref.goto('http://127.0.0.1:8732/c-shop/pine-ridge-original.html',{timeout:30000});
 assert.equal(rr.status(),200);
 assert.match(await ref.title(),/Pine Ridge/);
 await ref.close();
 // Mr Chen dialogue, shutter clue and return objective.
 await page.evaluate(()=>{
   player.x=1040;player.y=449;
   window.__goldenDragon2D.interact();
 });
 await page.waitForFunction(()=>!document.getElementById('dialogue').hidden);
 let st=await page.evaluate(()=>window.__goldenDragon2D.status);
 assert.equal(st.stage,'check_shutter');
 assert.ok(st.dialogue);
 await page.screenshot({path:'c-shop-screenshots/golden_dragon_mr_chen_dialogue.png'});
 for(let i=0;i<5;i++)await page.click('#nextDialogue');
 assert.equal(await page.evaluate(()=>document.getElementById('dialogue').hidden),true);
 await page.evaluate(()=>{
   player.x=673;player.y=570;window.__goldenDragon2D.interact();
 });
 st=await page.evaluate(()=>window.__goldenDragon2D.status);
 assert.equal(st.stage,'return');
 for(let i=0;i<2;i++)await page.click('#nextDialogue');
 await page.evaluate(()=>{
   player.x=1040;player.y=449;window.__goldenDragon2D.interact();
 });
 st=await page.evaluate(()=>window.__goldenDragon2D.status);
 assert.equal(st.stage,'finished');
 for(let i=0;i<3;i++)await page.click('#nextDialogue');
 await page.screenshot({path:'c-shop-screenshots/golden_dragon_objective_complete.png'});
 assert.equal(errors.length,0,'Browser errors: '+errors.join('\n'));
 report.final=await page.evaluate(()=>window.__goldenDragon2D.status);
 report.errors=errors;
 await writeFile('c-shop-screenshots/qa-report.json',JSON.stringify(report,null,2));
 console.log(JSON.stringify({passed:true,initial:report.initial,final:report.final}));
 await page.close();
}finally{await browser.close();}
