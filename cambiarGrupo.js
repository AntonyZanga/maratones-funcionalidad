// Importar Firebase desde config.js
import { auth, db } from './config.js';
import { doc, getDoc, updateDoc, collection, getDocs } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// Función para cargar los grupos de running desde Firebase
async function cargarGrupos(grupoActual) {
    const selectGrupo = document.getElementById("nuevo-grupo");
    if (!selectGrupo) {
        console.error("El elemento select de grupos no se encontró en el DOM.");
        return;
    }

    selectGrupo.innerHTML = ""; // Limpiar opciones previas

    try {
        console.log("Cargando grupos desde Firebase...");
        const querySnapshot = await getDocs(collection(db, "grupos"));

        if (querySnapshot.empty) {
            console.warn("No se encontraron grupos en la base de datos.");
        }

        // Agregar la opción 'Individual' siempre presente
        const optionDefault = document.createElement("option");
        optionDefault.value = "Individual";
        optionDefault.textContent = "Individual";
        selectGrupo.appendChild(optionDefault);

        querySnapshot.forEach((doc) => {
            const grupo = doc.data().nombre;
            console.log("Grupo encontrado:", grupo);
            const option = document.createElement("option");
            option.value = grupo;
            option.textContent = grupo;
            selectGrupo.appendChild(option);
        });

        // Seleccionar automáticamente el grupo actual del usuario
        if (grupoActual) {
            selectGrupo.value = grupoActual;
        }
    } catch (error) {
        console.error("Error al cargar los grupos:", error);
    }
}

// Función para obtener el usuario logueado y cargar su grupo
async function cargarPerfilUsuario() {
    const dni = sessionStorage.getItem("usuarioDNI"); // Recuperar DNI desde sesión

    if (!dni) {
        mostrarMensaje("No hay usuario logueado.", "red");
        return null;
    }

    try {
        const atletaRef = doc(db, "atletas", dni);
        const atletaSnap = await getDoc(atletaRef);

        if (!atletaSnap.exists()) {
            mostrarMensaje("Usuario no encontrado en la base de datos.", "red");
            return null;
        }

        const usuario = { dni, ...atletaSnap.data() };
        
        // Mostrar el grupo actual en la página
        if (usuario.grupoRunning) {
            document.getElementById("grupo-running").textContent = usuario.grupoRunning;
        }

        // Cargar los grupos y seleccionar el actual
        cargarGrupos(usuario.grupoRunning);

        return usuario;
    } catch (error) {
        console.error("Error al obtener datos del usuario:", error);
        mostrarMensaje("Error al obtener datos del usuario.", "red");
        return null;
    }
}

// Función para mostrar mensajes de estado
function mostrarMensaje(mensaje, color = "black") {
    const mensajeElemento = document.getElementById("mensaje");
    if (mensajeElemento) {
        mensajeElemento.textContent = mensaje;
        mensajeElemento.style.color = color;
    } else {
        console.warn("Elemento de mensaje no encontrado en el DOM.");
    }
}

// Cargar perfil del usuario al cargar la página
document.addEventListener("DOMContentLoaded", async () => {
    console.log("DOM completamente cargado.");
    await cargarPerfilUsuario();
});

// Evento para cambiar grupo de running
document.getElementById("btn-cambiar-grupo").addEventListener("click", async () => {
    const usuario = JSON.parse(localStorage.getItem("usuario"));

    if (!usuario || !usuario.dni) {
        console.error("No se encontró el DNI del usuario.", usuario);
        mostrarMensaje("Error: No se encontró tu DNI.", "red");
        return;
    }

    const dni = String(usuario.dni).trim();
    console.log("DNI obtenido:", dni);

    if (!dni || dni === "undefined" || dni === "null") {
        console.error("DNI no válido:", dni);
        mostrarMensaje("Error: DNI inválido.", "red");
        return;
    }

    const selectGrupo = document.getElementById("nuevo-grupo");
    if (!selectGrupo) {
        console.error("El selector de grupos no existe en el DOM.");
        return;
    }

    const nuevoGrupo = selectGrupo.value;

    if (!nuevoGrupo) {
        mostrarMensaje("Selecciona un grupo.", "red");
        return;
    }

    try {
        const atletaRef = doc(db, "atletas", dni);
        await updateDoc(atletaRef, { grupoRunning: nuevoGrupo });

        mostrarMensaje("Grupo actualizado correctamente.", "green");
        document.getElementById("grupo-running").textContent = nuevoGrupo; // Actualiza en la página
    } catch (error) {
        console.error("Error al actualizar el grupo:", error);
        mostrarMensaje("Error al actualizar el grupo.", "red");
    }
});
