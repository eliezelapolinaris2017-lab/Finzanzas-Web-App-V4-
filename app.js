// =========================
// NEXUS FINANCE DESKTOP v4
// 100% localStorage (sin Firebase)
// =========================

const STORAGE_KEY_MOVIMIENTOS = "nexus-finance-movimientos";
const STORAGE_KEY_CONFIG = "nexus-finance-config";
const STORAGE_KEY_FACTURAS = "nexus-finance-facturas";
const STORAGE_KEY_INVOICE_LOGO = "nexus-finance-invoice-logo";

let movimientos = [];
let facturas = [];
let invoiceLogoBase64 = null;

let config = {
  nombreNegocio: "",
  moneda: "$",
  empresaDireccion: "",
  empresaTelefono: "",
  empresaEmail: "",
};

// ===== UTILIDADES GENERALES =====

function loadFromStorage() {
  // movimientos
  try {
    const raw = localStorage.getItem(STORAGE_KEY_MOVIMIENTOS);
    movimientos = raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error("Error leyendo movimientos:", e);
    movimientos = [];
  }

  // config
  try {
    const rawCfg = localStorage.getItem(STORAGE_KEY_CONFIG);
    if (rawCfg) {
      const parsed = JSON.parse(rawCfg);
      config = { ...config, ...parsed };
    }
  } catch (e) {
    console.error("Error leyendo config:", e);
  }

  // facturas
  try {
    const rawF = localStorage.getItem(STORAGE_KEY_FACTURAS);
    facturas = rawF ? JSON.parse(rawF) : [];
  } catch (e) {
    console.error("Error leyendo facturas:", e);
    facturas = [];
  }

  // logo
  try {
    invoiceLogoBase64 = localStorage.getItem(STORAGE_KEY_INVOICE_LOGO);
  } catch (e) {
    console.error("Error leyendo logo factura:", e);
    invoiceLogoBase64 = null;
  }
}

function saveMovimientos() {
  localStorage.setItem(STORAGE_KEY_MOVIMIENTOS, JSON.stringify(movimientos));
}

function saveConfig() {
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

// ===== TOPBAR FECHA =====

function renderTopbarDate() {
  const el = document.getElementById("topbar-date");
  if (!el) return;
  const now = new Date();
  const formatted = now.toLocaleDateString("es-PR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  el.textContent = formatted;
}

// ===== KPIs =====

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
  if (elMovMes) elMovMes.textContent = movimientos.filter((m) => sameMonth(m.fecha, hoy)).length;

  const ultimo = [...movimientos].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))[0];
  if (elUlt) {
    if (ultimo) {
      const tipoTxt = ultimo.tipo === "ingreso" ? "Ingreso" : "Gasto";
      elUlt.textContent = `${tipoTxt} de ${formatMoney(ultimo.monto)} el ${ultimo.fecha}`;
    } else {
      elUlt.textContent = "Sin movimientos recientes";
    }
  }
}

// ===== TABLAS INGRESOS / GASTOS =====

function buildRowMovimiento(m) {
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

  recientesIng.forEach((m) => tbodyIng && tbodyIng.appendChild(buildRowMovimiento(m)));
  recientesGas.forEach((m) => tbodyGas && tbodyGas.appendChild(buildRowMovimiento(m)));

  ingresos.forEach((m) => tbodyIngFull && tbodyIngFull.appendChild(buildRowMovimiento(m)));
  gastos.forEach((m) => tbodyGasFull && tbodyGasFull.appendChild(buildRowMovimiento(m)));
}

// ===== MODAL MOVIMIENTO =====

const modalMovimiento = {
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
    if (!this.fechaInput.value) this.fechaInput.value = todayISO();
    this.backdrop.classList.add("show");
  },

  close() {
    if (!this.backdrop) return;
    this.backdrop.classList.remove("show");
  },
};

