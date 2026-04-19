# P1 审计续查记录（2026-03-10，批次 2）

## 背景

- 本批次继续执行“只读优先、避免和用户当前修复冲突”的 POD 回滚审计。
- 目标不是把用户正在做的重构误判成 POD，而是继续缩小“旧总表挂账”和“当前真实遗留”之间的差距。
- 这次重点做了两件事：
  - 归因 `DiceThrone` 当前一条流程红测；
  - 补查 3 个总表尾项：`engine/hooks/index.ts`、`tictactoe/domain/index.ts`、`pages/admin/index.tsx`。

---

## 一、DiceThrone 红测归因（只读）

### 1. 目标用例

```bash
npx vitest run src/games/dicethrone/__tests__/flow.test.ts -t "flowHalted=true 状态下打出大吉大利不会误触发阶段推进"
```

### 2. 现象

- 当前工作区下，此用例失败。
- 实际现象是阶段从 `offensiveRoll` 被推进到了 `main2`。
- 日志显示：
  - `card-lucky` 执行时产出的是 `BONUS_DIE_ROLLED x4 + HEAL_APPLIED`
  - 没有再产生测试注释里预期的 displayOnly `BONUS_DICE_REROLL_REQUESTED`
  - 随后的 `SKIP_BONUS_DICE_REROLL` 结算了真实攻击用的 `pendingBonusDiceSettlement`
  - `InteractionSystem` 随后执行 `resolveInteraction`
  - `FlowSystem` 看到 `flowHalted=true` 且阻塞已清空，于是自动推进到 `main2`

### 3. 归因结论

本轮已能把这条红测归因到**当前工作区的未提交改动**，而不是稳定存在的 POD 残留：

- `git show HEAD:src/games/dicethrone/domain/customActions/barbarian.ts`
- `git blame HEAD -L 251,269 -- src/games/dicethrone/domain/customActions/barbarian.ts`
- `git diff --cached -- src/games/dicethrone/domain/customActions/barbarian.ts`
- `git diff -- src/games/dicethrone/domain/customActions/barbarian.ts`

核对结果：

- `HEAD` 版本里，`handleLuckyRollHeal` 仍然保留：
  - `createDisplayOnlySettlement(sourceAbilityId, attackerId, attackerId, dice, timestamp)`
- 当前工作区（staged + unstaged）把这条 displayOnly settlement 注释掉了，并改成：
  - 多个 `BONUS_DIE_ROLLED`
  - 再补一个汇总 `BONUS_DIE_ROLLED`
- 同类改动也出现在 `handleMorePleaseRollDamage`

因此，这条 `flow.test` 当前失败，**更像是正在进行中的“骰子/卡牌特写重构”副作用**，不应直接记成 POD 历史回滚。

### 4. 本轮处理策略

- 不修改业务代码；
- 只记录归因，避免和用户当前 `DiceThrone` 改动冲突；
- 后续如果要修，应基于“当前特写方案”重新决定：
  - 是恢复 displayOnly settlement；
  - 还是同步改测试和阻塞模型。

---

## 二、总表尾项补查

### 1. `src/engine/hooks/index.ts`

复核结论：

- 当前导出链完整，包含：
  - `useSpectatorMoves`
  - `useEventStreamCursor`
  - `EventStreamRollbackContext`
  - `useEventStreamRollback`
- 这说明旧报告里提到的“导出被删”并不是当前遗留状态。
- 未发现新的 POD 回滚证据。

验证：

```bash
npx vitest run src/engine/hooks/__tests__/useEventStreamCursor.test.ts
```

结果：通过。

### 2. `src/games/tictactoe/domain/index.ts`

复核结论：

- 当前 `DomainCore` 装配链完整：
  - `setup`
  - `validate`
  - `execute`
  - `reduce`
  - `isGameOver`
- 没看到 POD 把井字棋核心流程入口删坏的残留。

验证：

```bash
npx vitest run src/games/tictactoe/__tests__/flow.test.ts
```

结果：通过。

### 3. `src/pages/admin/index.tsx`

复核结论：

- 当前页面仍保留管理面板的主要数据拉取与展示链：
  - `/stats`
  - `/stats/trend`
  - 多个统计卡片与图表组件装配
- 本轮未看到会影响游戏逻辑、引擎流程或大厅主链路的 POD 回滚残留。
- 该文件仍归类为低风险尾项，本轮仅做只读确认，不做额外改动。

---

## 三、本轮实际执行的命令

```bash
git log --oneline --all -- src/games/dicethrone/domain/flowHooks.ts
git show --no-patch --pretty=raw 9c9dd78
git diff --cached -- src/games/dicethrone/domain/commandValidation.ts src/games/dicethrone/domain/core-types.ts src/games/dicethrone/domain/events.ts src/games/dicethrone/domain/flowHooks.ts src/games/dicethrone/domain/reducer.ts
git blame HEAD -L 251,269 -- src/games/dicethrone/domain/customActions/barbarian.ts
git show HEAD:src/games/dicethrone/domain/customActions/barbarian.ts
git diff --cached -- src/games/dicethrone/domain/customActions/barbarian.ts
git diff -- src/games/dicethrone/domain/customActions/barbarian.ts
npx vitest run src/games/dicethrone/__tests__/flow.test.ts -t "flowHalted=true 状态下打出大吉大利不会误触发阶段推进"
npx vitest run src/engine/hooks/__tests__/useEventStreamCursor.test.ts src/games/tictactoe/__tests__/flow.test.ts
```

---

## 四、本轮结论

- 本轮没有发现新的“已提交 POD 残留”明确证据。
- `DiceThrone` 当前那条 `flow.test` 红测，已可归因到**工作区内未提交的特写改造**，不是稳定历史基线上的 POD 回滚。
- `src/engine/hooks/index.ts`、`src/games/tictactoe/domain/index.ts`、`src/pages/admin/index.tsx` 本轮补查后，未见新的 POD 遗留问题。

## 五、本轮文件改动

- 业务代码：无
- 文档新增：
  - `evidence/p1-audit-followup-2026-03-10-batch2.md`

---

## 六、SmashUp 活跃区复核（POD 口径，只读）

### 1. 复核文件

- `src/games/smashup/domain/index.ts`
- `src/games/smashup/domain/systems.ts`
- `src/games/smashup/domain/reduce.ts`
- `src/games/smashup/abilities/pirates.ts`

### 2. 本轮重点核对内容

- `beforeScoringTriggeredBases` 是否被正确落地、清理，避免重复触发或漏触发；
- `afterScoring` 交互打开后，`BASE_CLEARED / BASE_REPLACED` 是否仍然延迟补发，而不是被 POD 提前清掉；
- 多个 `afterScoring` 交互之间，`_deferredPostScoringEvents` 是否继续链式传递；
- `pirate_king / pirate_first_mate` 的交互 `targetType / displayMode / continuationContext` 是否存在 POD 造成的回滚；
- 计分后 `reduce` 是否仍然清理 `beforeScoringTriggeredBases / afterScoringTriggeredBases`，避免新基地继承旧基地触发状态。

### 3. 只读结论

- 本轮未发现新的明确 POD 回滚残留。
- 当前实现里可以看到：
  - `scoreOneBase` 在 `beforeScoring` 标记事件发出后，会立即本地 `reduce`，避免交互解决后重复创建同一个前置计分交互；
  - `afterScoring` 创建交互时，会把 `BASE_CLEARED / BASE_REPLACED` 序列化进 `_deferredPostScoringEvents`，而不是直接丢失；
  - 多基地/多交互场景下，延迟事件会继续挂在交互链上，最后一个交互解决后再补发；
  - `reduce.ts` 在 `BASE_REPLACED` 时会清理该基地索引对应的 `beforeScoringTriggeredBases / afterScoringTriggeredBases`；
  - `pirates.ts` 当前 `pirate_king_move`、`pirate_first_mate_choose_base` 仍保留 `targetType`、`displayMode`、延迟事件补发和受控移动链路。
- 结合本轮回归测试，暂未看到“POD 把你已经修好的多基地计分/海盗交互逻辑又回滚掉”的新证据。

### 4. 验证

```bash
npx vitest run src/games/smashup/__tests__/afterscoring-window-skip-base-clear.test.ts src/games/smashup/__tests__/baseAbilitiesPrompt.test.ts src/games/smashup/__tests__/newOngoingAbilities.test.ts src/games/smashup/__tests__/multi-base-afterscoring-bug.test.ts
```

