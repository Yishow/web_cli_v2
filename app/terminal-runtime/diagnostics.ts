import { DebugAdapter, type TraceEntry } from "@wterm/dom";

import { appendRingBuffer, formatHexDump, MAX_DEBUG_ENTRIES, type DebugLog } from "../debug-mode";

import type { DiagnosticsSnapshot } from "./types";

export interface RuntimeDebugTerminalLike {
  bridge: unknown | null;
  debug: (DebugAdapter & { traces?: readonly TraceEntry[] }) | null;
}

export interface CollectDiagnosticsOptions {
  enabled: boolean;
  timestamp: number;
  data: string | Uint8Array;
  terminal: RuntimeDebugTerminalLike | null;
}

export function createDiagnosticsState(): DiagnosticsSnapshot {
  return {
    availability: "disabled",
    message: null,
    logs: [],
    hexEntries: [],
    hexOffset: 0,
    lastTrace: null,
  };
}

export function collectDiagnosticsSnapshot(
  state: DiagnosticsSnapshot,
  options: CollectDiagnosticsOptions,
): DiagnosticsSnapshot {
  if (!options.enabled) {
    return createDiagnosticsState();
  }

  syncDebugAdapter(options.terminal, true);

  const dump = formatHexDump(options.data, state.hexOffset);
  const nextState: DiagnosticsSnapshot = {
    availability: "ready",
    message: null,
    logs: state.logs,
    hexEntries: appendRingBuffer(
      state.hexEntries,
      {
        timestamp: options.timestamp,
        byteLength: dump.byteLength,
        dump: dump.dump,
      },
      MAX_DEBUG_ENTRIES,
    ),
    hexOffset: dump.nextOffset,
    lastTrace: state.lastTrace,
  };

  const traces = options.terminal?.debug?.traces;
  if (!traces) {
    return {
      ...nextState,
      availability: "degraded",
      message: "wterm debug traces unavailable",
    };
  }

  const startIndex = state.lastTrace ? Math.max(traces.lastIndexOf(state.lastTrace) + 1, 0) : 0;
  const logs = traces.slice(startIndex).map((trace) => toDebugLog(trace, options.timestamp));

  return {
    ...nextState,
    logs: logs.reduce((entries, log) => appendRingBuffer(entries, log, MAX_DEBUG_ENTRIES), state.logs),
    lastTrace: traces.at(-1) ?? state.lastTrace,
  };
}

export function syncDebugAdapter(terminal: RuntimeDebugTerminalLike | null, enabled: boolean): void {
  if (!terminal) {
    return;
  }

  if (!enabled) {
    terminal.debug = null;
    return;
  }

  if (terminal.debug || !terminal.bridge) {
    return;
  }

  const adapter = new DebugAdapter();
  adapter.setBridge(terminal.bridge as never);
  terminal.debug = adapter as RuntimeDebugTerminalLike["debug"];
}

function toDebugLog(trace: TraceEntry, timestamp: number): DebugLog {
  return {
    timestamp,
    type: trace.type.toUpperCase(),
    sequence: JSON.stringify(trace.raw).slice(1, -1),
    description: describeTrace(trace),
  };
}

function describeTrace(trace: TraceEntry): string {
  if (trace.type === "osc") {
    return "Operating system command";
  }

  if (trace.type === "csi") {
    const params = trace.params?.length ? ` params=[${trace.params.join(",")}]` : "";
    return `Control sequence ${trace.final ?? ""}${params}`.trim();
  }

  if (trace.type === "sgr") {
    const params = trace.params?.length ? ` params=[${trace.params.join(",")}]` : "";
    return `Select graphic rendition${params}`;
  }

  if (trace.type === "esc") {
    return `Escape sequence ${trace.final ?? ""}`.trim();
  }

  return `Text output (${trace.raw.length} chars)`;
}