function setupModalMovimiento() {
  modalMovimiento.backdrop = document.getElementById("modal-movimiento");
  modalMovimiento.tipoInput = document.getElementById("mov-tipo");
  modalMovimiento.fechaInput = document.getElementById("mov-fecha");
  modalMovimiento.descInput = document.getElementById("mov-descripcion");
  modalMovimiento.catInput = document.getElementById("mov-categoria");
  modalMovimiento.metodoInput = document.getElementById("mov-metodo");
  modalMovimiento.montoInput = document.getElementById("mov-monto");
  modalMovimiento.titleEl = document.getElementById("modal-title");

  const btnAddMov = document.getElementById("btn-add-movimiento");
  btnAddMov?.addEventListener("click", () => modalMovimiento.open("ingreso"));

  document.querySelectorAll("[data-add]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const tipo = btn.getAttribute("data-add") === "gasto" ? "gasto" : "ingreso";
      modalMovimiento.open(tipo);
    });
  });

  document.getElementById("modal-close")?.addEventListener("click", () => modalMovimiento.close());
  document.getElementById("modal-cancel")?.addEventListener("click", () => modalMovimiento.close());

  const form = document.getElementById("form-movimiento");
  form?.addEventListener("submit", (e) => {
    e.preventDefault();
    const tipo = modalMovimiento.tipoInput.value;
    const fecha = modalMovimiento.fechaInput.value || todayISO();
    const descripcion = modalMovimiento.descInput.value.trim();
    const categoria = modalMovimiento.catInput.value.trim();
    const metodo = modalMovimiento.metodoInput.value;
    const monto = Number(modalMovimiento.montoInput.value);

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
    modalMovimiento.fechaInput.value = todayISO();
    modalMovimiento.close();
  });
}

// ===== NAVEGACIÓN =====

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

// ===== EXPORT CSV MOVIMIENTOS =====

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

function setupExportButtonsMovimientos() {
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

// ===== CONFIG + LOGO =====

function setupConfig() {
  const nombreInput = document.getElementById("config-nombre-negocio");
  const monedaInput = document.getElementById("config-moneda");
  const dirInput = document.getElementById("config-empresa-direccion");
  const telInput = document.getElementById("config-empresa-telefono");
  const emailInput = document.getElementById("config-empresa-email");

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

  setupInvoiceLogo();
}

function setupInvoiceLogo() {
  const inputFile = document.getElementById("invoice-logo-input");
  const img = document.getElementById("invoice-logo-preview-img");
  const emptyTxt = document.getElementById("invoice-logo-empty");

  function refreshPreview() {
    if (invoiceLogoBase64 && img && emptyTxt) {
      img.src = invoiceLogoBase64;
      img.style.display = "block";
      emptyTxt.style.display = "none";
    } else if (img && emptyTxt) {
      img.style.display = "none";
      emptyTxt.style.display = "inline";
    }
  }

  if (inputFile) {
    inputFile.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        invoiceLogoBase64 = ev.target.result;
        localStorage.setItem(STORAGE_KEY_INVOICE_LOGO, invoiceLogoBase64);
        refreshPreview();
      };
      reader.readAsDataURL(file);
    });
  }

  refreshPreview();
}

// ===== LOGOUT PLACEHOLDER =====

function setupLogout() {
  const btn = document.getElementById("btn-logout");
  btn?.addEventListener("click", () => {
    alert("Aquí puedes implementar un login real en el futuro. Por ahora solo cierra la pestaña.");
  });
}

// ===== FACTURAS UI =====

