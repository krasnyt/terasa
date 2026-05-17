"use strict";

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

export function createAutoLayout(config) {
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

function computeOptimalRowLengths(config) {
  const L = config.terraceLength;
  const maxSpan = Math.min(config.boardLength, config.maxJoistSpacing);

  if (L < config.minOffcut - 0.5) {
    return { error: `Délka terasy ${Math.round(L)} mm je menší než minimální odřezek ${Math.round(config.minOffcut)} mm.` };
  }

  if (maxSpan < config.minOffcut - 0.5) {
    return { error: `Maximální rozteč hranolů ${Math.round(config.maxJoistSpacing)} mm je menší než minimální odřezek ${Math.round(config.minOffcut)} mm.` };
  }

  if (L <= maxSpan + 0.5) {
    return { lengths: [L] };
  }

  const lengths = [];
  let placed = 0;

  while (L - placed > maxSpan + 0.5) {
    lengths.push(maxSpan);
    placed += maxSpan;
  }

  let remainder = L - placed;
  if (remainder > 0.5) {
    if (remainder < config.minOffcut - 0.5) {
      const shortage = config.minOffcut - remainder;
      const prev = lengths[lengths.length - 1];
      const newPrev = prev - shortage;
      if (newPrev < config.minOffcut - 0.5) {
        return { error: `Nelze sestavit rozložení bez dílu kratšího než ${Math.round(config.minOffcut)} mm. Zkus snížit min. odřezek nebo upravit délku terasy.` };
      }
      lengths[lengths.length - 1] = newPrev;
      remainder += shortage;
    }
    lengths.push(remainder);
  }

  return { lengths };
}

function computeOptimalRowLengthsWithOffset(config, offset) {
  const L = config.terraceLength;
  const maxSpan = Math.min(config.boardLength, config.maxJoistSpacing);

  if (L <= offset + 0.5) {
    return { lengths: [L] };
  }

  const lengths = [offset];
  let placed = offset;

  while (L - placed > maxSpan + 0.5) {
    lengths.push(maxSpan);
    placed += maxSpan;
  }

  let remainder = L - placed;
  if (remainder > 0.5) {
    if (remainder < config.minOffcut - 0.5) {
      const shortage = config.minOffcut - remainder;
      const prev = lengths[lengths.length - 1];
      const newPrev = prev - shortage;
      if (newPrev < config.minOffcut - 0.5) {
        return { error: `Nelze sestavit střídavý vzor bez dílu kratšího než ${Math.round(config.minOffcut)} mm.` };
      }
      lengths[lengths.length - 1] = newPrev;
      remainder += shortage;
    }
    lengths.push(remainder);
  }

  return { lengths };
}

export function computeOptimalLayout(config) {
  const rows = boardRows(config);
  const maxSpan = Math.min(config.boardLength, config.maxJoistSpacing);
  const baseResult = computeOptimalRowLengths(config);

  if (baseResult.error) {
    return {
      rows, pieces: [], packed: [],
      warnings: [{ type: "danger", text: baseResult.error }],
      invalidPattern: true,
    };
  }

  const stagger = Math.max(config.minOffcut, Math.floor(maxSpan / 2));
  const canAlternate = rows.length > 1 && stagger < maxSpan - 0.5;
  const offsetResult = canAlternate ? computeOptimalRowLengthsWithOffset(config, stagger) : null;
  const alternating = offsetResult && !offsetResult.error;

  const pieces = [];
  for (const row of rows) {
    const lengths = (alternating && row.index % 2 === 1) ? offsetResult.lengths : baseResult.lengths;
    let x = 0;
    lengths.forEach((length) => {
      pieces.push({
        id: `o-${row.index}-${pieces.length}`,
        row: row.index,
        x,
        y: row.y,
        length,
        width: row.width,
        patternIndex: row.index % 4,
      });
      x += length;
    });
  }

  const packed = packBoards(pieces.map((p) => p.length), config.boardLength);
  const infoText = alternating
    ? `Ideální rozložení: liché řady posunuty o ${Math.round(stagger)} mm, max. rozteč ${Math.round(config.maxJoistSpacing)} mm.`
    : `Ideální rozložení: max. rozteč ${Math.round(config.maxJoistSpacing)} mm. (Střídání nelze použít — zvyš max. rozteč nebo sniž min. odřezek.)`;

  return { rows, pieces, packed, warnings: [{ type: "info", text: infoText }] };
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

export function computeJoistPositions(config, pieces) {
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

export function computeJoistLayout(config, pieces, cutouts = []) {
  const positions = computeJoistPositions(config, pieces);
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

  const edgeOffset = Math.max(0, Number(config.pedestalEdgeOffset) || 0);
  const spacing = Math.max(100, Number(config.pedestalSpacing) || 500);

  if (length <= edgeOffset * 2 + 0.5) {
    return [segment.y1 + length / 2];
  }

  const first = segment.y1 + edgeOffset;
  const last = segment.y2 - edgeOffset;
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

export function packBoards(lengths, stockLength) {
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
