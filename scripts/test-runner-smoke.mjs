#!/usr/bin/env node
import { spawn } from "node:child_process";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import http from "node:http";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import JSZip from "jszip";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const defaultReleaseUrl = "https://wan0.net/llmchef/release/latest.zip";
const expectedIndex = "<!doctype html><title>Runner Smoke</title><div id=\"app\">runner smoke fixture</div>";
const expectedAsset = "console.log('runner smoke fixture');";
const launcherProbeHost = "localhost";
const releaseServerHost = "127.0.0.1";

const args = new Set(process.argv.slice(2));
const staticOnly = args.has("--static-only");
const launcherSetArg = process.argv.slice(2).find((arg) => arg.startsWith("--launcher-set="));
const launcherSet = launcherSetArg ? launcherSetArg.split("=")[1] : null;

const staticContracts = [
  {
    file: "runner/llmchef.js",
    required: ["LLMCHEF_RELEASE_URL", "LLMCHEF_RUNNER_APP_DIR", defaultReleaseUrl, "index.html", "127.0.0.1"],
    disallowed: ["wan0net.github.io/llmchef/release/latest.zip"],
  },
  {
    file: "runner/llmchef.php",
    required: ["LLMCHEF_RELEASE_URL", "LLMCHEF_RUNNER_APP_DIR", defaultReleaseUrl, "index.html", "localhost"],
    disallowed: ["wan0net.github.io/llmchef/release/latest.zip"],
  },
  {
    file: "runner/llmchef.psh",
    required: ["LLMCHEF_RELEASE_URL", "LLMCHEF_RUNNER_APP_DIR", defaultReleaseUrl, "index.html", "127.0.0.1"],
    disallowed: ["wan0net.github.io/llmchef/release/latest.zip", "Creating a placeholder"],
  },
  {
    file: "runner/llmchef.py",
    required: ["LLMCHEF_RELEASE_URL", "LLMCHEF_RUNNER_APP_DIR", defaultReleaseUrl, "index.html", "127.0.0.1"],
    disallowed: ["wan0net.github.io/llmchef/release/latest.zip"],
  },
  {
    file: "runner/llmchef.rb",
    required: ["LLMCHEF_RELEASE_URL", "LLMCHEF_RUNNER_APP_DIR", defaultReleaseUrl, "index.html", "127.0.0.1"],
    disallowed: ["wan0net.github.io/llmchef/release/latest.zip"],
  },
  {
    file: "runner/llmchef.sh",
    required: ["LLMCHEF_RELEASE_URL", "LLMCHEF_RUNNER_APP_DIR", defaultReleaseUrl, "index.html", "loopback http(s) host"],
    disallowed: ["wan0net.github.io/llmchef/release/latest.zip", "Creating a placeholder"],
  },
];

const executableLaunchers = {
  posix: [
    { id: "js", command: "node", args: ["runner/llmchef.js"] },
    { id: "py", command: "python3", args: ["runner/llmchef.py"] },
    { id: "rb", command: "ruby", args: ["runner/llmchef.rb"] },
    { id: "sh", command: "bash", args: ["runner/llmchef.sh"] },
    { id: "php", command: "php", args: ["runner/llmchef.php"], optional: true },
  ],
  windows: [
    { id: "js", command: "node", args: ["runner/llmchef.js"] },
    {
      id: "psh",
      command: "powershell.exe",
      args: ["-ExecutionPolicy", "Bypass", "-File", "runner/llmchef.psh"],
      powershellScript: "runner/llmchef.psh",
      env: {
        LLMCHEF_RUNNER_FOREGROUND: "1",
        LLMCHEF_TEST_MAX_REQUESTS: "5",
      },
    },
  ],
};

await run();

