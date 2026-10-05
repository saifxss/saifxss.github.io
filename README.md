# Saif Chamakhi's portfolio

Two complete presentations of the same portfolio:

- **Normal portfolio** (`index.html`, the default homepage): a refined version of the main-branch design, with a focused introduction, featured project, résumé shortcut, mobile navigation, and case-study browser.
- **3D arcade** (`arcade.html`): an interactive Three.js cabinet. Profile, seven projects, experience, toolkit, contact information, education, languages, and résumé access live inside its screen. A visible link switches between versions.

## Develop

Requires Node.js 20 or newer. Building and serving need no dependencies.

```sh
npm run build
npm run serve
# Normal: http://localhost:8000/
# Arcade: http://localhost:8000/arcade.html
```

GitHub Pages publishes the committed static files on `main`. Building generates local files; publish a reviewed build by pushing it to `main`.

## Source and generated files

- `bundle/index.bundle.html`: original design export and portfolio content.
- `build.mjs`, `prerender.mjs`: asserted export transforms, media resolution, and static rendering.
- `build-experiences.mjs`: derives both presentations from the shared content.
- `templates/arcade.html`, `css/machine.css`: arcade shell and responsive screen layouts.
- `js/machine-ui.js`: sections, projects, accessible DOM controls, video playback, and fallback.
- `js/machine-scene.js`: cabinet geometry, materials, camera, screen projection, physical controls, and GPU lifecycle.
- `css/classic.css`, `js/experience.js`: normal-version presentation and controls.
- `index.html`, `arcade.html`, `preview.html`, `classic.html`: generated output committed for GitHub Pages. Do not hand-edit these files. `classic.html` preserves old normal-version links; `preview.html` duplicates the arcade. Both compatibility copies are excluded from indexing and use the production canonical URLs.
- `js/arcade3d.js`: preserved earlier prototype; neither current presentation imports it.
- `serve.mjs`: local HTTP server with video range-request support.
- `legacy/`: archived previous site, excluded from indexing.

Run the build after editing source. CSS and JavaScript entry points use content hashes. No React or client-side template runtime is shipped. Fonts are optional, with system fallbacks.

## The arcade experience

Click or tap the screen to browse selected work. A colourful 90s arcade room surrounds a bevelled cabinet with cyan sides, pink trim, a striped marquee, and a yellow control deck. The camera frames both the CRT and the whole control board; the screen adapts to a readable portrait shape on phones. Both surfaces contain real HTML projected onto the cabinet, so text, links, scrolling, video, and keyboard navigation work normally.

Drag the cabinet or room with a mouse or one finger to rotate through 360°. The rotation toolbar provides keyboard-accessible 45° steps and a reset view. A drag does not activate the screen. Screen and board content hide behind the cabinet at rear angles, and opening a portfolio section returns the cabinet to the front for reading. Rotation renders only while the view changes and honours reduced motion.

The joystick and arrow buttons browse all seven projects. Six labelled control-board buttons open Profile, Work, Experience, Toolkit, Contact, and the résumé. These native buttons support mouse, touch, keyboard focus, and activation. The board stays visible while screen content scrolls, and a footer hint indicates additional content below. On short landscape screens, the board provides section navigation to preserve reading space. On-screen project selectors support Left/Right and Home/End. Escape or **Cabinet** returns to the overview. Direct section links work, for example `/arcade.html#work` or `/arcade.html#contact`. `/arcade.html?no3d` redirects to the normal version.

Reduced motion removes camera animation and automatic video playback. Save-Data skips the 3D download. Unsupported WebGL2, a failed scene module, or WebGL context loss produces a static cabinet that retains all screen content. The normal version also works without JavaScript and exposes all project case notes.

The renderer runs on demand, stopping when the camera settles. Device pixel ratio is capped at 1.25 for touch and 1.5 for desktop, with a 2.6-million-pixel ceiling on the WebGL buffer and a lower resolution after sustained slow frames. Text and controls remain native-resolution HTML. Section changes do not resize the WebGL buffer. Touch transitions are capped at 30fps. Background tabs pause rendering and video. Videos render directly in the screen's HTML instead of using a second decoder for a texture. Scene teardown releases geometry, materials, textures, event listeners, and animation callbacks.

The cabinet uses procedural geometry, canvas artwork, and local Three.js modules; no external model or CDN is required. Vendor Three.js files are pinned together at r185.

## Project media

`gifs/` takes precedence over `images/`. Matching ignores extensions, punctuation, and case; ambiguous matches fail. MP4/WebM files use optional `.poster.jpg` frames, other files render as stills, and missing footage uses an NDA placeholder. Files over 2 MB produce build warnings. Original GIF captures are archived under `legacy/gifs/`; see `gifs/README.md` for encoding instructions.

## Verification

Browser checks require Playwright and Chromium:

```sh
npm install
npx playwright install chromium
npm run serve
# In another terminal:
npm test
npm run test:polish
```

The suite checks both versions at 320–2560px, portrait and short landscape screens, all seven project case notes, native control-board targets, keyboard focus, high-DPI touch, live orientation changes, reduced motion, context loss, Save-Data, unavailable WebGL, module failure, and JavaScript-disabled normal content. It verifies that the board remains below the screen, every control stays inside the viewport, and control targets meet a 44px size with a 1px projection tolerance. Screenshots go to ignored `test-results/`; uncaught browser errors fail the suite.

The polish checks exercise mouse and touch rotation, back-face hiding, reset, keyboard rotation, automatic front framing, mobile menus, and normal-project selection across narrow and desktop layouts.

Optional environment variables: `PORTFOLIO_URL`, `PLAYWRIGHT_BROWSER_PATH`, and `PLAYWRIGHT_MODULE_PATH`. Mobile checks use browser emulation; physical iOS/Android GPU performance requires a device check.
