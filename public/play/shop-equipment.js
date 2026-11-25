/* Home & More equipment state.
 * Presentation-only gameplay resource accounting; the peaceful prologue does
 * not permit attacks against shop NPCs. Items unlock via authored story events.
 * Exposes a pure API for the live HUD, quick-selector, and save/load system.
 */
(function (root) {
  'use strict';
  const defs = Object.freeze({
    beretta_84fs:         { name: 'BERETTA 84FS', magazine: 8, startRounds: 9, startMags: 3, reloadSeconds: 1.25 },
    pump_shotgun:         { name: 'PUMP SHOTGUN', magazine: 5, startRounds: 5, startMags: 2, reloadSeconds: 1.7 },
    norinco_akm:          { name: 'NORINCO AKM', magazine: 30, startRounds: 30, startMags: 2, reloadSeconds: 1.9 },
    canik_tp9:            { name: 'CANIK TP9', magazine: 15, startRounds: 15, startMags: 2, reloadSeconds: 1.4 },
    sw_revolver_engraved: { name: 'ENGRAVED REVOLVER', magazine: 5, startRounds: 5, startMags: 3, reloadSeconds: 1.8 },
    fairbairn_sykes:      { name: 'F–S KNIFE', magazine: 0 },
    spetsnaz_sf:          { name: 'SF KNIFE', magazine: 0 },
    akm_bayonet:          { name: 'AKM BAYONET', magazine: 0 }
  });
  const known = Object.keys(defs);
  const initialOwned = Object.freeze(['beretta_84fs', 'sw_revolver_engraved']);
  const clampInt = (value, low, high) => Number.isFinite(value) ? Math.max(low, Math.min(high, Math.trunc(value))) : low;
  const makeRecord = id => ({ rounds: defs[id].startRounds ?? 0, spareMags: defs[id].startMags ?? 0 });

  function create({ armoryTest = false } = {}) {
    const owned = armoryTest ? known.slice() : initialOwned.slice();
    return {
      owned,
      equipped: 'beretta_84fs',
      holstered: true,
      magazines: Object.fromEntries(owned.filter(id => defs[id].magazine > 0).map(id => [id, makeRecord(id)])),
      reloading: null,
      shotsUsed: 0
    };
  }
  function owns(state, id) { return Boolean(state && defs[id] && state.owned.includes(id)); }
  function equip(state, id) {
    if (!owns(state, id)) return false;
    if (state.reloading) return false;
    state.equipped = id;
    state.holstered = false;
    return true;
  }
  function holster(state) {
    if (!state || !owns(state,state.equipped)) return false;
    state.holstered = !state.holstered;
    return !state.holstered;
  }
  function grant(state, id) {
    if (!state || !defs[id]) return false;
    if (owns(state,id)) return true;
    state.owned.push(id);
    if (defs[id].magazine) state.magazines[id] = makeRecord(id);
    return true;
  }
  function reload(state) {
    if (!state || state.reloading) return false;
    const id = state.equipped, spec = defs[id], mag = state.magazines[id];
    if (!spec?.magazine || !mag || mag.spareMags < 1 || mag.rounds >= spec.magazine) return false;
    state.reloading = { id, seconds: spec.reloadSeconds };
    return true;
  }
  function update(state, dt) {
    if (!state?.reloading || !Number.isFinite(dt) || dt <= 0) return false;
    state.reloading.seconds -= dt;
    if (state.reloading.seconds > 0) return false;
    const id = state.reloading.id;
    const mag = state.magazines[id];
    if (mag && mag.spareMags > 0) {
      mag.spareMags -= 1;
      mag.rounds = defs[id].magazine;
    }
    state.reloading = null;
    return true;
  }
  function consumeRound(state) {
    if (!state || state.holstered || state.reloading) return false;
    const mag = state.magazines[state.equipped];
    if (!mag || mag.rounds < 1) return false;
    mag.rounds--;
    state.shotsUsed++;
    return true;
  }
  function getHud(state) {
    if (!state) return null;
    const id=state.equipped,spec=defs[id],mag=state.magazines[id];
    return {
      weaponId:id,
      weaponName:spec?.name || '',
      ammo:mag?.rounds ?? null,
      spareMags:mag?.spareMags ?? null,
      reloading:Boolean(state.reloading),
      holstered:Boolean(state.holstered),
      owned:state.owned.slice()
    };
  }
  function serialize(state) {
    if (!state) return null;
    return { owned:state.owned.slice(), equipped:state.equipped, holstered:Boolean(state.holstered),
      magazines:Object.fromEntries(Object.entries(state.magazines).map(([id,mag])=>[id,{rounds:mag.rounds,spareMags:mag.spareMags}])),
      shotsUsed:state.shotsUsed };
  }
  function restore(saved, { armoryTest = false } = {}) {
    const state=create({armoryTest});
    if (!saved || typeof saved !== 'object') return state;
    const valid=Array.isArray(saved.owned) ? [...new Set(saved.owned.filter(id=>defs[id]))] : [];
    for(const id of valid) grant(state,id);
    if (typeof saved.equipped === 'string' && owns(state,saved.equipped)) state.equipped=saved.equipped;
    state.holstered=Boolean(saved.holstered);
    for(const id of state.owned){
      const spec=defs[id],mag=saved.magazines?.[id];
      if(!spec.magazine || !mag)continue;
      state.magazines[id]={
        rounds:clampInt(mag.rounds,0,spec.magazine+1),
        spareMags:clampInt(mag.spareMags,0,99)
      };
    }
    state.shotsUsed=clampInt(saved.shotsUsed,0,999999);
    // Test-mode inventory cannot be written into normal story progress.
    if (!armoryTest) {
      state.owned=state.owned.filter(id=>!saved.armoryTestOnly?.includes(id));
      if (!owns(state,state.equipped)) state.equipped='beretta_84fs';
    }
    return state;
  }
  root.HeroShopEquipment = Object.freeze({ defs, create, owns, equip, holster, grant, reload, update, consumeRound, getHud, serialize, restore });
})(typeof window === 'undefined' ? globalThis : window);
