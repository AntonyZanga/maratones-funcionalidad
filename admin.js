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

    // 🔹 Deshabilitar TODOS los botones y entradas
    deshabilitarInterfaz(true);
    uploadMessage.textContent = "⏳ Procesando resultados... Por favor, espera.";

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
            // 🔹 Habilitar nuevamente la interfaz
            deshabilitarInterfaz(false);
        }
    };

    reader.readAsArrayBuffer(file);
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
async function procesarArchivoExcel(file, fechaMaraton) {
    const reader = new FileReader();
    reader.onload = async function (e) {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

        if (rows.length < 2) {
            alert("El archivo Excel debe contener al menos dos filas (encabezado y datos).");
            return;
        }

        const fechaId = `Fecha_${fechaMaraton}`;
        const atletasRef = collection(db, "atletas");
        const snapshot = await getDocs(atletasRef);

        let atletasData = {};
        let maxFechas = 0;

        // 1️⃣ Leer todos los atletas actuales y contar el total de fechas
        snapshot.forEach(doc => {
            let data = doc.data();
            let historial = data.historial || [];
            atletasData[data.dni] = {
                ref: doc.ref,
                nombre: data.nombre,
                apellido: data.apellido,
                historial: historial
            };
            maxFechas = Math.max(maxFechas, historial.length);
        });

        // 2️⃣ Procesar el archivo Excel y actualizar Firestore
        let updates = [];
        rows.slice(1).forEach(([posicion, dni], index) => {
            if (!dni) return;

            let puntos = calcularPuntos(posicion);
            let atleta = atletasData[dni];

            if (!atleta) {
                // Si el atleta no está en la BD, crearlo con faltas previas
                let historial = Array(maxFechas).fill({ posicion: "-", puntos: "-" });
                historial.push({ posicion, puntos });

                updates.push(setDoc(doc(atletasRef, dni), {
                    dni,
                    nombre: "Desconocido",
                    apellido: "Desconocido",
                    historial: historial,
                    puntos: puntos,
                    asistencias: 1,
                    faltas: maxFechas
                }, { merge: true }));
            } else {
                // Si ya existía, asegurarse de que el historial tenga el tamaño correcto
                while (atleta.historial.length < maxFechas) {
                    atleta.historial.push({ posicion: "-", puntos: "-" });
                }
                atleta.historial.push({ posicion, puntos });

                updates.push(updateDoc(atleta.ref, {
                    historial: atleta.historial,
                    puntos: (atleta.puntos || 0) + puntos,
                    asistencias: (atleta.asistencias || 0) + 1
                }));
            }
        });

        // 3️⃣ Marcar faltas para atletas que no participaron en esta fecha
        Object.values(atletasData).forEach(atleta => {
            if (atleta.historial.length < maxFechas + 1) {
                atleta.historial.push({ posicion: "-", puntos: "-" });

                updates.push(updateDoc(atleta.ref, {
                    historial: atleta.historial,
                    faltas: (atleta.faltas || 0) + 1
                }));
            }
        });

        await Promise.all(updates);
        alert("Ranking actualizado correctamente.");
        actualizarRanking();
    };

    reader.readAsArrayBuffer(file);
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
    let atletasPorCategoria = {};
    let totalFechas = 0;

    // 1. Obtener atletas y registrar la cantidad total de fechas
    snapshot.forEach(doc => {
        let data = doc.data();
        let edad = calcularEdad(data.fechaNacimiento);
        let categoriaEdad = determinarCategoriaEdad(edad);
        let categoria = data.categoria || "Especial";
        let categoriaCompleta = `${categoria} - ${categoriaEdad}`;

        if (!atletasPorCategoria[categoriaCompleta]) {
            atletasPorCategoria[categoriaCompleta] = [];
        }

        totalFechas = Math.max(totalFechas, data.historial.length);

        atletasPorCategoria[categoriaCompleta].push({
            nombre: `${data.nombre} ${data.apellido}`,
            localidad: data.localidad || "Desconocida",
            puntos: data.puntos || 0,
            asistencias: data.asistencias || 0,
            faltas: data.faltas || 0,
            historial: data.historial || []
        });
    });

    // 2. Asegurar que todos los atletas tengan la misma cantidad de fechas
    Object.keys(atletasPorCategoria).forEach(categoria => {
        atletasPorCategoria[categoria].forEach(atleta => {
            while (atleta.historial.length < totalFechas) {
                atleta.historial.push({ posicion: "-", puntos: "-" });
            }
        });
    });

    // 3. Renderizar el ranking en la tabla
    Object.keys(atletasPorCategoria).sort().forEach(categoria => {
        let atletas = atletasPorCategoria[categoria];

        // Ordenar por puntos, primeros puestos y posición promedio
        atletas.sort((a, b) => b.puntos - a.puntos);

        let section = document.createElement("section");
        let title = document.createElement("h3");
        title.textContent = categoria;
        section.appendChild(title);

        let table = document.createElement("table");
        let theadHTML = `<thead>
            <tr>
                <th>P°</th><th>Nombre</th><th>Localidad</th><th>Pts</th>
                <th>Asis</th><th>Falt</th>`;

        for (let i = 1; i <= totalFechas; i++) {
            theadHTML += `<th colspan="2">Fecha ${i}</th>`;
        }
        theadHTML += `</tr></thead>`;

        table.innerHTML = theadHTML + `<tbody></tbody>`;
        section.appendChild(table);
        rankingContainer.appendChild(section);

        let tbody = table.querySelector("tbody");

        atletas.forEach((atleta, index) => {
            let row = document.createElement("tr");
            row.innerHTML = `
                <td>${index + 1}</td>
                <td>${atleta.nombre}</td>
                <td>${atleta.localidad}</td>
                <td>${atleta.puntos}</td>
                <td>${atleta.asistencias}</td>
                <td>${atleta.faltas}</td>`;

            atleta.historial.forEach(fecha => {
                row.innerHTML += `<td>${fecha.posicion}</td><td>${fecha.puntos}</td>`;
            });

            tbody.appendChild(row);
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
