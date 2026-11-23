const { main } = require('../actions/aem-cors-proxy');

const originalFetch = global.fetch;
const origin = 'http://127.0.0.1:4173';
const params = {
  __ow_method: 'get',
  __ow_path: '/graphql/execute.json/wknd-shared/adventures-all',
  __ow_query: 'aemHost=https%3A%2F%2Fauthor-demo.adobeaemcloud.com',
  __ow_headers: { origin, authorization: 'Bearer temporary-demo-token' },
};

beforeEach(() => {
  global.fetch = jest.fn().mockResolvedValue({
    status: 200,
    headers: { get: () => 'application/json' },
    text: async () => '{"data":{"adventureList":{"items":[]}}}',
  });
});

afterEach(() => {
  global.fetch = originalFetch;
});

test.each([
  'http://127.0.0.1:4173',
  'http://localhost:3000',
  'https://localhost:9080',
  'http://[::1]:4173',
  'https://fork-owner.github.io',
])('preflight allows demo origin %s and Authorization without requiring an AEM host', async (requestOrigin) => {
  const result = await main({
    __ow_method: 'options',
    __ow_headers: { origin: requestOrigin, 'access-control-request-headers': 'authorization' },
  });
  expect(result.statusCode).toBe(204);
  expect(result.headers['Access-Control-Allow-Origin']).toBe(requestOrigin);
  expect(result.headers['Access-Control-Allow-Headers']).toContain('Authorization');
  expect(result.headers['Access-Control-Allow-Methods']).toContain('GET');
  expect(result.headers.Vary).toBe('Origin');
  expect(global.fetch).not.toHaveBeenCalled();
});

test.each([
  'https://fork-owner.github.io.attacker.example',
  'http://fork-owner.github.io',
  'http://localhost.attacker.example:4173',
  'null',
])('unapproved origin %s does not receive CORS permission', async (requestOrigin) => {
  const result = await main({ __ow_method: 'options', __ow_headers: { origin: requestOrigin } });
  expect(result.headers['Access-Control-Allow-Origin']).toBeUndefined();
  expect(global.fetch).not.toHaveBeenCalled();
});

test('explicitly configured custom origins remain supported', async () => {
  const result = await main({
    __ow_method: 'options',
    __ow_headers: { origin: 'https://custom-demo.example' },
    ALLOWED_ORIGINS: 'https://custom-demo.example',
  });
  expect(result.headers['Access-Control-Allow-Origin']).toBe('https://custom-demo.example');
});

test('Bearer header is forwarded and routing parameters are removed from the upstream URL', async () => {
  const result = await main({
    ...params,
    __ow_path: params.__ow_path + ';width=240',
    __ow_query: params.__ow_query + '&aemToken=legacy-demo-token&extra=value',
  });
  expect(global.fetch).toHaveBeenCalledWith(
    'https://author-demo.adobeaemcloud.com/graphql/execute.json/wknd-shared/adventures-all%3Bwidth%3D240?extra=value',
    { method: 'GET', headers: { Accept: 'application/json', Authorization: 'Bearer temporary-demo-token' } },
  );
  expect(result.headers['Access-Control-Allow-Origin']).toBe(origin);
});

test('legacy query-token clients still work without an Authorization header', async () => {
  await main({
    ...params,
    __ow_headers: { origin },
    __ow_query: params.__ow_query + '&aemToken=legacy-demo-token',
  });
  expect(global.fetch).toHaveBeenCalledWith(
    expect.not.stringContaining('aemToken'),
    expect.objectContaining({ headers: { Accept: 'application/json', Authorization: 'Bearer legacy-demo-token' } }),
  );
});

test('upstream failures keep CORS headers so browsers can read the error', async () => {
  global.fetch.mockRejectedValue(new Error('Upstream unavailable'));
  const result = await main(params);
  expect(result.statusCode).toBe(502);
  expect(result.headers['Access-Control-Allow-Origin']).toBe(origin);
  expect(result.body).toEqual({ error: 'Upstream request failed' });
});
