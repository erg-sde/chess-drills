# CLAUDE.md

Static, browser-only chess drill app (GitHub Pages, no build step). See README for the layout.

- No server and no third-party scripts: keep everything self-hosted under `vendor/`. If you add a
  host the page talks to, add it to the Content-Security-Policy meta tag in `index.html`.
- Uses chess.js **0.10.3** (`vendor/chess.js`, global `Chess`, snake_case API like `in_checkmate()`).
- Engine: Stockfish 19 lite single-threaded WASM in a Worker (`app/engine.js`). Scores are White's
  point of view; mate is folded to ±10000 (MATE − n).
- Every opening line added to `data/repertoire.json` must be engine-checked and legal (validate with
  python-chess) before committing; `branch` is the index of the opponent's defining move.
- Test locally with `python -m http.server` and Playwright (Chromium is preinstalled in Claude cloud
  sessions). Mock api.github.com / api.anthropic.com with `page.route` rather than using real keys.
- Licence is GPL-3.0 (ships Stockfish.js).
