#!/usr/bin/env python3
"""Apply the authored Hero Shooter gothic HUD to a LOCAL clone of the repo.

Safe to re-run. Does not change your GitHub repository until you commit/push.
"""
from pathlib import Path
import shutil
import sys

bundle = Path(__file__).resolve().parent
repo = Path(sys.argv[1]).expanduser().resolve() if len(sys.argv)>1 else Path.cwd()
play = repo / 'public' / 'play'
required = ['index.html', 'shop.js', 'game.js', 'styles.css']
missing = [str(play / p) for p in required if not (play / p).is_file()]
if missing:
    sys.exit('Not a Hero Shooter checkout or required files missing:\n'+'\n'.join(missing))

def transform(path, fn):
    text=path.read_text(encoding='utf-8')
    modified=fn(text)
    if modified != text:
        path.write_text(modified,encoding='utf-8')
        print('Updated',path.relative_to(repo))
    else: print('Already patched',path.relative_to(repo))

def html_patch(s):
    snippet='    <script src="./ornate-hud.js" defer></script>\n    <script src="./weapon-quick-select.js" defer></script>\n'
    if snippet in s:return s
    if '<script src="./ornate-hud.js" defer></script>' in s:
        return s.replace('    <script src="./ornate-hud.js" defer></script>', snippet.rstrip(),1)
    anchor='    <script src="./entry.js" defer></script>'
    if anchor not in s: raise RuntimeError('Expected play/index.html script anchor missing')
    return s.replace(anchor,snippet+anchor,1)

def shop_patch(s):
    if 'function getHudSnapshot()' in s:return s
    anchor='  root.HeroShop={start,stop,frame,keydown,interact:doInteraction,cycleTarget};'
    if anchor not in s: raise RuntimeError('HeroShop export changed; update installer')
    fn='''  function getHudSnapshot() {
    if (!state || !state.loaded) return null;
    const p=state.player;
    return {
      health:Number.isFinite(p.hp)?p.hp:100,
      maxHealth:Number.isFinite(p.maxHp)?p.maxHp:100,
      maxHearts:Number.isFinite(p.maxHearts)?p.maxHearts:6,
      ammo:Number.isFinite(p.ammo)?p.ammo:null,
      spareMags:Number.isFinite(p.spareMags)?p.spareMags:null,
      weaponName:p.weaponName||'',
      angle:p.angle,
      localMap:{x:p.x,y:p.y,walls:floorObjects(state.geometry.walls).map(o=>({x:o.x,y:o.y,w:o.width||o.w,h:o.height||o.h}))}
    };
  }
'''
    return s.replace(anchor,fn+anchor.replace('cycleTarget};','cycleTarget,getHudSnapshot};'),1)

def game_patch(s):
    if 'window.HeroHUDCombatState = function' in s:return s
    anchor='            window.selectCampaign = selectCampaign;'
    if anchor not in s: raise RuntimeError('Legacy game.js export anchor changed; update installer')
    fn='''            // Read-only bridge for the ornate HUD: one source of truth for combat values.
            window.HeroHUDCombatState = function () {
                if (!player || gameState !== 'playing') return null;
                return {
                    health:player.hp,
                    maxHealth:player.maxHp,
                    maxHearts:player.maxHearts ?? 6,
                    ammo:player.ammo,
                    spareMags:player.spareMags,
                    reloading:player.reloading,
                    weaponName:player.weapon?.name || '',
                    angle:player.angle,
                    minimapCanvas:miniCanvas,
                    mapPosition:{x:player.x,y:player.y,worldSize:WORLD_SIZE}
                };
            };
'''
    return s.replace(anchor,fn+anchor,1)

transform(play/'index.html',html_patch)
transform(play/'shop.js',shop_patch)
transform(play/'game.js',game_patch)
for module in ('ornate-hud.js','weapon-quick-select.js'):
    dest=play/module;shutil.copy2(bundle/module,dest);print('Installed',dest.relative_to(repo))
asset_dir=play/'assets'/'ui';asset_dir.mkdir(parents=True,exist_ok=True)
asset=asset_dir/'hero_shooter_hud_transparent.png'
shutil.copy2(bundle/'assets'/'ui'/'hero_shooter_hud_transparent.png',asset)
print('Installed',asset.relative_to(repo))
weapons_dir=asset_dir/'weapons';weapons_dir.mkdir(parents=True,exist_ok=True)
for icon in (bundle/'assets'/'ui'/'weapons').glob('*.png'):
    target=weapons_dir/icon.name;shutil.copy2(icon,target);print('Installed',target.relative_to(repo))
print('Patch applied. Run: npm run check && npm test && npm run build')
