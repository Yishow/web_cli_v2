import test from "node:test";
import assert from "node:assert/strict";

import {
  CORE_CONFIG,
  CORE_PREFERENCE_KEY,
  getInitialCorePreference,
  loadCorePreference,
} from "./core-preference";

function createStorage(initialValue?: string | null) {
  let value = initialValue ?? null;
  const writes: Array<[string, string]> = [];

  return {
    storage: {
      getItem(key: string) {
        return key === CORE_PREFERENCE_KEY ? value : null;
      },
      setItem(key: string, nextValue: string) {
        writes.push([key, nextValue]);
        if (key === CORE_PREFERENCE_KEY) {
          value = nextValue;
        }
      },
    },
    writes,
  };
}

test("uses Ghostty core when no storage is available", () => {
  assert.equal(loadCorePreference(null), "ghostty");
});

test("starts from Ghostty before client hydration", () => {
  assert.equal(getInitialCorePreference(), "ghostty");
});

test("restores a saved ghostty preference", () => {
  const { storage, writes } = createStorage("ghostty");

  assert.equal(loadCorePreference(storage), "ghostty");
  assert.deepEqual(writes, []);
});

test("repairs invalid stored values back to Ghostty", () => {
  const { storage, writes } = createStorage("invalid-core");

  assert.equal(loadCorePreference(storage), "ghostty");
  assert.deepEqual(writes, [[CORE_PREFERENCE_KEY, "ghostty"]]);
});

test("exposes the expected wasm urls and size labels", () => {
  assert.deepEqual(CORE_CONFIG.builtin, {
    label: "Built-in",
    wasmUrl: "/wterm.wasm",
    size: "~12KB",
  });
  assert.deepEqual(CORE_CONFIG.ghostty, {
    label: "Ghostty",
    size: "~400KB",
  });
});
