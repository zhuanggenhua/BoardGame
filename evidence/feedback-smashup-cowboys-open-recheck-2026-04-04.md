# Smash Up Cowboys Open Feedback Recheck 2026-04-04

## 范围

- `69ce7167094b1acda250f8a9` `Run 'Em Off` 移动目标选择权
- `69ce7ac2094b1acda250f933` `Gold in Them Thar Hills` 额外打出

## 结论

### `69ce7167094b1acda250f8a9`

- 判定：`已修未回写`
- 代码证据：`src/games/smashup/domain/duel.ts` 当前 `Run 'Em Off` 获胜分支的目标基地选择提示使用 `loser.controller`
- 测试证据：
  - `src/games/smashup/__tests__/newFactionAbilities.test.ts`
  - `cowboys_run_em_off 在获胜时应由被移动随从的控制者而非 owner 选择目标基地`
  - `cowboys_run_em_off 平局时也应由各自被移动随从的控制者依次选择目标基地`
- 本轮补强：
  - 将获胜分支测试改为 `owner !== controller` 的场景，避免只在两者相同的情况下误判通过

### `69ce7ac2094b1acda250f933`

- 判定：`已修未回写`
- 现有 evidence：
  - `evidence/smashup-cowboys-audit-2026-03-30.md`
- 现有测试覆盖：
  - `cowboys_gold_in_them_thar_hills 额外打出的行动卡不会把挂有烟雾弹的对手随从列为目标`
  - `cowboys_gold_in_them_thar_hills 选择额外无目标行动时会立刻打出该牌`
  - `cowboys_gold_in_them_thar_hills 选择额外随从时会先选基地再直接打出`
- 用户补充说明：
  - 本地复跑 `src/games/smashup/__tests__/newFactionAbilities.test.ts` 后，Gold 相关额外打出测试已通过

## 本轮验证

- 命令：
  - `npm run test -- src/games/smashup/__tests__/newFactionAbilities.test.ts -t "cowboys_run_em_off|cowboys_gold_in_them_thar_hills"`
- 结果：
  - Vitest 最终通过 `src/games/smashup/__tests__/newFactionAbilities.test.ts`
  - `112 passed / 1 skipped`
- 备注：
  - 由于 npm 参数转发方式，实际跑成了整份 `newFactionAbilities.test.ts`
  - 这份文件包含本次关注的全部 Cowboys 回归用例，因此验证结论仍有效
