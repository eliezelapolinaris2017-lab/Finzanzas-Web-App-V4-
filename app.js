// app.js — Nexus Finance (solo localStorage, desktop)

// ====== STORAGE KEYS ======
const STORAGE_KEY_MOVIMIENTOS = "nexus-movimientos";
const STORAGE_KEY_FACTURAS = "nexus-facturas";
const STORAGE_KEY_COTIZACIONES = "nexus-cotizaciones";
const STORAGE_KEY_CONFIG = "nexus-config";

// ====== ESTADO ======
let movimientos = [];
let facturas = [];
let cotizaciones = [];
let config = {
  nombreNegocio: "",
  dirNegocio: "",
  telNegocio: "",
  emailNegocio: "",
  moneda: "$",
  logoDataUrl: ""
};

const PIN_CORRECTO = "1234";

// ====== UTILIDADES ======
function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function sameDay(d1, d2) {
  return d1 === d2;
}

function sameMonth(d1, d2) {
  if (!d1 || !d2) return false;
  return d1.slice(0, 7) === d2.slice(0, 7);
}

function formatMoney(value) {
  const num = Number(value) || 0;
  return `${config.moneda || "$"}${num.toFixed(2)}`;
}

function generateId(prefix) {
  return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 9999)}`;
}

// ====== LOCAL STORAGE ======
function loadFromStorage() {
  try {
    const rawMov = localStorage.getItem(STORAGE_KEY_MOVIMIENTOS);
    movimientos = rawMov ? JSON.parse(rawMov) : [];
  } catch (e) {
    console.error("Error leyendo movimientos:", e);
    movimientos = [];
  }

  try {
    const rawFac = localStorage.getItem(STORAGE_KEY_FACTURAS);
    facturas = rawFac ? JSON.parse(rawFac) : [];
  } catch (e) {
    console.error("Error leyendo facturas:", e);
    facturas = [];
  }

  try {
    const rawCot = localStorage.getItem(STORAGE_KEY_COTIZACIONES);
    cotizaciones = rawCot ? JSON.parse(rawCot) : [];
  } catch (e) {
    console.error("Error leyendo cotizaciones:", e);
    cotizaciones = [];
  }

  try {
    const rawCfg = localStorage.getItem(STORAGE_KEY_CONFIG);
    if (rawCfg) {
      config = { ...config, ...JSON.parse(rawCfg) };
    }
  } catch (e) {
    console.error("Error leyendo config:", e);
  }
}

function saveMovimientos() {
  localStorage.setItem(STORAGE_KEY_MOVIMIENTOS, JSON.stringify(movimientos));
}

function saveFacturas() {
  localStorage.setItem(STORAGE_KEY_FACTURAS, JSON.stringify(facturas));
}

function saveCotizaciones() {
  localStorage.setItem(STORAGE_KEY_COTIZACIONES, JSON.stringify(cotizaciones));
}

function saveConfig() {
  localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify(config));
}

// ====== TOPBAR DATE ======
function renderTopbarDate() {
  const el = document.getElementById("topbar-date");
  if (!el) return;
  const now = new Date();
  el.textContent = now.toLocaleDateString("es-PR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}

// ====== KPIs ======
function renderKpis() {
  const hoy = todayISO();
  let ingresosHoy = 0;
  let gastosHoy = 0;
  let ingresosMes = 0;
  let gastosMes = 0;

  movimientos.forEach(m => {
    if (!m.fecha) return;
    const monto = Number(m.monto) || 0;
    const isIngreso = m.tipo === "ingreso";

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
  document.getElementById("kpi-movimientos-mes").textContent = movimientos.filter(m => sameMonth(m.fecha, hoy)).length;

  const ultimo = [...movimientos].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))[0];
  const elUlt = document.getElementById("kpi-ultimo-movimiento");
  if (ultimo) {
    const tipoTxt = ultimo.tipo === "ingreso" ? "Ingreso" : "Gasto";
    elUlt.textContent = `${tipoTxt} de ${formatMoney(ultimo.monto)} el ${ultimo.fecha}`;
  } else {
    elUlt.textContent = "Sin movimientos recientes";
  }
}

// ====== RENDER MOVIMIENTOS ======
function buildMovimientoRow(m) {
  const tr = document.createElement("tr");
  tr.dataset.id = m.id;
  tr.innerHTML = `
    <td>${m.fecha || ""}</td>
    <td>${m.descripcion || ""}</td>
    <td>${m.categoria || ""}</td>
    <td>${m.metodo || ""}</td>
    <td class="right">${formatMoney(m.monto)}</td>
    <td>
      <div class="table-actions">
        <button class="badge-btn" data-action="edit-mov">Editar</button>
        <button class="badge-btn danger" data-action="delete-mov">Borrar</button>
      </div>
    </td>
  `;
  return tr;
}

function renderMovimientosTablas() {
  const tbodyIng = document.getElementById("tbody-ingresos");
  const tbodyGas = document.getElementById("tbody-gastos");
  const tbodyIngFull = document.getElementById("tbody-ingresos-full");
  const tbodyGasFull = document.getElementById("tbody-gastos-full");

  [tbodyIng, tbodyGas, tbodyIngFull, tbodyGasFull].forEach(tb => {
    if (tb) tb.innerHTML = "";
  });

  const ingresos = movimientos.filter(m => m.tipo === "ingreso").sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  const gastos = movimientos.filter(m => m.tipo === "gasto").sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  const recientesIng = ingresos.slice(0, 10);
  const recientesGas = gastos.slice(0, 10);

  recientesIng.forEach(m => tbodyIng && tbodyIng.appendChild(buildMovimientoRow(m)));
  recientesGas.forEach(m => tbodyGas && tbodyGas.appendChild(buildMovimientoRow(m)));

  ingresos.forEach(m => tbodyIngFull && tbodyIngFull.appendChild(buildMovimientoRow(m)));
  gastos.forEach(m => tbodyGasFull && tbodyGasFull.appendChild(buildMovimientoRow(m)));
}

// ====== MODAL MOVIMIENTO ======
const modalMov = {
  backdrop: null,
  idInput: null,
  tipoInput: null,
  fechaInput: null,
  descInput: null,
  catInput: null,
  metodoInput: null,
  montoInput: null,
  titleEl: null,

  openNuevo(tipo) {
    this.idInput.value = "";
    this.tipoInput.value = tipo || "ingreso";
    this.titleEl.textContent = tipo === "gasto" ? "Nuevo gasto" : "Nuevo ingreso";
    this.fechaInput.value = todayISO();
    this.descInput.value = "";
    this.catInput.value = "";
    this.metodoInput.value = "Efectivo";
    this.montoInput.value = "";
    this.backdrop.classList.add("show");
  },

  openEditar(mov) {
    this.idInput.value = mov.id;
    this.tipoInput.value = mov.tipo;
    this.titleEl.textContent = mov.tipo === "gasto" ? "Editar gasto" : "Editar ingreso";
    this.fechaInput.value = mov.fecha || todayISO();
    this.descInput.value = mov.descripcion || "";
    this.catInput.value = mov.categoria || "";
    this.metodoInput.value = mov.metodo || "Efectivo";
    this.montoInput.value = mov.monto || "";
    this.backdrop.classList.add("show");
  },

  close() {
    this.backdrop.classList.remove("show");
  }
};

function setupModalMovimientos() {
  modalMov.backdrop = document.getElementById("modal-movimiento");
  modalMov.idInput = document.getElementById("mov-id");
  modalMov.tipoInput = document.getElementById("mov-tipo");
  modalMov.fechaInput = document.getElementById("mov-fecha");
  modalMov.descInput = document.getElementById("mov-descripcion");
  modalMov.catInput = document.getElementById("mov-categoria");
  modalMov.metodoInput = document.getElementById("mov-metodo");
  modalMov.montoInput = document.getElementById("mov-monto");
  modalMov.titleEl = document.getElementById("modal-title");

  document.getElementById("btn-add-movimiento")?.addEventListener("click", () => {
    modalMov.openNuevo("ingreso");
  });

  document.querySelectorAll("[data-add]").forEach(btn => {
    btn.addEventListener("click", () => {
      const tipo = btn.getAttribute("data-add") === "gasto" ? "gasto" : "ingreso";
      modalMov.openNuevo(tipo);
    });
  });

  document.getElementById("modal-close")?.addEventListener("click", () => modalMov.close());
  document.getElementById("modal-cancel")?.addEventListener("click", () => modalMov.close());

  const form = document.getElementById("form-movimiento");
  form?.addEventListener("submit", e => {
    e.preventDefault();
    const id = modalMov.idInput.value;
    const tipo = modalMov.tipoInput.value;
    const fecha = modalMov.fechaInput.value || todayISO();
    const descripcion = modalMov.descInput.value.trim();
    const categoria = modalMov.catInput.value.trim();
    const metodo = modalMov.metodoInput.value;
    const monto = Number(modalMov.montoInput.value);

    if (!descripcion || !categoria || !metodo || !fecha || !monto) {
      alert("Completa todos los campos y coloca un monto válido.");
      return;
    }

    if (id) {
      // editar
      const idx = movimientos.findIndex(m => m.id === id);
      if (idx >= 0) {
        movimientos[idx] = {
          ...movimientos[idx],
          tipo,
          fecha,
          descripcion,
          categoria,
          metodo,
          monto
        };
      }
    } else {
      // nuevo
      movimientos.push({
        id: generateId("mov"),
        tipo,
        fecha,
        descripcion,
        categoria,
        metodo,
        monto,
        createdAt: Date.now()
      });
    }

    saveMovimientos();
    renderKpis();
    renderMovimientosTablas();
    modalMov.close();
  });

  // Delegar clicks de editar / borrar en todas las tablas
  ["tbody-ingresos", "tbody-gastos", "tbody-ingresos-full", "tbody-gastos-full"].forEach(id => {
    const tbody = document.getElementById(id);
    if (!tbody) return;
    tbody.addEventListener("click", e => {
      const btn = e.target.closest("button");
      if (!btn) return;
      const action = btn.dataset.action;
      const tr = btn.closest("tr");
      const idMov = tr?.dataset.id;
      if (!idMov) return;

      const mov = movimientos.find(m => m.id === idMov);
      if (!mov) return;

      if (action === "edit-mov") {
        modalMov.openEditar(mov);
      } else if (action === "delete-mov") {
        if (confirm("¿Borrar este movimiento?")) {
          movimientos = movimientos.filter(m => m.id !== idMov);
          saveMovimientos();
          renderKpis();
          renderMovimientosTablas();
        }
      }
    });
  });
}

// ====== EXPORT CSV MOVIMIENTOS ======
function movimientosToCsv(rows) {
  const header = ["tipo", "fecha", "descripcion", "categoria", "metodo", "monto"];
  const lines = [header.join(",")];
  rows.forEach(m => {
    const line = [
      m.tipo,
      m.fecha,
      `"${(m.descripcion || "").replace(/"/g, '""')}"`,
      `"${(m.categoria || "").replace(/"/g, '""')}"`,
      m.metodo,
      m.monto
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
    const ingresos = movimientos.filter(m => m.tipo === "ingreso");
    downloadCsv("ingresos.csv", movimientosToCsv(ingresos));
  });

  document.getElementById("btn-export-gastos")?.addEventListener("click", () => {
    const gastos = movimientos.filter(m => m.tipo === "gasto");
    downloadCsv("gastos.csv", movimientosToCsv(gastos));
  });

  document.getElementById("btn-export-todo")?.addEventListener("click", () => {
    downloadCsv("movimientos-completos.csv", movimientosToCsv(movimientos));
  });
}

