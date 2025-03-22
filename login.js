// Importar Firebase
import { auth, db } from './config.js';
import { doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

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

// =========================
// 🔥 RECUPERACIÓN DE CONTRASEÑA 🔥
// =========================

// Mostrar formulario de recuperación
document.getElementById("forgot-password-link").addEventListener("click", function(event) {
    event.preventDefault();
    document.getElementById("password-recovery").style.display = "block";
});

// Verificar DNI y fecha de nacimiento en Firebase
document.getElementById("check-dni").addEventListener("click", async function() {
    const dni = document.getElementById("dni-recovery").value;
    const fechaNacimiento = document.getElementById("fecha-nacimiento-recovery").value;

    if (!dni || !fechaNacimiento) {
        document.getElementById("recovery-message").textContent = "Completa todos los campos.";
        return;
    }

    const atletaRef = doc(db, "atletas", dni);
    const atletaSnap = await getDoc(atletaRef);

    if (atletaSnap.exists()) {
        const atletaData = atletaSnap.data();
        
        if (atletaData.fechaNacimiento === fechaNacimiento) {
            document.getElementById("new-password-section").style.display = "block";
            document.getElementById("recovery-message").textContent = "Datos correctos. Ingresa tu nueva contraseña.";
        } else {
            document.getElementById("recovery-message").textContent = "Fecha de nacimiento incorrecta.";
        }
    } else {
        document.getElementById("recovery-message").textContent = "DNI no encontrado.";
    }
});

// Actualizar la contraseña en Firebase
document.getElementById("update-password").addEventListener("click", async function() {
    const dni = document.getElementById("dni-recovery").value;
    const newPassword = document.getElementById("new-password").value;

    if (!newPassword.match(/^\d{6}$/)) {
        document.getElementById("recovery-message").textContent = "La contraseña debe tener 6 dígitos.";
        return;
    }

    const atletaRef = doc(db, "atletas", dni);
    
    await updateDoc(atletaRef, { password: newPassword });

    document.getElementById("recovery-message").textContent = "Contraseña actualizada con éxito. Redirigiendo...";
    setTimeout(() => {
        window.location.href = "index.html";
    }, 2000);
});
