// App shell: setup, the opening picker, background analysis (a bite at a time), settings (sync,
// AI key, data) and the hand-off to the drill page (window.DrillApp, defined in app/drill.js).
import { Engine } from "./engine.js";
import { loadOpenings } from "./core.js";
import { fetchChessCom, fetchLichess, splitPgn, fromPgn, guessOwner } from "./games.js";
import { analyseGame } from "./analyze.js";
import { mine } from "./mine.js";
import { buildGameCards, openingDecks, openingUsage, facts } from "./build.js";
import { store } from "./store.js";
import { GistSync, mergeProgress } from "./sync.js";
import { makeExplainer, PROVIDERS } from "./explain.js";
import { count } from "./analytics.js";

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const QUALITY = { quick: { depth: 10, check: 12, label: "Quick" }, standard: { depth: 12, check: 14, label: "Standard" }, deep: { depth: 14, check: 16, label: "Deep" } };
const BITE = 10; // games analysed per batch before cards are rebuilt

let S = { players: { chesscom: "", lichess: "", pgnNames: [] }, count: 100, quality: "standard", openings: null,
  ai: { provider: "anthropic", key: "", model: "", remember: true }, sync: null };
let REP = null, engine = null, progress = {}, decksData = null, gameData = null, syncer = null, syncTimer = 0;
let job = { running: false, paused: false, total: 0, done: 0 };
const sessionKey = { ai: null };

// ---------------- persistence ----------------
/** The first version saved one combined card set ({cards, decks, facts, subtitle...}, no "v").
 *  Split it into cards from games + chosen opening decks + archive. Card ids are unchanged, so
 *  progress carries over. */
function fromV1(old, analysedCount = 0) {
  if (!old || !Array.isArray(old.cards) || !old.cards.length) return null;
  const isRep = (id) => id && id.startsWith("rep-");
  const cards = old.cards.filter((c) => !isRep(c.deck) && c.deck !== "archive");
  const archive = old.cards.filter((c) => c.deck === "archive");
  const m = /last (\d+) games/.exec(old.subtitle || "");
  return {
    gameData: { cards, decks: (old.decks || []).filter((d) => !isRep(d.id) && d.id !== "archive"), archive,
      facts: old.facts || [], rating: old.rating || null, games: analysedCount || (m ? +m[1] : 0) },
    openings: [...new Set((old.decks || []).map((d) => d.id).filter(isRep))],
  };
}
async function loadState() {
  const s = await store.get("settings");
  if (s) S = { ...S, ...s, players: { ...S.players, ...(s.players || {}) }, ai: { ...S.ai, ...(s.ai || {}) } };
  progress = (await store.get("progress")) || {};
  gameData = (await store.get("gameData")) || null; // {cards, decks, facts, rating, games, archive}
  if (!gameData) { // cards built by the first version of the site
    const v1 = fromV1(await store.get("decks"), ((await store.get("analysed")) || []).length);
    if (v1) {
      gameData = v1.gameData; await store.set("gameData", gameData);
      if (!S.openings) S.openings = v1.openings;
      S.started = true; await saveSettings();
    }
  }
}
const saveSettings = () => { const c = JSON.parse(JSON.stringify(S)); if (!S.ai.remember) c.ai.key = ""; return store.set("settings", c); };
const aiCfg = () => ({ ...S.ai, key: S.ai.key || sessionKey.ai });

