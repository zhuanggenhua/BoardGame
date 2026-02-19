/**
 * 大杀四方 - UI 交互手动测试
 * 
 * 这个测试文件用于手动验证 UI 交互是否正常工作。
 * 运行后会在控制台输出交互状态，可以手动检查。
 */

import { describe, it, expect } from 'vitest';
import { GameTestRunner } from '../../../engine/testing';
import { SmashUpDomain } from '../domain';
import { smashUpFlowHooks } from '../domain/index';
import {
    createFlowSystem, createActionLogSystem, createUndoSystem,
    createInteractionSystem, createRematchSystem, createResponseWindowSystem,
    createTutorialSystem, createEventStreamSystem, createSimpleChoiceSystem,
} from '../../../engine';
import type { EngineSystem } from '../../../engine/systems/types';
import { createSmashUpEventSystem } from '../domain/systems';
import { asSimpleChoice } from '../../../engine/systems/InteractionSystem';
import type { SmashUpCore, CardInstance, MinionOnBase, BaseInPlay } from '../domain/types';
import type { MatchState } from '../../../engine/types';
import { initAllAbilities, resetAbilityInit } from '../abilities';
import { clearRegistry } from '../domain/abilityRegistry';
import { clearBaseAbilityRegistry } from '../domain/baseAbilities';
import { clearInteractionHandlers } from '../domain/abilityInteractionHandlers';
import { clearPowerModifierRegistry } from '../domain/ongoingModifiers';
import { clearOngoingEffectRegistry } from '../domain/ongoingEffects';
import { getCardDef } from '../data/cards';
import { createInitialSystemState } from '../../../engine/pipeline';
import { SU_COMMANDS } from '../domain/types';

const PLAYER_IDS = ['0', '1'];

function makeCard(uid: string, defId: string, owner: string, type: 'minion' | 'action' = 'action'): CardInstance {
    return { uid, defId, owner, type };
}

function makeMinion(uid: string, defId: string, controller: string, power: number): MinionOnBase {
    return {
        uid, defId, controller, owner: controller,
        basePower: power, powerModifier: 0, tempPowerModifier: 0, talentUsed: false, attachedActions: [],
    };
}

function makeBase(defId: string, minions: MinionOnBase[] = []): BaseInPlay {
    return { defId, minions, ongoingActions: [] };
}

function makePlayer(id: string, overrides: Record<string, unknown> = {}) {
    return {
        id, vp: 0, hand: [] as CardInstance[], deck: [] as CardInstance[], discard: [] as CardInstance[],
        minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1,
        factions: ['zombies', 'pirates'] as [string, string],
        ...overrides,
    };
}

function makeState(overrides: Partial<SmashUpCore> = {}): SmashUpCore {
    return {
        players: { '0': makePlayer('0'), '1': makePlayer('1') },
        turnOrder: ['0', '1'],
        currentPlayerIndex: 0,
        bases: [makeBase('test_base_1'), makeBase('test_base_2'), makeBase('test_base_3')],
        baseDeck: [],
        turnNumber: 1,
        nextUid: 100,
        ...overrides,
    };
}

function buildSystems(): EngineSystem<SmashUpCore>[] {
    return [
        createFlowSystem<SmashUpCore>({ hooks: smashUpFlowHooks }),
        createActionLogSystem<SmashUpCore>(),
        createUndoSystem<SmashUpCore>(),
        createInteractionSystem<SmashUpCore>(),
        createSimpleChoiceSystem<SmashUpCore>(),
        createRematchSystem<SmashUpCore>(),
        createResponseWindowSystem<SmashUpCore>({
            allowedCommands: ['su:play_action'],
            commandWindowTypeConstraints: { 'su:play_action': ['meFirst'] },
            responseAdvanceEvents: [{ eventType: 'su:action_played', windowTypes: ['meFirst'] }],
            loopUntilAllPass: true,
            hasRespondableContent: (state, playerId, windowType) => {
                if (windowType !== 'meFirst') return true;
                const core = state as SmashUpCore;
                const player = core.players[playerId];
                if (!player) return false;
                return player.hand.some(c => {
                    if (c.type !== 'action') return false;
                    const def = getCardDef(c.defId);
                    return def && 'subtype' in def && def.subtype === 'special';
                });
            },
        }),
        createTutorialSystem<SmashUpCore>(),
        createEventStreamSystem<SmashUpCore>(),
        createSmashUpEventSystem(),
    ];
}

function makeFullMatchState(core: SmashUpCore): MatchState<SmashUpCore> {
    const systems = buildSystems();
    const sys = createInitialSystemState(PLAYER_IDS, systems);
    return { core, sys: { ...sys, phase: 'playCards' } } as MatchState<SmashUpCore>;
}

function createRunner(customState: MatchState<SmashUpCore>) {
    return new GameTestRunner<SmashUpCore, any, any>({
        domain: SmashUpDomain,
        systems: buildSystems(),
        playerIds: PLAYER_IDS,
        setup: () => customState,
        silent: true,
    });
}

beforeAll(() => {
    clearRegistry();
    clearBaseAbilityRegistry();
    clearInteractionHandlers();
    clearPowerModifierRegistry();
    clearOngoingEffectRegistry();
    resetAbilityInit();
    initAllAbilities();
});

