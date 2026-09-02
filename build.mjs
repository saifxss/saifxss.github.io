// build.mjs — turns the Claude Design export into the deployable site.
//
//   bundle/index.bundle.html   (pristine export — the only file you replace)
//        |
//        v  node build.mjs
//   index.html   (generated, committed for GitHub Pages — the whole site)
//
// The export is a bundler-wrapped document: a loader unpacks a base64/gzip
// manifest holding the real page. Editing that by hand is impractical and any
// re-export throws the edits away, so every fix lives here as a named transform
// instead. Re-exporting from Claude Design means dropping in the new bundle and
// running this again.
//
// Each transform ASSERTS that it matched. If a re-export changes the markup a
// transform targets, the build fails loudly naming the transform, rather than
// silently dropping a fix and shipping a regression.
//
// The last stage RENDERS the template (see prerender.mjs), so what ships is
// finished HTML. There is no client-side template engine, no React download,
// and nothing to go wrong between the server responding and the page being
// readable. index.html is the entire site.

import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import { extname } from "node:path";
import { runInNewContext } from "node:vm";
import { findBlock, createContext, renderTemplate } from "./prerender.mjs";

const BUNDLE = "bundle/index.bundle.html";
const OUT_HTML = "index.html";

const SITE = "https://saifxss.github.io";
const EMAIL = "chamakhiseif@gmail.com";
const GITHUB = "https://github.com/saifxss";
const LINKEDIN = "https://www.linkedin.com/in/seif-chamakhi/";
const RESUME = "https://drive.google.com/file/d/18RgUWAaUabxcabjLMv4DzMsVOc3KPPCL/view?usp=sharing";

let mediaNote = "";

// ── transform bookkeeping ──────────────────────────────────────────────────
const applied = [];
function edit(name, html, find, replace, { count = 1 } = {}) {
  const hits = html.split(find).length - 1;
  if (hits !== count) {
    throw new Error(
      `transform "${name}": expected ${count} match(es), found ${hits}.\n` +
      `The bundle's markup changed. Update this transform in build.mjs.\n` +
      `Looking for: ${String(find).slice(0, 160)}`
    );
  }
  applied.push(name);
  return html.split(find).join(replace);
}
function editRe(name, html, re, replace, { count = 1 } = {}) {
  const hits = (html.match(new RegExp(re.source, re.flags.replace("g", "") + "g")) || []).length;
  if (hits !== count) {
    throw new Error(`transform "${name}": expected ${count} match(es), found ${hits}.`);
  }
  applied.push(name);
  return html.replace(re, replace);
}

// ── unpack ─────────────────────────────────────────────────────────────────
const bundle = readFileSync(BUNDLE, "utf8");
const grab = (kind) => {
  const m = bundle.match(new RegExp(`<script type="__bundler/${kind}">\\n?([\\s\\S]*?)\\n?\\s*</script>`));
  if (!m) throw new Error(`bundle is missing the __bundler/${kind} section`);
  return JSON.parse(m[1].trim());
};

let html = grab("template");

// The bundle also carries dc-runtime and the fonts as manifest entries. Neither
// ships any more: the fonts become a Google Fonts link below, and the runtime
// is not needed at all once the page is rendered here instead of in the
// browser. The manifest is left unread.

// ══ TASK 5 — <html lang> ═══════════════════════════════════════════════════
html = edit("lang", html, "<html><head>", '<html lang="en"><head>');

// ── the runtime script tag goes away entirely ─────────────────────────────
html = editRe("drop-runtime-tag", html, /<script src="[0-9a-f-]{36}"><\/script>/, "");

// ══ PERF — swap ~570KB of inlined woff2 for a Google Fonts link ════════════
// The export inlines every @font-face as base64. That is the single biggest
// slice of the bundle and it blocks first paint.
const fontStyleRe = /<style>\/\* cyrillic-ext \*\/[\s\S]*?<\/style>/;
if (!fontStyleRe.test(html)) throw new Error('transform "fonts": inlined @font-face block not found');
applied.push("fonts");
html = html.replace(fontStyleRe,
  '<link href="https://fonts.googleapis.com/css2?family=Libre+Franklin:wght@300;400;500;600;700;800&family=Spectral:ital,wght@1,300;1,400&display=swap" rel="stylesheet">');

// ══ TASK 4 — real <head>: title, meta, OG, JSON-LD ════════════════════════
const HEAD = `
<title>Saif Chamakhi — Unity Developer | Gameplay, UI Systems &amp; Multiplayer</title>
<meta name="description" content="Unity developer with 5+ years and 9 shipped commercial titles across Steam, Google Play, and WebGL, including a mobile release with 100,000+ downloads at 4.7 stars. Gameplay systems, UI architecture, and multiplayer netcode.">
<meta name="keywords" content="Unity Developer, C#, Photon Fusion, Photon Quantum, WebGL, Game Developer, UI Systems, Multiplayer, Tunisia, Remote">
<meta name="author" content="Saif Chamakhi">
<link rel="canonical" href="${SITE}">
<meta property="og:type" content="website">
<meta property="og:title" content="Saif Chamakhi — Unity Developer">
<meta property="og:description" content="5+ years, 9 shipped titles, 100,000+ downloads. Gameplay systems, UI architecture, multiplayer netcode.">
<meta property="og:url" content="${SITE}">
<meta property="og:image" content="${SITE}/assets/portrait.png">
<meta property="og:image:alt" content="Saif Chamakhi — Unity Developer">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#0E0D11">
<link rel="icon" href="favicon.ico">
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Person",
  "name": "Saif Chamakhi",
  "jobTitle": "Unity Developer",
  "url": "${SITE}",
  "email": "mailto:${EMAIL}",
  "telephone": "+216 52 099 160",
  "address": { "@type": "PostalAddress", "addressLocality": "Tunis", "addressCountry": "TN" },
  "sameAs": ["${GITHUB}", "${LINKEDIN}"],
  "knowsAbout": ["Unity", "C#", "Game Development", "Photon Fusion", "WebGL", "Multiplayer Netcode", "UI Architecture"]
}
</script>
`;
html = edit("head-meta", html,
  '<meta name="viewport" content="width=device-width, initial-scale=1">',
  '<meta name="viewport" content="width=device-width, initial-scale=1">' + HEAD);

