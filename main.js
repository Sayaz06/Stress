// =========================
// PART 1 — IMPORTS & INIT
// =========================

// FIREBASE IMPORTS
import {
  getFirestore,
  collection,
  addDoc,
  onSnapshot,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  query,
  orderBy,
  where,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";

// INIT FIREBASE
const db = getFirestore();
const auth = getAuth();

// GLOBAL STATE
let currentUser = null;
let currentActivity = null;   // selected activity for timer
let timerInterval = null;
let remainingSeconds = 0;

// =========================
// DOM ELEMENTS
// =========================

// Header / Auth / App
const authSection = document.getElementById("authSection");
const appSection = document.getElementById("appSection");
const userInfo = document.getElementById("userInfo");
const logoutBtn = document.getElementById("logoutBtn");
const signupForm = document.getElementById("signupForm");
const loginForm = document.getElementById("loginForm");

// Tabs
const plannerTabBtn = document.getElementById("plannerTabBtn");
const logTabBtn = document.getElementById("logTabBtn");
const plannerView = document.getElementById("plannerView");
const logView = document.getElementById("logView");

// Activities
const addActivityForm = document.getElementById("addActivityForm");
const activityNameInput = document.getElementById("activityName");
const activityMinutesInput = document.getElementById("activityMinutes");
const userActivitiesList = document.getElementById("userActivities");
const presetList = document.getElementById("presetList");

// Sound controls (kalau ada dalam HTML)
const soundSelect = document.getElementById("soundSelect");
const saveSoundBtn = document.getElementById("saveSoundBtn");

// Timer
const selectedActivityLabel = document.getElementById("selectedActivityLabel");
const timerDisplay = document.getElementById("timerDisplay");
const startTimerBtn = document.getElementById("startTimerBtn");

// Log & analytics
const focusLogList = document.getElementById("focusLogList");
const logSummary = document.getElementById("logSummary");
const logFilters = document.getElementById("logFilters");
const weeklyStatsList = document.getElementById("weeklyStatsList");
const weeklyChartCanvas = document.getElementById("weeklyChart");

// Theme
const themeToggle = document.getElementById("themeToggle");

// Chart.js instance (global)
let weeklyChartInstance = null;

// =========================
// PART 2 — AUTH + THEME + TABS
// =========================

// ===== SIGNUP =====
if (signupForm) {
  signupForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = signupForm.signupEmail.value.trim();
    const password = signupForm.signupPassword.value.trim();

    if (!email || !password) return;

    try {
      await createUserWithEmailAndPassword(auth, email, password);
      signupForm.reset();
    } catch (error) {
      console.error("Signup error:", error);
      alert("Signup gagal: " + error.message);
    }
  });
}

// ===== LOGIN =====
if (loginForm) {
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = loginForm.loginEmail.value.trim();
    const password = loginForm.loginPassword.value.trim();

    if (!email || !password) return;

    try {
      await signInWithEmailAndPassword(auth, email, password);
      loginForm.reset();
    } catch (error) {
      console.error("Login error:", error);
      alert("Login gagal: " + error.message);
    }
  });
}

// ===== LOGOUT =====
if (logoutBtn) {
  logoutBtn.addEventListener("click", async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Logout error:", error);
    }
  });
}

// ===== AUTH STATE LISTENER =====
onAuthStateChanged(auth, (user) => {
  if (user) {
    currentUser = user;

    userInfo.textContent = `Logged in sebagai: ${user.email}`;
    authSection.style.display = "none";
    appSection.style.display = "block";

    // Load data
    listenToUserActivities();
    listenToFocusLog();
    loadUserSoundPreference();
  } else {
    currentUser = null;

    userInfo.textContent = "Sila login atau signup.";
    authSection.style.display = "block";
    appSection.style.display = "none";

    // Clear UI
    userActivitiesList.innerHTML = "";
    focusLogList.innerHTML = "";
    logSummary.textContent = "";
  }
});

// =========================
// THEME TOGGLE
// =========================
if (themeToggle) {
  const savedTheme = localStorage.getItem("theme");

  if (savedTheme === "dark") {
    document.body.classList.add("dark");
    themeToggle.textContent = "Light Mode";
  }

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
}

// =========================
// TAB SWITCHING
// =========================
function showPlannerView() {
  plannerView.style.display = "block";
  logView.style.display = "none";

  plannerTabBtn.disabled = true;
  logTabBtn.disabled = false;
}

function showLogView() {
  plannerView.style.display = "none";
  logView.style.display = "block";

  plannerTabBtn.disabled = false;
  logTabBtn.disabled = true;
}

if (plannerTabBtn && logTabBtn) {
  plannerTabBtn.addEventListener("click", showPlannerView);
  logTabBtn.addEventListener("click", showLogView);
}

