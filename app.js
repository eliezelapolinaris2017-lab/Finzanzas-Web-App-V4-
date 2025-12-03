// app.js — Nexus Finance V4
// UI renovada + localStorage + Firebase (Auth + Firestore)

/* =========================================================
   1. FIREBASE (rellena TU firebaseConfig aquí)
   ========================================================= */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";

// 🔧 PEGA AQUÍ TU CONFIGURACIÓN REAL DE FIREBASE
// (cuando me la pases, simplemente sustituyes estos valores)
const firebaseConfig = {
  apiKey: "AIzaSyC66vv3-yaap1mV2n1GXRUopLqccobWqRE",
  authDomain: "finanzas-web-f4e05.firebaseapp.com",
  projectId: "finanzas-web-f4e05",
  storageBucket: "finanzas-web-f4e05.firebasestorage.app",
  messagingSenderId: "1047152523619",
  appId: "1:1047152523619:web:7d8f7d1f7a5ccc6090bb56"
};

let fbApp = null;
let auth = null;
let db = null;
let fbUser = null;

try {
  fbApp = initializeApp(firebaseConfig);
  auth = getAuth(fbApp);
  db = getFirestore(fbApp);
} catch (err) {
  console.warn("Firebase no inicializado (revisa firebaseConfig):", err);
}

/* =========================================================
   2. ESTADO LOCAL (localStorage)
   ========================================================= */
const STORAGE_KEY_MOVIMIENTOS = "nexus-finance-v4-movimientos";
const STORAGE_KEY_CONFIG = "nexus-finance-v4-config";

let movimientos = [];
let config = {
  nombreNegocio: "",
  moneda: "$",
};

/* =========================================================
   3. UTILIDADES LOCAL
   ========================================================= */
function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_MOVIMIENTOS);
    movimientos = raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error("Error leyendo movimientos:", e);
    movimientos = [];
  }

  try {
    const rawCfg = localStorage.getItem(STORAGE_KEY_CONFIG);
    if (rawCfg) config = { ...config, ...JSON.parse(rawCfg) };
  } catch (e) {
    console.error("Error leyendo config:", e);
  }
}

function saveMovimientos() {
  localStorage.setItem(STORAGE_KEY_MOVIMIENTOS, JSON.stringify(movimientos));
}

function saveConfig() {
  localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify(config));
}

function formatMoney(value) {
  const num = Number(value) || 0;
  return `${config.moneda || "$"}${num.toFixed(2)}`;
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function sameDay(dateStr, dateRef) {
  return dateStr === dateRef;
}

function sameMonth(dateStr, dateRef) {
  if (!dateStr) return false;
  return dateStr.slice(0, 7) === dateRef.slice(0, 7);
}

/* =========================================================
   4. SYNC CON FIRESTORE
   ========================================================= */

// Documento donde guardamos todo para cada usuario
function cloudDocRef() {
  if (!db || !fbUser) return null;
  // Puedes cambiar el path si quieres
  return doc(db, "users", fbUser.uid, "apps", "nexus-finance-v4");
}

// Cargar datos desde la nube (reemplaza local)
async function cloudPullReplace() {
  const ref = cloudDocRef();
  if (!ref) return;

  try {
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      console.log("No hay datos en la nube todavía.");
      return;
    }
    const data = snap.data();

    if (Array.isArray(data.movimientos)) movimientos = data.movimientos;
    if (data.config) config = { ...config, ...data.config };

    saveMovimientos();
    saveConfig();
    renderKpis();
    renderTablas();
    updateCloudStatus("Datos cargados de la nube ✅");
  } catch (err) {
    console.error("Error en cloudPullReplace:", err);
    updateCloudStatus("Error al leer de la nube");
  }
}

