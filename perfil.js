// Importar Firebase desde config.js
import { db, storage, auth } from './config.js';
import { doc, getDoc, setDoc, deleteDoc, collection, getDocs, query, where, addDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-storage.js";
import { signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// Verificación inicial al cargar la página
document.addEventListener("DOMContentLoaded", async () => {
    let usuario = JSON.parse(sessionStorage.getItem("usuario"));

    // Si falta el dni, intenta refrescarlo desde atletas
    if (!usuario || !usuario.uid) {
        window.location.href = "index.html";
        return;
    }
    if (!usuario.dni) {
        // Buscar en atletas por uid
        const { getDocs, collection, query, where } = await import("https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js");
        const { db } = await import('./config.js');
        const atletasQuery = query(
            collection(db, "atletas"),
            where("uid", "==", usuario.uid)
        );
        const querySnapshot = await getDocs(atletasQuery);
        if (!querySnapshot.empty) {
            const atletaData = querySnapshot.docs[0].data();
            usuario = {
                ...usuario,
                dni: atletaData.dni,
                nombre: atletaData.nombre,
                apellido: atletaData.apellido,
                photo: atletaData.photoURL || atletaData.photo
            };
            sessionStorage.setItem('usuario', JSON.stringify(usuario));
        } else {
            window.location.href = "registration.html";
            return;
        }
    }

    await cargarPerfilUsuario();
});

// Función principal para cargar el perfil
async function cargarPerfilUsuario() {
    const usuario = JSON.parse(sessionStorage.getItem("usuario"));
    
    try {
        // Buscar el atleta por DNI
        const atletaRef = doc(db, "atletas", usuario.dni.toString());
        const atletaDoc = await getDoc(atletaRef);

        if (!atletaDoc.exists()) {
            mostrarMensaje("No se encontró el perfil del atleta", "error");
            return;
        }

        const atletaData = atletaDoc.data();
        
        // Verificar que el usuario sea el dueño del documento
        if (atletaData.uid !== usuario.uid) {
            mostrarMensaje("No tienes permiso para ver este perfil", "error");
            window.location.href = "index.html";
            return;
        }

        // Cargar datos en el formulario
        document.getElementById("nombre").value = atletaData.nombre || "";
        document.getElementById("apellido").value = atletaData.apellido || "";
        document.getElementById("dni").value = atletaData.dni || "";
        document.getElementById("localidad").value = atletaData.localidad || "";
        document.getElementById("fecha-nacimiento").value = atletaData.fechaNacimiento || "";
        document.getElementById("categoria").value = atletaData.categoria || "";
        
        // Cargar grupo de running
        const grupoRunningElement = document.getElementById("grupo-running");
        if (grupoRunningElement) {
            grupoRunningElement.textContent = atletaData.grupoRunning || "Individual";
        }

        await cargarGrupos(atletaData.grupoRunning);

        document.getElementById('perfil-nombre').textContent = atletaData.nombre + (atletaData.apellido ? ' ' + atletaData.apellido : '');
        document.getElementById('perfil-email').textContent = atletaData.email;
        document.getElementById('perfil-dni').textContent = "DNI: " + (atletaData.dni || '');
        const foto = document.getElementById('perfil-foto');
        const fotoUrl = atletaData.photoURL || atletaData.photo || '';
        if (foto && fotoUrl) {
            foto.src = fotoUrl;
            foto.style.display = 'block';
        } else if (foto) {
            foto.style.display = 'none';
        }

        // Calcular puntos totales y bonus
        let puntosTotales = 0;
        let puntosBonus = 0;
        if (Array.isArray(atletaData.historial)) {
            atletaData.historial.forEach(item => {
                if (!isNaN(Number(item.puntos)) && item.puntos !== "-") {
                    puntosTotales += Number(item.puntos);
                }
                if (!isNaN(Number(item.bonus)) && item.bonus > 0) {
                    puntosBonus += Number(item.bonus);
                }
            });
        }
        document.getElementById('perfil-puntos').textContent = puntosTotales;
        document.getElementById('perfil-bonus').textContent = puntosBonus;

        // Cargar certificados
        await verCertificados(atletaData.dni);

        // Mostrar estado del apto médico en el perfil
        await mostrarEstadoAptoMedico(atletaData.dni);
        // Mostrar estado del certificado de discapacidad solo si la categoría es Especial
        const divCertDisc = document.getElementById('estado-certificado-discapacidad');
        if (atletaData.categoria && atletaData.categoria.toLowerCase() === 'especial') {
            divCertDisc.style.display = '';
            await mostrarEstadoCertificadoDiscapacidad(atletaData.dni);
        } else {
            divCertDisc.style.display = 'none';
        }

        document.getElementById('logout').addEventListener('click', async () => {
            await signOut(auth);
            sessionStorage.clear();
            window.location.href = 'index.html';
        });

    } catch (error) {
        console.error("Error al cargar perfil:", error);
        mostrarMensaje("Error al cargar los datos del perfil", "error");
    }
}

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

function esDniValido(dni) {
    // Verificar que solo contenga números y tenga 7 u 8 dígitos
    const dniRegex = /^\d{7,8}$/;
    
    // Convertir a número para validaciones adicionales
    const dniNum = parseInt(dni, 10);
    
    // DNIs que no son válidos (todos los números iguales)
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

async function dniExiste(dni) {
    const atletaRef = doc(db, "atletas", dni);
    const atletaSnap = await getDoc(atletaRef);
    return atletaSnap.exists(); 
}

// Función para actualizar el perfil
async function actualizarPerfil(event) {
    event.preventDefault();
    const submitBtn = event.target.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;
    const usuario = JSON.parse(sessionStorage.getItem("usuario"));

    try {
        const nuevoDni = document.getElementById("dni").value.trim();
        const nombre = document.getElementById("nombre").value.trim();
        const apellido = document.getElementById("apellido").value.trim();
        const localidad = document.getElementById("localidad").value.trim();
        const fechaNacimiento = document.getElementById("fecha-nacimiento").value;
        const categoria = document.getElementById("categoria").value;
        const grupoRunning = document.getElementById("nuevo-grupo").value;
        const aptoMedicoFile = document.getElementById("apto-medico").files[0];
        const certificadoDiscapacidadFile = document.getElementById("certificado-discapacidad").files[0];

        // Validaciones
        if (!nombre || !apellido || !nuevoDni || !localidad || !fechaNacimiento || !categoria) {
            mostrarMensaje("Todos los campos son obligatorios", "error");
            return;
        }

        // Convertir DNI a número
        const dniNumero = parseInt(nuevoDni, 10);
        if (isNaN(dniNumero)) {
            mostrarMensaje("El DNI debe ser un número válido", "error");
            return;
        }

        // Preparar datos de actualización
        const updateData = {
            nombre: nombre,
            apellido: apellido,
            dni: dniNumero,
            localidad: localidad,
            fechaNacimiento: fechaNacimiento,
            categoria: categoria,
            grupoRunning: grupoRunning,
            uid: usuario.uid
        };

        // Subir certificados si existen
        if (aptoMedicoFile) {
            await uploadCertificate(aptoMedicoFile, usuario.uid);
            updateData.aptoMedico = true;
        }

        if (certificadoDiscapacidadFile) {
            await uploadCertificate(certificadoDiscapacidadFile, usuario.uid);
            updateData.certificadoDiscapacidad = true;
        }

        // Actualizar documento
        await setDoc(doc(db, "atletas", nuevoDni), updateData, { merge: true });

        // Actualizar datos en sessionStorage
        const updatedUserData = {
            ...usuario,
            nombre: nombre,
            apellido: apellido,
            dni: dniNumero
        };
        sessionStorage.setItem('usuario', JSON.stringify(updatedUserData));

        mostrarMensaje("Perfil actualizado correctamente", "success");
        setTimeout(() => window.location.reload(), 2000);

    } catch (error) {
        console.error("Error al actualizar:", error);
        mostrarMensaje("Error al actualizar el perfil", "error");
        if (submitBtn) submitBtn.disabled = false;
    }
}

// Función para mostrar mensajes
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

// Event Listeners
document.getElementById("perfil-form")?.addEventListener("submit", actualizarPerfil);

// Mostrar/ocultar certificado según categoría (versión para <select>)
document.addEventListener("DOMContentLoaded", () => {
    const categoriaSelect = document.getElementById("categoria");
    const certificadoContainer = document.getElementById("certificado-container");

    const toggleCertificado = () => {
        if (categoriaSelect.value.toLowerCase() === "especial") {
            certificadoContainer.style.display = "block";
        } else {
            certificadoContainer.style.display = "none";
        }
    };

    categoriaSelect.addEventListener("change", toggleCertificado);

    // Ejecutar al cargar la página por si ya tiene valor
    toggleCertificado();
});

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
async function uploadCertificate(file, userId) {
    try {
        mostrarMensaje('Validando certificado...', 'info');
        const tipoArchivo = validateCertificateFile(file);
        
        // Obtener datos del atleta
        const atletaQuery = query(collection(db, 'atletas'), where('uid', '==', userId));
        const querySnapshot = await getDocs(atletaQuery);
        
        if (querySnapshot.empty) {
            throw new Error('No se encontró el perfil del atleta. Por favor, complete su registro primero.');
        }
        
        const atletaData = querySnapshot.docs[0].data();
        mostrarMensaje('Preparando certificado para subida...', 'info');
        
        // Convertir archivo a base64
        const base64Data = await fileToBase64(file);
        
        // Determinar el tipo de certificado basado en el input del formulario
        const tipo = document.getElementById('apto-medico').files[0] === file ? 'aptoMedico' : 'certificadoDiscapacidad';
        
        // Crear ID personalizado para el certificado
        const certificadoId = `${atletaData.dni}_${tipo}`;
        
        // Crear documento de certificado
        const certificateDoc = {
            uid: userId,
            dni: atletaData.dni,
            nombre: atletaData.nombre,
            apellido: atletaData.apellido,
            tipo: tipo,
            certificado: base64Data,
            nombreArchivo: file.name,
            tipoArchivo: tipoArchivo,
            fechaSubida: new Date().toISOString()
        };
        
        mostrarMensaje('Subiendo certificado...', 'info');
        const certificadoRef = doc(db, 'certificados', certificadoId);
        await setDoc(certificadoRef, certificateDoc);
        
        mostrarMensaje('Certificado subido exitosamente', 'success');
        return certificadoId;
    } catch (error) {
        console.error('Error al subir certificado:', error);
        mostrarMensaje(`Error al subir certificado: ${error.message}`, 'error');
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

// Función para ver certificado
async function viewCertificate(certificateId) {
    try {
        const certificate = await getCertificate(certificateId);
        
        if (certificate.fileType.startsWith('image/')) {
            const img = document.createElement('img');
            img.src = certificate.data;
            img.style.maxWidth = '100%';
            
            const modal = document.createElement('div');
            modal.style.position = 'fixed';
            modal.style.top = '0';
            modal.style.left = '0';
            modal.style.width = '100%';
            modal.style.height = '100%';
            modal.style.backgroundColor = 'rgba(0,0,0,0.8)';
            modal.style.display = 'flex';
            modal.style.justifyContent = 'center';
            modal.style.alignItems = 'center';
            modal.style.zIndex = '1000';
            
            modal.appendChild(img);
            document.body.appendChild(modal);
            
            modal.addEventListener('click', () => {
                document.body.removeChild(modal);
            });
        } else {
            const win = window.open('', '_blank');
            win.document.write(`
                <iframe width='100%' height='100%' src='${certificate.data}'></iframe>
            `);
        }
    } catch (error) {
        mostrarMensaje('Error al ver certificado: ' + error.message, 'error');
    }
}

// Función para descargar certificado
async function downloadCertificate(certificateId) {
    try {
        const certificate = await getCertificate(certificateId);
        
        const link = document.createElement('a');
        link.href = certificate.data;
        link.download = certificate.fileName;
        link.click();
    } catch (error) {
        mostrarMensaje('Error al descargar certificado: ' + error.message, 'error');
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

// Función para crear elemento de certificado
function createCertificateElement(certificate) {
    const div = document.createElement('div');
    div.className = 'certificate-item';
    div.style.marginBottom = '10px';
    div.style.padding = '10px';
    div.style.border = '1px solid #ddd';
    div.style.borderRadius = '5px';
    
    const fileName = document.createElement('p');
    fileName.textContent = certificate.fileName;
    fileName.style.marginBottom = '5px';
    
    const buttons = document.createElement('div');
    buttons.style.display = 'flex';
    buttons.style.gap = '10px';
    
    const viewBtn = document.createElement('button');
    viewBtn.textContent = 'Ver';
    viewBtn.className = 'btn btn-sm btn-primary';
    viewBtn.onclick = () => viewCertificate(certificate.id);
    
    const downloadBtn = document.createElement('button');
    downloadBtn.textContent = 'Descargar';
    downloadBtn.className = 'btn btn-sm btn-secondary';
    downloadBtn.onclick = () => downloadCertificate(certificate.id);
    
    buttons.appendChild(viewBtn);
    buttons.appendChild(downloadBtn);
    
    div.appendChild(fileName);
    div.appendChild(buttons);
    
    return div;
}

// Agregar event listeners para certificados
document.addEventListener("DOMContentLoaded", () => {
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
                const usuario = JSON.parse(sessionStorage.getItem("usuario"));
                if (!usuario || !usuario.uid) {
                    mostrarMensaje('Debe iniciar sesión para subir certificados', 'error');
                    return;
                }
                
                const certificateId = await uploadCertificate(file, usuario.uid);
                await loadUserCertificates(usuario.uid);
                
                certificateInput.value = '';
                const preview = document.getElementById('certificatePreview');
                if (preview) preview.style.display = 'none';
            } catch (error) {
                mostrarMensaje(error.message, 'error');
            }
        });
    }
});

// Función para ver certificados
async function verCertificados(dni) {
    try {
        // Verificar autenticación
        const usuario = JSON.parse(sessionStorage.getItem("usuario"));
        if (!usuario || !usuario.uid) {
            mostrarMensaje("Debes iniciar sesión para ver los certificados", "error");
            return;
        }

        // Verificar que el usuario tenga acceso al DNI
        const atletaRef = doc(db, "atletas", dni.toString());
        const atletaDoc = await getDoc(atletaRef);
        
        if (!atletaDoc.exists()) {
            mostrarMensaje("No se encontró el perfil del atleta", "error");
            return;
        }

        const atletaData = atletaDoc.data();
        
        // Verificar permisos de acceso
        if (atletaData.uid !== usuario.uid && !usuario.isAdmin) {
            mostrarMensaje("No tienes permiso para ver estos certificados", "error");
            return;
        }

        // Crear contenedor de certificados
        const certificadosContainer = document.createElement('div');
        certificadosContainer.className = 'certificados-container';
        certificadosContainer.style.marginTop = '20px';
        certificadosContainer.style.padding = '20px';
        certificadosContainer.style.border = '1px solid #ddd';
        certificadosContainer.style.borderRadius = '5px';

        // Función para crear botón de certificado
        const crearBotonCertificado = (tipo, certificado, nombreArchivo, tipoArchivo) => {
            const button = document.createElement('button');
            button.className = 'btn btn-primary';
            button.textContent = `Ver ${tipo === 'aptoMedico' ? 'Apto Médico' : 'Certificado de Discapacidad'}`;
            button.type = 'button';
            button.onclick = async (event) => {
                event.preventDefault();
                event.stopPropagation();
                try {
                    // Verificar permisos antes de mostrar el certificado
                    const certRef = doc(db, "certificados", `${dni}_${tipo}`);
                    const certDoc = await getDoc(certRef);
                    if (!certDoc.exists()) {
                        mostrarMensaje("El certificado no existe", "error");
                        return;
                    }
                    const certData = certDoc.data();
                    if (certData.uid !== atletaData.uid && !usuario.isAdmin) {
                        mostrarMensaje("No tienes permiso para ver este certificado", "error");
                        return;
                    }
                    // Crear ventana emergente para mostrar el certificado
                    const modal = document.createElement('div');
                    modal.style.position = 'fixed';
                    modal.style.top = '0';
                    modal.style.left = '0';
                    modal.style.width = '100%';
                    modal.style.height = '100%';
                    modal.style.backgroundColor = 'rgba(0,0,0,0.8)';
                    modal.style.display = 'flex';
                    modal.style.justifyContent = 'center';
                    modal.style.alignItems = 'center';
                    modal.style.zIndex = '1000';
                    const content = document.createElement('div');
                    content.style.backgroundColor = 'white';
                    content.style.padding = '20px';
                    content.style.borderRadius = '5px';
                    content.style.maxWidth = '90%';
                    content.style.maxHeight = '90%';
                    content.style.overflow = 'auto';
                    if (tipoArchivo.startsWith('image/')) {
                        const img = document.createElement('img');
                        img.src = certificado;
                        img.style.maxWidth = '100%';
                        content.appendChild(img);
                    } else if (tipoArchivo === 'application/pdf') {
                        const iframe = document.createElement('iframe');
                        iframe.src = certificado;
                        iframe.style.width = '100%';
                        iframe.style.height = '500px';
                        iframe.style.border = 'none';
                        content.appendChild(iframe);
                    }
                    const closeButton = document.createElement('button');
                    closeButton.textContent = 'Cerrar';
                    closeButton.className = 'btn btn-secondary';
                    closeButton.style.marginTop = '10px';
                    closeButton.type = 'button';
                    closeButton.onclick = () => {
                        document.body.removeChild(modal);
                    };
                    content.appendChild(closeButton);
                    modal.appendChild(content);
                    document.body.appendChild(modal);
                    // Scroll al modal en mobile
                    if (window.innerWidth < 700) {
                        setTimeout(() => {
                            modal.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        }, 100);
                    }
                } catch (error) {
                    console.error("Error al mostrar certificado:", error);
                    mostrarMensaje("Error al mostrar el certificado", "error");
                }
            };
            return button;
        };

        // Obtener certificados uno por uno para mejor manejo de errores
        try {
            const aptoMedicoRef = doc(db, "certificados", `${dni}_aptoMedico`);
            const aptoMedicoDoc = await getDoc(aptoMedicoRef);
            
            if (aptoMedicoDoc.exists()) {
                const { certificado, nombreArchivo, tipoArchivo } = aptoMedicoDoc.data();
                // Si no hay tipoArchivo, intentamos determinarlo por la extensión del archivo
                const tipoArchivoFinal = tipoArchivo || (nombreArchivo.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg');
                certificadosContainer.appendChild(crearBotonCertificado('aptoMedico', certificado, nombreArchivo, tipoArchivoFinal));
            }
        } catch (error) {
            console.error("Error al cargar apto médico:", error);
        }

        try {
            const certificadoDiscapacidadRef = doc(db, "certificados", `${dni}_certificadoDiscapacidad`);
            const certificadoDiscapacidadDoc = await getDoc(certificadoDiscapacidadRef);
            
            if (certificadoDiscapacidadDoc.exists()) {
                const { certificado, nombreArchivo, tipoArchivo } = certificadoDiscapacidadDoc.data();
                // Si no hay tipoArchivo, intentamos determinarlo por la extensión del archivo
                const tipoArchivoFinal = tipoArchivo || (nombreArchivo.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg');
                certificadosContainer.appendChild(crearBotonCertificado('certificadoDiscapacidad', certificado, nombreArchivo, tipoArchivoFinal));
            }
        } catch (error) {
            console.error("Error al cargar certificado de discapacidad:", error);
        }

        // Agregar contenedor al DOM solo si hay certificados
        if (certificadosContainer.children.length > 0) {
            const form = document.getElementById('perfil-form');
            if (form) {
                form.appendChild(certificadosContainer);
            }
        }

    } catch (error) {
        console.error("Error al cargar certificados:", error);
        mostrarMensaje("Error al cargar los certificados", "error");
    }
}

// Mostrar estado del apto médico en el perfil
async function mostrarEstadoAptoMedico(dni) {
  const estadoDiv = document.getElementById('estado-apto-medico');
  if (!estadoDiv) return;
  estadoDiv.innerHTML = '';
  try {
    const aptoRef = doc(db, 'certificados', `${dni}_aptoMedico`);
    const aptoDoc = await getDoc(aptoRef);
    let estado = 'pendiente';
    if (aptoDoc.exists()) {
      const data = aptoDoc.data();
      if (data.estadoManual === 'valido') estado = 'valido';
      else if (data.estadoManual === 'invalido') estado = 'invalido';
    } else {
      estadoDiv.innerHTML = '<span class="badge badge-pendiente">Apto médico: No presentado</span>';
      return;
    }
    let badgeClass = 'badge-pendiente', label = 'Pendiente de revisión';
    if (estado === 'valido') { badgeClass = 'badge-valido'; label = 'Apto médico: Válido'; }
    else if (estado === 'invalido') { badgeClass = 'badge-invalido'; label = 'Apto médico: Rechazado'; }
    else { label = 'Apto médico: Pendiente de revisión'; }
    estadoDiv.innerHTML = `<span class="badge ${badgeClass}">${label}</span>`;
  } catch (e) {
    estadoDiv.innerHTML = '<span class="badge badge-pendiente">Apto médico: No presentado</span>';
  }
}

// Mostrar estado del certificado de discapacidad en el perfil
async function mostrarEstadoCertificadoDiscapacidad(dni) {
  const estadoDiv = document.getElementById('estado-certificado-discapacidad');
  if (!estadoDiv) return;
  estadoDiv.innerHTML = '';
  try {
    const certRef = doc(db, 'certificados', `${dni}_certificadoDiscapacidad`);
    const certDoc = await getDoc(certRef);
    let estado = 'pendiente';
    if (certDoc.exists()) {
      const data = certDoc.data();
      if (data.estadoManual === 'valido') estado = 'valido';
      else if (data.estadoManual === 'invalido') estado = 'invalido';
    } else {
      estadoDiv.innerHTML = '<span class="badge badge-pendiente">Certificado de discapacidad: No presentado</span>';
      return;
    }
    let badgeClass = 'badge-pendiente', label = 'Pendiente de revisión';
    if (estado === 'valido') { badgeClass = 'badge-valido'; label = 'Certificado de discapacidad: Válido'; }
    else if (estado === 'invalido') { badgeClass = 'badge-invalido'; label = 'Certificado de discapacidad: Rechazado'; }
    else { label = 'Certificado de discapacidad: Pendiente de revisión'; }
    estadoDiv.innerHTML = `<span class="badge ${badgeClass}">${label}</span>`;
  } catch (e) {
    estadoDiv.innerHTML = '<span class="badge badge-pendiente">Certificado de discapacidad: No presentado</span>';
  }
}

// Para el botón 'Volver al inicio', aseguro que funcione en mobile:
document.addEventListener('DOMContentLoaded', () => {
    const volverBtn = document.querySelector('a.btn-link[href="index.html"]');
    if (volverBtn) {
        volverBtn.addEventListener('touchend', function(e) {
            window.location.href = 'index.html';
        });
    }
});
