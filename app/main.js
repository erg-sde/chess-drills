// App shell: first-run setup, the analysis pipeline, settings (sync, AI key, data) and the hand-off
// to the drill page (window.DrillApp, defined in index.html).
import { Engine } from "./engine.js";
import { loadOpenings } from "./core.js";
import { fetchChessCom, fetchLichess, splitPgn, fromPgn, guessOwner } from "./games.js";
import { analyseGame } from "./analyze.js";
import { mine } from "./mine.js";
import { buildDecks, facts } from "./build.js";
import { store } from "./store.js";
import { GistSync, mergeProgress } from "./sync.js";
import { makeExplainer, PROVIDERS } from "./explain.js";

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const QUALITY = { quick: { depth: 10, check: 12, label: "Quick" }, standard: { depth: 12, check: 14, label: "Standard" }, deep: { depth: 14, check: 16, label: "Deep" } };

let S = { players: { chesscom: "", lichess: "", pgnNames: [] }, count: 100, quality: "standard", ai: { provider: "anthropic", key: "", model: "", remember: true }, sync: null };
let engine = null, progress = {}, decksData = null, syncer = null, syncTimer = 0;
const sessionKey = { ai: null };

// ---------------- settings persistence ----------------
async function loadSettings() {
  const s = await store.get("settings");
  if (s) S = { ...S, ...s, players: { ...S.players, ...(s.players || {}) }, ai: { ...S.ai, ...(s.ai || {}) } };
  progress = (await store.get("progress")) || {};
  decksData = (await store.get("decks")) || null;
}
const saveSettings = () => {
  const copy = JSON.parse(JSON.stringify(S));
  if (!S.ai.remember) copy.ai.key = ""; // key kept for this tab only
  return store.set("settings", copy);
};
const aiCfg = () => ({ ...S.ai, key: S.ai.key || sessionKey.ai });

