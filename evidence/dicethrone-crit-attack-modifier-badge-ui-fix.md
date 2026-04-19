# DiceThrone 暴击误显示攻击修正徽章修复证据

## 问题

用户反馈：`dicethrone` 右上角 UI 出现了 `+4 Damage` 的攻击修正描述，但这 4 点来自 `CRIT`，不应进入“攻击修正”徽章。

## 根因调用链

1. `CRIT` 在 [src/games/dicethrone/domain/choiceEffects.ts](../src/games/dicethrone/domain/choiceEffects.ts) 中会把数值加到通用 `pendingAttack.bonusDamage`。
2. 右上角红色徽章语义应当是“攻击修正卡带来的额外伤害”，不应混入 `CRIT` 这类非攻击修正来源。
3. 状态层已拆分出 `pendingAttack.attackModifierBonusDamage`，但 [src/games/dicethrone/Board.tsx](../src/games/dicethrone/Board.tsx) 仍把通用 `bonusDamage` 传给右侧栏，导致 UI 继续把 `CRIT` 的 `+4` 显示出来。

## 修复

### 状态层

- `PendingAttack` 新增 `attackModifierBonusDamage`
- `ATTACK_INITIATED` 和 `BONUS_DAMAGE_ADDED` 只在“攻击修正卡来源”时写入该字段
- `Volley`、`Watch Out`、`Get Fired Up` 这些直接改 `pendingAttack.bonusDamage` 的旧路径，同步维护 `attackModifierBonusDamage`

### UI 最后一跳

- [src/games/dicethrone/Board.tsx](../src/games/dicethrone/Board.tsx)
  - `RightSidebar` 改为接收 `attackModifierBonusDamage`
  - 不再把通用 `pendingAttack.bonusDamage` 直接传入右上角徽章

### 测试阻塞项

- [package.json](../package.json) 文件头存在 UTF-8 BOM，导致 `tsx` 启动 E2E 服务时报 `Error parsing package.json`
- 本次仅移除 BOM，保留文件中原有脚本改动

## 验证

### 静态与单元测试

已通过：

- `npm run typecheck`
- `npm test -- src/games/dicethrone/__tests__/crit-token-transfer-full-flow.test.ts`
- `npm test -- src/games/dicethrone/__tests__/red-hot-meteor-integration.test.ts`
- `npm test -- src/games/dicethrone/__tests__/volley-5-dice-display.test.ts`

### E2E

已通过：

- `npm run test:e2e:ci -- e2e/dicethrone-watch-out-spotlight.e2e.ts`

其中新增定向用例：

- `暴击只增加总伤害，不应在右上角显示攻击修正伤害徽章`

## 截图分析

关键截图：

- 历史截图已按新规则清理；如需复查，请重跑 `e2e/dicethrone-watch-out-spotlight.e2e.ts`，新统一目录为 `test-results/evidence-screenshots/`

观察结果：

- 页面处于 `Defensive Roll Phase`
- 右侧栏与操作区已正常渲染
- 右上角未出现红色 `+4 Damage` 攻击修正徽章
- 说明 `pendingAttack.bonusDamage = 4` 且 `attackModifierBonusDamage = 0` 时，UI 已不再错误显示攻击修正描述

## 结论

本次修复命中真实根因：不是伤害计算错，而是右上角 UI 错把“总额外伤害”当成了“攻击修正卡额外伤害”。

修复后：

- `CRIT` 仍正常增加总伤害
- 右上角攻击修正徽章只反映攻击修正卡来源
- Watch Out / 大吉大利 相关既有 E2E 也保持通过
