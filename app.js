"use strict";

import { applyConfig, loadConfig, readConfig, STORAGE_KEY } from "./config.js";
import {
  boardRows,
  computeJoistPositions,
  computeOptimalLayout,
  createAutoLayout,
  packBoards,
} from "./layout.js";
import { createManualController } from "./manual.js";
import { createRenderer } from "./render.js?v=2";

const qs = (selector) => document.querySelector(selector);

const state = { layoutMode: "auto", manualPieces: [] };
const svgOrigin = { x: 0, y: 0 };

const inputs = {
  terraceLength: qs("#terraceLength"),
  terraceWidth: qs("#terraceWidth"),
  boardLength: qs("#boardLength"),
  boardWidth: qs("#boardWidth"),
  gap: qs("#gap"),
  minOffcut: qs("#minOffcut"),
  patternRows: qs("#patternRows"),
  joistEdgeOffset: qs("#joistEdgeOffset"),
  maxJoistSpacing: qs("#maxJoistSpacing"),
};

const els = {
  svg: qs("#deckSvg"),
  summary: qs("#summary"),
  cutList: qs("#cutList"),
  warnings: qs("#warnings"),
  boardTooltip: qs("#boardTooltip"),
  autoLayoutBtn: qs("#autoLayoutBtn"),
  optimalLayoutBtn: qs("#optimalLayoutBtn"),
  manualLayoutBtn: qs("#manualLayoutBtn"),
  autoLayoutPanel: qs("#autoLayoutPanel"),
  optimalLayoutPanel: qs("#optimalLayoutPanel"),
  manualLayoutPanel: qs("#manualLayoutPanel"),
  manualPalette: qs("#manualPalette"),
  paletteBoardChip: qs("#paletteBoardChip"),
  manualPieceLength: qs("#manualPieceLength"),
  manualLayoutText: qs("#manualLayoutText"),
  pdfExportBtn: qs("#pdfExportBtn"),
};

const renderer = createRenderer({ els, state, svgOrigin });

let saveTimer = null;

function readCurrentConfig() {
  return readConfig(inputs);
}

function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...readCurrentConfig(), layoutMode: state.layoutMode, manualPieces: state.manualPieces }));
    } catch {
      // localStorage nedostupný (soukromé prohlížení apod.)
    }
  }, 5000);
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

function setLayoutMode(mode) {
  state.layoutMode = mode;
  els.autoLayoutBtn.classList.toggle("is-active", mode === "auto");
  els.optimalLayoutBtn.classList.toggle("is-active", mode === "optimal");
  els.manualLayoutBtn.classList.toggle("is-active", mode === "manual");
  els.autoLayoutPanel.classList.toggle("is-hidden", mode !== "auto");
  els.optimalLayoutPanel.classList.toggle("is-hidden", mode !== "optimal");
  els.manualLayoutPanel.classList.toggle("is-hidden", mode !== "manual");
  els.manualPalette.classList.toggle("is-hidden", mode !== "manual");
  document.body.classList.toggle("is-manual-mode", mode === "manual");
  if (mode === "manual") manualController.syncManualTextFromPieces();
  scheduleSave();
  render();
}

