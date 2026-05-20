import type { CSSProperties } from "react";

export const TERMINAL_CJK_FONT_STACK = [
  '"JetBrains Mono"',
  '"Menlo"',
  '"Consolas"',
  '"DejaVu Sans Mono"',
  '"Noto Sans Mono CJK TC"',
  '"Noto Sans Mono CJK SC"',
  '"WenQuanYi Zen Hei Mono"',
  '"Courier New"',
  "monospace",
].join(", ");

type TerminalStyle = CSSProperties & {
  "--term-font-family": string;
};

export const TERMINAL_STYLE: TerminalStyle = {
  "--term-font-family": TERMINAL_CJK_FONT_STACK,
};
