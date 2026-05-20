import assert from "node:assert/strict";
import test from "node:test";

import {
  InvalidSessionNameError,
  isValidSessionName,
  killSession,
  listSessions,
  parseTmuxSessions,
} from "./tmux-sessions";

test("parseTmuxSessions returns structured session data", () => {
  const sessions = parseTmuxSessions(
    "webcli-main\t2\t1716163200\t1\nwebcli-dev\t1\t1716166800\t0\n",
  );

  assert.deepEqual(sessions, [
    { name: "webcli-main", windows: 2, created: 1716163200, attached: true },
    { name: "webcli-dev", windows: 1, created: 1716166800, attached: false },
  ]);
});

test("listSessions returns an empty array when tmux reports no sessions", () => {
  const sessions = listSessions(() => {
    const error = new Error("no server running on /tmp/tmux-1000/default") as Error & {
      status?: number;
      stderr?: string;
    };

    error.status = 1;
    error.stderr = "no server running on /tmp/tmux-1000/default";
    throw error;
  });

  assert.deepEqual(sessions, []);
});

test("killSession rejects invalid names before invoking tmux", () => {
  let called = false;

  assert.throws(
    () =>
      killSession("bad;name", () => {
        called = true;
        return "";
      }),
    InvalidSessionNameError,
  );
  assert.equal(called, false);
});

test("isValidSessionName only accepts alphanumeric names with dashes or underscores", () => {
  assert.equal(isValidSessionName("webcli-main"), true);
  assert.equal(isValidSessionName("session_123"), true);
  assert.equal(isValidSessionName("a"), true);
  assert.equal(isValidSessionName("my.session"), false);
  assert.equal(isValidSessionName("session name"), false);
  assert.equal(isValidSessionName(""), false);
});
