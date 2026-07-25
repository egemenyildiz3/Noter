// Safe link detection — only http:// and https:// URLs, never javascript: or data:.
// Returns an array of segments: { type: 'text'|'link', value: string, href: string }

const URL_RE = /https?:\/\/[^\s<>"'`()[\]{}]+/gi;

export function parseLinks(text) {
  if (!text) return [{ type: "text", value: "" }];
  const segments = [];
  let last = 0;
  let match;
  URL_RE.lastIndex = 0;
  while ((match = URL_RE.exec(text)) !== null) {
    if (match.index > last) {
      segments.push({ type: "text", value: text.slice(last, match.index) });
    }
    const raw = match[0];
    // Strip trailing punctuation that is likely not part of the URL.
    const href = raw.replace(/[.,;:!?]+$/, "");
    segments.push({ type: "link", value: href, href });
    last = match.index + raw.length;
  }
  if (last < text.length) {
    segments.push({ type: "text", value: text.slice(last) });
  }
  return segments;
}
