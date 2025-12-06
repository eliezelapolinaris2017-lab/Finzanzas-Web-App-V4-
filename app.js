// app.js — Nexus Finance Web V4
// Solo localStorage. Escritorio. Sin Firebase.

// ======== CLAVES LOCALSTORAGE ========
const STORAGE_KEYS = {
  MOVIMIENTOS: "nexus-finance-movimientos",
  FACTURAS: "nexus-finance-facturas",
  COTIZACIONES: "nexus-finance-cotizaciones",
  CLIENTES: "nexus-finance-clientes",
  CONFIG: "nexus-finance-config",
};

// ======== ESTADO GLOBAL ========
let movimientos = [];   // ingresos + gastos
let facturas = [];
let cotizaciones = [];
let clientes = [];
let config = {
  nombreNegocio: "",
  direccion: "",
  telefono: "",
  email: "",
  moneda: "$",
  pinAcceso: "1234",
  pdfLogo: null, // base64
};

let currentMovEditId = null;
let currentFacturaId = null;
let currentCotizacionId = null;
let currentClienteId = null;

// ======== UTILIDADES GENERALES ========
function loadFromStorage() {
  try {
    movimientos = JSON.parse(localStorage.getItem(STORAGE_KEYS.MOVIMIENTOS)) || [];
  } catch {
    movimientos = [];
  }
  try {
    facturas = JSON.parse(localStorage.getItem(STORAGE_KEYS.FACTURAS)) || [];
  } catch {
    facturas = [];
  }
  try {
    cotizaciones = JSON.parse(localStorage.getItem(STORAGE_KEYS.COTIZACIONES)) || [];
  } catch {
    cotizaciones = [];
  }
  try {
    clientes = JSON.parse(localStorage.getItem(STORAGE_KEYS.CLIENTES)) || [];
  } catch {
    clientes = [];
  }
  try {
    const rawCfg = localStorage.getItem(STORAGE_KEYS.CONFIG);
    if (rawCfg) config = { ...config, ...JSON.parse(rawCfg) };
  } catch {
    // deja config por defecto
  }
}

function saveMovimientos() {
  localStorage.setItem(STORAGE_KEYS.MOVIMIENTOS, JSON.stringify(movimientos));
}
function saveFacturas() {
  localStorage.setItem(STORAGE_KEYS.FACTURAS, JSON.stringify(facturas));
}
function saveCotizaciones() {
  localStorage.setItem(STORAGE_KEYS.COTIZACIONES, JSON.stringify(cotizaciones));
}
function saveClientes() {
  localStorage.setItem(STORAGE_KEYS.CLIENTES, JSON.stringify(clientes));
}
function saveConfig() {
  localStorage.setItem(STORAGE_KEYS.CONFIG, JSON.stringify(config));
}

function formatMoney(v) {
  const n = Number(v) || 0;
  return `${config.moneda || "$"}${n.toFixed(2)}`;
}
function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
function sameDay(a, b) {
  return a === b;
}
function sameMonth(a, b) {
  return a && b && a.slice(0, 7) === b.slice(0, 7);
}
function renderTopbarDate() {
  const el = document.getElementById("topbar-date");
  if (!el) return;
  el.textContent = new Date().toLocaleDateString("es-PR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

// ======== LOGIN POR PIN ========
function setupPinLogin() {
  const loginScreen = document.getElementById("login-screen");
  const pinForm = document.getElementById("pin-form");
  const pinInput = document.getElementById("pin-input");
  const pinError = document.getElementById("pin-error");

  if (!loginScreen || !pinForm || !pinInput) return;

  pinForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const pin = pinInput.value.trim();
    if (pin === (config.pinAcceso || "1234")) {
      loginScreen.classList.add("hidden");
      pinInput.value = "";
      if (pinError) pinError.textContent = "";
    } else {
      if (pinError) pinError.textContent = "PIN incorrecto. Inténtalo de nuevo.";
    }
  });
}

// ======== KPIs DASHBOARD ========
function renderKpis() {
  const hoy = todayISO();

  let ingHoy = 0;
  let gasHoy = 0;
  let ingMes = 0;
  let gasMes = 0;

  movimientos.forEach((m) => {
    if (!m.fecha) return;
    const monto = Number(m.monto) || 0;
    const esIngreso = m.tipo === "ingreso";

    if (sameDay(m.fecha, hoy)) {
      if (esIngreso) ingHoy += monto;
      else gasHoy += monto;
    }
    if (sameMonth(m.fecha, hoy)) {
      if (esIngreso) ingMes += monto;
      else gasMes += monto;
    }
  });

  const balHoy = ingHoy - gasHoy;
  const balMes = ingMes - gasMes;
  const movMes = movimientos.filter((m) => sameMonth(m.fecha, hoy)).length;

  const set = (id, text) => {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  };

  set("kpi-ingresos-hoy", formatMoney(ingHoy));
  set("kpi-gastos-hoy", formatMoney(gasHoy));
  set("kpi-balance-hoy", formatMoney(balHoy));
  set("kpi-ingresos-mes", `Mes actual: ${formatMoney(ingMes)}`);
  set("kpi-gastos-mes", `Mes actual: ${formatMoney(gasMes)}`);
  set("kpi-balance-mes", `Balance mes: ${formatMoney(balMes)}`);
  set("kpi-movimientos-mes", movMes.toString());

  const elUlt = document.getElementById("kpi-ultimo-movimiento");
  if (elUlt) {
    const ultimo = [...movimientos].sort(
      (a, b) => (b.createdAt || 0) - (a.createdAt || 0)
    )[0];
    if (!ultimo) {
      elUlt.textContent = "Sin movimientos recientes";
    } else {
      const tipoTxt = ultimo.tipo === "ingreso" ? "Ingreso" : "Gasto";
      elUlt.textContent = `${tipoTxt} de ${formatMoney(
        ultimo.monto
      )} el ${ultimo.fecha}`;
    }
  }
}

