import { db } from './config.js';
import { collection, getDocs, doc, setDoc, updateDoc, getDoc, writeBatch, query, where } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

document.addEventListener("DOMContentLoaded", () => {
    const usuario = JSON.parse(sessionStorage.getItem("usuario"));
    if (!usuario || usuario.dni !== "99999999") {
        alert("Acceso denegado. Debes ser administrador.");
        window.location.href = "index.html";
    }
    actualizarRanking();
});

document.getElementById("logout").addEventListener("click", () => {
    sessionStorage.removeItem("usuario");
    window.location.href = "index.html";
});

document.getElementById("upload-results").addEventListener("click", async () => {
    const fileInput = document.getElementById("file-input");
    const uploadMessage = document.getElementById("upload-message");

    if (fileInput.files.length === 0) {
        uploadMessage.textContent = "Selecciona un archivo Excel.";
        return;
    }

    deshabilitarInterfaz(true);
    uploadMessage.textContent = "⏳ Procesando resultados...";

    const file = fileInput.files[0];
    const reader = new FileReader();

    reader.onload = async function (event) {
        try {
            const data = new Uint8Array(event.target.result);
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
    };

    reader.readAsArrayBuffer(file);
});

function deshabilitarInterfaz(deshabilitar) {
    document.querySelectorAll("button, input, select, textarea").forEach(elemento => {
        elemento.disabled = deshabilitar;
    });
}

function obtenerCategoria(fechaNacimiento, genero) {
    let edad = calcularEdad(fechaNacimiento);
    return `${genero} - ${determinarCategoriaEdad(edad)}`;
}

async function procesarResultados(results) {
    if (results.length < 2) return;

    const batch = writeBatch(db);
    const puntosBase = [12, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1];
    let atletasParticipantes = new Set();

    for (let i = 1; i < results.length; i++) {
        const [posicion, dni] = results[i];
        if (!dni || isNaN(dni)) continue;

        atletasParticipantes.add(String(dni).trim());

        const atletaRef = doc(db, "atletas", String(dni).trim());
        const atletaSnap = await getDoc(atletaRef);
        if (!atletaSnap.exists()) continue;

        let atleta = atletaSnap.data();
        let nuevoPuntaje = puntosBase[i] ?? 1;

        let historial = atleta.historial || [];
        historial.push({ posicion: i + 1, puntos: nuevoPuntaje });

        let asistencias = (atleta.asistencias || 0) + 1;
        let asistenciasConsecutivas = (atleta.asistenciasConsecutivas || 0) + 1;
        let totalPuntos = (atleta.puntos || 0) + nuevoPuntaje + calcularBonus(asistenciasConsecutivas);

        batch.update(atletaRef, {
            puntos: totalPuntos,
            asistencias,
            asistenciasConsecutivas,
            historial
        });
    }

    const atletasRef = query(collection(db, "atletas"), where("historial", "!=", []));
    const snapshot = await getDocs(atletasRef);

    snapshot.forEach((docSnap) => {
        let dni = docSnap.id;
        if (!atletasParticipantes.has(dni)) {
            let atletaRef = doc(db, "atletas", dni);
            let atleta = docSnap.data();

            let historial = atleta.historial || [];
            historial.push({ posicion: "-", puntos: "-" });

            batch.update(atletaRef, {
                faltas: (atleta.faltas || 0) + 1,
                asistenciasConsecutivas: 0,
                historial
            });
        }
    });

    await batch.commit();
    actualizarRanking();
}

function calcularBonus(asistencias) {
    const bonus = [0, 0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 25, 30];
    return bonus[Math.min(asistencias, bonus.length - 1)];
}

async function actualizarRanking() {
    const rankingContainer = document.getElementById("ranking-container");
    rankingContainer.innerHTML = "";

    const atletasRef = query(collection(db, "atletas"), where("historial", "!=", []));
    const snapshot = await getDocs(atletasRef);
    let atletasPorCategoria = {};

    snapshot.forEach(doc => {
        let data = doc.data();
        let categoria = obtenerCategoria(data.fechaNacimiento, data.categoria);

        if (!atletasPorCategoria[categoria]) atletasPorCategoria[categoria] = [];
        atletasPorCategoria[categoria].push(data);
    });

    Object.keys(atletasPorCategoria).sort().forEach(categoria => {
        let section = document.createElement("section");
        let title = document.createElement("h3");
        title.textContent = categoria;
        section.appendChild(title);

        let table = document.createElement("table");
        let thead = document.createElement("thead");
        let tbody = document.createElement("tbody");

        thead.innerHTML = `
            <tr><th>P°</th><th>Nombre</th><th>Localidad</th><th>Pts</th><th>Asis</th><th>Falt</th></tr>`;
        table.appendChild(thead);
        table.appendChild(tbody);
        section.appendChild(table);
        rankingContainer.appendChild(section);

        atletasPorCategoria[categoria]
            .sort((a, b) => b.puntos - a.puntos)
            .forEach((atleta, index) => {
                let row = document.createElement("tr");
                row.innerHTML = `
                    <td>${index + 1}</td>
                    <td>${atleta.nombre} ${atleta.apellido}</td>
                    <td>${atleta.localidad || "Desconocida"}</td>
                    <td>${atleta.puntos}</td>
                    <td>${atleta.asistencias}</td>
                    <td>${atleta.faltas}</td>`;
                tbody.appendChild(row);
            });
    });
}

document.getElementById("reset-history").addEventListener("click", async () => {
    if (!confirm("⚠️ ¿Reiniciar historial de todos los atletas?")) return;

    const batch = writeBatch(db);
    const atletasRef = collection(db, "atletas");
    const snapshot = await getDocs(atletasRef);

    snapshot.forEach((docSnap) => {
        batch.update(doc(db, "atletas", docSnap.id), {
            historial: [],
            puntos: 0,
            asistencias: 0,
            faltas: 0,
            asistenciasConsecutivas: 0
        });
    });

    await batch.commit();
    alert("✅ Historial reseteado correctamente.");
    actualizarRanking();
});

function calcularEdad(fechaNacimiento) {
    return new Date().getFullYear() - new Date(fechaNacimiento).getFullYear();
}

function determinarCategoriaEdad(edad) {
    return edad >= 90 ? "90+" : `${Math.floor(edad / 5) * 5} - ${Math.floor(edad / 5) * 5 + 4}`;
}
