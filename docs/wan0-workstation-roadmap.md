# wan0 LiteChat Workstation Roadmap

This fork turns LiteChat into a browser-local agent workstation for projects,
repos, skills, generated files, and crea8-backed knowledge.

## Principles

- Projects are the center: chats, VFS, skills, previews, repo sync, and wiki
  context hang from a project.
- Browser-local first: everything useful should work from static Pages with
  IndexedDB, VFS, Git-in-browser, and user-granted File System Access.
- Optional bridges second: local helpers may improve Git, filesystem, and MCP,
  but the app must remain useful without them.
- Secure by default: generated code, imported skills, repo content, and previews
  must be treated as untrusted.
- Link42/crea8 aligned: visual language, density, typography, and information
  architecture should fit the broader stack.

## Feature A: Skills

Status: in progress

Goal: Add first-class skills that can be created, saved, imported from repos,
installed, versioned, and used by chats/agents/workflows.

Scope:

- Define a `Skill` domain model with id, slug, name, description, version,
  author, source, tags, manifest, files, install state, timestamps, and risk
  metadata. (implemented)
- Add local skill persistence in IndexedDB. (implemented)
- Add skill manager UI for create, edit, duplicate, delete, import, export, and
  install. (create, delete, import, export, and install implemented)
- Support importing skill packages from VFS folders.
- Support importing skill packages from Git repos cloned into VFS.
- Define package format:
  - `.litechat/skills/<slug>/skill.json`
  - `README.md`
  - optional `prompts/`, `agents/`, `workflows/`, `rules/`, `tools/`, `examples/`
- Install skill assets into existing LiteChat primitives where possible:
  prompt templates, agents, workflows, rules, tools, and VFS examples.
- Add safety review before installation for tools, runnable blocks, mods, or
  prompt instructions that request broad authority.

Acceptance:

- A user can create a skill locally.
- A user can export and re-import the same skill without data loss.
- A user can import a repo-hosted skill package from VFS.
- Installed skills are visible and usable from prompt/agent workflows.

## Feature B: Console Workbench UI

Status: in progress

Goal: Add a console/workbench shell inspired by Claude Code while staying aligned
with link42/crea8.

Scope:

- Add a selectable `classic` vs `console` interface mode.
- Console layout:
  - left rail: projects, chats, repos, skills, wiki pages
  - center: transcript and command surface
  - bottom: compact prompt composer
  - right rail: file preview, tool output, VFS, metadata
- Add command palette affordances for project, file, skill, wiki, and chat
  actions.
- Keep controls keyboard-first and dense without sacrificing readability.

Acceptance:

- Users can switch to console mode and back.
- Console mode preserves existing chat, project, model, VFS, and settings
  behavior.
- The layout handles desktop and narrow viewports without overlapping controls.

## Feature C: Generated File Previewer

Status: done

Goal: Preview generated or VFS files inside LiteChat safely.

Scope:

- Add VFS file preview panel/modal. (implemented)
- Add preview type detection and sandbox policy helpers. (implemented)
- Preview types:
  - HTML in sandboxed iframe (implemented)
  - Markdown rendered preview (implemented as safe text preview)
  - JSON tree/text preview (implemented as formatted text preview)
  - images, SVG as image when safe, audio, video (implemented)
  - code/text with syntax highlighting (implemented as safe text preview)
- Add "open preview" action from VFS rows and generated code blocks. (implemented)
- Add "save generated block to VFS and preview" workflow. (implemented)

Security:

- HTML previews use sandboxed iframes.
- No same-origin access for untrusted previews.
- Blob URLs are revoked when closed.

Acceptance:

- Selecting an HTML file in VFS can show a live preview.
- Markdown, JSON, images, and code preview correctly.
- Previewing untrusted HTML cannot access LiteChat app state.

## Feature D: Link42 / crea8 Theme And UI Refactor

Status: planned

Goal: Refactor LiteChat visuals and layout toward the broader link42/crea8 stack.

