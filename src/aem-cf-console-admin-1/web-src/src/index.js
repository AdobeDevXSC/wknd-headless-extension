/* eslint-env browser */
const { registerExtension } = require('./extension');

registerExtension().then(() => {
  document.getElementById('status').textContent = 'WKND Headless is connected.';
}).catch((error) => {
  console.error('WKND Headless extension registration failed:', error);
  document.getElementById('status').textContent =
    'Unable to connect WKND Headless. Open this extension from the Content Fragments Console and check the browser console for details.';
});
