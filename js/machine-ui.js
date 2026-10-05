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
let scene = null, current = 'about', project = 0, entered = false;
const esc = value => String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');
const parse = markup => { const template = document.createElement('template'); template.innerHTML = markup; return template.content; };
const links = [...parse(data.sections.about).querySelectorAll('.cta-row a')];
const resume = links.find(a => a.textContent.trim() === 'Resume');
if (resume) document.getElementById('board-resume').href = resume.href;
const clean = markup => {
  const root = parse(markup);
  root.querySelectorAll('*').forEach(el => { el.removeAttribute('style'); el.removeAttribute('data-reveal'); el.removeAttribute('id'); });
  const wrap = document.createElement('div'); wrap.append(root); return wrap.innerHTML;
};

function profile() {
  const intro = parse(data.sections.about).querySelector('p').textContent;
  const metrics = [...parse(data.sections.stats).children].map(el => `<div class="metric"><strong>${esc(el.children[0].textContent)}</strong><span>${esc(el.children[1].textContent)}</span></div>`).join('');
  return `<p class="section-kicker">01 / Meet the developer</p><div class="profile-layout"><div><h2>Unity developer.<br><em>Built to ship.</em></h2><p>${esc(intro)}</p><div class="screen-actions"><button class="screen-button primary" data-open="work">Explore my work ↗</button>${resume ? `<a class="screen-button" href="${esc(resume.href)}" target="_blank" rel="noopener">Résumé ↗</a>` : ''}<a class="text-link" href="mailto:chamakhiseif@gmail.com">Let's talk ↗</a></div><p class="profile-footnote">Tunis, Tunisia · Remote EU/GMT · Full-time or contract</p></div><div class="metric-grid">${metrics}</div></div>`;
}
function work() {
  const p = data.projects[project];
  const buttons = data.projects.map((item, i) => `<button type="button" data-project="${i}" aria-pressed="${i === project}"><span>${String(i + 1).padStart(2, '0')}</span>${esc(item.title)}</button>`).join('');
  const media = p.vid ? `<video src="${esc(p.media)}" poster="${esc(p.poster)}" muted loop playsinline preload="metadata" aria-label="${esc(p.title)} gameplay"></video><button type="button" class="video-toggle" data-video>Play preview</button>` : `<img src="${esc(p.media)}" alt="${esc(p.title)} gameplay" decoding="async">`;
  return `<p class="section-kicker">02 / Selected work</p>
    <div class="work-browser"><nav class="project-list" aria-label="Select a project">${buttons}</nav>
      <article class="project-detail">
        <div class="project-topline"><h2>${esc(p.title)}</h2><div class="project-stepper"><button data-step="-1" aria-label="Previous project">←</button><button data-step="1" aria-label="Next project">→</button></div></div>
        <div class="project-meta">${esc(p.platform)} · ${esc(p.year)} · ${String(project + 1).padStart(2, '0')} / 07</div>
        <div class="project-body"><div><div class="project-media">${media}</div><div class="tag-row">${(p.tech || []).map(t => `<span class="tag">${esc(t)}</span>`).join('')}</div></div>
          <div class="project-notes"><p class="project-summary">${esc(p.kind)}</p><ul>${p.bullets.map(b => `<li>${esc(b)}</li>`).join('')}</ul>
          ${p.link ? `<a class="text-link" href="${esc(p.link)}" target="_blank" rel="noopener">${esc(p.linkLabel || 'Explore project')} <span aria-hidden="true">↗</span></a>` : ''}</div>
        </div>
        <div class="earlier-work"><p>Earlier titles: <strong>Slash And Dash</strong> (BPM-driven obstacle generation, background VFX), <strong>DaQueen</strong> (ragdoll controller, Photon multiplayer), plus 20+ legacy titles restored and republished to current store requirements.</p></div>
      </article>
    </div>`;
}
function experience() {
  return `<p class="section-kicker">03 / Experience</p><h2>Where I've built.</h2>` + [...parse(data.sections.experience).querySelectorAll('.roles')].map(role => {
    const fields = [...role.firstElementChild.children].filter(el => el.tagName === 'DIV').map(el => el.textContent.trim());
    return `<article class="role"><div><h3>${esc(fields[0])}</h3><div class="role-label">${esc(fields[1])}</div><div class="role-date">${esc(fields[2])}</div></div>${clean(role.querySelector('ul').outerHTML)}</article>`;
  }).join('');
}
function toolkit() {
  const tools = [...parse(data.sections.tools).querySelectorAll('.stack-grid > div')].map(tool => `<article class="tool"><p class="section-kicker">${esc(tool.children[0].textContent)}</p><h3>${esc(tool.children[1].textContent)}</h3><p>${esc(tool.querySelector('p').textContent)}</p></article>`).join('');
  const skills = [...parse(data.sections.stack).querySelectorAll('.stack-grid > div')].map(skill => `<article class="skill"><h3>${esc(skill.firstElementChild.textContent)}</h3><div class="tag-row">${[...skill.querySelectorAll('span')].map(tag => `<span class="tag">${esc(tag.textContent)}</span>`).join('')}</div></article>`).join('');
  return `<p class="section-kicker">04 / Toolkit</p><h2>Beyond the game.</h2><div class="tools-grid">${tools}</div><h3>What I bring</h3><div class="skills-grid">${skills}</div>`;
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
new ResizeObserver(updateScrollHint).observe(content);
function render(section = current, { focus = false } = {}) {
  current = sections.includes(section) ? section : 'about';
  stopMedia();
  content.innerHTML = current === 'about' ? profile() : current === 'work' ? work() : current === 'experience' ? experience() : current === 'stack' ? toolkit() : `<div class="contact-content">${clean(data.sections.contact)}</div>`;
  content.scrollTop = 0;
  document.querySelectorAll('[data-section]').forEach(button => {
    if (button.dataset.section === current) button.setAttribute('aria-current', 'page'); else button.removeAttribute('aria-current');
  });
  controls.querySelectorAll('[data-board-section]').forEach(button => button.setAttribute('aria-pressed', String(entered && button.dataset.boardSection === current)));
  const index = sections.indexOf(current);
  document.getElementById('screen-location').textContent = `${String(index + 1).padStart(2, '0')} / ${names[index].toUpperCase()}`;
  document.getElementById('machine-announcer').textContent = current === 'work' ? `${data.projects[project].title}, project ${project + 1} of 7` : names[index];
  history.replaceState(null, '', entered ? '#' + current : location.pathname);
  syncVideo();
  requestAnimationFrame(() => {
    updateScrollHint();
    const list = content.querySelector('.project-list');
    const selected = list?.querySelector('[aria-pressed="true"]');
    if (selected && list.scrollWidth > list.clientWidth) list.scrollLeft = selected.offsetLeft - list.offsetLeft - (list.clientWidth - selected.offsetWidth) / 2;
  });
  if (focus) content.focus({ preventScroll: true });
  scene?.setSelection(project);
}
function enter(section = current, focus = true) {
  entered = true;
  document.body.classList.add('is-focused');
  start.hidden = true; app.hidden = false;
  render(section, { focus });
  scene?.setFocused(true);
}
function exit() {
  content.querySelectorAll('video').forEach(v => v.pause());
  entered = false;
  controls.querySelectorAll('[data-board-section]').forEach(button => button.setAttribute('aria-pressed', 'false'));
  document.body.classList.remove('is-focused');
  app.hidden = true; start.hidden = false;
  scene?.setFocused(false);
  history.replaceState(null, '', location.pathname);
  document.getElementById('start-button').focus({ preventScroll: true });
}
start.addEventListener('click', () => enter('work'));
document.getElementById('cabinet-back').addEventListener('click', exit);
screen.addEventListener('click', event => {
  const button = event.target.closest('button, a');
  if (!button) return;
  if (button.classList.contains('screen-brand')) { event.preventDefault(); enter('about'); }
  if (button.dataset.section) enter(button.dataset.section, false);
  if (button.dataset.open) enter(button.dataset.open);
  if (button.dataset.project != null) {
    project = Number(button.dataset.project); render('work');
    content.querySelector(`[data-project="${project}"]`).focus({ preventScroll: true });
  }
  if (button.dataset.step) {
    const step = button.dataset.step;
    project = (project + Number(step) + data.projects.length) % data.projects.length; render('work');
    content.querySelector(`[data-step="${step}"]`).focus({ preventScroll: true });
  }
  if (button.hasAttribute('data-video')) {
    const video = content.querySelector('video');
    if (video.paused) video.play().catch(() => { button.textContent = 'Preview unavailable'; }); else video.pause();
  }
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && entered) { event.preventDefault(); exit(); }
  if (event.target.matches('[data-project]') && ['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
    event.preventDefault();
    project = event.key === 'Home' ? 0 : event.key === 'End' ? data.projects.length - 1 : (project + (event.key === 'ArrowRight' ? 1 : -1) + data.projects.length) % data.projects.length;
    render('work'); content.querySelector(`[data-project="${project}"]`).focus();
  }
});
controls.addEventListener('click', event => {
  const button = event.target.closest('button');
  if (!button) return;
  if (button.dataset.boardSection) enter(button.dataset.boardSection, false);
  if (button.dataset.boardStep) {
    project = (project + Number(button.dataset.boardStep) + data.projects.length) % data.projects.length;
    enter('work', false);
  }
});
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
const initialSection = location.hash.slice(1);
render();
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
  } catch (error) { console.info('[portfolio] Using the static cabinet:', error.message); fallback(); }
  if (sections.includes(initialSection)) enter(initialSection);
}
