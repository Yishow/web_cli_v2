"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import type { TerminalCore } from "@wterm/core";
import type { WTerm } from "@wterm/dom";
import { GhosttyCore } from "@wterm/ghostty";
import { Terminal, useTerminal } from "@wterm/react";

import {
  formatReconnectFailureMessage,
  formatReconnectedMessage,
  formatReconnectProgressMessage,
  getReconnectDelay,
  MAX_RECONNECT_ATTEMPTS,
} from "../reconnect";
import { buildSshConnectPayload } from "../ssh-mode";
import { TERMINAL_STYLE } from "../terminal-style";
import { parseSshControlMessage } from "../../src/ssh-control-message";
import { patchBoxDrawingRendererWorkaround } from "./box-drawing-workaround";
import { getGhosttyLoadOptions, getTerminalCoreProps } from "./core-loader";
import { collectDiagnosticsSnapshot, createDiagnosticsState, syncDebugAdapter } from "./diagnostics";
import { attachImeCompositionAnchor } from "./ime-anchor";
import { createTerminalOutputBatcher } from "./output-batcher";
import { getReadyTransportStrategy } from "./ready-transport-strategy";
import { sendResizeControlMessage } from "./resize-control-message";
import { buildTransportWebSocketUrl } from "./transport";
import type { ConnectionStatus, TerminalRuntimeHandle, TerminalRuntimeProps } from "./types";
import { patchWideCharRendererWorkaround } from "./wide-char-workaround";

