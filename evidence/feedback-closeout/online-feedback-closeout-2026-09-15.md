# 线上反馈收口 2026-09-15

## 本轮口径

- 口径：线上真实反馈。
- 统计时间：2026-09-15 23:43 +08:00。
- 真实读取入口：`https://api.easyboardgame.top/admin-api/feedback`。
- 真实回写入口：生产 Mongo，经 `admin@8.148.71.102` / `boardgame.feedbacks`，原因是本轮没有可复用 Bearer token，项目脚本对已确认生产域名自动选择 `mongo-ssh`。
- 本地镜像：`temp/feedback-closeout/status-board.json`。

## 原始反馈

### 6aa8e5244b96287bdff6af71

```text
[system][online-ai-watchdog] SYS_INTERACTION_RESPOND pipeline_error: buildOngoingDetachedEvent is not defined
```

- 游戏：Smash Up。
- 场景：在线 AI watchdog 在计分阶段处理响应窗口时提交 `SYS_INTERACTION_RESPOND`。
- 当前现场：响应窗口来源是 `sheep_in_sheeps_clothing`，候选为发动该响应或让过。

### 6aa8e6144b96287bdff6af9b / 6aa8e54f4b96287bdff6af91

```text
[system][player-command-failure] SYS_INTERACTION_RESPOND pipeline_error: buildOngoingDetachedEvent is not defined
```

- 游戏：Smash Up。
- 场景：玩家在出牌阶段处理响应窗口时提交 `SYS_INTERACTION_RESPOND`。
- 当前现场：响应窗口来源是 `sheep_in_sheeps_clothing`，候选为发动该响应或让过。

## 效果原文

- 中文录入：`绵羊装`，效果为“对一个随从打出。持续：在另一个随从从这里移动到另一个基地后，你可以将此随从也移动到那里并消灭此行动。”
- 英文录入：`In Sheep's Clothing`，效果为“Play on a minion. Ongoing: After another minion moves from here to another base, you may move this minion to there as well and destroy this action.”
- 来源：`public/locales/zh-CN/game-smashup.json`、`public/locales/en/game-smashup.json`、`src/games/smashup/data/factions/sheep.ts`。

## 判定

- 这是实现 bug，不是规则录入冲突。
- 玩家动作：玩家或 AI 在“随从移动后是否发动绵羊装”的响应窗口选择发动。
- 状态写入：触发队列记录 `sheep_in_sheeps_clothing`，并携带移动来源基地、目标基地和附着行动来源。
- 错误分支：执行器要生成“附着持续行动离场并进入弃牌堆”的事件，但 `src/games/smashup/abilities/sheep.ts` 调用了已存在的事件 builder 却没有导入。
- 玩家可见结果：服务端抛 `buildOngoingDetachedEvent is not defined`，导致该次在线响应失败。

## 修复

- 在 `src/games/smashup/abilities/sheep.ts` 导入已有正式 owner：`../domain/ongoingDetach` 的 `buildOngoingDetachedEvent`。
- 在 `src/games/smashup/__tests__/abilities/promos-sheep-all-stars.test.ts` 补回归：羊皮狼响应同基地随从移走时，必须移动宿主随从，并把附着行动弃置。
- 没有改规则文本、卡牌数据、响应窗口权限或新建第二套事件构造逻辑。

## 验证

- 红灯：新增回归首跑命中同源错误 `ReferenceError: buildOngoingDetachedEvent is not defined`。
- 绿灯：`node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/abilities/promos-sheep-all-stars.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1 -t "羊皮狼响应同基地随从移走"` -> 1 passed。
- 绿灯：`node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/abilities/promos-sheep-all-stars.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1` -> 24 passed。
- 绿灯：`npm run typecheck -- --pretty false` -> `tsc --noEmit` passed。
- 同类扩审：扫描 `src/games/smashup/abilities` 与 `src/games/smashup/domain` 内 `buildOngoingDetachedEvent` 调用，共 21 个命中文件，漏导入 `missing=[]`。
- 空白检查：`git diff --check -- src/games/smashup/abilities/sheep.ts src/games/smashup/__tests__/abilities/promos-sheep-all-stars.test.ts` passed。

## 状态回写

- `6aa8e5244b96287bdff6af71`：`resolved`，生产 Mongo 回写成功。
- `6aa8e6144b96287bdff6af9b`：`resolved`，生产 Mongo 回写成功。
- `6aa8e54f4b96287bdff6af91`：重复项，跟随 `6aa8e6144b96287bdff6af9b` 写为 `resolved`，生产 Mongo 回写成功。
- 最终线上未收口队列：`open=0`、`in_progress=0`、`totalFetched=0`，读取时间 2026-09-15 23:43 +08:00。
- 精确 ID 生产回查：三条反馈均为 `resolved`，且 `resolvedMethod` 已写入。
- 本地状态镜像：`node scripts/verify/verify-feedback-status.mjs temp/feedback-closeout/status-board.json` -> `feedback-status: ok`。

## 漏审复盘

- 旧测试覆盖了 Sheep 派系注册、羊群移动、黑色牧羊、剪羊毛等路径，但没有覆盖 `sheep_in_sheeps_clothing` 的“响应窗口提交后继续执行触发器”路径。
- 旧测试或类型检查没有挡住的直接原因：该能力在运行时触发器闭包中才调用未导入函数；缺少当前卡牌的响应提交回归，所以直到线上玩家/AI 响应时才暴露。
- 本轮已把缺口补到现有 Sheep/All-Stars 能力测试中，覆盖 `triggerQueue -> smashup_reaction_choose -> SYS_INTERACTION_RESPOND -> MINION_MOVED + ONGOING_DETACHED`。
- 测试语义对账：新增测试不是只看响应窗口出现，而是断言玩家提交响应后产生 `MINION_MOVED` 与 `ONGOING_DETACHED`，并检查最终状态里宿主随从到达目标基地、附着行动进入拥有者弃牌堆。
- 漏审归因：测试断言过窄，证据停在中间态；旧覆盖只证明相邻 Sheep 能力和触发队列存在，没有把 `sheep_in_sheeps_clothing` 加入“提交响应后最终权威状态”的对象全集。
- 不更新项目规范：现有反馈收口、规则 bug 修复和回归标准已经要求“回到原始反馈位点补回归”和“同类扩审”；本轮是对象级测试覆盖缺口，不是规范缺口。
- 2026-09-16 后续回写：用户追问“是不是审计漏了、要不要更新维度后重审”后，已改判为项目级审计维度缺口；缺的是可选触发 / 响应窗口在提交后执行器、最终权威状态和清理语义上的强制审计项。替代结论见 `evidence/smashup/smashup-optional-reaction-trigger-reaudit-2026-09-16.md`，并已更新 `.spec/knowledge/standards/description-to-implementation-audit.md` 与 `.spec/knowledge/standards/regression-closeout.md`。

## 未执行事项

- 本轮没有执行提交、推送或生产部署；代码修复留在本机工作区，反馈状态已按线上反馈收口流程回写。
