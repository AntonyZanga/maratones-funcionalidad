// Importar Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-storage.js";

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
const storage = getStorage(app);

// Referencia al botón de registro
const btnRegistrar = document.querySelector("#btn-registrar");

// Validación en tiempo real de la contraseña
document.getElementById("password").addEventListener("input", function() {
  this.style.borderColor = this.value.length === 6 ? "green" : "red";
});

// Función para mostrar mensajes de estado
function mostrarMensaje(mensaje, tipo = "info") {
  const mensajeDiv = document.getElementById("mensaje");
  mensajeDiv.innerText = mensaje;
  mensajeDiv.style.color = tipo === "error" ? "red" : "black";
}

// Función para subir archivos a Firebase Storage
async function subirArchivo(dni, archivo, carpeta) {
  if (!archivo) return null;

  const extension = archivo.name.split('.').pop();
  const nombreArchivo = `${dni}_${Date.now()}.${extension}`;
  const archivoRef = ref(storage, `${carpeta}/${nombreArchivo}`);

  try {
    mostrarMensaje(`Subiendo ${carpeta}...`);
    await uploadBytes(archivoRef, archivo);
    return await getDownloadURL(archivoRef);
  } catch (error) {
    console.error(`Error subiendo ${carpeta}:`, error);
    mostrarMensaje(`Error al subir ${carpeta}`, "error");
    return null;
  }
}

// Función para registrar atleta
async function registrarAtleta() {
  // Deshabilitar el botón mientras se procesa
  btnRegistrar.disabled = true;
  mostrarMensaje("Procesando registro...");

  // Obtener valores del formulario
  let dni = document.getElementById("dni").value.trim();
  let nombre = document.getElementById("nombre").value.trim();
  let apellido = document.getElementById("apellido").value.trim();
  let fechaNacimiento = document.getElementById("fecha-nacimiento").value;
  let localidad = document.getElementById("localidad").value.trim();
  let tipoGrupo = document.getElementById("tipo-grupo").value;
  let nombreGrupo = tipoGrupo === "grupo" ? document.getElementById("nombre-grupo").value.trim() : null;
  let categoria = document.querySelector('input[name="categoria"]:checked')?.value;
  let password = document.getElementById("password").value;
  let confirmPassword = document.getElementById("confirm-password").value;
  let aptoMedico = document.getElementById("apto-medico").files[0];
  let certificadoDiscapacidad = document.getElementById("certificado-discapacidad").files[0];

  // Validaciones básicas
  if (!dni || !nombre || !apellido || !fechaNacimiento || !localidad || !categoria || !password || !confirmPassword) {
    mostrarMensaje("Todos los campos son obligatorios.", "error");
    btnRegistrar.disabled = false;
    return;
  }

  if (password.length !== 6) {
    mostrarMensaje("La contraseña debe tener exactamente 6 caracteres.", "red");
    return;
  }

  if (password !== confirmPassword) {
    mostrarMensaje("Las contraseñas no coinciden.", "red");
    return;
  }

  try {
    const atletaRef = doc(db, "atletas", dni);
    const atletaSnap = await getDoc(atletaRef);

    if (atletaSnap.exists()) {
      mostrarMensaje("Este DNI ya está registrado.", "error");
      btnRegistrar.disabled = false;
      return;
    }

    // Subir archivos y obtener URLs
    let certificadoURL = await subirArchivo(dni, certificadoDiscapacidad, "certificados_discapacidad");
    let aptoMedicoURL = await subirArchivo(dni, aptoMedico, "aptos_medicos");

    // Guardar atleta en Firestore
    await setDoc(atletaRef, {
      nombre,
      apellido,
      dni: parseInt(dni),
      fechaNacimiento,
      localidad,
      grupoRunning: tipoGrupo,
      grupoRunningNombre: nombreGrupo || "",
      categoria,
      password, // ⚠️ En producción debe encriptarse
      aptoMedico: aptoMedicoURL,
      certificadoDiscapacidad: certificadoURL
    });

    mostrarMensaje("Registro exitoso.");
    document.getElementById("registro-form").reset();
  } catch (error) {
    console.error("Error al registrar:", error);
    mostrarMensaje("Hubo un error al registrar. Inténtalo nuevamente.", "error");
  }

  // Habilitar nuevamente el botón
  btnRegistrar.disabled = false;
}

// Validación en vivo de la contraseña
document.getElementById("password").addEventListener("input", validarPassword);
document.getElementById("confirm-password").addEventListener("input", validarPassword);

function validarPassword() {
  let password = document.getElementById("password").value;
  let confirmPassword = document.getElementById("confirm-password").value;
  let passwordMatch = document.getElementById("password-match");

  if (password.length < 6) {
    passwordMatch.textContent = "La contraseña debe tener 6 caracteres.";
    passwordMatch.style.color = "red";
    return;
  }

  if (password === confirmPassword && password.length === 6) {
    passwordMatch.textContent = "Las contraseñas coinciden.";
    passwordMatch.style.color = "green";
  } else {
    passwordMatch.textContent = "Las contraseñas no coinciden.";
    passwordMatch.style.color = "red";
  }
}

// Asignar la función al botón de registro
document.getElementById("registro-form").addEventListener("submit", function (e) {
  e.preventDefault();
  registrarAtleta();
});
