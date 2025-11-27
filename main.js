import { auth, db } from "./firebase.js";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.13.1/firebase-auth.js";

import {
  collection,
  addDoc,
  query,
  where,
  getDocs,
  orderBy,
  serverTimestamp,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  deleteDoc
} from "https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js";

// UI ELEMENTS
const authSection = document.getElementById("authSection");
const appSection = document.getElementById("appSection");
const userInfo = document.getElementById("userInfo");
const logoutBtn = document.getElementById("logoutBtn");

const signupForm = document.getElementById("signupForm");
const loginForm = document.getElementById("loginForm");

const presetList = document.getElementById("presetList");
const addActivityForm = document.getElementById("addActivityForm");
const activityName = document.getElementById("activityName");
const activityMinutes = document.getElementById("activityMinutes");
const userActivities = document.getElementById("userActivities");

const timerDisplay = document.getElementById("timerDisplay");
const startTimerBtn = document.getElementById("startTimerBtn");
const selectedActivityLabel = document.getElementById("selectedActivityLabel");

const soundSelect = document.getElementById("soundSelect");
const saveSoundBtn = document.getElementById("saveSoundBtn");

// PLAN D UI
const plannerTabBtn = document.getElementById("plannerTabBtn");
const logTabBtn = document.getElementById("logTabBtn");
const plannerView = document.getElementById("plannerView");
const logView = document.getElementById("logView");
const logSummary = document.getElementById("logSummary");
const focusLogList = document.getElementById("focusLogList");
const logFilters = document.getElementById("logFilters");
const weeklyStatsList = document.getElementById("weeklyStatsList");

let selectedMinutes = 0;
let selectedActivityName = "";
let selectedActivityId = null;
let timerInterval = null;
let currentUser = null;
let audio = null;
let currentLogRange = "today";

// PRESETS
const presets = [
  { name: "Fokus 25 minit", minutes: 25 },
  { name: "Fokus 45 minit", minutes: 45 },
  { name: "Fokus 60 minit", minutes: 60 }
];

function renderPresets() {
  presetList.innerHTML = "";
  presets.forEach((p) => {
    const btn = document.createElement("button");
    btn.textContent = `${p.name}`;
    btn.onclick = () => selectActivity({
      id: null,
      name: p.name,
      minutes: p.minutes,
      source: "preset"
    });
    presetList.appendChild(btn);
  });
}

function selectActivity({ id, name, minutes, source }) {
  selectedMinutes = minutes;
  selectedActivityName = name;
  selectedActivityId = id;

  startTimerBtn.disabled = false;
  timerDisplay.textContent = `${String(minutes).padStart(2, "0")}:00`;
  selectedActivityLabel.textContent =
    `${source === "preset" ? "[Preset] " : ""}${name} — ${minutes} minit`;
}

function startTimer() {
  if (!selectedMinutes || selectedMinutes <= 0) return;
  if (!currentUser) return alert("Sila login dahulu.");

  if (timerInterval) clearInterval(timerInterval);

  let totalSeconds = selectedMinutes * 60;
  updateTimerDisplay(totalSeconds);

  const audioFile = `focus${selectedMinutes}min.mp3`;
  audio = new Audio(audioFile);
  audio.volume = 1.0;
  audio.play().catch(err => console.warn("Audio blocked:", err));

  timerInterval = setInterval(async () => {
    totalSeconds--;

    if (totalSeconds <= 0) {
      clearInterval(timerInterval);
      timerInterval = null;
      updateTimerDisplay(0);

      alert("Fokus selesai!");
      await logFocusSession();
      return;
    }

    updateTimerDisplay(totalSeconds);
  }, 1000);
}

