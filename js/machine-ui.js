const data = JSON.parse(document.getElementById('portfolio-data').textContent);
const screen = document.getElementById('machine-screen');
const controls = document.getElementById('machine-controls');
const content = document.getElementById('screen-content');
const app = document.getElementById('screen-app');
const start = document.getElementById('screen-start');
const sections = ['about', 'work', 'experience', 'stack', 'contact'];
const names = ['Profile', 'Work', 'Experience', 'Toolkit', 'Contact'];
const motion = matchMedia('(prefers-reduced-motion: reduce)');
const simpleRequested = new URLSearchParams(location.search).has('no3d');
const profileData = data.profile;
let scene = null, current = 'about', project = 0, entered = false;
let handledURL = '';
const esc = value => String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const list = items => (items || []).map(item => `<li>${esc(item)}</li>`).join('');
const external = (url, label, className = 'text-link') => url ? `<a class="${className}" href="${esc(url)}" target="_blank" rel="noopener">${esc(label)} <span aria-hidden="true">↗</span></a>` : '';
document.getElementById('board-resume').href = profileData.resume;
document.querySelector('[data-section="work"] span').textContent = String(data.projects.length).padStart(2, '0');

function profile() {
  const released = data.projects.find(p => p.slug === 'the-amazing-saniboy');
  const metrics = (data.metrics || []).map(item => `<div class="metric"><strong>${esc(item.value)}</strong><span>${esc(item.label)}</span></div>`).join('');
  const education = (data.education || []).map(item => `<article class="education-item"><h3>${esc(item.title)}</h3><p>${esc(item.institution)}${item.dates ? ` · ${esc(item.dates)}` : ''}</p></article>`).join('');
  const languages = (data.languages || []).map(item => `<li><strong>${esc(item.name)}</strong><span>${esc(item.level)}</span></li>`).join('');
  return `<p class="section-kicker">01 / Meet the developer</p><div class="profile-layout"><div><h2>${esc(profileData.title)}</h2><p class="profile-positioning">${esc(profileData.shippedTitles)} shipped titles · Mobile & WebGL</p><p class="profile-specialty">${esc(profileData.specialty)}</p><p>${esc(profileData.intro)}</p><button type="button" class="released-game-proof" data-featured-release><span>RELEASED ON GOOGLE PLAY</span><strong>${esc(released.title)} ↗</strong><span>100k+ downloads · 4.7-star rating</span></button><div class="screen-actions"><button type="button" class="screen-button primary" data-open="work">Explore my work <span aria-hidden="true">↗</span></button>${external(profileData.resume, 'Résumé', 'screen-button')}<a class="text-link" href="mailto:${esc(profileData.email)}">Let's talk <span aria-hidden="true">↗</span></a></div><p class="profile-footnote">${esc(profileData.location)} · ${esc(profileData.availability)}</p></div>${metrics ? `<div class="metric-grid">${metrics}</div>` : ''}</div><div class="profile-background">${education ? `<section><h3>Education</h3>${education}</section>` : ''}${languages ? `<section><h3>Languages</h3><ul class="language-list">${languages}</ul></section>` : ''}</div>`;
}

