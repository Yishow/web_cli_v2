import type { CSSProperties } from "react";

export const TERMINAL_FONT_STACK = [
  '"Menlo"',
  '"Consolas"',
  '"DejaVu Sans Mono"',
  '"Courier New"',
  "monospace",
].join(", ");

type TerminalStyle = CSSProperties & {
  "--term-font-family": string;
};

export const TERMINAL_STYLE: TerminalStyle = {
  "--term-font-family": TERMINAL_FONT_STACK,
};
