import assert from "node:assert/strict";
import test from "node:test";

import type { TraceEntry } from "@wterm/dom";
import { DebugAdapter } from "@wterm/dom";

import {
  collectDiagnosticsSnapshot,
  createDiagnosticsState,
  syncDebugAdapter,
  type RuntimeDebugTerminalLike,
} from "./diagnostics";

test("collects hex dump and trace logs when runtime diagnostics are available", () => {
  const traces: TraceEntry[] = [{ ts: 1, type: "osc", raw: "\u001b]0;vim\u0007" }];
  const result = collectDiagnosticsSnapshot(createDiagnosticsState(), {
    enabled: true,
    timestamp: 123,
    data: "A",
    terminal: {
      bridge: { ready: true },
      debug: { traces } as unknown as RuntimeDebugTerminalLike["debug"],
    },
  });

  assert.equal(result.availability, "ready");
  assert.equal(result.logs.length, 1);
  assert.equal(result.logs[0]?.type, "OSC");
  assert.equal(result.hexEntries.length, 1);
  assert.equal(result.hexEntries[0]?.dump, "00000000  41                                               |A|");
});

test("degrades gracefully when debug traces are unavailable but still keeps hex dump data", () => {
  const result = collectDiagnosticsSnapshot(createDiagnosticsState(), {
    enabled: true,
    timestamp: 123,
    data: "A",
    terminal: {
      bridge: null,
      debug: null,
    },
  });

  assert.equal(result.availability, "degraded");
  assert.equal(result.logs.length, 0);
  assert.equal(result.hexEntries.length, 1);
  assert.equal(result.message, "wterm debug traces unavailable");
});

test("enables and disables the wterm DebugAdapter on an existing runtime terminal", () => {
  const terminal: RuntimeDebugTerminalLike = {
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
