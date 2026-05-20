import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

test("pnpm lint exits successfully", () => {
  const result = spawnSync("pnpm", ["lint"], {
    cwd: process.cwd(),
    encoding: "utf8",
  });

  assert.equal(
    result.status,
    0,
    `Expected pnpm lint to succeed.\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`,
  );
});
