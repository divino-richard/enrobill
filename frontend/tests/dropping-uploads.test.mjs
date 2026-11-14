import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import axios from 'axios';
import { createServer } from 'vite';

const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false, watch: null } });
after(() => server.close());
const { submitDroppingRequest } = await server.ssrLoadModule('/src/features/dropping/api.ts');
const { default: api } = await server.ssrLoadModule('/src/lib/api.ts');
const { useAuthStore } = await server.ssrLoadModule('/src/features/auth/store.ts');
const uploadsPath = '/me/dropping-requests/uploads';
const files = [
  new File(['signed form'], 'form.pdf', { type: 'application/pdf' }),
  new File(['scan'], 'support.png', { type: 'image/png' }),
];
const submission = { enrollmentId: 18, reason: 'Moving school', files };
const metadata = files.map(file => ({ name: file.name, mime: file.type, size: file.size }));
const uploads = files.map((_, i) => ({ key: `stage/${i}`, url: `https://bucket.example.test/put/${i}` }));
const result = { id: 7, status: 'submitted' };

function intercept(t, adapter) {
  const originalApi = api.defaults.adapter;
  const originalS3 = axios.defaults.adapter;
  useAuthStore.setState({ token: 'test-student' });
  api.defaults.adapter = axios.defaults.adapter = adapter;
  t.after(() => {
    api.defaults.adapter = originalApi;
    axios.defaults.adapter = originalS3;
    useAuthStore.setState({ token: null });
  });
}

for (const requestId of [undefined, 7]) {
  test(`direct uploads send only JSON to the ${requestId ? 'correction' : 'new request'} endpoint`, async t => {
    const calls = [];
    const path = requestId ? `/me/dropping-requests/${requestId}/submit` : '/me/dropping-requests';
    intercept(t, async config => {
      calls.push([config.method, config.url]);
      if (config.method === 'put') {
        const i = uploads.findIndex(upload => upload.url === config.url);
        assert.ok(i >= 0);
        assert.equal(config.headers.get('Authorization'), undefined);
        assert.equal(config.headers.get('Content-Type'), files[i].type);
        assert.equal(config.data, files[i]);
        return { data: '' };
      }
      assert.equal(config.headers.get('Authorization'), 'Bearer test-student');
      assert.match(config.headers.get('Content-Type'), /application\/json/);
      const body = JSON.parse(config.data);
      if (config.url === uploadsPath + '/presign') {
        assert.deepEqual(body, { enrollmentId: 18, files: metadata });
        return { data: { data: uploads } };
      }
      assert.equal(config.url, path);
      assert.deepEqual(body, {
        enrollmentId: 18, reason: submission.reason,
        files: metadata.map((file, i) => ({ ...file, key: uploads[i].key })),
      });
      return { data: { data: result } };
    });

    assert.deepEqual(await submitDroppingRequest({ ...submission, requestId }), result);
    assert.deepEqual(calls, [
      ['post', uploadsPath + '/presign'], ...uploads.map(upload => ['put', upload.url]),
      ['post', path],
    ]);
  });
}

test('a failed second upload discards staging keys before the student retries', async t => {
  const calls = [];
  let retry = false;
  intercept(t, async config => {
    calls.push(config.url);
    if (config.url.endsWith('/presign')) return { data: { data: uploads } };
    if (config.method === 'delete') {
      assert.deepEqual(JSON.parse(config.data).keys, uploads.map(upload => upload.key));
      throw new Error('Cleanup unavailable');
    }
    if (retry && config.url === '/me/dropping-requests') return { data: { data: result } };
    if (retry || config.url === uploads[0].url) return { data: '' };
    throw new Error('Object storage error');
  });
  await assert.rejects(submitDroppingRequest(submission), /Document 2 could not be uploaded/);
  assert.deepEqual(calls, [uploadsPath + '/presign', ...uploads.map(upload => upload.url), uploadsPath]);
  retry = true;
  calls.length = 0;
  assert.deepEqual(await submitDroppingRequest(submission), result);
  assert.deepEqual(calls, [uploadsPath + '/presign', ...uploads.map(upload => upload.url), '/me/dropping-requests']);
});

test('cleanup failure preserves a definite rejection of the final submission', async t => {
  const validationError = new axios.AxiosError('Request failed with status code 422');
  validationError.response = { status: 422 };
  let cleanupCalls = 0;
  intercept(t, async config => {
    if (config.url.endsWith('/presign')) return { data: { data: uploads } };
    if (config.method === 'delete') {
      cleanupCalls++;
      throw new Error('Cleanup unavailable');
    }
    if (config.method === 'put') return { data: '' };
    throw validationError;
  });
  await assert.rejects(submitDroppingRequest(submission), error => error === validationError);
  assert.equal(cleanupCalls, 1);
});

for (const status of [undefined, 500, 503]) {
  test(`uncertain final submission (${status ?? 'lost response'}) leaves cleanup to the server`, async t => {
    const submissionError = new axios.AxiosError('Submission response unavailable');
    if (status) submissionError.response = { status };
    const calls = [];
    intercept(t, async config => {
      calls.push(config.url);
      if (config.url.endsWith('/presign')) return { data: { data: uploads } };
      if (config.method === 'put') return { data: '' };
      throw submissionError;
    });
    await assert.rejects(submitDroppingRequest(submission), error => error === submissionError);
    assert.deepEqual(calls, [uploadsPath + '/presign', ...uploads.map(upload => upload.url), '/me/dropping-requests']);
  });
}
