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
}

function renderTablas() {
  const tbodyIngDash = document.getElementById("tbody-ingresos");
  const tbodyGasDash = document.getElementById("tbody-gastos");
  const tbodyIngFull = document.getElementById("tbody-ingresos-full");
  const tbodyGasFull = document.getElementById("tbody-gastos-full");

  [tbodyIngDash, tbodyGasDash, tbodyIngFull, tbodyGasFull].forEach((tb) => {
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

  recientesIng.forEach((m) => tbodyIngDash && tbodyIngDash.appendChild(buildRow(m)));
  recientesGas.forEach((m) => tbodyGasDash && tbodyGasDash.appendChild(buildRow(m)));

  ingresos.forEach((m) => tbodyIngFull && tbodyIngFull.appendChild(buildRow(m)));
  gastos.forEach((m) => tbodyGasFull && tbodyGasFull.appendChild(buildRow(m)));
}

// ====== MODAL MOVIMIENTO ======
const modalMov = {
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
  }
};

function setupModalMovimiento() {
  modalMov.backdrop = document.getElementById("modal-movimiento");
  modalMov.tipoInput = document.getElementById("mov-tipo");
  modalMov.fechaInput = document.getElementById("mov-fecha");
  modalMov.descInput = document.getElementById("mov-descripcion");
  modalMov.catInput = document.getElementById("mov-categoria");
  modalMov.metodoInput = document.getElementById("mov-metodo");
  modalMov.montoInput = document.getElementById("mov-monto");
  modalMov.titleEl = document.getElementById("modal-title");

  document.getElementById("btn-add-movimiento")?.addEventListener("click", () => {
    modalMov.open("ingreso");
  });

  document.querySelectorAll("[data-add]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const tipo = btn.getAttribute("data-add") === "gasto" ? "gasto" : "ingreso";
      modalMov.open(tipo);
    });
  });

  document.getElementById("modal-close")?.addEventListener("click", () => modalMov.close());
  document.getElementById("modal-cancel")?.addEventListener("click", () => modalMov.close());

  const form = document.getElementById("form-movimiento");
  form?.addEventListener("submit", (e) => {
    e.preventDefault();
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

    const mov = {
      id: "mov-" + Date.now().toString(36),
      tipo,
      fecha,
      descripcion,
      categoria,
      metodo,
      monto,
      createdAt: Date.now()
    };

    movimientos.push(mov);
    saveMovimientos();
    renderKpis();
    renderTablas();

    form.reset();
    modalMov.fechaInput.value = todayISO();
    modalMov.close();
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

// ====== FACTURAS — HELPER ITEMS ======
function addItemRow(item = {}) {
  const tbody = document.getElementById("fac-items-body");
  if (!tbody) return;

  const tr = document.createElement("tr");
  tr.innerHTML = `
    <td>
      <input type="number" class="item-qty" min="0" step="1" value="${item.qty ?? 1}">
    </td>
    <td>
      <input type="text" class="item-desc" placeholder="Descripción del servicio" value="${item.desc ?? ""}">
    </td>
    <td>
      <input type="number" class="item-price" min="0" step="0.01" value="${item.price ?? 0}">
    </td>
    <td class="right item-total-cell">
      ${formatMoney(((item.qty ?? 1) * (item.price ?? 0)) || 0)}
    </td>
    <td>
      <button type="button" class="btn-small-outline btn-item-remove">X</button>
    </td>
  `;

  function updateRowTotal() {
    const qty = Number(tr.querySelector(".item-qty").value) || 0;
    const price = Number(tr.querySelector(".item-price").value) || 0;
    const total = qty * price;
    tr.querySelector(".item-total-cell").textContent = formatMoney(total);
  }

  tr.querySelector(".item-qty").addEventListener("input", updateRowTotal);
  tr.querySelector(".item-price").addEventListener("input", updateRowTotal);

  tr.querySelector(".btn-item-remove").addEventListener("click", () => {
    tbody.removeChild(tr);
  });

  tbody.appendChild(tr);
}

function clearItemsTable() {
  const tbody = document.getElementById("fac-items-body");
  if (!tbody) return;
  tbody.innerHTML = "";
}

function collectItemsFromForm() {
  const tbody = document.getElementById("fac-items-body");
  if (!tbody) return [];
  const rows = tbody.querySelectorAll("tr");
  const items = [];
  rows.forEach((tr) => {
    const qty = Number(tr.querySelector(".item-qty").value) || 0;
    const desc = tr.querySelector(".item-desc").value.trim();
    const price = Number(tr.querySelector(".item-price").value) || 0;
    if (!qty || !price || !desc) return;
    items.push({ qty, desc, price });
  });
  return items;
}

// ====== FACTURAS — LÓGICA ======
function clearFacturaForm() {
  document.getElementById("fac-id").value = "";
  document.getElementById("fac-numero").value = "";
  document.getElementById("fac-fecha").value = todayISO();
  document.getElementById("fac-metodo").value = "Efectivo";
  document.getElementById("fac-cliente").value = "";
  document.getElementById("fac-cliente-dir").value = "";
  document.getElementById("fac-tax").value = "0";
  document.getElementById("fac-notas").value = "";
  clearItemsTable();
  addItemRow({ qty: 1, desc: "", price: 0 });
}

function fillFacturaForm(f) {
  document.getElementById("fac-id").value = f.id;
  document.getElementById("fac-numero").value = f.numero || "";
  document.getElementById("fac-fecha").value = f.fecha || todayISO();
  document.getElementById("fac-metodo").value = f.metodo || "Efectivo";
  document.getElementById("fac-cliente").value = f.cliente || "";
  document.getElementById("fac-cliente-dir").value = f.clienteDireccion || "";
  document.getElementById("fac-tax").value = f.taxPercent || 0;
  document.getElementById("fac-notas").value = f.notas || "";

  clearItemsTable();
  if (f.items && f.items.length) {
    f.items.forEach((it) => addItemRow(it));
  } else {
    addItemRow({ qty: 1, desc: "", price: 0 });
  }
}

function showFacturaForm() {
  const panel = document.getElementById("factura-form-panel");
  if (!panel) return;
  panel.style.display = "block";
}

function hideFacturaForm() {
  const panel = document.getElementById("factura-form-panel");
  if (!panel) return;
  panel.style.display = "none";
}

// Recalcula totales
function recalcularFactura(fac) {
  let subtotal = 0;
  (fac.items || []).forEach((it) => {
    subtotal += (Number(it.qty) || 0) * (Number(it.price) || 0);
  });
  const taxPercent = Number(fac.taxPercent) || 0;
  const taxAmount = subtotal * (taxPercent / 100);
  fac.subtotal = subtotal;
  fac.taxAmount = taxAmount;
  fac.total = subtotal + taxAmount;
}

// Sincroniza factura -> movimiento ingreso
function syncFacturaToMovimientos(fac) {
  const desc = `Factura ${fac.numero} – ${fac.cliente || ""}`.trim();
  let mov = null;
  if (fac.movimientoId) {
    mov = movimientos.find((m) => m.id === fac.movimientoId);
  }
  if (!mov) {
    mov = {
      id: "mov-fac-" + Date.now().toString(36),
      tipo: "ingreso",
      createdAt: fac.createdAt || Date.now()
    };
    movimientos.push(mov);
    fac.movimientoId = mov.id;
  }

  mov.fecha = fac.fecha;
  mov.descripcion = desc;
  mov.categoria = "Factura";
  mov.metodo = fac.metodo || "Efectivo";
  mov.monto = fac.total;

  saveMovimientos();
}

// Render listado facturas
function renderFacturasTable() {
  const tbody = document.getElementById("tbody-facturas");
  if (!tbody) return;
  tbody.innerHTML = "";

  const sorted = facturas.slice().sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
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
        <button class="btn-small-outline" data-del-factura="${f.id}">X</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// ====== jsPDF ======
async function ensureJsPDF() {
  if (jsPDFReady) return;
  await new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js";
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
  jsPDFReady = true;
}

async function generateFacturaPdf(fac) {
  await ensureJsPDF();
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "mm", format: "a4" });

  const bName = config.businessName || "Mi Negocio";
  const bAddress = config.address || "";
  const bPhone = config.phone || "";
  const bEmail = config.email || "";
  const logo = config.logoBase64;

  // HEADER
  try {
    if (logo && logo.startsWith("data:")) {
      // pequeño y cuadrado para que no se vea estirado
      doc.addImage(logo, "PNG", 14, 10, 24, 24);
    }
  } catch (e) {
    // ignorar si falla
  }

  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(bName, 42, 16);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  let y = 22;
  if (bAddress) {
    doc.text(bAddress, 42, y);
    y += 5;
  }
  if (bPhone) {
    doc.text(`Tel: ${bPhone}`, 42, y);
    y += 5;
  }
  if (bEmail) {
    doc.text(bEmail, 42, y);
    y += 5;
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("FACTURA", 150, 14);

  doc.setFontSize(10);
  let rx = 150;
  let ry = 20;
  doc.setFont("helvetica", "bold");
  doc.text("Factura #", rx, ry);
  doc.setFont("helvetica", "normal");
  doc.text(String(fac.numero || ""), rx, ry + 5);
  ry += 10;

  doc.setFont("helvetica", "bold");
  doc.text("Fecha", rx, ry);
  doc.setFont("helvetica", "normal");
  doc.text(String(fac.fecha || ""), rx, ry + 5);

  // cliente
  y = 42;
  doc.setFont("helvetica", "bold");
  doc.text("Facturar a:", 14, y);
  y += 6;
  doc.setFont("helvetica", "normal");
  if (fac.cliente) {
    doc.text(String(fac.cliente), 14, y);
    y += 5;
  }
  if (fac.clienteDireccion) {
    const textLines = doc.splitTextToSize(String(fac.clienteDireccion), 80);
    doc.text(textLines, 14, y);
    y += textLines.length * 5;
  }

  // TABLA ÍTEMS
  y += 4;
  doc.line(14, y, 196, y);
  y += 6;

  const headers = ["Cant.", "Descripción", "Precio", "Importe"];
  const colX = [14, 30, 130, 165];
  doc.setFont("helvetica", "bold");
  headers.forEach((h, i) => {
    doc.text(h, colX[i], y);
  });
  y += 5;
  doc.line(14, y, 196, y);
  y += 4;
  doc.setFont("helvetica", "normal");

  (fac.items || []).forEach((it) => {
    const qty = Number(it.qty) || 0;
    const price = Number(it.price) || 0;
    const total = qty * price;
    const desc = String(it.desc || "");

    if (y > 250) {
      doc.addPage();
      y = 20;
    }

    doc.text(String(qty), colX[0], y);
    const descLines = doc.splitTextToSize(desc, colX[2] - colX[1] - 2);
    doc.text(descLines, colX[1], y);
    doc.text(formatMoney(price), colX[2], y, { align: "right" });
    doc.text(formatMoney(total), colX[3], y, { align: "right" });

    y += descLines.length * 5 + 2;
  });

  if (y > 240) {
    doc.addPage();
    y = 20;
  }

  // TOTALES
  y += 4;
  doc.line(110, y, 196, y);
  y += 6;

  doc.setFont("helvetica", "bold");
  doc.text("Subtotal", 140, y);
  doc.text(formatMoney(fac.subtotal || 0), 196, y, { align: "right" });
  y += 6;

  doc.text(`Impuesto (${fac.taxPercent || 0}%)`, 140, y);
  doc.text(formatMoney(fac.taxAmount || 0), 196, y, { align: "right" });
  y += 6;

  doc.setFont("helvetica", "bold");
  doc.text("TOTAL", 140, y);
  doc.text(formatMoney(fac.total || 0), 196, y, { align: "right" });
  y += 10;

  // Notas
  if (fac.notas) {
    if (y > 260) {
      doc.addPage();
      y = 20;
    }
    doc.setFont("helvetica", "bold");
    doc.text("Notas:", 14, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    const notesLines = doc.splitTextToSize(String(fac.notas), 180);
    doc.text(notesLines, 14, y);
  }

  const fileName = `Factura_${(fac.numero || "sin-numero").replace(/\s+/g, "_")}.pdf`;
  doc.save(fileName);
}

// ====== FACTURAS — MÓDULO PRINCIPAL ======
function setupFacturasModule() {
  const form = document.getElementById("form-factura");
  const btnNueva = document.getElementById("btn-factura-nueva");
  const btnNueva2 = document.getElementById("btn-factura-nueva-secundario");
  const btnCerrar = document.getElementById("btn-factura-cerrar");
  const btnGuardarPdf = document.getElementById("btn-factura-guardar-pdf");
  const btnAddItem = document.getElementById("btn-add-item");
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
  btnAddItem?.addEventListener("click", () => addItemRow({ qty: 1, desc: "", price: 0 }));

  form?.addEventListener("submit", (e) => {
    e.preventDefault();

    const id = document.getElementById("fac-id").value || null;
    const numero = document.getElementById("fac-numero").value.trim();
    const fecha = document.getElementById("fac-fecha").value || todayISO();
    const cliente = document.getElementById("fac-cliente").value.trim();
    const clienteDir = document.getElementById("fac-cliente-dir").value.trim();
    const metodo = document.getElementById("fac-metodo").value;
    const taxPercent = Number(document.getElementById("fac-tax").value) || 0;
    const notas = document.getElementById("fac-notas").value.trim();

    if (!numero || !cliente) {
      alert("Número de factura y cliente son obligatorios.");
      return;
    }

    const items = collectItemsFromForm();
    if (items.length === 0) {
      alert("Debes añadir al menos un ítem con cantidad, descripción y precio.");
      return;
    }

    let fac = null;
    if (id) {
      fac = facturas.find((f) => f.id === id);
    }
    if (!fac) {
      fac = {
        id: "fac-" + Date.now().toString(36),
        createdAt: Date.now()
      };
      facturas.push(fac);
    }

    fac.numero = numero;
    fac.fecha = fecha;
    fac.cliente = cliente;
    fac.clienteDireccion = clienteDir;
    fac.metodo = metodo;
    fac.items = items;
    fac.taxPercent = taxPercent;
    fac.notas = notas;

    recalcularFactura(fac);
    syncFacturaToMovimientos(fac);
    saveFacturas();
    saveMovimientos();

    renderFacturasTable();
    renderKpis();
    renderTablas();
    fillFacturaForm(fac);
    showFacturaForm();

    alert("Factura guardada.");
  });

  btnGuardarPdf?.addEventListener("click", () => {
    form.requestSubmit();
    const id = document.getElementById("fac-id").value;
    if (!id) {
      alert("Primero guarda la factura.");
      return;
    }
    const fac = facturas.find((f) => f.id === id);
    if (!fac) {
      alert("No se encontró la factura para PDF.");
      return;
    }
    generateFacturaPdf(fac);
  });

  tbody?.addEventListener("click", (e) => {
    const target = e.target;
    if (!(target instanceof HTMLElement)) return;
    const editId = target.getAttribute("data-edit-factura");
    const pdfId = target.getAttribute("data-pdf-factura");
    const delId = target.getAttribute("data-del-factura");

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
    } else if (delId) {
      const idx = facturas.findIndex((ff) => ff.id === delId);
      if (idx === -1) return;
      const fac = facturas[idx];
      if (fac.movimientoId) {
        movimientos = movimientos.filter((m) => m.id !== fac.movimientoId);
        saveMovimientos();
      }
      facturas.splice(idx, 1);
      saveFacturas();
      renderFacturasTable();
      renderKpis();
      renderTablas();
    }
  });
}

// ====== CONFIGURACIÓN ======
function applyConfigToUI() {
  document.getElementById("config-nombre-negocio").value = config.businessName || "";
  document.getElementById("config-direccion").value = config.address || "";
  document.getElementById("config-telefono").value = config.phone || "";
  document.getElementById("config-email").value = config.email || "";
  document.getElementById("config-moneda").value = config.currency || "$";

  const logoEl = document.getElementById("config-logo-preview");
  const sidebarLogo = document.getElementById("sidebar-logo");
  const sidebarName = document.getElementById("sidebar-business-name");
  if (logoEl) logoEl.src = config.logoBase64 || "assets/logo.png";
  if (sidebarLogo) sidebarLogo.src = config.logoBase64 || "assets/logo.png";
  if (sidebarName) sidebarName.textContent = config.businessName || "Nexus Finance";
}

function setupConfigModule() {
  applyConfigToUI();

  document.getElementById("btn-guardar-config")?.addEventListener("click", () => {
    config.businessName = document.getElementById("config-nombre-negocio").value.trim() || "Mi Negocio";
    config.address = document.getElementById("config-direccion").value.trim();
    config.phone = document.getElementById("config-telefono").value.trim();
    config.email = document.getElementById("config-email").value.trim();
    config.currency = document.getElementById("config-moneda").value.trim() || "$";
    saveConfig();
    applyConfigToUI();
    renderKpis();
    alert("Configuración guardada.");
  });

  document.getElementById("config-logo")?.addEventListener("change", async (ev) => {
    const file = ev.target.files[0];
    if (!file) return;
    const base64 = await new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(fr.result);
      fr.onerror = reject;
      fr.readAsDataURL(file);
    });
    config.logoBase64 = String(base64);
    saveConfig();
    applyConfigToUI();
  });
}

