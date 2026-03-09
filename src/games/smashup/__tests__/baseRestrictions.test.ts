/**
 * 大杀四方 - 基地限制校验测试
 *
 * 覆盖：
 * - base_the_homeworld: 额外出牌时 power>2 被拒，power≤2 通过
 * - base_secret_garden: 同 homeworld 的 extraPlayMinionPowerMax 限制
 * - base_tsars_palace: power≤2 随从被拒
 * - base_north_pole: 每回合每基地最多1个随从
 * - base_castle_of_ice: 所有随从被拒
 * - base_dread_lookout: 行动卡被拒
 */

import { describe, expect, it, beforeAll } from 'vitest';
import { initAllAbilities, resetAbilityInit } from '../abilities';
import { clearRegistry } from '../domain/abilityRegistry';
import { clearBaseAbilityRegistry } from '../domain/baseAbilities';
import { clearOngoingEffectRegistry, isOperationRestricted } from '../domain/ongoingEffects';
import { validate } from '../domain/commands';
import type { SmashUpCore, PlayerState, BaseInPlay, CardInstance } from '../domain/types';
import { SU_COMMANDS } from '../domain/types';
import type { MatchState } from '../../../engine/types';
import { SMASHUP_FACTION_IDS } from '../domain/ids';

// ============================================================================
// 初始化
// ============================================================================

beforeAll(() => {
    clearRegistry();
    clearBaseAbilityRegistry();
    clearOngoingEffectRegistry();
    resetAbilityInit();
    initAllAbilities();
});

// ============================================================================
// 辅助函数
// ============================================================================

function makePlayer(
    id: string, overrides?: Partial<PlayerState>,
): PlayerState {
    return {
        id, vp: 0, hand: [], deck: [], discard: [],
        minionsPlayed: 0, minionLimit: 1,
        actionsPlayed: 0, actionLimit: 1,
        factions: [SMASHUP_FACTION_IDS.ALIENS, SMASHUP_FACTION_IDS.DINOSAURS],
        ...overrides,
    };
}

function makeBase(defId: string, overrides?: Partial<BaseInPlay>): BaseInPlay {
    return { defId, minions: [], ongoingActions: [], ...overrides };
}

function makeCard(uid: string, defId: string, type: 'minion' | 'action', owner = '0'): CardInstance {
    return { uid, defId, type, owner };
}

function makeState(overrides?: Partial<SmashUpCore>): SmashUpCore {
    return {
        players: {
            '0': makePlayer('0'),
            '1': makePlayer('1'),
        },
        turnOrder: ['0', '1'],
        currentPlayerIndex: 0,
        bases: [],
        baseDeck: [],
        turnNumber: 1,
        nextUid: 100,
        ...overrides,
    } as SmashUpCore;
}

// ============================================================================
// base_the_homeworld: 母星 - 全局 extraMinionPowerMax
// 母星规则："每当有一个随从打出到这里后，它的拥有者可以额外打出一个力量为2或以下的随从"
// 力量≤2 限制通过 LIMIT_MODIFIED 事件的 powerMax 字段全局生效（不限制目标基地）
// ============================================================================

