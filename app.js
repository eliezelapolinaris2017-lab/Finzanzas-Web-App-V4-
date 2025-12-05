// ======================================================
// Nexus Finance — Desktop Web App (LOCALSTORAGE)
// Dashboard + Ingresos + Gastos + Facturas + Cotizaciones
// ======================================================

// ====== STORAGE KEYS ======
const STORAGE_KEY_MOVIMIENTOS   = "nexus-finance-movimientos-v4";
const STORAGE_KEY_FACTURAS      = "nexus-finance-facturas-v4";
const STORAGE_KEY_COTIZACIONES  = "nexus-finance-cotizaciones-v1";
const STORAGE_KEY_CONFIG        = "nexus-finance-config-v4";

// ====== ESTADO EN MEMORIA ======
let movimientos   = []; // {id,tipo,fecha,descripcion,categoria,metodo,monto,createdAt}
let facturas      = []; // {id,numero,fecha,cliente,dir,email,tel,metodo,items,subtotal,impuesto,total,notas,createdAt,movimientoId}
let cotizaciones  = []; // igual que factura pero sin movimientoId
let config = {
  nombreNegocio: "",
  moneda: "$",
  logoBase64: "",
  negocioDireccion: "",
  negocioTelefono: "",
  negocioEmail: ""
};

// ====== UTILES GENERALES ======
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
    if (rawCfg) config = { ...config, ...JSON.parse(rawCfg) };
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

function byCreatedDesc(a, b) {
  return (b.createdAt || 0) - (a.createdAt || 0);
}

function $(sel) {
  return document.querySelector(sel);
}
function $all(sel) {
  return Array.from(document.querySelectorAll(sel));
}

// ====== FECHA TOPBAR ======
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

// ====== KPIs DASHBOARD ======
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

  const elIngHoy   = document.getElementById("kpi-ingresos-hoy");
  const elGasHoy   = document.getElementById("kpi-gastos-hoy");
  const elBalHoy   = document.getElementById("kpi-balance-hoy");
  const elIngMes   = document.getElementById("kpi-ingresos-mes");
  const elGasMes   = document.getElementById("kpi-gastos-mes");
  const elBalMes   = document.getElementById("kpi-balance-mes");
  const elMovMes   = document.getElementById("kpi-movimientos-mes");
  const elUltMov   = document.getElementById("kpi-ultimo-movimiento");

  if (elIngHoy) elIngHoy.textContent = formatMoney(ingresosHoy);
  if (elGasHoy) elGasHoy.textContent = formatMoney(gastosHoy);
  if (elBalHoy) elBalHoy.textContent = formatMoney(balanceHoy);

  if (elIngMes) elIngMes.textContent = `Mes actual: ${formatMoney(ingresosMes)}`;
  if (elGasMes) elGasMes.textContent = `Mes actual: ${formatMoney(gastosMes)}`;
  if (elBalMes) elBalMes.textContent = `Balance mes: ${formatMoney(balanceMes)}`;

  if (elMovMes) {
    elMovMes.textContent = movimientos.filter((m) => sameMonth(m.fecha, hoy)).length;
  }

  const ultimo = [...movimientos].sort(byCreatedDesc)[0];
  if (elUltMov) {
    if (ultimo) {
      const tipoTxt = ultimo.tipo === "ingreso" ? "Ingreso" : "Gasto";
      elUltMov.textContent = `${tipoTxt} de ${formatMoney(ultimo.monto)} el ${ultimo.fecha}`;
    } else {
      elUltMov.textContent = "Sin movimientos recientes";
    }
  }
}

// ====== TABLAS INGRESOS / GASTOS ======

let currentEditMovId = null; // null -> nuevo, string -> editar

function buildRowMovimiento(m) {
  const tr = document.createElement("tr");
  tr.innerHTML = `
    <td>${m.fecha || ""}</td>
    <td>${m.descripcion || ""}</td>
    <td>${m.categoria || ""}</td>
    <td>${m.metodo || ""}</td>
    <td class="right">${formatMoney(m.monto)}</td>
    <td class="actions-col">
      <button class="btn-small-ghost" data-edit-mov="${m.id}">Editar</button>
      <button class="btn-small-ghost danger" data-del-mov="${m.id}">Borrar</button>
    </td>
  `;
  return tr;
}

function renderTablasMovimientos() {
  const tbodyIng      = document.getElementById("tbody-ingresos");
  const tbodyGas      = document.getElementById("tbody-gastos");
  const tbodyIngFull  = document.getElementById("tbody-ingresos-full");
  const tbodyGasFull  = document.getElementById("tbody-gastos-full");

  [tbodyIng, tbodyGas, tbodyIngFull, tbodyGasFull].forEach((tb) => {
    if (tb) tb.innerHTML = "";
  });

  const ingresos = movimientos.filter((m) => m.tipo === "ingreso");
  const gastos   = movimientos.filter((m) => m.tipo === "gasto");

  const recientesIng = ingresos.slice().sort(byCreatedDesc).slice(0, 10);
  const recientesGas = gastos.slice().sort(byCreatedDesc).slice(0, 10);

  recientesIng.forEach((m) => tbodyIng && tbodyIng.appendChild(buildRowMovimiento(m)));
  recientesGas.forEach((m) => tbodyGas && tbodyGas.appendChild(buildRowMovimiento(m)));
  ingresos.forEach((m) => tbodyIngFull && tbodyIngFull.appendChild(buildRowMovimiento(m)));
  gastos.forEach((m) => tbodyGasFull && tbodyGasFull.appendChild(buildRowMovimiento(m)));

  // Wire editar / borrar
  $all("[data-edit-mov]").forEach((btn) => {
    btn.addEventListener("click", () => openEditMovimiento(btn.getAttribute("data-edit-mov")));
  });
  $all("[data-del-mov]").forEach((btn) => {
    btn.addEventListener("click", () => deleteMovimiento(btn.getAttribute("data-del-mov")));
  });
}

