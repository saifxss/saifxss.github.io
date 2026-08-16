# gifs/

Animated gameplay captures. **Anything here overrides the still of the same
name in `images/`.** Drop a file in, run `npm run build`, done.

Name each file after the project's `shot:` value (extension is free — the build
matches on the name, and `.gif`, `.webp`, `.mp4` and `.webm` all work):

| Project | Name it |
|---|---|
| Maleficus | `maleficus-arena` |
| Tikto King | `tikto-king-board` |
| The Amazing SaniBoy | `saniboy-gameplay` |
| Draft Fever Bowl | `draft-fever-bowl-ui` |
| The Plooshies | `plooshies-party` |
| Shells And Tails | `shells-and-tails` |
| Albert's Ark Idle | `alberts-ark-idle` |

A project with no file in either folder shows "No footage — NDA restricted"
instead.

## Keep them small

These load in the arcade panel, so weight goes straight to Lighthouse.

- Target **under 1 MB** each, 2 MB hard ceiling
- ~800x500, 12–15 fps, 6–10 second loop
- Prefer **`.webm` or `.mp4` over `.gif`** — typically 5–10x smaller at the
  same quality
