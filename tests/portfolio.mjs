import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const browser = await chromium.launch({ headless:true, ...(process.env.PLAYWRIGHT_BROWSER_PATH ? { executablePath:process.env.PLAYWRIGHT_BROWSER_PATH } : {}), args:['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
const base = process.env.PORTFOLIO_URL || 'http://localhost:8000';
const arcade = base + '/arcade.html';
const errors = [];
mkdirSync('test-results', { recursive:true });
async function setup(options={}) {
  const context = await browser.newContext(options), page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  await page.route('https://fonts.googleapis.com/**', route => route.abort());
  await page.route('https://fonts.gstatic.com/**', route => route.abort());
  return {context,page};
}
async function settle(page) {
  await page.waitForFunction(() => document.body.classList.contains('flat-machine') ? document.body.classList.contains('is-focused') : document.body.dataset.camera === 'focused' && document.body.dataset.renderedViewport === `${innerWidth}x${innerHeight}`);
}
async function bounds(page,label) {
  const result=await page.evaluate(()=>{
    const rect=el=>{const r=el.getBoundingClientRect();return {x:r.left,y:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height};};
    const content=document.querySelector('#screen-content');
    return {width:innerWidth,height:innerHeight,screen:rect(document.querySelector('#machine-screen')),board:rect(document.querySelector('#machine-controls')),buttons:[...document.querySelectorAll('#machine-controls button,#machine-controls a')].map(el=>({label:el.getAttribute('aria-label')||el.textContent.trim(),...rect(el)})),overflow:content.scrollWidth-content.clientWidth,contentHeight:content.clientHeight};
  });
  for(const [name,r] of [['screen',result.screen],['board',result.board]]){
    assert(r.x>=-1&&r.right<=result.width+1,`${label}: ${name} horizontal fit`);
    assert(r.y>=-1&&r.bottom<=result.height+1,`${label}: ${name} vertical fit`);
  }
  assert(result.board.y>=result.screen.bottom-1,`${label}: controls never overlap screen`);
  for(const r of result.buttons){
    assert(r.x>=-1&&r.right<=result.width+1&&r.y>=0&&r.bottom<=result.height+1,`${label}: ${r.label} stays accessible`);
    assert(r.width>=43&&r.height>=43,`${label}: ${r.label} target is ${r.width.toFixed(1)}x${r.height.toFixed(1)}`);
  }
  assert(result.overflow<=1,`${label}: content width`);
  assert(result.contentHeight>=80,`${label}: reading area`);
}
async function mediaReady(page) {
  await page.waitForFunction(()=>[...document.querySelectorAll('.project-media img,.project-media video')].every(el=>el.tagName==='IMG'?el.complete:el.readyState>=2));
}
try{
  const {context,page}=await setup({viewport:{width:1440,height:900}});
  await page.goto(base);
  assert(await page.locator('.hero-copy h1').isVisible(),'normal portfolio is the homepage');
  assert.equal(await page.locator('#machine-canvas').count(),0,'homepage needs no WebGL');
  await page.locator('.mode-link').click();await page.waitForURL('**/arcade.html');await page.waitForSelector('body[data-camera="overview"]');
  assert.equal(await page.locator('.hero-copy').count(),0);
  await page.screenshot({path:'test-results/retro-desktop.png'});
  await page.locator('#start-button').click();await settle(page);await bounds(page,'desktop');
  assert.equal(await page.locator('[data-board-section="work"]').getAttribute('aria-pressed'),'true');
  const projects=await page.evaluate(()=>JSON.parse(document.querySelector('#portfolio-data').textContent).projects);
  for(let i=0;i<projects.length;i++){
    await page.locator(`[data-project="${i}"]`).click();
    const copy=await page.locator('.project-detail').innerText();
    assert(copy.includes(projects[i].title));
    for(const bullet of projects[i].bullets)assert(copy.includes(bullet));
    assert.equal(await page.evaluate(()=>document.activeElement.dataset.project),String(i));
  }
  await page.locator('[data-project="6"]').press('Home');await mediaReady(page);
  await page.screenshot({path:'test-results/retro-desktop-work.png'});
  await page.locator('[data-board-section="about"]').click();
  assert.match(await page.locator('#screen-content').innerText(),/100k/);
  assert(await page.locator('#screen-content').getByRole('link',{name:/Résumé/}).isVisible());
  await page.screenshot({path:'test-results/retro-desktop-profile.png'});
  await page.locator('[data-board-section="experience"]').press('Enter');
  assert.equal(await page.locator('.role').count(),4);
  await page.locator('[data-board-section="stack"]').click();
  assert.equal(await page.locator('.tool').count(),2);assert.equal(await page.locator('.skill').count(),8);
  await page.locator('[data-board-section="contact"]').click();
  assert.match(await page.locator('#screen-content').innerText(),/Education[\s\S]*Languages[\s\S]*Arabic Native/i);
  assert.equal(await page.locator('#screen-content a[href^="mailto:"]').count(),2);
  assert.equal(await page.locator('#screen-content a[href^="tel:"]').count(),1);
  assert.match(await page.locator('#board-resume').getAttribute('href'),/drive.google.com/);
  await page.screenshot({path:'test-results/retro-desktop-contact.png'});
  await page.locator('.joystick').click();
  assert.equal(await page.locator('.project-topline h2').textContent(),projects[1].title);
  await page.locator('[data-board-step="-1"]').click();
  assert.equal(await page.locator('.project-topline h2').textContent(),projects[0].title);
  await page.locator('[data-board-step="-1"]').press('Escape');
  await page.waitForSelector('body[data-camera="overview"]');assert(await page.locator('#start-button').isVisible());
  await page.locator('[data-board-section="experience"]').click();await settle(page);
  assert.equal(await page.locator('.role').count(),4,'board works directly from overview');
  await page.evaluate(()=>document.querySelector('#machine-canvas').getContext('webgl2').getExtension('WEBGL_lose_context').loseContext());
  await page.waitForSelector('.flat-machine');await bounds(page,'lost context');
  await page.locator('[data-board-section="contact"]').click();
  assert(await page.locator('#screen-content a[href^="tel:"]').isVisible());
  await page.locator('.normal-link').click();await page.waitForURL('**/index.html');
  assert.equal(await page.locator('#machine-canvas').count(),0);assert(await page.locator('.hero-copy h1').isVisible());
  await page.screenshot({path:'test-results/classic-desktop.png'});await context.close();
  console.log('PASS full content, board navigation, project keyboard/focus, context loss, normal version');

  for(const [width,height] of [[320,740],[390,844],[640,800],[768,1024],[1024,768],[2560,1440],[844,390],[568,320]]){
    const {context,page}=await setup({viewport:{width,height},reducedMotion:'reduce',hasTouch:width<700,isMobile:width<700,deviceScaleFactor:width<700?3:1});
    await page.goto(arcade+'#work');await settle(page);await bounds(page,`${width}x${height}`);
    await page.locator('[data-project="2"]').click();await mediaReady(page);
    assert.equal(await page.locator('video').evaluate(v=>v.paused),true);
    for(const section of ['about','experience','stack','contact']){
      await page.locator(`[data-board-section="${section}"]`).click();await bounds(page,`${width}x${height} ${section}`);
    }
    if(width===390)await page.screenshot({path:'test-results/retro-mobile-contact.png'});
    if(width===568)await page.screenshot({path:'test-results/retro-landscape-contact.png'});
    await page.goto(base);
    assert(await page.locator('.mode-link').isVisible());
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    await page.locator('.cab-btn').nth(2).click();await page.locator('.cab-btn').nth(2).press('ArrowRight');
    assert.equal(await page.locator('.cab-btn[aria-pressed="true"]').getAttribute('data-project'),'3');
    if(width===390){await page.locator('a[href="#top"]').first().click();await page.screenshot({path:'test-results/classic-mobile.png'});}
    await context.close();console.log(`PASS ${width}x${height}: screen, control targets, content and normal layout`);
  }
  const touch=await setup({viewport:{width:390,height:844},hasTouch:true,isMobile:true,deviceScaleFactor:3});
  await touch.page.goto(arcade);await touch.page.waitForSelector('body[data-camera="overview"]');
  const touchProjects=await touch.page.evaluate(()=>JSON.parse(document.querySelector('#portfolio-data').textContent).projects);
  await touch.page.screenshot({path:'test-results/retro-mobile.png'});
  await touch.page.locator('#start-button').tap();await settle(touch.page);await bounds(touch.page,'touch');
  await touch.page.locator('.joystick').tap();assert.equal(await touch.page.locator('.project-topline h2').textContent(),touchProjects[1].title);
  await mediaReady(touch.page);await touch.page.screenshot({path:'test-results/retro-mobile-work.png'});
  await touch.page.locator('[data-board-section="about"]').tap();await touch.page.screenshot({path:'test-results/retro-mobile-profile.png'});
  await touch.page.setViewportSize({width:844,height:390});await settle(touch.page);await bounds(touch.page,'live orientation change');
  await touch.page.setViewportSize({width:390,height:844});await settle(touch.page);await bounds(touch.page,'return to portrait');
  await touch.context.close();console.log('PASS high-DPI touch, joystick and live rotation');

  for(const mode of ['no-webgl','save-data','module-failure']){
    const {context,page}=await setup({viewport:{width:390,height:844}});
    if(mode==='no-webgl')await page.addInitScript(()=>{const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return type.startsWith('webgl')?null:original.call(this,type,...args);};});
    if(mode==='save-data')await page.addInitScript(()=>Object.defineProperty(navigator.connection,'saveData',{value:true}));
    if(mode==='module-failure')await page.route('**/machine-scene.js*',route=>route.abort());
    await page.goto(arcade);await page.waitForSelector('.flat-machine');await page.locator('[data-board-section="contact"]').click();
    await bounds(page,mode);assert(await page.locator('#screen-content a[href^="tel:"]').isVisible());
    await context.close();console.log(`PASS ${mode}: working screen and control board`);
  }
  const noJS=await setup({javaScriptEnabled:false,viewport:{width:390,height:844}});
  await noJS.page.goto(base+'/classic.html');assert.equal(await noJS.page.locator('.noscript-projects article').count(),6);assert(await noJS.page.locator('#experience').isVisible());await noJS.context.close();
  assert.deepEqual(errors,[]);console.log('PASS no-JavaScript normal content; no uncaught runtime errors');
}finally{await browser.close();}