function openEditMovimiento(id) {
  const mov = movimientos.find((m) => m.id === id);
  if (!mov) return;

  currentEditMovId = mov.id;

  const modalBackdrop = document.getElementById("modal-movimiento");
  const tipoInput     = document.getElementById("mov-tipo");
  const fechaInput    = document.getElementById("mov-fecha");
  const descInput     = document.getElementById("mov-descripcion");
  const catInput      = document.getElementById("mov-categoria");
  const metodoInput   = document.getElementById("mov-metodo");
  const montoInput    = document.getElementById("mov-monto");
  const titleEl       = document.getElementById("modal-title");

  if (!modalBackdrop) return;

  if (tipoInput)  tipoInput.value  = mov.tipo;
  if (fechaInput) fechaInput.value = mov.fecha;
  if (descInput)  descInput.value  = mov.descripcion || "";
  if (catInput)   catInput.value   = mov.categoria || "";
  if (metodoInput)metodoInput.value= mov.metodo || "Efectivo";
  if (montoInput) montoInput.value = mov.monto;

  if (titleEl) titleEl.textContent = mov.tipo === "gasto" ? "Editar gasto" : "Editar ingreso";

  modalBackdrop.classList.add("show");
}

function deleteMovimiento(id) {
  if (!confirm("¿Eliminar este registro?")) return;
  movimientos = movimientos.filter((m) => m.id !== id);
  saveMovimientos();
  renderKpis();
  renderTablasMovimientos();
}

// ====== MODAL MOVIMIENTO (NUEVO / EDITAR) ======
const modalMov = {
  backdrop: null,
  tipoInput: null,
  fechaInput: null,
  descInput: null,
  catInput: null,
  metodoInput: null,
  montoInput: null,
  titleEl: null,
};

function setupModalMovimiento() {
  modalMov.backdrop   = document.getElementById("modal-movimiento");
  modalMov.tipoInput  = document.getElementById("mov-tipo");
  modalMov.fechaInput = document.getElementById("mov-fecha");
  modalMov.descInput  = document.getElementById("mov-descripcion");
  modalMov.catInput   = document.getElementById("mov-categoria");
  modalMov.metodoInput= document.getElementById("mov-metodo");
  modalMov.montoInput = document.getElementById("mov-monto");
  modalMov.titleEl    = document.getElementById("modal-title");

  function open(tipo) {
    if (!modalMov.backdrop) return;
    currentEditMovId = null; // nuevo
    if (modalMov.tipoInput) modalMov.tipoInput.value = tipo || "ingreso";
    if (modalMov.titleEl) modalMov.titleEl.textContent = tipo === "gasto" ? "Nuevo gasto" : "Nuevo ingreso";

    if (modalMov.fechaInput && !modalMov.fechaInput.value) modalMov.fechaInput.value = todayISO();
    if (modalMov.descInput)  modalMov.descInput.value  = "";
    if (modalMov.catInput)   modalMov.catInput.value   = "";
    if (modalMov.metodoInput)modalMov.metodoInput.value= "Efectivo";
    if (modalMov.montoInput) modalMov.montoInput.value = "";

    modalMov.backdrop.classList.add("show");
  }

  function close() {
    if (!modalMov.backdrop) return;
    modalMov.backdrop.classList.remove("show");
  }

  // Botón principal + botones de cada tarjeta (+Ingreso / +Gasto)
  document.getElementById("btn-add-movimiento")?.addEventListener("click", () => open("ingreso"));

  document.querySelectorAll("[data-add]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const tipo = btn.getAttribute("data-add") === "gasto" ? "gasto" : "ingreso";
      open(tipo);
    });
  });

  document.getElementById("modal-close")?.addEventListener("click", close);
  document.getElementById("modal-cancel")?.addEventListener("click", close);

  const form = document.getElementById("form-movimiento");
  form?.addEventListener("submit", (e) => {
    e.preventDefault();
    const tipo        = modalMov.tipoInput?.value || "ingreso";
    const fecha       = modalMov.fechaInput?.value || todayISO();
    const descripcion = modalMov.descInput?.value.trim() || "";
    const categoria   = modalMov.catInput?.value.trim() || "";
    const metodo      = modalMov.metodoInput?.value || "Efectivo";
    const monto       = Number(modalMov.montoInput?.value);

    if (!descripcion || !categoria || !metodo || !fecha || !monto) {
      alert("Completa todos los campos y coloca un monto válido.");
      return;
    }

    if (currentEditMovId) {
      // EDITAR
      const mov = movimientos.find((m) => m.id === currentEditMovId);
      if (mov) {
        mov.tipo        = tipo;
        mov.fecha       = fecha;
        mov.descripcion = descripcion;
        mov.categoria   = categoria;
        mov.metodo      = metodo;
        mov.monto       = monto;
      }
    } else {
      // NUEVO
      const movimiento = {
        id: Date.now().toString(36),
        tipo,
        fecha,
        descripcion,
        categoria,
        metodo,
        monto,
        createdAt: Date.now(),
      };
      movimientos.push(movimiento);
    }

    saveMovimientos();
    renderKpis();
    renderTablasMovimientos();
    close();
  });
}

