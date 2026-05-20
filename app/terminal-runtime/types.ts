import type { TraceEntry } from "@wterm/dom";

import type { DebugLog } from "../debug-mode";
import type { CoreType } from "../core-preference";
import type { SshModeConfig } from "../ssh-mode";

export type TerminalMode = "local" | "ssh";
export type ConnectionStatus = "disconnected" | "connecting" | "connected" | "error";

export interface ConnectionState {
  status: ConnectionStatus;
  connected: boolean;
  reconnectAttempt: number;
  errorMessage: string | null;
}

export interface HexEntry {
  timestamp: number;
  byteLength: number;
  dump: string;
}

export type DiagnosticsAvailability = "disabled" | "ready" | "degraded";

export interface DiagnosticsSnapshot {
  availability: DiagnosticsAvailability;
  message: string | null;
  logs: DebugLog[];
  hexEntries: HexEntry[];
  hexOffset: number;
  lastTrace: TraceEntry | null;
}

export interface TerminalRuntimeProps {
  mode: TerminalMode;
  sessionName: string;
  sshConfig: SshModeConfig;
  coreType: CoreType;
  debugEnabled: boolean;
  onConnectionStateChange?: (state: ConnectionState) => void;
  onTitleChange?: (title: string) => void;
  onDiagnosticsChange?: (snapshot: DiagnosticsSnapshot) => void;
  className?: string;
}

export interface TerminalRuntimeHandle {
  connect: (targetSession?: string) => void;
  disconnect: () => void;
}