// Default tab
showPlannerView();

// =========================
// PART 3 — ACTIVITIES + TICK/UNTICK (CLOUD SYNC)
// =========================

// ===== PRESET ACTIVITIES =====
const presets = [
  { name: "Deep Work", minutes: 60 },
  { name: "Baca Buku", minutes: 30 },
  { name: "Belajar / Kursus", minutes: 45 },
  { name: "Rehat Fokus", minutes: 15 },
];

function renderPresetList() {
  if (!presetList) return;
  presetList.innerHTML = "";

  presets.forEach((preset) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = `${preset.name} (${preset.minutes} minit)`;

    btn.addEventListener("click", () => {
      selectActivity({
        id: null,
        name: preset.name,
        minutes: preset.minutes,
        isPreset: true,
      });
    });

    presetList.appendChild(btn);
  });
}

renderPresetList();

// ===== LISTEN TO USER ACTIVITIES =====
function listenToUserActivities() {
  if (!currentUser) return;

  const activitiesRef = collection(db, "users", currentUser.uid, "activities");
  const q = query(activitiesRef, orderBy("createdAt", "asc"));

  onSnapshot(q, (snapshot) => {
    const activities = [];
    snapshot.forEach((docSnap) => {
      activities.push({ id: docSnap.id, ...docSnap.data() });
    });
    renderUserActivities(activities);
  });
}

// ===== RENDER ACTIVITIES =====
function renderUserActivities(activities) {
  if (!userActivitiesList) return;
  userActivitiesList.innerHTML = "";

  if (!activities.length) {
    userActivitiesList.innerHTML =
      `<li>Tiada aktiviti lagi. Tambah satu di atas.</li>`;
    return;
  }

  activities.forEach((activity) => {
    const li = document.createElement("li");

    const isDone = activity.completedToday === true;

    li.innerHTML = `
      <div style="flex:1;">
        <span class="${isDone ? "activity-done" : ""}">
          ${activity.name} (${activity.minutes} minit)
        </span>
        ${
          isDone
            ? `<span class="activity-done-badge">Selesai hari ini</span>`
            : ""
        }
      </div>

      <div style="display:flex; gap:6px;">
        <button class="tick-btn" data-id="${activity.id}">
          ${isDone ? "Untick" : "Tick"}
        </button>

        <button class="select-btn" data-id="${activity.id}">
          Pilih
        </button>

        <button class="danger delete-btn" data-id="${activity.id}">
          Delete
        </button>
      </div>
    `;

    userActivitiesList.appendChild(li);
  });

  attachActivityButtonsEvents();
}

// ===== ATTACH BUTTON EVENTS =====
function attachActivityButtonsEvents() {
  const tickButtons = document.querySelectorAll(".tick-btn");
  const deleteButtons = document.querySelectorAll(".delete-btn");
  const selectButtons = document.querySelectorAll(".select-btn");

  // --- TICK / UNTICK ---
  tickButtons.forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (!currentUser) return;

      const activityId = btn.getAttribute("data-id");
      const activityRef = doc(
        db,
        "users",
        currentUser.uid,
        "activities",
        activityId
      );

      const isCurrentlyDone =
        btn.textContent.trim().toLowerCase() === "untick";

      try {
        await updateDoc(activityRef, {
          completedToday: !isCurrentlyDone,
          lastCompletedAt: !isCurrentlyDone ? serverTimestamp() : null,
        });
      } catch (error) {
        console.error("Gagal update tick:", error);
        alert("Tak berjaya update status aktiviti.");
      }
    });
  });

  // --- DELETE ---
  deleteButtons.forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (!currentUser) return;

      const activityId = btn.getAttribute("data-id");
      const activityRef = doc(
        db,
        "users",
        currentUser.uid,
        "activities",
        activityId
      );

      if (!confirm("Padam aktiviti ini?")) return;

      try {
        await deleteDoc(activityRef);
      } catch (error) {
        console.error("Gagal padam aktiviti:", error);
        alert("Tak berjaya padam aktiviti.");
      }
    });
  });

  // --- SELECT FOR TIMER ---
  selectButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      if (!currentUser) return;

      const li = btn.closest("li");
      const textSpan = li.querySelector("span");
      const text = textSpan.textContent || "";

      const match = text.match(/\((\d+)\s*minit\)/i);
      const minutes = match ? parseInt(match[1], 10) : 0;
      const name = text.replace(/\(\d+\s*minit\)/i, "").trim();

      selectActivity({
        id: btn.getAttribute("data-id"),
        name,
        minutes,
        isPreset: false,
      });
    });
  });
}

