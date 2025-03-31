// Importar los servicios desde config.js
import { auth, db, storage } from './config.js';
import { doc, getDoc, setDoc, collection, getDocs } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-storage.js";

// Función para cargar los grupos de running desde Firebase
async function cargarGrupos() {
    const selectGrupo = document.getElementById("tipo-grupo");
    selectGrupo.innerHTML = '<option value="">Seleccione un grupo...</option>'; // Reset opciones

    try {
        const querySnapshot = await getDocs(collection(db, "grupos"));
        querySnapshot.forEach((doc) => {
            const grupo = doc.data().nombre;
            const option = document.createElement("option");
            option.value = grupo;
            option.textContent = grupo;
            selectGrupo.appendChild(option);
        });
    } catch (error) {
        console.error("Error al cargar los grupos:", error);
    }
}

// Llamar a la función al cargar la página
document.addEventListener("DOMContentLoaded", cargarGrupos);

// Función para mostrar mensajes de estado
function mostrarMensaje(mensaje, color = "black") {
    const mensajeElemento = document.getElementById("mensaje");
    mensajeElemento.textContent = mensaje;
    mensajeElemento.style.color = color;
}

// Obtener cantidadFechas desde Firestore
async function obtenerCantidadFechas() {
    try {
        const torneoRef = doc(db, "torneo", "datos");
        const torneoSnap = await getDoc(torneoRef);

        if (torneoSnap.exists()) {
            return torneoSnap.data().cantidadFechas || 0;
        } else {
            console.warn("No se encontró el documento de torneo.");
            return 0;
        }
    } catch (error) {
        console.error("Error al obtener cantidadFechas:", error);
        return 0;
    }
}

// Función para registrar atleta
async function registrarAtleta(event) {
    event.preventDefault();

    let dni = document.getElementById("dni").value.trim();
    let nombre = document.getElementById("nombre").value.trim();
    let apellido = document.getElementById("apellido").value.trim();
    let fechaNacimiento = document.getElementById("fecha-nacimiento").value;
    let localidad = document.getElementById("localidad").value.trim();
    let selectGrupo = document.getElementById("tipo-grupo");
    let tipoGrupo = selectGrupo.value.trim() || "Individual";
    let categoria = document.querySelector('input[name="categoria"]:checked')?.value;
    let password = document.getElementById("password").value;
    let confirmPassword = document.getElementById("confirm-password").value;
    let aptoMedico = document.getElementById("apto-medico").files[0];
    let certificadoDiscapacidad = document.getElementById("certificado-discapacidad").files[0];

    // Validaciones
    if (!dni || !nombre || !apellido || !fechaNacimiento || !localidad || !categoria || !password || !confirmPassword) {
        mostrarMensaje("Todos los campos son obligatorios.", "red");
        return;
    }

    if (!esDniValido(dni)) {
        mostrarMensaje("DNI inválido. Debe tener entre 7 y 8 dígitos y ser real.", "red");
        return;
    }

    if (password.length < 6) {
        mostrarMensaje("La contraseña debe tener al menos 6 caracteres.", "red");
        return;
    }

    if (password !== confirmPassword) {
        mostrarMensaje("Las contraseñas no coinciden.", "red");
        return;
    }

    try {
        const atletaRef = doc(db, "atletas", dni);
        const atletaSnap = await getDoc(atletaRef);

        if (atletaSnap.exists()) {
            mostrarMensaje("Este DNI ya está registrado.", "red");
            return;
        }

        // Obtener cantidad de fechas antes de registrar
        let cantidadFechas = await obtenerCantidadFechas();

        // Crear historial con "-" en posicion y puntos
        let historial = Array.from({ length: cantidadFechas }, () => ({
            posicion: "-",
            puntos: "-"
        }));

        let certificadoURL = null;
        if (categoria === "especial" && certificadoDiscapacidad) {
            mostrarMensaje("Subiendo certificado de discapacidad...", "blue");
            const certificadoRef = ref(storage, `certificados/${dni}_certificado.${certificadoDiscapacidad.name.split('.').pop()}`);
            await uploadBytes(certificadoRef, certificadoDiscapacidad);
            certificadoURL = await getDownloadURL(certificadoRef);
        }

        let aptoMedicoURL = null;
        if (aptoMedico) {
            mostrarMensaje("Subiendo apto médico...", "blue");
            const aptoRef = ref(storage, `aptos_medicos/${dni}_apto.${aptoMedico.name.split('.').pop()}`);
            await uploadBytes(aptoRef, aptoMedico);
            aptoMedicoURL = await getDownloadURL(aptoRef);
        }

        // Guardar el atleta en Firestore
        await setDoc(atletaRef, {
            nombre,
            apellido,
            dni: parseInt(dni),
            fechaNacimiento,
            localidad,
            grupoRunning: tipoGrupo,
            categoria,
            password, // ⚠️ Debe encriptarse en producción
            aptoMedico: aptoMedicoURL,
            certificadoDiscapacidad: certificadoURL,
            historial // ← Se agrega el historial dinámico
        });

        // Limpiar sessionStorage y localStorage
        sessionStorage.clear();
        localStorage.clear();

        // Mensaje de éxito y redirección al index
        mostrarMensaje("Registro exitoso. Redirigiendo...", "green");

        setTimeout(() => {
            window.location.href = "index.html";
        }, 2000);
    } catch (error) {
        console.error("Error al registrar el atleta:", error);
        mostrarMensaje("Hubo un error al registrar. Intenta nuevamente.", "red");
    }
}

// Validación en vivo de la contraseña
document.getElementById("password").addEventListener("input", validarPassword);
document.getElementById("confirm-password").addEventListener("input", validarPassword);

function esDniValido(dni) {
    const dniRegex = /^[1-9]\d{6,7}$/;
    const dniInvalidos = ["00000000", "11111111", "12345678", "99999999"];
    return dniRegex.test(dni) && !dniInvalidos.includes(dni);
}

function validarPassword() {
    let password = document.getElementById("password").value;
    let confirmPassword = document.getElementById("confirm-password").value;
    let passwordMatch = document.getElementById("password-match");

    if (password.length < 6) {
        passwordMatch.textContent = "La contraseña debe tener al menos 6 caracteres.";
        passwordMatch.style.color = "red";
        return;
    }

    if (password === confirmPassword && password.length > 5) {
        passwordMatch.textContent = "Las contraseñas coinciden.";
        passwordMatch.style.color = "green";
    } else {
        passwordMatch.textContent = "Las contraseñas no coinciden.";
        passwordMatch.style.color = "red";
    }
}

// Asignar la función al botón de registro
document.getElementById("registro-form").addEventListener("submit", registrarAtleta);