// ======== TABLAS INGRESOS / GASTOS ========
function buildMovRow(m, withActions) {
  const tr = document.createElement("tr");
  tr.dataset.id = m.id;
  tr.innerHTML = `
    <td>${m.fecha || ""}</td>
    <td>${m.descripcion || ""}</td>
    <td>${m.categoria || ""}</td>
    <td>${m.metodo || ""}</td>
    <td class="right">${formatMoney(m.monto)}</td>
    ${
      withActions
        ? `<td class="right">
            <button class="btn-chip" data-action="edit-mov">Editar</button>
            <button class="btn-chip-danger" data-action="delete-mov">Borrar</button>
           </td>`
        : ""
    }
  `;
  return tr;
}

function renderTablasMovimientos() {
  const tbIng = document.getElementById("tbody-ingresos");
  const tbGas = document.getElementById("tbody-gastos");
  const tbIngFull = document.getElementById("tbody-ingresos-full");
  const tbGasFull = document.getElementById("tbody-gastos-full");

  [tbIng, tbGas, tbIngFull, tbGasFull].forEach((tb) => tb && (tb.innerHTML = ""));

  const ingresos = movimientos.filter((m) => m.tipo === "ingreso");
  const gastos = movimientos.filter((m) => m.tipo === "gasto");

  const recIng = ingresos
    .slice()
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
    .slice(0, 10);
  const recGas = gastos
    .slice()
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
    .slice(0, 10);

  recIng.forEach((m) => tbIng && tbIng.appendChild(buildMovRow(m, false)));
  recGas.forEach((m) => tbGas && tbGas.appendChild(buildMovRow(m, false)));

  ingresos.forEach((m) => tbIngFull && tbIngFull.appendChild(buildMovRow(m, true)));
  gastos.forEach((m) => tbGasFull && tbGasFull.appendChild(buildMovRow(m, true)));
}

function setupMovimientosActions() {
  const tbIngFull = document.getElementById("tbody-ingresos-full");
  const tbGasFull = document.getElementById("tbody-gastos-full");

  function handler(e) {
    const btn = e.target;
    if (!btn.dataset.action) return;
    const tr = btn.closest("tr");
    if (!tr) return;
    const id = tr.dataset.id;
    const mov = movimientos.find((m) => m.id === id);
    if (!mov) return;

    if (btn.dataset.action === "delete-mov") {
      if (!confirm("¿Borrar este movimiento?")) return;
      movimientos = movimientos.filter((m) => m.id !== id);
      saveMovimientos();
      renderKpis();
      renderTablasMovimientos();
    } else if (btn.dataset.action === "edit-mov") {
      currentMovEditId = mov.id;
      openMovModal(mov);
    }
  }

  tbIngFull && tbIngFull.addEventListener("click", handler);
  tbGasFull && tbGasFull.addEventListener("click", handler);
}

// ======== MODAL MOVIMIENTO ========
const movModal = {
  backdrop: null,
  tipo: null,
  fecha: null,
  desc: null,
  cat: null,
  metodo: null,
  monto: null,
  title: null,
};

function openMovModal(m) {
  if (!movModal.backdrop) return;
  movModal.backdrop.classList.add("show");

  const isEdit = !!m;
  movModal.title.textContent = isEdit
    ? m.tipo === "gasto"
      ? "Editar gasto"
      : "Editar ingreso"
    : "Nuevo movimiento";

  movModal.tipo.value = m?.tipo || "ingreso";
  movModal.fecha.value = m?.fecha || todayISO();
  movModal.desc.value = m?.descripcion || "";
  movModal.cat.value = m?.categoria || "";
  movModal.metodo.value = m?.metodo || "Efectivo";
  movModal.monto.value = m?.monto != null ? m.monto : "";
}

function closeMovModal() {
  movModal.backdrop && movModal.backdrop.classList.remove("show");
  currentMovEditId = null;
}

function setupMovModal() {
  movModal.backdrop = document.getElementById("modal-movimiento");
  if (!movModal.backdrop) return;

  movModal.tipo = document.getElementById("mov-tipo");
  movModal.fecha = document.getElementById("mov-fecha");
  movModal.desc = document.getElementById("mov-descripcion");
  movModal.cat = document.getElementById("mov-categoria");
  movModal.metodo = document.getElementById("mov-metodo");
  movModal.monto = document.getElementById("mov-monto");
  movModal.title = document.getElementById("modal-title");

  document.getElementById("btn-add-movimiento")?.addEventListener("click", () =>
    openMovModal(null)
  );

  document.querySelectorAll("[data-add]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const tipo = btn.getAttribute("data-add") === "gasto" ? "gasto" : "ingreso";
      openMovModal({ tipo });
      movModal.tipo.value = tipo;
    });
  });

  document.getElementById("modal-close")?.addEventListener("click", closeMovModal);
  document.getElementById("modal-cancel")?.addEventListener("click", closeMovModal);

  const form = document.getElementById("form-movimiento");
  form?.addEventListener("submit", (e) => {
    e.preventDefault();

    const tipo = movModal.tipo.value;
    const fecha = movModal.fecha.value || todayISO();
    const descripcion = movModal.desc.value.trim();
    const categoria = movModal.cat.value.trim();
    const metodo = movModal.metodo.value;
    const monto = Number(movModal.monto.value);

    if (!descripcion || !categoria || !metodo || !fecha || !monto) {
      alert("Completa todos los campos con un monto válido.");
      return;
    }

    if (currentMovEditId) {
      const idx = movimientos.findIndex((m) => m.id === currentMovEditId);
      if (idx >= 0) {
        movimientos[idx] = {
          ...movimientos[idx],
          tipo,
          fecha,
          descripcion,
          categoria,
          metodo,
          monto,
        };
      }
    } else {
      movimientos.push({
        id: Date.now().toString(),
        tipo,
        fecha,
        descripcion,
        categoria,
        metodo,
        monto,
        createdAt: Date.now(),
      });
    }

    saveMovimientos();
    renderKpis();
    renderTablasMovimientos();
    closeMovModal();
  });
}

