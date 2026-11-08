"use strict";

// ======================= STATE =======================
let data;               // prayer-times.json (all times in 24h "HH:MM")
let jumuahTimes = [];   // sorted 24h "HH:MM" strings, e.g. ["11:50", "12:50", "13:50"]
let announcement = {};
let renderedDay;        // key of the real calendar day last rendered
let displayDate = new Date(); // day whose times are currently shown (tomorrow after Isha)
let countdownInterval;

// ======================= LOADING =======================
async function loadTimes() {
  const response = await fetch("prayer-times.json");
  data = await response.json();
}

async function loadAnnouncement() {
  try {
    const response = await fetch("announcement.json", { cache: "no-store" });
    announcement = await response.json();
  } catch (err) {
    console.error("Keeping old announcement:", err);
  }
  displayAnnouncement(displayDate);
}

async function loadJumuahTimes() {
  try {
    const response = await fetch("jumuah-times.json", { cache: "no-store" });
    const json = await response.json();
    const parsed = Object.values(json).map(parseJumuahTime).filter(Boolean).sort();
    if (parsed.length === 0) throw new Error("No valid Jumu'ah times found");
    jumuahTimes = parsed;
  } catch (err) {
    console.error("Keeping old Jumu'ah times:", err);
  }
  fillJumuahTable();
  timetoDate(new Date());
}

// ======================= HELPERS =======================
function pad(n) {
  return String(n).padStart(2, "0");
}

// "HH:MM" (24h) -> "hh:MM AM" / "h:MM PM" (AM times keep the leading zero, e.g. "05:48 AM")
function to12h(time) {
  let [h, m] = time.split(":").map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  h = h % 12;
  if (h === 0) h = 12;
  return (suffix === "AM" ? pad(h) : h) + ":" + pad(m) + " " + suffix;
}

// Jumu'ah times are entered by hand, so accept "11:50", "1:50", "13:50", "1:50 PM", etc.
// Without an AM/PM marker: 10-11 -> morning, 12 -> noon, 1-9 -> afternoon.
function parseJumuahTime(raw) {
  const match = String(raw).trim().match(/^(\d{1,2}):(\d{2})\s*([AaPp][Mm])?$/);
  if (!match) {
    console.warn("Ignoring invalid Jumu'ah time:", raw);
    return null;
  }
  let h = Number(match[1]);
  const m = Number(match[2]);
  const suffix = match[3] ? match[3].toUpperCase() : null;

  if (suffix === "AM" && h === 12) h = 0;
  else if (suffix === "PM" && h < 12) h += 12;
  else if (!suffix && h >= 1 && h <= 9) h += 12;

  if (h > 23 || m > 59) {
    console.warn("Ignoring invalid Jumu'ah time:", raw);
    return null;
  }
  return pad(h) + ":" + pad(m);
}

function getTodayKey(date = new Date()) {
  return pad(date.getMonth() + 1) + "-" + pad(date.getDate());
}

// Day's entry from prayer-times.json; Feb 29 falls back to Feb 28.
function getDayData(date = new Date()) {
  const key = getTodayKey(date);
  if (data[key]) return data[key];
  if (key === "02-29" && data["02-28"]) return data["02-28"];
  throw new Error("No prayer times for " + key);
}

function isFriday(date) {
  return date.getDay() === 5;
}

// ======================= PRAYER LOGIC =======================
function getPrayerTimes(date) {
  const day = getDayData(date);
  const times = {};
  const friday = isFriday(date);

  for (const prayer in day) {
    if (prayer === "sunrise") {
      times["sunrise"] = day.sunrise;
    } else {
      if (friday && prayer === "dhuhr") continue; // Jumu'ah replaces Dhuhr on Fridays
      for (const occasion in day[prayer]) {
        times[prayer + " " + occasion] = day[prayer][occasion];
      }
    }
  }

  if (friday) {
    jumuahTimes.forEach((time, i) => {
      times["Jumu'ah " + (i + 1)] = time;
    });
  }
  return times;
}

// ======================= RENDERING: TABLES =======================
function fillTable(date = new Date()) {
  const day = getDayData(date);
  document.getElementById("sunrise-time").innerText = to12h(day.sunrise);
  for (const prayer of ["fajr", "dhuhr", "asr", "maghrib", "isha"]) {
    document.getElementById(prayer + "-adhan").innerText = to12h(day[prayer].adhan);
    document.getElementById(prayer + "-iqama").innerText = to12h(day[prayer].iqama);
  }
}

function displayAnnouncement(date = new Date()) {
  const text = announcement && announcement.announcement;
  document.getElementById("announcement").innerText = text && text.trim() !== ""
    ? text
    : "IQAMAH CHANGES: Maghrib at " + to12h(getDayData(date).maghrib.iqama);
}

