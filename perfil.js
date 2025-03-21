import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, doc, getDoc, updateDoc, collection, getDocs } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// Configuración de Firebase
const firebaseConfig = {
  apiKey: "AIzaSyAFHZcfSELn2Cfgh3I1og2mw3rIL8gqlAM",
  authDomain: "maratonessudeste.firebaseapp.com",
  projectId: "maratonessudeste",
  storageBucket: "maratonessudeste.appspot.com",
  messagingSenderId: "76996108214",
  appId: "1:76996108214:web:036e55fbfd01e15b462b17",
  measurementId: "G-B1GL7QJGSH"
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Obtener el DNI del usuario logueado (debe estar guardado en sessionStorage)
const dniUsuario = sessionStorage.getItem("dni");

document.addEventListener("DOMContentLoaded", () => {
    if (!dniUsuario) {
        alert("No estás logueado. Redirigiendo a inicio...");
        window.location.href = "index.html";
        return;
    }
    cargarDatosUsuario();
    cargarGrupos();
});

// ✅ Cargar los datos del usuario logueado
async function cargarDatosUsuario() {
    try {
        const atletaRef = doc(db, "atletas", dniUsuario);
        const atletaSnap = await getDoc(atletaRef);
        if (atletaSnap.exists()) {
            const atleta = atletaSnap.data();
            document.getElementById("dni").textContent = dniUsuario;
            document.getElementById("nombre").textContent = atleta.nombre;
            document.getElementById("apellido").textContent = atleta.apellido;
            document.getElementById("localidad").textContent = atleta.localidad;
            document.getElementById("grupo-actual").textContent = atleta.grupoRunning || "Individual";
        }
    } catch (error) {
        console.error("Error al obtener datos del usuario:", error);
    }
}

// ✅ Cargar la lista de grupos desde Firebase
async function cargarGrupos() {
    const selectGrupo = document.getElementById("nuevo-grupo");
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

// ✅ Función para actualizar el grupo del usuario en la base de datos
async function actualizarGrupo(event) {
    event.preventDefault();
    const nuevoGrupo = document.getElementById("nuevo-grupo").value;
    try {
        const atletaRef = doc(db, "atletas", dniUsuario);
        await updateDoc(atletaRef, { grupoRunning: nuevoGrupo });

        document.getElementById("grupo-actual").textContent = nuevoGrupo;
        mostrarMensajeCambioGrupo("Grupo actualizado correctamente.", "green");
    } catch (error) {
        console.error("Error al actualizar el grupo:", error);
        mostrarMensajeCambioGrupo("Error al actualizar el grupo.", "red");
    }
}

// ✅ Mostrar mensaje de éxito o error
function mostrarMensajeCambioGrupo(mensaje, color) {
    const mensajeElemento = document.getElementById("mensaje-cambio-grupo");
    mensajeElemento.textContent = mensaje;
    mensajeElemento.style.color = color;
}

// ✅ Evento para actualizar el grupo al enviar el formulario
document.getElementById("form-cambiar-grupo").addEventListener("submit", actualizarGrupo);
