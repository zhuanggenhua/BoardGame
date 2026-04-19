# DiceThrone 枪手左轮速射 II 升级链路 E2E 证据（2026-04-06）

## 结论

- 本轮未复现“`upgrade-fan-the-hammer-2` 打出后没有升级”。
- 正常对局链路里，枪手打出 `左轮速射 II` 后：
  - 技能槽显示为 `左轮速射 II`
  - UI 点击该槽位后，运行时 `pendingAttack.sourceAbilityId = 'fan-the-hammer'`
  - 通过领域统一入口 `getPendingAttackExpectedDamage(...)` 读取到的预期伤害为 `8`
- 这说明升级本身已经生效；之前若只看 `pendingAttack.damage`，会得到 `null`，但这不是 `fan-the-hammer` 独有异常，而是项目当前“攻击发起阶段不保证把基础伤害直接写进 `pendingAttack.damage`”的共享约定。

## 实际运行

```powershell
node scripts/infra/vitest-cli-safe.mjs run src/games/dicethrone/__tests__/cross-hero.test.ts --configLoader native --maxWorkers 1 -t "upgrade-fan-the-hammer-2 升级后，实际选择左轮速射应造成 8 点伤害"
node scripts/infra/run-e2e-single.mjs ci e2e/temp-dicethrone-ability-atlas-regression.e2e.ts "gunslinger fan-the-hammer upgraded slot should still deal 8 damage when selected in UI"
```

## 截图

- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\temp-dicethrone-ability-atlas-regression.e2e\gunslinger-fan-the-hammer-upgraded-slot-should-still-deal-8-damage-when-selected-in-UI\gunslinger-fan-the-hammer-upgraded-slot-before-select.png`
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\temp-dicethrone-ability-atlas-regression.e2e\gunslinger-fan-the-hammer-upgraded-slot-should-still-deal-8-damage-when-selected-in-UI\gunslinger-fan-the-hammer-upgraded-slot-after-select.png`

## 看图结论

### 1. 升级后、选技前

- 右侧中下技能槽已经是 `左轮速射 II`，不是一级图。
- 右侧掷骰条为 `1,2,3,4,5`，对应大顺，说明当前确实处在可点击该技能槽的合法进攻阶段。
- 主按钮区域已出现 `终结攻击`，说明页面已经进入攻击选择后的正常进攻态，而不是主阶段未生效。

验收判断：

- 就“升级有没有显示到技能槽”这一点，已达到验收标准。

### 2. 点击升级槽位后

- 槽位仍保持 `左轮速射 II`，没有回退成一级图。
- E2E 断言读取浏览器内真实状态，`getPendingAttackExpectedDamage(state.core, state.core.pendingAttack) === 8`，说明这次攻击按 II 级伤害进入后续链路。
- 画面仍残留一层半透明卡片尾迹，这是出牌飞行动画没有完全收干净的 UI 残余，不等于“升级未生效”。

验收判断：

- 就“升级后再次点击技能槽，是否真实按 II 级伤害发起攻击”这一点，已达到验收标准。
- 就“打牌动画是否完全收干净”这一点，当前截图仍有残影，不能据此宣称该 UI 细节已收口。

## 反思

- 这次差点误判的根因不是 `左轮速射 II` 规则没实现，而是把 `pendingAttack.damage` 当成了攻击发起阶段的真相源。
- 仓库已有 `src/games/dicethrone/domain/utils.ts` 明确写了：`pendingAttack.damage` 经常为 `undefined`，应通过 `getPendingAttackExpectedDamage(...)` 统一读取预期伤害。
- 后续审计 DiceThrone 攻击升级/加伤链路时，若阶段还停在 `ATTACK_INITIATED / offensiveRoll`，必须优先使用这条统一查询入口；否则很容易把共享状态约定误读成某一张牌或某个角色的独有 bug。