export const TerminalRuntime = forwardRef<TerminalRuntimeHandle, TerminalRuntimeProps>(
  function TerminalRuntime(
    {
      mode,
      sessionName,
      sshConfig,
      coreType,
      debugEnabled,
      onConnectionStateChange,
      onTitleChange,
      onDiagnosticsChange,
      className,
    },
    forwardedRef,
  ) {
    const [connected, setConnected] = useState(false);
    const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("disconnected");
    const [connectionError, setConnectionError] = useState<string | null>(null);
    const [reconnectAttempt, setReconnectAttempt] = useState(0);
    const [ghosttyCore, setGhosttyCore] = useState<TerminalCore | null>(null);
    const [ghosttyLoadError, setGhosttyLoadError] = useState<string | null>(null);
    const [diagnosticsState, setDiagnosticsState] = useState(createDiagnosticsState);
    const [coreReady, setCoreReady] = useState(false);

    const { ref, write } = useTerminal();
    const wsRef = useRef<WebSocket | null>(null);
    const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const reconnectAttemptRef = useRef(0);
    const intentionalCloseRef = useRef(false);
    const closeReasonRef = useRef<"intentional" | "error" | null>(null);
    const connectionSessionRef = useRef(sessionName);
    const imeAnchorCleanupRef = useRef<(() => void) | null>(null);
    const outputBatcherRef = useRef(
      createTerminalOutputBatcher({
        write,
        schedule(flush) {
          const timer = window.setTimeout(flush, 8);
          return () => {
            window.clearTimeout(timer);
          };
        },
      }),
    );
    const viewportRef = useRef<{ cols: number; rows: number } | null>(null);
    const openSocketRef = useRef<(targetSession: string) => void>(() => {});
    const debugEnabledRef = useRef(debugEnabled);
    const modeRef = useRef(mode);
    const sshConfigRef = useRef(sshConfig);

    const clearReconnectTimer = useCallback(() => {
      if (reconnectTimerRef.current !== null) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
    }, []);

    const setReconnectState = useCallback((attempt: number) => {
      reconnectAttemptRef.current = attempt;
      setReconnectAttempt(attempt);
    }, []);

    const scheduleReconnect = useCallback(
      (attempt: number) => {
        if (attempt > MAX_RECONNECT_ATTEMPTS) {
          clearReconnectTimer();
          setReconnectState(0);
          setConnectionStatus("error");
          setConnectionError("Local shell reconnect exhausted");
          write(formatReconnectFailureMessage());
          return;
        }

        const delay = getReconnectDelay(attempt);
        setReconnectState(attempt);
        setConnectionStatus("connecting");
        setConnectionError(null);
        write(formatReconnectProgressMessage(attempt, delay));
        clearReconnectTimer();
        reconnectTimerRef.current = setTimeout(() => {
          openSocketRef.current(connectionSessionRef.current);
        }, delay);
      },
      [clearReconnectTimer, setReconnectState, write],
    );

    const openSocket = useCallback(
      (targetSession: string) => {
        connectionSessionRef.current = targetSession;

        const target =
          modeRef.current === "ssh"
            ? { mode: "ssh" as const }
            : { mode: "local" as const, sessionName: targetSession };
        const ws = new WebSocket(buildTransportWebSocketUrl(window.location, target));
        wsRef.current = ws;
        setConnectionStatus("connecting");
        setConnectionError(null);
        setConnected(false);

        ws.onopen = () => {
          if (wsRef.current !== ws) {
            return;
          }

          const didReconnect = reconnectAttemptRef.current > 0;

          clearReconnectTimer();
          setReconnectState(0);
          intentionalCloseRef.current = false;
          closeReasonRef.current = null;

          if (modeRef.current === "ssh") {
            const payload = buildSshConnectPayload(sshConfigRef.current);

            if (!payload) {
              setConnectionStatus("error");
              setConnectionError("SSH 連線參數不完整");
              closeReasonRef.current = "error";
              ws.close();
              return;
            }

            ws.send(JSON.stringify(payload));
            return;
          }

          setConnected(true);
          setConnectionStatus("connected");
          setConnectionError(null);
          sendResizeControlMessage(ws, viewportRef.current);

          if (didReconnect) {
            write(formatReconnectedMessage());
          }
        };

        ws.onmessage = (event: MessageEvent) => {
          if (wsRef.current !== ws) {
            return;
          }

          const data = event.data as string;
          const controlMessage = parseSshControlMessage(data);

          if (controlMessage) {
            if (controlMessage.type === "ready") {
              const didReconnect = reconnectAttemptRef.current > 0;

              setConnected(true);
              setConnectionStatus("connected");
              setConnectionError(null);
              setReconnectState(0);

              if (didReconnect) {
                write(formatReconnectedMessage());
              }
            } else {
              setConnected(false);
              setConnectionStatus("error");
              setConnectionError(controlMessage.message);
              closeReasonRef.current = "error";
              write(`\r\n\x1b[31m${controlMessage.message}\x1b[0m\r\n`);
              ws.close();
            }

            return;
          }

          outputBatcherRef.current.enqueue(data);
          setDiagnosticsState((previous) =>
            collectDiagnosticsSnapshot(previous, {
              enabled: debugEnabledRef.current,
              timestamp: Date.now(),
              data,
              terminal: ref.current?.instance ?? null,
            }),
          );
        };

        ws.onclose = () => {
          if (wsRef.current !== ws) {
            return;
          }

          outputBatcherRef.current.flush();
          setConnected(false);
          wsRef.current = null;

          if (closeReasonRef.current === "error") {
            closeReasonRef.current = null;
            intentionalCloseRef.current = false;
            setReconnectState(0);
            return;
          }

          if (intentionalCloseRef.current) {
            write("\r\n\x1b[90m[disconnected]\x1b[0m\r\n");
            intentionalCloseRef.current = false;
            setConnectionStatus("disconnected");
            setConnectionError(null);
            setReconnectState(0);
            return;
          }

          if (modeRef.current === "ssh") {
            setConnectionStatus("disconnected");
            setConnectionError(null);
            setReconnectState(0);
            return;
          }

          scheduleReconnect(reconnectAttemptRef.current + 1);
        };

        ws.onerror = () => {
          if (wsRef.current === ws) {
            setConnected(false);

            if (modeRef.current === "ssh") {
              setConnectionStatus("error");
              setConnectionError("SSH 連線失敗");
            }
          }
        };
      },
      [clearReconnectTimer, ref, scheduleReconnect, setReconnectState, write],
    );

    const connect = useCallback(
      (targetSession?: string) => {
        const nextSession = targetSession ?? connectionSessionRef.current;

        clearReconnectTimer();
        setReconnectState(0);
        setConnectionError(null);

        if (wsRef.current) {
          outputBatcherRef.current.flush();
          intentionalCloseRef.current = true;
          closeReasonRef.current = "intentional";
          wsRef.current.close();
        }

        intentionalCloseRef.current = false;
        closeReasonRef.current = null;
        openSocket(nextSession);
      },
      [clearReconnectTimer, openSocket, setReconnectState],
    );

    const disconnect = useCallback(() => {
      intentionalCloseRef.current = true;
      closeReasonRef.current = "intentional";
      clearReconnectTimer();
      setReconnectState(0);
      setConnected(false);
      setConnectionStatus("disconnected");
      setConnectionError(null);
      wsRef.current?.close();
    }, [clearReconnectTimer, setReconnectState]);

    useImperativeHandle(
      forwardedRef,
      () => ({
        connect,
        disconnect,
      }),
      [connect, disconnect],
    );

    const handleData = useCallback((data: string) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(data);
      }
    }, []);

    const handleResize = useCallback((cols: number, rows: number) => {
      viewportRef.current = { cols, rows };
      sendResizeControlMessage(wsRef.current, viewportRef.current);
    }, []);

    const handleReady = useCallback(
      (terminal: WTerm) => {
        viewportRef.current = {
          cols: terminal.cols,
          rows: terminal.rows,
        };
        setCoreReady(true);
        patchBoxDrawingRendererWorkaround(terminal);
        patchWideCharRendererWorkaround(terminal.bridge);
        imeAnchorCleanupRef.current?.();
        imeAnchorCleanupRef.current = attachImeCompositionAnchor(terminal.element);
        syncDebugAdapter(terminal, debugEnabledRef.current);

        if (getReadyTransportStrategy(modeRef.current) === "manual") {
          return;
        }

        connect(connectionSessionRef.current);
      },
      [connect],
    );

    useEffect(() => {
      openSocketRef.current = openSocket;
    }, [openSocket]);

    useEffect(() => {
      connectionSessionRef.current = sessionName;
    }, [sessionName]);

    useEffect(() => {
      modeRef.current = mode;
    }, [mode]);

    useEffect(() => {
      sshConfigRef.current = sshConfig;
    }, [sshConfig]);

    useEffect(() => {
      onConnectionStateChange?.({
        status: connectionStatus,
        connected,
        reconnectAttempt,
        errorMessage: connectionError,
      });
    }, [connected, connectionError, connectionStatus, onConnectionStateChange, reconnectAttempt]);

    useEffect(() => {
      onDiagnosticsChange?.(diagnosticsState);
    }, [diagnosticsState, onDiagnosticsChange]);

    useEffect(() => {
      debugEnabledRef.current = debugEnabled;
      setDiagnosticsState(createDiagnosticsState());
      syncDebugAdapter(ref.current?.instance ?? null, debugEnabled);
    }, [debugEnabled, ref]);

    useEffect(() => {
      setCoreReady(false);
      setGhosttyLoadError(null);

      if (coreType !== "ghostty") {
        setGhosttyCore(null);
        return;
      }

      let cancelled = false;
      setGhosttyCore(null);

      void GhosttyCore.load(getGhosttyLoadOptions())
        .then((core) => {
          if (!cancelled) {
            setGhosttyCore(core);
          }
        })
        .catch((error) => {
          if (cancelled) {
            return;
          }

          const message = error instanceof Error ? error.message : String(error);
          console.error("[ghostty] Failed to load Ghostty core:", message);
          setGhosttyLoadError(message);
        });

      return () => {
        cancelled = true;
      };
    }, [coreType]);

    useEffect(() => {
      const outputBatcher = outputBatcherRef.current;

      return () => {
        imeAnchorCleanupRef.current?.();
        imeAnchorCleanupRef.current = null;
        outputBatcher.flush();
        intentionalCloseRef.current = true;
        closeReasonRef.current = "intentional";
        clearReconnectTimer();
        wsRef.current?.close();
      };
    }, [clearReconnectTimer]);

    const terminalCoreProps = getTerminalCoreProps(coreType, ghosttyCore);

    if (!terminalCoreProps) {
      return (
        <div className={`flex h-full items-center justify-center bg-[#08090d] text-xs text-white/40 ${className ?? ""}`}>
          {ghosttyLoadError ? `Ghostty core 載入失敗：${ghosttyLoadError}` : "正在載入 Ghostty core..."}
        </div>
      );
    }

    return (
      <div className={`relative ${className ?? "h-full w-full"}`}>
        <Terminal
          key={`terminal-${coreType}`}
          ref={ref}
          cols={120}
          rows={36}
          autoResize
          debug={debugEnabled}
          onReady={handleReady}
          onData={handleData}
          onResize={handleResize}
          onTitle={onTitleChange}
          className="h-full w-full"
          style={TERMINAL_STYLE}
          {...terminalCoreProps}
        />
        {!coreReady && (
          <div className="pointer-events-none absolute inset-0 bg-[#08090d]" />
        )}
      </div>
    );
  },
);
