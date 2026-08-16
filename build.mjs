// build.mjs — turns the Claude Design export into the deployable site.
//
//   bundle/index.bundle.html   (pristine export — the only file you replace)
//        |
//        v  node build.mjs
//   index.html + assets/dc-runtime.js   (generated, committed for GitHub Pages)
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

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, statSync } from "node:fs";
import { extname } from "node:path";
import { gunzipSync } from "node:zlib";
import { createHash } from "node:crypto";

const BUNDLE = "bundle/index.bundle.html";
const OUT_HTML = "index.html";
const OUT_RUNTIME = "assets/dc-runtime.js";
const VENDOR = "assets/vendor";

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

const manifest = grab("manifest");
let html = grab("template");

// The runtime is the only manifest entry we still need as a file: fonts get
// replaced by a Google Fonts link below, and React/ReactDOM the runtime fetches
// from unpkg itself.
const runtimeUuid = (html.match(/<script src="([0-9a-f-]{36})"><\/script>/) || [])[1];
if (!runtimeUuid || !manifest[runtimeUuid]) throw new Error("could not locate the dc-runtime entry");
const entry = manifest[runtimeUuid];
let runtime = Buffer.from(entry.data, "base64");
if (entry.compressed) runtime = gunzipSync(runtime);

// ══ RESILIENCE — self-host React instead of fetching it from unpkg ════════
// The runtime renders NOTHING until React and ReactDOM arrive, and it pulls
// both from unpkg at page load. One CDN outage, one blocked third-party
// request (corporate proxy, tracking blocker, offline visitor) and the page
// paints empty. Both UMD builds now ship from assets/vendor/ instead.
//
// The SRI hash goes with them, and that is deliberate. The runtime sets
// crossOrigin="anonymous" on any script carrying an integrity attribute
// (loadScript, dc-runtime.js), which turns a plain same-origin <script> into a
// CORS request. Over file:// — opening index.html directly, or an IDE preview
// — the origin is "null", the check can never pass, and React silently never
// loads. SRI exists to catch a THIRD PARTY serving something else; these files
// ship from this repo, so there is no third party left to distrust.
//
// The guarantee moves to build time instead: the hash the runtime pinned is
// verified against the bytes on disk here, every build, and the build fails if
// they ever drift. Same protection, checked earlier, no CORS.
//
// @babel/standalone is deliberately left on unpkg: it is only fetched for
// <x-import> of JSX modules, which this page does not use, so vendoring 3 MB
// for a code path that never runs would be dead weight.
let runtimeSrc = runtime.toString("utf8");
mkdirSync("assets", { recursive: true });

for (const [pkg, sriVar, remote] of [
  ["react", "REACT_SRI", "https://unpkg.com/react@18.3.1/umd/react.production.min.js"],
  ["react-dom", "REACT_DOM_SRI", "https://unpkg.com/react-dom@18.3.1/umd/react-dom.production.min.js"],
]) {
  const local = `${VENDOR}/${remote.split("/").pop()}`;
  if (!existsSync(local)) {
    throw new Error(
      `transform "vendor-${pkg}": ${local} is missing.\n` +
      `Download it from ${remote} — the build verifies its hash against the runtime's pin.`
    );
  }

  const pinned = new RegExp(`var ${sriVar} = "(sha384-[^"]+)";`).exec(runtimeSrc)?.[1];
  if (!pinned) throw new Error(`transform "vendor-${pkg}": could not read ${sriVar} from the runtime.`);
  const actual = "sha384-" + createHash("sha384").update(readFileSync(local)).digest("base64");
  if (actual !== pinned) {
    throw new Error(
      `transform "vendor-${pkg}": ${local} does not match the version the runtime pins.\n` +
      `  runtime ${sriVar}: ${pinned}\n  ${local}: ${actual}\n` +
      `Re-download it from ${remote}.`
    );
  }

  runtimeSrc = edit(`vendor-${pkg}`, runtimeSrc, `"${remote}"`, `"${local}"`);
  // Drop the integrity pin so the tag loads as a same-origin script, not CORS.
  runtimeSrc = edit(`vendor-${pkg}-sri`, runtimeSrc, `var ${sriVar} = "${pinned}";`, `var ${sriVar} = "";`);
}

writeFileSync(OUT_RUNTIME, runtimeSrc);

// ══ TASK 5 — <html lang> ═══════════════════════════════════════════════════
html = edit("lang", html, "<html><head>", '<html lang="en"><head>');

// ── runtime now loads from disk instead of a manifest uuid ─────────────────
html = edit("runtime-src", html,
  `<script src="${runtimeUuid}"></script>`,
  `<script src="${OUT_RUNTIME}"></script>`);

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
<!-- The <x-dc> block below is a CLIENT-SIDE TEMPLATE: dc-runtime parses it and
     replaces it with the rendered page. Until that happens its raw {{ }}
     expressions are literal text. dc-runtime hides it itself on first line of
     execution, but that is no use if the runtime is the thing that failed to
     load, so the same rule is stated here inline, where nothing can stop it.
     The load-guard in the body reveals the static resume if the render never
     lands, so hiding this can never leave a blank page. -->
