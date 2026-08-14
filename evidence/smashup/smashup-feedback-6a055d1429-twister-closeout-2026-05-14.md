# 线上反馈 6a055d1429cd213e03bfd3e9：Twister 可选移动修复与审计反思（2026-05-14）

## 反馈来源

- 来源类别：线上反馈源 / 生产 Mongo。
- 反馈 ID：`6a055d1429cd213e03bfd3e9`。
- 原反馈内容：`twister实现完全错误`。
- 游戏：`smashup`。
- 反馈路径：`/play/smashup/match/2xrhUJGfRVo?playerID=0`，视口 `796x360`。
- 处理状态：本地修复与验证完成；是否回写线上反馈状态以实际数据库更新记录为准。

## 真相源核对

本轮以用户新增的正式 shayu 卡图为优先真相源，不以代码/i18n 反推规则。

- 原图：`D:\gongzuo\webgame\BoardGame\public\assets\i18n\zh-CN\smashup\cards\shayu.png`
- Twister 裁图：
  - `D:\gongzuo\webgame\BoardGame\temp\smashup-feedback-6a055d1429-twister-card.png`
  - `D:\gongzuo\webgame\BoardGame\temp\smashup-feedback-6a055d1429-twister.png`
  - `D:\gongzuo\webgame\BoardGame\temp\smashup-feedback-6a055d1429-twister-text-x2.png`
- Monster Tornado 裁图：
  - `D:\gongzuo\webgame\BoardGame\temp\smashup-feedback-6a055d1429-monster_tornado.png`
  - `D:\gongzuo\webgame\BoardGame\temp\smashup-feedback-6a055d1429-monster_tornado-text-x2.png`

肉眼读取结论：

- `tornados_twister` 旋风：文本是“你可以将一个 3 或 3 以下战力的佣兵从该基地移动至另一个基地，也可以将一个 3 或 3 以下战力的佣兵从其他基地移动至本基地。”
- `tornados_monster_tornado` 龙卷风怪物同构，但阈值是 4。
- 关键语义不是 push/pull 方向，而是 **“你可以”**：有合法候选时玩家仍必须能拒绝移动。

## 根因

旧实现已经覆盖 push/pull 两个方向，但 `tornadoPushPull` 复用了强制移动 prompt：

1. 有合法候选时只给随从候选，没有 `skip`。
2. 单候选场景存在自动结算风险，玩家没有拒绝机会。
3. 旧审计只证明“能移动 / 方向和阈值成立”，没有证明“有合法目标时也能选择不移动”。

因此用户在正常测试中看到 Twister 强制移动候选，会合理判断为“实现完全错误”。这不是 UI 表层问题，是规则可选语义漏实现。

## 修改内容

- `src/games/smashup/abilities/tornados.ts`
  - `ChooseMinionForMoveContext` 增加 `optional?: boolean`。
  - `chooseMinionForMovePromptProgram` 在 optional 时插入 `createSkipOption()`。
  - optional 时禁用单候选自动结算：`autoResolveIfSingle: false`。
  - skip 解析为空事件，保持权威状态不变。
  - `tornadoPushPull` 传入 optional=true，并把标题改成“你可以选择…”。
  - 影响 `tornados_twister` 与 `tornados_monster_tornado`；不改变 `carried_away`、`picked_up` 等强制移动合同。
- `src/games/smashup/__tests__/shayuComprehensiveBehavior.test.ts`
  - 新增 Twister / Monster Tornado 合法候选存在时 skip 的 L2 行为回归。
- `e2e/smashup-shayu-factions.e2e.ts`
  - 新增 Twister 真实手牌入口 E2E，验证 prompt 出现 skip 且 skip 后候选仍留在原基地。
- `src/games/smashup/__tests__/abilityBehaviorAudit.test.ts`
  - 增加“已纳入全面审计的新派系可选/至多交互必须有拒绝或空选实现证据”的通用审计门禁。
- `.spec/knowledge/standards/testing-audit.md`、`.spec/skills/add-new-faction/SKILL.md`、`.spec/skills/smashup-faction-addition/SKILL.md`
  - 补强通用可选语义门禁：合法候选存在时必须有 skip/空选否定路径，不能只测成功路径。

## 验证

已执行：

```bash
npx vitest run src/games/smashup/__tests__/shayuComprehensiveBehavior.test.ts -t "旋风"
```

结果：`2 passed, 12 skipped`。

```bash
npm run test:e2e:ci:file -- e2e/smashup-shayu-factions.e2e.ts "Tornados 旋风真实入口必须允许跳过可选移动"
```

结果：`1 passed`。

```bash
npx vitest run --config vitest.config.audit.ts src/games/smashup/__tests__/abilityBehaviorAudit.test.ts -t "可选/至多交互"
```

结果：`1 passed, 26 skipped`。

## E2E 截图核对

1. `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\_shared\smashup-shayu-factions.e2e\Tornados-旋风真实入口必须允许跳过可选移动\shayu-tornados-twister-skip-open.png`
   - 实际看到：旋风已打到 Trailer Park；Mako 仍在 Wooden Horse；顶部提示“旋风：你可以选择力量≤3的随从进行移动”；底部中央出现“跳过”按钮。
   - 验收结论：有合法候选时，真实 UI 入口已经提供拒绝路径，符合“你可以”。

2. `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\_shared\smashup-shayu-factions.e2e\Tornados-旋风真实入口必须允许跳过可选移动\shayu-tornados-twister-after-skip.png`
   - 实际看到：交互消失；旋风仍在 Trailer Park；Mako 仍在 Wooden Horse，没有被拉入 Trailer Park。
   - 验收结论：skip 后权威状态未执行移动，流程回到可继续推进状态。

## 审计反思

这次确认为审计维度落地不足，不是 D1-D49 大框架不存在，而是旧 shayu 审计没有把“可选语义”转成必须执行的否定路径：

- 旧审计问了：方向是否正确、阈值是否正确、移动是否能成功、真实入口是否能触发。
- 旧审计漏问：当规则写“你可以”且有合法候选时，玩家是否仍能拒绝执行。
- 旧 `tornados_twister` / `tornados_monster_tornado` 结论只能降级为“push/pull 成功路径成立”，不能继续作为“可选移动完整审计完成”的证据。

已补的通用门禁：

- 文案含“你可以 / 可选 / 至多 / 任意数量 / may / up to / any number”的交互，必须拆出强制/可选合同。
- 有合法候选时必须测试 skip/空选/拒绝执行路径。
- 成功路径与拒绝路径是两个不同验收项；只测“能移动/能消灭/能拿牌”不得宣称可选语义已审计。

## 剩余风险

- 本轮定向修复 Twister / Monster Tornado 共用的 Tornados push/pull helper，并补 shayu 新派系可选交互静态门禁。
- 全量 `abilityBehaviorAudit` 仍有历史既有失败（如 legacy registerAbility 白名单、旧 targetType 多义等）不属于本反馈根因；本轮只运行新增门禁定向用例。
- 尚未执行提交、push、部署；线上是否生效取决于后续提交/部署流程。
