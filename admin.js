// Importar servicios desde config.js
import { db } from './config.js';
import { collection, getDocs, doc, setDoc, updateDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

if (typeof XLSX === "undefined") {
    console.error("❌ Error: La librería XLSX no está definida. Verifica que esté cargada en admin.html.");
} else {
    console.log("✅ XLSX cargado correctamente.");
}

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
// 🔥 CÁLCULO DE BONOS POR CARRERAS CONSECUTIVAS 🔥
// =========================
function calcularBonus(historial) {
    let consecutivas = 0;
    let bonus = 0;
    let bonusArray = [0, 2, 6, 12, 20, 30]; // Bonus acumulativos

    // Contar carreras consecutivas desde el final hacia atrás
    for (let i = historial.length - 1; i >= 0; i--) {
        if (historial[i].faltas) break; // Si faltó a una, se corta la racha
        consecutivas++;
    }

    if (consecutivas > 1 && consecutivas <= 6) {
        bonus = bonusArray[consecutivas - 1];
    } else if (consecutivas > 6) {
        bonus = 30; // Máximo 30 puntos extra
    }

    return bonus;
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

    let categorias = {}; // Objeto para clasificar atletas por categoría

    // Organizar atletas en sus categorías correspondientes
    for (let i = 1; i < results.length; i++) {
        const [posicion, dni, fechaMaraton] = results[i];

        if (!dni || isNaN(dni) || !fechaMaraton) continue;

        const atletaRef = doc(db, "atletas", String(dni).trim());
        const atletaSnap = await getDoc(atletaRef);

        if (!atletaSnap.exists()) continue;

        let atleta = atletaSnap.data();
        let categoria = obtenerCategoria(atleta.fechaNacimiento, atleta.genero);

        if (!categorias[categoria]) {
            categorias[categoria] = [];
        }
        categorias[categoria].push({ dni, posicion });
    }

    // Calcular puntos y actualizar datos en la base
    for (let categoria in categorias) {
        categorias[categoria].sort((a, b) => a.posicion - b.posicion); // Ordenar por posición

        for (let i = 0; i < categorias[categoria].length; i++) {
            let { dni, posicion } = categorias[categoria][i];
            let atletaRef = doc(db, "atletas", String(dni).trim());
            let atletaSnap = await getDoc(atletaRef);
            let atleta = atletaSnap.data();

            let nuevoPuntaje = (12 - i) + (atleta.puntos || 0); // Puntos según la posición
            let historial = atleta.historial || [];
            let asistencias = (atleta.asistencias || 0) + 1;
            let faltas = atleta.faltas || 0;
            
            historial.push({ fechaMaraton, posicion, puntos: nuevoPuntaje });

            let bonus = calcularBonus(historial); // Calcular bonus por carreras consecutivas

            await updateDoc(atletaRef, {
                puntos: nuevoPuntaje + bonus,
                asistencias,
                faltas,
                historial
            });
        }
    }

    uploadMessage.textContent = "Resultados cargados correctamente.";
    actualizarRanking();
}

// =========================
// 🔥 ACTUALIZAR TABLA DE RANKING POR CATEGORÍA 🔥
// =========================
async function actualizarRanking() {
    const rankingContainer = document.getElementById("ranking-container");
    rankingContainer.innerHTML = "";

    const atletasRef = collection(db, "atletas");
    const snapshot = await getDocs(atletasRef);
    let categorias = {};

    snapshot.forEach(doc => {
        let data = doc.data();
        if (data.puntos > 0) {
            let categoria = obtenerCategoria(data.fechaNacimiento, data.genero);

            if (!categorias[categoria]) {
                categorias[categoria] = [];
            }

            categorias[categoria].push({
                nombre: `${data.nombre} ${data.apellido}`,
                localidad: data.localidad || "Desconocida",
                puntos: data.puntos || 0,
                asistencias: data.asistencias || 0,
                faltas: data.faltas || 0,
                historial: data.historial || []
            });
        }
    });

    // Mostrar ranking por categoría
    for (let categoria in categorias) {
        let section = document.createElement("section");
        let title = document.createElement("h3");
        title.textContent = categoria;
        section.appendChild(title);

        let table = document.createElement("table");
        table.innerHTML = `
            <thead>
                <tr>
                    <th>Puesto</th>
                    <th>Nombre</th>
                    <th>Localidad</th>
                    <th>Puntos</th>
                    <th>Asistencias</th>
                    <th>Faltas</th>
                    <th>Historial</th>
                </tr>
            </thead>
            <tbody></tbody>
        `;
        section.appendChild(table);
        rankingContainer.appendChild(section);

        categorias[categoria].sort((a, b) => b.puntos - a.puntos);

        let tbody = table.querySelector("tbody");
        categorias[categoria].forEach((atleta, index) => {
            let row = document.createElement("tr");
            row.innerHTML = `
                <td>${index + 1}</td>
                <td>${atleta.nombre}</td>
                <td>${atleta.localidad}</td>
                <td>${atleta.puntos}</td>
                <td>${atleta.asistencias}</td>
                <td>${atleta.faltas}</td>
                <td>${atleta.historial.map(h => `#${h.posicion} (${h.puntos} pts)`).join(", ")}</td>
            `;
            tbody.appendChild(row);
        });
    }
}

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
