import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

test('Saafiya atlas is a self-contained 8-direction, 3-gait asset', async()=>{
  const svg=await readFile(new URL('../public/play/saafiya.svg',import.meta.url),'utf8');
  assert.match(svg, /width="256" height="576"/);
  assert.match(svg, /data:image\/png;base64,iVBORw0KGgo/);
});

test('Saafiya selects atlas cells for her NPC identity without changing C',async()=>{
  const source=await readFile(new URL('../public/play/sprites.js',import.meta.url),'utf8');
  const draws=[];
  class MockImage {
    constructor(){this.complete=true;this.naturalWidth=256;this.naturalHeight=576;}
    set src(value){this.url=value;}
  }
  const ctx={save(){},restore(){},drawImage(...args){draws.push(args);}};
  const root={};
  vm.runInNewContext(source,{
    window:root,Image:MockImage,document:{baseURI:'https://example.test/play/'},
    URL,Math,Object,console,performance:{now:()=>0}
  });
  const idle={x:160,y:110,angle:Math.PI/2,walkAngle:Math.PI/2,walkPhase:0,
              walkBlend:0,gait:'idle',idleClock:0,radius:14,name:'Saafiya'};
  root.HeroSprites.drawNpc(ctx,idle,'assistant');
  assert.equal(draws.length,1);
  assert.equal(draws[0][1],0);
  assert.equal(draws[0][2],0);
  assert.deepEqual(draws[0].slice(3),[32,48,144,78,32,48]);
  const running={...idle,gait:'run',angle:0,walkAngle:0,walkPhase:0,walkBlend:1};
  root.HeroSprites.drawNpc(ctx,running,'saafiya');
  assert.equal(draws.length,2);
  assert.equal(draws[1][1],192);
  assert.equal(draws[1][2],384);
});
