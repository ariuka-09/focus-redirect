import { getSettings, isActiveNow, todayKey } from "./settings.js";

const $ = (id) => document.getElementById(id);
const DAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const s = await getSettings();
const active = s.sites.length > 0 && isActiveNow(s.schedule);

$("state").textContent = active ? "Blocking now" : "Not blocking";
$("dot").classList.toggle("off", !active);

const sites = `${s.sites.length} site${s.sites.length === 1 ? "" : "s"}`;
$("detail").textContent = s.schedule.enabled
  ? `${sites} · ${s.schedule.days.map((d) => DAY[d]).join(" ")} ${s.schedule.start}–${s.schedule.end}`
  : `${sites} · all the time`;

const key = todayKey();
const { [key]: count = 0 } = await chrome.storage.local.get(key);
$("count").textContent = `Blocked ${count} time${count === 1 ? "" : "s"} today`;

$("settings").addEventListener("click", () => chrome.runtime.openOptionsPage());
