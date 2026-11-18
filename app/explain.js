// "Explain" with the user's own AI key. Calls go straight from this browser to the provider;
// there is no server in between. Raw HTTP (fetch + SSE) because the site has no build step and
// loads no third-party scripts.
const PROVIDERS = {
  anthropic: { name: "Anthropic (Claude)", defaultModel: "claude-opus-5-5", keyHint: "sk-ant-…" },
  openrouter: { name: "OpenRouter (many models)", defaultModel: "", keyHint: "sk-or-…" },
  openai: { name: "OpenAI", defaultModel: "", keyHint: "sk-…" },
};
export { PROVIDERS };

const err = (code, message) => Object.assign(new Error(message), { code });

async function* sse(res) {
  const rd = res.body.getReader(), dec = new TextDecoder(); let buf = "";
  for (;;) {
    const { value, done } = await rd.read(); if (done) break;
    buf += dec.decode(value, { stream: true });
    let i; while ((i = buf.indexOf("\n\n")) >= 0) {
      const chunk = buf.slice(0, i); buf = buf.slice(i + 2);
      const data = chunk.split("\n").filter((l) => l.startsWith("data:")).map((l) => l.slice(5).trim()).join("\n");
      if (data && data !== "[DONE]") { try { yield JSON.parse(data); } catch (e) { /* keep-alive or partial */ } }
    }
  }
}
function httpError(r, body) {
  if (r.status === 401 || r.status === 403) return err("bad_key", "The provider rejected the key.");
  if (r.status === 429) return err("rate_limited", "Rate limited.");
  return err("upstream_error", `Provider error ${r.status}: ${(body || "").slice(0, 200)}`);
}

/** Returns fn(prompt, {signal, onText}) -> Promise<{text}> for the drill page, or null without a key. */
export function makeExplainer(cfg) {
  if (!cfg || !cfg.key) return null;
  const provider = cfg.provider || "anthropic", model = cfg.model || PROVIDERS[provider].defaultModel;
  return async (prompt, { signal, onText } = {}) => {
    let text = "";
    try {
      if (provider === "anthropic") {
        const r = await fetch("https://api.anthropic.com/v1/messages", { method: "POST", signal, headers: {
          "content-type": "application/json", "x-api-key": cfg.key, "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true", "anthropic-beta": "server-side-fallback-2026-07-01" },
          // Adaptive thinking is on by default for this model; fallbacks: "default" retries a refused request on a fallback model.
          body: JSON.stringify({ model, max_tokens: 4000, stream: true, fallbacks: "default", messages: [{ role: "user", content: prompt }] }) });
        if (!r.ok) throw httpError(r, await r.text());
        for await (const ev of sse(r)) {
          if (ev.type === "content_block_delta" && ev.delta && ev.delta.type === "text_delta") { text += ev.delta.text; onText && onText({ text, delta: ev.delta.text }); }
          if (ev.type === "message_delta" && ev.delta && ev.delta.stop_reason === "refusal") throw err("refused", "The model declined this one.");
          if (ev.type === "error") throw err("upstream_error", (ev.error && ev.error.message) || "Provider error.");
        }
      } else {
        if (!model) throw err("no_model", "Choose a model for this provider in Settings.");
        const url = provider === "openrouter" ? "https://openrouter.ai/api/v1/chat/completions" : "https://api.openai.com/v1/chat/completions";
        const r = await fetch(url, { method: "POST", signal, headers: { "content-type": "application/json", Authorization: `Bearer ${cfg.key}` },
          body: JSON.stringify({ model, stream: true, messages: [{ role: "user", content: prompt }] }) });
        if (!r.ok) throw httpError(r, await r.text());
        for await (const ev of sse(r)) {
          const d = ev.choices && ev.choices[0] && ev.choices[0].delta && ev.choices[0].delta.content;
          if (d) { text += d; onText && onText({ text, delta: d }); }
        }
      }
      if (!text) throw err("empty_completion", "No answer came back.");
      return { text };
    } catch (e) {
      if (e.name === "AbortError") throw Object.assign(err("cancelled", "Stopped."), { text });
      if (!e.code) throw Object.assign(err("upstream_error", "Couldn't reach the provider. Check your connection."), { text });
      throw Object.assign(e, { text });
    }
  };
}
