// Importar Firebase desde config.js
import { auth, db } from './config.js';
import { doc, getDoc, updateDoc, collection, getDocs } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// Función para cargar los grupos de running desde Firebase
async function cargarGrupos() {
    const selectGrupo = document.getElementById("nuevo-grupo");
    selectGrupo.innerHTML = '<option value="Individual">Individual</option>'; // Opción por defecto

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

// Función para obtener el usuario logueado
async function obtenerUsuario() {
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

        return { dni, ...atletaSnap.data() }; // Retornar los datos del usuario
    } catch (error) {
        console.error("Error al obtener datos del usuario:", error);
        mostrarMensaje("Error al obtener datos del usuario.", "red");
        return null;
    }
}

// Función para mostrar mensajes de estado
function mostrarMensaje(mensaje, color = "black") {
    const mensajeElemento = document.getElementById("mensaje");
    mensajeElemento.textContent = mensaje;
    mensajeElemento.style.color = color;
}

// Cargar grupos al cargar la página
document.getElementById("btn-cambiar-grupo").addEventListener("click", async () => {
    const usuario = JSON.parse(localStorage.getItem("usuario"));

    if (!usuario || !usuario.dni) {
        console.error("No se encontró el DNI del usuario.", usuario);
        document.getElementById("mensaje").textContent = "Error: No se encontró tu DNI.";
        return;
    }

    const dni = String(usuario.dni).trim(); // Convertimos a string y eliminamos espacios en blanco
    console.log("DNI obtenido:", dni); // Para depuración

    if (!dni || dni === "undefined" || dni === "null") {
        console.error("DNI no válido:", dni);
        document.getElementById("mensaje").textContent = "Error: DNI inválido.";
        return;
    }

    const nuevoGrupo = document.getElementById("nuevo-grupo").value;

    if (!nuevoGrupo) {
        document.getElementById("mensaje").textContent = "Selecciona un grupo.";
        return;
    }

    try {
        const atletaRef = doc(db, "atletas", dni);
        await updateDoc(atletaRef, { grupo: nuevoGrupo });

        document.getElementById("mensaje").textContent = "Grupo actualizado correctamente.";
        document.getElementById("grupo-running").textContent = nuevoGrupo; // Actualiza en la página
    } catch (error) {
        console.error("Error al actualizar el grupo:", error);
        document.getElementById("mensaje").textContent = "Error al actualizar el grupo.";
    }
});


