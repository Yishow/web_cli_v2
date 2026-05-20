import assert from "node:assert/strict";
import test from "node:test";

import {
  createPtyClientMessageState,
  handlePtyClientMessage,
} from "./pty-client-message";

test("buffers input until the first resize can spawn the PTY", () => {
  const state = createPtyClientMessageState();

  assert.deepEqual(handlePtyClientMessage(state, "pwd\r", false), {
    type: "buffer",
  });

  assert.deepEqual(handlePtyClientMessage(state, "\x1b[RESIZE:120;36]", false), {
    type: "spawn",
    cols: 120,
    rows: 36,
    bufferedInput: ["pwd\r"],
  });
  assert.deepEqual(state.bufferedInput, []);
});

test("writes directly once the PTY already exists", () => {
  const state = createPtyClientMessageState();

  assert.deepEqual(handlePtyClientMessage(state, "ls\r", true), {
    type: "write",
    data: "ls\r",
  });
});

test("resizes an existing PTY without replaying buffered input", () => {
  const state = createPtyClientMessageState();

  assert.deepEqual(handlePtyClientMessage(state, "\x1b[RESIZE:80;24]", true), {
    type: "resize",
    cols: 80,
    rows: 24,
  });
});