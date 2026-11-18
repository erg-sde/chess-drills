// Turn mined mistakes into drill cards: a port of scripts/drills/build_decks.py.
// Every candidate is re-checked by the engine with multi-PV so a puzzle is only kept when its
// answer is clear. Curated per-user notes are not part of the web app.
import { MATE, pov, mateIn, fmtEval, uciToSan, legalPrefix, sanLine, describeCapture, forkTargets,
  openingName, START, posKey } from "./core.js";

export const DECKS = [
  { id: "openings", name: "Opening repair", blurb: "Positions from your first 12 moves that you keep reaching and getting wrong." },
  { id: "safety", name: "Don't hang it", blurb: "Moments where your move left a piece or pawns hanging. Find a move that keeps everything protected." },
  { id: "finish", name: "Finish them", blurb: "Your opponent blundered and you missed it, or a mate was there. Find the winning move." },
  { id: "defend", name: "See the mate coming", blurb: "Your move walked into a mating attack. Find the defence." },
];

export function cid(...parts) { // short stable id (two 32-bit FNV-1a hashes)
  const s = parts.join("|"); let a = 0x811c9dc5, b = 0x01000193 ^ s.length;
  for (let i = 0; i < s.length; i++) { a = Math.imul(a ^ s.charCodeAt(i), 16777619); b = Math.imul(b ^ s.charCodeAt(i), 2654435761); }
  return ((a >>> 0).toString(16).padStart(8, "0") + (b >>> 0).toString(16).padStart(8, "0")).slice(0, 10);
}

class Checker {
  constructor(engine, depth) { this.e = engine; this.depth = depth; }
  async lines(fen, n = 4) {
    const r = await this.e.analyse(fen, { depth: this.depth, multipv: n });
    return r.map((x) => ({ cp: x.cp, pv: uciToSan(fen, x.pv.slice(0, 10)) })).filter((x) => x.pv.length);
  }
  async scoreAfter(fen, san) {
    const g = new Chess(fen); g.move(san, { sloppy: true });
    if (g.in_checkmate()) return g.turn() === "w" ? -MATE : MATE;
    if (g.game_over()) return 0;
    return (await this.e.analyse(g.fen(), { depth: this.depth }))[0].cp;
  }
}

async function puzzleSolution(ck, fen, white, mate) {
  const ls = await ck.lines(fen, 3); if (!ls.length) return null;
  const best = ls[0], s0 = pov(best.cp, white);
  if (ls.length > 1) {
    const s1 = pov(ls[1].cp, white);
    if (mate) { if (mateIn(best.cp) == null || s0 < MATE - 200 || s1 >= MATE - 200) return null; }
    else if (s0 - s1 < 200 || s0 < 150) return null;
  }
  if (mate) { const n = mateIn(best.cp) || 0; if (n > 3 || n < 1) return null; return [legalPrefix(fen, best.pv.slice(0, 2 * n - 1)), best.cp]; }
  let sol = best.pv.slice(0, 1);
  if (best.pv.length >= 3) {
    const g = new Chess(fen); g.move(best.pv[0], { sloppy: true }); g.move(best.pv[1], { sloppy: true });
    const l2 = await ck.lines(g.fen(), 2);
    if (l2.length > 1 && pov(l2[0].cp, white) - pov(l2[1].cp, white) >= 200) sol = [best.pv[0], best.pv[1], l2[0].pv[0]];
  }
  return [sol, best.cp];
}

async function safeMoves(ck, fen, white, played) {
  const ls = await ck.lines(fen, 5); if (!ls.length) return null;
  const s0 = pov(ls[0].cp, white);
  const ok = ls.filter((l) => s0 - pov(l.cp, white) <= 60).map((l) => l.pv[0]);
  if (ok.includes(played)) return null;
  if (s0 - pov(await ck.scoreAfter(fen, played), white) < 150) return null;
  return [ls[0].pv.slice(0, 1), ok.slice(1), ls[0].cp];
}

