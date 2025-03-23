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

    sessionStorage.setItem("usuario", JSON.stringify(usuario));
    sessionStorage.setItem("usuarioDNI", usuario.dni);

    document.getElementById("dni").value = usuario.dni || "";
    document.getElementById("nombre").value = usuario.nombre || "";
    document.getElementById("apellido").value = usuario.apellido || "";

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

// Validar si un DNI ya está registrado en la base de datos
async function dniExiste(dni) {
    const atletaRef = doc(db, "atletas", dni);
    const atletaSnap = await getDoc(atletaRef);
    return atletaSnap.exists();
}

// Función para validar DNI
function esDniValido(dni) {
    const dniRegex = /^[1-9]\d{6,7}$/;
    const dniInvalidos = ["00000000", "11111111", "12345678", "99999999"];
    return dniRegex.test(dni) && !dniInvalidos.includes(dni);
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

            if (!esDniValido(nuevoDni)) {
                mostrarMensaje("DNI inválido. Debe tener entre 7 y 8 dígitos y ser real.", "red");
                return;
            }

            try {
                let updateData = { nombre, apellido, localidad, categoria, fechaNacimiento, grupoRunning };

                // Si el usuario cambia su DNI, validar que no esté en uso
                if (nuevoDni !== dniActual) {
                    const existe = await dniExiste(nuevoDni);
                    if (existe) {
                        mostrarMensaje("Este DNI ya está registrado. Ingrese otro.", "red");
                        return;
                    }
                }

                // Subir apto médico si hay archivo seleccionado
                if (aptoMedicoFile) {
                    const storageRef = ref(storage, `aptos_medicos/${nuevoDni}`);
                    await uploadBytes(storageRef, aptoMedicoFile);
                    const aptoMedicoURL = await getDownloadURL(storageRef);
                    updateData.aptoMedico = aptoMedicoURL;
                }

                // Actualizar los datos en Firebase
                await updateDoc(doc(db, "atletas", dniActual), updateData);

                // Si el DNI cambia, actualizar sessionStorage
                if (nuevoDni !== dniActual) {
                    let usuario = JSON.parse(sessionStorage.getItem("usuario"));
                    usuario.dni = nuevoDni;
                    sessionStorage.setItem("usuario", JSON.stringify(usuario));
                    sessionStorage.setItem("usuarioDNI", nuevoDni);
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