// ====== NAVEGACIÓN SECCIONES (sidebar .nav-item data-section="...") ======
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

// ====== EXPORTAR CSV INGRESOS / GASTOS ======
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

// ====== CONFIG (nombre, moneda, datos empresa, logo) ======
function setupConfig() {
  const nombreInput   = document.getElementById("config-nombre-negocio");
  const monedaInput   = document.getElementById("config-moneda");
  const dirInput      = document.getElementById("config-direccion");
  const telInput      = document.getElementById("config-telefono");
  const emailInput    = document.getElementById("config-email");
  const logoInput     = document.getElementById("config-logo");
  const logoPreview   = document.getElementById("config-logo-preview");

  if (nombreInput) nombreInput.value = config.nombreNegocio || "";
  if (monedaInput) monedaInput.value = config.moneda || "$";
  if (dirInput)    dirInput.value    = config.negocioDireccion || "";
  if (telInput)    telInput.value    = config.negocioTelefono || "";
  if (emailInput)  emailInput.value  = config.negocioEmail || "";
  if (logoPreview && config.logoBase64) logoPreview.src = config.logoBase64;

  document.getElementById("btn-guardar-config")?.addEventListener("click", () => {
    if (nombreInput) config.nombreNegocio   = nombreInput.value.trim();
    if (monedaInput) config.moneda          = monedaInput.value.trim() || "$";
    if (dirInput)    config.negocioDireccion= dirInput.value.trim();
    if (telInput)    config.negocioTelefono = telInput.value.trim();
    if (emailInput)  config.negocioEmail    = emailInput.value.trim();
    saveConfig();
    renderKpis();
    alert("Configuración guardada.");
  });

  logoInput?.addEventListener("change", (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fr = new FileReader();
    fr.onload = () => {
      config.logoBase64 = fr.result;
      saveConfig();
      if (logoPreview) logoPreview.src = config.logoBase64;
      alert("Logo actualizado.");
    };
    fr.readAsDataURL(file);
  });
}

// ====== LOGOUT SIMPLE (sólo limpiar localStorage opcional) ======
function setupLogout() {
  const btn = document.getElementById("btn-logout");
  if (!btn) return;
  btn.addEventListener("click", () => {
    if (!confirm("¿Cerrar sesión y limpiar datos locales? (Las copias en tu navegador se borrarán)")) return;
    localStorage.removeItem(STORAGE_KEY_MOVIMIENTOS);
    localStorage.removeItem(STORAGE_KEY_FACTURAS);
    localStorage.removeItem(STORAGE_KEY_COTIZACIONES);
    // NO borro config para no perder nombre/moneda/logo
    location.reload();
  });
}

// ====== SERVICE WORKER (opcional, ignora errores 404) ======
function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker
      .register("./service-worker.js")
      .catch((err) => console.warn("SW error:", err));
  }
}

// ======================================================
// FACTURAS  (sección: #section-facturas)
// ======================================================

function calcularTotalesDesdeItems(items) {
  let subtotal = 0;
  let impuesto = 0;
  items.forEach((it) => {
    const cant = Number(it.cantidad) || 0;
    const precio = Number(it.precio) || 0;
    const imp = Number(it.impuesto) || 0;
    const base = cant * precio;
    const impMonto = base * (imp / 100);
    subtotal += base;
    impuesto += impMonto;
  });
  const total = subtotal + impuesto;
  return { subtotal, impuesto, total };
}

function leerItemsDesdeTabla(tbodyId) {
  const tbody = document.getElementById(tbodyId);
  const items = [];
  if (!tbody) return items;
  tbody.querySelectorAll("tr").forEach((tr) => {
    const desc = tr.querySelector("[data-item-desc]")?.value || "";
    const cant = Number(tr.querySelector("[data-item-cant]")?.value || "0");
    const precio = Number(tr.querySelector("[data-item-precio]")?.value || "0");
    const imp = Number(tr.querySelector("[data-item-imp]")?.value || "0");
    if (!desc && !cant && !precio) return;
    items.push({
      descripcion: desc,
      cantidad: cant,
      precio,
      impuesto: imp,
    });
  });
  return items;
}