async function run() {
  await runStaticContracts();
  if (shouldRunRubyRegression()) {
    await runRubyRegressionTest();
  }
  const launcherConfigs = await selectAvailableLaunchers();
  await runInvalidOverrideChecks(launcherConfigs);

  if (staticOnly) {
    console.log("Runner smoke static checks passed.");
    return;
  }

  if (launcherConfigs.length === 0) {
    throw new Error(`No launcher set available for platform ${process.platform}.`);
  }

  await runRedirectOverrideChecks(launcherConfigs);
  await runUnsafeArchiveChecks(launcherConfigs);

  const fixtureRoot = await fs.mkdtemp(path.join(os.tmpdir(), "llmchef-runner-smoke-"));
  try {
    const fixtureZip = await createFixtureZip();
    const releaseServer = await startReleaseServer(fixtureZip);
    try {
      for (const launcher of launcherConfigs) {
        await runLauncherSmoke(launcher, fixtureRoot, releaseServer.releaseUrl);
      }
    } finally {
      await new Promise((resolve, reject) => releaseServer.server.close((error) => (error ? reject(error) : resolve())));
    }
  } finally {
    await fs.rm(fixtureRoot, { recursive: true, force: true });
  }

  console.log(`Runner smoke checks passed for ${launcherConfigs.map((launcher) => launcher.id).join(", ")}.`);
}

async function runStaticContracts() {
  for (const contract of staticContracts) {
    const source = await fs.readFile(path.join(repoRoot, contract.file), "utf8");
    for (const snippet of contract.required) {
      assert.match(source, new RegExp(escapeRegex(snippet)), `${contract.file} is missing required snippet: ${snippet}`);
    }
    for (const snippet of contract.disallowed) {
      assert.ok(!source.includes(snippet), `${contract.file} still contains disallowed snippet: ${snippet}`);
    }
  }
}

async function runRubyRegressionTest() {
  const result = await spawnAndCollect("ruby", ["runner/llmchef_rb_test.rb"], {
    cwd: repoRoot,
    env: process.env,
  });
  assert.equal(result.code, 0, `Ruby runner regression tests failed:\n${result.output}`);
}

function selectLaunchers() {
  if (launcherSet) {
    const selected = executableLaunchers[launcherSet];
    if (!selected) {
      throw new Error(`Unsupported launcher set: ${launcherSet}`);
    }
    return selected;
  }

  if (process.platform === "win32") {
    return executableLaunchers.windows;
  }

  if (process.platform === "linux" || process.platform === "darwin") {
    return executableLaunchers.posix;
  }

  return [];
}

async function selectAvailableLaunchers() {
  const launchers = selectLaunchers();
  const availableLaunchers = [];

  for (const launcher of launchers) {
    if (await isCommandAvailable(launcher.command)) {
      availableLaunchers.push(launcher);
      continue;
    }

    if (launcher.optional) {
      console.log(`Skipping optional ${launcher.id} launcher because ${launcher.command} is not available.`);
      continue;
    }

    availableLaunchers.push(launcher);
  }

  return availableLaunchers;
}

async function isCommandAvailable(command) {
  return new Promise((resolve) => {
    const child = spawn(command, ["--version"], {
      cwd: repoRoot,
      stdio: "ignore",
    });

    child.once("error", () => resolve(false));
    child.once("exit", () => resolve(true));
  });
}

function shouldRunRubyRegression() {
  if (launcherSet) {
    return launcherSet === "posix";
  }

  return process.platform === "linux" || process.platform === "darwin";
}

async function createFixtureZip() {
  const zip = new JSZip();
  zip.file("index.html", expectedIndex);
  zip.file("assets/app.js", expectedAsset);
  zip.file("assets/manifest.json", JSON.stringify({ name: "runner-smoke" }));
  return zip.generateAsync({ type: "nodebuffer" });
}

async function createUnsafeFixtureZip() {
  const zip = new JSZip();
  zip.file("index.html", expectedIndex);
  zip.file("../evil.txt", "path traversal smoke");
  return zip.generateAsync({ type: "nodebuffer" });
}

