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
// 🔥 PROCESAR RESULTADOS Y ACTUALIZAR RANKING 🔥
// =========================
async function procesarResultados(results) {
    const uploadMessage = document.getElementById("upload-message");

    if (results.length < 2) {
        uploadMessage.textContent = "El archivo no tiene datos válidos.";
        return;
    }

    const puntos = [12, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1];

    for (let i = 1; i < results.length; i++) {
        const [posicion, dni] = results[i];

        if (!dni || isNaN(dni)) continue;

        const atletaRef = doc(db, "atletas", dni);
        const atletaSnap = await getDoc(atletaRef);

        if (!atletaSnap.exists()) continue;

        let atleta = atletaSnap.data();
        let nuevoPuntaje = puntos[posicion - 1] || 1;

        let historial = atleta.historial || [];
        let asistencias = (atleta.asistencias || 0) + 1;
        let faltas = (atleta.faltas || 0);
        let totalPuntos = (atleta.puntos || 0) + nuevoPuntaje;

        historial.push({ posicion, puntos: nuevoPuntaje });

        await updateDoc(atletaRef, {
            puntos: totalPuntos,
            asistencias: asistencias,
            faltas: faltas,
            historial: historial
        });
    }

    uploadMessage.textContent = "Resultados cargados correctamente.";
    actualizarRanking();
}

// =========================
// 🔥 ACTUALIZAR TABLA DE RANKING 🔥
// =========================
async function actualizarRanking() {
    const rankingTable = document.getElementById("ranking-table");
    rankingTable.innerHTML = "";

    const atletasRef = collection(db, "atletas");
    const snapshot = await getDocs(atletasRef);
    let atletas = [];

    snapshot.forEach(doc => {
        let data = doc.data();
        if (data.puntos > 0) {
            atletas.push({
                nombre: `${data.nombre} ${data.apellido}`,
                localidad: data.localidad || "Desconocida",
                puntos: data.puntos || 0,
                asistencias: data.asistencias || 0,
                faltas: data.faltas || 0,
                historial: data.historial || []
            });
        }
    });

    atletas.sort((a, b) => b.puntos - a.puntos);

    atletas.forEach((atleta, index) => {
        const row = document.createElement("tr");
        row.innerHTML = `
            <td>${index + 1}</td>
            <td>${atleta.nombre}</td>
            <td>${atleta.localidad}</td>
            <td>${atleta.puntos}</td>
            <td>${atleta.asistencias}</td>
            <td>${atleta.faltas}</td>
            <td>${atleta.historial.map(h => `#${h.posicion} (${h.puntos} pts)`).join(", ")}</td>
        `;
        rankingTable.appendChild(row);
    });
}

// Llamar a la función para cargar el ranking al abrir la página
document.addEventListener("DOMContentLoaded", actualizarRanking);
