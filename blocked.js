import { getSettings, todayKey, listedDomainFor } from "./settings.js";

const $ = (id) => document.getElementById(id);
const expired = new URLSearchParams(location.search).has("expired");

// The redirect rule puts the original URL after "#".
let originalUrl, host;
try {
  originalUrl = new URL(decodeURIComponent(location.hash.slice(1))).href;
  host = new URL(originalUrl).hostname.replace(/^www\./, "");
  $("site").replaceChildren(
    expired ? "Your minute on " : "You tried to open ",
    Object.assign(document.createElement("b"), { textContent: host }),
    expired ? " is over." : "."
  );
} catch {}

if (expired) $("title").textContent = "Time's up.";

// Count real blocks only: not reloads, not "time's up" kicks.
const key = todayKey();
const isReload = performance.getEntriesByType("navigation")[0]?.type === "reload";
const { [key]: prev = 0 } = await chrome.storage.local.get(key);
const count = isReload || expired ? prev : prev + 1;
if (count !== prev) await chrome.storage.local.set({ [key]: count });
$("count").textContent = `Blocked ${count} time${count === 1 ? "" : "s"} today.`;

// Grace button: allow this site for 1 minute, then it gets blocked again.
const { sites } = await getSettings();
const domain = host && listedDomainFor(host, sites);
if (domain) {
  const btn = $("grace");
  btn.hidden = false;
  btn.addEventListener("click", async () => {
    btn.disabled = true;
    btn.textContent = "Opening…";
    await chrome.runtime.sendMessage({ type: "grace", domain });
    location.replace(originalUrl);
  });
}

const tick = () => {
  $("clock").textContent = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};
tick();
setInterval(tick, 10_000);
