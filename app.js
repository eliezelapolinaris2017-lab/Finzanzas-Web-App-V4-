// app.js — Nexus Finance v6
// Movimientos + Facturas profesionales + Config + Firebase Cloud Sync

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  onAuthStateChanged,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";

// ================== FIREBASE CONFIG ==================
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
const db = getFirestore(fbApp);
const provider = new GoogleAuthProvider();

let currentUser = null;

// ================== LOCAL STORAGE ==================
const STORAGE_KEY_MOVIMIENTOS = "nexus-finance-movimientos";
const STORAGE_KEY_CONFIG = "nexus-finance-config";
const STORAGE_KEY_FACTURAS = "nexus-finance-facturas";

let movimientos = [];
let facturas = [];
let config = {
  nombreNegocio: "",
  moneda: "$",
  companyId: "",
  companyAddress: "",
  companyPhone: "",
  companyEmail: "",
  invoiceLogoDataUrl: "", // base64 para logo facturas
};

// ====== UTILIDADES LOCAL ======
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

  try {
    const rawInv = localStorage.getItem(STORAGE_KEY_FACTURAS);
    facturas = rawInv ? JSON.parse(rawInv) : [];
  } catch (e) {
    console.error("Error leyendo facturas:", e);
    facturas = [];
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

// ================== RENDER TOPBAR ==================
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

// ================== RENDER KPIs ==================
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

  const kIngHoy = document.getElementById("kpi-ingresos-hoy");
  const kGasHoy = document.getElementById("kpi-gastos-hoy");
  const kBalHoy = document.getElementById("kpi-balance-hoy");
  const kIngMes = document.getElementById("kpi-ingresos-mes");
  const kGasMes = document.getElementById("kpi-gastos-mes");
  const kBalMes = document.getElementById("kpi-balance-mes");
  const kMovMes = document.getElementById("kpi-movimientos-mes");
  const kUlt = document.getElementById("kpi-ultimo-movimiento");

  if (kIngHoy) kIngHoy.textContent = formatMoney(ingresosHoy);
  if (kGasHoy) kGasHoy.textContent = formatMoney(gastosHoy);
  if (kBalHoy) kBalHoy.textContent = formatMoney(balanceHoy);
  if (kIngMes) kIngMes.textContent = `Mes actual: ${formatMoney(ingresosMes)}`;
  if (kGasMes) kGasMes.textContent = `Mes actual: ${formatMoney(gastosMes)}`;
  if (kBalMes) kBalMes.textContent = `Balance mes: ${formatMoney(balanceMes)}`;
  if (kMovMes) {
    kMovMes.textContent = movimientos.filter((m) => sameMonth(m.fecha, hoy)).length;
  }

  const ultimo = [...movimientos].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))[0];
  if (kUlt) {
    if (ultimo) {
      const tipoTxt = ultimo.tipo === "ingreso" ? "Ingreso" : "Gasto";
      kUlt.textContent = `${tipoTxt} de ${formatMoney(ultimo.monto)} el ${ultimo.fecha}`;
    } else {
      kUlt.textContent = "Sin movimientos recientes";
    }
  }
}

// ================== RENDER TABLAS MOVIMIENTOS ==================
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

// ================== MODAL MOVIMIENTO ==================
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

// ================== NAV ==================
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

// ================== EXPORT CSV ==================
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

// ================== CONFIG LOCAL + LOGO ==================
function renderLogoPreview() {
  const preview = document.getElementById("invoice-logo-preview");
  if (!preview) return;
  preview.innerHTML = "";

  if (config.invoiceLogoDataUrl) {
    const img = document.createElement("img");
    img.src = config.invoiceLogoDataUrl;
    img.alt = "Logo facturas";
    img.className = "invoice-logo-img";
    preview.appendChild(img);
  } else {
    const span = document.createElement("span");
    span.className = "muted";
    span.textContent = "No hay logo configurado.";
    preview.appendChild(span);
  }
}

