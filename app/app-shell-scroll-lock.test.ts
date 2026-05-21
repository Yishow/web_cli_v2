import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

test("app shell locks page scrolling so iOS does not drag the whole page when the keyboard is open", () => {
  const css = fs.readFileSync(new URL("./globals.css", import.meta.url), "utf8");

  assert.match(
    css,
    /html,\s*body\s*\{[^}]*overflow:\s*hidden;[^}]*overscroll-behavior:\s*none;/s,
  );
});
