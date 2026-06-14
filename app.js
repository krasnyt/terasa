"use strict";

import { applyConfig, loadConfig, normalizeConfig, readConfig, STORAGE_KEY } from "./config.js?v=13";
import {
  boardRows,
  computeJoistLayout,
  createAutoLayout,
  getMaxStockLength,
  packBoards,
  piecesForCutPlan,
  stockInventory,
} from "./layout.js?v=17";
import { createManualController } from "./manual.js?v=14";
import { createRenderer } from "./render.js?v=31";

const qs = (selector) => document.querySelector(selector);

const state = {
  layoutMode: "auto",
  viewMode: "both",
  manualPieces: [],
  manualJoists: [],
  cutouts: [],
  measure: { enabled: false, points: [], preview: null },
};
const svgOrigin = { x: 0, y: 0 };

const inputs = {
  terraceLength: qs("#terraceLength"),
  terraceWidth: qs("#terraceWidth"),
  boardLength: qs("#boardLength"),
  stockBoards: qs("#stockBoards"),
  boardWidth: qs("#boardWidth"),
  gap: qs("#gap"),
  sawKerf: qs("#sawKerf"),
  minOffcut: qs("#minOffcut"),
  patternRows: qs("#patternRows"),
  joistEndInset: qs("#joistEndInset"),
  joistLeftOffset: qs("#joistLeftOffset"),
  joistRightOffset: qs("#joistRightOffset"),
  pedestalTopOffset: qs("#pedestalTopOffset"),
  pedestalBottomOffset: qs("#pedestalBottomOffset"),
  pedestalSpacing: qs("#pedestalSpacing"),
  manualPieceLength: qs("#manualPieceLength"),
  manualJoistPosition: qs("#manualJoistPosition"),
  layDirection: document.querySelectorAll("input[name='layDirection']"),
};

const els = {
  svg: qs("#deckSvg"),
  summary: qs("#summary"),
  cutList: qs("#cutList"),
  warnings: qs("#warnings"),
  boardTooltip: qs("#boardTooltip"),
  autoLayoutBtn: qs("#autoLayoutBtn"),
  manualLayoutBtn: qs("#manualLayoutBtn"),
  transferToManualBtn: qs("#transferToManualBtn"),
  autoLayoutPanel: qs("#autoLayoutPanel"),
  manualLayoutPanel: qs("#manualLayoutPanel"),
  manualPalette: qs("#manualPalette"),
  paletteBoardChip: qs("#paletteBoardChip"),
  manualPieceLength: qs("#manualPieceLength"),
  manualLayoutText: qs("#manualLayoutText"),
  manualJoistPosition: qs("#manualJoistPosition"),
  manualJoistDragChip: qs("#manualJoistDragChip"),
  addManualJoistBtn: qs("#addManualJoistBtn"),
  manualJoistsList: qs("#manualJoistsList"),
  cutoutsDetails: qs("#cutoutsDetails"),
  cutoutsCount: qs("#cutoutsCount"),
  addCutoutBtn: qs("#addCutoutBtn"),
  cutoutsList: qs("#cutoutsList"),
  measureToolBtn: qs("#measureToolBtn"),
  pdfExportBtn: qs("#pdfExportBtn"),
  viewJoistsBtn: qs("#viewJoistsBtn"),
  viewBoardsBtn: qs("#viewBoardsBtn"),
  viewBothBtn: qs("#viewBothBtn"),
  configText: qs("#configText"),
  configExportBtn: qs("#configExportBtn"),
  configImportBtn: qs("#configImportBtn"),
  configStatus: qs("#configStatus"),
};

const renderer = createRenderer({ els, state, svgOrigin });

let saveTimer = null;

function readCurrentConfig() {
  return readConfig(inputs);
}

function currentStateSnapshot() {
  return {
    ...readCurrentConfig(),
    layoutMode: state.layoutMode,
    viewMode: state.viewMode,
    manualPieces: state.manualPieces,
    manualJoists: state.manualJoists,
    cutouts: state.cutouts,
  };
}

