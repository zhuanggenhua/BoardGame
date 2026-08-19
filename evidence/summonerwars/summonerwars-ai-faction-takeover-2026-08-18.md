# SummonerWars AI 派系接管修复证据

## 1. 基本信息

- 对象：召唤师战争开局派系选择，玩家选择 AI 已暂占派系时的权威状态更新。
- 日期：2026-08-18
- 作者：Codex
- 文档类型：`closeout`
- 关联需求 / PR / 任务：用户反馈“玩家选择派系如果是 ai 已经选了的，应该是让 ai 重新选”。

## 2. 审计范围

- 本轮覆盖的文件：`src/games/summonerwars/domain/**`、`src/engine/transport/localDispatchExecution.ts`、`src/engine/transport/useLocalAiRuntime.ts`、`src/engine/transport/onlineAiRecovery.ts`、`src/engine/transport/__tests__/server.test.ts`。
- 本轮覆盖的模块：`SELECT_FACTION`、`SELECT_CUSTOM_DECK`、`FACTION_SELECTED`、本地 dispatch 到领域管线的 seat controller 传递。
- 本轮覆盖的共享链路：本地执行管线把座位控制者带入领域状态；在线路径由 setupData 进入 SummonerWars core。
- 明确不在本轮范围内的对象：完整在线房间 E2E、AI 策略优先级优化、派系选择 UI 视觉验收。

### 2.0 缺口分类与范围裁定

| 条目 | 分类 | 是否阻塞当前规则实现 | 是否阻塞已审计/已收口口径 | 当前范围裁定 | 后续入口 |
| --- | --- | --- | --- | --- | --- |
| 在线真实房间 E2E | `非阻塞扩展` | 否 | 否，本轮有领域、本地执行和在线恢复进展签名代表链 | 当前范围外 | 需要线上回归时补页面/E2E |

## 3. 结论等级

- 结论：`代表性玩法已验证`
- 判定理由：领域校验、领域归约、本地执行接缝和在线 AI 恢复进展签名均已有回归测试；本轮未做真实在线房间端到端截图或全量视觉验收。

## 4. 权威来源

- 主真相源：开局派系选择记录（`selectedFactions`）、玩家准备记录（`readyPlayers`）、座位控制者（`seatControllers`）。
- 对照源：玩家选择派系命令（`SELECT_FACTION`）、自定义牌组选派系命令（`SELECT_CUSTOM_DECK`）、派系选择事件（`FACTION_SELECTED`）。
- 关键裁定：真人已选派系仍不可被抢；只有占用者明确是本地 AI 或远端 AI 时，玩家选择同派系才会释放该 AI 座位。

## 5. 逐项结论

| 对象 | 规则子句 | 实现入口 | 共享链路 / 复用依据 | 命中维度 | 证据层级 | 结论 |
| --- | --- | --- | --- | --- | --- | --- |
| 玩家选择 AI 已暂占派系 | 玩家正式选择同派系后，AI 座位回到未选，等待重新选择 | `validate.ts`、`reduce.ts` | `FACTION_SELECTED` 统一更新派系选择记录 | 状态管线 / AI-only guard | L2 | 通过 |
| 自定义牌组选中 AI 已暂占派系 | 自定义牌组按召唤师派系接管 AI 暂占派系 | `validate.ts`、`reduce.ts` | 与普通派系选择共用 `FACTION_SELECTED` | 状态管线 / 自定义牌组清理 | L2 | 通过 |
| 本地执行链路 | 本地座位控制者进入领域状态，归约能识别 AI 座位 | `localDispatchExecution.ts` | 与已有 `core.seatControllers` runtime 合并约定一致 | 本地执行接缝 | L2 | 通过 |
| 在线 AI 恢复进展判断 | AI 重新选择后发出准备命令，应被恢复链路识别为进展，避免误判“没有推进” | `onlineAiRecovery.ts`、`server.test.ts` | `buildAiProgressMarker` 的开局选择签名统一记录派系、角色和准备状态 | watchdog / AI-only guard | L2 | 通过 |

## 6. 验证证据

### L2 领域行为证据

