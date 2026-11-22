import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true,
 args:['--no-sandbox','--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--disable-gpu-sandbox']});
const cases=[
 ['street','front','idle'],['street','threequarter','walk'],
 ['dress','front','idle'],['dress','threequarter','walk']
];
const reports=[];
await mkdir('gothic-screenshots',{recursive:true});
try{
 for(const [look,view,motion] of cases){
  const page=await browser.newPage({viewport:{width:1500,height:960},deviceScaleFactor:1});
  const errors=[];
  page.on('pageerror',e=>errors.push(String(e)));
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  const url='http://127.0.0.1:8732/sophia-wardrobe.html?look='+look+'&view='+view+'&motion='+motion+'&stance=2'+(motion==='walk'?'&phase=.29':'');
  await page.goto(url,{waitUntil:'networkidle',timeout:60000});
  await page.waitForFunction(()=>window.__sharedSophiaReady||window.__sharedSophiaError,null,{timeout:60000});
  const err=await page.evaluate(()=>window.__sharedSophiaError);
  if(err)throw Error(look+' '+view+': '+err+' '+errors.join('\n'));
  if(motion==='walk'){
   await page.waitForFunction(()=>window.__sharedSophiaMetric?.beforeGapM>0,{timeout:15000});
   const gap=await page.evaluate(()=>window.__sharedSophiaMetric);
   assert.ok(gap.afterGapM<gap.beforeGapM,'Narrow walk failed '+JSON.stringify(gap));
  }
  await page.waitForTimeout(500);
  const file='gothic-screenshots/sophia_'+look+'_'+view+'_'+motion+'.png';
  await page.screenshot({path:file,animations:'disabled'});
  reports.push({look,view,motion,filename:file,consoleErrors:errors});
  if(errors.length)throw Error('Browser errors: '+errors.join('\n').slice(0,1700));
  console.log(JSON.stringify(reports.at(-1)));
  await page.close();
 }
 await writeFile('gothic-screenshots/qa.json',JSON.stringify(reports,null,2));
}finally{await browser.close();}
