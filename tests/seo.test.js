import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const SITE = 'https://tegank.org/';
const readPublic = (path, encoding) => readFileSync(new URL(`../public/${path}`, import.meta.url), encoding);
const html = readPublic('index.html', 'utf8');

const findTag = (tag, attr, key) => html.match(new RegExp(`<${tag}\\b[^>]*\\b${attr}="${key}"[^>]*>`))?.[0];
const attrOf = (tagHtml, name) => tagHtml?.match(new RegExp(`\\b${name}="([^"]*)"`))?.[1];
const meta = (attr, key) => attrOf(findTag('meta', attr, key), 'content');
const linkHref = (rel) => attrOf(findTag('link', 'rel', rel), 'href');
const lines = (path) => readPublic(path, 'utf8').split(/\r?\n/);

function structuredData() {
  const block = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  assert.ok(block, 'index.html has a JSON-LD block');
  return JSON.parse(block[1]);
}

test('the title leads with the name and fits in a search result', () => {
  const title = html.match(/<title>([^<]*)<\/title>/)[1];
  assert.match(title, /^Tegan Kierznowski /);
  assert.ok(title.length <= 60, `title is ${title.length} characters`);
});

test('the meta description fits in a search snippet', () => {
  const description = meta('name', 'description');
  assert.ok(description, 'index.html has a meta description');
  assert.ok(description.length >= 70 && description.length <= 160, `description is ${description.length} characters`);
});

test('canonical and og:url both name the https apex', () => {
  assert.equal(linkHref('canonical'), SITE);
  assert.equal(meta('property', 'og:url'), SITE);
});

test('the share image is a 1200x630 PNG that ships with the site', () => {
  const url = meta('property', 'og:image');
  assert.ok(url?.startsWith(SITE), 'og:image is an absolute URL on this site');
  const png = readPublic(url.slice(SITE.length));
  assert.equal(png.toString('latin1', 1, 4), 'PNG');
  assert.deepEqual([png.readUInt32BE(16), png.readUInt32BE(20)], [1200, 630]);
  assert.deepEqual([meta('property', 'og:image:width'), meta('property', 'og:image:height')], ['1200', '630']);
  assert.ok(png.length < 300_000, 'small enough for WhatsApp previews');
  assert.ok(meta('property', 'og:image:alt'));
  assert.equal(meta('name', 'twitter:card'), 'summary_large_image');
});

test('structured data describes the person the page is about', () => {
  const data = structuredData();
  assert.equal(data['@context'], 'https://schema.org');
  assert.equal(data['@type'], 'ProfilePage');
  assert.equal(data.url, SITE);
  assert.equal(data.mainEntity['@type'], 'Person');
  assert.equal(data.mainEntity.name, 'Tegan Kierznowski');
  assert.ok(data.mainEntity.sameAs.length > 0);
  for (const profile of data.mainEntity.sameAs) {
    assert.ok(html.includes(`href="${profile}"`), `${profile} is also linked on the page`);
  }
});

test('robots.txt points crawlers at a sitemap that lists the canonical URL', () => {
  assert.ok(lines('robots.txt').includes(`Sitemap: ${SITE}sitemap.xml`));
  assert.ok(lines('sitemap.xml').some((line) => line.trim() === `<loc>${SITE}</loc>`));
});
