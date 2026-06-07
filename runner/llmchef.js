#!/usr/bin/env node
import { execFile } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import https from "node:https";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, URL } from "node:url";

const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".wasm": "application/wasm",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
};

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const DEFAULT_RELEASE_URL = "https://wan0.net/llmchef/release/latest.zip";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const releaseUrl = resolveReleaseUrl(process.env.LLMCHEF_RELEASE_URL);
const isReleaseOverride = releaseUrl !== DEFAULT_RELEASE_URL;
const tempDir = process.env.LLMCHEF_RUNNER_APP_DIR || path.join(__dirname, "llmchef-app");

function resolveReleaseUrl(candidate = DEFAULT_RELEASE_URL) {
  if (!candidate || candidate === DEFAULT_RELEASE_URL) {
    return DEFAULT_RELEASE_URL;
  }

  const parsed = new URL(candidate);
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("LLMCHEF_RELEASE_URL only supports http(s) loopback overrides.");
  }

  if (!["localhost", "127.0.0.1", "::1"].includes(parsed.hostname)) {
    throw new Error("LLMCHEF_RELEASE_URL must stay on the default release origin or a loopback host.");
  }

  return candidate;
}

function getDownloadClient(url) {
  return new URL(url).protocol === "http:" ? http : https;
}

function downloadRelease(url, destinationPath, redirectCount = 0) {
  if (redirectCount > 5) {
    throw new Error("Too many redirects while downloading LLMChef release.");
  }

  return new Promise((resolve, reject) => {
    const request = getDownloadClient(url).get(url, (response) => {
      const statusCode = response.statusCode || 0;
      const location = response.headers.location;

      if (statusCode >= 300 && statusCode < 400 && location) {
        response.resume();

        if (isReleaseOverride) {
          reject(new Error("Redirects are not allowed for LLMCHEF_RELEASE_URL overrides."));
          return;
        }

        downloadRelease(new URL(location, url).toString(), destinationPath, redirectCount + 1)
          .then(resolve)
          .catch(reject);
        return;
      }

      if (statusCode !== 200) {
        response.resume();
        reject(new Error(`Unexpected HTTP status ${statusCode} while downloading LLMChef release.`));
        return;
      }

      const file = fs.createWriteStream(destinationPath);
      file.on("error", reject);
      response.on("error", reject);
      file.on("finish", () => {
        file.close((error) => (error ? reject(error) : resolve()));
      });
      response.pipe(file);
    });

    request.on("error", reject);
  });
}

const decodeSafePathSegment = (segment) => {
  try {
    return decodeURIComponent(segment);
  } catch {
    return null;
  }
};

const resolveSafeAssetPath = (requestPath) => {
  const normalizedPath = path.posix.normalize(requestPath || "/");
  const pathSegments = normalizedPath
    .split("/")
    .filter(Boolean)
    .map(decodeSafePathSegment);

  if (
    pathSegments.some(
      (segment) =>
        !segment ||
        segment === "." ||
        segment === ".." ||
        segment.includes(path.sep) ||
        segment.includes("/") ||
        segment.includes("\\"),
    )
  ) {
    return null;
  }

  return pathSegments.reduce(
    (currentPath, segment) => `${currentPath}${path.sep}${segment}`,
    tempDir,
  );
};

const sendFile = (res, method, filePath) => {
  const extension = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[extension] || "application/octet-stream";

  res.writeHead(200, {
    "Content-Type": contentType,
    "X-Content-Type-Options": "nosniff",
  });

  if (method === "HEAD") {
    res.end();
    return;
  }

  fs.createReadStream(filePath)
    .on("error", (error) => {
      console.error("Error serving asset:", error);
      if (!res.headersSent) {
        res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
      }
      res.end("Internal Server Error");
    })
    .pipe(res);
};

// nosemgrep: problem-based-packs.insecure-transport.js-node.using-http-server.using-http-server -- local CLI launcher serves static files on localhost/explicit user host only; HTTPS is not practical for this offline bootstrap helper.
const createStaticServer = () =>
  // nosemgrep: problem-based-packs.insecure-transport.js-node.using-http-server.using-http-server -- local CLI launcher serves static files on localhost/explicit user host only; HTTPS is not practical for this offline bootstrap helper.
  http.createServer((req, res) => {
    const method = req.method || "GET";

    if (!SAFE_METHODS.has(method)) {
      res.writeHead(405, {
        Allow: Array.from(SAFE_METHODS).join(", "),
        "Content-Type": "text/plain; charset=utf-8",
      });
      res.end("Method Not Allowed");
      return;
    }

    if (method === "OPTIONS") {
      res.writeHead(204, { Allow: Array.from(SAFE_METHODS).join(", ") });
      res.end();
      return;
    }

    const requestUrl = new URL(req.url || "/", "http://localhost");
    const assetPath = resolveSafeAssetPath(requestUrl.pathname);
    const filePath = assetPath && fs.existsSync(assetPath) && fs.statSync(assetPath).isFile()
      ? assetPath
      : path.join(tempDir, "index.html");

    sendFile(res, method, filePath);
  });

// Parse command line arguments
const args = process.argv.slice(2);
const port = args[0] || 3000;
const hostAllInterfaces = args.includes("--host") || args.includes("-h");

// Create temp directory if it doesn't exist
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

console.log("Downloading LLMChef release...");
const zipPath = path.join(tempDir, "llmchef.zip");

downloadRelease(releaseUrl, zipPath)
  .then(() => {
    console.log("Download complete. Extracting...");

    const extractCommand = process.platform === "win32" ? "powershell" : "unzip";
    const extractArgs = process.platform === "win32"
      ? ["-NoProfile", "-Command", "Expand-Archive", "-Path", zipPath, "-DestinationPath", tempDir, "-Force"]
      : ["-o", zipPath, "-d", tempDir];

    execFile(extractCommand, extractArgs, (error) => {
      if (error) {
        console.error("Error extracting files:", error);
        return;
      }

      console.log("Extraction complete.");
      fs.unlinkSync(zipPath);

      const host = hostAllInterfaces ? "0.0.0.0" : "localhost";
      const server = createStaticServer();
      server.listen(port, host, () => {
        const accessUrl = hostAllInterfaces
          ? `http://${os.hostname()}:${port} (accessible from other devices)`
          : `http://localhost:${port} (local access only)`;

        console.log(`LLMChef is running at ${accessUrl}`);
      });
    });
  })
  .catch((err) => {
    if (fs.existsSync(zipPath)) {
      fs.unlinkSync(zipPath);
    }
    console.error("Error downloading LLMChef:", err);
  });
