jest.mock('@adobe/uix-guest', () => ({ register: jest.fn() }));

const { register } = require('@adobe/uix-guest');
const { registerExtension } = require('../src/aem-cf-console-admin-1/web-src/src/extension');
const originalWindow = global.window;
let connection;
let items;
let context;

beforeEach(async () => {
  global.window = { open: jest.fn() };
  context = {
    aemHost: 'author-demo.adobeaemcloud.com',
    auth: {
      imsOrg: '111111111111111111111111@AdobeOrg',
      imsOrgName: 'WKND display name',
      imsToken: 'temporary-demo+token/with&reserved=characters',
    },
  };
  connection = {
    sharedContext: {
      get: jest.fn(key => context[key]),
    },
    host: { toaster: { display: jest.fn() } },
  };
  register.mockResolvedValue(connection);
  await registerExtension();
  items = register.mock.calls.at(-1)[0].methods.headerMenu.getButtons();
});

afterEach(() => {
  global.window = originalWindow;
  jest.clearAllMocks();
});

test('registers the WKND Headless dropdown with the two requested options', () => {
  expect(register).toHaveBeenCalledWith(expect.objectContaining({
    metadata: { extensions: [{ extensionPoint: 'aem/cf-console-admin/1' }] },
  }));
  expect(items).toHaveLength(1);
  expect(items[0].label).toBe('WKND Headless');
  expect(items[0].subItems.map(item => item.label)).toEqual(['Preview', 'In-Context Editing']);
});

test('Preview encodes the current AEM host and token and opens an isolated new tab', () => {
  items[0].subItems[0].onClick();
  const [destination, target, features] = global.window.open.mock.calls[0];
  const url = new URL(destination);
  expect(url.origin + url.pathname).toBe('https://102588-424goldmagpie.adobeio-static.net/');
  expect(url.searchParams.get('aemHost')).toBe(context.aemHost);
  expect(url.searchParams.get('imsToken')).toBe(context.auth.imsToken);
  expect(target).toBe('_blank');
  expect(features).toBe('noopener,noreferrer');
});

test('In-Context Editing puts connection parameters on the embedded app URL and reads current context on every click', () => {
  const onClick = items[0].subItems[1].onClick;
  onClick();
  const editorUrl = new URL(global.window.open.mock.calls[0][0]);
  const prefix = '#/@111111111111111111111111%40AdobeOrg/aem/editor/canvas/';
  expect(editorUrl.origin).toBe('https://experience.adobe.com');
  expect(editorUrl.search).toBe('');
  expect(editorUrl.hash.startsWith(prefix)).toBe(true);
  const appUrl = new URL('https://' + editorUrl.hash.slice(prefix.length));
  expect(appUrl.origin + appUrl.pathname).toBe('https://102588-424goldmagpie.adobeio-static.net/');
  expect(appUrl.searchParams.get('aemHost')).toBe(context.aemHost);
  expect(appUrl.searchParams.get('imsToken')).toBe(context.auth.imsToken);

  context.aemHost = 'https://author-another.adobeaemcloud.com';
  context.auth = { imsOrg: '222222222222222222222222@AdobeOrg', imsToken: 'updated-demo-token' };
  onClick();
  expect(connection.sharedContext.get).toHaveBeenCalledWith('auth');
  expect(global.window.open).toHaveBeenLastCalledWith(
    'https://experience.adobe.com/#/@222222222222222222222222%40AdobeOrg/aem/editor/canvas/102588-424goldmagpie.adobeio-static.net/?aemHost=https%3A%2F%2Fauthor-another.adobeaemcloud.com&imsToken=updated-demo-token',
    '_blank',
    'noopener,noreferrer',
  );
});

test.each([undefined, '', '   ', 42])(
  'missing organization context displays an error instead of opening a broken URL (%j)',
  (imsOrg) => {
    context.auth.imsOrg = imsOrg;
    items[0].subItems[1].onClick();
    expect(global.window.open).not.toHaveBeenCalled();
    expect(connection.host.toaster.display).toHaveBeenCalledWith({
      variant: 'negative',
      message: expect.stringContaining('organization ID is unavailable'),
    });
  },
);

test.each([
  { aemHost: '' },
  { aemHost: undefined },
  { auth: undefined },
  { auth: {} },
  { auth: { imsToken: '   ' } },
])('both menu options reject missing connection context (%j)', (override) => {
  Object.assign(context, override);
  items[0].subItems.forEach(item => item.onClick());
  expect(global.window.open).not.toHaveBeenCalled();
  expect(connection.host.toaster.display).toHaveBeenCalledWith({
    variant: 'negative',
    message: expect.stringContaining('AEM host or access token is unavailable'),
  });
});

test('registration failures propagate to the entry point', async () => {
  register.mockRejectedValueOnce(new Error('Host unavailable'));
  await expect(registerExtension()).rejects.toThrow('Host unavailable');
});
