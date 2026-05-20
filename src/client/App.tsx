"use client";

import { useCallback, useRef, useState } from "react";
import { Terminal, useTerminal } from "@wterm/react";
import type { WTerm } from "@wterm/dom";

export default function WebCliV2() {
  const [sessionName, setSessionName] = useState("webcli-main");
  const [connected, setConnected] = useState(false);
  const [debug] = useState(true);

  const { ref, write } = useTerminal();
  const wsRef = useRef<WebSocket | null>(null);

  const connect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
    }

    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${proto}//${window.location.host}/api/terminal?session=${encodeURIComponent(sessionName)}`;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      console.log("[wterm] WebSocket connected to tmux session:", sessionName);
    };

    ws.onmessage = (event) => {
      write(event.data as string);
    };

    ws.onclose = () => {
      setConnected(false);
      write("\r\n\x1b[90m[disconnected from tmux]\x1b[0m\r\n");
      wsRef.current = null;
    };

    ws.onerror = () => {
      setConnected(false);
      write("\r\n\x1b[31m[connection error]\x1b[0m\r\n");
    };
  }, [sessionName, write]);

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

  const handleReady = useCallback((wt: WTerm) => {
    // Auto connect on ready
    if (!wsRef.current) {
      connect();
    }
  }, [connect]);

  return (
    <div className="flex h-screen flex-col bg-zinc-950 text-white">
      <header className="flex items-center justify-between border-b border-white/10 px-4 py-2 text-sm">
        <div className="flex items-center gap-3">
          <span className="font-mono text-emerald-400">web_cli_v2</span>
          <span className="text-white/40">•</span>
          <span className="text-white/60">wterm + tmux</span>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="text"
            value={sessionName}
            onChange={(e) => setSessionName(e.target.value)}
            className="rounded bg-zinc-900 px-2 py-1 text-xs font-mono border border-white/20 w-48"
            placeholder="tmux session name"
          />
          <button
            onClick={connect}
            disabled={connected}
            className="rounded bg-emerald-600 px-3 py-1 text-xs hover:bg-emerald-500 disabled:opacity-50"
          >
            {connected ? "Connected" : "Connect / Reconnect"}
          </button>
        </div>

        <div className="text-xs text-white/40">
          {connected ? "● Connected to tmux" : "○ Disconnected"}
        </div>
      </header>

      <div className="flex-1">
        <Terminal
          ref={ref}
          cols={120}
          rows={32}
          autoResize
          debug={debug}
          wasmUrl="/wterm.wasm"
          onReady={handleReady}
          onData={handleData}
          onResize={handleResize}
          className="h-full w-full"
          style={{ background: "#0a0a0a" }}
        />
      </div>

      <footer className="border-t border-white/10 px-4 py-1 text-[10px] text-white/40 flex justify-between">
        <div>
          Session: <span className="font-mono text-emerald-400">{sessionName}</span>
        </div>
        <div>
          Tip: Type <span className="font-mono">tmux new-window</span> or <span className="font-mono">C-b c</span> inside
        </div>
      </footer>
    </div>
  );
}
