const assert = require('node:assert/strict');
const test = require('node:test');
const https = require('node:https');
const { EventEmitter } = require('node:events');
const { PropertyType } = require('@activepieces/pieces-framework');
const { generateImage } = require('../dist/src/lib/actions/generate-image.js');
const { gptImageClient } = require('../dist/src/lib/common/client.js');
const fixture = require('./fixtures/generation-api-schema.json');
const properties = fixture.definition.paths['/openai/images/generations'].post.requestBody.content['application/json'].schema.properties;

function mockCatalog(responses) {
  const original = https.get;
  const requests = [];
  https.get = (url, options, callback) => {
    const pending = new EventEmitter();
    pending.setTimeout = () => pending;
    pending.destroy = error => pending.emit('error', error);
    requests.push({ url, options });
    queueMicrotask(() => {
      const next = responses.shift();
      if (next.error) { pending.emit('error', next.error); return; }
      const response = new EventEmitter();
      response.statusCode = next.status ?? 200;
      response.setEncoding = () => {};
      callback(response);
      response.emit('data', typeof next.body === 'string' ? next.body : JSON.stringify(next.body));
      response.emit('end');
    });
    return pending;
  };
  return { requests, restore: () => { https.get = original; } };
}

test('official dynamic dropdowns preserve the complete published model and quality enums', async () => {
  const mock = mockCatalog([{ body: fixture }, { body: fixture }]);
  try {
    assert.equal(generateImage.props.model.type, PropertyType.DROPDOWN);
    assert.equal(generateImage.props.quality.type, PropertyType.DROPDOWN);
    const model = await generateImage.props.model.options({ auth: { secret_text: 'MUST_NOT_LEAVE_CONNECTION' } }, {});
    const quality = await generateImage.props.quality.options({}, {});
    assert.equal(model.options.length, 24);
    assert.deepEqual(model.options.map(option => option.value), properties.model.enum);
    assert.deepEqual(quality.options.map(option => option.value), properties.quality.enum);
    assert(mock.requests.every(request => request.url === fixture.source));
    assert(mock.requests.every(request => request.options.rejectUnauthorized === true));
    assert(mock.requests.every(request => JSON.stringify(request.options.headers) === '{"Accept":"application/json"}'));
    assert.doesNotMatch(JSON.stringify(mock.requests), /MUST_NOT_LEAVE_CONNECTION|Bearer/);
  } finally { mock.restore(); }
});

test('new service model IDs appear without a Piece release or brand-prefix allowlist', async () => {
  const updated = structuredClone(fixture);
  updated.definition.paths['/openai/images/generations'].post.requestBody.content['application/json'].schema.properties.model.enum.push('future-compatible-model');
  const mock = mockCatalog([{ body: updated }]);
  try {
    const state = await generateImage.props.model.options({}, {});
    assert.equal(state.options.length, 25);
    assert.deepEqual(state.options.at(-1), { label: 'future-compatible-model', value: 'future-compatible-model' });
  } finally { mock.restore(); }
});

test('failed or malformed metadata is explicit and never becomes a one-model fallback or permanent empty cache', async () => {
  const mock = mockCatalog([
    { status: 503, body: { secret: 'DO_NOT_DISPLAY' } },
    { status: 302, body: {} },
    { body: 'invalid JSON' },
    { body: { definition: {} } },
    { error: new Error('DO_NOT_DISPLAY TLS detail') },
    { body: fixture },
  ]);
  try {
    for (let i = 0; i < 5; i++) {
      const state = await generateImage.props.model.options({}, {});
      assert.equal(state.disabled, true);
      assert.deepEqual(state.options, []);
      assert.match(state.placeholder, /catalog unavailable/);
      assert.doesNotMatch(JSON.stringify(state), /DO_NOT_DISPLAY|gpt-image-2/);
    }
    assert.equal((await generateImage.props.model.options({}, {})).options.length, 24);
    assert.equal(mock.requests.length, 6);
  } finally { mock.restore(); }
});