function work() {
  const p = data.projects[project];
  const buttons = data.projects.map((item, i) => `<button type="button" data-project="${i}" aria-pressed="${i === project}"><span>${String(i + 1).padStart(2, '0')}</span>${esc(item.title)}</button>`).join('');
  const options = data.projects.map((item, i) => `<option value="${i}"${i === project ? ' selected' : ''}>${String(i + 1).padStart(2, '0')} — ${esc(item.title)}</option>`).join('');
  const media = p.vid ? `<video src="${esc(p.media)}" poster="${esc(p.poster)}" muted loop playsinline preload="metadata" aria-label="${esc(p.title)} gameplay"></video><button type="button" class="video-toggle" data-video>Play preview</button>` : `<img src="${esc(p.media)}" alt="${esc(p.title)} gameplay" decoding="async">`;
  const status = p.statusLabel ? `<span class="project-status">${esc(p.statusLabel)}</span>` : '';
  return `<p class="section-kicker">02 / Selected work</p>
    <div class="work-browser"><nav class="project-list" aria-label="Select a project">${buttons}</nav>
      <label class="project-picker" for="project-picker"><span>Select a project · ${data.projects.length} projects</span><select id="project-picker" data-project-select>${options}</select></label>
      <article class="project-detail">
        <div class="project-topline"><h2>${esc(p.title)}</h2><div class="project-stepper"><button type="button" data-step="-1" aria-label="Previous project">←</button><button type="button" data-step="1" aria-label="Next project">→</button></div></div>
        <div class="project-meta">${status}<span>${esc(p.platform)} · ${esc(p.year)} · ${String(project + 1).padStart(2, '0')} / ${String(data.projects.length).padStart(2, '0')}</span></div>
        <p class="project-summary">${esc(p.summary)}</p>
        <div class="project-body"><div><div class="project-media">${media}</div><div class="tag-row">${(p.tech || []).map(t => `<span class="tag">${esc(t)}</span>`).join('')}</div></div>
          <div class="project-notes"><h3>My contribution</h3><p class="contribution-role">${esc(p.role)}${p.studio ? `<span>${esc(p.studio)}</span>` : ''}</p><ul>${list(p.approach)}</ul></div>
        </div>
        <div class="case-proof">${p.outcome ? `<section><h3>Outcome</h3><p>${esc(p.outcome)}</p></section>` : ''}</div><details class="screen-disclosure"><summary>The technical challenge</summary><p>${esc(p.challenge)}</p></details>
        <div class="project-actions">${external(p.link, p.evidenceLabel || p.linkLabel || 'Explore project')}<button type="button" class="screen-button" data-copy-project>Copy project link</button><span class="copy-feedback" data-copy-feedback role="status" aria-live="polite"></span></div>
        ${data.earlierWork ? `<details class="screen-disclosure"><summary>Earlier projects & legacy titles</summary><p>${esc(data.earlierWork)}</p></details>` : ''}
      </article>
    </div>`;
}

function experience() {
  return `<p class="section-kicker">03 / Experience</p><h2>Where I've built.</h2>` + (data.experience || []).map(role => `<article class="role"><div><h3>${esc(role.studio)}</h3><div class="role-label">${esc(role.role)}</div><div class="role-date">${esc(role.dates)}</div></div><div><p>${esc(role.highlight)}</p><details class="screen-disclosure"><summary>More about this role</summary><ul>${list(role.bullets)}</ul></details></div></article>`).join('');
}

function toolkit() {
  const tools = (data.tools || []).map(tool => `<article class="tool"><p class="section-kicker">${esc(tool.category)}</p><h3>${esc(tool.title)}</h3><p>${esc(tool.description)}</p></article>`).join('');
  const skills = (data.skills || []).map(skill => `<article class="skill"><h3>${esc(skill.title)}</h3><div class="tag-row">${(skill.items || []).map(item => `<span class="tag">${esc(item)}</span>`).join('')}</div></article>`).join('');
  return `<p class="section-kicker">04 / Toolkit</p><h2>Beyond the game.</h2><div class="tools-grid">${tools}</div><div class="core-toolkit">${data.resume.skills.map(skill => `<section><h3>${esc(skill.label)}</h3><p>${esc(skill.text)}</p></section>`).join('')}</div><details class="screen-disclosure"><summary>Full technical toolkit</summary><div class="skills-grid">${skills}</div></details>`;
}

function contact() {
  return `<p class="section-kicker">05 / Contact</p><div class="contact-content"><div><h2>Let's build something.</h2><p>${esc(profileData.opportunities)}</p><div class="screen-actions"><a class="screen-button primary" href="mailto:${esc(profileData.email)}">Email Saif <span aria-hidden="true">↗</span></a>${external(profileData.resume, 'View résumé', 'screen-button')}</div></div><div class="contact-details"><dl><dt>Email</dt><dd><a class="text-link" href="mailto:${esc(profileData.email)}">${esc(profileData.email)}</a></dd>${profileData.phone ? `<dt>Phone</dt><dd><a class="text-link" href="tel:${esc(profileData.phone.replace(/[^+\d]/g, ''))}">${esc(profileData.phone)}</a></dd>` : ''}<dt>Location</dt><dd>${esc(profileData.location)}</dd></dl><div class="contact-links">${external(profileData.github, 'GitHub')}${external(profileData.linkedin, 'LinkedIn')}</div></div></div>`;
}

