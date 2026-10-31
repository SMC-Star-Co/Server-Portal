const test = require('node:test');
const assert = require('node:assert/strict');
const { __test: { sniff, isTech, diskPath } } = require('../src/invoice-media');
test('JPEG detected from bytes, not extension', () => {
  assert.equal(sniff(Buffer.from([0xff,0xd8,0xff,0xe0]))?.mime,'image/jpeg');
});
test('PNG detected from binary signature', () => {
  assert.equal(sniff(Buffer.from([137,80,78,71,13,10,26,10,0]))?.ext,'png');
});
test('WebP detected from RIFF signature', () => {
  assert.equal(sniff(Buffer.from('RIFFxxxxWEBP','ascii'))?.ext,'webp');
});
test('HEIC detected from file brand', () => {
  assert.equal(sniff(Buffer.from('0000ftypheic','ascii'))?.ext,'heic');
});
test('MP4 and MOV detected', () => {
  assert.equal(sniff(Buffer.from('0000ftypisom','ascii'))?.ext,'mp4');
  assert.equal(sniff(Buffer.from('0000ftypqt  ','ascii'))?.ext,'mov');
});
test('Unsupported input rejected', () => {
  assert.equal(sniff(Buffer.from('NOT AN IMAGE')),null);
});
test('Only technician-role accounts can manage', () => {
  assert.equal(isTech({roles:['sales']}),false);
  assert.equal(isTech({roles:['admin']}),false);
  assert.equal(isTech({roles:['technician']}),true);
  assert.equal(isTech({roles:['sales','technician']}),true);
});
test('Stored paths cannot traverse media folder', () => {
  assert.throws(()=>diskPath('../../etc/passwd'));
  assert.match(diskPath('a1234567-aaaa-4bbb-8ccc-123456789abc.webp'),/\.webp$/);
});