// firebase-config.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.11.1/firebase-app.js";

const firebaseConfig = {
  apiKey: "AIzaSyAFHZcfSELn2Cfgh3I1og2mw3rIL8gqlAM",
  authDomain: "maratonessudeste.firebaseapp.com",
  projectId: "maratonessudeste",
  storageBucket: "maratonessudeste.appspot.com",
  messagingSenderId: "76996108214",
  appId: "1:76996108214:web:036e55fbfd01e15b462b17",
  measurementId: "G-B1GL7QJGSH"
};

// Inicializar Firebase y exportar la instancia
export const app = initializeApp(firebaseConfig);
