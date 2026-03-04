/**
 * 调试 DiceThrone targeted-defense-damage 测试
 * 检查 rollDiceCount 和骰子统计
 */

import { DiceThroneDomain } from '../src/games/dicethrone/domain/index.js';
import { diceThroneSystemsForTest } from '../src/games/dicethrone/game.js';
import { createInitialSystemState, executePipeline } from '../src/engine/pipeline.js';
import { STATUS_IDS } from '../src/games/dicethrone/domain/ids.js';
import { INITIAL_HEALTH } from '../src/games/dicethrone/domain/types.js';

// 创建队列随机数
function createQueuedRandom(values) {
    let index = 0;
    const fallback = values.length > 0 ? values[values.length - 1] : 1;
    return {
        random: () => 0,
        d: (max) => {
            const raw = values[index] ?? fallback;
            index += 1;
            console.log(`[Random] d(${max}) = ${raw} (index=${index-1})`);
            return Math.min(Math.max(1, raw), max);
        },
        range: (min) => min,
        shuffle: (arr) => [...arr],
    };
}

// 创建英雄对战
function createHeroMatchup(hero0, hero1, mutate) {
    const playerIds = ['0', '1'];
    const random = createQueuedRandom([1, 1, 1, 1, 1, 4, 4, 4, 4, 4]);
    
    const pipelineConfig = {
        domain: DiceThroneDomain,
        systems: diceThroneSystemsForTest,
    };

    let state = {
        core: DiceThroneDomain.setup(playerIds, random),
        sys: createInitialSystemState(playerIds, diceThroneSystemsForTest, undefined),
    };

    const commands = [
        { type: 'SELECT_CHARACTER', playerId: '0', payload: { characterId: hero0 }, timestamp: Date.now() },
        { type: 'SELECT_CHARACTER', playerId: '1', payload: { characterId: hero1 }, timestamp: Date.now() },
        { type: 'PLAYER_READY', playerId: '1', payload: {}, timestamp: Date.now() },
        { type: 'HOST_START_GAME', playerId: '0', payload: {}, timestamp: Date.now() },
    ];

    for (const command of commands) {
        const result = executePipeline(pipelineConfig, state, command, random, playerIds);
        if (result.success) {
            state = result.state;
        }
    }

    if (mutate) {
        mutate(state.core);
    }

    return { state, random, pipelineConfig, playerIds };
}

// 执行命令
function executeCommand(context, type, playerId, payload = {}) {
    const command = { type, playerId, payload, timestamp: Date.now() };
    console.log(`\n[Command] ${type} by ${playerId}`, payload);
    
    const result = executePipeline(
        context.pipelineConfig,
        context.state,
        command,
        context.random,
        context.playerIds
    );
    
    if (result.success) {
        context.state = result.state;
        console.log(`[Success] Phase: ${result.state.sys.phase}, rollDiceCount: ${result.state.core.rollDiceCount}`);
        
        // 打印骰子状态
        if (result.state.core.dice && result.state.core.dice.length > 0) {
            const activeDice = result.state.core.dice.slice(0, result.state.core.rollDiceCount);
            console.log(`[Dice] Active: ${activeDice.length}, Values: [${activeDice.map(d => d.value).join(', ')}], Faces: [${activeDice.map(d => d.symbol).join(', ')}]`);
        }
        
        // 打印 HP
        console.log(`[HP] Player 0: ${result.state.core.players['0'].resources.hp}, Player 1: ${result.state.core.players['1'].resources.hp}`);
    } else {
        console.log(`[Error] ${result.error}`);
    }
    
    return result;
}

// 主测试
console.log('=== 开始测试 ===\n');

const context = createHeroMatchup('moon_elf', 'moon_elf', (core) => {
    // 给玩家0施加锁定 buff
    core.players['0'].statusEffects[STATUS_IDS.TARGETED] = 1;
    console.log('[Setup] Player 0 has TARGETED buff');
});

console.log('\n=== 执行命令序列 ===');

executeCommand(context, 'ADVANCE_PHASE', '0'); // main1 → offensiveRoll
executeCommand(context, 'ROLL_DICE', '0');
executeCommand(context, 'CONFIRM_ROLL', '0');
executeCommand(context, 'SELECT_ABILITY', '0', { abilityId: 'longbow-5-1' });
executeCommand(context, 'ADVANCE_PHASE', '0'); // offensiveRoll → defensiveRoll
executeCommand(context, 'ROLL_DICE', '1');
executeCommand(context, 'CONFIRM_ROLL', '1');
executeCommand(context, 'ADVANCE_PHASE', '1'); // defensiveRoll → main2（触发迷影步）

console.log('\n=== 最终状态 ===');
console.log(`Phase: ${context.state.sys.phase}`);
console.log(`Player 0 HP: ${context.state.core.players['0'].resources.hp} (expected: ${INITIAL_HEALTH - 7})`);
console.log(`Player 1 HP: ${context.state.core.players['1'].resources.hp} (expected: ${INITIAL_HEALTH - 7})`);
console.log(`Player 0 TARGETED: ${context.state.core.players['0'].statusEffects[STATUS_IDS.TARGETED] ?? 0}`);

const player1Damage = INITIAL_HEALTH - context.state.core.players['1'].resources.hp;
console.log(`\nPlayer 1 受到伤害: ${player1Damage} (expected: 7)`);

if (player1Damage !== 7) {
    console.log('\n❌ 测试失败！');
    console.log(`预期伤害: 7 (5 foot + 2 TARGETED)`);
    console.log(`实际伤害: ${player1Damage}`);
} else {
    console.log('\n✅ 测试通过！');
}
