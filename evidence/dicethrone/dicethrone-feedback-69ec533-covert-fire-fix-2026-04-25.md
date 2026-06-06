# DiceThrone 反馈修复证据：69ec533b9087da2a55c914ea

> 2026-06-06 当前有效口径：本文只对应反馈 `69ec533b9087da2a55c914ea` 这一条月精灵 `隐秘射击` 条件修复证据，不是当前 DiceThrone 所有月精灵技能条件、所有规则录入口径或新英雄补审的完成证明。阅读时只能把它当作单条反馈修复记录。

- 反馈内容：月精灵骰出“隐秘射击”无法发动。
- 修复结论：`covert-fire` 触发条件从 `3 Bow + 3 Moon` 修正为 `3 Bow + 2 Moon`。

## 代码变更

- `src/games/dicethrone/heroes/moon_elf/abilities.ts`
- `e2e/src/games/dicethrone/heroes/moon_elf/abilities.ts`
- `src/games/dicethrone/__tests__/moon-elf-abilities.test.ts`
- `src/games/dicethrone/__tests__/fixtures/wikiSnapshots.ts`
- `public/locales/zh-CN/game-dicethrone.json`
- `public/locales/en/game-dicethrone.json`

## 验证命令

- `node scripts/infra/vitest-cli-safe.mjs run src/games/dicethrone/__tests__/moon-elf-abilities.test.ts --configLoader native`
- `node scripts/infra/vitest-cli-safe.mjs run src/games/dicethrone/__tests__/audit-wiki-comparison.property.test.ts --config vitest.config.audit.ts --configLoader native`

## 验证结果

- `moon-elf-abilities.test.ts`：35/35 通过。
- `audit-wiki-comparison.property.test.ts`：9/9 通过。
- 线上反馈状态已回写为 `resolved`（2026-04-25）。

---

**当前阅读说明**：本文只能证明 `covert-fire` 触发条件这条专项问题曾被修复并回写反馈，不能外推为当前所有月精灵条件判定、所有 wiki 对照结果或 DiceThrone 当前整体审计都已收口。
