// ===================== STATE & STORAGE =====================
const STORAGE_MOV = "nexus-finance-movimientos-v1";
const STORAGE_CFG = "nexus-finance-config-v1";
const STORAGE_FAC = "nexus-finance-facturas-v1";
const STORAGE_PIN_HASH = "nexus-finance-pin-hash";
const STORAGE_PIN_VERIFIED = "nexus-finance-pin-verified";

let movimientos = [];
let config = {
  nombreNegocio: "Nexus Finance",
  moneda: "$",
  direccion: "",
  telefono: "",
  logoData: "",
  logoRatio: 1
};
let facturas = [];

// ===================== HELPERS GENERALES =====================
function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
function sameDay(a, b) {
  return a === b;
}
function sameMonth(dateStr, refStr) {
  if (!dateStr) return false;
  return dateStr.slice(0, 7) === refStr.slice(0, 7);
}
function formatMoney(num) {
  const n = Number(num) || 0;
  return `${config.moneda || "$"}${n.toFixed(2)}`;
}

// ===================== STORAGE =====================
function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_MOV);
    movimientos = raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error("Error leyendo movimientos:", e);
    movimientos = [];
  }
  try {
    const rawCfg = localStorage.getItem(STORAGE_CFG);
    if (rawCfg) config = { ...config, ...JSON.parse(rawCfg) };
  } catch (e) {
    console.error("Error leyendo config:", e);
  }
  try {
    const rawFac = localStorage.getItem(STORAGE_FAC);
    facturas = rawFac ? JSON.parse(rawFac) : [];
  } catch (e) {
    console.error("Error leyendo facturas:", e);
    facturas = [];
  }
}
function saveMovimientos() {
  localStorage.setItem(STORAGE_MOV, JSON.stringify(movimientos));
}
function saveConfig() {
  localStorage.setItem(STORAGE_CFG, JSON.stringify(config));
}
function saveFacturas() {
  localStorage.setItem(STORAGE_FAC, JSON.stringify(facturas));
}

// ===================== TOPBAR =====================
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

// ===================== KPI =====================
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

// ===================== TABLAS INGRESOS/GASTOS =====================
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

// ===================== MODAL MOVIMIENTO =====================
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

  // BOTÓN GLOBAL TOPBAR
  document.getElementById("btn-add-movimiento")?.addEventListener("click", () => {
    modal.open("ingreso");
  });

  // BOTONES DENTRO DE SECCIONES
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
      id: "mov-" + Date.now().toString(36),
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

// ===================== NAVEGACIÓN SECCIONES =====================
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

// ===================== EXPORTAR CSV =====================
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

// ===================== CONFIG (NEGOCIO + LOGO) =====================
function setupConfig() {
  const nombreInput = document.getElementById("config-nombre-negocio");
  const monedaInput = document.getElementById("config-moneda");
  const dirInput = document.getElementById("config-direccion");
  const telInput = document.getElementById("config-telefono");
  const logoInput = document.getElementById("config-logo");
  const logoPreview = document.getElementById("config-logo-preview");

  if (nombreInput) nombreInput.value = config.nombreNegocio || "";
  if (monedaInput) monedaInput.value = config.moneda || "$";
  if (dirInput) dirInput.value = config.direccion || "";
  if (telInput) telInput.value = config.telefono || "";
  if (logoPreview && config.logoData) {
    logoPreview.src = config.logoData;
  }

  document.getElementById("btn-guardar-config")?.addEventListener("click", () => {
    if (nombreInput) config.nombreNegocio = nombreInput.value.trim() || "Mi negocio";
    if (monedaInput) config.moneda = monedaInput.value.trim() || "$";
    if (dirInput) config.direccion = dirInput.value.trim();
    if (telInput) config.telefono = telInput.value.trim();
    saveConfig();
    renderKpis();
    alert("Configuración guardada.");
  });

  logoInput?.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result;
      const img = new Image();
      img.onload = () => {
        const ratio = img.width && img.height ? img.width / img.height : 1;
        config.logoData = dataUrl;
        config.logoRatio = ratio;
        saveConfig();
        if (logoPreview) logoPreview.src = dataUrl;
        alert("Logo guardado en localStorage (para usar en PDFs).");
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  });
}