// ======== NAVEGACIÓN SECCIONES ========
function setupNavigation() {
  const navItems = document.querySelectorAll(".nav-item");
  const sections = document.querySelectorAll(".section");

  navItems.forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = btn.getAttribute("data-section");
      navItems.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      sections.forEach((sec) => {
        sec.id === `section-${target}`
          ? sec.classList.add("active-section")
          : sec.classList.remove("active-section");
      });
    });
  });
}

// ======== EXPORTAR CSV ========
function movimientosToCsv(rows) {
  const header = ["tipo", "fecha", "descripcion", "categoria", "metodo", "monto"];
  const lines = [header.join(",")];
  rows.forEach((m) => {
    lines.push(
      [
        m.tipo,
        m.fecha,
        `"${(m.descripcion || "").replace(/"/g, '""')}"`,
        `"${(m.categoria || "").replace(/"/g, '""')}"`,
        m.metodo,
        m.monto,
      ].join(",")
    );
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

// ======== CONFIGURACIÓN NEGOCIO ========
function setupConfig() {
  const nombre = document.getElementById("config-nombre-negocio");
  const dir = document.getElementById("config-direccion");
  const tel = document.getElementById("config-telefono");
  const email = document.getElementById("config-email");
  const moneda = document.getElementById("config-moneda");
  const pin = document.getElementById("config-pin");
  const logoFile = document.getElementById("config-logo-file");
  const logoPreview = document.getElementById("config-logo-preview");

  if (nombre) nombre.value = config.nombreNegocio || "";
  if (dir) dir.value = config.direccion || "";
  if (tel) tel.value = config.telefono || "";
  if (email) email.value = config.email || "";
  if (moneda) moneda.value = config.moneda || "$";
  if (pin) pin.value = config.pinAcceso || "1234";
  if (logoPreview && config.pdfLogo) logoPreview.src = config.pdfLogo;

  document.getElementById("btn-guardar-config")?.addEventListener("click", () => {
    if (nombre) config.nombreNegocio = nombre.value.trim();
    if (dir) config.direccion = dir.value.trim();
    if (tel) config.telefono = tel.value.trim();
    if (email) config.email = email.value.trim();
    if (moneda) config.moneda = moneda.value.trim() || "$";
    if (pin) config.pinAcceso = pin.value.trim() || "1234";
    saveConfig();
    renderKpis();
    alert("Configuración guardada.");
  });

  logoFile?.addEventListener("change", () => {
    const file = logoFile.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      config.pdfLogo = ev.target.result;
      if (logoPreview) logoPreview.src = config.pdfLogo;
      saveConfig();
    };
    reader.readAsDataURL(file);
  });
}

// ======== LOGOUT ========
function setupLogout() {
  const btn = document.getElementById("btn-logout");
  const loginScreen = document.getElementById("login-screen");
  const pinInput = document.getElementById("pin-input");
  btn?.addEventListener("click", () => {
    if (loginScreen) {
      loginScreen.classList.remove("hidden");
      if (pinInput) pinInput.value = "";
    } else {
      alert("Cerrar sesión: recarga la página.");
    }
  });
}

// ======== CLIENTES ========
function refreshClienteSelects() {
  const selects = [
    document.getElementById("fact-cliente-select"),
    document.getElementById("cot-cliente-select"),
  ];

  const ordered = clientes.slice().sort((a, b) =>
    (a.nombre || "").localeCompare(b.nombre || "", "es")
  );

  selects.forEach((sel) => {
    if (!sel) return;
    const current = sel.value;
    sel.innerHTML = `<option value="">— Seleccionar cliente —</option>`;
    ordered.forEach((c) => {
      const opt = document.createElement("option");
      opt.value = c.id;
      opt.textContent = c.nombre || "(sin nombre)";
      sel.appendChild(opt);
    });
    if (current) sel.value = current;
  });
}

function renderClientesTable() {
  const tbody = document.getElementById("tbody-clientes");
  if (!tbody) return;
  tbody.innerHTML = "";
  clientes
    .slice()
    .sort((a, b) => (a.nombre || "").localeCompare(b.nombre || "", "es"))
    .forEach((c) => {
      const tr = document.createElement("tr");
      tr.dataset.id = c.id;
      tr.innerHTML = `
        <td>${c.nombre || ""}</td>
        <td>${c.telefono || ""}</td>
        <td>${c.email || ""}</td>
        <td>${c.direccion || ""}</td>
        <td class="right">
          <button class="btn-chip" data-action="edit-cliente">Editar</button>
          <button class="btn-chip-danger" data-action="delete-cliente">Borrar</button>
        </td>
      `;
      tbody.appendChild(tr);
    });
}

function setupClientesModule() {
  const editor = document.getElementById("cliente-editor");
  const form = document.getElementById("cliente-form");
  const btnNuevo = document.getElementById("btn-nuevo-cliente");
  const btnClose = document.getElementById("cliente-editor-close");
  const btnCancel = document.getElementById("btn-cliente-cancel");
  const tbody = document.getElementById("tbody-clientes");

  if (!editor || !form || !btnNuevo || !tbody) return;

  const nombre = document.getElementById("cliente-nombre");
  const direccion = document.getElementById("cliente-direccion");
  const telefono = document.getElementById("cliente-telefono");
  const email = document.getElementById("cliente-email");
  const notas = document.getElementById("cliente-notas");

  function open(cliente) {
    editor.classList.add("editor-open");
    currentClienteId = cliente?.id || null;
    form.reset();
    if (cliente) {
      nombre.value = cliente.nombre || "";
      direccion.value = cliente.direccion || "";
      telefono.value = cliente.telefono || "";
      email.value = cliente.email || "";
      notas.value = cliente.notas || "";
    }
  }
  function close() {
    editor.classList.remove("editor-open");
    currentClienteId = null;
  }

  btnNuevo.addEventListener("click", () => open(null));
  btnClose?.addEventListener("click", close);
  btnCancel?.addEventListener("click", (e) => {
    e.preventDefault();
    close();
  });

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const nombreVal = nombre.value.trim();
    if (!nombreVal) {
      alert("El nombre del cliente es obligatorio.");
      return;
    }

    const doc = {
      id: currentClienteId || Date.now().toString(),
      nombre: nombreVal,
      direccion: direccion.value.trim(),
      telefono: telefono.value.trim(),
      email: email.value.trim(),
      notas: notas.value.trim(),
      createdAt: currentClienteId
        ? clientes.find((c) => c.id === currentClienteId)?.createdAt || Date.now()
        : Date.now(),
    };

    const idx = clientes.findIndex((c) => c.id === doc.id);
    if (idx >= 0) clientes[idx] = doc;
    else clientes.push(doc);

    saveClientes();
    renderClientesTable();
    refreshClienteSelects();
    close();
  });

  tbody.addEventListener("click", (e) => {
    const btn = e.target;
    if (!btn.dataset.action) return;
    const tr = btn.closest("tr");
    if (!tr) return;
    const id = tr.dataset.id;
    const cli = clientes.find((c) => c.id === id);
    if (!cli) return;

    if (btn.dataset.action === "edit-cliente") {
      open(cli);
    } else if (btn.dataset.action === "delete-cliente") {
      if (!confirm("¿Borrar este cliente? Esto no borra sus facturas ni cotizaciones existentes.")) return;
      clientes = clientes.filter((c) => c.id !== id);
      saveClientes();
      renderClientesTable();
      refreshClienteSelects();
    }
  });

  renderClientesTable();
  refreshClienteSelects();
}

