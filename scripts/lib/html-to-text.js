// Convert an HTML fragment (e.g. a Greenhouse job's `content`) to plain text, so every
// ingester writes the same shape into data/raw. Dependency-free.
//
// Greenhouse serves *entity-escaped* HTML in `content` — tags arrive as `&lt;p&gt;` and a
// text entity like `&nbsp;` arrives escaped a second time as `&amp;nbsp;`. So we decode
// once to recover real HTML, act on its structure and strip its tags, then decode once
// more for the entities that lived in the text. Plain-text sources (Indeed) have no
// entities or tags, so every step is a no-op for them.
//
// This output feeds normalize.js's contentHash, so the function must be deterministic:
// the same HTML in must always produce the same text out, or dedup breaks and re-emits
// the same posting as "new" every day. It's a pure function of its input, so it is.

const NAMED_ENTITIES = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&apos;': "'",
  '&nbsp;': ' ',
  // Common typographic entities that show up in job descriptions.
  '&mdash;': '—',
  '&ndash;': '–',
  '&hellip;': '…',
  '&lsquo;': '‘',
  '&rsquo;': '’',
  '&ldquo;': '“',
  '&rdquo;': '”',
  '&bull;': '•',
  '&trade;': '™',
  '&copy;': '©',
  '&reg;': '®',
  '&deg;': '°',
};

// Single pass so we never double-decode (e.g. `&amp;lt;` must stay `&lt;`, not become `<`).
function decodeEntities(text) {
  return text.replace(/&(#\d+|#x[0-9a-fA-F]+|[a-zA-Z]+);/g, (match, body) => {
    if (body[0] === '#') {
      const code =
        body[1] === 'x' || body[1] === 'X'
          ? parseInt(body.slice(2), 16)
          : Number(body.slice(1));
      return Number.isNaN(code) ? match : String.fromCodePoint(code);
    }
    return NAMED_ENTITIES[match.toLowerCase()] ?? match;
  });
}

export function htmlToText(html) {
  if (!html) return '';
  let text = html.replace(/\r\n?/g, '\n');
  // Decode once to recover real tags from Greenhouse's escaped HTML (no-op for literal HTML).
  text = decodeEntities(text);
  // Turn list items into bullets and block/line boundaries into newlines *before*
  // stripping, so structure survives as whitespace.
  text = text
    .replace(/<li[^>]*>/gi, '\n- ')
    .replace(/<\/(p|div|ul|ol|h[1-6]|tr|section|article|blockquote)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n');
  // Strip all remaining tags.
  text = text.replace(/<[^>]+>/g, '');
  // Decode once more for entities that lived in the text (e.g. `&amp;nbsp;` -> `&nbsp;`
  // above -> a space here).
  text = decodeEntities(text);
  // Collapse whitespace: within-line runs to one space, blank-line runs to one blank line.
  text = text
    .replace(/[^\S\n]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return text;
}
