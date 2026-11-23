/** @jest-environment node */
import sessionConfig from "./sessionConfig";

test("proxy requests forward the AEM host and Bearer token while omitting SDK cookies", async () => {
  const originalFetch = global.fetch;
  const originalHeaders = global.Headers;
  global.fetch = jest.fn().mockResolvedValue({ ok: true });
  global.Headers = jest.fn().mockImplementation((headers) => new Map(Object.entries(headers || {})));
  try {
    const client = sessionConfig.clientOptions({
      aemHost: "https://author-demo.example/",
      authToken: "temporary-demo-token",
      proxyURL: sessionConfig.defaultProxyURL,
    });
    await client.fetch(
      sessionConfig.defaultProxyURL + "/graphql/execute.json/demo/adventures-all?existing=value",
      { method: "GET", credentials: "include", headers: { Accept: "application/json" } },
    );
    const [url, options] = global.fetch.mock.calls[0];
    expect(new URL(url).origin).toBe(new URL(sessionConfig.defaultProxyURL).origin);
    expect(new URL(url).pathname).toBe("/api/v1/web/aem/aem-cors-proxy/graphql/execute.json/demo/adventures-all");
    expect(new URL(url).searchParams.get("aemHost")).toBe("https://author-demo.example");
    expect(new URL(url).searchParams.get("existing")).toBe("value");
    expect(url).not.toContain("temporary-demo-token");
    expect(options.credentials).toBe("omit");
    expect(options.method).toBe("GET");
    expect(options.headers.get("Authorization")).toBe("Bearer temporary-demo-token");
    expect(options.headers.get("Accept")).toBe("application/json");
  } finally {
    global.fetch = originalFetch;
    if (originalHeaders === undefined) delete global.Headers;
    else global.Headers = originalHeaders;
  }
});
