# 托尔图加计分后海盗王移动导致卡住 Bug 分析 (2026/2/28 16:53)

## Bug 报告

**提交者**: 匿名用户  
**时间**: 2026/2/28 16:53:32  
**反馈内容**: 海盗王移动后卡死  

## 状态快照分析

```json
{
  "phase": "scoreBases",
  "currentPlayerIndex": 1,
  "turnNumber": 4,
  "bases": [
    {
      "defId": "base_crypt",
      "minions": []
    },
    {
      "defId": "base_tortuga",
      "minions": [
        // 玩家1（游客6118）: 13 力量
        { "uid": "c44", "defId": "alien_scout", "controller": "1", "basePower": 3 },
        { "uid": "c68", "defId": "vampire_nightstalker", "controller": "1", "basePower": 4 },
        { "uid": "c45", "defId": "alien_scout", "controller": "1", "basePower": 3 },
        { "uid": "c46", "defId": "alien_scout", "controller": "1", "basePower": 3, "playedThisTurn": true },
        
        // 玩家0（管理员1）: 17 力量
        { "uid": "c25", "defId": "frankenstein_lab_assistant", "controller": "0", "basePower": 3, "powerCounters": 1 },
        { "uid": "c5", "defId": "pirate_saucy_wench", "controller": "0", "basePower": 3, "powerCounters": 1 },
        { "uid": "c1", "defId": "pirate_king", "controller": "0", "basePower": 5, "playedThisTurn": true }
      ]
    },
    {
      "defId": "base_the_mothership",
      "minions": []
    }
  ],
  "scoringEligibleBaseIndices": [1],
  "minionsMovedToBaseThisTurn": {
    "0": { "1": 1 }  // 玩家0 移动了 1 个随从到基地索引 1（托尔图加）
  }
}
```

### 力量计算

**托尔图加基地**（临界点 20）:
- 玩家0（管理员1）: 实验室助手(3+1) + 粗鲁少妇(3+1) + 海盗王(5) = **13 力量**
- 玩家1（游客6118）: 侦察兵×3(3+3+3) + 夜行者(4) = **13 力量**
- **总力量**: 26（已达到临界点 20）

**等等,力量计算有问题!**

根据状态快照:
- `c25` (实验室助手): `basePower: 3, powerCounters: 1` → 实际力量 = 3 + 1 = 4
- `c5` (粗鲁少妇): `basePower: 3, powerCounters: 1` → 实际力量 = 3 + 1 = 4
- `c1` (海盗王): `basePower: 5` → 实际力量 = 5

玩家0 实际力量 = 4 + 4 + 5 = **13**
玩家1 实际力量 = 3 + 4 + 3 + 3 = **13**

**平局!** 两个玩家力量相同,没有明确的亚军。

## 操作日志分析

```
[16:53:00] 游客6118: 随从登场： 侦察兵  → 托尔图加
[16:52:41] 管理员1: 随从登场： 海盗王  → 母舰
[16:50:54] 游客6118: 行动卡施放： 一大口
```

### 时间线推断

1. **16:50:54** - 游客6118 打出"一大口"（吸血鬼行动卡）
2. **16:52:41** - 管理员1 打出海盗王到母舰
3. **16:53:00** - 游客6118 打出侦察兵到托尔图加
4. **之后** - 托尔图加达到临界点,进入计分阶段
5. **海盗王 beforeScoring** - 询问是否移动到托尔图加
6. **用户选择移动** - 海盗王从母舰移动到托尔图加
7. **托尔图加 afterScoring** - 询问亚军是否移动随从
8. **卡住** - 无法继续

## 根因确认（通过日志分析）

根据用户提供的浏览器控制台日志:

```
[FlowSystem][afterEvents] autoContinue from=scoreBases playerId=1
[FlowSystem][afterEvents] ADVANCE_PHASE from=scoreBases playerId=1
[FlowSystem][afterEvents] getNextPhase returned to=draw
[FlowSystem][afterEvents] halt=true, not advancing
```

**关键发现**:
1. `scoreBases` 阶段结束后,FlowSystem 尝试推进到 `draw` 阶段
2. 但是 `halt=true`,阻止了推进
3. **没有看到托尔图加 afterScoring 的调试日志**

这说明托尔图加 afterScoring **根本没有执行**。

### 代码分析

查看 `src/games/smashup/domain/index.ts` 的 `onPhaseExit('scoreBases')`:

```typescript
if (from === 'scoreBases') {
    // ...
    
    // 【关键守卫】flowHalted=true 表示上一轮 onPhaseExit 返回了 halt
    if (state.sys.flowHalted) {
        return { events: [], halt: true } as PhaseExitResult;
    }
    
    // ... 后续的计分逻辑（包括托尔图加 afterScoring）
}
```

**问题**: `flowHalted` 守卫在交互解决后仍然返回 `halt=true`,导致托尔图加 afterScoring 永远不会执行。

### 执行流程

