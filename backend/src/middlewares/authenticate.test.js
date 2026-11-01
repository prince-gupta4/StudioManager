import assert from "node:assert/strict";
import { test } from "node:test";

process.env.MONGODB_URI ??= "mongodb://127.0.0.1:27017/reelmanager-test";
process.env.SESSION_SECRET ??= "a-test-session-secret-with-more-than-32-characters";
process.env.STORAGE_LOCAL ??= "1";
process.env.STORAGE_PROVIDER ??= "local";

const { requirePermission } = await import("./authenticate.js");

test("requirePermission continues when the user has the requested permission", () => {
  let nextCalled = false;
  const middleware = requirePermission("clients:write");
  middleware({ user: { permissions: ["clients:read", "clients:write"] } }, {}, (error) => {
    assert.equal(error, undefined);
    nextCalled = true;
  });
  assert.equal(nextCalled, true);
});

test("requirePermission returns forbidden when the user lacks the requested permission", () => {
  let receivedError;
  const middleware = requirePermission("finance:read");
  middleware({ user: { permissions: ["production:read"] } }, {}, (error) => {
    receivedError = error;
  });
  assert.equal(receivedError?.status, 403);
  assert.equal(receivedError?.message, "You do not have permission to perform this action.");
});
