import assert from "node:assert/strict";
import test from "node:test";

import {
  deleteSessionApi,
  fetchSessions,
  sortSessionsByName,
  type SessionInfo,
} from "./session-management";

test("sortSessionsByName sorts sessions alphabetically", () => {
  const sessions: SessionInfo[] = [
    { name: "webcli-z", attached: false, created: 2, windows: 1 },
    { name: "webcli-a", attached: true, created: 1, windows: 2 },
  ];

  assert.deepEqual(sortSessionsByName(sessions), [
    { name: "webcli-a", attached: true, created: 1, windows: 2 },
    { name: "webcli-z", attached: false, created: 2, windows: 1 },
  ]);
});

test("fetchSessions returns an empty list for non-ok responses", async () => {
  const sessions = await fetchSessions(async () => new Response("nope", { status: 500 }));

  assert.deepEqual(sessions, []);
});

test("fetchSessions returns sorted sessions for ok responses", async () => {
  const sessions = await fetchSessions(async () =>
    Response.json([
      { name: "webcli-z", attached: false, created: 2, windows: 1 },
      { name: "webcli-a", attached: true, created: 1, windows: 2 },
    ]),
  );

  assert.deepEqual(sessions, [
    { name: "webcli-a", attached: true, created: 1, windows: 2 },
    { name: "webcli-z", attached: false, created: 2, windows: 1 },
  ]);
});

test("deleteSessionApi encodes the session name and returns success state", async () => {
  let requestedUrl = "";

  const success = await deleteSessionApi("webcli-main", async (input, init) => {
    requestedUrl = String(input);
    assert.equal(init?.method, "DELETE");
    return new Response(null, { status: 200 });
  });

  assert.equal(requestedUrl, "/api/sessions/webcli-main");
  assert.equal(success, true);
});
