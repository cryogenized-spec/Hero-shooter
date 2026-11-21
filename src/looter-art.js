// Clothing and headwear are drawn in actor-local space, facing +X.
export const looterLooks = [
    { coat: '#536d7b', skin: '#955f43', trim: '#bb9670', style: 'denim' },
    { coat: '#865036', skin: '#754934', trim: '#e8b86b', style: 'knit' },
    { coat: '#485944', skin: '#a16c4b', trim: '#c2bda2', style: 'bucket' },
    { coat: '#423c52', skin: '#85553f', trim: '#d6bccc', style: 'track' }
];
function oval(ctx, x, y, rx, ry, color) {
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, 2 * Math.PI);
    ctx.fillStyle = color;
    ctx.fill();
}
export function drawLooterJacket(ctx, look) {
    for (const side of [-1, 1]) {
        oval(ctx,-8,side * 6,6,3.1,'#272a30');
        ctx.save();
        ctx.translate(1,side * 9.8);
        ctx.rotate(-side * 0.47);
        oval(ctx,0,0,6.3,3.9,'#252429');
        oval(ctx,0,0,5.7,3.3,look.coat);
        oval(ctx,5.2,0,3.4,2.4,look.skin);
        ctx.restore();
    }
    const band = (x,y,w,h) => ctx.fillRect(x,y,w,h);
    ctx.fillStyle = look.trim;
    if (look.style === 'denim') {
        band(-7,-9,2,18);
        ctx.strokeStyle = look.trim;
        ctx.strokeRect(-4,-10,5,4);
    } else if (look.style === 'knit') {
        band(-5,-12,2,24);
        band(-1,-12,1,24);
    } else if (look.style === 'bucket') {
        ctx.save();
        ctx.rotate(-0.45);
        band(-2,-12,3,24);
        ctx.restore();
        oval(ctx,-4,8,5,3,'#756347');
    } else {
        for (const y of [-10,9]) {
            band(-6,y,12,1);
            band(-6,y+2,11,1);
        }
    }
}
export function drawLooterHead(ctx, look) {
    oval(ctx,1,0,7.4,6.8,look.skin);
    oval(ctx,7.5,0,1.8,2.3,look.skin);
    for (const side of [-1,1]) oval(ctx,1.7,side * 6.3,1.6,1.1,look.skin);
    if (look.style === 'denim') {
        oval(ctx,-1,0,6.6,6.4,'#272023');
        for (const y of [-4,0,4]) oval(ctx,-4,y,3.7,2.7,'#342a29');
    } else if (look.style === 'knit') {
        oval(ctx,-1,0,7.2,7.2,'#963f35');
        ctx.fillStyle = '#d0845d';
        ctx.fillRect(2,-5.8,1.5,11.6);
        for (const y of [-4,-1,2,5]) ctx.fillRect(-4,y,3,0.65);
    } else if (look.style === 'bucket') {
        oval(ctx,0,0,9.3,8.5,'#403d35');
        oval(ctx,-1,0,7,6.4,'#9c8f70');
        oval(ctx,-2,0,5,5.6,'#b3a485');
    } else {
        oval(ctx,-1,0,6.7,6.5,'#292830');
        oval(ctx,5,-0.5,5.8,4.8,'#665a73');
        ctx.fillStyle = '#b6a5b7';
        ctx.fillRect(-5,-0.5,7,1);
    }
}
