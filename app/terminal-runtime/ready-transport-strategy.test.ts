import assert from "node:assert/strict";
import test from "node:test";

import { getReadyTransportStrategy } from "./ready-transport-strategy";

test("uses a fresh local transport whenever a terminal instance becomes ready", () => {
  assert.equal(getReadyTransportStrategy("local"), "fresh-connect");
});

test("keeps ssh connections manual when the terminal becomes ready", () => {
  assert.equal(getReadyTransportStrategy("ssh"), "manual");
});
