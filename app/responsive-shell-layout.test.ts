import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

test("compact shell root uses a viewport-height variable with 100dvh fallback", () => {
  const css = fs.readFileSync(new URL("./globals.css", import.meta.url), "utf8");
  const compactRootBlock = css.match(/\.terminal-shell-root--compact\s*\{([^}]*)\}/s);

  assert.ok(compactRootBlock, "expected .terminal-shell-root--compact CSS block");
  assert.match(
    compactRootBlock[1],
    /^\s*height:\s*var\(--terminal-shell-viewport-height,\s*100dvh\);/m,
  );
});

test("compact shell root is pinned to the viewport instead of scrolling with the layout viewport", () => {
  const css = fs.readFileSync(new URL("./globals.css", import.meta.url), "utf8");
  const compactRootBlock = css.match(/\.terminal-shell-root--compact\s*\{([^}]*)\}/s);

  assert.ok(compactRootBlock, "expected .terminal-shell-root--compact CSS block");
  assert.match(compactRootBlock[1], /^\s*position:\s*fixed;/m);
  assert.match(compactRootBlock[1], /^\s*top:\s*0;/m);
  assert.match(compactRootBlock[1], /^\s*left:\s*0;/m);
  assert.match(compactRootBlock[1], /^\s*right:\s*0;/m);
  assert.match(compactRootBlock[1], /^\s*overflow:\s*hidden;/m);
});
