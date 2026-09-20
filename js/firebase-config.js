import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyCFfQGVGJ7bEvsUuXPjzAq8ftTdtZDHOho",
    authDomain: "l2-universe.firebaseapp.com",
    projectId: "l2-universe",
    storageBucket: "l2-universe.firebasestorage.app",
    messagingSenderId: "1021527998778",
    appId: "1:1021527998778:web:ed83dbd63fdefd987f1003",
    measurementId: "G-W39HDYX1K0"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);