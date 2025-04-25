// import Quagga from 'https://cdn.jsdelivr.net/npm/quagga2@1.2.6/dist/quagga.mjs';
import { db } from './config.js';
import { collection, getDocs, doc, updateDoc, getDoc, setDoc, query, where } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
// ZXing para escaneo de DNI
// import { BrowserBarcodeReader } from 'https://cdn.jsdelivr.net/npm/@zxing/browser@0.0.10/esm/index.min.js';

// Variables globales
let certificados = [];

function formatearFecha(fecha) {
  if (!fecha) return '-';
  const d = new Date(fecha);
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleDateString();
}
function badge(estado) {
  const map = {
    valido: 'badge badge-valido',
    invalido: 'badge badge-invalido',
    pendiente: 'badge badge-pendiente',
    vencido: 'badge badge-vencido'
  };
  const label = {
    valido: 'Válido',
    invalido: 'Inválido',
    pendiente: 'Pendiente',
    vencido: 'Vencido'
  };
  return `<span class="${map[estado]||'badge'}">${label[estado]||estado}</span>`;
}
function calcularEstado(cert) {
  if (cert.estadoManual === 'invalido') return 'invalido';
  if (cert.estadoManual === 'valido') return 'valido';
  return 'pendiente';
}
async function cargarCertificados() {
  try {
    const querySnapshot = await getDocs(collection(db, "certificados"));
    certificados = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      certificados.push({
        id: doc.id,
        ...data,
        fechaCarga: data.fechaSubida || data.fechaCarga,
        estado: calcularEstado(data)
      });
    });
    renderTabla(certificados);
    renderContadores(certificados);
  } catch (error) {
    console.error("Error al cargar certificados:", error);
    alert("Error al cargar los certificados");
  }
}
function renderTabla(certificados) {
  const tbody = document.querySelector('#tabla-certificados tbody');
  tbody.innerHTML = '';
  certificados.forEach(cert => {
    const fila = document.createElement('tr');
    fila.innerHTML = `
      <td>${cert.nombre}</td>
      <td>${cert.apellido}</td>
      <td>${cert.dni}</td>
      <td>${badge(cert.estado)}</td>
      <td>${formatearFecha(cert.fechaCarga)}</td>
      <td>
        <button class="btn btn-sm btn-accent ver-certificado" data-id="${cert.id}">
          <i class="fas fa-eye"></i> Ver
        </button>
      </td>
      <td>
        <button class="btn btn-sm btn-success aprobar-certificado" data-id="${cert.id}" ${cert.estado==='valido'?'disabled':''}>Aprobar</button>
        <button class="btn btn-sm btn-danger rechazar-certificado" data-id="${cert.id}" ${cert.estado==='invalido'?'disabled':''}>Rechazar</button>
      </td>
    `;
    tbody.appendChild(fila);
  });
}
function renderContadores(certificados) {
  const cont = {valido:0, invalido:0, pendiente:0};
  certificados.forEach(c=>cont[c.estado]++);
  document.getElementById('certificados-contadores').innerHTML = `
    <span class="badge badge-valido">Válidos: ${cont.valido}</span>
    <span class="badge badge-invalido">Inválidos: ${cont.invalido}</span>
    <span class="badge badge-pendiente">Pendientes: ${cont.pendiente}</span>
  `;
}
function aplicarFiltros() {
  let lista = certificados;
  const estado = document.getElementById('filtro-estado').value;
  const busqueda = document.getElementById('busqueda-certificados').value.trim().toLowerCase();
  if (estado) lista = lista.filter(c=>c.estado===estado);
  if (busqueda) lista = lista.filter(c=>
    (c.nombre && c.nombre.toLowerCase().includes(busqueda)) ||
    (c.apellido && c.apellido.toLowerCase().includes(busqueda)) ||
    (c.dni && c.dni.toString().includes(busqueda))
  );
  renderTabla(lista);
  renderContadores(lista);
}
document.addEventListener('DOMContentLoaded', async () => {
  try {
    // Código de solicitud de cámara eliminado
    await cargarCertificados();
    inicializarEventos();
  } catch (error) {
    console.error("Error al inicializar la aplicación:", error);
    alert("Error al cargar la aplicación. Por favor, recarga la página.");
  }
});
// Espera a que ZXingBrowser esté disponible antes de ejecutar el callback
function waitForZXingBrowser(callback) {
  if (window.ZXingBrowser && window.ZXingBrowser.BrowserBarcodeReader) {
    console.log('ZXingBrowser está disponible');
    callback();
  } else {
    console.log('Esperando ZXingBrowser...');
    setTimeout(() => waitForZXingBrowser(callback), 100);
  }
}
function inicializarEventos() {
  document.getElementById('exportar-certificados').addEventListener('click',()=>{
    import('https://cdn.sheetjs.com/xlsx-0.20.0/package/xlsx.mjs').then(XLSX=>{
      const lista = certificados || [];
      const data = lista.map(c=>({
        Nombre: c.nombre,
        Apellido: c.apellido,
        DNI: c.dni,
        Estado: c.estado,
        'Fecha de Carga': formatearFecha(c.fechaCarga),
        'Vencimiento': c.fechaVencimiento
      }));
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Certificados');
      XLSX.writeFile(wb, 'certificados.xlsx');
    });
  });
  document.getElementById('tabla-certificados').addEventListener('click',async e=>{
    if (e.target.closest('.ver-certificado')) {
      const id = e.target.closest('.ver-certificado').dataset.id;
      const cert = certificados.find(c=>c.id===id);
      if (!cert) return;
      const modal = document.getElementById('modal-certificado');
      const cont = document.getElementById('contenido-certificado');
      cont.innerHTML = '';
      if (cert.tipoArchivo && cert.tipoArchivo.startsWith('image/')) {
        cont.innerHTML = `<img src="${cert.certificado}" style="max-width:80vw;max-height:70vh;">`;
      } else if (cert.tipoArchivo==='application/pdf') {
        cont.innerHTML = `<iframe src="${cert.certificado}" style="width:80vw;height:70vh;border:none;"></iframe>`;
      } else {
        cont.innerHTML = `<p>No se puede mostrar el archivo.</p>`;
      }
      modal.style.display = 'flex';
      if (window.innerWidth < 700) {
        setTimeout(() => {
          modal.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 100);
      }
    }
  });
  const cerrarModalBtn = document.getElementById('cerrar-modal-certificado');
  if (cerrarModalBtn) {
    cerrarModalBtn.onclick = ()=> {
      document.getElementById('modal-certificado').style.display = 'none';
    };
  }
  document.getElementById('tabla-certificados').addEventListener('click',async e=>{
    if (e.target.closest('.aprobar-certificado')) {
      const id = e.target.closest('.aprobar-certificado').dataset.id;
      await updateDoc(doc(db,'certificados',id),{estadoManual:'valido'});
      await cargarCertificados();
    }
    if (e.target.closest('.rechazar-certificado')) {
      const id = e.target.closest('.rechazar-certificado').dataset.id;
      await updateDoc(doc(db,'certificados',id),{estadoManual:'invalido'});
      await cargarCertificados();
    }
  });
  document.getElementById('filtro-estado').onchange = aplicarFiltros;
  document.getElementById('busqueda-certificados').oninput = aplicarFiltros;
  document.getElementById('scan-dni').addEventListener('change', async (e) => {
    const dni = e.target.value.trim();
    if (!dni) return;
    
    const cert = certificados.find(c => c.dni && c.dni.toString() === dni);
    if (cert) {
      alert(`Certificado de ${cert.nombre} ${cert.apellido} (${cert.dni}): ${cert.estado.toUpperCase()}`);
    } else {
      alert('No se encontró certificado para ese DNI');
    }
    e.target.value = '';
  });
  document.getElementById('logout').onclick = async () => {
    try {
      await signOut(auth);
      sessionStorage.removeItem('usuario');
      window.location.href = 'index.html';
    } catch (error) {
      console.error("Error al cerrar sesión:", error);
      alert("Error al cerrar sesión");
    }
  };
} 