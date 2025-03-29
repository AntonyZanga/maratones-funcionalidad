import { db } from './config.js';
import { collection, getDocs, doc, updateDoc, deleteField } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

async function borrarHistorialCarreras() {
    try {
        const atletasRef = collection(db, "atletas");
        const snapshot = await getDocs(atletasRef);

        let batchUpdates = [];

        snapshot.forEach((docSnap) => {
            const atletaRef = doc(db, "atletas", docSnap.id);

            // 🔹 Eliminar completamente el campo historialCarreras
            batchUpdates.push(updateDoc(atletaRef, {
                historialCarreras: deleteField()
            }));
        });

        await Promise.all(batchUpdates);

        console.log("✅ Campo historialCarreras eliminado en todos los atletas.");
        alert("✅ Campo historialCarreras eliminado correctamente.");
    } catch (error) {
        console.error("❌ Error al eliminar historialCarreras:", error);
        alert("❌ Ocurrió un error al eliminar historialCarreras.");
    }
}

// Ejecutar la función
borrarHistorialCarreras();
