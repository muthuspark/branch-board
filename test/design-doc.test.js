import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

const design = await readFile(new URL("../DESIGN.md", import.meta.url), "utf8");

describe("DESIGN.md", () => {
  it("documents the Pravah-inspired system used by Branchboard", () => {
    assert.match(design, /^# Pravah — Style Reference/m);
    assert.match(design, /Parchment\s+\|\s+`#f3f1ed`/);
    assert.match(design, /Aubergine Black\s+\|\s+`#302023`/);
    assert.match(design, /ABCfavorit Book/);

    const sections = [
      "## Tokens — Colors",
      "## Tokens — Typography",
      "## Tokens — Spacing & Shapes",
      "## Components",
      "## Do's and Don'ts",
      "## Surfaces"
    ];
    let previous = -1;
    for (const section of sections) {
      const index = design.indexOf(section);
      assert.notEqual(index, -1, `${section} missing`);
      assert.ok(index > previous, `${section} is out of order`);
      previous = index;
    }
  });
});