<style>x-dc{display:none!important}</style>
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
  /* ── Undo the runtime's preview-frame sizing ──
     dc-runtime injects  html,body{height:100%}  and  #dc-root{height:100%}
     so the app fills Claude Design's preview iframe. On a standalone page that
     pins the document to the viewport height, so the DOCUMENT never scrolls and
     the BODY scrolls internally instead — which breaks position:sticky, anchor
     links, scroll restoration and every scroll-driven measurement. */
  html, body { height: auto !important; min-height: 100% !important; }
  #dc-root, #dc-root > .sc-host { height: auto !important; min-height: 100% !important; }

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
html = edit("cabinet-hint-close", html, NEXT_CELL,
  `<div style="${CAPTION};text-align:center">Press a button to load its case notes</div>\n` +
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
const norm = (f) => f.toLowerCase().replace(/\.[^.]+$/, "").replace(/[^a-z0-9]/g, "");

const listDir = (d) =>
  existsSync(d) ? readdirSync(d).filter((f) => MEDIA_EXT.includes(extname(f).toLowerCase())) : [];

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
    if (hit) return { path: `${dir}/${hit}`, note: `<- ${dir}/${hit}${how || ""}` };
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

for (const shot of [...html.matchAll(/shot:\s*"([^"]+)"/g)].map((m) => m[1])) {
  const r = resolveMedia(shot);
  mediaFor.set(shot, r.path || "");
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
html = html.replace(/shot:\s*"([^"]+)"/g, (m, f) => {
  const path = mediaFor.get(f) || "";
  return `${m}, media: ${JSON.stringify(path)}, nofoot: ${path ? "false" : "true"}`;
});

const PANEL = '<div style="position:relative;background-color:#17151E;background-image:repeating-linear-gradient(115deg,rgba(240,237,230,0.05) 0 1px,transparent 1px 9px);display:flex;flex-direction:column;justify-content:flex-end;padding:26px;gap:14px;animation:{{ active.anim }} 460ms cubic-bezier(.2,.8,.3,1)">';

