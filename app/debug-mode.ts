export const DEBUG_QUERY_PARAM = "debug";
export const MAX_DEBUG_ENTRIES = 1000;

export interface DebugLog {
  timestamp: number;
  type: string;
  sequence: string;
  description: string;
}

export function getInitialDebugMode(): boolean {
  return false;
}

export function readDebugMode(search: string): boolean {
  return new URLSearchParams(search).get(DEBUG_QUERY_PARAM) === "true";
}

export function setDebugModeSearch(search: string, enabled: boolean): string {
  const params = new URLSearchParams(search);

  if (enabled) {
    params.set(DEBUG_QUERY_PARAM, "true");
  } else {
    params.delete(DEBUG_QUERY_PARAM);
  }

  const next = params.toString();
  return next ? `?${next}` : "";
}

export function isDebugToggleShortcut(event: {
  ctrlKey: boolean;
  shiftKey: boolean;
  key: string;
}): boolean {
  return event.ctrlKey && event.shiftKey && event.key.toLowerCase() === "d";
}

export function appendRingBuffer<T>(entries: readonly T[], entry: T, limit: number): T[] {
  const next = [...entries, entry];
  return next.length > limit ? next.slice(-limit) : next;
}

export function formatHexDump(
  data: string | Uint8Array,
  startOffset = 0,
): { dump: string; byteLength: number; nextOffset: number } {
  const bytes = typeof data === "string" ? new TextEncoder().encode(data) : data;
  const lines: string[] = [];

  for (let index = 0; index < bytes.length; index += 16) {
    const slice = bytes.subarray(index, index + 16);
    const hex = Array.from(slice, (byte) => byte.toString(16).padStart(2, "0")).join(" ");
    const ascii = Array.from(slice, (byte) =>
      byte >= 0x20 && byte <= 0x7e ? String.fromCharCode(byte) : ".",
    ).join("");
    const offset = (startOffset + index).toString(16).padStart(8, "0");
    lines.push(`${offset}  ${hex.padEnd(47, " ")}  |${ascii}|`);
  }

  return {
    dump: lines.join("\n"),
    byteLength: bytes.length,
    nextOffset: startOffset + bytes.length,
  };
}
