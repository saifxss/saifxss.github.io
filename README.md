# saifxss.github.io

Personal portfolio and resume site for Saif Chamakhi — Unity game developer.

## Stack

- React 18 + Babel standalone (no build step, in-browser JSX transpile)
- Geist + JetBrains Mono via Google Fonts
- Vanilla CSS with a theme/accent system (dark-warm, dark-cool, paper)

## Structure

```
index.html          # Entry point — all src/ files are inlined here as <script type="text/babel">
src/
  data.jsx          # All content: projects, experience, skills, etc.
  app.jsx           # Main app, all section components, hero animation
  tweaks.jsx        # Floating tweaks panel (theme/accent switcher)
  bootscreen.jsx    # Arcade-style boot screen
  minimax.jsx       # Ultimate Tic-Tac-Toe with minimax + α-β pruning
  arcade.jsx        # 3D CSS arcade cabinet
  casestudy.jsx     # Full-screen case study modal
assets/
  games/            # Game screenshots
  portrait.png
```

## Editing

Edit files in `src/` directly, then copy the updated content into the matching `<script type="text/babel">` block in `index.html`. No build or install required.

## Live site

[saifxss.github.io](https://saifxss.github.io)

