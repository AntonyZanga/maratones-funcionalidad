// login.js

import { auth, db } from './config.js';
import { 
    GoogleAuthProvider, 
    signInWithPopup,
    signOut 
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { 
    collection,
    query,
    where,
    getDocs,
    doc,
    getDoc
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// Proveedor de Google
const provider = new GoogleAuthProvider();

// Elementos del DOM
const googleBtn = document.getElementById('google-login');
const userInfo = document.getElementById('user-info');
const logoutBtn = document.getElementById('logout');
const userName = document.getElementById('user-name');
const userPhoto = document.getElementById('user-photo');
const mensajeDiv = document.getElementById('mensaje');

// Mostrar/ocultar panel de puntos y bonus
const btnInfoPuntos = document.getElementById('btn-info-puntos');
const panelPuntos = document.getElementById('panel-puntos');

const panelHTML = `
  <div class="info-box-puntos">
    <h4>Sistema de Puntos</h4>
    <ul>
      <li><b>Puesto 1:</b> 12 puntos</li>
      <li><b>Puesto 2:</b> 10 puntos</li>
      <li><b>Puesto 3:</b> 9 puntos</li>
      <li><b>Puesto 4:</b> 8 puntos</li>
      <li>...hasta el <b>puesto 11</b> con <b>1 punto</b></li>
    </ul>
    <h5>Visualización de puntos por puesto:</h5>
    <div style="display: flex; gap: 6px; flex-wrap: wrap; align-items: flex-end;">
      ${[12, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1].map((pts, i) => `
        <div style="text-align:center;">
          <div style="background:#4caf50; width:28px; height:${pts * 4}px; margin:auto; border-radius:4px;"></div>
          <small>${i + 1}°</small>
        </div>
      `).join("")}
    </div>
    <h4 style="margin-top:1.5rem;">Bonificación por asistencia consecutiva</h4>
    <p>Los atletas reciben puntos extra por asistir a varias fechas seguidas:</p>
    <ul>
      <li>2 asistencias consecutivas: +2 pts</li>
      <li>3 asistencias: +4 pts</li>
      <li>4 asistencias: +6 pts</li>
      <li>5 asistencias: +8 pts</li>
      <li>6 asistencias: +10 pts</li>
      <li>...y así sucesivamente</li>
    </ul>
    <h5>Visualización del bonus:</h5>
    <div style="display: flex; gap: 6px; flex-wrap: wrap; align-items: flex-end;">
      ${[0, 0, 2, 4, 6, 8, 10, 12, 14].map((bonus, i) => `
        <div style="text-align:center;">
          <div style="background:#2196f3; width:28px; height:${bonus * 4}px; margin:auto; border-radius:4px;"></div>
          <small>${i} fechas</small>
        </div>
      `).join("")}
    </div>
    <h4 style="margin-top:1.5rem;">Ejemplos</h4>
    <ul>
      <li><b>Ana González</b> participó 3 fechas seguidas y salió 2°, 1° y 3° → <b>10 + 12 (+2) + 9 (+4)</b> = 37 pts</li>
      <li><b>Lucas Pérez</b> participó solo una vez y quedó 4° → <b>8 pts</b></li>
      <li><b>Valeria Díaz</b> faltó dos veces y luego ganó una carrera → <b>12 pts, sin bonus</b></li>
    </ul>
  </div>
`;

// Función para mostrar mensajes
function mostrarMensaje(mensaje, tipo = 'info') {
    let mensajeElement = document.getElementById('mensaje');
    
    // Si no existe el div, lo creamos
    if (!mensajeElement) {
        mensajeElement = document.createElement('div');
        mensajeElement.id = 'mensaje';
        const container = document.querySelector('.container');
        if (container) {
            container.insertBefore(mensajeElement, container.firstChild);
        }
    }

    mensajeElement.className = `mensaje mensaje-${tipo}`;
    mensajeElement.textContent = mensaje;
}

async function verificarAdmin(uid) {
    try {
        console.log("Verificando admin para UID:", uid);
        const usuarioRef = doc(db, "usuarios", uid);
        const usuarioDoc = await getDoc(usuarioRef);
        
        if (!usuarioDoc.exists()) {
            console.log("Usuario no encontrado en la colección usuarios");
            return false;
        }
        
        const userData = usuarioDoc.data();
        console.log("Datos del usuario:", userData);
        
        return userData.isAdmin === true;
    } catch (error) {
        console.error("Error al verificar admin:", error);
        return false;
    }
}

// Refresca el objeto usuario si falta el campo dni
async function refrescarUsuarioSiFaltaDNI() {
    let usuario = JSON.parse(sessionStorage.getItem('usuario'));
    if (usuario && (!usuario.dni || usuario.dni === "")) {
        // Buscar en atletas por uid
        const atletasQuery = query(
            collection(db, "atletas"),
            where("uid", "==", usuario.uid)
        );
        const querySnapshot = await getDocs(atletasQuery);
        if (!querySnapshot.empty) {
            const atletaData = querySnapshot.docs[0].data();
            // Actualiza el objeto usuario en sessionStorage
            usuario = {
                ...usuario,
                dni: atletaData.dni,
                nombre: atletaData.nombre,
                apellido: atletaData.apellido,
                photo: atletaData.photoURL || atletaData.photo
            };
            sessionStorage.setItem('usuario', JSON.stringify(usuario));
        }
    }
}

// Login con Google
googleBtn.addEventListener('click', async () => {
    try {
        mostrarMensaje('Iniciando sesión con Google...');
        const result = await signInWithPopup(auth, provider);
        const user = result.user;
        
        console.log("Usuario logueado:", user.uid);
        
        // Verificar admin PRIMERO
        const isAdmin = await verificarAdmin(user.uid);
        console.log("¿Es admin?:", isAdmin);
        
        if (isAdmin) {
            // Obtener datos completos del usuario de Firestore
            const usuarioRef = doc(db, "usuarios", user.uid);
            const usuarioDoc = await getDoc(usuarioRef);
            const usuarioData = usuarioDoc.data();
            
            const userData = {
                uid: user.uid,
                email: usuarioData.email,
                nombre: usuarioData.nombre,
                photo: usuarioData.photoURL,
                isAdmin: true,
                fechaRegistro: usuarioData.fechaRegistro
            };
            
            console.log("Guardando datos de admin:", userData);
            sessionStorage.setItem('usuario', JSON.stringify(userData));
            mostrarMensaje('Acceso de administrador confirmado');
            window.location.href = 'admin.html';
            return;
        }

        // Si no es admin, continuar con el flujo normal de atletas
        const atletasQuery = query(
            collection(db, "atletas"), 
            where("uid", "==", user.uid)
        );
        const querySnapshot = await getDocs(atletasQuery);

        if (querySnapshot.empty) {
            mostrarMensaje('Usuario nuevo detectado');
            const tempUserData = {
                email: user.email,
                nombre: user.displayName,
                photoURL: user.photoURL,
                uid: user.uid
            };
            sessionStorage.setItem('tempUserData', JSON.stringify(tempUserData));
            mostrarMensaje('Preparando registro complementario...');
            setTimeout(() => {
                window.location.href = 'registration.html';
            }, 2000);
            return;
        }

        // Usuario existente
        const atletaData = querySnapshot.docs[0].data();
        const userData = {
            uid: user.uid,
            email: user.email,
            nombre: atletaData.nombre,
            apellido: atletaData.apellido,
            dni: atletaData.dni,
            photo: user.photoURL,
            isAdmin: false
        };
        sessionStorage.setItem('usuario', JSON.stringify(userData));
        actualizarUI(userData);
        mostrarMensaje('¡Bienvenido de nuevo!');
        // NO redirigir automáticamente

    } catch (error) {
        console.error('Error en login:', error);
        mostrarMensaje('Error al iniciar sesión: ' + error.message, 'error');
    }
});

// Actualizar interfaz de usuario
async function actualizarUI(userData) {
    const mainHeader = document.getElementById('main-header');
    const userInfo = document.getElementById('user-info');
    const userName = document.getElementById('user-name');
    const userPhoto = document.getElementById('user-photo');
    const loginContainer = document.getElementById('login-container');
    const verPerfilBtn = document.getElementById('ver-perfil-btn');
    const headerPuntos = document.getElementById('header-puntos');
    const headerBonus = document.getElementById('header-bonus');

    if (userData) {
        if (mainHeader) mainHeader.style.display = 'block';
        if (userInfo) userInfo.style.display = 'block';
        if (userName) userName.textContent = userData.nombre + (userData.apellido ? ' ' + userData.apellido : '');
        if (userPhoto && userData.photo) {
            userPhoto.src = userData.photo;
            userPhoto.style.display = 'block';
        }
        if (loginContainer) loginContainer.style.display = 'none';
        if (verPerfilBtn) verPerfilBtn.style.display = 'flex';

        // Cargar puntos y bonus del usuario desde Firestore
        if (headerPuntos && headerBonus && userData.dni) {
            try {
                const atletaRef = doc(db, "atletas", userData.dni.toString());
                const atletaDoc = await getDoc(atletaRef);
                let puntosTotales = 0;
                let puntosBonus = 0;
                if (atletaDoc.exists() && Array.isArray(atletaDoc.data().historial)) {
                    atletaDoc.data().historial.forEach(item => {
                        if (!isNaN(Number(item.puntos)) && item.puntos !== "-") {
                            puntosTotales += Number(item.puntos);
                        }
                        if (!isNaN(Number(item.bonus)) && item.bonus > 0) {
                            puntosBonus += Number(item.bonus);
                        }
                    });
                }
                headerPuntos.textContent = puntosTotales;
                headerBonus.textContent = puntosBonus;
            } catch (e) {
                headerPuntos.textContent = '0';
                headerBonus.textContent = '0';
            }
        }

        if (btnInfoPuntos && panelPuntos) {
            btnInfoPuntos.style.display = 'block';
            btnInfoPuntos.textContent = 'ℹ️ Ver cómo se otorgan los puntos';
            btnInfoPuntos.addEventListener('click', function() {
                if (panelPuntos.style.display === 'block') {
                    panelPuntos.style.display = 'none';
                    btnInfoPuntos.textContent = 'ℹ️ Ver cómo se otorgan los puntos';
                } else {
            panelPuntos.innerHTML = panelHTML;
                    panelPuntos.style.display = 'block';
                    btnInfoPuntos.textContent = '🔽 Ocultar explicación';
                    // Scroll al panel si es mobile
                    if (window.innerWidth < 700) {
                        setTimeout(() => {
                            panelPuntos.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        }, 100);
                    }
                }
            });
        }

        // Mostrar el botón de admin solo si el usuario es admin
        const adminBtn = document.getElementById('admin-btn');
        if (adminBtn) {
            if (userData.isAdmin) {
                adminBtn.style.display = 'inline-flex';
            } else {
                adminBtn.style.display = 'none';
            }
        }
    } else {
        if (mainHeader) mainHeader.style.display = 'none';
        if (userInfo) userInfo.style.display = 'none';
        if (loginContainer) loginContainer.style.display = 'block';
        if (verPerfilBtn) verPerfilBtn.style.display = 'none';
        if (headerPuntos) headerPuntos.textContent = '0';
        if (headerBonus) headerBonus.textContent = '0';

        if (btnInfoPuntos && panelPuntos) {
            btnInfoPuntos.style.display = 'none';
            panelPuntos.style.display = 'none';
        }

        // Mostrar el botón de admin solo si el usuario es admin
        const adminBtn = document.getElementById('admin-btn');
        if (adminBtn) {
            adminBtn.style.display = 'none';
        }
    }
}

// Cerrar sesión
logoutBtn?.addEventListener('click', async () => {
    try {
        await signOut(auth);
        sessionStorage.clear();
        mostrarMensaje('Sesión cerrada correctamente');
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 1000);
    } catch (error) {
        console.error('Error en logout:', error);
        mostrarMensaje('Error al cerrar sesión: ' + error.message, 'error');
    }
});

// Verificar sesión al cargar la página
document.addEventListener('DOMContentLoaded', async () => {
    await refrescarUsuarioSiFaltaDNI();
    const usuario = JSON.parse(sessionStorage.getItem('usuario'));
    if (usuario) {
        actualizarUI(usuario);
    }
});
