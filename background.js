import { getSettings, isActiveNow, GRACE_MS, listedDomainFor } from "./settings.js";

const RULE_ID = 1;
const BLOCK_PAGE = chrome.runtime.getURL("blocked.html");

// Grace state lives in session storage: { "facebook.com": <expires at ms> }. Cleared on browser restart.
async function getGrace() {
  const { grace = {} } = await chrome.storage.session.get("grace");
  return grace;
}

async function applyRules() {
  const s = await getSettings();
  const active = s.sites.length > 0 && isActiveNow(s.schedule);
  const now = Date.now();
  const graced = Object.entries(await getGrace())
    .filter(([, until]) => until > now)
    .map(([domain]) => domain);

  const redirect = s.redirectUrl
    ? { url: s.redirectUrl }
    : // Pass the original URL after "#" so the block page can show which site it was.
      { regexSubstitution: BLOCK_PAGE + "#\\0" };

  const condition = {
    regexFilter: "^.+$",
    requestDomains: s.sites, // also matches subdomains (m.facebook.com, web.facebook.com)
    resourceTypes: ["main_frame"],
  };
  if (graced.length) condition.excludedRequestDomains = graced;

  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: [RULE_ID],
    addRules: active ? [{ id: RULE_ID, priority: 1, action: { type: "redirect", redirect }, condition }] : [],
  });

  await chrome.action.setBadgeText({ text: active ? "" : "off" });
  await chrome.action.setBadgeBackgroundColor({ color: "#8a8a8a" });
}

async function startGrace(domain) {
  const s = await getSettings();
  if (!s.sites.includes(domain)) return;
  const until = Date.now() + GRACE_MS;
  const grace = await getGrace();
  grace[domain] = until;
  await chrome.storage.session.set({ grace });
  await chrome.alarms.create("grace:" + domain, { when: until });
  await applyRules();
}

async function endGrace(domain) {
  const grace = await getGrace();
  delete grace[domain];
  await chrome.storage.session.set({ grace });
  await applyRules();

  // The rule only stops new page loads, so send tabs still open on that site back to the block page.
  const s = await getSettings();
  if (!s.sites.includes(domain) || !isActiveNow(s.schedule)) return;
  for (const tab of await chrome.tabs.query({})) {
    let host;
    try {
      host = new URL(tab.url).hostname;
    } catch {
      continue;
    }
    if (listedDomainFor(host, [domain])) {
      const url = s.redirectUrl || `${BLOCK_PAGE}?expired=1#${tab.url}`;
      chrome.tabs.update(tab.id, { url });
    }
  }
}

function ensureAlarm() {
  // Re-check every minute so the schedule switches on/off on time.
  chrome.alarms.create("tick", { periodInMinutes: 1 });
}

chrome.runtime.onInstalled.addListener(() => {
  ensureAlarm();
  applyRules();
});
chrome.runtime.onStartup.addListener(() => {
  ensureAlarm();
  applyRules();
});
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name.startsWith("grace:")) endGrace(alarm.name.slice("grace:".length));
  else applyRules();
});
chrome.storage.onChanged.addListener((_, area) => {
  if (area === "sync") applyRules();
});
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type !== "grace") return;
  startGrace(msg.domain).then(() => sendResponse({ ok: true }));
  return true; // keep the channel open for the async reply
});
