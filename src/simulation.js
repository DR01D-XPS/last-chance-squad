(function(root,factory){ const api=factory(); if(typeof module==='object'&&module.exports) module.exports=api; else root.LastChanceSimulation=api; })(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const tuning=Object.freeze({pixelsPerMetre:48,walkPerMetre:5,jumpCost:15,dashCost:25,mobility:100,minMaximum:40,turnSeconds:40,heal:8,gravity:1000,walkSpeed:185,jumpSpeed:580,particles:160,projectiles:24,loot:48,settleSeconds:2.4});
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
  function rng(seed) { let n=seed>>>0; return ()=>{ n+=0x6D2B79F5; let t=n; t=Math.imul(t^t>>>15,t|1); t^=t+Math.imul(t^t>>>7,t|61); return ((t^t>>>14)>>>0)/4294967296; }; }
  function makePlayer(id,x) { return {id,x,y:656,vx:0,vy:0,hp:100,maxMobility:100,mobility:100,grounded:true,facing:1,aim:0,aiming:0,state:'idle',stateTime:0,reaction:0,reactionName:'',walk:0,loot:null,coins:60,perk:null,betRound:-1,home:null,moving:false}; }
  function availableShot(p) { return p.hp>0; }
  function spend(p,cost) { if(p.mobility+1e-9<cost) return false; p.mobility=Math.max(0,p.mobility-cost); return true; }
  function changeMaximum(p,delta) { const spent=p.maxMobility-p.mobility; p.maxMobility=Math.max(tuning.minMaximum,p.maxMobility+delta); p.mobility=clamp(p.maxMobility-spent,0,p.maxMobility); }
  function placeLoot(world,type,x,y) { if(world.loot.length>=tuning.loot) return null; const l={id:world.nextId++,type,x,y,vx:0,vy:0,angle:0,weight:type==='fish'?3:type==='crate'?2:1,value:type==='fish'?60:type==='crate'?40:20,carrier:null}; world.loot.push(l); return l; }
  function createWorld(district='port',seed=92) {
    const w={district,players:[makePlayer(0,170),makePlayer(1,330),makePlayer(2,940),makePlayer(3,1340)],active:0,round:1,time:40,phase:'turn',settle:0,clock:0,random:rng(seed),nextId:0,loot:[],shots:[],particles:[],platforms:[],destroyed:0,stats:{shots:0,explosions:0,destructions:0},message:'Доберитесь до лавки, автомата или свободного убежища.',messageTime:8,reducedEffects:false,shakeEnabled:false,shake:0,stress:false,stressTick:0,
      shelters:[{id:0,x:70,w:240,owner:null},{id:1,x:1150,w:280,owner:null}],stations:[{type:'shop',x:480},{type:'roulette',x:1040}],events:[]};
    const tile=(x,y,width,destructible=false)=>w.platforms.push({id:w.nextId++,x,y,w:width,h:18,destructible,hp:45,alive:true});
    for(let x=0;x<1600;x+=100) if(x<600||x>=700||district!=='port') tile(x,700,100,false);
    for(let x=60;x<400;x+=85) tile(x,550,85,true);
    for(let x=150;x<405;x+=85) tile(x,400,85,true);
    for(let x=790;x<1130;x+=85) tile(x,540,85,true);
    for(let x=1220;x<1475;x+=85) tile(x,410,85,true);
    if(district==='factory') for(let x=580;x<850;x+=90) tile(x,590,90,true);
    if(district==='residential') for(let x=600;x<810;x+=70) tile(x,550,70,true);
    placeLoot(w,'fish',810,670); placeLoot(w,'crate',365,520); placeLoot(w,'bag',970,670); placeLoot(w,'gas',1250,670); placeLoot(w,'fish',1480,380);
    return w;
  }
  function say(w,text) { w.message=text; w.messageTime=5; }
  function react(p,state,duration) { p.reactionName=state; p.reaction=duration; p.stateTime=0; }
  function nextTurn(w) {
    w.active=(w.active+1)%4; if(w.active===0) w.round++;
    const p=w.players[w.active]; p.mobility=p.maxMobility; p.hp=Math.max(1,p.hp);
    if(p.home!==null) { const home=w.shelters[p.home]; if(home.owner===p.id&&p.x>=home.x&&p.x<=home.x+home.w&&p.grounded&&p.y>590) { p.hp=Math.min(100,p.hp+tuning.heal); say(w,'Убежище: +8 HP владельцу.'); } }
    w.time=tuning.turnSeconds; w.phase='turn'; w.settle=0; p.aiming=0;
  }
  function jump(w) { const p=w.players[w.active]; if(w.phase!=='turn'||!p.grounded||p.hp<=0||!spend(p,tuning.jumpCost*(p.perk==='jump'?.6:1))) return false; p.vy=-tuning.jumpSpeed; p.grounded=false; return true; }
  function dash(w) { const p=w.players[w.active]; if(w.phase!=='turn'||p.hp<=0||!spend(p,tuning.dashCost)) return false; p.vx+=p.facing*470; p.vy=Math.min(p.vy,-120); p.grounded=false; return true; }
  function addParticle(w,x,y,vx,vy,type='debris',life=.5) {
    // Ring-style recycling: effect count never grows with play time.
    if(w.particles.length>=tuning.particles) { const old=w.particles.shift(); Object.assign(old,{x,y,vx,vy,type,life,maxLife:life}); w.particles.push(old); }
    else w.particles.push({x,y,vx,vy,type,life,maxLife:life});
  }
  function drop(w,p) { if(p.loot===null) return; const l=w.loot.find(v=>v.id===p.loot); if(l) { l.carrier=null; l.x=p.x; l.y=p.y-55; l.vx=p.vx+50; l.vy=p.vy-130; } p.loot=null; }
  function explode(w,x,y,radius=95,source=-1) {
    w.stats.explosions++; w.shake=.13;
    const count=w.reducedEffects?6:20;
    for(let i=0;i<count;i++) { const a=w.random()*Math.PI*2,s=70+w.random()*180; addParticle(w,x,y,Math.cos(a)*s,Math.sin(a)*s,i%3===0?'flash':'debris',.22+w.random()*.32); }
    for(const p of w.players) {
      const dx=p.x-x,dy=p.y-y,d=Math.hypot(dx,dy); if(d>radius+24) continue;
      const power=1-d/(radius+24); p.hp=Math.max(0,p.hp-Math.round(30*power));
      p.vx+=(dx>=0?1:-1)*(140+power*310); p.vy-=190+power*270; p.grounded=false;
      react(p,'blast',.64); drop(w,p);
      // External impulse never calls spend(). Zero mobility must still allow knockback.
    }
    for(const l of w.loot) if(l.carrier===null) { const dx=l.x-x,dy=l.y-y,d=Math.hypot(dx,dy); if(d<radius+50) { l.vx+=(dx>=0?1:-1)*250; l.vy-=320; } }
    for(const t of w.platforms) if(t.alive&&t.destructible) {
      const px=clamp(x,t.x,t.x+t.w),py=clamp(y,t.y,t.y+t.h); if(Math.hypot(x-px,y-py)<radius) { t.hp-=60; if(t.hp<=0) { t.alive=false; w.destroyed++; w.stats.destructions++; for(let i=0;i<8;i++) addParticle(w,t.x+i*t.w/8,t.y,(w.random()-.5)*180,-60-w.random()*140,'steel',.5); } }
    }
    w.events.push({kind:'explosion',x,y,source,at:w.clock}); if(w.events.length>32) w.events.shift();
  }
  function shoot(w,targetX,targetY) {
    const p=w.players[w.active]; if(w.phase!=='turn'||!availableShot(p)||w.shots.length>=tuning.projectiles) return false;
    const angle=Math.atan2(targetY-(p.y+2),targetX-p.x); p.aim=angle; p.facing=Math.cos(angle)>=0?1:-1;
    w.shots.push({x:p.x+Math.cos(angle)*47,y:p.y+2+Math.sin(angle)*47,vx:Math.cos(angle)*650,vy:Math.sin(angle)*650,ttl:1.8,source:p.id});
    w.stats.shots++; p.aiming=.4; w.phase='settling'; w.settle=0; return true;
  }
  function bet(w,stake=20,forcedRoll) {
    const p=w.players[w.active]; if(w.phase!=='turn'||Math.abs(p.x-1040)>85||p.y<600||p.betRound===w.round||![10,20,30].includes(stake)||p.maxMobility-stake<tuning.minMaximum) return false;
    p.betRound=w.round; const roll=forcedRoll===undefined?w.random():forcedRoll;
    let result;
    if(roll<.5) { p.perk='walk'; react(p,'joy',.8); result='УСПЕХ · экономная ходьба, максимум сохранён'; }
    else if(roll<.6) { changeMaximum(p,stake); p.perk='jump'; react(p,'joy',.8); result='ДЖЕКПОТ · дешёвый прыжок, максимум +'+stake; }
    else if(roll<.85) { changeMaximum(p,-stake); react(p,'roulette_loss',1.1); result='ПРОИГРЫШ · максимум −'+stake; }
    else { changeMaximum(p,-stake); p.perk='empty'; react(p,'roulette_loss',1.1); result='КРИВАЯ СДЕЛКА · максимум −'+stake+', сильнее взрыв'; }
    say(w,result); w.events.push({kind:'bet',player:p.id,result,max:p.maxMobility,mobility:p.mobility}); return result;
  }
  function betLoot(w,color='red',forcedSector) {
    const p=w.players[w.active]; if(w.phase!=='turn'||Math.abs(p.x-1040)>85||p.y<600||p.loot===null||!['red','black','gold'].includes(color)) return false;
    const item=w.loot.find(l=>l.id===p.loot), sector=forcedSector===undefined?Math.floor(w.random()*8):forcedSector;
    const winning=color==='red'?sector<3:color==='black'?sector>=3&&sector<6:sector===6;
    w.loot=w.loot.filter(l=>l.id!==p.loot); p.loot=null;
    if(winning) { p.coins+=item.value*(color==='gold'?6:2); react(p,'joy',.8); say(w,'Трофей сыграл! Награда +'+item.value*(color==='gold'?6:2)+' монет.'); }
    else { react(p,'roulette_loss',1.1); say(w,sector===7?'ЧЕРЕП · трофей потерян.':'Трофей проигран. Все это видели.'); }
    return winning;
  }
  function interact(w) {
    const p=w.players[w.active]; if(w.phase!=='turn'||p.hp<=0) return false;
    if(Math.abs(p.x-1040)<85&&p.y>600) return 'roulette';
    if(Math.abs(p.x-480)<85&&p.y>600) return 'shop';
    const home=w.shelters.find(h=>p.x>h.x&&p.x<h.x+h.w&&p.y>600);
    if(home) { if(home.owner!==null&&home.owner!==p.id) { say(w,'Убежище уже занято игроком '+(home.owner+1)+'.'); return false; } if(p.home!==null) w.shelters[p.home].owner=null; home.owner=p.id; p.home=home.id; say(w,'Убежище занято: ваш цвет, флаг и +8 HP в начале хода.'); return 'home'; }
    if(p.loot) { drop(w,p); say(w,'Добыча сброшена.'); return 'drop'; }
    const nearby=w.loot.find(l=>l.carrier===null&&Math.hypot(l.x-p.x,l.y-p.y)<75);
    if(nearby) { nearby.carrier=p.id; p.loot=nearby.id; say(w,'Добыча: '+nearby.weight+' кг. Цена движения выросла.'); return 'pickup'; }
    say(w,'Подойдите ближе к объекту.'); return false;
  }
  function buy(w) { const p=w.players[w.active]; if(w.phase!=='turn'||Math.abs(p.x-480)>85||p.y<600||p.coins<20) return false; p.coins-=20; p.hp=Math.min(100,p.hp+25); say(w,'Лавка: ремонтная аптечка, +25 HP.'); return true; }
  function updateBody(body,w,dt,foot,radius) {
    const old=body.y+foot; body.vy+=tuning.gravity*dt; body.x+=body.vx*dt; body.y+=body.vy*dt;
    if('grounded' in body) body.grounded=false;
    if(body.vy>=0) for(const t of w.platforms) if(t.alive&&body.x+radius>t.x&&body.x-radius<t.x+t.w&&old<=t.y+1&&body.y+foot>=t.y) { body.y=t.y-foot; body.vy=0; if('grounded'in body) body.grounded=true; body.vx*=.85; break; }
    body.x=clamp(body.x,radius,1600-radius); body.vx*=Math.exp(-dt*3);
  }
  function segmentHit(x0,y0,x1,y1,left,top,right,bottom) {
    let lo=0,hi=1; const dx=x1-x0,dy=y1-y0;
    for(const [origin,delta,min,max] of [[x0,dx,left,right],[y0,dy,top,bottom]]) {
      if(Math.abs(delta)<1e-8) { if(origin<min||origin>max) return null; }
      else { let a=(min-origin)/delta,b=(max-origin)/delta; if(a>b) [a,b]=[b,a]; lo=Math.max(lo,a); hi=Math.min(hi,b); if(lo>hi) return null; }
    }
    return lo;
  }
  function update(w,dt,input={}) {
    dt=clamp(dt,0,.05); w.clock+=dt; w.messageTime=Math.max(0,w.messageTime-dt); w.shake=Math.max(0,w.shake-dt);
    const active=w.players[w.active];
    for(const p of w.players) {
      p.moving=false; p.reaction=Math.max(0,p.reaction-dt); p.aiming=Math.max(0,p.aiming-dt);
      if(p===active&&w.phase==='turn'&&p.hp>0&&input.move&&p.mobility>0) {
        const item=w.loot.find(l=>l.id===p.loot), weight=item?1+item.weight*.18:1;
        const perPixel=tuning.walkPerMetre/tuning.pixelsPerMetre*weight*(p.perk==='walk'?.7:1);
        const distance=Math.min(tuning.walkSpeed*dt,p.mobility/perPixel), before=p.x;
        p.x=clamp(p.x+Math.sign(input.move)*distance,24,1576);
        p.mobility=Math.max(0,p.mobility-Math.abs(p.x-before)*perPixel); p.moving=Math.abs(p.x-before)>.01;
        p.facing=Math.sign(input.move); p.walk+=Math.abs(p.x-before); p.aiming=0;
      }
      updateBody(p,w,dt,44,20);
      if(w.district==='factory'&&p.grounded&&p.y>530&&p.y<560&&p.x>580&&p.x<850) p.x+=30*dt;
      if(p.y>900) { p.hp=Math.max(1,p.hp-20); drop(w,p); p.x=100+p.id*160; p.y=200; p.vx=0;p.vy=0; react(p,'hurt',.24); }
      const state=p.reaction>0?p.reactionName:!p.grounded&&Math.abs(p.vx)>70?'blast':p.hp===0?'roulette_loss':p.moving?'walk':p.aiming>0?'aim':'idle';
      if(state!==p.state) p.stateTime=0; else p.stateTime+=dt; p.state=state;
    }
    for(const l of w.loot) {
      if(l.carrier!==null) { const p=w.players[l.carrier]; l.x=p.x; l.y=p.y-68; l.angle=0; }
      else { updateBody(l,w,dt,l.type==='fish'?14:18,16); l.angle+=l.vx*dt*.012; if(l.y>880) { l.x=800;l.y=300;l.vx=0;l.vy=0; } }
    }
    for(let i=w.shots.length-1;i>=0;i--) {
      const s=w.shots[i],oldX=s.x,oldY=s.y; s.vy+=120*dt; s.x+=s.vx*dt;s.y+=s.vy*dt;s.ttl-=dt;
      let hit=1.1;
      for(const t of w.platforms) if(t.alive) { const k=segmentHit(oldX,oldY,s.x,s.y,t.x,t.y,t.x+t.w,t.y+t.h); if(k!==null) hit=Math.min(hit,k); }
      for(const p of w.players) if(p.id!==s.source) { const k=segmentHit(oldX,oldY,s.x,s.y,p.x-23,p.y-39,p.x+23,p.y+44); if(k!==null) hit=Math.min(hit,k); }
      if(hit<=1||s.ttl<=0||s.x<0||s.x>1600||s.y>850) { const owner=w.players[s.source]; explode(w,hit<=1?oldX+(s.x-oldX)*hit:s.x,hit<=1?oldY+(s.y-oldY)*hit:s.y,owner?.perk==='empty'?115:95,s.source); w.shots.splice(i,1); }
    }
    for(let i=w.particles.length-1;i>=0;i--) { const e=w.particles[i]; e.life-=dt; e.vy+=500*dt;e.x+=e.vx*dt;e.y+=e.vy*dt;if(e.life<=0) w.particles.splice(i,1); }
    if(w.phase==='turn') { w.time=Math.max(0,w.time-dt); if(w.time<=0) nextTurn(w); }
    else { w.settle+=dt; if(w.settle>=tuning.settleSeconds||(w.settle>.4&&w.shots.length===0&&w.players.every(p=>p.grounded||p.hp<=0))) nextTurn(w); }
    if(w.stress) {
      w.stressTick+=dt;
      while(w.stressTick>=.12) {
        w.stressTick-=.12; const x=220+w.random()*1260;
        if(w.shots.length<tuning.projectiles) { w.shots.push({x,y:200+w.random()*200,vx:(w.random()-.5)*500,vy:80,ttl:.5+w.random()*.6,source:-1}); w.stats.shots++; }
        explode(w,x,500+w.random()*170,85,-1);
        // Regrow three breakable modules per stress tick so destruction stays active.
        w.platforms.filter(t=>t.destructible&&!t.alive).slice(0,3).forEach(t=>{t.alive=true;t.hp=45;});
      }
    }
  }
  function startStress(w) {
    w.stress=true; w.stressTick=0;
    while(w.loot.length<tuning.loot) placeLoot(w,['fish','crate','bag','gas'][w.loot.length%4],60+w.random()*1480,300+w.random()*330);
    for(let i=0;i<tuning.projectiles;i++) w.shots.push({x:60+w.random()*1480,y:130+w.random()*400,vx:(w.random()-.5)*400,vy:60,ttl:.8+w.random()*.9,source:-1});
    for(let i=0;i<tuning.particles;i++) addParticle(w,60+w.random()*1480,300+w.random()*400,(w.random()-.5)*200,-150,'debris',.5+w.random()*.2);
    say(w,'Нагрузочная сцена: 4 игрока · 48 трофеев · выстрелы · разрушения');
  }
  return { tuning,rng,createWorld,update,jump,dash,shoot,bet,betLoot,interact,buy,nextTurn,explode,changeMaximum,spend,availableShot,placeLoot,startStress,segmentHit };
});
