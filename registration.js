// registration.js
// ----------------

// Importar bcryptjs y los servicios de Firebase
import * as bcrypt from 'https://cdn.jsdelivr.net/npm/bcryptjs@2.4.3/dist/bcrypt.min.js';
import { auth, db, storage } from './config.js';
import { doc, getDoc, setDoc, collection, getDocs } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-storage.js";

// Función para cargar los grupos de running desde Firebase
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

// Mostrar mensajes de estado
function mostrarMensaje(mensaje, color = "black") {
    const mensajeElemento = document.getElementById("mensaje");
    mensajeElemento.textContent = mensaje;
    mensajeElemento.style.color = color;
}

// Obtener cantidad de fechas registradas en Firestore
async function obtenerCantidadFechas() {
    try {
        const torneoRef = doc(db, "torneo", "datos");
        const torneoSnap = await getDoc(torneoRef);
        return torneoSnap.exists() ? (torneoSnap.data().cantidadFechas || 0) : 0;
    } catch (error) {
        console.error("Error al obtener cantidadFechas:", error);
        return 0;
    }
}

// Validación del DNI
function esDniValido(dni) {
    const dniRegex = /^[1-9]\d{6,7}$/;
    const dniInvalidos = ["00000000", "11111111", "12345678", "99999999"];
    return dniRegex.test(dni) && !dniInvalidos.includes(dni);
}

// Validación en vivo de la contraseña
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

// Función para registrar atleta
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
        // Verificar que no exista ya el DNI
        const atletaRef = doc(db, "atletas", dni);
        const atletaSnap = await getDoc(atletaRef);
        if (atletaSnap.exists()) {
            mostrarMensaje("Este DNI ya está registrado.", "red");
            return;
        }

        // Historial inicial según cantidad de fechas
        const cantidadFechas = await obtenerCantidadFechas();
        const historial = Array.from({ length: cantidadFechas }, () => ({
            posicion: "-",
            puntos: "-"
        }));

        // Subir certificado de discapacidad si aplica
        let certificadoURL = null;
        if (categoria.toLowerCase() === "especial" && certificadoDiscapacidadFile) {
            mostrarMensaje("Subiendo certificado de discapacidad...", "blue");
            const ext = certificadoDiscapacidadFile.name.split('.').pop();
            const certificadoRef = ref(storage, `certificados/${dni}_certificado.${ext}`);
            await uploadBytes(certificadoRef, certificadoDiscapacidadFile);
            certificadoURL = await getDownloadURL(certificadoRef);
        }

        // Subir apto médico si se cargó
        let aptoMedicoURL = null;
        if (aptoMedicoFile) {
            mostrarMensaje("Subiendo apto médico...", "blue");
            const ext2 = aptoMedicoFile.name.split('.').pop();
            const aptoRef = ref(storage, `aptos_medicos/${dni}_apto.${ext2}`);
            await uploadBytes(aptoRef, aptoMedicoFile);
            aptoMedicoURL = await getDownloadURL(aptoRef);
        }

        // Hashear la contraseña
        const salt = bcrypt.genSaltSync(10);
        const passwordHash = bcrypt.hashSync(password, salt);

        // Guardar en Firestore usando el hash
        await setDoc(atletaRef, {
            nombre,
            apellido,
            dni: parseInt(dni, 10),
            fechaNacimiento,
            localidad,
            grupoRunning: tipoGrupo,
            categoria,
            passwordHash,               // <-- aquí el hash
            aptoMedico: aptoMedicoURL,
            certificadoDiscapacidad: certificadoURL,
            historial,
            faltas: cantidadFechas
        });

        // Limpiar y redirigir
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

// Mostrar/ocultar certificado según categoría
document.querySelectorAll('input[name="categoria"]').forEach(radio => {
    radio.addEventListener("change", () => {
        const cont = document.getElementById("certificado-container");
        cont.style.display = radio.checked && radio.value.toLowerCase() === "especial"
            ? "block" : "none";
    });
});
