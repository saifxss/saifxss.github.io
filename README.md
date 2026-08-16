# saifxss.github.io

Portfolio and resume site for **Saif Chamakhi** — Unity developer.

Live: [saifxss.github.io](https://saifxss.github.io)

## How this repo works

The site is designed in Claude Design, which exports a single self-contained
~900 KB bundle. That export is **an input, not the site**:

```
bundle/index.bundle.html   pristine Claude Design export  <- replace this
        |
        |  node build.mjs
        v
index.html + assets/dc-runtime.js    generated, committed
```

`build.mjs` unpacks the bundle and applies every fix the raw export lacks —
responsive breakpoints, SEO metadata, a noscript fallback, accessible contact
links, keyboard focus states. Hand-editing `index.html` is pointless: the next
build overwrites it.

## Updating the design

1. Export the new bundle from Claude Design.
2. Replace `bundle/index.bundle.html` with it.
3. `npm run build`
4. Commit `index.html` and `assets/dc-runtime.js` — GitHub Pages serves static
   files and never runs a build.

**If a transform fails**, the build stops and names it, e.g.:

```
transform "cls-contact": expected 1 match(es), found 0.
The bundle's markup changed. Update this transform in build.mjs.
```

That is deliberate. A re-export that moves the markup a fix depends on will
fail the build rather than silently ship a regression. Find the new markup in
the export and update that transform's selector.

## Viewing locally

```sh
npm run serve   # http://localhost:8000
```

## Project media

The arcade panel shows each project's `shot:` filename over a striped
placeholder. `build.mjs` wires real `<img>` tags **only when every file exists**
in `images/`, then reports what is missing:

```
Task 2: project media NOT wired — 0/7 files present in images/.
     missing: maleficus-arena.png, tikto-king-board.png, ...
```

Drop the files in and rebuild. They must be named exactly as the `shot:` values.

Note there is no client-side fallback for a missing file: the runtime turns the
HTML into React elements, so an inline `onerror=""` is handed to React as a
string prop and throws. Hence the build-time gate.

Guidance for the media: prefer MP4/WebM over GIF (5–10x smaller at equal
quality), target under 1 MB each, ~800x500, 12–15 fps.

## What build.mjs fixes

| Area | Fix |
|---|---|
| Responsive | Breakpoints at 1024 / 768 / 480px; the export ships none |
| Performance | ~570 KB of inlined woff2 swapped for a Google Fonts link |
| SEO | Title, description, canonical, Open Graph, JSON-LD (export title is "Bundled Page") |
| No-JS | `<noscript>` fallback with the full resume for crawlers |
| Contact | Raw address hidden behind an "Email" label; LinkedIn + Resume added; aria-labels |
| A11y | `lang="en"`, `:focus-visible` rings, `prefers-reduced-motion`, 44x44 touch targets |

## Layout

```
bundle/     pristine Claude Design export (build input)
build.mjs   the build
index.html  generated
assets/     dc-runtime.js (generated), portrait.png, games/
images/     project media (see above)
legacy/     archived previous versions of the site
```
