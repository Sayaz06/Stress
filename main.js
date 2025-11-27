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

// STATE
let selectedMinutes = 0;
let selectedActivityName = "";
let selectedActivityId = null; // untuk log & future features
let timerInterval = null;
let currentUser = null;

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
    btn.onclick = () => {
      selectActivity({
        id: null,
        name: p.name,
        minutes: p.minutes,
        source: "preset"
      });
    };
    presetList.appendChild(btn);
  });
}

// SELECT ACTIVITY (set minutes & enable start)
function selectActivity({ id, name, minutes, source }) {
  selectedMinutes = minutes;
  selectedActivityName = name;
  selectedActivityId = id;
  startTimerBtn.disabled = false;
  timerDisplay.textContent = `${String(minutes).padStart(2, "0")}:00`;
  selectedActivityLabel.textContent = `${source === "preset" ? "[Preset] " : ""}${name} — ${minutes} minit`;
}

// TIMER LOGIC
function startTimer() {
  if (!selectedMinutes || selectedMinutes <= 0) return;
  if (!currentUser) {
    alert("Sila login dahulu.");
    return;
  }

  // Prevent multiple timers
  if (timerInterval) clearInterval(timerInterval);

  let totalSeconds = selectedMinutes * 60;
  updateTimerDisplay(totalSeconds);

  timerInterval = setInterval(async () => {
    totalSeconds--;

    if (totalSeconds <= 0) {
      clearInterval(timerInterval);
      timerInterval = null;
      updateTimerDisplay(0);
      playSound();
      alert("Fokus selesai!");

      // Simpan log ke Firestore
      await logFocusSession();
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

// FIRESTORE: LOG FOCUS SESSION
async function logFocusSession() {
  try {
    await addDoc(collection(db, "focusLogs"), {
      uid: currentUser.uid,
      activityId: selectedActivityId || null,
      activityName: selectedActivityName || "Tidak diketahui",
      minutes: selectedMinutes,
      createdAt: serverTimestamp()
    });
    console.log("Focus session logged");
  } catch (err) {
    console.error("Error log focus session:", err);
  }
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

      const titleSpan = document.createElement("span");
      titleSpan.textContent = `${data.name} — ${data.minutes} minit`;
      titleSpan.style.cursor = "pointer";
      titleSpan.onclick = () =>
        selectActivity({
          id: docSnap.id,
          name: data.name,
          minutes: data.minutes,
          source: "custom"
        });

      const editBtn = document.createElement("button");
      editBtn.textContent = "Edit";
      editBtn.type = "button";
      editBtn.style.marginLeft = "0.5rem";
      editBtn.onclick = () => onEditActivity(docSnap.id, data);

      const deleteBtn = document.createElement("button");
      deleteBtn.textContent = "Delete";
      deleteBtn.type = "button";
      deleteBtn.style.marginLeft = "0.5rem";
      deleteBtn.style.background = "#ef4444";
      deleteBtn.onclick = () => onDeleteActivity(docSnap.id);

      li.appendChild(titleSpan);
      li.appendChild(editBtn);
      li.appendChild(deleteBtn);

      userActivities.appendChild(li);
    });
  } catch (err) {
    console.error("Error load activities:", err);
    userActivities.innerHTML = "<li>Gagal load aktiviti.</li>";
  }
}

// EDIT ACTIVITY
async function onEditActivity(id, data) {
  const newName = prompt("Nama aktiviti baru:", data.name);
  if (newName === null) return; // cancel
  const newMinutesRaw = prompt("Minit fokus baru:", data.minutes);
  if (newMinutesRaw === null) return;
  const newMinutes = parseInt(newMinutesRaw, 10);
  if (!newName.trim() || !newMinutes || newMinutes <= 0) {
    alert("Input tidak sah.");
    return;
  }

  try {
    await updateDoc(doc(db, "restActivities", id), {
      name: newName.trim(),
      minutes: newMinutes
    });
    if (currentUser) await loadUserActivities(currentUser);
  } catch (err) {
    console.error("Error update activity:", err);
    alert("Gagal update aktiviti.");
  }
}

// DELETE ACTIVITY
async function onDeleteActivity(id) {
  const confirmDelete = confirm("Padam aktiviti ini?");
  if (!confirmDelete) return;

  try {
    await deleteDoc(doc(db, "restActivities", id));
    if (currentUser) await loadUserActivities(currentUser);
  } catch (err) {
    console.error("Error delete activity:", err);
    alert("Gagal padam aktiviti.");
  }
}

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
  if (!currentUser) {
    alert("Sila login dahulu.");
    return;
  }

  const sound = soundSelect.value;
  try {
    await setDoc(doc(db, "userSettings", currentUser.uid), { sound }, { merge: true });
    alert("Pilihan bunyi disimpan.");
  } catch (err) {
    console.error("Error save sound:", err);
    alert("Gagal simpan pilihan bunyi.");
  }
});

// AUTH STATE
onAuthStateChanged(auth, (user) => {
  currentUser = user;
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
    selectedActivityLabel.textContent = "Tiada aktiviti dipilih.";
    startTimerBtn.disabled = true;
    selectedActivityId = null;
    selectedActivityName = "";
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
