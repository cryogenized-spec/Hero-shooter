/* C V8.1 — deterministic procedural gait in GLB model-space (+Z up).
 * Pure math: small enough to test independently of Three.js and the browser.
 * Source's V8.1 mesh is not skeleton-rigged. This is a visible deformation
 * fallback; a true bone rig remains a separate production task.
 */
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const smooth=v=>{v=clamp(v);return v*v*(3-2*v);};
export function gaitSample(phase,mode='idle'){
 const active=mode==='walk'||mode==='run';
 const run=mode==='run';
 const s=active?Math.sin(phase*Math.PI*2):0;
 return {
  active,run,phase,s,
  hipAmplitude:!active?0:(run?.66:.32),
  kneeAmplitude:!active?0:(run?.74:.34),
  bob:!active?0:(run?.048:.024)*(1-Math.cos(phase*Math.PI*4)),
  armCounter:!active?0:(run?.11:.055)*s
 };
}
// Right and left leg vertices receive opposite gait phases. A soft weight
// around the hip and midline keeps the original character silhouette intact.
export function legDisplacement(x,y,z,gait){
 if(!gait?.active||z>1.11||z<-.16||Math.abs(x)>.31)return [0,0,0];
 const side=x<0?-1:1;
 const midline=smooth((Math.abs(x)-.025)/.065);
 const hipBlend=smooth((1.11-z)/.20);
 const outerBlend=1-smooth((Math.abs(x)-.235)/.075);
 const weight=midline*hipBlend*outerBlend;
 if(weight<.003)return [0,0,0];
 const forwardPhase=side*gait.s;
 const hipAngle=forwardPhase*gait.hipAmplitude;
 const kneeAngle=Math.max(0,-forwardPhase)*gait.kneeAmplitude;
 // Local flexion around an anatomical approximation of the knee;
 // visual purpose only, not gait physics or a skeletal IK solver.
 const kneeZ=.51,hipZ=.95,hipY=.015,kneeBlend=smooth((.60-z)/.16);
 let yy=y,zz=z;
 if(kneeBlend>0){
   const dy=yy-.015,dz=zz-kneeZ;
   const co=Math.cos(kneeAngle),si=Math.sin(kneeAngle);
   yy+=kneeBlend*(dy*(co-1)-dz*si);
   zz+=kneeBlend*(dy*si+dz*(co-1));
 }
 const dy=yy-hipY,dz=zz-hipZ;
 const co=Math.cos(hipAngle),si=Math.sin(hipAngle);
 const ry=hipY+dy*co-dz*si;
 const rz=hipZ+dy*si+dz*co;
 return [0,(ry-y)*weight,(rz-z)*weight];
}