function stopMedia() { content.querySelectorAll('video').forEach(video => { video.pause(); video.removeAttribute('src'); video.load(); }); }
function syncVideo() {
  const video = content.querySelector('video');
  if (!video) return;
  const button = content.querySelector('[data-video]');
  const update = () => { button.textContent = video.paused ? 'Play preview' : 'Pause preview'; };
  video.addEventListener('play', update); video.addEventListener('pause', update);
  if (entered && !document.hidden && !motion.matches && !navigator.connection?.saveData) video.play().catch(update);
}
function updateScrollHint() {
  const more = content.scrollHeight - content.scrollTop > content.clientHeight + 12;
  document.getElementById('screen-scroll-hint').textContent = more ? 'SCROLL FOR MORE ↓' : 'READY PLAYER ONE';
}
content.addEventListener('scroll', updateScrollHint, { passive: true });
content.addEventListener('toggle', () => requestAnimationFrame(updateScrollHint), true);
new ResizeObserver(updateScrollHint).observe(content);

function render(section = current, { focus = false } = {}) {
  current = sections.includes(section) ? section : 'about';
  stopMedia();
  content.innerHTML = current === 'about' ? profile() : current === 'work' ? work() : current === 'experience' ? experience() : current === 'stack' ? toolkit() : contact();
  content.scrollTop = 0;
  document.querySelectorAll('[data-section]').forEach(button => {
    if (button.dataset.section === current) button.setAttribute('aria-current', 'page'); else button.removeAttribute('aria-current');
  });
  controls.querySelectorAll('[data-board-section]').forEach(button => button.setAttribute('aria-pressed', String(entered && button.dataset.boardSection === current)));
  const index = sections.indexOf(current);
  document.getElementById('screen-location').textContent = `${String(index + 1).padStart(2, '0')} / ${names[index].toUpperCase()}`;
  document.getElementById('machine-announcer').textContent = current === 'work' ? `${data.projects[project].title}, project ${project + 1} of ${data.projects.length}` : names[index];
  syncVideo();
  requestAnimationFrame(updateScrollHint);
  if (focus) content.focus({ preventScroll: true });
  scene?.setSelection(project);
}

function updateRoute(mode = 'push') {
  if (mode === 'none') return;
  const url = new URL(location.href);
  url.hash = entered ? current === 'work' ? `work/${data.projects[project].slug}` : current : '';
  if (url.href !== location.href) history[mode === 'replace' ? 'replaceState' : 'pushState'](null, '', url);
  handledURL = location.href;
}

function enter(section = current, focus = true, { historyMode = 'push' } = {}) {
  entered = true;
  document.body.classList.add('is-focused');
  start.hidden = true; app.hidden = false;
  render(section, { focus });
  scene?.setFocused(true);
  updateRoute(historyMode);
}

function exit({ historyMode = 'push', focus = true } = {}) {
  content.querySelectorAll('video').forEach(v => v.pause());
  entered = false;
  controls.querySelectorAll('[data-board-section]').forEach(button => button.setAttribute('aria-pressed', 'false'));
  document.body.classList.remove('is-focused');
  app.hidden = true; start.hidden = false;
  scene?.setFocused(false);
  updateRoute(historyMode);
  if (focus) document.getElementById('start-button').focus({ preventScroll: true });
}

function restoreRoute() {
  if (handledURL === location.href) return;
  handledURL = location.href;
  let route;
  try { route = decodeURIComponent(location.hash.slice(1)).split('/'); } catch { route = []; }
  if (!sections.includes(route[0])) { if (entered) exit({ historyMode: 'none', focus: false }); return; }
  if (route[0] === 'work' && route[1]) {
    const index = data.projects.findIndex(item => item.slug === route[1]);
    if (index >= 0) project = index;
  }
  enter(route[0], false, { historyMode: 'none' });
}

function selectProject(index, focusSelector) {
  project = (index + data.projects.length) % data.projects.length;
  enter('work', false);
  if (focusSelector) content.querySelector(focusSelector)?.focus({ preventScroll: true });
}

