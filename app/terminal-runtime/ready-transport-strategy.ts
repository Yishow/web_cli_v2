import type { TerminalMode } from "./types";

export type ReadyTransportStrategy = "fresh-connect" | "manual";

export function getReadyTransportStrategy(mode: TerminalMode): ReadyTransportStrategy {
  return mode === "local" ? "fresh-connect" : "manual";
}
