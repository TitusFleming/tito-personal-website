// Coin records, keyed by the name typed on the start screen.

import { test } from "node:test";
import assert from "node:assert/strict";
import { coinKey } from "./local.ts";

test("names are matched case- and whitespace-insensitively", () => {
  assert.equal(coinKey("Tito"), coinKey("  tito "));
  assert.equal(coinKey("TITO"), "tito");
});

test("an empty name still gets a record rather than being dropped", () => {
  assert.equal(coinKey(""), "anonymous");
  assert.equal(coinKey("   "), "anonymous");
  assert.equal(coinKey(null), "anonymous");
});

test("different names are different collectors", () => {
  assert.notEqual(coinKey("tito"), coinKey("someone else"));
});
