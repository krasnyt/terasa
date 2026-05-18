"use strict";

export const DEFAULTS = {
  terraceLength: 5000,
  terraceWidth: 2150,
  boardLength: 2300,
  boardWidth: 178,
  gap: 6,
  minOffcut: 250,
  patternRows: 3,
  joistEdgeOffset: 200,
  maxJoistSpacing: 1000,
  pedestalVerticalOffset: 300,
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

export function loadConfig() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    const boardLength = savedNumber(saved.boardLength, DEFAULTS.boardLength);
    const legacyPedestalOffset = savedNumber(saved.pedestalEdgeOffset, DEFAULTS.pedestalVerticalOffset, { allowZero: true });
    const previousSplitPedestalOffset = savedNumber(saved.pedestalStartOffset ?? saved.pedestalEndOffset, legacyPedestalOffset, { allowZero: true });
    return {
      ...DEFAULTS,
      ...saved,
      terraceLength: savedNumber(saved.terraceLength, DEFAULTS.terraceLength),
      terraceWidth: savedNumber(saved.terraceWidth, DEFAULTS.terraceWidth),
      boardLength,
      boardWidth: savedNumber(saved.boardWidth, DEFAULTS.boardWidth),
      gap: savedNumber(saved.gap, DEFAULTS.gap, { allowZero: true }),
      minOffcut: savedNumber(saved.minOffcut, DEFAULTS.minOffcut, { allowZero: true }),
      patternRows: Math.max(1, Math.round(savedNumber(saved.patternRows, DEFAULTS.patternRows))),
      joistEdgeOffset: savedNumber(saved.joistEdgeOffset, DEFAULTS.joistEdgeOffset, { allowZero: true }),
      maxJoistSpacing: Math.max(100, savedNumber(saved.maxJoistSpacing, DEFAULTS.maxJoistSpacing)),
      pedestalVerticalOffset: savedNumber(saved.pedestalVerticalOffset, previousSplitPedestalOffset, { allowZero: true }),
      pedestalSpacing: Math.max(100, savedNumber(saved.pedestalSpacing, DEFAULTS.pedestalSpacing)),
      manualPieceLength: savedNumber(saved.manualPieceLength, boardLength),
      layDirection: saved.layDirection === "right" ? "right" : "left",
    };
  } catch {
    return { ...DEFAULTS };
  }
}

export function applyConfig(inputs, config) {
  inputs.terraceLength.value = config.terraceLength;
  inputs.terraceWidth.value = config.terraceWidth;
  inputs.boardLength.value = config.boardLength;
  inputs.boardWidth.value = config.boardWidth;
  inputs.gap.value = config.gap;
  inputs.minOffcut.value = config.minOffcut;
  inputs.patternRows.value = config.patternRows;
  inputs.joistEdgeOffset.value = config.joistEdgeOffset;
  inputs.maxJoistSpacing.value = config.maxJoistSpacing;
  inputs.pedestalVerticalOffset.value = config.pedestalVerticalOffset;
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
    boardWidth: numberValue(inputs.boardWidth, DEFAULTS.boardWidth),
    gap: Math.max(0, Number(inputs.gap.value) || 0),
    minOffcut: Math.max(0, Number(inputs.minOffcut.value) || 0),
    patternRows: Math.max(1, Math.round(numberValue(inputs.patternRows, DEFAULTS.patternRows))),
    joistEdgeOffset: Math.max(0, Number(inputs.joistEdgeOffset.value) || 0),
    maxJoistSpacing: Math.max(100, numberValue(inputs.maxJoistSpacing, DEFAULTS.maxJoistSpacing)),
    pedestalVerticalOffset: Math.max(0, Number(inputs.pedestalVerticalOffset.value) || 0),
    pedestalSpacing: Math.max(100, numberValue(inputs.pedestalSpacing, DEFAULTS.pedestalSpacing)),
    manualPieceLength: numberValue(inputs.manualPieceLength, inputs.boardLength.value || DEFAULTS.boardLength),
    layDirection: directionValue(inputs.layDirection),
  };
}
