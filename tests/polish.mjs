import assert from 'node:assert/strict';import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_BROWSER_PATH?{executablePath:process.env.PLAYWRIGHT_BROWSER_PATH}:{}),args:['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const base=(process.env.PORTFOLIO_URL||'http://localhost:8000')+'/arcade.html';const errors=[];
try{
 for(const touch of [false,true]){
  const context=await browser.newContext({viewport:touch?{width:390,height:844}:{width:1440,height:900},isMobile:touch,hasTouch:touch,reducedMotion:'reduce'});const p=await context.newPage();p.on('pageerror',e=>errors.push(e.message));await p.route('https://fonts.googleapis.com/**',r=>r.abort());await p.goto(base+'?inspect=1');await p.waitForSelector('body[data-camera="overview"]');
  if(touch){const cdp=await context.newCDPSession(p);await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:35,y:300}]});for(let x=55;x<245;x+=20)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:300}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await p.waitForSelector('body:not(.is-dragging)');}
  else{const r=await p.locator('#machine-screen').boundingBox();await p.mouse.move(r.x+r.width/2,r.y+r.height/4);await p.mouse.down();await p.mouse.move(r.x+r.width/2+440,r.y+r.height/4,{steps:12});await p.mouse.up();}
  await p.waitForSelector('body.cabinet-back-facing');assert.equal(await p.locator('body.is-focused').count(),0);assert(await p.locator('#machine-screen').evaluate(e=>e.inert));await p.locator('#reset-view').click();await p.waitForFunction(()=>Math.abs(Number(document.body.dataset.rotation)+17)<=2);
  await p.locator('[data-rotate="1"]').focus();await p.keyboard.press('Enter');await p.waitForFunction(()=>Number(document.body.dataset.rotation)>20);await p.locator('#start-button').click();await p.waitForSelector('body[data-camera="focused"]');assert.equal(Number(await p.locator('body').getAttribute('data-rotation')),0);
  const picker=p.locator('[data-project-select]');if(await picker.isVisible())await picker.selectOption('2');else await p.locator('#screen-content [data-project="2"]').click();assert(p.url().includes('?inspect=1#work/the-amazing-saniboy'));await p.reload();await p.waitForSelector('body[data-camera="focused"]');assert.equal(await p.locator('.project-topline h2').textContent(),'The Amazing SaniBoy');
  if(touch){await p.setViewportSize({width:844,height:390});await p.waitForFunction(()=>document.body.dataset.renderedViewport==='844x390');assert(await p.locator('[data-project-select]').isVisible()||await p.locator('.project-list').isVisible());}
  await p.evaluate(()=>document.querySelector('#machine-canvas').getContext('webgl2').getExtension('WEBGL_lose_context').loseContext());await p.waitForSelector('body.flat-machine');assert(await p.locator('#machine-controls').isVisible());await context.close();console.log('PASS '+(touch?'touch':'mouse')+' rotation/reset, front reading, project reload and context loss');
 }
 assert.deepEqual(errors,[]);
}finally{await browser.close();}
