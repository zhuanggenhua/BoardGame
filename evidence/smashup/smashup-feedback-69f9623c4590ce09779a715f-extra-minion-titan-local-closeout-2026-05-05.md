# SmashUp 反馈 `69f9623c4590ce09779a715f` 本地收口

## 范围

- 反馈 ID：`69f9623c4590ce09779a715f`
- 反馈主题：熊的泰坦不能通过“额外随从”机会打出
- 结论口径：这不是熊专属补丁问题，而是 `smashup_immediate_extra_minion` 的共享候选构建缺口。

## 根因

- `src/games/smashup/domain/extraPlay.ts` 的 `smashup_immediate_extra_minion` 旧逻辑只枚举玩家手牌中的随从牌。
- 可作为随从打出的 `setaside` 泰坦来自 `getSetAsideTitansPlayableAs(..., 'minion')`，之前没有进入候选列表。
- 因此：
  - 提示里看不到这类泰坦；
  - 基地合法性校验也不会走 `ACTIVATE_SPECIAL`；
  - 实际执行同样不可能成功。

## 修复

- `src/games/smashup/domain/extraPlay.ts`
- `e2e/src/games/smashup/domain/extraPlay.ts`

修复点：

- 额外随从候选新增 `setaside` 泰坦。
- 基地合法性校验分流：
  - 手牌随从：`PLAY_MINION`
  - `setaside` 泰坦：`ACTIVATE_SPECIAL`
- 实际执行分流：
  - 手牌随从：`PLAY_MINION`
  - `setaside` 泰坦：`ACTIVATE_SPECIAL`

## 回归

- `src/games/smashup/__tests__/afterScoring-rescoring.test.ts`
- `e2e/src/games/smashup/__tests__/afterScoring-rescoring.test.ts`

新增用例：

- `smashup_immediate_extra_minion 应允许选择可作为随从打出的 setaside 泰坦`

## 验证

```powershell
node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/afterScoring-rescoring.test.ts --configLoader native --maxWorkers 1 --testNamePattern "smashup_immediate_extra_minion 应允许选择可作为随从打出的 setaside 泰坦"
node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/afterScoring-rescoring.test.ts --configLoader native --maxWorkers 1
```

- 结果：
  - 定向用例：`1 passed`
  - 整份文件：`8 passed`

## 结论

- 当前共享额外随从链路已经支持“可作为随从打出的 `setaside` 泰坦”。
- 该反馈本地已修，且修法已沉到共享逻辑，没有在熊派系上打专属补丁。
