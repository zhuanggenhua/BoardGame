/**
 * 大杀四方 - 需 Prompt 交互的基地能力测试
 *
 * 覆盖 triggerBaseAbility 层面的事件生成（Prompt continuation 设置），
 * 验证正确的触发条件、事件类型和 continuation 上下文。
 *
 * - base_the_homeworld: onMinionPlayed → LIMIT_MODIFIED
 * - base_the_mothership: afterScoring → Prompt（冠军收回 ≤3 随从）
 * - base_ninja_dojo: afterScoring → Prompt（消灭随从）
 * - base_pirate_cove: afterScoring → 多 Prompt（非冠军移动随从）
 * - base_tortuga: afterScoring → Prompt（亚军移动随从）
 * - base_wizard_academy: afterScoring → Prompt（重排基地牌库顶）
 * - base_mushroom_kingdom: onTurnStart → Prompt（移动对手随从）
 * - base_rlyeh: onTurnStart → Prompt（消灭己方随从+1VP）
 */
 

import { describe, expect, it, beforeAll } from 'vitest';
import { initAllAbilities, resetAbilityInit } from '../abilities';
import { clearRegistry } from '../domain/abilityRegistry';
import {
    clearBaseAbilityRegistry,
    triggerBaseAbility,
} from '../domain/baseAbilities';
import type { BaseAbilityContext } from '../domain/baseAbilities';
import { clearOngoingEffectRegistry } from '../domain/ongoingEffects';
import type { SmashUpCore, PlayerState, BaseInPlay, MinionOnBase } from '../domain/types';
import { SU_EVENTS } from '../domain/types';
import { SMASHUP_FACTION_IDS } from '../domain/ids';
import { triggerBaseAbilityWithMS, getInteractionsFromResult } from './helpers';

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

function makePlayer(id: string, overrides?: Partial<PlayerState>): PlayerState {
    return {
        id, vp: 0, hand: [], deck: [], discard: [],
        minionsPlayed: 0, minionLimit: 1,
        actionsPlayed: 0, actionLimit: 1,
        factions: [SMASHUP_FACTION_IDS.ALIENS, SMASHUP_FACTION_IDS.DINOSAURS],
        ...overrides,
    };
}

function makeMinion(uid: string, controller: string, power: number, defId = 'd1'): MinionOnBase {
    return {
        uid, defId, controller, owner: controller,
        basePower: power, powerModifier: 0,
        talentUsed: false, attachedActions: [],
    };
}

