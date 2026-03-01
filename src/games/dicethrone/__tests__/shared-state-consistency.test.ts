/**
 * 共享状态效果跨英雄一致性测试 + 燃烧/中毒 upkeep 正确性测试
 *
 * Task 10.3
 *
 * Property 9: 共享 Token 定义（击倒、闪避）在不同英雄间完全一致
 * Property 10: 燃烧/中毒 upkeep 处理正确（燃烧每层1伤害移除1层，中毒持续效果不移除层数）
 */

import { describe, it, expect } from 'vitest';
import { CHARACTER_DATA_MAP, ALL_TOKEN_DEFINITIONS } from '../domain/characters';
import type { TokenDef } from '../domain/tokenTypes';
import type { SelectableCharacterId } from '../domain/types';
import { STATUS_IDS, TOKEN_IDS } from '../domain/ids';
import {
    createRunner,
    fixedRandom,
    cmd,
    advanceTo,
    createNoResponseSetupWithEmptyHand,
} from './test-utils';

const HEROES: SelectableCharacterId[] = [
    'monk', 'barbarian', 'paladin', 'pyromancer', 'moon_elf', 'shadow_thief',
];

// ============================================================================
// 1. 共享 Token 定义跨英雄一致性（Property 9）
// ============================================================================

describe('共享 Token 定义跨英雄一致性', () => {
    function getTokensByIdAcrossHeroes(): Map<string, { heroId: string; def: TokenDef }[]> {
        const map = new Map<string, { heroId: string; def: TokenDef }[]>();
        for (const heroId of HEROES) {
            const data = CHARACTER_DATA_MAP[heroId];
            for (const def of data.tokens) {
                if (!map.has(def.id)) map.set(def.id, []);
                map.get(def.id)!.push({ heroId, def });
            }
        }
        return map;
    }

    const KEY_FIELDS: (keyof TokenDef)[] = ['category', 'stackLimit', 'frameId', 'atlasId'];

    it('同 ID 的 Token 在不同英雄间关键字段一致', () => {
        const tokenMap = getTokensByIdAcrossHeroes();
        const violations: string[] = [];
        for (const [tokenId, entries] of tokenMap) {
            if (entries.length < 2) continue;
            const ref = entries[0];
            for (let i = 1; i < entries.length; i++) {
                for (const field of KEY_FIELDS) {
                    const refVal = JSON.stringify(ref.def[field]);
                    const otherVal = JSON.stringify(entries[i].def[field]);
                    if (refVal !== otherVal) {
                        violations.push(
                            `[${tokenId}] ${field}: ${ref.heroId}=${refVal} vs ${entries[i].heroId}=${otherVal}`
                        );
                    }
                }
            }
        }
        expect(violations).toEqual([]);
    });

    it('击倒（knockdown）在所有拥有它的英雄间定义一致', () => {
        const tokenMap = getTokensByIdAcrossHeroes();
        const entries = tokenMap.get(STATUS_IDS.KNOCKDOWN);
        expect(entries?.length).toBeGreaterThanOrEqual(2);
        if (entries && entries.length >= 2) {
            const ref = entries[0].def;
            for (const e of entries.slice(1)) {
                expect(e.def.category).toBe(ref.category);
                expect(e.def.stackLimit).toBe(ref.stackLimit);
            }
        }
    });

    it('闪避（evasive）在所有拥有它的英雄间定义一致', () => {
        const tokenMap = getTokensByIdAcrossHeroes();
        const entries = tokenMap.get(TOKEN_IDS.EVASIVE);
        expect(entries?.length).toBeGreaterThanOrEqual(2);
        if (entries && entries.length >= 2) {
            const ref = entries[0].def;
            for (const e of entries.slice(1)) {
                expect(e.def.category).toBe(ref.category);
                expect(e.def.activeUse?.effect.type).toBe(ref.activeUse?.effect.type);
                expect(e.def.activeUse?.effect.rollSuccess?.range).toEqual(
                    ref.activeUse?.effect.rollSuccess?.range
                );
            }
        }
    });

    it('ALL_TOKEN_DEFINITIONS 去重后无重复 ID', () => {
        const ids = ALL_TOKEN_DEFINITIONS.map(d => d.id);
        expect(ids.length).toBe(new Set(ids).size);
    });
});

// ============================================================================
// 2. 燃烧/中毒 upkeep 处理正确性（Property 10）
// ============================================================================

/** 构建"推进到玩家0的下一个 upkeep"的命令序列 */
const advanceToPlayer0Upkeep = () => [
    // 玩家0: main1 → discard → 结束回合
    ...advanceTo('discard', '0'),
    cmd('ADVANCE_PHASE', '0'),
    // 玩家1: main1 → discard → 结束回合 → 玩家0 upkeep
    ...advanceTo('discard', '1'),
    cmd('ADVANCE_PHASE', '1'),
];

describe('燃烧 upkeep 处理正确性', () => {
    it('1层燃烧：造成1点伤害，移除1层', () => {
        const runner = createRunner(fixedRandom);
        const result = runner.run({
            name: '1层燃烧upkeep',
            setup: (playerIds, random) => {
                const state = createNoResponseSetupWithEmptyHand()(playerIds, random);
                state.core.players['0'].statusEffects[STATUS_IDS.BURN] = 1;
                return state;
            },
            commands: advanceToPlayer0Upkeep(),
            expect: {
                players: { '0': { hp: 49, statusEffects: { [STATUS_IDS.BURN]: 0 } } },
            },
        });
        expect(result.assertionErrors).toEqual([]);
    });

    it('3层燃烧：造成3点伤害，移除1层（剩余2层）', () => {
        const runner = createRunner(fixedRandom);
        const result = runner.run({
            name: '3层燃烧upkeep',
            setup: (playerIds, random) => {
                const state = createNoResponseSetupWithEmptyHand()(playerIds, random);
                state.core.players['0'].statusEffects[STATUS_IDS.BURN] = 3;
                return state;
            },
            commands: advanceToPlayer0Upkeep(),
            expect: {
                players: { '0': { hp: 47, statusEffects: { [STATUS_IDS.BURN]: 2 } } },
            },
        });
        expect(result.assertionErrors).toEqual([]);
    });
});

