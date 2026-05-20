import assert from "node:assert/strict";
import test from "node:test";

import {
  SSH_READY_CONTROL,
  encodeSshErrorControlMessage,
  parseSshControlMessage,
} from "./ssh-control-message";

test("encodes and parses SSH ready control messages", () => {
  assert.equal(parseSshControlMessage(SSH_READY_CONTROL)?.type, "ready");
});

test("encodes and parses SSH error control messages", () => {
  const encoded = encodeSshErrorControlMessage("SSH 驗證失敗");

  assert.deepEqual(parseSshControlMessage(encoded), {
    type: "error",
    message: "SSH 驗證失敗",
  });
});

test("ignores non-control terminal output", () => {
  assert.equal(parseSshControlMessage("pwd\r\n"), null);
});