// ===================== FACTURAS =====================
function parseItemsFromText(text) {
  const lines = String(text || "").split("\n");
  const items = [];
  lines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    const parts = trimmed.split("|").map((s) => s.trim());
    if (parts.length < 3) return;
    const qty = Number(parts[0].replace(",", ".")) || 0;
    const desc = parts[1];
    const price = Number(parts[2].replace(",", ".")) || 0;
    if (!qty || !price) return;
    items.push({ qty, desc, price });
  });
  return items;
}
function recalcularFactura(f) {
  let subtotal = 0;
  f.items.forEach((it) => {
    subtotal += (Number(it.qty) || 0) * (Number(it.price) || 0);
  });
  const taxRate = Number(f.taxPercent) || 0;
  const taxAmount = subtotal * (taxRate / 100);
  f.subtotal = subtotal;
  f.taxAmount = taxAmount;
  f.total = subtotal + taxAmount;
}
function renderFacturasTable() {
  const tbody = document.getElementById("tbody-facturas");
  if (!tbody) return;
  tbody.innerHTML = "";

  const sorted = facturas
    .slice()
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  sorted.forEach((f) => {
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
function clearFacturaForm() {
  document.getElementById("fac-id").value = "";
  document.getElementById("fac-numero").value = "";
  document.getElementById("fac-fecha").value = todayISO();
  document.getElementById("fac-metodo").value = "Efectivo";
  document.getElementById("fac-cliente").value = "";
  document.getElementById("fac-cliente-dir").value = "";
  document.getElementById("fac-items-text").value = "";
  document.getElementById("fac-tax").value = "0";
  document.getElementById("fac-notas").value = "";
}
function fillFacturaForm(f) {
  document.getElementById("fac-id").value = f.id;
  document.getElementById("fac-numero").value = f.numero || "";
  document.getElementById("fac-fecha").value = f.fecha || todayISO();
  document.getElementById("fac-metodo").value = f.metodo || "Efectivo";
  document.getElementById("fac-cliente").value = f.cliente || "";
  document.getElementById("fac-cliente-dir").value = f.clienteDireccion || "";
  const text = (f.items || [])
    .map((it) => `${it.qty} | ${it.desc} | ${it.price}`)
    .join("\n");
  document.getElementById("fac-items-text").value = text;
  document.getElementById("fac-tax").value = f.taxPercent || 0;
  document.getElementById("fac-notas").value = f.notas || "";
}
function showFacturaForm() {
  const panel = document.getElementById("factura-form-panel");
  if (panel) panel.style.display = "block";
}
function hideFacturaForm() {
  const panel = document.getElementById("factura-form-panel");
  if (panel) panel.style.display = "none";
}

// Sincroniza una factura con movimientos (ingreso)
function syncFacturaToMovimientos(factura) {
  const id = factura.id;
  let mov = movimientos.find((m) => m.facturaId === id);
  if (!mov) {
    mov = {
      id: "mov-fac-" + id,
      tipo: "ingreso",
      createdAt: factura.createdAt || Date.now(),
      facturaId: id
    };
    movimientos.push(mov);
  }
  mov.tipo = "ingreso";
  mov.fecha = factura.fecha;
  mov.descripcion = `Factura ${factura.numero} - ${factura.cliente || ""}`;
  mov.categoria = "Facturación";
  mov.metodo = factura.metodo || "Otro";
  mov.monto = factura.total || 0;
}

// jsPDF: generar factura
function generateFacturaPdf(f) {
  if (!window.jspdf || !window.jspdf.jsPDF) {
    alert("jsPDF no está disponible.");
    return;
  }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "mm", format: "a4" });

  const marginX = 14;
  let y = 18;

  // Logo
  if (config.logoData) {
    try {
      const ratio = config.logoRatio || 1;
      const logoW = 32;
      const logoH = logoW / ratio;
      doc.addImage(config.logoData, "PNG", marginX, 10, logoW, logoH);
    } catch (e) {
      console.warn("Error al añadir logo:", e);
    }
  }

  // Datos negocio
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(config.nombreNegocio || "Mi negocio", marginX + 40, y);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  let lineY = y + 6;
  if (config.direccion) {
    doc.text(config.direccion, marginX + 40, lineY);
    lineY += 5;
  }
  if (config.telefono) {
    doc.text("Tel: " + config.telefono, marginX + 40, lineY);
    lineY += 5;
  }

  // Título factura
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("FACTURA", 200 - marginX, 18, { align: "right" });
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("Factura #: " + (f.numero || ""), 200 - marginX, 24, { align: "right" });
  doc.text("Fecha: " + (f.fecha || ""), 200 - marginX, 29, { align: "right" });

  // Línea
  doc.setDrawColor(200);
  doc.line(marginX, 36, 200 - marginX, 36);
  y = 42;

  // Datos cliente
  doc.setFont("helvetica", "bold");
  doc.text("Facturar a:", marginX, y);
  doc.setFont("helvetica", "normal");
  y += 6;
  if (f.cliente) {
    doc.text(String(f.cliente), marginX, y);
    y += 5;
  }
  if (f.clienteDireccion) {
    const dirLines = doc.splitTextToSize(String(f.clienteDireccion), 80);
    dirLines.forEach((ln) => {
      doc.text(ln, marginX, y);
      y += 4;
    });
  }
  if (y < 58) y = 58;

  // Tabla de items
  y += 4;
  doc.setFont("helvetica", "bold");
  doc.text("Cant.", marginX, y);
  doc.text("Descripción", marginX + 18, y);
  doc.text("Precio", 200 - 60, y, { align: "left" });
  doc.text("Importe", 200 - marginX, y, { align: "right" });
  y += 4;
  doc.setDrawColor(220);
  doc.line(marginX, y, 200 - marginX, y);
  y += 6;
  doc.setFont("helvetica", "normal");

  (f.items || []).forEach((it) => {
    const qty = it.qty || 0;
    const desc = it.desc || "";
    const price = Number(it.price) || 0;
    const amount = qty * price;

    const descLines = doc.splitTextToSize(desc, 100);
    const lineHeight = 4;
    descLines.forEach((ln, idx) => {
      if (idx === 0) {
        doc.text(String(qty), marginX, y);
        doc.text(formatMoney(price), 200 - 60, y, { align: "left" });
        doc.text(formatMoney(amount), 200 - marginX, y, { align: "right" });
      }
      doc.text(ln, marginX + 18, y);
      y += lineHeight;
    });
    y += 2;
    if (y > 250) {
      doc.addPage();
      y = 20;
    }
  });

  // Totales
  if (y < 230) y = 230;
  doc.setDrawColor(220);
  doc.line(120, y - 2, 200 - marginX, y - 2);

  doc.setFont("helvetica", "bold");
  doc.text("Subtotal:", 120, y);
  doc.text("Impuesto:", 120, y + 5);
  doc.text("TOTAL:", 120, y + 11);

  doc.setFont("helvetica", "normal");
  doc.text(formatMoney(f.subtotal || 0), 200 - marginX, y, { align: "right" });
  doc.text(formatMoney(f.taxAmount || 0), 200 - marginX, y + 5, { align: "right" });
  doc.setFont("helvetica", "bold");
  doc.text(formatMoney(f.total || 0), 200 - marginX, y + 11, { align: "right" });

  // Notas
  if (f.notas) {
    const yNotes = y + 22;
    doc.setFont("helvetica", "bold");
    doc.text("Notas:", marginX, yNotes);
    doc.setFont("helvetica", "normal");
    const noteLines = doc.splitTextToSize(String(f.notas), 180 - marginX * 2);
    doc.text(noteLines, marginX, yNotes + 5);
  }

  doc.save(`Factura_${f.numero || ""}.pdf`);
}

// Setup módulo facturas (vista clásica con formulario oculto)
function setupFacturasModule() {
  const form = document.getElementById("form-factura");
  const btnNueva = document.getElementById("btn-factura-nueva");
  const btnNueva2 = document.getElementById("btn-factura-nueva-secundario");
  const btnCerrar = document.getElementById("btn-factura-cerrar");
  const btnGuardarPdf = document.getElementById("btn-factura-guardar-pdf");
  const tbody = document.getElementById("tbody-facturas");

  clearFacturaForm();
  renderFacturasTable();

  function nuevaFactura() {
    clearFacturaForm();
    showFacturaForm();
    const numInput = document.getElementById("fac-numero");
    if (numInput) numInput.focus();
  }

  btnNueva?.addEventListener("click", nuevaFactura);
  btnNueva2?.addEventListener("click", nuevaFactura);
  btnCerrar?.addEventListener("click", hideFacturaForm);

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
        id: "fac-" + Date.now().toString(36),
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
    showFacturaForm();

    alert("Factura guardada.");
  });

  btnGuardarPdf?.addEventListener("click", () => {
    // Simula submit para guardar datos
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
      showFacturaForm();
      const numInput = document.getElementById("fac-numero");
      if (numInput) numInput.focus();
    } else if (pdfId) {
      const f = facturas.find((ff) => ff.id === pdfId);
      if (!f) return;
      generateFacturaPdf(f);
    }
  });
}