async function startReleaseServer(zipBuffer) {
  const server = http.createServer((req, res) => {
    if ((req.url || "").startsWith("/release/latest.zip")) {
      res.writeHead(200, { "Content-Type": "application/zip" });
      res.end(zipBuffer);
      return;
    }
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not found");
  });

  const port = await listenOnRandomPort(server, releaseServerHost);
  return {
    server,
    releaseUrl: `http://${releaseServerHost}:${port}/release/latest.zip`,
  };
}

async function startRedirectServer(location) {
  const server = http.createServer((_req, res) => {
    res.writeHead(302, { Location: location });
    res.end("redirect");
  });

  const port = await listenOnRandomPort(server, "127.0.0.1");
  return {
    server,
    releaseUrl: `http://127.0.0.1:${port}/release/latest.zip`,
  };
}

async function runLauncherSmoke(launcher, fixtureRoot, releaseUrl) {
  const appDir = path.join(fixtureRoot, `${launcher.id}-app`);
  await fs.mkdir(path.join(appDir, "assets"), { recursive: true });
  await fs.writeFile(path.join(appDir, "index.html"), "stale index");
  await fs.writeFile(path.join(appDir, "assets", "app.js"), "stale asset");
  await fs.writeFile(path.join(appDir, "stale.txt"), "stale file");

  const port = await getFreePort();
  const preparedLauncher = await prepareLauncherSpawn(launcher, fixtureRoot);
  const child = spawn(launcher.command, [...preparedLauncher.args, String(port)], {
    cwd: repoRoot,
    detached: process.platform !== "win32",
    env: {
      ...process.env,
      LLMCHEF_RELEASE_URL: releaseUrl,
      LLMCHEF_RUNNER_APP_DIR: appDir,
      ...launcher.env,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  let output = "";
  child.stdout.on("data", (chunk) => {
    output += chunk.toString();
  });
  child.stderr.on("data", (chunk) => {
    output += chunk.toString();
  });

  try {
    await waitForHealthyServer(port, child, () => output);

    const rootResponse = await fetchText(buildLauncherUrl(port, "/"));
    assert.equal(rootResponse.statusCode, 200, `${launcher.id} did not serve the root document.`);
    assert.match(rootResponse.body, /runner smoke fixture/, `${launcher.id} served unexpected root content.`);

    const assetResponse = await fetchText(buildLauncherUrl(port, "/assets/app.js"));
    assert.equal(assetResponse.statusCode, 200, `${launcher.id} did not serve the extracted asset.`);
    assert.equal(assetResponse.body.trim(), expectedAsset, `${launcher.id} did not refresh the extracted asset.`);

    const spaResponse = await fetchText(buildLauncherUrl(port, "/missing/route"));
    assert.equal(spaResponse.statusCode, 200, `${launcher.id} did not serve index.html for SPA routing.`);
    assert.match(spaResponse.body, /runner smoke fixture/, `${launcher.id} did not fall back to index.html for SPA routing.`);

    assert.equal((await fs.readFile(path.join(appDir, "index.html"), "utf8")).trim(), expectedIndex);
    assert.equal((await fs.readFile(path.join(appDir, "assets", "app.js"), "utf8")).trim(), expectedAsset);
    assert.equal(await fileExists(path.join(appDir, "stale.txt")), false, `${launcher.id} left stale files after extraction.`);
  } finally {
    await stopProcess(child);
  }
}

async function runInvalidOverrideChecks(launchers) {
  const invalidOverrides = [
    "file:///etc/passwd",
    "http://127.0.0.2:4010/release/latest.zip",
    "http://127.attacker.tld/payload.zip",
    "http://localhost:80@attacker.tld/payload.zip",
  ];

  for (const launcher of launchers) {
    for (const invalidReleaseUrl of invalidOverrides) {
      const fixtureRoot = await fs.mkdtemp(path.join(os.tmpdir(), `llmchef-invalid-override-${launcher.id}-`));
      try {
        const preparedLauncher = await prepareLauncherSpawn(launcher, fixtureRoot);
        const result = await spawnAndCollect(launcher.command, [...preparedLauncher.args, "0"], {
          cwd: repoRoot,
          env: {
            ...process.env,
            LLMCHEF_RELEASE_URL: invalidReleaseUrl,
            LLMCHEF_RUNNER_APP_DIR: path.join(fixtureRoot, "app"),
            ...launcher.env,
          },
        });

        assert.equal(result.timedOut, false, `${launcher.id} timed out while rejecting override (${invalidReleaseUrl}):\n${result.output}`);
        assert.notEqual(result.code, 0, `${launcher.id} accepted an invalid override: ${invalidReleaseUrl}`);
        assert.match(
          result.output,
        /LLMCHEF_RELEASE_URL.*(loopback|default release origin|http\(s\)|userinfo)/i,
          `${launcher.id} reported an unexpected error for a rejected override (${invalidReleaseUrl}):\n${result.output}`,
        );
      } finally {
        await fs.rm(fixtureRoot, { recursive: true, force: true });
      }
    }
  }
}

async function runRedirectOverrideChecks(launchers) {
  const redirectServer = await startRedirectServer("http://127.attacker.tld/payload.zip");

  try {
    for (const launcher of launchers) {
      const fixtureRoot = await fs.mkdtemp(path.join(os.tmpdir(), `llmchef-redirect-override-${launcher.id}-`));
      try {
        const preparedLauncher = await prepareLauncherSpawn(launcher, fixtureRoot);
        const result = await spawnAndCollect(launcher.command, [...preparedLauncher.args, "0"], {
          cwd: repoRoot,
          env: {
            ...process.env,
            LLMCHEF_RELEASE_URL: redirectServer.releaseUrl,
            LLMCHEF_RUNNER_APP_DIR: path.join(fixtureRoot, "app"),
            ...launcher.env,
          },
        });

        assert.equal(result.timedOut, false, `${launcher.id} timed out while rejecting a malicious redirect override:\n${result.output}`);
        assert.notEqual(result.code, 0, `${launcher.id} followed a malicious redirect override.`);
        assert.match(
          result.output,
          /(redirect|max(?:imum)? redir|maximum redirection)/i,
          `${launcher.id} reported an unexpected error for a rejected redirect override:\n${result.output}`,
        );
      } finally {
        await fs.rm(fixtureRoot, { recursive: true, force: true });
      }
    }
  } finally {
    await new Promise((resolve, reject) => redirectServer.server.close((error) => (error ? reject(error) : resolve())));
  }
}

async function runUnsafeArchiveChecks(launchers) {
  const unsafeZip = await createUnsafeFixtureZip();
  const releaseServer = await startReleaseServer(unsafeZip);

  try {
    for (const launcher of launchers) {
      const fixtureRoot = await fs.mkdtemp(path.join(os.tmpdir(), `llmchef-unsafe-archive-${launcher.id}-`));
      const appDir = path.join(fixtureRoot, "app");
      const outsidePath = path.join(fixtureRoot, "evil.txt");

      try {
        const preparedLauncher = await prepareLauncherSpawn(launcher, fixtureRoot);
        const result = await spawnAndCollect(launcher.command, [...preparedLauncher.args, "0"], {
          cwd: repoRoot,
          env: {
            ...process.env,
            LLMCHEF_RELEASE_URL: releaseServer.releaseUrl,
            LLMCHEF_RUNNER_APP_DIR: appDir,
            ...launcher.env,
          },
        });

        assert.equal(result.timedOut, false, `${launcher.id} timed out while rejecting an unsafe archive:\n${result.output}`);
        assert.notEqual(result.code, 0, `${launcher.id} accepted an unsafe archive with path traversal.`);
        assert.equal(await fileExists(outsidePath), false, `${launcher.id} wrote outside the app dir while extracting an unsafe archive.`);
      } finally {
        await fs.rm(fixtureRoot, { recursive: true, force: true });
      }
    }
  } finally {
    await new Promise((resolve, reject) => releaseServer.server.close((error) => (error ? reject(error) : resolve())));
  }
}

async function prepareLauncherSpawn(launcher, fixtureRoot) {
  if (!launcher.powershellScript) {
    return launcher;
  }

  const tempScript = path.join(
    fixtureRoot,
    `${launcher.id}-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}.ps1`,
  );
  await fs.copyFile(path.join(repoRoot, launcher.powershellScript), tempScript);

  return {
    ...launcher,
    args: launcher.args.map((arg) => (arg === launcher.powershellScript ? tempScript : arg)),
  };
}

async function waitForHealthyServer(port, child, readOutput) {
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`Launcher exited early with code ${child.exitCode}:\n${readOutput()}`);
    }

    try {
      const response = await fetchText(buildLauncherUrl(port, "/"));
      if (response.statusCode === 200) {
        return;
      }
    } catch {
      // Server is still starting.
    }

    await delay(250);
  }

  throw new Error(`Timed out waiting for launcher server:\n${readOutput()}`);
}

