"use strict";

import { boardRows, parseManualText, serializeManualPieces } from "./layout.js";
import { svgEl } from "./render.js";

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

  function clearSvgPreview() {
    document.getElementById("manualPreviewRect")?.remove();
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

    if (dragState.type === "resize-right" || dragState.type === "resize-left") {
      handleResizeMove(e);
      return;
    }

    const config = readConfig();
    const rows = boardRows(config);
    const data = clientToSvgData(e.clientX, e.clientY);
    if (!data) { clearSvgPreview(); return; }
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

    const moved = pointerDownInfo
      ? Math.hypot(e.clientX - pointerDownInfo.x, e.clientY - pointerDownInfo.y)
      : 999;

    if (dragState?.type === "resize-right" || dragState?.type === "resize-left") {
      renderer.hideBoardTooltip();
      syncManualTextFromPieces();
      scheduleSave();
      render();
      dragState = null;
      pointerDownInfo = null;
      return;
    }

    if (dragState?.type === "move" && moved < 8) {
      state.manualPieces = state.manualPieces.filter((p) => p.id !== dragState.pieceId);
      dragState = null;
      pointerDownInfo = null;
      syncManualTextFromPieces();
      scheduleSave();
      render();
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

    els.svg.addEventListener("pointerdown", (e) => {
      if (state.measure?.enabled) return;
      if (state.layoutMode !== "manual") return;
      const data = clientToSvgData(e.clientX, e.clientY);
      if (!data) return;
      const thr = getSnapThresholdMm();

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