// ══ TASK 1 + 5 — responsive, touch targets, focus, reduced motion ═════════
// Inline style="" attributes can't hold media queries, so layout containers get
// a class here and the real CSS lives in one stylesheet.
const CSS = `
<style>
  /* ── Task 1: kill horizontal scroll ──
     overflow-x lives on body only. Putting it on html promotes html to a scroll
     container, which forces overflow-y to auto and re-breaks document scrolling. */
  html { max-width: 100%; }
  body { max-width: 100%; overflow-x: hidden; }
  *, *::before, *::after { box-sizing: border-box; }
  img, video, svg { max-width: 100%; height: auto; }

  /* ── Task 5: keyboard focus (the runtime only wires style-hover) ── */
  a:focus-visible, button:focus-visible, [tabindex]:focus-visible {
    outline: 2px solid oklch(0.78 0.14 320);
    outline-offset: 3px;
  }

  /* ── Task 1: touch targets (44x44 minimum, both axes) ── */
  .nav-links a, .cta-row a, .contact-links a, .site-nav a {
    display: inline-flex; align-items: center; justify-content: center;
    min-height: 44px; min-width: 44px;
  }
  .contact-links a { justify-content: flex-start; }
  /* Wordmark: tall enough to tap without stretching the 62px nav bar. */
  .site-nav > a { display: inline-flex; align-items: center; min-height: 44px; }

  /* ── Task 2: project media ── */
  .shot-media {
    position: absolute; inset: 0; width: 100%; height: 100%;
    object-fit: cover; display: block;
  }
  /* "Now playing" readout — red, outlined so it stays legible on any frame of
     the gameplay media underneath. text-shadow rather than -webkit-text-stroke,
     which thins the glyphs at 11px. z-index keeps it above the media overlay. */
  .now-playing {
    color: #ff2b2b !important;
    z-index: 2;
    text-shadow:
       1px  1px 0 #000,  -1px  1px 0 #000,
       1px -1px 0 #000,  -1px -1px 0 #000,
       0 2px 4px rgba(0, 0, 0, 0.9);
  }
  /* The blinking cue is part of the same readout, so it matches. */
  .now-playing > span:first-child {
    background: #ff2b2b !important;
    box-shadow: 0 0 0 1px #000, 0 0 6px rgba(255, 43, 43, 0.9);
  }

  /* Per-project store/video link, under the bullets in the cabinet panel. */
  .project-link {
    align-self: flex-start;
    display: inline-flex; align-items: center; gap: 8px;
    min-height: 44px; padding: 10px 18px;
    border: 1px solid rgba(240, 237, 230, 0.28);
    font-size: 11.5px; font-weight: 600;
    letter-spacing: 0.14em; text-transform: uppercase;
    color: #F0EDE6; text-decoration: none;
    transition: background 0.15s ease, border-color 0.15s ease;
  }
  .project-link:hover {
    background: rgba(240, 237, 230, 0.07);
    border-color: #F0EDE6;
  }

  /* Shown instead of a still when a project has nothing shippable. */
  .no-footage {
    position: absolute; inset: 0;
    display: flex; flex-direction: column;
    align-items: center; justify-content: center; gap: 10px;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 11.5px; letter-spacing: 0.18em; text-transform: uppercase;
    color: rgba(240, 237, 230, 0.62);
    text-align: center; padding: 24px; pointer-events: none;
  }
  .no-footage-mark {
    display: inline-flex; align-items: center; justify-content: center;
    width: 34px; height: 34px; border-radius: 50%;
    border: 1px solid rgba(240, 237, 230, 0.28);
    font-size: 13px; letter-spacing: 0;
    color: rgba(240, 237, 230, 0.5);
  }

  /* ── Cabinet buttons ──
     These were <div>s with a click handler and per-state inline styles baked in
     by the template engine. They are real <button>s now, so they are reachable
     by keyboard and announce their state, and the selected look is driven by
     aria-pressed instead of inline style — which is what lets the page swap
     titles without re-rendering the row. */
  .cab-btn {
    cursor: pointer; display: flex; flex-direction: column; align-items: center;
    gap: 8px; width: 118px; background: none; border: 0; padding: 0;
    font: inherit; color: inherit; -webkit-appearance: none;
  }
  .cab-dot {
    width: 44px; height: 44px; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    font-weight: 800; font-size: 14px; font-variant-numeric: tabular-nums;
    background: radial-gradient(circle at 34% 28%, #3A3745, #17151D);
    border: 1px solid rgba(240, 237, 230, 0.2);
    box-shadow: inset 0 -3px 6px rgba(0, 0, 0, 0.55);
    color: rgba(240, 237, 230, 0.72);
    transition: transform 130ms, box-shadow 130ms, background 130ms, color 130ms;
  }
  .cab-label {
    font-size: 10px; font-weight: 600; letter-spacing: 0.08em;
    text-transform: uppercase; text-align: center; line-height: 1.35;
    color: rgba(240, 237, 230, 0.42); transition: color 130ms;
  }
  .cab-btn[aria-pressed="true"] .cab-dot {
    background: radial-gradient(circle at 34% 28%, oklch(0.78 0.15 320), oklch(0.5 0.16 320));
    border-color: oklch(0.82 0.12 320);
    box-shadow: 0 0 22px oklch(0.62 0.16 320 / 0.75), inset 0 -3px 6px rgba(0, 0, 0, 0.4);
    color: #120F16;
  }
  .cab-btn[aria-pressed="true"] .cab-label { color: #F0EDE6; }
  .cab-btn:hover .cab-dot { transform: translateY(-2px); }
  .cab-btn:active .cab-dot { transform: translateY(2px); }

  /* ── Cabinet screen: one size for every title ──
     The case-notes panel is a grid item on an auto-sized row, so the row grows
     to whatever the tallest title needs and the whole screen resized as you
     switched projects. The Amazing SaniBoy is the outlier: four bullets plus a
     store link, where most titles have two bullets. Pinning the height fixes
     the screen; the panel already carries overflow:auto inline, so the one
     title that runs long scrolls inside a cabinet that no longer moves.

     Desktop only. At ≤1024px the screen stacks into two rows and each child
     gets its own min-height, so a fixed height there would crush them. */
  @media (min-width: 1025px) {
    .arcade-screen { height: 470px; }
  }

  /* ── ≤1024px — tablet ── */
  @media (max-width: 1024px) {
    .stat-band { grid-template-columns: repeat(2, 1fr) !important; }
    /* In 2-up, every second cell's divider lands on the container edge. */
    .stat-band > div:nth-child(2n) { border-right: 0 !important; }
    .stat-band > div { padding-left: 24px !important; padding-right: 24px !important; }
    .stat-band > div:nth-child(2n + 1) { padding-left: 0 !important; }
    .stack-grid { grid-template-columns: repeat(2, 1fr) !important; }
    .arcade-screen { grid-template-columns: 1fr !important; }
    .contact { grid-template-columns: 1fr !important; gap: 44px !important; }
    .roles { grid-template-columns: 1fr !important; gap: 18px !important; }
  }

  /* ── ≤768px — mobile ── */
  @media (max-width: 768px) {
    section, .pad-x { padding-left: 20px !important; padding-right: 20px !important; }

    /* Nav: wordmark + 3 section links + CTA cannot fit 375px. The links were
       being flex-shrunk to 44px, wrapping "Saif Chamakhi" onto two lines and
       pushing "Hire me" past the padding. Drop the section links (the content
       is a scroll away) and stop the wordmark shrinking. */
    .nav-links a:not(:last-child) { display: none !important; }
    .site-nav > a { flex: 0 0 auto; white-space: nowrap; }
    .nav-links { flex: 0 0 auto; gap: 0 !important; }

    /* Section headers put the heading and its intro side by side; below ~700px
       the intro collapses to a sliver, so stack them. */
    .section-head { flex-direction: column !important; align-items: stretch !important; gap: 18px !important; }
    .section-head > div { max-width: none !important; }
    .stat-band, .roles, .stack-grid, .contact,
    .arcade-screen, .arcade-controls {
      grid-template-columns: 1fr !important;
    }
    /* Stat cells divide with border-right + 44px side padding. Stacked, that
       leaves a stray rule down the right edge and a lot of dead height, so the
       dividers become horizontal rules between rows. */
    .stat-band { gap: 0 !important; text-align: left !important; }
    .stat-band > div {
      border-right: 0 !important;
      border-bottom: 1px solid rgba(240, 237, 230, 0.12);
      padding: 24px 0 !important;
    }
    .stat-band > div:last-child { border-bottom: 0; }
    .arcade-controls { gap: 16px !important; justify-items: start !important; }
    .arcade-screen { min-height: 0 !important; }
    .arcade-screen > * { min-height: 260px; }
    .site-footer { flex-direction: column !important; gap: 10px !important; }
  }

  /* ── ≤480px — small phones ── */
  @media (max-width: 480px) {
    h1 { font-size: clamp(32px, 9vw, 48px) !important; }
    .cta-row { flex-direction: column !important; align-items: stretch !important; }
    .cta-row a { text-align: center; width: 100%; }
    .nav-links { gap: 14px !important; }
  }

  /* ── Task 5: reduced motion — kills CRT flicker, scanlines, ticker ── */
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
      scroll-behavior: auto !important;
    }
    /* Collapsing the duration doesn't stop a keyframe animation, it snaps it to
       its LAST frame — which for the marquee is fully scrolled off. The track
       has to be pinned back to its start or the ticker reads as empty. */
    .ticker-track { transform: none !important; }
  }

  /* ══ the 3D cabinet ══
     Every rule here is scoped to html.a3d, which only arcade3d.js sets, and
     only once a WebGL2 context is actually running. Nothing below applies to a
     visitor without JS, without a GPU, on a phone, or with reduced motion on:
     they get the flat cabinet, unchanged. */
  /* opacity is written every frame by the scroll choreography, so there is
     deliberately no transition here: one would smear behind the scroll. The
     fade-in at boot is a ramp inside the render loop instead. */
  #a3d {
    position: fixed; inset: 0; z-index: 3;
    opacity: 0; visibility: hidden;
    /* The cabinet floats over the page for most of its travel, so it must
       never eat a click. arcade3d.js hit-tests on window events instead. */
    pointer-events: none;
  }
  .a3d #a3d { visibility: visible; }
  #a3d canvas { display: block; width: 100%; height: 100%; }

  /* Where the capture sits while the tube is showing it. On screen and at a
     real size, because a display:none video stops decoding and the texture
     freezes; fully transparent and behind the page, because nobody should see
     it twice. */
  #a3d-src {
    position: fixed; left: 0; top: 0; z-index: -1;
    width: 320px; height: 180px; overflow: hidden;
    opacity: 0; pointer-events: none;
  }
  #a3d-src video, #a3d-src img { width: 100%; height: 100%; object-fit: cover; }

  /* The flat cabinet is NOT reshaped any more. It was, while the machine
     stayed docked beside it for the length of the section - but the machine
     dissolves partway down now, and a panel that had been stripped of its
     marquee and its capture would be left holding an empty frame the moment
     it went. The two coexist instead: the machine is an overlay that hands
     the section back, and the page underneath never changed. */
</style>
`;
html = edit("responsive-css", html, "</helmet>", CSS + "</helmet>");

