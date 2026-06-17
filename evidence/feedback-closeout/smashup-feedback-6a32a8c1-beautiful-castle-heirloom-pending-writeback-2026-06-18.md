# SmashUp 线上反馈待回写（6a32a8c1638b2f426d29549c）

## 范围

- 反馈 ID：`6a32a8c1638b2f426d29549c`
- 游戏：`smashup`
- 反馈原文：`给自己5战力的随从打战术，但是因为基地效果让战术无效化了，可是基地无效化的应该是其他玩家的效果，不包括自己才对。`

## 真相源

- 生产真源：
  - `ssh admin@8.148.71.102` -> `docker exec -i boardgame-mongodb mongosh --quiet` -> `boardgame.feedbacks`
- 本轮命中的真实链路：
  - 现实含义：玩家在 `美丽城堡` 上，给自己 5 战力随从打《传家宝》时，被错误挡掉。
  - 现场日志信号：
    - `战术卡施放： 传家宝`
    - `目标受到保护，能力未生效`
    - `移除持续战术： 传家宝 （原因：princesses_heirloom_blocked_attach）`

## 根因

- 真正错误不在《蚁丘》或《传家宝》本体，而在 `美丽城堡（base_beautiful_castle）` 的保护判断。
- 旧实现把“自己来源的效果”也当成了需要拦截的对象，导致己方给己方随从附着《传家宝》时，被错误判成“受保护，不能影响”。
- 现实语义应是：
  - `美丽城堡` 只拦其他玩家对这里随从的消灭/移动/影响；
  - 自己对自己的效果不该被挡。

## 本轮修复

- `src/games/smashup/domain/baseAbilities_expansion.ts`
  - 在 `beautifulCastleChecker` 中补上：
    - `if (ctx.sourcePlayerId === ctx.targetMinion.controller) return false;`
- `src/games/smashup/__tests__/baseProtection.test.ts`
  - 新增：自己的效果不会被 `美丽城堡` 错误拦截。
- `src/games/smashup/__tests__/abilities/princesses.test.ts`
  - 新增：`美丽城堡` 上的 5 力己方随从仍可被自己的《传家宝》附着。

## 本地验证

- 验证命令：
  - `pnpm vitest run src/games/smashup/__tests__/baseProtection.test.ts src/games/smashup/__tests__/abilities/princesses.test.ts --configLoader native`
- 结果：
  - `39 passed`

## 当前状态

- 反馈本体结论：`resolved（待正式回写）`
- 当前边界：
  - 代码已改，定向验证已通过。
  - 这条反馈还没有正式回写到生产真源，因为：
    - HTTP 开放回写接口当前为 `404`
    - 本轮没有拿到“可改生产 Mongo”的明确授权
  - 这条修复也还没有在本轮再次提交、push、部署。

## 收口结论

- 这条反馈是**真实 bug**，不是误报。
- 当前已经具备：
  - `生产真源定位`
  - `代码修复`
  - `定向测试通过`
- 下一步只剩：
  - 把这批改动提交 / push / 部署
  - 在用户明确授权后，把生产反馈状态正式回写为 `resolved`