async function extendForced(ck, fen, sol, white, maxUser = 4) {
  const g = new Chess(fen); sol.forEach((s) => g.move(s, { sloppy: true }));
  const out = [...sol];
  while (Math.ceil(out.length / 2) < maxUser && !g.game_over()) {
    const o = await ck.lines(g.fen(), 1); if (!o.length) break;
    const g2 = new Chess(g.fen()); g2.move(o[0].pv[0], { sloppy: true });
    if (g2.game_over()) break;
    const ls = await ck.lines(g2.fen(), 2); if (!ls.length) break;
    const s0 = pov(ls[0].cp, white), s1 = ls.length > 1 ? pov(ls[1].cp, white) : -MATE;
    if (!(s0 - s1 >= 150 || s1 <= -(MATE - 200))) break;
    out.push(o[0].pv[0], ls[0].pv[0]);
    g.move(o[0].pv[0], { sloppy: true }); g.move(ls[0].pv[0], { sloppy: true });
  }
  return out;
}

// ---- one candidate -> card (or null). Pure functions of the position, so results are cached. ----
async function openingCard(ck, o) {
  const white = o.color === "white", fen = o.fen;
  const ls = await ck.lines(fen, 4); if (!ls.length) return null;
  const s0 = pov(ls[0].cp, white);
  const accept = ls.slice(1).filter((l) => s0 - pov(l.cp, white) <= 30).map((l) => l.pv[0]);
  const after = {}; for (const [m] of o.played) after[m] = pov(await ck.scoreAfter(fen, m), white);
  const bad = o.played.filter(([m]) => m !== ls[0].pv[0] && !accept.includes(m) && s0 - after[m] >= 60 && after[m] < 100);
  if (!bad.length) return null;
  const key = o.setup.length, best = ls[0].pv[0], worst = bad[0][0], we = white ? after[worst] : -after[worst];
  const playedTxt = o.played.map(([m, n]) => `${m} (${n}x)`).join(", ");
  return {
    id: "op-" + cid(o.key), deck: "openings", kind: "line", orient: white ? "w" : "b",
    title: `${white ? "White" : "Black"}: ${openingName(o.setup)[1] || "Opening"}, move ${Math.floor(key / 2) + 1}`,
    sub: `Reached ${o.count}x, scored ${Math.round(o.score * 100)}%. Your ${worst} (${bad[0][1]}x) gives ${fmtEval(we)}; ${best} keeps ${fmtEval(ls[0].cp)}.`,
    moves: [...o.setup, best], from: 0, key, prompt: `Watch the last few moves, then find ${white ? "White" : "Black"}'s move.`,
    accept: {}, soft: Object.fromEntries(accept.map((m) => [m, `${m} is fine too (within 0.3). This card drills ${best}.`])),
    played: worst, keyNote: `You reached this ${o.count} times and scored ${Math.round(o.score * 100)}%. You played ${playedTxt}. Stockfish prefers ${best} (${fmtEval(ls[0].cp)}); ${worst} gives ${fmtEval(we)}.`,
    wrong: { [worst]: `That's your usual move here. Stockfish rates it ${fmtEval(we)}; ${best} keeps ${fmtEval(ls[0].cp)}.` },
    notes: {}, nags: { [key]: "!" }, summary: `Line: ${sanLine(START, [...o.setup, best])}.`,
  };
}

function tacticDeck(t) {
  return t.role === "punish" || t.type === "missed_win" || t.type === "missed_mate" ? "finish"
    : t.type === "hung" ? "safety" : t.type === "allowed_mate" ? "defend" : null;
}

