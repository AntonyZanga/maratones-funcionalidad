// Importar Firebase desde config.js
import { db } from './config.js';
import { doc, getDoc, updateDoc, collection, getDocs } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// Cargar datos del usuario desde localStorage o sessionStorage
document.addEventListener("DOMContentLoaded", async () => {
    let usuario = JSON.parse(sessionStorage.getItem("usuario"));

    // Si sessionStorage está vacío pero localStorage tiene el usuario, lo restauramos
    if (!usuario) {
        usuario = JSON.parse(localStorage.getItem("usuario"));
        if (usuario) {
            sessionStorage.setItem("usuario", JSON.stringify(usuario));
        } else {
            window.location.href = "index.html"; // Si tampoco está en localStorage, redirigir
            return;
        }
    }

    // Mostrar los datos en la página de perfil
    document.getElementById("nombre").textContent = usuario.nombre;
    document.getElementById("apellido").textContent = usuario.apellido;
    document.getElementById("dni").textContent = usuario.dni;

    // Cargar el grupo desde Firebase
    await cargarGrupoDesdeFirebase(usuario.dni);
});

// Función para cargar el grupo del atleta desde Firebase
async function cargarGrupoDesdeFirebase(dni) {
    try {
        const atletaRef = doc(db, "atletas", dni);
        const atletaSnap = await getDoc(atletaRef);

        if (atletaSnap.exists()) {
            document.getElementById("grupo-running").textContent = atletaSnap.data().grupo || "Individual";
        } else {
            console.error("No se encontró el atleta en la base de datos.");
        }
    } catch (error) {
        console.error("Error al cargar el grupo:", error);
    }
}

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
