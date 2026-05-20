import type { CellData, TerminalCore } from "@wterm/core";

const patchedCores = new WeakSet<TerminalCore>();
const ZERO_WIDTH_SPACE = 0x200b;

function isWideCodePoint(codePoint: number): boolean {
  return (
    (codePoint >= 0x1100 && codePoint <= 0x115f) ||
    (codePoint >= 0x2329 && codePoint <= 0x232a) ||
    (codePoint >= 0x2e80 && codePoint <= 0xa4cf) ||
    (codePoint >= 0xac00 && codePoint <= 0xd7a3) ||
    (codePoint >= 0xf900 && codePoint <= 0xfaff) ||
    (codePoint >= 0xfe10 && codePoint <= 0xfe19) ||
    (codePoint >= 0xfe30 && codePoint <= 0xfe6f) ||
    (codePoint >= 0xff00 && codePoint <= 0xff60) ||
    (codePoint >= 0xffe0 && codePoint <= 0xffe6) ||
    (codePoint >= 0x1f300 && codePoint <= 0x1faff) ||
    (codePoint >= 0x20000 && codePoint <= 0x3fffd)
  );
}

function normalizeContinuationCell(cell: CellData, previousCell: CellData | null): CellData {
  if (!previousCell || !isWideCodePoint(previousCell.char)) {
    return cell;
  }

  if (cell.char !== 0 && cell.char !== 32) {
    return cell;
  }

  return {
    ...cell,
    char: ZERO_WIDTH_SPACE,
  };
}

export function patchWideCharRendererWorkaround(core: TerminalCore | null): void {
  if (!core || patchedCores.has(core)) {
    return;
  }

  const getCell = core.getCell.bind(core);
  const getScrollbackCell = core.getScrollbackCell.bind(core);

  core.getCell = (row, col) => {
    const cell = getCell(row, col);
    const previousCell = col > 0 ? getCell(row, col - 1) : null;

    return normalizeContinuationCell(cell, previousCell);
  };

  core.getScrollbackCell = (offset, col) => {
    const cell = getScrollbackCell(offset, col);
    const previousCell = col > 0 ? getScrollbackCell(offset, col - 1) : null;

    return normalizeContinuationCell(cell, previousCell);
  };

  patchedCores.add(core);
}