// ── attach the classes the CSS above targets ──────────────────────────────
const cls = (name, marker, className, count = 1) => {
  html = edit(name, html, marker, marker.replace("<div style=", `<div class="${className}" style=`), { count });
};

cls("cls-stat-band",
  '<div style="max-width:1320px;margin:0 auto;padding:0 44px;display:grid;grid-template-columns:repeat(4,1fr)">',
  "stat-band pad-x");
cls("cls-arcade-screen",
  '<div style="position:relative;border-radius:12px;overflow:hidden;background:#0C0B10;display:grid;grid-template-columns:1.25fr 1fr;gap:0;min-height:430px">',
  "arcade-screen");
cls("cls-arcade-controls",
  '<div style="margin-top:26px;display:grid;grid-template-columns:auto 1fr auto;gap:32px;align-items:center;border-top:1px solid rgba(240,237,230,0.1);padding-top:26px">',
  "arcade-controls");
cls("cls-roles",
  '<div style="display:grid;grid-template-columns:320px 1fr;gap:44px;padding:34px 0;border-top:1px solid rgba(240,237,230,0.14)">',
  "roles");
cls("cls-stack-grid",
  '<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:26px">',
  "stack-grid", 2);
cls("cls-contact",
  '<div style="max-width:1320px;margin:0 auto;padding:96px 44px;display:grid;grid-template-columns:1fr 360px;gap:64px;align-items:start">',
  "contact pad-x");
cls("cls-hero-cta",
  '<div style="display:flex;flex-wrap:wrap;gap:14px;align-items:center">',
  "cta-row");
// The reduced-motion rule above targets .ticker-track, which nothing carried:
// the marquee track is styled inline. Without the class the rule was dead and
// reduced-motion users got an empty ticker strip.
cls("cls-ticker-track",
  '<div style="display:flex;width:max-content;animation:ticker 34s linear infinite">',
  "ticker-track");

// nav + footer rows
html = edit("cls-nav-bar", html,
  '<div style="max-width:1320px;margin:0 auto;padding:0 44px;height:62px;display:flex;align-items:center;justify-content:space-between;gap:24px">',
  '<div class="site-nav pad-x" style="max-width:1320px;margin:0 auto;padding:0 44px;height:62px;display:flex;align-items:center;justify-content:space-between;gap:24px">');
html = edit("cls-nav", html,
  '<div style="display:flex;align-items:center;gap:26px;font-size:11px;font-weight:500;letter-spacing:0.16em;text-transform:uppercase;color:rgba(240,237,230,0.62)">',
  '<div class="nav-links" style="display:flex;align-items:center;gap:26px;font-size:11px;font-weight:500;letter-spacing:0.16em;text-transform:uppercase;color:rgba(240,237,230,0.62)">');
html = edit("cls-section-head", html,
  '<div data-reveal="1" style="display:flex;align-items:flex-end;justify-content:space-between;gap:32px;margin-bottom:46px">',
  '<div data-reveal="1" class="section-head" style="display:flex;align-items:flex-end;justify-content:space-between;gap:32px;margin-bottom:46px">');
html = edit("cls-footer", html,
  '<div style="max-width:1320px;margin:0 auto;padding:0 44px;display:flex;justify-content:space-between;gap:24px;font-size:11px;font-weight:500;letter-spacing:0.14em;text-transform:uppercase;color:rgba(240,237,230,0.55)">',
  '<div class="site-footer pad-x" style="max-width:1320px;margin:0 auto;padding:0 44px;display:flex;justify-content:space-between;gap:24px;font-size:11px;font-weight:500;letter-spacing:0.14em;text-transform:uppercase;color:rgba(240,237,230,0.55)">');

// ══ TASK 3 — contact links ════════════════════════════════════════════════
const OUTLINE = "border:1px solid rgba(240,237,230,0.3);padding:15px 28px;font-size:13px;letter-spacing:0.08em;text-transform:uppercase;font-weight:500";
const HOVER = "border-color:#F0EDE6;background:rgba(240,237,230,0.07);color:#F0EDE6";