function fillJumuahTable() {
  const container = document.getElementById("jumuah-times");
  container.innerHTML = "";

  jumuahTimes.forEach((time, index) => {
    const entry = document.createElement("p");
    entry.textContent = to12h(time);
    entry.classList.add("jumuah-entry");
    entry.id = "jumuah-" + (index + 1);
    container.append(entry);
  });
}

// ======================= RENDERING: DATE / CLOCK =======================
function highlightRow(prayer) {
  document.querySelectorAll("tr.next").forEach(row => row.classList.remove("next"));
  if (!prayer) return;
  const row = document.querySelector(`tr[data-prayer="${prayer}"]`);
  if (row) row.classList.add("next");
}

function highlightJumuah(id) {
  document.querySelectorAll(".jumuah-entry.next").forEach(e => e.classList.remove("next"));
  if (!id) return;
  const entry = document.getElementById(id);
  if (entry) entry.classList.add("next");
}

const longFormatter = new Intl.DateTimeFormat("en-CA", {
  year: "numeric",
  month: "long",
  day: "numeric"
});
const hijriFormatter = new Intl.DateTimeFormat("ar-u-ca-islamic-umalqura", {
  day: "numeric",
  month: "long",
  year: "numeric"
});

function updateLiveDate() {
  const now = new Date();

  // The Islamic day begins at Maghrib.
  const [h, m] = getDayData(now).maghrib.adhan.split(":").map(Number);
  const maghrib = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, 0);
  const hijriDate = new Date(now);
  if (now >= maghrib) hijriDate.setDate(hijriDate.getDate() + 1);

  document.getElementById("clock").innerText = now.toLocaleTimeString();
  document.getElementById("solar-date").innerText = longFormatter.format(now);
  document.getElementById("lunar-date").innerText = hijriFormatter.format(hijriDate);
}

// ======================= COUNTDOWN =======================
function findNextEvent(date) {
  const times = Object.entries(getPrayerTimes(date)).sort((a, b) => a[1].localeCompare(b[1]));
  const now = Date.now();

  for (const [name, time] of times) {
    const [hour, minutes] = time.split(":").map(Number);
    const candidate = new Date(date.getFullYear(), date.getMonth(), date.getDate(), hour, minutes, 0).getTime();
    if (candidate > now) return { name, time, target: candidate };
  }
  return null;
}

function timetoDate(date) {
  clearInterval(countdownInterval);

  // Today's prayers are all done after Isha iqama -> show tomorrow's schedule.
  let next = findNextEvent(date);
  if (next === null) {
    date = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
    next = findNextEvent(date);
    if (next === null) {
      console.error("No upcoming prayer found for", getTodayKey(date));
      return;
    }
  }

  displayDate = date;
  fillTable(date);
  displayAnnouncement(date);

  const { name: targetName, time: targetClock, target: targetTime } = next;
  const prayer = targetName.split(" ")[0].toLowerCase();
  const isJumuah = prayer === "jumu'ah";

  highlightRow(isJumuah ? null : prayer);
  highlightJumuah(isJumuah ? "jumuah-" + targetName.split(" ")[1] : null);

  document.getElementById("next-event-label").innerText =
    targetName.toUpperCase() + " \n " + to12h(targetClock) + " ";

  function updateCountdown() {
    const distance = (targetTime - Date.now()) + 1000;

    if (distance < 1000) {
      clearInterval(countdownInterval);
      timetoDate(new Date());
      return;
    }

    const disHours = Math.floor(distance / (1000 * 60 * 60));
    const disMinutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
    const disSeconds = Math.floor((distance % (1000 * 60)) / 1000);

    const parts = [];
    if (disHours > 0) parts.push(disHours + "h");
    if (disMinutes > 0) parts.push(disMinutes + "min");
    if (disSeconds > 0) parts.push(disSeconds + "sec");
    document.getElementById("countdown").innerText = parts.join(" ");
  }

  countdownInterval = setInterval(updateCountdown, 1000);
  updateCountdown();
}

// ======================= DAILY REFRESH =======================
function checkNewDay() {
  const today = getTodayKey();
  if (today !== renderedDay) {
    renderedDay = today;
    timetoDate(new Date());
  }
}

// ======================= STARTUP =======================
async function init() {
  try {
    await loadTimes();
    await loadAnnouncement();
    await loadJumuahTimes(); // also renders the table and starts the countdown

    renderedDay = getTodayKey();

    updateLiveDate();
    setInterval(updateLiveDate, 1000);
    setInterval(checkNewDay, 1000);
    setInterval(() => {
      loadJumuahTimes();
      loadAnnouncement();
    }, 5 * 60 * 1000);

    console.log("All JSON files loaded successfully");
  } catch (error) {
    console.error("Initialization failed:", error);
  }
}

init();
