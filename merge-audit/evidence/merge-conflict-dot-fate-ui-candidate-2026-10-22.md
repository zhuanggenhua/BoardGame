# Merge conflict record: Fate UI candidate (2026-10-22)

## Merge inputs

- Target snapshot: `main` at `1bd95e0260bd2faee79eebed4d8d8dede931f685`
- Candidate: `dot/fate-ui-candidate-20261022` at `b8f5d84eacbef19e6e6bc1b6be5330b07dc5b053`
- Common ancestor: `6cf1a9178b00567e3d58c46ef17209b78016928c`
- Candidate has one commit beyond the common ancestor. Its tree was previously verified as 407 text/source paths added or modified, with no deletions or binary files.
- Merge is confined to this isolated clone. No push was performed; the user's D: checkout was not changed.

## Conflict decisions

1. `.spec/skills/show-image-to-user/SKILL.md`: retained the target branch's actual reviewer identity, per-image review, and behavioral-evidence ownership requirements. Added the candidate's independent pure-visual contract routing through the canonical `e2e-verification` standard.
2. `scripts/assets/apply-server-asset-publish.mjs`: unified the duplicated counters under initialized `publishedIndexObjectCount`; retained the existing `serverPrimaryIndexObjects=...` stdout contract.
3. `scripts/assets/apply-server-asset-publish.test.mjs`: retained both distinct success cases as separate tests: explicit project-root/OTA index refresh and incremental release preservation.
4. `scripts/verify/e2e-image-index-contract.test.mjs`: kept the candidate's pure-visual contract cases. The candidate already contains the target branch's two reviewer-authorization tests byte-for-byte (reviewer-test suffix SHA-256 `6be8bc45a737289595ddef9178d3720da37a66a840359c735fa49d2f7f6bb745`), so no target behavior was lost. The final blob therefore equals parent 2 and the strict mechanical audit flags this one file as single-side; this is an explained exception, not an unreviewed choice.
5. `src/components/game/framework/widgets/GameHUD.tsx`: kept the target branch's TicTacToe portrait offset and the candidate's Fate offset, alongside the existing Mage Wars offset.
6. `src/components/system/FabMenu.tsx`: retained shell-bounded `layoutBounds`/`layoutInsets` clamping and incorporated the candidate's `bottomClearance` behavior and callback dependency.
7. `src/lib/__tests__/evidenceScreenshots.test.ts`: retained the target branch's `rm` import for its cleanup test; the candidate's distinct-state evidence case remains in the merged file.

No conflict required discarding either branch's independent behavior. No product files outside the merged candidate/target history were read from or modified in the user's original checkout.

## Validation

Conflict markers were removed from all seven files and the three modified JavaScript files passed `node --check`. Full project tests and the formal Fate E2E are pending in this isolated clone.