function makeBase(defId: string, overrides?: Partial<BaseInPlay>): BaseInPlay {
    return { defId, minions: [], ongoingActions: [], ...overrides };
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

function makeCtx(overrides: Partial<BaseAbilityContext>): BaseAbilityContext {
    return {
        state: makeState(),
        baseIndex: 0,
        baseDefId: 'test',
        playerId: '0',
        now: 1000,
        ...overrides,
    };
}

// ============================================================================
// base_the_homeworld: 母星 - onMinionPlayed → LIMIT_MODIFIED
// ============================================================================

describe('base_the_homeworld: 随从入场额外随从额度', () => {
    it('打出随从后获得 +1 随从额度', () => {
        const { events } = triggerBaseAbility('base_the_homeworld', 'onMinionPlayed', makeCtx({
            state: makeState({ bases: [makeBase('base_the_homeworld')] }),
            baseDefId: 'base_the_homeworld',
            minionUid: 'm1',
            minionDefId: 'alien_collector',
            minionPower: 2,
        }));

        expect(events).toHaveLength(1);
        expect(events[0].type).toBe(SU_EVENTS.LIMIT_MODIFIED);
        const payload = (events[0] as any).payload;
        expect(payload.playerId).toBe('0');
        expect(payload.limitType).toBe('minion');
        expect(payload.delta).toBe(1);
    });
});

// ============================================================================
// base_the_mothership: 母舰 - afterScoring → Prompt（收回 ≤3 随从）
// ============================================================================

describe('base_the_mothership: 计分后冠军收回随从', () => {
    it('有力量≤3的随从时生成 Prompt', () => {
        const result = triggerBaseAbilityWithMS('base_the_mothership', 'afterScoring', makeCtx({
            state: makeState({
                bases: [makeBase('base_the_mothership', {
                    minions: [
                        makeMinion('m1', '0', 2),
                        makeMinion('m2', '0', 5),
                        makeMinion('m3', '1', 1),
                    ],
                })],
            }),
            baseDefId: 'base_the_mothership',
            rankings: [
                { playerId: '0', power: 7, vp: 4 },
                { playerId: '1', power: 1, vp: 2 },
            ],
        }));

        expect(result.events).toHaveLength(0);
            const interactions = getInteractionsFromResult(result);
            expect(interactions).toHaveLength(1);
        expect(interactions[0].data.sourceId).toBe('base_the_mothership');
        expect(interactions[0].playerId).toBe('0'); // 冠军
        // 只有 m1 (power=2) 符合条件（≤3且为冠军控制）
        const options = interactions[0].data.options;
        // 应有 skip + 1 个随从选项
        expect(options.length).toBe(2);
    });

    it('冠军无力量≤3的随从时不生成 Prompt', () => {
        const { events } = triggerBaseAbility('base_the_mothership', 'afterScoring', makeCtx({
            state: makeState({
                bases: [makeBase('base_the_mothership', {
                    minions: [makeMinion('m1', '0', 5)],
                })],
            }),
            baseDefId: 'base_the_mothership',
            rankings: [{ playerId: '0', power: 5, vp: 4 }],
        }));

        expect(events).toHaveLength(0);
    });

    it('无排名信息时不触发', () => {
        const { events } = triggerBaseAbility('base_the_mothership', 'afterScoring', makeCtx({
            state: makeState({ bases: [makeBase('base_the_mothership')] }),
            baseDefId: 'base_the_mothership',
        }));

        expect(events).toHaveLength(0);
    });
});

// ============================================================================
// base_ninja_dojo: 忍者道场 - afterScoring → Prompt（消灭随从）
// ============================================================================

describe('base_ninja_dojo: 计分后冠军消灭随从', () => {
    it('有随从时生成 Prompt', () => {
        const result = triggerBaseAbilityWithMS('base_ninja_dojo', 'afterScoring', makeCtx({
            state: makeState({
                bases: [makeBase('base_ninja_dojo', {
                    minions: [
                        makeMinion('m1', '0', 3),
                        makeMinion('m2', '1', 2),
                    ],
                })],
            }),
            baseDefId: 'base_ninja_dojo',
            rankings: [
                { playerId: '0', power: 3, vp: 3 },
                { playerId: '1', power: 2, vp: 2 },
            ],
        }));

        expect(result.events).toHaveLength(0);
            const interactions = getInteractionsFromResult(result);
            expect(interactions).toHaveLength(1);
        expect(interactions[0].data.sourceId).toBe('base_ninja_dojo');
        expect(interactions[0].playerId).toBe('0'); // 冠军
        // skip + 2 个随从选项（可消灭任意随从）
        expect(interactions[0].data.options.length).toBe(3);
    });

    it('无随从时不生成 Prompt', () => {
        const { events } = triggerBaseAbility('base_ninja_dojo', 'afterScoring', makeCtx({
            state: makeState({
                bases: [makeBase('base_ninja_dojo')],
            }),
            baseDefId: 'base_ninja_dojo',
            rankings: [{ playerId: '0', power: 0, vp: 3 }],
        }));

        expect(events).toHaveLength(0);
    });
});

// ============================================================================
// base_pirate_cove: 海盗湾 - afterScoring → 多 Prompt（非冠军移动随从）
// ============================================================================

describe('base_pirate_cove: 计分后非冠军移动随从', () => {
    it('非冠军有随从时生成 Prompt', () => {
        const result = triggerBaseAbilityWithMS('base_pirate_cove', 'afterScoring', makeCtx({
            state: makeState({
                bases: [makeBase('base_pirate_cove', {
                    minions: [
                        makeMinion('m1', '0', 5),
                        makeMinion('m2', '1', 3),
                    ],
                })],
            }),
            baseDefId: 'base_pirate_cove',
            rankings: [
                { playerId: '0', power: 5, vp: 4 },
                { playerId: '1', power: 3, vp: 2 },
            ],
        }));

        // 只有玩家1（非冠军）生成 Prompt
        expect(result.events).toHaveLength(0);
            const interactions = getInteractionsFromResult(result);
            expect(interactions).toHaveLength(1);
        expect(interactions[0].data.sourceId).toBe('base_pirate_cove');
        expect(interactions[0].playerId).toBe('1');
    });

    it('冠军不生成 Prompt', () => {
        const { events } = triggerBaseAbility('base_pirate_cove', 'afterScoring', makeCtx({
            state: makeState({
                bases: [makeBase('base_pirate_cove', {
                    minions: [makeMinion('m1', '0', 5)], // 只有冠军有随从
                })],
            }),
            baseDefId: 'base_pirate_cove',
            rankings: [{ playerId: '0', power: 5, vp: 4 }],
        }));

        expect(events).toHaveLength(0);
    });

    it('非冠军无随从时不生成 Prompt', () => {
        const { events } = triggerBaseAbility('base_pirate_cove', 'afterScoring', makeCtx({
            state: makeState({
                bases: [makeBase('base_pirate_cove', {
                    minions: [makeMinion('m1', '0', 5)],
                })],
            }),
            baseDefId: 'base_pirate_cove',
            rankings: [
                { playerId: '0', power: 5, vp: 4 },
                { playerId: '1', power: 0, vp: 2 },
            ],
        }));

        expect(events).toHaveLength(0);
    });
});

// ============================================================================
// base_tortuga: 托尔图加 - afterScoring → Prompt（亚军移动随从）
// ============================================================================

describe('base_tortuga: 计分后亚军移动随从', () => {
    it('亚军有随从时生成 Prompt', () => {
        const result = triggerBaseAbilityWithMS('base_tortuga', 'afterScoring', makeCtx({
            state: makeState({
                bases: [makeBase('base_tortuga', {
                    minions: [
                        makeMinion('m1', '0', 5),
                        makeMinion('m2', '1', 3),
                    ],
                })],
            }),
            baseDefId: 'base_tortuga',
            rankings: [
                { playerId: '0', power: 5, vp: 4 },
                { playerId: '1', power: 3, vp: 2 },
            ],
        }));

        expect(result.events).toHaveLength(0);
            const interactions = getInteractionsFromResult(result);
            expect(interactions).toHaveLength(1);
        expect(interactions[0].data.sourceId).toBe('base_tortuga');
        expect(interactions[0].playerId).toBe('1'); // 亚军
    });

    it('排名不足2人时不触发', () => {
        const { events } = triggerBaseAbility('base_tortuga', 'afterScoring', makeCtx({
            state: makeState({ bases: [makeBase('base_tortuga')] }),
            baseDefId: 'base_tortuga',
            rankings: [{ playerId: '0', power: 5, vp: 4 }],
        }));

        expect(events).toHaveLength(0);
    });

    it('亚军在此无随从时不触发', () => {
        const { events } = triggerBaseAbility('base_tortuga', 'afterScoring', makeCtx({
            state: makeState({
                bases: [makeBase('base_tortuga', {
                    minions: [makeMinion('m1', '0', 5)],
                })],
            }),
            baseDefId: 'base_tortuga',
            rankings: [
                { playerId: '0', power: 5, vp: 4 },
                { playerId: '1', power: 0, vp: 2 },
            ],
        }));

        expect(events).toHaveLength(0);
    });
});

// ============================================================================
// base_wizard_academy: 巫师学院 - afterScoring → Prompt（重排基地牌库顶）
// ============================================================================

describe('base_wizard_academy: 计分后冠军重排基地牌库', () => {
    it('基地牌库有牌时生成 Prompt', () => {
        const result = triggerBaseAbilityWithMS('base_wizard_academy', 'afterScoring', makeCtx({
            state: makeState({
                bases: [makeBase('base_wizard_academy')],
                baseDeck: ['base_a', 'base_b', 'base_c', 'base_d'],
            }),
            baseDefId: 'base_wizard_academy',
            rankings: [{ playerId: '0', power: 5, vp: 3 }],
        }));

        expect(result.events).toHaveLength(0);
        const interactions = getInteractionsFromResult(result);
        expect(interactions).toHaveLength(1);
        expect(interactions[0].data.sourceId).toBe('base_wizard_academy');
        expect(interactions[0].playerId).toBe('0');
        // 查看顶部最多 3 张
        const ctx = (interactions[0].data as any).continuationContext;
        expect(ctx.topCards).toHaveLength(3);
        expect(ctx.topCards).toEqual(['base_a', 'base_b', 'base_c']);
    });

    it('基地牌库只有1张时也能触发', () => {
        const result = triggerBaseAbilityWithMS('base_wizard_academy', 'afterScoring', makeCtx({
            state: makeState({
                bases: [makeBase('base_wizard_academy')],
                baseDeck: ['base_x'],
            }),
            baseDefId: 'base_wizard_academy',
            rankings: [{ playerId: '0', power: 5, vp: 3 }],
        }));

        expect(result.events).toHaveLength(0);
        const interactions = getInteractionsFromResult(result);
        expect(interactions).toHaveLength(1);
    });

    it('基地牌库为空时不触发', () => {
        const { events } = triggerBaseAbility('base_wizard_academy', 'afterScoring', makeCtx({
            state: makeState({
                bases: [makeBase('base_wizard_academy')],
                baseDeck: [],
            }),
            baseDefId: 'base_wizard_academy',
            rankings: [{ playerId: '0', power: 5, vp: 3 }],
        }));

        expect(events).toHaveLength(0);
    });
});

// ============================================================================
// base_mushroom_kingdom: 蘑菇王国 - onTurnStart → Prompt（移动对手随从）
// ============================================================================

describe('base_mushroom_kingdom: 回合开始移动对手随从', () => {
    it('其他基地有对手随从时生成 Prompt', () => {
        const result = triggerBaseAbilityWithMS('base_mushroom_kingdom', 'onTurnStart', makeCtx({
            state: makeState({
                bases: [
                    makeBase('base_mushroom_kingdom'), // 索引 0
                    makeBase('other_base', { // 索引 1
                        minions: [makeMinion('m1', '1', 3)], // 对手随从
                    }),
                ],
            }),
            baseIndex: 0,
            baseDefId: 'base_mushroom_kingdom',
        }));

        expect(result.events).toHaveLength(0);
            const interactions = getInteractionsFromResult(result);
            expect(interactions).toHaveLength(1);
        expect(interactions[0].data.sourceId).toBe('base_mushroom_kingdom');
        expect(interactions[0].playerId).toBe('0');
        // skip + 1 个对手随从
        expect(interactions[0].data.options.length).toBe(2);
    });

    it('只有己方随从时不生成 Prompt', () => {
        const { events } = triggerBaseAbility('base_mushroom_kingdom', 'onTurnStart', makeCtx({
            state: makeState({
                bases: [
                    makeBase('base_mushroom_kingdom'),
                    makeBase('other_base', {
                        minions: [makeMinion('m1', '0', 3)], // 自己的随从
                    }),
                ],
            }),
            baseIndex: 0,
            baseDefId: 'base_mushroom_kingdom',
        }));

        expect(events).toHaveLength(0);
    });

    it('蘑菇王国自身的对手随从不计入选项', () => {
        const { events } = triggerBaseAbility('base_mushroom_kingdom', 'onTurnStart', makeCtx({
            state: makeState({
                bases: [
                    makeBase('base_mushroom_kingdom', {
                        minions: [makeMinion('m1', '1', 3)], // 蘑菇王国自身的对手随从
                    }),
                ],
            }),
            baseIndex: 0,
            baseDefId: 'base_mushroom_kingdom',
        }));

        // 不从自身移动，所以不生成 Prompt
        expect(events).toHaveLength(0);
    });
});

// ============================================================================
// base_rlyeh: 拉莱耶 - onTurnStart → Prompt（消灭己方随从+1VP）
// ============================================================================

describe('base_rlyeh: 回合开始消灭己方随从获1VP', () => {
    it('有己方随从时生成 Prompt', () => {
        const result = triggerBaseAbilityWithMS('base_rlyeh', 'onTurnStart', makeCtx({
            state: makeState({
                bases: [makeBase('base_rlyeh', {
                    minions: [makeMinion('m1', '0', 3)],
                })],
            }),
            baseIndex: 0,
            baseDefId: 'base_rlyeh',
        }));

        expect(result.events).toHaveLength(0);
            const interactions = getInteractionsFromResult(result);
            expect(interactions).toHaveLength(1);
        expect(interactions[0].data.sourceId).toBe('base_rlyeh');
        expect(interactions[0].playerId).toBe('0');
        // skip + 己方随从
        expect(interactions[0].data.options.length).toBe(2);
    });

    it('无己方随从时不生成 Prompt', () => {
        const { events } = triggerBaseAbility('base_rlyeh', 'onTurnStart', makeCtx({
            state: makeState({
                bases: [makeBase('base_rlyeh', {
                    minions: [makeMinion('m1', '1', 3)], // 对手随从
                })],
            }),
            baseIndex: 0,
            baseDefId: 'base_rlyeh',
        }));

        expect(events).toHaveLength(0);
    });

    it('基地为空时不生成 Prompt', () => {
        const { events } = triggerBaseAbility('base_rlyeh', 'onTurnStart', makeCtx({
            state: makeState({
                bases: [makeBase('base_rlyeh')],
            }),
            baseIndex: 0,
            baseDefId: 'base_rlyeh',
        }));

        expect(events).toHaveLength(0);
    });
});
