# DiceThrone 枪手 / 武士复审记录（2026-04-05）

> **2026-04-09 修订说明**
>
> 本文把“定义链 / 执行链已接上”描述得过于接近“体验已收口”。后续用户反馈证明，枪手 / 武士仍存在 **攻击修正 UI 可见性不足、5 骰结算缺少汇总文案、武士 token 中文与图标展示不一致** 的体验层漏项，因此本文原先可被理解为“已完整收口”的口径已失效。
>
> 2026-04-10 的补审与修复证据见：`evidence/dicethrone/dicethrone-gunslinger-samurai-ux-reaudit-2026-04-10.md`

## 审计范围

- 游戏：`dicethrone`
- 角色：`gunslinger`、`samurai`
- 目标：复核这两个新角色的“真相源 -> 数据定义 -> 执行链 -> 状态 -> 测试”闭环，确认旧“已收口”结论是否仍成立。

## 权威来源

- 枪手规则文档：
  - `src/games/dicethrone/rule/枪手真相源表.md`
  - `src/games/dicethrone/rule/枪手录入核对.md`
  - `src/games/dicethrone/rule/枪手卡牌录入核对.md`
- 武士规则文档：
  - `src/games/dicethrone/rule/武士真相源表.md`
  - `src/games/dicethrone/rule/武士录入核对.md`
  - `src/games/dicethrone/rule/武士卡牌录入核对.md`
- 当前运行时代码：
  - `src/games/dicethrone/heroes/gunslinger/*`
  - `src/games/dicethrone/heroes/samurai/*`
  - `src/games/dicethrone/domain/flowHooks.ts`
  - `src/games/dicethrone/domain/customActions/gunslinger.ts`
  - `src/games/dicethrone/domain/customActions/samurai.ts`
  - `src/games/dicethrone/domain/characters.ts`

## 审计方法

1. 先按角色文档逐项核“应该存在的能力/状态/卡牌”。
2. 再追源码闭环：定义 -> 注册 -> 流程钩子 / custom action / reducer -> 测试。
3. 对高风险点重点搜索：
   - `type: 'passive'`
   - `trigger: { type: 'phaseStart' }`
   - `bushido`
   - `samurai-back-strike-use`
   - `gunslinger-bounty-reward`
4. 最后复跑直接相关回归，确认当前基线。

## 逐项结论

### 1. 枪手 `Quick Draw / 快速拔枪` 旧审计结论已失效，问题已在本轮修复

- 真相源要求：
  - `src/games/dicethrone/rule/枪手录入核对.md` 明确写的是“维持阶段获得 `loaded`”。
- 复审前代码状态：
  - `src/games/dicethrone/heroes/gunslinger/abilities.ts` 里 `quick-draw` 使用 `trigger: { type: 'phaseStart', phase: 'upkeep' }`
  - 但此前仓库没有任何执行链消费 `AbilityDef.trigger.type === 'phaseStart'`
- 根因：
  - 这是典型 `D3 数据流闭环` + `D8 时序正确` 漏项：定义存在，但 `flowHooks` 未执行。
- 本轮修复：
  - `src/games/dicethrone/domain/combat/conditions.ts` 补 `PhaseStartCondition`
  - `src/games/dicethrone/domain/flowHooks.ts` 在进入 `upkeep` 时执行 `passive + phaseStart(upkeep)` 能力
  - 且先应用 `exitEvents`，保证首回合 `setup -> upkeep` 也能拿到 `loaded`
- 当前验证：
  - `src/games/dicethrone/__tests__/cross-hero.test.ts` 新增断言：枪手初始化后 `tokens.loaded === 1`
- 判定：
  - 旧“枪手线当前不再保留 `Loaded` 时机冲突为 residual”的口径在修复前不成立，现已修正。

### 2. 武士 `Bushido / 武士道` 旧审计结论已失效，问题已在本轮修复

- 真相源要求：
  - `src/games/dicethrone/rule/武士录入核对.md` 写明：
    - 起始玩家开局获得 `1 honor`
    - 若本回合攻击掷骰少于 `3` 次，回合结束再得 `1 honor`
- 复审前代码状态：
  - `src/games/dicethrone/heroes/samurai/abilities.ts` 中 `BUSHIDO` 只有展示定义，没有真实执行链
  - 当时没有任何 `flowHooks` / `customActions` / `测试断言` 去消费这条被动
