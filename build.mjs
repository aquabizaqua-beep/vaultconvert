import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(ROOT, 'dist');
const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'config/tools.json'), 'utf8'));
const site = cfg.site;
const toolsById = Object.fromEntries(cfg.tools.map(t => [t.id, t]));

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function ensureDir(p) { fs.mkdirSync(p, { recursive: true }); }
function writeOut(urlPath, html) {
  const dir = path.join(DIST, urlPath);
  ensureDir(dir);
  fs.writeFileSync(path.join(dir, 'index.html'), html);
}

function widget(p) {
  const vc = {
    decoder: p.decoder || null,
    outMime: p.outMime,
    outExt: p.outExt,
    quality: p.quality || null,
    flatten: p.flatten || null,
    scale: p.scale || null
  };
  return [
    '<div class="vc-tool">',
    '  <div id="vc-drop" class="vc-drop">',
    '    <input id="vc-input" type="file" multiple accept="' + esc(p.accept) + '">',
    '    <p class="vc-hint">Drag &amp; drop your ' + esc(p.from) + ' files here</p>',
    '    <p><button id="vc-pick">Choose files</button></p>',
    '    <p class="vc-priv">\uD83D\uDD12 Converted in your browser. Nothing is uploaded.</p>',
    '  </div>',
    '  <div id="vc-list" class="vc-list"></div>',
    '  <button id="vc-all" class="vc-all" hidden>Download all</button>',
    '</div>',
    '<script>window.__VC__=' + JSON.stringify(vc) + ';</script>',
    '<script src="/engine.js" defer></script>'
  ].join('\n');
}

function howtoHtml(steps) {
  if (!steps || !steps.length) return '';
  return '<h2>How to convert</h2>\n<ol class="howto">\n' +
    steps.map(s => '  <li>' + esc(s) + '</li>').join('\n') + '\n</ol>';
}
function faqHtml(faq) {
  if (!faq || !faq.length) return '';
  return '<h2>FAQ</h2>\n<div class="faq">\n' +
    faq.map(f => '  <details><summary>' + esc(f.q) + '</summary><p>' + esc(f.a) + '</p></details>').join('\n') +
    '\n</div>';
}
function relatedHtml(ids) {
  if (!ids || !ids.length) return '';
  const links = ids.filter(id => toolsById[id]).map(id => {
    const t = toolsById[id];
    return '<a href="/' + t.id + '/">' + esc(t.from) + ' to ' + esc(t.to) + '</a>';
  });
  if (!links.length) return '';
  return '<h2>Related converters</h2>\n<div class="related">' + links.join('') + '</div>';
}

function jsonLd(p) {
  const blocks = [];
  blocks.push({
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: p.h1,
    applicationCategory: 'UtilitiesApplication',
    operatingSystem: 'Any (web browser)',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' }
  });
  if (p.howto && p.howto.length) {
    blocks.push({
      '@context': 'https://schema.org',
      '@type': 'HowTo',
      name: p.h1,
      step: p.howto.map((s, i) => ({ '@type': 'HowToStep', position: i + 1, text: s }))
    });
  }
  if (p.faq && p.faq.length) {
    blocks.push({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: p.faq.map(f => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } }))
    });
  }
  return blocks.map(b => '<script type="application/ld+json">' + JSON.stringify(b) + '</script>').join('\n');
}

function layout(p) {
  const canonical = site.domain + p.url;
  const robots = site.noindex ? '<meta name="robots" content="noindex,nofollow">' : '<meta name="robots" content="index,follow,max-image-preview:large">';
  return [
    '<!doctype html>',
    '<html lang="en">',
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width,initial-scale=1">',
    '<title>' + esc(p.title) + '</title>',
    '<meta name="description" content="' + esc(p.desc) + '">',
    robots,
    '<link rel="canonical" href="' + esc(canonical) + '">',
    '<link rel="stylesheet" href="/style.css">',
    jsonLd(p),
    '</head>',
    '<body>',
    '<header class="site"><div class="wrap">',
    '<a class="logo" href="/">Vault<span>Convert</span></a>',
    '<nav class="nav"><a href="/">All tools</a><a href="/#privacy">Privacy</a></nav>',
    '</div></header>',
    '<main class="wrap">',
    p.body,
    '</main>',
    '<footer class="site"><div class="wrap">',
    '<p><b>VaultConvert</b> \u2014 free file converters that run entirely in your browser. Your files never leave your device.</p>',
    '<p><a href="/">All tools</a></p>',
    '</div></footer>',
    '</body></html>'
  ].join('\n');
}

function toolBody(p) {
  return [
    '<p class="badge">\uD83D\uDD12 100% private \u2014 no upload</p>',
    '<h1>' + esc(p.h1) + '</h1>',
    '<p class="sub">' + esc(p.sub) + '</p>',
    widget(p),
    '<p>' + esc(p.intro) + '</p>',
    howtoHtml(p.howto),
    faqHtml(p.faq),
    relatedHtml(p.related)
  ].join('\n');
}

