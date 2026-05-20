import assert from "node:assert/strict";
import test from "node:test";

import type { CellData } from "@wterm/core";

import { patchWideCharRendererWorkaround } from "./wide-char-workaround";

function createCell(char: number): CellData {
  return {
    char,
    fg: 7,
    bg: 0,
    flags: 0,
  };
}

test("converts continuation cells after wide glyphs into zero-width spaces", () => {
  const grid = [
    [createCell("中".codePointAt(0) ?? 0), createCell(0x20), createCell("a".codePointAt(0) ?? 0)],
  ];
  const core = {
    getCell(row: number, col: number) {
      return grid[row][col];
    },
  };

  patchWideCharRendererWorkaround(core);

  assert.equal(core.getCell(0, 0).char, "中".codePointAt(0));
  assert.equal(core.getCell(0, 1).char, 0x200b);
  assert.equal(core.getCell(0, 2).char, "a".codePointAt(0));
});

test("mirrors the same zero-width continuation handling for scrollback cells", () => {
  const scrollback = [
    [createCell("📁".codePointAt(0) ?? 0), createCell(0x20), createCell("x".codePointAt(0) ?? 0)],
  ];
  const core = {
    getCell() {
      return createCell(0x20);
    },
    getScrollbackCell(row: number, col: number) {
      return scrollback[row][col];
    },
  };

  patchWideCharRendererWorkaround(core);

  assert.equal(core.getScrollbackCell?.(0, 1).char, 0x200b);
  assert.equal(core.getScrollbackCell?.(0, 2).char, "x".codePointAt(0));
});

test("leaves normal spaces untouched when the previous cell is not wide", () => {
  const grid = [[createCell("A".codePointAt(0) ?? 0), createCell(0x20)]];
  const core = {
    getCell(row: number, col: number) {
      return grid[row][col];
    },
  };

  patchWideCharRendererWorkaround(core);

  assert.equal(core.getCell(0, 1).char, 0x20);
});