结果：4 个文件全部通过，共 154 条用例通过。

---

## 七、DiceThrone 活跃 UI / 战斗链路复核（POD 口径，只读）

### 1. 复核文件

- `src/games/dicethrone/Board.tsx`
- `src/games/dicethrone/domain/reduceCombat.ts`
- `src/games/dicethrone/ui/RightSidebar.tsx`
- `src/games/dicethrone/ui/viewMode.ts`
- `src/games/dicethrone/domain/commandCategories.ts`

### 2. 本轮重点核对内容

- `Board.tsx` 中响应窗口视角切换、可用 token 高亮、能力变体文案选择是否还保留；
- `reduceCombat.ts` 中 `BONUS_DAMAGE_ADDED → pendingAttack.bonusDamage` 及回合清理链是否仍在；
- `RightSidebar.tsx` 中 `activeModifiers` 与 `bonusDamage` 的展示入口是否被 POD 删掉；
- `viewMode.ts` 中 `isResponseAutoSwitch` 与响应视角判定是否存在回退；
- `commandCategories.ts` 是否仍保留本轮前面补上的命令分类修复。

### 3. 只读结论

- 本轮未发现新的明确 POD 回滚残留。
- 当前实现里可以确认：
  - `Board.tsx` 仍然保留 `tokenUsableOverrides`、`computeViewModeState(...)`、`rootPid === currentResponderId` 的响应高亮判定；
  - `Board.tsx` 仍把 `activeModifiers` 和 `bonusDamage={G.pendingAttack?.bonusDamage ?? G.players[G.activePlayerId]?.pendingBonusDamage}` 传给右侧栏；
  - `reduceCombat.ts` 仍保留 `BONUS_DAMAGE_ADDED` 处理器，并在攻击初始化时把排队的 bonusDamage 转进 `pendingAttack`；
  - `RightSidebar.tsx` 仍渲染 `ActiveModifierBadge` 与 `AttackBonusDamageDisplay`；
  - `viewMode.ts` 当前仍保留响应自动切视角的判断分支；
  - `commandCategories.ts` 当前没有看到前面补过的分类被再次回退。
- 结合现成回归测试，本轮未看到“POD 把你已经修好的修正伤害/侧栏/UI 视角逻辑又删掉”的新证据。

### 4. 验证

```bash
npx vitest run src/games/dicethrone/__tests__/viewMode.test.ts src/games/dicethrone/__tests__/bonus-damage-collection.test.ts src/games/dicethrone/__tests__/volley-5-dice-display.test.ts src/games/dicethrone/__tests__/red-hot-meteor-integration.test.ts src/games/dicethrone/__tests__/active-modifiers-undo.test.ts
```

结果：5 个文件全部通过，共 20 条用例通过。

---

## 八、引擎层复核（POD 口径，只读）

### 1. 复核文件

- `src/engine/systems/FlowSystem.ts`
- `src/engine/systems/InteractionSystem.ts`
- `src/engine/transport/react.tsx`

### 2. 本轮重点核对内容

- `FlowSystem` 的 `halt / autoContinue / phase updated` 主链是否有 POD 留下的“少一拍/多推进”残留；
- `InteractionSystem` 的 `resolveInteraction`、队列推进、延迟事件传递、选项刷新与响应校验语义是否仍完整；
- `transport/react.tsx` 中测试场景与响应窗口相关的状态同步链是否存在回退。

### 3. 只读结论

- 本轮未发现新的明确 POD 回滚残留。
- 从 `9c9dd78 -> HEAD` 的可见历史看：
  - `FlowSystem.ts` 这段变化主要是去掉调试日志，不是功能回退；
  - `InteractionSystem.ts` 后续反而补进了更完整的类型、`targetType`、`autoRefresh`、`responseValidationMode`、`revalidateOnRespond` 以及延迟事件传递能力；
  - 这与当前 `SmashUp` 多交互/延迟事件链能通过测试是吻合的；
  - `transport/react.tsx` 这轮没有看到新的 POD 残留证据。

### 4. 验证

```bash
npx vitest run src/engine/systems/__tests__/FlowSystem.test.ts src/engine/systems/__tests__/InteractionSystem.test.ts src/engine/systems/__tests__/InteractionSystem-auto-injection.test.ts src/games/smashup/__tests__/commandExecutionFlow.test.ts src/games/smashup/__tests__/tortuga-pirate-king-flowhalted-fix.test.ts
```

结果：5 个文件全部通过，共 26 条用例通过。

说明：

- `commandExecutionFlow.test.ts` 中有预期内的命令验证失败日志，但测试本身通过；
- 本轮不把这些日志记为 POD 问题。

---

## 九、传输层复核（POD 口径，只读）

### 1. 复核文件

- `src/engine/transport/server.ts`
- `src/engine/transport/client.ts`
- `src/engine/transport/react.tsx`
- `src/engine/pipeline.ts`
- `src/engine/adapter.ts`

### 2. 本轮重点核对内容

- 服务端离线裁决、增量同步、断线重连、`setupData` / 测试注入相关链是否存在 POD 回滚；
- 客户端 patch / resync / stateID 连续性处理是否仍然完整；
- React 传输层注册与 TestHarness / provider 状态同步是否有回退；
- `pipeline.ts / adapter.ts` 是否仍保留引擎装配主链。

### 3. 只读结论

- 本轮未发现新的明确 POD 回滚残留。
- 当前工作区下，这批文件相对 `HEAD` 没有新增本地冲突修改；
- 结合现有文档和本轮测试结果，传输层的服务端离线裁决、补丁同步、resync 恢复、错误国际化链都仍然工作；
- 暂未看到“POD 把你已经修好的传输/同步/断线恢复逻辑又删掉”的新证据。

### 4. 验证

```bash
npx vitest run src/engine/transport/__tests__/server.test.ts src/engine/transport/__tests__/server-injectState.test.ts src/engine/transport/__tests__/patch.test.ts src/engine/transport/__tests__/patch-integration.test.ts src/engine/transport/__tests__/errorI18n.test.ts
```

结果：5 个文件全部通过。

说明：

- `patch.test.ts` 与 `patch-integration.test.ts` 中会输出预期内的 patch 失败 / resync 日志；
- 这些属于测试场景覆盖，不记为 POD 问题。

---

## 十、全局 UI / 重赛 / 音频链复核（POD 口径，只读）

### 1. 复核文件

- `src/components/game/framework/widgets/RematchActions.tsx`
- `src/components/game/framework/widgets/GameHUD.tsx`
- `src/contexts/RematchContext.tsx`
- `src/contexts/SocialContext.tsx`
- `src/contexts/ToastContext.tsx`
- `src/pages/Home.tsx`
- `src/pages/MatchRoom.tsx`
- `src/lib/audio/AudioManager.ts`
- `src/lib/audio/useGameAudio.ts`
- `src/components/system/FabMenu.tsx`
- `src/components/lobby/LeaderboardTab.tsx`

### 2. 本轮重点核对内容

- `RematchActions` 的 `renderButton`、多人投票、返回大厅链是否仍在；
- `GameHUD` 的聊天预览、toast 反馈、全屏/聊天输入保护是否仍在；
- `RematchContext / ToastContext / SocialContext` 是否存在被 POD 删空入口的残留；
- `MatchRoom / Home` 的房间入口、座位校验相关链是否仍完整；
- `AudioManager / useGameAudio` 的音频路由、节流、优先级、缺失音频回退链是否仍完整；
- `FabMenu / LeaderboardTab` 这类 UI 节点是否被回滚成缺失状态。

### 3. 只读结论

- 本轮未发现新的明确 POD 回滚残留。
- 当前实现里可以确认：
  - `RematchActions.tsx` 仍保留 `renderButton` 插槽、多人投票 / 取消投票 / 返回大厅分支；
  - `GameHUD.tsx` 仍保留聊天输入长度保护、只读提示、网络状态提示和全屏失败 toast；
  - `ToastContext` 的去重链路、`AudioManager / useGameAudio` 的音频路由与优先级链，当前都能通过现成测试；
  - `MatchRoom` 相关座位校验现成测试通过，未见 POD 造成的房间进入主链缺口；
  - `FabMenu / LeaderboardTab` 当前代码是完整可用组件，不是被删空的残留状态。