- 命令：`node scripts/infra/vitest-cli-safe.mjs run src/games/summonerwars/__tests__/validate.test.ts src/games/summonerwars/__tests__/reduce.test.ts src/engine/transport/__tests__/localDispatchExecution.test.ts --configLoader native`
- 结果：3 个测试文件通过，108 个用例通过。
- 结论：玩家选择 AI 已暂占派系会释放 AI；真人已选派系仍被拒绝；本地执行链路能带入座位控制者。

### L2 在线恢复进展证据（2026-08-19 补充）

- 命令：`node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/server.test.ts -t "公开开局阶段的准备状态变化应被视为进展" --configLoader native`
- 结果：1 个目标用例通过。
- 结论：同样的派系选择下，只要 AI 座位的准备记录从未准备变为已准备，在线 AI 恢复链路的进展标记就会变化，不再把准备命令误判成“没有推进”。

### 代表性回归证据（2026-08-19 补充）

- 命令：`node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/server.test.ts -t "buildAiProgressMarker" --configLoader native`
- 结果：5 个目标用例通过。
- 命令：`node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/server.test.ts src/games/summonerwars/__tests__/flow.test.ts src/games/summonerwars/__tests__/validate.test.ts src/games/summonerwars/__tests__/reduce.test.ts src/engine/transport/__tests__/localDispatchExecution.test.ts src/engine/ai/__tests__/manualFactionSelection.test.ts src/pages/__tests__/onlineManualSetupSelectionBridge.test.tsx --configLoader native`
- 结果：7 个测试文件通过，468 个用例通过。
- 静态检查：`npx eslint src/engine/transport/onlineAiRecovery.ts src/engine/transport/__tests__/server.test.ts` 通过。

### AI 动作可见性分类（2026-08-19 补充）

- 可见动作：AI 重新选择派系、AI 准备状态变化、房主 AI 满员后开始游戏。
- 静默动作：`buildAiProgressMarker` 计算恢复进展标记；它只影响 watchdog 是否继续尝试，不直接派发命令、不增加 AI 动作延迟。
- 玩家接续入口：准备状态被识别为进展后，恢复链路可以继续等待或触发下一步合法 AI 动作；没有替真人准备或替真人开始游戏。

## 7. 禁止假阳性检查

- 是否误用静态展示 E2E 充当玩法收口：否，本轮证据是权威状态测试。
- 是否误用 tests passed 充当语义正确：否，测试断言了最终权威状态，包括当前玩家派系、AI 派系释放、AI 准备取消、自定义牌组清理。
- 是否只证明 prompt 出现、未证明最终权威状态变化：否。
- 是否把后台恢复标记变化当成完整在线 E2E：否，本轮只证明在线恢复链路能识别准备状态变化；真实房间截图/E2E 仍属后续扩展。

## 8. 共享根因与残余范围

- 共享根因项：旧逻辑把所有“其他玩家已选派系”都当作不可接管；归约只写当前玩家选择，没有释放明确的 AI 预占座位。
- 在线恢复补充根因项：在线 AI 恢复链路用于判断“这次自动动作是否有进展”的标记漏掉了开局准备记录；AI 发出准备命令后，权威状态会变化，但旧标记仍可能保持不变，导致 watchdog 把准备动作误判为没有推进，后续不再稳定继续到开始游戏。
- 同类扩审记录：
  - 根因关键词 / 事件 / 状态字段 / helper / UI 入口：`SELECT_FACTION`、`SELECT_CUSTOM_DECK`、`FACTION_SELECTED`、`selectedFactions`、`seatControllers`。
  - 搜索范围与命中项：SummonerWars 开局选择命令、归约和本地 dispatch 接缝。
  - 已一并修复项：普通派系选择、自定义牌组派系选择、本地执行链路。
  - 判定不受影响项及理由：真人抢真人仍由校验拒绝；未知座位类型按非 AI 处理。
  - 未完成扩审范围：真实在线房间端到端流程。

## 10. 对外汇报口径

- 允许说：玩家现在可以选择 AI 已暂占的派系；系统会释放 AI 的旧选择并让该 AI 座位回到待重新选择。
- 允许说：在线恢复链路现在会把 AI 准备状态变化当作真实进展，避免 AI 重新选完派系后因为准备动作被误判为没推进而停住。
- 禁止说：已经完成全量在线 E2E 或视觉验收。
