import sessionConfig from "./sessionConfig";

const config = {
  proxyURL: sessionConfig.defaultProxyURL,
  aemHost: "https://author-demo.example",
  graphqlEndpoint: "custom-namespace",
  authToken: "temporary-demo-token",
};
const rootPath = "/forked-repo/";

beforeEach(() => {
  sessionStorage.clear();
  window.history.replaceState(null, "", "/");
});

afterEach(() => {
  jest.restoreAllMocks();
  window.history.replaceState(null, "", "/");
});

test.each([
  ["https://123456-test.adobeio-static.net", "https://123456-test.adobeio-static.net/api/v1/web/aem/aem-cors-proxy"],
  ["http://localhost:3000", sessionConfig.defaultProxyURL],
  ["https://preview.example.com", sessionConfig.defaultProxyURL],
  ["https://test.adobeio-static.net.example.com", sessionConfig.defaultProxyURL],
])("proxy routing uses the hosted workspace origin and preserves external previews for %s", (origin, expected) => {
  expect(sessionConfig.proxyURLForOrigin(origin)).toBe(expected);
});

test("saved settings override all defaults and survive subsequent reads", () => {
  const saved = sessionConfig.save({ ...config, aemHost: config.aemHost + "/" }, rootPath);
  expect(saved.aemHost).toBe(config.aemHost);
  expect(sessionConfig.read(rootPath)).toEqual(config);
  expect(sessionConfig.read("/forked-repo")).toEqual(config);
});

test("settings are isolated by repository path and clearing removes the connection", () => {
  sessionConfig.save(config, rootPath);
  expect(sessionConfig.read("/another-repo/")).toBeNull();
  sessionStorage.setItem("unrelated-setting", "keep");
  sessionConfig.clear(rootPath);
  expect(sessionConfig.read(rootPath)).toBeNull();
  expect(() => sessionConfig.requireConfig(rootPath)).toThrow(/Configure and save/);
  expect(sessionStorage.getItem("unrelated-setting")).toBe("keep");
});

test.each([
  [{ aemHost: "javascript:alert(1)" }, /HTTP or HTTPS/],
  [{ aemHost: "https://author.example/content" }, /without a path/],
  [{ aemHost: "" }, /valid AEM Author URL/],
  [{ aemHost: "https://author.example/?token=secret" }, /query parameters/],
  [{ graphqlEndpoint: "https://example/graphql" }, /GraphQL namespace/],
  [{ authToken: "" }, /Enter a temporary access token/],
  [{ authToken: "   " }, /Enter a temporary access token/],
  [{ authToken: "token\nanother-line" }, /single line/],
])("invalid settings are rejected without overwriting the saved connection", (override, message) => {
  sessionConfig.save(config, rootPath);
  expect(() => sessionConfig.save({ ...config, ...override }, rootPath)).toThrow(message);
  expect(sessionConfig.read(rootPath)).toEqual(config);
});

test("a missing session cannot supply an AEM connection", () => {
  expect(sessionConfig.read(rootPath)).toBeNull();
  expect(() => sessionConfig.requireConfig(rootPath)).toThrow(/demo landing page/);
});

test("the React route resolves the landing page scope without build configuration", () => {
  try {
    window.history.replaceState(null, "", "/forked-repo/react-app/");
    expect(sessionConfig.appRootPath("react-app")).toBe(rootPath);
  } finally {
    window.history.replaceState(null, "", "/");
  }
});

test("saved direct connections adopt the proxy and cannot override the demo proxy", () => {
  const { proxyURL, ...directConfig } = config;
  sessionStorage.setItem(sessionConfig.storageKey(rootPath), JSON.stringify(directConfig));
  expect(sessionConfig.requireConfig(rootPath)).toEqual(config);
  sessionStorage.setItem(sessionConfig.storageKey(rootPath), JSON.stringify({
    ...config,
    proxyURL: "https://legacy-proxy.example/api",
  }));
  expect(sessionConfig.requireConfig(rootPath)).toEqual(config);
  sessionConfig.save(sessionConfig.read(rootPath), rootPath);
  expect(JSON.parse(sessionStorage.getItem(sessionConfig.storageKey(rootPath)))).toEqual(config);
});

