"use strict";

import {
  boardRows,
  computeJoistLayout,
  computePedestalLayout,
  computeRowCoverage,
  cutoutYRange,
  fullLastBoardInfo,
  JOIST_BOARD_END_INSET,
} from "./layout.js?v=5";

const svgNS = "http://www.w3.org/2000/svg";

export function svgEl(name, attrs = {}) {
  const element = document.createElementNS(svgNS, name);
  Object.entries(attrs).forEach(([key, value]) => {
    element.setAttribute(key, String(value));
  });
  return element;
}

export function createRenderer({ els, state, svgOrigin }) {
  function clearSvg() {
    while (els.svg.firstChild) els.svg.firstChild.remove();
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
    const cutoutPattern = svgEl("pattern", {
      id: "cutoutHatch",
      width: 42,
      height: 42,
      patternUnits: "userSpaceOnUse",
      patternTransform: "rotate(45)",
    });
    cutoutPattern.appendChild(svgEl("line", {
      class: "cutout-hatch-line",
      x1: 0,
      y1: 0,
      x2: 0,
      y2: 42,
    }));
    defs.appendChild(cutoutPattern);
    els.svg.appendChild(defs);
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

  function appendExtensionLine(parent, x1, y1, x2, y2) {
    parent.appendChild(svgEl("line", {
      class: "dimension-extension",
      x1,
      y1,
      x2,
      y2,
    }));
  }

  function asJoistLayout(config, piecesOrLayout, maybeCutouts, maybeExtraPositions) {
    if (piecesOrLayout && Array.isArray(piecesOrLayout.positions) && Array.isArray(piecesOrLayout.joists)) return piecesOrLayout;
    return computeJoistLayout(config, piecesOrLayout || [], maybeCutouts || [], maybeExtraPositions || []);
  }

  function joistCoversY(joist, y, tol) {
    return joist.segments.some((segment) => y >= segment.y1 - tol && y <= segment.y2 + tol);
  }

  function renderJoists(config, joistLayout, originX, originY) {
    const group = svgEl("g", { class: "joist-layer" });
    els.svg.appendChild(group);
    const joistPositions = joistLayout.positions;
    if (!joistPositions.length) return;

    const topCutoutDepth = joistLayout.cutouts
      .filter((cutout) => cutout.edge === "top")
      .reduce((max, cutout) => Math.max(max, cutout.depth), 0);
    const tickTop = originY - topCutoutDepth - 28;
    const dimLineY = originY - topCutoutDepth - 72;
    const dimLabelY = originY - topCutoutDepth - 96;
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

    drawTick(edgeLeft);
    drawSpanDim(edgeLeft, originX + joistPositions[0]);

    joistLayout.joists.forEach((joist, i) => {
      const x = joist.x;
      const svgX = originX + x;

      joist.segments.forEach((segment) => {
        group.appendChild(svgEl("line", {
          class: "joist-line",
          x1: svgX,
          y1: originY + segment.y1,
          x2: svgX,
          y2: originY + segment.y2,
        }));
      });

      drawTick(svgX);

      if (i > 0) {
        drawSpanDim(originX + joistPositions[i - 1], svgX);
      }
    });

    drawSpanDim(originX + joistPositions[joistPositions.length - 1], edgeRight);
    drawTick(edgeRight);
  }

  function renderPedestals(config, joistLayout, originX, originY) {
    const pedestalLayout = computePedestalLayout(config, joistLayout);
    if (!pedestalLayout.count) return;

    const group = svgEl("g", { class: "pedestal-layer" });
    els.svg.appendChild(group);

    pedestalLayout.pedestals.forEach((pedestal) => {
      const cx = originX + pedestal.x;
      const cy = originY + pedestal.y;
      group.appendChild(svgEl("circle", {
        class: "pedestal-dot",
        cx,
        cy,
        r: 24,
      }));
      group.appendChild(svgEl("line", {
        class: "pedestal-mark",
        x1: cx - 16,
        y1: cy,
        x2: cx + 16,
        y2: cy,
      }));
      group.appendChild(svgEl("line", {
        class: "pedestal-mark",
        x1: cx,
        y1: cy - 16,
        x2: cx,
        y2: cy + 16,
      }));
    });
  }

  function renderCutouts(config, cutouts, originX, originY) {
    if (!cutouts.length) return;
    const group = svgEl("g", { class: "cutout-layer" });
    els.svg.appendChild(group);

    cutouts.forEach((cutout) => {
      const range = cutoutYRange(cutout, config);
      const rectX = originX + cutout.x;
      const rectY = originY + range.y1;
      const rectW = cutout.width;
      const rectH = range.y2 - range.y1;
      group.appendChild(svgEl("rect", {
        class: "cutout-fill",
        x: rectX,
        y: rectY,
        width: rectW,
        height: rectH,
      }));
      group.appendChild(svgEl("rect", {
        class: "cutout-hatch",
        x: rectX,
        y: rectY,
        width: rectW,
        height: rectH,
      }));
      const label = svgEl("text", {
        class: "cutout-label",
        x: rectX + rectW / 2,
        y: rectY + rectH / 2 + 18,
        "text-anchor": "middle",
      });
      label.textContent = `${cutout.label} ${Math.round(cutout.width)} × ${Math.round(cutout.depth)} mm`;
      group.appendChild(label);
    });
  }

  function renderSeamMarker(piece, originX, originY) {
    if (piece.x <= 0.5) return;

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

    renderSeamMarker(piece, originX, originY);
  }

  function renderManualPiece(piece, config, originX, originY) {
    const overflowLeft = Math.max(0, -piece.x);
    const overflowRight = Math.max(0, piece.x + piece.length - config.terraceLength);
    const isOverflow = overflowLeft > 0.5 || overflowRight > 0.5;

    els.svg.appendChild(svgEl("rect", {
      class: `board-piece pattern-row-${piece.patternIndex % 4}${isOverflow ? " is-overflow" : ""}`,
      "data-manual-piece-id": piece.id,
      ...boardTooltipAttrs(piece, piece.width, piece.row + 1, { x: piece.x, y: piece.y }),
      x: originX + piece.x,
      y: originY + piece.y,
      width: piece.length,
      height: piece.width,
      rx: 5,
    }));

    renderSeamMarker(piece, originX, originY);

    if (overflowLeft > 0.5) {
      els.svg.appendChild(svgEl("rect", {
        class: "board-overflow-overlay",
        x: originX + piece.x,
        y: originY + piece.y,
        width: overflowLeft,
        height: piece.width,
      }));
      const t = svgEl("text", {
        class: "board-overflow-label",
        x: originX + piece.x + overflowLeft / 2,
        y: originY + piece.y + piece.width / 2,
        "text-anchor": "middle",
        "dominant-baseline": "central",
      });
      t.textContent = `−${Math.round(overflowLeft)} mm`;
      els.svg.appendChild(t);
    }

    if (overflowRight > 0.5) {
      const ox = originX + config.terraceLength;
      els.svg.appendChild(svgEl("rect", {
        class: "board-overflow-overlay",
        x: ox,
        y: originY + piece.y,
        width: overflowRight,
        height: piece.width,
      }));
      const t = svgEl("text", {
        class: "board-overflow-label",
        x: ox + overflowRight / 2,
        y: originY + piece.y + piece.width / 2,
        "text-anchor": "middle",
        "dominant-baseline": "central",
      });
      t.textContent = `+${Math.round(overflowRight)} mm`;
      els.svg.appendChild(t);
    }
  }

  function renderScrewDots(pieces, joistLayout, config, originX, originY) {
    const group = svgEl("g", { class: "screw-layer" });
    els.svg.appendChild(group);
    const edgeInset = JOIST_BOARD_END_INSET;
    const tol = config.gap + 0.5;
    for (const p of pieces) {
      const widthInset = Math.max(18, p.width * 0.15);
      const yTop = originY + p.y + widthInset;
      const yBot = originY + p.y + p.width - widthInset;
      const left = p.x;
      const right = p.x + p.length;
      for (const joist of joistLayout.joists) {
        const jx = joist.x;
        if (jx < left - tol || jx > right + tol) continue;
        let cx;
        if (jx <= left + edgeInset + 0.5) {
          cx = originX + left + edgeInset;
        } else if (jx >= right - edgeInset - 0.5) {
          cx = originX + right - edgeInset;
        } else {
          cx = originX + jx;
        }
        if (joistCoversY(joist, p.y + widthInset, tol)) {
          group.appendChild(svgEl("circle", { class: "screw-dot", cx, cy: yTop, r: 6 }));
        }
        if (joistCoversY(joist, p.y + p.width - widthInset, tol)) {
          group.appendChild(svgEl("circle", { class: "screw-dot", cx, cy: yBot, r: 6 }));
        }
      }
    }
  }

  function renderRowCoverage(config, rows, pieces, originX, originY) {
    const group = svgEl("g", { class: "row-coverage-layer" });
    els.svg.appendChild(group);
    const x = originX + config.terraceLength + 540;
    rows.forEach((row) => {
      const cov = computeRowCoverage(row.index, pieces, config);
      const y = originY + row.y + row.width / 2 + 18;
      let text;
      let cls;
      if (cov.status === "ok") { text = "✓ celá"; cls = "row-coverage-ok"; }
      else if (cov.status === "over") { text = `+${Math.round(cov.diff)} mm`; cls = "row-coverage-over"; }
      else if (cov.status === "empty") { text = "prázdná"; cls = "row-coverage-empty"; }
      else { text = `−${Math.round(cov.diff)} mm`; cls = "row-coverage-short"; }
      const t = svgEl("text", {
        class: `row-coverage-label ${cls}`,
        x,
        y,
        "text-anchor": "start",
      });
      t.textContent = text;
      group.appendChild(t);
    });
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

  function prepareSvg(config) {
    clearSvg();
    const cutouts = state.cutouts || [];
    const topCutoutDepth = cutouts
      .filter((cutout) => cutout.edge !== "bottom")
      .reduce((max, cutout) => Math.max(max, Number(cutout.depth) || 0), 0);
    const bottomCutoutDepth = cutouts
      .filter((cutout) => cutout.edge === "bottom")
      .reduce((max, cutout) => Math.max(max, Number(cutout.depth) || 0), 0);
    const pad = Math.max(220, config.terraceLength * 0.08);
    const topPad = Math.max(180, pad * 0.4, topCutoutDepth + 160);
    const bottomPad = Math.max(240, pad * 0.45, config.boardWidth + 90, bottomCutoutDepth + 240);
    const rightDimensionPad = Math.max(pad, 780);
    const viewWidth = config.terraceLength + pad + rightDimensionPad;
    const viewHeight = config.terraceWidth + topPad + bottomPad;
    const originX = pad;
    const originY = topPad;
    svgOrigin.x = originX;
    svgOrigin.y = originY;

    els.svg.setAttribute("viewBox", `0 0 ${viewWidth} ${viewHeight}`);
    els.svg.style.aspectRatio = `${viewWidth} / ${viewHeight}`;
    renderDimensionDefs();

    els.svg.appendChild(svgEl("rect", {
      class: "deck-outline",
      x: originX,
      y: originY,
      width: config.terraceLength,
      height: config.terraceWidth,
      rx: 0,
    }));

    return { originX, originY };
  }

  function renderGaps(config, rows, originX, originY) {
    rows.forEach((row) => {
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
  }

  function renderMeasureOverlay() {
    document.getElementById("measureLayer")?.remove();
    const measure = state.measure;
    if (!measure || !measure.points.length) return;

    const start = measure.points[0];
    const end = measure.points[1] || measure.preview;
    const group = svgEl("g", { id: "measureLayer", class: "measure-layer" });
    els.svg.appendChild(group);

    group.appendChild(svgEl("circle", {
      class: "measure-point",
      cx: svgOrigin.x + start.x,
      cy: svgOrigin.y + start.y,
      r: 15,
    }));

    if (!end) {
      group.appendChild(svgEl("text", {
        class: "measure-label",
        x: svgOrigin.x + start.x + 30,
        y: svgOrigin.y + start.y - 24,
      })).textContent = "1. bod";
      return;
    }

    const x1 = svgOrigin.x + start.x;
    const y1 = svgOrigin.y + start.y;
    const x2 = svgOrigin.x + end.x;
    const y2 = svgOrigin.y + end.y;
    const distance = Math.hypot(end.x - start.x, end.y - start.y);
    const midX = (x1 + x2) / 2;
    const midY = (y1 + y2) / 2;

    group.appendChild(svgEl("line", {
      class: `measure-line${measure.points.length < 2 ? " is-preview" : ""}`,
      x1,
      y1,
      x2,
      y2,
    }));
    group.appendChild(svgEl("circle", {
      class: "measure-point",
      cx: x2,
      cy: y2,
      r: 15,
    }));
    group.appendChild(svgEl("text", {
      class: "measure-label",
      x: midX,
      y: midY - 28,
    })).textContent = `${Math.round(distance)} mm`;
  }

  function renderSvg(config, layout, joistLayout) {
    const actualJoistLayout = asJoistLayout(config, joistLayout, state.cutouts);
    const { originX, originY } = prepareSvg(config);
    const showBoards = state.viewMode !== "joists";
    const showStructure = state.viewMode !== "boards";
    renderGaps(config, layout.rows, originX, originY);
    if (showStructure) renderJoists(config, actualJoistLayout, originX, originY);
    if (showBoards) layout.pieces.forEach((piece) => renderAutoPiece(piece, originX, originY));
    if (showStructure) renderPedestals(config, actualJoistLayout, originX, originY);
    if (showBoards && showStructure) renderScrewDots(layout.pieces, actualJoistLayout, config, originX, originY);
    renderCutouts(config, actualJoistLayout.cutouts, originX, originY);
    if (showBoards) {
      renderFullLastBoardExtension(config, layout, originX, originY);
      renderRowCoverage(config, layout.rows, layout.pieces, originX, originY);
    }
    renderDimensions(config, originX, originY);
    renderMeasureOverlay();
  }

  function renderManualSvg(config) {
    const { originX, originY } = prepareSvg(config);
    const rows = boardRows(config);
    const showBoards = state.viewMode !== "joists";
    const showStructure = state.viewMode !== "boards";
    renderGaps(config, rows, originX, originY);

    const joistLayout = computeJoistLayout(config, state.manualPieces, state.cutouts, state.manualJoists);
    if (showStructure) renderJoists(config, joistLayout, originX, originY);
    if (showBoards) state.manualPieces.forEach((piece) => renderManualPiece(piece, config, originX, originY));
    if (showStructure) renderPedestals(config, joistLayout, originX, originY);
    if (showBoards && showStructure) renderScrewDots(state.manualPieces, joistLayout, config, originX, originY);
    renderCutouts(config, joistLayout.cutouts, originX, originY);
    if (showBoards) {
      renderFullLastBoardExtension(config, { rows }, originX, originY);
      renderRowCoverage(config, rows, state.manualPieces, originX, originY);
    }
    renderDimensions(config, originX, originY);
    renderMeasureOverlay();
  }

  function renderSummary(config, layout, joistLayout) {
    const actualJoistLayout = asJoistLayout(config, joistLayout, state.cutouts);
    const pieceCount = layout.pieces.length;
    const used = layout.packed.reduce((sum, board) => sum + board.cuts.reduce((inner, cut) => inner + cut, 0), 0);
    const purchased = layout.packed.length * config.boardLength;
    const waste = Math.max(0, purchased - used);
    const coverageWidth = layout.rows.reduce((sum, row) => sum + row.width, 0) + Math.max(0, layout.rows.length - 1) * config.gap;

    const spacerCount = layout.rows.reduce((sum, row) => {
      const piecesInRow = layout.pieces.filter((p) => p.row === row.index).length;
      return sum + (piecesInRow > 0 ? piecesInRow + 1 : 0);
    }, 0);

    const screwReservePct = 10;
    const screwTol = config.gap + 0.5;
    let screwBase = 0;
    for (const piece of layout.pieces) {
      for (const joist of actualJoistLayout.joists) {
        const jx = joist.x;
        if (jx < piece.x - screwTol || jx > piece.x + piece.length + screwTol) continue;
        const widthInset = Math.max(18, piece.width * 0.15);
        if (joistCoversY(joist, piece.y + widthInset, screwTol)) screwBase += 1;
        if (joistCoversY(joist, piece.y + piece.width - widthInset, screwTol)) screwBase += 1;
      }
    }
    const screwTotal = Math.ceil((screwBase * (1 + screwReservePct / 100)) / 10) * 10;
    const joistLengthMm = actualJoistLayout.joists.reduce((sum, joist) => (
      sum + joist.segments.reduce((inner, segment) => inner + Math.max(0, segment.y2 - segment.y1), 0)
    ), 0);
    const pedestalLayout = computePedestalLayout(config, actualJoistLayout);
    const turboScrewCount = pedestalLayout.count * 4;

    const topItems = [
      ["Skladová prkna", `${layout.packed.length} ks`],
      ["Položené řady", `${layout.rows.length} řad`],
      ["Řezané díly", `${pieceCount} ks`],
      ["Celkový odpad", `${Math.round(waste)} mm (${purchased ? ((waste / purchased) * 100).toFixed(1) : "0.0"} %)`],
      ["Pokrytá šířka", `${Math.round(Math.min(coverageWidth, config.terraceWidth))} mm`],
    ];

    const bottomItems = [
      ["Podkladní hranoly", `${actualJoistLayout.positions.length} ks / ${(joistLengthMm / 1000).toFixed(2)} m`],
      ["Rektifikační terče", `${pedestalLayout.count} ks`],
      ["Turbošrouby", `${turboScrewCount} ks`],
      ["Distanční podložky", `${spacerCount} ks`],
      ["Vruty", { html: `<span class="summary-main">${screwTotal} ks</span><span class="summary-detail">${screwBase} + ${screwReservePct} % rezerva</span>` }],
    ];

    const renderValue = (value) => (typeof value === "string" ? value : value.html);
    const renderDl = (items) => `<dl class="summary-list">${items.map(([label, value]) => `<dt>${label}</dt><dd>${renderValue(value)}</dd>`).join("")}</dl>`;
    els.summary.innerHTML = `${renderDl(topItems)}<hr class="summary-divider" />${renderDl(bottomItems)}`;
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

  function renderManualWarnings(config, rows) {
    const warnings = [];

    if (state.manualPieces.length === 0) {
      warnings.push({ type: "info", text: "Přetáhni prkna z palety na výkres." });
    }

    state.manualPieces.forEach((piece) => {
      const overflowLeft = Math.max(0, -piece.x);
      const overflowRight = Math.max(0, piece.x + piece.length - config.terraceLength);
      if (overflowLeft > 0.5) {
        warnings.push({ type: "warning", text: `Prkno v řadě ${piece.row + 1} přesahuje vlevo o ${Math.round(overflowLeft)} mm.` });
      }
      if (overflowRight > 0.5) {
        warnings.push({ type: "warning", text: `Prkno v řadě ${piece.row + 1} přesahuje vpravo o ${Math.round(overflowRight)} mm.` });
      }
    });

    const fullBoardInfo = fullLastBoardInfo(config, rows);
    if (fullBoardInfo) {
      warnings.push({ type: "info", text: `Poslední řada má šířku ${Math.round(fullBoardInfo.currentLastWidth)} mm. Bez podélného řezu by terasa měla šířku ${Math.round(fullBoardInfo.fullWidth)} mm (+${Math.round(fullBoardInfo.extension)} mm).` });
    }

    if (!warnings.length) {
      warnings.push({ type: "info", text: "Ručně umístěná prkna – bez automatického řezného plánu." });
    }

    els.warnings.innerHTML = warnings.map((w) => `<li class="is-${w.type}">${w.text}</li>`).join("");
  }

  function boardTooltipTarget(event) {
    return event.target.closest?.("[data-board-tooltip]");
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

  function showBoardTooltip(event) {
    if (state.measure?.enabled) return;
    const target = boardTooltipTarget(event);
    if (!target) {
      hideBoardTooltip();
      return;
    }

    renderBoardTooltipContent(target);
    els.boardTooltip.classList.add("is-visible");
    moveBoardTooltip(event);
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

  function showResizeTooltip(e, value, label = "Délka") {
    const row = document.createElement("div");
    row.className = "board-tooltip-row";
    const lbl = document.createElement("span");
    lbl.className = "board-tooltip-label";
    lbl.textContent = label;
    const val = document.createElement("strong");
    val.className = "board-tooltip-value";
    val.textContent = `${Math.round(value)} mm`;
    row.append(lbl, val);
    els.boardTooltip.replaceChildren(row);
    els.boardTooltip.classList.add("is-visible");
    const vpPad = 12;
    const offset = 14;
    const tRect = els.boardTooltip.getBoundingClientRect();
    let left = e.clientX + offset;
    let top = e.clientY - tRect.height - offset;
    if (left + tRect.width + vpPad > window.innerWidth) left = e.clientX - tRect.width - offset;
    if (top < vpPad) top = e.clientY + offset;
    els.boardTooltip.style.left = `${Math.max(vpPad, left)}px`;
    els.boardTooltip.style.top = `${Math.max(vpPad, top)}px`;
  }

  return {
    clearSvg,
    hideBoardTooltip,
    moveBoardTooltip,
    renderCutList,
    renderManualSvg,
    renderManualWarnings,
    renderSummary,
    renderMeasureOverlay,
    renderSvg,
    renderWarnings,
    showBoardTooltip,
    showResizeTooltip,
  };
}
