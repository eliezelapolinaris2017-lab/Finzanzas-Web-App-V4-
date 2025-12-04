// app.js — Nexus Finance (LocalStorage + Facturas + jsPDF)

const STORAGE_KEY_MOVIMIENTOS = "nexus-finance-movimientos";
const STORAGE_KEY_CONFIG = "nexus-finance-config";
const STORAGE_KEY_FACTURAS = "nexus-finance-facturas";

let movimientos = [];
let facturas = [];

let config = {
  nombreNegocio: "",
  moneda: "$",
  empresaDireccion: "",
  empresaTelefono: "",
  empresaEmail: "",
  invoiceLogoBase64: ""
};

let invoiceLogoBase64 = "";

// ========== UTILIDADES BÁSICAS ==========

function loadFromStorage() {
  try {
    const rawMov = localStorage.getItem(STORAGE_KEY_MOVIMIENTOS);
    movimientos = rawMov ? JSON.parse(rawMov) : [];
  } catch (e) {
    console.error("Error leyendo movimientos:", e);
    movimientos = [];
  }

  try {
    const rawCfg = localStorage.getItem(STORAGE_KEY_CONFIG);
    if (rawCfg) config = { ...config, ...JSON.parse(rawCfg) };
    invoiceLogoBase64 = config.invoiceLogoBase64 || "";
  } catch (e) {
    console.error("Error leyendo config:", e);
  }

  try {
    const rawFac = localStorage.getItem(STORAGE_KEY_FACTURAS);
    facturas = rawFac ? JSON.parse(rawFac) : [];
  } catch (e) {
    console.error("Error leyendo facturas:", e);
    facturas = [];
  }
}

function saveMovimientos() {
  localStorage.setItem(STORAGE_KEY_MOVIMIENTOS, JSON.stringify(movimientos));
}

function saveConfig() {
  config.invoiceLogoBase64 = invoiceLogoBase64;
  localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify(config));
}

function saveFacturas() {
  localStorage.setItem(STORAGE_KEY_FACTURAS, JSON.stringify(facturas));
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

// ========== TOPBAR FECHA ==========

function renderTopbarDate() {
  const el = document.getElementById("topbar-date");
  if (!el) return;
  const now = new Date();
  const formato = now.toLocaleDateString("es-PR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
  el.textContent = formato;
}

// ========== KPIs ==========

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

// ========== TABLAS INGRESOS / GASTOS ==========

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

// ========== MODAL MOVIMIENTO ==========

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
  }
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
      createdAt: Date.now()
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

// ========== NAVEGACIÓN SECCIONES ==========

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

// ========== EXPORTAR CSV MOVIMIENTOS ==========

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

// ========== CONFIGURACIÓN (NEGOCIO + LOGO) ==========

function setupConfig() {
  const nombreInput = document.getElementById("config-nombre-negocio");
  const monedaInput = document.getElementById("config-moneda");
  const dirInput = document.getElementById("config-empresa-direccion");
  const telInput = document.getElementById("config-empresa-telefono");
  const emailInput = document.getElementById("config-empresa-email");
  const logoInput = document.getElementById("config-logo-factura");

  if (nombreInput) nombreInput.value = config.nombreNegocio || "";
  if (monedaInput) monedaInput.value = config.moneda || "$";
  if (dirInput) dirInput.value = config.empresaDireccion || "";
  if (telInput) telInput.value = config.empresaTelefono || "";
  if (emailInput) emailInput.value = config.empresaEmail || "";

  document.getElementById("btn-guardar-config")?.addEventListener("click", () => {
    if (nombreInput) config.nombreNegocio = nombreInput.value.trim();
    if (monedaInput) config.moneda = monedaInput.value.trim() || "$";
    if (dirInput) config.empresaDireccion = dirInput.value.trim();
    if (telInput) config.empresaTelefono = telInput.value.trim();
    if (emailInput) config.empresaEmail = emailInput.value.trim();

    saveConfig();
    renderKpis();
    alert("Configuración guardada.");
  });

  logoInput?.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      invoiceLogoBase64 = reader.result;
      config.invoiceLogoBase64 = invoiceLogoBase64;
      saveConfig();
      alert("Logo para facturas guardado correctamente.");
    };
    reader.readAsDataURL(file);
  });
}

