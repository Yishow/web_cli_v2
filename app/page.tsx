"use client";

import { useCallback, useRef, useState } from "react";
import { Terminal, useTerminal } from "@wterm/react";
import type { WTerm } from "@wterm/dom";

export default function WebCliV2() {
  const [sessionName, setSessionName] = useState("webcli-main");
  const [connected, setConnected] = useState(false);

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
      console.log("[wterm] Connected to tmux session:", sessionName);
    };

    ws.onmessage = (event: MessageEvent) => {
      write(event.data as string);
    };

    ws.onclose = () => {
      setConnected(false);
      write("\r\n\x1b[90m[disconnected]\x1b[0m\r\n");
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
    // Auto-connect when terminal is ready
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      connect();
    }
  }, [connect]);

  return (
    <div className="flex h-screen flex-col bg-zinc-950">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-white/10 bg-zinc-900/50 px-4 py-2 text-sm">
        <div className="flex items-center gap-3">
          <span className="font-semibold text-emerald-400">web_cli_v2</span>
          <span className="text-white/40">•</span>
          <span className="text-white/60 text-xs">wterm + tmux</span>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="text"
            value={sessionName}
            onChange={(e) => setSessionName(e.target.value)}
            className="rounded-md bg-zinc-800 px-3 py-1 text-xs font-mono border border-white/20 w-56 focus:outline-none focus:border-emerald-500"
            placeholder="tmux session name"
          />
          <button
            onClick={connect}
            disabled={connected}
            className="rounded-md bg-emerald-600 px-4 py-1 text-xs font-medium hover:bg-emerald-500 disabled:bg-emerald-800 disabled:text-white/50 transition-colors"
          >
            {connected ? "已連線" : "連線 / 重新連線"}
          </button>
        </div>

        <div className={`text-xs px-2 py-0.5 rounded ${connected ? "bg-emerald-500/20 text-emerald-400" : "bg-white/10 text-white/40"}`}>
          {connected ? "● 已連線" : "○ 未連線"}
        </div>
      </header>

      {/* Terminal */}
      <div className="flex-1 overflow-hidden">
        <Terminal
          ref={ref}
          cols={120}
          rows={36}
          autoResize
          debug={false}
          wasmUrl="/wterm.wasm"
          onReady={handleReady}
          onData={handleData}
          onResize={handleResize}
          className="h-full w-full"
        />
      </div>

      {/* Footer */}
      <footer className="border-t border-white/10 bg-zinc-900/50 px-4 py-1.5 text-[10px] text-white/40 flex justify-between items-center">
        <div>
          Session: <span className="font-mono text-emerald-400">{sessionName}</span>
        </div>
        <div>
          Tip: 在終端內輸入 <span className="font-mono text-white/60">tmux new-window</span> 或使用 <span className="font-mono">Ctrl-b c</span>
        </div>
      </footer>
    </div>
  );
}
