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
let selectedActivityId = null;
let timerInterval = null;
let currentUser = null;
let audio = null;

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
    btn.onclick = () => selectActivity({
      id: null,
      name: p.name,
      minutes: p.minutes,
      source: "preset"
    });
    presetList.appendChild(btn);
  });
}

// SELECT ACTIVITY
function selectActivity({ id, name, minutes, source }) {
  selectedMinutes = minutes;
  selectedActivityName = name;
  selectedActivityId = id;

  startTimerBtn.disabled = false;
  timerDisplay.textContent = `${String(minutes).padStart(2, "0")}:00`;
  selectedActivityLabel.textContent =
    `${source === "preset" ? "[Preset] " : ""}${name} — ${minutes} minit`;
}

// TIMER LOGIC (AUDIO FILE METHOD)
function startTimer() {
  if (!selectedMinutes || selectedMinutes <= 0) return;
  if (!currentUser) return alert("Sila login dahulu.");

  if (timerInterval) clearInterval(timerInterval);

  let totalSeconds = selectedMinutes * 60;
  updateTimerDisplay(totalSeconds);

  // ✅ PLAY AUDIO FILE (SILENT + ALARM)
  const audioFile = `focus${selectedMinutes}min.mp3`; // <-- FILE DI ROOT
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

// FIRESTORE: LOG SESSION
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

// LOAD ACTIVITIES
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
    snap.forEach(docSnap => {
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
  }
});

// SIGNUP
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

// LOGIN
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

// LOGOUT
logoutBtn.addEventListener("click", async () => {
  await signOut(auth);
});

// START TIMER
startTimerBtn.addEventListener("click", startTimer);
