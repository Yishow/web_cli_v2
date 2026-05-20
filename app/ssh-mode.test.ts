import assert from "node:assert/strict";
import test from "node:test";

import {
  buildSshConnectPayload,
  clearSshCredentials,
  createEmptySshConfig,
} from "./ssh-mode";

test("builds a password SSH payload without leaking private key fields", () => {
  assert.deepEqual(
    buildSshConnectPayload({
      host: "example.com",
      port: "22",
      username: "root",
      authMethod: "password",
      password: "secret",
      privateKey: "ignored",
    }),
    {
      type: "connect",
      host: "example.com",
      port: 22,
      username: "root",
      authMethod: "password",
      password: "secret",
    },
  );
});

test("builds a private key SSH payload and defaults the port to 22", () => {
  assert.deepEqual(
    buildSshConnectPayload({
      host: "example.com",
      port: "",
      username: "root",
      authMethod: "privateKey",
      password: "ignored",
      privateKey: "KEY",
    }),
    {
      type: "connect",
      host: "example.com",
      port: 22,
      username: "root",
      authMethod: "privateKey",
      privateKey: "KEY",
    },
  );
});

test("returns null when required SSH fields are missing", () => {
  assert.equal(
    buildSshConnectPayload({
      host: "",
      port: "22",
      username: "root",
      authMethod: "password",
      password: "secret",
      privateKey: "",
    }),
    null,
  );
});

test("clears credentials without persisting host defaults", () => {
  assert.deepEqual(clearSshCredentials(createEmptySshConfig()), createEmptySshConfig());
  assert.deepEqual(
    clearSshCredentials({
      host: "example.com",
      port: "22",
      username: "root",
      authMethod: "privateKey",
      password: "secret",
      privateKey: "KEY",
    }),
    {
      host: "",
      port: "22",
      username: "",
      authMethod: "password",
      password: "",
      privateKey: "",
    },
  );
});
