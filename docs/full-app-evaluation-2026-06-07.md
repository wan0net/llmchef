# Full App Evaluation - 2026-06-07

Issue: #26, BL-008: Full app functionality test and evaluation pass.

## Purpose and scope

This record captures the practical full-application evaluation requested for BL-008. The pass covered the major workflows that were practical in the available runner: project checks, unit coverage, build output, linting, architecture fitness, release verification, budget checks, dependency audit, agentic runner adoption tests, E2E web server setup, release archive generation, and review of the functional areas called out by the issue.

The evaluation did not identify a reproducible product-code regression in the available environment. This document is the evaluation artifact requested by the maintainer repair instruction.

## Environment and limitations

- Date: 2026-06-07.
- Branch: codex/issue-26.
- Repository: wan0net/llmchef.
- Browser UI smoke coverage was limited by the runner environment: Chromium could not launch because the shared library `libatk-1.0.so.0` was missing. Do not treat browser smoke tests as fully passed.
- The E2E webServer and release setup path still completed far enough to generate `public/release/latest.zip`.
- `tests/test_sync_github_kanban_issues.py` could not run in the available environment because the external Python dependency `hermes_cli` was missing.

## Command evidence

| Command | Result | Evidence / notes |
| --- | --- | --- |
| `npm test -- --run` | Pass | 33 files, 125 tests passed. |
| `npm run build` | Pass | Application build completed. |
| `npm run lint:all` | Pass | Lint checks completed. |
| `npm run fitness:architecture` | Pass | Architecture fitness checks completed. |
| `npm run release:verify` | Pass | Release verification completed. |
| `npm run budget` | Pass | Budget checks completed. |
| `npm audit --audit-level=moderate` | Pass | Audit completed at moderate threshold. |
| `python3 -m unittest tests/test_adopt_agentic_runners.py` | Pass | 3 tests passed. |
| `npm run test:e2e` | Blocked / partial | Playwright browser launch was blocked by missing `libatk-1.0.so.0`; webServer/release setup still completed and generated `public/release/latest.zip`. |
| `tests/test_sync_github_kanban_issues.py` | Blocked | Missing external dependency `hermes_cli`. |

## Functional areas evaluated

- Major workflows: covered by unit tests, build, lint, architecture fitness, and E2E setup where the environment allowed.
- Settings and providers: covered through the existing automated test suite and build/lint validation.
- Rendering and runnable blocks: covered by automated tests and build validation; browser smoke execution remained blocked by the Chromium shared-library issue.
- Tools and agentic runners: `tests/test_adopt_agentic_runners.py` passed with 3 tests.
- Persistence and sync: covered by available automated checks; GitHub kanban sync-specific Python test was blocked by missing `hermes_cli`.
- Import/export and release paths: release verification passed, E2E setup generated `public/release/latest.zip`, and the build completed.
- Dependency and project health: budget checks and `npm audit --audit-level=moderate` passed.

## Findings and follow-ups

- No product-code regression was reproducible in the available environment.
- Follow-up: run Playwright browser smoke tests in an environment with Chromium's required shared libraries installed, including `libatk-1.0.so.0`.
- Follow-up: run `tests/test_sync_github_kanban_issues.py` in an environment with `hermes_cli` installed or otherwise available on the test path.
- Follow-up: attach any manual browser UI notes from a fully provisioned desktop or CI image if maintainers require visual confirmation beyond the automated setup evidence.

## Conclusion

BL-008 evaluation evidence is recorded here. All available non-browser checks listed above passed, the release path generated `public/release/latest.zip`, and the only known blockers were environment dependencies for Chromium browser launch and `hermes_cli`. No product-code regression was reproduced during this pass.
