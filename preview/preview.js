(function(){
  'use strict';
  const A=LastChanceArt,S=LastChanceSimulation,$=id=>document.getElementById(id);
  const canvas=$('arena'),ctx=canvas.getContext('2d',{alpha:false}),painter=new A.CanvasPainter(ctx);
  let world=S.createWorld('port'),background=document.createElement('canvas'),bgPainter,keys=new Set(),mouse={x:1200,y:560},last=performance.now(),uiTick=0,frameWork=[],measurement=null,lastReport=null;
  background.width=1600;background.height=800;bgPainter=new A.CanvasPainter(background.getContext('2d',{alpha:false}));
  const roster=$('roster');
  A.players.forEach(v=>{ const card=document.createElement('article');card.className='player-card';card.style.setProperty('--player',v.color);card.innerHTML=`<div class="player-title">${v.mark} · ${v.name}<small class="role">ОЖИДАНИЕ</small></div><div class="meter-row"><span>HP</span><b class="hp-label">100 / 100</b></div><div class="meter health"><i class="hp-bar"></i></div><div class="meter-row"><span class="mobility-caption">Мобильность</span><b class="mobility-label">100 / 100</b></div><div class="meter"><i class="mobility-bar"></i></div><div class="card-details"><span class="coins">60 монет</span><span class="weight">0 кг</span><span class="home">Без убежища</span></div>`;roster.append(card); });
  const anims=A.states.map((s,i)=>{ const box=document.createElement('div');box.className='animation-card';box.innerHTML=`<canvas width="128" height="128" aria-label="${A.stateLabels[i]}"></canvas><span>${A.stateLabels[i]}</span>`;$('animation-grid').append(box);return {state:s,ctx:box.firstChild.getContext('2d')}; });
  function makeBackground() {
    const d=A.districts.find(v=>v.id===world.district); A.scenery(bgPainter,d);
    A.building(bgPainter,70,330,240,370,d,null,'ГАРАЖ 01'); A.building(bgPainter,1150,340,280,360,d,null,'СТОРОЖКА 02');
    // Open steel supports have a different silhouette from solid buildings.
    for(const [x,y,h] of [[90,550,150],[355,550,150],[820,540,160],[1090,540,160]]) { bgPainter.rect(x,y+15,12,h-15,A.palette.steel,0,A.palette.ink,2);bgPainter.line(x,y+h,x+53,y+35,A.palette.ink,4); }
    bgPainter.rect(10,717,570,28,A.palette.ink,2,null,0);bgPainter.rect(710,717,880,28,A.palette.ink,2,null,0);
    A.booth(bgPainter,'shop',480,700); A.booth(bgPainter,'roulette',1040,700);
    bgPainter.rect(730,586,56,90,A.palette.rust,2);bgPainter.line(744,595,744,668,A.palette.ink,2);bgPainter.line(759,595,759,668,A.palette.ink,2);
    for(const x of [608,700]) { bgPainter.line(x,700,x,736,A.palette.ink,4);bgPainter.ellipse(x,739,12,15,A.palette.steel); }
    $('district-label').textContent=d.name;$('district-subtitle').textContent=d.subtitle;
  }
  function setDistrict(id) { const reduced=world.reducedEffects,shake=world.shakeEnabled;world=S.createWorld(id);world.reducedEffects=reduced;world.shakeEnabled=shake;keys.clear();$('stress-button').setAttribute('aria-pressed','false');makeBackground();updateHUD(); }
  function render() {
    ctx.save();if(world.shakeEnabled&&world.shake>0&&!world.reducedEffects) ctx.translate(Math.sin(world.clock*160)*3,Math.cos(world.clock*110)*2);
    ctx.drawImage(background,0,0);
    const p=painter,c=A.palette;
    for(const home of world.shelters) if(home.owner!==null) {
      const v=A.players[home.owner],y=home.id===0?330:340;
      p.rect(home.x+4,y+4,home.w-8,7,v.color,1,null,0);p.line(home.x+home.w-22,y-5,home.x+home.w-22,y-70,c.ink,4);
      p.poly([[home.x+home.w-21,y-68],[home.x+home.w+24,y-59],[home.x+home.w+16,y-35],[home.x+home.w-21,y-40]],v.color,c.ink,2.5);p.text(v.mark,home.x+home.w-2,y-47,13,c.ink,900,'center');
      p.rect(home.x+home.w/2-13,674,26,18,v.color,2,c.ink,2);p.text(v.mark,home.x+home.w/2,687,11,c.ink,900,'center');
    }
    for(const t of world.platforms) if(t.alive) A.platform(p,t.x,t.y,t.w,t.destructible);
    const active=world.players[world.active];
    if(world.phase==='turn'&&active.aiming>0) {
      const a=active.aim; for(let i=1;i<13;i++) { const t=i*.055;p.ellipse(active.x+Math.cos(a)*(47+650*t),active.y+2+Math.sin(a)*(47+650*t)+60*t*t,2,2,c.white,c.ink,.7); }
    }
    for(const l of world.loot) if(l.carrier===null) A.loot(p,l.type,l.x,l.y,l.angle,l.type==='fish'?1.1:1);
    for(const body of world.players) {
      const v=A.players[body.id],clip=A.clips[body.state];
      const phase=clip.loop?(body.stateTime/clip.duration)%1:Math.min(1,body.stateTime/clip.duration);
      p.ellipse(body.x,body.y+44,24,5,c.ink+'30',null,0);
      A.hero(p,v,body.state,phase,{x:body.x,y:body.y,facing:body.facing});
      if(body===active&&world.phase==='turn'||body.aiming>0) A.weapon(p,body.x+body.facing*13,body.y+5,body.aim,'launcher',.85);
      if(body.loot!==null) { const l=world.loot.find(l=>l.id===body.loot);if(l) A.loot(p,l.type,l.x,l.y,0,l.type==='fish'?1.1:1); }
      p.rect(body.x-26,body.y-65,52,17,body===active?v.color:c.paper,4,c.ink,1.5);p.text(v.mark+' '+Math.round(body.hp),body.x,body.y-53,10,c.ink,800,'center');
      if(body===active) p.poly([[body.x,body.y-73],[body.x-6,body.y-82],[body.x+6,body.y-82]],v.color,c.ink,1.5);
      if(body.mobility<=.001) { p.rect(body.x-34,body.y+51,68,15,c.paper,3,c.ink,1);p.text('МОЖНО СТРЕЛЯТЬ',body.x,body.y+61,7,c.rust,800,'center'); }
    }
    for(const s of world.shots) { const a=Math.atan2(s.vy,s.vx); p.line(s.x-Math.cos(a)*28,s.y-Math.sin(a)*28,s.x,s.y,c.gold,3);p.group(s.x,s.y,a);p.rect(-7,-4,14,8,c.coral,3);p.poly([[-7,0],[-14,-5],[-14,5]],c.gold,null,0);p.end(); }
    for(const e of world.particles) { if(e.type==='flash') p.ellipse(e.x,e.y,13*(e.life/e.maxLife)+3,13*(e.life/e.maxLife)+3,c.gold,null,0);else p.rect(e.x,e.y,e.type==='steel'?8:5,e.type==='steel'?5:5,e.type==='steel'?c.steel:c.rust,1,c.ink,1); }
    for(const station of world.stations) if(Math.abs(active.x-station.x)<85&&active.y>600&&world.phase==='turn') { p.rect(station.x-50,710,100,24,c.paper,5,c.ink,2);p.text('E · '+(station.type==='shop'?'ЛАВКА':'СТАВКА'),station.x,727,11,c.ink,800,'center'); }
    ctx.restore();
  }
  function updateHUD() {
    const active=world.players[world.active];$('turn-label').textContent=(world.phase==='turn'?'Ход ':'Расчёт выстрела · ')+A.players[world.active].name;
    $('timer').textContent=Math.ceil(world.time)+' с';$('round-label').textContent='Раунд '+world.round;$('status').textContent=world.messageTime>0?world.message:active.mobility<=.001?'Мобильность кончилась. Прицеливание и выстрел доступны.':'Рыба тяжёлая. Товарищи тоже.';
    Array.from(roster.children).forEach((card,i)=>{ const p=world.players[i];card.classList.toggle('active',i===world.active);card.querySelector('.role').textContent=i===world.active?'ВАШ ХОД':'ДАЛЕЕ '+((i-world.active+4)%4);card.querySelector('.hp-label').textContent=Math.round(p.hp)+' / 100';card.querySelector('.hp-bar').style.width=p.hp+'%';card.querySelector('.mobility-label').textContent=Math.ceil(p.mobility)+' / '+p.maxMobility;card.querySelector('.mobility-bar').style.width=p.mobility/100*100+'%';card.querySelector('.mobility-caption').textContent=p.mobility<=.001?'Можно стрелять':'Мобильность';card.querySelector('.mobility-caption').classList.toggle('empty',p.mobility<=.001);card.querySelector('.coins').textContent=p.coins+' монет';card.querySelector('.weight').textContent=(world.loot.find(l=>l.id===p.loot)?.weight||0)+' кг';card.querySelector('.home').textContent=p.home===null?'Без убежища':'Убежище '+(p.home+1); });
    if($('roulette-dialog').open) updateBetButtons();
    $('perf').textContent=(frameWork.length?frameWork.reduce((a,b)=>a+b,0)/frameWork.length:0).toFixed(2)+' мс / кадр';
  }
  function updateBetButtons() {
    const p=world.players[world.active],near=world.phase==='turn'&&Math.abs(p.x-1040)<=85&&p.y>600;
    document.querySelectorAll('[data-stake]').forEach(b=>{ b.disabled=!near||p.betRound===world.round||p.maxMobility-Number(b.dataset.stake)<40; });
    document.querySelectorAll('[data-lootbet]').forEach(b=>{ b.disabled=!near||p.loot===null; });
    $('bet-hint').textContent='Игрок '+(p.id+1)+' · максимум '+p.maxMobility+' · текущая '+Math.ceil(p.mobility)+(p.betRound===world.round?' · ставка за раунд уже сделана':'');
  }
  function show(dialog) { keys.clear();dialog.showModal(); }
  window.addEventListener('keydown',e=>{
    if(e.target.closest('button')&&(e.code==='Space'||e.code==='Enter')) return;
    if(document.querySelector('dialog[open]')) return;
    if(['Space','ArrowLeft','ArrowRight','Enter'].includes(e.code)) e.preventDefault();
    keys.add(e.code);if(e.repeat)return;
    if(e.code==='Space') S.jump(world);if(e.code==='ShiftLeft'||e.code==='ShiftRight')S.dash(world);if(e.code==='Enter'&&world.phase==='turn')S.nextTurn(world);
    if(e.code==='KeyE') {const action=S.interact(world);if(action==='roulette'){updateBetButtons();show($('roulette-dialog'));} if(action==='shop')show($('shop-dialog'));}
  });
  window.addEventListener('keyup',e=>keys.delete(e.code));window.addEventListener('blur',()=>keys.clear());
  canvas.addEventListener('mousemove',e=>{const r=canvas.getBoundingClientRect();mouse.x=(e.clientX-r.left)*1600/r.width;mouse.y=(e.clientY-r.top)*800/r.height;const p=world.players[world.active];p.aim=Math.atan2(mouse.y-p.y,mouse.x-p.x);p.facing=mouse.x>=p.x?1:-1;p.aiming=.9;});
  canvas.addEventListener('pointerdown',e=>{if(e.button!==0||document.querySelector('dialog[open]'))return;canvas.focus();S.shoot(world,mouse.x,mouse.y);});
  $('reset-button').onclick=()=>setDistrict(world.district);
  $('stress-button').onclick=()=>{if(world.stress)setDistrict(world.district);else{S.startStress(world);$('stress-button').setAttribute('aria-pressed','true');}};
  $('effects-button').onclick=()=>{world.reducedEffects=!world.reducedEffects;$('effects-button').setAttribute('aria-pressed',String(world.reducedEffects));};
  $('shake-button').onclick=()=>{world.shakeEnabled=!world.shakeEnabled;$('shake-button').setAttribute('aria-pressed',String(world.shakeEnabled));$('shake-button').textContent='Тряска: '+(world.shakeEnabled?'вкл.':'выкл.');};
  if(matchMedia('(prefers-reduced-motion: reduce)').matches){world.reducedEffects=true;$('effects-button').setAttribute('aria-pressed','true');}
  document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>b.closest('dialog').close());
  document.querySelectorAll('[data-stake]').forEach(b=>b.onclick=()=>{S.bet(world,Number(b.dataset.stake));$('roulette-dialog').close();});
  document.querySelectorAll('[data-lootbet]').forEach(b=>b.onclick=()=>{S.betLoot(world,b.dataset.lootbet);$('roulette-dialog').close();});
  $('buy-button').onclick=()=>{S.buy(world);$('shop-dialog').close();};
  $('board-button').onclick=()=>{const p=new A.CanvasPainter($('style-board').getContext('2d'));A.board(p);show($('board-dialog'));};
  const mp=new A.CanvasPainter($('world-map').getContext('2d'));
  function map() {
    A.worldMap(mp,world.district);
  }
  A.districts.forEach(d=>{const b=document.createElement('button');b.innerHTML=d.name+'<small>'+d.subtitle+'</small>';b.onclick=()=>{setDistrict(d.id);$('map-dialog').close();};$('district-options').append(b);});
  $('map-button').onclick=()=>{map();show($('map-dialog'));};
  function quantile(a,q){const s=[...a].sort((a,b)=>a-b);return s[Math.min(s.length-1,Math.floor((s.length-1)*q))]||0;}
  function finishMeasurement(m) {
    const report={timestamp:new Date().toISOString(),renderer:'Canvas 2D / shared vector geometry',userAgent:navigator.userAgent,resolution:[canvas.width,canvas.height],durationSeconds:(performance.now()-m.start)/1000,frames:m.work.length,workMs:{median:quantile(m.work,.5),p95:quantile(m.work,.95),max:Math.max(...m.work)},frameIntervalMs:{median:quantile(m.intervals,.5),p95:quantile(m.intervals,.95),max:Math.max(...m.intervals)},maxConcurrent:m.counts,events:{...world.stats},limits:S.tuning,scope:'Headless/local browser art harness; not Unity player performance.'};
    lastReport=report;measurement=null;$('report-button').disabled=false;$('report-button').textContent='Замерить 30 секунд';$('download-button').hidden=false; m.resolve(report);
  }
  function runBenchmark(seconds=30) {
    if(measurement) return Promise.reject(new Error('Measurement already running'));
    setDistrict('port');S.startStress(world);$('stress-button').setAttribute('aria-pressed','true');$('report-button').disabled=true;$('report-button').textContent='Идёт замер…';
    return new Promise(resolve=>{measurement={start:performance.now(),seconds,work:[],intervals:[],counts:{players:4,loot:world.loot.length,projectiles:world.shots.length,particles:world.particles.length},resolve};});
  }
  $('report-button').onclick=()=>runBenchmark();$('download-button').onclick=()=>{const blob=new Blob([JSON.stringify(lastReport,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='last-chance-performance.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
  function frame(now) {
    const interval=now-last,dt=Math.min(.05,Math.max(0,interval/1000));last=now;const begin=performance.now();
    const move=document.querySelector('dialog[open]')?0:(keys.has('KeyD')||keys.has('ArrowRight')?1:0)-(keys.has('KeyA')||keys.has('ArrowLeft')?1:0);
    S.update(world,dt,{move});render();
    anims.forEach(v=>{v.ctx.clearRect(0,0,128,128);const p=new A.CanvasPainter(v.ctx),clip=A.clips[v.state],phase=(world.clock/(clip.duration+.25))%1;A.hero(p,A.players[0],v.state,phase,{x:64,y:67,scale:.9});if(v.state==='aim')A.weapon(p,84,74,-.05,'launcher',.65);});
    const work=performance.now()-begin;frameWork.push(work);if(frameWork.length>90)frameWork.shift();uiTick+=dt;if(uiTick>.1){updateHUD();uiTick=0;}
    if(measurement) {const m=measurement;m.work.push(work);m.intervals.push(interval);m.counts.loot=Math.max(m.counts.loot,world.loot.length);m.counts.projectiles=Math.max(m.counts.projectiles,world.shots.length);m.counts.particles=Math.max(m.counts.particles,world.particles.length);if(now-m.start>=m.seconds*1000)finishMeasurement(m);}
    requestAnimationFrame(frame);
  }
  window.LastChancePreview={get world(){return world;},setDistrict,render,runBenchmark,get lastReport(){return lastReport;},stopKeys:()=>keys.clear()};
  makeBackground();updateHUD();requestAnimationFrame(frame);
})();
