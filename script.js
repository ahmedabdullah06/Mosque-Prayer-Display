"use strict";

// ======================= STATE =======================
let data;
let jumuahData;
let renderedDay;
let countdownInterval;
let announcement;

// ======================= LOADING =======================
async function loadTimes() {
  const response = await fetch("prayer-times.json");
  data = await response.json();
}

async function loadAnnouncement() {
  const response = await fetch("announcement.json");
  announcement = await response.json();
}

async function loadJumuahTimes() {
  const response = await fetch("jumuah-times.json", { cache: "no-store" });
  jumuahData = await response.json();
}

// ======================= HELPERS =======================
function timeReformat(time){
  time = normalizeTime(time)
  let hour = Number(time.charAt(0) + time.charAt(1));
  if(hour > 12) hour -= 12;
  return hour + ":" + time[3] + time[4];
}

function normalizeTime(time, pm = false){
  let [h, m] = time.split(":").map(Number);
  if (pm && h < 12) h += 12;           // only for afternoon/evening times
  return String(h).padStart(2, "0") + ":" + String(m).padStart(2, "0");
}

function getTodayKey(date = new Date){
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return month + "-" + day;
}

// ======================= PRAYER LOGIC =======================
function getPrayerTimes(date){
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const today = month + "-" + day;
  const times = {};

  for (const prayer in data[today]){
    if (prayer == "sunrise") { times["sunrise"] = normalizeTime(data[today][prayer]); } 
    else {
      const isPm = prayer != "fajr";
      for (const occasion in data[today][prayer]){
        times[prayer + " " + occasion] = normalizeTime(data[today][prayer][occasion], isPm);
      }
    }
  } 

  if (date.getDay() == 5){
    Object.values(jumuahData).map(t => normalizeTime(t, true)).sort().forEach((time, i) => {
      times["Jumu'ah " + (i + 1)] = time;
    });
  }
  return times;
}

// ======================= RENDERING: TABLES =======================
function fillTable(date = new Date()){
  const today = getTodayKey(date);
  document.getElementById('sunrise-time').innerText = data[today]["sunrise"] + " AM";
  document.getElementById('fajr-adhan').innerText = data[today]["fajr"]["adhan"] + " AM";
  document.getElementById('fajr-iqama').innerText = data[today]["fajr"]["iqama"] + " AM";
  document.getElementById('dhuhr-adhan').innerText = timeReformat(data[today]["dhuhr"]["adhan"]) + " PM";
  document.getElementById('dhuhr-iqama').innerText = timeReformat(data[today]["dhuhr"]["iqama"]) + " PM";
  document.getElementById('asr-adhan').innerText = timeReformat(data[today]["asr"]["adhan"]) + " PM";
  document.getElementById('asr-iqama').innerText = timeReformat(data[today]["asr"]["iqama"]) + " PM";
  document.getElementById('maghrib-adhan').innerText = timeReformat(data[today]["maghrib"]["adhan"]) + " PM";
  document.getElementById('maghrib-iqama').innerText = timeReformat(data[today]["maghrib"]["iqama"]) + " PM";
  document.getElementById('isha-adhan').innerText = timeReformat(data[today]["isha"]["adhan"]) + " PM";
  document.getElementById('isha-iqama').innerText = timeReformat(data[today]["isha"]["iqama"]) + " PM";
}

function displayAnnouncement(date = new Date()){
  const today = getTodayKey(date);
  let iqama = timeReformat(data[today]["maghrib"]["iqama"]) + " PM";
  if (!announcement["announcement"] || announcement["announcement"] == ""){
    document.getElementById('announcement').innerText = "IQAMAH CHANGES: Maghrib at " + timeReformat(data[today]["maghrib"]["iqama"]) + " PM";
  }
  else{
    document.getElementById('announcement').innerText = announcement["announcement"];
  }
}

