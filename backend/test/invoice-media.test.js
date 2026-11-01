const test = require('node:test');
const assert = require('node:assert/strict');
const {
  __test: { isTechnician, parseSerials, canonicalSerial, downloadName, looksLike, extension, storedPath }
} = require('../src/invoice-media');

test('only technician role can upload or delete', () => {
  assert.equal(isTechnician({ roles:['sales'] }),false);
  assert.equal(isTechnician({ roles:['admin'] }),false);
  assert.equal(isTechnician({ roles:['technician'] }),true);
  assert.equal(isTechnician({ roles:['sales','technician'] }),true);
});
test('serial list preserves the exact order from serial management', () => {
  assert.deepEqual(parseSerials('2M201002KG, 3Q001, 1A002'),['2M201002KG','3Q001','1A002']);
  assert.deepEqual(parseSerials(''),[]);
});
test('serial validation accepts real hardware serials and rejects path injection', () => {
  assert.equal(canonicalSerial('2m201002kg'),'2M201002KG');
  assert.equal(canonicalSerial('..\\\\file'),'');
  assert.equal(canonicalSerial('../etc'),'');
});
test('invoice attachments use invoice prefix and sequence', () => {
  assert.equal(downloadName('40428','invoice',null,1,'jpg'),'40428-01.jpg');
  assert.equal(downloadName('40428','invoice',null,2,'pdf'),'40428-02.pdf');
  assert.equal(downloadName('40428','invoice',null,101,'docx'),'40428-101.docx');
});
test('server attachments use serial prefix and sequence, not invoice prefix', () => {
  assert.equal(downloadName('40428','serial','2M201002KG',1,'jpg'),'2M201002KG-01.jpg');
  assert.equal(downloadName('40428','serial','2M201002KG',2,'pdf'),'2M201002KG-02.pdf');
  assert.equal(downloadName('40428','serial','2M201002KG',3,'mp4'),'2M201002KG-03.mp4');
});
test('format signatures reject mismatched extensions', () => {
  const jpg = Buffer.from([255,216,255,224,0,16]);
  assert.equal(looksLike('jpg',jpg),true);
  assert.equal(looksLike('pdf',jpg),false);
  assert.equal(looksLike('pdf',Buffer.from('%PDF-1.7')),true);
  assert.equal(looksLike('docx',Buffer.from('PK\u0003\u0004')),true);
  assert.equal(looksLike('mp4',Buffer.from('0000ftypisom')),true);
  assert.equal(looksLike('heic',Buffer.from('0000ftypheic')),true);
  assert.equal(extension('Server.PDF'),'pdf');
});
test('stored file paths cannot escape media directory', () => {
  assert.throws(()=>storedPath('../private.txt'));
  assert.throws(()=>storedPath('../../etc/passwd'));
  assert.match(storedPath('a1234567-aaaa-4bbb-8ccc-123456789abc.pdf'),/\.pdf$/);
});