// ======== FACTURAS & COTIZACIONES (EDITOR CENTRAL) ========

// helper: crea fila de item en una tabla de items
function addItemRow(tbodyId, onChangeTotals) {
  const tbody = document.getElementById(tbodyId);
  if (!tbody) return;
  const tr = document.createElement("tr");
  tr.innerHTML = `
    <td><input type="text" data-field="descripcion" placeholder="Descripción"></td>
    <td><input type="number" min="0" step="1" data-field="cantidad" value="1"></td>
    <td><input type="number" min="0" step="0.01" data-field="precio" value="0"></td>
    <td><input type="number" min="0" step="0.01" data-field="impuesto" value="0"></td>
    <td class="right"><span data-field="total-linea">${formatMoney(0)}</span></td>
    <td class="right">
      <button type="button" class="btn-chip-danger" data-action="delete-item">✕</button>
    </td>
  `;
  tbody.appendChild(tr);
  onChangeTotals();
}

function collectItemsFromTable(tbodyId) {
  const tbody = document.getElementById(tbodyId);
  if (!tbody) return [];
  return [...tbody.querySelectorAll("tr")].map((tr) => {
    const get = (sel) => tr.querySelector(sel);
    return {
      descripcion: get("[data-field='descripcion']")?.value || "",
      cantidad: Number(get("[data-field='cantidad']")?.value || 0),
      precio: Number(get("[data-field='precio']")?.value || 0),
      impuesto: Number(get("[data-field='impuesto']")?.value || 0),
    };
  });
}

function recalcDocTotals(tbodyId, subId, impId, totId) {
  const items = collectItemsFromTable(tbodyId);
  let subtotal = 0;
  let impuesto = 0;

  const tbody = document.getElementById(tbodyId);

  items.forEach((it, idx) => {
    const line = it.cantidad * it.precio;
    subtotal += line;
    impuesto += (line * (it.impuesto || 0)) / 100;

    if (tbody) {
      const tr = tbody.querySelectorAll("tr")[idx];
      const span = tr?.querySelector("[data-field='total-linea']");
      if (span) span.textContent = formatMoney(line);
    }
  });

  const total = subtotal + impuesto;

  const subEl = document.getElementById(subId);
  const impEl = document.getElementById(impId);
  const totEl = document.getElementById(totId);

  if (subEl) subEl.textContent = formatMoney(subtotal);
  if (impEl) impEl.textContent = formatMoney(impuesto);
  if (totEl) totEl.textContent = formatMoney(total);

  return { items, subtotal, impuesto, total };
}