// Hero: the raw address was the visible label. Relabel, and add LinkedIn/Resume.
// The raw address is the visible label in BOTH the hero and the contact row.
html = editRe("email-labels", html,
  new RegExp(`(<a href="mailto:${EMAIL}"[^>]*>)${EMAIL}(</a>)`, "g"),
  `$1Email$2`, { count: 2 });
html = editRe("email-aria", html,
  new RegExp(`<a href="mailto:${EMAIL}" style=`, "g"),
  `<a href="mailto:${EMAIL}" aria-label="Email Saif Chamakhi" style=`, { count: 2 });
html = edit("hero-links", html,
  `<a href="${GITHUB}" style="${OUTLINE}" style-hover="${HOVER}">GitHub</a>`,
  `<a href="${LINKEDIN}" aria-label="Saif Chamakhi on LinkedIn" style="${OUTLINE}" style-hover="${HOVER}">LinkedIn</a>\n` +
  `        <a href="${GITHUB}" aria-label="Saif Chamakhi on GitHub" style="${OUTLINE}" style-hover="${HOVER}">GitHub</a>\n` +
  `        <a href="${RESUME}" target="_blank" rel="noopener" aria-label="Open Saif Chamakhi's resume" style="${OUTLINE}" style-hover="${HOVER}">Resume</a>`);

// Contact section: "Elsewhere" showed bare URLs as labels.
html = edit("contact-elsewhere", html,
  `<div style="display:flex;flex-direction:column;gap:7px;font-size:14.5px">\n            <a href="${GITHUB}">github.com/saifxss</a>\n            <a href="https://linkedin.com/in/seif-chamakhi">linkedin.com/in/seif-chamakhi</a>\n          </div>`,
  `<div class="contact-links" style="display:flex;flex-direction:column;gap:7px;font-size:14.5px">\n` +
  `            <a href="mailto:${EMAIL}" aria-label="Email Saif Chamakhi">Email</a>\n` +
  `            <a href="${LINKEDIN}" aria-label="Saif Chamakhi on LinkedIn">LinkedIn</a>\n` +
  `            <a href="${GITHUB}" aria-label="Saif Chamakhi on GitHub">GitHub</a>\n` +
  `            <a href="${RESUME}" target="_blank" rel="noopener" aria-label="Open Saif Chamakhi's resume">Resume</a>\n` +
  `          </div>`);

// The contact CTA row keeps the phone number, per the brief.
html = edit("contact-cta-row", html,
  '<div style="display:flex;flex-wrap:wrap;gap:14px">\n          <a href="mailto:',
  '<div class="cta-row" style="display:flex;flex-wrap:wrap;gap:14px">\n          <a href="mailto:');

// ══ CONTENT — swap Super One for Shells And Tails ═════════════════════════
// Super One is NDA-restricted with no showable footage, so it occupied a slot
// in a 7-project showcase that could never render anything. Shells And Tails
// has footage. Super One stays credited in the BNJMO role bullet — the work
// still counts, it just can't be shown.
//
// This is CONTENT, not a fix, and the durable home for it is the Claude Design
// document. Make the same change there when convenient; until then this
// transform re-applies it on every build, and will fail loudly if a future
// export has already dropped or renamed the entry.
html = edit("content-shells-and-tails", html,
  `    title: "Super One", year: "2025", platform: "Mobile", shot: "super-one-shop.png",
    kind: "Shop, profile, quest, and settings systems on a data-driven ScriptableObject architecture.",
    stack: "Unity · ScriptableObjects", tech: ["Unity", "ScriptableObjects", "UI"],
    bullets: [
      "Built shop, profile, quest, and settings systems on a data-driven ScriptableObject architecture, letting designers add content without engineering involvement.",
      "Designed modular, reusable UI components to keep the interface scalable as new features were added."
    ]`,
  `    title: "Shells And Tails", year: "2022", platform: "PC", shot: "shells-and-tails.png",
    kind: "Four-player split-screen showdown — four wildly different rule sets, one shared chaos.",
    stack: "Unity · C# · Local multiplayer", tech: ["Unity", "C#", "Local multiplayer"],
    bullets: [
      "Built the gameplay for each rule-set mini-game, each with its own win condition and feel.",
      "Wired the split-screen camera rig and four-player local input handling."
    ]`);

// ══ CONTENT — drop the hero availability badge ════════════════════════════
// The pulsing-dot "Open to full-time & contract · Remote EU/GMT" strip is a
// generated-portfolio tell. The same information is already stated plainly in
// the contact section, so the badge only costs credibility.
html = edit("content-drop-hero-badge", html,
  `      <div style="display:flex;align-items:center;gap:14px;font-size:11px;font-weight:600;letter-spacing:0.2em;text-transform:uppercase;color:oklch(0.75 0.14 320);margin-bottom:40px">
        <span style="width:7px;height:7px;border-radius:50%;background:oklch(0.68 0.16 320);box-shadow:0 0 0 5px oklch(0.62 0.16 320 / 0.22)"></span>
        Open to full-time &amp; contract · Remote EU/GMT
      </div>
`, "");

// ══ CONTENT — drop the placeholder media captions ═════════════════════════
// Two leftovers from the design mockup that label media rather than show it.
//
// 1. The arcade panel printed the raw shot filename ("maleficus-arena.png")
//    next to the platform/year badges. The panel now shows the actual media,
//    so the filename is noise — and it was stale anyway, still naming the .png
//    after gifs/ took over.
html = edit("content-drop-shot-caption", html,
  `
              <span style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:0.06em;text-transform:none;color:rgba(240,237,230,0.5)">{{ active.shot }}</span>`,
  "");

// 2. "showreel.mp4 — 30s gameplay cut" sat in the hero's bottom-right corner,
//    captioning a background video that was never part of the export — the
//    hero is a striped gradient. It described media that does not exist.
html = edit("content-drop-showreel-caption", html,
  `    <div style="position:absolute;right:44px;bottom:34px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:10.5px;letter-spacing:0.06em;color:rgba(240,237,230,0.5)">showreel.mp4 — 30s gameplay cut</div>
`,
  "");

// ══ CONTENT — per-project links ═══════════════════════════════════════════
// The export ships no links, so every title is a dead end. These are the live
// store/video pages, carried over from the previous portfolio's data.
// Tikto King has none — its <sc-if> simply renders nothing.
const PROJECT_LINKS = {
  "Maleficus":           ["https://www.youtube.com/watch?v=ot-bKn4FcaU", "Watch the demo"],
  "Tikto King":          null,
  "The Amazing SaniBoy": ["https://play.google.com/store/apps/details?id=com.readytoplay.saniboy&hl=en_US", "Google Play"],
  "Draft Fever Bowl":    ["https://store.steampowered.com/app/3100820/Draft_Fever_Bowl/", "Steam store"],
  "The Plooshies":       ["https://x.com/ThePlooshies/status/1828855091933159454", "See it on X"],
  "Shells And Tails":    ["https://www.youtube.com/watch?v=yojNNBnJC4A&t=1s", "Watch on YouTube"],
  "Albert's Ark Idle":   ["https://store.steampowered.com/app/3088750/Alberts_Ark_Idle/", "Steam store"],
};

