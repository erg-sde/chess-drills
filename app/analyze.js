// Per-game analysis, a port of scripts/drills/analyze_batch.py: every position is evaluated once,
// and each move gets the eval before/after, the win-probability loss for the mover, its class,
// the engine's best move and line (SAN) and the clock.
import { classify, winProb, uciToSan, openingName, START } from "./core.js";

/** game: {moves: [san], clocks: [seconds|null], color, ...meta}. Returns the record mine.js expects. */
export async function analyseGame(engine, game, { depth = 12, onPly } = {}) {
  const g = new Chess(game.fen0 || START);
  let before = (await engine.analyse(g.fen(), { depth }))[0];
  const plies = [];
  for (let i = 0; i < game.moves.length; i++) {
    const fen = g.fen(), side = g.turn() === "w" ? "white" : "black";
    const pvSan = uciToSan(fen, before.pv.slice(0, 6));
    const m = g.move(game.moves[i], { sloppy: true });
    if (!m) break;
    let after;
    if (g.in_checkmate()) after = { cp: side === "white" ? 10000 : -10000, pv: [] };
    else if (g.game_over()) after = { cp: 0, pv: [] };
    else after = (await engine.analyse(g.fen(), { depth }))[0];
    const wb = winProb(before.cp), wa = winProb(after.cp);
    let loss = side === "white" ? wb - wa : wa - wb;
    loss = pvSan[0] === m.san ? 0 : Math.max(0, loss);
    plies.push({ fen, side, san: m.san, best: pvSan[0] || null, pv: pvSan, eb: before.cp, ea: after.cp,
      loss: Math.round(loss * 10) / 10, cls: classify(loss, before.cp, after.cp, side === "white"),
      clock: game.clocks ? game.clocks[i] ?? null : null });
    before = after;
    onPly && onPly(i + 1, game.moves.length);
  }
  const [eco, opening] = openingName(plies.map((p) => p.san));
  const { moves, clocks, pgn, ...meta } = game;
  return { ...meta, eco, opening, depth, plies };
}
