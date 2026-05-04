import { expect, type Page, test } from "@playwright/test";
import path from "node:path";

const bootApp = async (page: Page) => {
  await page.goto("/#app");
  await expect(page.getByLabel("Chat input")).toBeVisible({ timeout: 20_000 });
};

const createProject = async (page: Page, name: string) => {
  await page.locator('button[aria-label="New Project"]:visible').click();
  const editInput = page.locator("li input").first();
  await expect(editInput).toBeVisible();
  await editInput.fill(name);
  await editInput.press("Enter");
  await expect(page.locator("li input")).toHaveCount(0);
  await expect(page.getByText(name, { exact: true })).toBeVisible();
};

const expandProject = async (page: Page, name: string) => {
  await page.getByText(name, { exact: true }).click();
  await expect(page.getByRole("button", { name: `Chats for ${name}` })).toBeVisible();
  await expect(page.getByRole("button", { name: `Wiki for ${name}` })).toBeVisible();
  await expect(page.getByRole("button", { name: `Files for ${name}` })).toBeVisible();
  await expect(page.getByRole("button", { name: `Git for ${name}` })).toBeVisible();
};

test("landing page exposes the local-first app and bundle paths", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveTitle(/LLMChef/);
  await expect(page.getByRole("heading", { name: /Chat with your LLM/i })).toBeVisible();
  await expect(page.getByText("All processing within your control.")).toBeVisible();
  await expect(page.getByRole("link", { name: /Open App/i }).first()).toHaveAttribute("href", "/#app");
  await expect(page.getByRole("link", { name: /Download Local Bundle/i })).toHaveAttribute(
    "href",
    "/release/latest.zip",
  );
});

test("app route boots the chat shell without console errors", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  await page.goto("/#app");

  await expect(page.getByLabel("Chat input")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByLabel("New Chat").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Send message" })).toBeVisible();
  expect(consoleErrors.filter((message) => !message.includes("PWA service initialization failed"))).toEqual([]);
});

test("project sidebar sections replace the old workspace selector", async ({ page }) => {
  const projectName = `E2E Project ${Date.now()}`;
  await bootApp(page);

  await expect(page.getByRole("button", { name: "Chats and projects" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Documents" })).toHaveCount(0);

  await createProject(page, projectName);
  await expandProject(page, projectName);

  await page.getByRole("button", { name: `Wiki for ${projectName}` }).click();
  await expect(page.getByRole("heading", { name: "Documents" })).toBeVisible();
  await expect(
    page.getByText(`${projectName} files and wiki pages, grounded through chat`),
  ).toBeVisible();
  await expect(page.locator("h1", { hasText: projectName })).toBeVisible();
  await expect(page.getByText("This is the human-facing home for the project knowledge base.")).toBeVisible();
  await expect(page.getByText("Backlinks", { exact: true })).toBeVisible();
  await expect(page.getByText("Related", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Chat input")).not.toBeVisible();

  await page
    .locator(".link42-panel")
    .getByRole("button", { name: "Page" })
    .click();
  await expect(page.getByRole("heading", { name: `${projectName} note` })).toBeVisible();

  page.once("dialog", async (dialog) => {
    await dialog.accept(`${projectName} architecture`);
  });
  await page
    .locator(".link42-panel")
    .getByRole("button", { name: "Diagram" })
    .click();
  await expect(page.getByRole("heading", { name: /architecture.*\.mmd/i })).toBeVisible();
  await expect(page.getByLabel(/Mermaid source/)).toBeVisible();
  await expect(page.getByText("Diagram preview")).toBeVisible();

  await page.getByRole("button", { name: `Chats for ${projectName}` }).click();
  await expect(page.getByLabel("Chat input")).toBeVisible();

  await page.getByRole("button", { name: `Files for ${projectName}` }).click();
  const filesDialog = page.getByRole("dialog");
  await expect(filesDialog).toBeVisible();
  await expect(page.getByRole("heading", { name: "Virtual Filesystem" })).toBeVisible();
  await filesDialog.locator('button:has-text("Close")').first().click();
  await expect(page.getByRole("dialog")).toHaveCount(0);

  await page.getByRole("button", { name: `Git for ${projectName}` }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: `Project Settings: ${projectName}` }),
  ).toBeVisible();
  await expect(page.getByRole("tab", { name: "Sync" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
});

test("LLMChef can be used as its own project workspace", async ({ page }) => {
  const projectName = `LLMChef Self ${Date.now()}`;
  const repoRoot = process.cwd();
  await bootApp(page);

  await createProject(page, projectName);
  await expandProject(page, projectName);
  await page.getByRole("button", { name: `Wiki for ${projectName}` }).click();
  await expect(page.getByRole("heading", { name: "Documents" })).toBeVisible();

  await page.locator('input[type="file"]').first().setInputFiles([
    path.join(repoRoot, "package.json"),
    path.join(repoRoot, "system-prompt.txt"),
    path.join(repoRoot, "src/lib/llmchef/project-document-search.ts"),
  ]);

  await expect(page.getByText("package.json", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("system-prompt.txt", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("project-document-search.ts", { exact: true }).first()).toBeVisible();

  await page.getByText("project-document-search.ts", { exact: true }).first().click();
  await expect(page.getByRole("heading", { name: "project-document-search.ts" })).toBeVisible();
  await page.getByRole("button", { name: "Tag for chat" }).click();
  await expect(page.getByText("Tagged for chat")).toBeVisible();
  await page.getByRole("button", { name: "Attach to chat" }).click();

  await expect(page.getByLabel("Chat input")).toBeVisible();
  await expect(page.getByText(/Attached \d+ passage/)).toBeVisible();
});

test("mobile project drawer uses the same single-pane sections", async ({ page }) => {
  const projectName = `Mobile Project ${Date.now()}`;
  await page.setViewportSize({ width: 390, height: 844 });
  await bootApp(page);

  await page.getByLabel("Open menu").click();
  await expect(page.getByRole("button", { name: "Documents" })).toHaveCount(0);
  await createProject(page, projectName);

  await expandProject(page, projectName);
});

test("composer queue controls are available in the chat shell", async ({ page }) => {
  await page.goto("/#app");

  const input = page.getByLabel("Chat input");
  await expect(input).toBeVisible({ timeout: 20_000 });
  await input.fill("Queue this prompt for later");

  await expect(page.getByLabel("Add prompt to queue")).toBeVisible();
  await expect(page.getByLabel("Send message")).toBeVisible();
});

test("settings modal exposes advanced controls", async ({ page }) => {
  await page.goto("/#app");

  await expect(page.getByLabel("Chat input")).toBeVisible({ timeout: 20_000 });
  await page.getByLabel("Open Settings").click();

  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "General" })).toBeVisible();
  await expect(page.getByText("Advanced Settings")).toBeVisible();
});

test("network ledger settings tab opens without a render loop", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  await page.goto("/#app");

  await expect(page.getByLabel("Chat input")).toBeVisible({ timeout: 20_000 });
  await page.getByLabel("Open Settings").click();
  await page.getByRole("tab", { name: "Network" }).click();

  await expect(page.getByRole("heading", { name: "Network Ledger" })).toBeVisible();
  await expect(page.getByText("Configured Network Surfaces")).toBeVisible();
  expect(consoleErrors.filter((message) => !message.includes("PWA service initialization failed"))).toEqual([]);
});

test("release bundle endpoint is available from the hosted app", async ({ request }) => {
  const response = await request.get("/release/latest.zip");

  expect(response.ok()).toBe(true);
  expect(response.headers()["content-type"] ?? "").toContain("zip");
});