describe('base_the_homeworld: 母星力量限制（全局）', () => {
    it('母星本身不再有基地级限制', () => {
        // 移除了 restrictions，isOperationRestricted 不再拦截
        const state = makeState({
            bases: [makeBase('base_the_homeworld')],
            players: {
                '0': makePlayer('0', { minionsPlayed: 1, minionLimit: 2 }),
                '1': makePlayer('1'),
            },
        });

        // 即使 power>2 也不被基地级限制拦截（限制在 validate 层全局检查）
        const restricted = isOperationRestricted(state, 0, '0', 'play_minion', { basePower: 5 });
        expect(restricted).toBe(false);
    });

    it('validate：extraMinionPowerMax 生效时 power>2 随从被拒（任意基地）', () => {
        // alien_invader 力量=3
        const state = makeState({
            bases: [makeBase('base_the_homeworld'), makeBase('base_rhodes_plaza')],
            players: {
                '0': makePlayer('0', {
                    minionsPlayed: 1, minionLimit: 2,
                    extraMinionPowerMax: 2,
                    hand: [makeCard('h1', 'alien_invader', 'minion')],
                }),
                '1': makePlayer('1'),
            },
        });
        const matchState: MatchState<SmashUpCore> = {
            core: state,
            sys: { phase: 'playCards' } as any,  
        };

        // 打到母星被拒
        const r1 = validate(matchState, {
            type: SU_COMMANDS.PLAY_MINION,
            playerId: '0',
            payload: { cardUid: 'h1', baseIndex: 0 },
        } as any);  
        expect(r1.valid).toBe(false);
        expect(r1.error).toContain('力量≤2');

        // 打到其他基地也被拒（全局限制）
        const r2 = validate(matchState, {
            type: SU_COMMANDS.PLAY_MINION,
            playerId: '0',
            payload: { cardUid: 'h1', baseIndex: 1 },
        } as any);  
        expect(r2.valid).toBe(false);
    });

    it('validate：extraMinionPowerMax 生效时 power≤2 随从通过', () => {
        // dino_war_raptor 力量=2
        const state = makeState({
            bases: [makeBase('base_the_homeworld'), makeBase('base_rhodes_plaza')],
            players: {
                '0': makePlayer('0', {
                    minionsPlayed: 1, minionLimit: 2,
                    extraMinionPowerMax: 2,
                    hand: [makeCard('h1', 'dino_war_raptor', 'minion')],
                }),
                '1': makePlayer('1'),
            },
        });
        const matchState: MatchState<SmashUpCore> = {
            core: state,
            sys: { phase: 'playCards' } as any,  
        };

        // 打到母星通过
        const r1 = validate(matchState, {
            type: SU_COMMANDS.PLAY_MINION,
            playerId: '0',
            payload: { cardUid: 'h1', baseIndex: 0 },
        } as any);  
        expect(r1.valid).toBe(true);

        // 打到其他基地也通过
        const r2 = validate(matchState, {
            type: SU_COMMANDS.PLAY_MINION,
            playerId: '0',
            payload: { cardUid: 'h1', baseIndex: 1 },
        } as any);  
        expect(r2.valid).toBe(true);
    });

    it('validate：首次打随从不受 extraMinionPowerMax 限制', () => {
        const state = makeState({
            bases: [makeBase('base_the_homeworld')],
            players: {
                '0': makePlayer('0', {
                    minionsPlayed: 0, minionLimit: 1,
                    hand: [makeCard('h1', 'alien_invader', 'minion')],
                }),
                '1': makePlayer('1'),
            },
        });
        const matchState: MatchState<SmashUpCore> = {
            core: state,
            sys: { phase: 'playCards' } as any,  
        };

        const result = validate(matchState, {
            type: SU_COMMANDS.PLAY_MINION,
            playerId: '0',
            payload: { cardUid: 'h1', baseIndex: 0 },
        } as any);  
        expect(result.valid).toBe(true);
    });

    it('validate：全局受限额度和普通额度同时存在时，power>2 随从仍可通过', () => {
        const state = makeState({
            bases: [makeBase('base_the_homeworld'), makeBase('base_rhodes_plaza')],
            players: {
                '0': makePlayer('0', {
                    minionsPlayed: 1,
                    minionLimit: 3,
                    extraMinionPowerMax: 2,
                    extraMinionPowerCaps: [2],
                    hand: [makeCard('h1', 'alien_invader', 'minion')],
                }),
                '1': makePlayer('1'),
            },
        });
        const matchState: MatchState<SmashUpCore> = {
            core: state,
            sys: { phase: 'playCards' } as any,
        };

        const result = validate(matchState, {
            type: SU_COMMANDS.PLAY_MINION,
            playerId: '0',
            payload: { cardUid: 'h1', baseIndex: 1 },
        } as any);
        expect(result.valid).toBe(true);
    });
});

