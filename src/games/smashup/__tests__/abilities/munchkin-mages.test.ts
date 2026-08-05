import { beforeAll, describe, expect, it } from 'vitest';

import { initAllAbilities, resetAbilityInit } from '../../abilities';
import { clearRegistry } from '../../domain/abilityRegistry';
import { clearBaseAbilityRegistry } from '../../domain/baseAbilities';
import { clearInteractionHandlers } from '../../domain/abilityInteractionHandlers';
import { clearOngoingEffectRegistry } from '../../domain/ongoingEffects';
import { clearPowerModifierRegistry } from '../../domain/ongoingModifiers';
import { SU_EVENTS, type SmashUpCore } from '../../domain/types';
import {
    applyEvents,
    getPromptMulti,
    getPromptOption,
    getPromptOptions,
    getSimpleChoicePrompt,
    invokeRegisteredAbilityContract,
    makeBase,
    makeCard,
    makeMatchState,
    makeMinion,
    makePlayer,
    makeState,
    respondToPromptOption,
    respondToPromptOptions,
    triggerBaseAbilityWithMS,
} from '../helpers';
import { defaultTestRandom } from '../testRunner';

beforeAll(() => {
    clearRegistry();
    clearBaseAbilityRegistry();
    clearPowerModifierRegistry();
    clearOngoingEffectRegistry();
    clearInteractionHandlers();
    resetAbilityInit();
    initAllAbilities();
});

function invoke(
    core: SmashUpCore,
    defId: string,
    tag: 'onPlay' | 'talent',
    cardUid: string,
    baseIndex = 0,
) {
    return invokeRegisteredAbilityContract(defId, tag, {
        state: core,
        matchState: makeMatchState(core),
        playerId: '0',
        cardUid,
        defId,
        baseIndex,
        random: defaultTestRandom,
        now: 100,
    });
}