// ====== FACTURAS ======
function recalcFacturaTotals() {
  const tbody = document.getElementById("fac-items-body");
  const rows = Array.from(tbody.querySelectorAll("tr"));
  let subtotal = 0;
  let impuesto = 0;

  rows.forEach(row => {
    const desc = row.querySelector(".fac-item-desc").value.trim();
    const q = Number(row.querySelector(".fac-item-cant").value) || 0;
    const p = Number(row.querySelector(".fac-item-precio").value) || 0;
    const imp = Number(row.querySelector(".fac-item-imp").value) || 0;
    if (!desc && !q && !p) return;
    const base = q * p;
    const tax = base * (imp / 100);
    subtotal += base;
    impuesto += tax;
    const cellTotal = row.querySelector(".fac-item-total");
    if (cellTotal) cellTotal.textContent = formatMoney(base + tax);
  });

  document.getElementById("fac-subtotal").textContent = formatMoney(subtotal);
  document.getElementById("fac-impuesto").textContent = formatMoney(impuesto);
  document.getElementById("fac-total").textContent = formatMoney(subtotal + impuesto);
  return { subtotal, impuesto, total: subtotal + impuesto };
}

function addFacturaItemRow(data = {}) {
  const tbody = document.getElementById("fac-items-body");
  const tr = document.createElement("tr");
  tr.innerHTML = `
    <td><input class="fac-item-desc" type="text" placeholder="Descripción"></td>
    <td><input class="fac-item-cant" type="number" min="0" step="0.01" style="width:70px"></td>
    <td><input class="fac-item-precio" type="number" min="0" step="0.01" style="width:80px"></td>
    <td><input class="fac-item-imp" type="number" min="0" step="0.01" style="width:60px"></td>
    <td class="right fac-item-total">${formatMoney(0)}</td>
    <td><button type="button" class="badge-btn danger" data-action="delete-item">X</button></td>
  `;
  tbody.appendChild(tr);

  tr.querySelector(".fac-item-desc").value = data.descripcion || "";
  tr.querySelector(".fac-item-cant").value = data.cantidad || "";
  tr.querySelector(".fac-item-precio").value = data.precio || "";
  tr.querySelector(".fac-item-imp").value = data.impuesto || "";

  const inputs = tr.querySelectorAll(".fac-item-cant, .fac-item-precio, .fac-item-imp");
  inputs.forEach(inp => inp.addEventListener("input", recalcFacturaTotals));

  tr.querySelector("[data-action='delete-item']").addEventListener("click", () => {
    tr.remove();
    recalcFacturaTotals();
  });

  recalcFacturaTotals();
}

