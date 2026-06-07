# Full App Evaluation - 2026-06-07

Issue: #26, BL-008: Full app functionality test and evaluation pass.

## Purpose and scope

This record captures the practical full-application evaluation requested for BL-008. The pass covered the major workflows that were practical in the available runner and in PR CI: project checks, unit coverage, build output, linting, architecture fitness, release verification, budget checks, dependency audit, agentic runner adoption tests, automated E2E coverage, release archive generation, and review of the functional areas called out by the issue.

The evaluation did not identify a reproducible product-code regression in the available environment. This document is the evaluation artifact requested by the maintainer repair instruction.

## Environment and limitations

- Date: 2026-06-07.
- Branch: codex/issue-26.
- Repository: wan0net/llmchef.
- Local authoritative runtime: Node 20 through `npx -y -p node@20 -c ...`, matching the repository workflow runtime.
- PR CI evidence: PR #28 Quality run `27089998896` and Security run `27089998893`.
- Browser smoke nuance: an earlier Developer runner could not launch Chromium because `libatk-1.0.so.0` was missing, but PR #28 Quality's hosted Ubuntu `lint, test, build` job completed successfully after `npx playwright install --with-deps chromium`, including `npm run test:e2e`.
- No manual visual/browser inspection is claimed beyond automated E2E evidence.
- `tests/test_sync_github_kanban_issues.py` could not run in the available environment because the external Python dependency `hermes_cli` was missing.
- Environment note: a non-authoritative local Node 26 attempt failed during `npm test -- --run` with Vitest reporting `localStorage is not available`; CI and local Node 20 evidence are authoritative for this record because the repository workflow uses Node 20.

## Command evidence

| Evidence source | Command / check | Result | Evidence / notes |
| --- | --- | --- | --- |
| Local Node 20, `npx -y -p node@20 -c ...` | `npm run version:check` | Pass | Version check completed on 2026-06-07. |
| Local Node 20, `npx -y -p node@20 -c ...` | `npm run lint` | Pass | Lint completed on 2026-06-07. |
| Local Node 20, `npx -y -p node@20 -c ...` | `npm run lint:all` | Pass | Full lint suite completed on 2026-06-07. |
| Local Node 20, `npx -y -p node@20 -c ...` | `npm run fitness:architecture` | Pass | Architecture fitness checks completed on 2026-06-07. |
| Local Node 20, `npx -y -p node@20 -c ...` | `npm test -- --run` | Pass | 33 files, 125 tests passed on 2026-06-07. |
| Local Node 20, `npx -y -p node@20 -c ...` | `npm audit --audit-level=moderate` | Pass | 0 vulnerabilities on 2026-06-07. |
| Local Node 20, `npx -y -p node@20 -c ...` | `npm run release:local` | Pass | Created `public/release/latest.zip` and versioned ZIP; archive size was 11M. |
| Local Node 20, `npx -y -p node@20 -c ...` | `npm run build:pages` | Pass | Pages build completed on 2026-06-07. |
| Local Node 20, `npx -y -p node@20 -c ...` | `npm run release:verify` | Pass | Release verification completed on 2026-06-07. |
| Local Node 20, `npx -y -p node@20 -c ...` | `npm run budget` | Pass | Budget checks completed on 2026-06-07. |
| Local Python | `python3 -m unittest tests/test_adopt_agentic_runners.py` | Pass | 3 tests passed on 2026-06-07. |
| Local artifact check | `public/release/latest.zip` | Pass | File exists and was 11M after `npm run release:local`. |
| PR #28 Quality CI, run `27089998896` | `lint, test, build` | Pass | Hosted Ubuntu job succeeded after `npx playwright install --with-deps chromium`; includes `npm run test:e2e`. |
| PR #28 Quality CI, run `27089998896` | Runner smoke: linux, macos, windows | Pass | All runner smoke jobs succeeded. |
| PR #28 Security CI, run `27089998893` | Semgrep and Trivy | Pass | Security jobs succeeded. |
| PR #28 security review agent | Review findings | Pass | Later review reported no findings and safe to merge. |
| Earlier Developer runner limitation | Chromium browser launch | Blocked in that runner only | Chromium could not launch because `libatk-1.0.so.0` was missing; PR CI automated E2E is the successful browser-smoke evidence. |
| Local Python dependency check | `tests/test_sync_github_kanban_issues.py` | Blocked | Missing external dependency `hermes_cli`; this test was not separately run. |

## Functional areas evaluated

- Major workflows: covered by local Node 20 unit tests, Pages build, lint, architecture fitness, release verification, and PR CI automated E2E.
- Settings and providers: covered through the existing automated test suite and build/lint validation.
- Rendering and runnable blocks: covered by automated tests, build validation, and PR #28 automated E2E on hosted Ubuntu.
- Tools and agentic runners: `tests/test_adopt_agentic_runners.py` passed with 3 tests.
- Persistence and sync: covered by available automated checks; GitHub kanban sync-specific Python test was blocked by missing `hermes_cli`.
- Import/export and release paths: `npm run release:local` created `public/release/latest.zip` and a versioned ZIP; release verification, Pages build, and budget checks passed.
- Dependency and project health: `npm audit --audit-level=moderate` reported 0 vulnerabilities, and PR #28 Semgrep/Trivy security jobs passed.

## Findings and follow-ups

- No product-code regression was reproducible in the authoritative local Node 20 run or PR #28 CI evidence.
- Automated browser smoke is supported by PR #28 Quality CI. The earlier local Developer runner Chromium failure remains an environment limitation for that runner, not a product-code blocker.
- Follow-up: run `tests/test_sync_github_kanban_issues.py` in an environment with `hermes_cli` installed or otherwise available on the test path.
- Follow-up: attach manual browser UI notes only if maintainers require visual confirmation beyond automated E2E evidence.

## Conclusion

BL-008 evaluation evidence is recorded here. The authoritative local Node 20 verification passed the listed project, test, lint, release, audit, and budget checks; `public/release/latest.zip` exists and was 11M; and PR #28 CI passed Quality, runner smoke, Semgrep, and Trivy jobs. The only remaining blocked item recorded here is `tests/test_sync_github_kanban_issues.py`, which still needs `hermes_cli`. No product-code regression was reproduced during this pass.
