/* eslint-env browser */
const { register } = require('@adobe/uix-guest');

async function registerExtension() {
  function openWknd(inContextEditing) {
    const aemHost = guestConnection.sharedContext.get('aemHost');
    const auth = guestConnection.sharedContext.get('auth');
    const imsToken = auth && auth.imsToken;
    if (typeof aemHost !== 'string' || !aemHost.trim() ||
        typeof imsToken !== 'string' || !imsToken.trim()) {
      return guestConnection.host.toaster.display({
        variant: 'negative',
        message: 'Cannot open WKND Headless: the AEM host or access token is unavailable.',
      });
    }

    const appUrl = new URL('https://102588-424goldmagpie.adobeio-static.net/');
    appUrl.searchParams.set('aemHost', aemHost);
    appUrl.searchParams.set('imsToken', imsToken);
    let destination = appUrl.href;

    if (inContextEditing) {
      const imsOrg = auth.imsOrg;
      if (typeof imsOrg !== 'string' || !imsOrg.trim()) {
        return guestConnection.host.toaster.display({
          variant: 'negative',
          message: 'Cannot open In-Context Editing: the current organization ID is unavailable.',
        });
      }
      destination = `https://experience.adobe.com/#/@${encodeURIComponent(imsOrg)}/aem/editor/canvas/${appUrl.href.slice('https://'.length)}`;
    }

    window.open(destination, '_blank', 'noopener,noreferrer');
  }

  const guestConnection = await register({
    id: 'wknd-headless-cf-console-header',
    metadata: {
      extensions: [{ extensionPoint: 'aem/cf-console-admin/1' }],
    },
    methods: {
      headerMenu: {
        getButtons() {
          return [{
            id: 'wknd-headless-header-menu',
            label: 'WKND Headless',
            variant: 'secondary',
            subItems: [{
              id: 'wknd-headless-preview',
              label: 'Preview',
              onClick: () => openWknd(false),
            }, {
              id: 'wknd-headless-in-context-editing',
              label: 'In-Context Editing',
              onClick: () => openWknd(true),
            }],
          }];
        },
      },
    },
  });

  return guestConnection;
}

module.exports = { registerExtension };