function openFacturaPanel(factura = null) {
  const panel = document.getElementById("factura-panel");
  panel.classList.remove("hidden");

  document.getElementById("fac-id").value = factura ? factura.id : "";
  document.getElementById("fac-numero").value = factura?.numero || "";
  document.getElementById("fac-fecha").value = factura?.fecha || todayISO();
  document.getElementById("fac-cliente").value = factura?.cliente || "";
  document.getElementById("fac-dir").value = factura?.dir || "";
  document.getElementById("fac-email").value = factura?.email || "";
  document.getElementById("fac-tel").value = factura?.tel || "";
  document.getElementById("fac-metodo").value = factura?.metodo || "Efectivo";
  document.getElementById("fac-notas").value = factura?.notas || "";

  const tbody = document.getElementById("fac-items-body");
  tbody.innerHTML = "";
  if (factura?.items && factura.items.length) {
    factura.items.forEach(item => addFacturaItemRow(item));
  } else {
    addFacturaItemRow();
  }
  recalcFacturaTotals();
}

function closeFacturaPanel() {
  document.getElementById("factura-panel").classList.add("hidden");
}

function buildFacturaRow(f) {
  const tr = document.createElement("tr");
  tr.dataset.id = f.id;
  tr.innerHTML = `
    <td>${f.fecha || ""}</td>
    <td>${f.numero || ""}</td>
    <td>${f.cliente || ""}</td>
    <td>${f.metodo || ""}</td>
    <td class="right">${formatMoney(f.total || 0)}</td>
    <td>
      <div class="table-actions">
        <button class="badge-btn" data-action="pdf-fac">PDF</button>
        <button class="badge-btn" data-action="edit-fac">Editar</button>
        <button class="badge-btn danger" data-action="delete-fac">Borrar</button>
      </div>
    </td>
  `;
  return tr;
}

