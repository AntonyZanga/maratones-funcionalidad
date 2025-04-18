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

            const resultado = await procesarResultados(results);
            if (resultado) {
                uploadMessage.textContent = "✅ Resultados cargados correctamente.";
            }
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
        return false;
    }

    if (results.length < 2) {
        uploadMessage.textContent = "El archivo no tiene datos válidos.";
        return false;
    }

    const puntosBase = [12, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1];
    let categorias = {};
    let atletasParticipantes = new Set();
    let dniNoEncontrados = [];
    let dniSimilares = [];

    const atletasRef = collection(db, "atletas");
    const snapshotGlobal = await getDocs(atletasRef);
    const todosLosDNIs = snapshotGlobal.docs.map(doc => doc.id);

    for (let i = 1; i < results.length; i++) {
        const fila = results[i];

        if (!Array.isArray(fila) || fila.length < 2) {
            console.warn(`Fila inválida en la línea ${i + 1}:`, fila);
            continue;
        }

        const [posicion, dni] = fila;

        if (!posicion || isNaN(posicion) || !dni || isNaN(dni)) {
            console.warn(`Datos inválidos en la fila ${i + 1}:`, fila);
            continue;
        }

        const dniLimpio = String(dni).trim();
        atletasParticipantes.add(dniLimpio);

        const atletaRef = doc(db, "atletas", dniLimpio);
        const atletaSnap = await getDoc(atletaRef);

        if (!atletaSnap.exists()) {
            dniNoEncontrados.push(dniLimpio);

            for (const posibleDNI of todosLosDNIs) {
                if (esSimilar(dniLimpio, posibleDNI)) {
                    const snapPosible = await getDoc(doc(db, "atletas", posibleDNI));
                    if (snapPosible.exists()) {
                        const atletaPosible = snapPosible.data();
                        dniSimilares.push({
                            original: dniLimpio,
                            sugerido: posibleDNI,
                            nombre: atletaPosible.nombre || "Desconocido",
                            apellido: atletaPosible.apellido || "Desconocido",
                            fechaNacimiento: atletaPosible.fechaNacimiento || "N/D",
                            localidad: atletaPosible.localidad || "N/D"
                        });
                    }
                }
            }

            continue;
        }

        let atleta = atletaSnap.data();
        let categoria = obtenerCategoria(atleta.fechaNacimiento, atleta.categoria, fechaMaraton);

        if (!categorias[categoria]) {
            categorias[categoria] = [];
        }

        categorias[categoria].push({ dni: dniLimpio, posicion, atletaRef, atleta });
    }

    const cantidadTotal = results.length - 1;
    const cantidadEncontrados = cantidadTotal - dniNoEncontrados.length;

    if (dniNoEncontrados.length > 0) {
        let mensaje = `🔎 Se procesaron ${cantidadTotal} corredores del archivo.\n\n`;
        mensaje += `✅ Encontrados en la base de datos: ${cantidadEncontrados}\n`;
        mensaje += `❌ No encontrados: ${dniNoEncontrados.length}\n\n`;
        mensaje += `📌 DNIs no encontrados:\n`;
        mensaje += dniNoEncontrados.map(dni => `• ${dni}`).join("\n");

        if (dniSimilares.length > 0) {
            mensaje += `\n\n🔍 Posibles coincidencias:\n`;
            dniSimilares.forEach(par => {
                mensaje += `• ${par.original} → ¿Quisiste decir ${par.sugerido}?\n`;
                mensaje += `   ↪ ${par.nombre} ${par.apellido} | Nac: ${par.fechaNacimiento} | Loc: ${par.localidad}\n`;
            });
        }

        mensaje += `\n\n⚠️ ¿Deseás continuar con la carga de resultados?`;

        const continuar = confirm(mensaje);
        if (!continuar) {
            uploadMessage.textContent = "❌ Carga cancelada por el usuario.";
            deshabilitarInterfaz(false);
            return false;
        }
    }

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
    actualizarRanking();

    // 🔹 Mensaje final con cantidad cargada
    uploadMessage.textContent = `✅ Resultados cargados correctamente. (${cantidadEncontrados} de ${cantidadTotal} encontrados)`;

    return true;
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
            try {
                let data = doc.data();

                if (!data.historial || data.historial.every(f => f.posicion === "-" && f.puntos === "-")) return;

                let primeraFechaReal = data.historial.find(f => f.fecha && f.posicion !== "-");
                if (!primeraFechaReal) return;

                let edad = calcularEdad(data.fechaNacimiento, primeraFechaReal?.fecha);
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

                for (let i = 0; i < data.historial.length; i++) {
                    const fecha = data.historial[i]?.fecha || null;
                    if (!fechasReales[i] && fecha) {
                        fechasReales[i] = fecha;
                    }
                }
            } catch (error) {
                console.error(`❌ Error procesando atleta ${doc.id}:`, error);
            }
        });

        const torneoRef = doc(db, "torneo", "datos");
        await updateDoc(torneoRef, { cantidadFechas: totalFechas });

        Object.keys(atletasPorCategoria).forEach(categoria => {
            atletasPorCategoria[categoria].forEach(atleta => {
                while (atleta.historial.length < totalFechas) {
                    atleta.historial.push({ posicion: "-", puntos: "-" });
                }
            });
        });

        // 🔹 Panel explicativo del sistema de puntos
        const infoBtn = document.createElement("button");
        infoBtn.textContent = "ℹ️ Ver cómo se otorgan los puntos";
        infoBtn.classList.add("btn-info-puntos");

        const infoBox = document.createElement("div");
        infoBox.classList.add("info-box-puntos");
        infoBox.style.display = "none";
        infoBox.innerHTML = `
            <h4>Sistema de Puntos</h4>
            <ul>
                <li><b>Puesto 1:</b> 12 puntos</li>
                <li><b>Puesto 2:</b> 10 puntos</li>
                <li><b>Puesto 3:</b> 9 puntos</li>
                <li><b>Puesto 4:</b> 8 puntos</li>
                <li>...hasta el <b>puesto 11</b> con <b>1 punto</b></li>
            </ul>

            <h5>Visualización de puntos por puesto:</h5>
            <div style="display: flex; gap: 6px; flex-wrap: wrap; align-items: flex-end;">
                ${[12, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1].map((pts, i) => `
                    <div style="text-align:center;">
                        <div style="background:#4caf50; width:28px; height:${pts * 4}px; margin:auto; border-radius:4px;"></div>
                        <small>${i + 1}°</small>
                    </div>
                `).join("")}
            </div>

            <h4 style="margin-top:1.5rem;">Bonificación por asistencia consecutiva</h4>
            <p>Los atletas reciben puntos extra por asistir a varias fechas seguidas:</p>
            <ul>
                <li>2 asistencias consecutivas: +2 pts</li>
                <li>3 asistencias: +4 pts</li>
                <li>4 asistencias: +6 pts</li>
                <li>5 asistencias: +8 pts</li>
                <li>6 asistencias: +10 pts</li>
                <li>...y así sucesivamente</li>
            </ul>

            <h5>Visualización del bonus:</h5>
            <div style="display: flex; gap: 6px; flex-wrap: wrap; align-items: flex-end;">
                ${[0, 0, 2, 4, 6, 8, 10, 12, 14].map((bonus, i) => `
                    <div style="text-align:center;">
                        <div style="background:#2196f3; width:28px; height:${bonus * 4}px; margin:auto; border-radius:4px;"></div>
                        <small>${i} fechas</small>
                    </div>
                `).join("")}
            </div>

            <h4 style="margin-top:1.5rem;">Ejemplos</h4>
            <ul>
                <li><b>Ana González</b> participó 3 fechas seguidas y salió 2°, 1° y 3° → <b>10 + 12 (+2) + 9 (+4)</b> = 37 pts</li>
                <li><b>Lucas Pérez</b> participó solo una vez y quedó 4° → <b>8 pts</b></li>
                <li><b>Valeria Díaz</b> faltó dos veces y luego ganó una carrera → <b>12 pts, sin bonus</b></li>
            </ul>
        `;

        infoBtn.addEventListener("click", () => {
            const visible = infoBox.style.display === "block";
            infoBox.style.display = visible ? "none" : "block";
            infoBtn.textContent = visible
                ? "ℹ️ Ver cómo se otorgan los puntos"
                : "🔽 Ocultar explicación";
        });

        rankingContainer.prepend(infoBox);
        rankingContainer.prepend(infoBtn);

        // 🔹 Renderizar tablas por categoría
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
                let fecha = fechasReales[i] ? fechasReales[i].split("-").reverse().join("/") : "";
                theadHTML += `<th colspan="2" style="text-align:center">
                    Fecha ${i + 1}<br><small>(${fecha})</small>
                </th>`;
            }

            theadHTML += `</tr><tr><th></th><th></th><th></th><th></th><th></th><th></th>`;
            for (let i = 0; i < totalFechas; i++) {
                theadHTML += `<th>P°</th><th>Pts</th>`;
            }
            theadHTML += `</tr></thead>`;

            table.innerHTML = theadHTML + `<tbody></tbody>`;
            const wrapper = document.createElement("div");
            wrapper.classList.add("ranking-table-wrapper");

            wrapper.appendChild(table);
            section.appendChild(wrapper);

            // 🔄 Aviso para usuarios sobre scroll horizontal
            const scrollNote = document.createElement("p");
            scrollNote.textContent = "🔄 Desliza hacia los lados para ver todas las fechas y resultados.";
            scrollNote.style.fontSize = "0.9rem";
            scrollNote.style.marginTop = "0.5rem";
            scrollNote.style.color = "#555";
            section.appendChild(scrollNote);

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
        console.error("❌ Error general al actualizar el ranking:", error);
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

    // Filtrar solo los equipos con puntos > 0
    let teamsArray = Object.values(teams).filter(t => t.puntos > 0);
    teamsArray.sort((a, b) => b.puntos - a.puntos);

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
function esSimilar(dni1, dni2) {
    if (dni1.length !== dni2.length) return false;

    let diferencias = 0;
    for (let i = 0; i < dni1.length; i++) {
        if (dni1[i] !== dni2[i]) diferencias++;
        if (diferencias > 1) return false;
    }

    return diferencias === 1;
}

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
        [0, 19], [20, 24], [25, 29], [30, 34], [35, 39],
        [40, 44], [45, 49], [50, 54], [55, 59], [60, 64], [65, 69]
    ];

    for (let [min, max] of categorias) {
        if (edad >= min && edad <= max) return `${min} - ${max}`;
    }

    return "70 y más años";
}
