import { getApps, initializeApp } from "firebase/app";
import { browserLocalPersistence, getAuth, setPersistence } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

function getFirebaseEnv(name: string) {
  return process.env[name] ?? "";
}

const firebaseConfig = {
  apiKey: getFirebaseEnv("NEXT_PUBLIC_FIREBASE_API_KEY"),
  authDomain: getFirebaseEnv("NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN"),
  projectId: getFirebaseEnv("NEXT_PUBLIC_FIREBASE_PROJECT_ID"),
  storageBucket: getFirebaseEnv("NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET"),
  messagingSenderId: getFirebaseEnv("NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID"),
  appId: getFirebaseEnv("NEXT_PUBLIC_FIREBASE_APP_ID")
};

const missingFirebaseEnv = Object.entries(firebaseConfig)
  .filter(([, value]) => !value)
  .map(([key]) => key);

if (missingFirebaseEnv.length > 0) {
  throw new Error(`Firebase environment variables are missing: ${missingFirebaseEnv.join(", ")}`);
}

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth(app);

if (typeof window !== "undefined") {
  void setPersistence(auth, browserLocalPersistence);
}
