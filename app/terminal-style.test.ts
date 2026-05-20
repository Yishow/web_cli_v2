import assert from "node:assert/strict";
import test from "node:test";

import { TERMINAL_CJK_FONT_STACK, TERMINAL_STYLE } from "./terminal-style";

test("exposes a CJK-capable terminal font stack for runtime style props", () => {
  assert.match(TERMINAL_CJK_FONT_STACK, /Noto Sans Mono CJK TC/);
  assert.match(TERMINAL_CJK_FONT_STACK, /Noto Sans Mono CJK SC/);
  assert.match(TERMINAL_CJK_FONT_STACK, /WenQuanYi Zen Hei Mono/);
  assert.equal(TERMINAL_STYLE["--term-font-family"], TERMINAL_CJK_FONT_STACK);
});
