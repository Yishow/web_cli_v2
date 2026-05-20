import assert from "node:assert/strict";
import test from "node:test";

import { AgentStreamShell } from "./agent-shell";

function streamResponse(chunks: string[], status = 200): Response {
  return new Response(
    new ReadableStream({
      start(controller) {
        for (const chunk of chunks) {
          controller.enqueue(new TextEncoder().encode(chunk));
        }
        controller.close();
      },
    }),
    { status },
  );
}

test("streams markdown chunks and returns to idle after completion", async () => {
  const writes: string[] = [];
  const states: string[] = [];
  const shell = new AgentStreamShell({
    fetcher: async () =>
      streamResponse(["# Title\n", "- item one\n", "```ts\nconsole.log('ok')\n```\n"]),
    onStateChange: (state) => {
      states.push(state.status);
    },
  });

  shell.attach((data) => {
    writes.push(data);
  });

  await shell.start("Explain the latest output");

  assert.deepEqual(states, ["loading", "streaming", "idle"]);
  assert.match(writes.join(""), /Title/);
  assert.match(writes.join(""), /item one/);
  assert.match(writes.join(""), /console\.log/);
});

test("surfaces request failures and can retry the last prompt", async () => {
  const writes: string[] = [];
  const statuses: string[] = [];
  let attempt = 0;
  const shell = new AgentStreamShell({
    fetcher: async () => {
      attempt += 1;
      if (attempt === 1) {
        return new Response(JSON.stringify({ error: "boom" }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        });
      }

      return streamResponse(["# Retry success\n"]);
    },
    onStateChange: (state) => {
      statuses.push(state.status);
    },
  });

  shell.attach((data) => {
    writes.push(data);
  });

  await shell.start("retry me");
  assert.equal(shell.state.status, "error");
  assert.equal(shell.state.lastPrompt, "retry me");
  assert.match(writes.join(""), /boom/);

  await shell.retry();

  assert.equal(attempt, 2);
  assert.equal(shell.state.status, "idle");
  assert.match(writes.join(""), /Retry success/);
  assert.deepEqual(statuses, ["loading", "error", "loading", "streaming", "idle"]);
});

test("aborts an in-flight stream on Ctrl+C and returns to idle", async () => {
  const writes: string[] = [];
  const shell = new AgentStreamShell({
    fetcher: async (_input, init) =>
      new Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode("# Partial\n"));
            const signal = init?.signal;
            const abortHandler = () => {
              controller.error(new DOMException("Aborted", "AbortError"));
            };
            signal?.addEventListener("abort", abortHandler, { once: true });
          },
        }),
        { status: 200 },
      ),
  });

  shell.attach((data) => {
    writes.push(data);
  });

  const pending = shell.start("abort me");
  shell.handleInput("\x03");
  await pending;

  assert.equal(shell.state.status, "idle");
  assert.match(writes.join(""), /\[stream aborted\]/);
});
