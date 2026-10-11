const assert = require('node:assert/strict');
const test = require('node:test');

const { gptImageClient } = require('../dist/src/lib/common/client.js');

test('pending image task never exposes preview media', () => {
  const result = gptImageClient.normalizeTask({
    taskId: 'same-task',
    body: { finished_at: null, response: { data: [{ url: 'https://example.com/preview.png' }] } },
  });
  assert.equal(result.status, 'pending');
  assert.deepEqual(result.media_urls, []);
});

test('completed image task exposes final URL and removes internal routing', () => {
  const result = gptImageClient.normalizeTask({
    taskId: 'same-task',
    body: { id: 'same-task', finished_at: 1763142637, response: { success: true, data: [{ url: 'https://example.com/final.png', supplier: 'internal' }] } },
  });
  assert.equal(result.status, 'succeeded');
  assert.equal(result.success, true);
  assert.deepEqual(result.media_urls, ['https://example.com/final.png']);
  assert.equal(JSON.stringify(result).includes('internal'), false);
});

test('missing or failed tasks cannot appear successful', () => {
  assert.throws(() => gptImageClient.normalizeTask({ body: {}, taskId: 'missing' }), /not found/);
  const result = gptImageClient.normalizeTask({
    taskId: 'failed',
    body: { finished_at: 1763142637, response: { success: false, error: { message: 'private detail' }, data: [{ url: 'https://example.com/not-final.png' }] } },
  });
  assert.equal(result.status, 'failed');
  assert.deepEqual(result.media_urls, []);
  assert.equal(JSON.stringify(result).includes('private detail'), false);
});
