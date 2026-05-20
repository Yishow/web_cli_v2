import assert from "node:assert/strict";
import test from "node:test";

import { BROWSER_SHELL_FILES, BROWSER_SHELL_GREETING } from "./browser-shell-files";

test("preloads a project-specific browser shell file set", () => {
  assert.equal(typeof BROWSER_SHELL_FILES["/home/user/README.md"], "string");
  assert.equal(typeof BROWSER_SHELL_FILES["/home/user/package.json"], "string");
  assert.equal(typeof BROWSER_SHELL_FILES["/home/user/examples/hello.sh"], "string");
  assert.equal(typeof BROWSER_SHELL_FILES["/home/user/SSH_NOTES.md"], "string");
  assert.match(BROWSER_SHELL_FILES["/home/user/SSH_NOTES.md"], /SSH mode/i);
});

test("greets users with fallback-shell constraints and starter commands", () => {
  assert.equal(BROWSER_SHELL_GREETING[0], "web_cli_v2 demo shell");
  assert.match(BROWSER_SHELL_GREETING.join("\n"), /browser-only/i);
  assert.match(BROWSER_SHELL_GREETING.join("\n"), /no backend/i);
  assert.match(BROWSER_SHELL_GREETING.join("\n"), /no persistence/i);
  assert.match(BROWSER_SHELL_GREETING.join("\n"), /ls, cat README\.md, bash examples\/hello\.sh/);
});
