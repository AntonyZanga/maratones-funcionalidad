// Importar Firebase desde config.js
import { db, storage } from './config.js';
import { doc, getDoc, updateDoc, collection, getDocs } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-storage.js";

document.addEventListener("DOMContentLoaded", async () => {
    console.log("Cargando perfil...");
    
    let usuario = JSON.parse(sessionStorage.getItem("usuario")) || JSON.parse(localStorage.getItem("usuario"));

    if (!usuario || !usuario.dni) {
        console.error("No hay usuario en sessionStorage o localStorage.");
        window.location.href = "index.html"; 
        return;
    }

    // Guardar en sessionStorage si solo estaba en localStorage
    sessionStorage.setItem("usuario", JSON.stringify(usuario));
    sessionStorage.setItem("usuarioDNI", usuario.dni);

    // Obtener referencias a los elementos del DOM
    const nombreElem = document.getElementById("nombre");
    const apellidoElem = document.getElementById("apellido");
    const dniElem = document.getElementById("dni");

    // Verificar si los elementos existen antes de asignar valores
    if (nombreElem) nombreElem.textContent = usuario.nombre;
    if (apellidoElem) apellidoElem.textContent = usuario.apellido;
    if (dniElem) dniElem.textContent = usuario.dni;

    await cargarPerfilUsuario();
});

// Cargar datos del atleta desde Firebase
async function cargarPerfilUsuario() {
    const dni = sessionStorage.getItem("usuarioDNI");

    if (!dni) {
        console.error("No hay usuario logueado en sessionStorage.");
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

        // Obtener elementos
        const grupoRunningElem = document.getElementById("grupo-running");
        const localidadElem = document.getElementById("localidad");
        const categoriaElem = document.getElementById("categoria");
        const fechaNacimientoElem = document.getElementById("fecha-nacimiento");

        // Verificar si los elementos existen antes de asignar valores
        if (grupoRunningElem) grupoRunningElem.textContent = usuario.grupoRunning || "Individual";
        if (localidadElem) localidadElem.value = usuario.localidad || "";
        if (categoriaElem) categoriaElem.value = usuario.categoria || "";
        if (fechaNacimientoElem) fechaNacimientoElem.value = usuario.fechaNacimiento || "";

        await cargarGrupos(usuario.grupoRunning);
    } catch (error) {
        console.error("Error al obtener datos del usuario:", error);
        mostrarMensaje("Error al obtener datos.", "red");
    }
}

// Cargar los grupos de running desde Firebase
async function cargarGrupos(grupoActual) {
    const selectGrupo = document.getElementById("nuevo-grupo");

    if (!selectGrupo) {
        console.error("El selector de grupos no se encontró en el DOM.");
        return;
    }

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
document.addEventListener("DOMContentLoaded", () => {
    const perfilForm = document.getElementById("perfil-form");

    if (perfilForm) {
        perfilForm.addEventListener("submit", async (event) => {
            event.preventDefault();

            const dniElem = document.getElementById("dni");
            const localidadElem = document.getElementById("localidad");
            const categoriaElem = document.getElementById("categoria");
            const fechaNacimientoElem = document.getElementById("fecha-nacimiento");
            const selectGrupo = document.getElementById("nuevo-grupo");
            const aptoMedicoFile = document.getElementById("apto-medico").files[0];

            if (!dniElem || !localidadElem || !categoriaElem || !fechaNacimientoElem || !selectGrupo) {
                console.error("Algunos elementos del formulario no se encontraron.");
                mostrarMensaje("Error: elementos del formulario faltantes.", "red");
                return;
            }

            const dni = dniElem.textContent.trim();
            const localidad = localidadElem.value.trim();
            const categoria = categoriaElem.value.trim();
            const fechaNacimiento = fechaNacimientoElem.value;
            const grupoRunning = selectGrupo.value;

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

                await updateDoc(atletaRef, updateData);
                mostrarMensaje("Perfil actualizado correctamente.", "green");

                const grupoRunningElem = document.getElementById("grupo-running");
                if (grupoRunningElem) grupoRunningElem.textContent = grupoRunning;
            } catch (error) {
                console.error("Error al actualizar el perfil:", error);
                mostrarMensaje("Error al guardar los cambios.", "red");
            }
        });
    }
});

// Función para mostrar mensajes
function mostrarMensaje(mensaje, color = "black") {
    const mensajeElemento = document.getElementById("mensaje");
    if (mensajeElemento) {
        mensajeElemento.textContent = mensaje;
        mensajeElemento.style.color = color;
    }
}

// Evento para cambiar grupo de running
document.addEventListener("DOMContentLoaded", () => {
    const btnCambiarGrupo = document.getElementById("btn-cambiar-grupo");

    if (btnCambiarGrupo) {
        btnCambiarGrupo.addEventListener("click", async () => {
            const usuario = JSON.parse(sessionStorage.getItem("usuario"));

            if (!usuario || !usuario.dni) {
                mostrarMensaje("Error: No se encontró tu DNI.", "red");
                return;
            }

            const dni = usuario.dni.trim();
            const selectGrupo = document.getElementById("nuevo-grupo");

            if (!selectGrupo) {
                console.error("El selector de grupos no existe.");
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

                const grupoRunningElem = document.getElementById("grupo-running");
                if (grupoRunningElem) grupoRunningElem.textContent = nuevoGrupo;
            } catch (error) {
                console.error("Error al actualizar el grupo:", error);
                mostrarMensaje("Error al actualizar el grupo.", "red");
            }
        });
    }
});
