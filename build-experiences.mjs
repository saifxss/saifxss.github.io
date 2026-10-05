import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { findBlock } from './prerender.mjs';

const hash = path => createHash('sha256').update(readFileSync(path)).digest('hex').slice(0, 10);
const safeJSON = value => JSON.stringify(value).replaceAll('<', '\\u003c');

export function buildExperiences(source, projects) {
  const section = id => {
    const at = source.indexOf(`<section id="${id}"`);
    if (at < 0) throw new Error(`Missing portfolio section: ${id}`);
    return findBlock(source, 'section', at).inner;
  };
  const hero = findBlock(source, 'div', source.indexOf('<div class="hero-copy"'));
  const stats = findBlock(source, 'div', source.indexOf('<div class="stat-band'));
  const data = { projects, sections: { about: hero.inner, stats: stats.inner, experience: section('experience'), tools: section('tools'), stack: section('stack'), contact: section('contact') } };
  let classic = source.replace('</head>', `<link rel="stylesheet" href="css/classic.css?v=${hash('css/classic.css')}"></head>`);
  const escaped = s => String(s).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');
  classic = classic.replace('<body>', '<body><a class="skip-link" href="#work">Skip to selected work</a>');
  const siteNav = findBlock(classic, 'div', classic.indexOf('<div class="site-nav'));
  classic = classic.slice(0, siteNav.start) + `<div class="site-nav pad-x"><a class="classic-brand" href="#top">Saif Chamakhi<span>Unity developer</span></a><div class="nav-links"><div class="section-links" id="classic-sections"><a href="#work">Work</a><a href="#experience">Experience</a><a href="#stack">Toolkit</a><a href="#contact">Contact</a></div><a class="mode-link" href="index.html" aria-label="Open the 3D arcade portfolio">3D arcade <span aria-hidden="true">↗</span></a><button class="menu-toggle" type="button" aria-expanded="false" aria-controls="classic-sections" hidden><span class="menu-icon" aria-hidden="true">☰</span><span class="menu-text">Menu</span></button></div></div>` + classic.slice(siteNav.end);
  const classicHero = findBlock(classic, 'div', classic.indexOf('<div class="hero-copy"'));
  const heroLinks = [...hero.inner.matchAll(/<a\b[^>]*>[\s\S]*?<\/a>/g)].map(m => m[0]);
  const introduction = hero.inner.match(/<p\b[^>]*>[\s\S]*?<\/p>/)[0];
  const resumeLink = heroLinks.find(a => a.includes('>Resume<'));
  const socials = heroLinks.filter(a => />(Email|LinkedIn|GitHub)</.test(a));
  const featured = projects[0];
  classic = classic.slice(0, classicHero.start) + `<div class="hero-copy"><div class="hero-intro"><p class="hero-eyebrow"><span></span> SAIF CHAMAKHI / UNITY DEVELOPER</p><h1>Unity<br>Developer<span class="hero-period">.</span></h1><div class="hero-specialty">Gameplay systems.<br>Thoughtful interfaces. Multiplayer.</div>${introduction}<div class="cta-row hero-actions">${heroLinks[0]}${resumeLink}</div><div class="hero-socials">${socials.join('')}</div><p class="hero-location">Tunis, Tunisia · Remote EU/GMT · Full-time or contract</p></div><a class="hero-feature" href="#work" aria-label="Explore ${escaped(featured.title)} and selected projects"><div class="feature-topline"><span>SELECTED WORK</span><span>01 / 07</span></div><div class="feature-image"><img src="${escaped(featured.poster || featured.media)}" alt="${escaped(featured.title)} gameplay" width="800" height="500" fetchpriority="high"></div><div class="feature-copy"><span>GAMEPLAY / UI ARCHITECTURE</span><h2>${escaped(featured.title)}</h2><p>From complex prototypes to systems a team can build on.</p><div>Explore the case studies <span aria-hidden="true">↗</span></div></div></a></div>` + classic.slice(classicHero.end);
  // In the normal presentation, project selection comes before the case study.
  const selector = findBlock(classic, 'div', classic.indexOf('<div class="arcade-controls"'));
  classic = classic.slice(0, selector.start) + classic.slice(selector.end);
  const screenWrapAt = classic.indexOf('<div class="cab-screenwrap"');
  classic = classic.slice(0, screenWrapAt) + selector.openTag + selector.inner.replace('Press a button to load its case notes', 'Select a project · Use ← / → to browse').replace('Insert coin', '07 projects') + '</div>' + classic.slice(screenWrapAt);
  const marquee = findBlock(classic, 'div', classic.indexOf('<div class="cab-marquee"'));
  classic = classic.slice(0, marquee.start) + '<div class="cab-marquee"><span>THE PROJECT COLLECTION</span><span>PC · MOBILE · WEBGL</span></div>' + classic.slice(marquee.end);
  classic = classic.replace(/<div (style="position:relative;font-weight:800;font-size:clamp\(30px,3\.4vw,46px\)[^"]*")>([^<]+)<\/div>/g, '<h3 class="case-title" $1>$2</h3>');
  classic = classic.replace('</body>', `<script src="js/experience.js?v=${hash('js/experience.js')}" defer></script></body>`);
  const noScript = '<noscript><style>.arcade-controls{display:none!important}</style><div class="noscript-projects">' + projects.slice(1).map(p => `<article><h3>${escaped(p.title)}</h3><p>${escaped(p.kind)}</p><ul>${p.bullets.map(b => `<li>${escaped(b)}</li>`).join('')}</ul>${p.link ? `<a href="${escaped(p.link)}">Explore project ↗</a>` : ''}</article>`).join('') + '</div></noscript>';
  classic = classic.replace('<section id="experience"', noScript + '<section id="experience"');
  const nav = findBlock(classic, 'div', classic.indexOf('<div style="position:sticky;'));
  classic = classic.slice(0, nav.start) + nav.openTag.replace('<div ', '<nav aria-label="Primary navigation" ') + nav.inner + '</nav>' + classic.slice(nav.end);
  const contact = findBlock(classic, 'section', classic.indexOf('<section id="contact"'));
  classic = classic.slice(0, contact.end) + '</main>' + classic.slice(contact.end);
  classic = classic.replace('<section id="top"', '<main><section id="top"');
  classic = classic.replace('rel="canonical" href="https://saifxss.github.io"', 'rel="canonical" href="https://saifxss.github.io/"');
  classic = classic.replace('property="og:url" content="https://saifxss.github.io"', 'property="og:url" content="https://saifxss.github.io/"');
  classic = classic.replace('class="mode-link" href="index.html"', 'class="mode-link" href="arcade.html"');

  let arcade = readFileSync('templates/arcade.html', 'utf8')
    .replace('%%CSS%%', hash('css/machine.css'))
    .replace('%%UI%%', hash('js/machine-ui.js'))
    .replace('%%SCENE%%', hash('js/machine-scene.js'))
    .replace('%%DATA%%', safeJSON(data));
  const banner = '<!-- Generated by build.mjs. Edit source files, not this output. -->';
  const finish = html => html.replace('<!DOCTYPE html>', '<!DOCTYPE html>\n' + banner).replace(/[ \t]+$/gm, '');
  return { classic: finish(classic), arcade: finish(arcade) };
}