// ========== LOGOUT PLACEHOLDER ==========

function setupLogout() {
  const btn = document.getElementById("btn-logout");
  if (!btn) return;
  btn.addEventListener("click", () => {
    alert("Aquí iría el cierre de sesión real. (Solo local por ahora).");
  });
}

// ========== FACTURAS: LÓGICA ==========

function parseItemsFromText(text) {
  const lines = (text || "").split("\n");
  const items = [];

  lines.forEach((raw) => {
    const line = raw.trim();
    if (!line) return;
    const parts = line.split("|").map((p) => p.trim());
    if (parts.length < 3) return;
    const cantidad = Number(parts[0]) || 0;
    const descripcion = parts[1] || "";
    const precio = Number(parts[2]) || 0;
    if (!cantidad || !precio) return;

    items.push({ cantidad, descripcion, precio });
  });

  return items;
}

function recalcularFactura(f) {
  const items = f.items || [];
  let subtotal = 0;
  items.forEach((it) => {
    subtotal += (Number(it.cantidad) || 0) * (Number(it.precio) || 0);
  });
  const taxPercent = Number(f.taxPercent) || 0;
  const taxAmount = subtotal * (taxPercent / 100);
  const total = subtotal + taxAmount;

  f.subtotal = subtotal;
  f.taxPercent = taxPercent;
  f.taxAmount = taxAmount;
  f.total = total;
}

function syncFacturaToMovimientos(factura) {
  // Crea o actualiza un movimiento de ingreso vinculado a la factura
  if (!factura.fecha) factura.fecha = todayISO();

  let mov = null;
  if (factura.movId) {
    mov = movimientos.find((m) => m.id === factura.movId);
  }

  if (!mov) {
    mov = {
      id: factura.movId || ("mov-" + Date.now()),
      createdAt: Date.now()
    };
    movimientos.push(mov);
  }

  mov.tipo = "ingreso";
  mov.fecha = factura.fecha;
  mov.descripcion = `Factura ${factura.numero} - ${factura.cliente || ""}`;
  mov.categoria = "Factura";
  mov.metodo = factura.metodo || "Otro";
  mov.monto = factura.total || 0;

  factura.movId = mov.id;

  saveMovimientos();
}

