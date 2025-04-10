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

    for (let i = 1; i < results.length; i++) {
        const [posicion, dni] = results[i];

        if (!dni || isNaN(dni)) continue;

        atletasParticipantes.add(String(dni).trim());

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

    const atletasRef = collection(db, "atletas");
    const snapshot = await getDocs(atletasRef);
    
    let batchUpdates = [];

    // 🔹 Procesar atletas que no participaron
snapshot.forEach((docSnap) => {
    let atleta = docSnap.data();
    let dni = docSnap.id;

    if (!atletasParticipantes.has(dni)) { 
        let atletaRef = doc(db, "atletas", dni);
        let nuevasFaltas = (atleta.faltas || 0) + 1;

        let historial = atleta.historial || [];
        historial.push({ posicion: "-", puntos: "-" }); // Mantiene la estructura

        batchUpdates.push(updateDoc(atletaRef, {
            faltas: nuevasFaltas,
            asistenciasConsecutivas: 0,
            historial: historial
        }));
    }
});


    // 🔹 Procesar atletas que sí participaron
    for (let categoria in categorias) {
        let atletasCategoria = categorias[categoria];

        atletasCategoria.sort((a, b) => a.posicion - b.posicion);

        for (let i = 0; i < atletasCategoria.length; i++) {
            let { dni, posicion, atletaRef, atleta } = atletasCategoria[i];

            let nuevoPuntaje = puntosBase[i] !== undefined ? puntosBase[i] : 1;

            let historial = atleta.historial || [];
            let asistencias = (atleta.asistencias || 0) + 1;
            let asistenciasConsecutivas = (atleta.asistenciasConsecutivas || 0) + 1;
            let totalPuntos = (atleta.puntos || 0) + nuevoPuntaje;

            // 🔹 Asegurar que la posición quede bien asignada
            historial.push({ posicion: i + 1, puntos: nuevoPuntaje });

            let bonus = calcularBonus(asistenciasConsecutivas);

            batchUpdates.push(updateDoc(atletaRef, {
                puntos: totalPuntos + bonus,
                asistencias: asistencias,
                asistenciasConsecutivas: asistenciasConsecutivas,
                historial: historial
            }));
        }
    }

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
// 🔥 ACTUALIZAR TABLA DE RANKING 🔥
// =========================
async function actualizarRanking() {
    try {
        const rankingContainer = document.getElementById("ranking-container");
        rankingContainer.innerHTML = "";

        const atletasRef = collection(db, "atletas");
        const snapshot = await getDocs(atletasRef);
        let atletasPorCategoria = {};
        let totalFechas = 0;

        // Obtener atletas y registrar la cantidad total de fechas
        snapshot.forEach(doc => {
            let data = doc.data();
            
            // 🔥 NO MOSTRAR ATLETAS SIN PARTICIPACIONES 🔥
            if (!data.historial || data.historial.every(fecha => fecha.posicion === "-" && fecha.puntos === "-")) return;

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

        // 🔥 ACTUALIZAR EL NÚMERO DE FECHAS EN LA COLECCIÓN "torneo"
        const torneoRef = doc(db, "torneo", "datos");
        await updateDoc(torneoRef, { cantidadFechas: totalFechas });

        // Asegurar que todos los atletas tengan la misma cantidad de fechas
        Object.keys(atletasPorCategoria).forEach(categoria => {
            atletasPorCategoria[categoria].forEach(atleta => {
                while (atleta.historial.length < totalFechas) {
                    atleta.historial.push({ posicion: "-", puntos: "-" });
                }
            });
        });

        // Renderizar el ranking en la tabla
        Object.keys(atletasPorCategoria).sort().forEach(categoria => {
            let atletas = atletasPorCategoria[categoria];

            // Ordenar por puntos
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
            theadHTML += `</tr><tr>
                    <th></th><th></th><th></th><th></th>
                    <th></th><th></th>`;

            for (let i = 1; i <= totalFechas; i++) {
                theadHTML += `<th>P°</th><th>Pts</th>`;
            }
            theadHTML += `</tr></thead>`;

            table.innerHTML = theadHTML + `<tbody></tbody>`;
            section.appendChild(table);
            rankingContainer.appendChild(section);
// =========================
// 🔥 RANKING DE RUNNING TEAMS 🔥
// =========================
let equipos = {};

// Agrupar atletas por grupo (excluyendo "Individual") y sumar puntos
snapshot.forEach(doc => {
    let data = doc.data();

    if (!data.historial || data.historial.every(fecha => fecha.puntos === "-" && fecha.posicion === "-")) return;

    let grupo = data.grupo || "Sin grupo";
    if (grupo.toLowerCase() === "individual") return;

    if (!equipos[grupo]) {
        equipos[grupo] = {
            nombre: grupo,
            puntos: 0,
            atletas: []
        };
    }

    equipos[grupo].puntos += data.puntos || 0;
    equipos[grupo].atletas.push(`${data.nombre} ${data.apellido}`);
});

// Ordenar por puntos
let equiposOrdenados = Object.values(equipos).sort((a, b) => b.puntos - a.puntos);

// Crear sección y tabla
let equiposSection = document.createElement("section");
equiposSection.classList.add("ranking-equipos");

let equiposTitle = document.createElement("h3");
equiposTitle.textContent = "🏆 Ranking de Equipos de Running";
equiposSection.appendChild(equiposTitle);

let equiposTable = document.createElement("table");
equiposTable.innerHTML = `
    <thead>
        <tr>
            <th>P°</th>
            <th>Equipo</th>
            <th>Puntos Totales</th>
            <th>Integrantes <small>(mostrar/ocultar)</small></th>
        </tr>
    </thead>
    <tbody>
        ${equiposOrdenados.map((equipo, index) => `
            <tr>
                <td>${index + 1}</td>
                <td>${equipo.nombre}</td>
                <td>${equipo.puntos}</td>
                <td>
                    <button class="toggle-integrantes" data-index="${index}">Mostrar</button>
                    <div class="integrantes" id="integrantes-${index}" style="display: none; margin-top: 5px; font-size: 0.9em;">
                        ${equipo.atletas.join(", ")}
                    </div>
                </td>
            </tr>
        `).join("")}
    </tbody>
`;

equiposSection.appendChild(equiposTable);
rankingContainer.appendChild(equiposSection);

// Agregar funcionalidad para mostrar/ocultar
equiposTable.querySelectorAll(".toggle-integrantes").forEach(btn => {
    btn.addEventListener("click", () => {
        const index = btn.getAttribute("data-index");
        const div = document.getElementById(`integrantes-${index}`);
        const visible = div.style.display === "block";
        div.style.display = visible ? "none" : "block";
        btn.textContent = visible ? "Mostrar" : "Ocultar";
    });
});
// =========================
// 🔥 RANKING DE RUNNING TEAMS 🔥
// =========================
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
    } catch (error) {
        console.error("❌ Error al actualizar el ranking:", error);
    }
}
// =========================
// 🔥 Resetear Historial (Borrar todo el torneo) 🔥
// =========================
document.getElementById("reset-history").addEventListener("click", async () => {
    const confirmReset = confirm("⚠️ ¿Estás seguro de que quieres resetear todo el historial? Esto borrará todas las fechas y puntuaciones.");
    
    if (!confirmReset) return;
    
    const doubleCheck = confirm("⚠️ Esta acción es IRREVERSIBLE. Se eliminarán todas las puntuaciones, asistencias y faltas. ¿Deseas continuar?");
    
    if (!doubleCheck) return;

    deshabilitarInterfaz(true);

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

        // 🔹 Resetear cantidad de fechas en Firestore
        const torneoRef = doc(db, "torneo", "datos");
        await updateDoc(torneoRef, { cantidadFechas: 0 });

        alert("✅ El torneo ha sido reiniciado.");
        actualizarRanking();
    } catch (error) {
        console.error("❌ Error al resetear el historial:", error);
        alert("❌ Ocurrió un error al resetear el historial.");
    } finally {
        deshabilitarInterfaz(false);
    }
});
// =========================
// 🔥 DESHACER ÚLTIMA FECHA 🔥
// =========================
document.getElementById("undo-last-date").addEventListener("click", async () => {
    const confirmUndo = confirm("⚠️ ¿Estás seguro de que deseas eliminar la última fecha? Se revertirán los últimos cambios en el ranking.");
    if (!confirmUndo) return;

    const doubleCheck = confirm("⚠️ Esta acción NO se puede deshacer. ¿Confirmas que quieres borrar la última fecha?");
    if (!doubleCheck) return;

    deshabilitarInterfaz(true);

    try {
        const atletasRef = collection(db, "atletas");
        const snapshot = await getDocs(atletasRef);
        let batchUpdates = [];

        snapshot.forEach((docSnap) => {
            let atleta = docSnap.data();
            let historial = atleta.historial || [];

            // Si no hay historial, no se puede deshacer nada
            if (historial.length === 0) return;

            // Elimina la última fecha
            historial.pop();

            // Variables para recalcultar
            let basePoints = 0;
            let asistencias = 0;
            let faltas = 0;
            let streak = 0; // racha actual de carreras consecutivas

            // Recorremos todo el historial (ya sin la última fecha)
            historial.forEach(evento => {
                if (evento.puntos === "-") {
                    // Si es falta, se suma 1 a faltas y se reinicia la racha
                    faltas++;
                    streak = 0;
                } else {
                    // Si asistió, se suma el puntaje base, se cuenta la asistencia y se incrementa la racha
                    let pts = parseInt(evento.puntos) || 0;
                    basePoints += pts;
                    asistencias++;
                    streak++;
                }
            });

            // Se calcula el bonus en función del streak actual (solo se considera la racha continua al final)
            let bonus = calcularBonusStreak(streak);
            let totalPoints = basePoints + bonus;

            let atletaRef = doc(db, "atletas", docSnap.id);
            batchUpdates.push(updateDoc(atletaRef, {
                historial: historial,
                puntos: totalPoints,
                asistencias: asistencias,
                faltas: faltas,
                asistenciasConsecutivas: streak
            }));
        });

        await Promise.all(batchUpdates);

        // Reducir en 1 la cantidad total de fechas en Firestore (colección "torneo")
        const torneoRef = doc(db, "torneo", "datos");
        const torneoSnap = await getDoc(torneoRef);
        if (torneoSnap.exists()) {
            let cantidadFechas = torneoSnap.data().cantidadFechas || 0;
            if (cantidadFechas > 0) {
                await updateDoc(torneoRef, { cantidadFechas: cantidadFechas - 1 });
            }
        }

        alert("✅ Última fecha eliminada correctamente.");
        actualizarRanking();
    } catch (error) {
        console.error("❌ Error al deshacer la última fecha:", error);
        alert("❌ Ocurrió un error. Revisa la consola.");
    } finally {
        deshabilitarInterfaz(false);
    }
});

// =========================
// 🔥 FUNCIÓN PARA CALCULAR BONUS SEGÚN RACHAS 🔥
// =========================
function calcularBonusStreak(streak) {
    if (streak < 2) return 0;
    if (streak === 2) return 2;
    if (streak === 3) return 6;   // 2 + 4
    if (streak === 4) return 12;  // 2 + 4 + 6
    if (streak === 5) return 20;  // 2 + 4 + 6 + 8
    if (streak >= 6) return 30;   // 2 + 4 + 6 + 8 + 10 (máximo)
    return 0;
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
