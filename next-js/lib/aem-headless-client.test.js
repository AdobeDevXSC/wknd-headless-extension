import AEMHeadless from '@adobe/aem-headless-client-js';
import client from './aem-headless-client';
import sessionConfig from './sessionConfig';

jest.mock('@adobe/aem-headless-client-js', () => jest.fn());

test('Next.js queries use the shared proxy, session token, namespace, and transport', async () => {
  window.history.replaceState(null, '', '/next-js/');
  sessionConfig.save({
    aemHost: 'https://author-demo.adobeaemcloud.com',
    authToken: 'demo-test-token',
    graphqlEndpoint: 'wknd-shared',
  }, '/');
  const runPersistedQuery = jest.fn().mockResolvedValue({ data: {} });
  AEMHeadless.mockImplementation(() => ({ runPersistedQuery }));
  const options = { serviceURL: sessionConfig.defaultProxyURL, auth: 'demo-test-token', fetch: jest.fn() };
  const optionsFactory = jest.spyOn(sessionConfig, 'clientOptions').mockReturnValue(options);
  try {
    await client.getAllAdventures();
    expect(AEMHeadless).toHaveBeenCalledWith(expect.objectContaining({
      serviceURL: sessionConfig.defaultProxyURL,
      auth: 'demo-test-token',
    }));
    expect(runPersistedQuery).toHaveBeenCalledWith('wknd-shared/adventures-all', {});
    expect(AEMHeadless).toHaveBeenCalledWith(options);
    expect(optionsFactory).toHaveBeenCalledWith(expect.objectContaining({
      aemHost: 'https://author-demo.adobeaemcloud.com',
      proxyURL: sessionConfig.defaultProxyURL,
    }));
  } finally {
    optionsFactory.mockRestore();
    sessionStorage.clear();
    window.history.replaceState(null, '', '/');
  }
});