// ---------------- sync ----------------
function setStatus(t) { try { window.DrillApp.setStatus(t); } catch (e) { /* drill page not up yet */ } }
async function startSync() {
  if (!S.sync || !S.sync.token) { syncer = null; setStatus("Progress is saved in this browser. Turn on sync in Settings to use it on other devices."); return; }
  syncer = new GistSync(S.sync.token, S.sync.gistId);
  try {
    S.sync.gistId = await syncer.connect(); await saveSettings();
    const remote = await syncer.pull();
    if (!decksData && remote.decks) { decksData = remote.decks; await store.set("decks", decksData); }
    progress = mergeProgress(progress, remote.progress); await store.set("progress", progress);
    setStatus("Synced with your GitHub gist.");
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
// Pull on focus: another device may have reviewed cards.
document.addEventListener("visibilitychange", async () => {
  if (document.visibilityState !== "visible" || !syncer || !decksData) return;
  try { const r = await syncer.pull(); progress = mergeProgress(progress, r.progress); await store.set("progress", progress); window.DrillApp.setProgress(progress); } catch (e) { /* offline */ }
});

// ---------------- drill hand-off ----------------
function showDrills() {
  $("setup").hidden = true; $("drillmain").hidden = false; $("opensettings").hidden = false;
  window.DrillApp.start(decksData, {
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
  <p>Stockfish runs right here in your browser: it goes through your recent games, finds the mistakes you keep making, and turns them into spaced-repetition cards. Nothing is uploaded anywhere.</p>
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
      <div class="hint">100 games take about 2 minutes on a laptop, longer on a phone.</div></div>
    <div class="fld"><label for="qual">Analysis depth</label><select id="qual">${Object.entries(QUALITY).map(([k, q]) => `<option value="${k}" ${k === S.quality ? "selected" : ""}>${q.label} (depth ${q.depth})</option>`).join("")}</select></div>
  </div>
  <div class="row"><button class="btn pri" id="go">Build my drills</button><button class="btn" id="havesync">I use sync on another device</button></div>
  <div class="prog" id="prog" hidden><div id="pstage"></div><div class="pbar"><i id="pbar"></i></div><div class="log" id="plog"></div></div>`;
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
  $("go").onclick = async () => {
    S.players.chesscom = $("u-cc").value.trim(); S.players.lichess = $("u-li").value.trim();
    if ($("pgnme")) S.players.pgnNames = [$("pgnme").value];
    S.count = +$("cnt").value; S.quality = $("qual").value;
    if (!S.players.chesscom && !S.players.lichess && !pgnTexts.length) { $("pgninfo").textContent = "Enter a username or add a PGN file first."; return; }
    await saveSettings();
    $("go").disabled = true;
    try { await runPipeline({ pgnTexts }); showDrills(); }
    catch (e) { console.error(e); renderSetup(e.message || String(e)); }
  };
}

// ---------------- pipeline ----------------
function progressUI() {
  const box = $("prog") || (() => { const d = document.createElement("div"); d.id = "prog"; d.className = "prog"; $("status").after(d); d.innerHTML = '<div id="pstage"></div><div class="pbar"><i id="pbar"></i></div><div class="log" id="plog"></div>'; return d; })();
  box.hidden = false;
  return {
    stage: (t) => { $("pstage").textContent = t; },
    bar: (f) => { $("pbar").style.width = Math.round(100 * f) + "%"; },
    log: (t) => { const l = $("plog"); l.textContent += (l.textContent ? "\n" : "") + t; l.scrollTop = l.scrollHeight; },
  };
}
const fmtTime = (s) => (s < 90 ? `${Math.round(s)} s` : `${Math.round(s / 60)} min`);

async function runPipeline({ pgnTexts = [], onlyNew = false } = {}) {
  const ui = progressUI(), q = QUALITY[S.quality];
  engine = engine || new Engine();
  let analysed = (await store.get("analysed")) || [];
  const have = new Set(analysed.map((g) => g.url));
  const since = onlyNew && analysed.length ? analysed.map((g) => g.end_time).sort().pop() : null;

  ui.stage("Downloading games…"); ui.bar(0);
  let raw = [];
  const sources = [];
  if (S.players.chesscom) sources.push(fetchChessCom(S.players.chesscom, { max: S.count, since, onStatus: ui.log }).catch((e) => { ui.log("chess.com: " + e.message); return []; }));
  if (S.players.lichess) sources.push(fetchLichess(S.players.lichess, { max: S.count, since, onStatus: ui.log }).catch((e) => { ui.log("lichess: " + e.message); return []; }));
  for (const r of await Promise.all(sources)) raw = raw.concat(r);
  const names = [S.players.chesscom, S.players.lichess, ...S.players.pgnNames].filter(Boolean);
  raw = raw.concat(pgnTexts.map((p) => fromPgn(p, names)).filter(Boolean));
  raw.sort((a, b) => (a.end_time < b.end_time ? 1 : -1));
  raw = raw.slice(0, S.count).filter((g) => !have.has(g.url));
  if (!raw.length && !analysed.length) throw new Error("No games found. Check the username, or the player name in your PGN file.");
  ui.log(`${raw.length} new game${raw.length === 1 ? "" : "s"} to analyse${analysed.length ? `, ${analysed.length} already done` : ""}.`);

  const totalPlies = raw.reduce((a, g) => a + g.moves.length, 0) || 1;
  let donePlies = 0; const t0 = performance.now();
  for (let i = 0; i < raw.length; i++) {
    const g = raw[i];
    ui.stage(`Analysing game ${i + 1} of ${raw.length} (vs ${g.opponent})`);
    const rec = await analyseGame(engine, g, { depth: q.depth, onPly: (n) => {
      const f = (donePlies + n) / totalPlies, el = (performance.now() - t0) / 1000;
      ui.bar(0.85 * f); if (f > 0.03) $("pstage").textContent = `Analysing game ${i + 1} of ${raw.length}: about ${fmtTime(el / f - el)} left`;
    } });
    donePlies += g.moves.length;
    analysed.push(rec);
    if (i % 5 === 4 || i === raw.length - 1) await store.set("analysed", analysed); // resumable
  }
  analysed.sort((a, b) => (a.end_time < b.end_time ? 1 : -1));
  analysed = analysed.slice(0, Math.max(S.count, 50) * 2); // keep the cache bounded
  await store.set("analysed", analysed);

  ui.stage("Finding the mistakes you repeat…"); ui.bar(0.86);
  const mined = mine(analysed);
  const rep = await (await fetch("data/repertoire.json")).json();
  ui.stage("Checking every puzzle with Stockfish…");
  const built = await buildDecks(engine, mined, analysed, rep, { depth: q.check, perDeck: 40, sinceText: `in your last ${analysed.length} games`,
    onProgress: (d, n, label) => { ui.bar(0.86 + 0.14 * Math.min(1, d / n)); $("pstage").textContent = `${label}: ${d} of about ${n}`; } });

  // Archive cards that dropped out, so progress on them isn't lost.
  const live = new Set(built.cards.map((c) => c.id)), today = new Date().toISOString().slice(0, 10);
  const archived = ((decksData && decksData.cards) || []).filter((c) => !live.has(c.id)).map((c) => (c.deck === "archive" ? c : { ...c, was: c.deck, deck: "archive", archived: today }));
  const ratings = analysed.slice(0, 30).map((g) => g.my_rating).filter(Boolean).sort((a, b) => a - b);
  decksData = {
    generated: today, cards: built.cards.concat(archived),
    decks: built.decks.concat(archived.length ? [{ id: "archive", name: "Archive", blurb: "Cards from earlier builds. Not in normal sessions; pick this deck to drill them." }] : []),
    facts: facts(mined.stats), rating: ratings.length ? ratings[Math.floor(ratings.length / 2)] : null,
    subtitle: `${built.cards.length} cards from your last ${analysed.length} games${archived.length ? `, plus ${archived.length} archived` : ""}.`,
    method: `Every move of your last ${analysed.length} games was evaluated by Stockfish 19 (lite) at depth ${q.depth} in your browser, and every card was re-checked at depth ${q.check}. A blunder loses 30+ points of win probability in one move (Lichess's scale). Puzzles are kept only when the answer is clearly best; "safe move" cards accept any move within 0.6 pawns of the best.`,
  };
  await store.set("decks", decksData);
  ui.bar(1); ui.stage("Done.");
  if (syncer) { try { await syncer.pushDecks(decksData); } catch (e) { ui.log("Couldn't upload cards to your gist: " + e.message); } }
}

// ---------------- settings dialog ----------------
function openSettings(tab = "") {
  const d = $("settings"), p = PROVIDERS;
  d.innerHTML = `<form method="dialog" class="dlg" id="sform">
    <h2>Settings</h2>
    <h3>Your games</h3>
    <div class="two"><div class="fld"><label for="s-cc">chess.com</label><input id="s-cc" value="${esc(S.players.chesscom)}"></div>
      <div class="fld"><label for="s-li">lichess</label><input id="s-li" value="${esc(S.players.lichess)}"></div></div>
    <div class="row"><button class="btn" type="button" id="s-new">Add new games and rebuild</button><button class="btn" type="button" id="s-rebuild">Rebuild from scratch</button></div>

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
  const keepGames = async () => { S.players.chesscom = $("s-cc").value.trim(); S.players.lichess = $("s-li").value.trim(); await saveSettings(); };
  $("s-new").onclick = async () => { await keepGames(); d.close(); await rebuild(true); };
  $("s-rebuild").onclick = async () => { await keepGames(); d.close(); await store.del("analysed"); await rebuild(false); };
  $("s-sync").onclick = async () => {
    const tok = $("s-tok").value.trim(); if (!tok) { $("s-syncmsg").textContent = "Paste a token first."; return; }
    S.sync = { token: tok, gistId: S.sync && S.sync.token === tok ? S.sync.gistId : null }; await saveSettings();
    $("s-syncmsg").textContent = "Connecting…";
    const r = await startSync();
    if (!syncer || !S.sync.gistId) { $("s-syncmsg").textContent = "That didn't work. Check the token's Gists permission."; return; }
    $("s-syncmsg").textContent = "Sync is on.";
    if (decksData) { if (!r || !r.decks) await syncer.pushDecks(decksData); progress = await syncer.pushProgress(progress); await store.set("progress", progress); }
    if (decksData) { d.close(); showDrills(); } // also covers a new device that just pulled its cards
  };
  if ($("s-unsync")) $("s-unsync").onclick = async () => { S.sync = null; syncer = null; await saveSettings(); d.close(); setStatus("Sync is off. Progress is saved in this browser."); };
  $("s-exp").onclick = async () => {
    const blob = new Blob([JSON.stringify({ version: 1, decks: decksData, progress, settings: { ...S, ai: { ...S.ai, key: "" }, sync: null } })], { type: "application/json" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `chess-drills-${new Date().toISOString().slice(0, 10)}.json`; a.click();
  };
  $("s-imp").onchange = async (e) => {
    try { const j = JSON.parse(await e.target.files[0].text()); if (j.decks) { decksData = j.decks; await store.set("decks", decksData); }
      progress = mergeProgress(progress, j.progress || {}); await store.set("progress", progress); d.close(); showDrills(); }
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
async function rebuild(onlyNew) {
  $("drillmain").hidden = false;
  try { await runPipeline({ onlyNew }); showDrills(); } catch (e) { setStatus("Rebuild failed: " + e.message); }
  const p = $("prog"); if (p) p.hidden = true;
}

// ---------------- boot ----------------
(async () => {
  await loadOpenings("data/openings.tsv");
  await loadSettings();
  $("opensettings").onclick = () => openSettings();
  if (S.sync && S.sync.token) await startSync();
  if (decksData) showDrills(); else renderSetup();
})();
