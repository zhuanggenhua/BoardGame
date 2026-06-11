# SmashUp `reduce is not defined` 自动反馈批量收口（2026-06-10）

## 范围

- 生产库当前剩余系统单唯一簇：
  - `gameId = smashup`
  - `source = player-command-failure`
  - `autoReportKind = command-failed`
  - `content = [system][command-failed] SYS_INTERACTION_RESPOND pipeline_error: reduce is not defined`
- 数量：
  - `222` 条

## 代表项与根因

- 代表项：
  - `6a2966210729eb97ecd4739d`
- 已有单条证据：
  - `evidence/feedback-closeout/feedback-closeout-2026-06-10-smashup-watchdog-reduce-is-not-defined.md`
- 已锁定真实根因：
  - `src/games/smashup/domain/baseAbilities_expansion.ts`
  - 文件里调用了 `reduce(...)`
  - 但旧代码缺少 `import { reduce } from './reduce'`

## 修复

- 已在当前树补上：

```ts
import { reduce } from './reduce'
```

- 修复文件：
  - `src/games/smashup/domain/baseAbilities_expansion.ts`

## 验证

- 代表项定向验证命令：

```bash
pnpm vitest run src/games/smashup/__tests__/yuanhouFactionAbilities.test.ts --configLoader native -t "时间旅行者基地：枢纽真实计分后让过响应应继续按正常牌库顶替换基地|时间旅行者基地：枢纽真实计分后应使用选择的基地替换已计分基地|时间旅行者基地：枢纽真实计分后若基地牌库已空且选择弃牌堆基地替换，应让所选基地替换并用其余弃牌堆与旧基地重建牌库"
```

- 结果：
  - `3 passed`

## 批量收口理由

- 当前生产 `open / in_progress` 系统单重新聚合后，只剩这一个错误簇。
- 它们的错误文案、来源和游戏一致，属于同一根因的重复自动报错，不是多根因混合。
- 代表项已经完成：
  - 根因定位
  - 代码修复
  - 定向测试验证
- 因此剩余 `222` 条同簇自动反馈应统一按 `resolved` 批量收口，而不是继续逐条重复处理。

## 收口口径

- 状态：`resolved`
- 说明：
  - `与 6a2966210729eb97ecd4739d 同根因；baseAbilities_expansion.ts 缺失 reduce 导入已修复，当前树已通过 base_the_nexus 定向回归。`
