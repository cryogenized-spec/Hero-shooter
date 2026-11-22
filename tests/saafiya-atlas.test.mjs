import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

test('Sophia uses the approved procedural v3.3 mesh and chrome 84FS prop',async()=>{
  const mesh=await readFile(new URL('../tools/render/sophia_saafiya_studio_v3_3_builder.py',import.meta.url),'utf8');
  const gait=await readFile(new URL('../tools/render/make_sophia_motion.py',import.meta.url),'utf8');
  assert.match(mesh,/class Studio33/);
  assert.match(mesh,/make_painted_face/);
  assert.match(gait,/add_chrome_prop/);
  assert.match(gait,/POSES=\('lowered','aimed'\)/);
  assert.match(gait,/GAITS=\('walk','run'\)/);
  assert.match(gait,/DIRS=\{'S':0,'SW':45,'W':90,'NW':135,'N':180,'NE':225,'E':270,'SE':315\}/);
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
  assert.deepEqual(draws[0].slice(3),[176,224,135,59,50,64]);
  const running={...idle,gait:'run',angle:0,walkAngle:0,walkPhase:0,walkBlend:1};
  root.HeroSprites.drawNpc(ctx,running,'saafiya');
  assert.equal(draws.length,2);
  assert.equal(draws[1][1],0);
  assert.equal(draws[1][2],6*224);
  assert.deepEqual(draws[1].slice(3),[176,224,135,59,50,64]);
  // Eight directions × eight distinct chronological poses on the VTK atlas.
  for(const gait of ['walk','run']){
    for(let direction=0;direction<8;direction++){
      for(let frame=0;frame<8;frame++){
        const angle=Math.PI/2+direction*Math.PI/4;
        root.HeroSprites.drawNpc(ctx,{
          ...idle,gait,walkBlend:1,angle,walkAngle:angle,
          walkPhase:frame*(2*Math.PI/8)
        },'saafiya');
        const coords=draws.at(-1);
        assert.equal(coords[1],frame*176,'frame '+frame);
        assert.equal(coords[2],direction*224,'direction '+direction);
      }
    }
  }
  assert.equal(draws.length,130);
});

test('single-stack Cheetah silhouette and sights stay aligned in the 3D exporter',async()=>{
  const source=await readFile(new URL('../tools/render/make_sophia_motion.py',import.meta.url),'utf8');
  assert.match(source,/def add_chrome_prop\(m\):/);
  assert.match(source,/thickness=\.044/);
  assert.match(source,/ergonomic_slim_grip/);
  assert.match(source,/contoured_black_grip_panel/);
  assert.match(source,/rounded_open_slide/);
  assert.match(source,/rounded_trigger_guard/);
  assert.match(source,/angle_x=90 if side<0 else 88/);
  assert.match(source,/angle_z=0 if side<0 else 57/);
  assert.doesNotMatch(source,/prop\/beretta84fs\/chromed_slide'/);
  // The character retains her historic nickname, but specs identify the
  // 7.65 mm slim single-stack Cheetah as Model 82, not the .380 84FS.
  assert.match(source,/7\.65-mm single-stack is the Model 82/);
});
