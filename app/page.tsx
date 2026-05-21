"use client";

import { useCallback, useEffect, useRef, useState } from "react";

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
import { AgentTerminal, type AgentTerminalHandle } from "./agent-terminal";
import type { AgentStreamState } from "./agent-shell";
import { BrowserShell } from "./browser-shell";
import { getCoreGuidance } from "./core-guidance";
import { HydrationSafeInput, HydrationSafeTextarea } from "./hydration-guards";
import { getResponsiveShellPolicy } from "./responsive-shell";
import {
  buildSshConnectPayload,
  clearSshCredentials,
  createEmptySshConfig,
  type SshAuthMethod,
} from "./ssh-mode";
import { formatDocumentTitle, getHeaderTitle } from "./terminal-title";
import { createDiagnosticsState } from "./terminal-runtime/diagnostics";
import { TerminalRuntime } from "./terminal-runtime/terminal-runtime";
import type {
  ConnectionState,
  DiagnosticsSnapshot,
  TerminalMode,
  TerminalRuntimeHandle,
} from "./terminal-runtime/types";
import {
  DEFAULT_THEME,
  getThemeMeta,
  getInitialThemePreference,
  loadThemePreference,
  THEMES,
  THEME_STORAGE_KEY,
  type ThemeId,
} from "./themes";
import {
  getInitialDebugMode,
  isDebugToggleShortcut,
  readDebugMode,
  setDebugModeSearch,
} from "./debug-mode";

type DebugPanelTab = "escape" | "hex";

