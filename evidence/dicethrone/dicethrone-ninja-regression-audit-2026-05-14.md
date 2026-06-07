# DiceThrone Ninja 四项回归修复审计（2026-05-14）

> 2026-05-18 失效回写：本文件里关于 `blink` “改成 `withDamage` 后即可视为防御语义正确”的结论已失效。后续按 `Ablilitycards.png` 与 `ninja录入核对.md` 复核发现，旧实现虽然能在防御阶段产生最终 HP 变化，但仍把 Blink 误落成共享 `rollDie` / 额外奖励骰语义，没有证明“读取防御投已出骰面”这一真实合同。当前最新口径以 `evidence/dicethrone/dicethrone-ninja-full-flow-reaudit-2026-05-15.md` 为准；本文件现在只能继续作为 2026-05-14 四项回归中的其余三项证据，以及 Blink “不可防御时应跳过防御效果”的历史分支证据。
>
> 2026-06-05 当前有效口径：本文只保留 Ninja 四项回归中的历史修复与分支证据，不代表 Ninja 整英雄或 Treant/Ninja 整批当前完成态。当前若要判断 Ninja 对象级残余、兄弟能力补审范围或整批发布口径，应以 `evidence/dicethrone/dicethrone-ninja-full-flow-reaudit-2026-05-15.md`、`evidence/dicethrone/dicethrone-treant-ninja-upgrade-reaudit-2026-05-30.md` 与 `src/games/dicethrone/rule/ninja录入核对.md` 为准。

## 范围

本次只审计用户指出的 Ninja 四项回归，不把结论扩展为 Ninja 全量全面审计：

| 对象 | 用户反馈 | 旧问题 | 修复入口 | 证据层级 | 结论 |
|---|---|---|---|---|---|
| `poison-blade` | 小顺子执行时选择贴图错误 | Ninja v2 面板视觉槽位与旧共享槽位语义不一致，UI 仍按共享 `sky/combo` 推断 | `ui/abilitySlotMapping.ts`、`AbilityOverlays.tsx`、`Board.tsx`、`HandArea.tsx`、`useAttackShowcase.ts` | L2 + L3 | 已按角色槽位覆盖为 `combo` |
| `death-blossom` | 左下角技能执行时选择贴图错误 | 同上，左下角实图槽应选择死亡盛放 | 同上 | L2 + L3 | 已按角色槽位覆盖为 `sky` |
| `blink` | 防御技能无效果 | 2026-05-14 先定位到 effect timing；2026-05-18 继续发现旧实现仍误把 Blink 做成共享 `rollDie` / 奖励骰语义，未按防御投已出骰面结算 | `heroes/ninja/abilities.ts`、`domain/customActions/ninja.ts` | L2 + 旧 L3（已降级） | 旧“改成 `withDamage` 即收口”与“真防御 L3 待补”都已失效；当前应改读为：这行只保留 2026-05-14/2026-05-18 的历史回归轨迹，Ninja 当前对象级 `L3/L4` 结论以升级重审主文档与 `ninja录入核对.md` 最新矩阵为准 |
| 不可防御 + 防御 | 结算选择不可防御仍然执行防御效果 | `resolveDefenseEffects` 未检查 `pendingAttack.isDefendable === false` | `domain/attack.ts` | L2 + L3 | 已跳过防御效果 |
| `ninja-card-knife-fan` | 三刀/刀扇应主要阶段使用 | 误录为投掷阶段攻击修正 | `heroes/ninja/cards.ts`、卡牌核对文档 | L2 | 已改为 `main` 行动牌，非攻击修正 |

## 根因

1. 贴图槽位根因不是“共享头像/共享图集抽象”，而是运行时把所有角色硬塞进同一套 `ABILITY_SLOT_MAP` 槽位语义。Ninja v2 面板的真实图像布局与旧英雄同名槽不一致，必须让 UI、选择命令、特写定位都消费同一份角色感知槽位映射。
2. `blink` 的第一层根因是效果时机错误；但这不是全部。2026-05-18 回写确认：即使 effect timing 进了防御阶段，如果实现仍把语义落成共享 `rollDie` / 奖励骰，而不是读取防御投已出骰面，也不能算规则正确。
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
  - 2026-05-14 历史修复曾把 `blink` 的 `rollDie` effect 改为 `timing: 'withDamage'`。
  - 2026-05-18 已继续回写为独立 `customAction`：基础版 `ninja-blink`，II 级 `ninja-blink-2`，不再复用旧共享 `rollDie` 语义。
- `src/games/dicethrone/domain/customActions/ninja.ts`
  - 新增 `ninja-blink` / `ninja-blink-2`，按防御投已出骰面的忍刀/手里剑/面具数量直接结算反击与烟雾弹。
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

补充说明：

- 上述 2026-05-14 E2E 结果仍能证明“不可防御分支会跳过已挂载的 Blink 防御效果”，但**不能再单独证明 Blink 本体语义已经与卡图一致**。
- 2026-05-18 新补的权威合同测试见：

```powershell
npx vitest run src/games/dicethrone/__tests__/ninja-ability-card-contract.test.ts --configLoader native --maxWorkers 1
```

2026-05-18 实测结果：`1 file passed / 6 tests passed`。该组测试新增了 Blink 基础版与 Blink II 的防御投骰面合同断言；当前最新结论应以这组 L2 证据和 `dicethrone-ninja-full-flow-reaudit-2026-05-15.md` 的回写为准。

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

> 2026-05-18 回写说明：这一组截图能证明“从真实防御入口推进后，最终 HP/烟雾弹状态发生了变化”以及“不可防御分支会跳过 Blink”，但它没有单独证明当前 UI 上展示/消费的就是“防御投已出骰面本体”而不是共享奖励骰语义。因此自 2026-05-18 起，这组截图不再作为 Blink 本体真实防御语义的充分 L3 证据。

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
- `evidence/dicethrone/dicethrone-ninja-full-flow-reaudit-2026-05-15.md`

当前结论：这四项回归里，`poison-blade` / `death-blossom` / `knife-fan` 仍可维持**本文件当轮** L2/L3 口径；`blink` 则已被 2026-05-18 新证据部分推翻。本文现在只能作为 2026-05-14 这一轮回归修复的历史证据，旧接入审计和本文件旧 Blink 结论都不能继续作为 Ninja 全面审计完成证明。

当前若要判断 Ninja 的现行状态，不应再把本文当作现行阅读入口，而应回到：

- `evidence/dicethrone/dicethrone-ninja-full-flow-reaudit-2026-05-15.md`
- `evidence/dicethrone/dicethrone-treant-ninja-upgrade-reaudit-2026-05-30.md`
- `src/games/dicethrone/rule/ninja录入核对.md`

截至 2026-06-05，Ninja 升级技能对象级 `L3` 与关键 `L4` 已在 `evidence/dicethrone/dicethrone-treant-ninja-upgrade-reaudit-2026-05-30.md` 与 `src/games/dicethrone/rule/ninja录入核对.md` 的最新矩阵中大幅补齐；因此本文件当前残余应统一读作历史回归轨迹，而不是对象级仍待实施。
