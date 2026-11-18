// Stockfish (WASM, single-threaded lite build) in a Web Worker, speaking UCI.
// analyse(fen, {depth, multipv}) -> [{cp, mate, pv}] best first; cp is from White's point of view
// (mate folded to +-MATE like the Python tooling: MATE - n for mate in n moves).
export const MATE = 10000;

export class Engine {
  constructor(url = "vendor/stockfish-19-lite-single.js") {
    this.w = new Worker(url);
    this.listeners = [];
    this.w.onmessage = (e) => { const line = typeof e.data === "string" ? e.data : ""; this.listeners.forEach((f) => f(line)); };
    this.queue = Promise.resolve();
    this.ready = this._cmdUntil("uci", (l) => l === "uciok").then(() => this._isready());
  }
  _send(c) { this.w.postMessage(c); }
  _cmdUntil(cmd, done, onLine) {
    return new Promise((res) => {
      const f = (l) => { onLine && onLine(l); if (done(l)) { this.listeners = this.listeners.filter((x) => x !== f); res(l); } };
      this.listeners.push(f); this._send(cmd);
    });
  }
  _isready() { return this._cmdUntil("isready", (l) => l === "readyok"); }
  // Serialise searches: one at a time.
  analyse(fen, { depth = 12, multipv = 1 } = {}) {
    const run = async () => {
      await this.ready;
      this._send(`setoption name MultiPV value ${multipv}`);
      this._send(`position fen ${fen}`);
      const best = {};
      const white = fen.split(" ")[1] === "w";
      await this._cmdUntil(`go depth ${depth}`, (l) => l.startsWith("bestmove"), (l) => {
        if (!l.startsWith("info") || !l.includes(" pv ")) return;
        const m = / multipv (\d+)/.exec(l), k = m ? +m[1] : 1;
        const sc = / score (cp|mate) (-?\d+)/.exec(l); if (!sc) return;
        let cp, mate = null;
        if (sc[1] === "cp") cp = +sc[2]; else { mate = +sc[2]; cp = mate > 0 ? MATE - mate : -MATE - mate; }
        if (!white) { cp = -cp; if (mate !== null) mate = -mate; }
        best[k] = { cp, mate, pv: l.split(" pv ")[1].trim().split(" ") };
      });
      return Object.keys(best).sort((a, b) => a - b).map((k) => best[k]);
    };
    const p = this.queue.then(run, run); this.queue = p.catch(() => {}); return p;
  }
  terminate() { this.w.terminate(); }
}
