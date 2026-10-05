// Page controls remain independent of Three.js and usable with any GPU.
const screen = document.querySelector('.arcade-screen');
const buttons = [...document.querySelectorAll('.cab-btn')];
const status = document.createElement('span');
status.className = 'selection-status';
status.setAttribute('role', 'status');
status.setAttribute('aria-live', 'polite');
document.querySelector('.arcade-controls').append(status);
buttons.forEach((button, i) => {
  button.setAttribute('aria-controls', 'project-screen');
  button.addEventListener('keydown', (event) => {
    const key = event.key;
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(key)) return;
    event.preventDefault();
    const next = key === 'Home' ? 0 : key === 'End' ? buttons.length - 1 : (i + (key === 'ArrowRight' ? 1 : -1) + buttons.length) % buttons.length;
    window.__arcade.show(next);
    buttons[next].focus({ preventScroll: true });
  });
});
screen.id = 'project-screen';
screen.setAttribute('role', 'region');
screen.setAttribute('aria-label', 'Selected project details');

const motion = matchMedia('(prefers-reduced-motion: reduce)');
const net = navigator.connection;
let onScreen = false;
const mediaObserver = new IntersectionObserver(([entry]) => {
  onScreen = entry.isIntersecting;
  updateVideos();
}, { threshold: 0.05 });
mediaObserver.observe(screen);

function mountMedia() {
  const video = screen.querySelector('video');
  if (!video) return;
  const toggle = document.createElement('button');
  toggle.type = 'button'; toggle.className = 'classic-video-toggle';
  toggle.setAttribute('aria-label', 'Play gameplay preview');
  const label = () => {
    toggle.textContent = video.paused ? 'Play preview' : 'Pause preview';
    toggle.setAttribute('aria-label', video.paused ? 'Play gameplay preview' : 'Pause gameplay preview');
  };
  toggle.addEventListener('click', () => {
    video.dataset.userPlayback = video.paused ? 'play' : 'pause';
    if (video.paused) video.play().catch(() => { toggle.textContent = 'Preview unavailable'; });
    else video.pause();
  });
  video.addEventListener('play', label); video.addEventListener('pause', label);
  screen.querySelector('.cab-media').append(toggle); label();
}
function updateVideos() {
  screen.querySelectorAll('video').forEach(video => {
    const playing = onScreen && !document.hidden && video.dataset.userPlayback !== 'pause' && (video.dataset.userPlayback === 'play' || (!motion.matches && !net?.saveData));
    video.removeAttribute('autoplay');
    if (playing) video.play().catch(() => {});
    else video.pause();
  });
}
document.addEventListener('arcade:change', () => {
  const selected = buttons[window.__arcade.index];
  status.textContent = selected.querySelector('.cab-label').textContent + ', project ' + (window.__arcade.index + 1) + ' of ' + buttons.length;
  const strip = selected.parentElement;
  strip.scrollLeft = selected.offsetLeft - strip.offsetLeft - (strip.clientWidth - selected.offsetWidth) / 2;
  mountMedia();
  updateVideos();
});
motion.addEventListener('change', updateVideos);
net?.addEventListener?.('change', updateVideos);
document.addEventListener('visibilitychange', updateVideos);

mountMedia(); updateVideos();

const toggle = document.querySelector('.menu-toggle');
const menu = document.querySelector('.section-links');
const mobile = matchMedia('(max-width: 768px)');
document.body.classList.add('js-navigation');
toggle.hidden = false;
function closeMenu(restoreFocus = false) {
  menu.classList.remove('is-open'); toggle.setAttribute('aria-expanded', 'false');
  toggle.querySelector('.menu-icon').textContent = '☰';
  toggle.setAttribute('aria-label', 'Open navigation menu');
  if (restoreFocus) toggle.focus();
}
toggle.addEventListener('click', event => {
  const open = toggle.getAttribute('aria-expanded') !== 'true';
  menu.classList.toggle('is-open', open); toggle.setAttribute('aria-expanded', String(open));
  toggle.querySelector('.menu-icon').textContent = open ? '×' : '☰';
  toggle.setAttribute('aria-label', open ? 'Close navigation menu' : 'Open navigation menu');
  if (open && event.detail === 0) menu.querySelector('a').focus({ preventScroll: true });
});
menu.addEventListener('click', event => {
  const link = event.target.closest('a');
  if (!link || !mobile.matches) return;
  closeMenu();
  const target = document.querySelector(link.hash);
  if (target) { target.tabIndex = -1; target.focus({ preventScroll: true }); }
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') { event.preventDefault(); closeMenu(true); }
});
document.addEventListener('click', event => {
  if (!event.target.closest('.site-nav') && toggle.getAttribute('aria-expanded') === 'true') closeMenu();
});
mobile.addEventListener('change', () => closeMenu()); closeMenu();

const links = [...document.querySelectorAll('.nav-links a[href^="#"]')];
const sectionObserver = new IntersectionObserver(entries => {
  for (const entry of entries) {
    if (!entry.isIntersecting) continue;
    links.forEach(link => {
      if (link.hash === '#' + entry.target.id) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
  }
}, { rootMargin: '-15% 0px -65% 0px', threshold: 0 });
links.forEach(link => { const section = document.querySelector(link.hash); if (section) sectionObserver.observe(section); });
