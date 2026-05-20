import assert from "node:assert/strict";
import test from "node:test";

import { createAgentMarkdownChunks } from "./agent-stream-script";

test("creates readable markdown chunks for the agent stream endpoint", () => {
  const chunks = createAgentMarkdownChunks("Summarize SSH mode");

  assert.ok(chunks.length >= 4);
  assert.match(chunks.join(""), /# Agent stream response/);
  assert.match(chunks.join(""), /Summarize SSH mode/);
  assert.match(chunks.join(""), /## Suggested next actions/);
  assert.match(chunks.join(""), /```bash/);
});
