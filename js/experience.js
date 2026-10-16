const projects = JSON.parse(document.getElementById('case-data').textContent);
const screen = document.getElementById('project-screen');
const tabs = [...document.querySelectorAll('[data-project]')];
const select = document.getElementById('project-select');
const status = document.getElementById('selection-status');
const motion = matchMedia('(prefers-reduced-motion: reduce)');
const isProjectPage = document.body.dataset.projectPage === 'true';
let selected = Number(document.body.dataset.selectedProject);
let onScreen = false;
function updateMedia() {
  const video = screen.querySelector('video'); if (!video) return;
  const shouldPlay = onScreen && !document.hidden && video.dataset.playback !== 'pause' && (video.dataset.playback === 'play' || (!motion.matches && !navigator.connection?.saveData));
  if (shouldPlay) video.play().catch(() => {}); else video.pause();
}
function mountMedia() {
  const video = screen.querySelector('video'), button = screen.querySelector('.video-toggle');
  if (!video || !button) return;
  const label = () => { button.textContent = video.paused ? 'Play preview' : 'Pause preview'; };
  button.addEventListener('click', () => {
    video.dataset.playback = video.paused ? 'play' : 'pause';
    if (video.paused) video.play().catch(() => { button.textContent = 'Preview unavailable'; }); else video.pause();
  });
  video.addEventListener('play', label); video.addEventListener('pause', label); label(); updateMedia();
}
function syncSelection() {
  tabs.forEach((tab, i) => tab.setAttribute('aria-current', String(i === selected)));
  select.value = String(selected);
  document.getElementById('project-position').textContent = `${selected + 1} / ${projects.length}`;
}
function show(index, { navigate = true } = {}) {
  const next = (index + projects.length) % projects.length;
  if (navigate && isProjectPage) {
    location.assign(`/projects/${projects[next].slug}/#work`);
    return;
  }
  if (next !== selected) {
    screen.querySelectorAll('video').forEach(video => { video.pause(); video.removeAttribute('src'); video.load(); });
    selected = next;
    screen.replaceChildren(document.querySelector(`template[data-case="${selected}"]`).content.cloneNode(true));
    syncSelection(); mountMedia();
  }
  if (navigate) history.pushState({ project: selected }, '', `/?project=${projects[selected].slug}#work`);
  status.textContent = `${projects[selected].title}, project ${selected + 1} of ${projects.length}`;
  document.title = `${projects[selected].title} | Saif Chamakhi · Unity Developer`;
}
tabs.forEach((tab, index) => {
  tab.addEventListener('click', event => {
    if (event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault(); show(index);
  });
  tab.addEventListener('keydown', event => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? projects.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + projects.length) % projects.length;
    show(next); tabs[next].focus({ preventScroll: true });
  });
});
select.addEventListener('change', () => show(Number(select.value)));
document.querySelectorAll('[data-nav]').forEach(button => button.addEventListener('click', () => {
  show(selected + (button.dataset.nav === 'next' ? 1 : -1));
  if (!isProjectPage) screen.scrollIntoView({ block: 'start', behavior: motion.matches ? 'instant' : 'smooth' });
}));
addEventListener('popstate', () => {
  if (isProjectPage) return;
  const slug = new URLSearchParams(location.search).get('project');
  const index = projects.findIndex(project => project.slug === slug);
  show(index < 0 ? 0 : index, { navigate: false });
});
screen.addEventListener('click', async event => {
  const button = event.target.closest('[data-share]'); if (!button) return;
  const url = new URL(`/projects/${button.dataset.share}/#work`, location.origin).href;
  try {
    await navigator.clipboard.writeText(url);
    button.textContent = 'Link copied ✓'; status.textContent = 'Project link copied';
  } catch {
    const input = document.createElement('input'); input.className = 'share-link-input'; input.value = url; input.setAttribute('aria-label', 'Project link: select and copy'); button.after(input); input.focus(); input.select();
    status.textContent = 'Select and copy the project link';
  }
});
new IntersectionObserver(([entry]) => { onScreen = entry.isIntersecting; updateMedia(); }, { threshold: .05 }).observe(screen);
document.addEventListener('visibilitychange', updateMedia); motion.addEventListener('change', updateMedia);
navigator.connection?.addEventListener?.('change', updateMedia); syncSelection(); mountMedia();
const toggle = document.querySelector('.menu-toggle'), menu = document.querySelector('.section-links');
const mobile = matchMedia('(max-width: 820px)'); document.body.classList.add('js-navigation'); toggle.hidden = false;
function closeMenu(focus = false) {
  menu.classList.remove('is-open'); toggle.setAttribute('aria-expanded', 'false'); toggle.setAttribute('aria-label', 'Open navigation menu'); toggle.querySelector('.menu-icon').textContent = '☰';
  if (focus) toggle.focus();
}
toggle.addEventListener('click', event => {
  const open = toggle.getAttribute('aria-expanded') !== 'true';
  menu.classList.toggle('is-open', open); toggle.setAttribute('aria-expanded', String(open)); toggle.setAttribute('aria-label', open ? 'Close navigation menu' : 'Open navigation menu'); toggle.querySelector('.menu-icon').textContent = open ? '×' : '☰';
  if (open && !event.detail) menu.querySelector('a').focus({ preventScroll: true });
});
menu.addEventListener('click', event => {
  const a = event.target.closest('a'); if (!a || !mobile.matches) return;
  closeMenu(); const target = document.querySelector(a.hash); if (target) { target.tabIndex = -1; target.focus({ preventScroll: true }); }
});
document.addEventListener('keydown', event => { if (event.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') { event.preventDefault(); closeMenu(true); } });
document.addEventListener('click', event => { if (!event.target.closest('.site-nav')) closeMenu(); });
mobile.addEventListener('change', () => closeMenu());
const links = [...menu.querySelectorAll('a')];const sections = links.map(a => document.querySelector(a.hash));
function activeSection() {
  let active = null;for (const section of sections) if (section && section.getBoundingClientRect().top <= 160) active = section.id;
  links.forEach(a => { if (a.hash === '#' + active) a.setAttribute('aria-current', 'location'); else a.removeAttribute('aria-current'); });
}
addEventListener('scroll', activeSection, { passive: true }); activeSection();
if (document.body.dataset.projectPage && !location.hash) document.getElementById('work').scrollIntoView({ behavior: 'instant' });
if (!isProjectPage) {
  const initial = projects.findIndex(project => project.slug === new URLSearchParams(location.search).get('project'));
  if (initial >= 0) show(initial, { navigate: false });
}
