# Soha Haldikar · portfolio

An interactive personal portfolio with a calm "Downstream" theme: the page opens on a koi pond and flows down through projects, research, programs and leadership into a cozy "riverside room".

## Run it locally

No build step. Serve the folder with any static server:

```sh
python3 -m http.server 8000
# then open http://localhost:8000
```

(Opening `index.html` directly won't work because the scripts are ES modules.)

## Structure

| Path | What it is |
| --- | --- |
| `index.html` | All sections and their content |
| `css/style.css` | Palette, type, layout and motion (light + dusk mode) |
| `js/pond.js` | The koi pond: koi, ripples, lily pads, feeding |
| `js/main.js` | Section interactions and the data for repos, programs, books, movies and places |
| `assets/` | Images (Khelo Science logo) |

## Editing content

- Repos, programs, books, movies and places are arrays at the top of each block in `js/main.js` (`REPOS`, `STONES`, `BOOKS`, `MOVIES`, `PLACES`).
- Anything still to fill in is styled as a placeholder (dashed outline, gold dot or highlighted italic text).

## Hosting

Works on GitHub Pages, Vercel or Netlify as a plain static site.