let linked = 0;
for (const [title, pair] of Object.entries(PROJECT_LINKS)) {
  if (!pair) continue;
  const [href, label] = pair;
  const find = `title: ${JSON.stringify(title)}, year:`;
  if (!html.includes(find)) {
    throw new Error(`transform "content-project-links": no PROJECTS entry titled ${title}. Update PROJECT_LINKS in build.mjs.`);
  }
  html = html.replace(find, `title: ${JSON.stringify(title)}, link: ${JSON.stringify(href)}, linkLabel: ${JSON.stringify(label)}, year:`);
  linked++;
}
applied.push(`content-project-links(${linked})`);

// Render it under the tech tags, inside the cabinet's right-hand panel.
html = edit("project-link-markup", html,
  `            <div style="margin-top:auto;display:flex;flex-wrap:wrap;gap:7px">`,
  `            <sc-if value="{{ active.link }}">
              <a class="project-link" href="{{ active.link }}" target="_blank" rel="noopener" aria-label="{{ active.title }} — {{ active.linkLabel }} (opens in a new tab)">{{ active.linkLabel }} <span aria-hidden="true">↗</span></a>
            </sc-if>
            <div style="margin-top:auto;display:flex;flex-wrap:wrap;gap:7px">`);

// Shells And Tails is now a showcased project, so drop it from the "earlier
// titles" line below the cabinet — it was listed there while Super One held the
// slot, and listing it in both places reads as padding.
html = edit("content-earlier-titles", html,
  `<span style="color:#F0EDE6">Slash And Dash</span> (BPM-driven obstacle generation, background VFX), <span style="color:#F0EDE6">Shells And Tails</span> (split-screen four-player local multiplayer), <span style="color:#F0EDE6">DaQueen</span> (ragdoll controller, Photon multiplayer)`,
  `<span style="color:#F0EDE6">Slash And Dash</span> (BPM-driven obstacle generation, background VFX), <span style="color:#F0EDE6">DaQueen</span> (ragdoll controller, Photon multiplayer)`);

// ══ A11Y + PRERENDER — cabinet controls become real buttons ═══════════════
// The seven title buttons and the prev/next pair were <div>s carrying a
// runtime click binding, so they were unreachable by keyboard and invisible to
// assistive tech. They become <button>s addressed by data-* attributes, which
// the small vanilla script at the end of the page wires up.
//
// The per-state inline styles ({{ p.btnBg }} and friends) come off here too:
// with the look driven by aria-pressed in CSS, switching titles is one
// attribute flip instead of a re-render of the whole row.
html = edit("cabinet-buttons", html,
  `<div sc-camel-on-click="{{ p.select }}" title="{{ p.title }}" style="cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:8px;width:118px">
              <div style="width:44px;height:44px;border-radius:50%;background:{{ p.btnBg }};border:1px solid {{ p.btnBorder }};box-shadow:{{ p.btnShadow }};display:flex;align-items:center;justify-content:center;font-weight:800;font-size:14px;font-variant-numeric:tabular-nums;color:{{ p.btnText }};transition:transform 130ms,box-shadow 130ms" style-hover="transform:translateY(-2px)" style-active="transform:translateY(2px)">{{ p.num }}</div>
              <div style="font-size:10px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;text-align:center;line-height:1.35;color:{{ p.labelColor }}">{{ p.title }}</div>
            </div>`,
  `<button type="button" class="cab-btn" data-project="{{ p.index }}" aria-pressed="{{ p.pressed }}">
              <span class="cab-dot" aria-hidden="true">{{ p.num }}</span>
              <span class="cab-label">{{ p.title }}</span>
            </button>`);

const NAV_STYLE = "cursor:pointer;border:1px solid rgba(240,237,230,0.24);padding:11px 15px;font-size:12px;font-weight:700;letter-spacing:0.1em";
const NAV_HOVER = "border-color:#F0EDE6;background:rgba(240,237,230,0.08)";
for (const [dir, glyph, label] of [["prev", "◀", "Previous title"], ["next", "▶", "Next title"]]) {
  html = edit(`cabinet-nav-${dir}`, html,
    `<div sc-camel-on-click="{{ ${dir} }}" style="${NAV_STYLE}" style-hover="${NAV_HOVER}">${glyph}</div>`,
    `<button type="button" data-nav="${dir}" aria-label="${label}" ` +
    `style="${NAV_STYLE};background:none;color:inherit;font-family:inherit;min-height:44px" ` +
    `style-hover="${NAV_HOVER}"><span aria-hidden="true">${glyph}</span></button>`);
}

// ══ CONTENT — tell people the cabinet is interactive ══════════════════════
// The instruction already existed, but as the tail of the section intro in the
// header's top-right, roughly a full screen above the buttons it describes. By
// the time the cabinet is on screen it has scrolled away. It moves down to sit
// directly under the button row, in the same caption register as the "1P" and
// "Insert coin" labels flanking it, and the intro keeps just its own claim.
const BTN_ROW = '<div style="display:flex;flex-wrap:wrap;gap:10px;justify-content:center">';
const NEXT_CELL = '<div style="display:flex;flex-direction:column;gap:8px;align-items:flex-end">';
const CAPTION = "font-size:9.5px;font-weight:600;letter-spacing:0.16em;text-transform:uppercase;color:rgba(240,237,230,0.45)";

// The button row is one cell of a 3-column grid, so the caption cannot simply
// be a sibling — that would make it a fourth column. Row and caption get
// wrapped in a column flex box that takes the cell instead.
html = edit("cabinet-hint-open", html, BTN_ROW,
  '<div style="display:flex;flex-direction:column;align-items:center;gap:14px">\n          ' + BTN_ROW);
// Class-tagged: when the 3D cabinet boots, the sticks become real controls and
// arcade3d.js rewrites this line to say so.
html = edit("cabinet-hint-close", html, NEXT_CELL,
  `<div class="cab-hint" style="${CAPTION};text-align:center">Press a button to load its case notes</div>\n` +
  `        </div>\n\n        ` + NEXT_CELL);

html = edit("cabinet-hint-dedupe", html,
  "Seven of nine titles, with the systems I owned on each. Pick a title on the cabinet to load its case notes.",
  "Seven of nine titles, with the systems I owned on each.");

// ── "Now playing" readout: red with a black outline ──
// It sits directly on top of the gameplay media, so it needs to survive
// whatever is behind it — hence the outline rather than a plain colour swap.
html = edit("cls-now-playing", html,
  `<div style="position:absolute;top:20px;left:26px;display:flex;align-items:center;gap:10px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:oklch(0.8 0.13 320)">`,
  `<div class="now-playing" style="position:absolute;top:20px;left:26px;display:flex;align-items:center;gap:10px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:oklch(0.8 0.13 320)">`);

