import assert from "node:assert/strict";
import test from "node:test";

import { parseSshConnectMessage } from "./ssh-client-message";

test("accepts password-based SSH connect payloads", () => {
  assert.deepEqual(
    parseSshConnectMessage(
      JSON.stringify({
        type: "connect",
        host: "example.com",
        port: 22,
        username: "root",
        authMethod: "password",
        password: "secret",
      }),
    ),
    {
      ok: true,
      value: {
        host: "example.com",
        port: 22,
        username: "root",
        authMethod: "password",
        password: "secret",
      },
    },
  );
});

test("accepts private-key SSH connect payloads and trims host values", () => {
  assert.deepEqual(
    parseSshConnectMessage(
      JSON.stringify({
        type: "connect",
        host: " example.com ",
        username: "root",
        authMethod: "privateKey",
        privateKey: "KEY",
      }),
    ),
    {
      ok: true,
      value: {
        host: "example.com",
        port: 22,
        username: "root",
        authMethod: "privateKey",
        privateKey: "KEY",
      },
    },
  );
});

test("rejects invalid SSH connect payloads", () => {
  assert.deepEqual(parseSshConnectMessage("not-json"), {
    ok: false,
    error: "Invalid connection parameters",
  });

  assert.deepEqual(
    parseSshConnectMessage(
      JSON.stringify({
        type: "connect",
        host: "",
        username: "root",
        authMethod: "password",
        password: "secret",
      }),
    ),
    {
      ok: false,
      error: "Missing required SSH connection fields",
    },
  );
});
