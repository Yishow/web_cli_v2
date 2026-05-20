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

import type { AgentStreamState } from "./agent-shell";
import { AgentStreamShell } from "./agent-shell";
import type { CoreType } from "./core-preference";
import { TERMINAL_STYLE } from "./terminal-style";
import { patchFullRepaintWorkaround } from "./terminal-runtime/full-repaint-workaround";
import { attachImeCompositionAnchor } from "./terminal-runtime/ime-anchor";
import { getGhosttyLoadOptions, getTerminalCoreProps } from "./terminal-runtime/core-loader";
import { patchWideCharRendererWorkaround } from "./terminal-runtime/wide-char-workaround";

export interface AgentTerminalHandle {
  start: (prompt: string) => Promise<void>;
  abort: () => void;
  retry: () => Promise<void>;
}

interface AgentTerminalProps {
  coreType: CoreType;
  onTitleChange?: (title: string) => void;
  onStateChange?: (state: AgentStreamState) => void;
  className?: string;
}

export const AgentTerminal = forwardRef<AgentTerminalHandle, AgentTerminalProps>(
  function AgentTerminal({ coreType, onTitleChange, onStateChange, className }, forwardedRef) {
    const { ref, write } = useTerminal();
    const shellRef = useRef<AgentStreamShell | null>(null);
    const imeAnchorCleanupRef = useRef<(() => void) | null>(null);
    const onStateChangeRef = useRef(onStateChange);
    const [ghosttyCore, setGhosttyCore] = useState<TerminalCore | null>(null);
    const [ghosttyLoadError, setGhosttyLoadError] = useState<string | null>(null);
    const [coreReady, setCoreReady] = useState(false);

    const handleReady = useCallback((terminal: WTerm) => {
      patchFullRepaintWorkaround(terminal.bridge);
      patchWideCharRendererWorkaround(terminal.bridge);
      imeAnchorCleanupRef.current?.();
      imeAnchorCleanupRef.current = attachImeCompositionAnchor(terminal.element);
      setCoreReady(true);
      onTitleChange?.("Agent Stream");

      if (shellRef.current) {
        return;
      }

      const shell = new AgentStreamShell({
        onStateChange: (state) => {
          onStateChangeRef.current?.(state);
        },
      });

      shellRef.current = shell;
      shell.attach(write);
    }, [onTitleChange, write]);

    const handleData = useCallback((data: string) => {
      shellRef.current?.handleInput(data);
    }, []);

    useImperativeHandle(
      forwardedRef,
      () => ({
        start: async (prompt: string) => {
          await shellRef.current?.start(prompt);
        },
        abort: () => {
          shellRef.current?.abort();
        },
        retry: async () => {
          await shellRef.current?.retry();
        },
      }),
      [],
    );

    useEffect(() => {
      onStateChangeRef.current = onStateChange;
    }, [onStateChange]);

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
          console.error("[agent-terminal] Failed to load Ghostty core:", message);
          setGhosttyLoadError(message);
        });

      return () => {
        cancelled = true;
      };
    }, [coreType]);

    useEffect(() => {
      return () => {
        imeAnchorCleanupRef.current?.();
        imeAnchorCleanupRef.current = null;
        shellRef.current = null;
      };
    }, []);

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
          ref={ref}
          cols={120}
          rows={36}
          autoResize
          onData={handleData}
          onTitle={(title) => {
            onTitleChange?.(title || "Agent Stream");
          }}
          onReady={handleReady}
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
