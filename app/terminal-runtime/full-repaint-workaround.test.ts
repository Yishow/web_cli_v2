import assert from "node:assert/strict";
import test from "node:test";
import type { TerminalCore } from "@wterm/core";

import { patchFullRepaintWorkaround } from "./full-repaint-workaround";

function createCore(): TerminalCore {
  return {
    init() {},
    resize() {},
    writeString() {},
    writeRaw() {},
    getCell() {
      return { char: 32, fg: 0, bg: 0, flags: 0 };
    },
    isDirtyRow(row: number) {
      return row === 0;
    },
    clearDirty() {},
    getCols() {
      return 80;
    },
    getRows() {
      return 24;
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
      return 0;
    },
    getScrollbackCell() {
      return { char: 32, fg: 0, bg: 0, flags: 0 };
    },
    getScrollbackLineLen() {
      return 0;
    },
    getUnhandledSequences() {
      return [];
    },
  };
}

test("forces all rows to repaint once the workaround is attached", () => {
  const core = createCore();

  patchFullRepaintWorkaround(core);

  assert.equal(core.isDirtyRow(0), true);
  assert.equal(core.isDirtyRow(10), true);
  assert.equal(core.isDirtyRow(23), true);
});