- 根因：
  - 这是典型 `D3 数据流闭环` + `D8 时序正确` 漏项：
    - “首回合起始玩家开局 +1 honor” 需要挂在 `setup -> upkeep`
    - “回合结束按本回合攻击掷骰次数补 honor” 需要挂在 `discard -> TURN_CHANGED`
- 本轮修复：
  - `src/games/dicethrone/domain/core-types.ts` 新增 `offensiveRollCountThisTurn`
  - `src/games/dicethrone/domain/reducer.ts` 在真正的进攻掷骰时累加该计数，并在 `TURN_CHANGED` 时清理
  - `src/games/dicethrone/domain/flowHooks.ts`
    - 进入 `upkeep` 时：若为 `turnNumber === 1` 的起始玩家且具备 `bushido`，授予 `1 honor`
    - 退出 `discard` 时：若本回合进攻掷骰次数 `< 3`，再授予 `1 honor`
  - `src/games/dicethrone/__tests__/cross-hero.test.ts` 新增 3 条回归：
    - 起始武士开局 `honor === 1`
    - 少于 `3` 次进攻掷骰时回合末额外 `+1 honor`
    - 正好 `3` 次进攻掷骰时不额外给 `honor`
- 命中维度：
  - `D3 数据流闭环`
  - `D8 时序正确`
  - `D21 触发频率门控`
  - `D47 测试覆盖完整性`
- 判定：
  - 旧“Bushido 未实装”的复审结论在修复后已失效；当前两段规则链路已经形成闭环。

## 已验证测试

```powershell
npm run test -- src/games/dicethrone/__tests__/token-execution.test.ts src/games/dicethrone/__tests__/cross-hero.test.ts
```

结果：

- `token-execution.test.ts` 通过
- `cross-hero.test.ts` 通过
- 总计 `109 passed`

说明：

- 现有回归已覆盖枪手 `loaded`、武士 `Bushido honor`、`honor/shame/retribution`、`stand-tall`、`masamune`、`righteousness` 等主链路
- `Masamune II` 的既有测试也已同步更新为“先跳过攻击方 honor 响应，再跳过防御方响应”，与修复后的真实战斗链一致

## 失效结论 / 修订说明

- 枪手：
  - 旧文档曾把 `Loaded` 时机视为已收口，但复审发现 `quick-draw` 的 `phaseStart` 实际未执行。
  - 该问题现已修复，旧结论必须视为已失效并已在本轮回写。
- 武士：
  - `src/games/dicethrone/rule/武士录入核对.md` 中旧“无角色级 residual”结论曾被 `Bushido` 漏实装推翻。
  - 该缺口已在本轮补齐，但旧结论失效这件事必须保留在修订记录中，避免未来再次误用旧审计。
- `2026-04-06` 追加修订：
  - 本文档解决的是“运行时缺口是否已补齐”，不等于“新角色已经和老派系完全共享同一套抽象”。
  - 后续对比审计发现：`Bushido` 目前虽然运行时正确，但仍是 `flowHooks` 中按 `abilityId` 的角色特判，没有像 `quick-draw` / `tithes` 那样落入统一可枚举的被动建模。
  - 因此旧口径“枪手 / 武士已完全收口”仍然过宽；更准确的表述应是“主要运行时缺口已补齐，但武士被动建模仍有共享抽象分叉”。详见 `evidence/dicethrone/dicethrone-gunslinger-samurai-vs-legacy-audit-2026-04-06.md`。

## 未覆盖风险

1. 枪手 `Bounty` 的 Wiki 补充裁定（如“伤害被完全防止时是否仍给 CP”）本轮只做代码路径核读，尚未补专门行为回归。
2. 武士 `tip.webp` 中 `retribution` 堆叠限制数字 OCR 仍可继续优化，但它已经不是角色运行时主 blocker。
3. 本轮补的是 `Bushido` 主规则闭环；若未来再引入“按阶段/按本回合次数结算”的新被动，仍应优先复用共享字段与 `flowHooks`，避免回到单点硬编码。
4. 枪手 `Duel` 的“获胜后二选一”当前已走通用 `CHOICE_REQUESTED -> simple-choice -> ChoiceModal` 链路，规则闭环与领域测试已存在；但本轮复审没有把“这种对决/比较类特殊交互是否需要专属 UI 表达（例如同时展示双方骰点、对决结果与结算语义）”列入专项检查。该问题已在 `evidence/dicethrone/dicethrone-special-interaction-ui-reaudit-2026-04-05.md` 单列复审；它应被视为 `D5/D15/D48` UI 语义缺口，而不等同于“规则未实装”。
