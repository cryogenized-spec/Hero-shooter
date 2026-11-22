import {chromium} from 'playwright';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';

// Rebuild the ORIGINAL user link from the exact recorded parameters, rather
// than approximating those sliders in a second character generator.
const target='public/play/assets/procedural/sophia_prefab';
const config=JSON.parse(await readFile(target+'/user_sophia_reference.json','utf8'));
const params=new URLSearchParams({
 lang:'en',cp:config.camera,sex:config.sex,
 breastSize:String(config.breastSize),breastFirmness:String(config.breastFirmness),
 breastHeight:String(config.breastHeight),breastSpacing:String(config.breastSpacing),
 breastProjection:String(config.breastProjection),skin:config.skin.slice(1),
 hair:config.hair,outfit:config.outfit.join(','),underwear:config.underwear?'1':'0',
 col:config.outfit.map(x=>x+':'+config.colors[x].slice(1)).join(','),
 clip:config.clip,speed:String(config.speed),look:config.look,
});
const url='https://dionysus.dk/webxr/charactercreator/?'+params.toString();
const browser=await chromium.launch({
 headless:true,acceptDownloads:true,
 args:['--no-sandbox','--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--disable-gpu-sandbox']
});
try{
 const page=await browser.newPage({viewport:{width:1500,height:960},acceptDownloads:true});
 const errors=[];
 page.on('pageerror',e=>errors.push(e.toString()));
 page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.goto(url,{waitUntil:'domcontentloaded',timeout:60000});
 await page.waitForFunction(()=>window.__ready===true,{timeout:90000});
 const actual=await page.evaluate(()=>window.__exportSettings());
 assert.equal(actual.sex,'female');
 assert.equal(actual.hair,'long01');
 assert.ok(actual.outfit.includes('bra') && actual.outfit.includes('panties'));
 assert.equal(actual.colors.skin.toLowerCase(),'#63452c');
 assert.ok(Math.abs(actual.values.breastSize-config.breastSize)<.001);
 await mkdir('prefab-screenshots',{recursive:true});
 await page.screenshot({path:'prefab-screenshots/user_sophia_original_creator.png',animations:'disabled'});
 await writeFile(target+'/user_sophia_creator_settings.json',JSON.stringify(actual,null,2));
 const artifact=target+'/sophia_from_shared_settings.glb';
 const ev=page.waitForEvent('download',{timeout:180000});
 await page.evaluate(async()=>{
   const binary=await window.__export({
     shape:'baked',pose:'rest',animations:['idle','walk','run'],
     fps:30,textureSize:1024,removeHiddenSkin:true,
     clothing:true,hair:true,eyes:true,teeth:true,
     brows:true,lashes:true,merge:false
   });
   const blob=new Blob([binary],{type:'model/gltf-binary'});
   const a=document.createElement('a');a.href=URL.createObjectURL(blob);
   a.download='sophia_from_shared_settings.glb';
   document.body.appendChild(a);a.click();a.remove();
 });
 const download=await ev;
 await download.saveAs(artifact);
 const buffer=await readFile(artifact);
 assert.ok(buffer.length>100000);
 assert.equal(buffer.readUInt32LE(0),0x46546c67,'GLB magic');
 const n=buffer.readUInt32LE(12);
 assert.equal(buffer.readUInt32LE(16),0x4e4f534a,'GLB JSON chunk');
 const gltf=JSON.parse(buffer.subarray(20,20+n).toString('utf8'));
 assert.ok(gltf.skins?.length>=1,'Missing humanoid skeletal rig');
 assert.ok(gltf.animations?.length>=3,'Missing idle/walk/run tracks');
 const stats={source:url,bytes:buffer.length,animations:gltf.animations.map(a=>a.name),
  materials:gltf.materials?.length,meshes:gltf.meshes?.length,
  skins:gltf.skins?.length,settings:actual,
  consoleErrors:errors.slice(0,15)};
 await writeFile(target+'/shared_glb_export_audit.json',JSON.stringify(stats,null,2));
 console.log(JSON.stringify({success:true,bytes:buffer.length,
  animations:stats.animations,meshCount:stats.meshes,errors:errors.slice(0,3)}));
}finally{await browser.close();}