describe('中毒 upkeep 处理正确性', () => {
    it('1层中毒：造成1点伤害，层数不变（持续效果）', () => {
        const runner = createRunner(fixedRandom);
        const result = runner.run({
            name: '1层中毒upkeep',
            setup: (playerIds, random) => {
                const state = createNoResponseSetupWithEmptyHand()(playerIds, random);
                state.core.players['0'].statusEffects[STATUS_IDS.POISON] = 1;
                return state;
            },
            commands: advanceToPlayer0Upkeep(),
            expect: {
                players: { '0': { hp: 49, statusEffects: { [STATUS_IDS.POISON]: 1 } } },
            },
        });
        expect(result.assertionErrors).toEqual([]);
    });

    it('2层中毒：造成2点伤害，层数不变（持续效果）', () => {
        const runner = createRunner(fixedRandom);
        const result = runner.run({
            name: '2层中毒upkeep',
            setup: (playerIds, random) => {
                const state = createNoResponseSetupWithEmptyHand()(playerIds, random);
                state.core.players['0'].statusEffects[STATUS_IDS.POISON] = 2;
                return state;
            },
            commands: advanceToPlayer0Upkeep(),
            expect: {
                players: { '0': { hp: 48, statusEffects: { [STATUS_IDS.POISON]: 2 } } },
            },
        });
        expect(result.assertionErrors).toEqual([]);
    });
});

describe('燃烧+中毒同时存在时 upkeep 处理', () => {
    it('2层燃烧+1层中毒：总共造成3点伤害', () => {
        const runner = createRunner(fixedRandom);
        const result = runner.run({
            name: '燃烧+中毒同时',
            setup: (playerIds, random) => {
                const state = createNoResponseSetupWithEmptyHand()(playerIds, random);
                state.core.players['0'].statusEffects[STATUS_IDS.BURN] = 2;
                state.core.players['0'].statusEffects[STATUS_IDS.POISON] = 1;
                return state;
            },
            commands: advanceToPlayer0Upkeep(),
            expect: {
                players: {
                    '0': {
                        hp: 47,
                        // 燃烧移除 1 层（2→1），毒液持续不变（1→1）
                        statusEffects: { [STATUS_IDS.BURN]: 1, [STATUS_IDS.POISON]: 1 },
                    },
                },
            },
        });
        expect(result.assertionErrors).toEqual([]);
    });
});

// ============================================================================
// 3. 眩晕/脑震荡/缠绕处理正确性
// ============================================================================

describe('眩晕（stun）进攻阶段处理', () => {
    it('有眩晕时进入 offensiveRoll 移除眩晕，再推进到 main2', () => {
        const runner = createRunner(fixedRandom);
        const result = runner.run({
            name: '眩晕跳过进攻',
            setup: (playerIds, random) => {
                const state = createNoResponseSetupWithEmptyHand()(playerIds, random);
                state.core.players['0'].statusEffects[STATUS_IDS.STUN] = 1;
                return state;
            },
            commands: [
                cmd('ADVANCE_PHASE', '0'), // main1 → offensiveRoll（stun 移除）
                cmd('ADVANCE_PHASE', '0'), // offensiveRoll → main2（无 pendingAttack）
            ],
            expect: {
                turnPhase: 'main2',
                players: { '0': { statusEffects: { [STATUS_IDS.STUN]: 0 } } },
            },
        });
        expect(result.assertionErrors).toEqual([]);
    });
});

describe('脑震荡（concussion）收入阶段处理', () => {
    it('有脑震荡时跳过收入阶段并移除脑震荡', () => {
        const runner = createRunner(fixedRandom);
        const result = runner.run({
            name: '脑震荡跳过收入',
            setup: (playerIds, random) => {
                const state = createNoResponseSetupWithEmptyHand()(playerIds, random);
                state.core.players['0'].statusEffects[STATUS_IDS.CONCUSSION] = 1;
                return state;
            },
            commands: advanceToPlayer0Upkeep(),
        });
        // 脑震荡被移除
        expect(result.finalState.core.players['0'].statusEffects[STATUS_IDS.CONCUSSION]).toBe(0);
    });
});

describe('缠绕（entangle）进攻阶段处理', () => {
    it('有缠绕时减少1次掷骰机会并移除缠绕', () => {
        const runner = createRunner(fixedRandom);
        const result = runner.run({
            name: '缠绕减少掷骰',
            setup: (playerIds, random) => {
                const state = createNoResponseSetupWithEmptyHand()(playerIds, random);
                state.core.players['0'].statusEffects[STATUS_IDS.ENTANGLE] = 1;
                return state;
            },
            commands: [
                cmd('ADVANCE_PHASE', '0'), // main1 → offensiveRoll
            ],
            expect: {
                turnPhase: 'offensiveRoll',
                players: { '0': { statusEffects: { [STATUS_IDS.ENTANGLE]: 0 } } },
                roll: { limit: 2 },
            },
        });
        expect(result.assertionErrors).toEqual([]);
    });
});
