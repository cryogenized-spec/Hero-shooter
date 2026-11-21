/* Shared sprite renderer ported faithfully from Codex's Hero Shooter PR #8.
   The approved procedural shapes and stride animation are reused in the new Home & More scene. */
(function (root) {
'use strict';
function paintSpritePath(ctx, fill, outline = '#11181c') {
    ctx.fillStyle = fill;
    ctx.fill();
    if (outline) {
        ctx.strokeStyle = outline;
        ctx.stroke();
    }
}

function drawSpriteEllipse(ctx, x, y, rx, ry, rotation, fill, outline) {
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, rotation, 0, Math.PI * 2);
    paintSpritePath(ctx, fill, outline);
}

function drawSpriteBoot(ctx, x, y, hipY) {
    ctx.strokeStyle = '#30383e';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-6, hipY);
    ctx.lineTo(x, y);
    ctx.stroke();

    ctx.lineWidth = 1.35;
    ctx.beginPath();
    ctx.roundRect(x - 4.5, y - 3.4, 9, 6.8, 1.6);
    paintSpritePath(ctx, '#232d37');
    ctx.fillStyle = '#697682';
    ctx.fillRect(x + 0.5, y - 2.2, 1.2, 4.4);
}

function drawSpriteBox(ctx, x, y, width, height, radius, fill, outline) {
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, radius);
    paintSpritePath(ctx, fill, outline);
}

function updateSpriteWalk(actor, previousX, previousY, dt, strideLength, maxTravel) {
    const dx = actor.x - previousX;
    const dy = actor.y - previousY;
    const travel = Math.min(Math.hypot(dx, dy), maxTravel);
    const stepping = travel > 0.01;
    if (stepping) {
        actor.walkPhase = (actor.walkPhase + travel * 2 * Math.PI / strideLength) % (2 * Math.PI);
        actor.walkAngle = Math.atan2(dy, dx);
    }
    actor.walkBlend += ((stepping ? 1 : 0) - actor.walkBlend) * (1 - Math.exp(-18 * dt));
}

function drawSpriteFootwork(ctx, actor, strideSize, rear, stanceWidth, secondStride = 1) {
    const stride = actor.walkBlend ? Math.sin(actor.walkPhase) * actor.walkBlend * strideSize : 0;
    const relativeAngle = (actor.walkAngle ?? actor.angle) - actor.angle;
    const fore = Math.cos(relativeAngle) * stride;
    const side = Math.sin(relativeAngle) * stride * 0.55;
    drawSpriteBoot(ctx, rear - fore, -stanceWidth - side, -stanceWidth);
    drawSpriteBoot(ctx, rear + fore * secondStride, stanceWidth + side * secondStride, stanceWidth);
}

// Garment, trim, skin and hair colors distinguish the in-world roles.
const NPC_SPRITE_COLORS = {
    chen: ['#4e6370', '#92a4ac', '#dfaa81', '#7f7a74'],
    assistant: ['#466862', '#82a399', '#ab7355', '#2c252a'],
    cashier: ['#977139', '#e6c479', '#d7a17b', '#332529'],
    manager: ['#71566c', '#b498a6', '#83583f', '#24212a'],
    young_g: ['#334d77', '#78a9d4', '#e0ae78', '#593621'],
    young_blaze: ['#8c4935', '#e3a277', '#e8b386', '#9c3b31'],
    airsoft_adult: ['#526447', '#97a778', '#c68e68', '#36382b'],
    security: ['#355580', '#91b7dc', '#a87256', '#292832'],
    blockade_goon: ['#773b40', '#b76a60', '#925a43', '#2c2426'],
    hostage_taker: ['#76503c', '#b47b65', '#a56950', '#322a28'],
    looter: ['#703b45', '#a8626b', '#b77959', '#27232a'],
    melee_looter: ['#695250', '#b3876f', '#b98257', '#35292b'],
    looter_unarmed: ['#505f70', '#8d9aa4', '#926047', '#29272b'],
    spotter: ['#8c703c', '#c9aa62', '#a57050', '#352c29'],
    thermal: ['#f8fafc', '#d0d9e2', '#ffffff', '#a6b4c3']
};

