import assert from "node:assert/strict";
import test from "node:test";

import {
  appendRingBuffer,
  formatHexDump,
  getInitialDebugMode,
  isDebugToggleShortcut,
  readDebugMode,
  setDebugModeSearch,
} from "./debug-mode";

test("starts with debug mode disabled before client hydration", () => {
  assert.equal(getInitialDebugMode(), false);
});

test("reads debug mode from the URL query string", () => {
  assert.equal(readDebugMode("?debug=true"), true);
  assert.equal(readDebugMode("?debug=false"), false);
  assert.equal(readDebugMode("?theme=light"), false);
});

test("adds and removes the debug query parameter without losing others", () => {
  assert.equal(setDebugModeSearch("?theme=light", true), "?theme=light&debug=true");
  assert.equal(setDebugModeSearch("?theme=light&debug=true", false), "?theme=light");
  assert.equal(setDebugModeSearch("?debug=true", false), "");
});

test("matches the Ctrl+Shift+D shortcut case-insensitively", () => {
  assert.equal(isDebugToggleShortcut({ ctrlKey: true, shiftKey: true, key: "D" }), true);
  assert.equal(isDebugToggleShortcut({ ctrlKey: true, shiftKey: true, key: "d" }), true);
  assert.equal(isDebugToggleShortcut({ ctrlKey: true, shiftKey: false, key: "D" }), false);
});

test("formats PTY output as a traditional hex dump with running offsets", () => {
  const result = formatHexDump("A你", 0x10);

  assert.equal(result.byteLength, 4);
  assert.equal(result.nextOffset, 0x14);
  assert.equal(result.dump, "00000010  41 e4 bd a0                                      |A...|");
});

test("keeps only the newest ring buffer entries", () => {
  const result = appendRingBuffer([1, 2, 3], 4, 3);

  assert.deepEqual(result, [2, 3, 4]);
});
