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

// Validación en tiempo real de la contraseña
document.getElementById("password").addEventListener("input", function() {
  const password = this.value;
  if (password.length === 6) {
    this.style.borderColor = "green";
  } else {
    this.style.borderColor = "red";
  }
});

// Función para registrar atleta
async function registrarAtleta() {
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
    alert("Todos los campos son obligatorios.");
    return;
  }

  if (password.length !== 6) {
    alert("La contraseña debe tener 6 caracteres.");
    return;
  }

  if (password !== confirmPassword) {
    alert("Las contraseñas no coinciden.");
    return;
  }

  try {
    const atletaRef = doc(db, "atletas", dni);
    const atletaSnap = await getDoc(atletaRef);

    if (atletaSnap.exists()) {
      alert("Este DNI ya está registrado.");
      return;
    }

    let certificadoURL = null;
    if (categoria === "especial" && certificadoDiscapacidad) {
      const certificadoRef = ref(storage, `certificados_discapacidad/${dni}_${certificadoDiscapacidad.name}`);
      await uploadBytes(certificadoRef, certificadoDiscapacidad);
      certificadoURL = await getDownloadURL(certificadoRef);
    }

    let aptoMedicoURL = null;
    if (aptoMedico) {
      const aptoRef = ref(storage, `aptos_medicos/${dni}_${aptoMedico.name}`);
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
      grupoRunningNombre: nombreGrupo || "",  // Se guarda solo si es grupo
      categoria,
      password,  // ⚠️ Debe encriptarse en producción
      aptoMedico: aptoMedicoURL,
      certificadoDiscapacidad: certificadoURL
    });

    alert("Registro exitoso.");
    document.getElementById("registro-form").reset();
  } catch (error) {
    console.error("Error al registrar:", error);
    alert("Hubo un error al registrar. Inténtalo nuevamente.");
  }
}

// Asignar la función al botón de registro
document.getElementById("registro-form").addEventListener("submit", function (e) {
  e.preventDefault(); // Evita el envío automático del formulario
  registrarAtleta();
});
