import assert from "node:assert/strict";
import test from "node:test";

import { buildTerminalWebSocketUrl, buildTransportWebSocketUrl } from "./transport";

test("builds a ws url for http origins and encodes the session name", () => {
  assert.equal(
    buildTerminalWebSocketUrl(
      {
        protocol: "http:",
        host: "localhost:3000",
      },
      "webcli main",
    ),
    "ws://localhost:3000/api/terminal?session=webcli%20main",
  );
});

test("builds a wss url for https origins", () => {
  assert.equal(
    buildTerminalWebSocketUrl(
      {
        protocol: "https:",
        host: "example.com",
      },
      "webcli-main",
    ),
    "wss://example.com/api/terminal?session=webcli-main",
  );
});

test("builds mode-specific websocket urls for local and ssh transports", () => {
  const location = {
    protocol: "https:",
    host: "example.com",
  };

  assert.equal(
    buildTransportWebSocketUrl(location, {
      mode: "local",
      sessionName: "webcli-main",
    }),
    "wss://example.com/api/terminal?session=webcli-main",
  );

  assert.equal(
    buildTransportWebSocketUrl(location, {
      mode: "ssh",
    }),
    "wss://example.com/api/ssh",
  );
});
