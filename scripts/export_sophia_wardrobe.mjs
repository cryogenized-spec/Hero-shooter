import {chromium} from 'playwright';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';

const target='public/play/assets/procedural/sophia_prefab';
const base=JSON.parse(await readFile(target+'/user_sophia_reference.json','utf8'));
const looks=[
 {id:'gothic_street',title:'Gothic Street',outfit:['panties','bra','skirt','jacket','boots'],
  colors:{panties:'000000',bra:'000000',skirt:'26151f',jacket:'201923',boots:'15151b'},
  secondary:{bra:'100d14',panties:'100d14',jacket:'19121d',boots:'121219'},
  description:'dark skirt, fitted open-front jacket, black boots, dark base layer'},
 {id:'gothic_dress',title:'Gothic Dress',outfit:['panties','bra','dress','boots'],
  colors:{panties:'000000',bra:'000000',dress:'291822',boots:'15151b'},
  secondary:{bra:'100d14',panties:'100d14',dress:'18131c',boots:'121219'},
  description:'deep wine-black dress and black boots; corset jewellery applied in viewer'}
];
const browser=await chromium.launch({
 headless:true,acceptDownloads:true,args:['--no-sandbox','--enable-webgl','--use-gl=angle',
 '--use-angle=swiftshader','--disable-gpu-sandbox']
});
const records=[];
try {
 await mkdir('prefab-screenshots',{recursive:true});
 for(const look of looks){
  const params=new URLSearchParams({
   lang:'en',sex:base.sex,cp:base.camera,breastSize:String(base.breastSize),
   breastFirmness:String(base.breastFirmness),breastHeight:String(base.breastHeight),
   breastSpacing:String(base.breastSpacing),breastProjection:String(base.breastProjection),
   skin:base.skin.slice(1),hair:base.hair,outfit:look.outfit.join(','),
   underwear:base.underwear?'1':'0',
   col:look.outfit.map(k=>k+':'+look.colors[k]).join(','),
   clip:base.clip,speed:String(base.speed),look:base.look
  });
  const url='https://dionysus.dk/webxr/charactercreator/?'+params.toString();
  const page=await browser.newPage({viewport:{width:1500,height:960},acceptDownloads:true});
  const errors=[];
  page.on('pageerror',e=>errors.push(String(e)));
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.goto(url,{waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForFunction(()=>window.__ready===true,{timeout:90000});
  // Override BOTH tint channels. The source's default tan jacket lapels and
  // pink underwear trims otherwise undermine Sophia's dark gothic palette.
  await page.evaluate(async data=>{
   for(const id of data.outfit){
    await window.__set('clothColor',{
      id,primary:'#'+data.colors[id],
      ...(data.secondary[id]?{secondary:'#'+data.secondary[id]}:{})
    });
   }
  },look);
  const settings=await page.evaluate(()=>window.__exportSettings());
  assert.equal(settings.sex,'female');assert.equal(settings.hair,'long01');
  assert.equal(settings.colors.skin.toLowerCase(),base.skin);
  for(const k of look.outfit)assert.ok(settings.outfit.includes(k),'missing '+k+' in '+look.id+' outfit '+settings.outfit);
  for(const k of look.outfit){
    assert.equal(settings.clothColors[k]?.primary?.toLowerCase(),'#'+look.colors[k],look.id+' wrong tint '+k);
    if(look.secondary[k])assert.equal(settings.clothColors[k]?.secondary?.toLowerCase(),'#'+look.secondary[k],look.id+' wrong trim '+k);
  }
  for(const k of ['breastSize','breastFirmness','breastHeight','breastSpacing','breastProjection'])
   assert.ok(Math.abs(settings.values[k]-base[k])<.001,'changed body '+k);
  await page.screenshot({path:'prefab-screenshots/creator_'+look.id+'.png',animations:'disabled'});
  const output=target+'/sophia_'+look.id+'.glb';
  const downloadPromise=page.waitForEvent('download',{timeout:180000});
  await page.evaluate(async()=>{
   const ab=await window.__export({shape:'baked',pose:'rest',animations:['idle','walk','run'],
     fps:30,textureSize:1024,removeHiddenSkin:true,clothing:true,hair:true,
     eyes:true,teeth:true,brows:true,lashes:true,merge:false});
   const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([ab],{type:'model/gltf-binary'}));
   a.download='sophia_variant.glb';document.body.appendChild(a);a.click();a.remove();
  });
  const dl=await downloadPromise;await dl.saveAs(output);
  const glb=await readFile(output);
  assert.ok(glb.length>300000,'GLB too small');
  assert.equal(glb.readUInt32LE(0),0x46546c67);
  const jsonLen=glb.readUInt32LE(12);
  const gltf=JSON.parse(glb.subarray(20,20+jsonLen).toString('utf8'));
  assert.ok(gltf.skins?.length,'missing skin');assert.ok(gltf.animations?.length>=3,'missing clips');
  const record={...look,sourceURL:url,settings,bytes:glb.length,
   animations:gltf.animations.map(x=>x.name),meshes:gltf.meshes?.length,materials:gltf.materials?.length,
   skinnedSkeletons:gltf.skins?.length,errors:errors.slice(0,10)};
  records.push(record);console.log(JSON.stringify({variant:look.id,bytes:glb.length,
   outfit:settings.outfit,animations:record.animations,errors:record.errors.slice(0,2)}));
  await page.close();
 }
 await writeFile(target+'/sophia_wardrobe_manifest.json',JSON.stringify({
  source:'User linked MakeHuman creator profile; exact same body/skin/hair/rig, outfit variants only',
  generatedAt:'2026-11-22',looks:records
 },null,2));
}finally{await browser.close();}