async function tacticCard(ck, t) {
  const white = t.color === "white", fen = t.fen, played = t.played, deck = tacticDeck(t);
  let sol, ev, accept = [];
  if (deck === "finish") {
    const r = await puzzleSolution(ck, fen, white, t.type === "missed_mate" || Math.abs(t.eval_before) >= MATE - 200);
    if (!r) return null; [sol, ev] = r;
  } else {
    const r = await safeMoves(ck, fen, white, played); if (!r) return null; [sol, accept, ev] = r;
    if (pov(ev, white) < -200) return null; // still lost after the best defence: a poor drill
    sol = await extendForced(ck, fen, sol, white);
  }
  if (!sol || !sol.length) return null;
  const first = sol[0], mi = mateIn(ev);
  let reason;
  if (mi) reason = `Mate in ${mi}: ${sanLine(fen, sol)}.`;
  else {
    const cap = describeCapture(fen, first), forks = forkTargets(fen, first);
    if (deck === "finish" && cap) reason = `${first} takes ${cap}` + (forks.length ? ` and hits the ${forks[0]}` : "") + ".";
    else if (deck === "finish" && forks.length >= 2) reason = `${first} attacks the ${forks[0]} and the ${forks[1]} at once.`;
    else if (deck === "finish") reason = `${sanLine(fen, sol)} wins material.`;
    else if (deck === "defend" && sol.length > 1) reason = `${sanLine(fen, sol)}: every move is forced until the threat is gone. Then you're at ${fmtEval(ev)}.`;
    else if (deck === "defend") reason = `${first} stops it` + (accept.length ? ` (also fine: ${accept.join(", ")})` : "") + ".";
    else reason = `${first} keeps everything protected` + (accept.length ? ` (also fine: ${accept.join(", ")})` : "") + ".";
  }
  const bb = new Chess(fen); bb.move(played, { sloppy: true }); const fenAfter = bb.fen();
  let refut = legalPrefix(fenAfter, t.refutation.slice(0, 4));
  if (!refut.length && !bb.game_over()) { const l = await ck.lines(fenAfter, 1); refut = l.length ? legalPrefix(fenAfter, l[0].pv.slice(0, 4)) : []; }
  let whyPlayed = "";
  if (deck === "finish") whyPlayed = `In the game you played ${played} and the chance was gone.`;
  else if (refut.length) {
    const rcap = describeCapture(fenAfter, refut[0]);
    whyPlayed = deck === "defend" ? `After ${played}, ${sanLine(fenAfter, refut)} and the mate is coming.`
      : rcap ? `After ${played}, ${refut[0]} takes ${rcap.replace("the ", "your ")}.` : `After ${played}, ${sanLine(fenAfter, refut.slice(0, 3))}.`;
  }
  const side = white ? "White" : "Black", key = t.setup.length;
  const notes = { [key]: reason }; for (let j = 2; j < sol.length; j += 2) notes[key + j] = "Still the only good move: the threat isn't over yet.";
  return {
    id: "tx-" + cid(t.url, t.ply), deck, kind: "puzzle", orient: white ? "w" : "b",
    title: { finish: mi ? `${side} to play: mate in ${mi}` : `${side} to play and win`, safety: `${side} to play: don't drop material`, defend: `${side} to play: stop the mate` }[deck],
    sub: `${t.date} vs ${t.opponent} · ${t.opening || "game"} · move ${Math.floor(t.ply / 2) + 1}`,
    moves: [...t.setup, ...sol], from: key, key,
    prompt: { finish: t.role === "punish" ? "Your opponent just went wrong. Find the winning move." : "There's a win here. Find it.",
      safety: `Find a safe move. In the game, ${played} lost material.`, defend: `Danger. In the game, ${played} walked into a mate. Find the defence.` }[deck],
    accept: accept.length ? { [key]: accept } : {}, soft: {}, played, keyNote: `${whyPlayed} ${reason}`.trim(),
    wrong: { [played]: `That's what you played in the game. ${whyPlayed}` }, notes, nags: { [key]: "!" },
    summary: `${reason} ${whyPlayed}`.trim(), game: { url: t.url, date: t.date, opp: t.opponent, result: t.result },
  };
}

/** Cards from the player's own games. `cache` (a plain object the caller persists) maps each candidate
 *  to its checked card or null, so a new batch of games only costs engine time for new candidates.
 *  opts: {depth, perDeck, cache, onProgress(done, total, label), shouldStop()} */
export async function buildGameCards(engine, mined, { depth = 14, perDeck = 60, cache = {}, onProgress, shouldStop } = {}) {
  const ck = new Checker(engine, depth), cards = [];
  const sig = (o) => `op|${o.key}|${o.count}|${o.played.map((x) => x.join(":")).join(",")}`;
  const tacts = [...mined.tactics].filter((t) => tacticDeck(t) && !(t.clock != null && t.clock < 8)).sort((a, b) => (a.date < b.date ? 1 : -1));
  const todo = mined.openings.filter((o) => !(sig(o) in cache)).length + tacts.filter((t) => !(`tx|${t.url}|${t.ply}` in cache)).length;
  let done = 0; const tick = (label) => onProgress && onProgress(++done, todo, label);

  for (const o of mined.openings) {
    const k = sig(o);
    if (!(k in cache)) { if (shouldStop && shouldStop()) break; tick("Opening positions"); cache[k] = await openingCard(ck, o); }
    if (cache[k]) cards.push({ ...cache[k], _score: o.weight * o.avg_loss });
  }
  const seen = new Set(), count = (d) => cards.filter((c) => c.deck === d).length;
  for (const t of tacts) {
    const deck = tacticDeck(t), pk = posKey(t.fen), k = `tx|${t.url}|${t.ply}`;
    if (seen.has(pk) || count(deck) >= perDeck) continue;
    if (!(k in cache)) { if (shouldStop && shouldStop()) break; tick("Puzzles from your games"); cache[k] = await tacticCard(ck, t); }
    if (cache[k]) { seen.add(pk); cards.push(cache[k]); }
  }
  let out = [];
  for (const d of DECKS) {
    const cs = cards.filter((c) => c.deck === d.id);
    if (d.id === "openings") cs.sort((a, b) => b._score - a._score);
    out = out.concat(cs.slice(0, perDeck));
  }
  out = out.map(({ _score, ...c }) => c).filter((c) => { const g = new Chess(); return c.moves.every((s) => g.move(s, { sloppy: true })); });
  return { decks: DECKS.filter((d) => out.some((c) => c.deck === d.id)), cards: out };
}

