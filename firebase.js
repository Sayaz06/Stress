/* ============================================================
   firebase.js — FINAL VERSION
============================================================ */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js";

// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyAeaaPQnLkSlUshc735_CwUH35gxLRsdbY",
  authDomain: "mytimingplanner-8bccb.firebaseapp.com",
  projectId: "mytimingplanner-8bccb",
  storageBucket: "mytimingplanner-8bccb.firebasestorage.app",
  messagingSenderId: "925754719118",
  appId: "1:925754719118:web:0ff929defcd80ca15c82df",
  measurementId: "G-X3TVBZMW7W"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
