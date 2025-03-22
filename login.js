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
        sessionStorage.setItem("usuarioDNI", dni);
        sessionStorage.setItem("usuarioNombre", atleta.nombre);
        sessionStorage.setItem("usuarioApellido", atleta.apellido);

        // Redirigir al perfil
        window.location.href = "perfil.html";
    } catch (error) {
        console.error("Error en el login:", error);
        mostrarMensaje("Error al iniciar sesión.");
    }
});
// =========================
// 🔥 VERIFICAR SESIÓN AL CARGAR LA PÁGINA 🔥
// =========================
document.addEventListener("DOMContentLoaded", () => {
    let usuario = JSON.parse(sessionStorage.getItem("usuario"));

    // 🔹 Si sessionStorage está vacío pero hay usuario en localStorage, restauramos los datos
    if (!usuario) {
        usuario = JSON.parse(localStorage.getItem("usuario"));
        if (usuario) {
            sessionStorage.setItem("usuario", JSON.stringify(usuario));
            sessionStorage.setItem("usuarioDNI", usuario.dni);
            sessionStorage.setItem("usuarioNombre", usuario.nombre);
            sessionStorage.setItem("usuarioApellido", usuario.apellido);
        }
    }

    // 🔹 Si después de esto no hay usuario, significa que nadie ha iniciado sesión
    if (!usuario) {
        console.warn("No hay usuario logueado.");
        return;
    }

    // 🔹 Mostrar información en la página
    document.getElementById("login-section").style.display = "none";
    document.getElementById("user-info").style.display = "block";
    document.getElementById("user-name").textContent = `${usuario.nombre} ${usuario.apellido}`;
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

// Actualizar la contraseña en Firebase
document.getElementById("update-password").addEventListener("click", async function() {
    const dni = document.getElementById("dni-recovery").value;
    const newPassword = document.getElementById("new-password").value;

    if (!newPassword.match(/^.{6,}$/)) {
    document.getElementById("recovery-message").textContent = "La contraseña debe tener al menos 6 caracteres.";
    return;
    }

    try {
        const atletaRef = doc(db, "atletas", dni);
        await updateDoc(atletaRef, { password: newPassword });

        document.getElementById("recovery-message").textContent = "Contraseña actualizada con éxito. Redirigiendo...";
        setTimeout(() => {
            window.location.href = "index.html";
        }, 2000);
    } catch (error) {
        console.error("Error al actualizar contraseña:", error);
        document.getElementById("recovery-message").textContent = "Error al actualizar la contraseña.";
    }
});
