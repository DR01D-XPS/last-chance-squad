const fs=require('node:fs/promises');
const path=require('node:path');
const A=require('../src/art.js');
const {start}=require('./serve.cjs');
const {launch}=require('./browser.cjs');
const root=path.resolve(__dirname,'..');
const asset=path.join(root,'assets');
async function save(name,body) { const target=path.join(asset,name);await fs.mkdir(path.dirname(target),{recursive:true});await fs.writeFile(target,body); }
async function main() {
  const server=await start(0);let browser;
  try {
    browser=await launch();const page=await browser.newPage({viewport:{width:1600,height:1400},deviceScaleFactor:1});
    await page.goto('http://127.0.0.1:'+server.address().port);
    async function raster(svg) {
      return Buffer.from(await page.evaluate(async svg=>{
        const img=new Image();img.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg);await img.decode();
        const c=document.createElement('canvas');c.width=img.naturalWidth;c.height=img.naturalHeight;c.getContext('2d').drawImage(img,0,0);return c.toDataURL('image/png').split(',')[1];
      },svg),'base64');
    }
    const board=new A.SVGPainter(1600,1050);A.board(board);await save('source/art-direction.svg',board.svg());await save('previews/art-direction.png',await raster(board.svg()));
    const map=new A.SVGPainter(900,300);A.worldMap(map);await save('source/world-map.svg',map.svg());await save('previews/world-map.png',await raster(map.svg()));
    const frameSize=128,frames=8;
    const sheets=[];
    for(const character of A.players) {
      const p=new A.SVGPainter(frameSize*frames,frameSize*A.states.length);
      for(let row=0;row<A.states.length;row++) for(let col=0;col<frames;col++) {
        const state=A.states[row],t=col/(A.clips[state].loop?frames:frames-1);
        p.group(col*frameSize,row*frameSize);A.hero(p,character,state,t,{x:64,y:70});p.end();
        if(col===0) { const single=new A.SVGPainter(frameSize,frameSize);A.hero(single,character,state,state==='hurt'?.5:state==='roulette_loss'?1:t,{x:64,y:70});await save(`source/characters/player-${character.id+1}-${state}.svg`,single.svg()); }
      }
      const name=`player-${character.id+1}`;await save(`source/characters/${name}-sheet.svg`,p.svg());await save(`sprites/characters/${name}.png`,await raster(p.svg()));sheets.push({id:character.id,name:character.name,color:character.color,hat:character.hat,backpack:character.pack,path:`sprites/characters/${name}.png`});
    }
    const props=['fish','crate','bag','gas','medkit','spring','grenade','coin'];const atlas=new A.SVGPainter(512,256);
    props.forEach((type,i)=>{atlas.group(i%4*128,Math.floor(i/4)*128);A.loot(atlas,type,64,64,0,1.65);atlas.end();});
    await save('source/props.svg',atlas.svg());await save('sprites/props.png',await raster(atlas.svg()));
    const weapons=new A.SVGPainter(384,128);['launcher','harpoon','shotgun'].forEach((type,i)=>A.weapon(weapons,i*128+48,64,0,type,1.45));await save('source/weapons.svg',weapons.svg());await save('sprites/weapons.png',await raster(weapons.svg()));
    const modules=[];
    function moduleSprite(name,w,h,draw,pivot=[.5,0]) { const p=new A.SVGPainter(w,h);draw(p);modules.push({name,w,h,svg:p.svg(),pivot}); }
    for(const d of A.districts) {
      moduleSprite('building-'+d.id,320,430,p=>A.building(p,20,40,280,370,d,null,'УБЕЖИЩЕ'),[.5,20/430]);
      const bg=new A.SVGPainter(1600,800);A.scenery(bg,d);await save(`source/backgrounds/${d.id}.svg`,bg.svg());await save(`sprites/backgrounds/${d.id}.png`,await raster(bg.svg()));
      await page.evaluate(id=>{LastChancePreview.setDistrict(id);LastChancePreview.render();},d.id);
      const arena=Buffer.from(await page.evaluate(()=>document.getElementById('arena').toDataURL('image/png').split(',')[1]),'base64');await save(`previews/arena-${d.id}.png`,arena);
    }
    moduleSprite('platform-solid',128,48,p=>A.platform(p,4,12,120),[.5,.75]);
    moduleSprite('platform-breakable',128,48,p=>A.platform(p,4,12,120,true),[.5,.75]);
    moduleSprite('shop',128,160,p=>A.booth(p,'shop',64,145),[.5,15/160]);
    moduleSprite('roulette',128,160,p=>A.booth(p,'roulette',64,145),[.5,15/160]);
    for(const v of A.players) moduleSprite('flag-player-'+(v.id+1),96,96,p=>{p.line(22,89,22,10,A.palette.ink,4);p.poly([[24,11],[78,22],[69,52],[24,46]],v.color,A.palette.ink,3);p.text(v.mark,47,36,15,A.palette.ink,900,'center');},[22/96,7/96]);
    for(const m of modules) { await save(`source/modules/${m.name}.svg`,m.svg);await save(`sprites/modules/${m.name}.png`,await raster(m.svg)); }
    const manifest={version:1,pixelsPerMetre:48,frame:{width:128,height:128,columns:8,rows:7,order:'top-to-bottom rows, left-to-right columns',pivotPixelsFromTopLeft:[64,114],unityPivotNormalized:[.5,.109375]},characters:sheets,animations:A.states.map((name,row)=>({name,label:A.stateLabels[row],row,frames:8,...A.clips[name],fps:8/A.clips[name].duration})),layers:['backpack','legs','boots','capsule','eyes','mouth','hat','hands','weapon'],rig:{hip:[64,70],foot:[64,114],hat:[64,36],backpack:[40,75],handFront:[95,74],weapon:[77,75],eyeLeft:[59,55],eyeRight:[76,55],collider:'48 × 78 px; fixed, not scaled with visual squash'},props:props.map((name,i)=>({name,rectTopLeft:[i%4*128,Math.floor(i/4)*128,128,128],pivot:[.5,.5]})),weapons:['launcher','harpoon','shotgun'].map((name,i)=>({name,rectTopLeft:[i*128,0,128,128],grip:[48,64]})),modules:modules.map(({name,w,h,pivot})=>({name,path:`sprites/modules/${name}.png`,width:w,height:h,pivot})),palette:A.palette,districts:A.districts};
    await save('manifest.json',JSON.stringify(manifest,null,2)+'\n');
    await save('palette.csv','token,hex\n'+Object.entries(A.palette).map(([name,color])=>`${name},${color}`).join('\n')+'\n');
    console.log('Экспортировано: 4 спрайт-листа × 7 состояний × 8 кадров, 8 предметов, 3 оружия, '+modules.length+' модулей, 3 арены и лист стиля.');
  } finally { if(browser)await browser.close();await new Promise(resolve=>server.close(resolve)); }
}
main().catch(error=>{console.error(error);process.exitCode=1;});
