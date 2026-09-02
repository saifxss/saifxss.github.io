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
with JavaScript switched off. The only script in the page itself is ~60 lines
of vanilla JS for the cabinet and the scroll reveal; the 3D cabinet is a
separate module that loads after first paint, and only where it can run at all
(see **The 3D cabinet** below).

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
Task 2: 7 with media, 0 without:
     maleficus-arena.png      <- gifs/maleficus.mp4  (name differs)  1.7 MB
     tikto-king-board.png     <- images/tikto.king-board.jpg  250 KB
     shells-and-tails.png     <- images/shells_and_tails.png  1.6 MB
```

Matching is by name, ignoring extension, case, dots, dashes and underscores —
so `saniboy.png` resolves for `saniboy-gameplay.png`. An ambiguous match is
refused and reported rather than guessed. A project with no file in either
folder renders **"No footage — NDA restricted"** instead of a broken image.

Files over 2 MB are flagged loudly. This media is the arcade panel's Largest
Contentful Paint, so its weight goes straight to the Lighthouse score.

**Ship video, not GIF.** A `.mp4`/`.webm` renders as an autoplaying muted
`<video>` with a poster frame; anything else renders as an `<img>`. The build
chooses the element from the extension, so there is nothing to configure. The
three captures here were GIFs until August 2026:

```
62.6 MB of GIF  ->  2.9 MB of H.264   (same 640x360 at 10 fps)
```

The originals are archived in `legacy/gifs/`. See `gifs/README.md` for the
ffmpeg command and how poster frames work.

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
| 3D | Hooks for the Three.js cabinet: two classes, mount points, hashed module URL |

## The 3D cabinet

`js/arcade3d.js` builds a real arcade cabinet in Three.js and flies it down the
page with the scroll:

```
hero            right of the headline, angled, idling
work section    ZOOMS IN on the screen and the control deck and HOLDS
below that      pulls back small into the bottom-left corner
section end     fades out
```

The zoom is a real dolly-in, not just a bigger cabinet: it frames a **band** of
the machine - from under the deck's front edge to over the top of the monitor
bezel - and lets the marquee and the coin door crop out of frame. `frameBand()`
solves the full cabinet height backwards from how much room that band is
supposed to fill, and places the machine so the BAND's middle sits at the
viewport's middle, which is what stops a zoom from drifting off centre as it
tightens.

Width is a constraint there, not an afterthought. Framed that tightly the band
is wider than a phone, so whichever limit binds first wins: on a 1440x900
desktop the band takes **86% of the viewport height** at 543px wide, and on a
390x844 phone it is width-bound at 367px, which works out at 62% of the height.

Because the zoomed machine is wider than the gap beside the work heading, the
hold is anchored on the **cabinet block** rather than on the section top - it
begins once the heading has scrolled out of frame, instead of fighting it for
the room. The later stops hang off the work section's bottom, because the
cabinet block is only ~820px tall, less than a viewport, and anchoring five
stops to it collapses them into each other.

### It is an overlay. The page underneath does not change.

This is a deliberate reversal of how it used to work. An earlier version
reshaped the flat cabinet under `html.a3d` - hid its marquee, collapsed its
screen to a title card - and MOVED the capture out of the panel and onto the
tube, which was fine while the machine stayed docked beside it for the whole
section. It is not fine now that the machine dissolves partway down: the panel
would be left holding an empty frame the moment it went.

So the tube runs **its own copy** of the capture, and the markup underneath is
untouched. A still costs nothing extra - only the URL is needed - and a video
costs one more decode of a file the browser has already cached, paid only
while the machine is on screen and paused the moment it fades. The build's
transforms now only ADD two classes and the mount points; delete
`js/arcade3d.js` and the page is what it was.

Touch is handled as touch, not as a mouse with a shorter arm. On a coarse
pointer nothing is dragged and nothing calls `preventDefault`, because a
finger landing on a cabinet that fills the screen is usually starting a
scroll: controls are worked by tapping, and a press that travels more than
12px is treated as the scroll it was. The buffer is also capped at 1.4x
device pixels below 860px rather than 1.75x.

The screen runs the selected project's own capture as a texture, under a CRT
shader (barrel glass, aperture grille, a roll on every switch). The two
joysticks and six buttons are live: push a stick left or right, or hit a
button, and the title changes. There is no model file and no image on the wire.
The body is one extruded side profile, and the marquee, side art, control panel
and coin door are drawn into canvases at boot.

What stops it reading as a render pasted onto a page, roughly in order of how
much each one earns:

- **It stands on something.** A drop shadow is useless on a near-black page, so
  the ground is the opposite: the machine lights the floor it stands on, with
  the lit face streaking toward the viewer. A tight dark patch underneath does
  the contact where the page is light enough to show it.
- **The glass has room light on it.** Two soft bands riding on the viewing
  angle, so the highlight slides across the tube as the cabinet turns. Without
  it the screen reads as a hole cut in the bezel.
- **The travel has mass.** The keyframes give a target every frame and the
  cabinet is not snapped to it: an under-damped spring chases it, and rotation
  is chased more softly than position, so the machine swings into place a beat
  behind where it is going.
- **It is never quite still.** The marquee tube stutters the way a fluorescent
  does, and between presses a light runs across the buttons: attract mode.
- **The two control surfaces are one object.** Whether you push a joystick or
  click a title in the button row below, the sticks flick the way the selection
  travelled. Driving the row while the sticks sat still made the cabinet look
  like a screen someone else was operating.

**Nothing here is load-bearing.** The flat cabinet still renders, still holds
its own capture, and is still the accessible control surface: the seven title
buttons are the same real `<button>`s, and the joysticks drive them rather
than bypassing them. Any of these and the visitor simply never sees the
machine, with nothing else different about the page:

| Condition | Why |
|---|---|
| No JavaScript | The page is prerendered; the work section is whole |
| No WebGL2 | The loader probes for a context and gives up if refused |
| `prefers-reduced-motion` | A cabinet flying down the page is exactly that motion |
| Save-Data | ~750 KB of Three.js over a metered connection, for decoration |
| Under 360px | No arrangement leaves the case notes readable |
| `?no3d` in the URL | Escape hatch, for comparing the two |

Crossing that floor either way is handled live: shrink the window past it and
the cabinet tears itself down, hands the capture back to the flat panel and
restores the markup; widen it and it comes back.

**Every gate says which one closed**, once, in the console:

```
[arcade3d] not running: the system asks for reduced motion
[arcade3d] not running: opened from the filesystem. ES modules need an http:// origin
```

They were all silent to begin with, which made "why is there no cabinet" a
question you could only answer by reading the source.

Nothing here touches first paint. The module and Three.js are imported on
`load`, and the module URL carries a hash of its own bytes so a deploy cannot
be served a stale cabinet.

```
js/arcade3d.js               52 KB   (17 KB gzipped)
vendor/three.*.min.js       733 KB  (184 KB gzipped)  pinned three@0.185.1
```

Both vendor files are needed: since r165 `three.module.min.js` imports the bulk
of the library from `three.core.min.js` beside it. To upgrade, replace both
from the same version tag and rerun the build.

## Layout

```
bundle/     pristine Claude Design export (build input)
build.mjs   the build
index.html  generated
prerender.mjs  the template renderer used by the build
assets/     portrait.png
gifs/       animated captures (override images/)
images/     static stills
js/         arcade3d.js, the 3D cabinet (loaded after first paint)
vendor/     pinned Three.js build
legacy/     archived previous versions of the site
```