// ====== LOGIN PIN ======
function showLoginOverlay(createMode) {
  const overlay = document.getElementById("login-overlay");
  const msg = document.getElementById("login-message");
  const pin2Wrap = document.getElementById("login-pin2-wrap");
  const pin = document.getElementById("login-pin");
  const pin2 = document.getElementById("login-pin2");

  if (!overlay) return;

  if (createMode) {
    msg.textContent = "Crea tu PIN de acceso (4–8 dígitos)";
    pin2Wrap.style.display = "flex";
  } else {
    msg.textContent = "Introduce tu PIN para entrar";
    pin2Wrap.style.display = "none";
  }

  overlay.style.display = "flex";
  pin.value = "";
  pin2.value = "";
  setTimeout(() => pin.focus(), 50);
}

function hideLoginOverlay() {
  const overlay = document.getElementById("login-overlay");
  if (!overlay) return;
  overlay.style.display = "none";
}

function setupLogin() {
  const btnLogin = document.getElementById("btn-login");
  const btnLogout = document.getElementById("btn-logout");

  btnLogin?.addEventListener("click", () => {
    const pinInput = document.getElementById("login-pin");
    const pin2Input = document.getElementById("login-pin2");
    const pin = (pinInput.value || "").trim();

    if (!pinValue) {
      // crear PIN
      const pin2 = (pin2Input.value || "").trim();
      if (pin.length < 4 || pin.length > 8) {
        alert("El PIN debe tener entre 4 y 8 dígitos.");
        return;
      }
      if (pin !== pin2) {
        alert("Los PIN no coinciden.");
        return;
      }
      setPin(pin);
      setLogged(true);
      hideLoginOverlay();
    } else {
      // validar PIN
      if (pin !== pinValue) {
        alert("PIN incorrecto.");
        return;
      }
      setLogged(true);
      hideLoginOverlay();
    }
  });

  btnLogout?.addEventListener("click", () => {
    setLogged(false);
    showLoginOverlay(!pinValue);
  });
}

// ====== INIT ======
document.addEventListener("DOMContentLoaded", () => {
  loadState();
  renderTopbarDate();
  setupNavigation();
  setupModalMovimiento();
  setupConfigModule();
  setupFacturasModule();
  setupLogin();

  renderKpis();
  renderTablas();

  // Mostrar / ocultar login
  if (isLogged && pinValue) {
    hideLoginOverlay();
  } else {
    showLoginOverlay(!pinValue);
  }
});