function setupConfig() {
  const nombreInput = document.getElementById("config-nombre-negocio");
  const monedaInput = document.getElementById("config-moneda");
  const companyIdInput = document.getElementById("config-company-id");
  const companyAddressInput = document.getElementById("config-company-address");
  const companyPhoneInput = document.getElementById("config-company-phone");
  const companyEmailInput = document.getElementById("config-company-email");
  const logoInput = document.getElementById("invoice-logo-input");

  if (nombreInput) nombreInput.value = config.nombreNegocio || "";
  if (monedaInput) monedaInput.value = config.moneda || "$";
  if (companyIdInput) companyIdInput.value = config.companyId || "";
  if (companyAddressInput) companyAddressInput.value = config.companyAddress || "";
  if (companyPhoneInput) companyPhoneInput.value = config.companyPhone || "";
  if (companyEmailInput) companyEmailInput.value = config.companyEmail || "";

  renderLogoPreview();

  document.getElementById("btn-guardar-config")?.addEventListener("click", () => {
    if (nombreInput) config.nombreNegocio = nombreInput.value.trim();
    if (monedaInput) config.moneda = monedaInput.value.trim() || "$";
    if (companyIdInput) config.companyId = companyIdInput.value.trim();
    if (companyAddressInput) config.companyAddress = companyAddressInput.value.trim();
    if (companyPhoneInput) config.companyPhone = companyPhoneInput.value.trim();
    if (companyEmailInput) config.companyEmail = companyEmailInput.value.trim();

    saveConfig();
    renderKpis();
    alert("Configuración guardada.");
  });

  logoInput?.addEventListener("change", (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = ev.target?.result;
      if (typeof result === "string") {
        config.invoiceLogoDataUrl = result;
        saveConfig();
        renderLogoPreview();
      }
    };
    reader.readAsDataURL(file);
  });
}

// ================== FACTURAS ==================
let editingInvoiceId = null;

function newInvoiceItemRow(item = {}) {
  const tr = document.createElement("tr");
  tr.innerHTML = `
    <td>
      <input type="text" class="inv-item-desc" placeholder="Descripción" value="${item.descripcion || ""}">
    </td>
    <td class="right">
      <input type="number" class="inv-item-qty" min="0" step="0.01" value="${item.cantidad ?? 1}">
    </td>
    <td class="right">
      <input type="number" class="inv-item-price" min="0" step="0.01" value="${item.precio ?? 0}">
    </td>
    <td class="right">
      <span class="inv-item-total">${formatMoney(item.total || 0)}</span>
    </td>
    <td class="right">
      <button type="button" class="btn-mini-outline inv-item-remove">✕</button>
    </td>
  `;
  return tr;
}

function recalcInvoiceItemsTotals() {
  const tbody = document.getElementById("invoice-items-body");
  if (!tbody) return;
  const rows = Array.from(tbody.querySelectorAll("tr"));

  let subtotal = 0;
  rows.forEach((row) => {
    const qtyInput = row.querySelector(".inv-item-qty");
    const priceInput = row.querySelector(".inv-item-price");
    const totalSpan = row.querySelector(".inv-item-total");

    const qty = Number(qtyInput?.value) || 0;
    const price = Number(priceInput?.value) || 0;
    const lineTotal = qty * price;
    subtotal += lineTotal;
    if (totalSpan) totalSpan.textContent = formatMoney(lineTotal);
  });

  const taxRateInput = document.getElementById("invoice-tax-rate");
  const subtotalEl = document.getElementById("invoice-subtotal-display");
  const totalEl = document.getElementById("invoice-total-display");

  const taxRate = Number(taxRateInput?.value) || 0;
  const impuestos = subtotal * (taxRate / 100);
  const total = subtotal + impuestos;

  if (subtotalEl) subtotalEl.textContent = formatMoney(subtotal);
  if (totalEl) totalEl.textContent = formatMoney(total);
}

