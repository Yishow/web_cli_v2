import assert from "node:assert/strict";
import test from "node:test";

import { getCoreGuidance } from "./core-guidance";

test("warns that the built-in core can drift on CJK and recommends Ghostty", () => {
  assert.deepEqual(getCoreGuidance("builtin"), {
    title: "Built-in 對 CJK / emoji 仍有限制",
    description: "中文、全形字與 emoji 在顯示上可能跳位；需要穩定輸入時，建議切換到 Ghostty。",
    recommendedCore: "ghostty",
  });
});

test("shows no warning when Ghostty is already selected", () => {
  assert.equal(getCoreGuidance("ghostty"), null);
});