### 4. 验证

```bash
npx vitest run src/components/game/framework/widgets/__tests__/RematchActions.test.tsx src/components/__tests__/GameHUDChatPreview.test.ts src/components/__tests__/ToastContext-dedupe.test.tsx src/lib/audio/__tests__/audioManager.test.ts src/lib/audio/__tests__/audioRouting.test.ts src/pages/__tests__/matchSeatValidation.test.ts
```

结果：6 个文件全部通过，共 32 条用例通过。

说明：

- `RematchActions.test.tsx` 当前会输出少量调试日志，但测试通过；
- 本轮不把这些日志记为 POD 问题。

---

## 十一、服务层 / 存储层复核（POD 口径，只读）

### 1. 复核文件

- `src/services/lobbySocket.ts`
- `src/services/matchApi.ts`
- `src/services/matchSocket.ts`
- `src/services/socialSocket.ts`
- `src/server/claimSeat.ts`
- `src/server/models/MatchRecord.ts`
- `src/server/storage/HybridStorage.ts`
- `src/server/storage/MongoStorage.ts`

### 2. 本轮重点核对内容

- `lobby / match / social` socket 服务是否存在被 POD 删掉的订阅、版本更新、重连/健康检查链；
- `matchApi` 的基础请求能力与鉴权错误链是否仍在；
- `claimSeat / MatchRecord` 的座位认领、身份回填、持久化模型链是否仍完整；
- `HybridStorage / MongoStorage` 的状态裁剪、TTL 刷新、混合存储读写链是否存在回退。

### 3. 只读结论

- 本轮未发现新的明确 POD 回滚残留。
- 当前实现里可以确认：
  - `lobbySocket.ts` 仍保留大厅订阅、版本门控、可见性重同步和健康检查挂钩；
  - `claimSeat.ts` 相关登录用户 / 游客认领链通过现成测试；
  - `MongoStorage.ts` 仍保留存储前状态裁剪、TTL 刷新、日志记录等主链；
  - `HybridStorage.ts` 当前是完整实现，不是残缺状态。

### 4. 验证

```bash
npx vitest run src/server/__tests__/claimSeat.test.ts src/server/__tests__/joinGuard.test.ts src/server/storage/__tests__/hybridStorage.test.ts src/server/storage/__tests__/mongoStorage.test.ts src/server/__tests__/matchOccupancy.test.ts
```

结果：

- `claimSeat / joinGuard / matchOccupancy` 通过；
- `hybridStorage.test.ts`、`mongoStorage.test.ts` 当前为跳过状态，没有新增失败。

说明：

- 存储层两组测试本轮没有运行到有效断言（测试本身为 skipped），因此这里只把它们记为“未出现新红灯”，不把它们当成新增正向证据夸大。

---

## 十二、管理页 / UGC 构建器复核（POD 口径，只读）

### 1. 复核文件

- `src/pages/admin/Matches.tsx`
- `src/pages/admin/Feedback.tsx`
- `src/pages/admin/Notifications.tsx`
- `src/ugc/builder/pages/components/HookField.tsx`
- `src/ugc/builder/pages/components/RenderComponentManager.tsx`
- `src/ugc/builder/pages/panels/BuilderModals.tsx`
- `src/ugc/builder/pages/panels/PropertyPanel.tsx`

### 2. 本轮重点核对内容

- `admin/Matches` 里之前明确恢复过的 `MatchDetailModal` / 详情入口是否仍在；
- `Feedback / Notifications` 页面是否仍保留完整的数据拉取、列表与操作链；
- UGC 构建器里的 `HookField / RenderComponentManager / BuilderModals / PropertyPanel` 是否是完整可用实现，而不是被 POD 删残的空壳。

### 3. 只读结论

- 本轮未发现新的明确 POD 回滚残留。
- 当前实现里可以确认：
  - `src/pages/admin/Matches.tsx` 当前仍有 `MatchDetailModal`，说明之前恢复的核心详情入口还在；
  - `Feedback.tsx` 与 `Notifications.tsx` 当前仍是完整页面，不是被删空状态；
  - UGC 四个文件当前都是真实实现，并不是被 POD 留下的残缺节点。
- 结合 UGC 现成测试，本轮没看到“POD 又把构建器关键面板删坏”的新证据。

### 4. 验证

```bash
npx vitest run src/ugc/builder/__tests__/UnifiedBuilder.test.ts src/ugc/builder/__tests__/resolvePlayerContext.test.ts
```

结果：2 个文件全部通过，共 19 条用例通过。

说明：

- 管理页这批当前没有直接对口的现成页面测试；
- 因此本轮对 `admin/*` 主要采用源码复核 + 关键入口存在性确认，不夸大成完整功能验收。

---

## 十三、低风险尾项收尾（POD 口径，只读）

### 1. 复核文件

- `src/App.tsx`
- `src/main.tsx`
- `src/index.css`
- `src/shared/chat.ts`
- `src/hooks/match/useMatchStatus.ts`
- `src/games/tictactoe/domain/types.ts`
- `src/games/ugc-wrapper/game.ts`
- `src/pages/devtools/AudioBrowser.tsx`
- `src/lib/utils.ts`
- `src/lib/i18n/zh-CN-bundled.ts`
- `src/assets/audio/registry-slim.json`
- `src/games/dicethrone/rule/王权骰铸规则.md`
- `"src/games/dicethrone/rule/\347\216\213\346\235\203\351\252\260\351\223\270\350\247\204\345\210\231.md"`（旧表转义路径，实际同上）
- `public/locales/en/admin.json`
- `public/locales/en/common.json`
- `public/locales/en/game.json`
- `public/locales/en/game-dicethrone.json`
- `public/locales/en/game-smashup.json`
- `public/locales/en/game-summonerwars.json`
- `public/locales/en/lobby.json`
- `public/locales/en/social.json`
- `public/locales/zh-CN/admin.json`
- `public/locales/zh-CN/common.json`
- `public/locales/zh-CN/game.json`
- `public/locales/zh-CN/game-dicethrone.json`
- `public/locales/zh-CN/game-smashup.json`
- `public/locales/zh-CN/game-summonerwars.json`
- `public/locales/zh-CN/lobby.json`
- `public/locales/zh-CN/social.json`

### 2. 本轮重点核对内容

- 应用入口、Provider 装配、TestHarness 初始化链是否存在被 POD 删坏的残留；
- 共享聊天协议与基础工具函数是否完整；
- devtools / 音频注册表 / bundled i18n 是否是可用状态，而不是删残或断链状态；
- 语言包是否存在明显缺失导致基础页面测试失效。

### 3. 只读结论

- 本轮未发现新的明确 POD 回滚残留。
- 当前实现里可以确认：
  - `App.tsx` 仍保留路由、Provider 装配、`TestHarness.init()`、全局 HUD / Toast / Modal / ErrorBoundary 等主入口；
  - `shared/chat.ts` 相关现成测试通过，未见 POD 造成的协议回退；
  - `readyCheckPlugin`、`audioUtils`、基础页面测试都通过，说明入口/工具/基础页面尾项当前未见被 POD 回滚破坏；
  - `src/games/dicethrone/rule/王权骰铸规则.md` 当前仍是完整规则文档，不是被删残的空壳；
  - locale 文件当前仍包含本轮复核涉及的关键键（如 `feedback`、`leaderboard`、`socket`、`rematch`、`chat`、`watchOut`、`volley`、`pirate`、`baseScored` 等）；
  - `registry-slim.json`、`zh-CN-bundled.ts` 与 `AudioBrowser` 当前至少处于可加载、可被上层依赖使用的状态。

### 4. 验证

```bash
npx vitest run src/components/social/__tests__/chatMessageValidation.test.ts src/components/social/__tests__/chatSelectionLogic.test.ts src/lib/audio/__tests__/audioUtils.test.ts src/lib/__tests__/readyCheckPlugin.test.ts src/pages/__tests__/NotFound.test.tsx src/pages/__tests__/Maintenance.test.tsx
```

结果：6 个文件全部通过，共 30 条用例通过。

---

## 十四、框架 / 特效 / ActionLog 尾项复核（POD 口径，只读）

### 1. 复核文件