// ===== ADD NEW ACTIVITY =====
if (addActivityForm) {
  addActivityForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!currentUser) return;

    const name = activityNameInput.value.trim();
    const minutes = parseInt(activityMinutesInput.value.trim(), 10);

    if (!name || !minutes) return;

    try {
      await addDoc(
        collection(db, "users", currentUser.uid, "activities"),
        {
          name,
          minutes,
          completedToday: false,
          createdAt: serverTimestamp(),
        }
      );

      addActivityForm.reset();
    } catch (error) {
      console.error("Gagal tambah aktiviti:", error);
      alert("Tak berjaya tambah aktiviti.");
    }
  });
}

// =========================
// PART 4 — TIMER + AUTO-LOG + AUTO-TICK
// =========================

// ===== SELECT ACTIVITY FOR TIMER =====
function selectActivity(activity) {
  currentActivity = activity;

  selectedActivityLabel.textContent =
    `Aktiviti: ${activity.name} (${activity.minutes} minit)`;

  remainingSeconds = activity.minutes * 60;
  updateTimerDisplay();

  startTimerBtn.disabled = false;
}

// ===== UPDATE TIMER DISPLAY =====
function updateTimerDisplay() {
  const m = Math.floor(remainingSeconds / 60)
    .toString()
    .padStart(2, "0");

  const s = (remainingSeconds % 60)
    .toString()
    .padStart(2, "0");

  timerDisplay.textContent = `${m}:${s}`;
}

// ===== START TIMER =====
if (startTimerBtn) {
  startTimerBtn.addEventListener("click", () => {
    if (!currentActivity || remainingSeconds <= 0) return;

    startTimerBtn.disabled = true;

    if (timerInterval) clearInterval(timerInterval);

    timerInterval = setInterval(async () => {
      if (remainingSeconds > 0) {
        remainingSeconds--;

        // Small animation
        timerDisplay.classList.add("tick");
        updateTimerDisplay();
        setTimeout(() => timerDisplay.classList.remove("tick"), 150);

      } else {
        clearInterval(timerInterval);
        timerInterval = null;
        startTimerBtn.disabled = false;

        await handleTimerComplete();
      }
    }, 1000);
  });
}

// ===== HANDLE TIMER COMPLETE =====
async function handleTimerComplete() {
  if (!currentUser || !currentActivity) return;

  // --- 1. Log ke Firestore ---
  try {
    await addDoc(
      collection(db, "users", currentUser.uid, "focusLog"),
      {
        activityName: currentActivity.name,
        minutes: currentActivity.minutes,
        createdAt: serverTimestamp(),
      }
    );
  } catch (error) {
    console.error("Gagal log fokus:", error);
  }

  alert(`Sesi "${currentActivity.name}" selesai!`);

  // --- 2. Auto-tick aktiviti (jika bukan preset) ---
  if (currentActivity.id) {
    const activityRef = doc(
      db,
      "users",
      currentUser.uid,
      "activities",
      currentActivity.id
    );

    try {
      await updateDoc(activityRef, {
        completedToday: true,
        lastCompletedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error("Gagal auto tick:", error);
    }
  }

  // --- 3. Reset timer UI ---
  remainingSeconds = currentActivity.minutes * 60;
  updateTimerDisplay();
}

// =========================
// PART 5 — FOCUS LOG + SUMMARY + FILTERS
// =========================

// ===== LISTEN TO FOCUS LOG =====
function listenToFocusLog() {
  if (!currentUser) return;

  const logRef = collection(db, "users", currentUser.uid, "focusLog");
  const q = query(logRef, orderBy("createdAt", "desc"));

  onSnapshot(q, (snapshot) => {
    const logs = [];
    snapshot.forEach((docSnap) => {
      logs.push({ id: docSnap.id, ...docSnap.data() });
    });

    renderFocusLog(logs);
    renderLogSummary(logs);
  });
}

// ===== RENDER FOCUS LOG LIST =====
function renderFocusLog(logs) {
  if (!focusLogList) return;

  focusLogList.innerHTML = "";

  if (!logs.length) {
    focusLogList.innerHTML = `<li>Belum ada log fokus.</li>`;
    return;
  }

  logs.forEach((item) => {
    const li = document.createElement("li");

    const dateStr = item.createdAt?.toDate
      ? item.createdAt.toDate().toLocaleString()
      : "";

    li.innerHTML = `
      <div style="flex:1;">
        <strong>${item.activityName}</strong>
        <div>${item.minutes} minit</div>
        <div style="font-size:0.8rem; opacity:0.7;">${dateStr}</div>
      </div>
    `;

    focusLogList.appendChild(li);
  });
}

// ===== SUMMARY (TOTAL MINUTES) =====
function renderLogSummary(logs) {
  if (!logSummary) return;

  if (!logs.length) {
    logSummary.textContent = "";
    return;
  }

  let totalMinutes = 0;
  logs.forEach((item) => {
    totalMinutes += item.minutes || 0;
  });

  logSummary.textContent =
    `Jumlah masa fokus: ${totalMinutes} minit (semua sesi).`;
}

// =========================
// LOG FILTERS (Today, 7 Days, 30 Days, All)
// =========================

if (logFilters) {
  logFilters.addEventListener("change", () => {
    applyLogFilter(logFilters.value);
  });
}

function applyLogFilter(filter) {
  if (!currentUser) return;

  const logRef = collection(db, "users", currentUser.uid, "focusLog");

  let q;

  const now = new Date();

  if (filter === "today") {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    q = query(
      logRef,
      where("createdAt", ">=", start),
      orderBy("createdAt", "desc")
    );
  }

  else if (filter === "7days") {
    const start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    q = query(
      logRef,
      where("createdAt", ">=", start),
      orderBy("createdAt", "desc")
    );
  }

  else if (filter === "30days") {
    const start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    q = query(
      logRef,
      where("createdAt", ">=", start),
      orderBy("createdAt", "desc")
    );
  }

  else {
    // ALL
    q = query(logRef, orderBy("createdAt", "desc"));
  }

  onSnapshot(q, (snapshot) => {
    const logs = [];
    snapshot.forEach((docSnap) => {
      logs.push({ id: docSnap.id, ...docSnap.data() });
    });

    renderFocusLog(logs);
    renderLogSummary(logs);
  });
}

// =========================
// PART 6 — WEEKLY CHART + WEEKLY STATS
// =========================

// ===== GENERATE LAST 7 DAYS LABELS =====
function getLast7DaysLabels() {
  const labels = [];
  const now = new Date();

  for (let i = 6; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    labels.push(d.toLocaleDateString("ms-MY", { weekday: "short" }));
  }

  return labels;
}

// ===== LISTEN TO LOGS FOR WEEKLY CHART =====
function updateWeeklyAnalytics(logs) {
  const now = new Date();
  const dailyTotals = [0, 0, 0, 0, 0, 0, 0]; // 7 hari

  logs.forEach((item) => {
    if (!item.createdAt?.toDate) return;

    const date = item.createdAt.toDate();
    const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));

    if (diffDays >= 0 && diffDays < 7) {
      const index = 6 - diffDays; // hari terbaru di kanan
      dailyTotals[index] += item.minutes || 0;
    }
  });

  renderWeeklyChart(dailyTotals);
  renderWeeklyStats(dailyTotals);
}

