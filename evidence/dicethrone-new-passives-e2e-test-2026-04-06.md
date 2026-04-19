# DiceThrone 新被动 E2E 证据（2026-04-06）

## 范围

- 游戏：`dicethrone`
- 角色 / 被动：
  - `gunslinger`：`Quick Draw`
  - `samurai`：`Bushido`
- 目标：
  - 证明两个新角色的被动不只是领域层有定义，而是在真实在线双人对局 UI 链路里实际生效。

## 运行命令

```powershell
node scripts/infra/run-e2e-single.mjs ci e2e/dicethrone-hero-mechanics.e2e.ts "Quick Draw：枪手首回合真实 upkeep 后应获得 1 个装填"
node scripts/infra/run-e2e-single.mjs ci e2e/dicethrone-hero-mechanics.e2e.ts "Bushido：武士首回合 upkeep 与回合末少于 3 次进攻掷骰时都应获得荣誉"
```

## 截图与肉眼结论

### 1. 枪手 `Quick Draw`：首回合 upkeep 后获得 `loaded`

- 截图：
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone-new-passives\gunslinger-quick-draw-opening-loaded.png`
- 我实际看到的内容：
  - 左侧自己的状态 / token 条里出现了 1 个枪手装填图标，不是空栏。
  - 图标右下角显示 `1/2`，说明当前层数为 `1`，并且使用的是枪手 `loaded` 的真实 UI 徽标，不是调试文本。
- 是否达到验收标准：
  - 达到。说明 `Quick Draw` 已经通过真实开局进入 `upkeep` 后落到 UI，而不是只在 core 里加数。

### 2. 武士 `Bushido`：首回合 upkeep 后获得第 1 个 `honor`

- 截图：
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone-new-passives\samurai-bushido-opening-honor.png`
- 我实际看到的内容：
  - 左侧自己的状态 / token 条里出现了武士荣誉图标。
  - 初始截图没有叠层数字，符合“当前只有 1 层 honor”的 UI 表现。
- 是否达到验收标准：
  - 达到。说明 `Bushido` 的开局起始玩家分支已经走到真实页面，不再是“定义里有名字、运行时靠旁路”。

### 3. 武士 `Bushido`：回合末少于 3 次进攻掷骰后获得第 2 个 `honor`

- 截图：
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone-new-passives\samurai-bushido-end-turn-honor.png`
- 我实际看到的内容：
  - 同一个武士荣誉图标仍在左侧 token 条里。
  - 图标右下角出现了 `2` 的叠层数字，和前一张“只有 1 层、无叠层数字”的状态明确不同。
- 是否达到验收标准：
  - 达到。说明 `Bushido` 回合末 `< 3` 次进攻掷骰的奖励不是只写进 core，而是经过真实 `discard -> turn changed` 链路进入了 UI。

## 断言与链路说明

- `Quick Draw` 用例断言：
  - 在线双人真实选角并开始对局后，`player 0` 的 `loaded = 1`
  - `player 1` 未误得 `loaded`
- `Bushido` 用例断言：
  - 开局进入主阶段前，`player 0` 的 `honor = 1`
  - 玩家真实推进 `main1 -> offensiveRoll -> main2 -> discard`
  - 本回合只进行了 1 次真实 `ROLL_DICE`
  - 回合切换后 `turnNumber = 2`、`activePlayerId = '1'`，同时 `player 0` 的 `honor = 2`
  - `offensiveRollCountThisTurn` 在 `TURN_CHANGED` 后被清空

## 结论

- `Quick Draw` 已实现，并有真实 UI 证据。
- `Bushido` 两段触发都已实现，并有真实 UI 证据。
- 这轮不再是“被动壳存在但行为靠旁路硬编码”的状态；至少对这两个新被动，领域实现与真实页面证据已经对齐。
