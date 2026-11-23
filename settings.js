export const DEFAULTS = {
  sites: ["facebook.com", "instagram.com", "tiktok.com", "x.com", "twitter.com"],
  redirectUrl: "", // empty = built-in blocked.html page
  schedule: { enabled: false, days: [1, 2, 3, 4, 5], start: "09:00", end: "18:00" },
};

export function getSettings() {
  return chrome.storage.sync.get(DEFAULTS);
}

const toMinutes = (hhmm) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

// Schedule off = block all the time. Windows that cross midnight (22:00–02:00) work too.
export function isActiveNow(schedule, now = new Date()) {
  if (!schedule.enabled) return true;
  if (!schedule.days.includes(now.getDay())) return false;
  const mins = now.getHours() * 60 + now.getMinutes();
  const start = toMinutes(schedule.start);
  const end = toMinutes(schedule.end);
  return start <= end ? mins >= start && mins < end : mins >= start || mins < end;
}

// "https://www.Facebook.com/feed" -> "facebook.com"; returns "" if it isn't a domain.
export function normalizeDomain(input) {
  const host = input
    .trim()
    .toLowerCase()
    .replace(/^[a-z][a-z0-9+.-]*:\/\//, "")
    .replace(/^www\./, "")
    .split(/[/?#:]/)[0];
  return /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(host) ? host : "";
}

export const todayKey = () => "count-" + new Date().toLocaleDateString("en-CA");

export const GRACE_MS = 60_000;

// Which block-list entry covers this host? "m.facebook.com" -> "facebook.com"; undefined if none.
export const listedDomainFor = (host, sites) =>
  sites.find((d) => host === d || host.endsWith("." + d));