function render() {
  renderer.hideBoardTooltip();
  const config = readCurrentConfig();

  if (state.layoutMode === "manual") {
    const currentLen = Number(els.manualPieceLength.value);
    if (!currentLen || currentLen > config.boardLength) {
      els.manualPieceLength.value = Math.round(config.boardLength);
    }
    manualController.updatePaletteLabel();
    renderer.renderManualSvg(config);
    const rows = boardRows(config);
    const packed = packBoards(state.manualPieces.map((p) => p.length), config.boardLength);
    const joistPositions = computeJoistPositions(config, state.manualPieces);
    renderer.renderSummary(config, { rows, pieces: state.manualPieces, packed }, joistPositions);
    renderer.renderCutList(config, packed);
    renderer.renderManualWarnings(config, rows);
    return;
  }

  const layout = state.layoutMode === "optimal"
    ? computeOptimalLayout(config)
    : createAutoLayout(config);

  if (layout.invalidPattern) {
    renderer.clearSvg();
    els.summary.innerHTML = "";
    els.cutList.innerHTML = "<p class=\"hint\">Návrh nelze sestavit, dokud se nevyřeší chyby v poznámkách.</p>";
    renderer.renderWarnings(config, layout);
    return;
  }

  const joistPositions = computeJoistPositions(config, layout.pieces);
  renderer.renderSvg(config, layout, joistPositions);
  renderer.renderSummary(config, layout, joistPositions);
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

function modeLabel() {
  if (state.layoutMode === "optimal") return "Ideální";
  if (state.layoutMode === "manual") return "Ručně";
  return "Automat";
}

function configRows(config) {
  const rows = [
    ["Režim", modeLabel()],
    ["Délka terasy", `${Math.round(config.terraceLength)} mm`],
    ["Šířka terasy", `${Math.round(config.terraceWidth)} mm`],
    ["Délka prkna", `${Math.round(config.boardLength)} mm`],
    ["Šířka prkna", `${Math.round(config.boardWidth)} mm`],
    ["Mezera", `${Math.round(config.gap)} mm`],
    ["Min. odřezek", `${Math.round(config.minOffcut)} mm`],
    ["Odsazení hranolů", `${Math.round(config.joistEdgeOffset)} mm`],
  ];

  if (state.layoutMode === "auto") rows.push(["Opakování vzoru", `${Math.round(config.patternRows)} řad`]);
  if (state.layoutMode === "optimal") rows.push(["Max. rozteč hranolů", `${Math.round(config.maxJoistSpacing)} mm`]);
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

function parseCssPercent(value) {
  const parsed = Number.parseFloat(String(value || "").replace("%", ""));
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

function renderPdfStockRow(row) {
  const label = row.querySelector(".stock-label")?.textContent.trim() || "";
  const meta = row.querySelector(".stock-meta")?.textContent.trim() || "";
  let x = 0;

  const cutRects = Array.from(row.querySelectorAll(".stock-cut")).map((cut, index) => {
    const width = parseCssPercent(cut.style.width);
    const rect = `<rect x="${x.toFixed(3)}" y="0" width="${width.toFixed(3)}" height="10" fill="${index % 2 === 0 ? "#b98152" : "#d3a77c"}" />`;
    x += width;
    return rect;
  }).join("");

  const wasteWidth = parseCssPercent(row.querySelector(".stock-waste")?.style.width);
  const wasteRect = wasteWidth > 0
    ? `<rect x="${x.toFixed(3)}" y="0" width="${wasteWidth.toFixed(3)}" height="10" fill="#f3d4ca" /><path d="M ${x.toFixed(3)} 10 L ${(x + wasteWidth).toFixed(3)} 0" stroke="#b42318" stroke-width="0.8" />`
    : "";

  return `
    <div class="stock-row pdf-stock-row">
      <strong class="stock-label">${escapeHtml(label)}</strong>
      <div class="stock-plan">
        <svg class="pdf-stock-svg" viewBox="0 0 100 10" preserveAspectRatio="none" aria-hidden="true">
          <rect x="0" y="0" width="100" height="10" fill="#f8fafc" />
          ${cutRects}
          ${wasteRect}
          <rect x="0" y="0" width="100" height="10" fill="none" stroke="#b8c2d1" stroke-width="0.6" />
        </svg>
        <span class="stock-meta">${escapeHtml(meta)}</span>
      </div>
    </div>
  `;
}

function renderPdfCutList() {
  const rows = Array.from(els.cutList.querySelectorAll(".stock-row"));
  if (!rows.length) return els.cutList.innerHTML;

  const columnCount = pdfCutColumnCount(rows.length);
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

function createPdfExportPage() {
  const existing = document.querySelector(".pdf-export-root");
  if (existing) existing.remove();

  const config = readCurrentConfig();
  const root = document.createElement("section");
  root.className = "pdf-export-root";
  root.setAttribute("aria-hidden", "true");

  const created = new Date();
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
        <div class="pdf-bottom-grid">
          <section class="pdf-box pdf-cut-box">
            <h2>Řezný plán</h2>
            ${renderPdfCutList()}
          </section>
          <section class="pdf-box pdf-notes-box">
            <h2>Poznámky</h2>
            <ul class="warnings">${els.warnings.innerHTML}</ul>
          </section>
        </div>
      </div>
    </div>
  `;

  root.querySelector(".pdf-drawing-box").appendChild(cloneCurrentSvg());
  document.body.appendChild(root);
  return root;
}

function fitPdfToSinglePage(root) {
  const page = root.querySelector(".pdf-export-page");
  const content = root.querySelector(".pdf-export-content");
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

function exportPdf() {
  render();
  const root = createPdfExportPage();

  requestAnimationFrame(() => {
    fitPdfToSinglePage(root);
    requestAnimationFrame(() => window.print());
  });

  const cleanup = () => {
    root.remove();
    window.removeEventListener("afterprint", cleanup);
  };
  window.addEventListener("afterprint", cleanup);
}

function bindEvents() {
  Object.values(inputs).forEach((input) => {
    input.addEventListener("input", () => {
      scheduleSave();
      render();
    });
  });

  els.autoLayoutBtn.addEventListener("click", () => setLayoutMode("auto"));
  els.optimalLayoutBtn.addEventListener("click", () => setLayoutMode("optimal"));
  els.manualLayoutBtn.addEventListener("click", () => setLayoutMode("manual"));
  els.pdfExportBtn.addEventListener("click", exportPdf);
  manualController.bindEvents();
}

const savedConfig = loadConfig();
applyConfig(inputs, savedConfig);
state.manualPieces = Array.isArray(savedConfig.manualPieces) ? savedConfig.manualPieces : [];
setupTooltips();
bindEvents();

const initialMode = ["auto", "optimal", "manual"].includes(savedConfig.layoutMode) ? savedConfig.layoutMode : "auto";
setLayoutMode(initialMode);