// ---------- INTEGRACIÓN CLIENTE → FACTURA / COTIZACIÓN ----------
function applyClienteToFactura(cli) {
  if (!cli) return;
  const nombre = document.getElementById("fact-cliente");
  const dir = document.getElementById("fact-direccion");
  const tel = document.getElementById("fact-telefono");
  const email = document.getElementById("fact-email");
  if (nombre) nombre.value = cli.nombre || "";
  if (dir) dir.value = cli.direccion || "";
  if (tel) tel.value = cli.telefono || "";
  if (email) email.value = cli.email || "";
}

function applyClienteToCotizacion(cli) {
  if (!cli) return;
  const nombre = document.getElementById("cot-cliente");
  const dir = document.getElementById("cot-direccion");
  const tel = document.getElementById("cot-telefono");
  const email = document.getElementById("cot-email");
  if (nombre) nombre.value = cli.nombre || "";
  if (dir) dir.value = cli.direccion || "";
  if (tel) tel.value = cli.telefono || "";
  if (email) email.value = cli.email || "";
}

// ----- FACTURAS -----
function renderFacturasTable() {
  const tbody = document.getElementById("tbody-facturas");
  if (!tbody) return;
  tbody.innerHTML = "";
  facturas
    .slice()
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
    .forEach((f) => {
      const tr = document.createElement("tr");
      tr.dataset.id = f.id;
      tr.innerHTML = `
        <td>${f.fecha || ""}</td>
        <td>${f.numero || ""}</td>
        <td>${f.cliente || ""}</td>
        <td>${f.metodo || ""}</td>
        <td class="right">${formatMoney(f.total || 0)}</td>
        <td class="right">
          <button class="btn-chip" data-action="edit-factura">Editar</button>
          <button class="btn-chip" data-action="pdf-factura">PDF</button>
          <button class="btn-chip-danger" data-action="delete-factura">Borrar</button>
        </td>
      `;
      tbody.appendChild(tr);
    });
}

