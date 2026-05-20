import assert from "node:assert/strict";
import test from "node:test";

import {
  MAX_RECONNECT_ATTEMPTS,
  RECONNECT_BASE_DELAY,
  RECONNECT_MAX_DELAY,
  formatReconnectFailureMessage,
  formatReconnectProgressMessage,
  formatReconnectedMessage,
  getReconnectDelay,
} from "./reconnect";

test("reconnect constants match the spec", () => {
  assert.equal(MAX_RECONNECT_ATTEMPTS, 10);
  assert.equal(RECONNECT_BASE_DELAY, 1000);
  assert.equal(RECONNECT_MAX_DELAY, 30000);
});

test("getReconnectDelay uses exponential backoff capped at 30 seconds", () => {
  assert.equal(getReconnectDelay(1), 1000);
  assert.equal(getReconnectDelay(2), 2000);
  assert.equal(getReconnectDelay(3), 4000);
  assert.equal(getReconnectDelay(4), 8000);
  assert.equal(getReconnectDelay(5), 16000);
  assert.equal(getReconnectDelay(6), 30000);
  assert.equal(getReconnectDelay(10), 30000);
});

test("reconnect progress message shows attempt count and next delay", () => {
  assert.equal(
    formatReconnectProgressMessage(4, 8000),
    '\r\n\x1b[33m[reconnecting... attempt 4/10, next in 8s]\x1b[0m\r\n',
  );
});

test("success and failure reconnect messages match the spec", () => {
  assert.equal(formatReconnectedMessage(), "\r\n\x1b[32m[reconnected ✓]\x1b[0m\r\n");
  assert.equal(
    formatReconnectFailureMessage(),
    '\r\n\x1b[31m[auto-reconnect failed after 10 attempts. Click "連線 / 重新連線" to retry manually]\x1b[0m\r\n',
  );
});
