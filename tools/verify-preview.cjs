const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const assert=require('node:assert/strict');
const {start}=require('./serve.cjs');
const {launch}=require('./browser.cjs');
const output=path.resolve(__dirname,'../artifacts/verification');
async function main(){
  await fs.mkdir(output,{recursive:true});const server=await start(0);let browser;
  const errors=[],checks=[];
  try {
    browser=await launch();const page=await browser.newPage({viewport:{width:1600,height:1400},deviceScaleFactor:1});
    page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)errors.push(r.status()+' '+r.url());});
    await page.goto('http://127.0.0.1:'+server.address().port);await page.waitForFunction(()=>window.LastChancePreview);
    assert.equal(await page.locator('.player-card').count(),4);assert.equal(await page.locator('.animation-card').count(),7);checks.push('4 игрока и все 7 состояний отображаются');
    await page.screenshot({path:path.join(output,'preview-desktop.png'),fullPage:true});
    for(const [id,label] of [['residential','Жилой район'],['factory','Завод'],['port','Порт']]) {
      await page.click('#map-button');await page.getByRole('button',{name:new RegExp('^'+label)}).click();
      assert.equal(await page.evaluate(()=>LastChancePreview.world.district),id);
    }
    checks.push('Карта переключает все три района');
    await page.evaluate(()=>{const w=LastChancePreview.world;w.players[0].mobility=0;});
    const startX=await page.evaluate(()=>LastChancePreview.world.players[0].x);
    await page.keyboard.down('KeyD');await page.waitForTimeout(150);await page.keyboard.up('KeyD');
    assert.equal(await page.evaluate(()=>LastChancePreview.world.players[0].x),startX);
    const rect=await page.locator('#arena').boundingBox();await page.mouse.move(rect.x+rect.width*.48,rect.y+rect.height*.36);await page.mouse.click(rect.x+rect.width*.48,rect.y+rect.height*.36);
    assert.ok(await page.evaluate(()=>LastChancePreview.world.stats.shots>0));checks.push('Клавиатура блокирует движение при нуле; мышь запускает выстрел');
    await page.evaluate(()=>{LastChancePreview.setDistrict('port');const w=LastChancePreview.world;w.players[0].x=1040;w.players[0].mobility=62;w.time=3;});
    await page.keyboard.press('KeyE');assert.equal(await page.locator('#roulette-dialog').evaluate(d=>d.open),true);
    const before=await page.evaluate(()=>LastChancePreview.world.time);await page.waitForTimeout(250);assert.ok(await page.evaluate(()=>LastChancePreview.world.time)<before);
    await page.click('[data-stake="20"]');assert.equal(await page.locator('#roulette-dialog').evaluate(d=>d.open),false);
    assert.equal(await page.evaluate(()=>{const p=LastChancePreview.world.players[0];return p.maxMobility-p.mobility;}),38);checks.push('Рулетка доступна на арене, таймер идёт в меню, ставка сохраняет потраченное движение');
    await page.evaluate(()=>{LastChancePreview.setDistrict('port');});await page.keyboard.press('KeyE');
    assert.equal(await page.evaluate(()=>LastChancePreview.world.shelters[0].owner),0);await page.screenshot({path:path.join(output,'occupied-shelter.png'),fullPage:true});checks.push('Занятие убежища: цвет, флаг и знак владельца');
    await page.click('#board-button');await page.locator('#board-dialog').screenshot({path:path.join(output,'style-board-dialog.png')});await page.keyboard.press('Escape');
    await page.click('#effects-button');assert.equal(await page.evaluate(()=>LastChancePreview.world.reducedEffects),true);
    await page.click('#shake-button');assert.equal(await page.evaluate(()=>LastChancePreview.world.shakeEnabled),true);checks.push('Переключатели эффектов и тряски действуют');
    await page.click('#effects-button');await page.click('#shake-button');
    let report;
    if(!process.argv.includes('--ui-only')) {
      // Benchmark full effects, with camera shake off, to make the load reproducible.
      await page.evaluate(()=>{LastChancePreview.world.reducedEffects=false;LastChancePreview.world.shakeEnabled=false;});
      console.log('Проверки интерфейса пройдены. Измерение сцены 30 секунд…');
      report=await page.evaluate(()=>LastChancePreview.runBenchmark(30));
      report.host={platform:os.platform(),release:os.release(),cpu:os.cpus()[0]?.model,cpuLogicalCount:os.cpus().length,memoryGiB:Math.round(os.totalmem()/2**30),browser:await browser.version(),headless:true};
      assert.equal(report.maxConcurrent.players,4);assert.equal(report.maxConcurrent.loot,48);assert.equal(report.maxConcurrent.projectiles,24);assert.equal(report.maxConcurrent.particles,160);
      assert.ok(report.events.explosions>100);assert.ok(report.events.destructions>40);assert.ok(report.events.shots>80);
      await page.screenshot({path:path.join(output,'stress-scene.png'),fullPage:true});
      checks.push('30 секунд непрерывной нагрузки: 4 игрока / 48 трофеев / 24 снаряда / 160 частиц');
      report.budget={p95WorkTargetMs:16.67,passed:report.workMs.p95<16.67};await fs.writeFile(path.join(output,'performance.json'),JSON.stringify(report,null,2)+'\n');
      if(!report.budget.passed)process.exitCode=1;
    } else {
      await page.click('#stress-button');await page.waitForTimeout(500);await page.screenshot({path:path.join(output,'stress-scene.png'),fullPage:true});
    }
    await page.goto(pathToFileURL(path.resolve(__dirname,'../preview/index.html')).href);await page.waitForFunction(()=>window.LastChancePreview);
    assert.equal(await page.evaluate(()=>LastChancePreview.world.players.length),4);await page.click('#map-button');assert.equal(await page.locator('#map-dialog').evaluate(d=>d.open),true);await page.keyboard.press('Escape');checks.push('Открытие готового HTML с диска без сервера');
    assert.equal(errors.length,0,'Ошибки браузера: '+errors.join('\n'));
    await fs.writeFile(path.join(output,'ui-checks.json'),JSON.stringify({passed:true,checks,errors},null,2)+'\n');
    console.log(JSON.stringify({checks:checks.length,errors,frames:report?.frames,p95WorkMs:report?.workMs.p95,p95FrameIntervalMs:report?.frameIntervalMs.p95,budgetPassed:report?.budget.passed,events:report?.events},null,2));
  }finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
