/* Hero Shooter — ornate live gameplay HUD, v3.
 * All numbers and map details are LIVE DOM/canvas elements, not baked into the PNG.
 * Designed for the supplied 2048x1152 transparent HUD asset.
 */
(function (root) {
  'use strict';
  const doc = root.document;
  const IMAGE = './assets/ui/hero_shooter_hud_transparent.png';
  const HEARTS = 6;
  const $ = id => doc.getElementById(id);
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const style = doc.createElement('style');
  style.textContent = `
    #heroOrnateHud {position:fixed; inset:0; z-index:19; pointer-events:none; overflow:hidden; display:none;}
    #heroOrnateHud .ornate-stage {position:absolute; width:min(100vw, 177.77778vh); height:min(100vh, 56.25vw); top:50%; left:50%; transform:translate(-50%,-50%);}
    #heroOrnateHud .ornate-art {position:absolute; width:100%; height:100%; object-fit:fill; inset:0; user-select:none;}
    #heroOrnateHud .ornate-hearts {position:absolute; left:18.1%; top:6.2%; width:21.7%; height:6.4%; display:flex; align-items:center; justify-content:space-between; gap:0.3%;}
    #heroOrnateHud .ornate-heart {position:relative; font-family:Georgia,serif; font-size:clamp(15px, 2.15vw, 35px); line-height:1; filter:drop-shadow(0 2px 3px #000); flex:1; text-align:center;}
    #heroOrnateHud .ornate-heart-base {color:#2a141d; -webkit-text-stroke:1px #a77e66;}
    #heroOrnateHud .ornate-heart-fill {position:absolute; left:0; top:0; width:100%; overflow:hidden; white-space:nowrap; color:#e84458; text-shadow:0 0 5px #a41324; -webkit-text-stroke:1px #ffb7a6;}
    #heroOrnateHud .ornate-map {position:absolute; left:86.05%; top:4.05%; width:11.6%; height:20.62%; aspect-ratio:1; border-radius:50%; background:#161a23; opacity:.98; overflow:hidden;}
    #heroOrnateHud .ornate-map canvas {width:100%; height:100%; display:block; border-radius:50%;}
    /* Futuristic condensed numerals paired with the bronze/burgundy skin. No network font dependency. */
    #heroOrnateHud .ornate-ammo {position:absolute; right:2.3%; bottom:9.8%; width:14%; height:7%; display:flex; align-items:center; justify-content:center; gap:.45em; color:#f6d7ba; font-family:Oxanium,Rajdhani,Eurostile,'Bank Gothic','Arial Narrow',sans-serif; font-size:clamp(12px,1.40vw,27px); font-weight:800; font-variant-numeric:tabular-nums; letter-spacing:.055em; text-shadow:0 1px 1px #000,0 2px 5px #000,0 0 6px #a34b37; white-space:nowrap;}
    #heroOrnateHud .ornate-ammo.empty {display:none;}
    #heroOrnateHud .ornate-ammo .ornate-ammo-sep {font-size:.75em; color:#a97660;}
    #heroOrnateHud .ornate-ammo .ornate-ammo-group {display:flex; flex-direction:column; align-items:center; gap:1px; line-height:.9;}
    #heroOrnateHud .ornate-ammo small {font-size:.37em; font-weight:700; letter-spacing:.16em; color:#b69a82; line-height:1.3;}
    #heroOrnateHud .ornate-ammo.is-reloading {font-size:clamp(8px,.84vw,17px); letter-spacing:.13em; color:#f8bd86;}
    #heroOrnateHud .ornate-weapon {position:absolute; left:77.0%; bottom:10.8%; width:9.5%; text-align:center; color:#e4b798; font:700 clamp(7px,.74vw,14px)/1.1 Oxanium,Rajdhani,'Arial Narrow',sans-serif; letter-spacing:.08em; text-shadow:0 1px 3px #000; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;}
    /* Keep existing gameplay prompts / dialogue, but hide older overlapping HUD cards. */
    body:not(.shop-mode) #topLeftHUD, body:not(.shop-mode) #minimapCanvas {visibility:hidden;}
    body.shop-mode .shop-topbar {top: min(26vh, 260px); right:12px; left:auto;}
    body.shop-mode .shop-actions {justify-content:flex-end;}
    @media(max-width:700px) { #heroOrnateHud .ornate-heart {font-size:clamp(9px,2.6vw,19px);} }
  `;
  function setup() {
    if ($('heroOrnateHud')) return;
    doc.head.appendChild(style);
    const layer=doc.createElement('div');
    layer.id='heroOrnateHud';
    layer.setAttribute('aria-label','Saafiya status HUD');
    layer.innerHTML=`<div class="ornate-stage">
      <img class="ornate-art" src="${IMAGE}" alt="" draggable="false" />
      <div class="ornate-hearts" role="img" aria-label="Vitality"></div>
      <div class="ornate-map"><canvas width="256" height="256" aria-label="Live local map"></canvas></div>
      <div class="ornate-weapon"></div><div class="ornate-ammo empty" aria-live="off"></div>
    </div>`;
    doc.body.appendChild(layer);
    const row=layer.querySelector('.ornate-hearts');
    for(let i=0;i<HEARTS;i++) {
      const heart=doc.createElement('div');
      heart.className='ornate-heart';
      heart.innerHTML='<span class="ornate-heart-base">♥</span><span class="ornate-heart-fill">♥</span>';
      row.appendChild(heart);
    }
    layer.querySelector('.ornate-art').addEventListener('error',()=>{
      // The HUD's live data still works; missing art is immediately diagnosable.
      root.console.warn('[Hero Shooter] HUD artwork missing: '+IMAGE);
    },{once:true});
    root.requestAnimationFrame(tick);
  }
  function snapshot() {
    if(doc.body.classList.contains('shop-mode')) return root.HeroShop?.getHudSnapshot?.() || null;
    return root.HeroHUDCombatState?.() || null;
  }
  function paintHearts(layer,s) {
    const max=Number(s.maxHealth), hp=Number(s.health);
    const pct=Number.isFinite(max)&&max>0&&Number.isFinite(hp)?clamp(hp/max,0,1):1;
    // A future starting disposition can override maxHearts (e.g. 8 for Bruiser).
    const slots=Number.isFinite(s.maxHearts)?Math.round(clamp(s.maxHearts,1,10)):HEARTS;
    const row=layer.querySelector('.ornate-hearts');
    while(row.children.length<slots) {
      const heart=doc.createElement('div');heart.className='ornate-heart';
      heart.innerHTML='<span class="ornate-heart-base">♥</span><span class="ornate-heart-fill">♥</span>';
      row.appendChild(heart);
    }
    while(row.children.length>slots) row.lastElementChild.remove();
    row.setAttribute('aria-label',`Vitality: ${Math.round(pct*100)}%; ${slots} hearts`);
    row.querySelectorAll('.ornate-heart-fill').forEach((el,i)=>{
      const fraction=clamp(pct*slots-i,0,1);
      el.style.clipPath=`inset(0 ${Math.round((1-fraction)*100)}% 0 0)`;
    });
  }
  function paintAmmo(layer,s) {
    const ammo=layer.querySelector('.ornate-ammo');
    const weapon=layer.querySelector('.ornate-weapon');
    const ready=Number.isFinite(s.ammo)&&Number.isFinite(s.spareMags);
    ammo.classList.toggle('empty',!ready);
    ammo.classList.toggle('is-reloading',Boolean(s.reloading));
    if (!ready) ammo.replaceChildren();
    else if (s.reloading) ammo.textContent='RELOADING';
    else {
      const count = (value,label) => {
        const group=doc.createElement('span');group.className='ornate-ammo-group';
        const amount=doc.createElement('strong');amount.textContent=String(Math.max(0,Math.trunc(value))).padStart(2,'0');
        const caption=doc.createElement('small');caption.textContent=label;
        group.append(amount,caption);return group;
      };
      const sep=doc.createElement('span');sep.className='ornate-ammo-sep';sep.textContent='/';
      ammo.replaceChildren(count(s.ammo,'ROUNDS'),sep,count(s.spareMags,'MAGS'));
    }
    weapon.textContent=s.weaponName || '';
  }
  function drawMap(layer,s) {
    const canvas=layer.querySelector('.ornate-map canvas');
    const g=canvas.getContext('2d');
    if (!g) return;
    const size=canvas.width,mid=size/2;
    g.clearRect(0,0,size,size);
    g.fillStyle='#10141a';g.fillRect(0,0,size,size);
    // World geometry rotates *under* the static HUD artwork's centre chevron.
    // Screen coordinates are Y-down: north-facing (-PI/2) => zero map rotation.
    // Facing east (0) => map rotates 90 degrees counterclockwise.
    const angle=Number.isFinite(s.angle)?s.angle:-Math.PI/2;
    g.save();
    g.translate(mid,mid);
    g.rotate(-angle-Math.PI/2);
    if (s.minimapCanvas && s.mapPosition) {
      // Legacy full-world canvas is re-centred at the player's live location.
      const p=s.mapPosition;
      const source=s.minimapCanvas;
      if (Number.isFinite(p.worldSize) && p.worldSize>0 && Number.isFinite(p.x) && Number.isFinite(p.y)) {
        const u=p.x/p.worldSize*source.width, v=p.y/p.worldSize*source.height;
        g.scale(2.9,2.9);
        g.imageSmoothingEnabled=true;
        g.drawImage(source,-u,-v);
      }
    } else if (s.localMap) {
      // Home & More prologue has no full-world radar. Draw its architectural
      // geometry in the same player-centred, player-relative orientation.
      const m=s.localMap,zoom=.20;
      g.strokeStyle='rgba(183,145,118,.12)';g.lineWidth=1;
      for(let p=-size*2;p<=size*2;p+=32){
        g.beginPath();g.moveTo(p,-size*2);g.lineTo(p,size*2);g.stroke();
        g.beginPath();g.moveTo(-size*2,p);g.lineTo(size*2,p);g.stroke();
      }
      for(const wall of m.walls||[]) {
        const x=(wall.x-m.x)*zoom,y=(wall.y-m.y)*zoom;
        const w=Math.max(1,(wall.w||4)*zoom),h=Math.max(1,(wall.h||4)*zoom);
        if(x>size*2||y>size*2||x+w< -size*2||y+h< -size*2)continue;
        g.fillStyle='#7b6256';g.fillRect(x,y,w,h);
      }
    }
    g.restore();
    // The chevron is already centred in the supplied transparent PNG. It
    // remains fixed: do not re-render or rotate a duplicate player arrow.
  }
  let lastRender=0;
  function tick(now) {
    const layer=$('heroOrnateHud');
    if(!layer)return;
    const s=snapshot();
    layer.style.display=s?'block':'none';
    if(s){
      drawMap(layer,s); // 60 fps smoothly rotating map; static chevron stays up.
      if(now-lastRender>100){paintHearts(layer,s);paintAmmo(layer,s);lastRender=now;}
    }
    root.requestAnimationFrame(tick);
  }
  root.HeroOrnateHUD={refresh:()=>{lastRender=-Infinity}};
  if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',setup,{once:true});
  else setup();
})(window);
