// Camera math is kept separate from gameplay and the canvas renderer so mouse
// aiming, shot targeting, and camera movement always use the same coordinates.
export const TRAINING_ZOOM = 2.25;

const clamp=(value,min,max)=>Math.min(max,Math.max(min,value));

export function clampCameraPosition(x,y,zoom,viewportWidth,viewportHeight,worldWidth,worldHeight){
  const visibleWidth=viewportWidth/zoom, visibleHeight=viewportHeight/zoom;
  return {
    x:visibleWidth>=worldWidth ? worldWidth/2 : clamp(x,visibleWidth/2,worldWidth-visibleWidth/2),
    y:visibleHeight>=worldHeight ? worldHeight/2 : clamp(y,visibleHeight/2,worldHeight-visibleHeight/2)
  };
}

export function followCamera(camera,target,dt,viewportWidth,viewportHeight,worldWidth,worldHeight,instant=false){
  const desired=clampCameraPosition(target.x,target.y,camera.zoom,
    viewportWidth,viewportHeight,worldWidth,worldHeight);
  const amount=instant ? 1 : 1-Math.exp(-9*Math.max(0,dt));
  camera.x += (desired.x-camera.x)*amount;
  camera.y += (desired.y-camera.y)*amount;
  return camera;
}

export function screenToWorld(point,camera,viewportWidth,viewportHeight){
  return {
    x:camera.x+(point.x-viewportWidth/2)/camera.zoom,
    y:camera.y+(point.y-viewportHeight/2)/camera.zoom
  };
}

export function worldToScreen(point,camera,viewportWidth,viewportHeight){
  return {
    x:(point.x-camera.x)*camera.zoom+viewportWidth/2,
    y:(point.y-camera.y)*camera.zoom+viewportHeight/2
  };
}
