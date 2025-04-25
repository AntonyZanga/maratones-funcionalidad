// Importar las funciones necesarias de los SDKs de Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, enableIndexedDbPersistence } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { getAuth, setPersistence, browserLocalPersistence } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-storage.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

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

// Inicializar servicios de Firebase
const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app);

// Configurar persistencia de Firestore
enableIndexedDbPersistence(db).catch((err) => {
    if (err.code === 'failed-precondition') {
        // Múltiples pestañas abiertas, persistencia solo puede habilitarse en una pestaña a la vez
        console.warn('Persistencia fallida: Múltiples pestañas abiertas');
    } else if (err.code === 'unimplemented') {
        // El navegador no soporta persistencia
        console.warn('Persistencia no soportada por el navegador');
    }
});

// Configurar persistencia de autenticación
setPersistence(auth, browserLocalPersistence).catch((error) => {
    console.error('Error al configurar persistencia de autenticación:', error);
});

// Configurar caché de Firestore
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutos
const cache = new Map();

// Función para obtener datos con caché
async function getCachedData(collection, document) {
    const cacheKey = `${collection}/${document}`;
    const cached = cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
        return cached.data;
    }
    
    const docRef = doc(db, collection, document);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
        const data = docSnap.data();
        cache.set(cacheKey, {
            data,
            timestamp: Date.now()
        });
        return data;
    }
    
    return null;
}

// Función para limpiar caché
function clearCache() {
    cache.clear();
}

// Exportar los servicios y funciones para usarlos en otros archivos
export { 
    db, 
    auth, 
    storage,
    getCachedData,
    clearCache
};
