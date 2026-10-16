import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const browser = await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_BROWSER_PATH?{executablePath:process.env.PLAYWRIGHT_BROWSER_PATH}:{}),args:['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const base=process.env.PORTFOLIO_URL||'http://localhost:8000';
const data=JSON.parse(readFileSync('data/portfolio.json'));
const errors=[];mkdirSync('test-results',{recursive:true});
async function setup(options={}){const context=await browser.newContext(options),page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.route('https://fonts.googleapis.com/**',r=>r.abort());await page.route('https://fonts.gstatic.com/**',r=>r.abort());return {context,page};}
async function fit(page,label){assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),label+': no horizontal overflow');}
async function settle(page){await page.waitForFunction(()=>document.body.classList.contains('flat-machine')?document.body.classList.contains('is-focused'):document.body.dataset.camera==='focused'&&document.body.dataset.renderedViewport===`${innerWidth}x${innerHeight}`);}
async function bounds(page,label){const r=await page.evaluate(()=>{const rect=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,w:r.width,h:r.height}};const content=document.querySelector('#screen-content');return {w:innerWidth,h:innerHeight,screen:rect(document.querySelector('#machine-screen')),board:rect(document.querySelector('#machine-controls')),buttons:[...document.querySelectorAll('#machine-controls button,#machine-controls a')].map(rect),overflow:content.scrollWidth-content.clientWidth,read:content.clientHeight};});for(const el of [r.screen,r.board,...r.buttons])assert(el.x>=-1&&el.right<=r.w+1&&el.y>=-1&&el.bottom<=r.h+1,label+': fit');assert(r.board.y>=r.screen.bottom-1,label+': board below screen');for(const b of r.buttons)assert(b.w>=43&&b.h>=43,label+': accessible board targets');assert(r.read>=80&&r.overflow<=1,label+': readable content');}
try {
 const {context,page}=await setup({viewport:{width:1440,height:900},reducedMotion:'reduce',permissions:['clipboard-read','clipboard-write']});
 await page.goto(base);assert(await page.locator('.hero-intro h1').isVisible());assert.equal(await page.locator('#machine-canvas').count(),0);assert.equal(await page.locator('#project-screen h3').textContent(),'The Amazing SaniBoy');
 for(let i=0;i<data.projects.length;i++){
  const p=data.projects[i];await page.locator(`[data-project="${i}"]`).click();assert(page.url().includes('/projects/'+p.slug+'/'));
  const copy=await page.locator('#project-screen').innerText();for(const value of [p.statusLabel,p.role,p.challenge,p.outcome,...p.approach])assert(copy.includes(value),p.slug+': complete case');
 }
 await page.locator('[data-share]').click();assert((await page.evaluate(()=>navigator.clipboard.readText())).includes(data.projects[6].slug));
 await page.reload();assert.equal(await page.locator('#project-screen h3').textContent(),data.projects[6].title);await page.locator('[data-project="0"]').click();await page.goBack();assert.equal(await page.locator('#project-screen h3').textContent(),data.projects[6].title);
 await page.locator('[data-project="0"]').focus();await page.keyboard.press('End');assert.equal(await page.locator('[data-project="6"]').getAttribute('aria-current'),'true');
 await page.goto(base);await page.screenshot({path:'test-results/final-normal-desktop.png'});const pdf=await page.request.get(base+'/'+data.profile.resume);assert.equal(pdf.status(),200);assert(pdf.headers()['content-type'].includes('application/pdf'));
 await context.close();console.log('PASS normal cases, static URLs/reload/history, copy, keyboard and resume');
 for(const [width,height] of [[320,740],[390,844],[768,1024],[1024,768],[2560,1440],[568,320]]){
  const {context,page}=await setup({viewport:{width,height},reducedMotion:'reduce',hasTouch:width<700,isMobile:width<700});await page.goto(base);await fit(page,width+' normal');
  if(width<=820){await page.locator('.menu-toggle').focus();await page.keyboard.press('Enter');assert.equal(await page.locator('.menu-toggle').getAttribute('aria-expanded'),'true');assert.equal(await page.evaluate(()=>document.activeElement.hash),'#work');await page.keyboard.press('Escape');assert.equal(await page.locator('.menu-toggle').getAttribute('aria-expanded'),'false');await page.locator('.menu-toggle').click();await page.locator('.section-links a[href="#work"]').click();}
  if(await page.locator('#project-select').isVisible())await page.locator('#project-select').selectOption('0');else await page.locator('[data-project="0"]').click();assert.equal(await page.locator('#project-screen h3').textContent(),'Maleficus');await fit(page,width+' case');
  if(width===390){await page.goto(base);await page.screenshot({path:'test-results/final-normal-mobile.png'});await page.locator('#contact').scrollIntoViewIfNeeded();await page.screenshot({path:'test-results/final-contact-mobile.png'});}
  await page.goto(base+'/arcade.html#work/the-amazing-saniboy');await settle(page);await bounds(page,width+' arcade');
  const selector=page.locator('[data-project-select]');if(await selector.isVisible())await selector.selectOption('0');else await page.locator('#screen-content [data-project="0"]').click();assert((await page.locator('.project-status').innerText()).includes('Unreleased'));
  for(const section of ['about','experience','stack','contact']){await page.locator(`[data-board-section="${section}"]`).click();await bounds(page,width+' '+section);}
  if(width===390)await page.screenshot({path:'test-results/final-arcade-mobile.png'});
  await context.close();console.log('PASS '+width+'x'+height+': normal, menu, project picker, arcade sections/board');
 }
 const noJS=await setup({javaScriptEnabled:false,viewport:{width:390,height:844}});await noJS.page.goto(base+'/projects/maleficus/');assert.equal(await noJS.page.locator('#project-screen h3').textContent(),'Maleficus');assert.equal(await noJS.page.locator('.noscript-projects article').count(),6);assert(await noJS.page.locator('#experience').isVisible());await fit(noJS.page,'noJS');await noJS.context.close();
 for(const mode of ['no-webgl','save-data','module-failure']){
  const {context,page}=await setup({viewport:{width:390,height:844}});
  if(mode==='no-webgl')await page.addInitScript(()=>{const orig=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return type.startsWith('webgl')?null:orig.call(this,type,...args);};});
  if(mode==='save-data')await page.addInitScript(()=>Object.defineProperty(navigator.connection,'saveData',{value:true}));
  if(mode==='module-failure')await page.route('**/machine-scene.js*',r=>r.abort());
  await page.goto(base+'/arcade.html#contact');await page.waitForSelector('.flat-machine');await bounds(page,mode);assert(await page.locator('#screen-content a[href^="mailto:"]').first().isVisible());await context.close();console.log('PASS '+mode);
 }
 assert.equal(data.projects.filter(p=>p.status==='released').length,2);assert.deepEqual(errors,[]);console.log('PASS accurate release data, no-JavaScript content and no uncaught runtime errors');
}finally{await browser.close();}
