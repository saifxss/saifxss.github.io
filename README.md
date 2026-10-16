# Saif Chamakhi's portfolio

A static portfolio for Unity gameplay and UI engineering, with an optional interactive 3D arcade.

## Develop

Node.js 20 or newer is enough to build and serve the website:

```sh
npm run build
npm run serve
# Default portfolio: http://localhost:8000/
# 3D arcade: http://localhost:8000/arcade.html
```

Set `PORT` to use another local port. GitHub Pages publishes the committed static files from `main`; building alone does not publish.

## Content and source

- `data/portfolio.json` is the single source of truth for profile details, projects, release status, experience, tools, skills, education, languages, and the curated one-page résumé (`resume`).
- `render-portfolio.mjs` renders the semantic normal portfolio and project case studies.
- `build.mjs` validates content and local media, generates both presentations, seven project URLs, and the sitemap.
- `css/classic.css` and `js/experience.js` provide the normal presentation, mobile menu, media controls, project history, and copy links.
- `templates/arcade.html`, `css/machine.css`, and `js/machine-ui.js` build the accessible HTML screen and physical control board.
- `js/machine-scene.js` provides the procedural Three.js cabinet, room, rotation, projection, and rendering lifecycle. Vendor modules are pinned to r185.
- `tools/build_resume.py` creates the public, text-selectable résumé from the same content using Python and ReportLab. Run `python tools/build_resume.py` after changing résumé content. It writes the application copy to `output/pdf/` and the identical website download to `assets/`.
- `index.html`, `arcade.html`, `projects/*/index.html`, `classic.html`, `preview.html`, and `sitemap.xml` are generated. Do not edit these outputs directly.
- `classic.html` preserves older normal-version links; `preview.html` preserves the arcade preview. Both use production canonical URLs and are excluded from indexing.
- `bundle/`, `prerender.mjs`, `build-experiences.mjs`, and `js/arcade3d.js` are retained historical sources. The active build no longer imports them or parses the original design export.

Only The Amazing SaniBoy and Albert's Ark Idle are labelled publicly released, as confirmed by the portfolio owner. Other statuses distinguish completed work awaiting release, playtested prototypes, and unreleased studio projects. The two selected public releases are separate from the 20+ legacy titles restored and republished at StolenPad. Download/rating milestones describe SaniBoy, rather than claiming sole credit for a team's commercial outcome. The latest résumé documents game development since 2019 and professional studio work since 2023.

## Design direction

The normal presentation uses graphite (`#0d1117`), slate surfaces (`#141a23` / `#1b2430`), warm ivory text (`#f2f0e9`), and amber actions (`#edbd72`). Ice blue (`#9fc4da`) supports technical labels; green (`#a4c9aa`) accompanies written release status. Information is never communicated by color alone.

Project footage supplies the rich color. Typography, fine borders, deliberate spacing, and readable 16px case-study copy establish the visual hierarchy. Mobile uses a visible native project selector and large primary actions. All seven cases have shareable static URLs, such as `/projects/the-amazing-saniboy/#work`. Reload, back/forward, keyboard selection, and copy links preserve the chosen project. Case content is rendered before JavaScript, and the no-script view exposes the remaining projects.

The homepage shows concise project summaries, role highlights, and the core toolkit. Native disclosure controls expose detailed role responsibilities and the full skills list. Project selection on the overview uses `/?project=project-slug#work`; the full case-study link opens a focused page with the challenge, contribution, and outcome. Case pages do not repeat the homepage hero, experience, and toolkit. Arcade content follows the same hierarchy, with all details still available on the machine.

## Arcade controls and performance

Drag the room or cabinet to rotate 360°, or use the keyboard-accessible rotation buttons. Reset restores the front angle. Opening a section returns the cabinet to a readable front view; a drag cannot activate the screen. The rear hides the projected HTML rather than showing it through the cabinet.

The joystick browses projects. Labelled buttons open Profile, Work, Experience, Toolkit, Contact, and the résumé. Screen content scrolls independently while the board remains accessible. Project links use `/arcade.html#work/project-slug` and preserve query parameters. Mobile uses a native project selector; short landscape screens reserve space for reading.

The renderer runs on demand. WebGL DPR is capped at 1.25 on touch and 1.5 on desktop, with a 2.6-million-pixel buffer ceiling and adaptive quality. Text is native-resolution HTML. Background tabs pause rendering and video; reduced motion stops automatic media playback and camera animation. Save-Data skips 3D. Missing WebGL, a scene-module failure, or context loss retains a static, usable HTML screen and board. Neither the normal homepage nor its case pages load Three.js.

## Verify

Browser checks need Playwright and Chromium:

```sh
npm install
npx playwright install chromium
npm run serve
# In another terminal:
npm test
npm run test:polish
```

The suites check normal and arcade layouts from 320 to 2560px, the confirmed release counts, all seven case studies, static project routes/reload/history, keyboard and mobile menus, project selectors, résumé delivery, clipboard sharing, native board target sizes, mouse/touch rotation, orientation changes, WebGL context loss, Save-Data, missing modules, and no-JavaScript content. Screenshots go into ignored `test-results/`; uncaught browser errors fail the suites.

Optional environment variables: `PORTFOLIO_URL`, `PLAYWRIGHT_BROWSER_PATH`, and `PLAYWRIGHT_MODULE_PATH`. Device checks use browser emulation; physical iOS/Android GPU performance remains a device-specific check.
