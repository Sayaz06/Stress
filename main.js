/* ============================================================
   PART 1 — FIREBASE IMPORTS (GUNA firebase.js)
============================================================ */

import { app, auth, db } from "./firebase.js";

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.13.1/firebase-auth.js";

import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js";

/* ============================================================
   PART 2 — DOM ELEMENTS
============================================================ */

const authSection = document.getElementById("authSection");
const appSection = document.getElementById("appSection");

const signupForm = document.getElementById("signupForm");
const loginForm = document.getElementById("loginForm");
const logoutBtn = document.getElementById("logoutBtn");

const plannerTabBtn = document.getElementById("plannerTabBtn");
const logTabBtn = document.getElementById("logTabBtn");

const plannerView = document.getElementById("plannerView");
const logView = document.getElementById("logView");

const presetList = document.getElementById("presetList");
const addActivityForm = document.getElementById("addActivityForm");
const activityNameInput = document.getElementById("activityName");
const activityMinutesInput = document.getElementById("activityMinutes");
const userActivitiesList = document.getElementById("userActivities");

const selectedActivityLabel = document.getElementById("selectedActivityLabel");
const timerDisplay = document.getElementById("timerDisplay");
const startTimerBtn = document.getElementById("startTimerBtn");

const focusLogList = document.getElementById("focusLogList");
const logSummary = document.getElementById("logSummary");

const weeklyStatsList = document.getElementById("weeklyStatsList");
const weeklyChartCanvas = document.getElementById("weeklyChart");

const themeToggle = document.getElementById("themeToggle");
const offlineBanner = document.getElementById("offlineBanner");
const userInfo = document.getElementById("userInfo");

let currentUser = null;
let currentActivity = null;
let remainingSeconds = 0;
let timerInterval = null;
let weeklyChartInstance = null;

let unsubscribeActivities = null;
let unsubscribeFocusLog = null;

/* ============================================================
   PART 3 — AUTH LOGIC
============================================================ */

function setAppForUser(user) {
  if (user) {
    currentUser = user;
    userInfo.textContent = `Logged in sebagai: ${user.email}`;
    authSection.style.display = "none";
    appSection.style.display = "block";

    listenToUserActivities();
    listenToFocusLog();
    autoResetDailyTicks();
    showPlannerView();
  } else {
    currentUser = null;
    userInfo.textContent = "Sila login atau signup.";

    authSection.style.display = "block";
    appSection.style.display = "none";

    userActivitiesList.innerHTML = "";
    focusLogList.innerHTML = "";
    logSummary.textContent = "";
    weeklyStatsList.innerHTML = "";

    if (weeklyChartInstance) {
      weeklyChartInstance.destroy();
      weeklyChartInstance = null;
    }

    if (unsubscribeActivities) unsubscribeActivities();
    if (unsubscribeFocusLog) unsubscribeFocusLog();
  }
}

signupForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = signupForm.signupEmail.value.trim();
  const password = signupForm.signupPassword.value.trim();
  if (!email || !password) return;

  try {
    await createUserWithEmailAndPassword(auth, email, password);
    signupForm.reset();
  } catch (error) {
    console.error(error);
    showErrorToast("Signup gagal. Sila cuba lagi.");
  }
});

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = loginForm.loginEmail.value.trim();
  const password = loginForm.loginPassword.value.trim();
  if (!email || !password) return;

  try {
    await signInWithEmailAndPassword(auth, email, password);
    loginForm.reset();
  } catch (error) {
    console.error(error);
    showErrorToast("Login gagal. Sila semak email/password.");
  }
});

logoutBtn.addEventListener("click", async () => {
  try {
    await signOut(auth);
  } catch (error) {
    console.error(error);
    showErrorToast("Gagal logout.");
  }
});

onAuthStateChanged(auth, (user) => {
  setAppForUser(user);
});

/* ============================================================
   PART 4 — THEME TOGGLE
============================================================ */

themeToggle.addEventListener("click", () => {
  document.body.classList.toggle("dark");
});

/* ============================================================
   PART 5 — TABS (PLANNER / LOG)
============================================================ */

function showPlannerView() {
  plannerView.style.display = "block";
  logView.style.display = "none";

  plannerTabBtn.disabled = true;
  logTabBtn.disabled = false;
}

function showLogView() {
  logView.style.display = "block";
  plannerView.style.display = "none";

  plannerTabBtn.disabled = false;
  logTabBtn.disabled = true;

  window.scrollTo({ top: 0, behavior: "smooth" });
}

plannerTabBtn.addEventListener("click", showPlannerView);
logTabBtn.addEventListener("click", showLogView);

