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

// Función para mostrar mensajes de estado
function mostrarMensaje(mensaje, color = "red") {
    const mensajeElemento = document.getElementById("login-message");
    mensajeElemento.textContent = mensaje;
    mensajeElemento.style.color = color;
}

// Manejar inicio de sesión
document.getElementById("login-form").addEventListener("submit", async function (event) {
    event.preventDefault();

    const dni = document.getElementById("login-dni").value.trim();
    const password = document.getElementById("login-password").value.trim();

    if (!dni || !password) {
        mostrarMensaje("Todos los campos son obligatorios.");
        return;
    }

    try {
        const atletaRef = doc(db, "atletas", dni);
        const atletaSnap = await getDoc(atletaRef);

        if (!atletaSnap.exists()) {
            mostrarMensaje("DNI no encontrado.");
            return;
        }

        const atletaData = atletaSnap.data();

        if (atletaData.password !== password) {
            mostrarMensaje("Contraseña incorrecta.");
            return;
        }

        // Guardar sesión en LocalStorage
        localStorage.setItem("usuario", JSON.stringify({ dni, nombre: atletaData.nombre, apellido: atletaData.apellido }));

        // Redirigir o actualizar
        window.location.reload();
    } catch (error) {
        console.error("Error al iniciar sesión:", error);
        mostrarMensaje("Error al iniciar sesión.");
    }
});

// Verificar si hay usuario logueado
document.addEventListener("DOMContentLoaded", () => {
    const usuario = JSON.parse(localStorage.getItem("usuario"));
    if (usuario) {
        document.getElementById("login-section").style.display = "none";
        document.getElementById("user-info").style.display = "block";
        document.getElementById("user-name").textContent = `${usuario.nombre} ${usuario.apellido}`;
    }
});

// Cerrar sesión
document.getElementById("logout")?.addEventListener("click", () => {
    localStorage.removeItem("usuario");
    window.location.reload();
});
