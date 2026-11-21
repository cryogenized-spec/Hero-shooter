// Joint offsets in sprite pixels: left/right boot, left/right hand, head offset, face-up.
export const falls = [
    [-18,-8, -17,7, 10,-12, 6,13, 0,false],
    [-16,-6, -20,3, -5,-13, 12,8, 0,true],
    [-9,6, -13,9, 9,5, 13,4, 3,false],
    [-17,10, -11,-6, -3,-13, 8,9, -2,true],
    [-20,-2, -18,2, 13,-8, 14,6, 0,false],
    [-12,-11, -20,5, 11,-3, -8,10, 1,true],
    [-17,-6, -10,-9, 8,-9, 12,-4, -3,false]
];
const seated = [17,-6, 14,8, 5,-10, 3,10, 0,false];
const guarding = [17,-6, 14,8, 10,-3, 9,3, 0,false];

// Stamp square clusters along each limb so the edges stay stepped.
function limb(ctx,x,y,endX,endY,width,ink) {
    const steps = Math.max(1,Math.abs(endX-x),Math.abs(endY-y));
    ctx.fillStyle = ink;
    for (let i=0;i<=steps;i++) {
        ctx.fillRect(Math.round(x+(endX-x)*i/steps)-2,Math.round(y+(endY-y)*i/steps)-2,width,width);
    }
}
export function drawRestingBody(ctx, pose, coat, skin, guard=false) {
    const sitting = pose === null;
    const [lx,ly,rx,ry,ax,ay,bx,by,offset,up] = sitting ? (guard ? guarding : seated) : falls[pose];
    limb(ctx,-4,-3,lx,ly,5,'#36343c');
    limb(ctx,-4,3,rx,ry,5,'#45424a');
    ctx.fillStyle='#28242a';
    for (const [x,y] of [[lx,ly],[rx,ry]]) ctx.fillRect(x-2,y-2,6,5);
    ctx.fillStyle='#322a30';ctx.fillRect(-8,-6,16,13);
    ctx.fillStyle=coat;ctx.fillRect(-7,-6,14,12);ctx.fillRect(-5,-8,10,16);
    ctx.fillStyle='#78343e';ctx.fillRect(-4,2,4,3);
    ctx.fillStyle=skin;ctx.fillRect(6,-4+offset,8,8);
    ctx.fillStyle='#30252a';ctx.fillRect(5,-5+offset,up?4:8,9);
    for (const [side,x,y] of [[-1,ax,ay],[1,bx,by]]) {
        limb(ctx,3,side*6,x,y,4,coat);
        ctx.fillStyle=skin;ctx.fillRect(x-1,y-1,3,3);
    }
}
export function registerWound(actor,critical) {
    if (!actor.wound) actor.wound={age:0,downAt:Infinity,dropIn:0,cry:true};
    else actor.wound.cry=false;
    if (critical) actor.wound.downAt=Math.min(actor.wound.downAt,actor.wound.age+2.4);
}
export function woundPhase(actor) {
    const w=actor.wound;
    if (!w || !Number.isFinite(w.downAt)) return 'mobile';
    if (w.age >= w.downAt+4) return 'expired';
    return w.age >= w.downAt ? 'seated' : 'stumble';
}