// Draw in local coordinates with +X pointing in the aim direction.
function drawHumanNpc(ctx, actor, colors, outline, pose, prop, thermal = false) {
    const [coat, trim, skin, hair] = colors;
    const lowered = pose === 'kneeling' || pose === 'cover';
    const handsUp = pose === 'kneeling';
    ctx.save();
    ctx.lineWidth = 1.35;
    ctx.lineJoin = 'round';
    ctx.scale(actor.radius / 14, actor.radius / 14);

    drawSpriteEllipse(ctx, -3, 2, 17, 14.5, 0, '#090d1659', null);
    if (lowered) {
        drawSpriteBoot(ctx, -11, -8, -7);
        drawSpriteBoot(ctx, -11, 8, 7);
        ctx.scale(0.83, 0.91);
    } else {
        const secondStride = actor.woundedSpeedFactor < 1 ? 0.38 : 1;
        drawSpriteFootwork(ctx, actor, 4.5, -14, 7.5, secondStride);
    }

    if (thermal) {
        ctx.shadowColor = '#ffffff';
        ctx.shadowBlur = 12;
    }
    ctx.beginPath();
    ctx.moveTo(-13, -7);
    ctx.quadraticCurveTo(-10, -13, -2, -13);
    ctx.quadraticCurveTo(10, -13, 10, 0);
    ctx.quadraticCurveTo(10, 13, -2, 13);
    ctx.quadraticCurveTo(-10, 13, -13, 7);
    ctx.closePath();
    paintSpritePath(ctx, coat, outline);
    ctx.shadowBlur = 0;
    ctx.fillStyle = trim;
    ctx.fillRect(-10, -8, 2, 16);
    ctx.fillRect(-7, -10, 6, 1.4);
    ctx.fillRect(-7, 8.6, 6, 1.4);

    const armX = prop === 'none' && !handsUp ? -1 : 5;
    const handX = handsUp ? 7 : armX + 5;
    const handY = handsUp ? 12 : (prop === 'none' ? 12 : 6);
    drawSpriteEllipse(ctx, armX, -9, 7.6, 3.7, 0.48, coat);
    drawSpriteEllipse(ctx, armX, 9, 7.6, 3.7, -0.48, coat);
    drawSpriteEllipse(ctx, handX, -handY, 3, 2.8, 0, skin);
    drawSpriteEllipse(ctx, handX, handY, 3, 2.8, 0, skin);

    if (prop === 'crate') {
        drawSpriteBox(ctx, 9, -9, 13, 18, 1, '#8e5d35', '#d6a260');
        ctx.fillStyle = '#bd8b58';
        ctx.fillRect(11, -3, 9, 1.4);
        ctx.fillRect(11, 2, 9, 1.4);
    } else if (prop === 'blade') {
        drawSpriteBox(ctx, 10, 3, 5, 3.5, 1, '#374151');
        drawSpriteBox(ctx, 15, 3.5, 8, 2.4, 1, '#cbd5e1');
    } else if (prop !== 'none') {
        const long = prop === 'long' || prop === 'airsoft';
        drawSpriteBox(ctx, 9, -2.5, long ? 17 : 12, 5, 1, '#29343f');
        ctx.fillStyle = '#738391';
        ctx.fillRect(12, -1.5, long ? 9 : 5, 1.2);
        if (prop === 'airsoft') {
            ctx.fillStyle = '#f97316';
            ctx.fillRect(24, -1.5, 2, 3);
        }
    }

    drawSpriteEllipse(ctx, 1.3, 0, 7.9, 7.5, 0, skin);
    ctx.beginPath();
    ctx.moveTo(6, -5.7);
    ctx.quadraticCurveTo(-3, -10, -6.5, -3);
    ctx.quadraticCurveTo(-9, 3.5, -3, 6.7);
    ctx.lineTo(-1.7, -1.5);
    ctx.lineTo(2, -1);
    ctx.closePath();
    paintSpritePath(ctx, hair);
    ctx.fillStyle = thermal ? '#a6b4c3' : '#3d2a29';
    ctx.fillRect(5.1, -2.3, 1.3, 1.3);
    ctx.fillRect(6.2, 1.7, 1.3, 1.1);
    ctx.restore();
}


