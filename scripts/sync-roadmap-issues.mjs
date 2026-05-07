#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const roadmapPath = path.join(projectRoot, "docs", "kanban-roadmap.md");
const canonicalBody = "Canonical backlog ticket synced from docs/kanban-roadmap.md.";

function gh(args) {
  return execFileSync("gh", args, {
    cwd: projectRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function parseRoadmap(markdown, { includeDone = false } = {}) {
  const lines = markdown.split(/\r?\n/);
  const tickets = [];
  let section = null;

  for (const line of lines) {
    if (line.startsWith("### Done")) {
      section = "done";
      continue;
    }
    if (line.startsWith("### Backlog")) {
      section = "backlog";
      continue;
    }
    if (line.startsWith("### ")) {
      section = null;
      continue;
    }
    if (!section) {
      continue;
    }

    const match = /^-\s+([A-Z]{2}-\d+)\s*(?::|-)\s*(.+?)\s+\(GH:\s+#(\d+)\)$/.exec(line);
    if (!match) {
      continue;
    }

    const [, ticketId, title, issueNumber] = match;
    if (section === "done" && !includeDone) {
      continue;
    }
    tickets.push({
      ticketId,
      title,
      issueNumber: Number(issueNumber),
      section,
    });
  }

  return tickets;
}

function expectedLane(ticketId) {
  if (ticketId.startsWith("KF-")) return "lane:release";
  if (ticketId.startsWith("AC-")) return "lane:architecture";
  return "lane:backlog";
}

function defaultPriority(ticketId) {
  if (ticketId.startsWith("KF-")) return "priority:P1";
  if (ticketId.startsWith("AC-")) return "priority:P2";
  return "priority:P3";
}

function expectedState(section) {
  return section === "done" ? "CLOSED" : "OPEN";
}

function getIssue(issueNumber) {
  const raw = gh([
    "issue",
    "view",
    String(issueNumber),
    "--json",
    "number,title,body,state,labels,url",
  ]);
  return JSON.parse(raw);
}

function normalizeBody(body) {
  return (body ?? "").trim();
}

function syncTicket(ticket, write) {
  const issue = getIssue(ticket.issueNumber);
  const labels = issue.labels.map((label) => label.name);
  const lane = expectedLane(ticket.ticketId);
  const priority = labels.find((label) => /^priority:/.test(label)) ?? defaultPriority(ticket.ticketId);
  const desiredLabels = Array.from(new Set([lane, priority]));
  const nextLabels = Array.from(new Set([
    ...labels.filter((label) => !label.startsWith("lane:") && !label.startsWith("priority:")),
    ...desiredLabels,
  ])).sort();
  const changes = [];

  const desiredTitle = `${ticket.ticketId}: ${ticket.title}`;
  if (issue.title !== desiredTitle) {
    changes.push(`title: ${JSON.stringify(issue.title)} -> ${JSON.stringify(desiredTitle)}`);
  }

  const body = normalizeBody(issue.body);
  const desiredBody = body.length === 0 ? canonicalBody : body;
  if (body !== desiredBody) {
    changes.push(`body: ${JSON.stringify(body)} -> ${JSON.stringify(desiredBody)}`);
  }

  const missingLabels = nextLabels.filter((label) => !labels.includes(label));
  const extraManagedLabels = labels.filter(
    (label) => (label.startsWith("lane:") || label.startsWith("priority:")) && !nextLabels.includes(label)
  );
  if (missingLabels.length > 0 || extraManagedLabels.length > 0) {
    changes.push(`labels: ${JSON.stringify(labels.slice().sort())} -> ${JSON.stringify(nextLabels)}`);
  }

  const desiredState = expectedState(ticket.section);
  if (issue.state !== desiredState) {
    changes.push(`state: ${issue.state} -> ${desiredState}`);
  }

  if (!write || changes.length === 0) {
    return { issue, changes, desiredLabels, desiredState, wrote: false };
  }

  gh([
    "issue",
    "edit",
    String(ticket.issueNumber),
    "--title",
    desiredTitle,
    "--body",
    desiredBody,
    "--add-label",
    desiredLabels.join(","),
  ]);

  for (const label of extraManagedLabels) {
    gh(["issue", "edit", String(ticket.issueNumber), "--remove-label", label]);
  }

  const refreshed = getIssue(ticket.issueNumber);
  if (desiredState === "CLOSED" && refreshed.state !== "CLOSED") {
    gh(["issue", "close", String(ticket.issueNumber)]);
  }
  if (desiredState === "OPEN" && refreshed.state !== "OPEN") {
    gh(["issue", "reopen", String(ticket.issueNumber)]);
  }

  return { issue, changes, desiredLabels, desiredState, wrote: true };
}

const write = process.argv.includes("--write");
const includeDone = process.argv.includes("--include-done");
const tickets = parseRoadmap(readFileSync(roadmapPath, "utf8"), { includeDone });

if (tickets.length === 0) {
  throw new Error(`No roadmap tickets found in ${roadmapPath}`);
}

const results = tickets.map((ticket) => syncTicket(ticket, write));
const changed = results.filter((result) => result.changes.length > 0);

console.log(
  `${write ? "Roadmap issue sync applied" : "Roadmap issue sync dry run"} for ${results.length} ${includeDone ? "roadmap" : "backlog"} tickets.`
);

if (changed.length === 0) {
  console.log("All roadmap-linked issues already match the roadmap.");
  process.exit(0);
}

for (const result of changed) {
  console.log(`- #${result.issue.number} ${result.issue.title}`);
  for (const change of result.changes) {
    console.log(`  - ${change}`);
  }
}

if (!write) {
  console.log("Re-run with --write to apply changes.");
}
