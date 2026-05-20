"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Terminal, useTerminal } from "@wterm/react";
import type { TraceEntry } from "@wterm/dom";
import { GhosttyCore } from "@wterm/ghostty";
import type { TerminalCore } from "@wterm/core";

import {
  CORE_CONFIG,
  CORE_PREFERENCE_KEY,
  getInitialCorePreference,
  loadCorePreference,
  normalizeCorePreference,
  type CoreType,
} from "./core-preference";
import {
  deleteSessionApi,
  fetchSessions,
  type SessionInfo,
} from "./session-management";
import {
  DEFAULT_THEME,
  getThemeMeta,
  loadThemePreference,
  THEMES,
  THEME_STORAGE_KEY,
  type ThemeId,
} from "./themes";
import {
  formatReconnectFailureMessage,
  formatReconnectedMessage,
  formatReconnectProgressMessage,
  getReconnectDelay,
  MAX_RECONNECT_ATTEMPTS,
} from "./reconnect";
import {
  formatDocumentTitle,
  getHeaderTitle,
  DEFAULT_HEADER_TITLE,
} from "./terminal-title";
import {
  appendRingBuffer,
  collectTraceLogs,
  formatHexDump,
  getInitialDebugMode,
  isDebugToggleShortcut,
  MAX_DEBUG_ENTRIES,
  readDebugMode,
  setDebugModeSearch,
  syncDebugAdapter,
  type DebugLog,
} from "./debug-mode";
import { getGhosttyLoadOptions, getTerminalCoreProps } from "./terminal-core";

type DebugPanelTab = "escape" | "hex";

interface HexEntry {
  timestamp: number;
  byteLength: number;
  dump: string;
}

