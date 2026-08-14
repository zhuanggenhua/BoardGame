# SmashUp watchdog `69fb3fde76f10333c15ed8d9` / `69fc62984a37805e1526f6d9` 奥术守护者 stale special 收口（2026-05-07）

## 范围

- 时间：`2026-05-07`
- 来源口径：生产 `feedbacks` 真源（SSH + `boardgame-mongodb`）
- 目标反馈：
  - `69fb3fde76f10333c15ed8d9`
  - `69fc62984a37805e1526f6d9`
- 共同文案：
  - `[system][online-ai-watchdog] force-end-turn-failed visible-interaction:recover-interaction:blocker_persisted`

## 回写前现场

- 生产快照：`temp/feedback-closeout/query-feedback-69fb3fde-69fc6298-before-writeback-20260507.raw.txt`
- 我实际核对到的共同特征：
  - 两条都还是 `status: open`
  - 两条都属于 `gameId=smashup`、`source=online-ai-watchdog`
  - 两条的 `aggregationKey` 都落在：
    - `scoreBases -> simple-choice -> smashup_reaction_choose -> blocker_persisted`
  - 两条 `stateSnapshot` 里都存在同一类 live 选项：
    - `activate_special:titan:titan_*_wizards_arcane_protector:*`
    - `pass`
  - 两条 `aiDecisionPreview` 都倾向继续选 `奥术守护者 特殊能力`

### 69fb3fde...

- `trackerKey`：
  - `3:visible-interaction:interaction:3:scoreBases:simple-choice:smashup_reaction_choose:ui.reaction_choose_optional_title::2`
- 现场暴露的错误候选：
  - `activate_special:titan:titan_3_wizards_arcane_protector:2`
  - `pass`

### 69fc6298...

- `trackerKey`：
  - `2:visible-interaction:interaction:2:scoreBases:simple-choice:smashup_reaction_choose:ui.reaction_choose_optional_title::2`
- 现场暴露的错误候选：
  - `activate_special:titan:titan_2_wizards_arcane_protector:0`
  - `pass`

## 根因

- 这不是 2026-05-04 已修的 `mandatory stale reaction choice`，也不是 `SimpleChoiceSystem` live refresh 自身又回归。
- 真实根因在 SmashUp 游戏层 `wizards_arcane_protector` 的 `special validator`：
  - 旧校验只检查 `cardsPlayedThisTurn >= 5`
  - 没检查 `titan.location.zone === 'setaside'`
- 结果是：
  - 奥术守护者已经进场后，`afterScoring` 的 live `smashup_reaction_choose` 仍继续暴露 `activate_special`
  - watchdog/AI 每次恢复都会稳定看到这个“看起来合法、其实已不可发动”的候选
  - AI preview 持续倾向选它，最终把可见交互拖成 `blocker_persisted`

## 修复

- 修改文件：
  - `src/games/smashup/abilities/titans.ts`
  - `src/games/smashup/__tests__/scoreBases-auto-continue.test.ts`
- 最小修复：
  - 给 `registerTitanSpecialValidator('wizards_arcane_protector', ...)` 增加
    - `if (titan.location.zone !== 'setaside') return '该泰坦当前不在牌库旁';`
- 同步补回归，确保两件事都被锁住：
  - 已进场泰坦在 `afterScoring` live 反应里不再暴露 special
  - persisted stale reaction 恢复后，只剩 `pass` 时 AI 会直接收口，不再继续误选 special

## 为什么这次审计会漏

- 这次漏的不是 D40。
  - `远古之物同时杀俩小鬼只结算一次` 属于“批内副作用未串行吃到最新状态”，已经在 `.spec/knowledge/standards/testing-audit.md` 的 `D40` 里单列。
- 这次漏的是 `D37` 的空档：
  - 现有 D37 更强调“交互选项是否会动态刷新掉 stale option”
  - 但还不够明确地区分：
    - `refreshInteractionOptions` 负责把快照里的旧候选换成 live 候选
    - 游戏层 `special validator` 仍必须把“实体当前位置 / 可打出区域 / zone 前置条件”写全
  - 如果 validator 漏了 `setaside` 前置条件，live 选项仍会稳定暴露一个“当前其实不可发动”的 special

## 本轮规范回写

- 已把 `.spec/knowledge/standards/testing-audit.md` 的 `D37` 补成更明确的口径：
  - 动态刷新不等于可激活性校验完整
  - 凡是候选依赖实体当前位置/区域（如 `setaside` 泰坦 special），审计时必须额外核对 validator 是否写全 zone/location 前置条件

## 验证命令

```powershell
node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/scoreBases-auto-continue.test.ts --configLoader native --maxWorkers 1 --testNamePattern "wizards_arcane_protector 已进场后，afterScoring live 反应不应继续暴露其 special|smashup_reaction_choose 从持久化恢复后只剩失效 special 快照时，AI 应按 live session 直接选择 pass|smashup_reaction_choose 构建反应选项时，应去重重复的泰坦 special 候选"

node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/server.test.ts --configLoader native --maxWorkers 1 --testNamePattern "smashup 持久化 stale reaction choice 走 watchdog 恢复时，不应落成 blocker_persisted|online AI watchdog 遇到同一 AI 的链式可见交互时，应在单次恢复序列内持续消费直到收口|online AI watchdog 在交互恢复后若同一 AI 只剩自然过阶段，应补最后一步 ADVANCE_PHASE 而不是把 legal-only 当失败"
```

结果：

- `scoreBases-auto-continue.test.ts`：`3 passed`
- `server.test.ts`：`3 passed`

## 正式写入口

- 本轮继续使用生产 Mongo 直连，不走 HTTP：
  - `ssh admin@8.148.71.102`
  - `docker exec -i boardgame-mongodb mongosh --quiet boardgame`

## 回写与复核

- 回写回显：`temp/feedback-closeout/update-feedback-status-20260507-smashup-watchdog-arcane-protector-to-resolved.raw.txt`
- 回写后快照：`temp/feedback-closeout/query-feedback-69fb3fde-69fc6298-after-writeback-20260507.raw.txt`
- 最新未收口统计：`temp/feedback-closeout/query-all-open-inprogress-after-writeback-20260507-smashup-watchdog-arcane-protector.raw.txt`

## 结论

- `69fb3fde76f10333c15ed8d9` 与 `69fc62984a37805e1526f6d9` 属于同一真实根因，当前都可以按“已修未回写的系统单”处理。
- 修复点不是 transport 再补一个 fallback，而是把 `wizards_arcane_protector` 的 special 可激活条件补完整。
- 本轮完成后，后续再看到同类 `scoreBases / smashup_reaction_choose / arcane_protector / blocker_persisted`，应优先怀疑“线上尚未带上这次修复”或“另有新的 validator 漏口”，而不是重新回到 D40 那条 old path。
