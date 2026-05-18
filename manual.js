"use strict";

import {
  boardRows,
  JOIST_BOARD_END_INSET,
  parseManualText,
  serializeManualPieces,
} from "./layout.js?v=5";
import { svgEl } from "./render.js?v=12";

export function createManualController({
  els,
  state,
  svgOrigin,
  readConfig,
  render,
  scheduleSave,
  renderer,
}) {
  let dragState = null;
  let pointerDownInfo = null;

  function syncManualTextFromPieces() {
    if (!els.manualLayoutText) return;
    els.manualLayoutText.value = serializeManualPieces(state.manualPieces);
  }

  function clientToSvgData(clientX, clientY) {
    const rect = els.svg.getBoundingClientRect();
    const vb = els.svg.viewBox.baseVal;
    if (!rect.width || !vb.width) return null;
    return {
      x: (clientX - rect.left) * (vb.width / rect.width) - svgOrigin.x,
      y: (clientY - rect.top) * (vb.height / rect.height) - svgOrigin.y,
    };
  }

  function rowAtData(dataY, rows) {
    return rows.find((row) => dataY >= row.y - 4 && dataY < row.y + row.width + 4) ?? null;
  }

  function getSnapThresholdMm() {
    const rect = els.svg.getBoundingClientRect();
    const vb = els.svg.viewBox.baseVal;
    if (!rect.width || !vb.width) return 100;
    return 22 * (vb.width / rect.width);
  }

  function snapX(rawX, rowIndex, boardLength, config, excludeId) {
    const threshold = getSnapThresholdMm();
    const rowPieces = state.manualPieces.filter((p) => p.row === rowIndex && p.id !== excludeId);
    const candidates = [0, config.terraceLength - boardLength];
    for (const p of rowPieces) {
      candidates.push(p.x + p.length + config.gap);
      candidates.push(p.x - boardLength - config.gap);
    }
    let best = rawX;
    let bestDist = threshold;
    for (const c of candidates) {
      const dist = Math.abs(rawX - c);
      if (dist < bestDist) { bestDist = dist; best = c; }
    }
    return best;
  }

  function updateSvgPreview(snappedX, row, pieceLength) {
    clearSvgPreview();
    els.svg.appendChild(svgEl("rect", {
      id: "manualPreviewRect",
      class: "board-preview-rect",
      x: svgOrigin.x + snappedX,
      y: svgOrigin.y + row.y,
      width: pieceLength,
      height: row.width,
      rx: 5,
    }));
  }

  function updateJoistPreview(x, config) {
    clearSvgPreview();
    const group = svgEl("g", { id: "manualJoistPreview" });
    const svgX = svgOrigin.x + x;
    group.appendChild(svgEl("line", {
      class: "manual-joist-preview-line",
      x1: svgX,
      y1: svgOrigin.y,
      x2: svgX,
      y2: svgOrigin.y + config.terraceWidth,
    }));
    const label = svgEl("text", {
      class: "manual-joist-preview-label",
      x: svgX + 24,
      y: svgOrigin.y + 58,
    });
    label.textContent = `X ${Math.round(x)} mm`;
    group.appendChild(label);
    els.svg.appendChild(group);
  }

  function clearSvgPreview() {
    document.getElementById("manualPreviewRect")?.remove();
    document.getElementById("manualJoistPreview")?.remove();
  }

  function adjacentManualSeams(config) {
    const seams = [];
    const rows = boardRows(config);
    rows.forEach((row) => {
      const rowPieces = state.manualPieces
        .filter((piece) => piece.row === row.index)
        .slice()
        .sort((a, b) => a.x - b.x);

      for (let i = 1; i < rowPieces.length; i += 1) {
        const left = rowPieces[i - 1];
        const right = rowPieces[i];
        const actualGap = right.x - (left.x + left.length);
        if (Math.abs(actualGap - config.gap) <= Math.max(1, config.gap + 0.5)) {
          seams.push({ row, left, right, x: right.x });
        }
      }
    });
    return seams;
  }

  function manualSeamGroups(config) {
    const groups = new Map();
    adjacentManualSeams(config).forEach((seam) => {
      const key = Math.round(seam.x);
      if (!groups.has(key)) groups.set(key, { x: key, seams: [] });
      groups.get(key).seams.push(seam);
    });
    return Array.from(groups.values()).sort((a, b) => a.x - b.x);
  }

  function seamGroupAtData(data, config, threshold) {
    let best = null;
    let bestDist = threshold;
    manualSeamGroups(config).forEach((group) => {
      group.seams.forEach((seam) => {
        const rowTop = seam.row.y;
        const rowBottom = seam.row.y + seam.row.width;
        const yDist = data.y < rowTop ? rowTop - data.y : Math.max(0, data.y - rowBottom);
        if (yDist > threshold) return;

        const leftJoistX = seam.left.x + seam.left.length - JOIST_BOARD_END_INSET;
        const rightJoistX = seam.right.x + JOIST_BOARD_END_INSET;
        const xDist = Math.min(
          Math.abs(data.x - group.x),
          Math.abs(data.x - leftJoistX),
          Math.abs(data.x - rightJoistX),
        );
        const dist = Math.hypot(xDist, Math.min(yDist, threshold));
        if (dist < bestDist) {
          best = group;
          bestDist = dist;
        }
      });
    });
    return best;
  }

  function handleSeamMove(e) {
    const config = readConfig();
    const data = clientToSvgData(e.clientX, e.clientY);
    if (!data) return;

    const minRightX = Math.max(...dragState.items.map((item) => Math.max(
      item.leftX + config.minOffcut + config.gap,
      item.rightEnd - config.boardLength,
    )));
    const maxRightX = Math.min(...dragState.items.map((item) => Math.min(
      item.leftX + config.boardLength + config.gap,
      item.rightEnd - config.minOffcut,
    )));
    if (minRightX > maxRightX) return;

    const rightX = Math.max(minRightX, Math.min(maxRightX, data.x - dragState.grabOffsetX));
    dragState.items.forEach((item) => {
      const left = state.manualPieces.find((p) => p.id === item.leftId);
      const right = state.manualPieces.find((p) => p.id === item.rightId);
      if (!left || !right) return;

      left.x = item.leftX;
      left.length = rightX - config.gap - item.leftX;
      right.x = rightX;
      right.length = item.rightEnd - rightX;
    });

    renderer.showResizeTooltip(e, rightX, `Spára (${dragState.items.length} řad)`);
    renderer.renderManualSvg(config);
  }

  function handleResizeMove(e) {
    const config = readConfig();
    const piece = state.manualPieces.find((p) => p.id === dragState.pieceId);
    if (!piece) return;
    const data = clientToSvgData(e.clientX, e.clientY);
    if (!data) return;

    if (dragState.type === "resize-right") {
      piece.length = Math.max(config.minOffcut, Math.min(config.boardLength, data.x - piece.x));
    } else {
      const fixedRight = dragState.originalX + dragState.originalLength;
      const newLen = Math.max(config.minOffcut, Math.min(config.boardLength, fixedRight - data.x));
      piece.x = fixedRight - newLen;
      piece.length = newLen;
    }

    renderer.showResizeTooltip(e, piece.length);
    renderer.renderManualSvg(config);
  }

  function onDragMove(e) {
    if (!dragState) return;
    if (pointerDownInfo) {
      const moved = Math.hypot(e.clientX - pointerDownInfo.x, e.clientY - pointerDownInfo.y);
      if (moved >= 8) pointerDownInfo.didDrag = true;
    }

    if (dragState.type === "resize-right" || dragState.type === "resize-left") {
      handleResizeMove(e);
      return;
    }

    if (dragState.type === "seam") {
      handleSeamMove(e);
      return;
    }

    const config = readConfig();
    const data = clientToSvgData(e.clientX, e.clientY);
    if (!data) { clearSvgPreview(); return; }

    if (dragState.type === "manual-joist") {
      const x = Math.round(Math.max(0, Math.min(config.terraceLength, data.x)));
      dragState.previewX = x;
      updateJoistPreview(x, config);
      renderer.showResizeTooltip(e, x, "X");
      return;
    }

    const rows = boardRows(config);
    const row = rowAtData(data.y, rows);
    if (!row) { clearSvgPreview(); dragState.previewRow = null; return; }
    const excludeId = dragState.type === "move" ? dragState.pieceId : null;
    const pieceLength = dragState.pieceLength || config.boardLength;
    const rawX = data.x - (dragState.grabOffsetX ?? 0);
    const snappedX = snapX(rawX, row.index, pieceLength, config, excludeId);
    dragState.previewX = snappedX;
    dragState.previewRow = row;
    updateSvgPreview(snappedX, row, pieceLength);
  }

  function onDragEnd(e) {
    document.removeEventListener("pointermove", onDragMove);
    document.removeEventListener("pointerup", onDragEnd);
    clearSvgPreview();
    els.svg.style.cursor = "";
    els.paletteBoardChip.classList.remove("is-dragging");
    els.manualJoistDragChip?.classList.remove("is-dragging");

    const moved = pointerDownInfo
      ? Math.hypot(e.clientX - pointerDownInfo.x, e.clientY - pointerDownInfo.y)
      : 999;

    if (dragState?.type === "resize-right" || dragState?.type === "resize-left" || dragState?.type === "seam") {
      renderer.hideBoardTooltip();
      syncManualTextFromPieces();
      scheduleSave();
      render();
      dragState = null;
      pointerDownInfo = null;
      return;
    }

    if (dragState?.type === "move" && moved < 8 && !pointerDownInfo?.didDrag) {
      state.manualPieces = state.manualPieces.filter((p) => p.id !== dragState.pieceId);
      dragState = null;
      pointerDownInfo = null;
      syncManualTextFromPieces();
      scheduleSave();
      render();
      return;
    }

    if (dragState?.type === "manual-joist") {
      renderer.hideBoardTooltip();
      if (dragState.previewX !== null && moved >= 8) {
        state.manualJoists.push({
          id: `j-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          x: dragState.previewX,
        });
        if (els.manualJoistPosition) els.manualJoistPosition.value = dragState.previewX;
        scheduleSave();
        render();
      }
      dragState = null;
      pointerDownInfo = null;
      return;
    }

    if (dragState?.previewX !== null && dragState?.previewRow) {
      const config = readConfig();
      if (dragState.type === "palette") {
        state.manualPieces.push({
          id: `m-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          row: dragState.previewRow.index,
          x: dragState.previewX,
          y: dragState.previewRow.y,
          length: dragState.pieceLength || config.boardLength,
          width: dragState.previewRow.width,
          patternIndex: dragState.previewRow.index % 4,
        });
      } else if (dragState.type === "move") {
        const piece = state.manualPieces.find((p) => p.id === dragState.pieceId);
        if (piece) {
          piece.x = dragState.previewX;
          piece.row = dragState.previewRow.index;
          piece.y = dragState.previewRow.y;
          piece.width = dragState.previewRow.width;
          piece.patternIndex = dragState.previewRow.index % 4;
        }
      }
      syncManualTextFromPieces();
      scheduleSave();
      render();
    }

    dragState = null;
    pointerDownInfo = null;
  }

  function startPaletteDrag(e) {
    if (state.layoutMode !== "manual") return;
    e.preventDefault();
    const config = readConfig();
    const rawLen = Number(els.manualPieceLength.value);
    const pieceLength = rawLen > 0 ? rawLen : config.boardLength;
    dragState = { type: "palette", previewX: null, previewRow: null, pieceLength };
    els.paletteBoardChip.classList.add("is-dragging");
    els.svg.style.cursor = "crosshair";
    pointerDownInfo = { x: e.clientX, y: e.clientY };
    document.addEventListener("pointermove", onDragMove);
    document.addEventListener("pointerup", onDragEnd);
  }

  function startManualJoistDrag(e) {
    if (state.layoutMode !== "manual") return;
    e.preventDefault();
    dragState = { type: "manual-joist", previewX: null, previewRow: null };
    els.manualJoistDragChip?.classList.add("is-dragging");
    els.svg.style.cursor = "col-resize";
    pointerDownInfo = { x: e.clientX, y: e.clientY };
    document.addEventListener("pointermove", onDragMove);
    document.addEventListener("pointerup", onDragEnd);
  }

  function startPieceDrag(e, pieceId) {
    e.preventDefault();
    const piece = state.manualPieces.find((p) => p.id === pieceId);
    const pieceLength = piece?.length ?? readConfig().boardLength;
    const data = clientToSvgData(e.clientX, e.clientY);
    const grabOffsetX = data && piece ? data.x - piece.x : 0;
    dragState = { type: "move", pieceId, previewX: null, previewRow: null, pieceLength, grabOffsetX };
    els.svg.style.cursor = "grabbing";
    pointerDownInfo = { x: e.clientX, y: e.clientY };
    document.addEventListener("pointermove", onDragMove);
    document.addEventListener("pointerup", onDragEnd);
  }

  function startResizeDrag(e, pieceId, side) {
    e.preventDefault();
    const piece = state.manualPieces.find((p) => p.id === pieceId);
    if (!piece) return;
    dragState = {
      type: `resize-${side}`,
      pieceId,
      originalX: piece.x,
      originalLength: piece.length,
      previewX: null,
      previewRow: null,
    };
    els.svg.style.cursor = "ew-resize";
    pointerDownInfo = { x: e.clientX, y: e.clientY };
    document.addEventListener("pointermove", onDragMove);
    document.addEventListener("pointerup", onDragEnd);
  }

  function startSeamDrag(e, group) {
    e.preventDefault();
    const data = clientToSvgData(e.clientX, e.clientY);
    dragState = {
      type: "seam",
      originalX: group.x,
      grabOffsetX: data ? data.x - group.x : 0,
      items: group.seams.map((seam) => ({
        leftId: seam.left.id,
        rightId: seam.right.id,
        leftX: seam.left.x,
        rightEnd: seam.right.x + seam.right.length,
      })),
      previewX: null,
      previewRow: null,
    };
    els.svg.style.cursor = "col-resize";
    pointerDownInfo = { x: e.clientX, y: e.clientY };
    document.addEventListener("pointermove", onDragMove);
    document.addEventListener("pointerup", onDragEnd);
  }

  function updatePaletteLabel() {
    const config = readConfig();
    const len = Number(els.manualPieceLength.value) || config.boardLength;
    els.paletteBoardChip.textContent = `Přetáhni prkno ${Math.round(len)} mm`;
  }

  function bindEvents() {
    els.manualPieceLength.addEventListener("input", updatePaletteLabel);

    els.manualLayoutText.addEventListener("input", () => {
      const config = readConfig();
      state.manualPieces = parseManualText(els.manualLayoutText.value, config);
      scheduleSave();
      render();
    });

    els.paletteBoardChip.addEventListener("pointerdown", startPaletteDrag);
    els.manualJoistDragChip?.addEventListener("pointerdown", startManualJoistDrag);

    els.svg.addEventListener("pointerdown", (e) => {
      if (state.measure?.enabled) return;
      if (state.layoutMode !== "manual") return;
      const data = clientToSvgData(e.clientX, e.clientY);
      if (!data) return;
      const thr = getSnapThresholdMm();
      const config = readConfig();
      const seamGroup = seamGroupAtData(data, config, thr);
      if (seamGroup) { startSeamDrag(e, seamGroup); return; }

      for (const piece of state.manualPieces) {
        if (data.y < piece.y - 4 || data.y > piece.y + piece.width + 4) continue;
        const dL = Math.abs(data.x - piece.x);
        const dR = Math.abs(data.x - (piece.x + piece.length));
        if (dL < thr && dL <= dR) { startResizeDrag(e, piece.id, "left"); return; }
        if (dR < thr) { startResizeDrag(e, piece.id, "right"); return; }
      }

      const target = e.target.closest("[data-manual-piece-id]");
      if (!target) return;
      startPieceDrag(e, target.dataset.manualPieceId);
    });

    els.svg.addEventListener("pointerover", renderer.showBoardTooltip);
    els.svg.addEventListener("pointermove", (e) => {
      renderer.moveBoardTooltip(e);
      if (state.measure?.enabled) return;
      if (state.layoutMode !== "manual" || dragState) return;
      const data = clientToSvgData(e.clientX, e.clientY);
      if (!data) return;
      const thr = getSnapThresholdMm();
      const config = readConfig();
      if (seamGroupAtData(data, config, thr)) {
        els.svg.style.cursor = "col-resize";
        return;
      }
      let cursor = "";
      for (const piece of state.manualPieces) {
        if (data.y < piece.y || data.y > piece.y + piece.width) continue;
        const dL = Math.abs(data.x - piece.x);
        const dR = Math.abs(data.x - (piece.x + piece.length));
        if (dL < thr || dR < thr) { cursor = "ew-resize"; break; }
        if (data.x > piece.x && data.x < piece.x + piece.length) cursor = "grab";
      }
      els.svg.style.cursor = cursor;
    });
    els.svg.addEventListener("pointerout", (event) => {
      if (!event.relatedTarget || !event.relatedTarget.closest?.("[data-board-tooltip]")) {
        renderer.hideBoardTooltip();
      }
    });
    els.svg.addEventListener("pointerleave", renderer.hideBoardTooltip);
    els.svg.addEventListener("mouseover", renderer.showBoardTooltip);
    els.svg.addEventListener("mousemove", renderer.moveBoardTooltip);
    els.svg.addEventListener("click", (e) => {
      if (state.layoutMode === "manual") return;
      renderer.showBoardTooltip(e);
    });
    els.svg.addEventListener("mouseout", (event) => {
      if (!event.relatedTarget || !event.relatedTarget.closest?.("[data-board-tooltip]")) {
        renderer.hideBoardTooltip();
      }
    });
    els.svg.addEventListener("mouseleave", renderer.hideBoardTooltip);
  }

  return {
    bindEvents,
    syncManualTextFromPieces,
    updatePaletteLabel,
  };
}
