import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { HydrationSafeInput, HydrationSafeTextarea, rootHydrationProps } from "./hydration-guards";

test("rootHydrationProps suppresses known external html mutations during hydration", () => {
  assert.equal(rootHydrationProps.suppressHydrationWarning, true);
});

test("HydrationSafeInput preserves input props while suppressing hydration noise", () => {
  const element = HydrationSafeInput({
    type: "text",
    value: "webcli-main",
    className: "field",
    placeholder: "tmux session name",
  });

  assert.equal(element.type, "input");
  assert.equal(element.props.suppressHydrationWarning, true);
  assert.equal(element.props.value, "webcli-main");
  assert.equal(element.props.className, "field");
  assert.equal(element.props.placeholder, "tmux session name");
});

test("HydrationSafeTextarea preserves textarea props while suppressing hydration noise", () => {
  const element = HydrationSafeTextarea({
    value: "-----BEGIN OPENSSH PRIVATE KEY-----",
    className: "field",
  });

  assert.equal(element.type, "textarea");
  assert.equal(element.props.suppressHydrationWarning, true);
  assert.equal(element.props.value, "-----BEGIN OPENSSH PRIVATE KEY-----");
  assert.equal(element.props.className, "field");
});

test("page and layout route external-mutable nodes through hydration guards", () => {
  const appDir = path.join(import.meta.dirname, "..", "app");
  const pageSource = fs.readFileSync(path.join(appDir, "page.tsx"), "utf8");
  const layoutSource = fs.readFileSync(path.join(appDir, "layout.tsx"), "utf8");

  assert.match(pageSource, /HydrationSafeInput/g);
  assert.match(pageSource, /HydrationSafeTextarea/g);
  assert.match(layoutSource, /rootHydrationProps/);
});
