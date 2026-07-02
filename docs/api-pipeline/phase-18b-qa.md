# Phase 18b QA: late-arrival families (github, desktop-login, daily-rewards)

This is the QA gate for the Phase 18b migration (the twelve late-arrival routes ported onto
`server/github.ts`, `server/desktop_login.ts`, and `server/daily_rewards.ts`). It audits the
implementation diff for correctness, test coverage, and dead code, then runs the matching
domain reviewers, applies BLOCKING and SHOULD-FIX findings, and re-validates. It is sized to
stay well under 40% context because the diff is four bounded route tables plus one middleware
variant and the harness flips; the audit fans out across that surface rather than re-reading
the spine. Paste the block below into a fresh Claude Code session.

### QA Starter Prompt

````
This is the QA pass for Phase 18b of the API Pipeline re-architecture: Migrate the late-arrival families (github, desktop-login, daily-rewards).
Model: Opus 4.8, xhigh effort. Harness: Claude Code.
Goal: Verify Phase 18b ships every acceptance criterion parity-clean under the canonical PARITY-FIRST rule, apply BLOCKING + SHOULD-FIX findings (apply-all per the maintainer's standing rule: NICE-TO-HAVE too unless adjudicated), and re-validate.

STEP 0 - PRE-FLIGHT
- `git status` + `git log --oneline -10`. Confirm the 18b commits are present and the SHARED worktree is otherwise clean; if dirty with unrelated files, STOP and ask. Stage with EXPLICIT paths only.
- Scan memory for "Server API pipeline audit", the Phase 18b entry, "API-pipeline HEAD parity gotcha", and "Phase 17 admin" (auth-mounting sweep mandate) so locked decisions are not re-litigated.

STEP 1 - LOAD CONTEXT (spawn ONE Explore agent; do NOT read planning docs or source directly)
Have it read and summarize, anchored on symbol names and route strings:
- docs/api-pipeline/state.md + progress.md (confirm the 18b record: fork outcomes, deviations, harness flips, the Phase 19/22/24/25 handoffs).
- docs/api-pipeline/phase-18b-late-arrivals.md (extract STEP 5 ACCEPTANCE CRITERIA verbatim as this QA's checklist, plus the STEP 2 maintainer forks and their recorded outcomes).
- The 18b diff: server/github.ts, server/desktop_login.ts, server/daily_rewards.ts, server/http/middleware/require_internal_secret.ts, server/http/registry.ts, server/main.ts, tests/server/http/{known_deviations,completeness,ownership_coverage,parity}*.ts, the three new test files, and the characterization backfills. List every RouteDef, guard, deviation, and harness pin the diff actually introduces or flips.
Explore returns: the per-route contract as IMPLEMENTED (status + body per branch, both dispatch modes), the fork outcomes as shipped, the fail-closed gate variant's exact semantics, and which pins were flipped vs added.

STEP 2 - QA AUDIT (fan out in parallel, each agent given only the Explore summary + the diff for its surface)
- Correctness agent: verify EVERY acceptance criterion against the real diff (never the prose). Byte-parity on every db-free branch both modes; the fork outcome present on BOTH serving paths; the ops gate fail-closed 401/401 with per-request env read and no fallback; the composite ordering untouched; the fused limiter one bucket, limiter-before-auth; no withBody anywhere in the families; the github callback (and its escaping throw) HTML never problem+json; HEAD and off-table shapes still delegate; rollback arms intact under 'legacy'.
- Test-coverage agent: every branch of the twelve routes covered through the REAL chains (gate cases, validation branches, deviation pins, captureBothModes re-pins for every masked path, the auth-mounting sweep additions, the characterization backfills); flag fictions (fakes that bypass the real compose/withErrors stack).
- Dead-code / cleanup agent: no orphaned helpers, no duplicated secretsMatch beyond the adjudicated copies, imports tidy, no em/en dash or emoji in any added line (perl -CSD scan), no stray .only(/debugger.
- Domain reviewers (per `git diff --name-only`): privacy-security-review (the fork outcome esp. if the scope fix shipped, secret handling in the new gate variant, the shared limiter, github OAuth state, no PII/secret in any 4xx/5xx) and qa-checklist ALWAYS; migration-safety only if DDL/JSONB appears; cross-platform-sync/architecture-reviewer only if a matcher/wire/sim file was unexpectedly touched.
Prompt every agent: "If your output is truncated, resume from the last completed file rather than restarting; report findings with confidence + severity and do not pre-filter." Resume truncated reviewers via SendMessage.

STEP 3 - FIX
- Apply every BLOCKING and SHOULD-FIX (and NICE-TO-HAVE per apply-all unless adjudicated with rationale), test-first for behavior bugs.
- Re-run: tsc; the three new suites + the six harness suites + both characterization suites; full `npm test`; `npm run ci:changed`; `npm run build:server`; `npm run build`.
- Separate Conventional Commits with explicit paths, suite green at each commit.

STEP 4 - UPDATE DOCS + MEMORY
- progress.md + state.md: QA verdict, applied findings, surviving deferrals with owners (19/22/24/25).
- Memory: surprising rules confirmed (gate semantics, fork outcome, any new gotcha).

STEP 5 - PACKET TEARDOWN
Not the final phase; skip teardown.

STEP 6 - FINAL RESPONSE FORMAT
One verdict: PASS / PASS-WITH-FOLLOWUPS / FAIL, with counts (criteria verified/total; BLOCKING found/fixed; SHOULD-FIX found/fixed; NICE applied/deferred). Files touched (absolute paths), validation results. End with: "Next: Phase 19 implementation (docs/api-pipeline/phase-19-rate-limiter.md)."
````
