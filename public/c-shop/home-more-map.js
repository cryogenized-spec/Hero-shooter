/* Home & More — Canvas reconstruction of the director-approved 1670x942
 * retail artwork. Approved image itself remains in the user's Library.
 * World axes +X right, +Y down. Additional 158px for mall concourse.
 * Mrs Chen's office is ON L1. Upper landing is a family gathering room.
 */
(function(){
'use strict';
const openStates=Object.create(null);
let doors=[],floorId='retail';
function map(api){
 const {rect:rect,circle:circle,label:label,blocks:blocks,props:props,spot:spot,random:random}=api;
 blocks.length=0;props.length=0;doors=[];floorId='retail';
 function wall(x,y,w,h){
  blocks.push({x,y,w,h});rect(x+3,y+3,w,h,'#241d2b');
  rect(x,y,w,h,'#413541');rect(x+2,y+2,w-4,Math.min(3,h-2),'#b99a8e');
 }
 function segment(x,start,end,gaps){
  let last=start;
  for(const [a,b] of gaps){if(a>last)wall(x,last,14,a-last);last=b;}
  if(end>last)wall(x,last,14,end-last);
 }
 function door(id,name,x,y,w,h,target){
  const p={id,name,x,y,w,h,target,open:!!openStates[id]};
  if(!p.open){p.block={x,y,w,h};blocks.push(p.block)}
  doors.push(p);spot(name,x+w/2,y+h/2,55,'Door to '+target);
 }
 function furnishings(x,y,w,h,color='#655565'){
  blocks.push({x,y,w,h});rect(x+4,y+4,w,h,'#2b2430');rect(x,y,w,h,color);
  rect(x+3,y+2,w-6,3,'#c1a084');
 }
 function tile(x,y,w,h){
  rect(x,y,w,h,'#a9929b');
  for(let xx=x;xx<x+w;xx+=28)for(let yy=y;yy<y+h;yy+=28){
   rect(xx+1,yy+1,26,26,random()<.52?'#a99098':'#b59da3');
   rect(xx+3,yy+3,21,1,'#d4bbb1');
  }
 }
 function plant(x,y){
  circle(x+2,y+4,16,'#4a3341');
  for(let i=0;i<9;i++){const a=i*Math.PI*2/9;circle(x+Math.cos(a)*12,y+Math.sin(a)*10,6,i%2?'#6c8c6b':'#91a873')}
  circle(x,y,4,'#ddac78');
 }
 function light(x,y){
  rect(x-23,y-5,46,12,'#4b3543');rect(x-20,y-3,40,7,'#db9e6e');rect(x-17,y-2,34,3,'#ffe5bf');
 }
 const palettes={
 cookware:['#af675f','#b6b3bc','#856876','#ccb2a7'],
 lamps:['#ebbc73','#b18c6b','#d9a895','#bd865c'],
 cleaning:['#98acb6','#d4c8a9','#82918e','#c5a6aa'],
 tools:['#edb755','#6a6265','#96766a','#af964e'],
 electronics:['#85849a','#afa4ab','#687c89','#c9aca1'],
 textiles:['#aa8279','#c1ad8d','#927188','#c7b8a0'],
 hardware:['#a78565','#656b72','#c5af89','#8a7672'],
 paint:['#b79eaf','#a3a4a8','#d19e89','#d7c6b3'],
 boxes:['#a38973','#bda48b','#746572','#a79185']
 };
 function gondola(x,y,w,h,kind,n){
  furnishings(x,y,w,h,'#534657');
  const colors=palettes[kind]||palettes.boxes;
  for(let cy=y+9,k=0;cy<y+h-15;cy+=24,k++){
   rect(x+5,cy,w-10,18,'#382f3e');
   for(let cx=x+9,j=0;cx<x+w-15;cx+=16,j++){
    rect(cx+2,cy+2,12,11,'#241f30');rect(cx,cy,12,10,colors[(n+j+k)%4]);
    rect(cx+2,cy+2,8,2,'#e9c9ad');
   }
   rect(x+4,cy+17,w-8,3,'#c6a17c');
  }
  for(let cy=y+8;cy<y+h;cy+=42){rect(x-4,cy,5,18,'#ce9e47');rect(x+w-1,cy,5,18,'#ce9e47')}
 }
 rect(0,0,1670,1100,'#2b2632');
 tile(22,22,1636,921);
 // L1 concourse and centre glass entrance.
 rect(0,943,1670,157,'#5d535d');
 for(let x=0;x<1670;x+=36)for(let y=946;y<1100;y+=36){
  rect(x+1,y+1,34,34,(Math.floor(x/36)+Math.floor(y/36))%2?'#6d636d':'#80727d');
  rect(x+2,y+2,31,2,'#a89b9c');
 }
 label('PINE RIDGE MALL  ·  LEVEL 1',598,1055,'#f6d1a3',18);
 wall(18,15,1630,20);wall(18,15,19,922);wall(1630,15,18,922);
 wall(18,898,714,21);wall(952,898,694,21);
 rect(732,889,220,9,'#cca679');rect(750,879,183,9,'#788e94');
 for(const x of [740,940])rect(x,883,7,32,'#d5bd9a');
 spot('Main glass doors',835,912,60,'The wide folding entrance has an electronic shutter.');
 // Approved brand treatment: sunset and acacia silhouette.
 rect(268,39,1327,104,'#853747');
 for(let x=268;x<1590;x+=17)rect(x,108+Math.sin(x*.02)*9,17,27+Math.sin(x*.012)*11,'#382834');
 label('Home & More',554,95,'#ffdcaf',48);
 label('FAMILY HOUSEWARES · IMPORTS · HARDWARE',576,126,'#e0ab8f',13);
 for(let x=300;x<1570;x+=169)light(x,33);
 for(const x of [290,1130,1427])plant(x,150);
 // Rear-wall stock, then 6 rear + 6 middle + 3 front display gondolas.
 for(const [x,w] of [[324,326],[690,190],[920,195],[1160,195],[1435,155]])gondola(x,154,w,30,'boxes',x%5);
 const rows=[
  {y:207,h:162,themes:['cookware','lamps','cleaning','tools','electronics','textiles']},
  {y:394,h:164,themes:['hardware','electronics','electronics','electronics','paint','boxes']},
  {y:579,h:108,themes:['boxes','boxes','boxes']}
 ];
 rows.forEach((row,ri)=>row.themes.forEach((theme,i)=>{
  const x=341+i*207;
  gondola(x,row.y,129,row.h,theme,i+ri*3);
  spot(theme[0].toUpperCase()+theme.slice(1),x+62,row.y+row.h+21,53,
   'Home & More ' + theme + ' section; shelves are stocked for Sunday work.');
 }));
 gondola(1560,265,53,342,'textiles',3);
 // Front checkout at bottom-right with two tills, queue rails and trolleys.
 furnishings(1028,750,328,61,'#753f45');
 rect(1042,762,303,17,'#bf8867');
 for(const x of [1118,1273]){
  rect(x,741,52,34,'#2e2733');rect(x+5,747,42,24,'#849fa3');
  rect(x+1,778,51,5,'#e0b49a');
 }
 label('CHECKOUT',1112,809,'#ffe0b7',13);
 for(const y of [612,678]){
  rect(1000,y,384,5,'#bb5058');
  for(const x of [1000,1094,1189,1283,1384]){circle(x,y+4,7,'#aca0ac');circle(x,y+4,3,'#4f404f')}
 }
 for(let i=0;i<6;i++){
  const x=410+i*27;rect(x,760-i*2,31,37,'#544752');rect(x+3,763-i*2,25,29,'#b6aaa6');
  circle(x+7,800-i*2,4,'#2e2533');
 }
 plant(695,845);plant(982,844);
 spot('Checkout counter',1224,836,73,'Mr Chen handles Sunday paperwork at the south-facing tills.');
 // West receiving / stockholding, open to a separated service corridor.
 rect(42,42,180,310,'#75616b');
 for(let x=54;x<205;x+=36)for(let y=55;y<329;y+=57){
  rect(x,y,29,39,'#947151');rect(x+3,y+2,23,5,'#c5a477');
 }
 label('RECEIVING',62,70,'#f9d4b0',12);
 wall(39,39,186,12);wall(39,39,12,321);wall(39,354,185,13);
 // Service corridor, accessed separately from the retail aisles.
 tile(235,365,51,531);
 segment(221,39,889,[[318,350],[411,460],[551,605],[672,699],[710,741],[786,830]]);
 segment(279,365,888,[[414,474]]);
 door('receiving','Receiving door',221,318,16,32,'the stockholding bay');
 label('STAFF ONLY',307,430,'#624551',11);
 door('staffAccess','Staff-only door',278,415,17,58,'the service corridor');
 // Stairs lead to separate upper family room, not Mrs Chen's L1 office.
 rect(42,374,177,123,'#786773');
 for(let i=0;i<8;i++)rect(53+i*19,388,17,88,'#ae9188');
 rect(53,479,149,5,'#ddba89');label('STAIRS TO UPPER ROOM',59,436,'#ffe0b5',12);
 door('stairs','Stairwell door',221,412,16,47,'the upper family gathering room');
 spot('Mezzanine stairs',121,451,58,'Stairs to the private upper family gathering room (not the office).');
 // Mrs Chen's own L1 office in left back-office wing.
 rect(40,510,181,153,'#b08c85');
 rect(65,537,114,41,'#80615c');rect(87,540,39,26,'#43394b');rect(90,543,33,20,'#9bb5b0');
 rect(160,595,27,31,'#5b485a');plant(178,550);
 label('MRS CHEN · ADMIN',59,531,'#ffe5c9',12);
 wall(39,502,186,11);wall(39,655,186,10);wall(39,504,12,162);
 door('office','Mrs Chen office door',221,551,16,54,'her private administration office');
 spot('Mrs. Chen',112,595,56,'Mrs Chen is completing the family business payroll.');
 // Two independent toilet cubicles with two distinct doors.
 rect(40,670,180,75,'#9c8b95');
 wall(39,664,187,8);wall(39,706,187,8);wall(39,745,187,9);
 for(const y of [688,727]){
  circle(99,y,12,'#e3dad6');circle(99,y,7,'#aaa1a6');
  rect(152,y-11,35,21,'#cbbcb2');rect(157,y-7,26,13,'#f0e4d7');
 }
 label('WC 1',60,686,'#f7e3c9',11);
 door('toilet1','WC 1 door',221,674,16,26,'WC 1');
 label('WC 2',60,727,'#f7e3c9',11);
 door('toilet2','WC 2 door',221,714,16,26,'WC 2');
 // Staff kitchen/canteen has its OWN door from the corridor.
 rect(40,757,180,134,'#c6a18f');rect(50,790,42,78,'#495667');rect(56,793,30,65,'#7293b7');
 circle(149,837,30,'#83606a');circle(149,837,26,'#ddb7a1');
 circle(108,835,12,'#5b455a');circle(190,835,12,'#5b455a');
 label('STAFF CANTEEN',57,777,'#ffe1ba',12);plant(191,785);
 wall(39,750,187,10);wall(39,892,187,8);wall(39,751,12,145);
 door('staffRoom','Staff room door',221,786,16,43,'the staff canteen');
 for(const x of [382,615,835,1061,1268,1479])light(x,188);
 return {doors,level:'retail'};
}
function upper(api){
 const {rect:rect,circle:circle,label:label,blocks:blocks,props:props,spot:spot}=api;
 blocks.length=0;props.length=0;doors=[];floorId='upper';
 rect(0,0,1670,1100,'#2b2530');
 rect(430,242,810,628,'#baa2a0');
 for(let x=437;x<1220;x+=35)for(let y=251;y<849;y+=35){
  rect(x,y,33,33,(x+y)%2?'#a998a0':'#b29ba0');
 }
 function wall(x,y,w,h){blocks.push({x,y,w,h});rect(x,y,w,h,'#483c49')}
 wall(424,235,823,15);wall(424,235,15,631);wall(1233,235,14,631);
 wall(424,856,316,14);wall(923,856,324,14);
 rect(739,861,184,7,'#ddbb8e');
 label('UPPER FAMILY GATHERING ROOM',563,295,'#f2ddc7',23);
 label('Quiet rest / private conversations · NOT the office',551,327,'#80606b',13);
 rect(593,428,202,90,'#6d566f');rect(604,431,178,21,'#b69ca9');
 rect(1016,420,71,194,'#584956');for(let i=0;i<5;i++)rect(1022,431+i*37,55,29,'#c1a78a');
 circle(811,629,75,'#674f5c');circle(811,629,65,'#ccac9c');
 circle(713,634,27,'#8e7783');circle(914,634,27,'#8e7783');
 rect(1145,667,49,106,'#536376');rect(1151,675,33,79,'#84a4c2');
 spot('Return to L1',828,830,90,'Go downstairs to the Home & More service corridor.');
 spot('Family seating',815,698,74,'The upstairs room is a quiet family gathering and respite space, not a business office.');
 return {doors,level:'upper'};
}
function paint(api){
 for(const d of doors){
  if(d.open){api.rect(d.x-4,d.y,5,5,'#d7b189');continue;}
  api.rect(d.x,d.y,d.w,d.h,'#423347');
  api.rect(d.x+2,d.y+2,4,d.h-4,'#c19c84');
  api.rect(d.x+d.w-4,d.y+d.h/2,3,4,'#f3c994');
 }
}
window.HomeMoreMap={
 build:map,upper:upper,paint:paint,
 get doors(){return doors;},get floor(){return floorId;},
 open(id,blocks){
  const d=doors.find(x=>x.id===id);
  if(!d)return null;
  if(!d.open){d.open=true;openStates[id]=true;let i=blocks.indexOf(d.block);if(i>=0)blocks.splice(i,1)}
  return d;
 }
};
})();