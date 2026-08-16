# Legacy Portfolio

Previous portfolio version, archived 2026-08-16.
Superseded by the Claude Design build at repo root.
Kept for reference only - not deployed.

## Archived later

`assets/games/` - moved here 2026-08-16. Nine game stills that duplicated
`images/` and were referenced by nothing in the live page. `build.mjs` only
resolves project media from `gifs/` and `images/`, in that order, so this
directory could never have been read.

`images/daqueen.png`, `images/slash_and_dash.png` - moved here 2026-08-16.
DaQueen and Slash And Dash are named in the "Earlier titles" line but have no
showcase slot, so nothing ever resolved these two files. The rest of `images/`
stays put: several stills are shadowed by an animated capture of the same name
in `gifs/`, and they are the fallback if that GIF is ever pulled.
