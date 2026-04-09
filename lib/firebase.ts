import { getApps, initializeApp } from "firebase/app";
import { browserLocalPersistence, getAuth, setPersistence } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCbCddHss2y-7UG6trwPhTPpbRVRCoDprM",
  authDomain: "sync-670a6.firebaseapp.com",
  projectId: "sync-670a6",
  storageBucket: "sync-670a6.firebasestorage.app",
  messagingSenderId: "835437547549",
  appId: "1:835437547549:web:f9dfa8a1fc1cc48eb1b6f4"
};

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth(app);

if (typeof window !== "undefined") {
  void setPersistence(auth, browserLocalPersistence);
}
