/* Hero Shooter — quick-selector art integration, v2.
 * Separate, transparent UI icons; no baked-in backgrounds or ammunition.
 * The currently playable Home & More prologue has no weapon-equipping system.
 * Selection therefore emits a read-only intent event (does not grant gear).
 */
(function (root) {
  'use strict';
  const doc = root.document;
  const ASSET_BASE = './assets/ui/weapons/';
  const catalog = Object.freeze([
    { id: 'beretta_84fs', label: 'Beretta 84FS · nickel / black grip' },
    { id: 'pump_shotgun', label: 'Pump-action shotgun · wooden furniture' },
    { id: 'norinco_akm', label: 'NORINCO AKM · wood stock' },
    { id: 'canik_tp9', label: 'CANIK TP9 · threaded muzzle' },
    { id: 'sw_revolver_engraved', label: 'Engraved S&W revolver · black / gold' },
    { id: 'fairbairn_sykes', label: 'Fairbairn–Sykes fighting knife' },
    { id: 'spetsnaz_sf', label: 'Spetsnaz SF combat knife' },
    { id: 'akm_bayonet', label: 'AKM-pattern bayonet · wooden grip' }
  ]);
  const byId = new Map(catalog.map(item => [item.id, item]));
  const directions = ['up', 'right', 'down', 'left'];
  const positions = {
    up: [5.55, 76.50, 4.50, 7.00],
    right: [10.03, 83.30, 4.35, 7.20],
    down: [5.55, 90.40, 4.50, 7.20],
    left: [1.13, 83.30, 4.35, 7.20]
  };
  // Two visible banks of four. As the narrative inventory is implemented,
  // call setPages(...) with the items actually owned by the player.
  let pages = [catalog.slice(0, 4).map(x => x.id), catalog.slice(4, 8).map(x => x.id)];
  let page = 0, selected = -1;
  let panel = null;
  const $ = id => doc.getElementById(id);
  const style = doc.createElement('style');
  style.textContent = `
    #heroOrnateHud .hero-quick-slot { position:absolute; display:flex; align-items:center;
      justify-content:center; padding:0; margin:0; background:transparent; border:0;
      cursor:pointer; pointer-events:auto; user-select:none; -webkit-tap-highlight-color:transparent; }
    #heroOrnateHud .hero-quick-slot img { display:block; width:94%; height:94%; object-fit:contain;
      filter:drop-shadow(0 1px 2px rgba(0,0,0,.85)); transition:filter .14s ease,transform .14s ease; }
    #heroOrnateHud .hero-quick-slot[data-selected="true"] img { transform:scale(1.08);
      filter:drop-shadow(0 0 5px rgba(255,90,91,.9)) drop-shadow(0 1px 3px #000); }
    #heroOrnateHud .hero-quick-slot:focus-visible { outline:2px solid #ffb68c; outline-offset:1px; }
    #heroOrnateHud .hero-quick-pager { position:absolute; left:7.04%; top:84.55%; width:1.62%;
      height:3.4%; display:flex; align-items:center; justify-content:center;
      padding:0; margin:0; border:none; background:transparent; color:#e4b394; cursor:pointer;
      text-shadow:0 1px 3px #050405; font:700 clamp(6px,.55vw,12px) Georgia,serif;
      pointer-events:auto; }
    #heroOrnateHud .hero-quick-pager:focus-visible { outline:2px solid #ffb68c; }
    @media(max-width:700px) { #heroOrnateHud .hero-quick-slot img {width:100%;height:100%;} }
  `;
  function emitSelection() {
    const id = pages[page]?.[selected];
    if (!id) return;
    // This event is intentionally NOT an equip mutation. Combat logic can
    // subscribe once inventory/weapon switching is part of the playable game.
    root.dispatchEvent(new CustomEvent('hero-quick-selector:select', {
      detail: { itemId:id, direction:directions[selected], page, slot:selected,
        previewOnly:!root.HeroInventory?.equipQuickSlot }
    }));
    if (root.HeroInventory?.equipQuickSlot) root.HeroInventory.equipQuickSlot(id,selected);
  }
  function render() {
    if (!panel) return;
    panel.querySelectorAll('.hero-quick-slot').forEach((btn,i) => {
      const id=pages[page]?.[i];
      const item=byId.get(id);
      btn.dataset.selected = String(i===selected);
      btn.setAttribute('aria-pressed', String(i===selected));
      btn.disabled = !item;
      btn.setAttribute('aria-label', item ? `${directions[i]}: ${item.label}` : `${directions[i]}: Empty`);
      btn.title = item?.label || 'Empty';
      const img=btn.querySelector('img');
      img.style.display=item?'block':'none';
      if(item) { img.src=ASSET_BASE+item.id+'.png'; img.alt=item.label; }
    });
    const b=panel.querySelector('.hero-quick-pager');
    b.textContent=`${page+1}/${pages.length}`;
    b.setAttribute('aria-label',`Quick selector page ${page+1} of ${pages.length}; click to change page`);
  }
  function select(index) {
    if (!Number.isInteger(index) || index<0 || index>3) return false;
    if (!byId.has(pages[page]?.[index])) return false;
    selected=index;
    render();
    emitSelection();
    return true;
  }
  function switchPage(index) {
    if (!Number.isInteger(index) || index<0 || index>=pages.length) return false;
    page=index;
    selected=-1;
    render();
    return true;
  }
  function setPages(nextPages) {
    if (!Array.isArray(nextPages) || !nextPages.length) return false;
    if (!nextPages.every(p=>Array.isArray(p) && p.length<=4 && p.every(id=>id==null || byId.has(id)))) return false;
    pages = nextPages.map(p=>Array.from({length:4},(_,i)=>p[i]??null));
    switchPage(0);
    return true;
  }
  function attach() {
    const stage=$('heroOrnateHud')?.querySelector('.ornate-stage');
    if(!stage || stage.querySelector('#heroWeaponQuickPanel')) return;
    doc.head.appendChild(style);
    panel=doc.createElement('div');
    panel.id='heroWeaponQuickPanel';
    panel.setAttribute('aria-label','Four-direction equipment selector');
    panel.style.cssText='position:absolute;inset:0;pointer-events:none;';
    for(let i=0;i<4;i++) {
      const dir=directions[i];
      const [left,top,width,height]=positions[dir];
      const btn=doc.createElement('button');
      btn.type='button';btn.className='hero-quick-slot';
      btn.style.cssText=`left:${left}%;top:${top}%;width:${width}%;height:${height}%;`;
      const img=doc.createElement('img'); img.draggable=false; img.loading='eager';
      btn.appendChild(img);
      btn.addEventListener('click',()=>select(i));
      panel.appendChild(btn);
    }
    const pager=doc.createElement('button');
    pager.type='button';pager.className='hero-quick-pager';
    pager.addEventListener('click',()=>switchPage((page+1)%pages.length));
    panel.appendChild(pager);
    stage.appendChild(panel);
    render();
    root.addEventListener('keydown',e=>{
      if(e.altKey||e.ctrlKey||e.metaKey||e.repeat) return;
      if(['INPUT','TEXTAREA','SELECT'].includes(e.target?.tagName))return;
      if($('heroOrnateHud')?.style.display==='none')return;
      // Avoid conflicting with WASD, dialogue navigation, reload and melee.
      const digit=/^Digit([1-4])$/.exec(e.code);
      if(digit){select(Number(digit[1])-1);return;}
      if(e.code==='BracketRight' || e.code==='BracketLeft') {
        switchPage((page+(e.code==='BracketRight'?1:pages.length-1))%pages.length);
      }
    });
  }
  root.HeroQuickSelector=Object.freeze({
    catalog:catalog.map(c=>({...c})),
    setPages,
    showPage:switchPage,
    select,
    getState:()=>({page,selected,pages:pages.map(p=>p.slice()),selectedId:selected<0?null:pages[page][selected]})
  });
  if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',attach,{once:true});
  else attach();
})(window);
