// Find repeated mistakes in analysed games: a port of scripts/drills/mine.py.
// Returns {stats, openings, tactics} in the same shape build.js expects.
import { MATE, pov, swing, posKey, NAME } from "./core.js";

const phase = (i) => (i < 20 ? "opening" : i < 60 ? "middlegame" : "endgame");
const povS = (cp, side) => pov(cp, side === "white");

function kind(g, i) {
  const p = g.plies[i], me = p.side === "white" ? "w" : "b", nxt = g.plies[i + 1];
  const eb = povS(p.eb, p.side), ea = povS(p.ea, p.side);
  if (eb >= MATE - 100 && ea < MATE - 100) return ["missed_mate", `There was a forced mate starting ${p.best}.`];
  if (ea <= -(MATE - 100)) return ["allowed_mate", "This walks into a forced mate."];
  if (nxt && nxt.pv.length) {
    const lost = -swing(nxt.fen, nxt.pv.slice(0, 4), me);
    if (lost >= 2) {
      const b = new Chess(nxt.fen), m = b.move(nxt.pv[0], { sloppy: true });
      const what = m && m.captured ? `your ${NAME[m.captured]} on ${m.to}` : "material";
      return ["hung", `It drops ${what}: ${nxt.pv.slice(0, 3).join(" ")} wins about ${lost} points.`];
    }
  }
  const gain = swing(p.fen, p.pv.slice(0, 4), me);
  if (gain >= 2) return ["missed_win", `${p.best} wins about ${gain} points of material.`];
  return ["positional", "The engine line keeps a much better position."];
}

const inc = (o, k, n = 1) => { o[k] = (o[k] || 0) + n; };

export function mine(games, { halfLife = 21 } = {}) {
  games = [...games].sort((a, b) => (a.end_time < b.end_time ? -1 : 1));
  const stats = { games: games.length, by_phase: {}, by_type: {}, by_color: {}, low_clock: {}, missed_punish: 0, opp_blunders: 0, by_class: {} };
  const tactics = [], reach = new Map();
  games.forEach((g, gi) => {
    g.plies.forEach((p, i) => {
      const mine = p.side === g.color;
      if (mine) {
        inc(stats.by_class, p.cls || "ok");
        if (i < 24) { const k = posKey(p.fen); if (!reach.has(k)) reach.set(k, []); reach.get(k).push([gi, i]); }
      }
      if (p.cls !== "blunder") return;
      if (mine) {
        const [t, why] = kind(g, i);
        inc(stats.by_phase, phase(i)); inc(stats.by_type, t); inc(stats.by_color, g.color);
        if (p.clock != null && p.clock < 30) inc(stats.low_clock, "under_30s");
        tactics.push({ g: gi, i, role: "fix", type: t, why });
      } else {
        stats.opp_blunders++;
        const q = g.plies[i + 1];
        if (q && (q.cls === "mistake" || q.cls === "blunder") && povS(q.eb, q.side) >= 200) {
          stats.missed_punish++;
          if (q.cls === "mistake") { const [t, why] = kind(g, i + 1); tactics.push({ g: gi, i: i + 1, role: "punish", type: t, why }); }
        }
      }
    });
  });

  // Opening leaks, weighted by recency (half-life in days before the latest game).
  const latest = games.length ? Date.parse(games[games.length - 1].end_time) : Date.now();
  const days = (g) => (latest - Date.parse(g.end_time)) / 864e5;
  const wt = games.map((g) => 0.5 ** (days(g) / halfLife));
  const openings = [];
  for (const [k, hits] of reach) {
    const recent = hits.filter(([gi]) => days(games[gi]) <= 45).length;
    if (hits.length < 3 && recent < 2) continue;
    const plies = hits.map(([gi, i]) => games[gi].plies[i]), ws = hits.map(([gi]) => wt[gi]);
    const weight = ws.reduce((a, b) => a + b, 0);
    if (weight < 1) continue;
    const avg = plies.reduce((a, p, j) => a + p.loss * ws[j], 0) / weight;
    const bad = plies.filter((p) => p.loss >= 10).length;
    if (avg < 6 || bad < 2) continue;
    const [gi0, i0] = hits[hits.length - 1], g0 = games[gi0];
    const counts = {}; plies.forEach((p) => inc(counts, p.san));
    const res = hits.map(([gi]) => games[gi].result);
    openings.push({
      key: k, count: hits.length, recent, weight: +weight.toFixed(2), avg_loss: +avg.toFixed(1), bad,
      color: g0.color, ply: i0, setup: g0.plies.slice(0, i0).map((q) => q.san), fen: plies[plies.length - 1].fen,
      played: Object.entries(counts).sort((a, b) => b[1] - a[1]),
      score: +(res.reduce((a, r) => a + (r === "win" ? 1 : r === "draw" ? 0.5 : 0), 0) / res.length).toFixed(2),
      last: g0.end_time.slice(0, 10), games: hits.slice(-5).map(([gi]) => games[gi].url),
    });
  }
  openings.sort((a, b) => b.weight * b.avg_loss - a.weight * a.avg_loss);

  const outT = tactics.map((t) => {
    const g = games[t.g], p = g.plies[t.i];
    return { role: t.role, type: t.type, why: t.why, url: g.url, date: g.end_time.slice(0, 10), color: g.color,
      opponent: g.opponent, result: g.result, time_class: g.time_class, opening: g.opening, ply: t.i,
      setup: g.plies.slice(0, t.i).map((q) => q.san), fen: p.fen, played: p.san, best: p.best, pv: p.pv,
      loss: p.loss, clock: p.clock, eval_before: povS(p.eb, p.side), eval_after: povS(p.ea, p.side),
      refutation: g.plies[t.i + 1] ? g.plies[t.i + 1].pv : [] };
  });
  return { stats, openings, tactics: outT };
}
