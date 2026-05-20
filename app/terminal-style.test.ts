import assert from "node:assert/strict";
import test from "node:test";

import { TERMINAL_FONT_STACK, TERMINAL_STYLE } from "./terminal-style";

test("matches the upstream wterm default font stack for runtime style props", () => {
  assert.equal(
    TERMINAL_FONT_STACK,
    '"Menlo", "Consolas", "DejaVu Sans Mono", "Courier New", monospace',
  );
  assert.equal(TERMINAL_STYLE["--term-font-family"], TERMINAL_FONT_STACK);
});
