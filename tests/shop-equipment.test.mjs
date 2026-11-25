import test from 'node:test';
import assert from 'node:assert/strict';
import '../public/play/shop-equipment.js';
const E=globalThis.HeroShopEquipment;
test('canonical inventory has limited starting ownership and real HUD ammo',()=>{
 const s=E.create();
 assert.deepEqual(s.owned,['beretta_84fs','sw_revolver_engraved']);
 assert.equal(E.getHud(s).ammo,9);
 assert.equal(E.getHud(s).spareMags,3);
 assert.equal(E.equip(s,'norinco_akm'),false);
 assert.equal(E.equip(s,'sw_revolver_engraved'),true);
 assert.equal(E.getHud(s).weaponName,'ENGRAVED REVOLVER');
});
test('reload finishes after countdown, updates only equipped magazine',()=>{
 const s=E.create();
 E.equip(s,'beretta_84fs');
 assert.equal(E.consumeRound(s),true);
 assert.equal(E.getHud(s).ammo,8);
 assert.equal(E.reload(s),false); // magazine full
 E.consumeRound(s); E.consumeRound(s);
 assert.equal(E.reload(s),true);
 assert.equal(E.getHud(s).reloading,true);
 assert.equal(E.consumeRound(s),false);
 E.update(s,0.5);
 assert.equal(E.getHud(s).ammo,6);
 E.update(s,0.8);
 assert.equal(E.getHud(s).ammo,8);
 assert.equal(E.getHud(s).spareMags,2);
});
test('no ammo for knives and no firing while holstered',()=>{
 const s=E.create({armoryTest:true});
 assert.equal(E.consumeRound(s),false);
 assert.equal(E.equip(s,'spetsnaz_sf'),true);
 assert.equal(E.getHud(s).ammo,null);
 assert.equal(E.reload(s),false);
 assert.equal(E.consumeRound(s),false);
});
test('story acquisition and save/restore preserve individual inventories',()=>{
 const s=E.create();
 assert.equal(E.grant(s,'pump_shotgun'),true);
 E.equip(s,'pump_shotgun'); E.consumeRound(s);
 const restored=E.restore(JSON.parse(JSON.stringify(E.serialize(s))));
 assert.equal(E.getHud(restored).weaponId,'pump_shotgun');
 assert.equal(E.getHud(restored).ammo,4);
 assert.equal(restored.owned.includes('canik_tp9'),false);
 assert.equal(E.equip(restored,'no_such_item'),false);
});
test('malformed saved counts are clamped and reloading is not restored',()=>{
 const s=E.restore({owned:['beretta_84fs'],magazines:{beretta_84fs:{rounds:9000,spareMags:-15}},reloading:{seconds:1000}});
 assert.equal(E.getHud(s).ammo,9);
 assert.equal(E.getHud(s).spareMags,0);
 assert.equal(E.getHud(s).reloading,false);
});
