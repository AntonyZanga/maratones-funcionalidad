// registration.js
// ----------------

import { auth, db, storage } from './config.js';
import { doc, getDoc, setDoc, collection, getDocs, addDoc, serverTimestamp, query, where } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-storage.js";

// ================================
// 🔹 Verificar autenticación
// ================================
document.addEventListener("DOMContentLoaded", async () => {
    // --- Código de autenticación y prellenado ---
    const tempUserData = JSON.parse(sessionStorage.getItem('tempUserData'));
    if (!tempUserData || !tempUserData.email || !tempUserData.uid) {
        window.location.href = 'index.html';
        return;
    }
    if (tempUserData.nombre) {
        const nombres = tempUserData.nombre.split(' ');
        document.getElementById("nombre").value = nombres[0] || '';
        document.getElementById("apellido").value = nombres.slice(1).join(' ') || '';
    }
    await cargarGrupos();

    // --- Validación en tiempo real del DNI ---
    const dniInput = document.getElementById('dni');
    const dniError = document.getElementById('dni-error');
    const form = document.getElementById('registro-form');
    function validarDNI() {
        const valor = dniInput.value.trim();
        if (!/^\d{7,8}$/.test(valor)) {
            dniInput.classList.remove('valid');
            dniInput.classList.add('invalid');
            dniError.textContent = "El DNI debe tener 7 u 8 números y no puede contener letras ni puntos.";
            return false;
        }
        if (valor === "00000000" || valor === "12345678") {
            dniInput.classList.remove('valid');
            dniInput.classList.add('invalid');
            dniError.textContent = "Ese DNI no es válido. Por favor, revisa tu documento.";
            return false;
        }
        dniInput.classList.remove('invalid');
        dniInput.classList.add('valid');
        dniError.textContent = "";
        return true;
    }
    if (dniInput) {
        dniInput.addEventListener('input', validarDNI);
    }
    if (form) {
        form.addEventListener('submit', function(e) {
            if (!validarDNI()) {
                e.preventDefault();
                dniInput.focus();
            }
        });
    }

    // --- Mostrar/ocultar certificado según categoría ---
    document.querySelectorAll('input[name="categoria"]').forEach(radio => {
        radio.addEventListener("change", () => {
            const certificadoContainer = document.getElementById("certificado-container");
            certificadoContainer.style.display = radio.value === "Especial" ? "block" : "none";
        });
    });
});

// ================================
// 🔹 Cargar grupos de running
// ================================
async function cargarGrupos() {
    const selectGrupo = document.getElementById("tipo-grupo");
    try {
        const querySnapshot = await getDocs(collection(db, "grupos"));
        querySnapshot.forEach(docSnap => {
            const grupo = docSnap.data().nombre;
            if (grupo !== "Individual") {
                const option = document.createElement("option");
                option.value = grupo;
                option.textContent = grupo;
                selectGrupo.appendChild(option);
            }
        });
    } catch (error) {
        console.error("Error al cargar los grupos:", error);
        mostrarMensaje("Error al cargar los grupos de running", "error");
    }
}

