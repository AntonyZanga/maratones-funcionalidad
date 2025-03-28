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

    const file = fileInput.files[0];
    const reader = new FileReader();

    reader.onload = async function (event) {
        const data = new Uint8Array(event.target.result);
        const workbook = XLSX.read(data, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const results = XLSX.utils.sheet_to_json(sheet, { header: 1 });

        await procesarResultados(results);
    };

    reader.readAsArrayBuffer(file);
});

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
    let categorias = {};

    for (let i = 1; i < results.length; i++) {
        const [posicion, dni] = results[i];

        if (!dni || isNaN(dni)) continue;

        const atletaRef = doc(db, "atletas", String(dni).trim());
        const atletaSnap = await getDoc(atletaRef);

        if (!atletaSnap.exists()) continue;

        let atleta = atletaSnap.data();
        let categoria = obtenerCategoria(atleta.fechaNacimiento, atleta.categoria);

        if (!categorias[categoria]) {
            categorias[categoria] = [];
        }

        categorias[categoria].push({ dni, posicion, atletaRef, atleta });
    }

    for (let categoria in categorias) {
        let atletasCategoria = categorias[categoria];

        atletasCategoria.sort((a, b) => a.posicion - b.posicion);

        for (let i = 0; i < atletasCategoria.length; i++) {
            let { dni, posicion, atletaRef, atleta } = atletasCategoria[i];

            let nuevoPuntaje = puntosBase[i] !== undefined ? puntosBase[i] : 1;

            let historial = atleta.historial || [];
            let asistencias = (atleta.asistencias || 0) + 1;
            let faltas = atleta.faltas || 0;
            let totalPuntos = (atleta.puntos || 0) + nuevoPuntaje;

            historial.push({ posicion, puntos: nuevoPuntaje });

            let bonus = calcularBonus(asistencias);

            await updateDoc(atletaRef, {
                puntos: totalPuntos + bonus,
                asistencias: asistencias,
                faltas: faltas,
                historial: historial
            });
        }
    }

    uploadMessage.textContent = "Resultados cargados correctamente.";
    actualizarRanking();
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

    const atletasRef = collection(db, "atletas");
    const snapshot = await getDocs(atletasRef);
    let atletas = [];

    snapshot.forEach(doc => {
        let data = doc.data();
        if (data.puntos > 0) {
            let edad = calcularEdad(data.fechaNacimiento);
            let categoriaEdad = determinarCategoriaEdad(edad);
            let categoria = data.categoria || "Especial";

            atletas.push({
                nombre: `${data.nombre} ${data.apellido}`,
                localidad: data.localidad || "Desconocida",
                puntos: data.puntos || 0,
                asistencias: data.asistencias || 0,
                faltas: data.faltas || 0,
                historial: data.historial || [],
                categoria: `${categoria} - ${categoriaEdad}`,
                edad: edad
            });
        }
    });

    atletas.sort((a, b) => {
        if (a.categoria === b.categoria) {
            return b.puntos - a.puntos;
        }
        return a.categoria.localeCompare(b.categoria);
    });

    let categoriaActual = "";
    let table = null;
    let posicionCategoria = 0;

    atletas.forEach((atleta, index) => {
        if (atleta.categoria !== categoriaActual) {
            if (table) rankingContainer.appendChild(table);

            categoriaActual = atleta.categoria;
            posicionCategoria = 0; // Reiniciar la posición para la nueva categoría

            let section = document.createElement("section");
            let title = document.createElement("h3");
            title.textContent = categoriaActual;
            section.appendChild(title);

            table = document.createElement("table");
            table.innerHTML = `
                <thead>
                    <tr>
                        <th>P°</th>
                        <th>Nombre</th>
                        <th>Localidad</th>
                        <th>Pts</th>
                        <th>Asis</th>
                        <th>Falt</th>
                        <th>Historial</th>
                    </tr>
                </thead>
                <tbody></tbody>
            `;
            section.appendChild(table);
            rankingContainer.appendChild(section);
        }

        posicionCategoria++; // Incrementar la posición dentro de la categoría

        let row = document.createElement("tr");
        row.innerHTML = `
            <td>${posicionCategoria}</td> <!-- Aquí ahora muestra la posición relativa a la categoría -->
            <td>${atleta.nombre}</td>
            <td>${atleta.localidad}</td>
            <td>${atleta.puntos}</td>
            <td>${atleta.asistencias}</td>
            <td>${atleta.faltas}</td>
            <td>${atleta.historial.map(h => #${h.posicion} (${h.puntos} pts)).join(", ")}</td>
        `;
        table.querySelector("tbody").appendChild(row);
    });

    if (table) rankingContainer.appendChild(table);
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
                faltas: 0
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
