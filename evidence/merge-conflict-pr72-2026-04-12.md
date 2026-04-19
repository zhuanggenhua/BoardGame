# 冲突解决汇报：PR72 (smashup-extra-play-timing)

## 1. 背景
- base: main
- head: deathcats4/codex/smashup-extra-play-timing
- 触发命令: `git merge deathcats4/codex/smashup-extra-play-timing --no-commit --no-ff`

## 2. 冲突文件
- src/games/smashup/abilities/bear_cavalry.ts
- src/games/smashup/domain/index.ts
- src/games/smashup/domain/systems.ts

## 3. 冲突块裁决
### src/games/smashup/abilities/bear_cavalry.ts
- 策略：合并双方
- 冲突块裁决：
  - 泰坦压制选项：保留分支使用 titan.uid/ownerId 的正确取值，同时保留本地 defId 字段
  - CARD_SUPPRESSED payload：保留本地字段契约（suppressorPlayerId/reason/cardType）
- 原因：与 domain/types.ts 的事件契约一致，避免错误字段（suppressedBy）导致 reduce 失败

### src/games/smashup/domain/index.ts
- 策略：以分支“计分/响应窗口新流程”为主，叠加本地关键校验
- 冲突块裁决：
  - scoreOneBase：保留 matchState.core 最新快照 + beforeScoring 反应会话；补回基地锁定/断点校验
  - onTurnEnd：保留反应会话入队；补回 destroy→move 循环并修正多余括号
  - onTurnStart：保留入队式 base/ongoing 触发；补充 hasSysUpdate 标记
  - ACTION_PLAYED：保留去重与 onActionPlayed 入队触发
- 原因：保证新 Card Resolution Order/计分时序落地，同时保留现有防回归校验

### src/games/smashup/domain/systems.ts
- 策略：合并双方
- 冲突块裁决：
  - 保留 Body Shop 指示物分配逻辑（含 getCardDef）
  - 合并 afterScoring 延迟事件补发逻辑，并保持 afterEvents 处理只走 pipeline
  - reaction queue 仍使用 latestTimestamp 作为时间基准
- 原因：避免丢失已上线的分配交互，同时兼容新计分链 deferred 事件模型

## 4. 冲突后补修/回归修复
- reaction queue：
  - 兼容旧 trigger（无 resolutionClass），默认 fallback 为 mandatory
  - 可选阶段仅剩 1 个 trigger 时直接执行，避免生成 `smashup_reaction_choose` 抢占交互链
  - 补齐 reactionQueueHandlers 的 registerInteractionHandler 注册
- bury 翻开流程：
  - 始终触发 BURIED_CARD_UNCOVERED
  - ongoing 行动卡无目标时改为 discardWithoutPlay，且补齐附着逻辑
  - 翻开行动牌补齐 onPlay + onActionPlayed 基地能力触发
  - 选择随从时补 baseIndex，并修正 handler 中 state/matchState/attach 未定义问题
- scoreBases 自动推进：
  - 新增 hasBlockingLegacyResponseWindow 保护未关闭响应窗口时不自动推进
  - multi_base_scoring 交互补齐 _ai 估值提示（estimatedSwing）
- reaction choose 兼容：
  - reducer 中临时旁路 smashup_reaction_choose，避免阻断特殊牌交互链
- pirates first mate afterScoring：
  - BASE_CLEARED 后 index 漂移时，fallback 使用 scoringBaseIndex 作为 fromBaseIndex
- ongoingEffects：
  - 统一 isSourceInZones（包含 globalZones=deck）与导入遗漏修正
- 命令/导入问题：
  - responseWindow.windowType 更正为 reactionWindow.windowType
  - 补全 reactionQueueHandlers import
- 额外回归修复：
  - cthulhu_madness_unleashed：额外行动次数按真实疯狂牌数量计算
  - base_the_field_of_honor：必须有 destroyerId 才触发；本基地每回合仅首次加分
  - destroyerId 兜底：当事件缺失 destroyerId 时回退到 playerId/控制者
  - onDestroy 去重：同一 MINION_DESTROYED 不再在后续链路重复触发
  - flowHalted 归一化：scoreBases 下 null/undefined 交互状态统一为 undefined

## 5. 风险与验证
- 风险点：
  - 计分/响应窗口时序变更可能影响多基地计分与 afterScoring 链
  - onTurnStart/onTurnEnd 入队式触发可能改变旧测试期望
- 验证命令与结果：
  - `npm run i18n:check` ✅
  - `npx tsc --noEmit` ✅
  - `npx eslint src/ --ext .ts,.tsx` ✅（0 errors，存在历史 warnings）
  - 重点 vitest 回归：
    - ongoingEffects / reactionQueueDestroyerId / buryEngine / scoreBases-auto-continue ✅
    - temple-firstmate-afterscore / scoringEligibleLock ✅
    - smoke / vampiresPod / wildlifePreserveProtection 等 ✅
    - madnessPromptAbilities / newBaseAbilities / onDestroyAbilities / reactionQueueBaseOptionalClockwise ✅
    - factionAbilities ✅

## 6. 单边覆盖审计（合并提交后执行）
- `npm run merge:audit -- HEAD`
- `npm run merge:audit:strict -- HEAD`

## 7. 回归与行为变化登记
- 原 PR 目标问题：
  - Card Resolution Order 收尾接线
  - 基地计分时序/响应窗口对齐官方流程
- 本次额外发现的真实回归：
  - scoreOneBase 需使用最新 core 快照，避免计分包含已移除随从（已在合并中补回）
- 仅业务口径/规则变化：
  - onTurnStart/onTurnEnd 触发统一走入队式排序
  - afterScoring 响应窗口在 BASE_SCORED 后、BASE_CLEARED 前开启

## 8. 结果
- 当前状态：冲突已解决并暂存，待完成合并提交与 merge audit 门禁
