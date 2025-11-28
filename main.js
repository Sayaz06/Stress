// ============================================================
// main.js — PART 1 (IMPORTS + VARIABLES)
// ============================================================

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

const plannerTabBtn = document.getElementById("plannerTabBtn");
const logTabBtn = document.getElementById("logTabBtn");
const plannerView = document.getElementById("plannerView");
const logView = document.getElementById("logView");
const logSummary = document.getElementById("logSummary");
const focusLogList = document.getElementById("focusLogList");
const logFilters = document.getElementById("logFilters");
const weeklyStatsList = document.getElementById("weeklyStatsList");
const weeklyChartCanvas = document.getElementById("weeklyChart");

// GLOBAL STATE
let selectedMinutes = 0;
let selectedActivityName = "";
let selectedActivityId = null;
let timerInterval = null;
let currentUser = null;
let audio = null;
let currentLogRange = "today";
let weeklyChart = null;

// ============================================================
// main.js — PART 2 (PRESETS + SELECT ACTIVITY + AUDIO SYSTEM)
// ============================================================

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
    btn.textContent = p.name;
    btn.onclick = () =>
      selectActivity({
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

// ✅ AUDIO SYSTEM (ROOT FOLDER, 1–45 MINIT)
function getAudioFileForMinutes(minutes) {
  if (!minutes || minutes <= 0) return null;

  // Fail exact: focus1min.mp3 hingga focus45min.mp3
  return `./focus${minutes}min.mp3`;
}

// ✅ START TIMER
function startTimer() {
  if (!selectedMinutes || selectedMinutes <= 0) return;
  if (!currentUser) return alert("Sila login dahulu.");

  if (timerInterval) clearInterval(timerInterval);

  if (audio) {
    try {
      audio.pause();
      audio.currentTime = 0;
    } catch (e) {}
  }

  let totalSeconds = selectedMinutes * 60;
  updateTimerDisplay(totalSeconds);

  const audioFile = getAudioFileForMinutes(selectedMinutes);
  audio = new Audio(audioFile);
  audio.volume = 1.0;

  audio.play().catch(() => {
    console.warn("Audio gagal load, tapi timer tetap jalan.");
  });

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

// ============================================================
// main.js — PART 3 (LOGGING + FIRESTORE)
// ============================================================

// ✅ Simpan log fokus bila timer habis
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

// ✅ Load log ikut user + range (today / 7 / 30 / all)
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
      renderWeeklyChart([]);
      return;
    }

    const now = new Date();
    const logs = [];

    snap.forEach((docSnap) => {
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
    renderWeeklyChart(logs);

  } catch (err) {
    console.error("Error load logs:", err);
    focusLogList.innerHTML = "<li>Gagal load log fokus.</li>";
  }
}

// ✅ Render list log
function renderLogList(logs) {
  focusLogList.innerHTML = "";

  if (logs.length === 0) {
    focusLogList.innerHTML = "<li>Tiada log dalam julat ini.</li>";
    return;
  }

  logs.forEach((log) => {
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

// ✅ Summary total minit
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

// ============================================================
// main.js — PART 4 (WEEKLY STATS + CHART + FILTERS + TABS)
// ============================================================

// ✅ Weekly Stats
function renderWeeklyStats(logs) {
  weeklyStatsList.innerHTML = "";

  const now = new Date();
  const weekLogs = logs.filter((l) => {
    const diff = (now - l.createdAt) / (1000 * 60 * 60 * 24);
    return diff <= 7;
  });

  if (weekLogs.length === 0) {
    weeklyStatsList.innerHTML = "<li>Tiada data minggu ini.</li>";
    return;
  }

  const totalWeek = weekLogs.reduce((sum, l) => sum + (l.minutes || 0), 0);
  const avg = Math.round(totalWeek / 7);

  const countMap = {};
  weekLogs.forEach((l) => {
    countMap[l.activityName] = (countMap[l.activityName] || 0) + 1;
  });

  const popular = Object.entries(countMap).sort((a, b) => b[1] - a[1])[0][0];

  let streak = 0;
  for (let i = 0; i < 7; i++) {
    const day = new Date(now);
    day.setDate(now.getDate() - i);

    const hasLog = weekLogs.some(
      (l) => l.createdAt.toDateString() === day.toDateString()
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

// ✅ Weekly Chart (7 hari)
function renderWeeklyChart(logs) {
  const now = new Date();
  const dailyTotals = {};

  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    const key = d.toLocaleDateString("ms-MY", {
      day: "2-digit",
      month: "short"
    });
    dailyTotals[key] = 0;
  }

  logs.forEach((log) => {
    const key = log.createdAt.toLocaleDateString("ms-MY", {
      day: "2-digit",
      month: "short"
    });
    if (dailyTotals[key] !== undefined) {
      dailyTotals[key] += log.minutes || 0;
    }
  });

  const labels = Object.keys(dailyTotals);
  const data = Object.values(dailyTotals);

  if (weeklyChart) weeklyChart.destroy();

  weeklyChart = new Chart(weeklyChartCanvas, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "Minit Fokus",
          data,
          backgroundColor: "#3b82f6"
        }
      ]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { stepSize: 10 }
        }
      }
    }
  });
}

// ✅ Filter Buttons
logFilters.querySelectorAll("button").forEach((btn) => {
  btn.addEventListener("click", () => {
    currentLogRange = btn.dataset.range;
    if (currentUser) loadFocusLogs(currentUser);
  });
});

// ✅ Tab Switching
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

// ============================================================
// main.js — PART 5 (ACTIVITIES CRUD)
// ============================================================

// ✅ ADD ACTIVITY
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

// ✅ EDIT ACTIVITY
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

// ✅ DELETE ACTIVITY
async function onDeleteActivity(id) {
  if (!confirm("Padam aktiviti ini?")) return;

  try {
    await deleteDoc(doc(db, "restActivities", id));
    loadUserActivities(currentUser);
  } catch (err) {
    console.error("Error delete:", err);
  }
}

// ✅ LOAD ACTIVITIES
async function loadUserActivities(user) {
  userActivities.innerHTML = "<li>Loading...</li>";

  try {
    const q = query(
      collection(db, "restActivities"),
      where("uid", "==", user.uid),
      orderBy("createdAt", "desc")
    );

    const snap = await getDocs(q);

    if (snap.empty) {
      userActivities.innerHTML = "<li>Tiada aktiviti lagi.</li>";
      return;
    }

    userActivities.innerHTML = "";
    snap.forEach((docSnap) => {
      const data = docSnap.data();
      const li = document.createElement("li");

      const title = document.createElement("span");
      title.textContent = `${data.name} — ${data.minutes} minit`;
      title.style.cursor = "pointer";
      title.onclick = () =>
        selectActivity({
          id: docSnap.id,
          name: data.name,
          minutes: data.minutes,
          source: "custom"
        });

      const editBtn = document.createElement("button");
      editBtn.textContent = "Edit";
      editBtn.onclick = () => onEditActivity(docSnap.id, data);

      const deleteBtn = document.createElement("button");
      deleteBtn.textContent = "Delete";
      deleteBtn.style.background = "#ef4444";
      deleteBtn.onclick = () => onDeleteActivity(docSnap.id);

      li.appendChild(title);
      li.appendChild(editBtn);
      li.appendChild(deleteBtn);

      userActivities.appendChild(li);
    });
  } catch (err) {
    console.error("Error load activities:", err);
  }
}

// ============================================================
// main.js — PART 6 (AUTH + THEME TOGGLE + FINAL LISTENERS)
// ============================================================

// ✅ AUTH STATE LISTENER
onAuthStateChanged(auth, (user) => {
  currentUser = user;

  if (user) {
    userInfo.textContent = `Logged in as: ${user.email}`;
    authSection.style.display = "none";
    appSection.style.display = "block";

    renderPresets();
    loadUserActivities(user);
    showPlanner();
  } else {
    userInfo.textContent = "Not logged in";
    authSection.style.display = "block";
    appSection.style.display = "none";
  }
});

// ✅ SIGNUP
signupForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  try {
    await createUserWithEmailAndPassword(
      auth,
      signupForm.signupEmail.value,
      signupForm.signupPassword.value
    );
    signupForm.reset();
  } catch (err) {
    alert(err.message);
  }
});

// ✅ LOGIN
loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  try {
    await signInWithEmailAndPassword(
      auth,
      loginForm.loginEmail.value,
      loginForm.loginPassword.value
    );
    loginForm.reset();
  } catch (err) {
    alert(err.message);
  }
});

// ✅ LOGOUT
logoutBtn.addEventListener("click", async () => {
  await signOut(auth);
});

// ✅ START TIMER BUTTON
startTimerBtn.addEventListener("click", startTimer);

// ✅ THEME TOGGLE
const themeToggle = document.getElementById("themeToggle");

// Load saved theme
const savedTheme = localStorage.getItem("theme");
if (savedTheme === "dark") {
  document.body.classList.add("dark");
  themeToggle.textContent = "Light Mode";
}

// Toggle theme on click
themeToggle.addEventListener("click", () => {
  const isDark = document.body.classList.toggle("dark");

  if (isDark) {
    localStorage.setItem("theme", "dark");
    themeToggle.textContent = "Light Mode";
  } else {
    localStorage.setItem("theme", "light");
    themeToggle.textContent = "Dark Mode";
  }
});
