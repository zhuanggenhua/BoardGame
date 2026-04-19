/**
 * 暗影穿刺 (Shadow Shank) + 伏击 (Sneak Attack) 伤害丢失 Bug 复现测试
 *
 * Bug 描述：暗影穿刺（终极技能，5暗影面）造成 CP+5 伤害，
 * 使用伏击 Token 后掷骰加伤，但最终伤害只有 CP+5，伏击的奖励骰伤害没有加上。
 * 
 * 预期：damage = (CP + 5) + dieValue
 * 实际：damage = CP + 5（伏击奖励骰伤害丢失）
 */

import { describe, it, expect } from 'vitest';
import { DiceThroneDomain } from '../domain';
import { TOKEN_IDS } from '../domain/ids';
import { RESOURCE_IDS } from '../domain/resources';
import type { DiceThroneCore, DiceThroneCommand } from '../domain/types';
import type { MatchState, PlayerId, RandomFn } from '../../../engine/types';
import type { EngineSystem } from '../../../engine/systems/types';
import { createInitialSystemState, executePipeline } from '../../../engine/pipeline';
import { diceThroneSystemsForTest, formatDiceThroneActionEntry } from '../game';
import {
    createQueuedRandom,
    cmd,
    assertState,
} from './test-utils';
import { GameTestRunner } from '../../../engine/testing';

const testSystems = diceThroneSystemsForTest as unknown as EngineSystem<DiceThroneCore>[];

const shadowThiefSetupCommands = [
    { type: 'SELECT_CHARACTER', playerId: '0', payload: { characterId: 'shadow_thief' } },
    { type: 'SELECT_CHARACTER', playerId: '1', payload: { characterId: 'shadow_thief' } },
    { type: 'PLAYER_READY', playerId: '1', payload: {} },
    { type: 'HOST_START_GAME', playerId: '0', payload: {} },
];

function createShadowThiefState(playerIds: PlayerId[], random: RandomFn): MatchState<DiceThroneCore> {
    const core = DiceThroneDomain.setup(playerIds, random);
    const sys = createInitialSystemState(playerIds, testSystems, undefined);
    let state: MatchState<DiceThroneCore> = { sys, core };
    const pipelineConfig = { domain: DiceThroneDomain, systems: testSystems };
    for (const c of shadowThiefSetupCommands) {
        const command = { type: c.type, playerId: c.playerId, payload: c.payload, timestamp: Date.now() } as DiceThroneCommand;
        const result = executePipeline(pipelineConfig, state, command, random, playerIds);
        if (result.success) state = result.state as MatchState<DiceThroneCore>;
    }
    return state;
}

const createShadowThiefSetup = (opts?: {
    mutate?: (core: DiceThroneCore) => void;
}) => {
    return (playerIds: PlayerId[], random: RandomFn): MatchState<DiceThroneCore> => {
        const state = createShadowThiefState(playerIds, random);
        // 清空手牌避免响应窗口干扰
        state.core.players['0'].hand = [];
        state.core.players['1'].hand = [];
        opts?.mutate?.(state.core);
        return state;
    };
};

