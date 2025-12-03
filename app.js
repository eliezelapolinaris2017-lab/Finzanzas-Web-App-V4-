// app.js — Nexus Finance V4
// Dashboard + LocalStorage + Firebase Auth + Sync Firestore
// RECUERDA: <script type="module" src="app.js?v=4"></script> en index.html

/* ==========================
   1. Firebase (modular v10)
   ========================== */

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
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";

// ⚠️ Usa la misma config que tu proyecto de Firebase
const firebaseConfig = {
  apiKey: "AIzaSyC66vv3-yaap1mV2n1GXRUopLqccobWqRE",
  authDomain: "finanzas-web-f4e05.firebaseapp.com",
  projectId: "finanzas-web-f4e05",
  storageBucket: "finanzas-web-f4e05.firebasestorage.app",
  messagingSenderId: "1047152523619",
  appId: "1:1047152523619:web:7d8f7d1f7a5ccc6090bb56"
};

const fbApp = initializeApp(firebaseConfig);
const auth = getAuth(fbApp);
const db   = getFirestore(fbApp);
const provider = new GoogleAuthProvider();

let currentUser = null; // usuario logueado

/* ==========================
   2. Estado local
   ========================== */

const STORAGE_KEY_MOVIMIENTOS = "nexus-finance-v4-movimientos";
const STORAGE_KEY_CONFIG      = "nexus-finance-v4-config";

let movimientos = [];
let config = {
  nombreNegocio: "",
  moneda: "$",
};

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

/* ==========================
   3. Utils
   ========================== */

