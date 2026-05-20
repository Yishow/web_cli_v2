import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_HEADER_TITLE,
  DEFAULT_PAGE_TITLE,
  formatDocumentTitle,
  getHeaderTitle,
} from "./terminal-title";

test("uses stable defaults before any terminal title arrives", () => {
  assert.equal(DEFAULT_PAGE_TITLE, "web_cli_v2");
  assert.equal(DEFAULT_HEADER_TITLE, "終端");
});

test("formatDocumentTitle appends the app name to terminal titles", () => {
  assert.equal(formatDocumentTitle("[webcli-main] vim"), "[webcli-main] vim — web_cli_v2");
  assert.equal(formatDocumentTitle(""), "web_cli_v2");
});

test("getHeaderTitle falls back to the default label for empty titles", () => {
  assert.equal(getHeaderTitle(""), "終端");
  assert.equal(getHeaderTitle("htop"), "htop");
});
