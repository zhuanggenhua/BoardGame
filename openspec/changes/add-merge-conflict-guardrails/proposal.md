# Change: 增加合并冲突守卫门禁

## Why
近期出现合并/暂存导致单边覆盖的回归（Undo AI 撤回回退），说明仅靠人工规范不足以阻断风险，需要在质量门禁中加入自动化审计与证据校验。

## What Changes
- 质量门禁对 push 范围内的 merge commit 执行 `merge:audit:strict`，发现单边覆盖立即失败。
- 对存在潜在冲突（两侧都改动同一文件）的 merge commit，强制要求提交 `evidence/merge-conflict-*.md` 冲突汇报。

## Impact
- Affected code: `scripts/infra/run-changed-quality-gate.mjs`
- Related tool: `scripts/verify/merge-conflict-audit.mjs`（复用，不改行为）
- Docs: `docs/git-merge-checklist.md` 已有规范，门禁将把其自动化执行