/** Everything the drill page shows: cards from your games + chosen opening decks + archive. */
async function compose() {
  const analysed = (await store.get("analysed")) || [];
  const op = openingDecks(REP, analysed, S.openings || []);
  const g = gameData || { cards: [], decks: [], archive: [] };
  const arch = g.archive || [];
  const n = analysed.length || g.games || 0, cardsN = g.cards.length; // synced devices have cards but no local analysis
  decksData = {
    decks: [...g.decks, ...op.decks, ...(arch.length ? [{ id: "archive", name: "Archive", blurb: "Cards from earlier builds. Not in normal sessions; pick this deck to drill them." }] : [])],
    cards: [...g.cards, ...op.cards, ...arch],
    facts: g.facts || [], rating: g.rating || null,
    subtitle: n ? `${cardsN} cards from your last ${n} games${job.running ? " so far" : ""}.` : "Opening drills.",
    method: n ? `Every move of your last ${n} games was evaluated by Stockfish 19 (lite) at depth ${QUALITY[S.quality].depth} in your browser, and every card was re-checked at depth ${QUALITY[S.quality].check}. A blunder loses 30+ points of win probability in one move (Lichess's scale). Puzzles are kept only when the answer is clearly best; "safe move" cards accept any move within 0.6 pawns of the best.` : "",
  };
  return decksData;
}

// ---------------- sync ----------------
function setStatus(t) { try { window.DrillApp.setStatus(t); } catch (e) { /* page not up yet */ } }
async function startSync() {
  if (!S.sync || !S.sync.token) { syncer = null; return; }
  syncer = new GistSync(S.sync.token, S.sync.gistId);
  try {
    S.sync.gistId = await syncer.connect(); await saveSettings();
    const remote = await syncer.pull();
    const rd = remote.decks && (remote.decks.v === 2 ? remote.decks : fromV1(remote.decks)); // accept the first version's format too
    if (rd) {
      if (rd.gameData && (!gameData || rd.gameData.games > (gameData.games || 0))) { gameData = rd.gameData; await store.set("gameData", gameData); }
      if (!S.openings && rd.openings) S.openings = rd.openings;
      if (gameData || (S.openings && S.openings.length)) S.started = true;
      await saveSettings();
    }
    progress = mergeProgress(progress, remote.progress); await store.set("progress", progress);
    return remote;
  } catch (e) { setStatus("Sync problem: " + e.message); }
}
function queuePush() {
  if (!syncer) return;
  clearTimeout(syncTimer);
  syncTimer = setTimeout(async () => {
    try { progress = await syncer.pushProgress(progress); await store.set("progress", progress); window.DrillApp.setProgress(progress); setStatus("Synced."); }
    catch (e) { setStatus("Couldn't sync just now; saved in this browser."); }
  }, 4000);
}
const pushDecks = () => syncer && syncer.pushDecks({ v: 2, gameData, openings: S.openings }).catch(() => {});
document.addEventListener("visibilitychange", async () => {
  if (document.visibilityState !== "visible" || !syncer || !decksData) return;
  try { const r = await syncer.pull(); progress = mergeProgress(progress, r.progress); await store.set("progress", progress); window.DrillApp.setProgress(progress); } catch (e) { /* offline */ }
});

// ---------------- header pill and toast ----------------
function pill() {
  let el = $("jobpill");
  if (!el) {
    el = document.createElement("div"); el.id = "jobpill"; el.className = "jobpill";
    el.innerHTML = '<span id="jobtxt"></span><button class="hbtn" id="jobbtn"></button>';
    $("hstat").appendChild(el); // second header row, under the title and buttons
    $("jobbtn").onclick = () => { job.paused = !job.paused; if (!job.paused && !job.running) runJob(); renderPill(); };
  }
  return el;
}
function renderPill(stage = "") {
  const el = pill();
  if (!job.running && !job.paused) { el.hidden = true; return; }
  el.hidden = false;
  const cards = gameData ? gameData.cards.length : 0;
  $("jobtxt").textContent = job.paused ? `Paused at ${job.done} of ${job.total} games` : stage || `Analysing your games: ${job.done} of ${job.total} · ${cards} cards so far`;
  $("jobbtn").textContent = job.paused ? "Resume" : "Pause";
}
function toast(text, action, fn) {
  let el = $("toast");
  if (!el) { el = document.createElement("div"); el.id = "toast"; el.className = "toast"; el.setAttribute("role", "status"); document.body.appendChild(el); }
  el.innerHTML = `<span></span>${action ? '<button class="btn pri"></button>' : ""}<button class="btn" aria-label="Dismiss">✕</button>`;
  el.querySelector("span").textContent = text;
  const bs = el.querySelectorAll("button");
  if (action) { bs[0].textContent = action; bs[0].onclick = () => { el.hidden = true; fn(); }; }
  bs[bs.length - 1].onclick = () => { el.hidden = true; };
  el.hidden = false;
  clearTimeout(el._t); el._t = setTimeout(() => { el.hidden = true; }, 15000);
}

