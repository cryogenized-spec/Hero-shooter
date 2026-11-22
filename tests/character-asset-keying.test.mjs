import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {drawArmedC} from '../src/armed-c.js';

const read=(path)=>readFile(new URL('../'+path,import.meta.url),'utf8');
function spritesHarness() {
  const draws=[];
  const urls=[];
  class MockImage {
    constructor(){this.complete=true;this.naturalHeight=576;this.naturalWidth=320;}
    set src(url){this.url=url;urls.push(url);}
  }
  const ctx={save(){},restore(){},translate(){},rotate(){},scale(){},
             drawImage(...args){draws.push(args);}};
  const root={};
  return {draws,urls,ctx,root,MockImage,execute:async()=>{
    const source=await read('public/play/sprites.js');
    vm.runInNewContext(source,{
      window:root,Image:MockImage,document:{baseURI:'https://example.test/play/'},
      URL,Math,Object,console,performance:{now:()=>0}
    });
  }};
}
const baseC=()=>({
  x:160,y:110,angle:Math.PI/2,walkAngle:Math.PI/2,walkPhase:0,
  walkBlend:0,gait:'idle',idleClock:0,radius:15,
  weaponVisible:false,weaponId:null,nvgEquipped:false,hasMolleVest:false
});

test('C uses civilian, then Glock 26 atlas, without swapping out another characters art',async()=>{
  const h=spritesHarness();await h.execute();
  const c=baseC();
  h.root.HeroSprites.drawC(h.ctx,c);
  assert.equal(h.draws.length,1);
  assert.ok(h.urls[0].endsWith('/c-civilian.svg'));
  assert.equal(h.draws[0][3],32);
  c.weaponVisible=true;c.weaponId='glock26';c.angle=0;
  h.root.HeroSprites.drawC(h.ctx,c);
  assert.equal(h.draws.length,2);
  assert.ok(h.urls[1].endsWith('/c-glock-ready.svg'));
  assert.equal(h.draws[1][1],240); // east/right aim facing at 40px per direction
  assert.equal(h.draws[1][3],40);
  c.weaponVisible=false;c.weaponId=null;
  h.root.HeroSprites.drawC(h.ctx,c);
  assert.equal(h.draws.length,3);
  assert.equal(h.urls.length,2); // load each atlas only once
  assert.equal(h.draws[2][3],32);
});

test('Saafiya and Sophia name variants resolve to their own NPC atlas',async()=>{
  const h=spritesHarness();await h.execute();
  const npc={x:160,y:110,angle:Math.PI/2,walkAngle:Math.PI/2,
    walkPhase:0,walkBlend:0,gait:'idle',idleClock:0,radius:14};
  for (const name of ['Saafiya','Sophia','Sofia','Saafiya Dlamini']) {
    h.root.HeroSprites.drawNpc(h.ctx,{...npc,name},'assistant','none');
  }
  assert.equal(h.draws.length,4);
  assert.equal(h.urls.length,1);
  assert.ok(h.urls[0].endsWith('/assets/procedural/saafiya_walk_8way_8frame_atlas.webp'));
  assert.ok(h.draws.every(d=>d[3]===176&&d[4]===224));
  // A stable explicit Tiled identity must work regardless of an actor's displayed name.
  h.root.HeroSprites.drawNpc(h.ctx,{...npc,name:'Character 5',meta:{sprite:'saafiya'}},'assistant');
  assert.equal(h.draws.length,5);
});

test('main shop maps Chen family by role and permits explicit art keys',async()=>{
  const shop=await read('public/play/shop.js');
  const map=JSON.parse(await read('public/play/maps/home-and-more.tmj'));
  const actors=map.layers.find(l=>l.name==='Actors').objects;
  const chen={'Wei Chen':'family-son','Mr. Chen':'family-father','Mrs. Chen':'family-mother'};
  for(const [name,role] of Object.entries(chen)){
    assert.equal(actors.find(a=>a.name===name)?.type,role);
  }
  assert.match(shop,/a\.meta\.sprite \|\| \(a\.type==='worker'/);
  assert.match(shop,/HeroSprites\.drawNpc\(ctx,a,looks,prop\)/);
});

test('armed combat atlas activates only for mall C with the Glock 26 and civilian clothing',()=>{
  assert.equal(drawArmedC({}, {gender:'female'}, {id:'glock26'}),false);
  assert.equal(drawArmedC({}, {gender:'mall'}, {id:'glock17'}),false);
  assert.equal(drawArmedC({}, {gender:'mall',hasMolleVest:true},{id:'glock26'}),false);
  assert.equal(drawArmedC({}, {gender:'mall',nvgEquipped:true},{id:'glock26'}),false);
  assert.equal(drawArmedC({}, {gender:'mall'}, {id:'glock26'}),false); // no browser Image API
});

test('all atlas assets are present with the correct dimensions',async()=>{
  const assets=[['c-civilian.svg',256],['c-glock-ready.svg',320],['saafiya.svg',256]];
  for(const [file,width] of assets){
    const source=await read('public/play/'+file);
    assert.ok(source.includes('width="'+width+'" height="576"'),'Wrong dimensions for '+file);
    assert.ok(source.includes('data:image/png;base64,iVBORw0KGgo'),'Missing embedded pixel texture for '+file);
  }
});