// ══ TASK 2 — real media in the project slot ═══════════════════════════════
// The export renders {{ active.shot }} as a filename caption over a striped
// placeholder. Once the gameplay stills/GIFs exist in images/, swap in a real
// lazy-loaded <img> under the CRT overlays.
//
// Resolution is per project, not all-or-nothing, so a single delivered file can
// be previewed on its own. Each PROJECTS entry gains two fields:
//   media    resolved path, or "" when nothing was found
//   nofoot   true when there is no media at all
// and the panel carries one <sc-if> for each, so a project with nothing shows
// the "no footage" note instead of a broken image.
//
// gifs/ WINS over images/: drop an animated capture in gifs/ and it overrides
// the still of the same name without touching images/.
//
// Why a build-time gate rather than a client-side one: the runtime turns this
// HTML into React elements, so an inline onerror="" reaches React as a string
// prop and throws (React error #231). An <img> pointing at a missing file would
// just 404 on every project switch with no way to recover.
const MEDIA_EXT = [".gif", ".webp", ".avif", ".png", ".jpg", ".jpeg", ".mp4", ".webm"];
const MEDIA_DIRS = ["gifs", "images"]; // search order — first hit wins
const VIDEO_EXT = [".mp4", ".webm"];   // these render as <video>, not <img>
const norm = (f) => f.toLowerCase().replace(/\.[^.]+$/, "").replace(/[^a-z0-9]/g, "");

// A video's poster sits beside it as "<name>.poster.jpg". It is a companion to
// that file, never a project's media in its own right, so it stays out of the
// pool the matcher searches.
const isPoster = (f) => /\.poster\.[^.]+$/i.test(f);

const listDir = (d) =>
  existsSync(d)
    ? readdirSync(d).filter((f) => MEDIA_EXT.includes(extname(f).toLowerCase()) && !isPoster(f))
    : [];

function resolveMedia(shot) {
  const want = norm(shot);
  for (const dir of MEDIA_DIRS) {
    const pool = listDir(dir);
    // 1. exact filename, 2. same name with a different extension,
    // 3. a single unambiguous prefix match (saniboy.png -> saniboy-gameplay.png)
    let hit = pool.find((f) => f === shot) || pool.find((f) => norm(f) === want);
    let how = hit ? "" : null;
    if (!hit) {
      const near = pool.filter((f) => want.startsWith(norm(f)) || norm(f).startsWith(want));
      if (near.length === 1) { hit = near[0]; how = "  (name differs)"; }
      else if (near.length > 1) return { note: `ambiguous in ${dir}/ (${near.join(", ")}) — rename one` };
    }
    if (hit) {
      const poster = `${dir}/${hit.replace(/\.[^.]+$/, "")}.poster.jpg`;
      return {
        path: `${dir}/${hit}`,
        poster: existsSync(poster) ? poster : "",
        note: `<- ${dir}/${hit}${how || ""}`,
      };
    }
  }
  return { note: "no file — shows the NDA note" };
}

// Anything past this lands in the arcade panel on load, so it is Largest
// Contentful Paint. A 24MB GIF will not score.
const MEDIA_WARN_BYTES = 2 * 1024 * 1024;

const notes = [];
const oversized = [];
let withMedia = 0, withoutMedia = 0;
const mediaFor = new Map();
const posterFor = new Map();

for (const shot of [...html.matchAll(/shot:\s*"([^"]+)"/g)].map((m) => m[1])) {
  const r = resolveMedia(shot);
  mediaFor.set(shot, r.path || "");
  posterFor.set(shot, r.poster || "");
  if (r.path) withMedia++; else withoutMedia++;
  let size = "";
  if (r.path) {
    const bytes = statSync(r.path).size;
    const mb = bytes / 1048576;
    size = `  ${mb < 1 ? (bytes / 1024).toFixed(0) + " KB" : mb.toFixed(1) + " MB"}`;
    if (bytes > MEDIA_WARN_BYTES) { size += "  << TOO BIG"; oversized.push(`${r.path} (${mb.toFixed(1)} MB)`); }
  }
  notes.push(`     ${shot.padEnd(24)} ${r.note}${size}`);
}

// Inject the resolved path (and the no-footage flag) into each PROJECTS entry.
// Which element the panel uses is decided here, not at runtime: a .mp4/.webm
// gets a <video>, everything else an <img>. The panel carries both branches
// behind an sc-if, so each project renders exactly the one it needs.
html = html.replace(/shot:\s*"([^"]+)"/g, (m, f) => {
  const path = mediaFor.get(f) || "";
  const vid = VIDEO_EXT.includes(extname(path).toLowerCase());
  return (
    `${m}, media: ${JSON.stringify(path)}` +
    `, poster: ${JSON.stringify(posterFor.get(f) || "")}` +
    `, vid: ${path && vid ? "true" : "false"}` +
    `, img: ${path && !vid ? "true" : "false"}` +
    `, nofoot: ${path ? "false" : "true"}`
  );
});

const PANEL = '<div style="position:relative;background-color:#17151E;background-image:repeating-linear-gradient(115deg,rgba(240,237,230,0.05) 0 1px,transparent 1px 9px);display:flex;flex-direction:column;justify-content:flex-end;padding:26px;gap:14px;animation:{{ active.anim }} 460ms cubic-bezier(.2,.8,.3,1)">';

// Gameplay capture ships as H.264 rather than GIF: same 640x360 at 10fps, but
// ~1/20th the bytes, and this media is the panel's Largest Contentful Paint.
// The <video> is muted + playsinline so it autoplays everywhere a GIF would
// have, and preload="none" keeps the six inactive panels off the wire until
// the visitor selects them — only the poster frame is fetched up front.
//
// Stills still get an <img>: a project whose media is a .png/.jpg takes the
// second branch, so mixing the two across projects costs nothing.
// The scrim is class-tagged so the 3D cabinet can drop it: once the capture is
// on the tube, the pane it darkened holds nothing but text.
const OVERLAY =
  '              <div class="shot-scrim" style="position:absolute;inset:0;background:linear-gradient(180deg,rgba(14,13,17,0.10),rgba(14,13,17,0.86));pointer-events:none"></div>\n';

html = edit("project-media", html, PANEL, PANEL + "\n" +
  '            <sc-if value="{{ active.vid }}">\n' +
  '              <video class="shot-media" src="{{ active.media }}" poster="{{ active.poster }}" autoplay loop muted playsinline preload="none" tabindex="-1" aria-label="{{ active.title }} — gameplay capture, no audio" width="800" height="500"></video>\n' +
  OVERLAY +
  '            </sc-if>\n' +
  '            <sc-if value="{{ active.img }}">\n' +
  '              <img class="shot-media" src="{{ active.media }}" alt="{{ active.title }} — gameplay" loading="lazy" decoding="async" width="800" height="500">\n' +
  OVERLAY +
  '            </sc-if>\n' +
  '            <sc-if value="{{ active.nofoot }}">\n' +
  '              <div class="no-footage">\n' +
  '                <span class="no-footage-mark">✕</span>\n' +
  '                <span>No footage — NDA restricted</span>\n' +
  '              </div>\n' +
  '            </sc-if>');