// ---------------- opening picker ----------------
async function openPicker(first = false) {
  const analysed = (await store.get("analysed")) || [];
  const usage = openingUsage(REP, analysed), sel = new Set(S.openings || []);
  const el = $("picker"); el.hidden = false;
  el.innerHTML = `<div class="pk-head"><h2>${first ? "While we build cards from your games, pick openings to drill" : "Opening decks"}</h2>
    <p class="why">${first ? "Your own cards appear here as each batch of games is analysed. Meanwhile, drill the main lines of any opening below: the common moves replay, then you play your side." : "Pick the openings you want in your decks. Lines are checked with Stockfish."}</p></div>
    <div class="pk-grid">${REP.decks.map((d) => `<button class="pk${sel.has(d.id) ? " on" : ""}" data-id="${d.id}" aria-pressed="${sel.has(d.id)}">
      <span class="pk-side ${d.color}">${d.color === "white" ? "White" : "Black"}</span><b></b><span class="pk-sub"></span>
      <span class="pk-n">${d.lines.length} lines${usage[d.id] ? ` · you played it in ${usage[d.id]} games` : ""}</span></button>`).join("")}</div>
    <div class="row"><button class="btn pri" id="pk-go">Start drilling</button><button class="btn" id="pk-close">${first ? "Skip" : "Close"}</button></div>`;
  [...el.querySelectorAll(".pk")].forEach((b, i) => {
    b.querySelector("b").textContent = REP.decks[i].name.replace(/ \((White|Black)\)$/, "");
    b.querySelector(".pk-sub").textContent = REP.decks[i].blurb;
    b.onclick = () => { b.classList.toggle("on"); b.setAttribute("aria-pressed", b.classList.contains("on")); };
  });
  $("pk-go").onclick = async () => {
    const chosen = [...el.querySelectorAll(".pk.on")].map((b) => b.dataset.id);
    S.openings = chosen; await saveSettings(); el.hidden = true;
    window.DrillApp.update(await compose());
    if (chosen.length) window.DrillApp.selectDeck(chosen[0]);
    pushDecks();
  };
  $("pk-close").onclick = async () => { if (!S.openings) { S.openings = []; await saveSettings(); } el.hidden = true; };
  el.scrollIntoView({ block: "start" });
}

// ---------------- drill hand-off ----------------
async function showDrills() {
  $("setup").hidden = true; $("drillmain").hidden = false; $("opensettings").hidden = false; $("openpicker").hidden = false;
  window.DrillApp.start(await compose(), {
    progress,
    onProgress: async (p) => { progress = p; await store.set("progress", p); queuePush(); },
    explain: makeExplainer(aiCfg()),
  });
  setStatus(syncer ? "Progress syncs to your GitHub gist." : "Progress is saved in this browser. Turn on sync in Settings to use it on other devices.");
}

