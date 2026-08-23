import { beforeEach, describe, expect, it } from 'vitest';

import { initAllAbilities, resetAbilityInit } from '../../abilities';
import { getBaseDef, getCardDef } from '../../data/cards';
import { clearRegistry } from '../../domain/abilityRegistry';
import { clearBaseAbilityRegistry, triggerBaseAbility, triggerExtendedBaseAbility } from '../../domain/baseAbilities';
import { queueImmediateExtraPlayInteractions } from '../../domain/extraPlay';
import { getEffectiveBreakpoint, getEffectivePower } from '../../domain/ongoingModifiers';
import { fireTriggers } from '../../domain/ongoingEffects';
import { SU_COMMANDS, SU_EVENTS, type ActionCardDef } from '../../domain/types';
import {
    getPromptOption,
    getSimpleChoicePrompt,
    applyEvents,
    makeBase,
    makeCard,
    makeMatchState,
    makeMinion,
    makeMinionMovedEvent,
    makePlayer,
    makeState,
    respondCommand,
    scoreBaseViaFlow,
} from '../helpers';
import { defaultTestRandom, runCommand } from '../testRunner';

beforeEach(() => {
    clearRegistry();
    clearBaseAbilityRegistry();
    resetAbilityInit();
    initAllAbilities();
});