describe('SmashUp UI 交互验证', () => {
    it('zombie_mall_crawl: 验证选项结构', () => {
        // 准备状态：手牌有 mall_crawl，牌库有多种卡牌
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('mc1', 'zombie_mall_crawl', '0', 'action')],
                    deck: [
                        makeCard('dk-w1', 'zombie_walker', '0', 'minion'),
                        makeCard('dk-gd1', 'zombie_grave_digger', '0', 'minion'),
                        makeCard('dk-w2', 'zombie_walker', '0', 'minion'),
                        makeCard('dk-c1', 'pirate_cannon', '0', 'action'),
                    ],
                    discard: [],
                    factions: ['zombies', 'pirates'] as [string, string],
                }),
                '1': makePlayer('1'),
            },
        });
        const state = makeFullMatchState(core);
        const runner = createRunner(state);

        // 打出 mall_crawl
        const r1 = runner.run({
            name: 'mall_crawl UI 验证',
            commands: [{ type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'mc1' } }],
        });

        expect(r1.steps[0]?.success).toBe(true);
        const choice = asSimpleChoice(r1.finalState.sys.interaction.current);
        expect(choice).toBeDefined();
        expect(choice?.sourceId).toBe('zombie_mall_crawl');

        // 验证选项结构
        console.log('\n=== zombie_mall_crawl 选项结构 ===');
        console.log('标题:', choice?.title);
        console.log('选项数量:', choice?.options.length);
        choice?.options.forEach((opt, i) => {
            console.log(`选项 ${i}:`, {
                id: opt.id,
                label: opt.label,
                value: opt.value,
                displayMode: opt.displayMode,
            });
        });

        // 验证选项可见性
        expect(choice?.options.length).toBeGreaterThan(0);
        expect(choice?.options[0]).toHaveProperty('id');
        expect(choice?.options[0]).toHaveProperty('label');
        expect(choice?.options[0]).toHaveProperty('value');

        // 验证选项内容
        const firstOption = choice?.options[0];
        expect(firstOption?.value).toHaveProperty('defId');
        expect(typeof firstOption?.label).toBe('string');
        expect(firstOption?.label.length).toBeGreaterThan(0);
    });

    it('zombie_lend_a_hand: 验证多选选项结构', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('lh1', 'zombie_lend_a_hand', '0', 'action')],
                    discard: [
                        makeCard('d1', 'zombie_walker', '0', 'minion'),
                        makeCard('d2', 'pirate_cannon', '0', 'action'),
                        makeCard('d3', 'zombie_grave_digger', '0', 'minion'),
                    ],
                    factions: ['zombies', 'pirates'] as [string, string],
                }),
                '1': makePlayer('1'),
            },
        });
        const state = makeFullMatchState(core);
        const runner = createRunner(state);

        const r1 = runner.run({
            name: 'lend_a_hand UI 验证',
            commands: [{ type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'lh1' } }],
        });

        expect(r1.steps[0]?.success).toBe(true);
        const choice = asSimpleChoice(r1.finalState.sys.interaction.current);
        expect(choice).toBeDefined();

        console.log('\n=== zombie_lend_a_hand 多选选项结构 ===');
        console.log('标题:', choice?.title);
        console.log('是否多选:', choice?.multi);
        console.log('最小选择数:', choice?.multi?.min);
        console.log('最大选择数:', choice?.multi?.max);
        console.log('选项数量:', choice?.options.length);

        // 验证多选配置
        expect(choice?.multi).toBeDefined();
        expect(choice?.multi?.min).toBeGreaterThanOrEqual(0);
        expect(choice?.options.length).toBe(3); // 弃牌堆有 3 张牌
    });

    it('pirate_dinghy: 验证多步链选项结构', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('dinghy1', 'pirate_dinghy', '0', 'action')],
                    factions: ['pirates', 'aliens'] as [string, string],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('test_base_1', [
                    makeMinion('m1', 'test_minion', '0', 3),
                    makeMinion('m2', 'test_minion', '1', 2),
                ]),
                makeBase('test_base_2', [
                    makeMinion('m3', 'test_minion', '0', 2),
                ]),
            ],
        });
        const state = makeFullMatchState(core);
        const runner = createRunner(state);

        const r1 = runner.run({
            name: 'dinghy UI 验证 - 第一步',
            commands: [{ type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'dinghy1' } }],
        });

        expect(r1.steps[0]?.success).toBe(true);
        const choice1 = asSimpleChoice(r1.finalState.sys.interaction.current);
        expect(choice1).toBeDefined();

        console.log('\n=== pirate_dinghy 第一步选项结构 ===');
        console.log('标题:', choice1?.title);
        console.log('sourceId:', choice1?.sourceId);
        console.log('选项数量:', choice1?.options.length);
        choice1?.options.forEach((opt, i) => {
            console.log(`选项 ${i}:`, {
                id: opt.id,
                label: opt.label,
                hasValue: !!opt.value,
            });
        });

        // 验证第一步选项
        expect(choice1?.options.length).toBeGreaterThan(0);
    });
});
