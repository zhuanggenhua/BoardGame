# SmashUp 反馈 `69f96a734590ce09779a7205` 本地收口

## 范围

- 反馈 ID：`69f96a734590ce09779a7205`
- 反馈主题：并列计分口径错误
- 当前口径：战斗力并列时，应取该并列组占据的更低名次分值，而不是继续取高位名次分值。

## 根因

- `src/games/smashup/domain/index.ts` 的 `buildBaseRankings()` 旧逻辑会让并列玩家继续沿用当前 `rankSlot` 发分。
- 结果是：
  - 并列第一仍拿第一位分；
  - 并列第二仍拿第二位分；
  - 与当前产品口径不一致。

## 修复

- `src/games/smashup/domain/index.ts`
  - 并列组改为按该组占据的最低名次发分。
- `src/games/smashup/ai.ts`
  - 同步修正 AI 的基地 VP 估值，避免 AI 仍按旧计分口径评估。
- `src/games/smashup/__tests__/baseScoring.test.ts`
  - 新增：
    - `scoreOneBase 在并列第一时给并列玩家第二位分`
    - `scoreOneBase 在并列第二时给并列玩家第三位分`

## 验证

```powershell
node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/baseScoring.test.ts --configLoader native --maxWorkers 1 --testNamePattern "scoreOneBase 在并列第一时给并列玩家第二位分|scoreOneBase 在并列第二时给并列玩家第三位分"
```

- 结果：`2 passed`

## 结论

- 该反馈对应的本地实现已对齐当前产品口径。
- 当前保留的是定向单测证据；本轮未扩展新的 UI/E2E 场景。