function agregarFilaItem(tbodyId) {
  const tbody = document.getElementById(tbodyId);
  if (!tbody) return;
  const tr = document.createElement("tr");
  tr.innerHTML = `
    <td><input type="text" data-item-desc placeholder="Descripción del ítem"></td>
    <td><input type="number" step="0.01" min="0" data-item-cant value="1"></td>
    <td><input type="number" step="0.01" min="0" data-item-precio value="0"></td>
    <td><input type="number" step="0.01" min="0" data-item-imp value="0"></td>
    <td class="right" data-item-total>0.00</td>
    <td><button type="button" class="btn-small-ghost danger" data-del-item>✕</button></td>
  `;
  tbody.appendChild(tr);

  const inputs = tr.querySelectorAll("input");
  inputs.forEach((inp) =>
    inp.addEventListener("input", () => {
      actualizarTotalFila(tr);
      actualizarResumenFactura();
      actualizarResumenCotizacion();
    })
  );
  tr.querySelector("[data-del-item]")?.addEventListener("click", () => {
    tr.remove();
    actualizarResumenFactura();
    actualizarResumenCotizacion();
  });
  actualizarTotalFila(tr);
}

function actualizarTotalFila(tr) {
  const cant = Number(tr.querySelector("[data-item-cant]")?.value || "0");
  const precio = Number(tr.querySelector("[data-item-precio]")?.value || "0");
  const imp = Number(tr.querySelector("[data-item-imp]")?.value || "0");
  const base = cant * precio;
  const impMonto = base * (imp / 100);
  const total = base + impMonto;
  const cell = tr.querySelector("[data-item-total]");
  if (cell) cell.textContent = total.toFixed(2);
}