// Guardar datos actuales en Firestore
async function cloudPush() {
  const ref = cloudDocRef();
  if (!ref) return;

  try {
    await setDoc(
      ref,
      {
        movimientos,
        config,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
    updateCloudStatus("Datos sincronizados en la nube ☁️");
  } catch (err) {
    console.error("Error en cloudPush:", err);
    updateCloudStatus("Error al guardar en la nube");
  }
}

/* =========================================================
   5. FECHA TOPBAR
   ========================================================= */
function renderTopbarDate() {
  const el = document.getElementById("topbar-date");
  if (!el) return;
  const now = new Date();
  const formato = now.toLocaleDateString("es-PR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  el.textContent = formato;
}

/* =========================================================
   6. KPIs
   ========================================================= */
function renderKpis() {
  const hoy = todayISO();

  let ingresosHoy = 0;
  let gastosHoy = 0;
  let ingresosMes = 0;
  let gastosMes = 0;

  movimientos.forEach((m) => {
    if (!m.fecha) return;
    const isIngreso = m.tipo === "ingreso";
    const monto = Number(m.monto) || 0;

    if (sameDay(m.fecha, hoy)) {
      if (isIngreso) ingresosHoy += monto;
      else gastosHoy += monto;
    }

    if (sameMonth(m.fecha, hoy)) {
      if (isIngreso) ingresosMes += monto;
      else gastosMes += monto;
    }
  });

  const balanceHoy = ingresosHoy - gastosHoy;
  const balanceMes = ingresosMes - gastosMes;

  const elIngHoy = document.getElementById("kpi-ingresos-hoy");
  const elGasHoy = document.getElementById("kpi-gastos-hoy");
  const elBalHoy = document.getElementById("kpi-balance-hoy");
  const elIngMes = document.getElementById("kpi-ingresos-mes");
  const elGasMes = document.getElementById("kpi-gastos-mes");
  const elBalMes = document.getElementById("kpi-balance-mes");
  const elMovMes = document.getElementById("kpi-movimientos-mes");
  const elUlt = document.getElementById("kpi-ultimo-movimiento");

  if (elIngHoy) elIngHoy.textContent = formatMoney(ingresosHoy);
  if (elGasHoy) elGasHoy.textContent = formatMoney(gastosHoy);
  if (elBalHoy) elBalHoy.textContent = formatMoney(balanceHoy);

  if (elIngMes) elIngMes.textContent = `Mes actual: ${formatMoney(ingresosMes)}`;
  if (elGasMes) elGasMes.textContent = `Mes actual: ${formatMoney(gastosMes)}`;
  if (elBalMes) elBalMes.textContent = `Balance mes: ${formatMoney(balanceMes)}`;

  const movMes = movimientos.filter((m) => sameMonth(m.fecha, hoy)).length;
  if (elMovMes) elMovMes.textContent = String(movMes);

  const ultimo = [...movimientos]
    .slice()
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))[0];

  if (elUlt) {
    if (ultimo) {
      const tipoTxt = ultimo.tipo === "ingreso" ? "Ingreso" : "Gasto";
      elUlt.textContent = `${tipoTxt} de ${formatMoney(ultimo.monto)} el ${ultimo.fecha}`;
    } else {
      elUlt.textContent = "Sin movimientos recientes";
    }
  }

  // Mostrar nombre de negocio (si lo configuraste)
  const brandName = document.getElementById("brand-name");
  if (brandName && config.nombreNegocio) {
    brandName.textContent = config.nombreNegocio;
  }
}

/* =========================================================
   7. TABLAS
   ========================================================= */
function buildRow(m) {
  const tr = document.createElement("tr");
  tr.innerHTML = `
    <td>${m.fecha || ""}</td>
    <td>${m.descripcion || ""}</td>
    <td>${m.categoria || ""}</td>
    <td>${m.metodo || ""}</td>
    <td class="right">${formatMoney(m.monto)}</td>
  `;
  return tr;
}

function renderTablas() {
  const tbodyIng = document.getElementById("tbody-ingresos");
  const tbodyGas = document.getElementById("tbody-gastos");
  const tbodyIngFull = document.getElementById("tbody-ingresos-full");
  const tbodyGasFull = document.getElementById("tbody-gastos-full");

  [tbodyIng, tbodyGas, tbodyIngFull, tbodyGasFull].forEach((tb) => {
    if (tb) tb.innerHTML = "";
  });

  const ingresos = movimientos.filter((m) => m.tipo === "ingreso");
  const gastos = movimientos.filter((m) => m.tipo === "gasto");

  const recientesIng = ingresos
    .slice()
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
    .slice(0, 10);
  const recientesGas = gastos
    .slice()
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
    .slice(0, 10);

  recientesIng.forEach((m) => tbodyIng && tbodyIng.appendChild(buildRow(m)));
  recientesGas.forEach((m) => tbodyGas && tbodyGas.appendChild(buildRow(m)));
  ingresos.forEach((m) => tbodyIngFull && tbodyIngFull.appendChild(buildRow(m)));
  gastos.forEach((m) => tbodyGasFull && tbodyGasFull.appendChild(buildRow(m)));
}

/* =========================================================
   8. MODAL DE NUEVO MOVIMIENTO
   ========================================================= */
const modal = {
  backdrop: null,
  tipoInput: null,
  fechaInput: null,
  descInput: null,
  catInput: null,
  metodoInput: null,
  montoInput: null,
  titleEl: null,

  open(tipo) {
    if (!this.backdrop) return;
    this.tipoInput.value = tipo || "ingreso";
    this.titleEl.textContent = tipo === "gasto" ? "Nuevo gasto" : "Nuevo ingreso";

    if (!this.fechaInput.value) {
      this.fechaInput.value = todayISO();
    }

    this.backdrop.classList.add("show");
  },

  close() {
    if (!this.backdrop) return;
    this.backdrop.classList.remove("show");
  },
};

function setupModal() {
  modal.backdrop = document.getElementById("modal-movimiento");
  modal.tipoInput = document.getElementById("mov-tipo");
  modal.fechaInput = document.getElementById("mov-fecha");
  modal.descInput = document.getElementById("mov-descripcion");
  modal.catInput = document.getElementById("mov-categoria");
  modal.metodoInput = document.getElementById("mov-metodo");
  modal.montoInput = document.getElementById("mov-monto");
  modal.titleEl = document.getElementById("modal-title");

  document.getElementById("btn-add-movimiento")?.addEventListener("click", () => {
    modal.open("ingreso");
  });

  document.querySelectorAll("[data-add]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const tipo = btn.getAttribute("data-add") === "gasto" ? "gasto" : "ingreso";
      modal.open(tipo);
    });
  });

  document.getElementById("modal-close")?.addEventListener("click", () => modal.close());
  document.getElementById("modal-cancel")?.addEventListener("click", () => modal.close());

  const form = document.getElementById("form-movimiento");
  form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const tipo = modal.tipoInput.value;
    const fecha = modal.fechaInput.value || todayISO();
    const descripcion = modal.descInput.value.trim();
    const categoria = modal.catInput.value.trim();
    const metodo = modal.metodoInput.value;
    const monto = Number(modal.montoInput.value);

    if (!descripcion || !categoria || !metodo || !fecha || !monto) {
      alert("Completa todos los campos y coloca un monto válido.");
      return;
    }

    const movimiento = {
      id: Date.now().toString(),
      tipo,
      fecha,
      descripcion,
      categoria,
      metodo,
      monto,
      createdAt: Date.now(),
    };

    movimientos.push(movimiento);
    saveMovimientos();
    renderKpis();
    renderTablas();

    // 🔄 Sincronizar con la nube si hay usuario conectado
    if (fbUser) {
      cloudPush().catch((err) => console.warn("No se pudo sincronizar:", err));
    }

    form.reset();
    modal.fechaInput.value = todayISO();
    modal.close();
  });
}

