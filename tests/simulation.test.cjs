const {test}=require('node:test');
const assert=require('node:assert/strict');
const S=require('../src/simulation.js');
const A=require('../src/art.js');
test('ходьба расходует мобильность за фактическое движение; край карты бесплатен',()=>{
  const w=S.createWorld('residential'),p=w.players[0],x=p.x;
  for(let i=0;i<60;i++) S.update(w,1/60,{move:1});
  assert.ok(Math.abs(p.mobility-(100-(p.x-x)/48*5))<.0001);
  p.x=1576;const before=p.mobility;S.update(w,.05,{move:1});assert.equal(p.mobility,before);
});
test('тяжёлая физическая добыча увеличивает цену движения',()=>{
  const a=S.createWorld('residential'),b=S.createWorld('residential');const l=S.placeLoot(b,'fish',170,640);l.carrier=0;b.players[0].loot=l.id;
  S.update(a,.05,{move:1});S.update(b,.05,{move:1});
  assert.ok(b.players[0].mobility<a.players[0].mobility);assert.equal(l.x,b.players[0].x);
});
test('при нуле движение, прыжок и рывок блокируются, прицел и выстрел доступны',()=>{
  const w=S.createWorld(),p=w.players[0];p.mobility=0;const x=p.x;
  S.update(w,.05,{move:1});assert.equal(p.x,x);assert.equal(S.jump(w),false);assert.equal(S.dash(w),false);
  assert.equal(S.shoot(w,600,400),true);assert.equal(p.mobility,0);assert.equal(w.phase,'settling');
});
test('внешнее отбрасывание при пустой шкале двигает бойца без списания',()=>{
  const w=S.createWorld(),p=w.players[0];p.mobility=0;const x=p.x;
  S.explode(w,p.x-20,p.y,90);S.update(w,.05);
  assert.ok(p.x>x);assert.equal(p.mobility,0);assert.equal(p.state,'blast');assert.ok(p.hp<100);
});
test('собственный ход восстанавливает действующий максимум и лечит в своём убежище',()=>{
  const w=S.createWorld(),p=w.players[0];S.changeMaximum(p,-20);p.mobility=0;p.hp=50;
  assert.equal(S.interact(w),'home');for(let i=0;i<4;i++) S.nextTurn(w);
  assert.equal(p.mobility,80);assert.equal(p.hp,58);assert.equal(w.shelters[0].owner,0);
});
test('ставка меняет максимум с сохранением уже потраченной мобильности',()=>{
  for(const [roll,max,remaining,perk] of [[.1,100,62,'walk'],[.55,120,82,'jump'],[.7,80,42,null],[.95,80,42,'empty']]){
    const w=S.createWorld(),p=w.players[0];p.x=1040;p.mobility=62;
    assert.ok(S.bet(w,20,roll));assert.equal(p.maxMobility,max);assert.equal(p.mobility,remaining);assert.equal(p.perk,perk);
  }
});
test('ставка ограничена минимумом, дистанцией, фазой и одной попыткой за раунд',()=>{
  const w=S.createWorld(),p=w.players[0];assert.equal(S.bet(w,20,.7),false);p.x=1040;
  S.changeMaximum(p,-50);assert.equal(S.bet(w,20,.7),false);assert.ok(S.bet(w,10,.7));assert.equal(p.maxMobility,40);
  const before=p.mobility;assert.equal(S.bet(w,10,.1),false);assert.equal(p.mobility,before);
  assert.equal(S.bet(w,15,.1),false);
});
test('таймер продолжает ход без ввода и передаёт его следующему игроку',()=>{
  const w=S.createWorld();w.time=.01;S.update(w,.02);assert.equal(w.active,1);assert.equal(w.time,40);
});
test('атака передаёт ход после расчёта, а не при запуске снаряда',()=>{
  const w=S.createWorld();w.players[0].x=600;w.players[0].y=100;w.players[0].grounded=false;S.shoot(w,1200,100);assert.equal(w.active,0);
  for(let i=0;i<60;i++)S.update(w,1/60);assert.equal(w.active,0);
  for(let i=0;i<110;i++)S.update(w,1/60);assert.equal(w.active,1);
});
test('взрыв разрушает отдельные модули, сохраняет постоянный пол и сбрасывает добычу',()=>{
  const w=S.createWorld(),p=w.players[0],item=w.loot[0];p.loot=item.id;item.carrier=0;
  S.explode(w,180,550,100);assert.ok(w.platforms.some(t=>t.destructible&&!t.alive));assert.ok(w.platforms.filter(t=>!t.destructible).every(t=>t.alive));
  S.explode(w,p.x,p.y,100);assert.equal(p.loot,null);assert.equal(item.carrier,null);
});
test('на всех трёх аренах четыре бойца, физическая добыча и торговые точки',()=>{
  for(const d of A.districts){const w=S.createWorld(d.id);assert.equal(w.players.length,4);assert.ok(w.loot.length>=5);assert.equal(w.stations.length,2);for(let i=0;i<60;i++)S.update(w,1/60);assert.ok(w.players.every(p=>p.y<800&&p.grounded));}
});
test('нагрузка ограничивает объекты и продолжает выстрелы с разрушениями',()=>{
  const w=S.createWorld();S.startStress(w);
  for(let i=0;i<900;i++){S.update(w,1/60);assert.ok(w.loot.length<=48);assert.ok(w.shots.length<=24);assert.ok(w.particles.length<=160);}
  assert.ok(w.stats.shots>80);assert.ok(w.stats.explosions>100);assert.ok(w.stats.destructions>40);
});
test('пересечение сегментом исключает пролёт быстрого снаряда через тонкую платформу',()=>{
  const fraction=S.segmentHit(20,0,20,50,0,20,40,25);assert.equal(fraction,.4);assert.equal(S.segmentHit(50,0,50,50,0,20,40,25),null);
});
test('рулетка трофеями считает выплату, а проигрыш убирает физический предмет',()=>{
  for(const [sector,expected] of [[0,180],[6,60],[7,60]]){
    const w=S.createWorld(),p=w.players[0],l=w.loot[0];p.x=1040;p.loot=l.id;l.carrier=0;
    S.betLoot(w,'red',sector);assert.equal(p.coins,expected);assert.equal(p.loot,null);assert.ok(!w.loot.includes(l));assert.equal(p.stateTime,0);
  }
});