function saveCurrentStateNow() {
  clearTimeout(saveTimer);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(currentStateSnapshot()));
  } catch {
    // localStorage nedostupný (soukromé prohlížení apod.)
  }
}

function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveCurrentStateNow, 5000);
}

function clientToSvgData(clientX, clientY) {
  const rect = els.svg.getBoundingClientRect();
  const vb = els.svg.viewBox.baseVal;
  if (!rect.width || !rect.height || !vb.width || !vb.height) return null;

  return {
    x: (clientX - rect.left) * (vb.width / rect.width) - svgOrigin.x,
    y: (clientY - rect.top) * (vb.height / rect.height) - svgOrigin.y,
  };
}

const manualController = createManualController({
  els,
  state,
  svgOrigin,
  readConfig: readCurrentConfig,
  render,
  scheduleSave,
  renderer,
});

function setupTooltips() {
  document.querySelectorAll(".help-dot[data-tooltip]").forEach((button) => {
    if (button.querySelector(".tooltip-text")) return;
    const tooltip = document.createElement("span");
    tooltip.className = "tooltip-text";
    tooltip.textContent = button.dataset.tooltip;
    button.appendChild(tooltip);

    button.addEventListener("mouseenter", () => button.classList.add("is-open"));
    button.addEventListener("mouseleave", () => button.classList.remove("is-open"));
    button.addEventListener("focus", () => button.classList.add("is-open"));
    button.addEventListener("blur", () => button.classList.remove("is-open"));
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      button.classList.add("is-open");
      button.focus();
    });
  });
}

function setLayoutMode(mode, options = {}) {
  const normalizedMode = mode === "manual" ? "manual" : "auto";
  state.layoutMode = normalizedMode;
  els.autoLayoutBtn.classList.toggle("is-active", normalizedMode === "auto");
  els.manualLayoutBtn.classList.toggle("is-active", normalizedMode === "manual");
  els.transferToManualBtn.classList.toggle("is-hidden", normalizedMode === "manual");
  els.autoLayoutPanel.classList.toggle("is-hidden", normalizedMode !== "auto");
  els.manualLayoutPanel.classList.toggle("is-hidden", normalizedMode !== "manual");
  els.manualPalette.classList.toggle("is-hidden", normalizedMode !== "manual");
  document.body.classList.toggle("is-manual-mode", normalizedMode === "manual");
  if (normalizedMode === "manual") manualController.syncManualTextFromPieces();
  renderManualJoistControls();
  if (options.save !== false) scheduleSave();
  render();
}

function setViewMode(mode, options = {}) {
  state.viewMode = ["joists", "boards", "both"].includes(mode) ? mode : "both";
  els.viewJoistsBtn.classList.toggle("is-active", state.viewMode === "joists");
  els.viewBoardsBtn.classList.toggle("is-active", state.viewMode === "boards");
  els.viewBothBtn.classList.toggle("is-active", state.viewMode === "both");
  if (options.save !== false) scheduleSave();
  render();
}

function computeCurrentGeneratedLayout(config) {
  if (state.layoutMode === "manual") return null;
  return createAutoLayout(config);
}

function transferCurrentLayoutToManual() {
  const config = readCurrentConfig();
  const layout = computeCurrentGeneratedLayout(config);
  if (!layout || layout.invalidPattern) return;

  state.manualPieces = layout.pieces.map((piece, index) => ({
    id: `m-copy-${Date.now()}-${index}`,
    row: piece.row,
    x: piece.x,
    y: piece.y,
    length: piece.length,
    width: piece.width,
    patternIndex: piece.patternIndex,
  }));
  state.manualJoists = [];
  renderManualJoistControls();
  setLayoutMode("manual");
}

function normalizeManualJoists(config, joists) {
  const values = Array.isArray(joists) ? joists : [];
  const unique = new Map();
  values.forEach((item) => {
    const raw = typeof item === "number" ? item : item?.x;
    const numeric = Number(raw);
    if (!Number.isFinite(numeric)) return;
    const x = Math.round(Math.max(0, Math.min(config.terraceLength, numeric)));
    unique.set(x, { id: item?.id || `j-${x}`, x });
  });
  return Array.from(unique.values()).sort((a, b) => a.x - b.x);
}

