import assert from "node:assert/strict";
import test from "node:test";
import type { CellData, TerminalCore } from "@wterm/core";

import { patchWideCharRendererWorkaround } from "./wide-char-workaround";

function createCell(char: number): CellData {
  return {
    char,
    fg: 0,
    bg: 0,
    flags: 0,
  };
}

function createCore(cells: CellData[]): TerminalCore {
  return {
    init() {},
    resize() {},
    writeString() {},
    writeRaw() {},
    getCell(_row, col) {
      return cells[col] ?? createCell(32);
    },
    isDirtyRow() {
      return false;
    },
    clearDirty() {},
    getCols() {
      return cells.length;
    },
    getRows() {
      return 1;
    },
    getCursor() {
      return { row: 0, col: 0, visible: true };
    },
    cursorKeysApp() {
      return false;
    },
    bracketedPaste() {
      return false;
    },
    usingAltScreen() {
      return false;
    },
    getTitle() {
      return null;
    },
    getResponse() {
      return null;
    },
    getScrollbackCount() {
      return 1;
    },
    getScrollbackCell(_offset, col) {
      return cells[col] ?? createCell(32);
    },
    getScrollbackLineLen() {
      return cells.length;
    },
    getUnhandledSequences() {
      return [];
    },
  };
}

test("converts wide-character continuation cells into zero-width spaces for DOM rendering", () => {
  const core = createCore([
    createCell("あ".codePointAt(0)!),
    createCell(32),
    createCell("A".codePointAt(0)!),
  ]);

  patchWideCharRendererWorkaround(core);

  assert.equal(core.getCell(0, 0).char, "あ".codePointAt(0)!);
  assert.equal(core.getCell(0, 1).char, 0x200b);
  assert.equal(core.getCell(0, 2).char, "A".codePointAt(0)!);
  assert.equal(core.getScrollbackCell(0, 1).char, 0x200b);
});

test("does not rewrite normal spaces that are not wide-character continuations", () => {
  const core = createCore([
    createCell("A".codePointAt(0)!),
    createCell(32),
    createCell("B".codePointAt(0)!),
  ]);

  patchWideCharRendererWorkaround(core);

  assert.equal(core.getCell(0, 1).char, 32);
  assert.equal(core.getScrollbackCell(0, 1).char, 32);
});