// key="{{ active.media }}" is load-bearing, not decoration. Without it React
// keeps the same <img> node across a project switch and only swaps its src —
// and a browser goes on painting the OLD image until the new one has decoded.
// With multi-megabyte GIFs that is seconds of the previous game's footage
// sitting under the new title, and spamming the buttons made it permanent.
// A changing key remounts the element, so the panel falls back to its striped
// background until the real media arrives and can never show the wrong game.
// (The lasting cure is re-encoding those 20-30 MB GIFs the build warns about;
// this makes the wait honest rather than wrong.)
html = edit("project-media", html, PANEL, PANEL + "\n" +
  '            <sc-if value="{{ active.media }}">\n' +
  '              <img class="shot-media" key="{{ active.media }}" src="{{ active.media }}" alt="{{ active.title }} — gameplay" loading="lazy" decoding="async" width="800" height="500">\n' +
  '              <div style="position:absolute;inset:0;background:linear-gradient(180deg,rgba(14,13,17,0.10),rgba(14,13,17,0.86));pointer-events:none"></div>\n' +
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

// ══ TASK 4 — static fallback résumé ═══════════════════════════════════════
// This used to be a plain <noscript> block, which only covers one of the two
// ways a visitor ends up with no page: JavaScript switched off. The other way
// is JavaScript switched ON but the render never landing (dc-runtime blocked,
// React unreachable, a throw mid-boot). <noscript> does nothing there.
//
// So the résumé is now always in the DOM, hidden, and revealed by whichever
// signal fires:
//   JS off            -> the <noscript> stylesheet below unhides it
//   JS on, no render  -> the load-guard script unhides it and drops <x-dc>
//   JS on, rendered   -> nothing fires, it stays hidden
// The visitor always gets real content, and never raw {{ }} markup.
const FALLBACK = `
<div id="static-resume" hidden>
  <div style="max-width:800px;margin:0 auto;padding:60px 24px;font-family:'Libre Franklin',Helvetica,Arial,sans-serif;line-height:1.6;color:#F0EDE6">
    <h1>Saif Chamakhi</h1>
    <p><strong>Unity Developer</strong> — gameplay systems, UI architecture, netcode</p>
    <p>Five years and nine shipped commercial titles across Steam, Google Play, and WebGL — including a mobile release past 100,000 downloads at 4.7 stars. I turn tightly coupled prototypes into modular systems a team can extend without breaking them.</p>
    <p>Open to full-time and contract work. Tunis, Tunisia · Remote EU/GMT.</p>

    <h2>Selected work</h2>
    <ul>
      <li><strong>Maleficus</strong> (2025, PC) — multiplayer arena spell game; event-driven refactor, strict UI/gameplay separation.</li>
      <li><strong>Tikto King</strong> (2025, Mobile) — multi-game platform; Minimax + alpha-beta AI.</li>
      <li><strong>Shells And Tails</strong> (2022, PC) — four-player split-screen showdown; per-mini-game rule sets, split-screen camera and local input.</li>
      <li><strong>Draft Fever Bowl</strong> (2024, Steam) — owned the UI layer, responsive popup framework reused team-wide.</li>
      <li><strong>The Plooshies</strong> (2024, WebGL) — Photon Fusion multiplayer, WebGL performance.</li>
      <li><strong>Albert's Ark Idle</strong> (2024, Steam) — progression systems and early UI through to release.</li>
      <li><strong>The Amazing SaniBoy</strong> (2023, Google Play) — 100,000+ downloads at 4.7 stars.</li>
    </ul>

    <h2>Experience</h2>
    <h3>StolenPad — Unity Developer (2026 – Present)</h3>
    <p>5+ hypercasual prototypes from concept to playable build; restored and republished a 20+ title back catalogue; cut web and mobile build sizes with compression, profiling and Addressables.</p>
    <h3>BNJMO — Unity Developer (Feb 2025 – Feb 2026)</h3>
    <p>Authored the studio's shared framework (audio, announcements, event layer, UI transitions), distributed via Git submodules and reused across Tikto King, Maleficus and client projects.</p>
    <h3>Blue Gravity Studios — Game Developer (Nov 2023 – Sep 2024)</h3>
    <p>Owned the UI layer on Draft Fever Bowl in a 20+ person Steam production; Photon Fusion integration and WebGL optimisation on The Plooshies.</p>
    <h3>READY TO TEK — Game Developer (Feb 2023 – Nov 2023)</h3>
    <p>Shipped The Amazing SaniBoy to Google Play; JSON-encrypted store, Google Play services, ads and leaderboards.</p>

    <h2>Stack</h2>
    <ul>
      <li><strong>Engines &amp; languages</strong> — Unity 3D/2D, Unity 6, C#, .NET, C++</li>
      <li><strong>Multiplayer &amp; netcode</strong> — Photon Fusion, Photon Quantum, client/server sync, state synchronisation</li>
      <li><strong>Gameplay &amp; AI</strong> — gameplay systems, Minimax / alpha-beta, Animator, VFX/SFX, physics</li>
      <li><strong>UI systems</strong> — Unity UI / Canvas, responsive layouts, reusable components, UI/gameplay separation</li>
      <li><strong>Architecture</strong> — OOP, SOLID, event-driven, ScriptableObjects, state machines, modular frameworks</li>
      <li><strong>Performance &amp; tooling</strong> — Unity Profiler, texture compression, Addressables, build size &amp; memory, editor tooling</li>
      <li><strong>Platforms</strong> — Android, iOS, Google Play, Steam, WebGL, REST APIs, JSON, ad networks</li>
      <li><strong>Workflow</strong> — Git / GitHub / GitLab, Agile (Scrum/Kanban), Jira, Notion</li>
    </ul>

    <h2>Education</h2>
    <p>Bachelor's in Video Game Development — ISAMM, Manouba (2019–2022)</p>
    <p>Languages: Arabic (native), English (professional), French (fluent)</p>

    <h2>Contact</h2>
    <p>
      <a href="mailto:${EMAIL}" style="color:#F0EDE6">Email</a> ·
      <a href="${LINKEDIN}" style="color:#F0EDE6">LinkedIn</a> ·
      <a href="${GITHUB}" style="color:#F0EDE6">GitHub</a> ·
      <a href="${RESUME}" target="_blank" rel="noopener" style="color:#F0EDE6">Resume</a>
    </p>
    <p>Phone: +216 52 099 160</p>
  </div>
</div>
<noscript><style>#static-resume{display:block!important}</style></noscript>
<script>
(function () {
  // Has dc-runtime replaced <x-dc> with a rendered #dc-root yet?
  function rendered() {
    var root = document.getElementById("dc-root");
    return !!(root && root.firstElementChild);
  }
  function check() {
    if (rendered()) return;
    var dc = document.querySelector("x-dc");
    if (dc) dc.remove();
    var fallback = document.getElementById("static-resume");
    if (fallback) fallback.hidden = false;
  }
  // Two triggers, because neither alone is reliable: "load" waits for the
  // gameplay media (slow, and it never fires if a request hangs), while a bare
  // timer can outrun React on a cold connection. Whichever lands first wins,
  // and check() is a no-op once the page has rendered.
  setTimeout(check, 8000);
  addEventListener("load", function () { setTimeout(check, 2000); });
})();
</script>
`;
html = edit("static-fallback", html, "<body>", "<body>" + FALLBACK);

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

// ── emit ───────────────────────────────────────────────────────────────────
const banner = "<!-- Generated by build.mjs from bundle/index.bundle.html. Do not edit by hand. -->\n";
html = html.replace("<!DOCTYPE html>", "<!DOCTYPE html>\n" + banner.trim());
writeFileSync(OUT_HTML, html);

const kb = (n) => (n / 1024).toFixed(1) + " KB";
console.log(`${OUT_HTML}      ${kb(Buffer.byteLength(html))}   (bundle was ${kb(bundle.length)})`);
console.log(`${OUT_RUNTIME}  ${kb(Buffer.byteLength(runtimeSrc))}`);
console.log(`\n${applied.length} transforms applied:`);
console.log("  " + applied.join(", "));
console.log(`
Task 2: ${mediaNote}`);
