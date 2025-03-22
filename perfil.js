// Cargar datos del usuario desde localStorage
document.addEventListener("DOMContentLoaded", () => {
    const usuario = JSON.parse(sessionStorage.getItem("usuario"));

    if (!usuario) {
        window.location.href = "index.html"; // Redirigir si no hay usuario logueado
        return;
    }

    // Mostrar los datos en la página
    document.getElementById("nombre").textContent = usuario.nombre;
    document.getElementById("apellido").textContent = usuario.apellido;
    document.getElementById("dni").textContent = usuario.dni;

    // Cargar el grupo desde Firebase
    cargarGrupoDesdeFirebase(usuario.dni);
});

// Función para cargar el grupo del atleta
import { db } from './config.js';
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

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