/** Opening library decks (no engine needed). `games` (analysed) only adds "faced" counts and ordering. */
export function openingDecks(rep, games = [], selected = null) {
  const decks = [], cards = [];
  for (const d of (rep && rep.decks) || []) {
    if (selected && !selected.includes(d.id)) continue;
    const opp = d.color === "white" ? "Black" : "White", orient = d.color === "white" ? "w" : "b";
    const seqs = games.filter((g) => g.color === d.color).map((g) => g.plies.map((p) => p.san));
    const cs = d.lines.map((ln) => {
      const mv = ln.moves.split(" "), br = ln.branch, ns = ln.notes || {};
      const faced = seqs.filter((s) => mv.slice(0, br + 1).every((x, i) => s[i] === x)).length;
      return { id: d.id + "-" + cid(ln.moves), deck: d.id, kind: "line", orient, title: `${d.name.split(" (")[0]}: ${ln.name}`,
        sub: faced ? `${opp} has chosen ${mv[br]} against you ${faced}x in your analysed games.` : (seqs.length ? `Not in your analysed games yet.` : ``),
        moves: mv, from: 0, key: br + 1, prompt: "Watch the moves leading in, then play your side to the end of the line.",
        notes: ns, nags: {}, accept: {}, soft: {},
        keyNote: (`${ln.name}. ` + Object.entries(ns).filter(([i]) => +i > br && (+i % 2) === ((br + 1) % 2)).sort((a, b) => a[0] - b[0]).map(([, v]) => v).join(" ")).slice(0, 400),
        summary: `Line: ${sanLine(START, mv)}.`, _faced: faced };
    }).sort((a, b) => b._faced - a._faced);
    decks.push({ id: d.id, name: d.name, blurb: d.blurb, faced: cs.reduce((a, c) => a + c._faced, 0) });
    cards.push(...cs.map(({ _faced, ...c }) => c));
  }
  return { decks, cards };
}

/** How often the player reaches each library deck as its colour (for suggestions). */
export function openingUsage(rep, games) {
  const out = {};
  for (const d of (rep && rep.decks) || []) {
    // Match on the player's own moves in the first 6 plies (London: 1.d4 and 2.Bf4 whatever Black plays).
    const mine = (i) => (i % 2 === 0) === (d.color === "white");
    const pats = d.lines.map((l) => l.moves.split(" ").slice(0, 6).map((x, i) => (mine(i) ? [i, x] : null)).filter(Boolean));
    out[d.id] = games.filter((g) => g.color === d.color && pats.some((p) => p.every(([i, x]) => g.plies[i] && g.plies[i].san === x))).length;
  }
  return out;
}

/** Facts for the "What your games say" panel. */
export function facts(st) {
  const bl = Object.values(st.by_type).reduce((a, b) => a + b, 0) || 1, g = st.games || 1;
  const pc = (n, d) => Math.round((100 * n) / (d || 1)) + "%";
  return [
    [String(st.games), "games analysed with Stockfish"],
    [(bl / g).toFixed(1), "blunders per game by you (30+ win-% points lost in one move)"],
    [pc(st.by_phase.middlegame || 0, bl), "of your blunders come between moves 10 and 30"],
    [pc(st.by_type.hung || 0, bl), `of your blunders simply leave material hanging (${st.by_type.hung || 0} moves)`],
    [pc(st.missed_punish, st.opp_blunders), `of your opponents' blunders went unpunished (${st.missed_punish} of ${st.opp_blunders})`],
    [String(st.by_type.allowed_mate || 0), "of your moves walked into a forced mate"],
    [pc(st.low_clock.under_30s || 0, bl), "of your blunders came with under 30 seconds left"],
  ];
}