- `src/components/game/framework/CharacterSelectionSkeleton.tsx`
- `src/components/game/framework/hooks/useAutoSkipPhase.ts`
- `src/components/game/framework/widgets/GameDebugPanel.tsx`
- `src/engine/fx/useFxBus.ts`
- `src/engine/primitives/actionLogHelpers.ts`
- `src/core/AssetLoader.ts`
- `src/lib/utils.ts`

### 2. 本轮重点核对内容

- 角色选择骨架屏、自动跳阶段、调试面板这些框架尾项是否被 POD 删残或断链；
- `useFxBus` 当前是否仍保留 FX cue 注册、超时兜底与 impact 回调保护，而不是被回滚成“只发不收”；
- `actionLogHelpers` 是否仍承担统一格式化职责，避免 UI / 游戏层各自分叉一套；
- `AssetLoader` 的关键资源预加载、失败回退与音频资源装载链是否仍完整；
- `lib/utils.ts` 当前是否还是上层通用依赖可安全调用的实现，而不是被 POD 删空。

### 3. 只读结论

- 本轮未发现新的明确 POD 回滚残留。
- 当前实现里可以确认：
  - `CharacterSelectionSkeleton.tsx` 仍是完整骨架屏实现，不是被删成占位空组件；
  - `useAutoSkipPhase.ts` 仍保留自动跳阶段的门控与清理逻辑，未见 POD 造成的“无条件推进”回退；
  - `GameDebugPanel.tsx` 仍是可用调试面板，不是被删残的空壳；
  - `useFxBus.ts` 仍保留 renderer 超时兜底与未调用 `onImpact` 的保护链，未见 FX 总线残缺；
  - `actionLogHelpers.ts` 仍作为统一 ActionLog 格式化入口被测试覆盖，未见被 POD 打散；
  - `AssetLoader.ts` 当前仍保留关键图片预加载、失败回退、音频预加载与 resolver 降级链；
  - `src/lib/utils.ts` 当前虽有用户活跃改动上下文，但本轮只读复核未发现明确可归因到 POD 的回滚痕迹。

### 4. 验证

```bash
npx vitest run src/core/__tests__/AssetLoader.test.ts src/core/__tests__/AssetLoader.preload.test.ts src/core/__tests__/AssetLoader.audio.test.ts src/lib/__tests__/i18n-check.test.ts src/components/game/framework/__tests__/CriticalImageGate.test.tsx src/components/game/framework/__tests__/TutorialSelectionGate.test.tsx src/components/__tests__/actionLogFormat.test.ts src/games/dicethrone/__tests__/actionLogFormat.test.ts src/games/smashup/__tests__/actionLogFormat.test.ts src/components/game/framework/__tests__/InteractionGuard.test.ts src/components/game/framework/hooks/__tests__/useVisualStateBuffer.test.ts src/components/game/framework/hooks/__tests__/useVisualSequenceGate.test.ts
```

结果：12 个文件全部通过，共 61 条用例通过。

说明：

- `i18n-check.test.ts` 运行时仍会输出一批既有的 `ambiguous-namespace` / `dynamic-key` 提示，但测试本身通过；
- 这些提示本轮只作为现状记录，不直接构成 POD 回滚证据；
- `AssetLoader.preload.test.ts` 中的失败/超时日志来自测试刻意构造的回退场景，属于预期覆盖，不是新增故障。

---

## 十五、SmashUp UI 特写 / 提示链复核（POD 口径，只读）

### 1. 复核文件

- `src/games/smashup/Board.tsx`
- `src/games/smashup/ui/PromptOverlay.tsx`
- `src/games/smashup/ui/RevealOverlay.tsx`
- `src/games/smashup/ui/SmashUpOverlayContext.tsx`
- `src/games/smashup/ui/cardPreviewHelper.ts`

### 2. 本轮重点核对内容

- `Board.tsx` 是否仍保留 `SmashUpOverlayProvider` → `RevealOverlay` → `PromptOverlay` → `CardSpotlightQueue` 的主渲染链；
- `PromptOverlay.tsx` 是否仍保留基于 `CardPreview` / `CardMagnifyOverlay` 的上下文预览与选项预览，而不是被 POD 回滚成“只有文本无卡面”；
- `RevealOverlay.tsx` 是否仍消费事件流并按查看权限显示展示卡牌，而不是展示链被删断；
- `SmashUpOverlayContext.tsx` 是否仍保留英文卡图中文覆盖层开关与派系选择上下文；
- `cardPreviewHelper.ts` 是否仍保留从 `cardId/defId` 映射预览引用的统一入口。

### 3. 只读结论

- 本轮未发现新的明确 POD 回滚残留。
- 当前实现里可以确认：
  - `Board.tsx` 仍在顶层包裹 `SmashUpOverlayProvider`，并继续挂载 `CardSpotlightQueue`、`RevealOverlay`、`CardMagnifyOverlay`、`PromptOverlay`；
  - `PromptOverlay.tsx` 当前仍保留 `displayCards` / context preview / 选项卡牌预览 / 放大镜链路，没有出现“提示还在但卡面特写节点被删掉”的迹象；
  - `RevealOverlay.tsx` 当前仍基于事件流消费 `REVEAL_*` 事件、执行 viewer 权限过滤并渲染卡牌展示队列；
  - `SmashUpOverlayContext.tsx` 当前仍保留本地持久化的覆盖层开关和已选派系列表，不是被删残的空 Context；
  - `cardPreviewHelper.ts` 当前仍统一把卡牌/基地 `defId` 映射到 `smashup-card-renderer` 预览引用，没有发现预览入口被 POD 拆散。

### 4. 验证

```bash
npx vitest run src/games/smashup/__tests__/promptSystem.test.ts src/games/smashup/__tests__/promptResponseChain.test.ts src/games/smashup/__tests__/interactionChainE2E.test.ts
```

结果：3 个文件通过，共 62 条用例通过，1 条 skipped。

说明：

- 这组测试主要证明 Prompt / Interaction / 多步选择链仍闭环可走，不把它夸大成完整 E2E 视觉验收；
- `RevealOverlay.tsx` 当前仍存在较多直接 `console.log` 调试输出，但本轮没有把它归因为 POD 回滚；当前只记录现状，不和用户活跃修复混淆。

---

## 十六、Summoner Wars UI / 交互模式链复核（POD 口径，只读）

### 1. 复核文件

- `src/games/summonerwars/Board.tsx`
- `src/games/summonerwars/ui/StatusBanners.tsx`
- `src/games/summonerwars/ui/modeTypes.ts`

### 2. 本轮重点核对内容

- `Board.tsx` 是否仍保留棋盘主界面、`StatusBanners`、`useGameEvents`、`useFxBus`、放大镜/选择浮层等主装配链；
- `StatusBanners.tsx` 是否仍消费能力模式与事件卡模式，负责把多步交互提示暴露给 UI；
- `modeTypes.ts` 是否仍保留事件卡 / 技能多步骤交互的共享类型，避免 UI 与领域层脱节。

### 3. 只读结论

- 本轮未发现新的明确 POD 回滚残留。
- 当前实现里可以确认：
  - `Board.tsx` 仍完整挂载 `StatusBanners`、`BoardGrid`、`useGameEvents`、`useCellInteraction`、`useFxBus` 等关键链路；
  - `StatusBanners.tsx` 当前仍覆盖大量能力模式提示分支，没有出现“模式还在、提示节点被删掉”的明显回滚；
  - `modeTypes.ts` 当前仍维持事件卡模式与技能模式的共享状态定义，未见 POD 造成的类型链断裂。

### 4. 验证

```bash
npx vitest run src/games/summonerwars/__tests__/abilities-trickster-execute.test.ts src/games/summonerwars/__tests__/interaction-chain-comprehensive.test.ts src/games/summonerwars/__tests__/entity-chain-integrity.test.ts
```

结果：3 个文件全部通过，共 196 条用例通过。

说明：

- 原本尝试运行 `triggerEntryAudit.test.ts` / `interactionChainAudit.test.ts`，但项目 Vitest 配置会过滤 `*audit*.test.ts`；
- 因此本轮实际采用未被过滤、且覆盖同类交互链的现成测试作为验证依据，避免把“命令没跑到”误记成已验证。

---

## 十七、DiceThrone 游戏装配 / 规则 / 动效钩子复核（POD 口径，只读）

