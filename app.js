// ======================================================
// Nexus Finance — Escritorio
// Solo localStorage (sin Firebase), KPIs + Facturas + PDF
// ======================================================

// ====== CLAVES STORAGE ======
const LS_MOVIMIENTOS = "nf-movimientos";
const LS_FACTURAS   = "nf-facturas";
const LS_CONFIG     = "nf-config";
const LS_PIN        = "nf-pin";
const LS_LOGGED     = "nf-logged";

// ====== ESTADO EN MEMORIA ======
let movimientos = [];   // {id, tipo: 'ingreso'|'gasto', fecha, descripcion, categoria, metodo, monto, createdAt}
let facturas   = [];   // {id, numero, fecha, cliente, clienteDireccion, metodo, taxPercent, notas, items[], subtotal, taxAmount, total, createdAt, movimientoId}
let config     = {
  businessName: "Mi Negocio",
  address: "",
  phone: "",
  email: "",
  currency: "$",
  logoBase64: "" // base64 para PDF
};
let pinValue   = null;
let isLogged   = false;
let jsPDFReady = false;

// ====== UTILIDADES GENERALES ======
function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function sameDay(d1, d2) {
  return d1 === d2;
}

function sameMonth(d1, ref) {
  return d1 && d1.slice(0, 7) === ref.slice(0, 7);
}

function formatMoney(value) {
  const num = Number(value) || 0;
  return `${config.currency || "$"}${num.toFixed(2)}`;
}

// ====== LOCAL STORAGE ======
function loadState() {
  try {
    const raw = localStorage.getItem(LS_MOVIMIENTOS);
    movimientos = raw ? JSON.parse(raw) : [];
  } catch {
    movimientos = [];
  }

  try {
    const raw = localStorage.getItem(LS_FACTURAS);
    facturas = raw ? JSON.parse(raw) : [];
  } catch {
    facturas = [];
  }

  try {
    const raw = localStorage.getItem(LS_CONFIG);
    if (raw) {
      config = { ...config, ...JSON.parse(raw) };
    }
  } catch {
    // ignore
  }

  try {
    pinValue = localStorage.getItem(LS_PIN);
  } catch {
    pinValue = null;
  }

  try {
    isLogged = localStorage.getItem(LS_LOGGED) === "true";
  } catch {
    isLogged = false;
  }
}

function saveMovimientos() {
  localStorage.setItem(LS_MOVIMIENTOS, JSON.stringify(movimientos));
}

function saveFacturas() {
  localStorage.setItem(LS_FACTURAS, JSON.stringify(facturas));
}

function saveConfig() {
  localStorage.setItem(LS_CONFIG, JSON.stringify(config));
}

function setPin(pin) {
  pinValue = pin;
  localStorage.setItem(LS_PIN, pin);
}

function setLogged(flag) {
  isLogged = !!flag;
  localStorage.setItem(LS_LOGGED, flag ? "true" : "false");
}

// ====== RENDER TOPBAR ======
function renderTopbarDate() {
  const el = document.getElementById("topbar-date");
  if (!el) return;
  const now = new Date();
  const txt = now.toLocaleDateString("es-PR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
  el.textContent = txt;
}

// ====== KPIs ======
function renderKpis() {
  const hoy = todayISO();
  const mes = hoy.slice(0, 7);

  let incHoy = 0;
  let gasHoy = 0;
  let incMes = 0;
  let gasMes = 0;

  movimientos.forEach((m) => {
    if (!m.fecha) return;
    const isIngreso = m.tipo === "ingreso";
    const monto = Number(m.monto) || 0;

    if (sameDay(m.fecha, hoy)) {
      if (isIngreso) incHoy += monto;
      else gasHoy += monto;
    }
    if (sameMonth(m.fecha, hoy)) {
      if (isIngreso) incMes += monto;
      else gasMes += monto;
    }
  });

  const balHoy = incHoy - gasHoy;
  const balMes = incMes - gasMes;

  document.getElementById("kpi-ingresos-hoy").textContent = formatMoney(incHoy);
  document.getElementById("kpi-gastos-hoy").textContent = formatMoney(gasHoy);
  document.getElementById("kpi-balance-hoy").textContent = formatMoney(balHoy);
  document.getElementById("kpi-ingresos-mes").textContent = `Mes actual: ${formatMoney(incMes)}`;
  document.getElementById("kpi-gastos-mes").textContent = `Mes actual: ${formatMoney(gasMes)}`;
  document.getElementById("kpi-balance-mes").textContent = `Balance mes: ${formatMoney(balMes)}`;

  const movMes = movimientos.filter((m) => sameMonth(m.fecha, hoy)).length;
  document.getElementById("kpi-movimientos-mes").textContent = movMes.toString();

  const ultimo = [...movimientos].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))[0];
  const elUlt = document.getElementById("kpi-ultimo-movimiento");
  if (ultimo) {
    const tipoTxt = ultimo.tipo === "ingreso" ? "Ingreso" : "Gasto";
    elUlt.textContent = `${tipoTxt} de ${formatMoney(ultimo.monto)} el ${ultimo.fecha}`;
  } else {
    elUlt.textContent = "Sin movimientos recientes";
  }
}

// ====== TABLAS INGRESOS / GASTOS ======
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
