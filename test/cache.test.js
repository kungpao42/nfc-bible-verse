import { test } from "node:test";
import assert from "node:assert/strict";
import { kvCacheTtl, verseDay } from "../worker/index.js";

const at = (iso) => Date.parse(iso);

test("short TTL just after the 05:00 UTC changeover", () => {
  assert.equal(kvCacheTtl(at("2026-11-27T05:00:30Z")), 60);
  assert.equal(kvCacheTtl(at("2026-11-27T05:09:00Z")), 60);
});
test("one hour during the day", () => {
  assert.equal(kvCacheTtl(at("2026-11-27T12:00:00Z")), 3600);
});
test("never runs past the next changeover", () => {
  assert.equal(kvCacheTtl(at("2026-11-28T04:30:00Z")), 1800);
  assert.equal(kvCacheTtl(at("2026-11-28T04:59:30Z")), 60);
});
test("verse day flips at 05:00 UTC", () => {
  assert.equal(verseDay(new Date("2026-11-27T04:59:59Z")), "2026-11-26");
  assert.equal(verseDay(new Date("2026-11-27T05:00:00Z")), "2026-11-27");
});
