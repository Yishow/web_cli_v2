import type { TerminalCore } from "@wterm/core";

import type { CoreType } from "./core-preference";

export const BUILTIN_WASM_URL = "/wterm.wasm";
export const GHOSTTY_WASM_PATH = "/ghostty.wasm";

export function getTerminalCoreProps(
  coreType: CoreType,
  ghosttyCore: TerminalCore | null,
): { wasmUrl: string } | { core: TerminalCore } | null {
  if (coreType === "ghostty") {
    return ghosttyCore ? { core: ghosttyCore } : null;
  }

  return { wasmUrl: BUILTIN_WASM_URL };
}

export function getGhosttyLoadOptions(): { wasmPath: string } {
  return { wasmPath: GHOSTTY_WASM_PATH };
}
