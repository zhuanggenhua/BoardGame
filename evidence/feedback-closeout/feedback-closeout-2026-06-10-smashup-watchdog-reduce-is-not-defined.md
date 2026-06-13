# SmashUp 自动反馈 `6a2966210729eb97ecd4739d` 收口（2026-06-10）

## 反馈

- `6a2966210729eb97ecd4739d`
- 游戏：`smashup`
- 类型：系统自动反馈
- 原文：
  - `[system][online-ai-watchdog] force-end-turn-failed visible-interaction:recover-interaction:legal_action_command_failed:SYS_INTERACTION_RESPOND:pipeline_error: reduce is not defined`

## 真相源

- 生产库：
  - `ssh admin@8.148.71.102`
  - `docker exec -i boardgame-mongodb mongosh --quiet boardgame`
- 生产记录确认：
  - `reporterType = system`
  - `status = open`
  - `gameId = smashup`
  - `autoReportKind = force-end-turn-failed`

## 根因

- 不是 watchdog 本身乱报。
- 真正报错点在 SmashUp 领域层基地扩展能力文件：
  - `src/games/smashup/domain/baseAbilities_expansion.ts`
- 文件里存在这段真实运行路径：
  - `drawEvents.reduce((state, event) => reduce(state, event), ctx.state)`
- 但该文件缺少：
  - `import { reduce } from './reduce'`
- 结果：
  - 当 `枢纽（base_the_nexus）` 在真实计分后进入 `smashup_reaction_choose` 响应链，再走“从基地弃牌堆选择一个基地放到牌库顶”的后续路径时，
  - 服务端执行 `SYS_INTERACTION_RESPOND` 会直接触发 `ReferenceError: reduce is not defined`
  - watchdog 最终把它记成这一条 `force-end-turn-failed`

## 修复

- 文件：
  - `src/games/smashup/domain/baseAbilities_expansion.ts`
- 修改：
  - 补上 `import { reduce } from './reduce'`

## 定向验证

- 命令：
  - `pnpm vitest run src/games/smashup/__tests__/yuanhouFactionAbilities.test.ts --configLoader native -t "时间旅行者基地：枢纽真实计分后让过响应应继续按正常牌库顶替换基地|时间旅行者基地：枢纽真实计分后应使用选择的基地替换已计分基地|时间旅行者基地：枢纽真实计分后若基地牌库已空且选择弃牌堆基地替换，应让所选基地替换并用其余弃牌堆与旧基地重建牌库"`
- 结果：
  - `3 passed`

## 收口结论

- 这条反馈是当前树可直接对位的真实代码缺口，不是噪音。
- 根因、修复点、定向验证三者已闭环，应按 `resolved` 收口。