### 1. 复核文件

- `src/games/dicethrone/game.ts`
- `src/games/dicethrone/hooks/useAnimationEffects.ts`
- `src/games/dicethrone/domain/rules.ts`
- `src/games/dicethrone/debug-config.tsx`

### 2. 本轮重点核对内容

- `game.ts` 是否仍保留 `CharacterSelectionSystem`、`FlowSystem`、`ResponseWindowSystem`、`InteractionSystem`、ActionLog 格式化与 card preview 注册链；
- `domain/rules.ts` 是否仍完整保留 `getActiveDice`、`getRollerId`、`canAdvancePhase`、`getNextPhase` 等核心规则入口；
- `useAnimationEffects.ts` 是否仍基于 `useEventStreamCursor` + 视觉缓冲 + FX impact 映射消费事件流，而不是被 POD 删成半截；
- `debug-config.tsx` 是否仍是完整调试面板，不是被删残的空壳。

### 3. 只读结论

- 本轮未发现新的明确 POD 回滚残留。
- 当前实现里可以确认：
  - `game.ts` 仍保留 DiceThrone 的系统装配主链、命令分类校验、ActionLog 格式化与卡牌预览注册；
  - `rules.ts` 仍保留投掷者判定、阶段推进门禁与阶段流转分支，未见被 POD 删坏的明显缺口；
  - `useAnimationEffects.ts` 当前仍通过 `useEventStreamCursor`、`useVisualStateBuffer`、`fxImpactMapRef` 等结构消费伤害/治疗/CP 事件，没有出现“事件有了但视觉层被删断”的静态迹象；
  - `debug-config.tsx` 当前仍是完整可操作的作弊/调试面板，未见 POD 误删。

### 4. 验证

```bash
npx vitest run src/games/dicethrone/__tests__/audio.config.test.ts src/games/dicethrone/__tests__/card-system.test.ts src/games/dicethrone/__tests__/boundaryEdgeCases.test.ts src/games/dicethrone/__tests__/cross-hero.test.ts
```

结果：4 个文件通过，共 68 条用例通过，1 条 skipped。

说明：

- 运行期间出现的 `Pipeline` 命令验证失败日志（如 `notEnoughCp`、`upgradeCardSkipLevel`、`roll_limit_reached`）来自测试显式覆盖的拒绝路径，属于预期断言，不是新增红灯；
- 本轮仍维持“只读优先”策略，未直接改动 DiceThrone 业务文件，避免和你当前正在做的修复冲突。

---

## 十八、引擎尾项：事件流 / 撤回 / 选择 / 传输契约复核（POD 口径，只读）

### 1. 复核文件

- `src/engine/hooks/useEventStreamCursor.ts`
- `src/engine/primitives/damageCalculation.ts`
- `src/engine/systems/SimpleChoiceSystem.ts`
- `src/engine/systems/UndoSystem.ts`
- `src/engine/transport/latency/optimisticEngine.ts`
- `src/engine/transport/protocol.ts`
- `src/engine/transport/storage.ts`
- `src/engine/types.ts`

### 2. 本轮重点核对内容

- `useEventStreamCursor.ts` 是否仍保留“首次挂载跳过历史 / Undo 回退重置 / 乐观回滚信号兼容”这条通用消费语义；
- `damageCalculation.ts` 是否仍作为统一伤害计算入口，而不是被拆回到各游戏各自算；
- `SimpleChoiceSystem.ts` / `UndoSystem.ts` 是否仍保留引擎层的通用交互与撤回职责，没有被 POD 删残；
- `optimisticEngine.ts` 是否仍保留 pending 队列、预测重放、stateID 对账与 reconcile 逻辑；
- `protocol.ts` / `storage.ts` / `types.ts` 是否仍维持前后端传输、存储、系统状态的基础契约。

### 3. 只读结论

- 本轮未发现新的明确 POD 回滚残留。
- 当前实现里可以确认：
  - `useEventStreamCursor.ts` 仍保留 Undo 回退、乐观回滚、重连场景的游标复位语义；
  - `damageCalculation.ts` 当前仍是统一的伤害分解入口，没有明显被 POD 打散；
  - `SimpleChoiceSystem.ts` 与 `UndoSystem.ts` 仍由引擎层统一提供，不是被删成“游戏各自兜底”；
  - `optimisticEngine.ts` 当前仍保留 pending 命令预测、重放与 reconcile 主链；
  - `protocol.ts`、`storage.ts`、`types.ts` 当前仍是完整契约定义，未见 POD 造成的关键字段缺口。

### 4. 验证

```bash
npx vitest run src/engine/hooks/__tests__/useEventStreamCursor.test.ts src/engine/primitives/__tests__/damageCalculation.test.ts src/engine/__tests__/undo-eventstream.test.ts src/engine/systems/__tests__/InteractionSystem-auto-injection.test.ts src/engine/transport/latency/__tests__/optimisticEngine.test.ts src/engine/transport/__tests__/stateValidator.test.ts
```

结果：全部通过（本轮与下节合并统计共 209 条用例通过，0 失败）。

说明：

- `InteractionSystem-auto-injection.test.ts` 本轮作为 `SimpleChoiceSystem` 相关行为的现成覆盖；
- `undo-eventstream.test.ts` 直接覆盖撤回恢复与事件流协同；
- `protocol.ts` / `storage.ts` / `types.ts` 这类契约文件本轮仍以静态复核为主，没有额外新增专门测试文件。

---

## 十九、SmashUp 数据 / 注册 / 基地结算主链复核（POD 口径，只读）

### 1. 复核文件

- `src/games/smashup/abilities/index.ts`
- `src/games/smashup/abilities/aliens.ts`
- `src/games/smashup/abilities/cthulhu.ts`
- `src/games/smashup/abilities/ghosts.ts`
- `src/games/smashup/abilities/vampires.ts`
- `src/games/smashup/data/cards.ts`
- `src/games/smashup/domain/abilityRegistry.ts`
- `src/games/smashup/domain/baseAbilities.ts`
- `src/games/smashup/domain/events.ts`
- `src/games/smashup/game.ts`

### 2. 本轮重点核对内容

- `abilities/index.ts` 是否仍完整注册基础派系、扩展派系、基地能力、持续修正与 `_pod` 别名映射；
- `abilityRegistry.ts` 是否仍保留 `registerPodAbilityAliases()` 这条 POD 兼容主链；
- `data/cards.ts` 是否仍作为卡牌/基地定义与名称文本解析的统一入口；
- `baseAbilities.ts` 是否仍保留基地能力注册与交互处理器主链；
- `game.ts` 是否仍保留响应窗口、ActionLog、预览注册、关键图片解析器注册等装配；
- `aliens / cthulhu / ghosts / vampires` 是否仍是完整能力实现，而不是被 POD 留下半截注册。

### 3. 只读结论

- 本轮未发现新的明确 POD 回滚残留。
- 当前实现里可以确认：
  - `abilities/index.ts` 当前仍完整执行注册表清理、派系能力注册、基地能力注册、持续效果注册，以及 `_pod` 能力/交互/持续效果/力量修正别名注册；
  - `abilityRegistry.ts` 当前仍通过统一批量映射为 `_pod` 版本复制能力标签，没有出现 POD 版逻辑入口整体丢失的迹象；
  - `data/cards.ts` 当前仍提供 `getCardDef` / `getBaseDef` / `resolveCardName` / `resolveCardText` 的统一查询入口；
  - `baseAbilities.ts` 当前仍保留基地能力与交互处理器注册主链，没有静态缺口；
  - `game.ts` 当前仍保留 `meFirst / afterScoring` 响应窗口门控、卡牌预览注册与关键图片解析器注册；
  - `game.ts` 中 `hasRespondableContent` 还有直接 `console.log` 调试输出，但本轮未把它归因为 POD 回滚，只作现状记录。

### 4. 验证

```bash
npx vitest run src/games/smashup/__tests__/factionAbilities.test.ts src/games/smashup/__tests__/expansionAbilities.test.ts src/games/smashup/__tests__/ghostsAbilities.test.ts src/games/smashup/__tests__/cthulhuExpansionAbilities.test.ts src/games/smashup/__tests__/baseAbilityIntegration.test.ts src/games/smashup/__tests__/baseScoring.test.ts src/games/smashup/__tests__/alien-probe-bug.test.ts
```

