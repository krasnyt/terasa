"use strict";

const qs = (selector) => document.querySelector(selector);
const svgNS = "http://www.w3.org/2000/svg";

const DEFAULTS = {
  terraceLength: 5000,
  terraceWidth: 2150,
  boardLength: 2300,
  boardWidth: 178,
  gap: 6,
  minOffcut: 250,
  patternRows: 3,
  joistEdgeOffset: 200,
};

const STORAGE_KEY = "terasa-navrh";

const inputs = {
  terraceLength: qs("#terraceLength"),
  terraceWidth: qs("#terraceWidth"),
  boardLength: qs("#boardLength"),
  boardWidth: qs("#boardWidth"),
  gap: qs("#gap"),
  minOffcut: qs("#minOffcut"),
  patternRows: qs("#patternRows"),
  joistEdgeOffset: qs("#joistEdgeOffset"),
};

const els = {
  svg: qs("#deckSvg"),
  summary: qs("#summary"),
  cutList: qs("#cutList"),
  warnings: qs("#warnings"),
  boardTooltip: qs("#boardTooltip"),
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

function loadConfig() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    return { ...DEFAULTS, ...saved };
  } catch {
    return { ...DEFAULTS };
  }
}

function applyConfig(config) {
  inputs.terraceLength.value = config.terraceLength;
  inputs.terraceWidth.value = config.terraceWidth;
  inputs.boardLength.value = config.boardLength;
  inputs.boardWidth.value = config.boardWidth;
  inputs.gap.value = config.gap;
  inputs.minOffcut.value = config.minOffcut;
  inputs.patternRows.value = config.patternRows;
  inputs.joistEdgeOffset.value = config.joistEdgeOffset;
}

let saveTimer = null;

function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(readConfig()));
    } catch {
      // localStorage nedostupný (soukromé prohlížení apod.)
    }
  }, 5000);
}