// ---------------- setup screen ----------------
function renderSetup(msg = "") {
  const el = $("setup"); el.hidden = false; $("drillmain").hidden = true;
  el.innerHTML = `
  <h2>Build drills from your own games</h2>
  <p>Stockfish runs right here in your browser: it goes through your recent games a few at a time, finds the mistakes you keep making, and turns them into spaced-repetition cards. You can start drilling openings straight away. Nothing is uploaded anywhere.</p>
  ${msg ? `<p class="warn">${esc(msg)}</p>` : ""}
  <div class="two">
    <div class="fld"><label for="u-cc">chess.com username</label><input id="u-cc" autocomplete="off" value="${esc(S.players.chesscom)}"></div>
    <div class="fld"><label for="u-li">lichess username</label><input id="u-li" autocomplete="off" value="${esc(S.players.lichess)}"></div>
  </div>
  <div class="fld"><label>…or upload PGN files</label>
    <div class="drop" id="drop">Drop .pgn files here, or <label style="text-decoration:underline;cursor:pointer">choose files<input id="pgnfile" type="file" accept=".pgn,text/plain" multiple hidden></label></div>
    <div class="hint" id="pgninfo"></div></div>
  <div class="two">
    <div class="fld"><label for="cnt">How many recent games</label><select id="cnt">${[50, 100, 200, 400].map((n) => `<option ${n === S.count ? "selected" : ""}>${n}</option>`).join("")}</select>
      <div class="hint">They're analysed ${BITE} at a time, newest first, while you drill.</div></div>
    <div class="fld"><label for="qual">Analysis depth</label><select id="qual">${Object.entries(QUALITY).map(([k, q]) => `<option value="${k}" ${k === S.quality ? "selected" : ""}>${q.label} (depth ${q.depth})</option>`).join("")}</select></div>
  </div>
  <div class="row"><button class="btn pri" id="go">Start</button><button class="btn" id="skip">Just drill openings</button><button class="btn" id="havesync">I use sync on another device</button></div>`;
  let pgnTexts = [];
  const takeFiles = async (files) => {
    for (const f of files) pgnTexts.push(...splitPgn(await f.text()));
    const owners = guessOwner(pgnTexts);
    $("pgninfo").innerHTML = pgnTexts.length ? `${pgnTexts.length} games loaded. Which player are you? <select id="pgnme">${owners.slice(0, 8).map((n) => `<option ${S.players.pgnNames.includes(n) ? "selected" : ""}>${esc(n)}</option>`).join("")}</select>` : "No games found in that file.";
  };
  $("pgnfile").onchange = (e) => takeFiles(e.target.files);
  const drop = $("drop");
  drop.ondragover = (e) => { e.preventDefault(); drop.classList.add("on"); };
  drop.ondragleave = () => drop.classList.remove("on");
  drop.ondrop = (e) => { e.preventDefault(); drop.classList.remove("on"); takeFiles(e.dataTransfer.files); };
  $("havesync").onclick = () => openSettings("sync");
  $("skip").onclick = async () => { count("openings-only", { event: true }); S.started = true; await saveSettings(); await showDrills(); openPicker(true); };
  $("go").onclick = async () => {
    S.players.chesscom = $("u-cc").value.trim(); S.players.lichess = $("u-li").value.trim();
    if ($("pgnme")) S.players.pgnNames = [$("pgnme").value];
    S.count = +$("cnt").value; S.quality = $("qual").value;
    if (!S.players.chesscom && !S.players.lichess && !pgnTexts.length) { $("pgninfo").textContent = "Enter a username or add a PGN file first, or choose “Just drill openings”."; return; }
    S.started = true; await saveSettings(); count("start-with-games", { event: true });
    const names = [S.players.chesscom, S.players.lichess, ...S.players.pgnNames].filter(Boolean);
    if (pgnTexts.length) await addPending(pgnTexts.map((p) => fromPgn(p, names)).filter(Boolean));
    await showDrills(); openPicker(true);
    runJob({ fetch: true });
  };
}

