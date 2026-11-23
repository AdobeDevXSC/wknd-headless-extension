import { act, renderHook, waitFor } from "@testing-library/react";
import sessionConfig from "../sessionConfig";
import AEMHeadless from "@adobe/aem-headless-client-js";
import { useAdventuresByActivity, useAdventureBySlug } from "./usePersistedQueries";

jest.mock("@adobe/aem-headless-client-js", () => jest.fn());

const runPersistedQuery = jest.fn();
const config = {
  aemHost: "https://author-demo.example",
  graphqlEndpoint: "session-namespace",
  authToken: "temporary-demo-token",
};
const params = {};

beforeEach(() => {
  jest.clearAllMocks();
  sessionStorage.clear();
  sessionConfig.save(config, "/");
  AEMHeadless.mockImplementation(() => ({ runPersistedQuery }));
  runPersistedQuery.mockReset();
});

test("environment settings cannot replace a missing browser session", () => {
  sessionStorage.clear();
  const values = {
    REACT_APP_HOST_URI: "https://environment-demo.example",
    REACT_APP_PROXY_URL: "https://environment-proxy.example",
    REACT_APP_GRAPHQL_ENDPOINT: "environment-namespace",
    REACT_APP_AUTH_TOKEN: "environment-demo-token",
  };
  const original = {};
  for (const key of Object.keys(values)) {
    original[key] = process.env[key];
    process.env[key] = values[key];
  }
  try {
    let client;
    let isolatedSDK;
    jest.isolateModules(() => {
      isolatedSDK = require("@adobe/aem-headless-client-js");
      isolatedSDK.mockImplementation(() => ({ runPersistedQuery }));
      client = require("./aemHeadlessClient").default;
    });
    expect(() => client.runPersistedQuery("session-namespace/adventures-all", {}))
      .toThrow(/Configure and save/);
    expect(isolatedSDK).not.toHaveBeenCalled();
  } finally {
    for (const key of Object.keys(values)) {
      if (original[key] === undefined) delete process.env[key];
      else process.env[key] = original[key];
    }
  }
});

test("list queries use the proxy with the session token and namespace", async () => {
  runPersistedQuery.mockResolvedValue({ data: { adventureList: { items: [] } } });
  const { result } = renderHook(() => useAdventuresByActivity("Hiking", params));
  await waitFor(() => expect(result.current.adventures).toEqual([]));
  expect(AEMHeadless).toHaveBeenCalledWith(expect.objectContaining({
    serviceURL: sessionConfig.defaultProxyURL,
    auth: config.authToken,
  }));
  expect(runPersistedQuery).toHaveBeenCalledWith("session-namespace/adventures-by-activity", { activity: "Hiking" });
});

test("detail queries use the session namespace", async () => {
  const adventure = { slug: "demo" };
  const references = [{ __typename: "AdventureModel", slug: "related" }];
  runPersistedQuery.mockResolvedValue({ data: { adventureList: { items: [adventure], _references: references } } });
  const { result } = renderHook(() => useAdventureBySlug("demo", params));
  await waitFor(() => expect(result.current.adventure).toEqual(adventure));
  expect(result.current.references).toEqual(references);
  expect(runPersistedQuery).toHaveBeenCalledWith("session-namespace/adventure-by-slug", { slug: "demo" });
});

test("detail navigation clears previous content and ignores outdated responses", async () => {
  const adventure = { slug: "demo" };
  const references = [{ __typename: "AdventureModel", slug: "related" }];
  runPersistedQuery.mockResolvedValueOnce({ data: { adventureList: { items: [adventure], _references: references } } });
  const { result, rerender } = renderHook(
    ({ slug }) => useAdventureBySlug(slug, params),
    { initialProps: { slug: "demo" } }
  );
  await waitFor(() => expect(result.current.references).toEqual(references));

  let resolveOutdated;
  runPersistedQuery.mockReturnValueOnce(new Promise(resolve => { resolveOutdated = resolve; }));
  rerender({ slug: "outdated" });
  expect(result.current.adventure).toBeNull();
  expect(result.current.references).toBeNull();

  const related = { slug: "related" };
  runPersistedQuery.mockResolvedValueOnce({ data: { adventureList: { items: [related], _references: [] } } });
  rerender({ slug: "related" });
  await waitFor(() => expect(result.current.adventure).toEqual(related));
  await act(async () => {
    resolveOutdated({ data: { adventureList: { items: [] } } });
  });
  expect(result.current.adventure).toEqual(related);
  expect(result.current.references).toEqual([]);
  expect(result.current.error).toBeNull();
});

test("invalid stored configuration reaches the error state used by the UI", async () => {
  sessionStorage.setItem(sessionConfig.storageKey("/"), "{broken");
  const log = jest.spyOn(console, "error").mockImplementation(() => {});
  try {
    const { result } = renderHook(() => useAdventuresByActivity(null, params));
    await waitFor(() => expect(result.current.error).toMatch(/Clear settings/));
    expect(runPersistedQuery).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalled();
  } finally {
    log.mockRestore();
  }
});

test("SDK network errors with object-shaped JSON reach the error state", async () => {
  const error = new Error("Failed to fetch");
  error.toJSON = () => ({ code: "REQUEST_ERROR", message: "General Request error: Failed to fetch." });
  runPersistedQuery.mockRejectedValue(error);
  const log = jest.spyOn(console, "error").mockImplementation(() => {});
  try {
    const { result } = renderHook(() => useAdventuresByActivity(null, params));
    await waitFor(() => expect(result.current.error).toBe("General Request error: Failed to fetch."));
    expect(log).toHaveBeenCalledWith(error);
  } finally {
    log.mockRestore();
  }
});
