import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const address='http://127.0.0.1:8732/sophia-prefab.html';
await mkdir('prefab-screenshots',{recursive:true});
const browser=await chromium.launch({
 headless:true,
 args:['--no-sandbox','--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--disable-gpu-sandbox']
});
const config=[
  ['front','gothic_dress'],['threequarter','gothic_dress'],
  ['profile','gothic_dress'],['back','gothic_dress'],
  ['threequarter','practical']
];
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
}finally{await browser.close();}
