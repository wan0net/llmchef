import { expect, test } from "@playwright/test";

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

test("release bundle endpoint is available from the hosted app", async ({ request }) => {
  const response = await request.get("/release/latest.zip");

  expect(response.ok()).toBe(true);
  expect(response.headers()["content-type"] ?? "").toContain("zip");
});