function buildLauncherUrl(port, pathname) {
  return `http://${launcherProbeHost}:${port}${pathname}`;
}

async function stopProcess(child) {
  if (child.exitCode !== null) {
    return;
  }

  await terminateProcessTree(child, "SIGTERM");
  const exited = await waitForExit(child, 5000);
  if (exited) {
    return;
  }

  await terminateProcessTree(child, "SIGKILL");
  await waitForExit(child, 5000);
}

async function terminateProcessTree(child, signal) {
  if (!child.pid) {
    child.kill(signal);
    return;
  }

  if (process.platform === "win32") {
    await runBestEffort("taskkill", ["/PID", String(child.pid), "/T", "/F"], 5000);
    return;
  }

  try {
    process.kill(-child.pid, signal);
  } catch {
    child.kill(signal);
  }
}

async function runBestEffort(command, commandArgs, timeoutMs) {
  await new Promise((resolve) => {
    const child = spawn(command, commandArgs, {
      cwd: repoRoot,
      stdio: "ignore",
    });
    const timer = setTimeout(resolve, timeoutMs);
    child.once("error", () => {
      clearTimeout(timer);
      resolve();
    });
    child.once("exit", () => {
      clearTimeout(timer);
      resolve();
    });
  });
}

async function waitForExit(child, timeoutMs) {
  if (child.exitCode !== null) {
    return true;
  }

  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(false), timeoutMs);
    child.once("exit", () => {
      clearTimeout(timer);
      resolve(true);
    });
  });
}