function formatMoney(value) {
  const num = Number(value) || 0;
  const symbol = config.moneda || "$";
  return `${symbol}${num.toFixed(2)}`;
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function sameDay(dateStr, ref) {
  return dateStr === ref;
}

function sameMonth(dateStr, ref) {
  if (!dateStr) return false;
  return dateStr.slice(0, 7) === ref.slice(0, 7);
}

/* ==========================
   4. UI: Fecha topbar
   ========================== */

function renderTopbarDate() {
  const el = document.getElementById("topbar-date");
  if (!el) return;
  const now = new Date();
  el.textContent = now.toLocaleDateString("es-PR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/* ==========================
   5. KPIs Dashboard
   ========================== */

function renderKpis() {
  const hoy = todayISO();

  let ingresosHoy = 0;
  let gastosHoy   = 0;
  let ingresosMes = 0;
  let gastosMes   = 0;

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
  const movimientosMes = movimientos.filter((m) => sameMonth(m.fecha, hoy)).length;

  const elInHoy   = document.getElementById("kpi-ingresos-hoy");
  const elGaHoy   = document.getElementById("kpi-gastos-hoy");
  const elBaHoy   = document.getElementById("kpi-balance-hoy");
  const elInMes   = document.getElementById("kpi-ingresos-mes");
  const elGaMes   = document.getElementById("kpi-gastos-mes");
  const elBaMes   = document.getElementById("kpi-balance-mes");
  const elMovMes  = document.getElementById("kpi-movimientos-mes");
  const elUltMov  = document.getElementById("kpi-ultimo-movimiento");

  if (elInHoy)  elInHoy.textContent  = formatMoney(ingresosHoy);
  if (elGaHoy)  elGaHoy.textContent  = formatMoney(gastosHoy);
  if (elBaHoy)  elBaHoy.textContent  = formatMoney(balanceHoy);
  if (elInMes)  elInMes.textContent  = `Mes actual: ${formatMoney(ingresosMes)}`;
  if (elGaMes)  elGaMes.textContent  = `Mes actual: ${formatMoney(gastosMes)}`;
  if (elBaMes)  elBaMes.textContent  = `Balance mes: ${formatMoney(balanceMes)}`;
  if (elMovMes) elMovMes.textContent = String(movimientosMes);

  if (elUltMov) {
    const ultimo = [...movimientos]
      .slice()
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))[0];
    if (ultimo) {
      const tipoTxt = ultimo.tipo === "ingreso" ? "Ingreso" : "Gasto";
      elUltMov.textContent = `${tipoTxt} de ${formatMoney(ultimo.monto)} el ${ultimo.fecha}`;
    } else {
      elUltMov.textContent = "Sin movimientos recientes";
    }
  }
}

/* ==========================
   6. Tablas
   ========================== */

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
  const tbodyIng     = document.getElementById("tbody-ingresos");
  const tbodyGas     = document.getElementById("tbody-gastos");
  const tbodyIngFull = document.getElementById("tbody-ingresos-full");
  const tbodyGasFull = document.getElementById("tbody-gastos-full");

  [tbodyIng, tbodyGas, tbodyIngFull, tbodyGasFull].forEach((tb) => {
    if (tb) tb.innerHTML = "";
  });

  const ingresos = movimientos.filter((m) => m.tipo === "ingreso");
  const gastos   = movimientos.filter((m) => m.tipo === "gasto");

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

/* ==========================
   7. Modal de movimiento
   ========================== */

const modal = {
  backdrop:   null,
  tipoInput:  null,
  fechaInput: null,
  descInput:  null,
  catInput:   null,
  metodoInput:null,
  montoInput: null,
  titleEl:    null,

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
  modal.backdrop   = document.getElementById("modal-movimiento");
  modal.tipoInput  = document.getElementById("mov-tipo");
  modal.fechaInput = document.getElementById("mov-fecha");
  modal.descInput  = document.getElementById("mov-descripcion");
  modal.catInput   = document.getElementById("mov-categoria");
  modal.metodoInput= document.getElementById("mov-metodo");
  modal.montoInput = document.getElementById("mov-monto");
  modal.titleEl    = document.getElementById("modal-title");

  // botón topbar
  document.getElementById("btn-add-movimiento")?.addEventListener("click", () => {
    modal.open("ingreso");
  });

  // botones dentro de secciones
  document.querySelectorAll("[data-add]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const tipo = btn.getAttribute("data-add") === "gasto" ? "gasto" : "ingreso";
      modal.open(tipo);
    });
  });

  document.getElementById("modal-close")?.addEventListener("click", () => modal.close());
  document.getElementById("modal-cancel")?.addEventListener("click", () => modal.close());

  const form = document.getElementById("form-movimiento");
  form?.addEventListener("submit", (e) => {
    e.preventDefault();
    const tipo        = modal.tipoInput.value;
    const fecha       = modal.fechaInput.value || todayISO();
    const descripcion = modal.descInput.value.trim();
    const categoria   = modal.catInput.value.trim();
    const metodo      = modal.metodoInput.value;
    const monto       = Number(modal.montoInput.value);

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

    form.reset();
    modal.fechaInput.value = todayISO();
    modal.close();
  });
}

/* ==========================
   8. Navegación secciones
   ========================== */

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

/* ==========================
   9. Exportar CSV
   ========================== */

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
  const a   = document.createElement("a");
  a.href    = url;
  a.download= filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function setupExportButtons() {
  document.getElementById("btn-export-ingresos")?.addEventListener("click", () => {
    const ingresos = movimientos.filter((m) => m.tipo === "ingreso");
    downloadCsv("ingresos.csv", movimientosToCsv(ingresos));
  });

  document.getElementById("btn-export-gastos")?.addEventListener("click", () => {
    const gastos = movimientos.filter((m) => m.tipo === "gasto");
    downloadCsv("gastos.csv", movimientosToCsv(gastos));
  });

  document.getElementById("btn-export-todo")?.addEventListener("click", () => {
    downloadCsv("movimientos-completos.csv", movimientosToCsv(movimientos));
  });
}

/* ==========================
   🔧 10. Configuración
   ========================== */

function setupConfig() {
  const nombreInput = document.getElementById("config-nombre-negocio");
  const monedaInput = document.getElementById("config-moneda");

  if (nombreInput) nombreInput.value = config.nombreNegocio || "";
  if (monedaInput) monedaInput.value = config.moneda || "$";

  document.getElementById("btn-guardar-config")?.addEventListener("click", () => {
    if (nombreInput) config.nombreNegocio = nombreInput.value.trim();
    if (monedaInput) config.moneda       = monedaInput.value.trim() || "$";
    saveConfig();
    renderKpis();
    alert("Configuración guardada.");
  });
}

