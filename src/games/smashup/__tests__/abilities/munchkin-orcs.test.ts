import { beforeAll, describe, expect, it } from 'vitest';
import { initAllAbilities, resetAbilityInit } from '../../abilities';
import { clearRegistry, resolveAbilityDefinition } from '../../domain/abilityRegistry';
import { clearBaseAbilityRegistry } from '../../domain/baseAbilities';
import { clearInteractionHandlers } from '../../domain/abilityInteractionHandlers';
import { clearOngoingEffectRegistry, fireTriggers, getModifiedBaseVp, isCardSuppressed, isMinionProtected } from '../../domain/ongoingEffects';
import { clearPowerModifierRegistry, getEffectivePower } from '../../domain/ongoingModifiers';
import type { SmashUpCore } from '../../domain/types';
import { getCardDef } from '../../data/cards';
import {
    applyEvents,
    expectRegisteredInteractionHandlerContract,
    getSimpleChoicePrompt,
    expectNoPrompt,
    invokeRegisteredAbilityContract,
    makeBase,
    makeCard,
    makeMatchState,
    makeMinion,
    makePlayer,
    makeState,
    respondToPromptOption,
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

function invoke(core: SmashUpCore, defId: string, tag: 'onPlay' | 'talent' | 'special', cardUid: string, baseIndex = 0) {
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

describe('萌奇金兽人派系随从', () => {
    it('剑王只给同基地己方其他随从加力量，自身和对手不加成', () => {
        const core = makeState({
            bases: [makeBase('test_base', [
                makeMinion('sword-a', 'munchkin_orcs_sword_lord', '0', 5),
                makeMinion('sword-b', 'munchkin_orcs_sword_lord', '0', 5),
                makeMinion('ally', 'test_minion', '0', 2),
                makeMinion('enemy', 'test_minion', '1', 2),
            ])],
        });

        const base = core.bases[0];
        expect(getEffectivePower(core, base.minions[0], 0)).toBe(6);
        expect(getEffectivePower(core, base.minions[1], 0)).toBe(6);
        expect(getEffectivePower(core, base.minions[2], 0)).toBe(4);
        expect(getEffectivePower(core, base.minions[3], 0)).toBe(2);
    });

    it('粉碎者天赋注册为真实可用的无状态入口', () => {
        const core = makeState({
            bases: [makeBase('test_base', [makeMinion('topper', 'munchkin_orcs_topper_chopper', '0', 5)])],
        });

        const result = invoke(core, 'munchkin_orcs_topper_chopper', 'talent', 'topper');
        expect(result.events).toEqual([]);
        expect(result.matchState).toBeUndefined();
    });

    it('重击者即使只有一个合法目标也必须停在手动选择态', () => {
        const core = makeState({
            players: { '0': makePlayer('0'), '1': makePlayer('1') },
            bases: [makeBase('test_base', [
                makeMinion('hammer', 'munchkin_orcs_hammer_slammer', '0', 3),
                makeMinion('target', 'test_minion', '1', 2),
                makeMinion('large', 'test_minion', '1', 3),
            ])],
        });

        const result = invoke(core, 'munchkin_orcs_hammer_slammer', 'onPlay', 'hammer');
        const prompt = getSimpleChoicePrompt(result.matchState!, 'munchkin_orcs_hammer_slammer_target');
        expect(prompt.options).toHaveLength(1);
        expect(prompt.autoResolveIfSingle).toBe(false);
        expect(prompt.options[0].displayMode).toBe('card');
        expect(prompt.options[0].value).toEqual(expect.objectContaining({ minionUid: 'target', baseIndex: 0 }));

        const resolved = respondToPromptOption(
            result.matchState!,
            option => option.value?.minionUid === 'target',
            '选择重击者目标',
            '0',
            defaultTestRandom,
        );
        expect(resolved.success).toBe(true);
        expect(resolved.finalState.core.bases[0].minions.map(minion => minion.uid)).toEqual(['hammer', 'large']);
    });

    it('重击者没有力量 2 或更少的合法目标时不创建隐藏自动目标', () => {
        const core = makeState({
            bases: [makeBase('test_base', [
                makeMinion('hammer', 'munchkin_orcs_hammer_slammer', '0', 3),
                makeMinion('large', 'test_minion', '1', 3),
            ])],
        });

        const result = invoke(core, 'munchkin_orcs_hammer_slammer', 'onPlay', 'hammer');
        expect(result.events).toEqual([]);
        expect(result.matchState).toBeUndefined();
    });

    it('呆瓜兽人只阻止其他玩家的行动卡影响，己方行动和非行动来源不阻止', () => {
        const core = makeState({
            bases: [makeBase('test_base', [makeMinion('dork', 'munchkin_orcs_dork_orc', '0', 2)])],
        });
        const target = core.bases[0].minions[0];

        expect(isMinionProtected(core, target, 0, '1', 'action')).toBe(true);
        expect(isMinionProtected(core, target, 0, '0', 'action')).toBe(false);
        expect(isMinionProtected(core, target, 0, '1', 'affect', { sourceKind: 'nonAction' })).toBe(false);
    });

    it('挤碎按基地、玩家、随从的顺序手动选择，单候选也不自动跳过', () => {
        const core = makeState({
            bases: [
                makeBase('base-a', [
                    makeMinion('own-a', 'test_minion', '0', 3),
                    makeMinion('own-b', 'test_minion', '0', 3),
                    makeMinion('enemy-a', 'test_minion', '1', 2),
                ]),
                makeBase('base-b', [makeMinion('other', 'test_minion', '1', 2)]),
            ],
        });

        const played = invoke(core, 'munchkin_orcs_crush', 'onPlay', 'crush-card');
        const basePrompt = getSimpleChoicePrompt(played.matchState!, 'munchkin_orcs_crush_base');
        expect(basePrompt.options).toHaveLength(1);
        expect(basePrompt.autoResolveIfSingle).toBe(false);

        const choseBase = respondToPromptOption(
            played.matchState!,
            option => option.value?.baseIndex === 0,
            '选择挤碎基地',
            '0',
        );
        const playerPrompt = getSimpleChoicePrompt(choseBase.finalState, 'munchkin_orcs_crush_player');
        expect(playerPrompt.options).toHaveLength(1);
        expect(playerPrompt.autoResolveIfSingle).toBe(false);

        const chosePlayer = respondToPromptOption(
            choseBase.finalState,
            option => option.value?.targetPlayerId === '1',
            '选择挤碎玩家',
            '0',
        );
        const minionPrompt = getSimpleChoicePrompt(chosePlayer.finalState, 'munchkin_orcs_crush_minion');
        expect(minionPrompt.options).toHaveLength(1);
        expect(minionPrompt.autoResolveIfSingle).toBe(false);

        const resolved = respondToPromptOption(
            chosePlayer.finalState,
            option => option.value?.minionUid === 'enemy-a',
            '选择挤碎随从',
            '0',
        );
        expect(resolved.finalState.core.bases[0].minions.map(minion => minion.uid)).toEqual(['own-a', 'own-b']);
    });

    it('死亡之息手动选择低力量随从，并把它放到拥有者牌库底', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1', { deck: [makeCard('deck-card', 'test_action', 'action', '1')] }),
            },
            bases: [makeBase('test_base', [
                makeMinion('weak', 'test_minion', '1', 4),
                makeMinion('strong', 'test_minion', '1', 5),
            ])],
        });

        const played = invoke(core, 'munchkin_orcs_death_breath', 'onPlay', 'death-breath');
        const prompt = getSimpleChoicePrompt(played.matchState!, 'munchkin_orcs_death_breath_target');
        expect(prompt.options).toHaveLength(1);
        expect(prompt.options[0].value?.minionUid).toBe('weak');
        expect(prompt.autoResolveIfSingle).toBe(false);

        const resolved = respondToPromptOption(
            played.matchState!,
            option => option.value?.minionUid === 'weak',
            '选择死亡之息目标',
            '0',
        );
        expect(resolved.finalState.core.bases[0].minions.map(minion => minion.uid)).toEqual(['strong']);
        expect(resolved.finalState.core.players['1'].deck.map(card => card.uid)).toEqual(['deck-card', 'weak']);
    });

    it('狗堆先选己方随从，再手动选择已有至少两个己方随从的基地', () => {
        const core = makeState({
            bases: [
                makeBase('base-a', [makeMinion('moving', 'test_minion', '0', 2)]),
                makeBase('base-b', [
                    makeMinion('ally-b1', 'test_minion', '0', 2),
                    makeMinion('ally-b2', 'test_minion', '0', 2),
                ]),
            ],
        });

        const played = invoke(core, 'munchkin_orcs_dogpile', 'onPlay', 'dogpile');
        const minionPrompt = getSimpleChoicePrompt(played.matchState!, 'munchkin_orcs_dogpile_minion');
        expect(minionPrompt.options).toHaveLength(1);
        expect(minionPrompt.autoResolveIfSingle).toBe(false);

        const choseMinion = respondToPromptOption(
            played.matchState!,
            option => option.value?.minionUid === 'moving',
            '选择狗堆随从',
            '0',
        );
        const basePrompt = getSimpleChoicePrompt(choseMinion.finalState, 'munchkin_orcs_dogpile_base');
        expect(basePrompt.options).toHaveLength(1);
        expect(basePrompt.autoResolveIfSingle).toBe(false);

        const resolved = respondToPromptOption(
            choseMinion.finalState,
            option => option.value?.baseIndex === 1,
            '选择狗堆目标基地',
            '0',
        );
        expect(resolved.finalState.core.bases[0].minions).toEqual([]);
        expect(resolved.finalState.core.bases[1].minions.map(minion => minion.uid)).toEqual(['ally-b1', 'ally-b2', 'moving']);
    });

    it('狗堆作为计分前特殊牌仍按随从、基地顺序移动，不因特殊入口丢失移动事件', () => {
        const core = makeState({
            bases: [
                makeBase('base_garrison', [
                    makeMinion('moving', 'test_minion', '0', 5),
                    makeMinion('keep', 'test_minion', '0', 4),
                    makeMinion('enemy', 'test_minion', '1', 5),
                ]),
                makeBase('base_homeworld', [
                    makeMinion('ally-b1', 'test_minion', '0', 2),
                    makeMinion('ally-b2', 'test_minion', '0', 2),
                ]),
            ],
        });

        const played = invoke(core, 'munchkin_orcs_dogpile', 'special', 'dogpile-special', 0);
        const minionPrompt = getSimpleChoicePrompt(played.matchState!, 'munchkin_orcs_dogpile_minion');
        expect(minionPrompt.autoResolveIfSingle).toBe(false);
        const choseMinion = respondToPromptOption(
            played.matchState!,
            option => option.value?.minionUid === 'moving',
            '选择计分前狗堆随从',
            '0',
        );
        const basePrompt = getSimpleChoicePrompt(choseMinion.finalState, 'munchkin_orcs_dogpile_base');
        expect(basePrompt.autoResolveIfSingle).toBe(false);
        const resolved = respondToPromptOption(
            choseMinion.finalState,
            option => option.value?.baseIndex === 1,
            '选择计分前狗堆基地',
            '0',
        );
        expect(resolved.finalState.core.bases[0].minions.map(minion => minion.uid)).toEqual(['keep', 'enemy']);
        expect(resolved.finalState.core.bases[1].minions.map(minion => minion.uid)).toEqual(['ally-b1', 'ally-b2', 'moving']);
    });

    it('给我！先选附着行动，再摧毁原宿主，最后手动选择新宿主并保留行动', () => {
        const core = makeState({
            bases: [makeBase('base-a', [
                makeMinion('old-host', 'test_minion', '1', 3, {
                    attachedActions: [{ uid: 'attached-action', defId: 'munchkin_orcs_and_stay_down', ownerId: '1' }],
                }),
            ]), makeBase('base-b', [makeMinion('new-host', 'test_minion', '0', 3)])],
        });

        const played = invoke(core, 'munchkin_orcs_gimme', 'onPlay', 'gimme');
        const actionPrompt = getSimpleChoicePrompt(played.matchState!, 'munchkin_orcs_gimme_action');
        expect(actionPrompt.options).toHaveLength(1);
        expect(actionPrompt.autoResolveIfSingle).toBe(false);

        const choseAction = respondToPromptOption(
            played.matchState!,
            option => option.value?.cardUid === 'attached-action',
            '选择给我行动',
            '0',
        );
        expect(choseAction.finalState.core.bases[0].minions).toEqual([]);
        const hostPrompt = getSimpleChoicePrompt(choseAction.finalState, 'munchkin_orcs_gimme_minion');
        expect(hostPrompt.options).toHaveLength(1);
        expect(hostPrompt.autoResolveIfSingle).toBe(false);

        const resolved = respondToPromptOption(
            choseAction.finalState,
            option => option.value?.minionUid === 'new-host',
            '选择给我新宿主',
            '0',
        );
        expect(resolved.finalState.core.bases[1].minions[0].attachedActions).toEqual([
            expect.objectContaining({ uid: 'attached-action', defId: 'munchkin_orcs_and_stay_down', ownerId: '1' }),
        ]);
        expect(resolved.finalState.core.players['1'].discard.some(card => card.uid === 'attached-action')).toBe(false);
    });

    it('八张兽人行动均有正确能力标签、执行定义和交互入口', () => {
        const contracts = [
            { defId: 'munchkin_orcs_and_stay_down', tags: ['special'], abilities: ['special'] },
            { defId: 'munchkin_orcs_angry_pillagers', tags: ['special'], abilities: ['special'] },
            { defId: 'munchkin_orcs_crush', tags: ['onPlay'], abilities: ['onPlay'] },
            { defId: 'munchkin_orcs_death_breath', tags: ['onPlay'], abilities: ['onPlay'] },
            { defId: 'munchkin_orcs_dogpile', tags: ['onPlay', 'special'], abilities: ['onPlay', 'special'] },
            { defId: 'munchkin_orcs_gimme', tags: ['onPlay'], abilities: ['onPlay'] },
            { defId: 'munchkin_orcs_stalling', tags: ['ongoing'], abilities: [] },
            { defId: 'munchkin_orcs_too_tough', tags: ['ongoing'], abilities: [] },
        ] as const;

        for (const contract of contracts) {
            const definition = getCardDef(contract.defId);
            expect(definition, `${contract.defId} 应有静态卡牌定义`).toBeDefined();
            expect(definition?.abilityTags).toEqual(expect.arrayContaining(contract.tags));
            for (const abilityTag of contract.abilities) {
                expect(resolveAbilityDefinition(contract.defId, abilityTag), `${contract.defId}:${abilityTag} 应注册执行定义`).toBeDefined();
            }
        }

        for (const sourceId of [
            'munchkin_orcs_hammer_slammer_target',
            'munchkin_orcs_crush_base',
            'munchkin_orcs_crush_player',
            'munchkin_orcs_crush_minion',
            'munchkin_orcs_death_breath_target',
            'munchkin_orcs_dogpile_minion',
            'munchkin_orcs_dogpile_base',
            'munchkin_orcs_gimme_action',
            'munchkin_orcs_gimme_minion',
        ]) {
            expect(expectRegisteredInteractionHandlerContract(sourceId), `${sourceId} 应注册交互处理器`).toBeTypeOf('function');
        }
    });

    it('太难了、坑洞和洗手间的保护只针对其他玩家的行动来源', () => {
        const tooToughCore = makeState({
            bases: [makeBase('test_base', [makeMinion('tough', 'test_minion', '0', 3, {
                attachedActions: [{ uid: 'too-tough', defId: 'munchkin_orcs_too_tough', ownerId: '0' }],
            })])],
        });
        const tough = tooToughCore.bases[0].minions[0];
        expect(isMinionProtected(tooToughCore, tough, 0, '1', 'action', { sourceKind: 'action', sourceDefId: 'munchkin_orcs_crush' })).toBe(true);
        expect(isMinionProtected(tooToughCore, tough, 0, '0', 'action', { sourceKind: 'action', sourceDefId: 'munchkin_orcs_crush' })).toBe(false);
        expect(isMinionProtected(tooToughCore, tough, 0, '1', 'affect', { sourceKind: 'nonAction', sourceDefId: 'munchkin_orcs_crush' })).toBe(false);

        const pitsCore = makeState({
            bases: [
                makeBase('base_the_pits', [makeMinion('pits-minion', 'test_minion', '0', 3)]),
                makeBase('other_base', [makeMinion('other-base-minion', 'test_minion', '0', 3)]),
            ],
        });
        const pitsMinion = pitsCore.bases[0].minions[0];
        const otherBaseMinion = pitsCore.bases[1].minions[0];
        expect(isMinionProtected(pitsCore, pitsMinion, 0, '1', 'action', { sourceKind: 'action', sourceDefId: 'munchkin_orcs_crush' })).toBe(true);
        expect(isMinionProtected(pitsCore, pitsMinion, 0, '0', 'action', { sourceKind: 'action', sourceDefId: 'munchkin_orcs_crush' })).toBe(false);
        expect(isMinionProtected(pitsCore, otherBaseMinion, 1, '1', 'action', { sourceKind: 'action', sourceDefId: 'munchkin_orcs_crush' })).toBe(false);

        const stallingCore = makeState({
            turnNumber: 3,
            bases: [makeBase({
                defId: 'test_base',
                ongoingActions: [{ uid: 'stalling', defId: 'munchkin_orcs_stalling', ownerId: '0' }],
                minions: [makeMinion('protected', 'test_minion', '0', 3, {
                    metadata: { stallingProtectedActionDefId: 'munchkin_orcs_crush', stallingProtectedTurnNumber: 3 },
                })],
            })],
        });
        const protectedMinion = stallingCore.bases[0].minions[0];
        expect(isMinionProtected(stallingCore, protectedMinion, 0, '1', 'action', { sourceKind: 'action', sourceDefId: 'munchkin_orcs_crush' })).toBe(true);
        expect(isMinionProtected(stallingCore, protectedMinion, 0, '1', 'action', { sourceKind: 'action', sourceDefId: 'munchkin_orcs_death_breath' })).toBe(false);
    });

    it('要塞总力量达到 22 时给前三名各加 1 VP，低于门槛不加', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
                '2': makePlayer('2'),
            },
            bases: [makeBase('base_garrison', [
                makeMinion('p0', 'test_minion', '0', 8),
                makeMinion('p1', 'test_minion', '1', 7),
                makeMinion('p2', 'test_minion', '2', 7),
            ])],
        });

        expect(getModifiedBaseVp(core, 0, '0', 3)).toBe(4);
        expect(getModifiedBaseVp(core, 0, '1', 2)).toBe(3);
        expect(getModifiedBaseVp(core, 0, '2', 1)).toBe(2);

        const belowThreshold = makeState({
            players: { '0': makePlayer('0'), '1': makePlayer('1') },
            bases: [makeBase('base_garrison', [
                makeMinion('p0', 'test_minion', '0', 10),
                makeMinion('p1', 'test_minion', '1', 11),
            ])],
        });
        expect(getModifiedBaseVp(belowThreshold, 0, '1', 3)).toBe(3);
    });

    it('要塞并列第三时所有并列玩家都算前三名', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
                '2': makePlayer('2'),
                '3': makePlayer('3'),
            },
            bases: [makeBase('base_garrison', [
                makeMinion('p0', 'test_minion', '0', 8),
                makeMinion('p1', 'test_minion', '1', 6),
                makeMinion('p2', 'test_minion', '2', 4),
                makeMinion('p3', 'test_minion', '3', 4),
            ])],
        });

        expect(getModifiedBaseVp(core, 0, '0', 3)).toBe(4);
        expect(getModifiedBaseVp(core, 0, '1', 2)).toBe(3);
        expect(getModifiedBaseVp(core, 0, '2', 1)).toBe(2);
        expect(getModifiedBaseVp(core, 0, '3', 1)).toBe(2);
    });

    it('洗手间触发后必须手动选择保护随从或明确跳过', () => {
        const core = makeState({
            players: { '0': makePlayer('0'), '1': makePlayer('1') },
            bases: [makeBase({
                defId: 'test_base',
                ongoingActions: [{ uid: 'stalling', defId: 'munchkin_orcs_stalling', ownerId: '0' }],
                minions: [
                    makeMinion('own-a', 'test_minion', '0', 3),
                    makeMinion('own-b', 'test_minion', '0', 2),
                    makeMinion('enemy', 'test_minion', '1', 3),
                ],
            })],
        });

        const triggered = fireTriggers(core, 'onActionPlayed', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '1',
            actionTargetBaseIndex: 0,
            triggerCardUid: 'opponent-action',
            triggerCardDefId: 'munchkin_orcs_crush',
            random: defaultTestRandom,
            now: 100,
        });
        const prompt = getSimpleChoicePrompt(triggered.matchState!, 'munchkin_orcs_stalling_minion');
        expect(prompt.options).toHaveLength(3);
        expect(prompt.autoResolveIfSingle).toBe(false);

        const protectedResult = respondToPromptOption(
            triggered.matchState!,
            option => option.value?.minionUid === 'own-b',
            '选择洗手间保护随从',
            '0',
        );
        expect(protectedResult.success).toBe(true);
        expect(protectedResult.finalState.core.bases[0].minions.find(minion => minion.uid === 'own-b')?.metadata).toEqual(expect.objectContaining({
            stallingProtectedActionDefId: 'munchkin_orcs_crush',
        }));
        expect(isMinionProtected(protectedResult.finalState.core, protectedResult.finalState.core.bases[0].minions[1], 0, '1', 'action', {
            sourceKind: 'action',
            sourceDefId: 'munchkin_orcs_crush',
        })).toBe(true);

        const skipped = respondToPromptOption(
            triggered.matchState!,
            option => option.value?.skip === true,
            '跳过洗手间保护',
            '0',
        );
        expect(skipped.success).toBe(true);
        expect(skipped.finalState.core.bases[0].minions.every(minion => !minion.metadata?.stallingProtectedActionDefId)).toBe(true);
    });

    it('洗手间只响应其他玩家在同一基地打出的行动', () => {
        const core = makeState({
            players: { '0': makePlayer('0'), '1': makePlayer('1') },
            bases: [makeBase({
                defId: 'test_base',
                ongoingActions: [{ uid: 'stalling', defId: 'munchkin_orcs_stalling', ownerId: '0' }],
                minions: [makeMinion('own', 'test_minion', '0', 3)],
            }), makeBase('other_base', [makeMinion('other-own', 'test_minion', '0', 3)])],
        });

        const ownAction = fireTriggers(core, 'onActionPlayed', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            actionTargetBaseIndex: 0,
            triggerCardUid: 'own-action',
            triggerCardDefId: 'munchkin_orcs_crush',
            random: defaultTestRandom,
            now: 101,
        });
        expectNoPrompt(ownAction.matchState);

        const otherBaseAction = fireTriggers(core, 'onActionPlayed', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '1',
            actionTargetBaseIndex: 1,
            triggerCardUid: 'other-base-action',
            triggerCardDefId: 'munchkin_orcs_crush',
            random: defaultTestRandom,
            now: 102,
        });
        expectNoPrompt(otherBaseAction.matchState);
    });

    it('躺下！计分前建立本基地压制状态，并让其他玩家特殊能力来源进入压制集', () => {
        const core = makeState({
            bases: [makeBase('test_base', [
                makeMinion('own', 'test_minion', '0', 5),
                makeMinion('enemy', 'test_minion', '1', 3, {
                    attachedActions: [{ uid: 'enemy-special', defId: 'munchkin_orcs_angry_pillagers', ownerId: '1' }],
                }),
            ])],
        });

        const definition = resolveAbilityDefinition('munchkin_orcs_and_stay_down', 'special');
        expect(definition?.validateUse?.({
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'stay-down',
            defId: 'munchkin_orcs_and_stay_down',
            baseIndex: 0,
            random: defaultTestRandom,
            now: 100,
        })).toBeNull();

        const result = invoke(core, 'munchkin_orcs_and_stay_down', 'special', 'stay-down');
        const active = applyEvents(core, result.events);
        expect(active.bases[0].metadata).toEqual(expect.objectContaining({
            andStayDownSuppressorPlayerId: '0',
            andStayDownTurnNumber: 1,
        }));
        expect(isCardSuppressed(active, 'enemy-special')).toBe(true);
    });

    it('躺下！只有当前基地总力量最高的玩家可以使用，平手也算最高', () => {
        const tiedCore = makeState({
            bases: [makeBase('test_base', [
                makeMinion('own', 'test_minion', '0', 5),
                makeMinion('enemy', 'test_minion', '1', 5),
            ])],
        });
        const tiedValidation = resolveAbilityDefinition('munchkin_orcs_and_stay_down', 'special')?.validateUse?.({
            state: tiedCore,
            matchState: makeMatchState(tiedCore),
            playerId: '0',
            cardUid: 'stay-down-tied',
            defId: 'munchkin_orcs_and_stay_down',
            baseIndex: 0,
            random: defaultTestRandom,
            now: 100,
        });
        expect(tiedValidation).toBeNull();

        const behindCore = makeState({
            bases: [makeBase('test_base', [
                makeMinion('own', 'test_minion', '0', 4),
                makeMinion('enemy', 'test_minion', '1', 5),
            ])],
        });
        const behindValidation = resolveAbilityDefinition('munchkin_orcs_and_stay_down', 'special')?.validateUse?.({
            state: behindCore,
            matchState: makeMatchState(behindCore),
            playerId: '0',
            cardUid: 'stay-down-behind',
            defId: 'munchkin_orcs_and_stay_down',
            baseIndex: 0,
            random: defaultTestRandom,
            now: 100,
        });
        expect(behindValidation).toBe('你不是该基地的最高力量玩家');
    });

    it('愤怒的掠夺者只有领先第二名至少 3 点时获得 1 VP，未满足时不产生奖励', () => {
        const validCore = makeState({
            bases: [makeBase('test_base', [
                makeMinion('own', 'test_minion', '0', 8),
                makeMinion('enemy', 'test_minion', '1', 5),
            ])],
        });
        const validResult = invoke(validCore, 'munchkin_orcs_angry_pillagers', 'special', 'angry-valid');
        expect(validResult.events).toEqual([
            expect.objectContaining({
                type: 'su:vp_awarded',
                payload: expect.objectContaining({ playerId: '0', amount: 1 }),
            }),
        ]);

        const invalidCore = makeState({
            bases: [makeBase('test_base', [
                makeMinion('own', 'test_minion', '0', 7),
                makeMinion('enemy', 'test_minion', '1', 5),
            ])],
        });
        const invalidDefinition = resolveAbilityDefinition('munchkin_orcs_angry_pillagers', 'special');
        const invalidValidation = invalidDefinition?.validateUse?.({
            state: invalidCore,
            matchState: makeMatchState(invalidCore),
            playerId: '0',
            cardUid: 'angry-invalid',
            defId: 'munchkin_orcs_angry_pillagers',
            baseIndex: 0,
            random: defaultTestRandom,
            now: 100,
        });
        expect(invalidValidation).toBe('你没有领先第二名至少 3 点力量');
    });
});
