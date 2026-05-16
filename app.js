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
  boardTooltip: qs("#boardTooltip"),
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
  const staggerChoice = chooseAutoStagger(config, rows.length, maxOffset);

  if (staggerChoice.error) {
    return {
      rows,
      pieces,
      packed: [],
      warnings: [{ type: "danger", text: staggerChoice.error }],
      invalidPattern: true,
      effectiveStagger: 0,
    };
  }

  if (staggerChoice.warning) {
    warnings.push({ type: "warning", text: staggerChoice.warning });
  }

  rows.forEach((row) => {
    const patternIndex = row.index % config.patternRows;
    const rawOffset = patternIndex * staggerChoice.stagger;
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
  return { rows, pieces, packed, warnings, effectiveStagger: staggerChoice.stagger };
}

function chooseAutoStagger(config, rowCount, maxOffset) {
  if (rowCount <= 1) {
    return { stagger: 0 };
  }

  if (config.patternRows <= 1) {
    return {
      error: "Opakování vzoru po 1 řadě by vždy vytvořilo stejné sousední řady. Zvol alespoň 2 řady ve vzoru.",
    };
  }

  const requested = Math.min(config.stagger, maxOffset);
  const recommended = Math.min(config.boardLength / config.patternRows, maxOffset);
  const candidates = [];

  if (requested > 0) candidates.push({ value: requested, source: "requested" });
  if (recommended > 0 && Math.abs(recommended - requested) > 0.5) {
    candidates.push({ value: recommended, source: "recommended" });
  }

  for (const candidate of candidates) {
    if (!hasAdjacentDuplicatePattern(config, rowCount, candidate.value)) {
      if (candidate.source === "recommended" && requested > 0) {
        return {
          stagger: candidate.value,
          warning: `Zadaný posun ${Math.round(requested)} mm vytvářel stejné sousední řady, proto byl pro návrh použit pravidelný posun ${Math.round(candidate.value)} mm.`,
        };
      }
      return { stagger: candidate.value };
    }
  }

  return {
    error: "Pro aktuální délku prkna, minimální odřezek a počet řad ve vzoru nejde vytvořit návrh bez stejných sousedních řad. Změň opakování vzoru nebo posun spár.",
  };
}

function hasAdjacentDuplicatePattern(config, rowCount, stagger) {
  const patterns = Array.from({ length: rowCount }, (_, rowIndex) => {
    const offset = ((rowIndex % config.patternRows) * stagger) % config.boardLength;
    return seamPattern(config, offset);
  });

  return patterns.some((pattern, index) => {
    if (index === 0) return false;
    return patternsEqual(patterns[index - 1], pattern);
  });
}

function seamPattern(config, offset) {
  const seams = [];
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

    x += length;
    if (x < config.terraceLength - 0.5) seams.push(Math.round(x));
  }

  return seams;
}

