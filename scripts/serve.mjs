import { spawnSync } from "node:child_process";

const port = process.env.LLMCHEF_PORT ?? "5173";

const build = spawnSync("npm", ["run", "build"], {
  stdio: "inherit",
  shell: true,
});
if (build.status !== 0) {
  process.exit(build.status ?? 1);
}

const server = spawnSync(
  "npx",
  ["http-server", "dist", "--port", port],
  {
    stdio: "inherit",
    shell: true,
  }
);
process.exit(server.status ?? 0);