function setupFacturaEditor() {
  const editor = document.getElementById("factura-editor");
  const form = document.getElementById("factura-form");
  if (!editor || !form) return;

  const tbodyItems = "fact-items-body";
  const clienteSelect = document.getElementById("fact-cliente-select");

  function clearForm(fact) {
    form.reset();
    document.getElementById("fact-fecha").value = fact?.fecha || todayISO();
    document.getElementById("fact-numero").value = fact?.numero || "";
    document.getElementById("fact-cliente").value = fact?.cliente || "";
    document.getElementById("fact-direccion").value = fact?.direccion || "";
    document.getElementById("fact-email").value = fact?.email || "";
    document.getElementById("fact-telefono").value = fact?.telefono || "";
    document.getElementById("fact-metodo").value = fact?.metodo || "Efectivo";
    document.getElementById("fact-notas").value = fact?.notas || "";

    // seleccionar cliente si hay id o nombre que coincida
    refreshClienteSelects();
    if (clienteSelect) {
      if (fact?.clienteId) {
        clienteSelect.value = fact.clienteId;
      } else if (fact?.cliente) {
        const cli = clientes.find((c) => c.nombre === fact.cliente);
        clienteSelect.value = cli ? cli.id : "";
      } else {
        clienteSelect.value = "";
      }
    }

    const tb = document.getElementById(tbodyItems);
    if (tb) tb.innerHTML = "";

    (fact?.items || [{}, {}, {}]).forEach((it) => {
      addItemRow(tbodyItems, () =>
        recalcDocTotals(tbodyItems, "fact-subtotal", "fact-impuesto", "fact-total")
      );
      const rows = tb.querySelectorAll("tr");
      const tr = rows[rows.length - 1];
      tr.querySelector("[data-field='descripcion']").value = it.descripcion || "";
      tr.querySelector("[data-field='cantidad']").value = it.cantidad || 1;
      tr.querySelector("[data-field='precio']").value = it.precio || 0;
      tr.querySelector("[data-field='impuesto']").value = it.impuesto || 0;
    });

    recalcDocTotals(tbodyItems, "fact-subtotal", "fact-impuesto", "fact-total");
  }

  function open(fact) {
    editor.classList.add("editor-open");
    currentFacturaId = fact?.id || null;
    clearForm(fact || null);
  }
  function close() {
    editor.classList.remove("editor-open");
    currentFacturaId = null;
  }

  document.getElementById("btn-nueva-factura")?.addEventListener("click", () =>
    open(null)
  );
  document.getElementById("fact-editor-close")?.addEventListener("click", close);
  document.getElementById("btn-fact-cancel")?.addEventListener("click", (e) => {
    e.preventDefault();
    close();
  });

  document.getElementById("btn-fact-add-item")?.addEventListener("click", () => {
    addItemRow(tbodyItems, () =>
      recalcDocTotals(tbodyItems, "fact-subtotal", "fact-impuesto", "fact-total")
    );
  });

  const tbItemsEl = document.getElementById(tbodyItems);
  tbItemsEl?.addEventListener("input", () =>
    recalcDocTotals(tbodyItems, "fact-subtotal", "fact-impuesto", "fact-total")
  );
  tbItemsEl?.addEventListener("click", (e) => {
    if (e.target.dataset.action === "delete-item") {
      const tr = e.target.closest("tr");
      tr?.remove();
      recalcDocTotals(tbodyItems, "fact-subtotal", "fact-impuesto", "fact-total");
    }
  });

  // cambio de cliente en select
  clienteSelect?.addEventListener("change", () => {
    const id = clienteSelect.value;
    const cli = clientes.find((c) => c.id === id);
    applyClienteToFactura(cli);
  });

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const base = recalcDocTotals(
      tbodyItems,
      "fact-subtotal",
      "fact-impuesto",
      "fact-total"
    );

    const clienteIdSel = clienteSelect ? clienteSelect.value || null : null;

    const doc = {
      id: currentFacturaId || Date.now().toString(),
      numero: document.getElementById("fact-numero").value.trim(),
      fecha: document.getElementById("fact-fecha").value || todayISO(),
      cliente: document.getElementById("fact-cliente").value.trim(),
      clienteId: clienteIdSel,
      direccion: document.getElementById("fact-direccion").value.trim(),
      email: document.getElementById("fact-email").value.trim(),
      telefono: document.getElementById("fact-telefono").value.trim(),
      metodo: document.getElementById("fact-metodo").value,
      notas: document.getElementById("fact-notas").value.trim(),
      ...base,
      createdAt: currentFacturaId
        ? facturas.find((f) => f.id === currentFacturaId)?.createdAt || Date.now()
        : Date.now(),
    };

    if (!doc.numero || !doc.cliente) {
      alert("Número de factura y cliente son obligatorios.");
      return;
    }

    const idx = facturas.findIndex((f) => f.id === doc.id);
    if (idx >= 0) facturas[idx] = doc;
    else facturas.push(doc);

    saveFacturas();
    renderFacturasTable();

    // crear movimiento de ingreso linkeado
    const mov = movimientos.find((m) => m.refFacturaId === doc.id);
    if (mov) {
      mov.fecha = doc.fecha;
      mov.descripcion = `Factura ${doc.numero} — ${doc.cliente}`;
      mov.categoria = "Factura";
      mov.metodo = doc.metodo;
      mov.monto = doc.total;
    } else {
      movimientos.push({
        id: `mov-fact-${doc.id}`,
        refFacturaId: doc.id,
        tipo: "ingreso",
        fecha: doc.fecha,
        descripcion: `Factura ${doc.numero} — ${doc.cliente}`,
        categoria: "Factura",
        metodo: doc.metodo,
        monto: doc.total,
        createdAt: doc.createdAt,
      });
    }
    saveMovimientos();
    renderKpis();
    renderTablasMovimientos();

    close();
  });

  // acciones en tabla facturas
  document.getElementById("tbody-facturas")?.addEventListener("click", (e) => {
    const btn = e.target;
    if (!btn.dataset.action) return;
    const tr = btn.closest("tr");
    if (!tr) return;
    const id = tr.dataset.id;
    const fact = facturas.find((f) => f.id === id);
    if (!fact) return;

    if (btn.dataset.action === "edit-factura") {
      open(fact);
    } else if (btn.dataset.action === "delete-factura") {
      if (!confirm("¿Borrar esta factura?")) return;
      facturas = facturas.filter((f) => f.id !== id);
      saveFacturas();
      renderFacturasTable();
      // borrar movimiento vinculado
      movimientos = movimientos.filter((m) => m.refFacturaId !== id);
      saveMovimientos();
      renderKpis();
      renderTablasMovimientos();
    } else if (btn.dataset.action === "pdf-factura") {
      generatePdf(fact, "Factura");
    }
  });

  document.getElementById("btn-fact-pdf")?.addEventListener("click", (e) => {
    e.preventDefault();
    if (!currentFacturaId) {
      alert("Guarda la factura antes de generar PDF.");
      return;
    }
    const fact = facturas.find((f) => f.id === currentFacturaId);
    if (fact) generatePdf(fact, "Factura");
  });
}

// ----- COTIZACIONES -----
function renderCotizacionesTable() {
  const tbody = document.getElementById("tbody-cotizaciones");
  if (!tbody) return;
  tbody.innerHTML = "";
  cotizaciones
    .slice()
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
    .forEach((c) => {
      const tr = document.createElement("tr");
      tr.dataset.id = c.id;
      tr.innerHTML = `
        <td>${c.fecha || ""}</td>
        <td>${c.numero || ""}</td>
        <td>${c.cliente || ""}</td>
        <td>${c.metodo || ""}</td>
        <td class="right">${formatMoney(c.total || 0)}</td>
        <td class="right">
          <button class="btn-chip" data-action="edit-cot">Editar</button>
          <button class="btn-chip" data-action="pdf-cot">PDF</button>
          <button class="btn-chip-danger" data-action="delete-cot">Borrar</button>
        </td>
      `;
      tbody.appendChild(tr);
    });
}

