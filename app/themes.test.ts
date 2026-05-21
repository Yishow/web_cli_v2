import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_THEME,
  getThemeMeta,
  getInitialThemePreference,
  isThemeId,
  loadThemePreference,
  THEMES,
  THEME_STORAGE_KEY,
} from "./themes";

function createStorage(initialValue?: string | null) {
  let value = initialValue ?? null;
  const writes: Array<[string, string]> = [];

  return {
    storage: {
      getItem(key: string) {
        return key === THEME_STORAGE_KEY ? value : null;
      },
      setItem(key: string, nextValue: string) {
        writes.push([key, nextValue]);
        if (key === THEME_STORAGE_KEY) {
          value = nextValue;
        }
      },
    },
    writes,
  };
}

test("THEMES exposes the expected built-in theme ids", () => {
  assert.deepEqual(
    THEMES.map((theme) => theme.id),
    ["default", "solarized-dark", "monokai", "light"],
  );
  assert.equal(DEFAULT_THEME, "default");
});

test("getInitialThemePreference keeps the first server and client render deterministic", () => {
  assert.equal(getInitialThemePreference(), "default");
});

test("isThemeId accepts only supported theme ids", () => {
  assert.equal(isThemeId("default"), true);
  assert.equal(isThemeId("solarized-dark"), true);
  assert.equal(isThemeId("monokai"), true);
  assert.equal(isThemeId("light"), true);
  assert.equal(isThemeId("invalid"), false);
});

test("loadThemePreference restores a saved theme", () => {
  const { storage, writes } = createStorage("monokai");

  assert.equal(loadThemePreference(storage), "monokai");
  assert.deepEqual(writes, []);
});

test("loadThemePreference repairs invalid stored values", () => {
  const { storage, writes } = createStorage("broken-theme");

  assert.equal(loadThemePreference(storage), "default");
  assert.deepEqual(writes, [[THEME_STORAGE_KEY, "default"]]);
});

test("getThemeMeta returns the requested theme metadata", () => {
  assert.deepEqual(getThemeMeta("light"), {
    id: "light",
    label: "Light",
    cssClass: "theme-light",
  });
});
