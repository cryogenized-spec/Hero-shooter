// Pixel clusters face south on the drafting grid. One cell is one world unit.
const shared = { o:'#221f24', d:'#343039', l:'#554953', h:'#292226', H:'#473636', w:'#e7d6be' };
const boots = [
 ' ooooo ', 'odddldo', 'odllldo', 'odddldo', 'oollloo', ' odldo ', ' ooooo '
];
const torso = [
 '   oooooooooooooo   ', ' ooddddddddddddddoo ', 'odccccccddccccccccdo',
 'occcCcccddcccCccccco', 'occCcccccCccccccCcco', 'occccCccddccCcccccco',
 'odccccccddccccccccdo', ' odcccccdccccccccdo ', '  oddcccddccccdddo  ',
 '   ooddddddddddoo   ', '     oooooooooo     '
];
// Sleeve motifs stay inside the same silhouette on both arms.
const sleeves = {
 denim:['  oooo',' oCCcco','oCcccco','occcCco','odcccdo',' odCCdo','  ossso','  osSso','   ooo'],
 knit:['  oooo',' oCCcco','occcCco','occccco','occddco',' odccdo','  ossso','  osSso','   ooo'],
 field:['  oooo',' oCCcco','occttco','occtdco','occccco',' odccdo','  ossso','  osSso','   ooo'],
 track:['  oooo',' otctco','otctcco','otctcco','otctcco',' otctdo','  ossso','  osSso','   ooo'],
 hoodie:['  oooo',' oCCcco','ocCccco','occccco','odccCco',' oddddo','  ossso','  osSso','   ooo'],
 plaid:['  oooo',' octdco','ottttto','occtcco','occtcco',' otttto','  ossso','  osSso','   ooo'],
 work:['  oooo',' oCCcco','oCCCCco','occttco','occtdco',' otwtto','  ossso','  osSso','   ooo'],
 puffer:['  oooo',' oCCcco','oddddco','oCCccco','oddddco',' oCCcco','  ossso','  osSso','   ooo']
};
const face = [
 '  oooooooo  ',' ossSSSSsso ','osSSSSSSSsso','osddSSSSddso','osowdSSdwoso',
 ' ossSSSsSso ','  osSsSSso  ','  osShhSso  ','   oshhso   ','    oooo    '
];
const crowns = {
 denim:['    oooooo','  oohHhhHhoo',' ohHhhHHhhHho','ohHhhHhhHHhhho','ohhHHhhHhhHHho',' ohhhHHhhhhho','  oohhhhoooo'],
 knit:['    oooooo','  ootTttttoo',' ottTtTtTttto','otTtTtTtTtTtto','otTtTtTtTtTtto','oddddddddddddo',' ottTTttTTtto','  oooooooooo'],
 field:['   oooooooo','  otTTTTttto',' ottTTtttttto',' otttttttttto','ooddddddddddoo','otTTTTttttttto',' otttTTttttto','  oooooooooo'],
 track:['   ooooooo','  ottTttttoo',' otttTtttttto','ottttTttttttto','otttttttttttto',' ooTTTTTTttoo','   ottttttto','    ooooooo'],
 hoodie:['   oooooooo','  ocCCccccco',' ocCccddcccco','ocCcdhhhhdccco','occdhHHhhhdcco','occhhhHHhhhcco',' occohhhhoocco','  oco    oco'],
 plaid:['    oooooo','  oohhHHhhoo',' ohhHHhhHHhho','ohhhHhhHhhhHho','oHhhHHhHHhhHho',' odHHhhHHhhdo','  oddhhhdddo'],
 work:['   ooooooo','  ottTttttoo',' ottTttttttto','otttttTTttttto','otdddddddddtto',' oTTTTTTTTTTo','  ottttttttto','    ooooooo'],
 puffer:['    oooooo','  oohHHHhhoo',' ohhHHHHHHhho','ohHHHHHHHHHhho','ohhHHHHHHHHhho',' ohhhHHHHhhho','  oohhhhhhoo']
};
const details = {
 denim:['ooooo','CtCtC','cdtdc','occco',' ooo'],
 knit:['tttttt','cccccc','dddddd'],
 field:['  tt',' tt','tt','oooooo','otTTto','otddto',' oooo'],
 track:['tcct','tcct','tcct'],
 hoodie:[' oooooo','ocCccco',' ooooo'],
 plaid:['tctctc','tttttt','cctccc','cctccc'],
 work:['oooooo','oTwwTo','otttto',' oooo'],
 puffer:['  tt',' tt','tt','oooooo','oTTtto','otdwto',' oooo']
};
export const looterLooks = [
 ['denim','#48647a','#7993a0','#a78d65','#cfb68e','#87523d','#b57a58'],
 ['knit','#865039','#ad7350','#944537','#ce7850','#754631','#a36b49'],
 ['field','#535c43','#84856a','#86775c','#c2ad81','#925c40','#bf865c'],
 ['track','#423952','#6c597b','#d3bacd','#877995','#82503b','#ad7956'],
 ['hoodie','#626267','#939196','#b39a72','#cab38c','#784933','#ac7452'],
 ['plaid','#88463b','#b46e52','#413c42','#716362','#965e42','#c78960'],
 ['work','#456966','#70938a','#c6994d','#e9bb75','#734731','#a46a4a'],
 ['puffer','#34495c','#667989','#a87950','#d4a46b','#89553d','#ba815b']
].map(([style,c,C,t,T,s,S]) => ({style,skin:s,ink:{...shared,c,C,t,T,s,S}}));

function compile(rows) {
 return rows.flatMap((row,y) => Array.from(row.matchAll(/([^ ])\1*/g), m => [m.index,y,m[0].length,m[1]]));
}
const feet = compile(boots), body = compile(torso), jaw = compile(face);
for (const look of looterLooks) {
 look.arm = compile(sleeves[look.style]);
 look.hair = compile(crowns[look.style]);
 look.detail = compile(details[look.style]);
}
function stamp(ctx, pixels, ink, x, y, mirror = false) {
 for (const [dx,dy,width,key] of pixels) {
  ctx.fillStyle = ink[key];
  ctx.fillRect(x + (mirror ? -dx-width : dx), y+dy, width, 1);
 }
}
export function drawLooterJacket(ctx, look, stride = 0) {
 ctx.save();
 ctx.rotate(-Math.PI/2);
 const step = Math.round(stride);
 stamp(ctx,feet,look.ink,-9,-14+step);
 stamp(ctx,feet,look.ink,2,-14-step);
 stamp(ctx,body,look.ink,-10,-11);
 stamp(ctx,body,look.ink,-10,-7);
 stamp(ctx,look.detail,look.ink,-9,-10);
 stamp(ctx,look.arm,look.ink,-14,-5);
 stamp(ctx,look.arm,look.ink,14,-5,true);
 ctx.restore();
}
export function drawLooterHead(ctx, look) {
 ctx.save();
 ctx.rotate(-Math.PI/2);
 stamp(ctx,jaw,look.ink,-6,-1);
 stamp(ctx,look.hair,look.ink,-7,-8);
 ctx.restore();
}