function renderFacturas() {
  const tbody = document.getElementById("tbody-facturas");
  if (!tbody) return;
  tbody.innerHTML = "";
  const ordenadas = [...facturas].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  ordenadas.forEach(f => tbody.appendChild(buildFacturaRow(f)));
}

function collectFacturaFromForm() {
  const id = document.getElementById("fac-id").value || generateId("fac");
  const numero = document.getElementById("fac-numero").value.trim();
  const fecha = document.getElementById("fac-fecha").value || todayISO();
  const cliente = document.getElementById("fac-cliente").value.trim();
  const dir = document.getElementById("fac-dir").value.trim();
  const email = document.getElementById("fac-email").value.trim();
  const tel = document.getElementById("fac-tel").value.trim();
  const metodo = document.getElementById("fac-metodo").value;
  const notas = document.getElementById("fac-notas").value.trim();

  if (!numero || !fecha || !cliente) {
    alert("Número, fecha y cliente son obligatorios.");
    return null;
  }

  const tbody = document.getElementById("fac-items-body");
  const rows = Array.from(tbody.querySelectorAll("tr"));
  const items = [];
  rows.forEach(row => {
    const desc = row.querySelector(".fac-item-desc").value.trim();
    const q = Number(row.querySelector(".fac-item-cant").value) || 0;
    const p = Number(row.querySelector(".fac-item-precio").value) || 0;
    const imp = Number(row.querySelector(".fac-item-imp").value) || 0;
    if (!desc && !q && !p) return;
    items.push({
      descripcion: desc,
      cantidad: q,
      precio: p,
      impuesto: imp
    });
  });

  if (!items.length) {
    alert("Añade al menos un ítem.");
    return null;
  }

  const { subtotal, impuesto, total } = recalcFacturaTotals();

  return {
    id,
    numero,
    fecha,
    cliente,
    dir,
    email,
    tel,
    metodo,
    notas,
    items,
    subtotal,
    impuesto,
    total
  };
}

