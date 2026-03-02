#!/usr/bin/env node
/**
 * 批量分析测试失败原因
 */

const failures = [
    {
        file: 'baseAbilitiesPrompt.test.ts',
        test: 'base_tortuga: 计分后亚军移动随从 > 亚军有随从时生成 Prompt',
        error: 'expected [] to have a length of 1 but got +0',
        type: 'interaction_not_created',
        field: 'interactions',
    },
    {
        file: 'baseAbilityIntegrationE2E.test.ts',
        test: '集成: base_tortuga 托尔图加 (afterScoring) > 基地达标且有亚军随从 → Interaction 亚军移动随从',
        error: 'expected false to be true',
        type: 'interaction_not_created',
        field: 'hasInteraction',
    },
    {
        file: 'baseFactionOngoing.test.ts',
        test: 'robot_microbot_archive: 微型机被消灭后抽牌 > 对手的微型机被消灭时不触发（"你的" 限定）',
        error: 'expected [ { type: \'su:cards_drawn\', …(2) } ] to have a length of +0 but got 1',
        type: 'ownership_check_failed',
        field: 'events',
    },
    {
        file: 'bigGulpDroneIntercept.test.ts',
        test: '一大口 + 雄蜂防止消灭 > 一大口选择消灭科学小怪时，雄蜂防止消灭交互正确创建',
        error: 'expected 1 to be +0',
        type: 'power_modifier_not_reduced',
        field: 'powerModifier',
    },
    {
        file: 'cthulhuExpansionAbilities.test.ts',
        test: 'innsmouth_the_deep_ones（深潜者：力量≤2随从+1力量） > 力量修正正确应用（reduce 验证）',
        error: 'expected +0 to be 1',
        type: 'temp_power_not_applied',
        field: 'tempPowerModifier',
        fixed: true,
    },
    {
        file: 'duplicateInteractionRespond.test.ts',
        test: '同一交互重复 respond 防护 > 第二次 SYS_INTERACTION_RESPOND 对已消费的交互应被拒绝',
        error: 'expected 1 to be +0',
        type: 'power_modifier_not_reduced',
        field: 'powerModifier',
    },
    {
        file: 'expansionAbilities.test.ts',
        test: 'cthulhu_complete_the_ritual 打出约束 > 目标基地有自己随从时可以打出',
        error: 'expected false to be true',
        type: 'validation_failed',
        field: 'result.success',
    },
    {
        file: 'factionAbilities.test.ts',
        test: 'pirate_swashbuckling: 所有己方随从+1力量',
        error: 'expected +0 to be 2',
        type: 'temp_power_events_not_generated',
        field: 'powerEvents.length',
        fixed: true,
    },
    {
        file: 'interactionChainE2E.test.ts',
        test: 'P3: pirate_first_mate（大副）触发链 > 通过直接设置交互测试：选随从 → 选基地 → 移动',
        error: 'Cannot read properties of undefined (reading \'sourceId\')',
        type: 'interaction_not_created',
        field: 'interaction.current',
    },
    {
        file: 'madnessAbilities.test.ts',
        test: 'miskatonic_mandatory_reading（最好不知道的事：special，选随从+抽疯狂卡+力量加成） > 状态正确（reduce 验证）- 抽3张疯狂卡后随从+6力量',
        error: 'expected +0 to be 6',
        type: 'temp_power_not_applied',
        field: 'tempPowerModifier',
        fixed: true,
    },
    {
        file: 'newBaseAbilities.test.ts',
        test: 'base_laboratorium: 实验工坊 - 基地全局首次随从 > 本回合该基地已被其他玩家打过随从时不应再次触发',
        error: 'expected 1 to be +0',
        type: 'trigger_not_prevented',
        field: 'events.length',
    },
    {
        file: 'newBaseAbilities.test.ts',
        test: 'base_moot_site: 集会场 - 基地全局首次随从 > 本回合该基地已被其他玩家打过随从时不应再次触发',
        error: 'expected 1 to be +0',
        type: 'trigger_not_prevented',
        field: 'events.length',
    },
    {
        file: 'newFactionAbilities.test.ts',
        test: '巨蚁派系能力 > 承受压力：Me First! 窗口中打出，从计分基地上的随从转移力量指示物到其他基地的随从',
        error: 'expected 3 to be +0',
        type: 'power_modifier_not_transferred',
        field: 'powerModifier',
    },
    {
        file: 'newFactionAbilities.test.ts',
        test: '巨蚁派系能力 > 兵蚁：onPlay 放2指示物；talent 移除1并转移1个指示物给另一个随从',
        error: 'Cannot read properties of undefined (reading \'data\')',
        type: 'interaction_not_created',
        field: 'interaction',
    },
    {
        file: 'newFactionAbilities.test.ts',
        test: '巨蚁派系能力 > 雄蜂：防止失败（指示物耗尽）时重新发出 MINION_DESTROYED',
        error: 'expected false to be true',
        type: 'event_not_generated',
        field: 'MINION_DESTROYED',
    },
    {
        file: 'newFactionAbilities.test.ts',
        test: '科学怪人派系能力 > 德国工程学：在该基地打出随从后应给该随从+1指示物',
        error: 'expected +0 to be 1',
        type: 'power_modifier_not_added',
        field: 'powerModifier',
    },
    {
        file: 'newFactionAbilities.test.ts',
        test: '科学怪人派系能力 > 怪物：天赋移除指示物并额外打出随从',
        error: 'expected undefined to be defined',
        type: 'event_not_generated',
        field: 'POWER_COUNTER_REMOVED',
    },
    {
        file: 'robot-hoverbot-chain.test.ts',
        test: '盘旋机器人链式打出 > 应该正确处理连续打出两个盘旋机器人',
        error: 'expected \'hoverbot-2\' to be \'zapbot-1\'',
        type: 'wrong_card_in_interaction',
        field: 'playOption.value.cardUid',
    },
    {
        file: 'robot-hoverbot-chain.test.ts',
        test: '盘旋机器人链式打出 > 应该阻止打出已经不在牌库顶的卡',
        error: 'expected true to be false',
        type: 'validation_not_prevented',
        field: 'result.success',
    },
    {
        file: 'zombieInteractionChain.test.ts',
        test: 'zombie_theyre_coming_to_get_you（它们为你而来）弃牌堆出牌 > 消耗正常随从额度',
        error: 'expected +0 to be 1',
        type: 'quota_not_consumed',
        field: 'minionsPlayed',
    },
];

