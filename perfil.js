// Importar Firebase desde config.js
import { db, storage } from './config.js';
import { doc, getDoc, updateDoc, collection, getDocs } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-storage.js";

// Cargar datos del usuario desde sessionStorage o localStorage
document.addEventListener("DOMContentLoaded", async () => {
    let usuario = JSON.parse(sessionStorage.getItem("usuario")) || JSON.parse(localStorage.getItem("usuario"));

    if (!usuario || !usuario.dni) {
        window.location.href = "index.html"; // Redirigir si no hay datos
        return;
    }

    // Guardar en sessionStorage si solo estaba en localStorage
    sessionStorage.setItem("usuario", JSON.stringify(usuario));
    sessionStorage.setItem("usuarioDNI", usuario.dni);

    // Mostrar datos en el perfil
    document.getElementById("nombre").textContent = usuario.nombre;
    document.getElementById("apellido").textContent = usuario.apellido;
    document.getElementById("dni").textContent = usuario.dni;

    // Cargar grupo y demás datos desde Firebase
    await cargarPerfilUsuario();
});

// Cargar datos del atleta desde Firebase
async function cargarPerfilUsuario() {
    const dni = sessionStorage.getItem("usuarioDNI");

    if (!dni) {
        mostrarMensaje("No hay usuario logueado.", "red");
        return;
    }

    try {
        const atletaRef = doc(db, "atletas", dni);
        const atletaSnap = await getDoc(atletaRef);

        if (!atletaSnap.exists()) {
            mostrarMensaje("Usuario no encontrado.", "red");
            return;
        }

        const usuario = atletaSnap.data();

        document.getElementById("grupo-running").textContent = usuario.grupoRunning || "Individual";
        document.getElementById("localidad").value = usuario.localidad || "";
        document.getElementById("categoria").value = usuario.categoria || "";
        document.getElementById("fecha-nacimiento").value = usuario.fechaNacimiento || "";

        await cargarGrupos(usuario.grupoRunning);
    } catch (error) {
        console.error("Error al obtener datos del usuario:", error);
        mostrarMensaje("Error al obtener datos.", "red");
    }
}

// Cargar los grupos de running desde Firebase
async function cargarGrupos(grupoActual) {
    const selectGrupo = document.getElementById("nuevo-grupo");
    selectGrupo.innerHTML = "";

    try {
        const querySnapshot = await getDocs(collection(db, "grupos"));

        const optionDefault = document.createElement("option");
        optionDefault.value = "Individual";
        optionDefault.textContent = "Individual";
        selectGrupo.appendChild(optionDefault);

        querySnapshot.forEach((doc) => {
            const grupo = doc.data().nombre;
            const option = document.createElement("option");
            option.value = grupo;
            option.textContent = grupo;
            selectGrupo.appendChild(option);
        });

        if (grupoActual) {
            selectGrupo.value = grupoActual;
        }
    } catch (error) {
        console.error("Error al cargar los grupos:", error);
    }
}

// Guardar cambios en Firebase
document.getElementById("perfil-form").addEventListener("submit", async (event) => {
    event.preventDefault();

    const dni = document.getElementById("dni").textContent.trim();
    const localidad = document.getElementById("localidad").value.trim();
    const categoria = document.getElementById("categoria").value.trim();
    const fechaNacimiento = document.getElementById("fecha-nacimiento").value;
    const grupoRunning = document.getElementById("nuevo-grupo").value;
    const aptoMedicoFile = document.getElementById("apto-medico").files[0];

    if (!dni || !localidad || !categoria || !fechaNacimiento) {
        mostrarMensaje("Todos los campos son obligatorios.", "red");
        return;
    }

    try {
        const atletaRef = doc(db, "atletas", dni);
        let updateData = { localidad, categoria, fechaNacimiento, grupoRunning };

        // Subir apto médico si hay archivo seleccionado
        if (aptoMedicoFile) {
            const storageRef = ref(storage, `aptos_medicos/${dni}`);
            await uploadBytes(storageRef, aptoMedicoFile);
            const aptoMedicoURL = await getDownloadURL(storageRef);
            updateData.aptoMedico = aptoMedicoURL;
        }

        // Guardar cambios en Firebase
        await updateDoc(atletaRef, updateData);
        mostrarMensaje("Perfil actualizado correctamente.", "green");
        document.getElementById("grupo-running").textContent = grupoRunning;
    } catch (error) {
        console.error("Error al actualizar el perfil:", error);
        mostrarMensaje("Error al guardar los cambios.", "red");
    }
});

// Función para mostrar mensajes
function mostrarMensaje(mensaje, color = "black") {
    const mensajeElemento = document.getElementById("mensaje");
    mensajeElemento.textContent = mensaje;
    mensajeElemento.style.color = color;
}

// Evento para cambiar grupo de running
document.getElementById("btn-cambiar-grupo").addEventListener("click", async () => {
    const usuario = JSON.parse(sessionStorage.getItem("usuario"));

    if (!usuario || !usuario.dni) {
        mostrarMensaje("Error: No se encontró tu DNI.", "red");
        return;
    }

    const dni = usuario.dni.trim();
    const selectGrupo = document.getElementById("nuevo-grupo");
    const nuevoGrupo = selectGrupo.value;

    if (!nuevoGrupo) {
        mostrarMensaje("Selecciona un grupo.", "red");
        return;
    }

    try {
        const atletaRef = doc(db, "atletas", dni);
        await updateDoc(atletaRef, { grupoRunning: nuevoGrupo });

        mostrarMensaje("Grupo actualizado correctamente.", "green");
        document.getElementById("grupo-running").textContent = nuevoGrupo;
    } catch (error) {
        console.error("Error al actualizar el grupo:", error);
        mostrarMensaje("Error al actualizar el grupo.", "red");
    }
});