// ---- Render tabla de listado de facturas ----
function renderTablaFacturas() {
  const tbody = document.getElementById("tbody-facturas");
  if (!tbody) return;
  tbody.innerHTML = "";
  facturas
    .slice()
    .sort(byCreatedDesc)
    .forEach((f) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${f.fecha || ""}</td>
        <td>${f.numero || ""}</td>
        <td>${f.cliente || ""}</td>
        <td>${f.metodo || ""}</td>
        <td class="right">${formatMoney(f.total)}</td>
        <td class="actions-col">
          <button class="btn-small-ghost" data-fac-pdf="${f.id}">PDF</button>
          <button class="btn-small-ghost" data-fac-edit="${f.id}">Editar</button>
          <button class="btn-small-ghost danger" data-fac-del="${f.id}">Borrar</button>
        </td>
      `;
      tbody.appendChild(tr);
    });

  $all("[data-fac-edit]").forEach((btn) =>
    btn.addEventListener("click", () => openFacturaForm(btn.getAttribute("data-fac-edit")))
  );
  $all("[data-fac-del]").forEach((btn) =>
    btn.addEventListener("click", () => deleteFactura(btn.getAttribute("data-fac-del")))
  );
  $all("[data-fac-pdf]").forEach((btn) =>
    btn.addEventListener("click", () => generarPdfFactura(btn.getAttribute("data-fac-pdf")))
  );
}

// ---- Formulario Factura (panel) ----

let currentFacturaId = null; // null nuevo, string editar

function limpiarFacturaForm() {
  currentFacturaId = null;
  $("#fac-id") && ($("#fac-id").value = "");
  $("#fac-numero") && ($("#fac-numero").value = "");
  $("#fac-fecha") && ($("#fac-fecha").value = todayISO());
  $("#fac-cliente") && ($("#fac-cliente").value = "");
  $("#fac-dir") && ($("#fac-dir").value = "");
  $("#fac-email") && ($("#fac-email").value = "");
  $("#fac-tel") && ($("#fac-tel").value = "");
  $("#fac-metodo") && ($("#fac-metodo").value = "Efectivo");
  $("#fac-notas") && ($("#fac-notas").value = "");

  const tbody = document.getElementById("fac-items-body");
  if (tbody) {
    tbody.innerHTML = "";
    agregarFilaItem("fac-items-body");
  }

  actualizarResumenFactura();
}

function openFacturaForm(id) {
  const panel = document.getElementById("factura-form-panel");
  if (!panel) return;

  if (id) {
    // editar
    const f = facturas.find((x) => x.id === id);
    if (!f) return;
    currentFacturaId = f.id;
    $("#fac-id") && ($("#fac-id").value = f.id);
    $("#fac-numero") && ($("#fac-numero").value = f.numero || "");
    $("#fac-fecha") && ($("#fac-fecha").value = f.fecha || todayISO());
    $("#fac-cliente") && ($("#fac-cliente").value = f.cliente || "");
    $("#fac-dir") && ($("#fac-dir").value = f.dir || "");
    $("#fac-email") && ($("#fac-email").value = f.email || "");
    $("#fac-tel") && ($("#fac-tel").value = f.tel || "");
    $("#fac-metodo") && ($("#fac-metodo").value = f.metodo || "Efectivo");
    $("#fac-notas") && ($("#fac-notas").value = f.notas || "");

    const tbody = document.getElementById("fac-items-body");
    if (tbody) {
      tbody.innerHTML = "";
      (f.items || []).forEach(() => agregarFilaItem("fac-items-body"));
      // rellenar valores
      const rows = tbody.querySelectorAll("tr");
      (f.items || []).forEach((it, idx) => {
        const tr = rows[idx];
        if (!tr) return;
        tr.querySelector("[data-item-desc]").value   = it.descripcion || "";
        tr.querySelector("[data-item-cant]").value   = it.cantidad || 0;
        tr.querySelector("[data-item-precio]").value = it.precio || 0;
        tr.querySelector("[data-item-imp]").value    = it.impuesto || 0;
        actualizarTotalFila(tr);
      });
    }
  } else {
    limpiarFacturaForm();
  }

  panel.classList.remove("hidden");
  actualizarResumenFactura();
}

function cerrarFacturaForm() {
  const panel = document.getElementById("factura-form-panel");
  if (!panel) return;
  panel.classList.add("hidden");
}

function actualizarResumenFactura() {
  const items = leerItemsDesdeTabla("fac-items-body");
  const { subtotal, impuesto, total } = calcularTotalesDesdeItems(items);
  $("#fac-subtotal") && ($("#fac-subtotal").textContent = formatMoney(subtotal));
  $("#fac-impuesto") && ($("#fac-impuesto").textContent = formatMoney(impuesto));
  $("#fac-total") && ($("#fac-total").textContent = formatMoney(total));
}

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
      createdAt: Date.now(),
    };
    movimientos.push(mov);
    fac.movimientoId = mov.id;
  }

  // Aseguramos siempre que sea ingreso (arreglo KPI)
  mov.tipo        = "ingreso";
  mov.fecha       = fac.fecha;
  mov.descripcion = desc;
  mov.categoria   = "Factura";
  mov.metodo      = fac.metodo || "Efectivo";
  mov.monto       = fac.total;

  saveMovimientos();
}

function deleteFactura(id) {
  if (!confirm("¿Eliminar factura? También se eliminará el movimiento asociado.")) return;
  const fac = facturas.find((f) => f.id === id);
  if (fac && fac.movimientoId) {
    movimientos = movimientos.filter((m) => m.id !== fac.movimientoId);
    saveMovimientos();
  }
  facturas = facturas.filter((f) => f.id !== id);
  saveFacturas();
  renderTablaFacturas();
  renderKpis();
  renderTablasMovimientos();
}

// ====== PDF FACTURA (jsPDF) ======

let jsPdfLoaded = false;
async function ensureJsPdf() {
  if (jsPdfLoaded) return;
  await new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src =
      "https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js";
    s.onload = () => resolve();
    s.onerror = (e) => reject(e);
    document.head.appendChild(s);
  });
  jsPdfLoaded = true;
}

async function generarPdfFactura(id) {
  await ensureJsPdf();
  const fac = facturas.find((f) => f.id === id);
  if (!fac) {
    alert("Factura no encontrada.");
    return;
  }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "mm", format: "a4" });

  // Logo
  let y = 20;
  if (config.logoBase64) {
    try {
      doc.addImage(config.logoBase64, "PNG", 14, 10, 24, 24);
    } catch (e) {
      console.warn("No se pudo agregar logo al PDF:", e);
    }
  }

  // Encabezado negocio
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(config.nombreNegocio || "Mi Negocio", 42, 18);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  if (config.negocioDireccion) doc.text(config.negocioDireccion, 42, 23);
  if (config.negocioTelefono)  doc.text("Tel: " + config.negocioTelefono, 42, 28);
  if (config.negocioEmail)     doc.text("Email: " + config.negocioEmail, 42, 33);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("FACTURA", 150, 18);

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("Factura #:", 150, 24);
  doc.text(String(fac.numero || ""), 180, 24, { align: "right" });
  doc.text("Fecha:", 150, 29);
  doc.text(String(fac.fecha || ""), 180, 29, { align: "right" });
  doc.text("Método:", 150, 34);
  doc.text(String(fac.metodo || ""), 180, 34, { align: "right" });

  // Cliente
  y = 44;
  doc.setFont("helvetica", "bold");
  doc.text("FACTURAR A:", 14, y);
  y += 6;
  doc.setFont("helvetica", "normal");
  if (fac.cliente) doc.text(String(fac.cliente), 14, y), (y += 5);
  if (fac.dir)     doc.text(String(fac.dir), 14, y), (y += 5);
  if (fac.email)   doc.text(String(fac.email), 14, y), (y += 5);
  if (fac.tel)     doc.text(String(fac.tel), 14, y), (y += 5);

  // Items
  y += 4;
  doc.line(14, y, 196, y);
  y += 4;
  doc.setFont("helvetica", "bold");
  doc.text("Descripción", 14, y);
  doc.text("Cant.", 110, y, { align: "right" });
  doc.text("Precio", 140, y, { align: "right" });
  doc.text("Imp%", 160, y, { align: "right" });
  doc.text("Total", 196, y, { align: "right" });
  y += 4;
  doc.line(14, y, 196, y);
  y += 5;
  doc.setFont("helvetica", "normal");

  (fac.items || []).forEach((it) => {
    const cant   = Number(it.cantidad) || 0;
    const precio = Number(it.precio) || 0;
    const imp    = Number(it.impuesto) || 0;
    const base   = cant * precio;
    const impMonto = base * (imp / 100);
    const total  = base + impMonto;

    if (y > 260) {
      doc.addPage();
      y = 20;
    }
    doc.text(String(it.descripcion || ""), 14, y);
    doc.text(String(cant.toFixed(2)), 110, y, { align: "right" });
    doc.text(String(precio.toFixed(2)), 140, y, { align: "right" });
    doc.text(String(imp.toFixed(2)), 160, y, { align: "right" });
    doc.text(String(total.toFixed(2)), 196, y, { align: "right" });
    y += 5;
  });

  // Totales
  y += 4;
  doc.line(120, y, 196, y);
  y += 6;
  doc.setFont("helvetica", "bold");
  doc.text("Subtotal:", 140, y);
  doc.text(formatMoney(fac.subtotal), 196, y, { align: "right" });
  y += 5;
  doc.text("Impuesto:", 140, y);
  doc.text(formatMoney(fac.impuesto), 196, y, { align: "right" });
  y += 5;
  doc.text("TOTAL:", 140, y);
  doc.text(formatMoney(fac.total), 196, y, { align: "right" });

  y += 10;
  if (fac.notas) {
    doc.setFont("helvetica", "bold");
    doc.text("Notas:", 14, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    doc.text(String(fac.notas), 14, y);
  }

  const filename =
    (config.nombreNegocio || "Factura") +
    "_Factura_" +
    (fac.numero || "") +
    ".pdf";
  doc.save(filename.replace(/\s+/g, "_"));
}

// ---- setup Facturas ----
function setupFacturas() {
  document.getElementById("btn-nueva-factura")?.addEventListener("click", () =>
    openFacturaForm(null)
  );
  document.getElementById("btn-fac-add-item")?.addEventListener("click", () =>
    agregarFilaItem("fac-items-body")
  );
  document.getElementById("btn-fac-cancel")?.addEventListener("click", () =>
    cerrarFacturaForm()
  );

  const form = document.getElementById("form-factura");
  form?.addEventListener("submit", (e) => {
    e.preventDefault();
    const numero = $("#fac-numero")?.value.trim();
    const fecha  = $("#fac-fecha")?.value || todayISO();
    const cliente= $("#fac-cliente")?.value.trim();
    const dir    = $("#fac-dir")?.value.trim();
    const email  = $("#fac-email")?.value.trim();
    const tel    = $("#fac-tel")?.value.trim();
    const metodo = $("#fac-metodo")?.value || "Efectivo";
    const notas  = $("#fac-notas")?.value.trim();

    if (!numero || !fecha || !cliente) {
      alert("Número, fecha y cliente son obligatorios.");
      return;
    }

    const items = leerItemsDesdeTabla("fac-items-body");
    if (!items.length) {
      alert("Añade al menos un ítem.");
      return;
    }

    const { subtotal, impuesto, total } = calcularTotalesDesdeItems(items);

    let fac;
    if (currentFacturaId) {
      fac = facturas.find((x) => x.id === currentFacturaId);
      if (!fac) return;
      fac.numero   = numero;
      fac.fecha    = fecha;
      fac.cliente  = cliente;
      fac.dir      = dir;
      fac.email    = email;
      fac.tel      = tel;
      fac.metodo   = metodo;
      fac.items    = items;
      fac.subtotal = subtotal;
      fac.impuesto = impuesto;
      fac.total    = total;
      fac.notas    = notas;
    } else {
      fac = {
        id: Date.now().toString(36),
        numero,
        fecha,
        cliente,
        dir,
        email,
        tel,
        metodo,
        items,
        subtotal,
        impuesto,
        total,
        notas,
        createdAt: Date.now(),
        movimientoId: null,
      };
      facturas.push(fac);
    }

    syncFacturaToMovimientos(fac);
    saveFacturas();
    renderTablaFacturas();
    renderKpis();
    renderTablasMovimientos();
    cerrarFacturaForm();
  });

  renderTablaFacturas();
}

// ======================================================
// COTIZACIONES  (sección: #section-cotizaciones)
// IDs similares pero con prefijo "cot-"
// ======================================================

let currentCotId = null;

function limpiarCotizacionForm() {
  currentCotId = null;
  $("#cot-id") && ($("#cot-id").value = "");
  $("#cot-numero") && ($("#cot-numero").value = "");
  $("#cot-fecha") && ($("#cot-fecha").value = todayISO());
  $("#cot-cliente") && ($("#cot-cliente").value = "");
  $("#cot-dir") && ($("#cot-dir").value = "");
  $("#cot-email") && ($("#cot-email").value = "");
  $("#cot-tel") && ($("#cot-tel").value = "");
  $("#cot-metodo") && ($("#cot-metodo").value = "Efectivo");
  $("#cot-notas") && ($("#cot-notas").value = "");

  const tbody = document.getElementById("cot-items-body");
  if (tbody) {
    tbody.innerHTML = "";
    agregarFilaItem("cot-items-body");
  }

  actualizarResumenCotizacion();
}

function openCotizacionForm(id) {
  const panel = document.getElementById("cotizacion-form-panel");
  if (!panel) return;

  if (id) {
    const c = cotizaciones.find((x) => x.id === id);
    if (!c) return;
    currentCotId = c.id;
    $("#cot-id").value       = c.id;
    $("#cot-numero").value   = c.numero || "";
    $("#cot-fecha").value    = c.fecha || todayISO();
    $("#cot-cliente").value  = c.cliente || "";
    $("#cot-dir").value      = c.dir || "";
    $("#cot-email").value    = c.email || "";
    $("#cot-tel").value      = c.tel || "";
    $("#cot-metodo").value   = c.metodo || "Efectivo";
    $("#cot-notas").value    = c.notas || "";

    const tbody = document.getElementById("cot-items-body");
    if (tbody) {
      tbody.innerHTML = "";
      (c.items || []).forEach(() => agregarFilaItem("cot-items-body"));
      const rows = tbody.querySelectorAll("tr");
      (c.items || []).forEach((it, idx) => {
        const tr = rows[idx];
        if (!tr) return;
        tr.querySelector("[data-item-desc]").value   = it.descripcion || "";
        tr.querySelector("[data-item-cant]").value   = it.cantidad || 0;
        tr.querySelector("[data-item-precio]").value = it.precio || 0;
        tr.querySelector("[data-item-imp]").value    = it.impuesto || 0;
        actualizarTotalFila(tr);
      });
    }
  } else {
    limpiarCotizacionForm();
  }

  panel.classList.remove("hidden");
  actualizarResumenCotizacion();
}

function cerrarCotizacionForm() {
  const panel = document.getElementById("cotizacion-form-panel");
  if (!panel) return;
  panel.classList.add("hidden");
}

function actualizarResumenCotizacion() {
  const items = leerItemsDesdeTabla("cot-items-body");
  const { subtotal, impuesto, total } = calcularTotalesDesdeItems(items);
  $("#cot-subtotal") && ($("#cot-subtotal").textContent = formatMoney(subtotal));
  $("#cot-impuesto") && ($("#cot-impuesto").textContent = formatMoney(impuesto));
  $("#cot-total") && ($("#cot-total").textContent = formatMoney(total));
}

function renderTablaCotizaciones() {
  const tbody = document.getElementById("tbody-cotizaciones");
  if (!tbody) return;
  tbody.innerHTML = "";
  cotizaciones
    .slice()
    .sort(byCreatedDesc)
    .forEach((c) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${c.fecha || ""}</td>
        <td>${c.numero || ""}</td>
        <td>${c.cliente || ""}</td>
        <td>${c.metodo || ""}</td>
        <td class="right">${formatMoney(c.total)}</td>
        <td class="actions-col">
          <button class="btn-small-ghost" data-cot-pdf="${c.id}">PDF</button>
          <button class="btn-small-ghost" data-cot-edit="${c.id}">Editar</button>
          <button class="btn-small-ghost danger" data-cot-del="${c.id}">Borrar</button>
        </td>
      `;
      tbody.appendChild(tr);
    });

  $all("[data-cot-edit]").forEach((btn) =>
    btn.addEventListener("click", () => openCotizacionForm(btn.getAttribute("data-cot-edit")))
  );
  $all("[data-cot-del]").forEach((btn) =>
    btn.addEventListener("click", () => deleteCotizacion(btn.getAttribute("data-cot-del")))
  );
  $all("[data-cot-pdf]").forEach((btn) =>
    btn.addEventListener("click", () => generarPdfCotizacion(btn.getAttribute("data-cot-pdf")))
  );
}

