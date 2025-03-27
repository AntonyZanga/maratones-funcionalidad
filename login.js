// Importar los servicios desde config.js
import { auth, db } from './config.js';
import { doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// Función para mostrar mensajes de estado
function mostrarMensaje(mensaje, color = "red") {
    const mensajeElemento = document.getElementById("login-message");
    mensajeElemento.textContent = mensaje;
    mensajeElemento.style.color = color;
}

// =========================
// 🔥 INICIO DE SESIÓN 🔥
// =========================
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
            mostrarMensaje("DNI no registrado.");
            return;
        }

        const atleta = atletaSnap.data();

        if (atleta.password !== password) {
            mostrarMensaje("Contraseña incorrecta.");
            return;
        }

        // Guardar sesión en localStorage y sessionStorage
        const usuarioData = { dni, nombre: atleta.nombre, apellido: atleta.apellido };
        localStorage.setItem("usuario", JSON.stringify(usuarioData)); 
        sessionStorage.setItem("usuario", JSON.stringify(usuarioData)); 

        console.log("✅ Usuario guardado en localStorage:", localStorage.getItem("usuario"));
        console.log("✅ Usuario guardado en sessionStorage:", sessionStorage.getItem("usuario"));

        // Redirigir
        if (dni === "99999999" && password === "111111") {
            window.location.href = "admin.html";
        } else {
            window.location.href = "perfil.html";
        }

    } catch (error) {
        console.error("❌ Error en el login:", error);
        mostrarMensaje("Error al iniciar sesión.");
    }
});

// =========================
// 🔥 VERIFICAR SESIÓN AL CARGAR LA PÁGINA 🔥
// =========================
document.addEventListener("DOMContentLoaded", () => {
    console.log("🔍 Verificando sesión al cargar la página...");

    let usuarioLocal = localStorage.getItem("usuario");
    let usuarioSession = sessionStorage.getItem("usuario");

    console.log("📦 Datos en localStorage:", usuarioLocal);
    console.log("📦 Datos en sessionStorage:", usuarioSession);

    let usuario = JSON.parse(usuarioSession);

    if (usuario) {
        console.log("✅ Usuario detectado en sessionStorage:", usuario);
        document.getElementById("login-section").style.display = "none";
        document.getElementById("user-info").style.display = "block";
        document.getElementById("user-name").textContent = `${usuario.nombre} ${usuario.apellido}`;
    } else {
        console.log("❌ No se encontró usuario en sessionStorage. Se muestra login.");
        document.getElementById("login-section").style.display = "block";
        document.getElementById("user-info").style.display = "none";
    }
});

// =========================
// 🔥 CIERRE DE SESIÓN 🔥
// =========================
document.getElementById("logout")?.addEventListener("click", () => {
    localStorage.removeItem("usuario");
    sessionStorage.clear();
    window.location.href = "index.html";
});

// =========================
// 🔥 RECUPERACIÓN DE CONTRASEÑA 🔥
// =========================
document.getElementById("forgot-password-link").addEventListener("click", function(event) {
    event.preventDefault();
    document.getElementById("password-recovery").style.display = "block";
});

document.getElementById("check-dni").addEventListener("click", async function() {
    const dni = document.getElementById("dni-recovery").value;
    const fechaNacimiento = document.getElementById("fecha-nacimiento-recovery").value;

    if (!dni || !fechaNacimiento) {
        document.getElementById("recovery-message").textContent = "Completa todos los campos.";
        return;
    }

    try {
        const atletaRef = doc(db, "atletas", dni);
        const atletaSnap = await getDoc(atletaRef);

        if (!atletaSnap.exists()) {
            document.getElementById("recovery-message").textContent = "DNI no encontrado.";
            return;
        }

        const atletaData = atletaSnap.data();
        
        if (atletaData.fechaNacimiento === fechaNacimiento) {
            document.getElementById("new-password-section").style.display = "block";
            document.getElementById("recovery-message").textContent = "Datos correctos. Ingresa tu nueva contraseña.";
        } else {
            document.getElementById("recovery-message").textContent = "Fecha de nacimiento incorrecta.";
        }
    } catch (error) {
        console.error("Error en la recuperación de contraseña:", error);
        document.getElementById("recovery-message").textContent = "Error al verificar el DNI.";
    }
});

document.getElementById("update-password").addEventListener("click", async function(event) {
    event.preventDefault(); // Evitar que el botón recargue la página

    const dni = document.getElementById("dni-recovery").value.trim();
    const newPassword = document.getElementById("new-password").value.trim();
    const recoveryMessage = document.getElementById("recovery-message");

    // Validar que la nueva contraseña tenga al menos 6 caracteres
    if (newPassword.length < 6) {
        recoveryMessage.textContent = "La contraseña debe tener al menos 6 caracteres.";
        recoveryMessage.style.color = "red";
        return;
    }

    try {
        // Obtener referencia del documento en Firestore
        const atletaRef = doc(db, "atletas", dni);
        const atletaSnap = await getDoc(atletaRef);

        if (!atletaSnap.exists()) {
            recoveryMessage.textContent = "DNI no encontrado.";
            recoveryMessage.style.color = "red";
            return;
        }

        // Actualizar la contraseña en Firestore
        await updateDoc(atletaRef, { password: newPassword });

        recoveryMessage.textContent = "Contraseña actualizada con éxito. Redirigiendo...";
        recoveryMessage.style.color = "green";

        // Redirigir después de 2 segundos
        setTimeout(() => {
            window.location.href = "index.html";
        }, 2000);

    } catch (error) {
        console.error("Error al actualizar la contraseña:", error);
        recoveryMessage.textContent = "Error al actualizar la contraseña.";
        recoveryMessage.style.color = "red";
    }
});

