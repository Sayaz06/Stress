/* ============================================================
   PART 1 — FIREBASE IMPORTS + INIT
============================================================ */

import {
  initializeApp
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";

import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";

import {
  getFirestore,
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
  writeBatch
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "000000000000",
  appId: "YOUR_APP_ID"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth();
const db = getFirestore();

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

const soundSelect = document.getElementById("soundSelect");
const saveSoundBtn = document.getElementById("saveSoundBtn");

const selectedActivityLabel = document.getElementById("selectedActivityLabel");
const timerDisplay = document.getElementById("timerDisplay");
const startTimerBtn = document.getElementById("startTimerBtn");

const logFilters = document.getElementById("logFilters");
const focusLogList = document.getElementById("focusLogList");
const logSummary = document.getElementById("logSummary");

const weeklyStatsList = document.getElementById("weeklyStatsList");
const weeklyChartCanvas = document.getElementById("weeklyChart");

const themeToggle = document.getElementById("themeToggle");
const offlineBanner = document.getElementById("offlineBanner");

let currentUser = null;
let currentActivity = null;
let remainingSeconds = 0;
let timerInterval = null;
let weeklyChartInstance = null;

/* ============================================================
   PART 3 — AUTH LOGIC
============================================================ */

signupForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = signupForm.signupEmail.value;
  const password = signupForm.signupPassword.value;

  try {
    await createUserWithEmailAndPassword(auth, email, password);
  } catch (error) {
    showErrorToast("Signup gagal.");
  }
});

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = loginForm.loginEmail.value;
  const password = loginForm.loginPassword.value;

  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (error) {
    showErrorToast("Login gagal.");
  }
});

logoutBtn.addEventListener("click", () => signOut(auth));

onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUser = user;

    authSection.style.display = "none";
    appSection.style.display = "block";

    loadUserSoundPreference();
    listenToUserActivities();
    listenToFocusLog();
    autoResetDailyTicks();

  } else {
    currentUser = null;

    authSection.style.display = "block";
    appSection.style.display = "none";

    userActivitiesList.innerHTML = "";
    focusLogList.innerHTML = "";
    logSummary.textContent = "";
  }
});

/* ============================================================
   PART 4 — THEME TOGGLE
============================================================ */

themeToggle.addEventListener("click", () => {
  document.body.classList.toggle("dark");
});

/* ============================================================
   PART 5 — PRESET ACTIVITIES
============================================================ */

const presetActivities = [
  { name: "Belajar", minutes: 25 },
  { name: "Kerja", minutes: 30 },
  { name: "Rehat", minutes: 10 }
];

function renderPresetActivities() {
  presetList.innerHTML = "";
  presetActivities.forEach((p) => {
    const btn = document.createElement("button");
    btn.textContent = `${p.name} (${p.minutes} min)`;
    btn.addEventListener("click", () => selectActivity(p));
    presetList.appendChild(btn);
  });
}
renderPresetActivities();

/* ============================================================
   PART 6 — USER ACTIVITIES CRUD
============================================================ */

function listenToUserActivities() {
  const ref = collection(db, "users", currentUser.uid, "activities");
  const q = query(ref, orderBy("createdAt", "desc"));

  onSnapshot(q, (snapshot) => {
    const activities = [];
    snapshot.forEach((docSnap) => {
      activities.push({ id: docSnap.id, ...docSnap.data() });
    });
    renderUserActivities(activities);
  });
}

