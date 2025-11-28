/* ============================================================
   firebase.js — FINAL VERSION (Project Baru)
============================================================ */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js";

// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyCo41_eKC_s_ZNjaTASyMsByQgVuM_MVAs",
  authDomain: "stress-timing-planner-prod.firebaseapp.com",
  projectId: "stress-timing-planner-prod",
  storageBucket: "stress-timing-planner-prod.firebasestorage.app",
  messagingSenderId: "833808167996",
  appId: "1:833808167996:web:0f1653572e1cacd7b23f39",
  measurementId: "G-H16W0ZSVNT"
};

// ✅ Initialize Firebase
export const app = initializeApp(firebaseConfig);

// ✅ Auth & Firestore
export const auth = getAuth(app);
export const db = getFirestore(app);