结果：全部通过（本轮与上节合并统计共 209 条用例通过，0 失败）。

说明：

- 运行时出现的 `invalid_command` 等验证失败日志来自测试刻意覆盖的拒绝路径，属于预期输出，不是新增回归；
- 本轮重点证明“能力注册 → 基地能力 → 响应窗口 → 计分/特定派系能力”这条主链当前仍可走通，不夸大成对全部 UI 视觉表现的终验。

---

## 二十、DiceThrone 支撑链：执行 / Token / 英雄数据 / UI 适配复核（POD 口径，只读）

### 1. 复核文件

- `src/games/dicethrone/audio.config.ts`
- `src/games/dicethrone/criticalImageResolver.ts`
- `src/games/dicethrone/domain/characters.ts`
- `src/games/dicethrone/domain/commands.ts`
- `src/games/dicethrone/domain/commonCards.ts`
- `src/games/dicethrone/domain/execute.ts`
- `src/games/dicethrone/domain/executeCards.ts`
- `src/games/dicethrone/domain/systems.ts`
- `src/games/dicethrone/domain/tokenResponse.ts`
- `src/games/dicethrone/domain/tokenTypes.ts`
- `src/games/dicethrone/domain/utils.ts`
- `src/games/dicethrone/domain/view.ts`
- `src/games/dicethrone/heroes/barbarian/cards.ts`
- `src/games/dicethrone/heroes/monk/cards.ts`
- `src/games/dicethrone/heroes/moon_elf/cards.ts`
- `src/games/dicethrone/heroes/moon_elf/tokens.ts`
- `src/games/dicethrone/heroes/pyromancer/abilities.ts`
- `src/games/dicethrone/heroes/pyromancer/cards.ts`
- `src/games/dicethrone/heroes/pyromancer/tokens.ts`
- `src/games/dicethrone/heroes/shadow_thief/abilities.ts`
- `src/games/dicethrone/heroes/shadow_thief/cards.ts`
- `src/games/dicethrone/heroes/shadow_thief/tokens.ts`
- `src/games/dicethrone/hooks/useAttackShowcase.ts`
- `src/games/dicethrone/latencyConfig.ts`
- `src/games/dicethrone/manifest.ts`
- `src/games/dicethrone/tutorial.ts`
- `src/games/dicethrone/ui/CenterBoard.tsx`
- `src/games/dicethrone/ui/CharacterSelectionAdapter.tsx`
- `src/games/dicethrone/ui/HandArea.tsx`
- `src/games/dicethrone/ui/OpponentHeader.tsx`
- `src/games/dicethrone/ui/TokenResponseModal.tsx`
- `src/games/dicethrone/ui/fxSetup.ts`
- `src/games/dicethrone/ui/resolveMoves.ts`

### 2. 本轮重点核对内容

- `execute.ts` / `executeCards.ts` / `commands.ts` 是否仍保留业务命令 → 事件生成 → 卡牌结算主链；
- `tokenResponse.ts` / `tokenTypes.ts` / `systems.ts` 是否仍保留 Token 响应窗口、可用 Token 筛选与结算逻辑；
- `characters.ts`、英雄 `cards.ts / abilities.ts / tokens.ts` 是否仍维持角色数据注册、起始牌组、Token 定义与能力升级链；
- `view.ts` 是否仍保留隐藏对手手牌/牌库的视图过滤；
- `audio.config.ts`、`criticalImageResolver.ts`、`manifest.ts`、`tutorial.ts`、`fxSetup.ts` 是否仍保留资源预加载、关键图片、教程与 FX 注册主链；
- `useAttackShowcase.ts`、`TokenResponseModal.tsx`、`resolveMoves.ts`、`CenterBoard.tsx` 等 UI 适配层是否仍接在正确的状态与命令链上。

### 3. 只读结论

- 本轮未发现新的明确 POD 回滚残留。
- 当前实现里可以确认：
  - `execute.ts` 仍负责角色初始化、掷骰、技能选择、卡牌/Token 命令分派与教程场景特殊处理；
  - `executeCards.ts` 当前仍统一处理 `PLAY_CARD` / `PLAY_UPGRADE_CARD` 等卡牌命令及 CP 资源扣减；
  - `tokenResponse.ts` 当前仍保留可用 Token 查询、使用/跳过 Token 的事件生成与 Ultimate/可防御条件门控；
  - `characters.ts` 与多名英雄的 `cards / abilities / tokens` 当前仍完整注册起始牌组、状态图集、初始 Token 与升级能力定义，没有静态缺口；
  - `view.ts` 仍保留对手手牌/牌库隐藏逻辑；
  - `useAttackShowcase.ts` 当前仍基于 `pendingAttack` + `findPlayerAbility` 构建防御前技能特写数据；
  - `manifest.ts`、`tutorial.ts`、`fxSetup.ts`、`resolveMoves.ts` 当前仍是完整适配层，不是被 POD 删残的空壳。

### 4. 验证

```bash
npx vitest run src/games/dicethrone/__tests__/audio.config.test.ts src/games/dicethrone/__tests__/entity-chain-integrity.test.ts src/games/dicethrone/__tests__/card-system.test.ts src/games/dicethrone/__tests__/pyromancer-tokens.test.ts src/games/dicethrone/__tests__/shield-cleanup.test.ts src/games/dicethrone/__tests__/steal-cp.test.ts src/games/dicethrone/__tests__/targeted-defense-damage.test.ts src/games/dicethrone/__tests__/token-fix-coverage.test.ts
```

结果：8 个文件通过，共 135 条用例通过，1 条 skipped。

说明：

- 测试输出中的 `ability_not_available`、`notEnoughCp`、`upgradeCardSkipLevel`、`wrongPhaseForUpgrade`、`no_pending_damage` 等日志都来自拒绝路径断言，属于预期覆盖；
- 本轮刻意避开了工作树中有活跃修改的 `src/games/dicethrone/hooks/useCardSpotlight.ts`，避免把你当前正在修的特写链误记成 POD 残留。

---

## 二十一、SmashUp 派系 / ongoing / 计分主链续查（POD 口径，只读）

### 1. 复核文件

- `src/games/smashup/abilities/bear_cavalry.ts`
- `src/games/smashup/abilities/dinosaurs.ts`
- `src/games/smashup/abilities/elder_things.ts`
- `src/games/smashup/abilities/frankenstein.ts`
- `src/games/smashup/abilities/giant_ants.ts`
- `src/games/smashup/abilities/innsmouth.ts`
- `src/games/smashup/abilities/miskatonic.ts`
- `src/games/smashup/abilities/ninjas.ts`
- `src/games/smashup/abilities/ongoing_modifiers.ts`
- `src/games/smashup/abilities/robots.ts`
- `src/games/smashup/abilities/steampunks.ts`
- `src/games/smashup/abilities/tricksters.ts`
- `src/games/smashup/abilities/zombies.ts`
- `src/games/smashup/audio.config.ts`
- `src/games/smashup/data/factions/aliens.ts`
- `src/games/smashup/data/factions/aliens_pod.ts`
- `src/games/smashup/data/factions/cthulhu.ts`
- `src/games/smashup/data/factions/cthulhu_pod.ts`
- `src/games/smashup/data/factions/ninjas.ts`
- `src/games/smashup/data/factions/pirates.ts`
- `src/games/smashup/domain/abilityHelpers.ts`
- `src/games/smashup/domain/abilityInteractionHandlers.ts`
- `src/games/smashup/domain/baseAbilities_expansion.ts`
- `src/games/smashup/domain/commands.ts`
- `src/games/smashup/domain/ids.ts`
- `src/games/smashup/domain/ongoingEffects.ts`
- `src/games/smashup/domain/ongoingModifiers.ts`
- `src/games/smashup/domain/reducer.ts`
- `src/games/smashup/domain/types.ts`
- `src/games/smashup/ui/CardMagnifyOverlay.tsx`
- `src/games/smashup/ui/DeckDiscardZone.tsx`
- `src/games/smashup/ui/FactionSelection.tsx`
- `src/games/smashup/ui/HandArea.tsx`
- `src/games/smashup/ui/SmashUpCardRenderer.tsx`
- `src/games/smashup/ui/cardAtlas.ts`
- `src/games/smashup/ui/factionMeta.ts`
- `src/games/smashup/ui/playerConfig.ts`

