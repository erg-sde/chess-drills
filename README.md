# Chess Drills

Spaced-repetition drills built from **your own games**, entirely in your browser.

Enter a chess.com or lichess username (or upload PGN files). Stockfish 19 runs in the page,
goes through your recent games, finds the mistakes you keep making, and turns them into cards:

- **Opening repair**: positions from your first 12 moves that you keep reaching and getting
  wrong, weighted toward recent games.
- **Don't hang it**: moments your move left material hanging. Find a safe move.
- **Finish them**: your opponent blundered (or a mate was there) and you missed it.
- **See the mate coming**: your move walked into a mating attack. Find the whole defence.
- **Opening decks**: main lines of openings you actually play (Ruy Lopez for now), ordered by how
  often you've faced each branch.

Every line is steppable from move 1. Cards come back on a schedule (4 hours, 1 day, 3 days, a week…).
Each card has an **Analyse** link (lichess analysis board) and an optional **Explain** button.

## Privacy and keys

There is no server. Games, analysis, cards and progress stay in your browser (IndexedDB).

- **Sync across devices (optional)**: paste a GitHub fine-grained token with only
  *Gists: read and write*. Progress and cards are kept in a secret gist in your own account and
  merged per card (the newer change wins, and reviews done offline on another device are kept).
  A second device with the same token gets your cards without re-running Stockfish.
- **Explain (optional)**: bring your own key for Anthropic (Claude), OpenRouter or OpenAI. Requests go
  straight from your browser to that provider. Use a key with a spending limit.
- Tokens and keys are stored only in your browser and sent only to GitHub or your AI provider.
  The page's Content Security Policy allows no other hosts and no third-party scripts.
- **Backup**: Settings → Export backup / Import backup.

## Running it

It is a static site: serve the folder (`python -m http.server`) or publish it with GitHub Pages
(Settings → Pages → deploy from the default branch, root folder). There is no build step.

## Layout

| Path | What |
| --- | --- |
| `index.html`, `app/drill.js` | The drill page: board, drilling, steppers, spaced repetition, progress stats. |
| `app/main.js` | Setup screen, pipeline, settings. |
| `app/engine.js` | Stockfish (WASM) in a Web Worker over UCI. |
| `app/games.js` | chess.com / lichess / PGN loading. |
| `app/analyze.js`, `app/mine.js`, `app/build.js` | Analysis → repeated mistakes → engine-checked cards. |
| `app/sync.js`, `app/explain.js`, `app/store.js` | Gist sync, bring-your-own-key AI, IndexedDB. |
| `data/repertoire.json` | Opening decks (engine-checked main lines). |
| `data/openings.tsv` | Opening names ([lichess chess-openings](https://github.com/lichess-org/chess-openings), CC0). |

## Licences

GPL-3.0 (see `LICENSE`), because it ships [Stockfish.js](https://github.com/nmrugg/stockfish.js)
(GPL-3.0). Also includes [chess.js](https://github.com/jhlywa/chess.js) 0.10.3 (BSD-2-Clause, header in
`vendor/chess.js`), chess piece images from python-chess's cburnett set (GPL/BSD/GFDL, Colin M.L. Burnett),
and the CC0 opening names above.