function renderUserActivities(activities) {
  userActivitiesList.innerHTML = "";

  const fragment = document.createDocumentFragment();

  activities.forEach((a) => {
    const li = document.createElement("li");
    li.classList.add("fade-in");

    const done = a.completedToday ? "activity-done" : "";

    li.innerHTML = `
      <div style="flex:1;">
        <span class="${done}">${a.name} (${a.minutes} min)</span>
        ${a.completedToday ? `<span class="activity-done-badge pulse">Selesai</span>` : ""}
      </div>

      <div style="display:flex; gap:6px;">
        <button class="tick-btn" data-id="${a.id}">
          ${a.completedToday ? "Untick" : "Tick"}
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

  const name = activityNameInput.value.trim();
  const minutes = parseInt(activityMinutesInput.value.trim(), 10);

  if (!name || !minutes) return;

  try {
    await addDoc(collection(db, "users", currentUser.uid, "activities"), {
      name,
      minutes,
      completedToday: false,
      createdAt: serverTimestamp()
    });

    addActivityForm.reset();
  } catch (error) {
    showErrorToast("Gagal tambah aktiviti.");
  }
});

function attachActivityButtonsEvents() {
  document.querySelectorAll(".tick-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.dataset.id;
      const ref = doc(db, "users", currentUser.uid, "activities", id);

      const isTick = btn.textContent === "Tick";

      await updateDoc(ref, {
        completedToday: isTick,
        lastCompletedAt: isTick ? serverTimestamp() : null
      });
    });
  });

  document.querySelectorAll(".select-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.dataset.id;
      const ref = doc(db, "users", currentUser.uid, "activities", id);
      const snap = await getDoc(ref);

      if (snap.exists()) {
        selectActivity({ id, ...snap.data() });
      }
    });
  });

  document.querySelectorAll(".delete-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.dataset.id;
      const ref = doc(db, "users", currentUser.uid, "activities", id);
      await deleteDoc(ref);
    });
  });
}

/* ============================================================
   PART 7 — TIMER + AUTO LOG
============================================================ */

function selectActivity(activity) {
  currentActivity = activity;
  selectedActivityLabel.textContent = `Aktiviti: ${activity.name} (${activity.minutes} min)`;
  remainingSeconds = activity.minutes * 60;
  updateTimerDisplay();
  startTimerBtn.disabled = false;
}

startTimerBtn.addEventListener("click", () => {
  if (!currentActivity) return;

  clearInterval(timerInterval);

  timerInterval = setInterval(() => {
    remainingSeconds--;
    updateTimerDisplay();

    if (remainingSeconds <= 0) {
      clearInterval(timerInterval);
      handleTimerComplete();
    }
  }, 1000);
});

function updateTimerDisplay() {
  const m = Math.floor(remainingSeconds / 60);
  const s = remainingSeconds % 60;
  timerDisplay.textContent = `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

async function handleTimerComplete() {
  playSelectedSound();

  await addDoc(collection(db, "users", currentUser.uid, "focusLog"), {
    activityName: currentActivity.name,
    minutes: currentActivity.minutes,
    createdAt: serverTimestamp()
  });

  alert(`Sesi "${currentActivity.name}" selesai!`);
}

/* ============================================================
   PART 8 — FOCUS LOG + FILTERS + SUMMARY
============================================================ */

function listenToFocusLog() {
  const ref = collection(db, "users", currentUser.uid, "focusLog");
  const q = query(ref, orderBy("createdAt", "desc"));

  onSnapshot(q, (snapshot) => {
    const logs = [];
    snapshot.forEach((docSnap) => logs.push({ id: docSnap.id, ...docSnap.data() }));

    renderFocusLog(logs);
    renderLogSummary(logs);
    updateWeeklyAnalytics(logs);
  });
}

function renderFocusLog(logs) {
  focusLogList.innerHTML = "";

  logs.forEach((log) => {
    const li = document.createElement("li");
    li.classList.add("fade-in");

    const date = log.createdAt?.toDate().toLocaleString("ms-MY") || "-";

    li.innerHTML = `
      <div>
        <strong>${log.activityName}</strong><br>
        ${log.minutes} min — <small>${date}</small>
      </div>
    `;

    focusLogList.appendChild(li);
  });
}

function renderLogSummary(logs) {
  const total = logs.reduce((sum, l) => sum + (l.minutes || 0), 0);
  logSummary.textContent = `Jumlah fokus: ${total} minit`;
}

/* ============================================================
   PART 9 — WEEKLY ANALYTICS (CHART + STATS)
============================================================ */

function getLast7DaysLabels() {
  const labels = [];
  const now = new Date();

  for (let i = 6; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 86400000);
    labels.push(d.toLocaleDateString("ms-MY", { weekday: "short" }));
  }
  return labels;
}

function updateWeeklyAnalytics(logs) {
  const now = new Date();
  const totals = [0, 0, 0, 0, 0, 0, 0];

  logs.forEach((l) => {
    if (!l.createdAt?.toDate) return;

    const date = l.createdAt.toDate();
    const diff = Math.floor((now - date) / 86400000);

    if (diff >= 0 && diff < 7) {
      const index = 6 - diff;
      totals[index] += l.minutes || 0;
    }
  });

  renderWeeklyChart(totals);
  renderWeeklyStats(totals);
}

function renderWeeklyChart(totals) {
  if (weeklyChartInstance) weeklyChartInstance.destroy();

  weeklyChartInstance = new Chart(weeklyChartCanvas, {
    type: "bar",
    data: {
      labels: getLast7DaysLabels(),
      datasets: [{
        label: "Minit Fokus",
        data: totals,
        backgroundColor: "rgba(59,130,246,0.6)",
        borderColor: "rgba(37,99,235,1)",
        borderWidth: 1,
        borderRadius: 6
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true } }
    }
  });
}

function renderWeeklyStats(totals) {
  weeklyStatsList.innerHTML = "";
  const labels = getLast7DaysLabels();

  totals.forEach((t, i) => {
    const li = document.createElement("li");
    li.textContent = `${labels[i]}: ${t} minit`;
    weeklyStatsList.appendChild(li);
  });
}

/* ============================================================
   PART 10 — SOUND SETTINGS
============================================================ */

const soundFiles = {
  beep: new Audio("sounds/beep.mp3"),
  gong: new Audio("sounds/gong.mp3"),
  nature: new Audio("sounds/nature.mp3")
};

function playSelectedSound() {
  const selected = localStorage.getItem(`sound_${currentUser.uid}`) || "beep";
  const audio = soundFiles[selected];
  if (audio) {
    audio.currentTime = 0;
    audio.play();
  }
}

saveSoundBtn.addEventListener("click", async () => {
  const selected = soundSelect.value;

  localStorage.setItem(`sound_${currentUser.uid}`, selected);

  await updateDoc(doc(db, "users", currentUser.uid), {
    preferredSound: selected
  });

  alert("Pilihan bunyi disimpan!");
});

async function loadUserSoundPreference() {
  const snap = await getDoc(doc(db, "users", currentUser.uid));
  let selected = "beep";

  if (snap.exists() && snap.data().preferredSound) {
    selected = snap.data().preferredSound;
  }

  localStorage.setItem(`sound_${currentUser.uid}`, selected);
  soundSelect.value = selected;
}

/* ============================================================
   PART 11 — AUTO RESET DAILY TICKS
============================================================ */

function autoResetDailyTicks() {
  const ref = collection(db, "users", currentUser.uid, "activities");

  onSnapshot(ref, (snapshot) => {
    const today = new Date().toDateString();

    snapshot.forEach(async (docSnap) => {
      const data = docSnap.data();
      if (!data.lastCompletedAt) return;

      const last = data.lastCompletedAt.toDate().toDateString();

      if (last !== today && data.completedToday) {
        await updateDoc(doc(db, "users", currentUser.uid, "activities", docSnap.id), {
          completedToday: false
        });
      }
    });
  });
}

/* ============================================================
   PART 12 — OFFLINE MODE + ERROR HANDLING
============================================================ */

function updateOnlineStatus() {
  if (navigator.onLine) offlineBanner.classList.remove("show");
  else offlineBanner.classList.add("show");
}

window.addEventListener("online", updateOnlineStatus);
window.addEventListener("offline", updateOnlineStatus);
updateOnlineStatus();

function showErrorToast(msg) {
  const div = document.createElement("div");
  div.className = "error-toast";
  div.textContent = msg;
  document.body.appendChild(div);
  setTimeout(() => div.remove(), 2600);
}

/* ============================================================
   PART 13 — UX POLISH
============================================================ */

function showPlannerView() {
  plannerView.classList.remove("view-hidden");
  logView.classList.add("view-hidden");
  activityNameInput.focus();
}

function showLogView() {
  logView.classList.remove("view-hidden");
  plannerView.classList.add("view-hidden");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

plannerTabBtn.addEventListener("click", showPlannerView);
logTabBtn.addEventListener("click", showLogView);