### 2. 本轮重点核对内容

- 各扩展派系能力文件是否仍保留注册函数与交互处理入口；
- `ongoing_modifiers.ts`、`ongoingEffects.ts`、`ongoingModifiers.ts` 是否仍维持持续效果 / 力量修正 / 保护限制主链；
- `commands.ts`、`reducer.ts`、`types.ts` 是否仍保留出牌验证、事件消费与核心数据结构定义；
- `baseAbilities_expansion.ts` 是否仍保留扩展基地能力和交互处理链；
- `data/factions/*.ts` 与 `_pod` 文件是否仍保留 POD 版派系数据，不是被删空的占位；
- `FactionSelection / HandArea / CardMagnifyOverlay / SmashUpCardRenderer / cardAtlas / factionMeta / playerConfig` 等 UI 支撑节点是否仍接在完整数据链上。

### 3. 只读结论

- 本轮未发现新的明确 POD 回滚残留。
- 当前实现里可以确认：
  - 多个扩展派系能力文件当前仍保留注册函数和交互处理逻辑，没有出现“数据还在、能力入口被删”的静态迹象；
  - `ongoing_modifiers.ts` 仍注册了随从、ongoing 行动卡、基地持续修正与保护相关规则；
  - `commands.ts` 当前仍保留 `meFirst`、弃牌堆出牌、ongoing 限制、特殊时机等关键验证分支；
  - `reducer.ts`、`types.ts` 仍是完整核心状态与事件消费主链，没有看见 POD 造成的结构性缺口；
  - `baseAbilities_expansion.ts` 当前仍保留扩展基地能力与其交互处理；
  - `ui/CardMagnifyOverlay.tsx`、`DeckDiscardZone.tsx`、`FactionSelection.tsx`、`HandArea.tsx`、`SmashUpCardRenderer.tsx`、`cardAtlas.ts`、`factionMeta.ts`、`playerConfig.ts` 当前仍是可用支撑实现，不是空壳。

### 4. 验证

```bash
npx vitest run src/games/smashup/__tests__/baseFactionOngoing.test.ts src/games/smashup/__tests__/baseProtection.test.ts src/games/smashup/__tests__/baseScoreCheck.test.ts src/games/smashup/__tests__/baseScoredNormalFlow.test.ts src/games/smashup/__tests__/baseScoredOptimistic.test.ts src/games/smashup/__tests__/baseScoredRaceCondition.test.ts src/games/smashup/__tests__/duplicateInteractionRespond.test.ts src/games/smashup/__tests__/elderThingAbilities.test.ts src/games/smashup/__tests__/expansionBaseAbilities.test.ts src/games/smashup/__tests__/expansionOngoing.test.ts src/games/smashup/__tests__/meFirst.test.ts src/games/smashup/__tests__/newBaseAbilities.test.ts src/games/smashup/__tests__/newFactionAbilities.test.ts src/games/smashup/__tests__/ongoingEffects.test.ts src/games/smashup/__tests__/query6Abilities.test.ts src/games/smashup/__tests__/turnTransitionInteractionBug.test.ts src/games/smashup/__tests__/zombieInteractionChain.test.ts src/games/smashup/__tests__/zombieWizardAbilities.test.ts
```

结果：18 个文件通过，共 372 条用例通过，1 条 skipped。

说明：

- 运行期间出现的 `该卡牌不能从弃牌堆打出到此基地`、`该基地禁止打出该随从` 等日志来自拒绝路径断言，属于预期覆盖；
- `newFactionAbilities.test.ts` 中出现的 `BASE_REPLACED ... newBaseDefId base_c not found in baseDeck` 日志本轮仅记为测试构造场景输出，测试整体通过，暂不作为 POD 回滚证据；
- 本轮刻意未动工作树中有活跃修改的 `src/games/smashup/ui/BaseZone.tsx`，避免和你正在进行的修复冲突。

---

## 二十二、SmashUp POD 阵营数据与尾测收尾（POD 口径，只读）

### 1. 复核文件

- `src/games/smashup/data/englishAtlasMap.json`
- `src/games/smashup/data/factions/bear_cavalry_pod.ts`
- `src/games/smashup/data/factions/dinosaurs_pod.ts`
- `src/games/smashup/data/factions/elder_things_pod.ts`
- `src/games/smashup/data/factions/frankenstein_pod.ts`
- `src/games/smashup/data/factions/ghosts_pod.ts`
- `src/games/smashup/data/factions/giant-ants_pod.ts`
- `src/games/smashup/data/factions/innsmouth_pod.ts`
- `src/games/smashup/data/factions/killer_plants_pod.ts`
- `src/games/smashup/data/factions/miskatonic_pod.ts`
- `src/games/smashup/data/factions/ninjas_pod.ts`
- `src/games/smashup/data/factions/pirates_pod.ts`
- `src/games/smashup/data/factions/robots_pod.ts`
- `src/games/smashup/data/factions/steampunks_pod.ts`
- `src/games/smashup/data/factions/tricksters_pod.ts`
- `src/games/smashup/data/factions/vampires_pod.ts`
- `src/games/smashup/data/factions/werewolves_pod.ts`
- `src/games/smashup/data/factions/wizards_pod.ts`
- `src/games/smashup/data/factions/zombies_pod.ts`
- `src/games/smashup/__tests__/baseAbilityIntegrationE2E.test.ts`
- `src/games/smashup/__tests__/bigGulpDroneIntercept.test.ts`
- `src/games/smashup/__tests__/madnessAbilities.test.ts`
- `src/games/smashup/__tests__/madnessPromptAbilities.test.ts`
- `src/games/smashup/__tests__/ongoingE2E.test.ts`
- `src/games/smashup/__tests__/promptE2E.test.ts`
- `src/games/smashup/__tests__/properties/coreProperties.test.ts`
- `src/games/smashup/__tests__/shoggoth-destroy-choice.test.ts`
- `src/games/smashup/__tests__/sleep-spores-e2e.test.ts`
- `src/games/smashup/__tests__/specialInteractionChain.test.ts`
- `src/games/smashup/__tests__/vampireBuffetE2E.test.ts`

### 2. 本轮重点核对内容

- 余下的 `_pod` 阵营数据文件是否仍是完整的 minion/action/card 定义，而不是被 POD 自己删成残缺版本；
- `englishAtlasMap.json` 是否仍作为英文卡图映射数据存在；
- 余下的尾测是否仍能覆盖疯狂牌、Prompt、ongoing、特殊交互链、Shoggoth 选择权、POD/特殊基地交互等场景。

### 3. 只读结论

- 本轮未发现新的明确 POD 回滚残留。
- 当前实现里可以确认：
  - 余下 `_pod` 阵营文件当前仍保留完整的卡牌数据数组与 atlas 预览引用，没有静态缺口；
  - `englishAtlasMap.json` 当前仍存在，未见英文图集映射被删空；
  - 这批尾测所覆盖的 madness / prompt / ongoing / 特殊交互链 / 属性协议 场景当前仍能跑通；
  - `vampireBuffetE2E.test.ts` 当前存在但为 skipped 状态，本轮只记现状，不夸大成已执行通过。

### 4. 验证

```bash
npx vitest run src/games/smashup/__tests__/baseAbilityIntegrationE2E.test.ts src/games/smashup/__tests__/bigGulpDroneIntercept.test.ts src/games/smashup/__tests__/madnessAbilities.test.ts src/games/smashup/__tests__/madnessPromptAbilities.test.ts src/games/smashup/__tests__/ongoingE2E.test.ts src/games/smashup/__tests__/promptE2E.test.ts src/games/smashup/__tests__/properties/coreProperties.test.ts src/games/smashup/__tests__/shoggoth-destroy-choice.test.ts src/games/smashup/__tests__/sleep-spores-e2e.test.ts src/games/smashup/__tests__/specialInteractionChain.test.ts src/games/smashup/__tests__/vampireBuffetE2E.test.ts
```

结果：10 个文件通过，1 个文件 skipped；共 173 条用例通过，2 条 skipped。

说明：

- `specialInteractionChain.test.ts` 中出现的“该基地禁止打出该随从”“该卡牌不能从弃牌堆打出到此基地”等日志来自拒绝路径断言；
- 这批文件里仍有少量命名带 `E2E` 的 Vitest 集成测试，但本轮只把它们当作现成自动化覆盖，不把它们当成真正浏览器端到端验收。

