import assert from "node:assert/strict";
import test from "node:test";

import { splitBoxDrawingSegments } from "./box-drawing-workaround";

test("groups box drawing glyphs into fixed-width segments", () => {
  assert.deepEqual(splitBoxDrawingSegments("abc──┐def"), [
    { text: "abc", box: false },
    { text: "──┐", box: true },
    { text: "def", box: false },
  ]);
});

test("keeps plain text as a single non-box segment", () => {
  assert.deepEqual(splitBoxDrawingSegments("Claude Code"), [
    { text: "Claude Code", box: false },
  ]);
});