/* =========================================================
   9. NAVEGACIÓN SECCIONES
   ========================================================= */
function setupNavigation() {
  const navItems = document.querySelectorAll(".nav-item");
  const sections = document.querySelectorAll(".section");

  navItems.forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = btn.getAttribute("data-section");

      navItems.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");

      sections.forEach((sec) => {
        if (sec.id === `section-${target}`) {
          sec.classList.add("active-section");
        } else {
          sec.classList.remove("active-section");
        }
      });
    });
  });
}

/* =========================================================
   10. EXPORTAR CSV
   ========================================================= */
function movimientosToCsv(rows) {
  const header = ["tipo", "fecha", "descripcion", "categoria", "metodo", "monto"];
  const lines = [header.join(",")];

  rows.forEach((m) => {
    const line = [
      m.tipo,
      m.fecha,
      `"${(m.descripcion || "").replace(/"/g, '""')}"`,
      `"${(m.categoria || "").replace(/"/g, '""')}"`,
      m.metodo,
      m.monto,
    ];
    lines.push(line.join(","));
  });

  return lines.join("\n");
}

function downloadCsv(filename, csv) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function setupExportButtons() {
  document.getElementById("btn-export-ingresos")?.addEventListener("click", () => {
    const ingresos = movimientos.filter((m) => m.tipo === "ingreso");
    const csv = movimientosToCsv(ingresos);
    downloadCsv("ingresos.csv", csv);
  });

  document.getElementById("btn-export-gastos")?.addEventListener("click", () => {
    const gastos = movimientos.filter((m) => m.tipo === "gasto");
    const csv = movimientosToCsv(gastos);
    downloadCsv("gastos.csv", csv);
  });

  document.getElementById("btn-export-todo")?.addEventListener("click", () => {
    const csv = movimientosToCsv(movimientos);
    downloadCsv("movimientos-completos.csv", csv);
  });
}

