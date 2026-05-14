# DiceThrone Ninja 四项回归修复审计（2026-05-14）

## 范围

本次只审计用户指出的 Ninja 四项回归，不把结论扩展为 Ninja 全量全面审计：

| 对象 | 用户反馈 | 旧问题 | 修复入口 | 证据层级 | 结论 |
|---|---|---|---|---|---|
| `poison-blade` | 小顺子执行时选择贴图错误 | Ninja v2 面板视觉槽位与旧共享槽位语义不一致，UI 仍按共享 `sky/combo` 推断 | `ui/abilitySlotMapping.ts`、`AbilityOverlays.tsx`、`Board.tsx`、`HandArea.tsx`、`useAttackShowcase.ts` | L2 + L3 | 已按角色槽位覆盖为 `combo` |
| `death-blossom` | 左下角技能执行时选择贴图错误 | 同上，左下角实图槽应选择死亡盛放 | 同上 | L2 + L3 | 已按角色槽位覆盖为 `sky` |
| `blink` | 防御技能无效果 | `rollDie` effect 使用了错误时机，防御结算未执行 | `heroes/ninja/abilities.ts` | L2 + L3 | 已改为 `withDamage` 防御时机 |
| 不可防御 + 防御 | 结算选择不可防御仍然执行防御效果 | `resolveDefenseEffects` 未检查 `pendingAttack.isDefendable === false` | `domain/attack.ts` | L2 + L3 | 已跳过防御效果 |
| `ninja-card-knife-fan` | 三刀/刀扇应主要阶段使用 | 误录为投掷阶段攻击修正 | `heroes/ninja/cards.ts`、卡牌核对文档 | L2 | 已改为 `main` 行动牌，非攻击修正 |

## 根因

1. 贴图槽位根因不是“共享头像/共享图集抽象”，而是运行时把所有角色硬塞进同一套 `ABILITY_SLOT_MAP` 槽位语义。Ninja v2 面板的真实图像布局与旧英雄同名槽不一致，必须让 UI、选择命令、特写定位都消费同一份角色感知槽位映射。
2. `blink` 根因是效果时机错误。防御技能需要在攻击结算的防御效果阶段执行，不能放在 `immediate` 这类不会被防御结算消费的时机。
3. 不可防御根因是攻击结算缺少二次活体校验。攻击被 token/选择链改成不可防御后，已挂载的 `defenseAbilityId` 不能继续执行。
4. 刀扇根因是卡牌录入口径没有回到图片和规则本身。它是主要阶段行动牌，不是投掷阶段攻击修正。

## 修复内容

- `src/games/dicethrone/ui/abilitySlotMapping.ts`
  - 增加 Ninja 角色槽位覆盖：`combo -> poison-blade`，`sky -> death-blossom`。
  - 增加 `slotContainsAbilityIdForCharacter` 与 `getAbilitySlotIdForCharacter`。
- UI 消费链改为角色感知：
  - `src/games/dicethrone/ui/AbilityOverlays.tsx`
  - `src/games/dicethrone/Board.tsx`
  - `src/games/dicethrone/ui/HandArea.tsx`
  - `src/games/dicethrone/hooks/useAttackShowcase.ts`
- `src/games/dicethrone/heroes/ninja/abilities.ts`
  - `blink` 的 `rollDie` effect 改为 `timing: 'withDamage'`。
- `src/games/dicethrone/domain/attack.ts`
  - `resolveDefenseEffects` 在 `pending.isDefendable === false` 时直接跳过防御效果。
- `src/games/dicethrone/heroes/ninja/cards.ts`
  - `ninja-card-knife-fan` 改为 `timing: 'main'`，移除攻击修正语义。

## 测试与验证

已通过：

```powershell
npx vitest run src/games/dicethrone/__tests__/ninja-ability-card-contract.test.ts --configLoader native --maxWorkers 1
```

结果：4 passed。

已通过：

```powershell
$env:NODE_OPTIONS='--max-old-space-size=8192'
$env:BG_NODE_MAX_OLD_SPACE_SIZE='8192'
npm run test:e2e:ci:file -- e2e/dicethrone/dicethrone-ninja-regression.e2e.ts
```

结果：2 passed。

## E2E 截图核验

### 毒刃 / 死亡盛放槽位

毒刃槽位截图：

`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-ninja-regression.e2e\毒刃与死亡盛放应分别映射到 Ninja 实图槽位并可真实选择\01-poison-blade-combo-slot-before-click.png`

肉眼观察：

- 中央玩家面板为 Ninja，右上方 `combo` 视觉槽位出现红色可选高亮。
- E2E 同时断言该槽 `data-resolved-ability-id="poison-blade"` 且 `data-can-click="true"`，点击后权威状态 `pendingAttack.sourceAbilityId` 写入 `poison-blade`。

死亡盛放槽位截图：

`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-ninja-regression.e2e\毒刃与死亡盛放应分别映射到 Ninja 实图槽位并可真实选择\03-death-blossom-sky-slot-before-click.png`

肉眼观察：

- 中央玩家面板为 Ninja，左下方真实贴图槽位可见，死亡盛放所在槽出现可选高亮。
- 手牌扇形覆盖了槽位下缘，但 E2E 会先找该槽真实可点击点，再通过真实鼠标点击触发，不使用直接命令替代 UI。
- E2E 同时断言该槽 `data-resolved-ability-id="death-blossom"` 且 `data-can-click="true"`，点击后权威状态 `pendingAttack.sourceAbilityId` 写入 `death-blossom`。

死亡盛放点击后截图：

`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-ninja-regression.e2e\毒刃与死亡盛放应分别映射到 Ninja 实图槽位并可真实选择\04-death-blossom-after-click.png`

肉眼观察：

- 点击后对应槽位进入选中状态，E2E 权威状态断言已通过。
- 这证明修复覆盖了“贴图槽位展示”和“点击后实际选择能力”两段链路。

### Blink 与不可防御

Blink 防御前截图：

`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-ninja-regression.e2e\Blink 防御应生效，攻击改为不可防御后不得再执行 Blink\01-blink-before-defense-advance.png`

Blink 防御后截图：

`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-ninja-regression.e2e\Blink 防御应生效，攻击改为不可防御后不得再执行 Blink\02-blink-after-defense-advance.png`

肉眼观察：

- 防御推进后仍在真实对局界面，未停在异常弹窗或空白状态。
- E2E 权威状态断言：攻击者 HP 从 30 到 27，防御者烟雾弹从 0 到 1，证明 1/4/6 三颗防御骰按忍刀、手里剑、面具效果执行。

不可防御前截图：

`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-ninja-regression.e2e\Blink 防御应生效，攻击改为不可防御后不得再执行 Blink\03-undefendable-before-defense-advance.png`

不可防御后截图：

`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-ninja-regression.e2e\Blink 防御应生效，攻击改为不可防御后不得再执行 Blink\04-undefendable-after-defense-advance.png`

肉眼观察：

- 不可防御分支推进后仍回到真实对局界面。
- E2E 权威状态断言：攻击者 HP 保持 30，防御者烟雾弹保持 0，证明即使 `defenseAbilityId='blink'` 仍挂在 pendingAttack 上，`isDefendable=false` 时也不会执行 Blink 防御效果。

## 旧审计回写

已回写：

- `evidence/dicethrone/dicethrone-treant-ninja-intake-audit-2026-05-10.md`
- `src/games/dicethrone/rule/ninja录入核对.md`
- `src/games/dicethrone/rule/ninja卡牌录入核对.md`

当前结论：这四项回归在本轮修复范围内达到 L2/L3。旧接入审计不能继续作为 Ninja 全面审计完成证明。
