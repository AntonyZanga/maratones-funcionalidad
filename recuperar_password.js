// Importar Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// Configuración de Firebase
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

// Función para mostrar mensajes
function mostrarMensaje(elemento, mensaje, color = "black") {
  elemento.textContent = mensaje;
  elemento.style.color = color;
}

// Manejo del modal de recuperación de contraseña
const modal = document.getElementById("password-modal");
const btnOpenModal = document.getElementById("forgot-password-btn");
const btnCloseModal = document.querySelector(".close");

// Abrir el modal
btnOpenModal.addEventListener("click", () => {
  modal.style.display = "block";
});

// Cerrar el modal
btnCloseModal.addEventListener("click", () => {
  modal.style.display = "none";
});

// Cerrar el modal si se hace clic fuera de él
window.addEventListener("click", (event) => {
  if (event.target === modal) {
    modal.style.display = "none";
  }
});

// Función para recuperar la contraseña
document.getElementById("recover-form").addEventListener("submit", async (event) => {
  event.preventDefault();

  const dni = document.getElementById("recover-dni").value.trim();
  const mensajeElemento = document.getElementById("recover-message");

  if (!dni) {
    mostrarMensaje(mensajeElemento, "Por favor, ingrese su DNI.", "red");
    return;
  }

  try {
    const atletaRef = doc(db, "atletas", dni);
    const atletaSnap = await getDoc(atletaRef);

    if (atletaSnap.exists()) {
      const atletaData = atletaSnap.data();
      const password = atletaData.password;

      mostrarMensaje(mensajeElemento, `Tu contraseña es: ${password}`, "green");
    } else {
      mostrarMensaje(mensajeElemento, "No se encontró un atleta con este DNI.", "red");
    }
  } catch (error) {
    console.error("Error al recuperar la contraseña:", error);
    mostrarMensaje(mensajeElemento, "Error al recuperar la contraseña. Intente nuevamente.", "red");
  }
});

