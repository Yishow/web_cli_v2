import assert from "node:assert/strict";
import test from "node:test";

import { createTerminalOutputBatcher } from "./output-batcher";

test("coalesces adjacent chunks into a single terminal write", () => {
  const writes: string[] = [];
  const scheduled: Array<() => void> = [];
  const batcher = createTerminalOutputBatcher({
    write(data) {
      writes.push(data);
    },
    schedule(flush) {
      scheduled.push(flush);
      return () => {};
    },
  });

  batcher.enqueue("foo");
  batcher.enqueue("bar");

  assert.deepEqual(writes, []);
  assert.equal(scheduled.length, 1);

  scheduled[0]();

  assert.deepEqual(writes, ["foobar"]);
});

test("buffers synchronized output until the closing marker arrives", () => {
  const writes: string[] = [];
  const scheduled: Array<() => void> = [];
  const batcher = createTerminalOutputBatcher({
    write(data) {
      writes.push(data);
    },
    schedule(flush) {
      scheduled.push(flush);
      return () => {};
    },
  });

  batcher.enqueue("\x1b[?2026h");
  batcher.enqueue("\x1b[2J\x1b[Hframe");
  batcher.enqueue("-done\x1b[?2026l");

  assert.deepEqual(writes, []);
  assert.equal(scheduled.length, 1);

  scheduled[0]();

  assert.deepEqual(writes, ["\x1b[2J\x1b[Hframe-done"]);
});

test("flushes any pending chunk immediately when requested", () => {
  const writes: string[] = [];
  const batcher = createTerminalOutputBatcher({
    write(data) {
      writes.push(data);
    },
    schedule() {
      return () => {};
    },
  });

  batcher.enqueue("pending");
  batcher.flush();

  assert.deepEqual(writes, ["pending"]);
});