async function copyProjectLink(button) {
  const url = new URL(location.href);
  url.hash = `work/${data.projects[project].slug}`;
  const feedback = content.querySelector('[data-copy-feedback]');
  let copied = false;
  try { await navigator.clipboard.writeText(url.href); copied = true; } catch {
    const field = document.createElement('textarea');
    field.value = url.href;
    field.setAttribute('aria-label', 'Project link to copy');
    field.style.cssText = 'position:fixed;left:-9999px;top:0';
    document.body.append(field); field.select();
    try { copied = document.execCommand('copy'); } catch { copied = false; }
    field.remove(); button.focus({ preventScroll: true });
  }
  if (!feedback.isConnected) return;
  if (copied) {
    feedback.textContent = 'Project link copied.';
  } else {
    feedback.innerHTML = `<label>Copy this project URL<input class="copy-link-field" aria-label="Project URL" readonly value="${esc(url.href)}"></label>`;
    const field = feedback.querySelector('input'); field.focus(); field.select();
  }
}

start.addEventListener('click', () => enter('work'));
document.getElementById('cabinet-back').addEventListener('click', () => exit());
screen.addEventListener('click', event => {
  const button = event.target.closest('button, a');
  if (!button) return;
  if (button.classList.contains('screen-brand')) { event.preventDefault(); enter('about'); }
  if (button.dataset.section) enter(button.dataset.section, false);
  if (button.hasAttribute('data-featured-release')) selectProject(data.projects.findIndex(p => p.slug === 'the-amazing-saniboy'));
  if (button.dataset.open) enter(button.dataset.open);
  if (button.dataset.project != null) selectProject(Number(button.dataset.project), `[data-project="${button.dataset.project}"]`);
  if (button.dataset.step) selectProject(project + Number(button.dataset.step), `[data-step="${button.dataset.step}"]`);
  if (button.hasAttribute('data-copy-project')) copyProjectLink(button);
  if (button.hasAttribute('data-video')) {
    const video = content.querySelector('video');
    if (video.paused) video.play().catch(() => { button.textContent = 'Preview unavailable'; }); else video.pause();
  }
});
content.addEventListener('change', event => {
  if (event.target.matches('[data-project-select]')) selectProject(Number(event.target.value), '[data-project-select]');
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && entered) { event.preventDefault(); exit(); }
  if (event.target.matches('[data-project]') && ['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
    event.preventDefault();
    const index = event.key === 'Home' ? 0 : event.key === 'End' ? data.projects.length - 1 : (project + (event.key === 'ArrowRight' ? 1 : -1) + data.projects.length) % data.projects.length;
    selectProject(index, `[data-project="${index}"]`);
  }
});
controls.addEventListener('click', event => {
  const button = event.target.closest('button');
  if (!button) return;
  if (button.dataset.boardSection) enter(button.dataset.boardSection, false);
  if (button.dataset.boardStep) selectProject(project + Number(button.dataset.boardStep));
});
addEventListener('popstate', restoreRoute);
addEventListener('hashchange', restoreRoute);
document.addEventListener('visibilitychange', () => { if (document.hidden) content.querySelectorAll('video').forEach(v => v.pause()); });
motion.addEventListener('change', () => { if (motion.matches) content.querySelectorAll('video').forEach(v => v.pause()); });
addEventListener('pagehide', event => { if (!event.persisted) { scene?.dispose(); stopMedia(); } });

function fallback() {
  document.body.classList.add('flat-machine', 'scene-ready');
  document.getElementById('rotation-tools').hidden = true;
  screen.inert = false; controls.inert = false;
  document.body.classList.remove('cabinet-back-facing', 'is-dragging');
  document.getElementById('fallback-note').hidden = false;
}
render();
restoreRoute();
// Respect old links to the simple presentation.
if (simpleRequested) location.replace('index.html');
else {
  try {
    if (navigator.connection?.saveData) throw new Error('data-saving mode');
    const sceneURL = document.querySelector('script[data-scene]').dataset.scene;
    const { createMachine } = await import('../' + sceneURL);
    scene = createMachine({ canvas: document.getElementById('machine-canvas'), screen, controls,
      onContextLost() { scene?.dispose(); scene = null; fallback(); },
    });
    document.getElementById('rotation-tools').hidden = false;
    document.querySelectorAll('[data-rotate]').forEach(button => button.addEventListener('click', () => scene?.rotate(Number(button.dataset.rotate))));
    document.getElementById('reset-view').addEventListener('click', () => scene?.resetView());
    document.body.classList.add('scene-ready');
    scene.setSelection(project);
    scene.setFocused(entered);
  } catch (error) { console.info('[portfolio] Using the static cabinet:', error.message); fallback(); }
}