function updateTimerDisplay(totalSeconds) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  timerDisplay.textContent =
    `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

async function logFocusSession() {
  try {
    await addDoc(collection(db, "focusLogs"), {
      uid: currentUser.uid,
      activityId: selectedActivityId || null,
      activityName: selectedActivityName,
      minutes: selectedMinutes,
      createdAt: serverTimestamp()
    });
  } catch (err) {
    console.error("Error log focus:", err);
  }
}

async function loadFocusLogs(user) {
  focusLogList.innerHTML = "<li>Loading...</li>";
  logSummary.textContent = "";
  weeklyStatsList.innerHTML = "";

  try {
    const q = query(
      collection(db, "focusLogs"),
      where("uid", "==", user.uid),
      orderBy("createdAt", "desc")
    );

    const snap = await getDocs(q);

    if (snap.empty) {
      focusLogList.innerHTML = "<li>Tiada log fokus lagi.</li>";
      logSummary.textContent = "Belum ada sesi fokus direkod.";
      return;
    }

    const now = new Date();
    const logs = [];

    snap.forEach(docSnap => {
      const data = docSnap.data();
      const createdAt = data.createdAt?.toDate
        ? data.createdAt.toDate()
        : null;

      if (!createdAt) return;

      const diffMs = now - createdAt;
      const diffDays = diffMs / (1000 * 60 * 60 * 24);

      let include = false;
      if (currentLogRange === "today") {
        include = createdAt.toDateString() === now.toDateString();
      } else if (currentLogRange === "7") {
        include = diffDays <= 7;
      } else if (currentLogRange === "30") {
        include = diffDays <= 30;
      } else {
        include = true;
      }

      if (include) logs.push({ ...data, createdAt });
    });

    renderLogList(logs);
    renderSummary(logs);
    renderWeeklyStats(logs);

  } catch (err) {
    console.error("Error load logs:", err);
    focusLogList.innerHTML = "<li>Gagal load log fokus.</li>";
  }
}

function renderLogList(logs) {
  focusLogList.innerHTML = "";

  if (logs.length === 0) {
    focusLogList.innerHTML = "<li>Tiada log dalam julat ini.</li>";
    return;
  }

  logs.forEach(log => {
    const timeStr = log.createdAt.toLocaleString("ms-MY", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit"
    });

    const li = document.createElement("li");
    li.textContent = `${timeStr} — ${log.activityName} (${log.minutes} minit)`;
    focusLogList.appendChild(li);
  });
}

function renderSummary(logs) {
  const total = logs.reduce((sum, l) => sum + (l.minutes || 0), 0);

  const label = {
    today: "Hari Ini",
    "7": "7 Hari",
    "30": "30 Hari",
    all: "Semua"
  };

  logSummary.textContent =
    `${label[currentLogRange]}: ${total} minit fokus direkodkan.`;
}

function renderWeeklyStats(logs) {
  weeklyStatsList.innerHTML = "";

  // Filter hanya untuk 7 hari
  const now = new Date();
  const weekLogs = logs.filter(l => {
    const diff = (now - l.createdAt) / (1000 * 60 * 60 * 24);
    return diff <= 7;
  });

  if (weekLogs.length === 0) {
    weeklyStatsList.innerHTML = "<li>Tiada data minggu ini.</li>";
    return;
  }

  // Total minit minggu ini
  const totalWeek = weekLogs.reduce((sum, l) => sum + (l.minutes || 0), 0);

  // Purata harian
  const avg = Math.round(totalWeek / 7);

  // Aktiviti popular
  const countMap = {};
  weekLogs.forEach(l => {
    countMap[l.activityName] = (countMap[l.activityName] || 0) + 1;
  });

  const popular = Object.entries(countMap)
    .sort((a, b) => b[1] - a[1])[0][0];

  // Streak harian
  let streak = 0;
  for (let i = 0; i < 7; i++) {
    const day = new Date(now);
    day.setDate(now.getDate() - i);

    const hasLog = weekLogs.some(l =>
      l.createdAt.toDateString() === day.toDateString()
    );

    if (hasLog) streak++;
    else break;
  }

  weeklyStatsList.innerHTML = `
    <li>Total minggu ini: <strong>${totalWeek} minit</strong></li>
    <li>Purata harian: <strong>${avg} minit</strong></li>
    <li>Aktiviti popular: <strong>${popular}</strong></li>
    <li>Streak harian: <strong>${streak} hari</strong></li>
  `;
}

// FILTER BUTTONS
logFilters.querySelectorAll("button").forEach((btn) => {
  btn.addEventListener("click", () => {
    currentLogRange = btn.dataset.range;
    if (currentUser) loadFocusLogs(currentUser);
  });
});

// TAB SWITCHING
function showPlanner() {
  plannerView.style.display = "block";
  logView.style.display = "none";
  plannerTabBtn.disabled = true;
  logTabBtn.disabled = false;
}

function showLog() {
  plannerView.style.display = "none";
  logView.style.display = "block";
  plannerTabBtn.disabled = false;
  logTabBtn.disabled = true;

  if (currentUser) loadFocusLogs(currentUser);
}

plannerTabBtn.addEventListener("click", showPlanner);
logTabBtn.addEventListener("click", showLog);

// ADD ACTIVITY
addActivityForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  if (!currentUser) {
    alert("Sila login dahulu.");
    return;
  }

  const name = activityName.value.trim();
  const minutes = parseInt(activityMinutes.value, 10);

  if (!name || !minutes || minutes <= 0) {
    alert("Sila masukkan nama dan minit yang sah.");
    return;
  }

  try {
    await addDoc(collection(db, "restActivities"), {
      uid: currentUser.uid,
      name,
      minutes,
      createdAt: serverTimestamp()
    });

    activityName.value = "";
    activityMinutes.value = "";

    await loadUserActivities(currentUser);
  } catch (err) {
    console.error("Error tambah aktiviti:", err);
    alert("Gagal tambah aktiviti.");
  }
});

// LOAD SOUND SETTING
async function loadUserSound(user) {
  try {
    const snap = await getDoc(doc(db, "userSettings", user.uid));
    if (snap.exists()) soundSelect.value = snap.data().sound;
  } catch (err) {
    console.error("Error load sound:", err);
  }
}

// SAVE SOUND SETTING
saveSoundBtn.addEventListener("click", async () => {
  if (!currentUser) return alert("Sila login dahulu.");

  try {
    await setDoc(doc(db, "userSettings", currentUser.uid), {
      sound: soundSelect.value
    });
    alert("Pilihan bunyi disimpan.");
  } catch (err) {
    console.error("Error save sound:", err);
  }
});

// EDIT ACTIVITY
async function onEditActivity(id, data) {
  const newName = prompt("Nama aktiviti baru:", data.name);
  if (newName === null) return;

  const newMinutesRaw = prompt("Minit fokus baru:", data.minutes);
  if (newMinutesRaw === null) return;

  const newMinutes = parseInt(newMinutesRaw, 10);
  if (!newName.trim() || !newMinutes || newMinutes <= 0)
    return alert("Input tidak sah.");

  try {
    await updateDoc(doc(db, "restActivities", id), {
      name: newName.trim(),
      minutes: newMinutes
    });
    loadUserActivities(currentUser);
  } catch (err) {
    console.error("Error update:", err);
  }
}

// DELETE ACTIVITY
async function onDeleteActivity(id) {
  if (!confirm("Padam aktiviti ini?")) return;

  try {
    await deleteDoc(doc(db, "restActivities", id));
    loadUserActivities(currentUser);
  } catch (err) {
    console.error("Error delete:", err);
  }
}

// LOAD ACTIVITIES
async function loadUserActivities(user) {
