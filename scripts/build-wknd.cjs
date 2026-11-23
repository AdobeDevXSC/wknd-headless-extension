const { spawnSync } = require("node:child_process");
const { copyFileSync, cpSync, rmSync } = require("node:fs");
const path = require("node:path");

const projectDirectory = path.resolve(__dirname, "..");
const appDirectory = path.join(projectDirectory, "react-app");
const outputDirectory = path.join(projectDirectory, "dist/application/web-prod");
const reactBuildScript = require.resolve("react-scripts/scripts/build", { paths: [appDirectory] });
const result = spawnSync(process.execPath, [reactBuildScript], {
  cwd: appDirectory,
  stdio: "inherit",
  env: {
    ...process.env,
    PUBLIC_URL: "/react-app",
    BUILD_PATH: path.join(outputDirectory, "react-app"),
    GENERATE_SOURCEMAP: "false",
  },
});

if (result.error) throw result.error;
if (result.status !== 0) {
  throw new Error(`React build failed (${result.signal || result.status}).`);
}

const nextDirectory = path.join(projectDirectory, "next-js");
const nextBuild = spawnSync(process.platform === "win32" ? "npm.cmd" : "npm", ["run", "export"], {
  cwd: nextDirectory,
  stdio: "inherit",
  env: { ...process.env, NEXT_PUBLIC_BASE_PATH: "/next-js", NEXT_TELEMETRY_DISABLED: "1" },
});
if (nextBuild.error) throw nextBuild.error;
if (nextBuild.status !== 0) {
  throw new Error(`Next.js export failed (${nextBuild.signal || nextBuild.status}).`);
}

const nextOutput = path.join(outputDirectory, "next-js");
rmSync(nextOutput, { recursive: true, force: true });
cpSync(path.join(nextDirectory, "out"), nextOutput, { recursive: true });

const extensionBuild = spawnSync(process.platform === "win32" ? "npm.cmd" : "npm", ["run", "build:extension"], {
  cwd: projectDirectory,
  stdio: "inherit",
});
if (extensionBuild.error) throw extensionBuild.error;
if (extensionBuild.status !== 0) {
  throw new Error(`Extension build failed (${extensionBuild.signal || extensionBuild.status}).`);
}
cpSync(path.join(projectDirectory, "dist/aem-cf-console-admin-1/web-prod"), outputDirectory, { recursive: true });
copyFileSync(path.join(projectDirectory, "landing/index.html"), path.join(outputDirectory, "index.html"));
copyFileSync(path.join(appDirectory, "src/sessionConfig.js"), path.join(outputDirectory, "session-config.js"));
