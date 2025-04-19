// registration.js
// ----------------

import { auth, db, storage } from './config.js';
import { doc, getDoc, setDoc, collection, getDocs } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-storage.js";

// Asignar bcrypt desde la librería cargada por CDN
const bcrypt = dcodeIO.bcrypt;

// ================================
// 🔹 Cargar grupos de running
// ================================
async function cargarGrupos() {
    const selectGrupo = document.getElementById("tipo-grupo");
    selectGrupo.innerHTML = '';

    const optionIndividual = document.createElement("option");
    optionIndividual.value = "Individual";
    optionIndividual.textContent = "Individual";
    optionIndividual.selected = true;
    selectGrupo.appendChild(optionIndividual);

    try {
        const querySnapshot = await getDocs(collection(db, "grupos"));
        querySnapshot.forEach(docSnap => {
            const grupo = docSnap.data().nombre;
            if (grupo !== "Individual") {
                const option = document.createElement("option");
                option.value = grupo;
                option.textContent = grupo;
                selectGrupo.appendChild(option);
            }
        });
    } catch (error) {
        console.error("Error al cargar los grupos:", error);
    }
}
document.addEventListener("DOMContentLoaded", cargarGrupos);

// ================================
// 🔹 Mostrar mensajes
// ================================
function mostrarMensaje(mensaje, color = "black") {
    const mensajeElemento = document.getElementById("mensaje");
    mensajeElemento.textContent = mensaje;
    mensajeElemento.style.color = color;
}

// ================================
// 🔹 Obtener fechas procesadas
// ================================
async function obtenerDatosTorneo() {
    try {
        const torneoRef = doc(db, "torneo", "datos");
        const snap = await getDoc(torneoRef);
        if (!snap.exists()) {
            return { cantidadFechas: 0, fechasProcesadas: [] };
        }
        const data = snap.data();
        return {
            cantidadFechas: data.cantidadFechas || 0,
            fechasProcesadas: Array.isArray(data.fechasProcesadas) ? data.fechasProcesadas : []
        };
    } catch (error) {
        console.error("Error al obtener datos del torneo:", error);
        return { cantidadFechas: 0, fechasProcesadas: [] };
    }
}

// ================================
// 🔹 Validar DNI
// ================================
function esDniValido(dni) {
    const dniRegex = /^[1-9]\d{6,7}$/;
    const dniInvalidos = ["00000000", "11111111", "12345678", "99999999"];
    return dniRegex.test(dni) && !dniInvalidos.includes(dni);
}

// ================================
// 🔹 Validación en vivo de password
// ================================
function validarPassword() {
    const password = document.getElementById("password").value;
    const confirmPassword = document.getElementById("confirm-password").value;
    const passwordMatch = document.getElementById("password-match");

    if (password.length < 6) {
        passwordMatch.textContent = "La contraseña debe tener al menos 6 caracteres.";
        passwordMatch.style.color = "red";
    } else if (password === confirmPassword) {
        passwordMatch.textContent = "Las contraseñas coinciden.";
        passwordMatch.style.color = "green";
    } else {
        passwordMatch.textContent = "Las contraseñas no coinciden.";
        passwordMatch.style.color = "red";
    }
}
document.getElementById("password").addEventListener("input", validarPassword);
document.getElementById("confirm-password").addEventListener("input", validarPassword);

// ================================
// 🔹 Registrar atleta
// ================================
async function registrarAtleta(event) {
    event.preventDefault();

    const dni = document.getElementById("dni").value.trim();
    const nombre = document.getElementById("nombre").value.trim();
    const apellido = document.getElementById("apellido").value.trim();
    const fechaNacimiento = document.getElementById("fecha-nacimiento").value;
    const localidad = document.getElementById("localidad").value.trim();
    const tipoGrupo = document.getElementById("tipo-grupo").value.trim() || "Individual";
    const categoria = document.querySelector('input[name="categoria"]:checked')?.value;
    const password = document.getElementById("password").value;
    const confirmPassword = document.getElementById("confirm-password").value;
    const aptoMedicoFile = document.getElementById("apto-medico").files[0];
    const certificadoDiscapacidadFile = document.getElementById("certificado-discapacidad").files[0];

    // Validaciones básicas
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

        const { cantidadFechas, fechasProcesadas } = await obtenerDatosTorneo();

        const historial = fechasProcesadas.map(fecha => ({
            posicion: "-",
            puntos: "-",
            bonus: 0,
            grupoRunning: "Individual",
            fecha: fecha,
            categoria: categoria
        }));

        if (historial.length < cantidadFechas) {
            for (let i = historial.length; i < cantidadFechas; i++) {
                historial.push({
                    posicion: "-",
                    puntos: "-",
                    bonus: 0,
                    grupoRunning: "Individual",
                    fecha: null,
                    categoria: categoria
                });
            }
        }

        let certificadoURL = null;
        if (categoria.toLowerCase() === "especial" && certificadoDiscapacidadFile) {
            const ext = certificadoDiscapacidadFile.name.split('.').pop();
            const certificadoRef = ref(storage, `certificados/${dni}_certificado.${ext}`);
            await uploadBytes(certificadoRef, certificadoDiscapacidadFile);
            certificadoURL = await getDownloadURL(certificadoRef);
        }

        let aptoMedicoURL = null;
        if (aptoMedicoFile) {
            const ext2 = aptoMedicoFile.name.split('.').pop();
            const aptoRef = ref(storage, `aptos_medicos/${dni}_apto.${ext2}`);
            await uploadBytes(aptoRef, aptoMedicoFile);
            aptoMedicoURL = await getDownloadURL(aptoRef);
        }

        const salt = bcrypt.genSaltSync(10);
        const passwordHash = bcrypt.hashSync(password, salt);

        await setDoc(atletaRef, {
            nombre,
            apellido,
            dni: parseInt(dni, 10),
            fechaNacimiento,
            localidad,
            grupoRunning: tipoGrupo,
            categoria,
            passwordHash,
            aptoMedico: aptoMedicoURL,
            certificadoDiscapacidad: certificadoURL,
            historial,
            faltas: cantidadFechas
        });

        sessionStorage.clear();
        localStorage.clear();
        mostrarMensaje("Registro exitoso. Redirigiendo...", "green");
        setTimeout(() => window.location.href = "index.html", 2000);

    } catch (error) {
        console.error("Error al registrar el atleta:", error);
        mostrarMensaje("Hubo un error al registrar. Intenta nuevamente.", "red");
    }
}
document.getElementById("registro-form").addEventListener("submit", registrarAtleta);

// ================================
// 🔹 Mostrar/ocultar certificado
// ================================
document.querySelectorAll('input[name="categoria"]').forEach(radio => {
    radio.addEventListener("change", () => {
        const cont = document.getElementById("certificado-container");
        cont.style.display = radio.checked && radio.value.toLowerCase() === "especial"
            ? "block" : "none";
    });
});