function exportFacturaPdf(facturaId) {
  const fac = facturas.find(f => f.id === facturaId);
  if (!fac) return;
  if (!window.jspdf || !window.jspdf.jsPDF) {
    alert("jsPDF no está disponible.");
    return;
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  // Logo
  let y = 14;
  if (config.logoDataUrl) {
    try {
      doc.addImage(config.logoDataUrl, "PNG", 10, 10, 35, 18);
      y = 14;
    } catch (e) {
      console.warn("Error agregando logo:", e);
    }
  }

  // Datos empresa
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text(config.nombreNegocio || "Nexus Finance", 50, 12);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  if (config.dirNegocio) doc.text(config.dirNegocio, 50, 17);
  if (config.telNegocio) doc.text(`Tel: ${config.telNegocio}`, 50, 22);
  if (config.emailNegocio) doc.text(config.emailNegocio, 50, 27);

  // Título factura
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("FACTURA", 150, 14);

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(`No.: ${fac.numero}`, 150, 19);
  doc.text(`Fecha: ${fac.fecha}`, 150, 24);

  // Datos cliente
  let yCli = 38;
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Facturar a:", 10, yCli);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  yCli += 5;
  doc.text(fac.cliente || "", 10, yCli);
  if (fac.dir) {
    yCli += 5;
    doc.text(fac.dir, 10, yCli);
  }
  if (fac.tel) {
    yCli += 5;
    doc.text(`Tel: ${fac.tel}`, 10, yCli);
  }
  if (fac.email) {
    yCli += 5;
    doc.text(fac.email, 10, yCli);
  }

  // Tabla ítems
  let yTable = yCli + 10;
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("Descripción", 10, yTable);
  doc.text("Cant.", 90, yTable);
  doc.text("Precio", 110, yTable);
  doc.text("Imp%", 135, yTable);
  doc.text("Total", 160, yTable);

  doc.setDrawColor(200);
  doc.line(10, yTable + 2, 200 - 10, yTable + 2);

  doc.setFont("helvetica", "normal");
  let yRow = yTable + 8;

  fac.items.forEach(item => {
    if (yRow > 260) {
      doc.addPage();
      yRow = 20;
    }
    const base = (item.cantidad || 0) * (item.precio || 0);
    const tax = base * ((item.impuesto || 0) / 100);
    const tot = base + tax;

    doc.text(String(item.descripcion || ""), 10, yRow);
    doc.text(String(item.cantidad || 0), 92, yRow, { align: "right" });
    doc.text(formatMoney(item.precio || 0), 132, yRow, { align: "right" });
    doc.text(String(item.impuesto || 0), 147, yRow, { align: "right" });
    doc.text(formatMoney(tot), 190 - 10, yRow, { align: "right" });

    yRow += 6;
  });

  // Totales
  const yTotals = yRow + 6;
  doc.setFont("helvetica", "bold");
  doc.text("Subtotal:", 140, yTotals);
  doc.text("Impuesto:", 140, yTotals + 5);
  doc.text("Total:", 140, yTotals + 10);

  doc.setFont("helvetica", "normal");
  doc.text(formatMoney(fac.subtotal || 0), 190 - 10, yTotals, { align: "right" });
  doc.text(formatMoney(fac.impuesto || 0), 190 - 10, yTotals + 5, { align: "right" });
  doc.setFont("helvetica", "bold");
  doc.text(formatMoney(fac.total || 0), 190 - 10, yTotals + 10, { align: "right" });

  // Notas
  if (fac.notas) {
    const yNotas = yTotals + 22;
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text("Notas:", 10, yNotas);
    doc.setFont("helvetica", "normal");
    doc.text(doc.splitTextToSize(fac.notas, 180), 10, yNotas + 5);
  }

  doc.save(`Factura-${fac.numero || fac.id}.pdf`);
}

function setupFacturas() {
  document.getElementById("btn-nueva-factura")?.addEventListener("click", () => openFacturaPanel(null));
  document.getElementById("btn-fac-add-item")?.addEventListener("click", () => addFacturaItemRow());
  document.getElementById("btn-fac-close")?.addEventListener("click", closeFacturaPanel);
  document.getElementById("btn-fac-cancel")?.addEventListener("click", closeFacturaPanel);

  document.getElementById("form-factura")?.addEventListener("submit", e => {
    e.preventDefault();
    const facData = collectFacturaFromForm();
    if (!facData) return;

    const existingIdx = facturas.findIndex(f => f.id === facData.id);
    const now = Date.now();
    if (existingIdx >= 0) {
      facturas[existingIdx] = {
        ...facturas[existingIdx],
        ...facData
      };
    } else {
      facturas.push({
        ...facData,
        createdAt: now
      });
    }

    saveFacturas();
    renderFacturas();
    closeFacturaPanel();
  });

  const tbody = document.getElementById("tbody-facturas");
  tbody?.addEventListener("click", e => {
    const btn = e.target.closest("button");
    if (!btn) return;
    const action = btn.dataset.action;
    const tr = btn.closest("tr");
    const id = tr?.dataset.id;
    if (!id) return;
    const fac = facturas.find(f => f.id === id);
    if (!fac) return;

    if (action === "edit-fac") {
      openFacturaPanel(fac);
    } else if (action === "delete-fac") {
      if (confirm("¿Borrar esta factura?")) {
        facturas = facturas.filter(f => f.id !== id);
        saveFacturas();
        renderFacturas();
      }
    } else if (action === "pdf-fac") {
      exportFacturaPdf(id);
    }
  });
}

// ====== COTIZACIONES ======
function recalcCotizacionTotals() {
  const tbody = document.getElementById("cot-items-body");
  const rows = Array.from(tbody.querySelectorAll("tr"));
  let subtotal = 0;
  let impuesto = 0;

  rows.forEach(row => {
    const desc = row.querySelector(".cot-item-desc").value.trim();
    const q = Number(row.querySelector(".cot-item-cant").value) || 0;
    const p = Number(row.querySelector(".cot-item-precio").value) || 0;
    const imp = Number(row.querySelector(".cot-item-imp").value) || 0;
    if (!desc && !q && !p) return;
    const base = q * p;
    const tax = base * (imp / 100);
    subtotal += base;
    impuesto += tax;
    const cellTotal = row.querySelector(".cot-item-total");
    if (cellTotal) cellTotal.textContent = formatMoney(base + tax);
  });

  document.getElementById("cot-subtotal").textContent = formatMoney(subtotal);
  document.getElementById("cot-impuesto").textContent = formatMoney(impuesto);
  document.getElementById("cot-total").textContent = formatMoney(subtotal + impuesto);
  return { subtotal, impuesto, total: subtotal + impuesto };
}

function addCotizacionItemRow(data = {}) {
  const tbody = document.getElementById("cot-items-body");
  const tr = document.createElement("tr");
  tr.innerHTML = `
    <td><input class="cot-item-desc" type="text" placeholder="Descripción"></td>
    <td><input class="cot-item-cant" type="number" min="0" step="0.01" style="width:70px"></td>
    <td><input class="cot-item-precio" type="number" min="0" step="0.01" style="width:80px"></td>
    <td><input class="cot-item-imp" type="number" min="0" step="0.01" style="width:60px"></td>
    <td class="right cot-item-total">${formatMoney(0)}</td>
    <td><button type="button" class="badge-btn danger" data-action="delete-item">X</button></td>
  `;
  tbody.appendChild(tr);

  tr.querySelector(".cot-item-desc").value = data.descripcion || "";
  tr.querySelector(".cot-item-cant").value = data.cantidad || "";
  tr.querySelector(".cot-item-precio").value = data.precio || "";
  tr.querySelector(".cot-item-imp").value = data.impuesto || "";

  const inputs = tr.querySelectorAll(".cot-item-cant, .cot-item-precio, .cot-item-imp");
  inputs.forEach(inp => inp.addEventListener("input", recalcCotizacionTotals));

  tr.querySelector("[data-action='delete-item']").addEventListener("click", () => {
    tr.remove();
    recalcCotizacionTotals();
  });

  recalcCotizacionTotals();
}

function openCotizacionPanel(cot = null) {
  const panel = document.getElementById("cotizacion-panel");
  panel.classList.remove("hidden");

  document.getElementById("cot-id").value = cot ? cot.id : "";
  document.getElementById("cot-numero").value = cot?.numero || "";
  document.getElementById("cot-fecha").value = cot?.fecha || todayISO();
  document.getElementById("cot-cliente").value = cot?.cliente || "";
  document.getElementById("cot-dir").value = cot?.dir || "";
  document.getElementById("cot-email").value = cot?.email || "";
  document.getElementById("cot-tel").value = cot?.tel || "";
  document.getElementById("cot-metodo").value = cot?.metodo || "Efectivo";
  document.getElementById("cot-notas").value = cot?.notas || "";

  const tbody = document.getElementById("cot-items-body");
  tbody.innerHTML = "";
  if (cot?.items && cot.items.length) {
    cot.items.forEach(item => addCotizacionItemRow(item));
  } else {
    addCotizacionItemRow();
  }
  recalcCotizacionTotals();
}

function closeCotizacionPanel() {
  document.getElementById("cotizacion-panel").classList.add("hidden");
}

function buildCotizacionRow(c) {
  const tr = document.createElement("tr");
  tr.dataset.id = c.id;
  tr.innerHTML = `
    <td>${c.fecha || ""}</td>
    <td>${c.numero || ""}</td>
    <td>${c.cliente || ""}</td>
    <td>${c.metodo || ""}</td>
    <td class="right">${formatMoney(c.total || 0)}</td>
    <td>
      <div class="table-actions">
        <button class="badge-btn" data-action="pdf-cot">PDF</button>
        <button class="badge-btn" data-action="edit-cot">Editar</button>
        <button class="badge-btn danger" data-action="delete-cot">Borrar</button>
      </div>
    </td>
  `;
  return tr;
}

function renderCotizaciones() {
  const tbody = document.getElementById("tbody-cotizaciones");
  if (!tbody) return;
  tbody.innerHTML = "";
  const ordenadas = [...cotizaciones].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  ordenadas.forEach(c => tbody.appendChild(buildCotizacionRow(c)));
}

function collectCotizacionFromForm() {
  const id = document.getElementById("cot-id").value || generateId("cot");
  const numero = document.getElementById("cot-numero").value.trim();
  const fecha = document.getElementById("cot-fecha").value || todayISO();
  const cliente = document.getElementById("cot-cliente").value.trim();
  const dir = document.getElementById("cot-dir").value.trim();
  const email = document.getElementById("cot-email").value.trim();
  const tel = document.getElementById("cot-tel").value.trim();
  const metodo = document.getElementById("cot-metodo").value;
  const notas = document.getElementById("cot-notas").value.trim();

  if (!numero || !fecha || !cliente) {
    alert("Número, fecha y cliente son obligatorios.");
    return null;
  }

  const tbody = document.getElementById("cot-items-body");
  const rows = Array.from(tbody.querySelectorAll("tr"));
  const items = [];
  rows.forEach(row => {
    const desc = row.querySelector(".cot-item-desc").value.trim();
    const q = Number(row.querySelector(".cot-item-cant").value) || 0;
    const p = Number(row.querySelector(".cot-item-precio").value) || 0;
    const imp = Number(row.querySelector(".cot-item-imp").value) || 0;
    if (!desc && !q && !p) return;
    items.push({
      descripcion: desc,
      cantidad: q,
      precio: p,
      impuesto: imp
    });
  });

  if (!items.length) {
    alert("Añade al menos un ítem.");
    return null;
  }

  const { subtotal, impuesto, total } = recalcCotizacionTotals();

  return {
    id,
    numero,
    fecha,
    cliente,
    dir,
    email,
    tel,
    metodo,
    notas,
    items,
    subtotal,
    impuesto,
    total
  };
}

function exportCotizacionPdf(cotId) {
  const cot = cotizaciones.find(c => c.id === cotId);
  if (!cot) return;
  if (!window.jspdf || !window.jspdf.jsPDF) {
    alert("jsPDF no está disponible.");
    return;
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  // Logo
  if (config.logoDataUrl) {
    try {
      doc.addImage(config.logoDataUrl, "PNG", 10, 10, 35, 18);
    } catch (e) {
      console.warn("Error agregando logo:", e);
    }
  }

  // Datos empresa
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text(config.nombreNegocio || "Nexus Finance", 50, 12);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  if (config.dirNegocio) doc.text(config.dirNegocio, 50, 17);
  if (config.telNegocio) doc.text(`Tel: ${config.telNegocio}`, 50, 22);
  if (config.emailNegocio) doc.text(config.emailNegocio, 50, 27);

  // Título cotización
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("COTIZACIÓN", 150, 14);

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(`No.: ${cot.numero}`, 150, 19);
  doc.text(`Fecha: ${cot.fecha}`, 150, 24);

  // Datos cliente
  let yCli = 38;
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Cotizar a:", 10, yCli);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  yCli += 5;
  doc.text(cot.cliente || "", 10, yCli);
  if (cot.dir) {
    yCli += 5;
    doc.text(cot.dir, 10, yCli);
  }
  if (cot.tel) {
    yCli += 5;
    doc.text(`Tel: ${cot.tel}`, 10, yCli);
  }
  if (cot.email) {
    yCli += 5;
    doc.text(cot.email, 10, yCli);
  }

  // Tabla ítems
  let yTable = yCli + 10;
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("Descripción", 10, yTable);
  doc.text("Cant.", 90, yTable);
  doc.text("Precio", 110, yTable);
  doc.text("Imp%", 135, yTable);
  doc.text("Total", 160, yTable);

  doc.setDrawColor(200);
  doc.line(10, yTable + 2, 200 - 10, yTable + 2);

  let yRow = yTable + 8;
  doc.setFont("helvetica", "normal");
  cot.items.forEach(item => {
    if (yRow > 260) {
      doc.addPage();
      yRow = 20;
    }
    const base = (item.cantidad || 0) * (item.precio || 0);
    const tax = base * ((item.impuesto || 0) / 100);
    const tot = base + tax;

    doc.text(String(item.descripcion || ""), 10, yRow);
    doc.text(String(item.cantidad || 0), 92, yRow, { align: "right" });
    doc.text(formatMoney(item.precio || 0), 132, yRow, { align: "right" });
    doc.text(String(item.impuesto || 0), 147, yRow, { align: "right" });
    doc.text(formatMoney(tot), 190 - 10, yRow, { align: "right" });

    yRow += 6;
  });

  // Totales
  const yTotals = yRow + 6;
  doc.setFont("helvetica", "bold");
  doc.text("Subtotal:", 140, yTotals);
  doc.text("Impuesto:", 140, yTotals + 5);
  doc.text("Total:", 140, yTotals + 10);

  doc.setFont("helvetica", "normal");
  doc.text(formatMoney(cot.subtotal || 0), 190 - 10, yTotals, { align: "right" });
  doc.text(formatMoney(cot.impuesto || 0), 190 - 10, yTotals + 5, { align: "right" });
  doc.setFont("helvetica", "bold");
  doc.text(formatMoney(cot.total || 0), 190 - 10, yTotals + 10, { align: "right" });

  // Notas
  if (cot.notas) {
    const yNotas = yTotals + 22;
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text("Notas:", 10, yNotas);
    doc.setFont("helvetica", "normal");
    doc.text(doc.splitTextToSize(cot.notas, 180), 10, yNotas + 5);
  }

  doc.save(`Cotizacion-${cot.numero || cot.id}.pdf`);
}

function setupCotizaciones() {
  document.getElementById("btn-nueva-cotizacion")?.addEventListener("click", () => openCotizacionPanel(null));
  document.getElementById("btn-cot-add-item")?.addEventListener("click", () => addCotizacionItemRow());
  document.getElementById("btn-cot-close")?.addEventListener("click", closeCotizacionPanel);
  document.getElementById("btn-cot-cancel")?.addEventListener("click", closeCotizacionPanel);

  document.getElementById("form-cotizacion")?.addEventListener("submit", e => {
    e.preventDefault();
    const cotData = collectCotizacionFromForm();
    if (!cotData) return;

    const existingIdx = cotizaciones.findIndex(c => c.id === cotData.id);
    const now = Date.now();
    if (existingIdx >= 0) {
      cotizaciones[existingIdx] = {
        ...cotizaciones[existingIdx],
        ...cotData
      };
    } else {
      cotizaciones.push({
        ...cotData,
        createdAt: now
      });
    }

    saveCotizaciones();
    renderCotizaciones();
    closeCotizacionPanel();
  });

  const tbody = document.getElementById("tbody-cotizaciones");
  tbody?.addEventListener("click", e => {
    const btn = e.target.closest("button");
    if (!btn) return;
    const action = btn.dataset.action;
    const tr = btn.closest("tr");
    const id = tr?.dataset.id;
    if (!id) return;
    const cot = cotizaciones.find(c => c.id === id);
    if (!cot) return;

    if (action === "edit-cot") {
      openCotizacionPanel(cot);
    } else if (action === "delete-cot") {
      if (confirm("¿Borrar esta cotización?")) {
        cotizaciones = cotizaciones.filter(c => c.id !== id);
        saveCotizaciones();
        renderCotizaciones();
      }
    } else if (action === "pdf-cot") {
      exportCotizacionPdf(id);
    }
  });
}

// ====== CONFIGURACIÓN ======
function setupConfigSection() {
  const nombreInput = document.getElementById("config-nombre-negocio");
  const dirInput = document.getElementById("config-dir-negocio");
  const telInput = document.getElementById("config-tel-negocio");
  const emailInput = document.getElementById("config-email-negocio");
  const monedaInput = document.getElementById("config-moneda");
  const logoInput = document.getElementById("config-logo");
  const logoPreview = document.getElementById("config-logo-preview");

  if (nombreInput) nombreInput.value = config.nombreNegocio || "";
  if (dirInput) dirInput.value = config.dirNegocio || "";
  if (telInput) telInput.value = config.telNegocio || "";
  if (emailInput) emailInput.value = config.emailNegocio || "";
  if (monedaInput) monedaInput.value = config.moneda || "$";
  if (logoPreview && config.logoDataUrl) {
    logoPreview.src = config.logoDataUrl;
  }

  logoInput?.addEventListener("change", e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      config.logoDataUrl = reader.result;
      saveConfig();
      if (logoPreview) logoPreview.src = config.logoDataUrl;
    };
    reader.readAsDataURL(file);
  });

  document.getElementById("btn-guardar-config")?.addEventListener("click", () => {
    if (nombreInput) config.nombreNegocio = nombreInput.value.trim();
    if (dirInput) config.dirNegocio = dirInput.value.trim();
    if (telInput) config.telNegocio = telInput.value.trim();
    if (emailInput) config.emailNegocio = emailInput.value.trim();
    if (monedaInput) config.moneda = monedaInput.value.trim() || "$";
    saveConfig();
    renderKpis();
    alert("Configuración guardada.");
  });
}

