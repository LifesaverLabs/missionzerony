// The site has no shared header, so each page carries its own copy of the
// section nav. These tests fail if a subpage's nav drifts from the main page's.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');

function navLinks(html) {
  const nav = html.match(/<nav class="links"[^>]*>([\s\S]*?)<\/nav>/);
  assert.ok(nav, 'page has a nav.links block');
  return [...nav[1].matchAll(/<a href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)].map(([, href, text]) => ({ href, text }));
}

// Main-page links as a subpage should show them: "#x" becomes "/#x".
const mainLinks = navLinks(read('./index.html')).map(({ href, text }) => ({
  href: href.startsWith('#') ? '/' + href : href,
  text,
}));

const SUBPAGES = ['./counterfactual/index.html', './built-instead/index.html'];

for (const page of SUBPAGES) {
  test(`${page} nav matches the main page nav`, () => {
    const links = navLinks(read(page)).filter((l) => l.href !== '/');
    assert.deepEqual(links, mainLinks);
  });
}

test('every main-page nav anchor points to a section that exists', () => {
  const html = read('./index.html');
  for (const { href } of mainLinks) {
    if (!href.startsWith('/#')) continue;
    const id = href.slice(2);
    assert.ok(html.includes(`id="${id}"`), `missing section id="${id}"`);
  }
});
