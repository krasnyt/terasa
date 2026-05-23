"use strict";

export const JOIST_BOARD_END_INSET = 18;

export function boardRows(config) {
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

export function fullLastBoardInfo(config, rows) {
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

function stockLengthValue(raw) {
  const text = String(raw || "").trim().toLowerCase();
  const match = text.match(/^([0-9]+(?:[.,][0-9]+)?)(mm)?$/);
  if (!match) return null;
  const numeric = Number(match[1].replace(",", "."));
  if (!Number.isFinite(numeric) || numeric <= 0) return null;
  return numeric;
}

function formatStockEntry(entry) {
  const count = entry.count === Infinity ? "X" : Math.round(entry.count);
  return `${count}x${Math.round(entry.length)}`;
}

export function stockInventory(config) {
  const fallbackLength = Math.max(1, Math.round(Number(config.boardLength) || 0));
  const spec = String(config.stockBoards || "").trim();
  if (!spec) {
    return {
      entries: [{ count: Infinity, length: fallbackLength }],
      warnings: [],
      label: `Xx${fallbackLength}`,
      isCustom: false,
      maxLength: fallbackLength,
    };
  }

  const warnings = [];
  const entries = [];
  spec.split(/[;\n,]+/).map((part) => part.trim()).filter(Boolean).forEach((part) => {
    const match = part.match(/^(\d+|x|\*|∞)\s*[x×]\s*([0-9]+(?:[.,][0-9]+)?(?:\s*mm)?)$/i);
    if (!match) {
      warnings.push({ type: "danger", text: `Skladové prkno „${part}” nemá správný tvar. Použij například 1x2300; 2x2400; Xx2500.` });
      return;
    }
    const count = /^(x|\*|∞)$/i.test(match[1]) ? Infinity : Number(match[1]);
    const length = stockLengthValue(match[2].replace(/\s+/g, ""));
    if ((!Number.isFinite(count) && count !== Infinity) || count <= 0 || !Number.isFinite(length) || length <= 0) {
      warnings.push({ type: "danger", text: `Skladové prkno „${part}” nejde přečíst.` });
      return;
    }
    entries.push({ count, length: Math.round(length) });
  });

  if (!entries.length) {
    return {
      entries: [{ count: Infinity, length: fallbackLength }],
      warnings: warnings.length ? warnings : [{ type: "danger", text: "Seznam skladových prken je prázdný nebo neplatný." }],
      label: `Xx${fallbackLength}`,
      isCustom: true,
      maxLength: fallbackLength,
    };
  }

  const maxLength = Math.max(...entries.map((entry) => entry.length));
  return {
    entries,
    warnings,
    label: entries.map(formatStockEntry).join("; "),
    isCustom: true,
    maxLength,
  };
}

export function getMaxStockLength(config) {
  return stockInventory(config).maxLength;
}

function buildRowLengths(config, patternIndex, stagger) {
  const boardLength = getMaxStockLength(config);
  if (config.terraceLength < config.minOffcut - 0.5) {
    return { error: `Délka terasy ${Math.round(config.terraceLength)} mm je menší než minimální odřezek ${Math.round(config.minOffcut)} mm.` };
  }

  if (config.terraceLength <= boardLength + 0.5) {
    return { lengths: [config.terraceLength] };
  }

  const offset = patternIndex * stagger;
  const firstLength = offset > 0 ? boardLength - offset : boardLength;
  const lengths = [firstLength];
  let placed = firstLength;

  while (config.terraceLength - placed > boardLength + 0.5) {
    lengths.push(boardLength);
    placed += boardLength;
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

  return {
    lengths: roundLengthsToTotal(lengths, config.terraceLength, config.minOffcut, boardLength),
  };
}

function roundLengthsToTotal(lengths, total, minLength, maxLength) {
  const target = Math.round(total);
  const rounded = lengths.map((length) => Math.floor(length));
  let missing = target - rounded.reduce((sum, length) => sum + length, 0);
  if (missing <= 0) return rebalanceRoundedLengths(rounded, missing, minLength, maxLength);

  const order = lengths
    .map((length, index) => ({ index, fraction: length - Math.floor(length) }))
    .sort((a, b) => b.fraction - a.fraction || a.index - b.index);

  for (const item of order) {
    if (missing <= 0) break;
    const room = Math.max(0, Math.round(maxLength) - rounded[item.index]);
    if (!room) continue;
    const add = Math.min(room, missing);
    rounded[item.index] += add;
    missing -= add;
  }

  return rebalanceRoundedLengths(rounded, missing, minLength, maxLength);
}

function rebalanceRoundedLengths(lengths, diff, minLength, maxLength) {
  if (diff === 0) return lengths;
  const min = Math.round(minLength);
  const max = Math.round(maxLength);
  const direction = diff > 0 ? 1 : -1;
  let remaining = Math.abs(diff);

  while (remaining > 0) {
    const index = direction > 0
      ? lengths.findIndex((length) => length < max)
      : lengths.findIndex((length) => length > min);
    if (index === -1) break;
    lengths[index] += direction;
    remaining -= 1;
  }

  return lengths;
}

function placeRowPieces(config, row, lengths, idPrefix, patternIndex, pieces) {
  if (config.layDirection === "right") {
    let x = config.terraceLength;
    lengths.forEach((length) => {
      x -= length;
      pieces.push({
        id: `${idPrefix}-${row.index}-${pieces.length}`,
        row: row.index,
        x,
        y: row.y,
        length,
        width: row.width,
        patternIndex,
      });
    });
    return;
  }

  let x = 0;
  lengths.forEach((length) => {
    pieces.push({
      id: `${idPrefix}-${row.index}-${pieces.length}`,
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

export function createAutoLayout(config) {
  const rows = boardRows(config);
  const pieces = [];
  const inventory = stockInventory(config);
  const boardLength = inventory.maxLength;

  if (rows.length > 1 && config.patternRows < 2) {
    return {
      rows,
      pieces,
      packed: [],
      warnings: [{ type: "danger", text: "Opakování vzoru musí být alespoň 2 řady, jinak by všechny řady měly stejné spáry." }],
      invalidPattern: true,
    };
  }

  const stagger = rows.length > 1 ? boardLength / config.patternRows : 0;

  if (rows.length > 1 && stagger < config.minOffcut - 0.5) {
    return {
      rows,
      pieces,
      packed: [],
      warnings: [{
        type: "danger",
        text: `Při ${config.patternRows} řadách ve vzoru by posun spár vyšel na ${Math.round(stagger)} mm, což je méně než minimální odřezek ${Math.round(config.minOffcut)} mm. Sniž opakování vzoru, zvětši délku skladového prkna nebo sniž minimální odřezek.`,
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
            text: `Ve vzoru by vznikl díl o délce ${Math.round(length)} mm, což je méně než minimální odřezek ${Math.round(config.minOffcut)} mm. Uprav délku terasy, skladová prkna, opakování vzoru nebo minimální odřezek.`,
          }],
          invalidPattern: true,
        };
      }
    }

    placeRowPieces(config, row, result.lengths, "a", patternIndex, pieces);
  }

  const packed = packBoards(piecesForCutPlan(pieces), config);
  return {
    rows,
    pieces,
    packed,
    warnings: packed.warnings,
    invalidPattern: packed.invalid,
    stagger,
  };
}

export function serializeManualPieces(pieces) {
  if (!pieces.length) return "";
  const byRow = new Map();
  pieces.forEach((p) => {
    if (!byRow.has(p.row)) byRow.set(p.row, []);
    byRow.get(p.row).push(p);
  });
  const maxRow = Math.max(...byRow.keys());
  const lines = [];
  for (let i = 0; i <= maxRow; i++) {
    const rowPieces = (byRow.get(i) || []).slice().sort((a, b) => a.x - b.x);
    lines.push(rowPieces.map((p) => Math.round(p.length)).join("; "));
  }
  return lines.join("\n");
}

export function parseManualText(text, config) {
  const rows = boardRows(config);
  const lines = text.split(/\r?\n/);
  const pieces = [];
  lines.forEach((line, lineIdx) => {
    const tokens = line.split(";").map((s) => s.trim()).filter(Boolean);
    if (!tokens.length) return;
    const row = rows[lineIdx];
    if (!row) return;
    let x = 0;
    tokens.forEach((tok, tokIdx) => {
      const len = Number(tok.replace(",", "."));
      if (!Number.isFinite(len) || len <= 0) return;
      pieces.push({
        id: `t-${lineIdx}-${tokIdx}-${Math.random().toString(36).slice(2, 8)}`,
        row: lineIdx,
        x,
        y: row.y,
        length: len,
        width: row.width,
        patternIndex: lineIdx % 4,
      });
      x += len + config.gap;
    });
  });
  return pieces;
}

export function piecesForCutPlan(pieces) {
  const byRow = new Map();
  pieces.forEach((piece) => {
    if (!byRow.has(piece.row)) byRow.set(piece.row, []);
    byRow.get(piece.row).push(piece);
  });

  const orderById = new Map();
  byRow.forEach((rowPieces) => {
    rowPieces
      .slice()
      .sort((a, b) => a.x - b.x || String(a.id || "").localeCompare(String(b.id || "")))
      .forEach((piece, index) => {
        orderById.set(piece.id, index + 1);
      });
  });

  return pieces.map((piece) => {
    const pieceIndex = orderById.get(piece.id) || 1;
    return {
      length: piece.length,
      row: piece.row,
      pieceIndex,
      cutLabel: `ř. ${piece.row + 1}, díl ${pieceIndex} zleva`,
    };
  });
}

export function computeRowCoverage(rowIndex, pieces, config) {
  const rowPieces = pieces.filter((p) => p.row === rowIndex);
  if (!rowPieces.length) return { status: "empty", diff: config.terraceLength };
  const sorted = rowPieces.slice().sort((a, b) => a.x - b.x);
  const tol = 0.5;
  let coveredEnd = 0;
  let hasGap = sorted[0].x > tol;
  for (const p of sorted) {
    if (p.x > coveredEnd + config.gap + tol) hasGap = true;
    coveredEnd = Math.max(coveredEnd, p.x + p.length);
  }
  const diff = coveredEnd - config.terraceLength;
  if (Math.abs(diff) <= tol && !hasGap) return { status: "ok", diff: 0 };
  if (diff > tol) return { status: "over", diff };
  return { status: "short", diff: Math.max(0, -diff) || 1 };
}

export function computeJoistPositions(config, pieces, extraPositions = []) {
  const half = Math.round(config.terraceLength / 2);
  const leftOffset = Math.max(0, Number(config.joistLeftOffset ?? config.joistEdgeOffset) || 0);
  const rightOffset = Math.max(0, Number(config.joistRightOffset ?? config.joistEdgeOffset) || 0);
  const leftEdge = Math.min(leftOffset, half);
  const rightEdge = Math.max(config.terraceLength - rightOffset, leftEdge + 1);
  const all = new Set([leftEdge, rightEdge]);
  const clampX = (x) => Math.max(0, Math.min(config.terraceLength, x));

  pieces.forEach((piece) => {
    const left = Number(piece.x) || 0;
    const right = left + (Number(piece.length) || 0);
    if (left > 0.5 && left < config.terraceLength - 0.5) {
      all.add(Math.round(clampX(left + JOIST_BOARD_END_INSET)));
    }
    if (right > 0.5 && right < config.terraceLength - 0.5) {
      all.add(Math.round(clampX(right - JOIST_BOARD_END_INSET)));
    }
  });

  extraPositions.forEach((position) => {
    const x = typeof position === "number" ? position : position?.x;
    if (!Number.isFinite(Number(x))) return;
    all.add(Math.round(clampX(Number(x))));
  });

  return Array.from(all).sort((a, b) => a - b);
}

export function normalizeCutouts(cutouts, config) {
  if (!Array.isArray(cutouts)) return [];

  return cutouts.map((cutout, index) => {
    const edge = ["top", "bottom"].includes(cutout.edge) ? cutout.edge : "top";
    const x = Math.max(0, Number(cutout.x) || 0);
    const width = Math.max(0, Number(cutout.width) || 0);
    const depth = Math.max(0, Number(cutout.depth) || 0);
    const clippedX = Math.min(x, config.terraceLength);
    const clippedRight = Math.min(config.terraceLength, clippedX + width);
    const clippedDepth = Math.min(depth, config.terraceWidth);
    return {
      id: cutout.id || `c-${index + 1}`,
      label: String(cutout.label || `Zářez ${index + 1}`).trim() || `Zářez ${index + 1}`,
      edge,
      x: clippedX,
      width: Math.max(0, clippedRight - clippedX),
      depth: clippedDepth,
    };
  }).filter((cutout) => cutout.width > 0.5 && cutout.depth > 0.5);
}

export function cutoutYRange(cutout, config) {
  if (cutout.edge === "bottom") {
    return {
      y1: config.terraceWidth,
      y2: config.terraceWidth + cutout.depth,
    };
  }

  return {
    y1: -cutout.depth,
    y2: 0,
  };
}

function mergeTouchingSegments(segments) {
  return segments
    .filter((segment) => segment.y2 > segment.y1 + 0.5)
    .sort((a, b) => a.y1 - b.y1)
    .reduce((merged, segment) => {
      const prev = merged.at(-1);
      if (prev && segment.y1 <= prev.y2 + 0.5) {
        prev.y2 = Math.max(prev.y2, segment.y2);
      } else {
        merged.push({ ...segment });
      }
      return merged;
    }, []);
}

export function computeJoistLayout(config, pieces, cutouts = [], extraPositions = []) {
  const positions = computeJoistPositions(config, pieces, extraPositions);
  const normalizedCutouts = normalizeCutouts(cutouts, config);
  const joists = positions.map((x) => {
    let segments = [{ y1: 0, y2: config.terraceWidth }];
    normalizedCutouts
      .filter((cutout) => x >= cutout.x - 0.5 && x <= cutout.x + cutout.width + 0.5)
      .forEach((cutout) => {
        segments.push(cutoutYRange(cutout, config));
      });

    return { x, segments: mergeTouchingSegments(segments) };
  });

  return { positions, joists, cutouts: normalizedCutouts };
}

function pedestalYsForSegment(segment, config) {
  const length = segment.y2 - segment.y1;
  if (length <= 0.5) return [];

  const topOffset = Math.max(0, Number(config.pedestalTopOffset ?? config.pedestalVerticalOffset) || 0);
  const bottomOffset = Math.max(0, Number(config.pedestalBottomOffset ?? config.pedestalVerticalOffset) || 0);
  const spacing = Math.max(100, Number(config.pedestalSpacing) || 500);

  if (length <= topOffset + bottomOffset + 0.5) {
    return [segment.y1 + length / 2];
  }

  const first = segment.y1 + topOffset;
  const last = segment.y2 - bottomOffset;
  const distance = last - first;
  const intervalCount = Math.max(1, Math.ceil(distance / spacing));

  return Array.from({ length: intervalCount + 1 }, (_, index) => first + (distance * index) / intervalCount);
}

export function computePedestalLayout(config, joistLayout) {
  const pedestals = [];

  joistLayout.joists.forEach((joist, joistIndex) => {
    joist.segments.forEach((segment, segmentIndex) => {
      pedestalYsForSegment(segment, config).forEach((y, pedestalIndex) => {
        pedestals.push({
          id: `${joistIndex}-${segmentIndex}-${pedestalIndex}`,
          x: joist.x,
          y,
        });
      });
    });
  });

  return { pedestals, count: pedestals.length };
}

function attachPackMeta(boards, props) {
  Object.defineProperties(boards, {
    warnings: { value: props.warnings || [], enumerable: false },
    invalid: { value: Boolean(props.invalid), enumerable: false },
    inventory: { value: props.inventory, enumerable: false },
  });
  return boards;
}

function remainingAfterCut(remaining, length, sawKerf) {
  const gap = remaining - length;
  if (gap <= 0.5) return { remaining: 0, kerf: 0 };
  const kerf = Math.min(sawKerf, gap);
  return {
    remaining: Math.max(0, gap - kerf),
    kerf,
  };
}

function cutItemLabel(item) {
  if (item.cutLabel) return item.cutLabel;
  if (Number.isFinite(item.row) && Number.isFinite(item.pieceIndex)) {
    return `ř. ${item.row + 1}, díl ${item.pieceIndex} zleva`;
  }
  return "";
}

export function packBoards(cutItems, stockSource) {
  const config = typeof stockSource === "number" ? { boardLength: stockSource, stockBoards: "" } : stockSource;
  const inventory = stockInventory(config);
  const sawKerf = Math.max(0, Number(config.sawKerf) || 0);
  const warnings = [...inventory.warnings];
  const boards = [];
  if (warnings.some((warning) => warning.type === "danger")) {
    return attachPackMeta(boards, { warnings, invalid: true, inventory });
  }
  const available = inventory.entries.map((entry, index) => ({
    ...entry,
    index,
    remainingCount: entry.count,
  }));
  const sorted = cutItems
    .map((item, inputIndex) => {
      const rawLength = typeof item === "number" ? item : item.length;
      return {
        inputIndex,
        length: Math.round(Number(rawLength) || 0),
        label: typeof item === "number" ? "" : cutItemLabel(item),
      };
    })
    .filter((item) => item.length > 0)
    .sort((a, b) => b.length - a.length || a.inputIndex - b.inputIndex);

  for (const item of sorted) {
    const { length } = item;
    let target = boards
      .filter((board) => board.remaining >= length)
      .sort((a, b) => remainingAfterCut(a.remaining, length, sawKerf).remaining - remainingAfterCut(b.remaining, length, sawKerf).remaining)[0];
    if (!target) {
      const source = available
        .filter((entry) => entry.length >= length && (entry.remainingCount === Infinity || entry.remainingCount > 0))
        .sort((a, b) => a.length - b.length || a.index - b.index)[0];
      if (!source) {
        warnings.push({
          type: "danger",
          text: `Díl ${Math.round(length)} mm se nevejde do dostupné zásoby skladových prken (${inventory.label}).`,
        });
        return attachPackMeta(boards, { warnings, invalid: true, inventory });
      }
      if (source.remainingCount !== Infinity) source.remainingCount -= 1;
      target = { cuts: [], cutDetails: [], kerfs: [], sawWaste: 0, remaining: source.length, length: source.length, sourceIndex: source.index };
      boards.push(target);
    }
    const result = remainingAfterCut(target.remaining, length, sawKerf);
    target.cuts.push(length);
    target.cutDetails.push({ length, label: item.label });
    target.kerfs.push(result.kerf);
    target.sawWaste += result.kerf;
    target.remaining = result.remaining;
  }

  return attachPackMeta(boards, { warnings, invalid: warnings.some((warning) => warning.type === "danger"), inventory });
}