function setupFacturasUI() {
  const btnNueva = document.getElementById("btn-nueva-factura");
  const btnExportCsv = document.getElementById("btn-facturas-export-csv");
  const modalBackdrop = document.getElementById("modal-factura");
  const btnClose = document.getElementById("modal-factura-close");
  const btnCancel = document.getElementById("modal-factura-cancel");
  const btnGuardar = document.getElementById("btn-factura-guardar-sin-pdf");
  const btnGuardarPdf = document.getElementById("btn-factura-guardar-pdf");
  const btnAddItem = document.getElementById("btn-add-factura-item");

  function openFacturaModal(factura) {
    const fechaInput = document.getElementById("fact-fecha");
    const numeroInput = document.getElementById("fact-numero");
    const clienteInput = document.getElementById("fact-cliente");
    const dirCliInput = document.getElementById("fact-cliente-direccion");
    const notasInput = document.getElementById("fact-notas");
    const taxPercent = document.getElementById("fact-tax-percent");
    const tbodyItems = document.getElementById("tbody-factura-items");

    tbodyItems.innerHTML = "";

    const hoy = todayISO();
    fechaInput.value = factura?.fecha || hoy;
    numeroInput.value = factura?.numero || String(facturas.length + 1).padStart(4, "0");
    clienteInput.value = factura?.cliente || "";
    dirCliInput.value = factura?.clienteDireccion || "";
    notasInput.value = factura?.notas || "";
    taxPercent.value = factura?.taxPercent ?? 0;

    const items = factura?.items?.length ? factura.items : [{ descripcion: "", cantidad: 1, precio: 0 }];

    items.forEach((it) => addFacturaItemRow(it.descripcion, it.cantidad, it.precio));

    recalcFacturaTotals();
    modalBackdrop.classList.add("show");
  }

  function closeFacturaModal() {
    modalBackdrop.classList.remove("show");
  }

  btnNueva?.addEventListener("click", () => openFacturaModal(null));
  btnClose?.addEventListener("click", closeFacturaModal);
  btnCancel?.addEventListener("click", closeFacturaModal);
  btnAddItem?.addEventListener("click", () => addFacturaItemRow("", 1, 0));

  btnGuardar?.addEventListener("click", () => {
    const factura = collectFacturaFromModal();
    if (!factura) return;
    facturas.push(factura);
    saveFacturas();
    renderFacturasTable();
    closeFacturaModal();
  });

  btnGuardarPdf?.addEventListener("click", () => {
    const factura = collectFacturaFromModal();
    if (!factura) return;
    facturas.push(factura);
    saveFacturas();
    renderFacturasTable();
    generateFacturaPdf(factura);
    closeFacturaModal();
  });

  btnExportCsv?.addEventListener("click", () => {
    const header = ["numero", "fecha", "cliente", "total"];
    const lines = [header.join(",")];
    facturas.forEach((f) => {
      lines.push([f.numero, f.fecha, `"${(f.cliente || "").replace(/"/g, '""')}"`, f.total.toFixed(2)].join(","));
    });
    const csv = lines.join("\n");
    downloadCsv("facturas.csv", csv);
  });

  document.getElementById("tbody-facturas")?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-fact-pdf]");
    if (!btn) return;
    const id = btn.getAttribute("data-fact-pdf");
    const f = facturas.find((x) => x.id === id);
    if (!f) return;
    generateFacturaPdf(f);
  });
}

function addFacturaItemRow(descripcion, cantidad, precio) {
  const tbody = document.getElementById("tbody-factura-items");
  if (!tbody) return;
  const tr = document.createElement("tr");

  tr.innerHTML = `
    <td><input class="inv-item-desc" type="text" value="${descripcion || ""}"></td>
    <td><input class="inv-item-qty" type="number" min="0" step="1" value="${cantidad || 1}"></td>
    <td><input class="inv-item-price" type="number" min="0" step="0.01" value="${precio || 0}"></td>
    <td class="right inv-item-total">0.00</td>
    <td><button type="button" class="btn-mini-outline inv-item-remove">X</button></td>
  `;

  tbody.appendChild(tr);

  const qtyInput = tr.querySelector(".inv-item-qty");
  const priceInput = tr.querySelector(".inv-item-price");
  const descInput = tr.querySelector(".inv-item-desc");
  const btnRemove = tr.querySelector(".inv-item-remove");

  [qtyInput, priceInput, descInput].forEach((inp) => {
    inp.addEventListener("input", recalcFacturaTotals);
  });

  btnRemove.addEventListener("click", () => {
    tr.remove();
    recalcFacturaTotals();
  });

  recalcFacturaTotals();
}

function recalcFacturaTotals() {
  const rows = document.querySelectorAll("#tbody-factura-items tr");
  let subtotal = 0;

  rows.forEach((tr) => {
    const qty = Number(tr.querySelector(".inv-item-qty")?.value || 0);
    const price = Number(tr.querySelector(".inv-item-price")?.value || 0);
    const total = qty * price;
    subtotal += total;
    const tdTotal = tr.querySelector(".inv-item-total");
    if (tdTotal) tdTotal.textContent = total.toFixed(2);
  });

  const taxPercentInput = document.getElementById("fact-tax-percent");
  const taxPercent = Number(taxPercentInput?.value || 0);
  const taxAmount = subtotal * (taxPercent / 100);
  const total = subtotal + taxAmount;

  const elSub = document.getElementById("fact-subtotal");
  const elTaxAmt = document.getElementById("fact-tax-amount");
  const elTotal = document.getElementById("fact-total");

  if (elSub) elSub.textContent = formatMoney(subtotal);
  if (elTaxAmt) elTaxAmt.textContent = formatMoney(taxAmount);
  if (elTotal) elTotal.textContent = formatMoney(total);
}