/* ==========================
   11. Service Worker (simple)
   ========================== */

function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker
      .register("./service-worker.js")
      .catch((err) => console.warn("SW error:", err));
  }
}

/* ==========================
   12. Firebase Auth + Sync
   ========================== */

// Ruta compatible con tus reglas:
//
// match /users/{uid}/state/{docId} { ... }
function getCloudDocRef() {
  if (!currentUser) return null;
  return doc(db, "users", currentUser.uid, "state", "app");
}

// UI de auth / nube (opcionales, no rompe si no existen)
function updateAuthUI() {
  const statusEl = document.getElementById("cloud-status");
  const loginBtn = document.getElementById("btn-login-google");
  const logoutBtn= document.getElementById("btn-logout");

  if (statusEl) {
    if (currentUser) {
      statusEl.textContent = currentUser.displayName || currentUser.email || "Conectado";
    } else {
      statusEl.textContent = "Modo local (sin sesión)";
    }
  }

  if (loginBtn)  loginBtn.style.display  = currentUser ? "none" : "inline-flex";
  if (logoutBtn) logoutBtn.style.display = currentUser ? "inline-flex" : "inline-flex"; // ya existe en sidebar
}

async function handleLoginGoogle() {
  try {
    await signInWithPopup(auth, provider);
  } catch (e) {
    console.error("Error login Google:", e);
    alert("No se pudo iniciar sesión con Google.");
  }
}

async function handleLogout() {
  try {
    await signOut(auth);
    alert("Sesión cerrada.");
  } catch (e) {
    console.error("Error al cerrar sesión:", e);
    alert("No se pudo cerrar sesión.");
  }
}

async function cloudPullReplace() {
  if (!currentUser) {
    alert("Primero inicia sesión con Google.");
    return;
  }
  try {
    const ref  = getCloudDocRef();
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      alert("No hay datos en la nube todavía.");
      return;
    }
    const remote = snap.data() || {};
    console.log("Datos remotos:", remote);

    movimientos = Array.isArray(remote.movimientos) ? remote.movimientos : [];
    config      = { ...config, ...(remote.config || {}) };

    saveMovimientos();
    saveConfig();
    renderKpis();
    renderTablas();
    setupConfig(); // recarga inputs

    alert("Datos cargados desde la nube.");
  } catch (err) {
    console.error("Error en cloudPullReplace:", err);
    alert("Error al leer de la nube: " + (err.code || err.message));
  }
}

async function cloudPushReplace() {
  if (!currentUser) {
    alert("Primero inicia sesión con Google.");
    return;
  }
  try {
    const ref = getCloudDocRef();
    await setDoc(ref, {
      movimientos,
      config,
      updatedAt: new Date().toISOString(),
    });
    alert("Datos guardados en la nube.");
  } catch (err) {
    console.error("Error en cloudPushReplace:", err);
    alert("Error al guardar en la nube: " + (err.code || err.message));
  }
}

function setupCloudUI() {
  const loginBtn   = document.getElementById("btn-login-google");
  const logoutBtn  = document.getElementById("btn-logout");
  const pullBtn    = document.getElementById("btn-cloud-pull");
  const pushBtn    = document.getElementById("btn-cloud-push");

  loginBtn?.addEventListener("click", handleLoginGoogle);
  logoutBtn?.addEventListener("click", handleLogout);
  pullBtn?.addEventListener("click", cloudPullReplace);
  pushBtn?.addEventListener("click", cloudPushReplace);

  onAuthStateChanged(auth, (user) => {
    currentUser = user || null;
    console.log("Auth:", currentUser ? currentUser.uid : "NO LOGUEADO");
    updateAuthUI();
  });
}

/* ==========================
   13. INIT
   ========================== */

document.addEventListener("DOMContentLoaded", () => {
  loadFromStorage();
  renderTopbarDate();
  setupNavigation();
  setupModal();
  setupExportButtons();
  setupConfig();
  registerServiceWorker();
  renderKpis();
  renderTablas();
  setupCloudUI();
});