/* ============================================================
   PART 6 — PRESET ACTIVITIES
============================================================ */

const presetActivities = [
  { name: "Fokus 1 minit", minutes: 1 },
  { name: "Fokus 5 minit", minutes: 5 },
  { name: "Fokus 10 minit", minutes: 10 },
  { name: "Fokus 15 minit", minutes: 15 },
  { name: "Fokus 20 minit", minutes: 20 },
  { name: "Fokus 25 minit", minutes: 25 },
  { name: "Fokus 30 minit", minutes: 30 },
  { name: "Fokus 45 minit", minutes: 45 }
];

function renderPresetActivities() {
  presetList.innerHTML = "";
  presetActivities.forEach((p) => {
    const btn = document.createElement("button");
    btn.textContent = `${p.name} (${p.minutes} min)`;
    btn.addEventListener("click", () => {
      selectActivity({
        id: null,
        name: p.name,
        minutes: p.minutes,
        isPreset: true
      });
    });
    presetList.appendChild(btn);
  });
}
renderPresetActivities();

/* ============================================================
   PART 7 — USER ACTIVITIES (CRUD + TICK CLOUD)
============================================================ */

function listenToUserActivities() {
  if (!currentUser) return;
  const ref = collection(db, "users", currentUser.uid, "activities");
  const q = query(ref, orderBy("createdAt", "desc"));

  if (unsubscribeActivities) unsubscribeActivities();

  unsubscribeActivities = onSnapshot(
    q,
    (snapshot) => {
      const activities = [];
      snapshot.forEach((docSnap) => {
        activities.push({ id: docSnap.id, ...docSnap.data() });
      });
      renderUserActivities(activities);
    },
    (error) => {
      console.error(error);
      showErrorToast("Gagal memuat aktiviti.");
    }
  );
}

function renderUserActivities(activities) {
  userActivitiesList.innerHTML = "";
  const fragment = document.createDocumentFragment();

  activities.forEach((a) => {
    const li = document.createElement("li");

    const isDone = !!a.completedToday;
    const textClass = isDone ? "activity-done" : "";
    const doneText = isDone ? `<div class="activity-done-text">Selesai hari ini</div>` : "";

    li.innerHTML = `
      <div class="activity-main">
        <div class="${textClass}">${a.name} (${a.minutes} min)</div>
        ${doneText}
      </div>
      <div class="activity-actions">
        <button class="tick-btn" data-id="${a.id}">
          ${isDone ? "Untick" : "Tick"}
        </button>
        <button class="select-btn" data-id="${a.id}">Pilih</button>
        <button class="danger delete-btn" data-id="${a.id}">Padam</button>
      </div>
    `;

    fragment.appendChild(li);
  });

  userActivitiesList.appendChild(fragment);
  attachActivityButtonsEvents();
}

addActivityForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!currentUser) return;

  const name = activityNameInput.value.trim();
  const minutes = parseInt(activityMinutesInput.value.trim(), 10);
  if (!name || !minutes) return;

  try {
    await addDoc(collection(db, "users", currentUser.uid, "activities"), {
      name,
      minutes,
      completedToday: false,
      lastCompletedAt: null,
      createdAt: serverTimestamp()
    });
    addActivityForm.reset();
  } catch (error) {
    console.error(error);
    showErrorToast("Gagal tambah aktiviti.");
  }
});

function attachActivityButtonsEvents() {
  const tickBtns = document.querySelectorAll(".tick-btn");
  const selectBtns = document.querySelectorAll(".select-btn");
  const deleteBtns = document.querySelectorAll(".delete-btn");

  tickBtns.forEach((btn) => {
    btn.addEventListener("click", () => handleTickClick(btn));
  });

  selectBtns.forEach((btn) => {
    btn.addEventListener("click", () => handleSelectActivityClick(btn));
  });

  deleteBtns.forEach((btn) => {
    btn.addEventListener("click", () => handleDeleteActivity(btn));
  });
}

async function handleTickClick(btn) {
  if (!currentUser) return;

  const id = btn.dataset.id;
  const ref = doc(db, "users", currentUser.uid, "activities", id);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;

  const data = snap.data();
  const isCurrentlyDone = !!data.completedToday;

  try {
    await updateDoc(ref, {
      completedToday: !isCurrentlyDone,
      lastCompletedAt: !isCurrentlyDone ? serverTimestamp() : null
    });
  } catch (error) {
    console.error(error);
    showErrorToast("Gagal update tick.");
  }
}

async function handleSelectActivityClick(btn) {
  if (!currentUser) return;

  const id = btn.dataset.id;
  const ref = doc(db, "users", currentUser.uid, "activities", id);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;

  const data = snap.data();
  selectActivity({
    id,
    name: data.name,
    minutes: data.minutes,
    isPreset: false
  });
}