function clearInvoiceModal() {
  editingInvoiceId = null;

  const numberInput = document.getElementById("invoice-number");
  const dateInput = document.getElementById("invoice-date");
  const dueInput = document.getElementById("invoice-due");
  const clientNameInput = document.getElementById("invoice-client-name");
  const clientEmailInput = document.getElementById("invoice-client-email");
  const clientPhoneInput = document.getElementById("invoice-client-phone");
  const notesInput = document.getElementById("invoice-notes");
  const taxRateInput = document.getElementById("invoice-tax-rate");
  const tbody = document.getElementById("invoice-items-body");

  if (numberInput) numberInput.value = "";
  if (dateInput) dateInput.value = todayISO();
  if (dueInput) dueInput.value = "";
  if (clientNameInput) clientNameInput.value = "";
  if (clientEmailInput) clientEmailInput.value = "";
  if (clientPhoneInput) clientPhoneInput.value = "";
  if (notesInput) notesInput.value = "";
  if (taxRateInput) taxRateInput.value = "0";
  if (tbody) tbody.innerHTML = "";

  // Añadimos 2 filas por defecto
  if (tbody) {
    tbody.appendChild(newInvoiceItemRow());
    tbody.appendChild(newInvoiceItemRow());
  }

  recalcInvoiceItemsTotals();
}

function fillInvoiceModal(factura) {
  editingInvoiceId = factura.id;

  const numberInput = document.getElementById("invoice-number");
  const dateInput = document.getElementById("invoice-date");
  const dueInput = document.getElementById("invoice-due");
  const clientNameInput = document.getElementById("invoice-client-name");
  const clientEmailInput = document.getElementById("invoice-client-email");
  const clientPhoneInput = document.getElementById("invoice-client-phone");
  const notesInput = document.getElementById("invoice-notes");
  const taxRateInput = document.getElementById("invoice-tax-rate");
  const tbody = document.getElementById("invoice-items-body");

  if (numberInput) numberInput.value = factura.numero || "";
  if (dateInput) dateInput.value = factura.fecha || todayISO();
  if (dueInput) dueInput.value = factura.vencimiento || "";
  if (clientNameInput) clientNameInput.value = factura.clienteNombre || "";
  if (clientEmailInput) clientEmailInput.value = factura.clienteEmail || "";
  if (clientPhoneInput) clientPhoneInput.value = factura.clienteTelefono || "";
  if (notesInput) notesInput.value = factura.notas || "";
  if (taxRateInput) taxRateInput.value = factura.taxRate ?? 0;

  if (tbody) {
    tbody.innerHTML = "";
    (factura.items || []).forEach((it) => {
      tbody.appendChild(
        newInvoiceItemRow({
          descripcion: it.descripcion,
          cantidad: it.cantidad,
          precio: it.precio,
          total: it.total,
        })
      );
    });
    if ((factura.items || []).length === 0) {
      tbody.appendChild(newInvoiceItemRow());
    }
  }

  recalcInvoiceItemsTotals();
}

function openInvoiceModal(factura = null) {
  const backdrop = document.getElementById("modal-invoice");
  const title = document.getElementById("invoice-modal-title");
  if (!backdrop || !title) return;

  if (factura) {
    title.textContent = "Editar factura";
    fillInvoiceModal(factura);
  } else {
    title.textContent = "Nueva factura";
    clearInvoiceModal();
  }

  backdrop.classList.add("show");
}

function closeInvoiceModal() {
  const backdrop = document.getElementById("modal-invoice");
  if (!backdrop) return;
  backdrop.classList.remove("show");
}

