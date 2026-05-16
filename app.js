"use strict";

const qs = (selector) => document.querySelector(selector);
const svgNS = "http://www.w3.org/2000/svg";

const inputs = {
  terraceLength: qs("#terraceLength"),
  terraceWidth: qs("#terraceWidth"),
  boardLength: qs("#boardLength"),
  boardWidth: qs("#boardWidth"),
  gap: qs("#gap"),
  minOffcut: qs("#minOffcut"),
  stagger: qs("#stagger"),
  patternRows: qs("#patternRows"),
  manualCuts: qs("#manualCuts"),
};

const els = {
  svg: qs("#deckSvg"),
  summary: qs("#summary"),
  cutList: qs("#cutList"),
  warnings: qs("#warnings"),
  autoMode: qs("#autoMode"),
  manualMode: qs("#manualMode"),
  autoPanel: qs("#autoPanel"),
  manualPanel: qs("#manualPanel"),
  resetManual: qs("#resetManual"),
  viewTitle: qs("#viewTitle"),
  viewSubtitle: qs("#viewSubtitle"),
};

const state = {
  mode: "auto",
  manualPieces: [],
  drag: null,
  lastManualSignature: "",
};

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

function numberValue(input, fallback) {
  const value = Number(input.value);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function readConfig() {
  return {
    terraceLength: numberValue(inputs.terraceLength, 5000),
    terraceWidth: numberValue(inputs.terraceWidth, 2150),
    boardLength: numberValue(inputs.boardLength, 2300),
    boardWidth: numberValue(inputs.boardWidth, 178),
    gap: Math.max(0, Number(inputs.gap.value) || 0),
    minOffcut: Math.max(0, Number(inputs.minOffcut.value) || 0),
    stagger: Math.max(0, Number(inputs.stagger.value) || 0),
    patternRows: Math.max(1, Math.round(numberValue(inputs.patternRows, 3))),
  };
}

function boardRows(config) {
  const pitch = config.boardWidth + config.gap;
  const rows = Math.max(1, Math.ceil((config.terraceWidth + config.gap) / pitch));
  return Array.from({ length: rows }, (_, index) => {
    const y = index * pitch;
    const remaining = config.terraceWidth - y;
    return {
      index,
      y,
      width: Math.max(0, Math.min(config.boardWidth, remaining)),
    };
  }).filter((row) => row.width > 0);
}

function createAutoLayout(config) {
  const rows = boardRows(config);
  const pieces = [];
  const warnings = [];
  const maxOffset = Math.max(0, config.boardLength - config.minOffcut);
  const usableStagger = Math.min(config.stagger, maxOffset);
  const normalizedStagger = usableStagger > 0
    ? usableStagger
    : config.boardLength / config.patternRows;

  rows.forEach((row) => {
    const patternIndex = row.index % config.patternRows;
    const rawOffset = patternIndex * normalizedStagger;
    const offset = rawOffset % config.boardLength;
    let x = 0;
    let firstLength = offset > 0 ? config.boardLength - offset : config.boardLength;

    if (firstLength < config.minOffcut && config.terraceLength > config.minOffcut) {
      firstLength = Math.min(config.terraceLength, config.minOffcut);
    }

    while (x < config.terraceLength - 0.5) {
      let length = Math.min(x === 0 ? firstLength : config.boardLength, config.terraceLength - x);
      const remainder = config.terraceLength - (x + length);

      if (remainder > 0 && remainder < config.minOffcut && length > config.minOffcut + remainder) {
        length -= config.minOffcut - remainder;
      }

      pieces.push({
        id: `a-${row.index}-${pieces.length}`,
        row: row.index,
        x,
        y: row.y,
        length,
        width: row.width,
        patternIndex,
      });
      x += length;
    }
  });

  const shortPieces = pieces.filter((piece) => piece.length < config.minOffcut);
  if (shortPieces.length) {
    warnings.push({
      type: "warning",
      text: `${shortPieces.length} dílů je kratších než nastavené minimum odřezku.`,
    });
  }

  const packed = packBoards(pieces.map((piece) => piece.length), config.boardLength);
  return { rows, pieces, packed, warnings };
}

function packBoards(lengths, stockLength) {
  const boards = [];
  const sorted = lengths
    .filter((length) => length > 0)
    .map((length) => Math.round(length))
    .sort((a, b) => b - a);

  sorted.forEach((length) => {
    let target = boards.find((board) => board.remaining >= length);
    if (!target) {
      target = { cuts: [], remaining: stockLength };
      boards.push(target);
    }
    target.cuts.push(length);
    target.remaining -= length;
  });

  return boards;
}

function parseManualCuts(config) {
  return inputs.manualCuts.value
    .split(/[\s,;]+/)
    .map((part) => Number(part.trim()))
    .filter((length) => Number.isFinite(length) && length > 0)
    .map((length) => Math.min(length, config.boardLength));
}

function ensureManualPieces(config, forceReset = false) {
  const signature = [
    parseManualCuts(config).join(","),
    config.terraceLength,
    config.terraceWidth,
    config.boardWidth,
    config.gap,
  ].join("|");

  if (!forceReset && signature === state.lastManualSignature && state.manualPieces.length) {
    return;
  }

  const trayX = -config.terraceLength * 0.36;
  const trayPitch = config.boardWidth + config.gap;
  state.manualPieces = parseManualCuts(config).map((length, index) => ({
    id: `m-${Date.now()}-${index}`,
    length,
    row: null,
    x: trayX,
    trayIndex: index,
    y: index * trayPitch,
  }));
  state.lastManualSignature = signature;
}

function manualLayout(config) {
  ensureManualPieces(config);
  const rows = boardRows(config);
  const placed = state.manualPieces.filter((piece) => piece.row !== null);
  const packed = packBoards(state.manualPieces.map((piece) => piece.length), config.boardLength);
  const warnings = [];
  const totalPlaced = placed.reduce((sum, piece) => sum + piece.length * config.boardWidth, 0);
  const terraceArea = config.terraceLength * config.terraceWidth;
  const covered = terraceArea ? Math.min(100, (totalPlaced / terraceArea) * 100) : 0;

  warnings.push({
    type: "info",
    text: `Ručně položené díly pokrývají přibližně ${covered.toFixed(1)} % plochy.`,
  });

  const overlaps = countManualOverlaps(state.manualPieces, config);
  if (overlaps > 0) {
    warnings.push({
      type: "danger",
      text: `${overlaps} ručních dílů se překrývá s jiným dílem ve stejné řadě.`,
    });
  }

  return { rows, pieces: state.manualPieces, packed, warnings };
}

function countManualOverlaps(pieces, config) {
  const byRow = new Map();
  pieces.forEach((piece) => {
    if (piece.row === null) return;
    if (!byRow.has(piece.row)) byRow.set(piece.row, []);
    byRow.get(piece.row).push(piece);
  });

  let overlaps = 0;
  byRow.forEach((rowPieces) => {
    rowPieces.sort((a, b) => a.x - b.x);
    for (let index = 1; index < rowPieces.length; index += 1) {
      const previous = rowPieces[index - 1];
      const current = rowPieces[index];
      if (previous.x + previous.length + config.gap > current.x) overlaps += 1;
    }
  });
  return overlaps;
}

function svgEl(name, attrs = {}) {
  const element = document.createElementNS(svgNS, name);
  Object.entries(attrs).forEach(([key, value]) => {
    element.setAttribute(key, String(value));
  });
  return element;
}

function clearSvg() {
  while (els.svg.firstChild) els.svg.firstChild.remove();
}

function render() {
  const config = readConfig();
  const layout = state.mode === "auto" ? createAutoLayout(config) : manualLayout(config);
  renderSvg(config, layout);
  renderSummary(config, layout);
  renderCutList(config, layout.packed);
  renderWarnings(config, layout);
  updateModeCopy();
}

function renderSvg(config, layout) {
  clearSvg();
  const trayWidth = state.mode === "manual" ? config.terraceLength * 0.42 : 0;
  const pad = Math.max(220, config.terraceLength * 0.08);
  const viewWidth = config.terraceLength + pad * 2 + trayWidth;
  const viewHeight = config.terraceWidth + pad * 1.6;
  const originX = pad;
  const originY = pad * 0.62;

  els.svg.setAttribute("viewBox", `${-trayWidth} 0 ${viewWidth} ${viewHeight}`);

  if (state.mode === "manual") {
    renderTray(config, originY);
  }

  els.svg.appendChild(svgEl("rect", {
    class: "deck-outline",
    x: originX,
    y: originY,
    width: config.terraceLength,
    height: config.terraceWidth,
    rx: 0,
  }));

  layout.rows.forEach((row) => {
    if (row.index > 0) {
      els.svg.appendChild(svgEl("rect", {
        x: originX,
        y: originY + row.y - config.gap,
        width: config.terraceLength,
        height: config.gap,
        fill: "#eef3f8",
      }));
    }
  });

  if (state.mode === "auto") {
    layout.pieces.forEach((piece) => renderAutoPiece(piece, originX, originY));
  } else {
    layout.pieces.forEach((piece) => renderManualPiece(piece, config, originX, originY));
  }

  renderDimensions(config, originX, originY);
}

function renderTray(config, originY) {
  els.svg.appendChild(svgEl("text", {
    class: "tray-label",
    x: -config.terraceLength * 0.36,
    y: originY - 24,
  })).textContent = "Zásobník dílů";

  els.svg.appendChild(svgEl("rect", {
    x: -config.terraceLength * 0.39,
    y: originY - 8,
    width: config.terraceLength * 0.34,
    height: config.terraceWidth + 16,
    rx: 8,
    fill: "rgba(244, 247, 251, 0.86)",
    stroke: "#d8dee8",
  }));
}

function renderAutoPiece(piece, originX, originY) {
  els.svg.appendChild(svgEl("rect", {
    class: `board-piece pattern-row-${piece.patternIndex % 4}`,
    x: originX + piece.x,
    y: originY + piece.y,
    width: piece.length,
    height: piece.width,
    rx: 5,
  }));

  if (piece.x > 0) {
    els.svg.appendChild(svgEl("line", {
      class: "seam-line",
      x1: originX + piece.x,
      y1: originY + piece.y,
      x2: originX + piece.x,
      y2: originY + piece.y + piece.width,
    }));
  }

  if (piece.length > 420) {
    const text = svgEl("text", {
      class: "piece-label",
      x: originX + piece.x + piece.length / 2,
      y: originY + piece.y + piece.width / 2,
    });
    text.textContent = `${Math.round(piece.length)}`;
    els.svg.appendChild(text);
  }
}

function renderManualPiece(piece, config, originX, originY) {
  const rowY = piece.row === null
    ? originY + piece.y
    : originY + boardRows(config)[piece.row].y;
  const x = piece.row === null ? piece.x : originX + piece.x;
  const width = piece.length;
  const height = piece.row === null ? config.boardWidth : boardRows(config)[piece.row].width;

  const group = svgEl("g", {
    class: `manual-piece${state.drag?.id === piece.id ? " is-dragging" : ""}`,
    "data-piece-id": piece.id,
  });
  group.appendChild(svgEl("rect", {
    class: "board-piece",
    x,
    y: rowY,
    width,
    height,
    rx: 5,
  }));

  const text = svgEl("text", {
    class: "piece-label",
    x: x + Math.max(38, width / 2),
    y: rowY + height / 2,
  });
  text.textContent = `${Math.round(piece.length)}`;
  group.appendChild(text);
  els.svg.appendChild(group);
}

function renderDimensions(config, originX, originY) {
  const lengthLabel = svgEl("text", {
    class: "dimension-label",
    x: originX + config.terraceLength / 2,
    y: originY + config.terraceWidth + 42,
    "text-anchor": "middle",
  });
  lengthLabel.textContent = `${Math.round(config.terraceLength)} mm`;
  els.svg.appendChild(lengthLabel);

  const widthLabel = svgEl("text", {
    class: "dimension-label",
    x: originX - 42,
    y: originY + config.terraceWidth / 2,
    transform: `rotate(-90 ${originX - 42} ${originY + config.terraceWidth / 2})`,
    "text-anchor": "middle",
  });
  widthLabel.textContent = `${Math.round(config.terraceWidth)} mm`;
  els.svg.appendChild(widthLabel);
}

function renderSummary(config, layout) {
  const pieceCount = state.mode === "auto"
    ? layout.pieces.length
    : state.manualPieces.length;
  const used = layout.packed.reduce((sum, board) => sum + board.cuts.reduce((inner, cut) => inner + cut, 0), 0);
  const purchased = layout.packed.length * config.boardLength;
  const waste = Math.max(0, purchased - used);
  const coverageWidth = layout.rows.reduce((sum, row) => sum + row.width, 0) + Math.max(0, layout.rows.length - 1) * config.gap;

  const items = [
    ["Skladová prkna", `${layout.packed.length} ks`],
    ["Položené řady", `${layout.rows.length} řad`],
    ["Řezané díly", `${pieceCount} ks`],
    ["Celkový prořez", `${Math.round(waste)} mm (${purchased ? ((waste / purchased) * 100).toFixed(1) : "0.0"} %)`],
    ["Pokrytá šířka", `${Math.round(Math.min(coverageWidth, config.terraceWidth))} mm`],
  ];

  els.summary.innerHTML = items.map(([label, value]) => `<dt>${label}</dt><dd>${value}</dd>`).join("");
}

function renderCutList(config, boards) {
  if (!boards.length) {
    els.cutList.innerHTML = "<p class=\"hint\">Zatím nejsou žádné díly.</p>";
    return;
  }

  els.cutList.innerHTML = boards.map((board, index) => {
    const used = board.cuts.reduce((sum, cut) => sum + cut, 0);
    const cuts = board.cuts.map((cut) => {
      const width = Math.max(2, (cut / config.boardLength) * 100);
      return `<span class="stock-cut" style="width:${width}%" title="${cut} mm"></span>`;
    }).join("");
    const wasteWidth = Math.max(0, (board.remaining / config.boardLength) * 100);
    return `
      <div class="stock-row">
        <strong class="stock-label">Prkno ${index + 1}</strong>
        <div class="stock-plan">
          <div class="stock-bar" aria-label="Prkno ${index + 1}: ${board.cuts.join(" + ")} mm">
            ${cuts}
            <span class="stock-waste" style="width:${wasteWidth}%"></span>
          </div>
          <span class="stock-meta">${board.cuts.join(" + ")} / odpad ${Math.round(board.remaining)} mm</span>
        </div>
      </div>
    `;
  }).join("");
}

function renderWarnings(config, layout) {
  const warnings = [...layout.warnings];
  const maxRowWidth = layout.rows.reduce((sum, row) => sum + row.width, 0)
    + Math.max(0, layout.rows.length - 1) * config.gap;

  if (maxRowWidth > config.terraceWidth + 0.5) {
    warnings.push({
      type: "info",
      text: "Poslední řada je zakreslena jako širší díl, který bude potřeba podélně seříznout.",
    });
  }

  if (config.stagger >= config.boardLength && state.mode === "auto") {
    warnings.push({
      type: "warning",
      text: "Posun spár je větší než délka prkna, proto je ve výpočtu redukovaný modulo délka prkna.",
    });
  }

  if (state.mode === "auto") {
    const recommended = Math.round(config.boardLength / config.patternRows);
    const difference = Math.abs(config.stagger - recommended);
    if (difference > Math.max(25, recommended * 0.08)) {
      warnings.push({
        type: "info",
        text: `Pro pravidelnější vzor zvaž posun kolem ${recommended} mm při ${config.patternRows} řadách ve vzoru.`,
      });
    }
  }

  if (!warnings.length) {
    warnings.push({ type: "info", text: "Návrh je bez zjevných konfliktů podle aktuálních vstupů." });
  }

  els.warnings.innerHTML = warnings.map((warning) => (
    `<li class="is-${warning.type}">${warning.text}</li>`
  )).join("");
}

function updateModeCopy() {
  const isAuto = state.mode === "auto";
  els.viewTitle.textContent = isAuto ? "Automatický návrh" : "Ruční skládání";
  els.viewSubtitle.textContent = isAuto
    ? "Změna vstupu okamžitě přepočítá řezný plán i vizualizaci."
    : "Přetáhni díly ze zásobníku do řad terasy; výsledný počet prken se přepočítá.";
}

function setMode(mode) {
  state.mode = mode;
  const isAuto = mode === "auto";
  els.autoMode.classList.toggle("is-active", isAuto);
  els.manualMode.classList.toggle("is-active", !isAuto);
  els.autoMode.setAttribute("aria-pressed", String(isAuto));
  els.manualMode.setAttribute("aria-pressed", String(!isAuto));
  els.autoPanel.classList.toggle("is-hidden", !isAuto);
  els.manualPanel.classList.toggle("is-hidden", isAuto);
  render();
}

function svgPoint(event) {
  const point = els.svg.createSVGPoint();
  point.x = event.clientX;
  point.y = event.clientY;
  return point.matrixTransform(els.svg.getScreenCTM().inverse());
}

function findPiece(id) {
  return state.manualPieces.find((piece) => piece.id === id);
}

function startDrag(event) {
  if (state.mode !== "manual") return;
  const group = event.target.closest(".manual-piece");
  if (!group) return;
  const piece = findPiece(group.dataset.pieceId);
  if (!piece) return;

  const config = readConfig();
  const pad = Math.max(220, config.terraceLength * 0.08);
  const originX = pad;
  const originY = pad * 0.62;
  const point = svgPoint(event);
  const pieceX = piece.row === null ? piece.x : originX + piece.x;
  const pieceY = piece.row === null ? originY + piece.y : originY + boardRows(config)[piece.row].y;

  state.drag = {
    id: piece.id,
    dx: point.x - pieceX,
    dy: point.y - pieceY,
  };
  els.svg.setPointerCapture(event.pointerId);
  render();
}

function moveDrag(event) {
  if (!state.drag) return;
  const config = readConfig();
  const piece = findPiece(state.drag.id);
  if (!piece) return;

  const point = svgPoint(event);
  const trayX = -config.terraceLength * 0.36;
  const pad = Math.max(220, config.terraceLength * 0.08);
  const originX = pad;
  const originY = pad * 0.62;

  const localDeckX = point.x - originX - state.drag.dx;
  const localDeckY = point.y - originY - state.drag.dy;
  const insideDeck = point.x >= originX
    && point.x <= originX + config.terraceLength
    && point.y >= originY
    && point.y <= originY + config.terraceWidth;

  if (insideDeck) {
    const rows = boardRows(config);
    const nearest = rows.reduce((best, row) => {
      const distance = Math.abs(localDeckY - row.y);
      return distance < best.distance ? { row, distance } : best;
    }, { row: rows[0], distance: Infinity }).row;

    piece.row = nearest.index;
    piece.x = Math.max(0, Math.min(config.terraceLength - piece.length, localDeckX));
  } else {
    piece.row = null;
    piece.x = trayX;
    piece.y = Math.max(0, point.y - originY - state.drag.dy);
  }

  render();
}

function endDrag(event) {
  if (!state.drag) return;
  try {
    els.svg.releasePointerCapture(event.pointerId);
  } catch {
    // Pointer capture may already be released by the browser.
  }
  state.drag = null;
  render();
}

function resetManual() {
  ensureManualPieces(readConfig(), true);
  render();
}

Object.values(inputs).forEach((input) => {
  input.addEventListener("input", () => {
    if (input === inputs.manualCuts) state.lastManualSignature = "";
    render();
  });
});

els.autoMode.addEventListener("click", () => setMode("auto"));
els.manualMode.addEventListener("click", () => setMode("manual"));
els.resetManual.addEventListener("click", resetManual);
els.svg.addEventListener("pointerdown", startDrag);
els.svg.addEventListener("pointermove", moveDrag);
els.svg.addEventListener("pointerup", endDrag);
els.svg.addEventListener("pointercancel", endDrag);

setupTooltips();
render();