/* =========================================================
   11. CONFIGURACIÓN BÁSICA
   ========================================================= */
function setupConfig() {
  const nombreInput = document.getElementById("config-nombre-negocio");
  const monedaInput = document.getElementById("config-moneda");

  if (nombreInput) nombreInput.value = config.nombreNegocio || "";
  if (monedaInput) monedaInput.value = config.moneda || "$";

  document.getElementById("btn-guardar-config")?.addEventListener("click", () => {
    if (nombreInput) config.nombreNegocio = nombreInput.value.trim();
    if (monedaInput) config.moneda = monedaInput.value.trim() || "$";
    saveConfig();
    renderKpis();

    if (fbUser) {
      cloudPush().catch((err) => console.warn("No se pudo sincronizar config:", err));
    }

    alert("Configuración guardada.");
  });
}

/* =========================================================
   12. AUTH UI (GOOGLE / LOGOUT)
   ========================================================= */
function updateCloudStatus(msg) {
  const el = document.getElementById("cloud-status");
  if (!el) return;
  if (fbUser) {
    const name = fbUser.displayName || fbUser.email || fbUser.uid;
    el.textContent = `${msg} — ${name}`;
  } else {
    el.textContent = msg || "Sincronización local (no conectado)";
  }
}

function setupAuth() {
  if (!auth) {
    console.warn("Firebase Auth no disponible (revisa config).");
    updateCloudStatus("Solo modo local (sin Firebase)");
    return;
  }

  const provider = new GoogleAuthProvider();
  const btnLogin = document.getElementById("btn-login-google");
  const btnLogout = document.getElementById("btn-logout");

  btnLogin?.addEventListener("click", async () => {
    try {
      await signInWithPopup(auth, provider);
      // El onAuthStateChanged se encargará del resto
    } catch (err) {
      console.error("Error al iniciar sesión:", err);
      alert("No se pudo iniciar sesión con Google.");
    }
  });

  btnLogout?.addEventListener("click", async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.error("Error al cerrar sesión:", err);
      alert("No se pudo cerrar sesión.");
    }
  });

  onAuthStateChanged(auth, async (user) => {
    fbUser = user || null;

    if (fbUser) {
      updateCloudStatus("Conectado ☁️");
      // Al conectarse, traemos los datos de la nube
      await cloudPullReplace();
    } else {
      updateCloudStatus("Solo modo local (no conectado)");
    }

    // Opcional: cambiar visibilidad de botones
    if (btnLogin) btnLogin.style.display = fbUser ? "none" : "inline-flex";
    if (btnLogout) btnLogout.style.display = fbUser ? "inline-flex" : "none";
  });
}

/* =========================================================
   13. SERVICE WORKER
   ========================================================= */
function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker
      .register("./service-worker.js")
      .catch((err) => console.warn("SW error:", err));
  }
}

/* =========================================================
   14. INIT
   ========================================================= */
document.addEventListener("DOMContentLoaded", () => {
  loadFromStorage();
  renderTopbarDate();
  setupNavigation();
  setupModal();
  setupExportButtons();
  setupConfig();
  setupAuth(); // Google + Firestore
  registerServiceWorker();
  renderKpis();
  renderTablas();
});
