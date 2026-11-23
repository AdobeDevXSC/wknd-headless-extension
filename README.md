# 424GoldMagpie

Welcome to my Adobe I/O Application!

## WKND React and Next.js apps

The WKND apps have moved into [react-app/](./react-app/) and
[next-js/](./next-js/). Both use the existing AEM proxy, one landing page, and
one browser-session connection. Install dependencies in each app with `npm ci`.

```shell
npm run build:wknd
npm run test:wknd
npm run deploy:wknd
```

Open [the hosted landing page](https://102588-424goldmagpie.adobeio-static.net/index.html)
to configure AEM, then open either app card in the same tab.
The shared landing source is [landing/index.html](./landing/index.html), the
combined build is [scripts/build-wknd.cjs](./scripts/build-wknd.cjs), and
generated CDN assets are in `dist/application/web-prod/`. The root
[app.config.yaml](./app.config.yaml) owns both apps' deployment. React's existing
`build:app-builder` and `deploy:app-builder` commands are aliases to the root.
The deployment uploads the combined apps and extension web assets, leaving
Runtime actions and extension publication unchanged. The application's
custom build hook also uses the combined build for regular root deployments.
The former standalone assets-browser source remains in `web-src`, but the
application CDN now serves these two demos instead.

Both apps use one session/transport module at
`react-app/src/sessionConfig.js`, re-exported by Next.js. Keeping that browser
source inside React's `src` avoids Create React App's external-source restriction
without copying files or changing bundlers. SDK options are shared; each request
still reads the current session, so clearing settings or changing tokens takes
effect immediately.

On an `https://*.adobeio-static.net` deployment, the proxy URL uses the current
origin and `/api/v1/web/aem/aem-cors-proxy`, so a new workspace does not require
editing either app. Localhost and other previews continue using the existing
hosted demo proxy. Images still load directly from AEM Publish; proxy forwarding,
allowed upstream hosts, and authentication are unchanged.

## Setup

- Populate the `.env` file in the project root and fill it as shown [below](#env)

## Local Dev

- `aio app run` to start your local Dev server
- App will run on `localhost:9080` by default

By default the UI will be served locally but actions will be deployed and served from Adobe I/O Runtime. To run your actions locally use the `aio app dev` option.

For more information on the difference between `aio app run` and `aio app dev`, see [here](https://developer.adobe.com/app-builder/docs/guides/development/#aio-app-dev-vs-aio-app-run)

## Test & Coverage

- Run `aio app test` to run unit tests for ui and actions
- Run `aio app test --e2e` to run e2e tests
- Run `npm run test:wknd` for both frontends, including shared session/transport tests
- Run `npm test -- --runInBand test/aem-cors-proxy.test.js` for the proxy

## Deploy & Cleanup

- `aio app deploy` to build and deploy all actions on Runtime and static files to CDN
- `aio app undeploy` to undeploy the app

### GitHub Actions production deployment

[Deploy App Builder to PROD](./.github/workflows/deploy_prod.yml) runs on pushes
to `main` and through the Actions **Run workflow** button. Its deployment job
uses the GitHub environment named `PROD`. Configure that environment with:

- Secrets: `AIO_RUNTIME_AUTH` and `SERVICE_API_KEY` (the API key used by the
  `publish-events` action).
- Variables: `AIO_RUNTIME_NAMESPACE` and `AIO_RUNTIME_APIHOST`
  (`https://adobeioruntime.net`).
- Optional variables: `AEM_PUBLISH_HOST` and `PROXY_ALLOWED_ORIGINS` for the
  proxy's default host and additional allowed origins.

The workflow validates required settings, installs root and frontend
dependencies, runs unit tests, and builds and deploys all Runtime actions and
web assets, including the WKND landing page, both apps, and the header extension.
Deployments are serialized. It uses Runtime credentials directly without
writing or committing `.env`; an `ENV` secret is not needed.

Deployment does not publish extension registrations to Exchange or change log
forwarding. Existing BYO extension registrations remain unchanged. Configure
required reviewers and deployment branch restrictions on `PROD` if production
deployments need approval. The older stage workflow is now manual-only and
still requires its separate stage secrets.

## Config

### WKND Headless CF Console header extension

Use this **Extension URL** in AEM Extension Manager's Bring Your Own extension form:

```text
https://102588-424goldmagpie.adobeio-static.net/wkndheadless-extension.html
```

`/index.html` remains the React/Next.js demo landing page. The combined build
includes the extension page and its bundled scripts, so `npm run deploy:wknd`
preserves all three entry points. Update existing BYO registrations that still
point at `/index.html`; deploying files does not edit Extension Manager settings.

The `aem/cf-console-admin/1` extension adds a **WKND Headless** dropdown:

- **Preview** opens `https://102588-424goldmagpie.adobeio-static.net/?aemHost={encodedHost}&imsToken={encodedToken}` in a new tab.
- **In-Context Editing** opens `https://experience.adobe.com/#/@{encodedImsOrg}/aem/editor/canvas/102588-424goldmagpie.adobeio-static.net/?aemHost={encodedHost}&imsToken={encodedToken}` in a new tab. The parameters belong to the embedded app URL, not the Experience Cloud query string.

Both options read `aemHost` and `auth.imsToken` from the current UIX shared context on every click. Editing also reads `auth.imsOrg`, including its `@AdobeOrg` suffix. URL values are encoded; missing required context produces an error toast instead of opening a tab.

**Demo-only token handoff:** These URLs contain a bearer token. Use short-lived demo tokens only and do not copy, log, bookmark, or share the links. The WKND receiving app imports `aemHost` and `imsToken` into its existing repository-scoped session settings and immediately removes those parameters from its own URL, including on invalid input. This cannot undo exposure in initial requests, server logs, browser history, or Universal Editor's outer URL. API requests still send the token in the Authorization header. Deploy the updated receiving app before using these links; the previously deployed app does not import URL parameters.

**Organization routing:** Live browser verification confirmed that Experience Cloud accepts the IMS organization ID in the `#/@.../` route and normalizes it to the matching tenant. No tenant lookup, hardcoded mapping, or Shell SDK connection in the extension is needed. The ID is read on each click so the link uses the console's current organization rather than a display name or a previously cached value.

The extension lives in `src/aem-cf-console-admin-1/`. Its `view` operation
references `wkndheadless-extension.html`. Runtime actions are unchanged.

```shell
npm install
npm test -- --runInBand test/cf-console-header.test.js
npm run build:extension
aio app run --extension aem/cf-console-admin/1
```

In the Adobe Developer Console, ensure this App Builder workspace includes the **AEM Content Fragments Console** extension service. Opening the extension page by itself does not render the host's header.

For local preview:

1. Open `https://localhost:9080` in the same browser and accept the local development certificate.
2. Open your CF Console URL with **all three** query parameters: `devMode=true`, `ext=https://localhost:9080/wkndheadless-extension.html`, and `repo=<AEM_AUTHOR_HOST>`, before the `#`:

   ```text
   https://experience.adobe.com/?devMode=true&ext=https%3A%2F%2Flocalhost%3A9080%2Fwkndheadless-extension.html&repo=<AEM_AUTHOR_HOST>#/@<TENANT>/aem/cf/admin/
   ```

3. Allow local-network access if the browser prompts, then reload the console. The generic Experience Cloud custom-app link printed by `aio app run` is not the CF Console preview URL.

`devMode=true` is required to allow localhost extension resources in the production Experience Cloud environment. Alternatively, use AEM Extension Manager's preview/test workflow.

Deploy the shared CDN with `npm run deploy:wknd` to keep the extension and both
apps together. Enable the extension for the intended organization through AEM
Extension Manager using its dedicated URL above. This web-only deployment does
not publish or update an Exchange registration. Allow pop-ups for the
console/extension if the browser blocks new tabs. Editing also requires a site
configured for Universal Editor and the appropriate AEM permissions.

### AEM demo CORS proxy

The `aem/aem-cors-proxy` action allows HTTPS `*.github.io` origins and HTTP/HTTPS loopback previews (`localhost`, `127.0.0.1`, and `[::1]`) without per-fork configuration. `PROXY_ALLOWED_ORIGINS` can add explicit custom origins.

Clients supply `aemHost` as a query parameter and their temporary AEM token as an `Authorization: Bearer` header. The legacy `aemToken` query parameter remains supported for older clients, but new clients should not put tokens in URLs. The action allows only read-only persisted-query requests to HTTPS AEM Cloud hosts.

The `web-custom-options: true` annotation enables the action's preflight handler. `OPTIONS` requests do not require an AEM host or token and include CORS permission for `Authorization`; actual responses and upstream errors include the allowed origin too.

Validate and deploy only the proxy:

```shell
npm test -- --runInBand test/aem-cors-proxy.test.js
npx --no-install eslint actions/aem-cors-proxy/index.js test/aem-cors-proxy.test.js
aio app deploy --action aem/aem-cors-proxy --no-web-assets --no-publish --no-log-forwarding-update
```

### `.env`

You can generate this file using the command `aio app use`. 

```bash
# This file must **not** be committed to source control

## please provide your Adobe I/O Runtime credentials
# AIO_RUNTIME_AUTH=
# AIO_RUNTIME_NAMESPACE=
```

### `app.config.yaml`

- Main configuration file that defines an application's implementation. 
- More information on this file, application configuration, and extension configuration 
  can be found [here](https://developer.adobe.com/app-builder/docs/guides/configuration/#appconfigyaml)

#### Action Dependencies

- You have two options to resolve your actions' dependencies:

  1. **Packaged action file**: Add your action's dependencies to the root
   `package.json` and install them using `npm install`. Then set the `function`
   field in `app.config.yaml` to point to the **entry file** of your action
   folder. We will use `webpack` to package your code and dependencies into a
   single minified js file. The action will then be deployed as a single file.
   Use this method if you want to reduce the size of your actions.

  2. **Zipped action folder**: In the folder containing the action code add a
     `package.json` with the action's dependencies. Then set the `function`
     field in `app.config.yaml` to point to the **folder** of that action. We will
     install the required dependencies within that directory and zip the folder
     before deploying it as a zipped action. Use this method if you want to keep
     your action's dependencies separated.

## Debugging in VS Code

While running your local server (`aio app dev`), both UI and actions can be debugged. To do so follow the instructions [here](https://developer.adobe.com/app-builder/docs/guides/development/#debugging)

## Typescript support for UI

To use typescript use `.tsx` extension for react components and add a `tsconfig.json` 
and make sure you have the below config added
```
 {
  "compilerOptions": {
      "jsx": "react"
    }
  } 
```
