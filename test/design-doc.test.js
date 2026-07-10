import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

const design = await readFile(new URL("../DESIGN.md", import.meta.url), "utf8");

describe("DESIGN.md", () => {
  it("documents the Branchboard design system in the expected section order", () => {
    assert.match(design, /^---\nname: Branchboard/m);
    assert.match(design, /colors:\n\s+ink:/);
    assert.match(design, /typography:\n\s+body:/);
    assert.match(design, /components:\n\s+button-primary:/);

    const sections = [
      "## 1. Overview",
      "## 2. Colors",
      "## 3. Typography",
      "## 4. Elevation",
      "## 5. Components",
      "## 6. Do's and Don'ts"
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
