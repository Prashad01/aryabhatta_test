import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyCDn6nQnTTAQ1caKcfuJR7-91iDfvoGtVM",
  authDomain: "aryabhatta-13335.firebaseapp.com",
  projectId: "aryabhatta-13335",
  storageBucket: "aryabhatta-13335.firebasestorage.app",
  messagingSenderId: "993172793888",
  appId: "1:993172793888:web:4ead58227b09d0de54aa45",
  measurementId: "G-LER2B3QG5B"
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const storage = getStorage(app);