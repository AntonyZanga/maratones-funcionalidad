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
async function procesarResultados(results) {
    const uploadMessage = document.getElementById("upload-message");

    if (results.length < 2) {
        uploadMessage.textContent = "El archivo no tiene datos válidos.";
        return;
    }

    const puntosBase = [12, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1];
    let categorias = {};
    let atletasParticipantes = new Set();

    // 🔹 Obtener DNIs únicos de los resultados
    let resultadosFiltrados = results.slice(1) // Omitir encabezado
        .filter(([_, dni]) => dni && !isNaN(dni)) // Filtrar datos inválidos
        .map(([posicion, dni]) => ({ posicion, dni: String(dni).trim() })); // Normalizar DNIs

    resultadosFiltrados.forEach(({ dni }) => atletasParticipantes.add(dni));

    // 🔹 Obtener datos de los atletas en una sola consulta
    const atletasSnapshot = await getDocs(collection(db, "atletas"));
    let batchUpdates = [];

    let atletasData = {};
    atletasSnapshot.forEach(docSnap => {
        atletasData[docSnap.id] = docSnap.data();
    });

    // 🔹 Agrupar atletas por categoría
    resultadosFiltrados.forEach(({ posicion, dni }) => {
        let atleta = atletasData[dni];
        if (!atleta) return;

        let categoria = obtenerCategoria(atleta.fechaNacimiento, atleta.categoria);
        if (!categorias[categoria]) categorias[categoria] = [];

        categorias[categoria].push({ dni, posicion, atleta });
    });

    // 🔹 Procesar atletas que NO participaron
    atletasSnapshot.forEach(docSnap => {
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

    // 🔹 Procesar atletas que SÍ participaron
    Object.values(categorias).forEach(atletasCategoria => {
        atletasCategoria.sort((a, b) => a.posicion - b.posicion);

        atletasCategoria.forEach(({ dni, posicion, atleta }, index) => {
            let nuevoPuntaje = puntosBase[index] ?? 1;
            let historial = atleta.historial || [];
            let asistencias = (atleta.asistencias || 0) + 1;
            let asistenciasConsecutivas = (atleta.asistenciasConsecutivas || 0) + 1;
            let totalPuntos = (atleta.puntos || 0) + nuevoPuntaje;
            let bonus = calcularBonus(asistenciasConsecutivas);

            historial.push({ posicion: index + 1, puntos: nuevoPuntaje });

            batchUpdates.push(updateDoc(doc(db, "atletas", dni), {
                puntos: totalPuntos + bonus,
                asistencias,
                asistenciasConsecutivas,
                historial
            }));
        });
    });

    await Promise.all(batchUpdates);

    uploadMessage.textContent = "✅ Resultados cargados correctamente.";
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
// 🔥 ACTUALIZAR RANKING 🔥
// =========================
// =========================
// 🔥 ACTUALIZAR RANKING 🔥
// =========================
async function actualizarRanking() {
    const rankingContainer = document.getElementById("ranking-container");
    rankingContainer.innerHTML = "";

    const snapshot = await getDocs(collection(db, "atletas"));
    let atletasPorCategoria = {};
    let totalFechas = 0;

    // 🔹 Obtener la fecha de la primera maratón cargada
    let fechasRegistradas = [];

    snapshot.forEach(doc => {
        let data = doc.data();
        if (data.historial) {
            fechasRegistradas = data.historial.map((_, index) => `Fecha ${index + 1}`);
        }
    });

    totalFechas = fechasRegistradas.length;

    // 🔹 Procesar atletas y calcular total de fechas
    snapshot.forEach(doc => {
        let data = doc.data();
        let historial = data.historial || [];
        let fechaInscripcion = data.fechaInscripcion || null;

        // 🔥 NO MOSTRAR ATLETAS SIN PARTICIPACIONES 🔥
        if (historial.every(fecha => fecha.posicion === "-" && fecha.puntos === "-")) return;

        let edad = calcularEdad(data.fechaNacimiento);
        let categoriaEdad = determinarCategoriaEdad(edad);
        let categoria = data.categoria || "Especial";
        let categoriaCompleta = `${categoria} - ${categoriaEdad}`;

        if (!atletasPorCategoria[categoriaCompleta]) atletasPorCategoria[categoriaCompleta] = [];

        // 🔹 Ajustar historial según la fecha de inscripción
        if (fechaInscripcion) {
            let fechaInscripcionIndex = fechasRegistradas.findIndex(fecha => new Date(fecha) >= new Date(fechaInscripcion));
            historial = historial.slice(fechaInscripcionIndex);
        }

        atletasPorCategoria[categoriaCompleta].push({
            nombre: `${data.nombre} ${data.apellido}`,
            localidad: data.localidad || "Desconocida",
            puntos: data.puntos || 0,
            asistencias: data.asistencias || 0,
            faltas: data.faltas || 0,
            historial
        });
    });

    // 🔹 Renderizar el ranking
    Object.keys(atletasPorCategoria).sort().forEach(categoria => {
        let atletas = atletasPorCategoria[categoria].sort((a, b) => b.puntos - a.puntos);

        let section = document.createElement("section");
        let title = document.createElement("h3");
        title.textContent = categoria;
        section.appendChild(title);

        let table = document.createElement("table");
        let thead = document.createElement("thead");
        let tbody = document.createElement("tbody");

        // 🔹 Encabezado de la tabla
        let headerRow1 = document.createElement("tr");
        let headerRow2 = document.createElement("tr");

        ["P°", "Nombre", "Localidad", "Pts", "Asis", "Falt"].forEach(text => {
            let th = document.createElement("th");
            th.textContent = text;
            headerRow1.appendChild(th);
            let th2 = document.createElement("th");
            headerRow2.appendChild(th2);
        });

        fechasRegistradas.forEach(fecha => {
            let thFecha = document.createElement("th");
            thFecha.colSpan = 2;
            thFecha.textContent = fecha;
            headerRow1.appendChild(thFecha);

            ["P°", "Pts"].forEach(text => {
                let th = document.createElement("th");
                th.textContent = text;
                headerRow2.appendChild(th);
            });
        });

        thead.appendChild(headerRow1);
        thead.appendChild(headerRow2);
        table.appendChild(thead);
        table.appendChild(tbody);
        section.appendChild(table);
        rankingContainer.appendChild(section);

        // 🔹 Cuerpo de la tabla
        atletas.forEach((atleta, index) => {
            let row = document.createElement("tr");

            [index + 1, atleta.nombre, atleta.localidad, atleta.puntos, atleta.asistencias, atleta.faltas].forEach(text => {
                let td = document.createElement("td");
                td.textContent = text;
                row.appendChild(td);
            });

            atleta.historial.forEach(fecha => {
                ["posicion", "puntos"].forEach(key => {
                    let td = document.createElement("td");
                    td.textContent = fecha[key];
                    row.appendChild(td);
                });
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
