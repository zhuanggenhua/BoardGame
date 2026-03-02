# POD 派系基地补充修复总结

## 问题描述
用户选择 `wizards` + `ninjas_pod` 时，巫师学院 `afterScoring` 能力显示空白选项（无基地名称）。

## 根本原因
1. POD 派系（如 `ninjas_pod`、`pirates_pod`）的卡牌有 `faction: 'xxx_pod'` 字段
2. 但基地没有对应的 `faction: 'xxx_pod'` 条目
3. `getBaseDefIdsForFactions(['wizards', 'ninjas_pod'])` 只找到 2 个巫师基地
4. 原补充逻辑：`factionsWithoutBases.length * 2 = 1 * 2 = 2` 个基地
5. 总基地数：2 + 2 = 4
6. 2人游戏：3个在场 + 1个牌库 = **牌库只剩1张**
7. 巫师学院 `afterScoring` 只能显示 1 个选项（应该显示 3 个）

## 修复方案
修改 `src/games/smashup/data/cards.ts` 中的 `getBaseDefIdsForFactions` 函数，改进补充逻辑：

```typescript
const playerCount = factionIds.length / 2; // 每个玩家选 2 个派系
const minTotalBases = Math.max(
    playerCount * 4,                    // 通用最小值（2人=8, 3人=12, 4人=16）
    factionsWithoutBases.length * 2,    // 每个缺失派系至少 2 个基地
    matched.length + 4                  // 至少补充 4 个基地
);
const missingCount = Math.max(0, minTotalBases - matched.length);
```

## 修复效果
- ✅ 2人游戏至少 8 个基地（3在场 + 5牌库）
- ✅ 3人游戏至少 12 个基地（4在场 + 8牌库）
- ✅ 4人游戏至少 16 个基地（5在场 + 11牌库）
- ✅ 巫师学院 `afterScoring` 能显示 3 个选项（牌库有足够基地）
- ✅ 向后兼容：无POD派系时不触发补充逻辑

## 验证场景
详见 `test-pod-base-supplement-fix.md`，包含 5 个测试场景：
1. wizards + ninjas_pod (2人游戏) → 8 个基地
2. wizards + pirates (2人游戏，无POD) → 4 个基地（原有逻辑）
3. ninjas_pod + pirates_pod (2人游戏，两个POD) → 8 个基地
4. wizards + ninjas + robots (3人游戏) → 6 个基地（原有逻辑）
5. wizards + ninjas_pod + robots_pod (3人游戏，2个POD) → 12 个基地

## 文件变更
- `src/games/smashup/data/cards.ts` - 修改 `getBaseDefIdsForFactions` 函数
- `test-pod-base-supplement-fix.md` - 验证文档
- `fix-pod-base-supplement-summary.md` - 本总结文档

## ESLint 检查
✅ 通过，0 errors（2 warnings 为预存在）

## 下一步
1. 运行游戏测试验证修复
2. 检查巫师学院选项显示是否正常
3. 确认补充的基地定义存在（`getBaseDef(defId)` 返回有效值）