function drawMallCFeet(ctx, actor) {
    // Move the feet along the travel direction while the torso tracks aim.
    drawSpriteEllipse(ctx, -3, 2, 18, 15.5, 0, '#090d1659', null);
    drawSpriteFootwork(ctx, actor, actor.isSneaking ? 2.6 : 5, -15, 8);
}

// Hand-pixelled overhead portrait. Rows run from bun to chin, facing down.
const cPortrait = [
    '        ...  ',
    '      ..rrr..',
    '     .rbacbbr.',
    '    .rbacbbrrr.',
    '    .rcbrracbr.',
    '   .rbrraacrbr.',
    '    .rrbcbrrr.',
    '   ..rrrtttrr..',
    '  .rbbbaaabbbrr.',
    ' .rbacbbrraabrrr.',
    '.rracbbrrraabbbrr.',
    '.rbcbbrrrbbaacbrr.',
    '.rbbrraabbbbacbrr.',
    '.rbrraabrrrrabrrr.',
    '.rr..mmmmmmm..rrr.',
    '.r.mzzm.mmzzm..rr.',
    ' .mGggmttmGggm.r.',
    ' .mggdm..mggdm.r.',
    ' .r...brrb...rrr.',
    ' .rsbbffffbbfsr.',
    '  .sf.dfssf.ds.',
    '  .sfffsffsfss.',
    '   .sffhffhss.',
    '    .sffssfs.',
    '      .sss.',
];
const cInks = {
    '.': '#20181c', r: '#442526', b: '#743a2c', a: '#ad5735', c: '#dc8650',
    z: '#989196', t: '#302d36', m: '#47444a', s: '#b87555', f: '#e3a17a', h: '#f6c39a',
    d: '#183221', g: '#509a45', G: '#c8f883'
};

// Batch adjacent pixels into strips once, outside the animation loop.
const forehead = ['.rbrabcbbrrabbbrr.', '.rrbabbrrrabbrbrr.', ' .rbbrrrabbrfsrr.', ' .rrbbrbbffhfsr.', ' .rsrrbfffhhfsr.'];
const barePortrait = [...cPortrait.slice(0, 14), ...forehead, ...cPortrait.slice(19)];
const portraitStrips = rows => rows.flatMap((row, y) =>
    Array.from(row.matchAll(/([^ ])\1*/g), match => ({
        x: match.index - 9, y: y - 15, width: match[0].length, ink: cInks[match[1]]
    }))
);

const cHeadBare = portraitStrips(barePortrait);
const cHeadGoggles = portraitStrips(cPortrait);

function drawCHead(ctx, goggles) {
    ctx.save();
    ctx.rotate(-Math.PI / 2);
    for (const strip of (goggles ? cHeadGoggles : cHeadBare)) {
        ctx.fillStyle = strip.ink;
        ctx.fillRect(strip.x, strip.y, strip.width, 1);
    }
    ctx.restore();
}

