import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAFHZcfSELn2Cfgh3I1og2mw3rIL8gqlAM",
  authDomain: "maratonessudeste.firebaseapp.com",
  projectId: "maratonessudeste",
  storageBucket: "maratonessudeste.firebasestorage.app",
  messagingSenderId: "76996108214",
  appId: "1:76996108214:web:036e55fbfd01e15b462b17",
  measurementId: "G-B1GL7QJGSH"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

document.getElementById("registro-form").addEventListener("submit", async function (event) {
  event.preventDefault();
  const mensaje = document.getElementById("registro-mensaje");
  mensaje.textContent = "Procesando registro...";

  let dni = document.getElementById("dni").value.trim();
  let nombre = document.getElementById("nombre").value.trim();
  let apellido = document.getElementById("apellido").value.trim();
  let fechaNacimiento = document.getElementById("fecha-nacimiento").value;
  let localidad = document.getElementById("localidad").value.trim();
  let grupoRunning = document.getElementById("tipo-grupo").value;
  let nombreGrupo = grupoRunning === "grupo" ? document.getElementById("nombre-grupo").value.trim() : "";
  let categoria = document.querySelector("input[name='categoria']:checked").value;
  let password = document.getElementById("password").value;
  let confirmPassword = document.getElementById("confirm-password").value;

  if (password.length !== 6 || password !== confirmPassword) {
    mensaje.textContent = "Error: Las contraseñas deben coincidir y tener 6 dígitos.";
    return;
  }

  try {
    const atletaRef = doc(db, "atletas", dni);
    const atletaSnap = await getDoc(atletaRef);

    if (atletaSnap.exists()) {
      mensaje.textContent = "Error: Este DNI ya está registrado.";
      return;
    }

    await setDoc(atletaRef, {
      nombre,
      apellido,
      dni: parseInt(dni),
      fechaNacimiento,
      localidad,
      grupoRunning,
      nombreGrupo,
      categoria,
      password, // 🔴 Se recomienda encriptar en producción
    });

    mensaje.textContent = "Registro exitoso.";
    document.getElementById("registro-form").reset();
  } catch (error) {
    mensaje.textContent = "Error al registrar. Inténtalo nuevamente.";
    console.error("Error al registrar:", error);
  }
});
