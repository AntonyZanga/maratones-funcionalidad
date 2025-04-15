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
function deshabilitarInterfaz(deshabilitar) {
    const elementos = document.querySelectorAll("button, input, select, textarea");
    elementos.forEach(elemento => {
        elemento.disabled = deshabilitar;
    });
}
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
    const fechaInput = document.getElementById("fecha-maraton");
    const uploadMessage = document.getElementById("upload-message");

    if (!fechaInput.value) {
        uploadMessage.textContent = "❌ Debes seleccionar la fecha de la maratón.";
        return;
    }

    if (fileInput.files.length === 0) {
        uploadMessage.textContent = "❌ Selecciona un archivo Excel.";
        return;
    }

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
            deshabilitarInterfaz(false);
        }
    };

    reader.readAsArrayBuffer(file);
});

// =========================
// 🔥 OBTENER CATEGORÍA SEGÚN EDAD Y GÉNERO 🔥
// =========================
function obtenerCategoria(fechaNacimiento, genero, fechaCarrera) {
    let edad = calcularEdad(fechaNacimiento, fechaCarrera);
    let categoriaEdad = determinarCategoriaEdad(edad);
    return `${genero} - ${categoriaEdad}`;
}

// =========================
// 🔥 PROCESAR RESULTADOS Y ACTUALIZAR RANKING 🔥
// =========================
async function procesarResultados(results) {
    const uploadMessage = document.getElementById("upload-message");
    const fechaMaratonInput = document.getElementById("fecha-maraton");
    const fechaMaraton = fechaMaratonInput?.value;

    if (!fechaMaraton) {
        uploadMessage.textContent = "Seleccioná la fecha de la maratón.";
        return;
    }

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
        let categoria = obtenerCategoria(atleta.fechaNacimiento, atleta.categoria, fechaMaraton);

        if (!categorias[categoria]) {
            categorias[categoria] = [];
        }

        categorias[categoria].push({ dni, posicion, atletaRef, atleta });
    }

    const atletasRef = collection(db, "atletas");
    const snapshot = await getDocs(atletasRef);
    let batchUpdates = [];

    snapshot.forEach((docSnap) => {
        let atleta = docSnap.data();
        let dni = docSnap.id;

        if (!atletasParticipantes.has(dni)) {
            let atletaRef = doc(db, "atletas", dni);
            let nuevasFaltas = (atleta.faltas || 0) + 1;

            let historial = atleta.historial || [];
            historial.push({
                posicion: "-",
                puntos: "-",
                bonus: 0,
                grupoRunning: atleta.grupoRunning || "Individual",
                fecha: fechaMaraton
            });

            batchUpdates.push(updateDoc(atletaRef, {
                faltas: nuevasFaltas,
                asistenciasConsecutivas: 0,
                historial: historial
            }));
        }
    });

    for (let categoria in categorias) {
        let atletasCategoria = categorias[categoria];

        atletasCategoria.sort((a, b) => a.posicion - b.posicion);

        for (let i = 0; i < atletasCategoria.length; i++) {
            let { dni, posicion, atletaRef, atleta } = atletasCategoria[i];

            let nuevoPuntaje = puntosBase[i] !== undefined ? puntosBase[i] : 1;
            let historial = atleta.historial || [];
            let asistencias = (atleta.asistencias || 0) + 1;
            let asistenciasConsecutivas = (atleta.asistenciasConsecutivas || 0) + 1;
            let totalPuntos = (atleta.puntos || 0);

            let bonus = calcularBonus(asistenciasConsecutivas);

            historial.push({
                posicion: i + 1,
                puntos: nuevoPuntaje,
                bonus: bonus,
                grupoRunning: atleta.grupoRunning || "Individual",
                fecha: fechaMaraton
            });

            batchUpdates.push(updateDoc(atletaRef, {
                puntos: totalPuntos + nuevoPuntaje + bonus,
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
// 🔥 ACTUALIZAR TABLA DE RANKING (Individual y Running Teams) 🔥
// =========================
async function actualizarRanking() {
    try {
        const rankingContainer = document.getElementById("ranking-container");
        rankingContainer.innerHTML = "";

        const atletasRef = collection(db, "atletas");
        const snapshot = await getDocs(atletasRef);
        let atletasPorCategoria = {};
        let totalFechas = 0;
        let fechasReales = [];

        snapshot.forEach(doc => {
            let data = doc.data();

            if (!data.historial || data.historial.every(f => f.posicion === "-" && f.puntos === "-")) return;

            // Determinar la categoría según la PRIMERA participación
            let primeraFechaReal = data.historial.find(f => f.fecha && f.posicion !== "-");
            let edad = calcularEdad(data.fechaNacimiento, primeraFechaReal?.fecha);
            let categoriaEdad = determinarCategoriaEdad(edad);
            let categoria = data.categoria || "Especial";
            let categoriaCompleta = `${categoria} - ${categoriaEdad}`;

            if (!atletasPorCategoria[categoriaCompleta]) {
                atletasPorCategoria[categoriaCompleta] = [];
            }

            totalFechas = Math.max(totalFechas, data.historial.length);

            // Guardar atleta y su historial
            atletasPorCategoria[categoriaCompleta].push({
                nombre: `${data.nombre} ${data.apellido}`,
                localidad: data.localidad || "Desconocida",
                puntos: data.puntos || 0,
                asistencias: data.asistencias || 0,
                faltas: data.faltas || 0,
                historial: data.historial || []
            });

            // Guardar fechas si están vacías
            for (let i = 0; i < data.historial.length; i++) {
                const fecha = data.historial[i]?.fecha || null;
                if (!fechasReales[i] && fecha) {
                    fechasReales[i] = fecha;
                }
            }
        });

        // Guardar la cantidad de fechas en Firestore
        const torneoRef = doc(db, "torneo", "datos");
        await updateDoc(torneoRef, { cantidadFechas: totalFechas });

        // Asegurar que todos los atletas tengan historial uniforme
        Object.keys(atletasPorCategoria).forEach(categoria => {
            atletasPorCategoria[categoria].forEach(atleta => {
                while (atleta.historial.length < totalFechas) {
                    atleta.historial.push({ posicion: "-", puntos: "-" });
                }
            });
        });

        // Renderizar tabla por categoría
        Object.keys(atletasPorCategoria).sort().forEach(categoria => {
            let atletas = atletasPorCategoria[categoria];
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

            for (let i = 0; i < totalFechas; i++) {
            let fecha = fechasReales[i]
                ? new Date(fechasReales[i]).toLocaleDateString("es-AR")
                : "";
            theadHTML += `<th colspan="2" style="text-align:center">
                Fecha ${i + 1}<br><small>(${fecha})</small>
            </th>`;
            }

            theadHTML += `</tr><tr>
                    <th></th><th></th><th></th><th></th><th></th><th></th>`;
            for (let i = 0; i < totalFechas; i++) {
                theadHTML += `<th>P°</th><th>Pts</th>`;
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

        actualizarRankingTeams();
    } catch (error) {
        console.error("❌ Error al actualizar el ranking:", error);
    }
}

document.getElementById("publicar-ranking").addEventListener("click", async () => {
    try {
        const confirmar = confirm("¿Deseás publicar el ranking actual al público?");
        if (!confirmar) return;

        const contenedor = document.getElementById("ranking-container");
        const html = contenedor.innerHTML;

        const refPublico = doc(db, "torneo", "publico");
        await setDoc(refPublico, {
            html: html,
            fecha: new Date().toISOString()
        });

        alert("✅ Ranking publicado para el público.");
    } catch (error) {
        console.error("❌ Error al publicar el ranking:", error);
        alert("❌ Ocurrió un error al publicar el ranking.");
    }
});

// =========================
// 🔥 ACTUALIZAR RANKING DE RUNNING TEAMS (USANDO LA COLECCIÓN "grupos") 🔥
// =========================
async function actualizarRankingTeams() {
    // Obtener los grupos registrados
    const gruposRef = collection(db, "grupos");
    const gruposSnap = await getDocs(gruposRef);
    let teams = {};

    gruposSnap.forEach(groupDoc => {
        const groupData = groupDoc.data();
        const groupName = groupData.nombre;
        teams[groupName] = {
            team: groupName,
            puntos: 0
        };
    });

    // Obtener atletas y sumar puntos + bonus por grupoRunning histórico
    const atletasRef = collection(db, "atletas");
    const atletasSnap = await getDocs(atletasRef);

    atletasSnap.forEach(docSnap => {
        let data = docSnap.data();
        let historial = data.historial || [];

        historial.forEach(fecha => {
            const grupo = fecha.grupoRunning || "Individual";
            const puntos = parseInt(fecha.puntos);
            const bonus = parseInt(fecha.bonus) || 0;
            const total = isNaN(puntos) ? 0 : puntos + bonus;

            if (grupo !== "Individual" && total > 0 && teams[grupo]) {
                teams[grupo].puntos += total;
            }
        });
    });

    // Ordenar los equipos por puntos
    let teamsArray = Object.values(teams).sort((a, b) => b.puntos - a.puntos);

    // Renderizar la tabla del ranking de equipos
    const rankingContainer = document.getElementById("ranking-container");
    let section = document.createElement("section");
    let title = document.createElement("h3");
    title.textContent = "Ranking de Running Teams";
    section.appendChild(title);
    
    let table = document.createElement("table");
    let thead = document.createElement("thead");
    thead.innerHTML = `<tr>
      <th>P°</th>
      <th>Team</th>
      <th>Puntos</th>
    </tr>`;
    table.appendChild(thead);

    let tbody = document.createElement("tbody");
    teamsArray.forEach((team, index) => {
        let row = document.createElement("tr");
        row.innerHTML = `<td>${index + 1}</td>
                         <td>${team.team}</td>
                         <td>${team.puntos}</td>`;
        tbody.appendChild(row);
    });
    table.appendChild(tbody);
    section.appendChild(table);
    rankingContainer.appendChild(section);
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
function calcularEdad(fechaNacimiento, fechaReferencia) {
    let nacimiento = new Date(fechaNacimiento);
    let referencia = fechaReferencia ? new Date(fechaReferencia) : new Date();
    let edad = referencia.getFullYear() - nacimiento.getFullYear();
    let m = referencia.getMonth() - nacimiento.getMonth();
    if (m < 0 || (m === 0 && referencia.getDate() < nacimiento.getDate())) {
        edad--;
    }
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
