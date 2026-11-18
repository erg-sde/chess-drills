// Load games: chess.com and lichess public APIs (both allow browser requests), or uploaded PGN.
// Every game becomes {url, end_time (ISO), time_class, color, result, opponent, my_rating,
// opp_rating, source, moves: [san], clocks: [seconds|null]}.

function headers(pgn) {
  const h = {}; for (const m of pgn.matchAll(/^\[(\w+)\s+"(.*)"\]\s*$/gm)) h[m[1]] = m[2]; return h;
}
function clocks(pgn) {
  const body = pgn.replace(/^\[.*\]\s*$/gm, "");
  return [...body.matchAll(/\[%clk\s+(\d+):(\d+):(\d+(?:\.\d+)?)\]/g)].map((m) => +m[1] * 3600 + +m[2] * 60 + +m[3]);
}
export function splitPgn(text) {
  return text.replace(/\r/g, "").split(/\n\s*\n(?=\[Event )/).map((s) => s.trim()).filter((s) => s.startsWith("["));
}
function movesOf(pgn) {
  const g = new Chess();
  if (!g.load_pgn(pgn, { sloppy: true })) {
    // chess.js 0.10 chokes on some comments; strip them and retry.
    const clean = pgn.replace(/\{[^}]*\}/g, "").replace(/\$\d+/g, "");
    if (!g.load_pgn(clean, { sloppy: true })) return null;
  }
  return g.history();
}
const tc = (h) => {
  const t = (h.TimeControl || "").split("+")[0];
  if (!t || t === "-" || t.includes("/")) return "daily";
  const s = +t + 40 * +((h.TimeControl || "").split("+")[1] || 0);
  return s < 180 ? "bullet" : s < 480 ? "blitz" : s < 1500 ? "rapid" : "classical";
};
/** One PGN game -> game record, from the point of view of whichever player is in `names`. */
export function fromPgn(pgn, names, extra = {}) {
  const h = headers(pgn), lower = names.map((n) => n.toLowerCase());
  if (h.Variant && h.Variant !== "Standard") return null;
  if (h.SetUp === "1" || h.FEN) return null; // custom start positions: skip
  const color = lower.includes((h.White || "").toLowerCase()) ? "white" : lower.includes((h.Black || "").toLowerCase()) ? "black" : null;
  if (!color) return null;
  const moves = movesOf(pgn); if (!moves || moves.length < 6) return null;
  const r = h.Result || "*", res = r === "1/2-1/2" ? "draw" : r === "*" ? null : (r === "1-0") === (color === "white") ? "win" : "loss";
  if (!res) return null;
  const date = (h.UTCDate || h.EndDate || h.Date || "").replace(/\./g, "-"), time = h.UTCTime || h.EndTime || "00:00:00";
  const iso = /^\d{4}-\d\d-\d\d$/.test(date) ? `${date}T${time}Z` : new Date().toISOString();
  const opp = color === "white" ? h.Black : h.White;
  const url = h.Link || (/^https?:/.test(h.Site || "") ? h.Site : "") || `pgn:${h.White}-${h.Black}-${iso}-${moves.slice(0, 12).join("")}`;
  const ck = clocks(pgn);
  return { url, end_time: iso, time_class: tc(h), color, result: res, opponent: opp,
    my_rating: +(color === "white" ? h.WhiteElo : h.BlackElo) || null, opp_rating: +(color === "white" ? h.BlackElo : h.WhiteElo) || null,
    source: "pgn", moves, clocks: ck.length === moves.length ? ck : null, ...extra };
}

/** Most frequent player name across PGNs: the likely owner of an uploaded file. */
export function guessOwner(pgns) {
  const c = {}; for (const p of pgns) { const h = headers(p); [h.White, h.Black].forEach((n) => n && (c[n] = (c[n] || 0) + 1)); }
  return Object.entries(c).sort((a, b) => b[1] - a[1]).map(([n]) => n);
}

export async function fetchChessCom(user, { max = 100, since = null, onStatus } = {}) {
  const base = `https://api.chess.com/pub/player/${encodeURIComponent(user.toLowerCase())}`;
  const r = await fetch(`${base}/games/archives`);
  if (r.status === 404) throw new Error(`chess.com has no player "${user}".`);
  if (!r.ok) throw new Error(`chess.com answered ${r.status}.`);
  const archives = (await r.json()).archives || [];
  const out = [];
  for (const a of archives.reverse()) {
    if (out.length >= max) break;
    if (since && a.slice(-7).replace("/", "-") < since.slice(0, 7)) break;
    onStatus && onStatus(`chess.com: ${a.slice(-7)}`);
    const j = await (await fetch(a)).json();
    for (const g of (j.games || []).reverse()) {
      if (g.rules !== "chess" || !g.pgn || out.length >= max) continue;
      const rec = fromPgn(g.pgn, [user], { url: g.url, source: "chess.com", end_time: new Date(g.end_time * 1000).toISOString(), time_class: g.time_class });
      if (rec && (!since || rec.end_time > since)) out.push(rec);
    }
  }
  return out;
}

export async function fetchLichess(user, { max = 100, since = null, onStatus } = {}) {
  onStatus && onStatus("lichess: downloading");
  const q = new URLSearchParams({ max: String(max), clocks: "true", evals: "false", opening: "false", rated: "true" });
  if (since) q.set("since", String(Date.parse(since) + 1));
  const r = await fetch(`https://lichess.org/api/games/user/${encodeURIComponent(user)}?${q}`, { headers: { Accept: "application/x-chess-pgn" } });
  if (r.status === 404) throw new Error(`lichess has no player "${user}".`);
  if (r.status === 429) throw new Error("lichess is rate-limiting requests. Wait a minute and try again.");
  if (!r.ok) throw new Error(`lichess answered ${r.status}.`);
  return splitPgn(await r.text()).map((p) => fromPgn(p, [user], { source: "lichess" })).filter(Boolean);
}
