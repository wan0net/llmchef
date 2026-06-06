## Summary

<!-- What changed and why? -->

## Decision Packet

**Decision:** <!-- proceed / hold / needs human input -->

**Evidence:** <!-- tests, checks, staging URLs, reviewed files -->

**Risks:** <!-- known gaps, assumptions, blast radius -->

**Next Action:** <!-- specific next step and owner -->

## Verification

- [ ] Relevant tests pass
- [ ] Security-sensitive changes reviewed
- [ ] Staging decision recorded when `deploy:staging` is used
- [ ] No secrets, credentials, or unapproved production changes included

## Public Repo Security Signoff

- [ ] Contributor/maintainer gating remains enforced for issue/PR/comment triggers
- [ ] Fork PR self-hosted review isolation remains enforced (`head.repo.full_name == github.repository`)
- [ ] Repair requeue remains bounded to same-issue/same-PR proof and prompt-hash binding
- [ ] Comment/log outputs reviewed for secret/private-data leakage risk