Scope:

- Audit existing LiteChat theme tokens and components.
- Introduce a token layer compatible with link42/crea8:
  neutral base, restrained accents, dense operator surfaces, clear borders,
  high legibility, and project-first information hierarchy.
- Reduce one-off styling in feature components.
- Add `wan0-console` theme variant.
- Keep existing themes working during migration.

Acceptance:

- Theme settings include the new wan0 console/workbench look.
- Core surfaces use shared tokens rather than local one-offs.
- Build remains static and theme choice persists locally.

## Feature E: crea8 Wiki Interface

Status: in progress

Goal: Integrate crea8 as the persistent wiki/knowledge surface for LiteChat
projects.

Memory principle: crea8 notes are the durable memory source of truth. LiteChat
should not maintain invisible long-term AI memory. AI-learned durable facts
become proposed crea8 note updates; user edits to crea8 notes override future AI
behavior.

Scope:

- Study local crea8 data model, editor, persistence, and deployment API.
- Add a crea8 connector configuration:
  local/static mode first, API mode second.
- Map LiteChat projects to crea8 spaces/collections.
- Browse/search crea8 pages from LiteChat.
- Attach crea8 pages to prompts.
- Generate or update crea8 pages from chat outputs and VFS files.
- Add memory proposal flow:
  AI proposes a durable memory update, user accepts/edits/rejects, accepted
  content writes to crea8.
- Add prompt context retrieval from selected crea8 notes with prompt-injection
  boundaries.
- Add workflows:
  - summarize chat into project page
  - publish generated docs to crea8
  - extract decisions/actions into wiki pages

Acceptance:

- A project can link to a crea8 space.
- A user can browse and attach wiki pages to a prompt.
- A user can publish a markdown summary from a chat to crea8.
- Durable AI memory is visible as crea8 notes, not hidden app state.

## Feature F: Security Audit And Dependency Upgrade

Status: planned

Goal: Audit the fork before it becomes a self-modifying, repo-importing,
code-previewing workstation.

Scope:

- Run dependency audit and document findings.
- Upgrade libraries conservatively.
- Review code execution surfaces:
  runnable JS/Python blocks, HTML previews, mods, MCP tools, imported skills,
  Git/VFS sync, API keys, and IndexedDB persistence.
- Add threat model for:
  untrusted skill packages, malicious repos, prompt injection through files/wiki,
  token exfiltration, service worker persistence, and unsafe previews.
- Add guardrails:
  manifest permissions for skills
  import/install review
  sandboxed previews
  blocked path defaults for real FS sync
  no automatic destructive sync
  explicit consent before tools/mods run privileged behavior
- Add tests for high-risk boundaries where practical.

Acceptance:

- `docs/security-audit.md` exists with findings, risk ratings, and remediation
  status.
- Known high-severity dependency issues are upgraded or documented with rationale.
- New skill/import/preview features have explicit safety boundaries.

## Implementation Order

1. Security baseline: audit current repo and document known risks.
2. Roadmap scaffolding: add skill and preview domain docs/types without UI churn.
3. Local skills: persistence, create/edit/delete, import/export package.
4. VFS previewer: safe preview panel for common generated file types.
5. Console workbench shell: interface mode and layout.
6. Link42/crea8 theme refactor: tokens and wan0 console theme.
7. Skill repo import: clone/scan/install flow.
8. crea8 memory foundation: note/proposal types and prompt-context contract.
9. crea8 read connector: browse/search/attach wiki pages.
10. crea8 write workflows: accept memory proposals and publish summaries/docs.
11. Full security pass: dependency upgrades, threat-model closure, final hardening.

## Working Notes

- Keep each feature commit-sized and deployable.
- Use existing LiteChat stores, services, control modules, VFS, Git, prompt
  templates, agents, workflows, and marketplace concepts before adding new
  systems.
- Do not enable auto-running imported code, tools, mods, or previews.
- Keep GitHub Pages deploy working at `/litechat/`.
