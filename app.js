// app.js — Nexus Finance UI renovado
// Maneja navegación, movimientos y KPIs usando localStorage

const STORAGE_KEY_MOVIMIENTOS = "nexus-finance-movimientos";
const STORAGE_KEY_CONFIG = "nexus-finance-config";

let movimientos = [];
let config = {
  nombreNegocio: "",
  moneda: "$",
};

// ====== UTILIDADES ======
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

// ====== RENDER FECHA TOPBAR ======
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

// ====== RENDER KPIs ======
function renderKpis() {
  const hoy = todayISO();
  const mesActual = hoy.slice(0, 7);

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

  document.getElementById("kpi-ingresos-hoy").textContent = formatMoney(ingresosHoy);
  document.getElementById("kpi-gastos-hoy").textContent = formatMoney(gastosHoy);
  document.getElementById("kpi-balance-hoy").textContent = formatMoney(balanceHoy);
  document.getElementById("kpi-ingresos-mes").textContent = `Mes actual: ${formatMoney(ingresosMes)}`;
  document.getElementById("kpi-gastos-mes").textContent = `Mes actual: ${formatMoney(gastosMes)}`;
  document.getElementById("kpi-balance-mes").textContent = `Balance mes: ${formatMoney(balanceMes)}`;
  document.getElementById("kpi-movimientos-mes").textContent = movimientos.filter((m) =>
    sameMonth(m.fecha, hoy)
  ).length;

  const ultimo = [...movimientos].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))[0];
  const elUlt = document.getElementById("kpi-ultimo-movimiento");
  if (ultimo) {
    const tipoTxt = ultimo.tipo === "ingreso" ? "Ingreso" : "Gasto";
    elUlt.textContent = `${tipoTxt} de ${formatMoney(ultimo.monto)} el ${ultimo.fecha}`;
  } else {
    elUlt.textContent = "Sin movimientos recientes";
  }
}

// ====== RENDER TABLAS ======
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

// ====== MODAL ======
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
  form?.addEventListener("submit", (e) => {
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

    form.reset();
    modal.fechaInput.value = todayISO();
    modal.close();
  });
}

// ====== NAVEGACIÓN SECCIONES ======
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

// ====== EXPORTAR CSV ======
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

// ====== CONFIG ======
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
    alert("Configuración guardada.");
  });
}

// ====== LOGOUT (placeholder) ======
function setupLogout() {
  const btn = document.getElementById("btn-logout");
  if (!btn) return;
  btn.addEventListener("click", () => {
    // Aquí puedes integrar tu lógica real de Firebase Auth signOut()
    alert("Aquí iría el cierre de sesión real con Firebase Auth.");
  });
}

// ====== SERVICE WORKER (si existe) ======
function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker
      .register("./service-worker.js")
      .catch((err) => console.warn("SW error:", err));
  }
}

// ====== INIT ======
document.addEventListener("DOMContentLoaded", () => {
  loadFromStorage();
  renderTopbarDate();
  setupNavigation();
  setupModal();
  setupExportButtons();
  setupConfig();
  setupLogout();
  registerServiceWorker();
  renderKpis();
  renderTablas();
});
