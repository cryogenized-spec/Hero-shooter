import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';

const browser=await chromium.launch({
 headless:true,
 args:['--no-sandbox','--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--disable-gpu-sandbox']
});
await mkdir('c-mall-screenshots',{recursive:true});
const output=[];
try{
 const page=await browser.newPage({viewport:{width:1600,height:960},deviceScaleFactor:1});
 const fatal=[];
 page.on('pageerror',e=>fatal.push(String(e)));
 page.on('console',m=>{if(m.type()==='error')fatal.push(m.text());});
 await page.goto('http://127.0.0.1:8833/c-mall/',{waitUntil:'networkidle',timeout:60000});
 await page.waitForFunction(()=>window.__goldenDragonReady||window.__goldenDragonError,null,{timeout:85000});
 const error=await page.evaluate(()=>window.__goldenDragonError||null);
 if(error)throw Error('Scene startup failed: '+error+' '+fatal.join('\n'));
 const report=await page.evaluate(()=>{
  const {state,mall}=window.__goldenDragonTest;
  const c=state.hero.position;
  return {
   ready:state.ready,chenLoaded:!!state.chen,
   canvas:[document.querySelector('#stage canvas')?.width,document.querySelector('#stage canvas')?.height],
   portrait:document.querySelector('#portrait img')?.naturalWidth,
   spawn:[c.x,c.y,c.z],walkableSpawn:mall.walkable(0,-6.5),
   blockedShelves:!mall.walkable(-6.4,1.3),mallCorridor:mall.walkable(0,-11.3),
   interactables:mall.events.length,
   canvasVisible:document.querySelector('#loading')?.hidden===true
  };
 });
 assert.equal(report.ready,true);
 assert.equal(report.chenLoaded,true);
 assert.equal(report.walkableSpawn,true);
 assert.equal(report.blockedShelves,true);
 assert.equal(report.mallCorridor,true);
 assert.ok(report.interactables>=5,'Missing props and Mr Chen interactions');
 assert.ok(report.canvas[0]>=1400,'Scene is not rendered at viewport resolution');
 assert.ok(report.portrait>=100,'Attached C reference portrait did not load');
 assert.ok(report.canvasVisible,'Loading overlay still covers level');
 await page.waitForTimeout(900);
 await page.screenshot({path:'c-mall-screenshots/golden_dragon_shop_overview.png',animations:'disabled'});
 const start=await page.evaluate(()=>window.__goldenDragonTest.state.hero.position.toArray());
 await page.keyboard.down('w');
 // SwiftShader software WebGL and 1600×960 screenshots can briefly stall
 // requestAnimationFrame; check actual movement rather than fixed wall time.
 try{
  await page.waitForFunction(start=>{
    const p=window.__goldenDragonTest?.state.hero?.position;
    return p&&Math.hypot(p.x-start[0],p.y-start[1])>.06;
  },start,{timeout:12000,polling:150});
 }finally{await page.keyboard.up('w');}
 const end=await page.evaluate(()=>window.__goldenDragonTest.state.hero.position.toArray());
 const walked=Math.hypot(start[0]-end[0],start[1]-end[1]);
 console.log('KEYBOARD MOVEMENT DEBUG',JSON.stringify({start,end,walked}));
 assert.ok(walked>.06,'Player did not walk: '+JSON.stringify({start,end}));
 await page.evaluate(()=>{
  const h=window.__goldenDragonTest.state.hero;
  h.position.set(5.35,-3.8,.04);
  window.__goldenDragonTest.cameraFollow(true);
 });
 await page.waitForTimeout(350);
 await page.keyboard.press('e');
 assert.equal(await page.locator('#dialogue').evaluate(el=>el.hidden),false,'Dialog did not open near Mr Chen');
 assert.match(await page.locator('#dialogueName').textContent(),/C/);
 await page.screenshot({path:'c-mall-screenshots/golden_dragon_chen_dialogue.png',animations:'disabled'});
 await page.keyboard.press('Escape');
 assert.equal(await page.locator('#dialogue').evaluate(el=>el.hidden),true);
 await page.evaluate(()=>{window.__goldenDragonTest.state.hero.position.set(0,-11.3,.04);window.__goldenDragonTest.cameraFollow(true);});
 await page.waitForTimeout(450);
 await page.screenshot({path:'c-mall-screenshots/golden_dragon_mall_concourse.png',animations:'disabled'});
 if(fatal.length)throw Error('Browser errors: '+fatal.join('\n').slice(0,2500));
 output.push({...report,walkingDeltaM:walked,pageErrors:fatal,files:3});
 console.log(JSON.stringify(output[0],null,2));
 await writeFile('c-mall-screenshots/qa.json',JSON.stringify(output,null,2));
}finally{
 await browser.close();
}
