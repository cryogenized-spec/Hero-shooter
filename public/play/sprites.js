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
    drawSpriteFootwork(ctx, this, actor.isSneaking ? 2.6 : 5, -15, 8);
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

    // Rolled sleeves and hands frame the pink sidearm.
    drawSpriteEllipse(ctx, 5, -9, 9, 4, 0.62, '#534238');
    drawSpriteEllipse(ctx, 5, 9, 9, 4, -0.62, '#534238');
    drawSpriteEllipse(ctx, 14, -4, 3.5, 3.5, 0, '#d59b76');
    drawSpriteEllipse(ctx, 14, 4, 3.5, 3.5, 0, '#d59b76');

    if (actor.weaponVisible) {
        ctx.beginPath();
        ctx.roundRect(12, -3.25, 10.5, 6.5, 1.2);
    paintSpritePath(ctx, '#283341');
    ctx.fillStyle = '#f76da9';
    ctx.fillRect(13, 1, 8.5, 1.7);
    ctx.fillStyle = '#778390';
    ctx.fillRect(16, -2.3, 4, 0.8);
    if (actor.flashlightOn) {
        ctx.fillStyle = '#fef08a';
        ctx.fillRect(21, -1, 2, 2);
    }

    }

    // Hair and face are drawn last above the collar.
    drawSpriteEllipse(ctx, 0.8, 0, 9.4, 9, 0, '#deaa83');
    ctx.beginPath();
    ctx.moveTo(6.8, -6.5);
    ctx.bezierCurveTo(-1, -13, -11, -8.5, -10, 1);
    ctx.quadraticCurveTo(-9, 7, -4, 8);
    ctx.lineTo(-5, 1);
    ctx.lineTo(-1.5, 3);
    ctx.lineTo(0, -3);
    ctx.closePath();
    paintSpritePath(ctx, '#291f24');
    ctx.fillStyle = '#42292a';
    ctx.fillRect(6.3, -3, 1.4, 1.5);
    ctx.fillRect(7.4, 2, 1.4, 1);
}


function normalize(actor) {
  if (!Number.isFinite(actor.walkPhase)) actor.walkPhase=0;
  if (!Number.isFinite(actor.walkBlend)) actor.walkBlend=0;
  if (!Number.isFinite(actor.walkAngle)) actor.walkAngle=Number.isFinite(actor.angle)?actor.angle:0;
  if (!Number.isFinite(actor.angle)) actor.angle=0;
  if (!Number.isFinite(actor.radius)) actor.radius=14;
  if (!Number.isFinite(actor.woundedSpeedFactor)) actor.woundedSpeedFactor=1;
}
function drawC(ctx, actor) {
  normalize(actor);
  ctx.save();ctx.translate(actor.x,actor.y);ctx.rotate(actor.angle);
  drawMallCFeet(ctx,actor);drawMallCBody(ctx,actor);
  ctx.restore();
}
function drawNpc(ctx, actor, appearance='assistant', prop='none') {
  normalize(actor);
  const colors=NPC_SPRITE_COLORS[appearance] || NPC_SPRITE_COLORS.assistant;
  ctx.save();ctx.translate(actor.x,actor.y);ctx.rotate(actor.angle);
  drawHumanNpc(ctx,actor,colors,'#11181c','standing',prop);
  ctx.restore();
}
root.HeroSprites=Object.freeze({drawC,drawNpc,updateWalk:updateSpriteWalk,colors:NPC_SPRITE_COLORS});
})(window);