// ---------------- background job: fetch, then analyse a bite at a time ----------------
async function addPending(games) {
  const analysed = (await store.get("analysed")) || [], pending = (await store.get("pending")) || [];
  const have = new Set([...analysed, ...pending].map((g) => g.url));
  const fresh = games.filter((g) => !have.has(g.url));
  const all = [...pending, ...fresh].sort((a, b) => (a.end_time < b.end_time ? 1 : -1)).slice(0, Math.max(0, S.count - analysed.length));
  await store.set("pending", all);
  return fresh.length;
}
async function fetchGames() {
  const errs = [], log = (t) => renderPill(t);
  const got = [];
  if (S.players.chesscom) got.push(...await fetchChessCom(S.players.chesscom, { max: S.count, onStatus: log }).catch((e) => { errs.push("chess.com: " + e.message); return []; }));
  if (S.players.lichess) got.push(...await fetchLichess(S.players.lichess, { max: S.count, onStatus: log }).catch((e) => { errs.push("lichess: " + e.message); return []; }));
  const n = await addPending(got);
  if (errs.length) toast(errs.join(" "));
  return n;
}
async function runJob({ fetch = false } = {}) {
  if (job.running) return;
  job.running = true; job.paused = false;
  engine = engine || new Engine();
  const q = QUALITY[S.quality];
  try {
    renderPill("Downloading your games…");
    if (fetch) await fetchGames();
    let analysed = (await store.get("analysed")) || [], pending = (await store.get("pending")) || [];
    job.total = analysed.length + pending.length; job.done = analysed.length; renderPill();
    const cache = (await store.get("checkCache")) || {};
    while (pending.length && !job.paused) {
      const bite = pending.slice(0, BITE);
      for (const g of bite) {
        if (job.paused) break;
        const rec = await analyseGame(engine, g, { depth: q.depth });
        analysed.push(rec); pending = pending.filter((x) => x.url !== g.url); job.done++;
        await store.set("analysed", analysed); await store.set("pending", pending);
        renderPill();
      }
      await rebuildCards(analysed, cache, q);
    }
    if (!pending.length && analysed.length) { await rebuildCards(analysed, cache, q, true); }
  } catch (e) { console.error(e); toast("Analysis stopped: " + e.message); }
  job.running = false; renderPill();
  if (gameData) window.DrillApp.update(await compose());
  if (!job.paused && gameData) { count("cards-built", { event: true }); setStatus(`Done: ${gameData.cards.length} cards from your last ${gameData.games} games.`); pushDecks(); }
}
async function rebuildCards(analysed, cache, q, final = false) {
  const before = new Set(gameData ? gameData.cards.map((c) => c.id) : []);
  renderPill(`Checking new puzzles with Stockfish… (${job.done} of ${job.total} games analysed)`);
  const mined = mine(analysed);
  const built = await buildGameCards(engine, mined, { depth: q.check, perDeck: 60, cache });
  await store.set("checkCache", cache);
  // Cards that dropped out move to the archive (progress kept); none are lost.
  const live = new Set(built.cards.map((c) => c.id)), today = new Date().toISOString().slice(0, 10);
  const prevArch = (gameData && gameData.archive) || [];
  const dropped = ((gameData && gameData.cards) || []).filter((c) => !live.has(c.id)).map((c) => ({ ...c, was: c.deck, deck: "archive", archived: today }));
  const archive = [...prevArch.filter((c) => !live.has(c.id)), ...dropped];
  const ratings = analysed.slice(-30).map((g) => g.my_rating).filter(Boolean).sort((a, b) => a - b);
  gameData = { cards: built.cards, decks: built.decks, archive, facts: facts(mined.stats), games: analysed.length,
    rating: ratings.length ? ratings[Math.floor(ratings.length / 2)] : null };
  await store.set("gameData", gameData);
  window.DrillApp.update(await compose());
  const fresh = built.cards.filter((c) => !before.has(c.id));
  if (fresh.length) {
    const byDeck = {}; fresh.forEach((c) => (byDeck[c.deck] = (byDeck[c.deck] || 0) + 1));
    const top = Object.entries(byDeck).sort((a, b) => b[1] - a[1])[0][0];
    toast(`${fresh.length} new card${fresh.length === 1 ? "" : "s"} from your games.`, "Drill them", () => window.DrillApp.selectDeck(Object.keys(byDeck).length > 1 ? "all" : top));
  }
  if (final || job.done % 30 < BITE) pushDecks();
  renderPill();
}

