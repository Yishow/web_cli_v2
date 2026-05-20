import assert from "node:assert/strict";
import test from "node:test";

import { DebugAdapter, type TraceEntry } from "@wterm/dom";

import {
  appendRingBuffer,
  collectTraceLogs,
  formatHexDump,
  getInitialDebugMode,
  isDebugToggleShortcut,
  readDebugMode,
  setDebugModeSearch,
  syncDebugAdapter,
  type DebugTerminalLike,
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

test("collects new trace logs from the last unread trace index", () => {
  const traces: TraceEntry[] = [
    { ts: 1, type: "text", raw: "hello" },
    { ts: 2, type: "osc", raw: "\u001b]0;vim\u0007" },
    { ts: 3, type: "csi", raw: "\u001b[31m", params: [31], final: "m" },
  ];

  const result = collectTraceLogs(traces, 1, 123);

  assert.equal(result.nextIndex, 3);
  assert.deepEqual(result.logs, [
    {
      timestamp: 123,
      type: "OSC",
      sequence: "\\u001b]0;vim\\u0007",
      description: "Operating system command",
    },
    {
      timestamp: 123,
      type: "CSI",
      sequence: "\\u001b[31m",
      description: "Control sequence m params=[31]",
    },
  ]);
});

test("keeps only the newest ring buffer entries", () => {
  const result = appendRingBuffer([1, 2, 3], 4, 3);

  assert.deepEqual(result, [2, 3, 4]);
});

test("enables and disables the wterm DebugAdapter on an existing instance", () => {
  const terminal: DebugTerminalLike = {
    bridge: { ready: true },
    debug: null,
  };

  syncDebugAdapter(terminal, true);
  assert.ok(terminal.debug instanceof DebugAdapter);

  const firstAdapter = terminal.debug;
  syncDebugAdapter(terminal, true);
  assert.equal(terminal.debug, firstAdapter);

  syncDebugAdapter(terminal, false);
  assert.equal(terminal.debug, null);
});