mediaNote = [`${withMedia} with media, ${withoutMedia} without:`, ...notes].join("\n");
if (oversized.length) {
  mediaNote += "\n" + [
    "",
    `  WARNING: ${oversized.length} file(s) over 2 MB. This is the arcade panel's`,
    "  LCP media, so page weight and Lighthouse take the hit directly:",
    ...oversized.map((o) => `     ${o}`),
    "  Re-encode to webm/mp4 (~800x500, 12-15fps, 6-10s) — usually 5-10x smaller.",
  ].join("\n");
}

// ══ 3D — the real arcade cabinet ══════════════════════════════════════════
// js/arcade3d.js builds an actual cabinet in Three.js: extruded body, lit
// marquee, a CRT running the project's own capture, two joysticks and six
// buttons that switch titles. It travels with the scroll, from the right of
// the hero, to the centre of the viewport at the work heading, to a docked
// column on the left for the length of the section.
//
// It REPLACES the flat cabinet visually, but not structurally. The markup
// below still renders, and still is the site under any of:
//
//   no JavaScript      the page is prerendered, so the work section is whole
//   no WebGL2          the loader gives up before it imports anything
//   under 360px        nothing at that width is worth the download
//   reduced motion     a cabinet that flies down the page is exactly the
//                      motion that setting exists to refuse
//   Save-Data          750KB of Three.js over a metered connection
//
// So the transforms here only ADD hooks: two classes the module reads the page
// through, and the mount points. Nothing is reshaped and nothing is taken
// away - the machine is an overlay that dissolves, and the panel underneath
// goes on carrying its own capture. Delete js/arcade3d.js and the page is
// what it was.
const A3D_SHELL = '<div data-reveal="1" style="position:relative;border:1px solid rgba(240,237,230,0.16);border-radius:26px 26px 8px 8px;background:linear-gradient(180deg,#1B1822 0%,#141219 46%,#100F14 100%);padding:26px 26px 30px;box-shadow:0 40px 90px rgba(0,0,0,0.55),inset 0 1px 0 rgba(240,237,230,0.09);animation:hum 5.5s ease-in-out infinite">';

// The module needs to know where the work section's cabinet block starts, to
// hang the scroll choreography off it. That is all this class does.
html = edit("a3d-shell", html, A3D_SHELL,
  A3D_SHELL.replace('<div data-reveal="1" style=', '<div data-reveal="1" class="cab-shell" style='));

// The media pane, already carrying the <video>/<img> an earlier transform put
// in it. The module reads that element to know what to copy onto the tube; it
// never touches it, so the pane keeps working whether or not the 3D runs.
html = edit("a3d-media", html, PANEL,
  PANEL.replace("<div style=", '<div class="cab-media" style='));

// The canvas and the capture holder go outside the design's markup entirely,
// so a re-export cannot move them.
// The module URL carries a hash of its own bytes. Without one, a browser with
// no cache headers to go on falls back to heuristic freshness and can serve a
// stale cabinet for minutes after a deploy; GitHub Pages sends no max-age.
const A3D_SRC = "js/arcade3d.js";
if (!existsSync(A3D_SRC)) throw new Error(`arcade3d: ${A3D_SRC} is missing.`);
const A3D_HASH = createHash("sha256").update(readFileSync(A3D_SRC)).digest("hex").slice(0, 8);

const A3D_MOUNT = `
<div id="a3d" aria-hidden="true"><canvas></canvas></div>
<div id="a3d-src" aria-hidden="true"></div>`;

// Capability gate. Every branch that bails leaves the flat cabinet alone, and
// the import is deliberately after load: nothing about the cabinet is allowed
// to compete with first paint.
const A3D_LOADER = `
<script>
(function () {
  // The cabinet has a stacked layout now, so this is a floor rather than a
  // desktop gate: below it there is no arrangement that leaves the case notes
  // readable. 1180 used to live here, which is why most windows saw nothing.
  var OK = "(min-width: 360px)";

  // Every gate below leaves the flat cabinet alone, which is correct but was
  // also completely silent: "why is there no 3D cabinet" had no answer short
  // of reading this file. Each bail now says which gate closed. One line, and
  // only when the cabinet does NOT run.
  function bail(why) {
    if (window.console && console.info) console.info("[arcade3d] not running: " + why);
  }

  if (location.protocol === "file:") return bail(
    "opened from the filesystem. ES modules need an http:// origin - run a " +
    "local server (npm run serve) and open http://localhost:8000 instead."
  );
  if (location.search.indexOf("no3d") > -1) return bail("?no3d is in the URL");
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return bail(
    "the system asks for reduced motion (Windows: Settings > Accessibility > " +
    "Visual effects > Animation effects)"
  );
  // ~750KB of Three.js over a metered connection, for decoration.
  var net = navigator.connection;
  if (net && net.saveData) return bail("the browser is in Save-Data mode");

  // Probing for a context is the only honest test: a browser can advertise
  // WebGL2 and still refuse one on a machine with no usable GPU.
  var probe = document.createElement("canvas").getContext("webgl2");
  if (!probe) return bail("this browser would not give up a WebGL2 context");
  var kill = probe.getExtension("WEBGL_lose_context");
  if (kill) kill.loseContext();

  var live = null, pending = false, warnedNarrow = false;
  function start() {
    if (live || pending) return;
    if (!matchMedia(OK).matches) {
      if (!warnedNarrow) {
        warnedNarrow = true;
        bail("the window is " + innerWidth + "px wide; the cabinet needs 360px");
      }
      return;
    }
    pending = true;
    import("./js/arcade3d.js?v=${A3D_HASH}")
      .then(function (m) { pending = false; live = m.default(); })
      .catch(function (err) { pending = false; bail("the module failed to load - " + err); });
  }
  function stop() { if (live) { live.destroy(); live = null; } }

  if (document.readyState === "complete") setTimeout(start, 150);
  else addEventListener("load", function () { setTimeout(start, 150); });

  addEventListener("resize", function () {
    if (matchMedia(OK).matches) start(); else stop();
  }, { passive: true });
})();
</script>`;

html = edit("a3d-mount", html, "</body>", A3D_MOUNT + A3D_LOADER + "\n</body>");

// ══ TYPOGRAPHY — no em dashes ═════════════════════════════════════════════
// Runs LAST, on the finished document, so every transform above can keep
// matching the bundle's own em-dashed markup verbatim. Anything that ships
// (content, meta, alt text, CSS comments) comes out with plain hyphens.
const emDashes = (html.match(/—/g) || []).length;
if (!emDashes) throw new Error('transform "no-em-dashes": nothing matched. Drop this transform if the source is already clean.');
applied.push(`no-em-dashes(${emDashes})`);
// Deleted outright, not swapped for a hyphen. Surrounding spaces/tabs collapse
// to one space so "Unity Developer — netcode" reads "Unity Developer netcode";
// newlines are left alone so indented markup keeps its shape.
html = html.replace(/[ \t]*—[ \t]*/g, " ");

// ══ PRERENDER — render the template here, ship HTML ═══════════════════════
// Everything above still speaks the export's template language. This stage
// runs it, once, and emits the result. See prerender.mjs for why.
//
// The page's own logic class is the source of truth: it is evaluated in a
// sandbox and asked for its bindings, exactly as the browser would, so the
// rendered output cannot drift from what the design intended.
const templateBlock = findBlock(html, "x-dc");
if (!templateBlock) throw new Error("prerender: no template block in the document.");
const logicMatch = html.match(/<script type="text\/x-dc"[^>]*>([\s\S]*?)<\/script>/);
if (!logicMatch) throw new Error("prerender: no page logic script in the document.");

