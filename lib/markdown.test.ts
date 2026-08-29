// The machine-readable surfaces, checked against what the audit asks for.

import { test } from "node:test";
import assert from "node:assert/strict";
import { llmsTxt, markdownFor, notFoundMarkdown } from "./markdown.ts";
import { ROUTES, SITE_URL } from "./site.ts";

test("every route has a markdown variant", () => {
  for (const route of ROUTES) {
    const md = markdownFor(route.path);
    assert.ok(md, `${route.path} has no markdown`);
    assert.ok(md.startsWith("# "), `${route.path} markdown must open with an H1`);
    assert.ok(md.includes(route.title), `${route.path} markdown omits its own title`);
  }
});

test("a trailing slash resolves to the same page", () => {
  assert.equal(markdownFor("/projects/epl-brief/"), markdownFor("/projects/epl-brief"));
});

test("an unknown path has no markdown variant", () => {
  assert.equal(markdownFor("/nope"), null);
  assert.equal(markdownFor("/projects/does-not-exist"), null);
});

test("the 404 body gives an agent a way to recover", () => {
  // This is the audit's "Partial" item: a real 404 status was already there,
  // what was missing was a body that points somewhere useful.
  const md = notFoundMarkdown("/some-path-that-does-not-exist");
  assert.ok(md.includes("404"), "states what happened");
  assert.ok(md.includes("/some-path-that-does-not-exist"), "echoes the path tried");
  assert.ok(md.includes("/sitemap.xml"), "points at the sitemap");
  assert.ok(md.includes("/llms.txt"), "points at the guidance file");
  for (const route of ROUTES) {
    assert.ok(md.includes(`${SITE_URL}${route.path === "/" ? "" : route.path}`), `lists ${route.path}`);
  }
});

test("llms.txt follows the llmstxt.org layout", () => {
  const txt = llmsTxt();
  const lines = txt.split("\n");
  assert.ok(lines[0].startsWith("# "), "opens with an H1");
  assert.ok(txt.includes("\n> "), "carries a blockquote summary");
});

test("llms.txt names when to use the site, and when not to", () => {
  // The audit failed this on generic marketing copy, so the assertion is about
  // guidance specifically rather than the file merely existing.
  const txt = llmsTxt();
  assert.ok(/## When to use this site/.test(txt), "has a when-to-use section");
  assert.ok(/Do not use this site for/.test(txt), "says what it is NOT authoritative for");
  assert.ok(/## How to call it/.test(txt), "explains how an agent should call it");
  assert.ok(txt.includes("Accept: text/markdown"), "documents the negotiation");
  for (const route of ROUTES.filter((r) => r.agentUse)) {
    assert.ok(txt.includes(route.title), `mentions ${route.title}`);
  }
});

test("every absolute link uses the canonical origin", () => {
  const bodies = [llmsTxt(), notFoundMarkdown("/x"), ...ROUTES.map((r) => markdownFor(r.path)!)];
  for (const body of bodies) {
    for (const url of body.match(/https?:\/\/[^\s)>\]]+/g) ?? []) {
      const ok = url.startsWith(SITE_URL) || !url.includes("richard-fleming.com");
      assert.ok(ok, `non-canonical origin: ${url}`);
    }
  }
});

test("trust-anchor pages exist and carry substantive content", () => {
  // The audit's bar: /about, /contact and /privacy each real, each with at
  // least 500 characters of content. The markdown variant serves the same
  // `details` paragraphs the HTML page renders, so this asserts both at once.
  for (const path of ["/about", "/contact", "/privacy"]) {
    const route = ROUTES.find((r) => r.path === path);
    assert.ok(route, `${path} must be a declared route`);
    assert.ok(route.info, `${path} must be flagged as an info page`);
    const body = (route.details ?? []).join("\n\n");
    assert.ok(
      body.length >= 500,
      `${path} carries ${body.length} chars of content, needs 500+`,
    );
    const md = markdownFor(path);
    assert.ok(md && md.includes(route.details![0]), `${path} markdown must serve the details`);
  }
});

test("trust pages appear in llms.txt so agents can find them", () => {
  const txt = llmsTxt();
  for (const path of ["/about", "/contact", "/privacy"]) {
    assert.ok(txt.includes(`${SITE_URL}${path}`), `llms.txt must list ${path}`);
  }
});
