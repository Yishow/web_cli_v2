import assert from "node:assert/strict";
import test from "node:test";

import {
  readVisualViewportHeight,
  readVisualViewportOffsetTop,
} from "./visual-viewport-height";

test("uses visualViewport height when iOS keyboard shrinks the visible viewport", () => {
  assert.equal(
    readVisualViewportHeight({
      innerHeight: 1194,
      visualViewport: { height: 731 },
    }),
    731,
  );
});

test("falls back to innerHeight when visualViewport is unavailable", () => {
  assert.equal(
    readVisualViewportHeight({
      innerHeight: 1194,
      visualViewport: null,
    }),
    1194,
  );
});

test("uses visualViewport offsetTop when iOS shifts the visible viewport while the keyboard is open", () => {
  assert.equal(
    readVisualViewportOffsetTop({
      innerHeight: 1194,
      visualViewport: { height: 731, offsetTop: 148 },
    }),
    148,
  );
});

test("falls back to zero offsetTop when visualViewport is unavailable", () => {
  assert.equal(
    readVisualViewportOffsetTop({
      innerHeight: 1194,
      visualViewport: null,
    }),
    0,
  );
});
