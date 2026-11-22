import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {
  TRAINING_ZOOM,clampCameraPosition,followCamera,screenToWorld,worldToScreen
} from '../public/training/camera.js';

const viewport={width:1672,height:941};
const world={width:1672,height:941};
const approx=(actual,expected,tolerance=1e-8)=>assert.ok(
  Math.abs(actual-expected)<tolerance,`Expected ${actual} to match ${expected}`
);

test('training viewport is zoomed into C rather than showing the entire world',()=>{
  assert.ok(TRAINING_ZOOM>2 && TRAINING_ZOOM<3);
  const seenWidth=viewport.width/TRAINING_ZOOM;
  const seenHeight=viewport.height/TRAINING_ZOOM;
  assert.ok(seenWidth<world.width/2);
  assert.ok(seenHeight<world.height/2);
});

test('camera follows the player smoothly and stops at the map edges',()=>{
  const camera={x:0,y:0,zoom:TRAINING_ZOOM};
  const start={x:270,y:435};
  followCamera(camera,start,0,viewport.width,viewport.height,world.width,world.height,true);
  const left=viewport.width/(2*TRAINING_ZOOM);
  approx(camera.x,left);
  approx(camera.y,435);
  const beforeX=camera.x;
  followCamera(camera,{x:1000,y:680},1/60,viewport.width,viewport.height,world.width,world.height);
  assert.ok(camera.x>beforeX && camera.x<1000,'Follow should ease rather than teleport');
  assert.ok(camera.y>435 && camera.y<680);
  followCamera(camera,{x:9000,y:9000},2,viewport.width,viewport.height,world.width,world.height,true);
  approx(camera.x,world.width-left);
  approx(camera.y,world.height-viewport.height/(2*TRAINING_ZOOM));
  followCamera(camera,{x:-900,y:-900},2,viewport.width,viewport.height,world.width,world.height,true);
  approx(camera.x,left);
  approx(camera.y,viewport.height/(2*TRAINING_ZOOM));
});

test('small maps remain centered without overscrolling',()=>{
  const c=clampCameraPosition(0,1000,2,1672,941,420,200);
  approx(c.x,210);
  approx(c.y,100);
});

test('moving-camera mouse input roundtrips for all four edges and center',()=>{
  const camera={x:1000,y:500,zoom:TRAINING_ZOOM};
  for(const point of [{x:0,y:0},{x:836,y:470.5},{x:1672,y:941},{x:333.25,y:723.7}]){
    const projected=screenToWorld(point,camera,viewport.width,viewport.height);
    const restored=worldToScreen(projected,camera,viewport.width,viewport.height);
    approx(restored.x,point.x);
    approx(restored.y,point.y);
  }
  const target={x:1140,y:565};
  const cursor=worldToScreen(target,camera,viewport.width,viewport.height);
  const hitPoint=screenToWorld(cursor,camera,viewport.width,viewport.height);
  approx(hitPoint.x,target.x);
  approx(hitPoint.y,target.y);
});

test('training stage renders through the camera but keeps collisions and target checks in world coordinates',async()=>{
  const stage=await readFile(new URL('../public/training/range.js',import.meta.url),'utf8');
  assert.match(stage,/ctx\.setTransform\(camera\.zoom/);
  assert.match(stage,/ctx\.drawImage\(yard,0,0\)/);
  assert.match(stage,/ctx\.restore\(\);\s*requestAnimationFrame\(frame\)/);
  assert.match(stage,/updateCamera\(dt\)/);
  assert.match(stage,/updateCamera\(0,true\)/);
  assert.match(stage,/const hitPoint=screenToWorld\(aim,camera,canvas\.width,canvas\.height\)/);
  assert.match(stage,/hitPoint\.x>=x/);
  assert.match(stage,/hitPoint\.y>=y/);
  assert.match(stage,/const worldAim=screenToWorld\(aim,camera,canvas\.width,canvas\.height\)/);
  assert.match(stage,/player\.walkBlend=distance>0\?1:0/);
  assert.match(stage,/if\(canStand\(player\.x\+dx\*step,player\.y\)\)/);
  assert.match(stage,/drawShotEffects\(dt\)/);
});
