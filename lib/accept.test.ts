// The negotiation rules from acceptmarkdown.com, pinned.
//
// The browser cases matter as much as the agent ones: a naive "does the header
// contain text/markdown" check serves markdown to every browser on earth,
// because browsers send a `*/*` wildcard.

import { test } from "node:test";
import assert from "node:assert/strict";
import { mentionsMarkdown, negotiate, parseAccept, qualityFor } from "./accept.ts";

const BROWSER =
  "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8";

test("an agent asking only for markdown gets markdown", () => {
  assert.equal(negotiate("text/markdown"), "markdown");
  assert.equal(negotiate("text/markdown; charset=utf-8"), "markdown");
});

test("a browser gets HTML despite its wildcard", () => {
  assert.equal(negotiate(BROWSER), "html");
});

test("a bare wildcard gets HTML, never markdown", () => {
  assert.equal(negotiate("*/*"), "html");
  assert.equal(negotiate("text/*"), "html");
});

test("no Accept header at all is HTML, and never 406", () => {
  assert.equal(negotiate(null), "html");
  assert.equal(negotiate(undefined), "html");
  assert.equal(negotiate(""), "html");
});

test("q-values decide, not order in the header", () => {
  assert.equal(negotiate("text/markdown;q=0.9, text/html;q=1.0"), "html");
  assert.equal(negotiate("text/html;q=0.5, text/markdown;q=0.9"), "markdown");
  assert.equal(negotiate("text/markdown;q=1.0, text/html;q=1.0"), "html", "ties go to HTML");
});

test("q=0 is an explicit refusal", () => {
  assert.equal(negotiate("text/html;q=0, text/markdown"), "markdown");
  assert.equal(negotiate("text/markdown;q=0, text/html"), "html");
});

test("a client that accepts neither gets 406", () => {
  assert.equal(negotiate("application/pdf"), "none");
  assert.equal(negotiate("image/png, image/jpeg"), "none");
  assert.equal(negotiate("text/html;q=0, text/markdown;q=0"), "none");
});

test("malformed q-values do not silently downgrade a type", () => {
  assert.equal(negotiate("text/markdown;q=banana"), "markdown");
  assert.equal(qualityFor(parseAccept("text/markdown;q=abc"), "text/markdown"), 1);
});

test("q-values are clamped to the 0..1 range", () => {
  assert.equal(qualityFor(parseAccept("text/markdown;q=9"), "text/markdown"), 1);
  assert.equal(qualityFor(parseAccept("text/markdown;q=-4"), "text/markdown"), 0);
});

test("parsing is case and whitespace insensitive", () => {
  assert.equal(negotiate("  TEXT/MARKDOWN  "), "markdown");
  assert.equal(negotiate("Text/HTML, Text/Markdown;Q=0.1"), "html");
});

test("mentionsMarkdown detects an explicit request at any quality", () => {
  assert.equal(mentionsMarkdown("text/markdown;q=0"), true);
  assert.equal(mentionsMarkdown(BROWSER), false, "a wildcard is not a request for markdown");
  assert.equal(mentionsMarkdown(null), false);
});
