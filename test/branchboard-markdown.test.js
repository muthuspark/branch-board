import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { marked } from "marked";
import katex from "katex";
import { renderAssistantMarkdown } from "../public/markdown-renderer.js";

const sanitizer = {
  sanitize(html) {
    return html
      .replace(/<img[^>]*>/gi, "")
      .replace(/\s+on\w+="[^"]*"/gi, "")
      .replace(/href="javascript:[^"]*"/gi, "");
  }
};

describe("Branchboard markdown rendering", () => {
  it("renders assistant markdown as HTML", () => {
    const html = renderAssistantMarkdown("A **clear** point\n\n- one\n- two", marked, sanitizer);

    assert.match(html, /<strong>clear<\/strong>/);
    assert.match(html, /<ul>/);
    assert.match(html, /<li>one<\/li>/);
  });

  it("renders GitHub-flavored markdown tables", () => {
    const html = renderAssistantMarkdown("| Camp | Core Claim |\n|---|---|\n| Functionalism | AI can be conscious |", marked, sanitizer);

    assert.match(html, /<table>/);
    assert.match(html, /<th>Camp<\/th>/);
    assert.match(html, /<td>Functionalism<\/td>/);
  });

  it("renders inline and display LaTex", () => {
    const html = renderAssistantMarkdown("Inline $x^2$\n\n$$\\frac{1}{2}$$", marked, sanitizer, katex);

    assert.match(html, /class="katex"/);
    assert.match(html, /class="katex-display"/);
    assert.doesNotMatch(html, /\$x\^2\$/);
  });

  it("sanitizes raw HTML from assistant markdown", () => {
    const html = renderAssistantMarkdown('<img src="x" onerror="alert(1)">', marked, sanitizer);

    assert.doesNotMatch(html, /<img/i);
    assert.doesNotMatch(html, /onerror/i);
  });
});
