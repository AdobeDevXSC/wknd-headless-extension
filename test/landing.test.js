const { readFileSync } = require('node:fs');
const path = require('node:path');
const { runInNewContext } = require('node:vm');

const html = readFileSync(path.join(__dirname, '../landing/index.html'), 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];

test.each([
  ['https://102588-424goldmagpie-stage.adobeio-static.net/index.html', 'STAGE'],
  ['https://102588-424goldmagpie.adobeio-static.net/index.html', 'PROD'],
  ['http://localhost:9080/index.html', 'LOCAL / UNKNOWN'],
  ['https://preview.example.com/index.html', 'LOCAL / UNKNOWN'],
])('landing headline identifies the environment at %s', (url, environment) => {
  const title = { textContent: html.match(/<h1 id="demo-title">([^<]+)<\/h1>/)[1] };
  const elements = {
    'demo-title': title,
    'settings-form': { querySelectorAll: () => [] },
    'settings-status': { dataset: {} },
    'proxy-url': {},
  };

  runInNewContext(script, {
    document: { getElementById: id => elements[id] },
    location: new URL(url),
    window: {},
    URL,
  });

  expect(title.textContent).toBe(`WKND Headless Demos (${environment})`);
});
