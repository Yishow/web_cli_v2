import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

test("compact shell root uses explicit viewport height so the terminal stage can expand", () => {
  const css = fs.readFileSync(new URL("./globals.css", import.meta.url), "utf8");
  const compactRootBlock = css.match(/\.terminal-shell-root--compact\s*\{([^}]*)\}/s);

  assert.ok(compactRootBlock, "expected .terminal-shell-root--compact CSS block");
  assert.match(compactRootBlock[1], /^\s*height:\s*100dvh;/m);
});