// Render tabla de facturas
function renderFacturasTable() {
  const tbody = document.getElementById("tbody-facturas");
  if (!tbody) return;
  tbody.innerHTML = "";

  const ordenadas = facturas
    .slice()
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  ordenadas.forEach((f) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${f.numero || ""}</td>
      <td>${f.fecha || ""}</td>
      <td>${f.cliente || ""}</td>
      <td class="right">${formatMoney(f.total || 0)}</td>
      <td>
        <button class="btn-small" data-edit-factura="${f.id}">Editar</button>
        <button class="btn-small-outline" data-pdf-factura="${f.id}">PDF</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function fillFacturaForm(f) {
  document.getElementById("fac-id").value = f.id || "";
  document.getElementById("fac-numero").value = f.numero || "";
  document.getElementById("fac-fecha").value = f.fecha || todayISO();
  document.getElementById("fac-cliente").value = f.cliente || "";
  document.getElementById("fac-cliente-dir").value = f.clienteDireccion || "";
  document.getElementById("fac-metodo").value = f.metodo || "Efectivo";
  document.getElementById("fac-tax").value = f.taxPercent ?? 0;
  document.getElementById("fac-notas").value = f.notas || "";

  const itemsText = (f.items || [])
    .map((it) => `${it.cantidad} | ${it.descripcion} | ${it.precio}`)
    .join("\n");
  document.getElementById("fac-items-text").value = itemsText;
}

function clearFacturaForm() {
  document.getElementById("fac-id").value = "";
  document.getElementById("fac-numero").value = "";
  document.getElementById("fac-fecha").value = todayISO();
  document.getElementById("fac-cliente").value = "";
  document.getElementById("fac-cliente-dir").value = "";
  document.getElementById("fac-metodo").value = "Efectivo";
  document.getElementById("fac-items-text").value = "";
  document.getElementById("fac-tax").value = 0;
  document.getElementById("fac-notas").value = "";
}

function generateFacturaPdf(factura) {
  if (!window.jspdf || !window.jspdf.jsPDF) {
    console.error("jsPDF no encontrado en window.jspdf.jsPDF");
    alert("jsPDF no está cargado. Revisa que el <script> del CDN esté ANTES de app.js.");
    return;
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF("p", "mm", "letter");

  const marginLeft = 15;
  let cursorY = 18;

  // LOGO
  if (invoiceLogoBase64) {
    try {
      doc.addImage(invoiceLogoBase64, "PNG", marginLeft, 10, 40, 20);
    } catch (e) {
      console.warn("Error añadiendo logo a PDF:", e);
    }
  }

  // DATOS DE LA EMPRESA
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  const nombre = config.nombreNegocio || "Mi negocio";
  const dir = config.empresaDireccion || "";
  const tel = config.empresaTelefono || "";
  const email = config.empresaEmail || "";

  doc.text(nombre, 110, 18);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);

  const empresaLines = [];
  if (dir) empresaLines.push(dir);
  if (tel) empresaLines.push("Tel: " + tel);
  if (email) empresaLines.push("Email: " + email);
  empresaLines.forEach((line, i) => {
    doc.text(line, 110, 24 + i * 5);
  });

  // TÍTULO FACTURA
  cursorY = 50;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("FACTURA", marginLeft, cursorY);
  cursorY += 8;

  // INFO FACTURA + CLIENTE
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`Factura: ${factura.numero}`, marginLeft, cursorY);
  doc.text(`Fecha: ${factura.fecha}`, marginLeft, cursorY + 5);

  const clienteBlockY = cursorY;
  doc.text("Facturar a:", 110, clienteBlockY);
  doc.text(factura.cliente || "", 110, clienteBlockY + 5);
  if (factura.clienteDireccion) {
    const cliDirLines = doc.splitTextToSize(factura.clienteDireccion, 80);
    doc.text(cliDirLines, 110, clienteBlockY + 10);
  }

  cursorY += 18;

  // TABLA DE ITEMS
  const startY = cursorY;
  doc.setFont("helvetica", "bold");
  doc.text("Descripción", marginLeft, startY);
  doc.text("Cant.", 120, startY);
  doc.text("Precio", 140, startY);
  doc.text("Total", 170, startY);

  doc.setDrawColor(0);
  doc.line(marginLeft, startY + 2, 195 - marginLeft, startY + 2);

  doc.setFont("helvetica", "normal");
  cursorY = startY + 8;

  (factura.items || []).forEach((it) => {
    const descLines = doc.splitTextToSize(it.descripcion || "", 90);
    const lineHeight = 5 * descLines.length;
    const totalLinea = (it.cantidad || 0) * (it.precio || 0);

    doc.text(descLines, marginLeft, cursorY);
    doc.text(String(it.cantidad || 0), 120, cursorY);
    doc.text(formatMoney(it.precio || 0), 140, cursorY);
    doc.text(formatMoney(totalLinea), 170, cursorY);

    cursorY += lineHeight + 2;
  });

  // RESUMEN
  cursorY += 4;
  doc.text("Subtotal:", 140, cursorY);
  doc.text(formatMoney(factura.subtotal || 0), 180, cursorY, { align: "right" });

  cursorY += 5;
  doc.text(`Impuesto (${factura.taxPercent || 0}%):`, 140, cursorY);
  doc.text(formatMoney(factura.taxAmount || 0), 180, cursorY, { align: "right" });

  cursorY += 6;
  doc.setFont("helvetica", "bold");
  doc.text("Total:", 140, cursorY);
  doc.text(formatMoney(factura.total || 0), 180, cursorY, { align: "right" });

  // NOTAS
  cursorY += 12;
  if (factura.notas) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text("Notas:", marginLeft, cursorY);
    const notasLines = doc.splitTextToSize(factura.notas, 180 - marginLeft * 2);
    doc.text(notasLines, marginLeft, cursorY + 5);
  }

  doc.save(`Factura-${factura.numero}.pdf`);
}