function drawMallCBody(ctx, actor) {
    ctx.lineJoin = 'round';
    ctx.lineWidth = 1.35;
    ctx.save();
    ctx.translate(Math.cos(actor.walkPhase * 2) * 0.8 * actor.walkBlend, 0);

    // Olive flannel, with the carrier drawn only after the go-bag is recovered.
    ctx.beginPath();
    ctx.moveTo(-15, -9);
    ctx.lineTo(-7, -14);
    ctx.lineTo(4, -13);
    ctx.quadraticCurveTo(13, 0, 4, 13);
    ctx.lineTo(-7, 14);
    ctx.lineTo(-15, 9);
    ctx.closePath();
    paintSpritePath(ctx, '#596840', actor.isSneaking ? '#34d399' : '#11181c');

    ctx.beginPath();
    if (actor.hasMolleVest) {
        ctx.roundRect(-13, -10, 17, 20, 2);
        paintSpritePath(ctx, '#3d4b35');
        ctx.fillStyle = '#86946c';
        ctx.fillRect(-11, -7, 8, 1.4);
        ctx.fillRect(-11, -0.7, 8, 1.4);
        ctx.fillRect(-11, 5.6, 8, 1.4);
    } else {
        ctx.moveTo(-13, -6); ctx.lineTo(4, -6);
        ctx.moveTo(-13, 6); ctx.lineTo(4, 6);
        ctx.moveTo(-9, -12); ctx.lineTo(-9, 12);
        ctx.moveTo(-3, -12); ctx.lineTo(-3, 12);
        ctx.strokeStyle = '#35432f';
        ctx.lineWidth = 1.5;
        ctx.stroke();
    }
    ctx.restore();

    for (const side of [-1, 1]) {
        ctx.save();
        // Each shoulder is a pivot. Empty hands rest just outside the hips.
        ctx.translate(1, side * 11);
        const swing = Math.sin(actor.walkPhase) * actor.walkBlend * 0.18;
        ctx.rotate(actor.weaponVisible ? -side * 0.56 : side * (2.70 + side * swing));
        drawSpriteEllipse(ctx, 3.8, 0, 6, 3.5, 0, '#584c43');
        drawSpriteBox(ctx, 6, -2.6, 4, 5.2, 1, '#b58161');
        drawSpriteBox(ctx, 9, -2.7, 4.8, 5.4, 1.5, '#393137');
        drawSpriteBox(ctx, 12, -2, 2.8, 4, 1, '#d99a71');
        ctx.restore();
    }
    if (actor.weaponVisible) {
        drawSpriteBox(ctx, 11, -2.5, 6.5, 5.6, 1.6, '#302830');
        drawSpriteBox(ctx, 13.2, -2.3, 12.2, 4.6, 0.8, '#ae4369');
        ctx.fillStyle = '#f48bad';
        ctx.fillRect(14, -1.8, 10.2, 1);
        ctx.fillStyle = '#443844';
        ctx.fillRect(18, -0.7, 3.4, 1.6);
        ctx.fillRect(15, 0, 0.7, 1.6);
        ctx.fillRect(16.4, 0, 0.7, 1.6);
        drawSpriteBox(ctx, 24.6, -1.9, 1.7, 3.8, 0.4, '#403b43');
        if (actor.flashlightOn) {
            ctx.fillStyle = '#ffefaf';
            ctx.fillRect(25, 1.2, 1.8, 1);
        }
    }

    // A folded, checked scarf frames the head and stays visible at play scale.
    drawSpriteEllipse(ctx, 1, 0, 9.8, 11.4, 0, '#887565');
    ctx.fillStyle = '#dfc8ac';
    for (const side of [-1, 1]) {
        ctx.fillRect(-4, side * 9, 3, 1.6);
        ctx.fillRect(1, side * 10, 3, 1.6);
        ctx.fillRect(5, side * 8, 2, 1.6);
    }
    drawCHead(ctx, actor.nvgEquipped);
}


function drawDogSprite(ctx, dog) {
    const stride = Math.sin(dog.walkPhase) * dog.walkBlend * 3.5;
    ctx.lineWidth = 1.4;
    ctx.lineJoin = 'round';
    drawSpriteEllipse(ctx, -2, 2, 18, 9, 0, '#090d1659', null);
    drawSpriteBox(ctx, -12 - stride, -8, 7, 4, 2, '#52392f');
    drawSpriteBox(ctx, -12 + stride, 4, 7, 4, 2, '#52392f');
    drawSpriteBox(ctx, 4 + stride, -8, 7, 4, 2, '#6c4933');
    drawSpriteBox(ctx, 4 - stride, 4, 7, 4, 2, '#6c4933');
    ctx.strokeStyle = '#52392f';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-10, 0);
    ctx.quadraticCurveTo(-16, 0, -20, stride - 2);
    ctx.stroke();
    ctx.lineWidth = 1.4;
    drawSpriteEllipse(ctx, -2, 0, 12, 6.8, 0, '#8d6245');
    drawSpriteEllipse(ctx, 10, 0, 6.1, 5.2, 0, '#674634');
    ctx.beginPath();
    ctx.moveTo(8, -2.5); ctx.lineTo(5, -7); ctx.lineTo(12, -4.8);
    ctx.lineTo(12, 4.8); ctx.lineTo(5, 7); ctx.lineTo(8, 2.5);
    ctx.closePath();
    paintSpritePath(ctx, '#4d372d');
    drawSpriteBox(ctx, 12, -2.4, 5, 4.8, 1.5, '#4d372d');
}

