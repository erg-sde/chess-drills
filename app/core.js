// Shared chess helpers: scoring (Lichess curve, same as the Python tooling), move classes,
// opening names, SAN/UCI conversion and material counting. Uses chess.js 0.10.3 (global Chess).
import { MATE } from "./engine.js";
export { MATE };

export const winProb = (cp) => (Math.abs(cp) >= MATE - 100 ? (cp > 0 ? 100 : 0)
  : 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * Math.max(-1500, Math.min(1500, cp)))) - 1));
export const isMate = (cp) => Math.abs(cp) >= MATE - 100;
export const pov = (cp, white) => (white ? cp : -cp);
export const mateIn = (cp) => (Math.abs(cp) < MATE - 200 ? null : MATE - Math.abs(cp));

export function classify(loss, cpBefore, cpAfter, whiteMoved) {
  if (cpBefore != null && cpAfter != null) {
    const s = whiteMoved ? 1 : -1;
    const lostMate = isMate(cpBefore) && cpBefore * s > 0 && !(isMate(cpAfter) && cpAfter * s > 0);
    const allowedMate = isMate(cpAfter) && cpAfter * s < 0 && !(isMate(cpBefore) && cpBefore * s < 0);
    if (lostMate || allowedMate) return "blunder";
  }
  return loss >= 30 ? "blunder" : loss >= 20 ? "mistake" : loss >= 10 ? "inaccuracy" : "";
}
export const moveAccuracy = (loss) => Math.max(0, Math.min(100, 103.1668 * Math.exp(-0.04354 * Math.max(0, loss)) - 3.1669));
export function fmtEval(cp) {
  if (isMate(cp)) { const n = MATE - Math.abs(cp); return (cp > 0 ? "M" : "-M") + n; }
  return (cp >= 0 ? "+" : "") + (cp / 100).toFixed(2);
}

const VAL = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
export const NAME = { p: "pawn", n: "knight", b: "bishop", r: "rook", q: "queen", k: "king" };
export function material(g, color) {
  let m = 0;
  for (const row of g.board()) for (const p of row) if (p) m += VAL[p.type] * (p.color === color ? 1 : -1);
  return m;
}
/** Material change for `color` ('w'|'b') after playing SAN `line` from fen (stops on an illegal move). */
export function swing(fen, line, color) {
  const g = new Chess(fen), m0 = material(g, color);
  for (const s of line) if (!g.move(s, { sloppy: true })) break;
  return material(g, color) - m0;
}
export function legalPrefix(fen, sans) {
  const g = new Chess(fen), out = [];
  for (const s of sans) { const m = g.move(s, { sloppy: true }); if (!m) break; out.push(m.san); }
  return out;
}
export function uciToSan(fen, ucis) {
  const g = new Chess(fen), out = [];
  for (const u of ucis) {
    const m = g.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] });
    if (!m) break; out.push(m.san);
  }
  return out;
}
export function sanLine(fen, sans) {
  const g = new Chess(fen), out = [];
  sans.forEach((s, i) => {
    const n = +g.fen().split(" ")[5], w = g.turn() === "w";
    out.push(w ? `${n}.${s}` : i === 0 ? `${n}...${s}` : s);
    g.move(s, { sloppy: true });
  });
  return out.join(" ");
}
export const posKey = (fen) => fen.split(" ").slice(0, 4).join(" ");
export const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

/** What does `san` capture, as text ("the knight on f6"), or null. */
export function describeCapture(fen, san) {
  const g = new Chess(fen), m = g.move(san, { sloppy: true });
  if (!m || !m.captured) return null;
  return m.flags.includes("e") ? "a pawn" : `the ${NAME[m.captured]} on ${m.to}`;
}
/** Enemy pieces (non-pawn) the moved piece attacks after `san`: worth more than it, or the king. */
export function forkTargets(fen, san) {
  const g = new Chess(fen), m = g.move(san, { sloppy: true });
  if (!m) return [];
  const f = g.fen().split(" "); f[1] = f[1] === "w" ? "b" : "w"; f[3] = "-";
  const h = new Chess(f.join(" "));
  if (!h.fen || h.fen().split(" ")[0] !== f[0]) return [];
  const mover = h.get(m.to); if (!mover) return [];
  return h.moves({ square: m.to, verbose: true }).filter((x) => x.captured && x.captured !== "p" &&
    (x.captured === "k" || VAL[x.captured] > VAL[mover.type])).map((x) => `${NAME[x.captured]} on ${x.to}`);
}

// ---- opening names (lichess chess-openings, CC0) ----
let OPEN = null;
export async function loadOpenings(url = "data/openings.tsv") {
  const t = await (await fetch(url)).text();
  OPEN = new Map();
  for (const line of t.split("\n").slice(1)) {
    const [eco, name, pgn] = line.split("\t"); if (!pgn) continue;
    OPEN.set(pgn.trim().split(/\s+/).filter((x) => !x.endsWith(".")).join(" "), [eco, name]);
  }
}
export function openingName(sans) {
  if (!OPEN) return ["", "", 0];
  for (let n = Math.min(sans.length, 30); n > 0; n--) { const hit = OPEN.get(sans.slice(0, n).join(" ")); if (hit) return [hit[0], hit[1], n]; }
  return ["", "", 0];
}
