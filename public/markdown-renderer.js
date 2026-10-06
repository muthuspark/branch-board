export function renderAssistantMarkdown(markdown, marked, DOMPurify, katex) {
  const html = marked.parse(renderMath(String(markdown || ""), katex), {
    async: false,
    breaks: true,
    gfm: true
  });

  return DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true }
  });
}

function renderMath(markdown, katex) {
  if (!katex) return markdown;

  return markdown.split(/(```[\s\S]*?```)/g).map(part => {
    if (part.startsWith("```")) return part;
    return part.split(/(`[^`]*`)/g).map(segment => {
      if (segment.startsWith("`")) return segment;
      return segment
        .replace(/\$\$([\s\S]+?)\$\$/g, (_match, expression) => render(expression, true))
        .replace(/(?<!\\)\$([^$\n]+?)\$/g, (_match, expression) => render(expression, false));
    }).join("");
  }).join("");

  function render(expression, displayMode) {
    return katex.renderToString(expression.trim(), {
      displayMode,
      throwOnError: false,
      strict: "ignore"
    });
  }
}