function normalize(actor) {
  if (!Number.isFinite(actor.walkPhase)) actor.walkPhase=0;
  if (!Number.isFinite(actor.walkBlend)) actor.walkBlend=0;
  if (!Number.isFinite(actor.walkAngle)) actor.walkAngle=Number.isFinite(actor.angle)?actor.angle:0;
  if (!Number.isFinite(actor.angle)) actor.angle=0;
  if (!Number.isFinite(actor.radius)) actor.radius=14;
  if (!Number.isFinite(actor.woundedSpeedFactor)) actor.woundedSpeedFactor=1;
}
let civilianAtlas, armedCivilianAtlas;
function drawC(ctx, actor) {
  // Both atlases portray C before she acquires the tactical carrier and goggles.
  // Keep the procedural renderer for other equipped weapons and later gear.
  const glockReady=actor.weaponVisible && actor.weaponId==='glock26';
  const atlasEligible=actor.gait && (!actor.weaponVisible || glockReady) &&
    !actor.nvgEquipped && !actor.hasMolleVest && typeof Image!=='undefined';
  if (atlasEligible) {
    if (glockReady && !armedCivilianAtlas) {
      armedCivilianAtlas=new Image();
      armedCivilianAtlas.src=new URL('c-glock-ready.svg',document.baseURI).href;
    } else if (!glockReady && !civilianAtlas) {
      civilianAtlas=new Image();
      civilianAtlas.src=new URL('c-civilian.svg',document.baseURI).href;
    }
    const atlas=glockReady?armedCivilianAtlas:civilianAtlas;
    if (atlas.complete && atlas.naturalWidth) {
      const idle=actor.gait==='idle';
      // Unarmed C faces where she last walked; armed C faces her aim direction.
      const angle=glockReady ? actor.angle :
        (idle ? (actor.lastTravelFacing ?? actor.angle) : actor.walkAngle);
      if (!idle && !glockReady) actor.lastTravelFacing=angle;
      const direction=((Math.round((angle-Math.PI/2)/(Math.PI/4))%8)+8)%8;
      const gait=idle?0:actor.gait==='run'?2:1;
      const phase=idle?(actor.idleClock||0)*3:actor.walkPhase*2/Math.PI;
      const frame=((Math.floor(phase)%4)+4)%4;
      const cellWidth=glockReady?40:32;
      ctx.save();
      ctx.imageSmoothingEnabled=false;
      ctx.drawImage(atlas,direction*cellWidth,(gait*4+frame)*48,cellWidth,48,
        Math.round(actor.x)-cellWidth/2,Math.round(actor.y)-32,cellWidth,48);
      ctx.restore();
      return;
    }
  }
  normalize(actor);
  ctx.save();ctx.translate(actor.x,actor.y);ctx.rotate(actor.angle);
  drawMallCFeet(ctx,actor);drawMallCBody(ctx,actor);
  ctx.restore();
}
// South-facing pixel layers. The same unit grid is used by C.
const chenInks = { k:'#242024', h:'#30282b', m:'#493a3b', H:'#695454',
    g:'#92817a', s:'#bd825b', S:'#dfa77a', b:'#56433e', w:'#e7d1ac',
    t:'#9b805b', G:'#c6a269', l:'#393640' };
