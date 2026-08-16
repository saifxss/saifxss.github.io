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

const BUNDLE = "bundle/index.bundle.html";
const OUT_HTML = "index.html";
const OUT_RUNTIME = "assets/dc-runtime.js";

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

mkdirSync("assets", { recursive: true });
writeFileSync(OUT_RUNTIME, runtime);

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
  /* ── Task 1: kill horizontal scroll ── */
  html, body { max-width: 100%; overflow-x: hidden; }
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

  /* ── ≤1024px — tablet ── */
  @media (max-width: 1024px) {
    .stat-band { grid-template-columns: repeat(2, 1fr) !important; }
    .stack-grid { grid-template-columns: repeat(2, 1fr) !important; }
    .arcade { transform: none !important; }
    .arcade-screen { grid-template-columns: 1fr !important; }
    .contact { grid-template-columns: 1fr !important; gap: 44px !important; }
    .roles { grid-template-columns: 1fr !important; gap: 18px !important; }
  }

  /* ── ≤768px — mobile ── */
  @media (max-width: 768px) {
    section, .pad-x { padding-left: 20px !important; padding-right: 20px !important; }
    .hero, .stat-band, .work-grid, .roles, .stack-grid, .contact,
    .arcade-screen, .arcade-controls {
      grid-template-columns: 1fr !important;
    }
    .stat-band { gap: 24px !important; text-align: left !important; padding: 28px 20px !important; }
    .stat-band > * { border-left: 0 !important; padding-left: 0 !important; }
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

// nav + footer rows
html = edit("cls-nav-bar", html,
  '<div style="max-width:1320px;margin:0 auto;padding:0 44px;height:62px;display:flex;align-items:center;justify-content:space-between;gap:24px">',
  '<div class="site-nav pad-x" style="max-width:1320px;margin:0 auto;padding:0 44px;height:62px;display:flex;align-items:center;justify-content:space-between;gap:24px">');
html = edit("cls-nav", html,
  '<div style="display:flex;align-items:center;gap:26px;font-size:11px;font-weight:500;letter-spacing:0.16em;text-transform:uppercase;color:rgba(240,237,230,0.62)">',
  '<div class="nav-links" style="display:flex;align-items:center;gap:26px;font-size:11px;font-weight:500;letter-spacing:0.16em;text-transform:uppercase;color:rgba(240,237,230,0.62)">');
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

html = edit("project-media", html, PANEL, PANEL + "\n" +
  '            <sc-if value="{{ active.media }}">\n' +
  '              <img class="shot-media" src="{{ active.media }}" alt="{{ active.title }} — gameplay" loading="lazy" decoding="async" width="800" height="500">\n' +
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

// ══ TASK 4 — noscript fallback ════════════════════════════════════════════
const NOSCRIPT = `
<noscript>
  <div style="max-width:800px;margin:0 auto;padding:60px 24px;font-family:'Libre Franklin',Helvetica,Arial,sans-serif;line-height:1.6;color:#F0EDE6">
    <h1>Saif Chamakhi</h1>
    <p><strong>Unity Developer</strong> — gameplay systems, UI architecture, netcode</p>
    <p>Five years and nine shipped commercial titles across Steam, Google Play, and WebGL — including a mobile release past 100,000 downloads at 4.7 stars. I turn tightly coupled prototypes into modular systems a team can extend without breaking them.</p>
    <p>Open to full-time and contract work. Tunis, Tunisia · Remote EU/GMT.</p>

    <h2>Selected work</h2>
    <ul>
      <li><strong>Maleficus</strong> (2025, PC) — multiplayer arena spell game; event-driven refactor, strict UI/gameplay separation.</li>
      <li><strong>Tikto King</strong> (2025, Mobile) — multi-game platform; Minimax + alpha-beta AI.</li>
      <li><strong>Super One</strong> (2025, Mobile) — shop, profile, quest and settings systems on ScriptableObjects.</li>
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
</noscript>
`;
html = edit("noscript", html, "<body>", "<body>" + NOSCRIPT);

// ── emit ───────────────────────────────────────────────────────────────────
const banner = "<!-- Generated by build.mjs from bundle/index.bundle.html — do not edit by hand. -->\n";
html = html.replace("<!DOCTYPE html>", "<!DOCTYPE html>\n" + banner.trim());
writeFileSync(OUT_HTML, html);

const kb = (n) => (n / 1024).toFixed(1) + " KB";
console.log(`${OUT_HTML}      ${kb(Buffer.byteLength(html))}   (bundle was ${kb(bundle.length)})`);
console.log(`${OUT_RUNTIME}  ${kb(runtime.length)}`);
console.log(`\n${applied.length} transforms applied:`);
console.log("  " + applied.join(", "));
console.log(`
Task 2: ${mediaNote}`);
