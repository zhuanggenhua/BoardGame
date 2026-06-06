## 1. Implementation
- [x] 1.1 在 Smash Up manifest 中新增 `teamMode` setup 选项，默认关闭，4 人房可切到 `2v2`。
- [x] 1.2 在领域层新增团队模式建模（固定座位顺序、队伍归属、团队目标分数）。
- [x] 1.3 改造 `isGameOver`：4 人且 `teamMode=2v2` 时按 1&3 vs 2&4 的团队总 VP 25 分判定胜负。
- [x] 1.4 前端记分板 / 结束页补充团队目标与团队总分展示，并兼容 `winners` 数组。
- [x] 1.5 补充单测与 i18n manifest key 覆盖。

## 2. Validation
- [x] 2.1 `openspec validate add-smashup-2v2-team-mode --strict --no-interactive` 通过。
- [x] 2.2 `npm run test -- src/games/smashup/__tests__/smashup.smoke.test.ts src/games/smashup/__tests__/turnCycle.test.ts src/lib/__tests__/i18n-check.test.ts` 通过。
