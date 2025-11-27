// main.js
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
  getDoc
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

const soundSelect = document.getElementById("soundSelect");
const saveSoundBtn = document.getElementById("saveSoundBtn");

// STATE
let selectedMinutes = 0;
let timerInterval = null;

// PRESET ACTIVITIES
const presets = [
  { name: "Fokus 25 minit", minutes: 25 },
  { name: "Fokus 45 minit", minutes: 45 },
  { name: "Fokus 60 minit", minutes: 60 }
];

// RENDER PRESETS
function renderPresets() {
  presetList.innerHTML = "";
  presets.forEach((p) => {
    const btn = document.createElement("button");
    btn.textContent = `${p.name}`;
    btn.type = "button";
    btn.onclick = () => selectActivity(p.minutes);
    presetList.appendChild(btn);
  });
}

// SELECT ACTIVITY (set minutes & enable start)
function selectActivity(minutes) {
  selectedMinutes = minutes;
  startTimerBtn.disabled = false;
  timerDisplay.textContent = `${String(minutes).padStart(2, "0")}:00`;
}

// TIMER LOGIC
function startTimer() {
  if (!selectedMinutes || selectedMinutes <= 0) return;

  // Prevent multiple timers
  if (timerInterval) clearInterval(timerInterval);

  let totalSeconds = selectedMinutes * 60;

  updateTimerDisplay(totalSeconds);

  timerInterval = setInterval(() => {
    totalSeconds--;

    if (totalSeconds <= 0) {
      clearInterval(timerInterval);
      timerInterval = null;
      updateTimerDisplay(0);
      playSound();
      alert("Fokus selesai!");
      return;
    }

    updateTimerDisplay(totalSeconds);
  }, 1000);
}

function updateTimerDisplay(totalSeconds) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  timerDisplay.textContent = `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

// AUDIO: guna pilihan user
function playSound() {
  const sound = soundSelect.value;
  let url = "";

  if (sound === "beep") {
    url = "https://actions.google.com/sounds/v1/alarms/beep_short.ogg";
  } else if (sound === "gong") {
    url = "https://actions.google.com/sounds/v1/alarms/temple_bell.ogg";
  } else if (sound === "nature") {
    url = "https://actions.google.com/sounds/v1/ambiences/forest_nature.ogg";
  } else {
    url = "https://actions.google.com/sounds/v1/alarms/beep_short.ogg";
  }

  const audio = new Audio(url);
  audio.play();
}

// FIRESTORE: LOAD USER ACTIVITIES
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
      li.textContent = `${data.name} — ${data.minutes} minit`;
      li.style.cursor = "pointer";
      li.onclick = () => selectActivity(data.minutes);
      userActivities.appendChild(li);
    });
  } catch (err) {
    console.error("Error load activities:", err);
    userActivities.innerHTML = "<li>Gagal load aktiviti.</li>";
  }
}

// FIRESTORE: ADD CUSTOM ACTIVITY
addActivityForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const user = auth.currentUser;
  if (!user) {
    alert("Sila login dahulu.");
    return;
  }

  const name = activityName.value.trim();
  const minutes = parseInt(activityMinutes.value, 10);

  if (!name || !minutes || minutes <= 0) {
    alert("Sila isi nama dan minit yang sah.");
    return;
  }

  try {
    await addDoc(collection(db, "restActivities"), {
      uid: user.uid,
      name,
      minutes,
      createdAt: serverTimestamp()
    });

    activityName.value = "";
    activityMinutes.value = "";
    await loadUserActivities(user);
  } catch (err) {
    console.error("Error add activity:", err);
    alert("Gagal simpan aktiviti.");
  }
});

// FIRESTORE: LOAD USER SOUND SETTING
async function loadUserSound(user) {
  try {
    const ref = doc(db, "userSettings", user.uid);
    const snap = await getDoc(ref);
    if (snap.exists()) {
      const data = snap.data();
      if (data.sound) {
        soundSelect.value = data.sound;
      }
    } else {
      soundSelect.value = "beep";
    }
  } catch (err) {
    console.error("Error load sound setting:", err);
    soundSelect.value = "beep";
  }
}

// FIRESTORE: SAVE USER SOUND SETTING
saveSoundBtn.addEventListener("click", async () => {
  const user = auth.currentUser;
  if (!user) {
    alert("Sila login dahulu.");
    return;
  }

  const sound = soundSelect.value;
  try {
    await setDoc(doc(db, "userSettings", user.uid), { sound }, { merge: true });
    alert("Pilihan bunyi disimpan.");
  } catch (err) {
    console.error("Error save sound:", err);
    alert("Gagal simpan pilihan bunyi.");
  }
});

// AUTH STATE
onAuthStateChanged(auth, (user) => {
  if (user) {
    userInfo.textContent = `Logged in as: ${user.email}`;
    authSection.style.display = "none";
    appSection.style.display = "block";
    renderPresets();
    loadUserActivities(user);
    loadUserSound(user);
  } else {
    userInfo.textContent = "Not logged in";
    authSection.style.display = "block";
    appSection.style.display = "none";
    userActivities.innerHTML = "";
    timerDisplay.textContent = "00:00";
    startTimerBtn.disabled = true;
  }
});

// SIGNUP
signupForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = signupForm.signupEmail.value.trim();
  const password = signupForm.signupPassword.value;

  try {
    await createUserWithEmailAndPassword(auth, email, password);
    signupForm.reset();
  } catch (err) {
    console.error("Signup error:", err);
    alert(err.message);
  }
});

// LOGIN
loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = loginForm.loginEmail.value.trim();
  const password = loginForm.loginPassword.value;

  try {
    await signInWithEmailAndPassword(auth, email, password);
    loginForm.reset();
  } catch (err) {
    console.error("Login error:", err);
    alert(err.message);
  }
});

// LOGOUT
logoutBtn.addEventListener("click", async () => {
  try {
    await signOut(auth);
  } catch (err) {
    console.error("Logout error:", err);
  }
});

// START TIMER BUTTON
startTimerBtn.addEventListener("click", startTimer);