// Evaluate the logic. componentDidMount touches the DOM and is never called;
// only renderVals() is, which is pure.
const sandbox = { DCLogic: class { constructor(props) { this.props = props || {}; } setState() {} }, console };
runInNewContext(logicMatch[1] + "\n;globalThis.__Component = Component;", sandbox);
const logic = new sandbox.__Component({ revealOnScroll: true });

/** Bindings for the cabinet with project `open` selected. */
function valsFor(open) {
  logic.state = { open, tick: 0 };
  const vals = logic.renderVals();
  // Two extra fields the button markup needs, now that selection is an
  // attribute rather than a set of inlined colours.
  vals.projects = vals.projects.map((p, i) => ({ ...p, index: i, pressed: i === open ? "true" : "false" }));
  return vals;
}

const ctx = createContext();
const projectCount = valsFor(0).projects.length;

// The cabinet screen is the one region that changes when a title is selected.
// Each state is rendered now and parked in an inert <template>; the client
// script clones one in on click. Inert matters: media inside a <template> is
// not fetched, so parking seven panels does not pull seven GIFs.
const screenStart = templateBlock.inner.indexOf('<div class="arcade-screen"');
if (screenStart < 0) throw new Error("prerender: could not find the cabinet screen.");
const screen = findBlock(templateBlock.inner, "div", screenStart);
if (screen.start !== screenStart) throw new Error("prerender: cabinet screen block did not resolve cleanly.");

const panels = [];
for (let i = 0; i < projectCount; i++) {
  panels.push(`<template data-arcade="${i}">${renderTemplate(screen.inner, valsFor(i), ctx)}</template>`);
}

let page = renderTemplate(templateBlock.inner, valsFor(0), ctx);
if (/\{\{|<sc-|sc-camel-/.test(page)) {
  throw new Error("prerender: template constructs survived rendering. " +
    (page.match(/\{\{[^}]*\}\}|<sc-[a-z-]+|sc-camel-[\w-]+/g) || []).slice(0, 5).join(", "));
}

// <helmet> is the export's way of saying "this belongs in <head>".
const helmet = findBlock(page, "helmet");
if (!helmet) throw new Error("prerender: no <helmet> block.");
page = page.slice(0, helmet.start) + page.slice(helmet.end);

const RUNTIME_JS = `
<script>
(function () {
  var screen = document.querySelector(".arcade-screen");
  var buttons = [].slice.call(document.querySelectorAll(".cab-btn"));
  var open = 0;

  var still = matchMedia("(prefers-reduced-motion: reduce)");

  // A looping autoplay capture is exactly the kind of motion this setting is
  // there to stop. The poster frame still shows, so the panel is never empty —
  // it just holds a single frame instead of playing.
  function respectMotion(root) {
    if (!still.matches) return;
    [].slice.call(root.querySelectorAll("video")).forEach(function (v) {
      v.removeAttribute("autoplay");
      v.pause();
    });
  }

  function show(i) {
    var n = buttons.length;
    i = ((i % n) + n) % n;
    var panel = document.querySelector('template[data-arcade="' + i + '"]');
    if (!panel || !screen) return;
    // Replacing the subtree rather than re-pointing the source is what keeps a
    // heavy capture from lingering: the old element is gone, so the browser has
    // nothing stale left to paint while the new one loads. It also replays the
    // boot animation for free, and drops the outgoing <video> so it stops
    // decoding the moment it leaves the screen.
    screen.replaceChildren(panel.content.cloneNode(true));
    respectMotion(screen);
    for (var j = 0; j < n; j++) buttons[j].setAttribute("aria-pressed", j === i ? "true" : "false");
    open = i;
    // The 3D cabinet listens for this: the panel it just cloned in carries the
    // capture, and the tube has to be re-pointed at the new element. Announced
    // rather than called directly so this script stays standalone.
    document.dispatchEvent(new CustomEvent("arcade:change", { detail: { index: i } }));
  }

  // The only handle the 3D cabinet gets on the selection. Its joysticks and
  // buttons drive these buttons, so keyboard and pointer end up in one place
  // and aria-pressed cannot drift from what the tube is showing.
  window.__arcade = {
    show: show,
    count: buttons.length,
    get index() { return open; },
  };

  respectMotion(document);

  buttons.forEach(function (button, i) {
    button.addEventListener("click", function () { show(i); });
  });
  var prev = document.querySelector('[data-nav="prev"]');
  var next = document.querySelector('[data-nav="next"]');
  if (prev) prev.addEventListener("click", function () { show(open - 1); });
  if (next) next.addEventListener("click", function () { show(open + 1); });

  // Reveal on scroll, lifted from the design's own componentDidMount. Guarded
  // so the content is never left invisible if anything here is unavailable.
  var reveal = [].slice.call(document.querySelectorAll("[data-reveal]"));
  if (!reveal.length || !("IntersectionObserver" in window)) return;
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  reveal.forEach(function (node) {
    node.style.opacity = "0";
    node.style.transform = "translateY(16px)";
    node.style.transition = "opacity 640ms cubic-bezier(.22,.61,.36,1), transform 640ms cubic-bezier(.22,.61,.36,1)";
  });
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (!e.isIntersecting) return;
      e.target.style.opacity = "1";
      e.target.style.transform = "none";
      io.unobserve(e.target);
    });
  }, { rootMargin: "0px 0px -8% 0px", threshold: 0.05 });
  reveal.forEach(function (node) { io.observe(node); });
})();
</script>`;

// Swap the template block for the rendered page, hoist the helmet into <head>,
// and add the generated hover/active CSS the template used to carry inline.
const pseudoCss = ctx.css();
html = html.slice(0, templateBlock.start) +
  page + "\n" + panels.join("\n") + RUNTIME_JS +
  html.slice(templateBlock.end);
html = html.replace(/<script type="text\/x-dc"[\s\S]*?<\/script>\n?/, "");
html = html.replace("</head>", helmet.inner + (pseudoCss ? `<style>\n  ${pseudoCss}\n</style>\n` : "") + "</head>");
applied.push(`prerender(${projectCount} panels, ${pseudoCss.split("\n").length} pseudo rules)`);

// ── emit ───────────────────────────────────────────────────────────────────
const banner = "<!-- Generated by build.mjs from bundle/index.bundle.html. Do not edit by hand. -->\n";
html = html.replace("<!DOCTYPE html>", "<!DOCTYPE html>\n" + banner.trim());
writeFileSync(OUT_HTML, html);

const kb = (n) => (n / 1024).toFixed(1) + " KB";
console.log(`${OUT_HTML}   ${kb(Buffer.byteLength(html))}   (bundle was ${kb(bundle.length)})`);
console.log("no runtime, no React: the page ships as HTML.");
console.log(`\n${applied.length} transforms applied:`);
console.log("  " + applied.join(", "));
console.log(`
Task 2: ${mediaNote}`);
