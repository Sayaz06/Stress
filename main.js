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
  serverTimestamp
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
    btn.onclick = () => selectActivity(p.minutes);
    presetList.appendChild(btn);
  });
}

// SELECT ACTIVITY
function selectActivity(minutes) {
  selectedMinutes = minutes;
  startTimerBtn.disabled = false;
  timerDisplay.textContent = `${minutes}:00`;
}

// TIMER
function startTimer() {
  let totalSeconds = selectedMinutes * 60;

  timerInterval = setInterval(() => {
    totalSeconds--;

    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;

    timerDisplay.textContent = `${m}:${s.toString().padStart(2, "0")}`;

    if (totalSeconds <= 0) {
      clearInterval(timerInterval);
      playSound();
      alert("Fokus selesai!");
    }
  }, 1000);
}

// AUDIO
function playSound() {
  const audio = new Audio("https://actions.google.com/sounds/v1/alarms/beep_short.ogg");
  audio.play();
}

// LOAD USER ACTIVITIES
async function loadUserActivities(user) {
  userActivities.innerHTML = "<li>Loading...</li>";

  const q = query(
    collection(db, "restActivities"),
    where("uid", "==", user.uid),
    orderBy("createdAt", "desc")
  );

  const snap = await getDocs(q);

  userActivities.innerHTML = "";
  snap.forEach((docSnap) => {
    const data = docSnap.data();
    const li = document.createElement("li");
    li.textContent = `${data.name} — ${data.minutes} minit`;
    li.onclick = () => selectActivity(data.minutes);
    userActivities.appendChild(li);
  });
}

// ADD CUSTOM ACTIVITY
addActivityForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const user = auth.currentUser;
  if (!user) return;

  const name = activityName.value.trim();
  const minutes = parseInt(activityMinutes.value);

  await addDoc(collection(db, "restActivities"), {
    uid: user.uid,
    name,
    minutes,
    createdAt: serverTimestamp()
  });

  activityName.value = "";
  activityMinutes.value = "";

  loadUserActivities(user);
});

// AUTH STATE
onAuthStateChanged(auth, (user) => {
  if (user) {
    userInfo.textContent = `Logged in as: ${user.email}`;
    authSection.style.display = "none";
    appSection.style.display = "block";
    renderPresets();
    loadUserActivities(user);
  } else {
    userInfo.textContent = "Not logged in";
    authSection.style.display = "block";
    appSection.style.display = "none";
  }
});

// SIGNUP
signupForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  await createUserWithEmailAndPassword(
    auth,
    signupForm.signupEmail.value,
    signupForm.signupPassword.value
  );
});

// LOGIN
loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  await signInWithEmailAndPassword(
    auth,
    loginForm.loginEmail.value,
    loginForm.loginPassword.value
  );
});

// LOGOUT
logoutBtn.addEventListener("click", () => signOut(auth));

// START TIMER
startTimerBtn.addEventListener("click", startTimer);
