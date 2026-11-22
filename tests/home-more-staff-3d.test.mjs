import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,stat} from 'node:fs/promises';
import vm from 'node:vm';

const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');
const STAFF={
  'Sibusiso Mkhize':'sibusiso_mkhize',
  'Thandeka Dlamini':'thandeka_dlamini',
  'Bongani Cele':'bongani_cele',
  'Mandla Khumalo':'mandla_khumalo',
  'Back-office clerk':'back_office_clerk'
};

test('all four map workers and the office clerk have specific named VTK atlas keys',async()=>{
  const map=JSON.parse(await read('public/play/maps/home-and-more.tmj'));
  const actors=map.layers.find(layer=>layer.name==='Actors').objects;
  for(const name of Object.keys(STAFF)){
    const a=actors.find(o=>o.name===name);
    assert.ok(a,'Missing '+name+' from active Sunday map');
    assert.ok(a.type==='worker'||a.type==='staff-clerk');
  }
  assert.equal(actors.filter(a=>a.type==='worker').length,4,'Do not add or remove wage recipients');
  assert.ok(!actors.some(a=>/^(Ismail|Ismael)$/i.test(a.name)),'Do not silently alter story continuity');
});

test('all named employees, plus Ismail, select unique 8-way atlas assets',async()=>{
  const source=await read('public/play/sprites.js');
  const draws=[],urls=[];
  class ImageMock{
    constructor(){this.complete=true;this.naturalWidth=256;this.naturalHeight=576}
    set src(value){urls.push(value)}
  }
  const root={};
  const ctx={save(){},restore(){},translate(){},rotate(){},scale(){},drawImage(...args){draws.push(args)}};
  vm.runInNewContext(source,{window:root,Image:ImageMock,
    document:{baseURI:'https://example.test/play/'},URL,Math,Object,console,performance:{now:()=>0}});
  const cases=[...Object.keys(STAFF),'Ismail'];
  for(const name of cases){
    const actor={name,x:220,y:180,angle:Math.PI/2,walkAngle:Math.PI/2,
      walkPhase:0,walkBlend:0,gait:'idle',radius:14,idleClock:4};
    if(name==='Back-office clerk') actor.meta={sprite:'assistant'};
    root.HeroSprites.drawNpc(ctx,actor,name==='Thandeka Dlamini'?'cashier':'assistant');
    assert.equal(draws.length,cases.indexOf(name)+1,name+' must load sprite atlas');
    assert.equal(draws.at(-1)[1],0);
    assert.equal(draws.at(-1)[2],0,'idle is truly at rest');
  }
  assert.equal(urls.length,cases.length);
  for(const slug of Object.values(STAFF)){
    assert.ok(urls.some(url=>url.endsWith('/assets/procedural/'+slug+'_8dir_12row_atlas.png')),slug);
  }
  assert.ok(urls.some(url=>url.endsWith('/assets/procedural/ismail_vtk_atlas_32x48.png')));
});

test('worker VTK walking and running sprite offsets match canonical eight bearings',async()=>{
  const src=await read('public/play/sprites.js'),root={},draws=[];
  class ImageMock{constructor(){this.complete=true;this.naturalWidth=256;this.naturalHeight=576}set src(x){}}
  const ctx={save(){},restore(){},drawImage(...args){draws.push(args)}};
  vm.runInNewContext(src,{window:root,Image:ImageMock,
    document:{baseURI:'https://example.test/play/'},URL,Math,Object,console,performance:{now:()=>0}});
  const a={name:'Bongani Cele',x:200,y:200,radius:14,angle:Math.PI/2,
    walkAngle:Math.PI/2,gait:'walk',walkPhase:0,walkBlend:1};
  for(let col=0;col<8;col++){
    for(const gait of ['walk','run']){
      for(let frame=0;frame<4;frame++){
        a.angle=Math.PI/2+col*Math.PI/4;a.walkAngle=a.angle;
        a.gait=gait;a.walkPhase=frame*Math.PI/2;
        root.HeroSprites.drawNpc(ctx,a,'assistant');
        const d=draws.at(-1);
        assert.equal(d[1],col*32);
        assert.equal(d[2],((gait==='walk'?4:8)+frame)*48);
        assert.equal(d[3],32);assert.equal(d[4],48);
      }
    }
  }
  assert.equal(draws.length,64);
});

test('generated GLBs and PNGs validate when the GitHub render job has published them',async t=>{
  const src=await read('tools/render/build_shop_workers_vtk.py');
  assert.match(src,/import vtk/);
  assert.match(src,/export_glb/);
  const ismail=await read('tools/render/build_ismail_vtk.py');
  assert.match(ismail,/vtk\.vtkAssembly/);
  const files=[...Object.values(STAFF),'ismail'];
  const base='public/play/assets/procedural/';
  try {await stat(new URL('../'+base+'sibusiso_mkhize.glb',import.meta.url));}
  catch(e){if(e.code==='ENOENT')return t.skip('GitHub Action has not committed the VTK exports yet');throw e;}
  for(const slug of files){
    const glbname=slug==='ismail'?'ismail_unarmed_vtk.glb':slug+'.glb';
    const atlasname=slug==='ismail'?'ismail_vtk_atlas_32x48.png':slug+'_8dir_12row_atlas.png';
    const glb=await readFile(new URL('../'+base+glbname,import.meta.url));
    assert.equal(glb.subarray(0,4).toString('ascii'),'glTF',glbname);
    const png=await readFile(new URL('../'+base+atlasname,import.meta.url));
    assert.equal(png.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
    assert.equal(png.readUInt32BE(16),256);
    assert.equal(png.readUInt32BE(20),576);
    assert.equal(png[25],6,'RGBA image required for transparent sprites');
  }
});