---

## 二十三、SmashUp 最后 4 个尾项补记（POD 口径，只读）

### 1. 复核文件

- `src/games/smashup/__tests__/alienAuditFixes.test.ts`
- `src/games/smashup/__tests__/choice-audit-fixes.test.ts`
- `src/games/smashup/__tests__/helpers.ts`
- `src/games/smashup/__tests__/ui-interaction-manual.test.ts`

### 2. 本轮重点核对内容

- `alienAuditFixes.test.ts`、`choice-audit-fixes.test.ts` 是否仍是有效的回归测试文件，而不是被删残或空壳；
- `helpers.ts` 是否仍提供测试构造用的共享工具，不是断裂的辅助层；
- `ui-interaction-manual.test.ts` 是否仍能验证 UI 交互选项结构。

### 3. 只读结论

- 本轮未发现新的明确 POD 回滚残留。
- 当前实现里可以确认：
  - `alienAuditFixes.test.ts` 仍覆盖外星人派系若干审计修复回归场景；
  - `choice-audit-fixes.test.ts` 仍是有效回归测试文件；
  - `helpers.ts` 当前仍为 SmashUp 测试提供共享建模/构造工具；
  - `ui-interaction-manual.test.ts` 当前仍可运行并验证若干交互选项结构。

### 4. 验证

```bash
npx vitest run src/games/smashup/__tests__/ui-interaction-manual.test.ts
```

结果：1 个文件通过，共 3 条用例通过。

说明：

- `alienAuditFixes.test.ts`、`choice-audit-fixes.test.ts` 的文件名命中当前项目 Vitest 排除规则 `*audit*.test.ts`，本轮无法通过现有默认命令直接执行，因此只做静态复核并在此明确记录；
- `ui-interaction-manual.test.ts` 虽命名为“manual”，但当前仍是可自动运行的 Vitest 文件，本轮已实际执行通过。

---

## 二十四、DiceThrone 最后 7 项收尾（POD 口径，只读）

### 1. 复核文件

- `src/games/dicethrone/__tests__/defense-trigger-audit.test.ts`
- `src/games/dicethrone/__tests__/pyromancer-damage.property.test.ts`
- `src/games/dicethrone/__tests__/tutorial-e2e.test.ts`
- `src/games/dicethrone/domain/combat/CombatAbilityManager.ts`
- `src/games/dicethrone/domain/combat/types.ts`
- `src/games/dicethrone/domain/customActions/pyromancer.ts`
- `src/games/dicethrone/domain/ids.ts`

### 2. 本轮重点核对内容

- `CombatAbilityManager.ts` / `combat/types.ts` 是否仍保留战斗能力建模和执行支撑；
- `customActions/pyromancer.ts` 是否仍保留炎术士自定义动作实现；
- `ids.ts` 是否仍维护状态、Token、骰面、图集、命令等统一常量；
- 剩余 3 个测试文件是否仍保留有效覆盖，尤其教程链和防御触发/伤害属性边界。

### 3. 只读结论

- 本轮未发现新的明确 POD 回滚残留。
- 当前实现里可以确认：
  - `CombatAbilityManager.ts` 与 `combat/types.ts` 仍保留战斗能力相关支撑结构；
  - `customActions/pyromancer.ts` 当前仍是炎术士自定义效果实现入口，没有静态缺口；
  - `ids.ts` 当前仍集中维护 DiceThrone 的状态/Token/骰面/图集/命令常量；
  - `tutorial-e2e.test.ts` 当前仍覆盖教程流程；
  - `defense-trigger-audit.test.ts`、`pyromancer-damage.property.test.ts` 当前文件本体仍完整，不是空壳。

### 4. 验证

```bash
npx vitest run src/games/dicethrone/__tests__/pyromancer-abilities.test.ts src/games/dicethrone/__tests__/red-hot-meteor-integration.test.ts src/games/dicethrone/__tests__/tutorial-e2e.test.ts
```

结果：全部通过，共 24 条用例通过。

说明：

- `defense-trigger-audit.test.ts` 命中文件名排除规则 `*audit*.test.ts`，`pyromancer-damage.property.test.ts` 命中 `*.property.test.ts` 排除规则；本轮对这两份文件仅做静态复核，并在此明确记录；
- `tutorial-e2e.test.ts` 虽命名含 `e2e`，但本轮作为现成 Vitest 集成测试运行通过，不把它夸大成浏览器端到端验收。

---

## 二十五、当前工作树与 POD 清单重叠项甄别（只读，不归因）

### 1. 当前重叠文件

- `public/locales/zh-CN/game-dicethrone.json`
- `src/components/lobby/GameDetailsModal.tsx`
- `src/games/dicethrone/domain/rules.ts`
- `src/games/dicethrone/hooks/useCardSpotlight.ts`
- `src/games/smashup/ui/BaseZone.tsx`
- `src/server/storage/MongoStorage.ts`
- `src/server/storage/__tests__/mongoStorage.test.ts`

### 2. 甄别结论

- 这 7 个文件当前都与 POD 清单有路径重叠，但**本轮不应直接按 POD 残留处理**。
- 只读 diff 可见的现状更像是**用户当前正在进行的修复/增强**，例如：
  - `src/games/dicethrone/domain/rules.ts`：新增“攻击修正只能用于当前攻击”的门控；
  - `src/games/dicethrone/hooks/useCardSpotlight.ts`：调整奖励骰与卡牌特写绑定策略；
  - `src/games/smashup/ui/BaseZone.tsx`：修正四人局右侧提示定位条件；
  - `src/components/lobby/GameDetailsModal.tsx`：增加确认动作防重入；
  - `src/server/storage/MongoStorage.ts` 与测试：增加脏房间清理逻辑；
  - `public/locales/zh-CN/game-dicethrone.json`：属于文案/描述修正。

### 3. 审计策略

- 这些文件后续如需继续审，必须基于“当前用户活跃改动”单独甄别，不能直接套用 POD 回滚口径；
- 在没有更强证据前，本轮明确将它们记为**活跃修复链**，不是自动回滚对象。

### 4. 本轮补充验证

```bash
npx vitest run src/components/lobby/__tests__/GameDetailsModalJoinConfirm.test.ts src/server/storage/__tests__/mongoStorage.test.ts src/server/__tests__/claimSeat.test.ts src/games/dicethrone/__tests__/BonusDieOverlay.test.tsx src/games/dicethrone/__tests__/righteous-combat-variant-selection.test.ts src/games/dicethrone/__tests__/card-system.test.ts
```

结果：6 个文件通过，共 32 条用例通过，10 条 skipped。

补充判断：

- `GameDetailsModal.tsx` 当前更像是“确认动作防重入 + claim-seat 重试链”修复，现有 lobby / claim-seat 相关测试未出现新红灯；
- `MongoStorage.ts` 与 `mongoStorage.test.ts` 当前更像是新增“脏房间清理”能力，新增清理用例通过，不应按 POD 回滚处理；
- `rules.ts` 与 `useCardSpotlight.ts` 当前相关测试（`card-system`、`BonusDieOverlay`、变体选择）均通过，更像当前修复链；
- `BaseZone.tsx` 当前没有直接对口的现成测试，本轮只做静态甄别；从 diff 看更像四人局定位修正，不像 POD 残留；
- `BonusDieOverlay.test.tsx` 运行时仍有 `whileHover` / `whileTap` 的 React 警告，但测试通过，本轮不把它记成 POD 证据。

---

## 二十六、直接对账 `pod-commit-complete-checklist`（口径校验）

### 1. 校验方法

- 直接从 `evidence/pod-commit-complete-checklist.md` 提取全部路径；
- 再与以下续查文档做字符串覆盖对账：
  - `evidence/p1-audit-followup-2026-03-10.md`
  - `evidence/p1-audit-followup-2026-03-10-batch2.md`
  - `evidence/dicethrone-audit-followup-2026-03-10.md`

### 2. 结果

- Checklist 路径总数：`336`
- 当前未在续查文档中点名的路径数：`0`

### 3. 说明

- 这一步是对“旧总表清零”之外的二次口径校验；
- 结论是：**POD 提交完整清单中的 336 个路径，当前都已经在续查文档体系中被显式覆盖/点名**。
