// Importar Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// Configuración de Firebase (Usa la misma que en registration.js)
const firebaseConfig = {
  apiKey: "AIzaSyAFHZcfSELn2Cfgh3I1og2mw3rIL8gqlAM",
  authDomain: "maratonessudeste.firebaseapp.com",
  projectId: "maratonessudeste",
  storageBucket: "maratonessudeste.appspot.com",
  messagingSenderId: "76996108214",
  appId: "1:76996108214:web:036e55fbfd01e15b462b17",
  measurementId: "G-B1GL7QJGSH"
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Función para mostrar mensajes en el formulario
function mostrarMensajeRecuperar(mensaje, color = "black") {
  const mensajeElemento = document.getElementById("mensaje-recuperar");
  mensajeElemento.textContent = mensaje;
  mensajeElemento.style.color = color;
}

// Función para restablecer la contraseña
async function recuperarPassword(event) {
  event.preventDefault();

  const dni = document.getElementById("dni-recuperar").value.trim();
  const fechaNacimiento = document.getElementById("fecha-nacimiento-recuperar").value;
  const nuevaPassword = document.getElementById("nueva-password").value;

  if (!dni || !fechaNacimiento || !nuevaPassword) {
    mostrarMensajeRecuperar("Todos los campos son obligatorios.", "red");
    return;
  }

  if (nuevaPassword.length !== 6) {
    mostrarMensajeRecuperar("La contraseña debe tener exactamente 6 dígitos.", "red");
    return;
  }

  try {
    const atletaRef = doc(db, "atletas", dni);
    const atletaSnap = await getDoc(atletaRef);

    if (!atletaSnap.exists()) {
      mostrarMensajeRecuperar("El DNI no está registrado.", "red");
      return;
    }

    const atletaData = atletaSnap.data();
    if (atletaData.fechaNacimiento !== fechaNacimiento) {
      mostrarMensajeRecuperar("Los datos no coinciden. Verifica tu información.", "red");
      return;
    }

    // Actualizar la contraseña
    await updateDoc(atletaRef, { password: nuevaPassword });

    mostrarMensajeRecuperar("Contraseña actualizada con éxito.", "green");
    document.getElementById("recuperar-form").reset();
  } catch (error) {
    console.error("Error al recuperar la contraseña:", error);
    mostrarMensajeRecuperar("Hubo un error al restablecer la contraseña. Inténtalo de nuevo.", "red");
  }
}

// Agregar evento al formulario
document.getElementById("recuperar-form").addEventListener("submit", recuperarPassword);