function collectInvoiceFromForm() {
  const numberInput = document.getElementById("invoice-number");
  const dateInput = document.getElementById("invoice-date");
  const dueInput = document.getElementById("invoice-due");
  const clientNameInput = document.getElementById("invoice-client-name");
  const clientEmailInput = document.getElementById("invoice-client-email");
  const clientPhoneInput = document.getElementById("invoice-client-phone");
  const notesInput = document.getElementById("invoice-notes");
  const taxRateInput = document.getElementById("invoice-tax-rate");
  const tbody = document.getElementById("invoice-items-body");

  const numero = numberInput?.value.trim() || "";
  const fecha = dateInput?.value || todayISO();
  const vencimiento = dueInput?.value || "";
  const clienteNombre = clientNameInput?.value.trim() || "";
  const clienteEmail = clientEmailInput?.value.trim() || "";
  const clienteTelefono = clientPhoneInput?.value.trim() || "";
  const notas = notesInput?.value.trim() || "";
  const taxRate = Number(taxRateInput?.value) || 0;

  if (!numero || !clienteNombre) {
    alert("Número de factura y nombre del cliente son obligatorios.");
    return null;
  }

  const rows = Array.from(tbody?.querySelectorAll("tr") || []);
  const items = [];
  let subtotal = 0;

  rows.forEach((row) => {
    const descInput = row.querySelector(".inv-item-desc");
    const qtyInput = row.querySelector(".inv-item-qty");
    const priceInput = row.querySelector(".inv-item-price");

    const descripcion = descInput?.value.trim() || "";
    const cantidad = Number(qtyInput?.value) || 0;
    const precio = Number(priceInput?.value) || 0;
    const total = cantidad * precio;

    if (!descripcion && total === 0) {
      return; // línea vacía
    }

    items.push({
      descripcion,
      cantidad,
      precio,
      total,
    });

    subtotal += total;
  });

  const impuestos = subtotal * (taxRate / 100);
  const total = subtotal + impuestos;

  return {
    id: editingInvoiceId || Date.now().toString(),
    numero,
    fecha,
    vencimiento,
    clienteNombre,
    clienteEmail,
    clienteTelefono,
    notas,
    items,
    subtotal,
    impuestos,
    total,
    taxRate,
    estado: "Borrador",
    createdAt: editingInvoiceId
      ? facturas.find((f) => f.id === editingInvoiceId)?.createdAt || Date.now()
      : Date.now(),
    updatedAt: Date.now(),
  };
}

function renderFacturas() {
  const tbody = document.getElementById("tbody-facturas");
  if (!tbody) return;
  tbody.innerHTML = "";

  const ordered = facturas.slice().sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  ordered.forEach((f) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${f.numero || ""}</td>
      <td>${f.fecha || ""}</td>
      <td>${f.clienteNombre || ""}</td>
      <td class="right">${formatMoney(f.total || 0)}</td>
      <td>${f.estado || "Borrador"}</td>
      <td class="right">
        <button type="button" class="btn-mini" data-inv-edit="${f.id}">Editar</button>
        <button type="button" class="btn-mini-outline" data-inv-delete="${f.id}">Borrar</button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  // Listeners para editar / borrar
  tbody.querySelectorAll("[data-inv-edit]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-inv-edit");
      const factura = facturas.find((f) => f.id === id);
      if (factura) {
        openInvoiceModal(factura);
      }
    });
  });

  tbody.querySelectorAll("[data-inv-delete]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-inv-delete");
      if (!id) return;
      if (!confirm("¿Eliminar esta factura definitivamente?")) return;
      facturas = facturas.filter((f) => f.id !== id);
      saveFacturas();
      renderFacturas();
    });
  });
}

function setupInvoiceModule() {
  const btnNew = document.getElementById("btn-new-invoice");
  const btnAddItem = document.getElementById("btn-add-invoice-item");
  const taxRateInput = document.getElementById("invoice-tax-rate");
  const backdrop = document.getElementById("modal-invoice");
  const btnClose = document.getElementById("invoice-modal-close");
  const btnCancel = document.getElementById("invoice-modal-cancel");
  const form = document.getElementById("invoice-form");
  const itemsBody = document.getElementById("invoice-items-body");

  btnNew?.addEventListener("click", () => openInvoiceModal(null));

  btnAddItem?.addEventListener("click", () => {
    if (!itemsBody) return;
    itemsBody.appendChild(newInvoiceItemRow());
    recalcInvoiceItemsTotals();
  });

  // Recalcular totales cuando cambien cantidad / precio / tax
  itemsBody?.addEventListener("input", (e) => {
    if (
      e.target.classList.contains("inv-item-qty") ||
      e.target.classList.contains("inv-item-price")
    ) {
      recalcInvoiceItemsTotals();
    }
  });

  itemsBody?.addEventListener("click", (e) => {
    const target = e.target;
    if (target.classList.contains("inv-item-remove")) {
      const row = target.closest("tr");
      if (row) {
        row.remove();
        recalcInvoiceItemsTotals();
      }
    }
  });

  taxRateInput?.addEventListener("input", () => {
    recalcInvoiceItemsTotals();
  });

  btnClose?.addEventListener("click", () => closeInvoiceModal());
  btnCancel?.addEventListener("click", () => closeInvoiceModal());

  form?.addEventListener("submit", (e) => {
    e.preventDefault();
    const factura = collectInvoiceFromForm();
    if (!factura) return;

    const index = facturas.findIndex((f) => f.id === factura.id);
    if (index >= 0) {
      facturas[index] = factura;
    } else {
      facturas.push(factura);
    }

    saveFacturas();
    renderFacturas();
    closeInvoiceModal();
  });
}

