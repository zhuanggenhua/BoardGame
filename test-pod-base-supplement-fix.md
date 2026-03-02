# POD 派系基地补充修复验证

## 问题描述
用户选择 `wizards` + `ninjas_pod` 时：
- `wizards` 有 2 个基地
- `ninjas_pod` 没有基地（POD 派系）
- 原补充逻辑：`factionsWithoutBases.length * 2 = 1 * 2 = 2`
- 总基地数：2 + 2 = 4
- 2人游戏：3个在场 + 1个牌库 = **牌库只剩1张**
- 巫师学院 `afterScoring` 显示 1 个选项（应该显示 3 个）

## 修复方案
改进补充逻辑，确保最小基地数量满足游戏可玩性：

```typescript
const playerCount = factionIds.length / 2; // 每个玩家选 2 个派系
const minTotalBases = Math.max(
    playerCount * 4,                    // 通用最小值（2人=8, 3人=12, 4人=16）
    factionsWithoutBases.length * 2,    // 每个缺失派系至少 2 个基地
    matched.length + 4                  // 至少补充 4 个基地
);
```

## 验证场景

### 场景 1: wizards + ninjas_pod (2人游戏)
- `matched` = 2 个巫师基地
- `factionsWithoutBases` = `['ninjas_pod']`
- `playerCount` = 2
- `minTotalBases` = Math.max(2*4, 1*2, 2+4) = Math.max(8, 2, 6) = **8**
- `missingCount` = 8 - 2 = **6**
- 总基地数：2 + 6 = **8**
- 2人游戏：3个在场 + 5个牌库 ✅

### 场景 2: wizards + pirates (2人游戏，无POD)
- `matched` = 2 个巫师基地 + 2 个海盗基地 = 4
- `factionsWithoutBases` = `[]`
- 不触发补充逻辑
- 总基地数：**4** ✅（原有逻辑正常）

### 场景 3: ninjas_pod + pirates_pod (2人游戏，两个POD)
- `matched` = 0
- `factionsWithoutBases` = `['ninjas_pod', 'pirates_pod']`
- `playerCount` = 2
- `minTotalBases` = Math.max(2*4, 2*2, 0+4) = Math.max(8, 4, 4) = **8**
- `missingCount` = 8 - 0 = **8**
- 总基地数：0 + 8 = **8** ✅

### 场景 4: wizards + ninjas + robots (3人游戏)
- `matched` = 2 + 2 + 2 = 6
- `factionsWithoutBases` = `[]`
- 不触发补充逻辑
- 总基地数：**6** ✅（原有逻辑正常）

### 场景 5: wizards + ninjas_pod + robots_pod (3人游戏，2个POD)
- `matched` = 2 个巫师基地
- `factionsWithoutBases` = `['ninjas_pod', 'robots_pod']`
- `playerCount` = 3
- `minTotalBases` = Math.max(3*4, 2*2, 2+4) = Math.max(12, 4, 6) = **12**
- `missingCount` = 12 - 2 = **10**
- 总基地数：2 + 10 = **12** ✅

## 预期结果
- ✅ 2人游戏至少 8 个基地（3在场 + 5牌库）
- ✅ 3人游戏至少 12 个基地（4在场 + 8牌库）
- ✅ 4人游戏至少 16 个基地（5在场 + 11牌库）
- ✅ 巫师学院 `afterScoring` 能显示 3 个选项（牌库有足够基地）
- ✅ 向后兼容：无POD派系时不触发补充逻辑

## 下一步
1. 运行游戏测试验证修复
2. 检查巫师学院选项显示是否正常
3. 确认补充的基地定义存在（`getBaseDef(defId)` 返回有效值）
