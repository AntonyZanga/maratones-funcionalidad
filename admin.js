// Importar servicios desde config.js
import { db } from './config.js';
import { collection, getDocs, doc, setDoc, updateDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// =========================
// 🔥 VERIFICACIÓN DE ADMINISTRADOR 🔥
// =========================
document.addEventListener("DOMContentLoaded", () => {
    const usuario = JSON.parse(sessionStorage.getItem("usuario"));

    if (!usuario || usuario.dni !== "99999999") {
        alert("Acceso denegado. Debes ser administrador.");
        window.location.href = "index.html";
    }

    actualizarRanking();
});

// =========================
// 🔥 CIERRE DE SESIÓN 🔥
// =========================
document.getElementById("logout").addEventListener("click", () => {
    localStorage.removeItem("usuario");
    sessionStorage.clear();
    window.location.href = "index.html";
});

// =========================
// 🔥 CARGA DE RESULTADOS DESDE EXCEL 🔥
// =========================
document.getElementById("upload-results").addEventListener("click", async () => {
    const fileInput = document.getElementById("file-input");
    const uploadMessage = document.getElementById("upload-message");
    
    if (fileInput.files.length === 0) {
        uploadMessage.textContent = "Selecciona un archivo Excel.";
        return;
    }

    deshabilitarInterfaz(true);
    uploadMessage.textContent = "⏳ Procesando resultados...";

    try {
        const file = fileInput.files[0];
        const data = new Uint8Array(await file.arrayBuffer());
        const workbook = XLSX.read(data, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const results = XLSX.utils.sheet_to_json(sheet, { header: 1 });

        await procesarResultados(results);
        uploadMessage.textContent = "✅ Resultados cargados correctamente.";
    } catch (error) {
        console.error("Error al procesar el archivo:", error);
        uploadMessage.textContent = "❌ Error al procesar los resultados.";
    } finally {
        deshabilitarInterfaz(false);
    }
});
function deshabilitarInterfaz(deshabilitar) {
    const elementos = document.querySelectorAll("button, input, select, textarea");

    elementos.forEach(elemento => {
        elemento.disabled = deshabilitar;
    });
}

// =========================
// 🔥 OBTENER CATEGORÍA SEGÚN EDAD Y GÉNERO 🔥
// =========================
function obtenerCategoria(fechaNacimiento, genero) {
    let edad = calcularEdad(fechaNacimiento);
    let categoriaEdad = determinarCategoriaEdad(edad);
    return `${genero} - ${categoriaEdad}`;
}

// =========================
// 🔥 PROCESAR RESULTADOS Y ACTUALIZAR RANKING 🔥
// =========================
async function procesarResultados(results) {
    const uploadMessage = document.getElementById("upload-message");

    if (results.length < 2) {
        uploadMessage.textContent = "El archivo no tiene datos válidos.";
        return;
    }

    const puntosBase = [12, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1];
    let atletasMap = new Map();
    let batchUpdates = [];

    // 🔹 Obtener datos actuales de los atletas
    const snapshot = await getDocs(collection(db, "atletas"));
    snapshot.forEach((docSnap) => {
        atletasMap.set(docSnap.id, docSnap.data());
    });

    let atletasParticipantes = new Set();
    for (let i = 1; i < results.length; i++) {
        const [posicion, dni] = results[i];
        if (!dni || isNaN(dni)) continue;

        let dniStr = String(dni).trim();
        atletasParticipantes.add(dniStr);

        let atleta = atletasMap.get(dniStr);
        if (!atleta) continue;

        let categoria = obtenerCategoria(atleta.fechaNacimiento, atleta.categoria);
        let nuevoPuntaje = puntosBase[i] !== undefined ? puntosBase[i] : 1;

        let historial = atleta.historial || [];
        let asistencias = (atleta.asistencias || 0) + 1;
        let asistenciasConsecutivas = (atleta.asistenciasConsecutivas || 0) + 1;
        let totalPuntos = (atleta.puntos || 0) + nuevoPuntaje;
        let bonus = calcularBonus(asistenciasConsecutivas);

        historial.push({ posicion: i + 1, puntos: nuevoPuntaje });

        let atletaRef = doc(db, "atletas", dniStr);
        batchUpdates.push(updateDoc(atletaRef, {
            puntos: totalPuntos + bonus,
            asistencias,
            asistenciasConsecutivas,
            historial
        }));
    }

    // 🔹 Marcar faltas para quienes no participaron
    snapshot.forEach((docSnap) => {
        let dni = docSnap.id;
        if (!atletasParticipantes.has(dni)) {
            let atleta = docSnap.data();
            let historial = atleta.historial || [];
            historial.push({ posicion: "-", puntos: "-" });

            batchUpdates.push(updateDoc(doc(db, "atletas", dni), {
                faltas: (atleta.faltas || 0) + 1,
                asistenciasConsecutivas: 0,
                historial
            }));
        }
    });

    await Promise.all(batchUpdates);
    await actualizarRanking();
}
// =========================
// 🔥 CÁLCULO DE BONOS POR ASISTENCIA 🔥
// =========================
function calcularBonus(asistencias) {
    const bonus = [0, 0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 25, 30]; // Máx. 30 puntos extra
    return bonus[Math.min(asistencias, bonus.length - 1)];
}

// =========================
// 🔥 ACTUALIZAR TABLA DE RANKING 🔥
// =========================
async function actualizarRanking() {
    const rankingContainer = document.getElementById("ranking-container");
    rankingContainer.innerHTML = "";

    const snapshot = await getDocs(collection(db, "atletas"));
    let atletasPorCategoria = {};
    let totalFechas = 0;

    snapshot.forEach(doc => {
        let data = doc.data();
        if (!data.historial || data.historial.every(fecha => fecha.posicion === "-")) return;

        let categoria = obtenerCategoria(data.fechaNacimiento, data.categoria);
        if (!atletasPorCategoria[categoria]) atletasPorCategoria[categoria] = [];

        totalFechas = Math.max(totalFechas, data.historial.length);

        atletasPorCategoria[categoria].push({
            nombre: `${data.nombre} ${data.apellido}`,
            localidad: data.localidad || "Desconocida",
            puntos: data.puntos || 0,
            asistencias: data.asistencias || 0,
            faltas: data.faltas || 0,
            historial: data.historial || []
        });
    });

    Object.keys(atletasPorCategoria).sort().forEach(categoria => {
        let atletas = atletasPorCategoria[categoria].sort((a, b) => b.puntos - a.puntos);
        let section = document.createElement("section");
        let title = document.createElement("h3");
        title.textContent = categoria;
        section.appendChild(title);

        let table = document.createElement("table");
        let thead = `<thead><tr><th>P°</th><th>Nombre</th><th>Localidad</th><th>Pts</th><th>Asis</th><th>Falt</th>`;
        for (let i = 1; i <= totalFechas; i++) thead += `<th>P°</th><th>Pts</th>`;
        table.innerHTML = thead + `</tr></thead><tbody></tbody>`;
        section.appendChild(table);
        rankingContainer.appendChild(section);

        let tbody = table.querySelector("tbody");
        atletas.forEach((atleta, index) => {
            let row = `<td>${index + 1}</td><td>${atleta.nombre}</td><td>${atleta.localidad}</td><td>${atleta.puntos}</td><td>${atleta.asistencias}</td><td>${atleta.faltas}</td>`;
            atleta.historial.forEach(fecha => row += `<td>${fecha.posicion}</td><td>${fecha.puntos}</td>`);
            tbody.innerHTML += `<tr>${row}</tr>`;
        });
    });
}
// =========================
// 🔥 Resetear Historial 🔥
// =========================

document.getElementById("reset-history").addEventListener("click", async () => {
    const confirmReset = confirm("⚠️ ¿Estás seguro de que quieres reiniciar el historial de todos los atletas? Esta acción no se puede deshacer.");
    
    if (!confirmReset) return;

    try {
        const atletasRef = collection(db, "atletas");
        const snapshot = await getDocs(atletasRef);

        let batchUpdates = [];

        snapshot.forEach((docSnap) => {
            const atletaRef = doc(db, "atletas", docSnap.id);
            batchUpdates.push(updateDoc(atletaRef, {
                historial: [],
                puntos: 0,
                asistencias: 0,
                faltas: 0,
                asistenciasConsecutivas: 0
            }));
        });

        await Promise.all(batchUpdates);

        alert("✅ Historial reseteado correctamente.");
        actualizarRanking();
    } catch (error) {
        console.error("❌ Error al resetear el historial:", error);
        alert("❌ Ocurrió un error al resetear el historial. Revisa la consola para más detalles.");
    }
});

// =========================
// 🔥 FUNCIONES AUXILIARES 🔥
// =========================
function calcularEdad(fechaNacimiento) {
    let fechaNac = new Date(fechaNacimiento);
    let hoy = new Date();
    let edad = hoy.getFullYear() - fechaNac.getFullYear();
    return edad;
}

function determinarCategoriaEdad(edad) {
    const categorias = [
        [0, 19], [20, 24], [25, 29], [30, 34], [35, 39], [40, 44],
        [45, 49], [50, 54], [55, 59], [60, 64], [65, 69], [70, 74],
        [75, 79], [80, 84], [85, 89]
    ];
    for (let [min, max] of categorias) {
        if (edad >= min && edad <= max) return `${min} - ${max}`;
    }
    return "90+";
}