describe('Munchkin 法师派系能力', () => {
    it('爆破大师先手动弃牌，再手动选择力量不超过2的目标', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [
                        makeCard('cost-a', 'test_action', 'action', '0'),
                        makeCard('cost-b', 'test_minion', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('test_base', [
                makeMinion('blaster', 'munchkin_mages_blaster_master', '0', 5),
                makeMinion('low-target', 'test_minion', '1', 2),
                makeMinion('high-target', 'test_minion', '1', 3),
            ])],
        });

        const ability = invoke(core, 'munchkin_mages_blaster_master', 'talent', 'blaster');
        const discardPrompt = getSimpleChoicePrompt(ability.matchState!, 'munchkin_mages_blaster_master_discard');
        expect(discardPrompt.targetType).toBe('hand');
        expect(getPromptMulti(discardPrompt)).toMatchObject({ min: 1, max: 1 });
        expect(getPromptOptions(discardPrompt)).toHaveLength(2);

        const afterDiscard = respondToPromptOption(
            ability.matchState!,
            option => option.value?.cardUid === 'cost-b',
            '选择爆破大师弃牌成本',
            '0',
            defaultTestRandom,
        );
        const targetPrompt = getSimpleChoicePrompt(afterDiscard.finalState, 'munchkin_mages_blaster_master_target');
        expect(targetPrompt.options.some((option: any) => option.value?.minionUid === 'low-target')).toBe(true);
        expect(targetPrompt.options.some((option: any) => option.value?.minionUid === 'high-target')).toBe(false);

        const resolved = respondToPromptOption(
            afterDiscard.finalState,
            option => option.value?.minionUid === 'low-target',
            '选择爆破大师目标',
            '0',
            defaultTestRandom,
        );
        expect(resolved.success).toBe(true);
        expect(resolved.finalState.core.players['0'].discard.map(card => card.uid)).toContain('cost-b');
        expect(resolved.finalState.core.bases[0].minions.map(minion => minion.uid)).toEqual([
            'blaster',
            'high-target',
        ]);
    });

    it('快乐小法师弃牌后获得本回合+2力量', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', { hand: [makeCard('cost', 'test_action', 'action', '0')] }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('test_base', [
                makeMinion('zapper', 'munchkin_mages_happy_zapper', '0', 2),
            ])],
        });

        const ability = invoke(core, 'munchkin_mages_happy_zapper', 'talent', 'zapper');
        const discardPrompt = getSimpleChoicePrompt(ability.matchState!, 'munchkin_mages_happy_zapper_discard');
        const resolved = respondToPromptOption(
            ability.matchState!,
            option => option.value?.cardUid === 'cost',
            '选择快乐小法师弃牌成本',
            '0',
            defaultTestRandom,
        );

        expect(discardPrompt.options).toHaveLength(1);
        expect(resolved.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.TEMP_POWER_ADDED,
            payload: expect.objectContaining({ minionUid: 'zapper', amount: 2 }),
        }));
        expect(resolved.finalState.core.bases[0].minions[0].tempPowerModifier).toBe(2);
    });

    it('快乐小法师在计分前也必须手动激活同一套弃牌与加力能力', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('cost', 'test_action', 'action', '0')],
                    discard: [],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('test_base', [
                makeMinion('zapper', 'munchkin_mages_happy_zapper', '0', 2),
            ])],
        });

        const ability = invoke(core, 'munchkin_mages_happy_zapper', 'special', 'zapper');
        const prompt = getSimpleChoicePrompt(ability.matchState!, 'munchkin_mages_happy_zapper_discard');
        expect(prompt.options).toHaveLength(1);

        const resolved = respondToPromptOption(
            ability.matchState!,
            option => option.value?.cardUid === 'cost',
            '选择快乐小法师特殊能力的弃牌成本',
            '0',
            defaultTestRandom,
        );

        expect(resolved.success).toBe(true);
        expect(resolved.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.TEMP_POWER_ADDED,
            payload: expect.objectContaining({ minionUid: 'zapper', amount: 2 }),
        }));
        expect(resolved.finalState.core.bases[0].minions[0].tempPowerModifier).toBe(2);
    });

    it('勤读者弃牌后抽一张牌，行动卡来源按弃牌堆校验', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('cost', 'test_action', 'action', '0')],
                    deck: [makeCard('drawn', 'test_minion', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('test_base', [makeMinion('scroll', 'munchkin_mages_scroll_shuffler', '0', 2)])],
        });

        const ability = invoke(core, 'munchkin_mages_scroll_shuffler', 'onPlay', 'scroll');
        const prompt = getSimpleChoicePrompt(ability.matchState!, 'munchkin_mages_scroll_shuffler_discard');
        expect(prompt.sourceBaseIndex).toBe(0);
        const resolved = respondToPromptOption(
            ability.matchState!,
            option => option.value?.cardUid === 'cost',
            '选择勤读者弃牌成本',
            '0',
            defaultTestRandom,
        );

        expect(resolved.success).toBe(true);
        expect(resolved.finalState.core.players['0'].discard.map(card => card.uid)).toEqual(['cost']);
        expect(resolved.finalState.core.players['0'].hand.map(card => card.uid)).toContain('drawn');
        expect(resolved.finalState.core.bases[0].minions.map(minion => minion.uid)).toEqual(['scroll']);
    });

    it('快速阅读弃牌后抽三张牌', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('cost', 'test_action', 'action', '0')],
                    deck: [
                        makeCard('draw-1', 'test_minion', 'minion', '0'),
                        makeCard('draw-2', 'test_minion', 'minion', '0'),
                        makeCard('draw-3', 'test_minion', 'minion', '0'),
                    ],
                    discard: [makeCard('speed', 'munchkin_mages_speed_reading', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('test_base')],
        });

        const ability = invoke(core, 'munchkin_mages_speed_reading', 'onPlay', 'speed');
        const resolved = respondToPromptOption(
            ability.matchState!,
            option => option.value?.cardUid === 'cost',
            '选择快速阅读弃牌成本',
            '0',
            defaultTestRandom,
        );

        expect(resolved.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.CARDS_DRAWN,
            payload: expect.objectContaining({ count: 3 }),
        }));
        expect(resolved.finalState.core.players['0'].hand.map(card => card.uid)).toEqual([
            'draw-1',
            'draw-2',
            'draw-3',
        ]);
    });

    it('快速攻击先手动弃牌，再手动选择力量不超过3的目标', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('cost', 'test_action', 'action', '0')],
                    discard: [makeCard('zap', 'munchkin_mages_zzzzzap', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('test_base', [
                makeMinion('target-3', 'test_minion', '1', 3),
                makeMinion('target-4', 'test_minion', '1', 4),
            ])],
        });

        const ability = invoke(core, 'munchkin_mages_zzzzzap', 'onPlay', 'zap');
        const afterDiscard = respondToPromptOption(
            ability.matchState!,
            option => option.value?.cardUid === 'cost',
            '选择快速攻击弃牌成本',
            '0',
            defaultTestRandom,
        );
        const targetPrompt = getSimpleChoicePrompt(afterDiscard.finalState, 'munchkin_mages_zzzzzap_target');
        expect(getPromptOption(targetPrompt, option => option.value?.minionUid === 'target-3')).toBeDefined();
        expect(targetPrompt.options.some((option: any) => option.value?.minionUid === 'target-4')).toBe(false);

        const resolved = respondToPromptOption(
            afterDiscard.finalState,
            option => option.value?.minionUid === 'target-3',
            '选择快速攻击目标',
            '0',
            defaultTestRandom,
        );
        expect(resolved.finalState.core.bases[0].minions.map(minion => minion.uid)).toEqual(['target-4']);
    });

    it('魔杖天才弃牌后由玩家选择额外随从或额外行动', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', { hand: [makeCard('cost', 'test_action', 'action', '0')] }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('test_base', [makeMinion('wand', 'munchkin_mages_wand_whiz', '0', 3)])],
        });
        const ability = invoke(core, 'munchkin_mages_wand_whiz', 'onPlay', 'wand');
        const afterDiscard = respondToPromptOption(
            ability.matchState!,
            option => option.value?.cardUid === 'cost',
            '选择魔杖天才弃牌成本',
            '0',
            defaultTestRandom,
        );
        const modePrompt = getSimpleChoicePrompt(afterDiscard.finalState, 'munchkin_mages_wand_whiz_mode');
        const resolved = respondToPromptOption(
            afterDiscard.finalState,
            option => option.value?.mode === 'action',
            '选择魔杖天才额外行动',
            '0',
            defaultTestRandom,
        );
        expect(modePrompt.options).toHaveLength(2);
        expect(resolved.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.LIMIT_MODIFIED,
            payload: expect.objectContaining({ limitType: 'action', reason: 'munchkin_mages_wand_whiz' }),
        }));
    });

    it('魅力控制怪物到回合结束，并恢复为公共怪物', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', { discard: [makeCard('charm', 'munchkin_mages_charm', 'action', '0')] }),
                '1': makePlayer('1'),
            },
            bases: [makeBase({
                defId: 'test_base',
                monsters: [{ uid: 'monster-1', defId: 'munchkin_monster_bigfoot' }],
            })],
        });
        const ability = invoke(core, 'munchkin_mages_charm', 'onPlay', 'charm');
        const prompt = getSimpleChoicePrompt(ability.matchState!, 'munchkin_mages_charm_target');
        const resolved = respondToPromptOption(
            ability.matchState!,
            option => option.value?.monsterUid === 'monster-1',
            '选择魅力目标',
            '0',
            defaultTestRandom,
        );
        expect(prompt.options).toHaveLength(1);
        expect(resolved.finalState.core.bases[0].monsters?.[0].controllerId).toBe('0');

        const ended = applyEvents(resolved.finalState.core, [{
            type: SU_EVENTS.TURN_ENDED,
            payload: { playerId: '0', nextPlayerIndex: 1 },
            timestamp: 200,
        } as any]);
        expect(ended.bases[0].monsters?.[0].controllerId).toBeUndefined();
    });

    it('大上一倍先选仆从，再手动选择任意数量的弃牌', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [
                        makeCard('cost-a', 'test_action', 'action', '0'),
                        makeCard('cost-b', 'test_minion', 'minion', '0'),
                    ],
                    discard: [makeCard('embiggen', 'munchkin_mages_embiggen', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('test_base', [makeMinion('target', 'test_minion', '0', 2)])],
        });
        const ability = invoke(core, 'munchkin_mages_embiggen', 'onPlay', 'embiggen');
        const targetResolved = respondToPromptOption(
            ability.matchState!,
            option => option.value?.minionUid === 'target',
            '选择大上一倍目标',
            '0',
            defaultTestRandom,
        );
        const discardPrompt = getSimpleChoicePrompt(targetResolved.finalState, 'munchkin_mages_embiggen_discard');
        const resolved = respondToPromptOptions(
            targetResolved.finalState,
            discardPrompt.options
                .filter((option: any) => option.value?.cardUid === 'cost-a' || option.value?.cardUid === 'cost-b')
                .map((option: any) => option.id),
            '0',
            defaultTestRandom,
        );
        expect(resolved.finalState.core.bases[0].minions[0].tempPowerModifier).toBe(2);
        expect(resolved.finalState.core.players['0'].discard.map(card => card.uid)).toEqual([
            'embiggen',
            'cost-a',
            'cost-b',
        ]);
    });

    it('大召唤在每个基地各打出一张怪物，通往次元之门只在自身基地打出一张', () => {
        const massCore = makeState({
            players: { '0': makePlayer('0'), '1': makePlayer('1') },
            bases: [makeBase('base-a'), makeBase('base-b')],
            monsterDeck: ['munchkin_monster_bigfoot', 'munchkin_monster_fowl_fiend', 'munchkin_monster_ghoul'],
            nextUid: 500,
        });
        const mass = invoke(massCore, 'munchkin_mages_mass_summoning', 'onPlay', 'mass');
        const afterMass = applyEvents(massCore, mass.events);
        expect(afterMass.bases.map(base => base.monsters?.map(monster => monster.defId))).toEqual([
            ['munchkin_monster_bigfoot'],
            ['munchkin_monster_fowl_fiend'],
        ]);
        expect(afterMass.monsterDeck).toEqual(['munchkin_monster_ghoul']);

        const portalCore = makeState({
            players: {
                '0': makePlayer('0', { hand: [makeCard('cost', 'test_action', 'action', '0')] }),
                '1': makePlayer('1'),
            },
            bases: [makeBase({
                defId: 'test_base',
                ongoingActions: [{ uid: 'portal', defId: 'munchkin_mages_portal_to_beyond', ownerId: '0' }],
            })],
            monsterDeck: ['munchkin_monster_bigfoot'],
            nextUid: 700,
        });
        const portal = invoke(portalCore, 'munchkin_mages_portal_to_beyond', 'talent', 'portal');
        const portalResolved = respondToPromptOption(
            portal.matchState!,
            option => option.value?.cardUid === 'cost',
            '选择通往次元之门弃牌成本',
            '0',
            defaultTestRandom,
        );
        expect(portalResolved.finalState.core.bases[0].monsters?.[0].defId).toBe('munchkin_monster_bigfoot');
    });

    it('恢复奥术智慧抽牌直到手上有五张，神奇的夜晚按弃牌张数增加力量不超过3的额外额度', () => {
        const recoverCore = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [
                        makeCard('recover', 'munchkin_mages_recover_arcane_wisdom', 'action', '0'),
                        makeCard('hand-1', 'test_action', 'action', '0'),
                        makeCard('hand-2', 'test_minion', 'minion', '0'),
                    ],
                    deck: [
                        makeCard('draw-1', 'test_minion', 'minion', '0'),
                        makeCard('draw-2', 'test_minion', 'minion', '0'),
                        makeCard('draw-3', 'test_minion', 'minion', '0'),
                        makeCard('draw-4', 'test_minion', 'minion', '0'),
                    ],
                    discard: [],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('test_base')],
        });
        const recover = invoke(recoverCore, 'munchkin_mages_recover_arcane_wisdom', 'onPlay', 'recover');
        const recovered = applyEvents(recoverCore, [
            {
                type: SU_EVENTS.CARDS_DISCARDED,
                payload: { playerId: '0', cardUids: ['recover'] },
                timestamp: 100,
            } as any,
            ...recover.events,
        ]);
        expect(recovered.players['0'].hand).toHaveLength(5);

        const eveningCore = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('discard-a', 'test_action', 'action', '0'), makeCard('discard-b', 'test_minion', 'minion', '0')],
                    discard: [makeCard('evening', 'munchkin_mages_some_enchanted_evening', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('test_base')],
        });
        const evening = invoke(eveningCore, 'munchkin_mages_some_enchanted_evening', 'onPlay', 'evening');
        const eveningPrompt = getSimpleChoicePrompt(evening.matchState!, 'munchkin_mages_some_enchanted_evening_discard');
        const eveningResolved = respondToPromptOptions(
            evening.matchState!,
            eveningPrompt.options.map((option: any) => option.id),
            '0',
            defaultTestRandom,
        );
        expect(eveningResolved.events.filter((event: any) => event.type === SU_EVENTS.LIMIT_MODIFIED)).toHaveLength(2);
        expect(eveningResolved.events.every((event: any) => event.type !== SU_EVENTS.LIMIT_MODIFIED
            || (event.payload.powerMax === 3 && event.payload.playTiming === 'immediate'))).toBe(true);
    });

    it('次元之门和法师之塔在随从入场后都先停住让玩家选择', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('cost', 'test_action', 'action', '0')],
                    minionsPlayedPerBase: { 0: 1 },
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_dimension_doors', [makeMinion('played', 'test_minion', '0', 2)])],
        });
        const dimension = triggerBaseAbilityWithMS('base_dimension_doors', 'onMinionPlayed', {
            state: core,
            baseIndex: 0,
            baseDefId: 'base_dimension_doors',
            playerId: '0',
            minionUid: 'played',
            random: defaultTestRandom,
            now: 100,
        });
        const dimensionPrompt = getSimpleChoicePrompt(dimension.matchState!, 'base_dimension_doors_discard');
        const dimensionResolved = respondToPromptOption(
            dimension.matchState!,
            option => option.value?.cardUid === 'cost',
            '选择次元之门弃牌',
            '0',
            defaultTestRandom,
        );
        expect(dimensionPrompt.options).toHaveLength(2);
        expect(dimensionResolved.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.LIMIT_MODIFIED,
            payload: expect.objectContaining({ restrictToBase: 0 }),
        }));

        const tower = triggerBaseAbilityWithMS('base_mages_tower', 'onMinionPlayed', {
            state: core,
            baseIndex: 0,
            baseDefId: 'base_mages_tower',
            playerId: '0',
            minionUid: 'played',
            random: defaultTestRandom,
            now: 101,
        });
        const towerPrompt = getSimpleChoicePrompt(tower.matchState!, 'base_mages_tower_draw');
        expect(towerPrompt.options).toHaveLength(2);
        expect(towerPrompt.options.some((option: any) => option.value?.draw === true)).toBe(true);
    });
});
