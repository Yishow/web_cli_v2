import assert from "node:assert/strict";
import test from "node:test";

import { getImeAnchorBox } from "./ime-anchor";

test("anchors the hidden textarea to the current cursor cell inside the terminal", () => {
  assert.deepEqual(
    getImeAnchorBox(
      { left: 188, top: 144, width: 9, height: 18 },
      { left: 120, top: 90, width: 960, height: 540 },
    ),
    {
      left: 68,
      top: 54,
      width: 1,
      height: 1,
    },
  );
});

test("clamps the hidden textarea to the visible terminal bounds", () => {
  assert.deepEqual(
    getImeAnchorBox(
      { left: 1080, top: 620, width: 9, height: 18 },
      { left: 120, top: 90, width: 960, height: 540 },
    ),
    {
      left: 959,
      top: 530,
      width: 1,
      height: 1,
    },
  );
});
