# CLAUDE.md

Static, browser-only chess drill app (GitHub Pages, no build step). See README for the layout.

- No server and no third-party scripts: keep everything self-hosted under `vendor/`. If you add a
  host the page talks to, add it to the Content-Security-Policy meta tag in `index.html`.
- Uses chess.js **0.10.3** (`vendor/chess.js`, global `Chess`, snake_case API like `in_checkmate()`).
- Engine: Stockfish 19 lite single-threaded WASM in a Worker (`app/engine.js`). Scores are White's
  point of view; mate is folded to ±10000 (MATE − n).
- Opening library: edit `tools/library/lines.py` and `notes.py`, run `python tools/library/check.py <deck>`
  (your side within 0.5 pawns of best, opponent moves not blunders unless the line punishes one), then
  `python tools/library/build.py`. Never hand-edit `data/repertoire.json` for library decks. `branch` is
  the index of the opponent's defining move; notes are keyed by labels like "7.d4" / "5...Na5".
- Games are analysed in the background, BITE (10) at a time, newest first; state lives in IndexedDB
  (`pending`, `analysed`, `checkCache`, `gameData`) so a reload resumes. The drill page is told about
  new cards with `DrillApp.update()`, which must not disturb the card in play.
- Test locally with `python -m http.server` and Playwright (Chromium is preinstalled in Claude cloud
  sessions). Mock api.github.com / api.anthropic.com with `page.route` rather than using real keys.
- Licence is GPL-3.0 (ships Stockfish.js).
