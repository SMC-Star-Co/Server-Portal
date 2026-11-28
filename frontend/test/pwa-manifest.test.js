const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const manifest = JSON.parse(read('manifest.webmanifest'));

test('portal has stable install identity, standalone display and same-origin scope', () => {
  assert.equal(manifest.name, 'Setare Soheil Parsa – Server Portal');
  assert.equal(manifest.short_name, 'Server Portal');
  for (const k of ['id', 'scope', 'start_url']) assert.equal(manifest[k], '/');
  assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.lang, 'fa');
  assert.equal(manifest.dir, 'rtl');
  assert.equal(manifest.theme_color, '#f8fafc');
  assert.equal(manifest.background_color, '#f8fafc');
});

test('manifest icons are local PNG files with actual declared dimensions', () => {
  assert.deepEqual(manifest.icons.map(i => i.sizes), ['192x192', '512x512']);
  for (const icon of manifest.icons) {
    assert.match(icon.src, /^\/assets\/icons\/app-icon-(192|512)\.png$/);
    assert.equal(icon.type, 'image/png');
    assert.equal(icon.purpose, 'any');
    const png = fs.readFileSync(path.join(root, icon.src.slice(1)));
    assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    assert.equal(png.subarray(12, 16).toString('ascii'), 'IHDR');
    const [w, h] = icon.sizes.split('x').map(Number);
    assert.equal(png.readUInt32BE(16), w);
    assert.equal(png.readUInt32BE(20), h);
  }
});

test('HTML links manifest and matching theme without custom installation or push hooks', () => {
  const html = read('index.html');
  assert.ok(html.includes('<link rel="manifest" href="/manifest.webmanifest">'));
  assert.ok(html.includes('<meta name="theme-color" content="' + manifest.theme_color + '">'));
  assert.ok(html.includes('<title>' + manifest.name + '</title>'));
  assert.doesNotMatch(html, /beforeinstallprompt|appinstalled|serviceWorker\.register|PushManager/);
});

test('nginx serves manifest explicitly with revalidation and no HTML fallback', () => {
  const config = fs.readFileSync(path.join(root, '..', 'nginx', 'default.conf'), 'utf8');
  assert.ok(config.includes('location = /manifest.webmanifest {'));
  assert.ok(config.includes('application/manifest+json'));
  assert.ok(config.includes('add_header Cache-Control "no-cache";'));
  assert.ok(config.includes('try_files $uri =404;'));
});
