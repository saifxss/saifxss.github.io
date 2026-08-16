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
index.html                 generated, committed — the whole site
```

`build.mjs` unpacks the bundle, applies every fix the raw export lacks —
responsive breakpoints, SEO metadata, accessible contact links, keyboard focus
states — and then **renders the template to finished HTML**. Hand-editing
`index.html` is pointless: the next build overwrites it.

The export is a client-side app: it downloads React and a template runtime,
parses the page out of an `<x-dc>` block and renders it in the browser. That is
not how this site ships. `prerender.mjs` runs the template at build time
against the design's own logic class, so `index.html` is ordinary markup. No
React, no runtime, no `{{ }}` in the served page, and the site reads correctly
with JavaScript switched off. The only script that ships is ~40 lines of
vanilla JS for the cabinet and the scroll reveal.

## Updating the design

1. Export the new bundle from Claude Design.
2. Replace `bundle/index.bundle.html` with it.
3. `npm run build`
4. Commit `index.html` — GitHub Pages serves static files and never runs a
   build.

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

Two folders feed the arcade panel, and **`gifs/` overrides `images/`**:

```
gifs/    animated captures   <- wins
images/  static stills       <- fallback
```

`build.mjs` resolves each project's `shot:` name against both, then prints the
full mapping and the file size on every run:

```
Task 2: 6 with media, 1 without:
     maleficus-arena.png      <- gifs/maleficus.gif  (name differs)  24.2 MB  << TOO BIG
     tikto-king-board.png     <- images/tikto.king-board.jpg  250 KB
     shells-and-tails.png     <- images/shells_and_tails.png  1.6 MB
```

Matching is by name, ignoring extension, case, dots, dashes and underscores —
so `saniboy.png` resolves for `saniboy-gameplay.png`. An ambiguous match is
refused and reported rather than guessed. A project with no file in either
folder renders **"No footage — NDA restricted"** instead of a broken image.

Files over 2 MB are flagged loudly. This media is the arcade panel's Largest
Contentful Paint, so its weight goes straight to the Lighthouse score. Prefer
`.webm`/`.mp4` over `.gif` — usually 5-10x smaller at the same quality — and
target under 1 MB, ~800x500, 12-15 fps, 6-10 second loop.

Resolution is build-time by necessity as well as by choice: the page is
rendered before it ships, so a missing file is caught here rather than 404-ing
in a visitor's browser.

## What build.mjs fixes

| Area | Fix |
|---|---|
| Responsive | Breakpoints at 1024 / 768 / 480px; the export ships none |
| Performance | ~570 KB of inlined woff2 swapped for a Google Fonts link |
| SEO | Title, description, canonical, Open Graph, JSON-LD (export title is "Bundled Page") |
| No-JS | The page is prerendered, so it reads fully with JS off |
| Weight | ~210 KB of React + runtime removed; nothing to download before first paint |
| Contact | Raw address hidden behind an "Email" label; LinkedIn + Resume added; aria-labels |
| A11y | `lang="en"`, `:focus-visible` rings, `prefers-reduced-motion`, 44x44 touch targets |

## Layout

```
bundle/     pristine Claude Design export (build input)
build.mjs   the build
index.html  generated
prerender.mjs  the template renderer used by the build
assets/     portrait.png
gifs/       animated captures (override images/)
images/     static stills
legacy/     archived previous versions of the site
```
