import assert from "node:assert/strict";
import test from "node:test";

import {
  buildResizeControlMessage,
  sendResizeControlMessage,
} from "./resize-control-message";

test("builds the control frame used to spawn or redraw a PTY", () => {
  assert.equal(buildResizeControlMessage({ cols: 120, rows: 36 }), "\x1b[RESIZE:120;36]");
});

test("sends a resize control frame for an open websocket", () => {
  const frames: string[] = [];

  const sent = sendResizeControlMessage(
    {
      readyState: 1,
      send(frame) {
        frames.push(frame);
      },
    },
    { cols: 98, rows: 31 },
  );

  assert.equal(sent, true);
  assert.deepEqual(frames, ["\x1b[RESIZE:98;31]"]);
});

test("skips invalid sizes and closed sockets", () => {
  const frames: string[] = [];
  const socket = {
    readyState: 0,
    send(frame: string) {
      frames.push(frame);
    },
  };

  assert.equal(sendResizeControlMessage(socket, { cols: 0, rows: 31 }), false);
  assert.equal(sendResizeControlMessage(socket, { cols: 98, rows: 31 }), false);
  assert.deepEqual(frames, []);
});
