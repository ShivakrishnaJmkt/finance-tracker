// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from 'firebase/firestore';


// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyArDtz20crwiSgNDjdocAv9M1VJ7dRxSIk",
  authDomain: "credix-72f32.firebaseapp.com",
  projectId: "credix-72f32",
  storageBucket: "credix-72f32.firebasestorage.app",
  messagingSenderId: "826198464104",
  appId: "1:826198464104:web:3d6ff18f928e2444cf8ddd",
  measurementId: "G-M0Z95HE1RT"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
 