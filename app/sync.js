// Progress sync through a secret GitHub Gist the user owns ("bring your own storage").
// The token stays in this browser and is only ever sent to api.github.com.
const API = "https://api.github.com", DESC = "chess-drills sync (do not edit by hand)";
const F_PROGRESS = "chess-drills-progress.json", F_DECKS = "chess-drills-decks.json";

/** Merge two progress maps. Per card the newer change wins; reviews the other device made that the
 *  winner hasn't seen are added to its history and counters, so nothing done offline is lost. */
export function mergeProgress(a = {}, b = {}) {
  const out = {};
  for (const id of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const x = a[id], y = b[id];
    if (!x || !y) { out[id] = { ...(x || y) }; continue; }
    const [win, lose] = (x.t || 0) >= (y.t || 0) ? [x, y] : [y, x];
    const seen = new Set((win.h || []).map((e) => e[0]));
    const extra = (lose.h || []).filter((e) => !seen.has(e[0]));
    out[id] = { ...win, r: (win.r || 0) + extra.filter((e) => e[1]).length, w: (win.w || 0) + extra.filter((e) => !e[1]).length,
      h: [...(win.h || []), ...extra].sort((p, q) => p[0] - q[0]).slice(-60) };
  }
  return out;
}

export class GistSync {
  constructor(token, gistId = null) { this.token = token; this.id = gistId; }
  async _req(path, opts = {}) {
    const r = await fetch(API + path, { ...opts, headers: { Accept: "application/vnd.github+json", Authorization: `Bearer ${this.token}`,
      "X-GitHub-Api-Version": "2022-11-28", ...(opts.body ? { "Content-Type": "application/json" } : {}) } });
    if (r.status === 401) throw Object.assign(new Error("GitHub rejected the token."), { code: "bad_token" });
    if (r.status === 403 || r.status === 404) throw Object.assign(new Error("The token can't read or write gists. It needs the Gists permission (read and write)."), { code: "no_scope" });
    if (!r.ok) throw new Error(`GitHub answered ${r.status}.`);
    return r.json();
  }
  /** Find this app's gist among the user's gists, or create a secret one. */
  async connect() {
    if (!this.id) {
      for (let page = 1; page <= 5 && !this.id; page++) {
        const list = await this._req(`/gists?per_page=100&page=${page}`);
        const hit = list.find((g) => g.description === DESC && g.files[F_PROGRESS]);
        if (hit) this.id = hit.id;
        if (list.length < 100) break;
      }
    }
    if (!this.id) {
      const g = await this._req("/gists", { method: "POST", body: JSON.stringify({ description: DESC, public: false,
        files: { [F_PROGRESS]: { content: JSON.stringify({ version: 1, progress: {} }) } } }) });
      this.id = g.id;
    }
    return this.id;
  }
  async _file(g, name) {
    const f = g.files[name]; if (!f) return null;
    const text = f.truncated ? await (await fetch(f.raw_url)).text() : f.content;
    try { return JSON.parse(text); } catch (e) { return null; }
  }
  async pull() {
    const g = await this._req(`/gists/${this.id}`);
    return { progress: ((await this._file(g, F_PROGRESS)) || {}).progress || {}, decks: await this._file(g, F_DECKS) };
  }
  /** Read, merge, write: a device with stale data can't overwrite newer progress. Returns the merged map. */
  async pushProgress(local) {
    const { progress: remote } = await this.pull();
    const merged = mergeProgress(local, remote);
    await this._req(`/gists/${this.id}`, { method: "PATCH", body: JSON.stringify({ files: { [F_PROGRESS]: { content: JSON.stringify({ version: 1, updated: Date.now(), progress: merged }) } } }) });
    return merged;
  }
  async pushDecks(decks) {
    await this._req(`/gists/${this.id}`, { method: "PATCH", body: JSON.stringify({ files: { [F_DECKS]: { content: JSON.stringify(decks) } } }) });
  }
}