const chenBase = [
 '    kkkkkkkkkkkk', '  kkccCCccccccCCkk', ' kcCcccccccccccccck',
 ' kcCcccccccccccccck', ' kcccccccccccccccck', '  kdccccccccccccdk',
 '   kddddddddddddk', '    kkkkkkkkkkkk'
];
const chenSleeve = ['  kkk',' kCCck','kCccck','kcccck','kcccdk',' kdddk',' kSSsk','  kssk','   kk'];
const chenBoot = [' kkkk','klllbk','kblbbk','kbbblk',' kkllk','  kkk'];
const chenHeads = {
 'family-father': [
 '     kkkkkkk','   kkhmmHHmhkk','  khmHHmmhhmmhk',' khgmmhhhmHHmhkk',
 ' khgmmhmmHHmmhhk','kghhmhhmHHmmhhhk','kgghhmmHmmhhmhhk',
 ' kggmhhmhmmmhhk',' kgmsSSSSSSsmhk','  ksGGGbGGGssk','   kGsbGsGbGk','    ksSSsssk','      kkkk'],
 'family-mother': [
 '     kkkkkkk','   kkhhmHHmhkk','  khmmHmmmhmhhk',' khmHHmmhhhmmhhk',
 ' khmHmmhhhmHmmhk',' khmhmhhhmmHmmhk','GkhmmhmmmHmmhhhk',' kkhmmHHmmhSSshk',
 '  khhhhmmmSSSsk','  khhsSSSSSSssk','   kGssSSSSssk','     ksssSssk','       kkkk'],
 'family-son': [
 '    kk kkkkk','  kkhhkhmmhhkk',' khmHmmmhhHHhhk','khmHHmmhmmHmmhhk',
 'khHmmmhmmHmhmmhk','khmmhhmmHhmmhmhhk',' khhmmhhhmmhhmhk',
 ' khhhhshhmhshhsk','  khhsSShsSSssk','   kssSSSSSSsk','    ksSSSSssk','      kkkkk']
};
const chenClothes = {
 'family-father': { c:'#66533e', C:'#887456', d:'#413439',
   trim:['tctctctctctctc','ctctctctctctct','tctctctctctctc','cclllcccclllcc'] },
 'family-mother': { c:'#783f45', C:'#a26459', d:'#573238',
   trim:['G     G    G',' G   G    G','  G G    G','   G   GGGG'] },
 'family-son': { c:'#696247', C:'#908462', d:'#494536',
   trim:['tttt       tt','ddd       ddd','    ww  ww','     wwww'] }
};
const longHair = [' kkkkkkkkkk','khmmhhhhmmhk','khHmhhhhmHhk','khHmmhhhmHhk','khHmmhhhmHhk','khhmhhhhmmhk',' khmhhhhmhk',' khhmhhhmmk','  khhkhhhk','   kk kkk'];
function chenPixels(rows) {
    return rows.flatMap((row,y) => Array.from(row.matchAll(/([^ ])\1*/g),
        match => [match.index,y,match[0].length,match[1]]));
}
const familyArt = Object.fromEntries(Object.entries(chenClothes).map(([role,clothes]) =>
    [role,{ ink:{...chenInks,...clothes}, head:chenPixels(chenHeads[role]), trim:chenPixels(clothes.trim) }]));