// ---------------- settings dialog ----------------
function openSettings(tab = "") {
  const d = $("settings"), p = PROVIDERS;
  d.innerHTML = `<form method="dialog" class="dlg" id="sform">
    <h2>Settings</h2>
    <h3>Your games</h3>
    <div class="two"><div class="fld"><label for="s-cc">chess.com</label><input id="s-cc" value="${esc(S.players.chesscom)}"></div>
      <div class="fld"><label for="s-li">lichess</label><input id="s-li" value="${esc(S.players.lichess)}"></div></div>
    <div class="two"><div class="fld"><label for="s-cnt">Games to keep analysed</label><select id="s-cnt">${[50, 100, 200, 400].map((n) => `<option ${n === S.count ? "selected" : ""}>${n}</option>`).join("")}</select></div>
      <div class="fld"><label for="s-q">Analysis depth</label><select id="s-q">${Object.entries(QUALITY).map(([k, q]) => `<option value="${k}" ${k === S.quality ? "selected" : ""}>${q.label}</option>`).join("")}</select></div></div>
    <div class="row"><button class="btn" type="button" id="s-new">Check for new games</button><button class="btn" type="button" id="s-rebuild">Re-analyse everything</button></div>

    <h3 id="sync-h">Sync across devices (GitHub gist)</h3>
    <p class="hint">Progress and cards are stored in a secret gist in your own GitHub account. Create a <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener">fine-grained token</a> with only <b>Gists: read and write</b>, and paste it here. It stays in this browser and is only sent to GitHub.</p>
    <div class="fld"><label for="s-tok">GitHub token</label><input id="s-tok" type="password" autocomplete="off" value="${esc(S.sync && S.sync.token)}" placeholder="github_pat_…"></div>
    <div class="row"><button class="btn" type="button" id="s-sync">${S.sync ? "Save and sync now" : "Turn on sync"}</button>${S.sync ? '<button class="btn" type="button" id="s-unsync">Turn off sync</button>' : ""}<span class="hint" id="s-syncmsg"></span></div>

    <h3>Explain button (your own AI key)</h3>
    <p class="hint">Calls go straight from this browser to the provider. Use a key with a spending limit. Each explanation is a short request.</p>
    <div class="two"><div class="fld"><label for="s-prov">Provider</label><select id="s-prov">${Object.entries(p).map(([k, v]) => `<option value="${k}" ${k === S.ai.provider ? "selected" : ""}>${v.name}</option>`).join("")}</select></div>
      <div class="fld"><label for="s-model">Model</label><input id="s-model" value="${esc(S.ai.model)}" placeholder="${esc(p[S.ai.provider].defaultModel || "model id")}"></div></div>
    <div class="fld"><label for="s-key">API key</label><input id="s-key" type="password" autocomplete="off" value="${esc(S.ai.key || sessionKey.ai || "")}" placeholder="${esc(p[S.ai.provider].keyHint)}"></div>
    <label><input type="checkbox" id="s-rem" ${S.ai.remember ? "checked" : ""}> Remember the key in this browser</label>

    <h3>Your data</h3>
    <div class="row"><button class="btn" type="button" id="s-exp">Export backup</button><label class="btn">Import backup<input type="file" id="s-imp" accept="application/json" hidden></label><button class="btn" type="button" id="s-reset">Delete everything</button></div>
    <div class="row"><button class="btn pri" value="close" id="s-close">Done</button></div>
  </form>`;
  d.showModal();
  if (tab === "sync") $("s-tok").focus();
  $("s-prov").onchange = () => { $("s-model").placeholder = p[$("s-prov").value].defaultModel || "model id"; $("s-key").placeholder = p[$("s-prov").value].keyHint; };
  const keepGames = async () => { S.players.chesscom = $("s-cc").value.trim(); S.players.lichess = $("s-li").value.trim(); S.count = +$("s-cnt").value; S.quality = $("s-q").value; await saveSettings(); };
  $("s-new").onclick = async () => { await keepGames(); d.close(); if (!$("drillmain").hidden || decksData) runJob({ fetch: true }); };
  $("s-rebuild").onclick = async () => {
    await keepGames(); d.close();
    // Analysed games keep every move and clock, so they can be re-queued without downloading again.
    const a = (await store.get("analysed")) || [];
    await store.set("pending", a.map(({ plies, eco, opening, depth, ...g }) => ({ ...g, moves: plies.map((x) => x.san), clocks: plies.map((x) => x.clock) })));
    await store.del("analysed"); await store.del("checkCache");
    runJob({ fetch: true });
  };
  $("s-sync").onclick = async () => {
    const tok = $("s-tok").value.trim(); if (!tok) { $("s-syncmsg").textContent = "Paste a token first."; return; }
    S.sync = { token: tok, gistId: S.sync && S.sync.token === tok ? S.sync.gistId : null }; await saveSettings();
    $("s-syncmsg").textContent = "Connecting…";
    const r = await startSync();
    if (!syncer || !S.sync.gistId) { $("s-syncmsg").textContent = "That didn't work. Check the token's Gists permission."; return; }
    $("s-syncmsg").textContent = "Sync is on."; count("sync-on", { event: true });
    if (gameData || S.openings) { if (!r || !r.decks || r.decks.v !== 2) await pushDecks(); progress = await syncer.pushProgress(progress); await store.set("progress", progress); }
    // Always let sync take you into the tool; with nothing to load yet, offer the opening picker.
    const wasSetup = !$("setup").hidden;
    S.started = true; await saveSettings(); d.close(); await showDrills();
    if (wasSetup && !gameData && !(S.openings && S.openings.length)) openPicker(true);
  };
  if ($("s-unsync")) $("s-unsync").onclick = async () => { S.sync = null; syncer = null; await saveSettings(); d.close(); setStatus("Sync is off. Progress is saved in this browser."); };
  $("s-exp").onclick = async () => {
    const blob = new Blob([JSON.stringify({ version: 2, gameData, openings: S.openings, progress, settings: { ...S, ai: { ...S.ai, key: "" }, sync: null } })], { type: "application/json" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `chess-drills-${new Date().toISOString().slice(0, 10)}.json`; a.click();
  };
  $("s-imp").onchange = async (e) => {
    try { const j = JSON.parse(await e.target.files[0].text());
      if (j.gameData) { gameData = j.gameData; await store.set("gameData", gameData); }
      if (j.openings) S.openings = j.openings;
      progress = mergeProgress(progress, j.progress || {}); await store.set("progress", progress);
      S.started = true; await saveSettings(); d.close(); await showDrills(); }
    catch (x) { alert("That file isn't a Chess Drills backup."); }
  };
  $("s-reset").onclick = async () => { if (!confirm("Delete all cards, progress and settings from this browser? Your gist, if any, is kept.")) return; await store.clear(); localStorage.clear(); location.reload(); };
  $("sform").onsubmit = async () => {
    S.ai = { provider: $("s-prov").value, model: $("s-model").value.trim(), remember: $("s-rem").checked, key: $("s-rem").checked ? $("s-key").value.trim() : "" };
    sessionKey.ai = $("s-rem").checked ? null : $("s-key").value.trim();
    await keepGames(); await saveSettings();
    window.DrillApp.setExplain(makeExplainer(aiCfg()));
  };
}

// ---------------- boot ----------------
(async () => {
  count();
  await loadOpenings("data/openings.tsv");
  REP = await (await fetch("data/repertoire.json")).json();
  await loadState();
  $("opensettings").onclick = () => openSettings();
  $("openpicker").onclick = () => openPicker(false);
  if (S.sync && S.sync.token) await startSync();
  if (S.started || gameData) {
    await showDrills();
    const pending = (await store.get("pending")) || [];
    if (pending.length) runJob(); // resume where the last visit stopped
  } else renderSetup();
})();
