// Importar funciones necesarias de Firebase
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// Función para registrar un atleta
async function registrarAtleta() {
  const db = window.db; // Accede a la base de datos Firestore

  // Obtener valores del formulario
  let dni = document.getElementById("dni").value.trim();
  let nombre = document.getElementById("nombre").value.trim();
  let apellido = document.getElementById("apellido").value.trim();
  let fechaNacimiento = document.getElementById("fechaNacimiento").value;
  let localidad = document.getElementById("localidad").value.trim();
  let grupoRunning = document.getElementById("grupoRunning").value.trim();
  let categoria = document.getElementById("categoria").value;
  let password = document.getElementById("password").value;
  let confirmPassword = document.getElementById("confirmPassword").value;
  let aptoMedico = document.getElementById("aptoMedico").checked;
  let certificadoDiscapacidad = document.getElementById("certificadoDiscapacidad").checked;

  // Verificar que todos los campos estén llenos
  if (!dni || !nombre || !apellido || !fechaNacimiento || !localidad || !grupoRunning || !categoria || !password || !confirmPassword) {
    alert("Todos los campos son obligatorios.");
    return;
  }

  // Verificar que la contraseña tenga 6 caracteres
  if (password.length !== 6) {
    alert("La contraseña debe tener 6 caracteres.");
    return;
  }

  // Verificar que las contraseñas coincidan
  if (password !== confirmPassword) {
    alert("Las contraseñas no coinciden.");
    return;
  }

  try {
    const atletaRef = doc(db, "atletas", dni); // Referencia al documento con el DNI como ID
    const atletaSnap = await getDoc(atletaRef);

    if (atletaSnap.exists()) {
      alert("Este DNI ya está registrado.");
      return;
    }

    // Si el DNI no existe, guardar el atleta
    await setDoc(atletaRef, {
      nombre,
      apellido,
      dni: parseInt(dni),
      fechaNacimiento,
      localidad,
      grupoRunning,
      categoria,
      password, // 🔴 En producción deberías encriptarla
      aptoMedico,
      certificadoDiscapacidad
    });

    alert("Registro exitoso.");
    document.getElementById("registrationForm").reset(); // Limpiar el formulario
  } catch (error) {
    console.error("Error al registrar:", error);
    alert("Hubo un error al registrar. Inténtalo nuevamente.");
  }
}

// Asignar la función al botón de registro
document.getElementById("btnRegistrar").addEventListener("click", registrarAtleta);