export default function WebCliV2() {
  const [sessionName, setSessionName] = useState("webcli-main");
  const [connected, setConnected] = useState(false);
  const [coreType, setCoreType] = useState<CoreType>(getInitialCorePreference);
  const [ghosttyCore, setGhosttyCore] = useState<TerminalCore | null>(null);
  const [ghosttyLoadError, setGhosttyLoadError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [reconnectAttempt, setReconnectAttempt] = useState(0);
  const [themeId, setThemeId] = useState<ThemeId>(() =>
    loadThemePreference(typeof window === "undefined" ? null : window.localStorage),
  );
  const [terminalTitle, setTerminalTitle] = useState("");
  const [debugMode, setDebugMode] = useState(getInitialDebugMode);
  const [debugLogs, setDebugLogs] = useState<DebugLog[]>([]);
  const [hexEntries, setHexEntries] = useState<HexEntry[]>([]);
  const [panelExpanded, setPanelExpanded] = useState(false);
  const [activeDebugTab, setActiveDebugTab] = useState<DebugPanelTab>("escape");

  const { ref, write } = useTerminal();
  const wsRef = useRef<WebSocket | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptRef = useRef(0);
  const intentionalCloseRef = useRef(false);
  const connectionSessionRef = useRef(sessionName);
  const openSocketRef = useRef<(targetSession: string) => void>(() => {});
  const debugModeRef = useRef(debugMode);
  const hexOffsetRef = useRef(0);
  const lastTraceRef = useRef<TraceEntry | null>(null);
  const panelContentRef = useRef<HTMLDivElement | null>(null);

  const loadSessions = useCallback(async () => {
    try {
      setSessions(await fetchSessions());
    } catch {
      // Keep the last successful list when polling fails.
    }
  }, []);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const startPolling = useCallback(() => {
    stopPolling();
    pollRef.current = setInterval(() => {
      void loadSessions();
    }, 5000);
  }, [loadSessions, stopPolling]);

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

  const scheduleReconnect = useCallback((attempt: number) => {
    if (attempt > MAX_RECONNECT_ATTEMPTS) {
      clearReconnectTimer();
      setReconnectState(0);
      write(formatReconnectFailureMessage());
      return;
    }

    const delay = getReconnectDelay(attempt);
    setReconnectState(attempt);
    write(formatReconnectProgressMessage(attempt, delay));
    clearReconnectTimer();
    reconnectTimerRef.current = setTimeout(() => {
      openSocketRef.current(connectionSessionRef.current);
    }, delay);
  }, [clearReconnectTimer, setReconnectState, write]);

  const openSocket = useCallback((targetSession: string) => {
    connectionSessionRef.current = targetSession;

    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${proto}//${window.location.host}/api/terminal?session=${encodeURIComponent(targetSession)}`;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      if (wsRef.current !== ws) {
        return;
      }

      const didReconnect = reconnectAttemptRef.current > 0;

      setConnected(true);
      clearReconnectTimer();
      setReconnectState(0);
      intentionalCloseRef.current = false;
      if (didReconnect) {
        write(formatReconnectedMessage());
      }
      console.log("[wterm] Connected to tmux session:", targetSession);
      void loadSessions();
    };

    ws.onmessage = (event: MessageEvent) => {
      if (wsRef.current === ws) {
        const data = event.data as string;
        const terminal = ref.current?.instance ?? null;

        if (debugModeRef.current) {
          syncDebugAdapter(terminal, true);
        }

        write(data);

        if (debugModeRef.current && terminal?.debug) {
          const timestamp = Date.now();
          const dump = formatHexDump(data, hexOffsetRef.current);
          const traces = terminal.debug.traces;
          const lastTraceIndex = lastTraceRef.current ? traces.lastIndexOf(lastTraceRef.current) : -1;
          const { logs } = collectTraceLogs(traces, Math.max(lastTraceIndex + 1, 0), timestamp);

          hexOffsetRef.current = dump.nextOffset;
          lastTraceRef.current = traces.at(-1) ?? null;

          setHexEntries((previous) =>
            appendRingBuffer(
              previous,
              {
                timestamp,
                byteLength: dump.byteLength,
                dump: dump.dump,
              },
              MAX_DEBUG_ENTRIES,
            ),
          );

          if (logs.length > 0) {
            setDebugLogs((previous) =>
              logs.reduce((entries, log) => appendRingBuffer(entries, log, MAX_DEBUG_ENTRIES), previous),
            );
          }
        }
      }
    };

    ws.onclose = () => {
      if (wsRef.current !== ws) {
        return;
      }

      setConnected(false);
      wsRef.current = null;
      void loadSessions();

      if (intentionalCloseRef.current) {
        write("\r\n\x1b[90m[disconnected]\x1b[0m\r\n");
        intentionalCloseRef.current = false;
        setReconnectState(0);
        return;
      }

      scheduleReconnect(reconnectAttemptRef.current + 1);
    };

    ws.onerror = () => {
      if (wsRef.current === ws) {
        setConnected(false);
      }
    };
  }, [clearReconnectTimer, loadSessions, ref, scheduleReconnect, setReconnectState, write]);

  const connect = useCallback((targetSession?: string) => {
    const nextSession = targetSession ?? sessionName;

    clearReconnectTimer();
    setReconnectState(0);

    if (targetSession && targetSession !== sessionName) {
      setSessionName(targetSession);
    }

    if (wsRef.current) {
      intentionalCloseRef.current = true;
      wsRef.current.close();
    }

    intentionalCloseRef.current = false;
    openSocket(nextSession);
  }, [clearReconnectTimer, openSocket, sessionName, setReconnectState]);

  const handleData = useCallback((data: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(data);
    }
  }, []);

  const handleResize = useCallback((cols: number, rows: number) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(`\x1b[RESIZE:${cols};${rows}]`);
    }
  }, []);

  const handleReady = useCallback(() => {
    syncDebugAdapter(ref.current?.instance ?? null, debugModeRef.current);

    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      connect();
    }
  }, [connect, ref]);

  const handleCoreChange = useCallback((event: React.ChangeEvent<HTMLSelectElement>) => {
    const nextCore = normalizeCorePreference(event.currentTarget.value) ?? "builtin";

    window.localStorage.setItem(CORE_PREFERENCE_KEY, nextCore);
    setGhosttyCore(null);
    setGhosttyLoadError(null);
    setCoreType(nextCore);
  }, []);

  const handleThemeChange = useCallback((event: React.ChangeEvent<HTMLSelectElement>) => {
    const nextTheme = event.currentTarget.value as ThemeId;

    window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    setThemeId(nextTheme);
  }, []);

  const handleTitle = useCallback((title: string) => {
    setTerminalTitle(title);
  }, []);

  const applyDebugMode = useCallback(
    (next: boolean) => {
      const url = new URL(window.location.href);
      url.search = setDebugModeSearch(url.search, next);
      window.history.replaceState({}, "", url.toString());

      debugModeRef.current = next;
      hexOffsetRef.current = 0;
      lastTraceRef.current = null;
      setDebugMode(next);
      setDebugLogs([]);
      setHexEntries([]);
      setPanelExpanded(false);
      setActiveDebugTab("escape");
      syncDebugAdapter(ref.current?.instance ?? null, next);
    },
    [ref],
  );

  const toggleDebug = useCallback(() => {
    applyDebugMode(!debugMode);
  }, [applyDebugMode, debugMode]);

  const handleSwitchSession = useCallback((name: string) => {
    connect(name);
  }, [connect]);

  const handleDelete = useCallback(async (name: string) => {
    const success = await deleteSessionApi(name);

    if (success) {
      setSessions((previous) => previous.filter((session) => session.name !== name));
      if (name === sessionName) {
        intentionalCloseRef.current = true;
        clearReconnectTimer();
        setReconnectState(0);
        wsRef.current?.close();
      }
    }

    setDeleteConfirm(null);
  }, [clearReconnectTimer, sessionName, setReconnectState]);

  const handleRefreshSessions = useCallback(() => {
    void loadSessions();
    if (sidebarOpen) {
      startPolling();
    }
  }, [loadSessions, sidebarOpen, startPolling]);

  const currentTheme = getThemeMeta(themeId ?? DEFAULT_THEME);
  const terminalCoreProps = getTerminalCoreProps(coreType, ghosttyCore);

  useEffect(() => {
    openSocketRef.current = openSocket;
  }, [openSocket]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const savedCore = loadCorePreference(window.localStorage);
      setCoreType((current) => (current === savedCore ? current : savedCore));
    }, 0);

    return () => {
      clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    if (coreType !== "ghostty") {
      return;
    }

    let cancelled = false;

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
    document.title = formatDocumentTitle(terminalTitle);
  }, [terminalTitle]);

  useEffect(() => {
    const nextDebugMode = readDebugMode(window.location.search);

    if (nextDebugMode !== debugModeRef.current) {
      applyDebugMode(nextDebugMode);
    } else if (nextDebugMode) {
      syncDebugAdapter(ref.current?.instance ?? null, true);
    }
  }, [applyDebugMode, ref]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isDebugToggleShortcut(event)) {
        event.preventDefault();
        toggleDebug();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [toggleDebug]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadSessions();
    }, 0);

    return () => {
      clearTimeout(timer);
    };
  }, [loadSessions]);

  useEffect(() => {
    const handleBeforeUnload = () => {
      intentionalCloseRef.current = true;
      clearReconnectTimer();
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [clearReconnectTimer]);

  useEffect(() => {
    if (sidebarOpen) {
      const timer = window.setTimeout(() => {
        void loadSessions();
      }, 0);
      startPolling();

      return () => {
        clearTimeout(timer);
        stopPolling();
      };
    } else {
      stopPolling();
    }

    return stopPolling;
  }, [loadSessions, sidebarOpen, startPolling, stopPolling]);

  useEffect(() => {
    return () => {
      clearReconnectTimer();
    };
  }, [clearReconnectTimer]);

  useEffect(() => {
    if (!debugMode || !panelExpanded || !panelContentRef.current) {
      return;
    }

    panelContentRef.current.scrollTop = panelContentRef.current.scrollHeight;
  }, [activeDebugTab, debugLogs, debugMode, hexEntries, panelExpanded]);

  return (
    <div className="flex h-screen flex-col bg-zinc-950">
      <header className="flex items-center justify-between border-b border-white/10 bg-zinc-900/50 px-4 py-2 text-sm">
        <div className="flex items-center gap-3">
          <span className="font-semibold text-emerald-400">web_cli_v2</span>
          <span className="text-white/40">•</span>
          <span className="text-white/60 text-xs">wterm + tmux</span>
          <span className="text-white/40">•</span>
          <span
            className={`max-w-48 truncate font-mono text-xs ${
              terminalTitle ? "text-white/70" : "text-white/30"
            }`}
            title={terminalTitle || DEFAULT_HEADER_TITLE}
          >
            {getHeaderTitle(terminalTitle)}
          </span>
          <span className="text-white/40">•</span>
          <button
            onClick={() => setSidebarOpen((open) => !open)}
            className={`flex items-center gap-1.5 rounded-md px-2 py-1 text-xs transition-colors ${
              sidebarOpen
                ? "bg-zinc-700 text-white"
                : "bg-zinc-800 text-white/60 hover:bg-zinc-700 hover:text-white"
            }`}
          >
            <span>Sessions</span>
            <span className="rounded-full bg-emerald-600 px-1.5 py-0.5 text-[10px] leading-none text-white">
              {sessions.length}
            </span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <label htmlFor="core-select" className="text-xs text-white/40">
              Core
            </label>
            <select
              id="core-select"
              value={coreType}
              onChange={handleCoreChange}
              className="cursor-pointer rounded-md border border-white/20 bg-zinc-800 px-2 py-1 text-xs font-mono focus:border-emerald-500 focus:outline-none"
            >
              <option value="builtin">Built-in (~12KB)</option>
              <option value="ghostty">Ghostty (~400KB)</option>
            </select>
          </div>
          <div className="flex items-center gap-1.5">
            <label htmlFor="theme-select" className="text-xs text-white/40">
              Theme
            </label>
            <select
              id="theme-select"
              value={themeId}
              onChange={handleThemeChange}
              className="cursor-pointer rounded-md border border-white/20 bg-zinc-800 px-2 py-1 text-xs font-mono focus:border-emerald-500 focus:outline-none"
            >
              {THEMES.map((theme) => (
                <option key={theme.id} value={theme.id}>
                  {theme.label}
                </option>
              ))}
            </select>
          </div>
          <input
            type="text"
            value={sessionName}
            onChange={(e) => setSessionName(e.target.value)}
            className="rounded-md bg-zinc-800 px-3 py-1 text-xs font-mono border border-white/20 w-56 focus:outline-none focus:border-emerald-500"
            placeholder="tmux session name"
          />
          <button
            onClick={() => connect()}
            disabled={connected}
            className="rounded-md bg-emerald-600 px-4 py-1 text-xs font-medium hover:bg-emerald-500 disabled:bg-emerald-800 disabled:text-white/50 transition-colors"
          >
            {connected ? "已連線" : "連線 / 重新連線"}
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={toggleDebug}
            className={`rounded-md px-2 py-0.5 text-xs transition-colors ${
              debugMode
                ? "bg-amber-500/20 text-amber-400 hover:bg-amber-500/30"
                : "bg-white/10 text-white/40 hover:bg-white/15 hover:text-white/60"
            }`}
            title="Debug Mode (Ctrl+Shift+D)"
          >
            {debugMode ? "Debug ON" : "Debug"}
          </button>
          <div
            className={`rounded px-2 py-0.5 text-xs ${
              connected
                ? "bg-emerald-500/20 text-emerald-400"
                : reconnectAttempt > 0
                  ? "animate-pulse bg-yellow-500/20 text-yellow-400"
                  : "bg-white/10 text-white/40"
            }`}
          >
            {connected ? "● 已連線" : reconnectAttempt > 0 ? "◌ 重連中..." : "○ 未連線"}
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <div
          className={`overflow-hidden border-r border-white/10 bg-zinc-900/80 transition-all duration-300 ${
            sidebarOpen ? "w-72" : "w-0 border-r-0"
          }`}
        >
          {sidebarOpen ? (
            <div className="flex h-full w-72 flex-col">
              <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
                <span className="text-sm font-semibold text-white/80">Sessions</span>
                <button
                  onClick={handleRefreshSessions}
                  className="text-sm text-white/40 hover:text-white/80"
                  title="重新整理"
                >
                  ↻
                </button>
              </div>

              <div className="flex-1 overflow-y-auto">
                {sessions.length === 0 ? (
                  <div className="px-3 py-8 text-center text-xs text-white/30">
                    尚無 session
                    <br />
                    請在上方輸入名稱建立新 session
                  </div>
                ) : (
                  sessions.map((session) => (
                    <div
                      key={session.name}
                      className={`group flex cursor-pointer items-center gap-2 border-b border-white/5 px-3 py-2 hover:bg-zinc-800/50 ${
                        session.name === sessionName && connected
                          ? "border-l-2 border-l-emerald-500 bg-zinc-800"
                          : ""
                      }`}
                      onClick={() => handleSwitchSession(session.name)}
                    >
                      <span className={`text-xs ${session.attached ? "text-emerald-400" : "text-zinc-600"}`}>
                        ●
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-xs font-mono text-white/80">
                          {session.name}
                        </div>
                        <div className="text-[10px] text-white/30">
                          {new Date(session.created * 1000).toLocaleString()} · {session.windows} window
                          {session.windows === 1 ? "" : "s"}
                        </div>
                      </div>
                      <button
                        onClick={(event) => {
                          event.stopPropagation();
                          setDeleteConfirm(session.name);
                        }}
                        className="text-xs text-white/30 opacity-0 transition-opacity hover:text-red-400 group-hover:opacity-100"
                        title="刪除 session"
                      >
                        ✕
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : null}
        </div>

        <div
          className={`flex-1 overflow-hidden ${currentTheme.cssClass} ${
            debugMode ? "ring-1 ring-inset ring-amber-500/20" : ""
          }`}
        >
          {terminalCoreProps ? (
            <Terminal
              key={`terminal-${coreType}`}
              ref={ref}
              cols={120}
              rows={36}
              autoResize
              debug={debugMode}
              onReady={handleReady}
              onData={handleData}
              onResize={handleResize}
              onTitle={handleTitle}
              className="h-full w-full"
              {...terminalCoreProps}
            />
          ) : (
            <div className="flex h-full items-center justify-center bg-zinc-950 text-xs text-white/50">
              {ghosttyLoadError ? `Ghostty core 載入失敗：${ghosttyLoadError}` : "正在載入 Ghostty core..."}
            </div>
          )}
        </div>
      </div>

      {debugMode ? (
        <div className="border-t border-amber-500/30 bg-zinc-950/95">
          <div className="flex items-center justify-between gap-3 px-4 py-1.5">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setPanelExpanded((previous) => !previous)}
                className="text-xs font-medium text-amber-400 transition-colors hover:text-amber-300"
              >
                Debug Panel
              </button>
              <div className="flex items-center gap-1 rounded-md bg-white/5 p-1">
                <button
                  onClick={() => setActiveDebugTab("escape")}
                  className={`rounded px-2 py-0.5 text-[10px] transition-colors ${
                    activeDebugTab === "escape"
                      ? "bg-amber-500/20 text-amber-300"
                      : "text-white/40 hover:text-white/70"
                  }`}
                >
                  Escape Log ({debugLogs.length})
                </button>
                <button
                  onClick={() => setActiveDebugTab("hex")}
                  className={`rounded px-2 py-0.5 text-[10px] transition-colors ${
                    activeDebugTab === "hex"
                      ? "bg-amber-500/20 text-amber-300"
                      : "text-white/40 hover:text-white/70"
                  }`}
                >
                  Hex Dump ({hexEntries.length})
                </button>
              </div>
            </div>
            <button
              onClick={() => setPanelExpanded((previous) => !previous)}
              className="text-xs text-white/40 transition-colors hover:text-white/70"
              title={panelExpanded ? "摺疊 debug panel" : "展開 debug panel"}
            >
              {panelExpanded ? "▼" : "▶"}
            </button>
          </div>

          {panelExpanded ? (
            <div
              ref={panelContentRef}
              className="debug-panel-scroll h-[200px] overflow-y-auto border-t border-white/10 px-4 py-2 font-mono text-[10px]"
            >
              {activeDebugTab === "escape" ? (
                <div className="space-y-1">
                  {debugLogs.length > 0 ? (
                    debugLogs.map((log, index) => (
                      <div key={`${log.timestamp}-${index}`} className="flex gap-2 text-white/60">
                        <span className="text-white/30">
                          {new Date(log.timestamp).toISOString().slice(11, 23)}
                        </span>
                        <span className="text-amber-400">[{log.type}]</span>
                        <span className="text-emerald-400">{log.sequence}</span>
                        <span>{log.description}</span>
                      </div>
                    ))
                  ) : (
                    <div className="text-white/30">等待終端輸出...</div>
                  )}
                </div>
              ) : (
                <div className="space-y-3 text-white/60">
                  {hexEntries.length > 0 ? (
                    hexEntries.map((entry, index) => (
                      <div key={`${entry.timestamp}-${index}`} className="space-y-1">
                        <div className="text-white/30">
                          [{new Date(entry.timestamp).toISOString().slice(11, 23)}] {entry.byteLength} bytes
                        </div>
                        <pre className="whitespace-pre-wrap text-emerald-400/80">{entry.dump}</pre>
                      </div>
                    ))
                  ) : (
                    <div className="text-white/30">等待 PTY 輸出...</div>
                  )}
                </div>
              )}
            </div>
          ) : null}
        </div>
      ) : null}

      {deleteConfirm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="max-w-sm rounded-lg border border-white/20 bg-zinc-900 p-4">
            <p className="mb-1 text-sm text-white/80">
              確定要刪除 session 「{deleteConfirm}」？
            </p>
            <p className="mb-4 text-xs text-white/40">
              此操作無法復原
              {deleteConfirm === sessionName && connected ? (
                <span className="text-red-400">（此為當前連線的 session，刪除後將斷線）</span>
              ) : null}
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="rounded bg-zinc-700 px-3 py-1 text-xs text-white/60 hover:text-white"
              >
                取消
              </button>
              <button
                onClick={() => void handleDelete(deleteConfirm)}
                className="rounded bg-red-600 px-3 py-1 text-xs text-white hover:bg-red-500"
              >
                刪除
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <footer className="border-t border-white/10 bg-zinc-900/50 px-4 py-1.5 text-[10px] text-white/40 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <div>
            Session: <span className="font-mono text-emerald-400">{sessionName}</span>
          </div>
          <div>
            Core: <span className="font-mono text-emerald-400">{CORE_CONFIG[coreType].label}</span>{" "}
            <span className="text-white/30">({CORE_CONFIG[coreType].size})</span>
          </div>
          <div>
            Theme: <span className="font-mono text-emerald-400">{currentTheme.label}</span>
          </div>
        </div>
        <div>
          Tip: 在終端內輸入 <span className="font-mono text-white/60">tmux new-window</span> 或使用 <span className="font-mono">Ctrl-b c</span>
        </div>
      </footer>
    </div>
  );
}