describe('龙派系可复用实现批', () => {
    it('龙行动卡静态合同已补到当前实现批', () => {
        const burnItDown = getCardDef('dragons_burn_it_down') as ActionCardDef | undefined;
        const dragonLands = getCardDef('dragons_dragon_lands') as ActionCardDef | undefined;
        const intimidatingPresence = getCardDef('dragons_intimidating_presence') as ActionCardDef | undefined;
        const dangerousGround = getCardDef('dragons_dangerous_ground') as ActionCardDef | undefined;
        const raze = getCardDef('dragons_raze') as ActionCardDef | undefined;
        const greatWyrm = getCardDef('dragons_great_wyrm') as any;
        const ruins = getCardDef('dragons_ruins') as ActionCardDef | undefined;
        const bringDownTheWalls = getCardDef('dragons_bring_down_the_walls') as ActionCardDef | undefined;

        expect(burnItDown).toMatchObject({
            subtype: 'standard',
            playNeedsBase: true,
        });
        expect(dragonLands).toMatchObject({
            subtype: 'ongoing',
            ongoingTarget: 'base',
            playNeedsBase: true,
            responseWindowTiming: 'beforeScoring',
            responseWindowNeedsBase: true,
            abilityTags: ['ongoing'],
        });
        expect(intimidatingPresence).toMatchObject({
            subtype: 'ongoing',
            ongoingTarget: 'base',
            playNeedsBase: true,
            responseWindowTiming: 'beforeScoring',
            responseWindowNeedsBase: true,
            abilityTags: ['ongoing'],
        });
        expect(dangerousGround).toMatchObject({
            subtype: 'ongoing',
            ongoingTarget: 'base',
            playNeedsBase: true,
            abilityTags: ['ongoing'],
        });
        expect(raze).toMatchObject({
            subtype: 'ongoing',
            ongoingTarget: 'base',
            playNeedsBase: true,
            abilityTags: ['ongoing'],
        });
        expect(greatWyrm).toMatchObject({
            type: 'minion',
            abilityTags: ['ongoing'],
        });
        expect(ruins).toMatchObject({
            subtype: 'ongoing',
            ongoingTarget: 'base',
            playNeedsBase: true,
            abilityTags: ['ongoing'],
        });
        expect(bringDownTheWalls).toMatchObject({
            subtype: 'ongoing',
            ongoingTarget: 'base',
            playNeedsBase: true,
            abilityTags: ['ongoing'],
        });
    });

    it('飞龙打出时只有一个合法随从也必须等待玩家选择后才消灭', () => {
        const state = makeMatchState(makeState({
            currentPlayerIndex: 0,
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('wy1', 'dragons_wyvern', '0')],
                    factions: ['dragons', 'aliens'] as [string, string],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base_ninja_dojo', [
                    makeMinion('target-1', 'pirate_first_mate', '1', 2),
                ]),
            ],
        }));

        const result = runCommand(state, {
            type: SU_COMMANDS.PLAY_MINION,
            playerId: '0',
            payload: { cardUid: 'wy1', baseIndex: 0 },
        });

        expect(result.success).toBe(true);
        const prompt = getSimpleChoicePrompt(result.finalState, 'dragons_wyvern');
        expect(prompt.autoResolveIfSingle).toBe(false);
        const target = getPromptOption(prompt, option => option.value?.minionUid === 'target-1', '飞龙唯一目标');

        const resolved = runCommand(
            result.finalState,
            respondCommand(target.id, '0'),
        );

        expect(resolved.success).toBe(true);
        const base = resolved.finalState.core.bases[0];
        expect(base.minions.some((minion) => minion.uid === 'target-1')).toBe(false);
        expect(base.minions.some((minion) => minion.uid === 'wy1')).toBe(true);
    });

    it('飞龙天赋会让本回合基地爆分线降低 3', () => {
        const state = makeMatchState(makeState({
            bases: [
                makeBase('base_ninja_dojo', [
                    makeMinion('wy1', 'dragons_wyvern', '0', 4),
                ]),
            ],
        }));

        const result = runCommand(state, {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { minionUid: 'wy1', baseIndex: 0 },
        });

        expect(result.success).toBe(true);
        expect(result.finalState.core.tempBreakpointModifiers?.[0]).toBe(-3);
        expect(getEffectiveBreakpoint(result.finalState.core, 0)).toBe(15);
    });

    it('帝国龙在其他玩家打出随从到这里后会让控制者摸 1', () => {
        const state = makeMatchState(makeState({
            currentPlayerIndex: 1,
            players: {
                '0': makePlayer('0', {
                    deck: [makeCard('draw-1', 'alien_invader', '0')],
                }),
                '1': makePlayer('1', {
                    hand: [makeCard('p1-minion', 'pirate_first_mate', '1')],
                }),
            },
            bases: [
                makeBase('base_ninja_dojo', [
                    makeMinion('dragon-1', 'dragons_imperial_dragon', '0', 3),
                ]),
            ],
        }));

        const result = runCommand(state, {
            type: SU_COMMANDS.PLAY_MINION,
            playerId: '1',
            payload: { cardUid: 'p1-minion', baseIndex: 0 },
        });

        expect(result.success).toBe(true);
        expect(result.finalState.core.players['0'].hand.map((card) => card.uid)).toContain('draw-1');
    });

    it('帝国龙在其他玩家把随从移入这里后也会让控制者摸 1', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    deck: [makeCard('draw-1', 'alien_invader', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base_ninja_dojo', [
                    makeMinion('dragon-1', 'dragons_imperial_dragon', '0', 3),
                ]),
                makeBase('base_pirate_cove', [
                    makeMinion('move-1', 'pirate_first_mate', '1', 2),
                ]),
            ],
        });

        const moveEvent = makeMinionMovedEvent({
            minionUid: 'move-1',
            minionDefId: 'pirate_first_mate',
            fromBaseIndex: 1,
            toBaseIndex: 0,
        });
        const movedCore = applyEvents(core, [moveEvent as any]);
        const triggered = fireTriggers(movedCore, 'onMinionMoved', {
            state: movedCore,
            matchState: makeMatchState(movedCore),
            playerId: '1',
            baseIndex: 0,
            moveFromBaseIndex: 1,
            moveToBaseIndex: 0,
            triggerMinionUid: 'move-1',
            triggerMinionDefId: 'pirate_first_mate',
            random: defaultTestRandom,
            now: 1000,
        });
        const finalCore = applyEvents(movedCore, triggered.events as any);

        expect(finalCore.players['0'].hand.map((card) => card.uid)).toContain('draw-1');
    });

    it('幼龙会让其他玩家刚打出到这里的随从本回合 -1 力量', () => {
        const state = makeMatchState(makeState({
            currentPlayerIndex: 1,
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1', {
                    hand: [makeCard('p1-minion', 'pirate_first_mate', '1')],
                }),
            },
            bases: [
                makeBase('base_ninja_dojo', [
                    makeMinion('hatch-1', 'dragons_hatchling', '0', 2),
                ]),
            ],
        }));

        const result = runCommand(state, {
            type: SU_COMMANDS.PLAY_MINION,
            playerId: '1',
            payload: { cardUid: 'p1-minion', baseIndex: 0 },
        });

        expect(result.success).toBe(true);
        const played = result.finalState.core.bases[0].minions.find((minion) => minion.uid === 'p1-minion');
        expect(played?.tempPowerModifier).toBe(-1);
        expect(played?.powerCounters ?? 0).toBe(0);
        expect(played && getEffectivePower(result.finalState.core, played, 0)).toBe(1);
    });

    it('幼龙会让其他玩家移入这里的随从本回合 -1 力量', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base_ninja_dojo', [
                    makeMinion('hatch-1', 'dragons_hatchling', '0', 2),
                ]),
                makeBase('base_pirate_cove', [
                    makeMinion('move-1', 'pirate_first_mate', '1', 2),
                ]),
            ],
        });

        const moveEvent = makeMinionMovedEvent({
            minionUid: 'move-1',
            minionDefId: 'pirate_first_mate',
            fromBaseIndex: 1,
            toBaseIndex: 0,
        });
        const movedCore = applyEvents(core, [moveEvent as any]);
        const triggered = fireTriggers(movedCore, 'onMinionMoved', {
            state: movedCore,
            matchState: makeMatchState(movedCore),
            playerId: '1',
            baseIndex: 0,
            moveFromBaseIndex: 1,
            moveToBaseIndex: 0,
            triggerMinionUid: 'move-1',
            triggerMinionDefId: 'pirate_first_mate',
            random: defaultTestRandom,
            now: 1000,
        });
        const finalCore = applyEvents(movedCore, triggered.events as any);
        const movedMinion = finalCore.bases[0].minions.find((minion) => minion.uid === 'move-1');

        expect(movedMinion?.tempPowerModifier).toBe(-1);
        expect(movedMinion?.powerCounters ?? 0).toBe(0);
        expect(movedMinion && getEffectivePower(finalCore, movedMinion, 0)).toBe(1);
    });

    it('幼龙会响应真实行动交互产生的移入事件', () => {
        const state = makeMatchState(makeState({
            currentPlayerIndex: 1,
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1', {
                    hand: [makeCard('move-action', 'tornados_carried_away', 'action', '1')],
                }),
            },
            bases: [
                makeBase('base_ninja_dojo', [
                    makeMinion('hatch-1', 'dragons_hatchling', '0', 2),
                ]),
                makeBase('base_pirate_cove', [
                    makeMinion('move-1', 'pirate_first_mate', '1', 2),
                ]),
            ],
        }));

        const play = runCommand(state, {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '1',
            payload: { cardUid: 'move-action', targetBaseIndex: 1, targetMinionUid: 'move-1' },
        } as any);
        expect(play.success).toBe(true);

        const prompt = getSimpleChoicePrompt(play.finalState, 'tornados_carried_away_dest');
        const targetBase = getPromptOption(prompt, option => option.value?.baseIndex === 0, '卷走目标基地选项');
        const resolved = runCommand(play.finalState, respondCommand(targetBase.id, '1'));

        expect(resolved.success).toBe(true);
        const movedMinion = resolved.finalState.core.bases[0].minions.find((minion) => minion.uid === 'move-1');
        expect(movedMinion?.tempPowerModifier).toBe(-1);
        expect(movedMinion && getEffectivePower(resolved.finalState.core, movedMinion, 0)).toBe(1);
    });

    it('险地会让其他玩家在这里打出随从后选择唯一剩余手牌再弃掉', () => {
        const state = makeMatchState(makeState({
            currentPlayerIndex: 1,
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1', {
                    hand: [
                        makeCard('play-1', 'pirate_first_mate', '1'),
                        makeCard('discard-1', 'alien_invader', '1'),
                    ],
                }),
            },
            bases: [
                makeBase({
                    defId: 'base_ninja_dojo',
                    ongoingActions: [
                        { uid: 'ground-1', defId: 'dragons_dangerous_ground', ownerId: '0' },
                    ],
                }),
            ],
        }));

        const result = runCommand(state, {
            type: SU_COMMANDS.PLAY_MINION,
            playerId: '1',
            payload: { cardUid: 'play-1', baseIndex: 0 },
        });

        expect(result.success).toBe(true);
        const prompt = getSimpleChoicePrompt(result.finalState, 'dragons_dangerous_ground');
        expect(prompt.autoResolveIfSingle).toBe(false);
        const discard = getPromptOption(prompt, option => option.value?.cardUid === 'discard-1', '险地唯一弃牌候选');

        const resolved = runCommand(
            result.finalState,
            respondCommand(discard.id, '1'),
        );

        expect(resolved.success).toBe(true);
        expect(resolved.finalState.core.players['1'].hand).toEqual([]);
        expect(resolved.finalState.core.players['1'].discard.map((card) => card.uid)).toContain('discard-1');
    });

    it('险地会让其他玩家在这里打出随从后通过 prompt 选择弃牌', () => {
        const state = makeMatchState(makeState({
            currentPlayerIndex: 1,
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1', {
                    hand: [
                        makeCard('play-1', 'pirate_first_mate', '1'),
                        makeCard('discard-a', 'alien_invader', 'action', '1'),
                        makeCard('discard-b', 'wizard_zap', 'action', '1'),
                    ],
                }),
            },
            bases: [
                makeBase({
                    defId: 'base_ninja_dojo',
                    ongoingActions: [
                        { uid: 'ground-1', defId: 'dragons_dangerous_ground', ownerId: '0' },
                    ],
                }),
            ],
        }));

        const played = runCommand(state, {
            type: SU_COMMANDS.PLAY_MINION,
            playerId: '1',
            payload: { cardUid: 'play-1', baseIndex: 0 },
        });

        expect(played.success).toBe(true);
        const prompt = getSimpleChoicePrompt(played.finalState, 'dragons_dangerous_ground');
        const discardA = getPromptOption(prompt, (option) => option.value?.cardUid === 'discard-a', '险地弃牌候选 discard-a');

        const resolved = runCommand(
            played.finalState,
            respondCommand(discardA.id, '1'),
        );

        expect(resolved.success).toBe(true);
        expect(resolved.finalState.core.players['1'].discard.map((card) => card.uid)).toContain('discard-a');
        expect(resolved.finalState.core.players['1'].hand.map((card) => card.uid)).toEqual(['discard-b']);
    });

    it('侧翼攻击会从弃牌堆额外打出一个可打到基地上的行动卡，且不额外消耗行动次数', () => {
        const state = makeMatchState(makeState({
            currentPlayerIndex: 0,
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('flank-1', 'dragons_flank_attack', 'action', '0')],
                    discard: [makeCard('ruins-1', 'dragons_ruins', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base_ninja_dojo', []),
                makeBase('base_pirate_cove', []),
            ],
        }));

        const played = runCommand(state, {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'flank-1' },
        });

        expect(played.success).toBe(true);
        const sourcePrompt = getSimpleChoicePrompt(played.finalState, 'dragons_flank_attack_source');
        expect(sourcePrompt.autoResolveIfSingle).toBe(false);
        const discardSource = getPromptOption(
            sourcePrompt,
            (option) => option.value?.searchScope === 'discard',
            '侧翼攻击唯一弃牌堆搜索范围',
        );
        const chosenSource = runCommand(
            played.finalState,
            respondCommand(discardSource.id, '0'),
        );

        expect(chosenSource.success).toBe(true);
        const cardPrompt = getSimpleChoicePrompt(chosenSource.finalState, 'dragons_flank_attack_card');
        const ruinsOption = getPromptOption(
            cardPrompt,
            (option) => option.value?.cardUid === 'ruins-1' && option.value?.sourceZone === 'discard',
            '侧翼攻击弃牌堆行动卡候选',
        );

        const chosenCard = runCommand(
            chosenSource.finalState,
            respondCommand(ruinsOption.id, '0'),
        );

        expect(chosenCard.success).toBe(true);
        const basePrompt = getSimpleChoicePrompt(chosenCard.finalState, 'dragons_flank_attack_base');
        const targetBase = getPromptOption(
            basePrompt,
            (option) => option.value?.baseIndex === 1,
            '侧翼攻击目标基地候选',
        );

        const resolved = runCommand(
            chosenCard.finalState,
            respondCommand(targetBase.id, '0'),
        );

        expect(resolved.success).toBe(true);
        expect(resolved.finalState.core.players['0'].actionsPlayed).toBe(1);
        expect(resolved.finalState.core.players['0'].discard.map((card) => card.uid)).toContain('flank-1');
        expect(resolved.finalState.core.players['0'].discard.map((card) => card.uid)).not.toContain('ruins-1');
        expect(resolved.finalState.core.bases[1].ongoingActions).toEqual([
            expect.objectContaining({ uid: 'ruins-1', defId: 'dragons_ruins', ownerId: '0' }),
        ]);
    });

    it('侧翼攻击在同时搜索牌库与弃牌堆时，选择弃牌堆卡牌后仍会洗切牌库', () => {
        const reverseRandom = {
            ...defaultTestRandom,
            shuffle: <T,>(arr: T[]) => [...arr].reverse(),
        };
        const state = makeMatchState(makeState({
            currentPlayerIndex: 0,
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('flank-1', 'dragons_flank_attack', 'action', '0')],
                    deck: [
                        makeCard('deck-a', 'dragons_ruins', 'action', '0'),
                        makeCard('deck-b', 'dragons_dangerous_ground', 'action', '0'),
                    ],
                    discard: [makeCard('discard-1', 'dragons_raze', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base_ninja_dojo', []),
            ],
        }));

        const played = runCommand(state, {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'flank-1' },
        }, reverseRandom);

        expect(played.success).toBe(true);
        const scopePrompt = getSimpleChoicePrompt(played.finalState, 'dragons_flank_attack_source');
        expect(scopePrompt.targetType).toBe('button');
        const bothOption = getPromptOption(
            scopePrompt,
            (option) => option.value?.searchScope === 'both',
            '侧翼攻击双区域搜索候选',
        );

        const chosenScope = runCommand(
            played.finalState,
            respondCommand(bothOption.id, '0'),
            reverseRandom,
        );

        expect(chosenScope.success).toBe(true);
        const cardPrompt = getSimpleChoicePrompt(chosenScope.finalState, 'dragons_flank_attack_card');
        const discardOption = getPromptOption(
            cardPrompt,
            (option) => option.value?.cardUid === 'discard-1' && option.value?.sourceZone === 'discard',
            '侧翼攻击双区域弃牌堆行动卡候选',
        );

        const chosenCard = runCommand(
            chosenScope.finalState,
            respondCommand(discardOption.id, '0'),
            reverseRandom,
        );

        expect(chosenCard.success).toBe(true);
        expect(chosenCard.finalState.core.players['0'].deck.map((card) => card.uid)).toEqual(['deck-b', 'deck-a']);
        expect(chosenCard.finalState.core.players['0'].hand.map((card) => card.uid)).toContain('discard-1');
    });

    it('推倒城墙会在基地计分前给其拥有者一个立刻打出到该基地的额外随从机会', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('extra-minion', 'alien_invader', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase({
                    defId: 'base_ninja_dojo',
                    ongoingActions: [
                        { uid: 'walls-1', defId: 'dragons_bring_down_the_walls', ownerId: '0' },
                    ],
                }),
            ],
        });
        const matchState = makeMatchState(core);
        matchState.sys.phase = 'scoreBases';

        const triggered = fireTriggers(core, 'beforeScoring', {
            state: core,
            matchState,
            playerId: '1',
            baseIndex: 0,
            random: defaultTestRandom,
            now: 1000,
        });

        const extraMinionEvent = triggered.events.find((event) => event.type === SU_EVENTS.LIMIT_MODIFIED) as any;
        expect(extraMinionEvent?.payload).toMatchObject({
            playerId: '0',
            limitType: 'minion',
            delta: 1,
            restrictToBase: 0,
            playTiming: 'immediate',
        });

        const promptedState = queueImmediateExtraPlayInteractions(
            triggered.matchState ?? matchState,
            triggered.events.filter((event) => event.type === SU_EVENTS.LIMIT_MODIFIED) as any,
        );
        const prompt = getSimpleChoicePrompt(promptedState, 'smashup_immediate_extra_minion');
        expect(prompt.playerId).toBe('0');
        const skipOption = getPromptOption(prompt, (option) => option.value?.skip === true, '额外随从跳过选项');

        const skipped = runCommand(
            promptedState,
            respondCommand(skipOption.id, '0'),
        );

        expect(skipped.success).toBe(true);
        expect(skipped.finalState.sys.interaction.current).toBeUndefined();
    });

    it('龙之领地与威压的持续力量修正已生效', () => {
        const core = makeState({
            bases: [
                makeBase({
                    defId: 'base_ninja_dojo',
                    minions: [
                        makeMinion('ally-1', 'pirate_first_mate', '0', 2),
                        makeMinion('enemy-1', 'alien_invader', '1', 3),
                    ],
                    ongoingActions: [
                        { uid: 'lands-1', defId: 'dragons_dragon_lands', ownerId: '0' },
                        { uid: 'presence-1', defId: 'dragons_intimidating_presence', ownerId: '0' },
                    ],
                }),
            ],
        });

        const ally = core.bases[0].minions[0];
        const enemy = core.bases[0].minions[1];

        expect(getEffectivePower(core, ally, 0)).toBe(3);
        expect(getEffectivePower(core, enemy, 0)).toBe(2);
    });

    it('夷平会持续压制常规基地能力触发', () => {
        const normalState = makeState({
            bases: [makeBase({ defId: 'base_the_workshop' })],
        });
        const normalResult = triggerBaseAbility('base_the_workshop', 'onActionPlayed', {
            state: normalState,
            baseIndex: 0,
            baseDefId: 'base_the_workshop',
            playerId: '0',
            now: 0,
        });
        expect(normalResult.events.some((event) => event.type === SU_EVENTS.LIMIT_MODIFIED)).toBe(true);

        const suppressedState = makeState({
            bases: [makeBase({
                defId: 'base_the_workshop',
                ongoingActions: [{ uid: 'raze-1', defId: 'dragons_raze', ownerId: '0' }],
            })],
        });
        const suppressedResult = triggerBaseAbility('base_the_workshop', 'onActionPlayed', {
            state: suppressedState,
            baseIndex: 0,
            baseDefId: 'base_the_workshop',
            playerId: '0',
            now: 0,
        });
        expect(suppressedResult.events).toEqual([]);
    });

    it('夷平会持续压制扩展基地能力触发', () => {
        const normalState = makeState({
            bases: [makeBase({ defId: 'base_cave_of_shinies' })],
        });
        const normalResult = triggerExtendedBaseAbility('base_cave_of_shinies', 'onMinionDestroyed', {
            state: normalState,
            baseIndex: 0,
            baseDefId: 'base_cave_of_shinies',
            playerId: '0',
            minionUid: 'm1',
            minionDefId: 'test_minion',
            now: 0,
        });
        expect(normalResult.events.some((event) => event.type === SU_EVENTS.VP_AWARDED)).toBe(true);

        const suppressedState = makeState({
            bases: [makeBase({
                defId: 'base_cave_of_shinies',
                ongoingActions: [{ uid: 'raze-1', defId: 'dragons_raze', ownerId: '0' }],
            })],
        });
        const suppressedResult = triggerExtendedBaseAbility('base_cave_of_shinies', 'onMinionDestroyed', {
            state: suppressedState,
            baseIndex: 0,
            baseDefId: 'base_cave_of_shinies',
            playerId: '0',
            minionUid: 'm1',
            minionDefId: 'test_minion',
            now: 0,
        });
        expect(suppressedResult.events).toEqual([]);
    });

    it('夷平也会压制基地自带的持续力量加成', () => {
        const normalState = makeState({
            bases: [
                makeBase('base_central_brain', [
                    makeMinion('robot-1', 'robot_microbot_alpha', '0', 1),
                ]),
            ],
        });
        const normalMinion = normalState.bases[0].minions[0];
        expect(getEffectivePower(normalState, normalMinion, 0)).toBe(2);

        const suppressedState = makeState({
            bases: [
                makeBase({
                    defId: 'base_central_brain',
                    ongoingActions: [{ uid: 'raze-1', defId: 'dragons_raze', ownerId: '0' }],
                    minions: [makeMinion('robot-1', 'robot_microbot_alpha', '0', 1)],
                }),
            ],
        });
        const suppressedMinion = suppressedState.bases[0].minions[0];
        expect(getEffectivePower(suppressedState, suppressedMinion, 0)).toBe(1);
    });

    it('烧毁它会摧毁基地上的行动牌，并用基地牌库顶牌替换该基地且保留随从', () => {
        const state = makeMatchState(makeState({
            currentPlayerIndex: 0,
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('burn-1', 'dragons_burn_it_down', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase({
                    defId: 'base_ninja_dojo',
                    minions: [
                        makeMinion('ally-1', 'alien_invader', '0', 3, {
                            attachedActions: [{ uid: 'attached-1', defId: 'mermaids_charmed', ownerId: '1' }],
                        }),
                    ],
                    ongoingActions: [
                        { uid: 'base-act-1', defId: 'dragons_dangerous_ground', ownerId: '1' },
                    ],
                }),
            ],
            baseDeck: ['base_the_workshop'],
            baseDiscard: [],
        }));

        const result = runCommand(state, {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'burn-1', targetBaseIndex: 0 },
        });

        expect(result.success).toBe(true);
        expect(result.finalState.sys.interaction.current).toBeUndefined();
        expect(result.finalState.core.bases[0].defId).toBe('base_the_workshop');
        expect(result.finalState.core.bases[0].ongoingActions).toEqual([]);
        expect(result.finalState.core.bases[0].minions[0]?.uid).toBe('ally-1');
        expect(result.finalState.core.bases[0].minions[0]?.attachedActions).toEqual([
            expect.objectContaining({ uid: 'attached-1', defId: 'mermaids_charmed' }),
        ]);
        expect(result.finalState.core.baseDeck).toEqual([]);
        expect(result.finalState.core.baseDiscard).toEqual(['base_ninja_dojo']);
        expect(result.finalState.core.players['1'].discard).toEqual(
            expect.arrayContaining([expect.objectContaining({ uid: 'base-act-1', defId: 'dragons_dangerous_ground' })]),
        );
    });

    it('烧毁它在基地弃牌堆可选时会允许选择弃牌堆基地进行替换', () => {
        const state = makeMatchState(makeState({
            currentPlayerIndex: 0,
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('burn-1', 'dragons_burn_it_down', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase({
                    defId: 'base_ninja_dojo',
                    minions: [makeMinion('ally-1', 'alien_invader', '0', 3)],
                    ongoingActions: [
                        { uid: 'base-act-1', defId: 'dragons_dangerous_ground', ownerId: '1' },
                    ],
                }),
            ],
            baseDeck: ['base_the_workshop'],
            baseDiscard: ['base_central_brain', 'base_monkey_lab'],
        }));

        const played = runCommand(state, {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'burn-1', targetBaseIndex: 0 },
        });

        expect(played.success).toBe(true);
        const prompt = getSimpleChoicePrompt(played.finalState, 'dragons_burn_it_down');
        expect(prompt.targetType).toBe('button');
        const discardOption = getPromptOption(
            prompt,
            (option) => option.value?.source === 'discard' && option.value?.baseDefId === 'base_central_brain',
            '烧毁它弃牌堆替换基地候选',
        );

        const resolved = runCommand(
            played.finalState,
            respondCommand(discardOption.id, '0'),
        );

        expect(resolved.success).toBe(true);
        expect(resolved.finalState.core.bases[0].defId).toBe('base_central_brain');
        expect(resolved.finalState.core.bases[0].ongoingActions).toEqual([]);
        expect(resolved.finalState.core.bases[0].minions.map((minion) => minion.uid)).toEqual(['ally-1']);
        expect(resolved.finalState.core.baseDeck).toEqual(['base_the_workshop']);
        expect(resolved.finalState.core.baseDiscard).toEqual(['base_monkey_lab', 'base_ninja_dojo']);
        expect(resolved.finalState.core.players['1'].discard).toEqual(
            expect.arrayContaining([expect.objectContaining({ uid: 'base-act-1', defId: 'dragons_dangerous_ground' })]),
        );
    });

    it('巨龙会让其他玩家在该基地计分时少拿 1 基础 VP，但不影响基地能力额外给的 VP', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase({
                    defId: 'base_the_factory',
                    minions: [
                        makeMinion('wyrm-1', 'dragons_great_wyrm', '0', 5),
                        makeMinion('winner-1', 'alien_invader', '1', 20),
                    ],
                }),
            ],
            baseDeck: ['base_the_workshop'],
            baseDiscard: [],
        });

        const result = scoreBaseViaFlow(
            core,
            0,
            core.baseDeck,
            '0',
            1000,
            defaultTestRandom,
            makeMatchState(core),
        );
        const baseScored = result.events.find((event) => event.type === SU_EVENTS.BASE_SCORED) as any;
        const winnerRanking = baseScored?.payload?.rankings?.find((ranking: any) => ranking.playerId === '1');
        const factoryTopAward = getBaseDef('base_the_factory')?.vpAwards[0] ?? 0;
        const bonusVpEvent = result.events.find((event: any) =>
            event.type === SU_EVENTS.VP_AWARDED
            && event.payload?.playerId === '1'
            && event.payload?.reason === '工厂：每5力量1VP（20力量=4VP）',
        ) as any;

        expect(winnerRanking?.vp).toBe(factoryTopAward - 1);
        expect(bonusVpEvent?.payload?.amount).toBe(4);
    });

    it('废墟只会让其他玩家少拿 1 基础 VP，不影响自己在同基地的基础 VP', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase({
                    defId: 'base_central_brain',
                    minions: [
                        makeMinion('winner-0', 'alien_invader', '0', 20),
                        makeMinion('runner-1', 'pirate_first_mate', '1', 15),
                    ],
                    ongoingActions: [
                        { uid: 'ruins-1', defId: 'dragons_ruins', ownerId: '0' },
                    ],
                }),
            ],
            baseDeck: ['base_the_workshop'],
            baseDiscard: [],
        });

        const result = scoreBaseViaFlow(
            core,
            0,
            core.baseDeck,
            '0',
            1000,
            defaultTestRandom,
            makeMatchState(core),
        );
        const baseScored = result.events.find((event) => event.type === SU_EVENTS.BASE_SCORED) as any;
        const rankings = baseScored?.payload?.rankings ?? [];
        const baseAwards = getBaseDef('base_central_brain')?.vpAwards ?? [0, 0, 0];

        expect(rankings.find((ranking: any) => ranking.playerId === '0')?.vp).toBe(baseAwards[0]);
        expect(rankings.find((ranking: any) => ranking.playerId === '1')?.vp).toBe(Math.max(0, baseAwards[1] - 1));
    });

    it('龙穴会在基地计分后让冠军摸 3 张牌', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    deck: [
                        makeCard('draw-1', 'alien_invader', '0'),
                        makeCard('draw-2', 'pirate_first_mate', '0'),
                        makeCard('draw-3', 'wizard_zap', 'action', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_dragons_lair', [])],
        });

        const result = triggerBaseAbility('base_dragons_lair', 'afterScoring', {
            state: core,
            baseIndex: 0,
            baseDefId: 'base_dragons_lair',
            playerId: '0',
            rankings: [{ playerId: '0', power: 10, vp: 2 }],
            random: defaultTestRandom,
            now: 1000,
        });
        const finalCore = applyEvents(core, result.events as any);

        expect(finalCore.players['0'].hand.map((card) => card.uid).sort()).toEqual(['draw-1', 'draw-2', 'draw-3']);
        expect(finalCore.players['0'].deck).toEqual([]);
    });

    it('龙之荒芜会让该基地上的所有随从持续 -1 力量', () => {
        const core = makeState({
            bases: [
                makeBase('base_wyrms_desolation', [
                    makeMinion('ally-1', 'alien_invader', '0', 3),
                    makeMinion('enemy-1', 'pirate_first_mate', '1', 2),
                ]),
            ],
        });

        const ally = core.bases[0].minions[0];
        const enemy = core.bases[0].minions[1];

        expect(getEffectivePower(core, ally, 0)).toBe(2);
        expect(getEffectivePower(core, enemy, 0)).toBe(1);
    });
});
