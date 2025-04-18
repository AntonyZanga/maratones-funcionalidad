// login.js
// --------
// Importar servicios y bcryptjs
import bcrypt from 'https://cdn.jsdelivr.net/npm/bcryptjs@2.4.3/dist/bcrypt.min.js';
import { auth, db } from './config.js';
import { doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// Función para mostrar mensajes
function mostrarMensaje(mensaje, color = "red") {
    const elem = document.getElementById("login-message");
    elem.textContent = mensaje;
    elem.style.color = color;
}

// Login
document.getElementById("login-form").addEventListener("submit", async (event) => {
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
        // **Comparar hash** en lugar de texto plano
        const valid = bcrypt.compareSync(password, atleta.passwordHash || '');
        if (!valid) {
            mostrarMensaje("Contraseña incorrecta.");
            return;
        }

        // Guardar sesión
        const usuarioData = { dni, nombre: atleta.nombre, apellido: atleta.apellido };
        localStorage.setItem("usuario", JSON.stringify(usuarioData));
        sessionStorage.setItem("usuario", JSON.stringify(usuarioData));

        // Redirección
        if (dni === "99999999") {
            window.location.href = "admin.html";
        } else {
            window.location.href = "perfil.html";
        }

    } catch (error) {
        console.error("Error en el login:", error);
        mostrarMensaje("Error al iniciar sesión.");
    }
});

// Verificar sesión al cargar
document.addEventListener("DOMContentLoaded", () => {
    if (!sessionStorage.getItem("primeraVisita")) {
        sessionStorage.clear();
        localStorage.removeItem("usuario");
        sessionStorage.setItem("primeraVisita", "true");
    }
    const usuario = JSON.parse(sessionStorage.getItem("usuario"));
    if (usuario) {
        document.getElementById("login-section").style.display = "none";
        document.getElementById("user-info").style.display = "block";
        document.getElementById("user-name").textContent = `${usuario.nombre} ${usuario.apellido}`;
    }
});

// Logout
document.getElementById("logout")?.addEventListener("click", () => {
    localStorage.removeItem("usuario");
    sessionStorage.clear();
    window.location.href = "index.html";
});

// Recuperación de contraseña
document.getElementById("forgot-password-link").addEventListener("click", e => {
    e.preventDefault();
    document.getElementById("password-recovery").style.display = "block";
});

document.getElementById("check-dni").addEventListener("click", async event => {
    event.preventDefault();
    const dni = document.getElementById("dni-recovery").value;
    const fechaNacimiento = document.getElementById("fecha-nacimiento-recovery").value;
    const msg = document.getElementById("recovery-message");

    if (!dni || !fechaNacimiento) {
        msg.textContent = "Completa todos los campos.";
        return;
    }

    try {
        const atletaRef = doc(db, "atletas", dni);
        const atletaSnap = await getDoc(atletaRef);
        if (!atletaSnap.exists()) {
            msg.textContent = "DNI no encontrado.";
            return;
        }
        const data = atletaSnap.data();
        if (data.fechaNacimiento === fechaNacimiento) {
            document.getElementById("new-password-section").style.display = "block";
            msg.textContent = "Datos correctos. Ingresa tu nueva contraseña.";
        } else {
            msg.textContent = "Fecha de nacimiento incorrecta.";
        }
    } catch (error) {
        console.error("Error en la recuperación de contraseña:", error);
        msg.textContent = "Error al verificar el DNI.";
    }
});

// Actualizar contraseña (con hash)
document.getElementById("update-password").addEventListener("click", async event => {
    event.preventDefault();
    const dni = document.getElementById("dni-recovery").value.trim();
    const newPassword = document.getElementById("new-password").value.trim();
    const msg = document.getElementById("recovery-message");

    if (newPassword.length < 6) {
        msg.textContent = "La contraseña debe tener al menos 6 caracteres.";
        msg.style.color = "red";
        return;
    }

    try {
        const atletaRef = doc(db, "atletas", dni);
        const atletaSnap = await getDoc(atletaRef);
        if (!atletaSnap.exists()) {
            msg.textContent = "DNI no encontrado.";
            msg.style.color = "red";
            return;
        }

        // Generar nuevo hash
        const salt = bcrypt.genSaltSync(10);
        const newHash = bcrypt.hashSync(newPassword, salt);
        await updateDoc(atletaRef, { passwordHash: newHash });

        msg.textContent = "Contraseña actualizada con éxito. Redirigiendo...";
        msg.style.color = "green";
        setTimeout(() => window.location.href = "index.html", 2000);

    } catch (error) {
        console.error("Error al actualizar la contraseña:", error);
        msg.textContent = "Error al actualizar la contraseña.";
        msg.style.color = "red";
    }
});