function setupFacturasModule() {
  const form = document.getElementById("form-factura");
  const btnNueva = document.getElementById("btn-factura-nueva");
  const btnGuardarPdf = document.getElementById("btn-factura-guardar-pdf");
  const tbody = document.getElementById("tbody-facturas");

  clearFacturaForm();
  renderFacturasTable();

  btnNueva?.addEventListener("click", () => {
    clearFacturaForm();
  });

  form?.addEventListener("submit", (e) => {
    e.preventDefault();

    const id = document.getElementById("fac-id").value || null;
    const numero = document.getElementById("fac-numero").value.trim();
    const fecha = document.getElementById("fac-fecha").value || todayISO();
    const cliente = document.getElementById("fac-cliente").value.trim();
    const clienteDir = document.getElementById("fac-cliente-dir").value.trim();
    const metodo = document.getElementById("fac-metodo").value;
    const itemsText = document.getElementById("fac-items-text").value;
    const taxPercent = Number(document.getElementById("fac-tax").value) || 0;
    const notas = document.getElementById("fac-notas").value.trim();

    if (!numero || !cliente) {
      alert("Número de factura y cliente son obligatorios.");
      return;
    }

    const items = parseItemsFromText(itemsText);
    if (items.length === 0) {
      alert("Debes añadir al menos un ítem con cantidad | descripción | precio.");
      return;
    }

    let factura = null;
    if (id) {
      factura = facturas.find((f) => f.id === id);
    }
    if (!factura) {
      factura = {
        id: "fac-" + Date.now(),
        createdAt: Date.now()
      };
      facturas.push(factura);
    }

    factura.numero = numero;
    factura.fecha = fecha;
    factura.cliente = cliente;
    factura.clienteDireccion = clienteDir;
    factura.metodo = metodo;
    factura.items = items;
    factura.taxPercent = taxPercent;
    factura.notas = notas;

    recalcularFactura(factura);
    syncFacturaToMovimientos(factura);
    saveFacturas();
    saveMovimientos();

    renderFacturasTable();
    renderKpis();
    renderTablas();
    fillFacturaForm(factura);

    alert("Factura guardada.");
  });

  btnGuardarPdf?.addEventListener("click", () => {
    // Guardar primero con el submit (simulado)
    form.requestSubmit();

    const id = document.getElementById("fac-id").value;
    if (!id) {
      alert("Primero guarda la factura.");
      return;
    }
    const factura = facturas.find((f) => f.id === id);
    if (!factura) {
      alert("No se encontró la factura para PDF.");
      return;
    }
    generateFacturaPdf(factura);
  });

  tbody?.addEventListener("click", (e) => {
    const target = e.target;
    if (!(target instanceof HTMLElement)) return;

    const editId = target.getAttribute("data-edit-factura");
    const pdfId = target.getAttribute("data-pdf-factura");

    if (editId) {
      const f = facturas.find((ff) => ff.id === editId);
      if (!f) return;
      fillFacturaForm(f);
    } else if (pdfId) {
      const f = facturas.find((ff) => ff.id === pdfId);
      if (!f) return;
      generateFacturaPdf(f);
    }
  });
}

// ========== INIT ==========

document.addEventListener("DOMContentLoaded", () => {
  loadFromStorage();
  renderTopbarDate();
  setupNavigation();
  setupModal();
  setupExportButtons();
  setupConfig();
  setupLogout();
  setupFacturasModule();
  renderKpis();
  renderTablas();
});
