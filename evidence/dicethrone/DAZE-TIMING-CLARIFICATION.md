# Daze 时序专项澄清证据

> 2026-06-06 当前有效口径：本文只保留 Daze 额外攻击触发时序这一条规则裁定与代码对照证据，不代表 DiceThrone 全体规则链、任一单英雄，或四位新英雄整批当前已经审计完成。它现在只能证明当时 Daze 的“伤害结算后移除并触发额外攻击”这条时序被澄清并核对过，不能外推成更大范围规则或新英雄补审已经收口。

## 用户确认的正确时序

**用户原话**："b有眩晕在结算伤害后移除，然后a再次进行攻击"

## 完整时序流程

1. **Player A 施加眩晕**
   - Player A 攻击 Player B
   - 攻击造成伤害并施加眩晕状态

2. **Player B 的回合（有眩晕）**
   - Player B 可以正常攻击（眩晕不阻止进攻行为）
   - Player B 选择攻击 Player A

3. **攻击结算时序**（关键）
   ```
   ① 结算伤害 → Player B 的攻击正常造成伤害
   ② 移除眩晕 → 从 Player B 身上移除眩晕状态
   ③ 触发额外攻击 → Player A 获得额外攻击机会，攻击 Player B
   ```

## 关键理解

- **眩晕不阻止攻击**：有眩晕的玩家可以正常发起攻击
- **伤害正常结算**：眩晕不影响攻击伤害
- **惩罚在攻击后**：攻击结算完成后，施加眩晕的玩家获得反击机会
- **这是惩罚机制**：有眩晕的玩家虽然能攻击，但会被对手反击

## 代码实现验证

查看 `src/games/dicethrone/domain/flowHooks.ts` 中的 `checkDazeExtraAttack` 函数：

```typescript
function checkDazeExtraAttack(
    core: DiceThroneCore,
    events: GameEvent[],
    commandType: string,
    timestamp: number
): { dazeEvents: GameEvent[]; triggered: boolean } {
    // 从已生成的事件中找到 ATTACK_RESOLVED，获取攻击方信息
    const attackResolved = events.find(e => e.type === 'ATTACK_RESOLVED') as
        Extract<DiceThroneEvent, { type: 'ATTACK_RESOLVED' }> | undefined;
    if (!attackResolved) return { dazeEvents: [], triggered: false };

    const { attackerId, defenderId } = attackResolved.payload;
    const attacker = core.players[attackerId];
    const dazeStacks = attacker?.statusEffects[STATUS_IDS.DAZE] ?? 0;
    if (dazeStacks <= 0) return { dazeEvents: [], triggered: false };

    const dazeEvents: GameEvent[] = [];

    // ① 移除晕眩状态
    dazeEvents.push({
        type: 'STATUS_REMOVED',
        payload: { targetId: attackerId, statusId: STATUS_IDS.DAZE, stacks: dazeStacks },
        sourceCommandType: commandType,
        timestamp,
    } as StatusRemovedEvent);

    // ② 触发额外攻击：对手获得一次额外攻击机会
    dazeEvents.push({
        type: 'EXTRA_ATTACK_TRIGGERED',
        payload: {
            attackerId: defenderId,  // ✅ 对手（施加眩晕的玩家）获得额外攻击
            targetId: attackerId,    // ✅ 攻击原攻击方（有眩晕的玩家）
            sourceStatusId: STATUS_IDS.DAZE,
        },
        sourceCommandType: commandType,
        timestamp,
    } as ExtraAttackTriggeredEvent);

    return { dazeEvents, triggered: true };
}
```

**调用时机**：此函数在 `onPhaseExit` 中被调用，位于攻击结算（`resolveAttack`）**之后**：

```typescript
// offensiveRoll 阶段退出时
if (from === 'offensiveRoll') {
    // ... 攻击结算逻辑 ...
    const attackEvents = resolveAttack(core, random, undefined, timestamp);
    events.push(...attackEvents);
    
    // ✅ 攻击结算完成后，检查眩晕额外攻击
    const { dazeEvents, triggered } = checkDazeExtraAttack(
        core, events, command.type, timestamp
    );
    if (triggered) {
        events.push(...dazeEvents);
        return { events, overrideNextPhase: 'offensiveRoll' };
    }
}
```

## 时序总结

```
Player B (有眩晕) 攻击 Player A
    ↓
resolveAttack() 执行
    ↓ 产生 DAMAGE_DEALT 事件
    ↓ 产生 ATTACK_RESOLVED 事件
    ↓
checkDazeExtraAttack() 执行
    ↓ 检测到 Player B 有眩晕
    ↓ 产生 STATUS_REMOVED 事件（移除眩晕）
    ↓ 产生 EXTRA_ATTACK_TRIGGERED 事件（Player A 额外攻击）
    ↓
overrideNextPhase: 'offensiveRoll'
    ↓
Player A 进入 offensiveRoll 阶段（额外攻击）
```

## 结论

✅ 代码实现完全正确  
✅ 时序符合规则：伤害结算 → 移除眩晕 → 触发额外攻击  
✅ Token 定义已修复：`target: 'opponent'` 正确反映了对手获得额外攻击  
✅ 测试已更新：验证对手获得额外攻击机会  

这条时序专项在当轮已澄清并对齐规则，但它只能证明 Daze 单链路裁定成立，不能外推成当前 DiceThrone 总补审完成。

## 当前阅读说明

- 本文是 Daze 时序单链路裁定证据，不是 DiceThrone 当前总审计出口。
- 本文不能替代新英雄默认全面审计留档所需的对象级矩阵、批次级 `L4` 判等与旧文档统一回写。