// ===== RENDER WEEKLY CHART =====
function renderWeeklyChart(dailyTotals) {
  if (!weeklyChartCanvas) return;

  const labels = getLast7DaysLabels();

  // Destroy chart lama kalau ada
  if (weeklyChartInstance) {
    weeklyChartInstance.destroy();
  }

  weeklyChartInstance = new Chart(weeklyChartCanvas, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "Minit Fokus",
          data: dailyTotals,
          backgroundColor: "rgba(59, 130, 246, 0.6)",
          borderColor: "rgba(37, 99, 235, 1)",
          borderWidth: 1,
          borderRadius: 6,
        },
      ],
    },
    options: {
      responsive: true,
      scales: {
        y: {
          beginAtZero: true,
          ticks: { color: "#555" },
        },
        x: {
          ticks: { color: "#555" },
        },
      },
      plugins: {
        legend: { display: false },
      },
    },
  });
}

// ===== RENDER WEEKLY STATS LIST =====
function renderWeeklyStats(dailyTotals) {
  if (!weeklyStatsList) return;

  weeklyStatsList.innerHTML = "";

  const labels = getLast7DaysLabels();

  for (let i = 0; i < 7; i++) {
    const li = document.createElement("li");
    li.innerHTML = `
      <strong>${labels[i]}</strong>: ${dailyTotals[i]} minit
    `;
    weeklyStatsList.appendChild(li);
  }
}

// ===== INTEGRATE WITH LOG SNAPSHOT =====
// Modify listenToFocusLog to call updateWeeklyAnalytics(logs)
function listenToFocusLog() {
  if (!currentUser) return;

  const logRef = collection(db, "users", currentUser.uid, "focusLog");
  const q = query(logRef, orderBy("createdAt", "desc"));

  onSnapshot(q, (snapshot) => {
    const logs = [];
    snapshot.forEach((docSnap) => {
      logs.push({ id: docSnap.id, ...docSnap.data() });
    });

    // Render log list + summary
    renderFocusLog(logs);
    renderLogSummary(logs);

    // NEW: Weekly analytics
    updateWeeklyAnalytics(logs);
  });
}