function setupCotEditor() {
  const editor = document.getElementById("cot-editor");
  const form = document.getElementById("cot-form");
  if (!editor || !form) return;

  const tbodyItems = "cot-items-body";
  const clienteSelect = document.getElementById("cot-cliente-select");

  function clearForm(cot) {
    form.reset();
    document.getElementById("cot-fecha").value = cot?.fecha || todayISO();
    document.getElementById("cot-numero").value = cot?.numero || "";
    document.getElementById("cot-cliente").value = cot?.cliente || "";
    document.getElementById("cot-direccion").value = cot?.direccion || "";
    document.getElementById("cot-email").value = cot?.email || "";
    document.getElementById("cot-telefono").value = cot?.telefono || "";
    document.getElementById("cot-metodo").value = cot?.metodo || "Estimado";
    document.getElementById("cot-notas").value = cot?.notas || "";

    // seleccionar cliente si hay id o nombre que coincida
    refreshClienteSelects();
    if (clienteSelect) {
      if (cot?.clienteId) {
        clienteSelect.value = cot.clienteId;
      } else if (cot?.cliente) {
        const cli = clientes.find((c) => c.nombre === cot.cliente);
        clienteSelect.value = cli ? cli.id : "";
      } else {
        clienteSelect.value = "";
      }
    }

    const tb = document.getElementById(tbodyItems);
    if (tb) tb.innerHTML = "";

    (cot?.items || [{}, {}, {}]).forEach((it) => {
      addItemRow(tbodyItems, () =>
        recalcDocTotals(tbodyItems, "cot-subtotal", "cot-impuesto", "cot-total")
      );
      const rows = tb.querySelectorAll("tr");
      const tr = rows[rows.length - 1];
      tr.querySelector("[data-field='descripcion']").value = it.descripcion || "";
      tr.querySelector("[data-field='cantidad']").value = it.cantidad || 1;
      tr.querySelector("[data-field='precio']").value = it.precio || 0;
      tr.querySelector("[data-field='impuesto']").value = it.impuesto || 0;
    });

    recalcDocTotals(tbodyItems, "cot-subtotal", "cot-impuesto", "cot-total");
  }

  function open(cot) {
    editor.classList.add("editor-open");
    currentCotizacionId = cot?.id || null;
    clearForm(cot || null);
  }
  function close() {
    editor.classList.remove("editor-open");
    currentCotizacionId = null;
  }

  document.getElementById("btn-nueva-cotizacion")?.addEventListener("click", () =>
    open(null)
  );
  document.getElementById("cot-editor-close")?.addEventListener("click", close);
  document.getElementById("btn-cot-cancel")?.addEventListener("click", (e) => {
    e.preventDefault();
    close();
  });

  document.getElementById("btn-cot-add-item")?.addEventListener("click", () => {
    addItemRow(tbodyItems, () =>
      recalcDocTotals(tbodyItems, "cot-subtotal", "cot-impuesto", "cot-total")
    );
  });

  const tbItemsEl = document.getElementById(tbodyItems);
  tbItemsEl?.addEventListener("input", () =>
    recalcDocTotals(tbodyItems, "cot-subtotal", "cot-impuesto", "cot-total")
  );
  tbItemsEl?.addEventListener("click", (e) => {
    if (e.target.dataset.action === "delete-item") {
      const tr = e.target.closest("tr");
      tr?.remove();
      recalcDocTotals(tbodyItems, "cot-subtotal", "cot-impuesto", "cot-total");
    }
  });

  clienteSelect?.addEventListener("change", () => {
    const id = clienteSelect.value;
    const cli = clientes.find((c) => c.id === id);
    applyClienteToCotizacion(cli);
  });

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const base = recalcDocTotals(
      tbodyItems,
      "cot-subtotal",
      "cot-impuesto",
      "cot-total"
    );

    const clienteIdSel = clienteSelect ? clienteSelect.value || null : null;

    const doc = {
      id: currentCotizacionId || Date.now().toString(),
      numero: document.getElementById("cot-numero").value.trim(),
      fecha: document.getElementById("cot-fecha").value || todayISO(),
      cliente: document.getElementById("cot-cliente").value.trim(),
      clienteId: clienteIdSel,
      direccion: document.getElementById("cot-direccion").value.trim(),
      email: document.getElementById("cot-email").value.trim(),
      telefono: document.getElementById("cot-telefono").value.trim(),
      metodo: document.getElementById("cot-metodo").value,
      notas: document.getElementById("cot-notas").value.trim(),
      ...base,
      createdAt: currentCotizacionId
        ? cotizaciones.find((c) => c.id === currentCotizacionId)?.createdAt ||
          Date.now()
        : Date.now(),
    };

    if (!doc.numero || !doc.cliente) {
      alert("Número de cotización y cliente son obligatorios.");
      return;
    }

    const idx = cotizaciones.findIndex((c) => c.id === doc.id);
    if (idx >= 0) cotizaciones[idx] = doc;
    else cotizaciones.push(doc);

    saveCotizaciones();
    renderCotizacionesTable();
    close();
  });

  document.getElementById("tbody-cotizaciones")?.addEventListener("click", (e) => {
    const btn = e.target;
    if (!btn.dataset.action) return;
    const tr = btn.closest("tr");
    if (!tr) return;
    const id = tr.dataset.id;
    const cot = cotizaciones.find((c) => c.id === id);
    if (!cot) return;

    if (btn.dataset.action === "edit-cot") {
      open(cot);
    } else if (btn.dataset.action === "delete-cot") {
      if (!confirm("¿Borrar esta cotización?")) return;
      cotizaciones = cotizaciones.filter((c) => c.id !== id);
      saveCotizaciones();
      renderCotizacionesTable();
    } else if (btn.dataset.action === "pdf-cot") {
      generatePdf(cot, "Cotización");
    }
  });

  document.getElementById("btn-cot-pdf")?.addEventListener("click", (e) => {
    e.preventDefault();
    if (!currentCotizacionId) {
      alert("Guarda la cotización antes de generar PDF.");
      return;
    }
    const cot = cotizaciones.find((c) => c.id === currentCotizacionId);
    if (cot) generatePdf(cot, "Cotización");
  });
}