async function spawnAndCollect(command, commandArgs, options, timeoutMs = 30000) {
  const child = spawn(command, commandArgs, {
    ...options,
    stdio: ["ignore", "pipe", "pipe"],
  });

  let output = "";
  child.stdout.on("data", (chunk) => {
    output += chunk.toString();
  });
  child.stderr.on("data", (chunk) => {
    output += chunk.toString();
  });

  const { code, timedOut } = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      resolve({ code: child.exitCode, timedOut: true });
    }, timeoutMs);
    child.once("error", reject);
    child.once("exit", (code) => {
      clearTimeout(timer);
      resolve({ code, timedOut: false });
    });
  });

  return { code, output, timedOut };
}

async function fetchText(url) {
  return new Promise((resolve, reject) => {
    const request = http.get(url, (response) => {
      const chunks = [];
      response.on("data", (chunk) => chunks.push(chunk));
      response.on("end", () => {
        resolve({
          statusCode: response.statusCode || 0,
          body: Buffer.concat(chunks).toString("utf8"),
        });
      });
    });
    request.on("error", reject);
  });
}

async function listenOnRandomPort(server, host) {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, host, () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        reject(new Error("Unable to resolve server address."));
        return;
      }
      resolve(address.port);
    });
  });
}

async function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close();
        reject(new Error("Unable to allocate a free port."));
        return;
      }
      const { port } = address;
      server.close((error) => (error ? reject(error) : resolve(port)));
    });
  });
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
