# gifs/

Animated gameplay captures. **Anything here overrides the still of the same
name in `images/`.** Drop a file in, run `npm run build`, done.

Name each file after the project's `shot:` value (extension is free — the build
matches on the name, and `.mp4`, `.webm`, `.webp` and `.gif` all work):

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

## Ship video, not GIF

A `.mp4`/`.webm` renders as an autoplaying muted `<video>`; anything else
renders as an `<img>`. The build picks the element, so there is nothing to
configure — just add the right file.

Use video. The three captures here were GIFs until they were re-encoded:

```
maleficus.gif    33.4 MB  ->  maleficus.mp4     1.7 MB
saniboy.gif      21.7 MB  ->  saniboy.mp4       846 KB
alberts_ark.gif   7.5 MB  ->  alberts_ark.mp4   331 KB
                 -------      -----------------------
                  62.6 MB                       2.9 MB
```

Same 640x360 at 10 fps, 95% smaller. The originals are in `legacy/gifs/`.

To re-encode one (needs `ffmpeg`):

```sh
ffmpeg -i clip.gif -c:v libx264 -crf 30 -preset veryslow \
       -pix_fmt yuv420p -movflags +faststart -an clip.mp4
```

## Posters

A file named `<name>.poster.jpg` beside a video is used as its `poster`, and is
the only thing fetched before the visitor selects that project — the video
itself is `preload="none"`. Posters are never matched as a project's media in
their own right, so the name is safe to reuse.

```sh
ffmpeg -i clip.gif -frames:v 1 -q:v 6 clip.poster.jpg
```

## Keep them small

This media is the arcade panel's Largest Contentful Paint, so weight goes
straight to Lighthouse. The build prints every file's size and fails loudly
over 2 MB.

- Target **under 1 MB** each, 2 MB hard ceiling
- ~800x500, 12–15 fps, 6–10 second loop