async function handleDeleteActivity(btn) {
  if (!currentUser) return;

  const id = btn.dataset.id;
  const ref = doc(db, "users", currentUser.uid, "activities", id);

  const confirmDelete = confirm("Padam aktiviti ini?");
  if (!confirmDelete) return;

  try {
    await deleteDoc(ref);
  } catch (error) {
    console.error(error);
    showErrorToast("Gagal padam aktiviti.");
  }
}

/* ============================================================
   PART 8 — AUTO RESET DAILY TICKS
============================================================ */

function autoResetDailyTicks() {
  if (!currentUser) return;

  const ref = collection(db, "users", currentUser.uid, "activities");

  onSnapshot(
    ref,
    async (snapshot) => {
      const todayStr = new Date().toDateString();
      const promises = [];

      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        if (!data.lastCompletedAt || !data.completedToday) return;

        const lastDate = data.lastCompletedAt.toDate().toDateString();
        if (lastDate !== todayStr) {
          const aRef = doc(db, "users", currentUser.uid, "activities", docSnap.id);
          promises.push(
            updateDoc(aRef, {
              completedToday: false
            })
          );
        }
      });

      if (promises.length > 0) {
        try {
          await Promise.all(promises);
        } catch (error) {
          console.error(error);
          showErrorToast("Gagal auto reset tick.");
        }
      }
    },
    (error) => {
      console.error(error);
    }
  );
}

/* ============================================================
   PART 9 — TIMER + AUTO LOG FOCUS + PLAY AUDIO DARI AWAL
============================================================ */

// audio global untuk fokus
let currentFocusAudio = null;

function selectActivity(activity) {
  currentActivity = activity;
  remainingSeconds = (activity.minutes || 0) * 60;

  selectedActivityLabel.textContent = `Aktiviti: ${activity.name} (${activity.minutes} min)`;
  updateTimerDisplay();
  startTimerBtn.disabled = false;
}