describe('暗影穿刺 + 伏击 伤害丢失 Bug 复现', () => {
    it('终极技能 shadow-shank + sneak_attack：伤害应包含伏击奖励骰', () => {
        // 随机数队列：
        // 5 × d(6)=6 → 全 shadow 面 → 触发 shadow-shank
        // 伏击掷骰 d(6)=5 → 加 5 点伤害
        const queuedRandom = createQueuedRandom([
            6, 6, 6, 6, 6,  // 进攻掷骰：5 个 shadow
            5,               // 伏击奖励骰：5
        ]);

        // 初始 CP = 2（INITIAL_CP）
        // shadow-shank preDefense: gainCp(3) → CP = 5
        // shadow-shank withDamage: damage = CP + 5 = 10
        // 伏击奖励骰：+5
        // 预期总伤害：10 + 5 = 15
        // 防御者 HP：50 - 15 = 35

        const runner = new GameTestRunner({
            domain: DiceThroneDomain,
            systems: testSystems,
            playerIds: ['0', '1'],
            random: queuedRandom,
            setup: createShadowThiefSetup({
                mutate: (core) => {
                    // 给攻击者 1 层伏击 Token
                    core.players['0'].tokens[TOKEN_IDS.SNEAK_ATTACK] = 1;
                    // 确保防御者没有防御 Token（避免切换到防御方响应）
                    core.players['1'].tokens[TOKEN_IDS.TAIJI] = 0;
                    core.players['1'].tokens[TOKEN_IDS.EVASIVE] = 0;
                },
            }),
            assertFn: assertState,
            silent: true, // 关闭调试日志
        });

        const result = runner.run({
            name: '暗影穿刺 + 伏击 伤害验证',
            commands: [
                // 进攻阶段
                cmd('ADVANCE_PHASE', '0'),     // main1 → offensiveRoll
                cmd('ROLL_DICE', '0'),         // 5 × d(6)=6 → 全 shadow
                cmd('CONFIRM_ROLL', '0'),
                cmd('SELECT_ABILITY', '0', { abilityId: 'shadow-shank' }),
                cmd('ADVANCE_PHASE', '0'),     // offensiveRoll exit → 终极不可防御 → resolveAttack
                // → TOKEN_RESPONSE_REQUESTED（攻击方有伏击）→ halt
                // Token 响应窗口：使用伏击
                cmd('USE_TOKEN', '0', { tokenId: TOKEN_IDS.SNEAK_ATTACK, amount: 1 }),
                cmd('SKIP_TOKEN_RESPONSE', '0'), // 跳过后续响应 → 伤害结算
            ],
            expect: {
                turnPhase: 'main2',
                players: {
                    '0': {
                        tokens: {
                            [TOKEN_IDS.SNEAK_ATTACK]: 0, // 伏击被消耗
                            [TOKEN_IDS.SNEAK]: 1,         // shadow-shank 授予潜行
                        },
                        // CP = 2 + 3 (gainCp) = 5，shadow-shank 不消耗 CP
                        cp: 5,
                    },
                    '1': {
                        // 防御者 HP = 50 - 15 = 35
                        // 如果 bug 存在，HP 会是 50 - 10 = 40
                        hp: 35,
                    },
                },
            },
        });

        expect(result.assertionErrors).toHaveLength(0);

        // 验证事件流
        const allEvents = result.steps.flatMap(s => s.events);
        expect(allEvents).toContain('TOKEN_RESPONSE_REQUESTED');
        expect(allEvents).toContain('TOKEN_USED');
        expect(allEvents).toContain('BONUS_DIE_ROLLED');
        expect(allEvents).toContain('DAMAGE_DEALT');
    });

    it('复现线上场景：CP=6 + gainCp(3) = 9, damage 应为 9+5+dieValue', () => {
        // 模拟线上 bug 报告的实际 CP 值
        // 攻击前 CP = 6，gainCp(3) 后 CP = 9
        // damage = 9 + 5 = 14（基础）+ dieValue（伏击奖励骰）
        const queuedRandom = createQueuedRandom([
            6, 6, 6, 6, 6,  // 进攻掷骰：5 个 shadow
            3,               // 伏击奖励骰：3
        ]);

        const runner = new GameTestRunner({
            domain: DiceThroneDomain,
            systems: testSystems,
            playerIds: ['0', '1'],
            random: queuedRandom,
            setup: createShadowThiefSetup({
                mutate: (core) => {
                    // 设置攻击者 CP = 6（模拟线上场景）
                    core.players['0'].resources[RESOURCE_IDS.CP] = 6;
                    // 给攻击者 1 层伏击 Token
                    core.players['0'].tokens[TOKEN_IDS.SNEAK_ATTACK] = 1;
                    // 确保防御者没有防御 Token
                    core.players['1'].tokens[TOKEN_IDS.TAIJI] = 0;
                    core.players['1'].tokens[TOKEN_IDS.EVASIVE] = 0;
                },
            }),
            assertFn: assertState,
            silent: true,
        });

        // CP=6 → gainCp(3) → CP=9 → damage = 9+5 = 14 → 伏击+3 → 总伤害 17
        // 防御者 HP = 50 - 17 = 33
        const result = runner.run({
            name: '线上场景复现：CP=6 + 伏击',
            commands: [
                cmd('ADVANCE_PHASE', '0'),
                cmd('ROLL_DICE', '0'),
                cmd('CONFIRM_ROLL', '0'),
                cmd('SELECT_ABILITY', '0', { abilityId: 'shadow-shank' }),
                cmd('ADVANCE_PHASE', '0'),
                cmd('USE_TOKEN', '0', { tokenId: TOKEN_IDS.SNEAK_ATTACK, amount: 1 }),
                cmd('SKIP_TOKEN_RESPONSE', '0'),
            ],
            expect: {
                turnPhase: 'main2',
                players: {
                    '0': {
                        cp: 9, // 6 + 3
                        tokens: { [TOKEN_IDS.SNEAK_ATTACK]: 0 },
                    },
                    '1': {
                        // 如果 bug 存在：HP = 50 - 14 = 36（伏击奖励骰没加上）
                        // 正确：HP = 50 - 17 = 33
                        hp: 33,
                    },
                },
            },
        });

        expect(result.assertionErrors).toHaveLength(0);
    });

    it('验证 ActionLog：TOKEN_USED 显示伏击掷骰值，DAMAGE_DEALT 包含总伤害', () => {
        // CP=6, gainCp(3)→CP=9, baseDamage=14, sneakDie=3, total=17
        const queuedRandom = createQueuedRandom([
            6, 6, 6, 6, 6,  // 全 shadow
            3,               // 伏击奖励骰
        ]);

        const setup = createShadowThiefSetup({
            mutate: (core) => {
                core.players['0'].resources[RESOURCE_IDS.CP] = 6;
                core.players['0'].tokens[TOKEN_IDS.SNEAK_ATTACK] = 1;
                core.players['1'].tokens[TOKEN_IDS.TAIJI] = 0;
                core.players['1'].tokens[TOKEN_IDS.EVASIVE] = 0;
            },
        });

        const pipelineConfig = { domain: DiceThroneDomain, systems: testSystems };
        let state = setup(['0', '1'], queuedRandom);

        const commands = [
            { type: 'ADVANCE_PHASE', playerId: '0', payload: {} },
            { type: 'ROLL_DICE', playerId: '0', payload: {} },
            { type: 'CONFIRM_ROLL', playerId: '0', payload: {} },
            { type: 'SELECT_ABILITY', playerId: '0', payload: { abilityId: 'shadow-shank' } },
            { type: 'ADVANCE_PHASE', playerId: '0', payload: {} },
            { type: 'USE_TOKEN', playerId: '0', payload: { tokenId: TOKEN_IDS.SNEAK_ATTACK, amount: 1 } },
            { type: 'SKIP_TOKEN_RESPONSE', playerId: '0', payload: {} },
        ];

        let useTokenEvents: any[] = [];
        let skipTokenEvents: any[] = [];
        for (const c of commands) {
            const command = { ...c, timestamp: Date.now() } as DiceThroneCommand;
            const result = executePipeline(pipelineConfig, state, command, queuedRandom, ['0', '1']);
            if (!result.success) throw new Error(`Command ${c.type} failed: ${result.error}`);
            if (c.type === 'USE_TOKEN') {
                useTokenEvents = result.events;
            }
            if (c.type === 'SKIP_TOKEN_RESPONSE') {
                skipTokenEvents = result.events;
            }
            state = result.state as MatchState<DiceThroneCore>;
        }

        // USE_TOKEN 事件中 damageModifier 仍为 0（reducer 层不变，避免双重加伤）
        const tokenUsedEvent = useTokenEvents.find((e: any) => e.type === 'TOKEN_USED');
        expect(tokenUsedEvent).toBeDefined();
        expect(tokenUsedEvent.payload.damageModifier).toBe(0);

        // 同批事件中有 BONUS_DIE_ROLLED（pendingDamageBonus=3）
        const bonusDieEvent = useTokenEvents.find((e: any) => e.type === 'BONUS_DIE_ROLLED');
        expect(bonusDieEvent).toBeDefined();
        expect(bonusDieEvent.payload.pendingDamageBonus).toBe(3);

        // DAMAGE_DEALT 事件的 amount = 14 + 3 = 17
        const damageEvent = skipTokenEvents.find((e: any) => e.type === 'DAMAGE_DEALT');
        expect(damageEvent).toBeDefined();
        expect(damageEvent.payload.amount).toBe(17);
        const sneakMod = damageEvent.payload.modifiers.find((m: any) => m.sourceId === 'sneak_attack');
        expect(sneakMod).toBeDefined();
        expect(sneakMod.value).toBe(3);

        // 验证 ActionLog formatEntry 对 USE_TOKEN 命令的输出
        // formatEntry 应该用 BONUS_DIE_ROLLED 的掷骰值（3）替代 TOKEN_USED 的 damageModifier（0）
        const useTokenCommand = { type: 'USE_TOKEN', playerId: '0', payload: { tokenId: TOKEN_IDS.SNEAK_ATTACK, amount: 1 }, timestamp: 1 };
        const logEntries = formatDiceThroneActionEntry({ command: useTokenCommand as any, state: state as any, events: useTokenEvents });
        // 找到 TOKEN_USED 的日志条目
        const tokenLogEntries = Array.isArray(logEntries) ? logEntries : logEntries ? [logEntries] : [];
        const tokenUsedLog = tokenLogEntries.find((e: any) => e.kind === 'TOKEN_USED');
        expect(tokenUsedLog).toBeDefined();
        // tokenModifier segment 的 amount 应该是 3（掷骰值），不是 0
        const modifierSeg = tokenUsedLog!.segments.find(
            (s: any) => s.type === 'i18n' && s.key === 'actionLog.tokenModifier'
        ) as any;
        expect(modifierSeg).toBeDefined();
        expect(modifierSeg.params.amount).toBe(3);
    });
});
