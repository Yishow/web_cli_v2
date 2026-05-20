import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const repoRoot = path.resolve(import.meta.dirname, "..");

test("removes the legacy Vite entry files from the repo", () => {
  for (const relativePath of ["index.html", "vite.config.ts", "src/client/App.tsx", "src/client/main.tsx"]) {
    assert.equal(
      existsSync(path.join(repoRoot, relativePath)),
      false,
      `${relativePath} should be removed once the legacy Vite demo is retired`,
    );
  }
});

test("drops Vite-only excludes from tsconfig after the demo is retired", () => {
  const tsconfig = readFileSync(path.join(repoRoot, "tsconfig.json"), "utf8");

  assert.equal(tsconfig.includes('"src/client/**/*"'), false);
  assert.equal(tsconfig.includes('"vite.config.ts"'), false);
});
