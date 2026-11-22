import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';

const address='http://127.0.0.1:8732/sophia-prefab.html';
await mkdir('prefab-screenshots',{recursive:true});
const browser=await chromium.launch({
 headless:true,
 args:['--no-sandbox','--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--disable-gpu-sandbox']
});
// Earlier appearance QA completed separately; focus this run on the linked gait.
const config=[]
try{
 for(const [view,outfit] of config){
   const page=await browser.newPage({viewport:{width:1600,height:1000},deviceScaleFactor:1});
   const problems=[];
   page.on('console',msg=>{if(msg.type()==='error')problems.push(msg.text());});
   page.on('pageerror',err=>problems.push(String(err)));
   await page.goto(address+'?shot='+view+'&outfit='+outfit,{waitUntil:'networkidle',timeout:60000});
   await page.waitForFunction(()=>window.__sophiaReady||window.__sophiaError,null,{timeout:45000});
   const error=await page.evaluate(()=>window.__sophiaError);
   if(error)throw Error(view+': '+error+'\nConsole '+problems.join('\n'));
   await page.waitForTimeout(1000);
   const file='prefab-screenshots/sophia_makehuman_'+outfit+'_'+view+'.png';
   await page.screenshot({path:file,fullPage:true,animations:'disabled'});
   const meta=await page.evaluate(()=>({
     canvas:[document.querySelector('#stage canvas')?.width,document.querySelector('#stage canvas')?.height],
     ready:window.__sophiaReady,loadHidden:document.querySelector('#loading')?.hidden
   }));
   if(meta.canvas?.some(x=>!x)||meta.loadHidden!==true)throw Error('Invalid render '+JSON.stringify(meta));
   console.log(JSON.stringify({file,meta,consoleErrors:problems.slice(0,3)}));
   await page.close();
 }

 // Exactly the linked character: no alterations to skin, face, hair, outfit or
 // speed between the ORIGINAL and narrower gait captures.
 const checks=[];
 const cases=[
   ['original_front','front',0],
   ['narrow_front','front',2],
   ['narrow_threequarter','threequarter',2]
 ];
 for(const [name,view,stance] of cases) {
   const page=await browser.newPage({viewport:{width:1600,height:1000},deviceScaleFactor:1});
   const url=address+'?reference=1&shot='+view+'&motion=walk&phase=0.29&stance='+stance;
   await page.goto(url,{waitUntil:'networkidle',timeout:60000});
   await page.waitForFunction(()=>window.__sophiaReady||window.__sophiaError,null,{timeout:55000});
   const error=await page.evaluate(()=>window.__sophiaError);
   if(error)throw Error(name+': '+error);
   await page.waitForFunction(()=>window.__sophiaStanceState?.beforeGapM!=null,{timeout:25000});
   const metrics=await page.evaluate(()=>window.__sophiaStanceState);
   if(!Number.isFinite(metrics.beforeGapM)||!Number.isFinite(metrics.afterGapM))
     throw Error(name+' missing foot-width values '+JSON.stringify(metrics));
   if(stance && !(metrics.afterGapM < metrics.beforeGapM-0.015))
     throw Error(name+' foot width not reduced enough '+JSON.stringify(metrics));
   if(!stance && Math.abs(metrics.afterGapM-metrics.beforeGapM)>0.0001)
     throw Error(name+' baseline was changed '+JSON.stringify(metrics));
   const file='prefab-screenshots/sophia_user_walk_'+name+'.png';
   await page.screenshot({path:file,fullPage:true,animations:'disabled'});
   console.log(JSON.stringify({file,metrics,url}));
   checks.push({name,stance,metrics});
   await page.close();
 }
 await writeFile('prefab-screenshots/stance_width_audit.json',JSON.stringify(checks,null,2));
}finally{await browser.close();}