const familyBody = chenPixels(chenBase), familyArm = chenPixels(chenSleeve);
const familyFoot = chenPixels(chenBoot), familyHair = chenPixels(longHair);
function drawFamilyPixels(ctx,pixels,ink,x,y,mirror=false) {
    for (const [col,row,width,key] of pixels) {
        ctx.fillStyle = ink[key];
        ctx.fillRect(x+(mirror ? -col-width : col),y+row,width,1);
    }
}
function drawChen(ctx,actor,role) {
    const art = familyArt[role], ink = art.ink;
    const phase = Math.sin(actor.walkPhase)*actor.walkBlend;
    ctx.save();
    ctx.rotate(-Math.PI/2);
    ctx.scale(actor.radius/14,actor.radius/14);
    drawSpriteEllipse(ctx,0,-3,14,16,0,'#090d1659',null);
    const along = Math.cos(actor.walkAngle-actor.angle)*phase;
    const across = Math.sin(actor.walkAngle-actor.angle)*phase;
    for (const side of [-1,1]) {
        drawFamilyPixels(ctx,familyFoot,ink,side*(6+across*2)-3,-13+side*along*4);
    }
    drawFamilyPixels(ctx,familyBody,ink,-10,-10);
    drawFamilyPixels(ctx,art.trim,ink,-7,-8);
    for (const side of [-1,1]) {
        drawFamilyPixels(ctx,familyArm,ink,side*14,-7+side*phase*1.6,side===1);
    }
    if (role==='family-mother') drawFamilyPixels(ctx,familyHair,ink,-6,-15);
    drawFamilyPixels(ctx,art.head,ink,-8,-6);
    ctx.restore();
}

const npcAtlases=new Map();
function drawNpcAtlas(ctx, actor, filename) {
  if (typeof Image === 'undefined') return false;
  let atlas=npcAtlases.get(filename);
  if (!atlas) {
    atlas=new Image();
    atlas.src=new URL(filename,document.baseURI).href;
    npcAtlases.set(filename,atlas);
  }
  if (!atlas.complete || !atlas.naturalWidth) return false;
  const moving=actor.gait ? actor.gait!=='idle' : actor.walkBlend>0.1;
  const angle=moving ? actor.walkAngle : actor.angle;
  const column=((Math.round((angle-Math.PI/2)/(Math.PI/4))%8)+8)%8;
  const gait=moving ? (actor.gait==='run' || actor.isSprinting ? 2 : 1) : 0;
  const phase=moving ? actor.walkPhase*2/Math.PI : (actor.idleClock ?? performance.now()/1000)*3;
  const frame=((Math.floor(phase)%4)+4)%4;
  ctx.save();
  ctx.imageSmoothingEnabled=false;
  ctx.drawImage(atlas,column*32,(gait*4+frame)*48,32,48,
    Math.round(actor.x)-16,Math.round(actor.y)-32,32,48);
  ctx.restore();
  return true;
}

function drawNpc(ctx, actor, appearance='assistant', prop='none') {
  normalize(actor);
  // Tiled actor sprite keys override any generic role-based appearance.
  const explicit=actor.meta?.sprite || actor.spriteKey || actor.appearanceKey;
  const selected=String(explicit || appearance).trim().toLowerCase();
  // "Sophia" is also used for Saafiya in dialogue/voice transcription.
  const isSaafiyaAlias=/^(saafiya|sophia|sofia)(?:\s|$)/i.test(actor.name||'');
  const isSaafiya=['saafiya','sophia','sofia'].includes(selected) ||
    (!explicit && ['assistant','cashier'].includes(selected) && isSaafiyaAlias);
  if (isSaafiya || selected==='saafiya-equipped') {
    const armed=selected==='saafiya-equipped' || actor.weaponVisible || prop==='pistol';
    if (drawNpcAtlas(ctx,actor,armed?'saafiya-equipped.svg':'saafiya.svg')) return;
  }
  if (selected==='family-father' && drawNpcAtlas(ctx,actor,'mr-chen.svg')) return;
  const colors=NPC_SPRITE_COLORS[selected] || NPC_SPRITE_COLORS.assistant;
  ctx.save();ctx.translate(actor.x,actor.y);ctx.rotate(actor.angle);
  if (Object.hasOwn(familyArt,selected)) drawChen(ctx,actor,selected);
  else drawHumanNpc(ctx,actor,colors,'#11181c','standing',prop);
  ctx.restore();
}
function drawDog(ctx, actor) {
  normalize(actor);
  ctx.save();ctx.translate(actor.x,actor.y);ctx.rotate(actor.angle);
  drawDogSprite(ctx,actor);
  ctx.restore();
}
root.HeroSprites=Object.freeze({drawC,drawNpc,drawDog,updateWalk:updateSpriteWalk,colors:NPC_SPRITE_COLORS});
})(window);
