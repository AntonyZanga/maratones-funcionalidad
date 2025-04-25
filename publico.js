async function mostrarRanking() {
    try {
        const refPublico = doc(db, "torneo", "publico");
        const docSnap = await getDoc(refPublico);

        if (docSnap.exists()) {
            const data = docSnap.data();
            const contenedor = document.getElementById("ranking-container");
            contenedor.innerHTML = data.html;

            // Mostrar el contenido del panel explicativo si existe
            const infoBoxPuntos = document.getElementById('info-box-puntos-publico');
            if (infoBoxPuntos && data.contenidoPanel) {
                infoBoxPuntos.innerHTML = data.contenidoPanel;
            }
        } else {
            console.log("No hay ranking publicado");
        }
    } catch (error) {
        console.error("Error al cargar el ranking:", error);
    }
} 