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

// Función para recuperar contraseña
async function recuperarPassword() {
  event.preventDefault();
  
  const dni = document.getElementById("recuperar-dni").value.trim();
  const fechaNacimiento = document.getElementById("recuperar-fecha-nacimiento").value;
  const nuevaPassword = document.getElementById("nueva-password").value;
  const confirmarPassword = document.getElementById("confirmar-nueva-password").value;

  if (!dni || !fechaNacimiento || !nuevaPassword || !confirmarPassword) {
    alert("Todos los campos son obligatorios.");
    return;
  }

  if (nuevaPassword.length !== 6) {
    alert("La nueva contraseña debe tener exactamente 6 dígitos.");
    return;
  }

  if (nuevaPassword !== confirmarPassword) {
    alert("Las contraseñas no coinciden.");
    return;
  }

  try {
    const atletaRef = doc(db, "atletas", dni);
    const atletaSnap = await getDoc(atletaRef);

    if (!atletaSnap.exists()) {
      alert("No se encontró un atleta con este DNI.");
      return;
    }

    const atletaData = atletaSnap.data();
    if (atletaData.fechaNacimiento !== fechaNacimiento) {
      alert("La fecha de nacimiento no coincide.");
      return;
    }

    // Actualizar la contraseña en Firestore
    await updateDoc(atletaRef, { password: nuevaPassword });
    alert("Contraseña actualizada exitosamente.");
  } catch (error) {
    console.error("Error al recuperar contraseña:", error);
    alert("Hubo un error. Inténtalo nuevamente.");
  }
}
// Asignar función al formulario de recuperación
document.getElementById("recuperar-form").addEventListener("submit", recuperarPassword);

// Función para mostrar mensajes de estado
function mostrarMensaje(mensaje, color = "black") {
  const mensajeElemento = document.getElementById("mensaje");
  mensajeElemento.textContent = mensaje;
  mensajeElemento.style.color = color;
}

// Función para registrar atleta
async function registrarAtleta() {
  // Evitar el envío automático del formulario
  event.preventDefault();

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
    mostrarMensaje("Todos los campos son obligatorios.", "red");
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
      mostrarMensaje("Este DNI ya está registrado.", "red");
      return;
    }

    let certificadoURL = null;
    if (categoria === "especial" && certificadoDiscapacidad) {
      mostrarMensaje("Subiendo certificado de discapacidad...", "blue");
      const certificadoRef = ref(storage, `certificados/${dni}_certificado.${certificadoDiscapacidad.name.split('.').pop()}`);
      await uploadBytes(certificadoRef, certificadoDiscapacidad);
      certificadoURL = await getDownloadURL(certificadoRef);
    }

    let aptoMedicoURL = null;
    if (aptoMedico) {
      mostrarMensaje("Subiendo apto médico...", "blue");
      const aptoRef = ref(storage, `aptos_medicos/${dni}_apto.${aptoMedico.name.split('.').pop()}`);
      await uploadBytes(aptoRef, aptoMedico);
      aptoMedicoURL = await getDownloadURL(aptoRef);
    }

    // Guardar el atleta en Firestore
    await setDoc(atletaRef, {
      nombre,
      apellido,
      dni: parseInt(dni),
      fechaNacimiento,
      localidad,
      grupoRunning: tipoGrupo,
      grupoRunningNombre: nombreGrupo || "",
      categoria,
      password, // ⚠️ Debe encriptarse en producción
      aptoMedico: aptoMedicoURL,
      certificadoDiscapacidad: certificadoURL
    });

    mostrarMensaje("Registro exitoso.", "green");
    document.getElementById("registro-form").reset();
  } catch (error) {
    console.error("Error al registrar:", error);
    mostrarMensaje("Hubo un error al registrar. Inténtalo nuevamente.", "red");
  }
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
document.getElementById("registro-form").addEventListener("submit", registrarAtleta);
