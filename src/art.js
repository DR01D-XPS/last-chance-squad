(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.LastChanceArt = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const palette = Object.freeze({
    ink: '#202B38', paper: '#F4E9D5', white: '#FFF7E6', steel: '#566675',
    wall: '#78828A', concrete: '#B5ADA1', olive: '#727D54', rust: '#B35B45',
    teal: '#39B7BC', coral: '#F57752', gold: '#F6C453', violet: '#AA8CDB',
    water: '#355F69', sky: '#DFCCB5', distant: '#A89B9D', black: '#334352'
  });
  const players = Object.freeze([
    { id: 0, name: 'Клёп', color: palette.teal, hat: 'hardhat', pack: 'tool', mark: 'I' },
    { id: 1, name: 'Поплавок', color: palette.coral, hat: 'fisher', pack: 'roll', mark: 'II' },
    { id: 2, name: 'Пластырь', color: palette.gold, hat: 'medic', pack: 'medical', mark: 'III' },
    { id: 3, name: 'Шурш', color: palette.violet, hat: 'beanie', pack: 'pouch', mark: 'IV' }
  ]);
  const states = ['idle', 'walk', 'aim', 'hurt', 'blast', 'joy', 'roulette_loss'];
  const stateLabels = ['Ожидание', 'Ходьба', 'Прицеливание', 'Урон', 'От взрыва', 'Радость', 'Проигрыш'];
  const hatLabels = { hardhat: 'Каска', fisher: 'Вязаная шапка', medic: 'Кепка медика', beanie: 'Шапка с помпоном' };
  const packLabels = { tool: 'Рюкзак с инструментами', roll: 'Рюкзак со скаткой', medical: 'Сумка медика', pouch: 'Мешок с ремнями' };
  const clips = Object.freeze({
    idle: { duration: 1.2, loop: true }, walk: { duration: .64, loop: true },
    aim: { duration: .8, loop: true }, hurt: { duration: .24, loop: false },
    blast: { duration: .64, loop: true }, joy: { duration: .8, loop: false },
    roulette_loss: { duration: 1.1, loop: false }
  });
  const districts = Object.freeze([
    { id: 'residential', name: 'Жилой район', subtitle: 'Дворы и крыши', sky: '#DFCCB5', back: '#A89B9D', wall: '#B5ADA1', accent: '#39B7BC', props: 'balconies' },
    { id: 'factory', name: 'Завод', subtitle: 'Цех и конвейер', sky: '#C9C2B5', back: '#909596', wall: '#78828A', accent: '#F6C453', props: 'pipes' },
    { id: 'port', name: 'Порт', subtitle: 'Причалы и контейнеры', sky: '#DFCCB5', back: '#A89B9D', wall: '#566675', accent: '#F57752', props: 'crane' }
  ]);

  // Both adapters use the same geometry. Canvas preview and SVG exports cannot drift.
  class CanvasPainter {
    constructor(ctx) { this.ctx = ctx; }
    group(x = 0, y = 0, r = 0, sx = 1, sy = 1) { const c = this.ctx; c.save(); c.translate(x, y); c.rotate(r); c.scale(sx, sy); }
    end() { this.ctx.restore(); }
    clipRect(x,y,w,h) { const c=this.ctx;c.save();c.beginPath();c.rect(x,y,w,h);c.clip(); }
    shape(kind, args, fill, stroke = palette.ink, width = 3) {
      const c = this.ctx; c.beginPath();
      if (kind === 'rect') c.roundRect(args[0], args[1], args[2], args[3], args[4] || 0);
      if (kind === 'ellipse') c.ellipse(args[0], args[1], args[2], args[3], 0, 0, Math.PI * 2);
      if (kind === 'poly') { c.moveTo(args[0][0], args[0][1]); args.slice(1).forEach(p => c.lineTo(p[0], p[1])); c.closePath(); }
      if (fill) { c.fillStyle = fill; c.fill(); }
      if (stroke && width) { c.strokeStyle = stroke; c.lineWidth = width; c.lineJoin = 'round'; c.lineCap = 'round'; c.stroke(); }
    }
    rect(x, y, w, h, fill, r = 0, stroke = palette.ink, lw = 3) { this.shape('rect', [x,y,w,h,r], fill, stroke, lw); }
    ellipse(x, y, rx, ry, fill, stroke = palette.ink, lw = 3) { this.shape('ellipse', [x,y,rx,ry], fill, stroke, lw); }
    poly(points, fill, stroke = palette.ink, lw = 3) { this.shape('poly', points, fill, stroke, lw); }
    line(x1, y1, x2, y2, color = palette.ink, lw = 3) { const c = this.ctx; c.beginPath(); c.moveTo(x1,y1); c.lineTo(x2,y2); c.strokeStyle=color; c.lineWidth=lw; c.lineCap='round'; c.stroke(); }
    text(value, x, y, size = 16, color = palette.ink, weight = 700, align = 'left') { const c=this.ctx; c.font=`${weight} ${size}px Arial, sans-serif`; c.fillStyle=color; c.textAlign=align; c.fillText(value,x,y); }
  }
  function escape(s) { return String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;'); }
  class SVGPainter {
    constructor(w, h) { this.w=w; this.h=h; this.parts=[]; this.clipId=0; }
    group(x=0,y=0,r=0,sx=1,sy=1) { this.parts.push(`<g transform="translate(${x} ${y}) rotate(${r*180/Math.PI}) scale(${sx} ${sy})">`); }
    end() { this.parts.push('</g>'); }
    clipRect(x,y,w,h) { const id='clip-'+(++this.clipId);this.parts.push(`<defs><clipPath id="${id}"><rect x="${x}" y="${y}" width="${w}" height="${h}"/></clipPath></defs><g clip-path="url(#${id})">`); }
    attrs(fill,stroke,lw) { return `fill="${fill||'none'}" stroke="${stroke||'none'}" stroke-width="${lw}" stroke-linejoin="round" stroke-linecap="round"`; }
    rect(x,y,w,h,fill,r=0,stroke=palette.ink,lw=3) { this.parts.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" ${this.attrs(fill,stroke,lw)}/>`); }
    ellipse(x,y,rx,ry,fill,stroke=palette.ink,lw=3) { this.parts.push(`<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" ${this.attrs(fill,stroke,lw)}/>`); }
    poly(points,fill,stroke=palette.ink,lw=3) { this.parts.push(`<polygon points="${points.map(p=>p.join(',')).join(' ')}" ${this.attrs(fill,stroke,lw)}/>`); }
    line(x1,y1,x2,y2,color=palette.ink,lw=3) { this.parts.push(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" ${this.attrs(null,color,lw)}/>`); }
    text(value,x,y,size=16,color=palette.ink,weight=700,align='left') { this.parts.push(`<text x="${x}" y="${y}" font-family="Arial,sans-serif" font-size="${size}" font-weight="${weight}" fill="${color}" text-anchor="${align==='center'?'middle':align==='right'?'end':'start'}">${escape(value)}</text>`); }
    svg() { return `<svg xmlns="http://www.w3.org/2000/svg" width="${this.w}" height="${this.h}" viewBox="0 0 ${this.w} ${this.h}">${this.parts.join('')}</svg>`; }
  }

  function pose(state, t) {
    const s = Math.sin(t*Math.PI*2), c = Math.cos(t*Math.PI*2);
    const p={sx:1,sy:1,tilt:0,y:0,step:0,hand:0,eye:'open',look:3,hat:0,mouth:'small'};
    if (state==='idle') { p.sy=1+s*.018; p.y=-s*.7; p.eye=t>.83&&t<.91?'blink':'open'; }
    if (state==='walk') { p.step=s*9; p.tilt=s*.055; p.y=-Math.abs(s)*3; p.sx=1+Math.abs(s)*.025; p.sy=1-Math.abs(s)*.025; p.hand=-s*5; }
    if (state==='aim') { p.tilt=-.055; p.look=5; p.hand=1; p.sy=1+s*.009; p.eye='focus'; }
    if (state==='hurt') { const k=Math.sin(Math.min(1,t)*Math.PI); p.sx=1+k*.18; p.sy=1-k*.16; p.tilt=-k*.2; p.eye='pinch'; p.hand=-10*k; p.mouth='shock'; }
    if (state==='blast') { p.tilt=-.6+s*.13; p.sy=1.08; p.sx=.92; p.hand=-21; p.step=12; p.eye='wide'; p.hat=-7; p.mouth='shock'; }
    if (state==='joy') { p.y=-Math.abs(s)*9; p.hand=-30; p.eye='happy'; p.mouth='smile'; p.sy=1+s*.045; p.sx=1-s*.04; }
    if (state==='roulette_loss') { const k=Math.sin(Math.min(1,t)*Math.PI/2); p.tilt=.12*k; p.sy=1-.14*k; p.sx=1+.08*k; p.eye='sad'; p.look=-1; p.hand=10*k; p.mouth='frown'; p.hat=3*k; }
    return p;
  }
  function hat(p, type, lift=0) {
    const c=palette; p.group(0,lift);
    if(type==='hardhat') { p.ellipse(0,-32,24,13,c.gold); p.rect(-28,-32,55,7,c.gold,3); p.line(0,-43,0,-34,c.ink,2); p.rect(-17,-39,8,3,c.white,1,null,0); }
    if(type==='fisher') { p.poly([[-21,-29],[-20,-45],[7,-48],[22,-35],[20,-28]],c.olive); p.rect(-24,-32,48,9,c.olive,3); p.line(-7,-41,-6,-33,c.ink,2); p.line(5,-42,7,-33,c.ink,2); }
    if(type==='medic') { p.rect(-22,-44,45,18,c.white,7); p.rect(-24,-31,52,8,c.coral,3); p.rect(-4,-42,7,13,c.coral,0,null,0); p.rect(-7,-39,13,6,c.coral,0,null,0); }
    if(type==='beanie') { p.ellipse(0,-34,23,13,c.rust); p.rect(-25,-32,48,10,c.coral,4); p.ellipse(1,-49,7,7,c.coral); [-15,-5,5,15].forEach(x=>p.line(x,-30,x,-23,c.ink,1.7)); }
    p.end();
  }
  function backpack(p,type) {
    const c=palette;
    if(type==='tool') { p.rect(-34,-15,20,39,c.olive,6); p.rect(-39,-7,13,15,c.olive,3); p.line(-32,13,-19,13,c.ink,2); p.rect(-29,-19,10,8,c.steel,2); }
    if(type==='roll') { p.rect(-35,-15,21,37,c.olive,5); p.rect(-38,-22,30,12,c.olive,6); p.line(-31,-20,-31,-12,c.ink,2); p.rect(-31,0,14,11,c.concrete,2); }
    if(type==='medical') { p.rect(-35,-12,22,35,c.white,5); p.rect(-30,-3,12,5,c.coral,0,null,0); p.rect(-26,-7,5,13,c.coral,0,null,0); p.line(-32,14,-17,14,c.ink,2); }
    if(type==='pouch') { p.ellipse(-24,7,15,20,c.olive); p.rect(-36,-16,21,10,c.olive,4); p.rect(-29,1,11,10,c.gold,2); p.line(-24,3,-24,9,c.ink,1.7); }
  }
  // Local origin is at the hip; foot baseline y=44. Same pivots for every costume.
  function hero(p, player, state='idle', t=0, options={}) {
    const c=palette, v=pose(state,t), facing=options.facing||1;
    p.group(options.x||0,(options.y||0)+v.y,v.tilt,(options.scale||1)*facing,options.scale||1);
    p.group(0,0,0,v.sx,v.sy); backpack(p,player.pack);
    p.line(-11,26,-12-v.step,36,c.ink,5); p.line(11,26,11+v.step,36,c.ink,5);
    p.rect(-23-v.step,33,22,11,c.ink,4,c.ink,2); p.rect(2+v.step,33,24,11,c.ink,4,c.ink,2);
    p.rect(-23,-34,46,66,player.color,21,c.ink,3.5);
    // One flat seam adds industrial personality without noise or material shading.
    p.line(-14,21,13,21,c.ink,1.6);
    if(v.eye==='happy') { p.line(-8,-13,-3,-17,c.ink,3); p.line(-3,-17,2,-13,c.ink,3); p.line(8,-13,13,-17,c.ink,3); p.line(13,-17,18,-13,c.ink,3); }
    else if(v.eye==='pinch'||v.eye==='blink') { p.line(-10,-14,1,-13,c.ink,3); p.line(8,-13,18,-14,c.ink,3); }
    else { p.ellipse(-5,-15,7,v.eye==='wide'?11:9,c.white,null,0); p.ellipse(12,-15,7,v.eye==='wide'?11:9,c.white,null,0); p.ellipse(-5+v.look*.55,-14,2.5,4,c.ink,null,0); p.ellipse(12+v.look*.55,-14,2.5,4,c.ink,null,0); }
    if(v.eye==='focus') p.line(-12,-23,2,-21,c.ink,2);
    if(v.eye==='sad') { p.line(-12,-26,0,-29,c.ink,2); p.line(8,-29,20,-25,c.ink,2); }
    if(v.mouth==='shock') p.ellipse(6,2,5,6,c.ink,null,0);
    else if(v.mouth==='smile') { p.poly([[0,0],[14,0],[11,8],[5,8]],c.ink,null,0); }
    else if(v.mouth==='frown') { p.line(1,7,8,4,c.ink,2); p.line(8,4,15,7,c.ink,2); }
    else p.line(3,3,10,4,c.ink,2);
    hat(p,player.hat,v.hat);
    if(state==='aim') { p.line(-17,5,0,8,c.ink,5); p.ellipse(4,8,6,6,player.color); p.line(18,2,30,4,c.ink,5); p.ellipse(31,4,6,6,player.color); }
    else { p.line(-20,3,-27,10+v.hand,c.ink,4); p.ellipse(-28,14+v.hand,6,7,player.color); p.line(20,3,28,10+v.hand,c.ink,4); p.ellipse(29,14+v.hand,6,7,player.color); }
    p.end(); p.end();
  }
  function weapon(p,x,y,angle=0,type='launcher',scale=1) {
    const c=palette; p.group(x,y,angle,scale,scale);
    p.rect(-10,3,10,14,c.steel,2); p.rect(-18,-7,39,14,c.steel,4);
    if(type==='launcher') { p.rect(14,-10,27,20,c.coral,4); p.ellipse(39,0,3,8,c.ink); p.line(-11,-10,5,-10,c.ink,3); }
    else if(type==='harpoon') { p.rect(14,-4,27,8,c.steel,2); p.poly([[41,0],[31,-9],[31,9]],c.white); }
    else { p.rect(14,-5,30,10,c.ink,2); p.rect(-10,-12,10,5,c.gold,1); }
    p.end();
  }
  function loot(p,type,x,y,angle=0,scale=1) {
    const c=palette; p.group(x,y,angle,scale,scale);
    if(type==='fish') { p.poly([[-20,0],[-31,-13],[-31,13]],c.teal); p.ellipse(0,0,25,13,c.teal); p.poly([[-7,-10],[0,-19],[12,-10]],c.steel); p.ellipse(15,-3,3.5,3.5,c.ink,null,0); p.line(16,6,22,3,c.ink,2); p.line(-10,4,-3,8,c.ink,2); }
    else if(type==='crate') { p.rect(-18,-18,36,36,c.olive,3); p.rect(-13,-13,26,26,c.olive,1,c.ink,2); p.line(-12,12,12,-12,c.ink,4); p.line(-14,-16,-14,16,c.ink,2); p.line(14,-16,14,16,c.ink,2); }
    else if(type==='bag') { p.ellipse(0,4,14,17,c.concrete); p.poly([[-7,-9],[-9,-20],[-2,-16],[6,-20],[7,-9]],c.concrete); p.line(-9,-8,9,-8,c.rust,3); p.text('¤',-5,10,15,c.ink); }
    else if(type==='gas') { p.rect(-12,-20,24,40,c.rust,9); p.rect(-6,-25,12,7,c.steel,2); p.rect(-8,-7,16,15,c.gold,2); p.poly([[-3,4],[1,-4],[4,4]],c.ink,null,0); }
    else if(type==='medkit') { p.rect(-17,-12,34,25,c.white,4); p.rect(-7,-18,14,6,c.steel,2); p.rect(-3,-6,6,15,c.coral,0,null,0); p.rect(-8,-1,16,5,c.coral,0,null,0); }
    else if(type==='spring') { p.rect(-18,12,36,6,c.gold,2); p.line(-12,9,12,3,c.steel,3); p.line(12,3,-12,-3,c.steel,3); p.line(-12,-3,12,-9,c.steel,3); p.rect(-19,-15,38,6,c.gold,2); }
    else if(type==='grenade') { p.ellipse(0,2,11,13,c.steel); p.rect(-6,-16,10,7,c.rust,2); p.line(3,-15,11,-10,c.ink,3); p.line(-8,3,8,3,c.coral,3); }
    else { p.ellipse(0,0,10,10,c.gold); p.line(0,-5,0,5,c.ink,2); }
    p.end();
  }
  function platform(p,x,y,w,destructible=false,accent=palette.gold) {
    const c=palette; p.rect(x,y,w,18,c.steel,3,c.ink,3); p.rect(x+3,y+3,w-6,4,destructible?c.rust:c.concrete,1,null,0);
    for(let dx=16;dx<w-8;dx+=32) { p.ellipse(x+dx,y+13,2,2,c.ink,null,0); }
    if(destructible) { p.poly([[x+8,y+2],[x+17,y+2],[x+11,y+8],[x+3,y+8]],accent,null,0); }
  }
  function building(p,x,y,w,h,district,owner=null,label='') {
    const c=palette; p.rect(x,y,w,h,district.wall,4,c.ink,4); p.rect(x+6,y+8,w-12,12,c.steel,1,c.ink,2);
    for(let dx=20;dx<w-24;dx+=56) for(let dy=44;dy<h-52;dy+=72) { p.rect(x+dx,y+dy,30,38,c.black,2,c.ink,3); p.line(x+dx+15,y+dy+3,x+dx+15,y+dy+35,c.wall,2); p.line(x+dx+3,y+dy+19,x+dx+27,y+dy+19,c.wall,2); }
    p.rect(x+w*.5-19,y+h-56,38,56,c.ink,17,c.ink,2); p.rect(x+w*.5-16,y+h-37,32,37,c.steel,0,c.ink,2);
    if(label) { p.rect(x+w*.5-58,y+24,116,24,c.paper,3,c.ink,2); p.text(label,x+w*.5,y+41,11,c.ink,800,'center'); }
    if(owner) {
      p.rect(x+4,y+4,w-8,7,owner.color,1,null,0); p.line(x+w-22,y-5,x+w-22,y-70,c.ink,4);
      p.poly([[x+w-21,y-68],[x+w+24,y-59],[x+w+16,y-35],[x+w-21,y-40]],owner.color,c.ink,2.5);
      p.text(owner.mark,x+w-2,y-47,13,c.ink,900,'center');
      p.rect(x+w*.5-13,y+h-26,26,18,owner.color,2,c.ink,2); p.text(owner.mark,x+w*.5,y+h-13,11,c.ink,900,'center');
    }
  }
  function booth(p,type,x,y) {
    const c=palette; p.group(x,y);
    p.rect(-52,-106,104,106,c.concrete,3,c.ink,3);
    p.rect(-55,-116,110,26,type==='roulette'?c.coral:c.gold,4,c.ink,3);
    p.text(type==='roulette'?'ЛУДКА':'ЛАВКА',0,-98,14,c.ink,900,'center');
    p.rect(-44,-82,88,60,c.black,3,c.ink,3);
    if(type==='roulette') {
      p.ellipse(0,-52,26,26,c.paper,c.ink,3);
      for(let i=0;i<8;i++) { const a=i*Math.PI/4; const b=a+Math.PI/4; p.poly([[0,-52],[Math.cos(a)*24,-52+Math.sin(a)*24],[Math.cos(b)*24,-52+Math.sin(b)*24]],i===6?c.gold:i===7?c.white:i%2?c.ink:c.coral,c.ink,1); }
      p.ellipse(0,-52,5,5,c.gold); p.poly([[0,-86],[-6,-76],[6,-76]],c.gold);
    } else { weapon(p,0,-53,0,'launcher',.8); p.line(-35,-29,35,-29,c.paper,2); }
    p.rect(-57,-19,114,19,c.olive,2,c.ink,3); p.end();
  }
  function scenery(p,district,w=1600,h=800) {
    const c=palette; p.rect(0,0,w,h,district.sky,0,null,0);
    p.ellipse(w*.74,145,65,65,c.gold,null,0);
    for(let i=0;i<18;i++) {
      const bw=60+(i*47%81), bh=110+(i*79%185), x=i*100-30;
      p.rect(x,h-210-bh,bw,bh,district.back,0,null,0);
      if(i%3===0) p.rect(x+bw*.6,h-245-bh,12,50,district.back,0,null,0);
      for(let n=0;n<3;n++) p.rect(x+15+n*19,h-190-bh,7,10,district.sky,1,null,0);
    }
    p.rect(0,h-212,w,212,district.id==='port'?c.water:c.concrete,0,null,0);
    if(district.id==='port') { for(let i=0;i<50;i++) p.line((i*137)%w,h-180+(i*29)%170,(i*137)%w+20+(i%4)*9,h-180+(i*29)%170,c.teal,2); }
    if(district.id==='factory') {
      for(let i=0;i<5;i++) { p.rect(130+i*280,90+(i%2)*38,25,300,c.steel,3,c.wall,2); p.rect(110+i*280,95+(i%2)*38,65,17,c.wall,3,c.steel,2); }
      p.rect(620,350,280,24,c.olive,4,c.ink,3); for(let i=0;i<9;i++) p.line(630+i*32,354,641+i*32,369,c.gold,3);
    }
    if(district.id==='residential') {
      p.line(90,200,600,250,c.ink,2); for(let i=0;i<8;i++) p.rect(135+i*55,209+i*5,25,25,i%2?c.paper:c.olive,2,c.ink,1);
      for(let i=0;i<3;i++) { p.rect(1040+i*80,180,56,12,c.steel,2,c.ink,2); p.line(1043+i*80,180,1043+i*80,153,c.ink,2); p.line(1092+i*80,180,1092+i*80,153,c.ink,2); }
    }
    if(district.id==='port') {
      p.line(1430,380,1430,48,c.ink,14); p.line(1426,50,1110,90,c.ink,10); p.line(1430,52,1260,195,c.ink,6); p.line(1260,195,1110,90,c.ink,6);
      p.line(1190,90,1190,255,c.ink,3); p.ellipse(1190,264,9,12,c.steel);
      for(let i=0;i<6;i++) p.line(1150+i*43,92-i*5,1194+i*26,163-i*15,c.steel,3);
    }
  }
  function board(p) {
    const c=palette; p.rect(0,0,1600,1050,c.paper,0,null,0);
    p.text('ОТРЯД ПОСЛЕДНЕГО ШАНСА',48,64,34,c.ink,900);
    p.text('Художественное направление / 01     Капсулы, добыча и дурные решения',50,94,17,c.steel,600);
    p.line(48,112,1552,112,c.ink,2);
    players.forEach((v,i)=>{ const x=48+i*384; p.rect(x,132,360,226,c.white,12,c.ink,2); hero(p,v,'idle',.16,{x:x+92,y:251,scale:1.5}); p.text(v.name,x+180,208,25,c.ink,900); p.text('0'+(i+1)+' / '+hatLabels[v.hat],x+180,237,12,c.steel,600); p.rect(x+180,256,140,10,v.color,4,null,0); p.text(packLabels[v.pack],x+180,291,11,c.ink,600); });
    p.text('ОДИН РИГ / СЕМЬ РЕАКЦИЙ',48,398,20,c.ink,900);
    states.forEach((s,i)=>{ const x=48+i*215; p.rect(x,417,196,176,c.white,9,c.ink,1.5); hero(p,players[0],s,s==='roulette_loss'?1:s==='hurt'?.5:.2,{x:x+98,y:498,scale:1.1}); if(s==='aim') weapon(p,x+121,506,-.07,'launcher',.8); p.text(stateLabels[i],x+98,570,14,c.ink,700,'center'); });
    p.text('ГОРОД ИЗ ОБЩИХ МОДУЛЕЙ',48,631,20,c.ink,900);
    districts.forEach((d,i)=>{ const x=48+i*512; p.group(x,653,0,.3025,.3025); p.clipRect(0,0,1600,800); scenery(p,d); building(p,120,280,330,420,d,players[i],'УБЕЖИЩЕ'); booth(p,i===2?'roulette':'shop',1120,700); platform(p,40,700,1460); loot(p,'fish',920,680,0,2); p.end(); p.end(); p.text(d.name,x+8,922,21,c.ink,900); p.text(d.subtitle,x+8,947,14,c.steel,600); });
    const colors=[c.teal,c.coral,c.gold,c.violet,c.ink,c.steel,c.wall,c.concrete,c.olive,c.rust,c.paper,c.water];
    colors.forEach((v,i)=>p.rect(48+i*72,982,60,26,v,5,c.ink,1)); p.text('Плоские цвета · контур 3 px · эффекты до 0,6 с',982,1001,17,c.steel,600);
  }
  function worldMap(p,current='port') {
    const c=palette;p.rect(0,0,900,300,c.paper,0,null,0);
    for(let i=0;i<14;i++)p.rect(20+i*69,25+(i*53)%120,37,35+(i*29)%78,c.concrete,3,null,0);
    p.line(125,190,450,140,c.ink,12);p.line(450,140,775,200,c.ink,12);p.line(125,190,775,200,c.steel,4);
    districts.forEach((d,i)=>{const x=[125,450,775][i],y=[190,140,200][i];p.ellipse(x,y,50,50,c.paper,c.ink,3);p.rect(x-30,y-24,60,44,d.wall,3,c.ink,2);p.rect(x-33,y-27,66,7,d.accent,2,c.ink,2);for(let j=0;j<3;j++)p.rect(x-22+j*16,y-14,9,11,c.ink,1,null,0);p.rect(x-7,y+4,14,16,c.ink,1,null,0);p.text(d.name,x,y+76,15,c.ink,800,'center');if(d.id===current)p.text('ВЫ ЗДЕСЬ',x,y-65,11,c.rust,800,'center');});
  }
  return { palette, players, states, stateLabels, clips, districts, CanvasPainter, SVGPainter, pose, hero, weapon, loot, platform, building, booth, scenery, board, worldMap };
});