// ============================================================================
// base_secret_garden: 神秘花园 - 同 homeworld 的限制模式
// ============================================================================

describe('base_secret_garden: 神秘花园力量限制', () => {
    it('首次打随从无限制', () => {
        const state = makeState({
            bases: [makeBase('base_secret_garden')],
            players: {
                '0': makePlayer('0', { minionsPlayed: 0 }),
                '1': makePlayer('1'),
            },
        });

        const restricted = isOperationRestricted(state, 0, '0', 'play_minion', { basePower: 5 });
        expect(restricted).toBe(false);
    });

    it('只剩神秘花园基地限定额度时，power>2 被拒', () => {
        const state = makeState({
            bases: [makeBase('base_secret_garden')],
            players: {
                '0': makePlayer('0', {
                    minionsPlayed: 1,
                    minionLimit: 1,
                    baseLimitedMinionQuota: { 0: 1 },
                }),
                '1': makePlayer('1'),
            },
        });

        const restricted = isOperationRestricted(state, 0, '0', 'play_minion', {
            minionDefId: 'alien_invader',
            basePower: 4,
        });
        expect(restricted).toBe(true);
    });

    it('只剩神秘花园基地限定额度时，power≤2 通过', () => {
        const state = makeState({
            bases: [makeBase('base_secret_garden')],
            players: {
                '0': makePlayer('0', {
                    minionsPlayed: 1,
                    minionLimit: 1,
                    baseLimitedMinionQuota: { 0: 1 },
                }),
                '1': makePlayer('1'),
            },
        });

        const restricted = isOperationRestricted(state, 0, '0', 'play_minion', {
            minionDefId: 'wizard_neophyte',
            basePower: 2,
        });
        expect(restricted).toBe(false);
    });

    it('还有其他可用随从额度时，power>2 不应被神秘花园误拦截', () => {
        const state = makeState({
            bases: [makeBase('base_secret_garden')],
            players: {
                '0': makePlayer('0', {
                    minionsPlayed: 1,
                    minionLimit: 2,
                    baseLimitedMinionQuota: { 0: 1 },
                }),
                '1': makePlayer('1'),
            },
        });

        const restricted = isOperationRestricted(state, 0, '0', 'play_minion', {
            minionDefId: 'killer_plant_water_lily',
            basePower: 3,
        });
        expect(restricted).toBe(false);
    });

    it('validate：消费过神秘花园≤2额度后，仍可用其他额度打出3战力随从到这里', () => {
        const state = makeState({
            bases: [makeBase('base_secret_garden')],
            players: {
                '0': makePlayer('0', {
                    minionsPlayed: 1,
                    minionLimit: 2,
                    baseLimitedMinionQuota: { 0: 0 },
                    hand: [makeCard('m1', 'killer_plant_water_lily', 'minion')],
                }),
                '1': makePlayer('1'),
            },
        });
        const matchState: MatchState<SmashUpCore> = {
            core: state,
            sys: { phase: 'playCards' } as any,
        };

        const result = validate(matchState, {
            type: SU_COMMANDS.PLAY_MINION,
            playerId: '0',
            payload: { cardUid: 'm1', baseIndex: 0 },
        } as any);
        expect(result.valid).toBe(true);
    });
});

// ============================================================================
// base_tsars_palace: 沙皇宫殿 - power≤2 随从被拒
// ============================================================================

