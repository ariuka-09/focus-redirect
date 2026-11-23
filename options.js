import { getSettings, normalizeDomain } from "./settings.js";

const $ = (id) => document.getElementById(id);
const DAYS = [[1, "Mon"], [2, "Tue"], [3, "Wed"], [4, "Thu"], [5, "Fri"], [6, "Sat"], [0, "Sun"]];

$("days").append(
  ...DAYS.map(([n, name]) => {
    const label = document.createElement("label");
    label.innerHTML = `<input type="checkbox" value="${n}"> ${name}`;
    return label;
  })
);

const syncScheduleUi = () => ($("schedule-fields").disabled = !$("sched-on").checked);
$("sched-on").addEventListener("change", syncScheduleUi);

const s = await getSettings();
$("sites").value = s.sites.join("\n");
$("redirect").value = s.redirectUrl;
$("sched-on").checked = s.schedule.enabled;
$("start").value = s.schedule.start;
$("end").value = s.schedule.end;
for (const box of $("days").querySelectorAll("input")) box.checked = s.schedule.days.includes(+box.value);
syncScheduleUi();

function show(text, isError = false) {
  $("msg").textContent = text;
  $("msg").className = isError ? "err" : "";
}

$("save").addEventListener("click", async () => {
  const lines = $("sites").value.split("\n").map((l) => l.trim()).filter(Boolean);
  const bad = lines.filter((l) => !normalizeDomain(l));
  if (bad.length) return show(`Not a domain: ${bad.join(", ")}`, true);
  const sites = [...new Set(lines.map(normalizeDomain))];

  const redirectUrl = $("redirect").value.trim();
  if (redirectUrl) {
    let host;
    try {
      const u = new URL(redirectUrl);
      if (!/^https?:$/.test(u.protocol)) throw 0;
      host = u.hostname.replace(/^www\./, "");
    } catch {
      return show("Redirect must be an http(s) URL.", true);
    }
    if (sites.some((d) => host === d || host.endsWith("." + d))) {
      return show("Redirect target is on the block list — that would loop.", true);
    }
  }

  const days = [...$("days").querySelectorAll("input:checked")].map((b) => +b.value);
  const schedule = { enabled: $("sched-on").checked, days, start: $("start").value, end: $("end").value };
  if (schedule.enabled && (!days.length || !schedule.start || !schedule.end)) {
    return show("Pick at least one day and both times.", true);
  }

  await chrome.storage.sync.set({ sites, redirectUrl, schedule });
  $("sites").value = sites.join("\n");
  show("Saved.");
});