const urls = [];

function buildCore(tool) {
  const p = {
    url: '/' + tool.id + '/',
    title: 'Convert ' + tool.from + ' to ' + tool.to + ' \u2014 Free, No Upload | VaultConvert',
    desc: tool.metaDesc || ('Convert ' + tool.from + ' to ' + tool.to + ' free in your browser. No upload, no watermark.'),
    h1: 'Convert ' + tool.from + ' to ' + tool.to,
    sub: 'Free, private, and instant \u2014 right in your browser.',
    intro: tool.intro,
    howto: tool.howto,
    faq: tool.faq,
    related: tool.related,
    decoder: tool.decoder, outMime: tool.outMime, outExt: tool.outExt,
    quality: tool.quality, flatten: tool.flatten, scale: tool.scale,
    accept: tool.accept, from: tool.from, to: tool.to
  };
  p.body = toolBody(p);
  writeOut(tool.id, layout(p));
  urls.push(p.url);
}

function buildModifier(tool, m) {
  const p = {
    url: '/' + tool.id + '/' + m.slug + '/',
    title: 'Convert ' + tool.from + ' to ' + tool.to + ' ' + m.label + ' \u2014 Free, No Upload | VaultConvert',
    desc: 'Convert ' + tool.from + ' to ' + tool.to + ' ' + m.label + ' \u2014 free, in your browser, no upload or watermark.',
    h1: 'Convert ' + tool.from + ' to ' + tool.to + ' ' + m.label,
    sub: 'Free, private, and instant \u2014 right in your browser.',
    intro: m.intro,
    howto: m.howto || tool.howto,
    faq: (m.faq && m.faq.length) ? m.faq : tool.faq,
    related: [tool.id].concat((tool.related || []).filter(Boolean)).slice(0, 4),
    decoder: tool.decoder, outMime: tool.outMime, outExt: tool.outExt,
    quality: (m.quality != null) ? m.quality : tool.quality,
    flatten: (m.flatten != null) ? m.flatten : tool.flatten,
    scale: (m.scale != null) ? m.scale : tool.scale,
    accept: tool.accept, from: tool.from, to: tool.to
  };
  p.body = toolBody(p);
  writeOut(tool.id + '/' + m.slug, layout(p));
  urls.push(p.url);
}

function buildIndex() {
  const cards = cfg.tools.map(t =>
    '<a class="tool-card" href="/' + t.id + '/"><b>' + esc(t.from) + ' \u2192 ' + esc(t.to) + '</b><span>' + esc(t.title) + '</span></a>'
  ).join('\n');
  const body = [
    '<p class="badge">\uD83D\uDD12 100% private \u2014 no upload</p>',
    '<h1>' + esc(site.name) + '</h1>',
    '<p class="sub">' + esc(site.tagline) + '</p>',
    '<div class="tools-grid">' + cards + '</div>',
    '<h2 id="privacy">Why VaultConvert is different</h2>',
    '<p>Most online converters upload your files to a server, convert them there, and ask you to trust that they delete them afterwards. VaultConvert never does that. Every conversion runs inside your own browser using your device\u2019s processing power, so your files \u2014 personal photos, documents, anything \u2014 never travel across the internet. No upload, no account, no watermark, no waiting in a queue.</p>'
  ].join('\n');
  const p = {
    url: '/',
    title: site.name + ' \u2014 Free Private File Converter (No Upload)',
    desc: site.tagline,
    h1: site.name, sub: site.tagline, body
  };
  writeOut('', layout(p));
  urls.push('/');
}

// build
if (fs.existsSync(DIST)) fs.rmSync(DIST, { recursive: true });
ensureDir(DIST);

for (const tool of cfg.tools) {
  buildCore(tool);
  for (const m of (tool.modifiers || [])) buildModifier(tool, m);
}
buildIndex();

// static assets
for (const f of ['engine.js', 'style.css', '_headers']) {
  fs.copyFileSync(path.join(ROOT, 'static', f), path.join(DIST, f));
}

// robots.txt
const robotsTxt = site.noindex
  ? 'User-agent: *\nDisallow: /\n'
  : 'User-agent: *\nAllow: /\nSitemap: ' + site.domain + '/sitemap.xml\n';
fs.writeFileSync(path.join(DIST, 'robots.txt'), robotsTxt);

// sitemap.xml
const sitemap = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
  urls.map(u => '  <url><loc>' + site.domain + u + '</loc></url>').join('\n') +
  '\n</urlset>\n';
fs.writeFileSync(path.join(DIST, 'sitemap.xml'), sitemap);

console.log('Built ' + urls.length + ' pages into dist/');
console.log(urls.join('\n'));
