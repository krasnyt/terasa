"use strict";

export const DEFAULTS = {
  terraceLength: 5000,
  terraceWidth: 2150,
  boardLength: 2300,
  stockBoards: "",
  boardWidth: 178,
  gap: 6,
  sawKerf: 2,
  minOffcut: 250,
  patternRows: 3,
  joistLeftOffset: 200,
  joistRightOffset: 200,
  pedestalTopOffset: 300,
  pedestalBottomOffset: 300,
  pedestalSpacing: 500,
  manualPieceLength: 2300,
  layDirection: "left",
};

export const STORAGE_KEY = "terasa-navrh";

function numberValue(input, fallback) {
  const value = Number(input.value);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function directionValue(radios) {
  return Array.from(radios).find((radio) => radio.checked)?.value === "right" ? "right" : "left";
}

function savedNumber(value, fallback, options = {}) {
  if (value === "" || value === null || value === undefined) return fallback;
  const numeric = Number(value);
  const min = options.min ?? 0;
  const allowZero = options.allowZero ?? false;
  if (!Number.isFinite(numeric)) return fallback;
  if (allowZero) return numeric >= min ? numeric : fallback;
  return numeric > min ? numeric : fallback;
}

export function normalizeConfig(value = {}) {
  const saved = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const boardLength = savedNumber(saved.boardLength, DEFAULTS.boardLength);
  const legacyJoistOffset = savedNumber(saved.joistEdgeOffset, DEFAULTS.joistLeftOffset, { allowZero: true });
  const legacyPedestalOffset = savedNumber(saved.pedestalEdgeOffset, DEFAULTS.pedestalTopOffset, { allowZero: true });
  const previousSplitPedestalOffset = savedNumber(saved.pedestalVerticalOffset ?? saved.pedestalStartOffset ?? saved.pedestalEndOffset, legacyPedestalOffset, { allowZero: true });
  return {
    ...DEFAULTS,
    ...saved,
    terraceLength: savedNumber(saved.terraceLength, DEFAULTS.terraceLength),
    terraceWidth: savedNumber(saved.terraceWidth, DEFAULTS.terraceWidth),
    boardLength,
    stockBoards: typeof saved.stockBoards === "string" ? saved.stockBoards : DEFAULTS.stockBoards,
    boardWidth: savedNumber(saved.boardWidth, DEFAULTS.boardWidth),
    gap: savedNumber(saved.gap, DEFAULTS.gap, { allowZero: true }),
    sawKerf: savedNumber(saved.sawKerf, DEFAULTS.sawKerf, { allowZero: true }),
    minOffcut: savedNumber(saved.minOffcut, DEFAULTS.minOffcut, { allowZero: true }),
    patternRows: Math.max(1, Math.round(savedNumber(saved.patternRows, DEFAULTS.patternRows))),
    joistLeftOffset: savedNumber(saved.joistLeftOffset, legacyJoistOffset, { allowZero: true }),
    joistRightOffset: savedNumber(saved.joistRightOffset, legacyJoistOffset, { allowZero: true }),
    pedestalTopOffset: savedNumber(saved.pedestalTopOffset, previousSplitPedestalOffset, { allowZero: true }),
    pedestalBottomOffset: savedNumber(saved.pedestalBottomOffset, previousSplitPedestalOffset, { allowZero: true }),
    pedestalSpacing: Math.max(100, savedNumber(saved.pedestalSpacing, DEFAULTS.pedestalSpacing)),
    manualPieceLength: savedNumber(saved.manualPieceLength, boardLength),
    layDirection: saved.layDirection === "right" ? "right" : "left",
  };
}

export function loadConfig() {
  try {
    return normalizeConfig(JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"));
  } catch {
    return { ...DEFAULTS };
  }
}

export function applyConfig(inputs, config) {
  inputs.terraceLength.value = config.terraceLength;
  inputs.terraceWidth.value = config.terraceWidth;
  inputs.boardLength.value = config.boardLength;
  inputs.stockBoards.value = config.stockBoards || "";
  inputs.boardWidth.value = config.boardWidth;
  inputs.gap.value = config.gap;
  inputs.sawKerf.value = config.sawKerf;
  inputs.minOffcut.value = config.minOffcut;
  inputs.patternRows.value = config.patternRows;
  inputs.joistLeftOffset.value = config.joistLeftOffset;
  inputs.joistRightOffset.value = config.joistRightOffset;
  inputs.pedestalTopOffset.value = config.pedestalTopOffset;
  inputs.pedestalBottomOffset.value = config.pedestalBottomOffset;
  inputs.pedestalSpacing.value = config.pedestalSpacing;
  inputs.manualPieceLength.value = config.manualPieceLength;
  Array.from(inputs.layDirection).forEach((radio) => {
    radio.checked = radio.value === (config.layDirection === "right" ? "right" : "left");
  });
}

export function readConfig(inputs) {
  return {
    terraceLength: numberValue(inputs.terraceLength, DEFAULTS.terraceLength),
    terraceWidth: numberValue(inputs.terraceWidth, DEFAULTS.terraceWidth),
    boardLength: numberValue(inputs.boardLength, DEFAULTS.boardLength),
    stockBoards: String(inputs.stockBoards?.value || "").trim(),
    boardWidth: numberValue(inputs.boardWidth, DEFAULTS.boardWidth),
    gap: Math.max(0, Number(inputs.gap.value) || 0),
    sawKerf: Math.max(0, Number(inputs.sawKerf.value) || 0),
    minOffcut: Math.max(0, Number(inputs.minOffcut.value) || 0),
    patternRows: Math.max(1, Math.round(numberValue(inputs.patternRows, DEFAULTS.patternRows))),
    joistLeftOffset: Math.max(0, Number(inputs.joistLeftOffset.value) || 0),
    joistRightOffset: Math.max(0, Number(inputs.joistRightOffset.value) || 0),
    pedestalTopOffset: Math.max(0, Number(inputs.pedestalTopOffset.value) || 0),
    pedestalBottomOffset: Math.max(0, Number(inputs.pedestalBottomOffset.value) || 0),
    pedestalSpacing: Math.max(100, numberValue(inputs.pedestalSpacing, DEFAULTS.pedestalSpacing)),
    manualPieceLength: numberValue(inputs.manualPieceLength, inputs.boardLength.value || DEFAULTS.boardLength),
    layDirection: directionValue(inputs.layDirection),
  };
}
