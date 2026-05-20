import assert from "node:assert/strict";
import test from "node:test";
import type { TerminalCore } from "@wterm/core";

import {
  BUILTIN_WASM_URL,
  GHOSTTY_WASM_PATH,
  getGhosttyLoadOptions,
  getTerminalCoreProps,
} from "./core-loader";

function createTerminalCore(): TerminalCore {
  return {
    init() {},
    resize() {},
    writeString() {},
    writeRaw() {},
    getCell() {
      return { char: 32, fg: 0, bg: 0, flags: 0 };
    },
    isDirtyRow() {
      return false;
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

test("uses the built-in wasm url for the default runtime core", () => {
  assert.equal(BUILTIN_WASM_URL, "/wterm.wasm");
  assert.deepEqual(getTerminalCoreProps("builtin", null), {
    wasmUrl: "/wterm.wasm",
  });
});

test("requires a loaded ghostty core for the runtime boundary", () => {
  assert.equal(GHOSTTY_WASM_PATH, "/ghostty.wasm");
  assert.equal(getTerminalCoreProps("ghostty", null), null);

  const ghosttyCore = createTerminalCore();
  assert.deepEqual(getTerminalCoreProps("ghostty", ghosttyCore), {
    core: ghosttyCore,
  });
});

test("exposes Ghostty load options for the runtime loader", () => {
  assert.deepEqual(getGhosttyLoadOptions(), {
    wasmPath: "/ghostty.wasm",
  });
});
