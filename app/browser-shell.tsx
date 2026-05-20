"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { TerminalCore } from "@wterm/core";
import type { WTerm } from "@wterm/dom";
import { GhosttyCore } from "@wterm/ghostty";
import { BashShell } from "@wterm/just-bash";
import { Terminal, useTerminal } from "@wterm/react";

import type { CoreType } from "./core-preference";
import { BROWSER_SHELL_FILES, BROWSER_SHELL_GREETING } from "./browser-shell-files";
import { TERMINAL_STYLE } from "./terminal-style";
import { attachImeCompositionAnchor } from "./terminal-runtime/ime-anchor";
import { getGhosttyLoadOptions, getTerminalCoreProps } from "./terminal-runtime/core-loader";
import { patchWideCharRendererWorkaround } from "./terminal-runtime/wide-char-workaround";

interface BrowserShellProps {
  coreType: CoreType;
  onTitleChange?: (title: string) => void;
  className?: string;
}

export function BrowserShell({ coreType, onTitleChange, className }: BrowserShellProps) {
  const { ref, write } = useTerminal();
  const shellRef = useRef<BashShell | null>(null);
  const imeAnchorCleanupRef = useRef<(() => void) | null>(null);
  const [ghosttyCore, setGhosttyCore] = useState<TerminalCore | null>(null);
  const [ghosttyLoadError, setGhosttyLoadError] = useState<string | null>(null);
  const [coreReady, setCoreReady] = useState(false);

  const handleReady = useCallback((terminal: WTerm) => {
    patchWideCharRendererWorkaround(terminal.bridge);
    imeAnchorCleanupRef.current?.();
    imeAnchorCleanupRef.current = attachImeCompositionAnchor(terminal.element);
    setCoreReady(true);
    onTitleChange?.("Demo Shell");

    if (shellRef.current) {
      return;
    }

    const shell = new BashShell({
      files: BROWSER_SHELL_FILES,
      greeting: BROWSER_SHELL_GREETING,
    });

    shellRef.current = shell;
    shell.attach(write);
  }, [onTitleChange, write]);

  const handleData = useCallback((data: string) => {
    shellRef.current?.handleInput(data);
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
        console.error("[browser-shell] Failed to load Ghostty core:", message);
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
          onTitleChange?.(title || "Demo Shell");
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
}
