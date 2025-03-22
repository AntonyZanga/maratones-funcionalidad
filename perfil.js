import { db } from './config.js';
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// ================================
// 🔥 CARGA DE DATOS DEL USUARIO 🔥
// ================================
document.addEventListener("DOMContentLoaded", async () => {
    const dni = sessionStorage.getItem("usuarioDNI");
    const nombre = sessionStorage.getItem("usuarioNombre");
    const apellido = sessionStorage.getItem("usuarioApellido");

    if (!dni || !nombre || !apellido) {
        window.location.href = "index.html"; // Redirigir si no hay usuario logueado
        return;
    }

    // Mostrar los datos en la página
    document.getElementById("user-name").textContent = `${nombre} ${apellido}`;
    document.getElementById("nombre").textContent = nombre;
    document.getElementById("apellido").textContent = apellido;
    document.getElementById("dni").textContent = dni;

    // Cargar el grupo desde Firebase
    await cargarGrupoDesdeFirebase(dni);
});

// ================================
// 🔥 FUNCIÓN PARA CARGAR EL GRUPO 🔥
// ================================
async function cargarGrupoDesdeFirebase(dni) {
    try {
        const atletaRef = doc(db, "atletas", dni);
        const atletaSnap = await getDoc(atletaRef);

        if (atletaSnap.exists()) {
            document.getElementById("grupo-running").textContent = atletaSnap.data().grupo || "Individual";
        } else {
            console.error("No se encontró el atleta en la base de datos.");
            document.getElementById("grupo-running").textContent = "No registrado";
        }
    } catch (error) {
        console.error("Error al cargar el grupo:", error);
        document.getElementById("grupo-running").textContent = "Error al cargar";
    }
}

// ================================
// 🔥 CERRAR SESIÓN 🔥
// ================================
document.getElementById("logout").addEventListener("click", () => {
    sessionStorage.clear();
    window.location.href = "index.html";
});
