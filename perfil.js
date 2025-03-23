// Importar Firebase desde config.js
import { db, storage } from './config.js';
import { doc, getDoc, updateDoc, setDoc, deleteDoc, collection, getDocs } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
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
    const dniElem = document.getElementById("dni");
    const nombreElem = document.getElementById("nombre");
    const apellidoElem = document.getElementById("apellido");

    if (dniElem) {
        dniElem.value = usuario.dni || "";
        dniElem.removeAttribute("readonly"); // Hacer DNI editable
        dniElem.removeAttribute("disabled");
    }

    if (nombreElem) nombreElem.value = usuario.nombre || "";
    if (apellidoElem) apellidoElem.value = usuario.apellido || "";

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

        // Actualizar campos del formulario con los datos de Firebase
        document.getElementById("nombre").value = usuario.nombre || "";
        document.getElementById("apellido").value = usuario.apellido || "";
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
            const nombreElem = document.getElementById("nombre");
            const apellidoElem = document.getElementById("apellido");
            const localidadElem = document.getElementById("localidad");
            const categoriaElem = document.getElementById("categoria");
            const fechaNacimientoElem = document.getElementById("fecha-nacimiento");
            const selectGrupo = document.getElementById("nuevo-grupo");
            const aptoMedicoFile = document.getElementById("apto-medico").files[0];

            if (!dniElem || !nombreElem || !apellidoElem || !localidadElem || !categoriaElem || !fechaNacimientoElem || !selectGrupo) {
                console.error("Algunos elementos del formulario no se encontraron.");
                mostrarMensaje("Error: elementos del formulario faltantes.", "red");
                return;
            }

            const nuevoDni = dniElem.value.trim();
            const nombre = nombreElem.value.trim();
            const apellido = apellidoElem.value.trim();
            const localidad = localidadElem.value.trim();
            const categoria = categoriaElem.value.trim();
            const fechaNacimiento = fechaNacimientoElem.value;
            const grupoRunning = selectGrupo.value;
            const dniActual = sessionStorage.getItem("usuarioDNI");

            if (!nuevoDni || !nombre || !apellido || !localidad || !categoria || !fechaNacimiento) {
                mostrarMensaje("Todos los campos son obligatorios.", "red");
                return;
            }

            try {
                let updateData = { nombre, apellido, localidad, categoria, fechaNacimiento, grupoRunning };

                // Subir apto médico si hay archivo seleccionado
                if (aptoMedicoFile) {
                    const storageRef = ref(storage, `aptos_medicos/${nuevoDni}`);
                    await uploadBytes(storageRef, aptoMedicoFile);
                    const aptoMedicoURL = await getDownloadURL(storageRef);
                    updateData.aptoMedico = aptoMedicoURL;
                }

                if (nuevoDni !== dniActual) {
                    // Crear un nuevo documento con el nuevo DNI
                    await setDoc(doc(db, "atletas", nuevoDni), updateData);
                    // Eliminar el documento anterior
                    await deleteDoc(doc(db, "atletas", dniActual));
                    sessionStorage.setItem("usuarioDNI", nuevoDni);
                } else {
                    // Actualizar el documento existente
                    await updateDoc(doc(db, "atletas", nuevoDni), updateData);
                }

                mostrarMensaje("Perfil actualizado correctamente.", "green");
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