// ================== CLOUD / FIRESTORE ==================
function updateCloudUI() {
  const statusEl = document.getElementById("cloud-status");
  const btnLogin = document.getElementById("btn-login");
  const btnLogout = document.getElementById("btn-logout");

  if (!statusEl || !btnLogin || !btnLogout) return;

  if (currentUser) {
    statusEl.textContent =
      currentUser.displayName || currentUser.email || "Conectado";
    btnLogin.style.display = "none";
    btnLogout.style.display = "inline-flex";
  } else {
    statusEl.textContent = "Sin conexión";
    btnLogin.style.display = "inline-flex";
    btnLogout.style.display = "none";
  }
}

function getCloudDocRef() {
  if (!currentUser) throw new Error("No hay usuario autenticado.");
  return doc(db, "users", currentUser.uid, "state", "app");
}

async function cloudPushReplace() {
  if (!currentUser) {
    alert("Primero inicia sesión con Google.");
    return;
  }
  try {
    const ref = getCloudDocRef();
    await setDoc(
      ref,
      {
        uid: currentUser.uid,
        movimientos,
        facturas,
        config,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
    alert("Datos (movimientos, facturas, config) guardados en la nube.");
  } catch (err) {
    console.error("Error en cloudPushReplace:", err);
    alert("Error al guardar en la nube: " + (err.code || err.message));
  }
}

async function cloudPullReplace() {
  if (!currentUser) {
    alert("Primero inicia sesión con Google.");
    return;
  }
  try {
    const ref = getCloudDocRef();
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      alert("No hay datos en la nube todavía.");
      return;
    }
    const data = snap.data();
    movimientos = Array.isArray(data.movimientos) ? data.movimientos : [];
    facturas = Array.isArray(data.facturas) ? data.facturas : [];
    config = { ...config, ...(data.config || {}) };

    saveMovimientos();
    saveFacturas();
    saveConfig();

    setupConfig();
    renderKpis();
    renderTablas();
    renderFacturas();
    alert("Datos cargados desde la nube.");
  } catch (err) {
    console.error("Error en cloudPullReplace:", err);
    alert("Error al leer de la nube: " + (err.code || err.message));
  }
}

function setupCloudAuth() {
  const btnLogin = document.getElementById("btn-login");
  const btnLogout = document.getElementById("btn-logout");

  btnLogin?.addEventListener("click", async () => {
    try {
      await signInWithPopup(auth, provider);
      // onAuthStateChanged manejará el resto
    } catch (e) {
      console.error("Error en login:", e);
      alert("No se pudo iniciar sesión: " + (e.code || e.message));
    }
  });

  btnLogout?.addEventListener("click", async () => {
    try {
      await signOut(auth);
    } catch (e) {
      console.error("Error al cerrar sesión:", e);
    }
  });

  onAuthStateChanged(auth, (user) => {
    currentUser = user || null;
    updateCloudUI();
  });
}

function setupCloudButtons() {
  document.getElementById("btn-cloud-push")?.addEventListener("click", cloudPushReplace);
  document.getElementById("btn-cloud-pull")?.addEventListener("click", cloudPullReplace);
}

// ================== INIT ==================
document.addEventListener("DOMContentLoaded", () => {
  loadFromStorage();
  renderTopbarDate();
  setupNavigation();
  setupModal();
  setupExportButtons();
  setupConfig();
  setupInvoiceModule();
  setupCloudAuth();
  setupCloudButtons();
  renderKpis();
  renderTablas();
  renderFacturas();
});
