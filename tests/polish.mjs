import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdirSync} from 'node:fs';
mkdirSync('test-results',{recursive:true});
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_BROWSER_PATH?{executablePath:process.env.PLAYWRIGHT_BROWSER_PATH}:{}),args:['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const errors=[];
const base=process.env.PORTFOLIO_URL||'http://localhost:8000';
const arcade=base+'/arcade.html';
async function pageFor(options){const c=await browser.newContext(options);const p=await c.newPage();p.on('pageerror',e=>errors.push(e.message));await p.route('https://fonts.googleapis.com/**',r=>r.abort());await p.route('https://fonts.gstatic.com/**',r=>r.abort());return {c,p};}
try {
 const {c,p}=await pageFor({viewport:{width:1440,height:900},reducedMotion:'reduce'});
 await p.goto(arcade);await p.waitForSelector('body[data-camera="overview"]');
 await p.screenshot({path:'test-results/polished-arcade.png'});
 const screen=await p.locator('#machine-screen').boundingBox();
 await p.mouse.move(screen.x+screen.width/2,screen.y+screen.height/4);await p.mouse.down();await p.mouse.move(screen.x+screen.width/2+60,screen.y+screen.height/4,{steps:5});await p.mouse.up();
 assert.equal(await p.locator('body.is-focused').count(),0,'dragging the screen never opens a section');
 await p.locator('#reset-view').click();await p.waitForFunction(()=>Math.abs(Number(document.body.dataset.rotation)+17)<=2);
 await p.mouse.move(70,300);await p.mouse.down();await p.mouse.move(510,310,{steps:12});await p.mouse.up();
 await p.waitForSelector('body.cabinet-back-facing');assert.equal(await p.locator('#machine-screen').evaluate(e=>e.inert),true);
 assert.equal(await p.locator('body.is-focused').count(),0);await p.screenshot({path:'test-results/polished-arcade-back.png'});
 await p.locator('#reset-view').click();await p.waitForFunction(()=>Math.abs(Number(document.body.dataset.rotation)+17)<=2);
 await p.locator('[data-rotate="1"]').focus();await p.keyboard.press('Enter');await p.waitForFunction(()=>Number(document.body.dataset.rotation)>20);
 await p.screenshot({path:'test-results/polished-arcade-side.png'});
 await p.locator('#start-button').click();await p.waitForSelector('body[data-camera="focused"]');
 assert.equal(Number(await p.locator('body').getAttribute('data-rotation')),0);
 await p.screenshot({path:'test-results/polished-arcade-work.png'});
 await p.goto(base);await p.screenshot({path:'test-results/polished-classic-desktop.png'});
 await p.locator('.hero-actions a:first-child').click();await p.locator('.cab-btn').nth(2).click();
 assert((await p.locator('.cab-notes').innerText()).includes('100,000'));
 await p.locator('.classic-video-toggle').click();await p.waitForFunction(()=>!document.querySelector('.arcade-screen video').paused);
 await p.locator('.classic-video-toggle').click();assert(await p.locator('.arcade-screen video').evaluate(v=>v.paused));
 await p.locator('#work').screenshot({path:'test-results/polished-classic-work.png'});
 await c.close();
 for(const w of [320,390,768,1024]){
  const {c,p}=await pageFor({viewport:{width:w,height:844},isMobile:w<768,hasTouch:w<768,reducedMotion:'reduce'});
  await p.goto(base);
  assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  if(w<=768){await p.locator('.menu-toggle').focus();await p.keyboard.press('Enter');assert.equal(await p.locator('.menu-toggle').getAttribute('aria-expanded'),'true');assert.equal(await p.evaluate(()=>document.activeElement.hash),'#work');await p.keyboard.press('Escape');assert.equal(await p.locator('.menu-toggle').getAttribute('aria-expanded'),'false');await p.locator('.menu-toggle').click();await p.locator('.section-links a[href="#work"]').click();assert.equal(await p.locator('.menu-toggle').getAttribute('aria-expanded'),'false');}
  await p.locator('.cab-btn').nth(6).click();await p.locator('.cab-btn').nth(6).focus();await p.keyboard.press('Home');
  assert.equal(await p.locator('.cab-btn').first().getAttribute('aria-pressed'),'true');
  assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  if(w===390){await p.locator('.classic-brand').click();await p.screenshot({path:'test-results/polished-classic-mobile.png'});await p.locator('.hero-actions a:first-child').click();await p.screenshot({path:'test-results/polished-classic-mobile-work.png'});}
  await c.close();console.log('PASS normal '+w);
 }
 const {c:tc,p:tp}=await pageFor({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce'});
 await tp.goto(arcade);await tp.waitForSelector('body[data-camera="overview"]');
 const session=await tc.newCDPSession(tp);
 await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:35,y:300}]});
 for(let x=55;x<245;x+=20)await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:300}]});
 await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 await tp.waitForSelector('body:not(.is-dragging)');
 await tp.waitForSelector('body.cabinet-back-facing');assert.equal(await tp.locator('body.is-focused').count(),0);
 await tp.locator('#reset-view').tap();await tp.waitForFunction(()=>Math.abs(Number(document.body.dataset.rotation)+17)<=2);
 await tp.screenshot({path:'test-results/polished-arcade-mobile.png'});
 await tp.locator('#start-button').tap();await tp.waitForSelector('body[data-camera="focused"]');await tp.screenshot({path:'test-results/polished-arcade-mobile-work.png'});
 await tc.close();
 const {c:nc,p:np}=await pageFor({viewport:{width:390,height:844},javaScriptEnabled:false});await np.goto(base+'/classic.html');
 for(const link of await np.locator('.section-links a').all())assert(await link.isVisible());assert.equal(await np.locator('.noscript-projects article').count(),6);await nc.close();
 assert.deepEqual(errors,[]);console.log('PASS rotation, touch, keyboard, media and normal layouts');
} finally {await browser.close();}