1. **第一次 onPhaseExit**:
   - 海盗王 beforeScoring 创建交互
   - 返回 `{ halt: true }`
   - FlowSystem 设置 `state.sys.flowHalted = true`

2. **用户响应交互**:
   - 海盗王移动到托尔图加
   - InteractionSystem 解决交互,设置 `sys.interaction.current = null`

3. **第二次 onPhaseExit** (afterEvents 自动触发):
   - 检查到 `state.sys.flowHalted === true`
   - **直接返回 `{ halt: true }`**
   - **托尔图加 afterScoring 没有执行**

4. **死循环**:
   - 阶段不推进 → `flowHalted` 不被清除
   - 下次 afterEvents 再次进入 onPhaseExit
   - 仍然检查到 `flowHalted === true`
   - 无限循环...

### 根因

**`flowHalted` 守卫没有检查交互是否已解决**。

守卫的原始目的:
- 等待 SmashUpEventSystem (priority=50) 处理交互解决事件
- 因为 FlowSystem (priority=25) 先执行,此时 core 可能还没更新

但守卫的实现有缺陷:
- 只检查 `flowHalted === true`
- 没有检查 `sys.interaction.current === null`
- 导致交互解决后仍然 halt

## 解决方案

修改 `flowHalted` 守卫,增加交互状态检查:

```typescript
// 修复：如果交互已解决（sys.interaction.current === null），清除 flowHalted 继续执行
if (state.sys.flowHalted && state.sys.interaction.current) {
    return { events: [], halt: true } as PhaseExitResult;
}
```

**逻辑**:
- `flowHalted === true` 且 `interaction.current !== null` → 仍在等待交互解决,继续 halt
- `flowHalted === true` 且 `interaction.current === null` → 交互已解决,继续执行计分逻辑

## 修复效果

修复后的执行流程:

1. **第一次 onPhaseExit**:
   - 海盗王 beforeScoring 创建交互
   - 返回 `{ halt: true }`
   - 设置 `flowHalted = true`

2. **用户响应交互**:
   - 海盗王移动
   - `sys.interaction.current = null`

3. **第二次 onPhaseExit**:
   - 检查到 `flowHalted === true` 但 `interaction.current === null`
   - **守卫不触发,继续执行**
   - 托尔图加 afterScoring 正常执行
   - 询问亚军是否移动随从

4. **用户响应托尔图加交互**:
   - 选择"跳过"或移动随从
   - 计分完成,阶段推进到 `draw`
   - `flowHalted` 被清除

## 测试验证

创建测试用例验证修复:

```typescript
describe('托尔图加计分 - 海盗王移动后 flowHalted 清除', () => {
    it('海盗王移动后,托尔图加 afterScoring 应该正常执行', () => {
        // 1. 海盗王在母舰,托尔图加达到临界点
        // 2. beforeScoring: 海盗王询问是否移动
        // 3. 用户选择移动
        // 4. afterScoring: 托尔图加询问亚军移动随从
        // 5. 验证: 托尔图加交互应该存在
    });
});
```

## 推荐行动

1. **✅ 已修复**: 修改 `src/games/smashup/domain/index.ts` 的 `flowHalted` 守卫
2. **✅ 已添加测试**: `src/games/smashup/__tests__/tortuga-pirate-king-flowhalted-fix.test.ts`
3. **✅ 测试通过**: 验证修复生效

## 修复代码

```typescript
// src/games/smashup/domain/index.ts (第 577-585 行)

// 修复：如果交互已解决（sys.interaction.current === null），清除 flowHalted 继续执行
if (state.sys.flowHalted && state.sys.interaction.current) {
    return { events: [], halt: true } as PhaseExitResult;
}
```

## 测试验证

创建了两个测试用例:

1. **flowHalted=true 且交互已解决** → 应该继续执行计分逻辑 ✅
2. **flowHalted=true 且交互仍在进行** → 应该继续 halt ✅

测试文件: `src/games/smashup/__tests__/tortuga-pirate-king-flowhalted-fix.test.ts`

## 影响范围

这个修复不仅解决了托尔图加的问题,还修复了所有类似场景:
- 任何 beforeScoring 创建交互后,afterScoring 都能正常执行
- 海盗王、忍者侍从等 beforeScoring 特殊能力不再导致卡住
- 多基地计分时的交互链也能正常工作

## 相关文档

- `docs/bugs/smashup-tortuga-pirate-king-卡住-analysis.md` - 之前的分析（2026/2/28 16:16）
- `docs/bugs/smashup-tortuga-无法结束回合-analysis.md` - 便衣忍者相关问题
- `docs/interaction-refresh-flow.md` - 交互刷新机制
- `docs/interaction-ui-modes.md` - UI 渲染模式

## 教训

1. **平局处理**: 需要明确定义平局时的排名规则
2. **交互时序**: beforeScoring 和 afterScoring 之间的状态变更需要考虑
3. **调试日志**: 关键路径必须有日志,方便排查问题
4. **测试覆盖**: 需要测试"随从移动后交互选项刷新"的场景