function patternsEqual(left, right) {
  const tolerance = 35;
  if (left.length !== right.length) return false;
  return left.every((value, index) => Math.abs(value - right[index]) <= tolerance);
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

function boardTooltipAttrs(piece, width, rowLabel, position) {
  return {
    "data-board-tooltip": "true",
    "data-board-length": Math.round(piece.length),
    "data-board-width": Math.round(width),
    "data-board-x": position ? Math.round(position.x) : "",
    "data-board-y": position ? Math.round(position.y) : "",
    "data-board-row": rowLabel || "",
  };
}

function clearSvg() {
  while (els.svg.firstChild) els.svg.firstChild.remove();
}

function render() {
  hideBoardTooltip();
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
  const rightDimensionPad = Math.max(pad, 780);
  const viewWidth = config.terraceLength + pad + rightDimensionPad + trayWidth;
  const viewHeight = config.terraceWidth + pad * 1.6;
  const originX = pad;
  const originY = pad * 0.62;

  els.svg.setAttribute("viewBox", `${-trayWidth} 0 ${viewWidth} ${viewHeight}`);
  renderDimensionDefs();

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

function renderDimensionDefs() {
  const defs = svgEl("defs");
  const marker = svgEl("marker", {
    id: "dimensionArrow",
    viewBox: "0 0 10 10",
    refX: 5,
    refY: 5,
    markerWidth: 7,
    markerHeight: 7,
    orient: "auto-start-reverse",
  });
  marker.appendChild(svgEl("path", {
    d: "M 0 0 L 10 5 L 0 10 z",
    class: "dimension-arrow",
  }));
  defs.appendChild(marker);
  els.svg.appendChild(defs);
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
    ...boardTooltipAttrs(piece, piece.width, piece.row + 1, {
      x: piece.x,
      y: piece.y,
    }),
    x: originX + piece.x,
    y: originY + piece.y,
    width: piece.length,
    height: piece.width,
    rx: 5,
  }));

  if (piece.x > 0) {
    els.svg.appendChild(svgEl("line", {
      class: "seam-halo",
      x1: originX + piece.x,
      y1: originY + piece.y + 6,
      x2: originX + piece.x,
      y2: originY + piece.y + piece.width - 6,
    }));
    els.svg.appendChild(svgEl("line", {
      class: "seam-line",
      x1: originX + piece.x,
      y1: originY + piece.y + 6,
      x2: originX + piece.x,
      y2: originY + piece.y + piece.width - 6,
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
  const rows = boardRows(config);
  const rowY = piece.row === null
    ? originY + piece.y
    : originY + rows[piece.row].y;
  const x = piece.row === null ? piece.x : originX + piece.x;
  const width = piece.length;
  const height = piece.row === null ? config.boardWidth : rows[piece.row].width;
  const position = piece.row === null ? null : {
    x: piece.x,
    y: rows[piece.row].y,
  };

  const group = svgEl("g", {
    class: `manual-piece${state.drag?.id === piece.id ? " is-dragging" : ""}`,
    "data-piece-id": piece.id,
  });
  group.appendChild(svgEl("rect", {
    class: "board-piece",
    ...boardTooltipAttrs(piece, height, piece.row === null ? "" : piece.row + 1, position),
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

function boardTooltipTarget(event) {
  if (state.drag) return null;
  return event.target.closest?.("[data-board-tooltip]");
}

function showBoardTooltip(event) {
  const target = boardTooltipTarget(event);
  if (!target) {
    hideBoardTooltip();
    return;
  }

  renderBoardTooltipContent(target);
  els.boardTooltip.classList.add("is-visible");
  moveBoardTooltip(event);
}

function renderBoardTooltipContent(target) {
  const rows = [
    ["Rozměr", `${target.dataset.boardLength} × ${target.dataset.boardWidth} mm`],
    ["Pozice", target.dataset.boardX === "" ? "mimo terasu" : `[${target.dataset.boardX};${target.dataset.boardY}]`],
  ];

  if (target.dataset.boardRow) {
    rows.push(["Řada", target.dataset.boardRow]);
  }

  els.boardTooltip.replaceChildren(...rows.map(([label, value]) => {
    const row = document.createElement("div");
    row.className = "board-tooltip-row";

    const labelNode = document.createElement("span");
    labelNode.className = "board-tooltip-label";
    labelNode.textContent = label;

    const valueNode = document.createElement("strong");
    valueNode.className = "board-tooltip-value";
    valueNode.textContent = value;

    row.append(labelNode, valueNode);
    return row;
  }));
}

function moveBoardTooltip(event) {
  if (!els.boardTooltip.classList.contains("is-visible")) return;
  const offset = 14;
  const tooltipRect = els.boardTooltip.getBoundingClientRect();
  const viewportPadding = 12;
  let left = event.clientX + offset;
  let top = event.clientY + offset;

  if (left + tooltipRect.width + viewportPadding > window.innerWidth) {
    left = event.clientX - tooltipRect.width - offset;
  }

  if (top + tooltipRect.height + viewportPadding > window.innerHeight) {
    top = event.clientY - tooltipRect.height - offset;
  }

  els.boardTooltip.style.left = `${Math.max(viewportPadding, left)}px`;
  els.boardTooltip.style.top = `${Math.max(viewportPadding, top)}px`;
}

function hideBoardTooltip() {
  els.boardTooltip.classList.remove("is-visible");
}

function renderDimensions(config, originX, originY) {
  const group = svgEl("g", { class: "dimension-layer" });
  els.svg.appendChild(group);

  const bottomY = originY + config.terraceWidth + 170;
  const leftX = originX - 72;
  const rightX = originX + config.terraceLength + 62;
  const topY = originY;
  const deckBottomY = originY + config.terraceWidth;

  appendDimensionLine(group, {
    x1: originX,
    y1: bottomY,
    x2: originX + config.terraceLength,
    y2: bottomY,
    label: `${Math.round(config.terraceLength)} mm`,
    labelX: originX + config.terraceLength / 2,
    labelY: bottomY - 48,
  });
  appendExtensionLine(group, originX, deckBottomY, originX, bottomY + 18);
  appendExtensionLine(group, originX + config.terraceLength, deckBottomY, originX + config.terraceLength, bottomY + 18);

  appendDimensionLine(group, {
    x1: leftX,
    y1: topY,
    x2: leftX,
    y2: deckBottomY,
    label: `${Math.round(config.terraceWidth)} mm`,
    labelX: leftX - 42,
    labelY: originY + config.terraceWidth / 2,
    rotate: -90,
  });
  appendExtensionLine(group, leftX - 18, topY, originX, topY);
  appendExtensionLine(group, leftX - 18, deckBottomY, originX, deckBottomY);

  appendDimensionLine(group, {
    x1: rightX,
    y1: originY,
    x2: rightX,
    y2: originY + config.boardWidth,
    label: `prkno ${Math.round(config.boardWidth)} mm`,
    labelX: rightX + 42,
    labelY: originY + config.boardWidth / 2 + 14,
    anchor: "start",
    className: "dimension-label dimension-detail-label",
  });
  appendExtensionLine(group, originX + config.terraceLength, originY, rightX + 14, originY);
  appendExtensionLine(group, originX + config.terraceLength, originY + config.boardWidth, rightX + 14, originY + config.boardWidth);

  if (config.gap > 0) {
    const gapTop = originY + config.boardWidth;
    const gapCenter = gapTop + config.gap / 2;
    group.appendChild(svgEl("line", {
      class: "dimension-extension",
      x1: originX + config.terraceLength,
      y1: gapCenter,
      x2: rightX + 10,
      y2: gapCenter,
    }));
    group.appendChild(svgEl("circle", {
      class: "dimension-point",
      cx: originX + config.terraceLength,
      cy: gapCenter,
      r: 5,
    }));
    appendDimensionText(group, {
      label: `mezera ${Math.round(config.gap)} mm`,
      x: rightX + 42,
      y: gapCenter + 14,
      anchor: "start",
      className: "dimension-label dimension-detail-label",
    });
  }
}

function appendDimensionLine(parent, options) {
  parent.appendChild(svgEl("line", {
    class: "dimension-line",
    x1: options.x1,
    y1: options.y1,
    x2: options.x2,
    y2: options.y2,
    "marker-start": "url(#dimensionArrow)",
    "marker-end": "url(#dimensionArrow)",
  }));
  appendDimensionText(parent, {
    label: options.label,
    x: options.labelX,
    y: options.labelY,
    rotate: options.rotate,
    anchor: options.anchor,
    className: options.className,
  });
}

function appendDimensionText(parent, options) {
  const attrs = {
    class: options.className || "dimension-label",
    x: options.x,
    y: options.y,
    "text-anchor": "middle",
  };

  if (options.anchor) attrs["text-anchor"] = options.anchor;
  if (options.rotate) {
    attrs.transform = `rotate(${options.rotate} ${options.x} ${options.y})`;
  }

  const text = svgEl("text", attrs);
  text.textContent = options.label;
  parent.appendChild(text);
}

function appendExtensionLine(parent, x1, y1, x2, y2) {
  parent.appendChild(svgEl("line", {
    class: "dimension-extension",
    x1,
    y1,
    x2,
    y2,
  }));
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
    ["Celkový odpad", `${Math.round(waste)} mm (${purchased ? ((waste / purchased) * 100).toFixed(1) : "0.0"} %)`],
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

  if (state.mode === "auto" && !layout.invalidPattern) {
    const recommended = Math.round(config.boardLength / config.patternRows);
    const activeStagger = Math.round(layout.effectiveStagger ?? config.stagger);
    const difference = Math.abs(activeStagger - recommended);
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
els.svg.addEventListener("pointerover", showBoardTooltip);
els.svg.addEventListener("pointermove", moveBoardTooltip);
els.svg.addEventListener("pointerout", (event) => {
  if (!event.relatedTarget || !event.relatedTarget.closest?.("[data-board-tooltip]")) {
    hideBoardTooltip();
  }
});
els.svg.addEventListener("pointerleave", hideBoardTooltip);
els.svg.addEventListener("mouseover", showBoardTooltip);
els.svg.addEventListener("mousemove", moveBoardTooltip);
els.svg.addEventListener("click", showBoardTooltip);
els.svg.addEventListener("mouseout", (event) => {
  if (!event.relatedTarget || !event.relatedTarget.closest?.("[data-board-tooltip]")) {
    hideBoardTooltip();
  }
});
els.svg.addEventListener("mouseleave", hideBoardTooltip);
els.svg.addEventListener("pointerup", endDrag);
els.svg.addEventListener("pointercancel", endDrag);

setupTooltips();
render();