function readConfig() {
  return {
    terraceLength: numberValue(inputs.terraceLength, DEFAULTS.terraceLength),
    terraceWidth: numberValue(inputs.terraceWidth, DEFAULTS.terraceWidth),
    boardLength: numberValue(inputs.boardLength, DEFAULTS.boardLength),
    boardWidth: numberValue(inputs.boardWidth, DEFAULTS.boardWidth),
    gap: Math.max(0, Number(inputs.gap.value) || 0),
    minOffcut: Math.max(0, Number(inputs.minOffcut.value) || 0),
    patternRows: Math.max(1, Math.round(numberValue(inputs.patternRows, DEFAULTS.patternRows))),
    joistEdgeOffset: Math.max(0, Number(inputs.joistEdgeOffset.value) || 0),
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

function fullLastBoardInfo(config, rows) {
  const lastRow = rows.at(-1);
  if (!lastRow) return null;

  const extension = config.boardWidth - lastRow.width;
  if (extension <= 0.5) return null;

  return {
    extension,
    fullWidth: lastRow.y + config.boardWidth,
    currentLastWidth: lastRow.width,
  };
}

function buildRowLengths(config, patternIndex, stagger) {
  if (config.terraceLength < config.minOffcut - 0.5) {
    return { error: `Délka terasy ${Math.round(config.terraceLength)} mm je menší než minimální odřezek ${Math.round(config.minOffcut)} mm.` };
  }

  if (config.terraceLength <= config.boardLength + 0.5) {
    return { lengths: [config.terraceLength] };
  }

  const offset = patternIndex * stagger;
  const firstLength = offset > 0 ? config.boardLength - offset : config.boardLength;
  const lengths = [firstLength];
  let placed = firstLength;

  while (config.terraceLength - placed > config.boardLength + 0.5) {
    lengths.push(config.boardLength);
    placed += config.boardLength;
  }

  let remainder = config.terraceLength - placed;
  if (remainder > 0.5) {
    if (remainder < config.minOffcut - 0.5) {
      const shortage = config.minOffcut - remainder;
      const prev = lengths[lengths.length - 1];
      if (prev - shortage >= config.minOffcut - 0.5) {
        lengths[lengths.length - 1] = prev - shortage;
        remainder = config.minOffcut;
      }
    }
    lengths.push(remainder);
  }

  return { lengths };
}

function createAutoLayout(config) {
  const rows = boardRows(config);
  const pieces = [];

  if (rows.length > 1 && config.patternRows < 2) {
    return {
      rows,
      pieces,
      packed: [],
      warnings: [{ type: "danger", text: "Opakování vzoru musí být alespoň 2 řady, jinak by všechny řady měly stejné spáry." }],
      invalidPattern: true,
    };
  }

  const stagger = rows.length > 1 ? config.boardLength / config.patternRows : 0;

  if (rows.length > 1 && stagger < config.minOffcut - 0.5) {
    return {
      rows,
      pieces,
      packed: [],
      warnings: [{
        type: "danger",
        text: `Při ${config.patternRows} řadách ve vzoru by posun spár vyšel na ${Math.round(stagger)} mm, což je méně než minimální odřezek ${Math.round(config.minOffcut)} mm. Sniž opakování vzoru, zvětši délku prkna nebo sniž minimální odřezek.`,
      }],
      invalidPattern: true,
    };
  }

  for (const row of rows) {
    const patternIndex = row.index % config.patternRows;
    const result = buildRowLengths(config, patternIndex, stagger);

    if (result.error) {
      return {
        rows,
        pieces: [],
        packed: [],
        warnings: [{ type: "danger", text: result.error }],
        invalidPattern: true,
      };
    }

    for (const length of result.lengths) {
      if (length < config.minOffcut - 0.5) {
        return {
          rows,
          pieces: [],
          packed: [],
          warnings: [{
            type: "danger",
            text: `Ve vzoru by vznikl díl o délce ${Math.round(length)} mm, což je méně než minimální odřezek ${Math.round(config.minOffcut)} mm. Uprav délku terasy, délku prkna, opakování vzoru nebo minimální odřezek.`,
          }],
          invalidPattern: true,
        };
      }
    }

    let x = 0;
    result.lengths.forEach((length) => {
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
    });
  }

  const packed = packBoards(pieces.map((piece) => piece.length), config.boardLength);
  return { rows, pieces, packed, warnings: [], stagger };
}

function computeJoistPositions(config, pieces) {
  const seamSet = new Set();
  pieces.forEach((piece) => {
    if (piece.x > 0.5) seamSet.add(Math.round(piece.x));
  });

  const half = Math.round(config.terraceLength / 2);
  const leftEdge = Math.min(config.joistEdgeOffset, half);
  const rightEdge = Math.max(config.terraceLength - config.joistEdgeOffset, leftEdge + 1);
  const all = new Set([leftEdge, ...seamSet, rightEdge]);
  return Array.from(all).sort((a, b) => a - b);
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
  const layout = createAutoLayout(config);

  if (layout.invalidPattern) {
    clearSvg();
    els.summary.innerHTML = "";
    els.cutList.innerHTML = "<p class=\"hint\">Návrh nelze sestavit, dokud se nevyřeší chyby v poznámkách.</p>";
    renderWarnings(config, layout);
    return;
  }

  const joistPositions = computeJoistPositions(config, layout.pieces);
  renderSvg(config, layout, joistPositions);
  renderSummary(config, layout, joistPositions);
  renderCutList(config, layout.packed);
  renderWarnings(config, layout);
}

function renderSvg(config, layout, joistPositions) {
  clearSvg();
  const pad = Math.max(220, config.terraceLength * 0.08);
  const rightDimensionPad = Math.max(pad, 780);
  const viewWidth = config.terraceLength + pad + rightDimensionPad;
  const viewHeight = config.terraceWidth + pad * 1.6;
  const originX = pad;
  const originY = pad * 0.62;

  els.svg.setAttribute("viewBox", `0 0 ${viewWidth} ${viewHeight}`);
  renderDimensionDefs();

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

  renderJoists(config, joistPositions, originX, originY);
  layout.pieces.forEach((piece) => renderAutoPiece(piece, originX, originY));
  renderFullLastBoardExtension(config, layout, originX, originY);
  renderDimensions(config, originX, originY);
}

function renderJoists(config, joistPositions, originX, originY) {
  const group = svgEl("g", { class: "joist-layer" });
  els.svg.appendChild(group);

  const tickTop = originY - 28;
  const dimLineY = originY - 72;
  const dimLabelY = originY - 96;

  const edgeLeft = originX;
  const edgeRight = originX + config.terraceLength;

  const drawTick = (svgX) => {
    group.appendChild(svgEl("line", {
      class: "joist-tick",
      x1: svgX,
      y1: tickTop,
      x2: svgX,
      y2: originY,
    }));
  };

  const drawSpanDim = (fromX, toX) => {
    const midX = (fromX + toX) / 2;
    group.appendChild(svgEl("line", {
      class: "dimension-line joist-dim-line",
      x1: fromX,
      y1: dimLineY,
      x2: toX,
      y2: dimLineY,
      "marker-start": "url(#dimensionArrow)",
      "marker-end": "url(#dimensionArrow)",
    }));
    appendDimensionText(group, {
      label: `${Math.round(toX - fromX)} mm`,
      x: midX,
      y: dimLabelY,
      className: "dimension-label dimension-detail-label",
    });
  };

  // Tick + kóta na levém kraji terasy → první hranol
  drawTick(edgeLeft);
  drawSpanDim(edgeLeft, originX + joistPositions[0]);

  joistPositions.forEach((x, i) => {
    const svgX = originX + x;

    group.appendChild(svgEl("line", {
      class: "joist-line",
      x1: svgX,
      y1: originY,
      x2: svgX,
      y2: originY + config.terraceWidth,
    }));

    drawTick(svgX);

    if (i > 0) {
      drawSpanDim(originX + joistPositions[i - 1], svgX);
    }
  });

  // Kóta od posledního hranolu → pravý kraj terasy
  drawSpanDim(originX + joistPositions[joistPositions.length - 1], edgeRight);
  drawTick(edgeRight);
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

function renderFullLastBoardExtension(config, layout, originX, originY) {
  const info = fullLastBoardInfo(config, layout.rows);
  if (!info) return;

  const deckBottomY = originY + config.terraceWidth;
  const fullBottomY = originY + info.fullWidth;
  const rightX = originX + config.terraceLength + 96;

  els.svg.appendChild(svgEl("rect", {
    class: "full-board-extension",
    x: originX,
    y: deckBottomY,
    width: config.terraceLength,
    height: info.extension,
  }));
  els.svg.appendChild(svgEl("line", {
    class: "full-board-extension-edge",
    x1: originX,
    y1: fullBottomY,
    x2: originX + config.terraceLength,
    y2: fullBottomY,
  }));
  els.svg.appendChild(svgEl("line", {
    class: "full-board-extension-bracket",
    x1: rightX,
    y1: deckBottomY,
    x2: rightX,
    y2: fullBottomY,
    "marker-start": "url(#dimensionArrow)",
    "marker-end": "url(#dimensionArrow)",
  }));

  const labelX = rightX + 42;
  const labelY = deckBottomY + info.extension / 2 - 20;
  const label = svgEl("text", {
    class: "dimension-label dimension-detail-label full-board-extension-label",
    x: labelX,
    y: labelY,
    "text-anchor": "start",
  });
  const line1 = svgEl("tspan", { x: labelX, dy: "0" });
  line1.textContent = "bez podélného řezu";
  const line2 = svgEl("tspan", { x: labelX, dy: "68" });
  line2.textContent = `+${Math.round(info.extension)} mm`;
  label.append(line1, line2);
  els.svg.appendChild(label);
}

function boardTooltipTarget(event) {
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

function renderSummary(config, layout, joistPositions) {
  const pieceCount = layout.pieces.length;
  const used = layout.packed.reduce((sum, board) => sum + board.cuts.reduce((inner, cut) => inner + cut, 0), 0);
  const purchased = layout.packed.length * config.boardLength;
  const waste = Math.max(0, purchased - used);
  const coverageWidth = layout.rows.reduce((sum, row) => sum + row.width, 0) + Math.max(0, layout.rows.length - 1) * config.gap;

  const items = [
    ["Skladová prkna", `${layout.packed.length} ks`],
    ["Položené řady", `${layout.rows.length} řad`],
    ["Řezané díly", `${pieceCount} ks`],
    ["Podkladní hranoly", `${joistPositions.length} ks / ${((joistPositions.length * config.terraceWidth) / 1000).toFixed(2)} m`],
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

  if (!layout.invalidPattern) {
    const maxRowWidth = layout.rows.reduce((sum, row) => sum + row.width, 0)
      + Math.max(0, layout.rows.length - 1) * config.gap;

    if (maxRowWidth > config.terraceWidth + 0.5) {
      warnings.push({
        type: "info",
        text: "Poslední řada je zakreslena jako širší díl, který bude potřeba podélně seříznout.",
      });
    }

    const fullBoardInfo = fullLastBoardInfo(config, layout.rows);
    if (fullBoardInfo) {
      warnings.push({
        type: "info",
        text: `Poslední řada má šířku ${Math.round(fullBoardInfo.currentLastWidth)} mm. Bez podélného řezu by terasa měla šířku ${Math.round(fullBoardInfo.fullWidth)} mm (+${Math.round(fullBoardInfo.extension)} mm).`,
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

Object.values(inputs).forEach((input) => {
  input.addEventListener("input", () => {
    scheduleSave();
    render();
  });
});

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

applyConfig(loadConfig());
setupTooltips();
render();