function deleteCotizacion(id) {
  if (!confirm("¿Eliminar cotización?")) return;
  cotizaciones = cotizaciones.filter((c) => c.id !== id);
  saveCotizaciones();
  renderTablaCotizaciones();
}

async function generarPdfCotizacion(id) {
  await ensureJsPdf();
  const c = cotizaciones.find((x) => x.id === id);
  if (!c) {
    alert("Cotización no encontrada.");
    return;
  }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "mm", format: "a4" });

  let y = 20;
  if (config.logoBase64) {
    try {
      doc.addImage(config.logoBase64, "PNG", 14, 10, 24, 24);
    } catch (e) {
      console.warn("No se pudo agregar logo al PDF:", e);
    }
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(config.nombreNegocio || "Mi Negocio", 42, 18);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  if (config.negocioDireccion) doc.text(config.negocioDireccion, 42, 23);
  if (config.negocioTelefono)  doc.text("Tel: " + config.negocioTelefono, 42, 28);
  if (config.negocioEmail)     doc.text("Email: " + config.negocioEmail, 42, 33);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("COTIZACIÓN", 150, 18);

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("Cotización #:", 150, 24);
  doc.text(String(c.numero || ""), 180, 24, { align: "right" });
  doc.text("Fecha:", 150, 29);
  doc.text(String(c.fecha || ""), 180, 29, { align: "right" });
  doc.text("Método:", 150, 34);
  doc.text(String(c.metodo || ""), 180, 34, { align: "right" });

  y = 44;
  doc.setFont("helvetica", "bold");
  doc.text("CLIENTE:", 14, y);
  y += 6;
  doc.setFont("helvetica", "normal");
  if (c.cliente) doc.text(String(c.cliente), 14, y), (y += 5);
  if (c.dir)     doc.text(String(c.dir), 14, y), (y += 5);
  if (c.email)   doc.text(String(c.email), 14, y), (y += 5);
  if (c.tel)     doc.text(String(c.tel), 14, y), (y += 5);

  y += 4;
  doc.line(14, y, 196, y);
  y += 4;
  doc.setFont("helvetica", "bold");
  doc.text("Descripción", 14, y);
  doc.text("Cant.", 110, y, { align: "right" });
  doc.text("Precio", 140, y, { align: "right" });
  doc.text("Imp%", 160, y, { align: "right" });
  doc.text("Total", 196, y, { align: "right" });
  y += 4;
  doc.line(14, y, 196, y);
  y += 5;
  doc.setFont("helvetica", "normal");

  (c.items || []).forEach((it) => {
    const cant   = Number(it.cantidad) || 0;
    const precio = Number(it.precio) || 0;
    const imp    = Number(it.impuesto) || 0;
    const base   = cant * precio;
    const impMonto = base * (imp / 100);
    const total  = base + impMonto;

    if (y > 260) {
      doc.addPage();
      y = 20;
    }
    doc.text(String(it.descripcion || ""), 14, y);
    doc.text(String(cant.toFixed(2)), 110, y, { align: "right" });
    doc.text(String(precio.toFixed(2)), 140, y, { align: "right" });
    doc.text(String(imp.toFixed(2)), 160, y, { align: "right" });
    doc.text(String(total.toFixed(2)), 196, y, { align: "right" });
    y += 5;
  });

  y += 4;
  doc.line(120, y, 196, y);
  y += 6;
  doc.setFont("helvetica", "bold");
  doc.text("Subtotal:", 140, y);
  doc.text(formatMoney(c.subtotal), 196, y, { align: "right" });
  y += 5;
  doc.text("Impuesto:", 140, y);
  doc.text(formatMoney(c.impuesto), 196, y, { align: "right" });
  y += 5;
  doc.text("TOTAL:", 140, y);
  doc.text(formatMoney(c.total), 196, y, { align: "right" });

  y += 10;
  if (c.notas) {
    doc.setFont("helvetica", "bold");
    doc.text("Notas:", 14, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    doc.text(String(c.notas), 14, y);
  }

  const filename =
    (config.nombreNegocio || "Cotizacion") +
    "_Cotizacion_" +
    (c.numero || "") +
    ".pdf";
  doc.save(filename.replace(/\s+/g, "_"));
}

function setupCotizaciones() {
  document.getElementById("btn-nueva-cotizacion")?.addEventListener("click", () =>
    openCotizacionForm(null)
  );
  document.getElementById("btn-cot-add-item")?.addEventListener("click", () =>
    agregarFilaItem("cot-items-body")
  );
  document.getElementById("btn-cot-cancel")?.addEventListener("click", () =>
    cerrarCotizacionForm()
  );

  const form = document.getElementById("form-cotizacion");
  form?.addEventListener("submit", (e) => {
    e.preventDefault();
    const numero = $("#cot-numero")?.value.trim();
    const fecha  = $("#cot-fecha")?.value || todayISO();
    const cliente= $("#cot-cliente")?.value.trim();
    const dir    = $("#cot-dir")?.value.trim();
    const email  = $("#cot-email")?.value.trim();
    const tel    = $("#cot-tel")?.value.trim();
    const metodo = $("#cot-metodo")?.value || "Efectivo";
    const notas  = $("#cot-notas")?.value.trim();

    if (!numero || !fecha || !cliente) {
      alert("Número, fecha y cliente son obligatorios.");
      return;
    }

    const items = leerItemsDesdeTabla("cot-items-body");
    if (!items.length) {
      alert("Añade al menos un ítem.");
      return;
    }

    const { subtotal, impuesto, total } = calcularTotalesDesdeItems(items);

    let c;
    if (currentCotId) {
      c = cotizaciones.find((x) => x.id === currentCotId);
      if (!c) return;
      c.numero   = numero;
      c.fecha    = fecha;
      c.cliente  = cliente;
      c.dir      = dir;
      c.email    = email;
      c.tel      = tel;
      c.metodo   = metodo;
      c.items    = items;
      c.subtotal = subtotal;
      c.impuesto = impuesto;
      c.total    = total;
      c.notas    = notas;
    } else {
      c = {
        id: Date.now().toString(36),
        numero,
        fecha,
        cliente,
        dir,
        email,
        tel,
        metodo,
        items,
        subtotal,
        impuesto,
        total,
        notas,
        createdAt: Date.now(),
      };
      cotizaciones.push(c);
    }

    saveCotizaciones();
    renderTablaCotizaciones();
    cerrarCotizacionForm();
  });

  renderTablaCotizaciones();
}

// ======================================================
// INIT
// ======================================================
document.addEventListener("DOMContentLoaded", () => {
  loadFromStorage();
  renderTopbarDate();
  setupNavigation();
  setupModalMovimiento();
  setupExportButtons();
  setupConfig();
  setupLogout();
  registerServiceWorker();
  setupFacturas();
  setupCotizaciones();
  renderKpis();
  renderTablasMovimientos();
});