function collectFacturaFromModal() {
  const numeroInput = document.getElementById("fact-numero");
  const fechaInput = document.getElementById("fact-fecha");
  const clienteInput = document.getElementById("fact-cliente");
  const dirCliInput = document.getElementById("fact-cliente-direccion");
  const notasInput = document.getElementById("fact-notas");
  const taxPercentInput = document.getElementById("fact-tax-percent");

  const rows = document.querySelectorAll("#tbody-factura-items tr");
  const items = [];
  rows.forEach((tr) => {
    const desc = tr.querySelector(".inv-item-desc")?.value.trim() || "";
    const qty = Number(tr.querySelector(".inv-item-qty")?.value || 0);
    const price = Number(tr.querySelector(".inv-item-price")?.value || 0);
    if (!desc && qty === 0 && price === 0) return;
    items.push({ descripcion: desc, cantidad: qty, precio: price });
  });

  if (!numeroInput.value.trim()) {
    alert("Escribe un número de factura.");
    return null;
  }
  if (!clienteInput.value.trim()) {
    alert("Escribe el nombre del cliente.");
    return null;
  }
  if (!items.length) {
    alert("Añade al menos una línea a la factura.");
    return null;
  }

  let subtotal = 0;
  items.forEach((it) => {
    subtotal += (it.cantidad || 0) * (it.precio || 0);
  });
  const taxPercent = Number(taxPercentInput.value || 0);
  const taxAmount = subtotal * (taxPercent / 100);
  const total = subtotal + taxAmount;

  return {
    id: Date.now().toString(),
    numero: numeroInput.value.trim(),
    fecha: fechaInput.value || todayISO(),
    cliente: clienteInput.value.trim(),
    clienteDireccion: dirCliInput.value.trim(),
    notas: notasInput.value.trim(),
    items,
    subtotal,
    taxPercent,
    taxAmount,
    total,
    createdAt: Date.now(),
  };
}

function renderFacturasTable() {
  const tbody = document.getElementById("tbody-facturas");
  if (!tbody) return;
  tbody.innerHTML = "";

  const ordenadas = [...facturas].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  ordenadas.forEach((f) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${f.numero}</td>
      <td>${f.fecha}</td>
      <td>${f.cliente}</td>
      <td class="right">${formatMoney(f.total || 0)}</td>
      <td>
        <button type="button" class="btn-mini-outline" data-fact-pdf="${f.id}">
          PDF
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// ===== PDF FACTURA (jsPDF) =====

function generateFacturaPdf(factura) {
  if (!window.jspdf) {
    alert("jsPDF no está cargado.");
    return;
  }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF("p", "mm", "letter");

  const marginLeft = 15;
  let cursorY = 18;

  // Logo
  if (invoiceLogoBase64) {
    try {
      doc.addImage(invoiceLogoBase64, "PNG", marginLeft, 10, 40, 20);
    } catch (e) {
      console.warn("Error añadiendo logo:", e);
    }
  }

  // Datos negocio
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

  // Título
  cursorY = 50;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("FACTURA", marginLeft, cursorY);
  cursorY += 8;

  // Datos factura + cliente
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

  // Tabla items
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

  factura.items.forEach((it) => {
    const descLines = doc.splitTextToSize(it.descripcion || "", 90);
    const lineHeight = 5 * descLines.length;
    const totalLinea = (it.cantidad || 0) * (it.precio || 0);

    doc.text(descLines, marginLeft, cursorY);
    doc.text(String(it.cantidad || 0), 120, cursorY);
    doc.text(formatMoney(it.precio || 0), 140, cursorY);
    doc.text(formatMoney(totalLinea), 170, cursorY);

    cursorY += lineHeight + 2;
  });

  // Totales
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

  // Notas
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

// ===== INIT =====

document.addEventListener("DOMContentLoaded", () => {
  loadFromStorage();
  renderTopbarDate();
  setupNavigation();
  setupModalMovimiento();
  setupExportButtonsMovimientos();
  setupConfig();
  setupLogout();
  setupFacturasUI();
  renderKpis();
  renderTablas();
  renderFacturasTable();
});