// ====== NAVEGACIÓN PRINCIPAL ======
function setupNavigation() {
  const navItems = document.querySelectorAll(".nav-item");
  const sections = document.querySelectorAll(".section");

  navItems.forEach(btn => {
    btn.addEventListener("click", () => {
      const target = btn.getAttribute("data-section");
      navItems.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      sections.forEach(sec => {
        if (sec.id === `section-${target}`) {
          sec.classList.add("active-section");
        } else {
          sec.classList.remove("active-section");
        }
      });
    });
  });
}

// ====== PIN / LOGOUT ======
function setupPin() {
  const pinScreen = document.getElementById("pin-screen");
  const appShell = document.getElementById("app-shell");
  const pinInput = document.getElementById("pin-input");
  const pinError = document.getElementById("pin-error");

  function checkPin() {
    const value = pinInput.value.trim();
    if (value === PIN_CORRECTO) {
      pinError.classList.add("hidden");
      pinScreen.classList.add("hidden");
      appShell.classList.remove("hidden");
    } else {
      pinError.classList.remove("hidden");
    }
  }

  document.getElementById("btn-pin-enter")?.addEventListener("click", checkPin);
  pinInput?.addEventListener("keyup", e => {
    if (e.key === "Enter") checkPin();
  });

  document.getElementById("btn-logout")?.addEventListener("click", () => {
    appShell.classList.add("hidden");
    pinScreen.classList.remove("hidden");
    pinInput.value = "";
  });
}

// ====== INIT ======
document.addEventListener("DOMContentLoaded", () => {
  loadFromStorage();
  setupPin();
  renderTopbarDate();
  setupNavigation();
  setupModalMovimientos();
  setupExportButtons();
  setupFacturas();
  setupCotizaciones();
  setupConfigSection();
  renderKpis();
  renderMovimientosTablas();
  renderFacturas();
  renderCotizaciones();
});
