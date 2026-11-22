import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';

const browser=await chromium.launch({
 headless:true,args:['--no-sandbox','--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--disable-gpu-sandbox']
});
const cases=[['original_front','front',0],['narrow_front','front',2],['narrow_threequarter','threequarter',2]];
const results=[];
try{
 await mkdir('prefab-screenshots',{recursive:true});
 for(const [name,view,stance] of cases){
   const page=await browser.newPage({viewport:{width:1500,height:960},deviceScaleFactor:1});
   const errors=[];page.on('pageerror',e=>errors.push(String(e)));
   const url='http://127.0.0.1:8732/sophia-shared-walk.html?motion=walk&view='+view+'&phase=.29&stance='+stance;
   await page.goto(url,{waitUntil:'networkidle',timeout:60000});
   await page.waitForFunction(()=>window.__sharedSophiaReady||window.__sharedSophiaError,null,{timeout:60000});
   const err=await page.evaluate(()=>window.__sharedSophiaError);
   if(err)throw Error(name+': '+err+' '+errors.join('\n'));
   await page.waitForFunction(()=>window.__sharedSophiaMetric?.beforeGapM>0,{timeout:20000});
   const measure=await page.evaluate(()=>window.__sharedSophiaMetric);
   assert.ok(measure.beforeGapM>.07 && measure.beforeGapM<.5,'Unexpected foot spacing');
   if(stance===0)assert.ok(Math.abs(measure.beforeGapM-measure.afterGapM)<.0001);
   else assert.ok(measure.afterGapM<measure.beforeGapM-.012,'Corrected stance did not narrow');
   await page.screenshot({path:'prefab-screenshots/sophia_real_export_walk_'+name+'.png'});
   results.push({name,measure});
   console.log(JSON.stringify({name,measure,errors:errors.slice(0,2)}));
   await page.close();
 }
 await writeFile('prefab-screenshots/shared_character_walk_audit.json',JSON.stringify(results,null,2));
}finally{await browser.close();}