test('all published model IDs reach one submission unchanged and saved inputs do not depend on catalog availability', async () => {
  const original = gptImageClient.post;
  const originalGet = https.get;
  let catalogRequests = 0;
  const calls = [];
  gptImageClient.post = async request => { calls.push(request); return { task_id: 'same-task' }; };
  https.get = () => { catalogRequests++; throw new Error('Catalog offline'); };
  try {
    for (const model of properties.model.enum) {
      const result = await generateImage.run({
        auth: { secret_text: 'OFFLINE_ONLY' },
        propsValue: { prompt: 'Offline fixture', model, quality: model.startsWith('dall-e') ? 'standard' : 'auto', size: '1024x1024', count: 1 },
      });
      assert.deepEqual(result, { task_id: 'same-task', status: 'pending', success: false });
    }
    assert.deepEqual(calls.map(call => call.body.model), properties.model.enum);
    assert(calls.every(call => call.path === '/openai/images/generations'));
    const context = { auth: { secret_text: 'OFFLINE_ONLY' }, propsValue: { prompt: 'Offline fixture', model: 'gpt-image-2', quality: 'low', size: 'auto', count: 1 } };
    await generateImage.run(context);
    assert.equal(calls.at(-1).body.size, 'auto');
    await assert.rejects(generateImage.run({ ...context, propsValue: { ...context.propsValue, size: 'invalid' } }), /Size must/);
    await assert.rejects(generateImage.run({ ...context, propsValue: { ...context.propsValue, model: '' } }), /Choose a model/);
    assert.equal(calls.length, 25);
    assert.equal(catalogRequests, 0);
  } finally { gptImageClient.post = original; https.get = originalGet; }
});

test('optional quality leaves all models on API defaults and DALL-E exposes only its documented quality choices', async () => {
  assert.equal(generateImage.props.quality.required, false);
  assert.equal(generateImage.props.quality.defaultValue, undefined);
  assert.deepEqual(generateImage.props.quality.refreshers, ['model']);
  const mock = mockCatalog([{ body: fixture }, { body: fixture }]);
  try {
    const dalle2 = await generateImage.props.quality.options({ model: 'dall-e-2' }, {});
    const dalle3 = await generateImage.props.quality.options({ model: 'dall-e-3' }, {});
    assert.deepEqual(dalle2.options.map(option => option.value), ['standard']);
    assert.deepEqual(dalle3.options.map(option => option.value), ['hd', 'standard']);
  } finally { mock.restore(); }

  const original = gptImageClient.post;
  const calls = [];
  gptImageClient.post = async request => { calls.push(request); return { task_id: 'same-task' }; };
  const context = model => ({
    auth: { secret_text: 'OFFLINE_ONLY' },
    propsValue: { prompt: 'Offline fixture', model,
      size: generateImage.props.size.defaultValue,
      count: generateImage.props.count.defaultValue },
  });
  try {
    for (const model of properties.model.enum) await generateImage.run(context(model));
    assert.equal(calls.length, 24);
    assert(calls.every(call => !Object.hasOwn(call.body, 'quality')));
    assert(calls.every(call => call.body.size === '1024x1024' && call.body.n === 1));
    for (const quality of [null, '', '  ']) {
      const cleared = context('dall-e-3');
      await generateImage.run({ ...cleared, propsValue: { ...cleared.propsValue, quality } });
      assert.equal(Object.hasOwn(calls.at(-1).body, 'quality'), false);
    }
    const acceptedCalls = calls.length;
    for (const model of ['dall-e-2', 'dall-e-3']) {
      for (const quality of ['low', 'auto']) {
        const input = context(model);
        await assert.rejects(generateImage.run({ ...input, propsValue: { ...input.propsValue, quality } }), /not supported/);
      }
    }
    assert.equal(calls.length, acceptedCalls, 'invalid quality must be rejected before any paid submission');
    const saved = context('gpt-image-2');
    await generateImage.run({ ...saved, propsValue: { ...saved.propsValue, quality: 'low' } });
    assert.equal(calls.at(-1).body.quality, 'low', 'explicit saved GPT quality is preserved');
  } finally { gptImageClient.post = original; }
});
