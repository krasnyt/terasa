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
};

export const STORAGE_KEY = "terasa-navrh";

function numberValue(input, fallback) {
  const value = Number(input.value);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

export function loadConfig() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    return { ...DEFAULTS, ...saved };
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
  };
}