export default function WebCliV2() {
  const [mode, setMode] = useState<TerminalMode>("local");
  const [browserShellOpen, setBrowserShellOpen] = useState(false);
  const [agentTerminalOpen, setAgentTerminalOpen] = useState(false);
  const [agentPrompt, setAgentPrompt] = useState("Summarize the current shell architecture and upgrade boundaries.");
  const [agentState, setAgentState] = useState<AgentStreamState>({
    status: "idle",
    errorMessage: null,
    lastPrompt: null,
  });
  const [sessionName, setSessionName] = useState("webcli-main");
  const [sshConfig, setSshConfig] = useState(createEmptySshConfig);
  const [connected, setConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionState["status"]>("disconnected");
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [coreType, setCoreType] = useState<CoreType>(getInitialCorePreference);
  const [viewportWidth, setViewportWidth] = useState<number | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [reconnectAttempt, setReconnectAttempt] = useState(0);
  const [themeId, setThemeId] = useState<ThemeId>(getInitialThemePreference);
  const [terminalTitle, setTerminalTitle] = useState("");
  const [debugMode, setDebugMode] = useState(getInitialDebugMode);
  const [diagnostics, setDiagnostics] = useState<DiagnosticsSnapshot>(createDiagnosticsState);
  const [panelExpanded, setPanelExpanded] = useState(false);
  const [activeDebugTab, setActiveDebugTab] = useState<DebugPanelTab>("escape");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [secondaryHeaderOpen, setSecondaryHeaderOpen] = useState(false);
  const [newSessionInput, setNewSessionInput] = useState("webcli-main");

  const runtimeRef = useRef<TerminalRuntimeHandle | null>(null);
  const agentTerminalRef = useRef<AgentTerminalHandle | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const panelContentRef = useRef<HTMLDivElement | null>(null);
  const settingsRef = useRef<HTMLDivElement | null>(null);
  const settingsBtnRef = useRef<HTMLButtonElement | null>(null);
  const secondaryHeaderRef = useRef<HTMLDivElement | null>(null);
  const secondaryHeaderBtnRef = useRef<HTMLButtonElement | null>(null);
  const modeSwitchMountedRef = useRef(false);
  const shellBandRef = useRef<ReturnType<typeof getResponsiveShellPolicy>["band"]>("compact");

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

  const handleCoreChange = useCallback((event: React.ChangeEvent<HTMLSelectElement>) => {
    const nextCore = normalizeCorePreference(event.currentTarget.value) ?? "builtin";
    window.localStorage.setItem(CORE_PREFERENCE_KEY, nextCore);
    setCoreType(nextCore);
  }, []);

  const handleThemeChange = useCallback((event: React.ChangeEvent<HTMLSelectElement>) => {
    const nextTheme = event.currentTarget.value as ThemeId;
    window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    setThemeId(nextTheme);
  }, []);

  const handleUseRecommendedCore = useCallback(() => {
    window.localStorage.setItem(CORE_PREFERENCE_KEY, "ghostty");
    setCoreType("ghostty");
  }, []);

  const handleTitle = useCallback((title: string) => {
    setTerminalTitle(title);
  }, []);

  const applyDebugMode = useCallback((next: boolean) => {
    const url = new URL(window.location.href);
    url.search = setDebugModeSearch(url.search, next);
    window.history.replaceState({}, "", url.toString());
    setDebugMode(next);
    setDiagnostics(createDiagnosticsState());
    setPanelExpanded(false);
    setActiveDebugTab("escape");
  }, []);

  const toggleDebug = useCallback(() => {
    applyDebugMode(!debugMode);
  }, [applyDebugMode, debugMode]);

  const handleSwitchSession = useCallback((name: string) => {
    setSessionName(name);
    setNewSessionInput(name);
    runtimeRef.current?.connect(name);
  }, []);

  const handleModeChange = useCallback((nextMode: TerminalMode) => {
    if (nextMode === mode) {
      return;
    }

    setSidebarOpen(false);
    setDeleteConfirm(null);
    setBrowserShellOpen(false);
    setAgentTerminalOpen(false);
    setAgentState({
      status: "idle",
      errorMessage: null,
      lastPrompt: null,
    });
    setConnected(false);
    setReconnectAttempt(0);
    setConnectionError(null);
    setConnectionStatus("disconnected");

    if (nextMode === "ssh") {
      setSshConfig(clearSshCredentials(sshConfig));
    }

    setMode(nextMode);
  }, [mode, sshConfig]);

  const handleNewSessionConnect = useCallback(() => {
    const name = newSessionInput.trim();
    if (!name) return;
    handleSwitchSession(name);
  }, [newSessionInput, handleSwitchSession]);

  const handleOpenBrowserShell = useCallback(() => {
    runtimeRef.current?.disconnect();
    setSidebarOpen(false);
    setDeleteConfirm(null);
    setAgentTerminalOpen(false);
    setAgentState({
      status: "idle",
      errorMessage: null,
      lastPrompt: null,
    });
    setConnected(false);
    setReconnectAttempt(0);
    setConnectionError(null);
    setConnectionStatus("disconnected");
    setBrowserShellOpen(true);
  }, []);

  const handleCloseBrowserShell = useCallback(() => {
    setBrowserShellOpen(false);
    setConnectionError(null);
    setConnectionStatus("disconnected");
    setConnected(false);
    setReconnectAttempt(0);
    setTerminalTitle("");

    if (mode === "local") {
      window.setTimeout(() => {
        runtimeRef.current?.connect(sessionName);
      }, 0);
    }
  }, [mode, sessionName]);

  const handleOpenAgentTerminal = useCallback(() => {
    runtimeRef.current?.disconnect();
    setSidebarOpen(false);
    setDeleteConfirm(null);
    setBrowserShellOpen(false);
    setConnected(false);
    setReconnectAttempt(0);
    setConnectionError(null);
    setConnectionStatus("disconnected");
    setAgentState({
      status: "idle",
      errorMessage: null,
      lastPrompt: null,
    });
    setAgentTerminalOpen(true);
  }, []);

  const handleCloseAgentTerminal = useCallback(() => {
    setAgentTerminalOpen(false);
    setAgentState({
      status: "idle",
      errorMessage: null,
      lastPrompt: null,
    });
    setTerminalTitle("");

    if (mode === "local") {
      window.setTimeout(() => {
        runtimeRef.current?.connect(sessionName);
      }, 0);
    }
  }, [mode, sessionName]);

  const handleStartAgentStream = useCallback(async () => {
    await agentTerminalRef.current?.start(agentPrompt);
  }, [agentPrompt]);

  const handleAbortAgentStream = useCallback(() => {
    agentTerminalRef.current?.abort();
  }, []);

  const handleRetryAgentStream = useCallback(async () => {
    await agentTerminalRef.current?.retry();
  }, []);

  const handleDisconnect = useCallback(() => {
    runtimeRef.current?.disconnect();

    if (mode === "ssh") {
      setSshConfig(clearSshCredentials(sshConfig));
    }
  }, [mode, sshConfig]);

  const handleSshFieldChange = useCallback(
    (field: "host" | "port" | "username" | "password" | "privateKey", value: string) => {
      setConnectionError(null);
      setConnectionStatus((previous) => (previous === "error" ? "disconnected" : previous));
      setSshConfig((previous) => ({
        ...previous,
        [field]: value,
      }));
    },
    [],
  );

  const handleSshAuthChange = useCallback((authMethod: SshAuthMethod) => {
    setConnectionError(null);
    setConnectionStatus((previous) => (previous === "error" ? "disconnected" : previous));
    setSshConfig((previous) => ({
      ...previous,
      authMethod,
      password: authMethod === "password" ? previous.password : "",
      privateKey: authMethod === "privateKey" ? previous.privateKey : "",
    }));
  }, []);

  const handleSshConnect = useCallback(() => {
    if (!buildSshConnectPayload(sshConfig)) {
      setConnectionStatus("error");
      setConnectionError("請完整填寫 SSH 連線資訊");
      return;
    }

    runtimeRef.current?.connect();
  }, [sshConfig]);

  const handleClearSshForm = useCallback(() => {
    setConnectionError(null);
    setConnectionStatus("disconnected");
    setSshConfig(clearSshCredentials(sshConfig));
  }, [sshConfig]);

  const handleDelete = useCallback(
    async (name: string) => {
      const success = await deleteSessionApi(name);
      if (success) {
        setSessions((previous) => previous.filter((session) => session.name !== name));
        if (name === sessionName) {
          runtimeRef.current?.disconnect();
        }
      }
      setDeleteConfirm(null);
    },
    [sessionName],
  );

  const handleRefreshSessions = useCallback(() => {
    void loadSessions();
    if (sidebarOpen) {
      startPolling();
    }
  }, [loadSessions, sidebarOpen, startPolling]);

  const handleConnectionStateChange = useCallback(
    (state: ConnectionState) => {
      setConnectionStatus(state.status);
      setConnected(state.connected);
      setReconnectAttempt(state.reconnectAttempt);
      setConnectionError(state.errorMessage);

      if (state.connected && mode === "local") {
        void loadSessions();
      }
    },
    [loadSessions, mode],
  );

  const handleDiagnosticsChange = useCallback((snapshot: DiagnosticsSnapshot) => {
    setDiagnostics(snapshot);
  }, []);

  const currentTheme = getThemeMeta(themeId ?? DEFAULT_THEME);
  const coreGuidance = getCoreGuidance(coreType);
  const shellPolicy = getResponsiveShellPolicy(viewportWidth);
  const compactShell = shellPolicy.isCompact;
  const localSessionsVisible = !browserShellOpen && !agentTerminalOpen && mode === "local";
  const sidebarVisible = localSessionsVisible && sidebarOpen;
  const sshConnectReady = buildSshConnectPayload(sshConfig) !== null;
  const sshTargetLabel = sshConfig.host
    ? `${sshConfig.username || "user"}@${sshConfig.host}:${sshConfig.port || "22"}`
    : "SSH";
  const compactSecondaryMeta = browserShellOpen
    ? "Demo Shell"
    : agentTerminalOpen
      ? "Agent Stream"
      : mode === "local"
        ? sessionName
        : sshTargetLabel;
  const drawerWidthClass = shellPolicy.drawerWidth === "phone"
    ? "w-[85vw] max-w-80"
    : shellPolicy.drawerWidth === "tablet"
      ? "w-[22rem] max-w-[88vw]"
      : "w-72";
  const drawerClasses = shellPolicy.usesOverlayDrawer
    ? `absolute inset-y-0 left-0 z-40 ${drawerWidthClass} border-r border-white/[0.07] bg-[#0b0d12]/95 shadow-2xl backdrop-blur-md transition-transform duration-200`
    : "absolute inset-y-0 left-0 z-40 w-72 border-r border-white/[0.07] bg-[#0b0d12]/95 shadow-2xl backdrop-blur-md transition-transform duration-200";

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const savedCore = loadCorePreference(window.localStorage);
      setCoreType((current) => (current === savedCore ? current : savedCore));
    }, 0);
    return () => { clearTimeout(timer); };
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const savedTheme = loadThemePreference(window.localStorage);
      setThemeId((current) => (current === savedTheme ? current : savedTheme));
    }, 0);
    return () => { clearTimeout(timer); };
  }, []);

  useEffect(() => {
    document.title = formatDocumentTitle(terminalTitle);
  }, [terminalTitle]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const nextDebugMode = readDebugMode(window.location.search);
      if (nextDebugMode !== debugMode) {
        applyDebugMode(nextDebugMode);
      }
    }, 0);
    return () => { clearTimeout(timer); };
  }, [applyDebugMode, debugMode]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isDebugToggleShortcut(event)) {
        event.preventDefault();
        toggleDebug();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => { window.removeEventListener("keydown", handleKeyDown); };
  }, [toggleDebug]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadSessions(); }, 0);
    return () => { clearTimeout(timer); };
  }, [loadSessions]);

  useEffect(() => {
    if (mode !== "local") {
      stopPolling();
      return stopPolling;
    }

    if (sidebarOpen) {
      const timer = window.setTimeout(() => { void loadSessions(); }, 0);
      startPolling();
      return () => {
        clearTimeout(timer);
        stopPolling();
      };
    }

    stopPolling();
    return stopPolling;
  }, [loadSessions, mode, sidebarOpen, startPolling, stopPolling]);

  useEffect(() => {
    if (!modeSwitchMountedRef.current) {
      modeSwitchMountedRef.current = true;
      return;
    }

    runtimeRef.current?.disconnect();

    if (mode === "local") {
      const timer = window.setTimeout(() => {
        runtimeRef.current?.connect(sessionName);
      }, 0);
      return () => { clearTimeout(timer); };
    }

    return undefined;
  }, [mode, sessionName]);

  useEffect(() => {
    if (!debugMode || !panelExpanded || !panelContentRef.current) return;
    panelContentRef.current.scrollTop = panelContentRef.current.scrollHeight;
  }, [activeDebugTab, debugMode, diagnostics.hexEntries, diagnostics.logs, panelExpanded]);

  useEffect(() => {
    if (!settingsOpen) return;
    const handler = (e: MouseEvent) => {
      if (
        settingsRef.current?.contains(e.target as Node) ||
        settingsBtnRef.current?.contains(e.target as Node)
      ) {
        return;
      }
      setSettingsOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => { document.removeEventListener("mousedown", handler); };
  }, [settingsOpen]);

  useEffect(() => {
    if (!compactShell || !secondaryHeaderOpen) return;
    const handler = (e: MouseEvent) => {
      if (
        secondaryHeaderRef.current?.contains(e.target as Node) ||
        secondaryHeaderBtnRef.current?.contains(e.target as Node)
      ) {
        return;
      }
      setSecondaryHeaderOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => { document.removeEventListener("mousedown", handler); };
  }, [compactShell, secondaryHeaderOpen]);

  useEffect(() => {
    const syncViewport = () => {
      const width = window.innerWidth;
      const nextShellPolicy = getResponsiveShellPolicy(width);
      const previousShellBand = shellBandRef.current;

      setViewportWidth(width);
      shellBandRef.current = nextShellPolicy.band;

      if (previousShellBand !== nextShellPolicy.band) {
        setSecondaryHeaderOpen(!nextShellPolicy.secondaryHeaderCollapsedByDefault);
        setSettingsOpen(false);

        if (nextShellPolicy.usesOverlayDrawer) {
          setSidebarOpen(false);
        }

        if (nextShellPolicy.debugCollapsedByDefault) {
          setPanelExpanded(false);
        }
      }
    };

    const timer = window.setTimeout(syncViewport, 0);
    window.addEventListener("resize", syncViewport);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("resize", syncViewport);
    };
  }, []);

  return (
    <div
      className={compactShell
        ? "terminal-shell-root terminal-shell-root--compact"
        : "flex h-screen flex-col bg-[#08090d]"}
      data-shell-band={shellPolicy.band}
      data-terminal-inset={shellPolicy.terminalInset}
    >
      {compactShell ? (
        <header
          className="terminal-shell-header"
          data-compact-shell="true"
          data-secondary-header-open={secondaryHeaderOpen ? "true" : "false"}
        >
          <div className="terminal-shell-header-primary">
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="text-[10px] font-bold tracking-widest text-emerald-400 uppercase">
                web_cli_v2
              </span>
              <div className="flex items-center gap-1 rounded border border-white/10 bg-black/20 p-0.5">
                <button
                  onClick={() => handleModeChange("local")}
                  className={`rounded px-2 py-1 text-[10px] transition-colors ${
                    mode === "local"
                      ? "bg-emerald-500/15 text-emerald-300"
                      : "text-white/35 hover:text-white/60"
                  }`}
                >
                  Local
                </button>
                <button
                  onClick={() => handleModeChange("ssh")}
                  className={`rounded px-2 py-1 text-[10px] transition-colors ${
                    mode === "ssh"
                      ? "bg-cyan-500/15 text-cyan-300"
                      : "text-white/35 hover:text-white/60"
                  }`}
                >
                  SSH
                </button>
              </div>
            </div>

            <div className="flex min-w-0 items-center gap-2">
              {browserShellOpen ? (
                <div className="flex items-center gap-1.5 text-[10px] text-cyan-300/80">
                  <span className="text-[8px]">◇</span>
                  <span>Demo</span>
                </div>
              ) : agentTerminalOpen ? (
                agentState.status === "error" && agentState.errorMessage ? (
                  <div className="flex items-center gap-1.5 text-[10px] text-red-400">
                    <span className="text-[8px]">▲</span>
                    <span className="max-w-24 truncate">{agentState.errorMessage}</span>
                  </div>
                ) : agentState.status === "loading" || agentState.status === "streaming" ? (
                  <div className="flex animate-pulse items-center gap-1.5 text-[10px] text-fuchsia-300">
                    <span className="text-[8px]">◌</span>
                    <span>{agentState.status === "loading" ? "Agent..." : "Streaming"}</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 text-[10px] text-fuchsia-300/80">
                    <span className="text-[8px]">◇</span>
                    <span>Agent</span>
                  </div>
                )
              ) : connectionStatus === "error" && connectionError ? (
                <div className="flex items-center gap-1.5 text-[10px] text-red-400">
                  <span className="text-[8px]">▲</span>
                  <span className="max-w-24 truncate">{connectionError}</span>
                </div>
              ) : connected ? (
                <div className="flex items-center gap-1.5 text-[10px] text-emerald-400">
                  <span className="text-[8px]">●</span>
                  <span>已連線</span>
                </div>
              ) : connectionStatus === "connecting" || reconnectAttempt > 0 ? (
                <div className="flex animate-pulse items-center gap-1.5 text-[10px] text-yellow-400">
                  <span className="text-[8px]">◌</span>
                  <span>{mode === "ssh" ? "SSH..." : "重連中"}</span>
                </div>
              ) : (
                <button
                  onClick={() => {
                    if (mode === "ssh") {
                      handleSshConnect();
                      return;
                    }

                    runtimeRef.current?.connect();
                  }}
                  className="flex items-center gap-1.5 rounded px-2 py-1 text-[10px] text-white/30 transition-colors hover:bg-emerald-700/20 hover:text-emerald-400 disabled:cursor-not-allowed disabled:opacity-40"
                  title="點擊重新連線"
                  disabled={mode === "ssh" && !sshConnectReady}
                >
                  <span className="text-[8px]">○</span>
                  <span>{mode === "ssh" ? "SSH" : "未連線"}</span>
                </button>
              )}

              {mode === "local" ? (
                <button
                  onClick={() => {
                    setSidebarOpen((open) => !open);
                    setSecondaryHeaderOpen(false);
                  }}
                  className={`flex items-center gap-1.5 rounded px-2 py-1 text-[10px] transition-colors ${
                    sidebarOpen
                      ? "bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20"
                      : "text-white/40 hover:bg-white/5 hover:text-white/60"
                  }`}
                >
                  <span>Sessions</span>
                  {sessions.length > 0 && (
                    <span className="rounded-full bg-white/10 px-1 text-[9px] leading-4 text-white/50">
                      {sessions.length}
                    </span>
                  )}
                </button>
              ) : null}

              <button
                ref={secondaryHeaderBtnRef}
                onClick={() => setSecondaryHeaderOpen((open) => !open)}
                className={`rounded px-2 py-1 text-[10px] transition-colors ${
                  secondaryHeaderOpen
                    ? "bg-white/10 text-white/70"
                    : "text-white/35 hover:bg-white/5 hover:text-white/60"
                }`}
              >
                Controls
              </button>
            </div>
          </div>

          {secondaryHeaderOpen ? (
            <div ref={secondaryHeaderRef} className="terminal-shell-header-secondary">
              <div className="terminal-shell-header-secondary-meta">
                <span className="terminal-shell-header-secondary-label">Context</span>
                <span className="truncate font-mono text-[10px] text-white/45">
                  {compactSecondaryMeta}
                  {terminalTitle ? ` · ${getHeaderTitle(terminalTitle)}` : ""}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => {
                    agentTerminalOpen ? handleCloseAgentTerminal() : handleOpenAgentTerminal();
                    setSecondaryHeaderOpen(false);
                  }}
                  className={`rounded px-2 py-1 text-[10px] transition-colors ${
                    agentTerminalOpen
                      ? "bg-fuchsia-500/10 text-fuchsia-300 ring-1 ring-fuchsia-500/20"
                      : "text-fuchsia-200/60 hover:bg-fuchsia-500/10 hover:text-fuchsia-200"
                  }`}
                  title="Agent output terminal"
                >
                  {agentTerminalOpen ? "Close Agent" : "Agent View"}
                </button>
                <button
                  onClick={() => {
                    browserShellOpen ? handleCloseBrowserShell() : handleOpenBrowserShell();
                    setSecondaryHeaderOpen(false);
                  }}
                  className={`rounded px-2 py-1 text-[10px] transition-colors ${
                    browserShellOpen
                      ? "bg-cyan-500/10 text-cyan-300 ring-1 ring-cyan-500/20"
                      : "text-cyan-200/60 hover:bg-cyan-500/10 hover:text-cyan-200"
                  }`}
                  title="Browser-only demo shell"
                >
                  {browserShellOpen ? "Close Demo" : "Demo Shell"}
                </button>
                <button
                  onClick={() => {
                    toggleDebug();
                    setSecondaryHeaderOpen(false);
                  }}
                  className={`rounded px-2 py-1 text-[10px] transition-colors ${
                    debugMode
                      ? "bg-amber-500/10 text-amber-400 ring-1 ring-amber-500/20"
                      : "text-white/35 hover:bg-white/5 hover:text-white/60"
                  }`}
                  title="Debug Mode (Ctrl+Shift+D)"
                >
                  {debugMode ? "Debug ON" : "Debug"}
                </button>
              </div>

              <div className="terminal-shell-header-secondary-controls">
                <label className="terminal-shell-header-field">
                  <span className="terminal-shell-header-secondary-label">Core</span>
                  <select
                    value={coreType}
                    onChange={(event) => {
                      handleCoreChange(event);
                      setSecondaryHeaderOpen(false);
                    }}
                    className="min-w-0 flex-1 cursor-pointer rounded border border-white/10 bg-zinc-800 px-2 py-1 text-[10px] font-mono text-white/75 focus:border-emerald-500/50 focus:outline-none"
                  >
                    <option value="builtin">Built-in (~12KB)</option>
                    <option value="ghostty">Ghostty (~400KB)</option>
                  </select>
                </label>
                <label className="terminal-shell-header-field">
                  <span className="terminal-shell-header-secondary-label">Theme</span>
                  <select
                    value={themeId}
                    onChange={(event) => {
                      handleThemeChange(event);
                      setSecondaryHeaderOpen(false);
                    }}
                    className="min-w-0 flex-1 cursor-pointer rounded border border-white/10 bg-zinc-800 px-2 py-1 text-[10px] font-mono text-white/75 focus:border-emerald-500/50 focus:outline-none"
                  >
                    {THEMES.map((theme) => (
                      <option key={theme.id} value={theme.id}>
                        {theme.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="text-[9px] text-white/20">
                Core: {CORE_CONFIG[coreType].label} ({CORE_CONFIG[coreType].size})
                {" · "}Theme: {currentTheme.label}
              </div>

              {coreGuidance && (
                <div className="rounded border border-amber-500/20 bg-amber-500/10 p-2 text-[9px] text-amber-100/85">
                  <div className="font-semibold text-amber-200">{coreGuidance.title}</div>
                  <div className="mt-1 text-amber-100/70">{coreGuidance.description}</div>
                  <button
                    onClick={() => {
                      handleUseRecommendedCore();
                      setSecondaryHeaderOpen(false);
                    }}
                    className="mt-2 rounded border border-amber-400/30 px-2 py-1 text-[9px] font-medium text-amber-100 transition-colors hover:bg-amber-400/10"
                  >
                    切換到 Ghostty
                  </button>
                </div>
              )}
            </div>
          ) : null}
        </header>
      ) : (
        <header
          className="flex h-10 shrink-0 items-center justify-between border-b border-white/[0.06] bg-white/[0.02] px-3"
          data-compact-shell="false"
          data-secondary-header-open={secondaryHeaderOpen ? "true" : "false"}
        >
          <div className="flex items-center gap-2.5">
            <span className="text-[10px] font-bold tracking-widest text-emerald-400 uppercase">
              web_cli_v2
            </span>
            <div className="h-3 w-px bg-white/10" />
            <div className="flex items-center gap-1 rounded border border-white/10 bg-black/20 p-0.5">
              <button
                onClick={() => handleModeChange("local")}
                className={`rounded px-2 py-1 text-[10px] transition-colors ${
                  mode === "local"
                    ? "bg-emerald-500/15 text-emerald-300"
                    : "text-white/35 hover:text-white/60"
                }`}
              >
                Local
              </button>
              <button
                onClick={() => handleModeChange("ssh")}
                className={`rounded px-2 py-1 text-[10px] transition-colors ${
                  mode === "ssh"
                    ? "bg-cyan-500/15 text-cyan-300"
                    : "text-white/35 hover:text-white/60"
                }`}
              >
                SSH
              </button>
            </div>
            {browserShellOpen ? (
              <>
                <div className="h-3 w-px bg-white/10" />
                <span className="font-mono text-[10px] text-cyan-200/60">Demo Shell</span>
              </>
            ) : agentTerminalOpen ? (
              <>
                <div className="h-3 w-px bg-white/10" />
                <span className="font-mono text-[10px] text-fuchsia-200/60">Agent Stream</span>
              </>
            ) : mode === "local" ? (
              <>
                <div className="h-3 w-px bg-white/10" />
                <button
                  onClick={() => setSidebarOpen((open) => !open)}
                  className={`flex items-center gap-1.5 rounded px-2 py-1 text-[10px] transition-colors ${
                    sidebarOpen
                      ? "bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20"
                      : "text-white/40 hover:bg-white/5 hover:text-white/60"
                  }`}
                >
                  <span>Sessions</span>
                  {sessions.length > 0 && (
                    <span className="rounded-full bg-white/10 px-1 text-[9px] leading-4 text-white/50">
                      {sessions.length}
                    </span>
                  )}
                </button>
                <div className="h-3 w-px bg-white/10" />
                <span className="font-mono text-[10px] text-white/30">{sessionName}</span>
              </>
            ) : (
              <>
                <div className="h-3 w-px bg-white/10" />
                <span className="font-mono text-[10px] text-cyan-200/60">{sshTargetLabel}</span>
              </>
            )}
          </div>

          <div className="flex-1 px-6 text-center">
            {terminalTitle && (
              <span className="inline-block max-w-xs truncate font-mono text-[10px] text-white/20">
                {getHeaderTitle(terminalTitle)}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-2">
              <button
                onClick={agentTerminalOpen ? handleCloseAgentTerminal : handleOpenAgentTerminal}
                className={`rounded px-2 py-1 text-[10px] transition-colors ${
                  agentTerminalOpen
                    ? "bg-fuchsia-500/10 text-fuchsia-300 ring-1 ring-fuchsia-500/20"
                    : "text-fuchsia-200/50 hover:bg-fuchsia-500/10 hover:text-fuchsia-200"
                }`}
                title="Agent output terminal"
              >
                {agentTerminalOpen ? "Close Agent" : "Agent View"}
              </button>

              <div className="h-3 w-px bg-white/10" />

              <button
                onClick={browserShellOpen ? handleCloseBrowserShell : handleOpenBrowserShell}
                className={`rounded px-2 py-1 text-[10px] transition-colors ${
                  browserShellOpen
                    ? "bg-cyan-500/10 text-cyan-300 ring-1 ring-cyan-500/20"
                    : "text-cyan-200/50 hover:bg-cyan-500/10 hover:text-cyan-200"
                }`}
                title="Browser-only demo shell"
              >
                {browserShellOpen ? "Close Demo" : "Try Demo Shell"}
              </button>

              <div className="h-3 w-px bg-white/10" />

              <div className="relative">
                <button
                  ref={settingsBtnRef}
                  onClick={() => setSettingsOpen((o) => !o)}
                  className={`rounded px-2 py-1 text-[10px] transition-colors ${
                    settingsOpen
                      ? "bg-white/10 text-white/70"
                      : "text-white/30 hover:bg-white/5 hover:text-white/60"
                  }`}
                  title="設定"
                >
                  ⚙ 設定
                </button>
                {settingsOpen && (
                  <div
                    ref={settingsRef}
                    className="absolute right-0 top-full z-50 mt-1.5 w-60 rounded-lg border border-white/10 bg-zinc-900/95 p-3 shadow-2xl backdrop-blur-sm"
                  >
                    <div className="mb-2.5 text-[9px] font-semibold tracking-widest text-white/25 uppercase">
                      偏好設定
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center gap-3">
                        <label className="w-16 shrink-0 text-[10px] text-white/45">Core</label>
                        <select
                          value={coreType}
                          onChange={handleCoreChange}
                          className="min-w-0 flex-1 cursor-pointer rounded border border-white/10 bg-zinc-800 px-2 py-1 text-[10px] font-mono text-white/75 focus:border-emerald-500/50 focus:outline-none"
                        >
                          <option value="builtin">Built-in (~12KB)</option>
                          <option value="ghostty">Ghostty (~400KB)</option>
                        </select>
                      </div>
                      <div className="flex items-center gap-3">
                        <label className="w-16 shrink-0 text-[10px] text-white/45">Theme</label>
                        <select
                          value={themeId}
                          onChange={handleThemeChange}
                          className="min-w-0 flex-1 cursor-pointer rounded border border-white/10 bg-zinc-800 px-2 py-1 text-[10px] font-mono text-white/75 focus:border-emerald-500/50 focus:outline-none"
                        >
                          {THEMES.map((theme) => (
                            <option key={theme.id} value={theme.id}>
                              {theme.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="pt-1 text-[9px] text-white/20">
                        Core: {CORE_CONFIG[coreType].label} ({CORE_CONFIG[coreType].size})
                        {" · "}Theme: {currentTheme.label}
                      </div>
                      {coreGuidance && (
                        <div className="rounded border border-amber-500/20 bg-amber-500/10 p-2 text-[9px] text-amber-100/85">
                          <div className="font-semibold text-amber-200">{coreGuidance.title}</div>
                          <div className="mt-1 text-amber-100/70">{coreGuidance.description}</div>
                          <button
                            onClick={handleUseRecommendedCore}
                            className="mt-2 rounded border border-amber-400/30 px-2 py-1 text-[9px] font-medium text-amber-100 transition-colors hover:bg-amber-400/10"
                          >
                            切換到 Ghostty
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="h-3 w-px bg-white/10" />

              <button
                onClick={toggleDebug}
                className={`rounded px-2 py-1 text-[10px] transition-colors ${
                  debugMode
                    ? "bg-amber-500/10 text-amber-400 ring-1 ring-amber-500/20"
                    : "text-white/30 hover:bg-white/5 hover:text-white/60"
                }`}
                title="Debug Mode (Ctrl+Shift+D)"
              >
                {debugMode ? "Debug ON" : "Debug"}
              </button>

              <div className="h-3 w-px bg-white/10" />
            </div>

            {browserShellOpen ? (
              <div className="flex items-center gap-1.5 text-[10px] text-cyan-300/80">
                <span className="text-[8px]">◇</span>
                <span className="hidden sm:inline">browser-only · no backend · no persistence</span>
              </div>
            ) : agentTerminalOpen ? (
              agentState.status === "error" && agentState.errorMessage ? (
                <div className="flex items-center gap-1.5 text-[10px] text-red-400">
                  <span className="text-[8px]">▲</span>
                  <span className="max-w-28 truncate sm:max-w-44">{agentState.errorMessage}</span>
                </div>
              ) : agentState.status === "loading" || agentState.status === "streaming" ? (
                <div className="flex animate-pulse items-center gap-1.5 text-[10px] text-fuchsia-300">
                  <span className="text-[8px]">◌</span>
                  <span>{agentState.status === "loading" ? "Agent 準備中..." : "streaming..."}</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 text-[10px] text-fuchsia-300/80">
                  <span className="text-[8px]">◇</span>
                  <span className="hidden sm:inline">read-mostly terminal · dedicated endpoint</span>
                </div>
              )
            ) : connectionStatus === "error" && connectionError ? (
              <div className="flex items-center gap-1.5 text-[10px] text-red-400">
                <span className="text-[8px]">▲</span>
                <span className="max-w-28 truncate sm:max-w-44">{connectionError}</span>
              </div>
            ) : connected ? (
              <div className="flex items-center gap-1.5 text-[10px] text-emerald-400">
                <span className="text-[8px]">●</span>
                <span>已連線</span>
              </div>
            ) : connectionStatus === "connecting" || reconnectAttempt > 0 ? (
              <div className="flex animate-pulse items-center gap-1.5 text-[10px] text-yellow-400">
                <span className="text-[8px]">◌</span>
                <span>{mode === "ssh" ? "SSH 連線中..." : "重連中..."}</span>
              </div>
            ) : (
              <button
                onClick={() => {
                  if (mode === "ssh") {
                    handleSshConnect();
                    return;
                  }

                  runtimeRef.current?.connect();
                }}
                className="flex items-center gap-1.5 rounded px-2 py-1 text-[10px] text-white/30 transition-colors hover:bg-emerald-700/20 hover:text-emerald-400 disabled:cursor-not-allowed disabled:opacity-40"
                title="點擊重新連線"
                disabled={mode === "ssh" && !sshConnectReady}
              >
                <span className="text-[8px]">○</span>
                <span>{mode === "ssh" ? "SSH 連線" : "未連線"}</span>
              </button>
            )}
          </div>
        </header>
      )}

      <div className="min-h-0 flex-1 overflow-hidden">
        <div
          className={`${compactShell ? "terminal-shell-stage--compact " : ""}relative h-full overflow-hidden`}
          data-drawer-width={shellPolicy.drawerWidth}
        >
          {sidebarVisible && (
            <div
              className={`absolute inset-0 z-30 ${shellPolicy.usesOverlayDrawer ? "bg-black/30" : ""}`}
              onClick={() => setSidebarOpen(false)}
            />
          )}

          <div
            className={`${drawerClasses} ${sidebarVisible ? "translate-x-0" : "-translate-x-full"}`}
          >
            <div className="flex h-full flex-col">
              <div className="flex items-center justify-between border-b border-white/[0.06] px-3 py-2.5">
                <span className="text-[9px] font-semibold tracking-widest text-white/35 uppercase">
                  Sessions
                </span>
                <button
                  onClick={handleRefreshSessions}
                  className="text-sm leading-none text-white/25 transition-colors hover:text-white/60"
                  title="重新整理"
                >
                  ↻
                </button>
              </div>

              <div className="border-b border-white/[0.06] px-3 py-3">
                <div className="mb-1.5 text-[9px] uppercase tracking-wider text-white/25">
                  連線目標
                </div>
                <div className="flex gap-1.5">
                  <HydrationSafeInput
                    type="text"
                    value={newSessionInput}
                    onChange={(e) => setNewSessionInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleNewSessionConnect();
                    }}
                    className="min-w-0 flex-1 rounded border border-white/10 bg-zinc-900 px-2 py-1 text-[10px] font-mono text-white/75 placeholder-white/20 focus:border-emerald-500/40 focus:outline-none"
                    placeholder="tmux session name"
                  />
                  <button
                    onClick={handleNewSessionConnect}
                    className="rounded bg-emerald-700/70 px-2.5 py-1 text-[10px] font-medium text-emerald-100 transition-colors hover:bg-emerald-600/70"
                  >
                    連線
                  </button>
                </div>
                {connected ? (
                  <button
                    onClick={handleDisconnect}
                    className="mt-1.5 w-full rounded border border-white/10 py-1 text-[10px] text-white/30 transition-colors hover:border-red-500/30 hover:text-red-400"
                  >
                    斷線
                  </button>
                ) : null}
              </div>

              <div className="flex-1 overflow-y-auto">
                {sessions.length === 0 ? (
                  <div className="px-3 py-10 text-center text-[10px] leading-6 text-white/20">
                    尚無 session
                    <br />
                    輸入名稱後點「連線」建立新 session
                  </div>
                ) : (
                  <div>
                    <div className="px-3 pb-1 pt-2.5 text-[9px] uppercase tracking-wider text-white/20">
                      現有 Sessions
                    </div>
                    {sessions.map((session) => (
                      <div
                        key={session.name}
                        className={`group relative flex cursor-pointer items-center gap-2.5 px-3 py-2 transition-colors hover:bg-white/[0.04] ${
                          session.name === sessionName && connected
                            ? "bg-emerald-500/[0.06]"
                            : ""
                        }`}
                        onClick={() => handleSwitchSession(session.name)}
                      >
                        {session.name === sessionName && connected ? (
                          <div className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full bg-emerald-500" />
                        ) : null}
                        <span
                          className={`text-[8px] ${
                            session.attached ? "text-emerald-400" : "text-zinc-600"
                          }`}
                        >
                          ●
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-mono text-[10px] text-white/70">
                            {session.name}
                          </div>
                          <div className="text-[9px] text-white/25">
                            {new Date(session.created * 1000).toLocaleString()} ·{" "}
                            {session.windows}w
                          </div>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteConfirm(session.name);
                          }}
                          className="text-[10px] text-white/20 opacity-0 transition-all hover:text-red-400 group-hover:opacity-100"
                          title="刪除 session"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {!browserShellOpen && !agentTerminalOpen && mode === "ssh" ? (
            <div className="absolute inset-x-2 top-2 z-20 rounded-xl border border-cyan-500/20 bg-zinc-950/90 p-4 shadow-2xl backdrop-blur-sm sm:inset-x-4 sm:top-4">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <div className="text-[10px] font-semibold tracking-widest text-cyan-300 uppercase">
                  SSH Connection
                </div>
                <div className="mt-1 text-[10px] text-white/35">
                  僅保留於目前頁面生命週期，不會寫入 localStorage 或後端。
                </div>
              </div>
              {connected ? (
                <button
                  onClick={handleDisconnect}
                  className="rounded border border-white/10 px-3 py-1.5 text-[10px] text-white/50 transition-colors hover:border-red-500/30 hover:text-red-400"
                >
                  中斷 SSH
                </button>
              ) : null}
            </div>

            <div className="grid grid-cols-12 gap-2">
              <HydrationSafeInput
                type="text"
                value={sshConfig.host}
                onChange={(event) => handleSshFieldChange("host", event.currentTarget.value)}
                className="col-span-12 sm:col-span-4 rounded border border-white/10 bg-zinc-900 px-2 py-1.5 text-[10px] font-mono text-white/80 placeholder-white/20 focus:border-cyan-500/40 focus:outline-none"
                placeholder="host"
              />
              <HydrationSafeInput
                type="text"
                value={sshConfig.port}
                onChange={(event) => handleSshFieldChange("port", event.currentTarget.value)}
                className="col-span-6 sm:col-span-2 rounded border border-white/10 bg-zinc-900 px-2 py-1.5 text-[10px] font-mono text-white/80 placeholder-white/20 focus:border-cyan-500/40 focus:outline-none"
                placeholder="22"
              />
              <HydrationSafeInput
                type="text"
                value={sshConfig.username}
                onChange={(event) => handleSshFieldChange("username", event.currentTarget.value)}
                className="col-span-6 sm:col-span-3 rounded border border-white/10 bg-zinc-900 px-2 py-1.5 text-[10px] font-mono text-white/80 placeholder-white/20 focus:border-cyan-500/40 focus:outline-none"
                placeholder="username"
              />
              <div className="col-span-12 sm:col-span-3 flex items-center rounded border border-white/10 bg-zinc-900 p-0.5">
                <button
                  onClick={() => handleSshAuthChange("password")}
                  className={`flex-1 rounded px-2 py-1 text-[10px] transition-colors ${
                    sshConfig.authMethod === "password"
                      ? "bg-cyan-500/15 text-cyan-200"
                      : "text-white/35 hover:text-white/65"
                  }`}
                >
                  Password
                </button>
                <button
                  onClick={() => handleSshAuthChange("privateKey")}
                  className={`flex-1 rounded px-2 py-1 text-[10px] transition-colors ${
                    sshConfig.authMethod === "privateKey"
                      ? "bg-cyan-500/15 text-cyan-200"
                      : "text-white/35 hover:text-white/65"
                  }`}
                >
                  Private Key
                </button>
              </div>
            </div>

            {sshConfig.authMethod === "password" ? (
              <HydrationSafeInput
                type="password"
                value={sshConfig.password}
                onChange={(event) => handleSshFieldChange("password", event.currentTarget.value)}
                className="mt-2 w-full rounded border border-white/10 bg-zinc-900 px-2 py-1.5 text-[10px] font-mono text-white/80 placeholder-white/20 focus:border-cyan-500/40 focus:outline-none"
                placeholder="password"
              />
            ) : (
              <HydrationSafeTextarea
                value={sshConfig.privateKey}
                onChange={(event) => handleSshFieldChange("privateKey", event.currentTarget.value)}
                className="mt-2 h-28 w-full rounded border border-white/10 bg-zinc-900 px-2 py-1.5 text-[10px] font-mono text-white/80 placeholder-white/20 focus:border-cyan-500/40 focus:outline-none"
                placeholder="-----BEGIN OPENSSH PRIVATE KEY-----"
              />
            )}

            <div className="mt-3 flex items-center justify-between gap-3">
              <div className="text-[10px] text-white/25">
                {connectionError && connectionStatus === "error"
                  ? connectionError
                  : "使用受信任環境；disconnect 或重新整理後不會保留 credential。"}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleClearSshForm}
                  className="rounded border border-white/10 px-3 py-1.5 text-[10px] text-white/45 transition-colors hover:border-white/20 hover:text-white/70"
                >
                  清空
                </button>
                <button
                  onClick={handleSshConnect}
                  disabled={!sshConnectReady || connectionStatus === "connecting"}
                  className="rounded bg-cyan-600/80 px-3 py-1.5 text-[10px] font-medium text-cyan-50 transition-colors hover:bg-cyan-500/80 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  連線 SSH
                </button>
              </div>
            </div>
            </div>
          ) : null}

          {browserShellOpen ? (
            <div className="absolute inset-x-2 top-2 z-20 rounded-xl border border-cyan-500/20 bg-zinc-950/90 p-4 shadow-2xl backdrop-blur-sm sm:inset-x-4 sm:top-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-[10px] font-semibold tracking-widest text-cyan-300 uppercase">
                  Demo / Fallback Shell
                </div>
                <div className="mt-1 text-[10px] text-white/35">
                  Browser-only，沒有 backend transport，也不會保留任何檔案或輸入。
                </div>
              </div>
              <button
                onClick={handleCloseBrowserShell}
                className="rounded border border-white/10 px-3 py-1.5 text-[10px] text-white/50 transition-colors hover:border-white/20 hover:text-white/75"
              >
                返回工作 shell
              </button>
            </div>
            </div>
          ) : null}

          {agentTerminalOpen ? (
            <div className="absolute inset-x-2 top-2 z-20 rounded-xl border border-fuchsia-500/20 bg-zinc-950/90 p-4 shadow-2xl backdrop-blur-sm sm:inset-x-4 sm:top-4">
            <div className="mb-3 flex items-start justify-between gap-4">
              <div>
                <div className="text-[10px] font-semibold tracking-widest text-fuchsia-300 uppercase">
                  Agent Output Terminal
                </div>
                <div className="mt-1 text-[10px] text-white/35">
                  專用 `/api/agent-stream` Markdown stream；這不是 tmux session，也不是 SSH shell。
                </div>
              </div>
              <button
                onClick={handleCloseAgentTerminal}
                className="rounded border border-white/10 px-3 py-1.5 text-[10px] text-white/50 transition-colors hover:border-white/20 hover:text-white/75"
              >
                返回工作 shell
              </button>
            </div>

            <HydrationSafeTextarea
              value={agentPrompt}
              onChange={(event) => setAgentPrompt(event.currentTarget.value)}
              className="h-24 w-full rounded border border-white/10 bg-zinc-900 px-3 py-2 text-[11px] text-white/80 placeholder-white/20 focus:border-fuchsia-500/40 focus:outline-none"
              placeholder="Describe what you want the agent terminal to stream..."
            />

            <div className="mt-3 flex items-center justify-between gap-3">
              <div className="text-[10px] text-white/25">
                {agentState.status === "error" && agentState.errorMessage
                  ? agentState.errorMessage
                  : "Start / Abort / Retry are UI actions; Ctrl+C inside the terminal also aborts the stream."}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => void handleRetryAgentStream()}
                  disabled={!agentState.lastPrompt || agentState.status === "loading" || agentState.status === "streaming"}
                  className="rounded border border-white/10 px-3 py-1.5 text-[10px] text-white/55 transition-colors hover:border-white/20 hover:text-white/80 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Retry
                </button>
                <button
                  onClick={handleAbortAgentStream}
                  disabled={agentState.status !== "loading" && agentState.status !== "streaming"}
                  className="rounded border border-white/10 px-3 py-1.5 text-[10px] text-white/55 transition-colors hover:border-red-500/30 hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Abort
                </button>
                <button
                  onClick={() => void handleStartAgentStream()}
                  disabled={!agentPrompt.trim() || agentState.status === "loading" || agentState.status === "streaming"}
                  className="rounded bg-fuchsia-600/80 px-3 py-1.5 text-[10px] font-medium text-fuchsia-50 transition-colors hover:bg-fuchsia-500/80 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Start Stream
                </button>
              </div>
            </div>
            </div>
          ) : null}

          <div
            className={`absolute inset-0 overflow-hidden ${currentTheme.cssClass} ${
              debugMode ? "ring-1 ring-inset ring-amber-500/15" : ""
            }`}
          >
            {browserShellOpen ? (
              <BrowserShell
                key={`browser-shell-${coreType}`}
                coreType={coreType}
                onTitleChange={handleTitle}
                className="h-full w-full"
              />
            ) : agentTerminalOpen ? (
              <AgentTerminal
                key={`agent-terminal-${coreType}`}
                ref={agentTerminalRef}
                coreType={coreType}
                onTitleChange={handleTitle}
                onStateChange={setAgentState}
                className="h-full w-full"
              />
            ) : (
              <TerminalRuntime
                ref={runtimeRef}
                mode={mode}
                sessionName={sessionName}
                sshConfig={sshConfig}
                coreType={coreType}
                debugEnabled={debugMode}
                onConnectionStateChange={handleConnectionStateChange}
                onTitleChange={handleTitle}
                onDiagnosticsChange={handleDiagnosticsChange}
                className="h-full w-full"
              />
            )}
          </div>
        </div>
      </div>

      {debugMode ? (
        <div className="border-t border-amber-500/20 bg-zinc-950/95">
          <div
            className="flex cursor-pointer items-center justify-between px-4 py-1.5"
            onClick={() => setPanelExpanded((p) => !p)}
          >
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-semibold text-amber-400">Debug Panel</span>
              <div
                className="flex items-center gap-1 rounded bg-white/5 p-0.5"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  onClick={() => setActiveDebugTab("escape")}
                  className={`rounded px-2 py-0.5 text-[9px] transition-colors ${
                    activeDebugTab === "escape"
                      ? "bg-amber-500/20 text-amber-300"
                      : "text-white/30 hover:text-white/60"
                  }`}
                >
                  Escape ({diagnostics.logs.length})
                </button>
                <button
                  onClick={() => setActiveDebugTab("hex")}
                  className={`rounded px-2 py-0.5 text-[9px] transition-colors ${
                    activeDebugTab === "hex"
                      ? "bg-amber-500/20 text-amber-300"
                      : "text-white/30 hover:text-white/60"
                  }`}
                >
                  Hex ({diagnostics.hexEntries.length})
                </button>
              </div>
            </div>
            <span className="text-[10px] text-white/25">
              {panelExpanded ? "▼" : "▶"}
            </span>
          </div>

          {panelExpanded ? (
            <div
              ref={panelContentRef}
              className="debug-panel-scroll h-48 overflow-y-auto border-t border-white/[0.06] px-4 py-2 font-mono text-[10px]"
            >
              {activeDebugTab === "escape" ? (
                <div className="space-y-1">
                  {diagnostics.logs.length > 0 ? (
                    diagnostics.logs.map((log, index) => (
                      <div key={`${log.timestamp}-${index}`} className="flex gap-2 text-white/50">
                        <span className="text-white/20">
                          {new Date(log.timestamp).toISOString().slice(11, 23)}
                        </span>
                        <span className="text-amber-400">[{log.type}]</span>
                        <span className="text-emerald-400">{log.sequence}</span>
                        <span>{log.description}</span>
                      </div>
                    ))
                  ) : (
                    <div className="text-white/25">
                      {diagnostics.availability === "degraded" && diagnostics.message
                        ? diagnostics.message
                        : "等待終端輸出..."}
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-3 text-white/50">
                  {diagnostics.hexEntries.length > 0 ? (
                    diagnostics.hexEntries.map((entry, index) => (
                      <div key={`${entry.timestamp}-${index}`} className="space-y-0.5">
                        <div className="text-white/25">
                          [{new Date(entry.timestamp).toISOString().slice(11, 23)}]{" "}
                          {entry.byteLength}B
                        </div>
                        <pre className="whitespace-pre-wrap text-emerald-400/70">{entry.dump}</pre>
                      </div>
                    ))
                  ) : (
                    <div className="text-white/25">等待 PTY 輸出...</div>
                  )}
                </div>
              )}
            </div>
          ) : null}
        </div>
      ) : null}

      {deleteConfirm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-80 rounded-xl border border-white/10 bg-zinc-900 p-5 shadow-2xl">
            <p className="mb-1 text-sm font-medium text-white/80">
              刪除「{deleteConfirm}」？
            </p>
            <p className="mb-4 text-xs leading-5 text-white/35">
              此操作無法復原。
              {deleteConfirm === sessionName && connected ? (
                <span className="text-red-400/80">（當前連線的 session，刪除後將斷線）</span>
              ) : null}
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="rounded-lg bg-white/5 px-4 py-1.5 text-xs text-white/50 transition-colors hover:bg-white/10 hover:text-white/80"
              >
                取消
              </button>
              <button
                onClick={() => void handleDelete(deleteConfirm)}
                className="rounded-lg bg-red-600/80 px-4 py-1.5 text-xs text-white transition-colors hover:bg-red-600"
              >
                確認刪除
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