// ================================
// 🔹 Mostrar mensajes
// ================================
function mostrarMensaje(mensaje, tipo = "info") {
    // Crear o obtener el contenedor de mensajes
    let mensajeContainer = document.getElementById('mensaje-container');
    if (!mensajeContainer) {
        mensajeContainer = document.createElement('div');
        mensajeContainer.id = 'mensaje-container';
        mensajeContainer.style.position = 'fixed';
        mensajeContainer.style.top = '20px';
        mensajeContainer.style.left = '50%';
        mensajeContainer.style.transform = 'translateX(-50%)';
        mensajeContainer.style.zIndex = '1000';
        document.body.appendChild(mensajeContainer);
    }

    // Crear el mensaje
    const mensajeElement = document.createElement('div');
    mensajeElement.className = `mensaje mensaje-${tipo}`;
    mensajeElement.style.padding = '15px 25px';
    mensajeElement.style.marginBottom = '10px';
    mensajeElement.style.borderRadius = '5px';
    mensajeElement.style.boxShadow = '0 2px 5px rgba(0,0,0,0.2)';
    mensajeElement.style.animation = 'slideIn 0.3s ease-out';
    
    // Estilos según el tipo
    switch(tipo) {
        case 'success':
            mensajeElement.style.backgroundColor = '#d4edda';
            mensajeElement.style.color = '#155724';
            mensajeElement.style.border = '1px solid #c3e6cb';
            break;
        case 'error':
            mensajeElement.style.backgroundColor = '#f8d7da';
            mensajeElement.style.color = '#721c24';
            mensajeElement.style.border = '1px solid #f5c6cb';
            break;
        case 'info':
            mensajeElement.style.backgroundColor = '#d1ecf1';
            mensajeElement.style.color = '#0c5460';
            mensajeElement.style.border = '1px solid #bee5eb';
            break;
    }

    mensajeElement.textContent = mensaje;
    mensajeContainer.appendChild(mensajeElement);

    // Auto-eliminar después de 5 segundos
    setTimeout(() => {
        mensajeElement.style.animation = 'slideOut 0.3s ease-in';
        setTimeout(() => {
            mensajeContainer.removeChild(mensajeElement);
        }, 300);
    }, 5000);
}

// Agregar estilos CSS para las animaciones
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from { transform: translateY(-100%); opacity: 0; }
        to { transform: translateY(0); opacity: 1; }
    }
    @keyframes slideOut {
        from { transform: translateY(0); opacity: 1; }
        to { transform: translateY(-100%); opacity: 0; }
    }