function renderManualJoistControls() {
  if (!els.manualJoistsList) return;
  const config = readCurrentConfig();
  state.manualJoists = normalizeManualJoists(config, state.manualJoists);
  if (!state.manualJoists.length) {
    els.manualJoistsList.innerHTML = "<p class=\"hint\">Zatím není přidaný žádný ruční hranolovník.</p>";
    return;
  }

  els.manualJoistsList.innerHTML = state.manualJoists.map((joist) => `
    <button class="manual-joist-chip" type="button" data-manual-joist-remove="${escapeHtml(joist.id)}" aria-label="Odebrat ruční hranolovník ${Math.round(joist.x)} mm">
      ${Math.round(joist.x)} mm <span aria-hidden="true">×</span>
    </button>
  `).join("");
}

function addManualJoist() {
  if (state.layoutMode !== "manual") setLayoutMode("manual");
  const config = readCurrentConfig();
  const raw = Number(els.manualJoistPosition.value);
  if (!Number.isFinite(raw)) return;
  const x = Math.round(Math.max(0, Math.min(config.terraceLength, raw)));
  state.manualJoists = normalizeManualJoists(config, [
    ...state.manualJoists,
    { id: `j-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, x },
  ]);
  els.manualJoistPosition.value = x;
  renderManualJoistControls();
  scheduleSave();
  render();
}

function createCutout() {
  const config = readCurrentConfig();
  return {
    id: `c-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    label: "Okno / dveře",
    edge: "top",
    x: Math.round(config.terraceLength * 0.25),
    width: Math.round(config.terraceLength * 0.35),
    depth: Math.min(300, Math.round(config.terraceWidth * 0.25)),
  };
}

function renderCutoutControls() {
  if (!els.cutoutsList) return;
  if (els.cutoutsCount) els.cutoutsCount.textContent = `${state.cutouts.length} ks`;
  if (!state.cutouts.length) {
    els.cutoutsList.innerHTML = "<p class=\"hint\">Zatím není zadaný žádný zářez.</p>";
    return;
  }

  els.cutoutsList.innerHTML = state.cutouts.map((cutout) => `
    <div class="cutout-card" data-cutout-id="${escapeHtml(cutout.id)}">
      <div class="cutout-card-header">
        <label>
          Název
          <input data-cutout-field="label" type="text" value="${escapeHtml(cutout.label || "")}" />
        </label>
        <button class="cutout-remove-btn" data-cutout-remove="${escapeHtml(cutout.id)}" type="button" aria-label="Odebrat zářez">×</button>
      </div>
      <div class="cutout-grid">
        <label>
          Strana
          <span class="input-unit">
            <select data-cutout-field="edge">
              <option value="top"${cutout.edge !== "bottom" ? " selected" : ""}>Horní</option>
              <option value="bottom"${cutout.edge === "bottom" ? " selected" : ""}>Dolní</option>
            </select>
          </span>
        </label>
        <label>
          Od levého kraje
          <span class="input-unit">
            <input data-cutout-field="x" type="number" min="0" step="10" value="${Math.round(Number(cutout.x) || 0)}" />
            <span>mm</span>
          </span>
        </label>
        <label>
          Šířka
          <span class="input-unit">
            <input data-cutout-field="width" type="number" min="0" step="10" value="${Math.round(Number(cutout.width) || 0)}" />
            <span>mm</span>
          </span>
        </label>
        <label>
          Hloubka
          <span class="hint">ven od hrany</span>
          <span class="input-unit">
            <input data-cutout-field="depth" type="number" min="0" step="10" value="${Math.round(Number(cutout.depth) || 0)}" />
            <span>mm</span>
          </span>
        </label>
      </div>
    </div>
  `).join("");
}

function updateCutoutFromControl(target) {
  const card = target.closest(".cutout-card");
  if (!card) return;
  const cutout = state.cutouts.find((item) => item.id === card.dataset.cutoutId);
  if (!cutout) return;
  const field = target.dataset.cutoutField;
  if (!field) return;
  if (field === "label" || field === "edge") {
    cutout[field] = target.value;
  } else {
    cutout[field] = Math.max(0, Number(target.value) || 0);
  }
  scheduleSave();
  render();
}

function render() {
  renderer.hideBoardTooltip();
  const config = readCurrentConfig();

  if (state.layoutMode === "manual") {
    const currentLen = Number(els.manualPieceLength.value);
    const maxStockLength = getMaxStockLength(config);
    if (!currentLen || currentLen > maxStockLength) {
      els.manualPieceLength.value = Math.round(maxStockLength);
    }
    manualController.updatePaletteLabel();
    renderer.renderManualSvg(config);
    const rows = boardRows(config);
    const packed = packBoards(piecesForCutPlan(state.manualPieces), config);
    state.manualJoists = normalizeManualJoists(config, state.manualJoists);
    renderManualJoistControls();
    const joistLayout = computeJoistLayout(config, state.manualPieces, state.cutouts, state.manualJoists);
    renderer.renderSummary(config, { rows, pieces: state.manualPieces, packed }, joistLayout);
    renderer.renderCutList(config, packed);
    renderer.renderManualWarnings(config, rows, packed.warnings);
    return;
  }

  const layout = computeCurrentGeneratedLayout(config);

  if (layout.invalidPattern) {
    els.transferToManualBtn.disabled = true;
    renderer.clearSvg();
    els.summary.innerHTML = "";
    els.cutList.innerHTML = "<p class=\"hint\">Návrh nelze sestavit, dokud se nevyřeší chyby v poznámkách.</p>";
    renderer.renderWarnings(config, layout);
    return;
  }

  els.transferToManualBtn.disabled = false;
  const joistLayout = computeJoistLayout(config, layout.pieces, state.cutouts);
  renderer.renderSvg(config, layout, joistLayout);
  renderer.renderSummary(config, layout, joistLayout);
  renderer.renderCutList(config, layout.packed);
  renderer.renderWarnings(config, layout);
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function setConfigStatus(message, type = "") {
  if (!els.configStatus) return;
  els.configStatus.textContent = message;
  els.configStatus.classList.toggle("is-error", type === "error");
  els.configStatus.classList.toggle("is-ok", type === "ok");
}

function exportConfigText() {
  return JSON.stringify({
    format: "terasa-navrh",
    version: 1,
    exportedAt: new Date().toISOString(),
    config: currentStateSnapshot(),
  }, null, 2);
}

function copyTextFallback(text) {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.top = "-1000px";
  textarea.style.left = "-1000px";
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  const copied = document.execCommand("copy");
  textarea.remove();
  if (!copied) throw new Error("copy-failed");
}

async function copyTextToClipboard(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  copyTextFallback(text);
}

async function exportConfig() {
  const text = exportConfigText();
  els.configText.value = text;
  try {
    await copyTextToClipboard(text);
    setConfigStatus("Konfigurace je zkopírovaná do schránky.", "ok");
  } catch {
    setConfigStatus("Konfigurace je připravená v poli. Zkopíruj ji ručně.", "error");
  }
}

function unwrapImportedConfig(parsed) {
  if (parsed?.format === "terasa-navrh" && parsed.config) return parsed.config;
  if (parsed?.config && typeof parsed.config === "object") return parsed.config;
  if (parsed?.data && typeof parsed.data === "object") return parsed.data;
  return parsed;
}

function parseImportedConfig(text) {
  const parsed = JSON.parse(text);
  const rawConfig = unwrapImportedConfig(parsed);
  if (!rawConfig || typeof rawConfig !== "object" || Array.isArray(rawConfig)) {
    throw new Error("invalid-config");
  }
  return normalizeConfig(rawConfig);
}

function importConfig() {
  const text = els.configText.value.trim();
  if (!text) {
    setConfigStatus("Vlož nejdřív text exportované konfigurace.", "error");
    return;
  }

  try {
    const imported = parseImportedConfig(text);
    applyConfig(inputs, imported);
    state.manualPieces = Array.isArray(imported.manualPieces) ? imported.manualPieces : [];
    state.manualJoists = Array.isArray(imported.manualJoists) ? imported.manualJoists : [];
    state.cutouts = Array.isArray(imported.cutouts) ? imported.cutouts : [];
    state.measure = { enabled: false, points: [], preview: null };
    renderCutoutControls();
    setMeasureEnabled(false);
    setViewMode(imported.viewMode, { save: false });
    setLayoutMode(imported.layoutMode === "manual" ? "manual" : "auto", { save: false });
    saveCurrentStateNow();
    setConfigStatus("Konfigurace je importovaná a uložená.", "ok");
  } catch {
    setConfigStatus("Konfiguraci se nepodařilo načíst. Zkontroluj, že vkládáš celý exportovaný text.", "error");
  }
}

function modeLabel() {
  if (state.layoutMode === "manual") return "Ručně";
  return "Automat";
}

function viewModeLabel() {
  if (state.viewMode === "joists") return "Hranoly";
  if (state.viewMode === "boards") return "Prkna";
  return "Oboje";
}

function configRows(config) {
  const rows = [
    ["Režim", modeLabel()],
    ["Zobrazení", viewModeLabel()],
    ["Délka terasy", `${Math.round(config.terraceLength)} mm`],
    ["Šířka terasy", `${Math.round(config.terraceWidth)} mm`],
    ["Délka prkna", `${Math.round(config.boardLength)} mm`],
    ["Skladová prkna", stockInventory(config).label],
    ["Šířka prkna", `${Math.round(config.boardWidth)} mm`],
    ["Mezera", `${Math.round(config.gap)} mm`],
    ["Tloušťka řezu", `${Math.round(config.sawKerf)} mm`],
    ["Min. odřezek", `${Math.round(config.minOffcut)} mm`],
    ["Začátek pokládky", config.layDirection === "right" ? "zprava" : "zleva"],
    ["Odsazení hranolovníku od konce prkna", `${Math.round(config.joistEndInset)} mm`],
    ["Odsazení terčů zleva", `${Math.round(config.joistLeftOffset)} mm`],
    ["Odsazení terčů zprava", `${Math.round(config.joistRightOffset)} mm`],
    ["Odsazení terčů shora", `${Math.round(config.pedestalTopOffset)} mm`],
    ["Odsazení terčů zdola", `${Math.round(config.pedestalBottomOffset)} mm`],
    ["Rozteč terčů", `${Math.round(config.pedestalSpacing)} mm`],
  ];

  if (state.layoutMode === "auto") rows.push(["Opakování vzoru", `${Math.round(config.patternRows)} řad`]);
  if (state.layoutMode === "manual" && state.manualJoists.length) rows.push(["Ruční hranolovníky", `${state.manualJoists.length} ks`]);
  if (state.cutouts.length) rows.push(["Zářezy", `${state.cutouts.length} ks`]);
  return rows;
}

function cloneCurrentSvg() {
  const svg = els.svg.cloneNode(true);
  svg.removeAttribute("id");
  svg.removeAttribute("style");
  svg.querySelectorAll("[id]").forEach((node) => node.removeAttribute("id"));
  return svg;
}

function pdfCutColumnCount(rowCount) {
  if (rowCount > 42) return 4;
  if (rowCount > 16) return 3;
  if (rowCount > 8) return 2;
  return 1;
}

function pdfCutRowsPerPage(columnCount) {
  if (columnCount >= 4) return 128;
  if (columnCount === 3) return 72;
  if (columnCount === 2) return 42;
  return 24;
}

function parseCssPercent(value) {
  const parsed = Number.parseFloat(String(value || "").replace("%", ""));
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

function renderPdfStockRow(row) {
  const label = row.querySelector(".stock-label")?.textContent.trim() || "";
  const meta = row.querySelector(".stock-meta")?.textContent.trim() || "";
  let x = 0;

  let cutIndex = 0;
  const stockSegments = Array.from(row.querySelectorAll(".stock-bar > span")).map((segment) => {
    const width = parseCssPercent(segment.style.width);
    let rect = "";
    if (segment.classList.contains("stock-cut")) {
      rect = `<rect x="${x.toFixed(3)}" y="0" width="${width.toFixed(3)}" height="10" fill="${cutIndex % 2 === 0 ? "#b98152" : "#d3a77c"}" />`;
      cutIndex += 1;
    } else if (segment.classList.contains("stock-kerf")) {
      rect = `<rect x="${x.toFixed(3)}" y="0" width="${width.toFixed(3)}" height="10" fill="#667085" />`;
    } else if (segment.classList.contains("stock-waste") && width > 0) {
      rect = `<rect x="${x.toFixed(3)}" y="0" width="${width.toFixed(3)}" height="10" fill="#f3d4ca" /><path d="M ${x.toFixed(3)} 10 L ${(x + width).toFixed(3)} 0" stroke="#b42318" stroke-width="0.8" />`;
    }
    x += width;
    return rect;
  }).join("");

  return `
    <div class="stock-row pdf-stock-row">
      <strong class="stock-label">${escapeHtml(label)}</strong>
      <div class="stock-plan">
        <svg class="pdf-stock-svg" viewBox="0 0 100 10" preserveAspectRatio="none" aria-hidden="true">
          <rect x="0" y="0" width="100" height="10" fill="#f8fafc" />
          ${stockSegments}
          <rect x="0" y="0" width="100" height="10" fill="none" stroke="#b8c2d1" stroke-width="0.6" />
        </svg>
        <span class="stock-meta">${escapeHtml(meta)}</span>
      </div>
    </div>
  `;
}

function renderPdfCutColumns(rows, columnCount) {
  const rowsPerColumn = Math.ceil(rows.length / columnCount);
  const columns = [];

  for (let i = 0; i < columnCount; i += 1) {
    const columnRows = rows.slice(i * rowsPerColumn, (i + 1) * rowsPerColumn);
    if (columnRows.length) {
      columns.push(`<div class="pdf-cut-column">${columnRows.map(renderPdfStockRow).join("")}</div>`);
    }
  }

  return `<div class="pdf-cut-columns" style="--pdf-cut-columns:${columns.length}">${columns.join("")}</div>`;
}

function renderPdfCutPageBodies() {
  const rows = Array.from(els.cutList.querySelectorAll(".stock-row"));
  if (!rows.length) return [els.cutList.innerHTML || "<p>Řezný plán není dostupný.</p>"];

  const leadHtml = Array.from(els.cutList.children)
    .filter((child) => !child.classList.contains("stock-row"))
    .map((child) => child.outerHTML)
    .join("");
  const columnCount = pdfCutColumnCount(rows.length);
  const rowsPerPage = pdfCutRowsPerPage(columnCount);
  const pages = [];

  for (let i = 0; i < rows.length; i += rowsPerPage) {
    const pageRows = rows.slice(i, i + rowsPerPage);
    const pageLeadHtml = pages.length === 0 ? leadHtml : "";
    pages.push(`${pageLeadHtml}${renderPdfCutColumns(pageRows, columnCount)}`);
  }

  return pages;
}

function createPdfExportPage() {
  const existing = document.querySelector(".pdf-export-root");
  if (existing) existing.remove();

  const config = readCurrentConfig();
  const root = document.createElement("section");
  root.className = "pdf-export-root";
  root.setAttribute("aria-hidden", "true");

  const created = new Date();
  const cutPageBodies = renderPdfCutPageBodies();
  const cutPageCount = cutPageBodies.length;
  const cutPages = cutPageBodies.map((body, index) => `
    <div class="pdf-export-page pdf-cut-page">
      <div class="pdf-export-content">
        <header class="pdf-cut-page-header">
          <div>
            <h1>Řezný plán</h1>
            <p>Plán pokládky terasy · ${created.toLocaleDateString("cs-CZ")} ${created.toLocaleTimeString("cs-CZ", { hour: "2-digit", minute: "2-digit" })}</p>
          </div>
          <span>${cutPageCount > 1 ? `strana ${index + 1} / ${cutPageCount}` : "samostatná stránka"}</span>
        </header>
        <section class="pdf-box pdf-cut-box pdf-cut-page-box">
          ${body}
        </section>
      </div>
    </div>
  `).join("");

  root.innerHTML = `
    <div class="pdf-export-page">
      <div class="pdf-export-content">
        <header class="pdf-export-header">
          <div>
            <h1>Plán pokládky terasy</h1>
            <p>${modeLabel()} · ${created.toLocaleDateString("cs-CZ")} ${created.toLocaleTimeString("cs-CZ", { hour: "2-digit", minute: "2-digit" })}</p>
          </div>
          <dl class="pdf-config-list">
            ${configRows(config).map(([label, value]) => `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`).join("")}
          </dl>
        </header>
        <div class="pdf-main-grid">
          <div class="pdf-drawing-box"></div>
          <section class="pdf-box pdf-summary-box">
            <h2>Výstup</h2>
            ${els.summary.innerHTML || "<p>Výstup není dostupný.</p>"}
          </section>
        </div>
        <section class="pdf-box pdf-notes-box pdf-notes-section">
          <h2>Poznámky</h2>
          <ul class="warnings">${els.warnings.innerHTML}</ul>
        </section>
      </div>
    </div>
    ${cutPages}
  `;

  root.querySelector(".pdf-drawing-box").appendChild(cloneCurrentSvg());
  document.body.appendChild(root);
  return root;
}

function fitPdfPage(page) {
  const content = page.querySelector(".pdf-export-content");
  if (!content) return;

  content.style.setProperty("--pdf-scale", "1");
  content.style.width = "";

  const pageRect = page.getBoundingClientRect();
  const pageStyle = getComputedStyle(page);
  const horizontalPadding = Number.parseFloat(pageStyle.paddingLeft) + Number.parseFloat(pageStyle.paddingRight);
  const verticalPadding = Number.parseFloat(pageStyle.paddingTop) + Number.parseFloat(pageStyle.paddingBottom);
  const availableWidth = pageRect.width - horizontalPadding;
  const availableHeight = pageRect.height - verticalPadding;
  const contentRect = content.getBoundingClientRect();
  const scale = Math.min(1, availableWidth / contentRect.width, availableHeight / content.scrollHeight);
  const fittedScale = Math.max(0.12, scale - 0.01);
  content.style.width = `${availableWidth / fittedScale}px`;
  content.style.setProperty("--pdf-scale", String(fittedScale));
}

function fitPdfToPages(root) {
  root.querySelectorAll(".pdf-export-page").forEach(fitPdfPage);
}

function exportPdf() {
  render();
  const root = createPdfExportPage();

  requestAnimationFrame(() => {
    fitPdfToPages(root);
    requestAnimationFrame(() => window.print());
  });

  const cleanup = () => {
    root.remove();
    window.removeEventListener("afterprint", cleanup);
  };
  window.addEventListener("afterprint", cleanup);
}

function setMeasureEnabled(enabled) {
  state.measure.enabled = enabled;
  state.measure.preview = null;
  els.measureToolBtn.classList.toggle("is-active", enabled);
  els.measureToolBtn.setAttribute("aria-pressed", enabled ? "true" : "false");
  els.svg.classList.toggle("is-measuring", enabled);
  renderer.renderMeasureOverlay();
}

function handleMeasurePointerDown(event) {
  if (!state.measure.enabled) return;
  const point = clientToSvgData(event.clientX, event.clientY);
  if (!point) return;

  event.preventDefault();
  event.stopImmediatePropagation();
  renderer.hideBoardTooltip();

  if (state.measure.points.length >= 2) {
    state.measure.points = [];
    state.measure.preview = null;
  } else if (state.measure.points.length === 1) {
    state.measure.points = [state.measure.points[0], point];
    state.measure.preview = null;
  } else {
    state.measure.points = [point];
    state.measure.preview = null;
  }

  renderer.renderMeasureOverlay();
}

function handleMeasurePointerMove(event) {
  if (!state.measure.enabled || state.measure.points.length !== 1) return;
  const point = clientToSvgData(event.clientX, event.clientY);
  if (!point) return;
  event.stopImmediatePropagation();
  state.measure.preview = point;
  renderer.renderMeasureOverlay();
}

function bindEvents() {
  Object.values(inputs).forEach((input) => {
    const controls = typeof input.forEach === "function" ? Array.from(input) : [input];
    controls.forEach((control) => {
      control.addEventListener("input", () => {
        scheduleSave();
        render();
      });
    });
  });

  els.autoLayoutBtn.addEventListener("click", () => setLayoutMode("auto"));
  els.manualLayoutBtn.addEventListener("click", () => setLayoutMode("manual"));
  els.transferToManualBtn.addEventListener("click", transferCurrentLayoutToManual);
  els.addManualJoistBtn.addEventListener("click", addManualJoist);
  els.manualJoistPosition.addEventListener("keydown", (event) => {
    if (event.key === "Enter") addManualJoist();
  });
  els.manualJoistsList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-manual-joist-remove]");
    if (!button) return;
    state.manualJoists = state.manualJoists.filter((joist) => joist.id !== button.dataset.manualJoistRemove);
    renderManualJoistControls();
    scheduleSave();
    render();
  });
  els.viewJoistsBtn.addEventListener("click", () => setViewMode("joists"));
  els.viewBoardsBtn.addEventListener("click", () => setViewMode("boards"));
  els.viewBothBtn.addEventListener("click", () => setViewMode("both"));
  els.measureToolBtn.addEventListener("click", () => setMeasureEnabled(!state.measure.enabled));
  els.pdfExportBtn.addEventListener("click", exportPdf);
  els.configExportBtn.addEventListener("click", exportConfig);
  els.configImportBtn.addEventListener("click", importConfig);
  els.svg.addEventListener("pointerdown", handleMeasurePointerDown);
  els.svg.addEventListener("pointermove", handleMeasurePointerMove);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && state.measure.enabled) setMeasureEnabled(false);
  });
  els.addCutoutBtn.addEventListener("click", () => {
    state.cutouts.push(createCutout());
    els.cutoutsDetails.open = true;
    renderCutoutControls();
    scheduleSave();
    render();
  });
  els.cutoutsList.addEventListener("input", (event) => {
    if (event.target.matches("[data-cutout-field]")) updateCutoutFromControl(event.target);
  });
  els.cutoutsList.addEventListener("change", (event) => {
    if (event.target.matches("[data-cutout-field]")) updateCutoutFromControl(event.target);
  });
  els.cutoutsList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-cutout-remove]");
    if (!button) return;
    state.cutouts = state.cutouts.filter((cutout) => cutout.id !== button.dataset.cutoutRemove);
    renderCutoutControls();
    scheduleSave();
    render();
  });
  manualController.bindEvents();
}

const savedConfig = loadConfig();
applyConfig(inputs, savedConfig);
state.manualPieces = Array.isArray(savedConfig.manualPieces) ? savedConfig.manualPieces : [];
state.manualJoists = Array.isArray(savedConfig.manualJoists) ? savedConfig.manualJoists : [];
state.cutouts = Array.isArray(savedConfig.cutouts) ? savedConfig.cutouts : [];
state.viewMode = ["joists", "boards", "both"].includes(savedConfig.viewMode) ? savedConfig.viewMode : "both";
renderCutoutControls();
setupTooltips();
bindEvents();

const initialMode = savedConfig.layoutMode === "manual" ? "manual" : "auto";
setViewMode(state.viewMode, { save: false });
setLayoutMode(initialMode, { save: false });
