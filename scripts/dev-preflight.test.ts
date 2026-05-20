import assert from "node:assert/strict";
import { createServer } from "node:net";
import test from "node:test";

import {
  formatExistingDevServerMessage,
  formatPortConflictMessage,
  isPortAvailable,
  parseNextDevLock,
  parseSsProcess,
} from "./dev-preflight";

test("reports a listening port as unavailable", async () => {
  const server = createServer();
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));

  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("failed to read test server port");
  }

  assert.equal(await isPortAvailable(address.port, "127.0.0.1"), false);

  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
});

test("reports a free port as available", async () => {
  const server = createServer();
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));

  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("failed to read test server port");
  }

  const port = address.port;

  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });

  assert.equal(await isPortAvailable(port, "127.0.0.1"), true);
});

test("parses pid and command information from ss output", () => {
  const parsed = parseSsProcess(
    'LISTEN 0 511 0.0.0.0:3010 0.0.0.0:* users:(("MainThread",pid=395524,fd=33))',
  );

  assert.deepEqual(parsed, { pid: "395524", command: "MainThread" });
});

test("parses Next dev lock metadata", () => {
  const parsed = parseNextDevLock(
    '{"pid":395524,"port":3010,"hostname":"localhost","appUrl":"http://localhost:3010","startedAt":1779266155018}',
  );

  assert.deepEqual(parsed, {
    pid: 395524,
    port: 3010,
    hostname: "localhost",
    appUrl: "http://localhost:3010",
    startedAt: 1779266155018,
  });
});

test("formats a helpful conflict message", () => {
  assert.equal(
    formatPortConflictMessage(3010, { pid: "395524", command: "tsx server.ts" }),
    "Port 3010 is already in use by PID 395524 (tsx server.ts).\nStop that process or run PORT=<other-port> pnpm dev.",
  );
});

test("formats a helpful existing dev server message", () => {
  assert.equal(
    formatExistingDevServerMessage({
      pid: 395524,
      port: 3010,
      hostname: "localhost",
      appUrl: "http://localhost:3010",
      startedAt: 1779266155018,
    }),
    "Another dev server for this repo is already running at http://localhost:3010 (PID 395524).\nStop that process before starting a new pnpm dev session.",
  );
});
