import { spawnSync } from "node:child_process";

const origin = process.env.LLMCHEF_ORIGIN ?? "origin";
const branch = process.env.LLMCHEF_BRANCH ?? "main";

const pull = spawnSync("git", ["pull", origin, branch], {
  stdio: "inherit",
  shell: true,
});
if (pull.status !== 0) {
  process.exit(pull.status ?? 1);
}

const install = spawnSync("npm", ["install"], {
  stdio: "inherit",
  shell: true,
});
if (install.status !== 0) {
  process.exit(install.status ?? 1);
}

const serve = spawnSync("npm", ["run", "serve"], {
  stdio: "inherit",
  shell: true,
});
process.exit(serve.status ?? 0);