describe('base_tsars_palace: 沙皇宫殿 power≤2 限制', () => {
    it('power=2 随从被拒', () => {
        const state = makeState({
            bases: [makeBase('base_tsars_palace')],
        });

        const restricted = isOperationRestricted(state, 0, '0', 'play_minion', { basePower: 2 });
        expect(restricted).toBe(true);
    });

    it('power=1 随从被拒', () => {
        const state = makeState({
            bases: [makeBase('base_tsars_palace')],
        });

        const restricted = isOperationRestricted(state, 0, '0', 'play_minion', { basePower: 1 });
        expect(restricted).toBe(true);
    });

    it('power=3 随从通过', () => {
        const state = makeState({
            bases: [makeBase('base_tsars_palace')],
        });

        const restricted = isOperationRestricted(state, 0, '0', 'play_minion', { basePower: 3 });
        expect(restricted).toBe(false);
    });

    it('power=5 随从通过', () => {
        const state = makeState({
            bases: [makeBase('base_tsars_palace')],
        });

        const restricted = isOperationRestricted(state, 0, '0', 'play_minion', { basePower: 5 });
        expect(restricted).toBe(false);
    });
});

// ============================================================================
// base_north_pole: 北极基地 - 每回合每基地最多1个随从
// ============================================================================

describe('base_north_pole: 每回合每基地最多1个随从', () => {
    it('同一玩家本回合已在该基地打出1个随从后，再打出会被限制', () => {
        const state = makeState({
            bases: [makeBase('base_north_pole')],
            players: {
                '0': makePlayer('0', {
                    minionsPlayedPerBase: { 0: 1 },
                }),
                '1': makePlayer('1'),
            },
        });

        const restricted = isOperationRestricted(state, 0, '0', 'play_minion', { basePower: 3 });
        expect(restricted).toBe(true);
    });

    it('本回合尚未在该基地打出随从时，不受限制', () => {
        const state = makeState({
            bases: [makeBase('base_north_pole')],
            players: {
                '0': makePlayer('0', {
                    minionsPlayedPerBase: { 0: 0 },
                }),
                '1': makePlayer('1'),
            },
        });

        const restricted = isOperationRestricted(state, 0, '0', 'play_minion', { basePower: 3 });
        expect(restricted).toBe(false);
    });
});

// ============================================================================
// base_castle_of_ice: 冰之城堡 - 禁止所有随从
// ============================================================================

describe('base_castle_of_ice: 冰之城堡禁止所有随从', () => {
    it('任何随从都被拒', () => {
        const state = makeState({
            bases: [makeBase('base_castle_of_ice')],
        });

        expect(isOperationRestricted(state, 0, '0', 'play_minion', { basePower: 1 })).toBe(true);
        expect(isOperationRestricted(state, 0, '0', 'play_minion', { basePower: 5 })).toBe(true);
        expect(isOperationRestricted(state, 0, '0', 'play_minion', { basePower: 10 })).toBe(true);
    });

    it('行动卡不受限制', () => {
        const state = makeState({
            bases: [makeBase('base_castle_of_ice')],
        });

        const restricted = isOperationRestricted(state, 0, '0', 'play_action');
        expect(restricted).toBe(false);
    });
});

// ============================================================================
// base_dread_lookout: 恐怖眺望台 - 禁止行动卡
// ============================================================================

describe('base_dread_lookout: 恐怖眺望台禁止行动卡', () => {
    it('行动卡被拒', () => {
        const state = makeState({
            bases: [makeBase('base_dread_lookout')],
        });

        const restricted = isOperationRestricted(state, 0, '0', 'play_action');
        expect(restricted).toBe(true);
    });

    it('随从不受限制', () => {
        const state = makeState({
            bases: [makeBase('base_dread_lookout')],
        });

        const restricted = isOperationRestricted(state, 0, '0', 'play_minion', { basePower: 3 });
        expect(restricted).toBe(false);
    });

    it('validate 命令层面：打出行动卡到恐怖眺望台被拒', () => {
        const state = makeState({
            bases: [makeBase('base_dread_lookout')],
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('h1', 'pirate_full_sail', 'action')],
                }),
                '1': makePlayer('1'),
            },
        });
        const matchState: MatchState<SmashUpCore> = {
            core: state,
            sys: { phase: 'playCards' } as any,  
        };

        const result = validate(matchState, {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'h1', targetBaseIndex: 0 },
        } as any);  
        expect(result.valid).toBe(false);
    });
});
