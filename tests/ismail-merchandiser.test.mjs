import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');
test('Ismail atlas is 256 by 576 pixels with PNG texture',async()=>{
 const svg=await read('public/play/ismail.svg');
 assert.match(svg,/width="256" height="576"/);
 assert.match(svg,/data:image\/png;base64,iVBORw0KGgo/);
});
test('Ismail maps all 96 directions, gaits and frames to his own atlas',async()=>{
 const draws=[],urls=[];const root={};
 class Img{constructor(){this.complete=true;this.naturalWidth=256;}set src(v){urls.push(v);}}
 const ctx={save(){},restore(){},drawImage(...v){draws.push(v);}};
 vm.runInNewContext(await read('public/play/sprites.js'),{window:root,Image:Img,document:{baseURI:'https://example.test/play/'},URL,Math,Object,console,performance:{now:()=>0}});
 const actor={name:'Ismail',meta:{sprite:'ismail'},x:200,y:210,radius:14,gait:'idle',angle:0,walkAngle:0,walkBlend:0,idleClock:0,walkPhase:0};
 for(let gait=0;gait<3;gait++)for(let dir=0;dir<8;dir++)for(let frame=0;frame<4;frame++){
   actor.gait=['idle','walk','run'][gait];actor.angle=Math.PI/2+dir*Math.PI/4;actor.walkAngle=actor.angle;
   actor.walkBlend=gait?1:0;actor.idleClock=frame/3;actor.walkPhase=frame*Math.PI/2;
   root.HeroSprites.drawNpc(ctx,actor,'assistant');
   assert.equal(draws.at(-1)[1],dir*32);assert.equal(draws.at(-1)[2],(gait*4+frame)*48);
 }
 assert.equal(draws.length,96);
 assert.deepEqual(urls,['https://example.test/play/ismail.svg']);
});
test('Ismail is on shop shelving route but not in original four payroll recipients',async()=>{
 const map=JSON.parse(await read('public/play/maps/home-and-more.tmj'));
 const actors=map.layers.find(l=>l.name==='Actors').objects;
 const actor=actors.find(a=>a.name==='Ismail');
 const prop=k=>actor.properties.find(p=>p.name===k)?.value;
 assert.equal(actors.length,8);
 assert.equal(actors.filter(a=>a.type==='worker').length,5);
 assert.equal(prop('sprite'),'ismail');assert.equal(prop('pair'),'shelves');assert.equal(prop('floor'),'shop');
 assert.equal(prop('route').split(';').length,4);
 const shop=await read('public/play/shop.js');
 assert.match(shop,/if\(actor\.meta\.sprite==='ismail'\)return showDialogue/);
 assert.match(shop,/envelopes=\['Sibusiso Mkhize','Thandeka Dlamini','Bongani Cele','Mandla Khumalo'\]/);
 assert.ok(shop.indexOf("if(actor.meta.sprite==='ismail')")<shop.indexOf("if(actor.type==='worker')return handPayslip(actor)"));
});
