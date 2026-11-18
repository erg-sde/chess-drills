// Visitor counts with GoatCounter (privacy-friendly: no cookies, no personal data).
// Uses GoatCounter's documented /count endpoint directly instead of loading its script, so the page
// still runs no third-party code. Never sends usernames, games, keys or anything typed into the page.
export const GOATCOUNTER = "edmann13"; // dashboard: https://edmann13.goatcounter.com

const off = () => !GOATCOUNTER || navigator.doNotTrack === "1" || window.doNotTrack === "1" ||
  ["localhost", "127.0.0.1", ""].includes(location.hostname);

/** count() records a page view; count("event-name", {event: true}) records an event. */
export function count(path = location.pathname, { title = document.title, event = false } = {}) {
  if (off()) return;
  const q = new URLSearchParams({ p: path, t: title, s: `${screen.width},${screen.height},${devicePixelRatio || 1}`, rnd: Math.random().toString(36).slice(2) });
  if (event) q.set("e", "true");
  else if (document.referrer && !document.referrer.startsWith(location.origin)) q.set("r", document.referrer);
  const url = `https://${GOATCOUNTER}.goatcounter.com/count?${q}`;
  if (!(navigator.sendBeacon && navigator.sendBeacon(url))) { const i = new Image(); i.src = url; }
}
