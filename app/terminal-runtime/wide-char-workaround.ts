import type { CellData } from "@wterm/core";

const DEFAULT_COLOR = 256;

type TerminalCellReader = {
  getCell: (row: number, col: number) => CellData;
  getScrollbackCell?: (row: number, col: number) => CellData;
};

function isWideCodePoint(codePoint: number): boolean {
  return (
    (codePoint >= 0x1100 && codePoint <= 0x115f) ||
    (codePoint >= 0x2e80 && codePoint <= 0x303e) ||
    (codePoint >= 0x3041 && codePoint <= 0x33ff) ||
    (codePoint >= 0x3400 && codePoint <= 0x4dbf) ||
    (codePoint >= 0x4e00 && codePoint <= 0x9fff) ||
    (codePoint >= 0xac00 && codePoint <= 0xd7a3) ||
    (codePoint >= 0xf900 && codePoint <= 0xfaff) ||
    (codePoint >= 0xff00 && codePoint <= 0xff60) ||
    (codePoint >= 0x1f300 && codePoint <= 0x1faff) ||
    (codePoint >= 0x20000 && codePoint <= 0x3fffd)
  );
}

function toZeroWidthContinuation(cell: CellData, previousCell: CellData | null): CellData {
  if (!previousCell || !isWideCodePoint(previousCell.char)) {
    return cell;
  }

  return {
    ...cell,
    char: 0x200b,
    fg: DEFAULT_COLOR,
    bg: DEFAULT_COLOR,
    flags: 0,
    fgRgb: undefined,
    bgRgb: undefined,
  };
}

export function patchWideCharRendererWorkaround(core: TerminalCellReader | null): void {
  if (!core || "__wideCharRendererPatched" in core) {
    return;
  }

  const patchedCore = core as TerminalCellReader & {
    __wideCharRendererPatched?: boolean;
  };
  const originalGetCell = core.getCell.bind(core);
  const originalGetScrollbackCell = core.getScrollbackCell?.bind(core);

  patchedCore.getCell = (row, col) => {
    const cell = originalGetCell(row, col);

    if (col === 0) {
      return cell;
    }

    return toZeroWidthContinuation(cell, originalGetCell(row, col - 1));
  };

  if (originalGetScrollbackCell) {
    patchedCore.getScrollbackCell = (row, col) => {
      const cell = originalGetScrollbackCell(row, col);

      if (col === 0) {
        return cell;
      }

      return toZeroWidthContinuation(cell, originalGetScrollbackCell(row, col - 1));
    };
  }

  patchedCore.__wideCharRendererPatched = true;
}