// ===================== LOGOUT =====================
function setupLogout() {
  const btn = document.getElementById("btn-logout");
  btn?.addEventListener("click", () => {
    try {
      sessionStorage.removeItem(STORAGE_PIN_VERIFIED);
    } catch (e) {}
    showPinOverlay("login");
  });
}

// ===================== PIN / SEGURIDAD =====================
async function sha256(text) {
  const enc = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function showPinOverlay(mode) {
  const overlay = document.getElementById("pin-overlay");
  const title = document.getElementById("pin-title");
  const subtitle = document.getElementById("pin-subtitle");
  const pin1 = document.getElementById("pin-input");
  const pin2 = document.getElementById("pin-input-2");
  const errorEl = document.getElementById("pin-error");

  const hasHash = !!localStorage.getItem(STORAGE_PIN_HASH);
  const realMode = mode || (hasHash ? "login" : "create");

  if (realMode === "create") {
    title.textContent = "Crear PIN de acceso";
    subtitle.textContent = "Crea un PIN de 4–8 dígitos para proteger Nexus Finance.";
    pin2.style.display = "block";
  } else {
    title.textContent = "Bloqueo con PIN";
    subtitle.textContent = "Introduce tu PIN para entrar al panel.";
    pin2.style.display = "none";
  }

  pin1.value = "";
  pin2.value = "";
  errorEl.textContent = "";
  overlay.style.display = "flex";
  pin1.focus();

  overlay.dataset.mode = realMode;
}
function hidePinOverlay() {
  const overlay = document.getElementById("pin-overlay");
  overlay.style.display = "none";
}

function setupPinOverlay() {
  const overlay = document.getElementById("pin-overlay");
  const pin1 = document.getElementById("pin-input");
  const pin2 = document.getElementById("pin-input-2");
  const btnOk = document.getElementById("pin-accept");
  const btnReset = document.getElementById("pin-reset");
  const errorEl = document.getElementById("pin-error");

  const hasHash = !!localStorage.getItem(STORAGE_PIN_HASH);
  const verified = sessionStorage.getItem(STORAGE_PIN_VERIFIED) === "1";

  if (hasHash && verified) {
    hidePinOverlay();
    initAppOnce();
    return;
  }

  showPinOverlay(hasHash ? "login" : "create");

  async function handleAccept() {
    const mode = overlay.dataset.mode || (hasHash ? "login" : "create");
    const v1 = pin1.value.trim();
    const v2 = pin2.value.trim();
    errorEl.textContent = "";

    if (!v1 || v1.length < 4 || v1.length > 8) {
      errorEl.textContent = "El PIN debe tener entre 4 y 8 dígitos.";
      return;
    }

    if (mode === "create") {
      if (v1 !== v2) {
        errorEl.textContent = "Los PIN no coinciden.";
        return;
      }
      const hash = await sha256(v1);
      localStorage.setItem(STORAGE_PIN_HASH, hash);
      sessionStorage.setItem(STORAGE_PIN_VERIFIED, "1");
      hidePinOverlay();
      initAppOnce();
    } else {
      const hashStored = localStorage.getItem(STORAGE_PIN_HASH) || "";
      const hash = await sha256(v1);
      if (hash !== hashStored) {
        errorEl.textContent = "PIN incorrecto.";
        return;
      }
      sessionStorage.setItem(STORAGE_PIN_VERIFIED, "1");
      hidePinOverlay();
      initAppOnce();
    }
  }

  btnOk.addEventListener("click", handleAccept);
  pin1.addEventListener("keydown", (e) => {
    if (e.key === "Enter") handleAccept();
  });
  pin2.addEventListener("keydown", (e) => {
    if (e.key === "Enter") handleAccept();
  });

  btnReset.addEventListener("click", () => {
    if (!localStorage.getItem(STORAGE_PIN_HASH)) {
      showPinOverlay("create");
      return;
    }
    if (confirm("¿Borrar PIN y crear uno nuevo?")) {
      localStorage.removeItem(STORAGE_PIN_HASH);
      sessionStorage.removeItem(STORAGE_PIN_VERIFIED);
      showPinOverlay("create");
    }
  });
}

// ===================== INIT APP =====================
let appInitialized = false;
function initAppOnce() {
  if (appInitialized) return;
  appInitialized = true;

  loadFromStorage();
  renderTopbarDate();
  setupNavigation();
  setupModal();
  setupExportButtons();
  setupConfig();
  setupFacturasModule();
  setupLogout();
  renderKpis();
  renderTablas();
}

// Arranque
document.addEventListener("DOMContentLoaded", () => {
  setupPinOverlay();
});
