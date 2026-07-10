export function renderAssistantMarkdown(markdown, marked, DOMPurify) {
  const html = marked.parse(String(markdown || ""), {
    async: false,
    breaks: true,
    gfm: true
  });

  return DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true }
  });
}