`;
document.head.appendChild(style);

// ================================
// 🔹 Obtener datos del torneo
// ================================
async function obtenerDatosTorneo() {
    try {
        const torneoRef = doc(db, "torneo", "datos");
        const snap = await getDoc(torneoRef);
        if (!snap.exists()) {
            return { cantidadFechas: 0, fechasProcesadas: [] };
        }
        return snap.data();
    } catch (error) {
        console.error("Error al obtener datos del torneo:", error);
        return { cantidadFechas: 0, fechasProcesadas: [] };
    }
}

// ================================
// 🔹 Validar DNI
// ================================
function esDniValido(dni) {
    // Verificar que solo contenga números y tenga 7 u 8 dígitos
    const dniRegex = /^\d{7,8}$/;
    
    // Convertir a número para validaciones adicionales
    const dniNum = parseInt(dni, 10);
    
    // DNIs que no son válidos
    const dniInvalidos = [
        "00000000", 
        "11111111", 
        "22222222", 
        "33333333", 
        "44444444", 
        "55555555", 
        "66666666", 
        "77777777", 
        "88888888", 
        "99999999"
    ];

    // Verificar que:
    // 1. Cumpla con el formato (7-8 dígitos)
    // 2. No sea un DNI con todos los números iguales
    // 3. Sea un número mayor que 1000000 (1 millón)
    return dniRegex.test(dni) && 
           !dniInvalidos.includes(dni) && 
           dniNum > 1000000;
}

// ================================
// 🔹 Registrar atleta
// ================================
async function registrarAtleta(event) {
    event.preventDefault();
    const submitBtn = event.target.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;

    const tempUserData = JSON.parse(sessionStorage.getItem('tempUserData'));
    if (!tempUserData || !tempUserData.uid) {
        mostrarMensaje("Error: Debes iniciar sesión primero", "error");
        if (submitBtn) submitBtn.disabled = false;
        return;
    }

    const dni = document.getElementById("dni").value.trim();
    const nombre = document.getElementById("nombre").value.trim();
    const apellido = document.getElementById("apellido").value.trim();
    const fechaNacimiento = document.getElementById("fecha-nacimiento").value;
    const localidad = document.getElementById("localidad").value.trim();
    const tipoGrupo = document.getElementById("tipo-grupo").value;
    const categoria = document.querySelector('input[name="categoria"]:checked')?.value;
    const aptoMedicoFile = document.getElementById("apto-medico").files[0];
    const certificadoDiscapacidadFile = document.getElementById("certificado-discapacidad").files[0];

    try {
        // Validar datos requeridos
        if (!nombre || !apellido || !dni) {
            mostrarMensaje("Nombre, apellido y DNI son obligatorios", "error");
            if (submitBtn) submitBtn.disabled = false;
            return;
        }

        // Convertir DNI a número
        const dniNumero = parseInt(dni, 10);
        if (isNaN(dniNumero)) {
            mostrarMensaje("El DNI debe ser un número válido", "error");
            if (submitBtn) submitBtn.disabled = false;
            return;
        }

        // Obtener datos del torneo
        const { cantidadFechas, fechasProcesadas } = await obtenerDatosTorneo();

        // Crear historial
        const historial = fechasProcesadas.map(fecha => ({
            posicion: "-",
            puntos: "-",
            bonus: 0,
            grupoRunning: tipoGrupo,
            fecha: fecha,
            categoria: categoria
        }));

        // Completar fechas faltantes
        if (historial.length < cantidadFechas) {
            for (let i = historial.length; i < cantidadFechas; i++) {
                historial.push({
                    posicion: "-",
                    puntos: "-",
                    bonus: 0,
                    grupoRunning: tipoGrupo,
                    fecha: null,
                    categoria: categoria
                });
            }
        }

        // Crear documento del atleta
        const atletaData = {
            nombre: nombre,
            apellido: apellido,
            dni: dniNumero,
            fechaNacimiento: fechaNacimiento,
            localidad: localidad,
            grupoRunning: tipoGrupo,
            categoria: categoria,
            email: tempUserData.email,
            photoURL: tempUserData.photoURL,
            uid: tempUserData.uid,
            aptoMedico: false,
            certificadoDiscapacidad: false,
            historial: historial,
            faltas: cantidadFechas,
            fechaRegistro: new Date().toISOString()
        };

        // Intentar crear el documento
        const atletaRef = doc(db, "atletas", dni.toString());
        const atletaSnap = await getDoc(atletaRef);
        if (atletaSnap.exists()) {
            mostrarMensaje("El DNI ya está registrado. Si crees que es un error, contacta a la administración.", "error");
            if (submitBtn) submitBtn.disabled = false;
            return;
        }
        await setDoc(atletaRef, atletaData);

        // Subir certificados si existen
        const updateData = {};
        
        if (aptoMedicoFile) {
            await subirCertificado(aptoMedicoFile, 'aptoMedico', dni);
            updateData.aptoMedico = true;
        }

        if (certificadoDiscapacidadFile) {
            await subirCertificado(certificadoDiscapacidadFile, 'certificadoDiscapacidad', dni);
            updateData.certificadoDiscapacidad = true;
        }

        // Actualizar el documento del atleta con los estados de los certificados
        if (Object.keys(updateData).length > 0) {
            await setDoc(atletaRef, updateData, { merge: true });
        }

        // Actualizar sesión
        const userData = {
            uid: tempUserData.uid,
            email: tempUserData.email,
            nombre: nombre,
            apellido: apellido,
            dni: dniNumero,
            isAdmin: false,
            photo: tempUserData.photoURL
        };
        sessionStorage.setItem('usuario', JSON.stringify(userData));
        sessionStorage.removeItem('tempUserData');

        mostrarMensaje('¡Registro exitoso! Serás redirigido a la página principal...');
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 2000);

    } catch (error) {
        console.error("Error:", error);
        mostrarMensaje("Error al registrar: " + error.message, "error");
        if (submitBtn) submitBtn.disabled = false;
    }
}

// ================================
// 🔹 Event Listeners
// ================================
document.getElementById("registro-form").addEventListener("submit", registrarAtleta);

// Agregar esta función
function validarArchivo(file, maxSizeMB = 2) {
    if (!file) return true;
    const maxSize = maxSizeMB * 1024 * 1024; // Convertir a bytes
    if (file.size > maxSize) {
        mostrarMensaje(`El archivo debe ser menor a ${maxSizeMB}MB`, "error");
        return false;
    }
    return true;
}

// Constantes para certificados
const MAX_FILE_SIZE = 1 * 1024 * 1024; // 1MB
const VALID_FILE_TYPES = ['image/jpeg', 'image/png', 'application/pdf'];
const VALID_FILE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.pdf'];
const MAX_FILE_SIZE_MB = (MAX_FILE_SIZE / (1024 * 1024)).toFixed(1);

function validateCertificateFile(file) {
    // Validar tipo de archivo
    const fileExtension = '.' + file.name.split('.').pop().toLowerCase();
    let detectedType = file.type;
    
    // Si el tipo no está definido o es incorrecto, intentar detectarlo por la extensión
    if (!detectedType || !VALID_FILE_TYPES.includes(detectedType)) {
        if (fileExtension === '.pdf') {
            detectedType = 'application/pdf';
        } else if (fileExtension === '.jpg' || fileExtension === '.jpeg') {
            detectedType = 'image/jpeg';
        } else if (fileExtension === '.png') {
            detectedType = 'image/png';
        }
    }
    
    if (!VALID_FILE_TYPES.includes(detectedType)) {
        throw new Error(`Tipo de archivo no válido. Solo se permiten: ${VALID_FILE_EXTENSIONS.join(', ')}`);
    }
    
    // Validar tamaño
    if (file.size > MAX_FILE_SIZE) {
        throw new Error(`El archivo es demasiado grande. El tamaño máximo permitido es ${MAX_FILE_SIZE_MB}MB`);
    }
    
    // Validar extensión
    if (!VALID_FILE_EXTENSIONS.includes(fileExtension)) {
        throw new Error(`Extensión de archivo no válida. Solo se permiten: ${VALID_FILE_EXTENSIONS.join(', ')}`);
    }
    
    return detectedType;
}

// Función para convertir archivo a base64
function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
    });
}

// Función para subir certificado
async function subirCertificado(file, tipo, dni) {
    try {
        // Validar archivo
        if (!file) {
            throw new Error('No se seleccionó ningún archivo');
        }

        // Validar archivo y obtener tipo detectado
        const tipoArchivo = validateCertificateFile(file);

        // Convertir archivo a base64
        const base64Data = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = error => reject(error);
            reader.readAsDataURL(file);
        });

        // Obtener datos del usuario actual
        const tempUserData = JSON.parse(sessionStorage.getItem('tempUserData'));
        if (!tempUserData || !tempUserData.uid) {
            throw new Error('No se encontró la información del usuario');
        }

        // Obtener datos del atleta
        const atletaRef = doc(db, "atletas", dni.toString());
        const atletaDoc = await getDoc(atletaRef);
        if (!atletaDoc.exists()) {
            throw new Error('No se encontró el perfil del atleta');
        }
        const atletaData = atletaDoc.data();

        // Determinar el tipo de certificado basado en el input del formulario
        const tipoCertificado = document.getElementById('apto-medico').files[0] === file ? 'aptoMedico' : 'certificadoDiscapacidad';

        // Crear ID personalizado para el certificado
        const certificadoId = `${dni}_${tipoCertificado}`;

        // Guardar en Firestore con ID personalizado
        const certificadoRef = doc(db, "certificados", certificadoId);
        await setDoc(certificadoRef, {
            uid: tempUserData.uid,
            dni: parseInt(dni),
            nombre: atletaData.nombre,
            apellido: atletaData.apellido,
            tipo: tipoCertificado,
            nombreArchivo: file.name,
            tipoArchivo: tipoArchivo,
            certificado: base64Data,
            fechaSubida: new Date().toISOString()
        });

        return true;
    } catch (error) {
        console.error("Error al subir certificado:", error);
        throw error;
    }
}

// Función para obtener certificado
async function getCertificate(certificateId) {
    try {
        mostrarMensaje('Cargando certificado...', 'info');
        const certDoc = await getDoc(doc(db, 'certificados', certificateId));
        
        if (!certDoc.exists()) {
            throw new Error('El certificado solicitado no existe en el sistema.');
        }

        const certData = certDoc.data();
        
        // Verificar permisos
        if (certData.uid !== auth.currentUser.uid) {
            throw new Error('No tiene autorización para acceder a este certificado.');
        }
        
        return {
            fileName: certData.fileName,
            fileType: certData.fileType,
            data: certData.certificado
        };
    } catch (error) {
        console.error('Error al obtener certificado:', error);
        mostrarMensaje(`Error al cargar certificado: ${error.message}`, 'error');
        throw error;
    }
}

// Función para cargar certificados del usuario
async function loadUserCertificates(userId) {
    try {
        mostrarMensaje('Cargando certificados...', 'info');
        const certificatesRef = collection(db, 'certificados');
        const q = query(certificatesRef, where('uid', '==', userId));
        const snapshot = await getDocs(q);
        
        const certificatesList = document.getElementById('certificatesList');
        if (!certificatesList) {
            mostrarMensaje('No se encontró el contenedor de certificados', 'error');
            return;
        }
        
        certificatesList.innerHTML = '';
        
        if (snapshot.empty) {
            const noCertificates = document.createElement('p');
            noCertificates.textContent = 'No hay certificados registrados';
            noCertificates.style.textAlign = 'center';
            noCertificates.style.padding = '20px';
            noCertificates.style.color = '#666';
            certificatesList.appendChild(noCertificates);
            mostrarMensaje('No se encontraron certificados', 'info');
            return;
        }
        
        snapshot.forEach(doc => {
            const certificate = {
                id: doc.id,
                ...doc.data()
            };
            const element = createCertificateElement(certificate);
            certificatesList.appendChild(element);
        });
        
        mostrarMensaje(`Se cargaron ${snapshot.size} certificados`, 'success');
    } catch (error) {
        console.error('Error al cargar certificados:', error);
        mostrarMensaje(`Error al cargar certificados: ${error.message}`, 'error');
    }
}

// Agregar event listeners para certificados
document.addEventListener('DOMContentLoaded', () => {
    // Event listener para subida de certificados
    const certificateInput = document.getElementById('certificateInput');
    const uploadCertificateBtn = document.getElementById('uploadCertificate');
    
    if (certificateInput && uploadCertificateBtn) {
        // Agregar información sobre tipos de archivo permitidos
        const fileInfo = document.createElement('div');
        fileInfo.style.marginTop = '10px';
        fileInfo.style.fontSize = '0.9em';
        fileInfo.style.color = '#666';
        fileInfo.innerHTML = `
            <p>Tipos de archivo permitidos: ${VALID_FILE_EXTENSIONS.join(', ')}</p>
            <p>Tamaño máximo: ${MAX_FILE_SIZE_MB}MB</p>
        `;
        certificateInput.parentNode.insertBefore(fileInfo, certificateInput.nextSibling);
        
        certificateInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                try {
                    validateCertificateFile(file);
                    const fileError = document.getElementById('fileError');
                    if (fileError) fileError.textContent = '';
                    
                    if (file.type.startsWith('image/')) {
                        const preview = document.getElementById('certificatePreview');
                        if (preview) {
                            const reader = new FileReader();
                            reader.onload = (e) => {
                                preview.src = e.target.result;
                                preview.style.display = 'block';
                            };
                            reader.readAsDataURL(file);
                        }
                    }
                    mostrarMensaje('Archivo validado correctamente', 'success');
                } catch (error) {
                    const fileError = document.getElementById('fileError');
                    if (fileError) {
                        fileError.textContent = error.message;
                        fileError.style.color = '#721c24';
                        fileError.style.marginTop = '5px';
                    }
                    const preview = document.getElementById('certificatePreview');
                    if (preview) preview.style.display = 'none';
                    e.target.value = '';
                    mostrarMensaje(error.message, 'error');
                }
            }
        });

        uploadCertificateBtn.addEventListener('click', async () => {
            const file = certificateInput.files[0];
            if (!file) {
                mostrarMensaje('Por favor, seleccione un archivo para subir', 'error');
                return;
            }
            
            try {
                const userId = auth.currentUser.uid;
                if (!userId) {
                    mostrarMensaje('Debe iniciar sesión para subir certificados', 'error');
                    return;
                }
                
                const certificateId = await uploadCertificate(file, userId);
                await loadUserCertificates(userId);
                
                certificateInput.value = '';
                const preview = document.getElementById('certificatePreview');
                if (preview) preview.style.display = 'none';
            } catch (error) {
                mostrarMensaje(error.message, 'error');
            }
        });
    }
});