test("malformed saved settings are reported rather than silently falling back", () => {
  sessionStorage.setItem(sessionConfig.storageKey(rootPath), "{broken");
  expect(() => sessionConfig.read(rootPath)).toThrow(/Clear settings/);
  sessionStorage.setItem(sessionConfig.storageKey(rootPath), JSON.stringify({ aemHost: config.aemHost }));
  expect(() => sessionConfig.read(rootPath)).toThrow(/Invalid AEM setting/);
});

test("blocked browser storage reports an actionable error", () => {
  const getItem = jest.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
    throw new DOMException("Blocked", "SecurityError");
  });
  try {
    expect(() => sessionConfig.read(rootPath)).toThrow(/Allow storage/);
  } finally {
    getItem.mockRestore();
  }
});

test.each([
  "/forked-repo/",
  "/forked-repo/react-app/",
  "/forked-repo/react-app/?slug=camping#details",
])("URL connections populate the shared session and scrub only connection parameters at %s", (path) => {
  const url = new URL(path, window.location.origin);
  url.searchParams.set("aemHost", "author-demo.adobeaemcloud.com");
  url.searchParams.set("imsToken", "demo+token/with&reserved=characters");
  window.history.replaceState({ keep: true }, "", url);
  const imported = sessionConfig.read(rootPath);
  expect(imported).toEqual({
    aemHost: "https://author-demo.adobeaemcloud.com",
    authToken: "demo+token/with&reserved=characters",
    proxyURL: sessionConfig.defaultProxyURL,
    graphqlEndpoint: "wknd-shared",
  });
  expect(window.location.pathname + window.location.search + window.location.hash).toBe(path);
  expect(window.history.state).toEqual({ keep: true });
  expect(sessionConfig.read(rootPath)).toEqual(imported);
});

test("a new complete URL connection replaces an existing saved connection", () => {
  sessionConfig.save(config, rootPath);
  const params = new URLSearchParams({ aemHost: "https://author-new.example/", imsToken: "new-demo-token" });
  window.history.replaceState(null, "", rootPath + "?" + params);
  expect(sessionConfig.requireConfig(rootPath)).toEqual({
    aemHost: "https://author-new.example",
    authToken: "new-demo-token",
    proxyURL: sessionConfig.defaultProxyURL,
    graphqlEndpoint: "wknd-shared",
  });
});

test.each([
  "aemHost=author-demo.example",
  "imsToken=demo-token",
  "aemHost=author-demo.example&imsToken=",
  "aemHost=author-demo.example&imsToken=one&imsToken=two",
  "aemHost=author-demo.example&imsToken=demo-token%0Aanother-line",
  "aemHost=https%3A%2F%2Fauthor.example%2Fcontent&imsToken=demo-token",
])("invalid URL connections are scrubbed and reported without overwriting settings: %s", (query) => {
  sessionConfig.save(config, rootPath);
  window.history.replaceState(null, "", rootPath + "?keep=yes&" + query + "#details");
  expect(() => sessionConfig.read(rootPath)).toThrow();
  expect(window.location.search + window.location.hash).toBe("?keep=yes#details");
  expect(sessionConfig.read(rootPath)).toEqual(config);
});

test("a storage failure is reported after scrubbing the token from the URL", () => {
  window.history.replaceState(null, "", rootPath + "?aemHost=author-demo.example&imsToken=demo-token");
  jest.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new DOMException("Blocked", "SecurityError");
  });
  expect(() => sessionConfig.read(rootPath)).toThrow(/Could not save settings/);
  expect(window.location.search).toBe("");
});

test("a URL cleanup failure is reported without importing the connection", () => {
  window.history.replaceState(null, "", rootPath + "?aemHost=author-demo.example&imsToken=demo-token");
  jest.spyOn(window.history, "replaceState").mockImplementation(() => {
    throw new DOMException("Blocked", "SecurityError");
  });
  expect(() => sessionConfig.read(rootPath)).toThrow(/Could not remove connection parameters/);
  expect(sessionStorage.getItem(sessionConfig.storageKey(rootPath))).toBeNull();
});
