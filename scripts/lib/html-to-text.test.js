import { test } from 'node:test';
import assert from 'node:assert/strict';
import { htmlToText } from './html-to-text.js';

test('empty / falsy input yields empty string', () => {
  assert.equal(htmlToText(''), '');
  assert.equal(htmlToText(null), '');
  assert.equal(htmlToText(undefined), '');
});

test('strips tags and keeps text', () => {
  assert.equal(htmlToText('<p>Hello <b>world</b></p>'), 'Hello world');
});

test('decodes common named and numeric entities', () => {
  assert.equal(
    htmlToText('Tom&amp;Jerry &#39;s &quot;quote&quot; a&nbsp;b &#x27;x&#x27;'),
    `Tom&Jerry 's "quote" a b 'x'`,
  );
});

test('strips entity-escaped HTML tags (Greenhouse content shape)', () => {
  assert.equal(
    htmlToText('&lt;p&gt;Hi &lt;b&gt;there&lt;/b&gt;&lt;/p&gt;'),
    'Hi there',
  );
});

test('decodes doubly-escaped text entities', () => {
  // Greenhouse escapes a text `&nbsp;` a second time as `&amp;nbsp;`.
  assert.equal(htmlToText('a&amp;nbsp;b and R&amp;amp;D'), 'a b and R&D');
});

test('turns list items into bullets on their own lines', () => {
  assert.equal(htmlToText('<ul><li>one</li><li>two</li></ul>'), '- one\n- two');
});

test('collapses whitespace and blank-line runs', () => {
  assert.equal(htmlToText('<p>a   b</p>\n\n\n<p>c</p>'), 'a b\n\nc');
});

test('is idempotent on realistic content', () => {
  const html =
    '<div><h2>About the role</h2><p>Build &amp; ship things.</p>' +
    '<ul><li>Own the pipeline</li><li>Write &quot;good&quot; code</li></ul></div>';
  const once = htmlToText(html);
  assert.equal(htmlToText(once), once);
});

test('is deterministic across calls', () => {
  const html = '<p>Same <em>input</em>,&nbsp;same output.</p>';
  assert.equal(htmlToText(html), htmlToText(html));
});

test('plain text (Indeed-style) passes through unchanged aside from whitespace', () => {
  assert.equal(
    htmlToText('Senior Software Engineer, full-time.'),
    'Senior Software Engineer, full-time.',
  );
});