// ======== PDF CON JSPDF ========
function generatePdf(doc, tipo) {
  if (!window.jspdf || !window.jspdf.jsPDF) {
    alert("jsPDF no está cargado. Verifica el script en tu HTML.");
    return;
  }

  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF();

  const esFactura = tipo === "Factura";
  const tituloDoc = esFactura ? "FACTURA" : "COTIZACIÓN";
  const labelNumero = esFactura ? " #" : " #";
  const labelBloqueCliente = esFactura ? "Facturar a:" : "Cotizar a:";

  let y = 20;

  // ===== ENCABEZADO CON LOGO + DATOS NEGOCIO =====
  if (config.pdfLogo) {
    try {
      // logo parte izquierda arriba
      pdf.addImage(config.pdfLogo, "PNG", 15, 12, 25, 25);
    } catch (e) {
      console.warn("Error añadiendo logo al PDF:", e);
    }
  }

  pdf.setFontSize(11);
  pdf.setFont("helvetica", "bold");
  pdf.text(config.nombreNegocio || "OASIS AIR CLEANER SERVICES LLC", 50, 18);
  pdf.setFont("helvetica", "normal");
  if (config.direccion) pdf.text(config.direccion, 50, 24);
  if (config.telefono) pdf.text(`Tel: ${config.telefono}`, 50, 30);
  if (config.email) pdf.text(config.email, 50, 36);

  // Título FACTURA / COTIZACIÓN a la derecha
  pdf.setFontSize(14);
  pdf.setFont("helvetica", "bold");
  pdf.text(tituloDoc, 165, 18, { align: "right" });

  pdf.setFontSize(10);
  pdf.setFont("helvetica", "normal");
  pdf.text(`${labelNumero}: ${doc.numero || ""}`, 165, 24, { align: "right" });
  pdf.text(`Fecha: ${doc.fecha || ""}`, 165, 30, { align: "right" });

  // Línea separadora
  pdf.line(15, 40, 195, 40);
  y = 48;

  // ===== DATOS DEL CLIENTE =====
  pdf.setFontSize(10);
  pdf.setFont("helvetica", "bold");
  pdf.text(labelBloqueCliente, 15, y);
  y += 5;

  pdf.setFont("helvetica", "normal");
  if (doc.cliente) {
    pdf.text(String(doc.cliente), 15, y);
    y += 5;
  }
  if (doc.direccion) {
    const dirLines = pdf.splitTextToSize(String(doc.direccion), 80);
    pdf.text(dirLines, 15, y);
    y += dirLines.length * 5;
  }
  if (doc.email) {
    pdf.text(String(doc.email), 15, y);
    y += 5;
  }
  if (doc.telefono) {
    pdf.text(String(doc.telefono), 15, y);
    y += 5;
  }

  // Espacio antes de tabla
  y += 5;

  // ===== TABLA DE ITEMS =====
  pdf.setFont("helvetica", "bold");
  pdf.text("Cant.", 20, y);
  pdf.text("Descripción", 40, y);
  pdf.text("Precio", 135, y, { align: "right" });
  pdf.text("Importe", 185, y, { align: "right" });

  y += 3;
  pdf.line(15, y, 195, y);
  y += 6;

  pdf.setFont("helvetica", "normal");

  (doc.items || []).forEach((it) => {
    const cant = it.cantidad || 0;
    const desc = String(it.descripcion || "");
    const precio = Number(it.precio || 0);
    const importe = cant * precio;

    const descLines = pdf.splitTextToSize(desc, 80);
    const lineHeight = 5 * descLines.length;

    if (y + lineHeight > 250) {
      pdf.addPage();
      y = 20;
    }

    pdf.text(String(cant), 20, y);
    pdf.text(descLines, 40, y);
    pdf.text(formatMoney(precio), 135, y, { align: "right" });
    pdf.text(formatMoney(importe), 185, y, { align: "right" });

    y += lineHeight + 2;
  });

  // Línea antes de totales
  y += 2;
  pdf.line(115, y, 195, y);
  y += 6;

  // ===== TOTALES =====
  pdf.setFont("helvetica", "normal");
  pdf.text(`Subtotal: ${formatMoney(doc.subtotal || 0)}`, 185, y, {
    align: "right",
  });
  y += 5;
  pdf.text(`Impuesto: ${formatMoney(doc.impuesto || 0)}`, 185, y, {
    align: "right",
  });
  y += 5;

  pdf.setFont("helvetica", "bold");
  pdf.text(`TOTAL: ${formatMoney(doc.total || 0)}`, 185, y, {
    align: "right",
  });
  y += 12;

  // ===== NOTAS =====
  if (doc.notas) {
    pdf.setFont("helvetica", "bold");
    pdf.text("Notas:", 15, y);
    y += 5;
    pdf.setFont("helvetica", "normal");
    const notesLines = pdf.splitTextToSize(String(doc.notas), 180);
    pdf.text(notesLines, 15, y);
    y += notesLines.length * 5;
  }

  // Mensaje final sólo para factura
  if (esFactura) {
    y += 10;
    pdf.setFont("helvetica", "normal");
    pdf.text("FACTURA PAGADA EN SU TOTALIDAD.", 15, y);
  }

  const filename = `${tituloDoc}_${doc.numero || "documento"}.pdf`;
  pdf.save(filename);
}


// ======== INIT ========
document.addEventListener("DOMContentLoaded", () => {
  loadFromStorage();
  renderTopbarDate();
  setupNavigation();
  setupPinLogin();
  setupMovModal();
  setupMovimientosActions();
  setupExportButtons();
  setupConfig();
  setupLogout();
  setupClientesModule();
  setupFacturaEditor();
  setupCotEditor();

  renderKpis();
  renderTablasMovimientos();
  renderFacturasTable();
  renderCotizacionesTable();
});