// 按类型分组
const byType = {};
for (const f of failures) {
    if (!byType[f.type]) byType[f.type] = [];
    byType[f.type].push(f);
}

console.log('## 测试失败分类统计\n');
for (const [type, items] of Object.entries(byType)) {
    console.log(`### ${type} (${items.length}个)`);
    for (const item of items) {
        const status = item.fixed ? '✅' : '❌';
        console.log(`${status} ${item.file}: ${item.test}`);
    }
    console.log('');
}

console.log('\n## 根因分析\n');

console.log('### 1. interaction_not_created (5个)');
console.log('- 基地能力/ongoing 能力应该创建交互但没有创建');
console.log('- 可能原因：交互创建逻辑被破坏，或条件判断错误');
console.log('');

console.log('### 2. power_modifier_not_* (5个)');
console.log('- 力量指示物应该添加/移除/转移但没有生效');
console.log('- 可能原因：POWER_COUNTER_* 事件没有正确产生或 reduce 没有处理');
console.log('');

console.log('### 3. temp_power_not_applied (3个，已修复2个)');
console.log('- 临时力量修正应该应用但没有生效');
console.log('- 已修复：测试检查错误字段（powerModifier → tempPowerModifier）');
console.log('- 剩余1个需要检查');
console.log('');

console.log('### 4. trigger_not_prevented (2个)');
console.log('- 基地能力应该只触发一次但触发了多次');
console.log('- 可能原因：回合/基地标记逻辑失效');
console.log('');

console.log('### 5. ownership_check_failed (1个)');
console.log('- ongoing 能力应该只对"你的"随从生效但对对手随从也生效了');
console.log('- 可能原因：所有权检查逻辑错误');
console.log('');

console.log('### 6. validation_* (2个)');
console.log('- 验证应该通过/失败但结果相反');
console.log('- 可能原因：验证逻辑错误');
console.log('');

console.log('### 7. event_not_generated (2个)');
console.log('- 应该产生特定事件但没有产生');
console.log('- 可能原因：事件生成逻辑被破坏');
console.log('');

console.log('### 8. quota_not_consumed (1个)');
console.log('- 随从额度应该消耗但没有消耗');
console.log('- 可能原因：额度消耗逻辑错误');
console.log('');

console.log('### 9. wrong_card_in_interaction (1个)');
console.log('- 交互选项中的卡牌不正确');
console.log('- 可能原因：选项刷新逻辑错误');
console.log('');

console.log('\n## 共同模式\n');
console.log('大部分失败都与以下系统相关：');
console.log('1. 交互系统（5个）- 交互创建/选项刷新');
console.log('2. 力量指示物系统（5个）- POWER_COUNTER_* 事件');
console.log('3. Ongoing 能力系统（3个）- 触发条件/所有权检查');
console.log('4. 验证系统（2个）- 打出条件验证');
console.log('');

console.log('## 可能的根因\n');
console.log('这些失败可能由最近的以下改动引起：');
console.log('1. 交互系统重构（InteractionSystem）');
console.log('2. 力量修正系统重构（powerModifier/tempPowerModifier 分离）');
console.log('3. Ongoing 能力注册/触发机制变更');
console.log('4. 事件生成/reduce 逻辑变更');