function fillJumuahTable() {
  const container = document.getElementById("jumuah-times");
  container.innerHTML = "";
  let i = 0;

  const times = Object.values(jumuahData).map(t => normalizeTime(t, true)).sort()

  times.forEach((time, index) => {
    i++;
    const entry = document.createElement("p");
    entry.textContent = timeReformat(time) + " PM";
    entry.classList.add("jumuah-entry");
    entry.id= "jumuah-" + i;
    container.append(entry);
  });
  document.getElementById("jumuah-title").rowSpan = i;
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

function updateLiveDate() {
  const now = new Date();

  const [h, m] = normalizeTime(data[getTodayKey()]["maghrib"]["adhan"], true).split(":").map(Number);
  const maghrib = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, 0);
  const hijriDate = new Date(now);
  if (now >= maghrib) hijriDate.setDate(hijriDate.getDate() + 1);

  const longFormatter = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
  const hijriFormatter = new Intl.DateTimeFormat('ar-u-ca-islamic-umalqura', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  document.getElementById('clock').innerText = now.toLocaleTimeString();
  document.getElementById('solar-date').innerText = longFormatter.format(now);
  document.getElementById('lunar-date').innerText = hijriFormatter.format(hijriDate);
}

// ======================= COUNTDOWN =======================
function timetoDate(date){
  clearInterval(countdownInterval);
  const times = Object.entries(getPrayerTimes(date)).sort((a, b) => a[1].localeCompare(b[1]));
  let targetTime = null;
  let targetName;
  let targetClock;

  for (const [name, time] of times) {
    const hour = parseInt(time.split(":")[0]);
    const minutes = parseInt(time.split(":")[1]);
    const candidate = new Date(date.getFullYear(), date.getMonth(), date.getDate(), hour, minutes, 0).getTime();

    if (candidate > Date.now()) {
      targetTime = candidate;
      targetClock = time;
      targetName = name;
      break;
    }
  }

  if (targetTime === null) {
    const tomorrow = new Date(date);
    tomorrow.setDate(tomorrow.getDate() + 1);
    fillTable(tomorrow); 
    timetoDate(tomorrow);
    displayAnnouncement(tomorrow);
    return;
  }

  const prayer = targetName.split(" ")[0].toLowerCase();
  const isJumuah = prayer === "jumu'ah";
  const skipDhuhr = date.getDay() === 5 && prayer === "dhuhr";

  highlightRow(isJumuah || skipDhuhr ? null : prayer);
  highlightJumuah(isJumuah ? "jumuah-" + targetName.split(" ")[1] : null);

  function updateCountdown() {
    const now = new Date().getTime();
    const distance = (targetTime - now) + 1000;

    if (distance < 1000) {
      clearInterval(countdownInterval);
      timetoDate(new Date()); 
      return;
    }

    const disHours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const disMinutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
    const disSeconds = Math.floor((distance % (1000 * 60)) / 1000);
    let element = document.getElementById('countdown')
  
    document.getElementById('next-event-label').innerText = (
      targetName.toUpperCase() + 
      " \n " + 
      timeReformat(targetClock) + 
      (Number(targetClock.slice(0, 2)) >= 12 ? " PM" : " AM") + 
      " "
    );
    const parts = [];
    if (disHours > 0) parts.push(disHours + "h");
    if (disMinutes > 0) parts.push(disMinutes + "min");
    if (disSeconds > 0) parts.push(disSeconds + "sec");
    element.innerText = parts.join(" ");
  }

  countdownInterval = setInterval(updateCountdown, 1000);
  updateCountdown();
}

// ======================= DAILY REFRESH =======================
function checkNewDay() {
  const today = getTodayKey();
  if (today !== renderedDay) {
    renderedDay = today;

    fillTable();
    displayAnnouncement();
    timetoDate(new Date());
  }
}

// ======================= STARTUP =======================
async function init() {
  try {
    await loadTimes();
    await loadJumuahTimes();
    await loadAnnouncement();
    displayAnnouncement()
    fillTable();
    fillJumuahTable();
    renderedDay = getTodayKey();
    timetoDate(new Date());

    updateLiveDate();
    setInterval(updateLiveDate, 1000);
    setInterval(checkNewDay, 1000);

    console.log("All JSON files loaded successfully");

  } 
  catch (error) { console.error("Initialization failed:", error); }
}

init();