function updateTimerDisplay() {
  const m = Math.floor(remainingSeconds / 60);
  const s = remainingSeconds % 60;
  timerDisplay.textContent = `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

startTimerBtn.addEventListener("click", () => {
  if (!currentActivity || !currentUser) return;

  // hentikan timer lama jika ada
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }

  // mula main audio fokus sebaik user tekan Start
  playFocusAudioForMinutes(currentActivity.minutes || 0);

  timerInterval = setInterval(async () => {
    remainingSeconds--;
    updateTimerDisplay();

    if (remainingSeconds <= 0) {
      clearInterval(timerInterval);
      timerInterval = null;

      await onTimerComplete();
    }
  }, 1000);
});

/* ============================================================
   PART 10 — FOCUS LOG + SUMMARY + WEEKLY ANALYTICS
============================================================ */

async function onTimerComplete() {
  if (!currentActivity || !currentUser) return;

  // ✅ Jangan main bunyi di sini — bunyi sudah dimainkan dari awal
  // (fail focusXmin.mp3 mengandungi silent + alarm)

  try {
    await addDoc(collection(db, "users", currentUser.uid, "focusLog"), {
      activityName: currentActivity.name,
      minutes: currentActivity.minutes,
      createdAt: serverTimestamp()
    });

    alert(`Sesi "${currentActivity.name}" selesai! Log telah disimpan.`);
  } catch (error) {
    console.error(error);
    showErrorToast("Gagal simpan log fokus.");
  }
}

function listenToFocusLog() {
  if (!currentUser) return;

  const ref = collection(db, "users", currentUser.uid, "focusLog");
  const q = query(ref, orderBy("createdAt", "desc"));

  if (unsubscribeFocusLog) unsubscribeFocusLog();

  unsubscribeFocusLog = onSnapshot(
    q,
    (snapshot) => {
      const logs = [];
      snapshot.forEach((docSnap) => {
        logs.push({ id: docSnap.id, ...docSnap.data() });
      });

      renderFocusLog(logs);
      renderLogSummary(logs);
      updateWeeklyAnalytics(logs);
    },
    (error) => {
      console.error(error);
      showErrorToast("Gagal memuat log fokus.");
    }
  );
}

function renderFocusLog(logs) {
  focusLogList.innerHTML = "";

  logs.forEach((log) => {
    const li = document.createElement("li");

    const dateStr = log.createdAt?.toDate
      ? log.createdAt.toDate().toLocaleString("ms-MY")
      : "-";

    li.innerHTML = `
      <div>
        <strong>${log.activityName}</strong><br />
        ${log.minutes} min — <small>${dateStr}</small>
      </div>
    `;

    focusLogList.appendChild(li);
  });
}

function renderLogSummary(logs) {
  const totalMinutes = logs.reduce((sum, log) => sum + (log.minutes || 0), 0);
  logSummary.textContent = `Jumlah fokus terkumpul: ${totalMinutes} minit`;
}

function updateWeeklyAnalytics(logs) {
  const now = new Date();

  const totals = [0, 0, 0, 0, 0, 0, 0];
  const labels = getLast7DaysLabels(now);

  logs.forEach((log) => {
    if (!log.createdAt?.toDate) return;

    const date = log.createdAt.toDate();
    const diffDays = Math.floor((stripTime(now) - stripTime(date)) / 86400000);

    if (diffDays >= 0 && diffDays < 7) {
      const index = 6 - diffDays;
      totals[index] += log.minutes || 0;
    }
  });

  renderWeeklyStats(labels, totals);
  renderWeeklyChart(labels, totals);
}

function stripTime(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function getLast7DaysLabels(baseDate) {
  const labels = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(baseDate);
    d.setDate(d.getDate() - i);
    labels.push(d.toLocaleDateString("ms-MY", { weekday: "short" }));
  }
  return labels;
}

function renderWeeklyStats(labels, totals) {
  weeklyStatsList.innerHTML = "";
  for (let i = 0; i < labels.length; i++) {
    const li = document.createElement("li");
    li.textContent = `${labels[i]}: ${totals[i]} minit`;
    weeklyStatsList.appendChild(li);
  }
}

function renderWeeklyChart(labels, totals) {
  if (weeklyChartInstance) {
    weeklyChartInstance.destroy();
  }

  weeklyChartInstance = new Chart(weeklyChartCanvas, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "Minit fokus",
          data: totals,
          backgroundColor: "rgba(59,130,246,0.7)",
          borderColor: "rgba(37,99,235,1)",
          borderWidth: 1,
          borderRadius: 6
        }
      ]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false }
      },
      scales: {
        y: { beginAtZero: true }
      }
    }
  });
}

/* ============================================================
   PART 11 — SISTEM BUNYI focusXmin.mp3
============================================================ */

// Simpan audio semasa supaya boleh stop bila user start timer baru
let currentFocusAudio = null;

// Senarai durasi fail yang memang wujud dalam folder sounds/
const AVAILABLE_FOCUS_DURATIONS = [1, 5, 10, 15, 20, 25, 30, 45];

// Cari durasi paling hampir jika user guna durasi pelik (contoh: 12 minit)
function getClosestFocusDuration(minutes) {
  if (!minutes || minutes <= 0) return 1;

  let closest = AVAILABLE_FOCUS_DURATIONS[0];
  let diffMin = Math.abs(minutes - closest);

  for (let i = 1; i < AVAILABLE_FOCUS_DURATIONS.length; i++) {
    const d = Math.abs(minutes - AVAILABLE_FOCUS_DURATIONS[i]);
    if (d < diffMin) {
      diffMin = d;
      closest = AVAILABLE_FOCUS_DURATIONS[i];
    }
  }
  return closest;
}

// Mula mainkan audio fokus berdasarkan minit aktiviti
// Audio ini mengandungi "silent X minit + 10 minit alarm" dalam satu file
function playFocusAudioForMinutes(minutes) {
  const nearest = getClosestFocusDuration(minutes);
  const filePath = `sounds/focus${nearest}min.mp3`;

  // Hentikan audio lama jika ada
  if (currentFocusAudio) {
    try {
      currentFocusAudio.pause();
      currentFocusAudio.currentTime = 0;
    } catch (e) {
      console.warn("Gagal reset audio lama:", e);
    }
  }

  // Buat audio baru
  currentFocusAudio = new Audio(filePath);
  currentFocusAudio.loop = false;

  // Mainkan dari awal — silent dulu, kemudian alarm (ikut file yang ad buat)
  currentFocusAudio.play().catch((err) => {
    console.warn("Audio fokus gagal dimainkan (mungkin block autoplay):", err);
  });
}

/* ============================================================
   PART 12 — OFFLINE MODE + ERROR TOAST
============================================================ */

function updateOnlineStatus() {
  if (navigator.onLine) {
    offlineBanner.classList.remove("show");
  } else {
    offlineBanner.classList.add("show");
  }
}

window.addEventListener("online", updateOnlineStatus);
window.addEventListener("offline", updateOnlineStatus);
updateOnlineStatus();

function showErrorToast(message) {
  const div = document.createElement("div");
  div.className = "error-toast";
  div.textContent = message;
  document.body.appendChild(div);
  setTimeout(() => {
    div.remove();
  }, 2600);
}
