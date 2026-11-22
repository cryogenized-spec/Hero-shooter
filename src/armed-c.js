let armedAtlas;
export function drawArmedC(ctx, actor, weapon) {
    if (actor.gender !== 'mall' || weapon?.id !== 'glock26' ||
        actor.hasMolleVest || actor.nvgEquipped || typeof Image === 'undefined') return false;
    if (!armedAtlas) {
        armedAtlas = new Image();
        // Repository-root Pages serves the game under /public/, unlike dist/ Pages.
        const sourceHosted=typeof location!=='undefined' &&
            /\/public\/(?:training|play)\//.test(location.pathname);
        armedAtlas.src = new URL(sourceHosted ? '../public/play/c-glock-ready.svg' :
            '../play/c-glock-ready.svg', import.meta.url).href;
    }
    if (!armedAtlas.complete || !armedAtlas.naturalWidth) return false;
    const direction = ((Math.round((actor.angle - Math.PI/2) / (Math.PI/4)) % 8) + 8) % 8;
    const gait = actor.walkBlend < 0.1 ? 0 : actor.sprinting ? 2 : 1;
    // The training and combat renderer must never cycle a standing character.
    const idleFrame=Number.isInteger(actor.idlePoseFrame) ? ((actor.idlePoseFrame%4)+4)%4 : 0;
    const walkingFrame=((Math.floor(actor.walkPhase*2/Math.PI)%4)+4)%4;
    const row=gait*4+(gait?walkingFrame:idleFrame);
    const kick = 2 * Math.sin(Math.PI * Math.min(1, (actor.slideTime || 0) / 0.105));
    ctx.save();
    ctx.translate(Math.round(actor.x - Math.cos(actor.angle)*kick), Math.round(actor.y - Math.sin(actor.angle)*kick));
    if (actor.isSneaking) ctx.scale(0.88, 0.88);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(armedAtlas, direction*40, row*48, 40, 48, -20, -32, 40, 48);
    ctx.restore();
    return true;
}
