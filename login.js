// Importar los servicios desde config.js
import { auth, db } from './config.js';
import { doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// Función para mostrar mensajes en la sección de depuración
function agregarLog(mensaje, color = "black") {
    const logElemento = document.getElementById("debug-log");
    const nuevoMensaje = document.createElement("p");
    nuevoMensaje.textContent = mensaje;
    nuevoMensaje.style.color = color;
    logElemento.appendChild(nuevoMensaje);
}

// =========================
// 🔥 VERIFICAR SESIÓN AL CARGAR LA PÁGINA 🔥
// =========================
document.addEventListener("DOMContentLoaded", () => {
    agregarLog("🔍 Verificando sesión al cargar la página...");

    let usuarioLocal = localStorage.getItem("usuario");
    let usuarioSession = sessionStorage.getItem("usuario");

    agregarLog("📦 Datos en localStorage: " + usuarioLocal);
    agregarLog("📦 Datos en sessionStorage: " + usuarioSession);

    let usuario = JSON.parse(usuarioSession);

    if (usuario) {
        agregarLog("✅ Usuario detectado en sessionStorage: " + JSON.stringify(usuario), "green");
        document.getElementById("login-section").style.display = "none";
        document.getElementById("user-info").style.display = "block";
        document.getElementById("user-name").textContent = `${usuario.nombre} ${usuario.apellido}`;
    } else {
        agregarLog("❌ No se encontró usuario en sessionStorage. Se muestra login.", "red");
        document.getElementById("login-section").style.display = "block";
        document.getElementById("user-info").style.display = "none";
    }

    // Verificar si el botón existe
    const checkDniButton = document.getElementById("check-dni");
    if (checkDniButton) {
        agregarLog("✅ Botón 'Verificar' detectado.", "green");
    } else {
        agregarLog("❌ Botón 'Verificar' NO encontrado en el DOM.", "red");
    }
});

// =========================
// 🔥 RECUPERACIÓN DE CONTRASEÑA 🔥
// =========================
document.getElementById("check-dni").addEventListener("click", async function() {
    agregarLog("🔍 Botón 'Verificar' presionado.", "blue");

    const dni = document.getElementById("dni-recovery").value.trim();
    const fechaNacimiento = document.getElementById("fecha-nacimiento-recovery").value.trim();

    if (!dni || !fechaNacimiento) {
        agregarLog("⚠️ Campos vacíos en recuperación de contraseña.", "orange");
        document.getElementById("recovery-message").textContent = "Completa todos los campos.";
        return;
    }

    agregarLog("📋 DNI ingresado: " + dni);
    agregarLog("📋 Fecha de nacimiento ingresada: " + fechaNacimiento);

    try {
        const atletaRef = doc(db, "atletas", dni);
        agregarLog("🔎 Buscando documento en Firestore: " + atletaRef.path);

        const atletaSnap = await getDoc(atletaRef);

        if (!atletaSnap.exists()) {
            agregarLog("⚠️ DNI no encontrado en la base de datos.", "red");
            document.getElementById("recovery-message").textContent = "DNI no encontrado.";
            return;
        }

        const atletaData = atletaSnap.data();
        agregarLog("📄 Datos obtenidos de Firestore: " + JSON.stringify(atletaData), "green");

        if (atletaData.fechaNacimiento === fechaNacimiento) {
            document.getElementById("new-password-section").style.display = "block";
            document.getElementById("recovery-message").textContent = "Datos correctos. Ingresa tu nueva contraseña.";
            agregarLog("✅ Datos correctos. Mostrando sección de nueva contraseña.", "green");
        } else {
            agregarLog("⚠️ Fecha de nacimiento incorrecta.", "red");
            document.getElementById("recovery-message").textContent = "Fecha de nacimiento incorrecta.";
        }
    } catch (error) {
        agregarLog("❌ Error en la recuperación de contraseña: " + error, "red");
        document.getElementById("recovery-message").textContent = "Error al verificar el DNI.";
    }
});
