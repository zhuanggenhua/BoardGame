import { makeMinionDestroyedEvent } from '../helpers';
import { beforeEach, describe, expect, it } from 'vitest';

import { initAllAbilities, resetAbilityInit } from '../../abilities';
import { clearRegistry } from '../../domain/abilityRegistry';
import { clearBaseAbilityRegistry } from '../../domain/baseAbilities';
import { fireTriggers, isMinionProtected } from '../../domain/ongoingEffects';
import { getEffectivePower } from '../../domain/ongoingModifiers';
import { SU_COMMANDS, SU_EVENTS, type ActionCardDef } from '../../domain/types';
import { getCardDef } from '../../data/cards';
import {
    applyEvents,
    getPromptOption,
    getPromptOptions,
    getOptionalSimpleChoicePrompt,
    getSimpleChoicePrompt,
    makeBase,
    makeCard,
    makeMatchState,
    makeMinion,
    makePlayer,
    makeState,
    respondCommand,
    respondToPromptOption,
    respondToPromptOptions,
    triggerBaseAbilityWithMS,
} from '../helpers';
import { runCommand } from '../testRunner';

const dummyRandom = {
    random: () => 0.5,
    shuffle: <T>(items: T[]) => [...items],
    d: () => 1,
    range: (min: number) => min,
};

beforeEach(() => {
    clearRegistry();
    clearBaseAbilityRegistry();
    resetAbilityInit();
    initAllAbilities();
});

describe('超级英雄派系隐藏实现批', () => {
    it('惊奇队长静态合同已声明 talent', () => {
        const captainAmazing = getCardDef('superheroes_captain_amazing') as ActionCardDef | any;
        expect(captainAmazing?.abilityTags).toEqual(['talent']);
    });

    it('放射暴露静态合同已声明 playNeedsMinion', () => {
        const radioactiveExposure = getCardDef('superheroes_radioactive_exposure') as ActionCardDef | any;
        expect(radioactiveExposure?.playNeedsMinion).toBe(true);
    });

    it('心灵女士与三张持续行动的静态合同已对齐真实玩法', () => {
        const mindLady = getCardDef('superheroes_mind_lady') as ActionCardDef | any;
        const expandedPower = getCardDef('superheroes_expanded_power') as ActionCardDef | any;
        const secretBase = getCardDef('superheroes_secret_base') as ActionCardDef | any;
        const myOnlyWeakness = getCardDef('superheroes_my_only_weakness') as ActionCardDef | any;

        expect(mindLady?.abilityTags).toEqual(['talent']);
        expect(expandedPower).toMatchObject({
            subtype: 'ongoing',
            ongoingTarget: 'minion',
            playNeedsMinion: true,
            playTargetMinionController: 'self',
        });
        expect(secretBase).toMatchObject({
            subtype: 'ongoing',
            ongoingTarget: 'base',
            playNeedsBase: true,
        });
        expect(myOnlyWeakness).toMatchObject({
            subtype: 'ongoing',
            ongoingTarget: 'minion',
            playNeedsMinion: true,
        });
    });

    it('惊奇队长天赋会让这里你当前在场的每个随从本回合 +1 力量', () => {
        const state = makeMatchState(makeState({
            bases: [
                makeBase('base_ninja_dojo', [
                    makeMinion('captain-1', 'superheroes_captain_amazing', '0', 5),
                    makeMinion('ally-1', 'pirate_first_mate', '0', 2),
                    makeMinion('enemy-1', 'alien_invader', '1', 3),
                ]),
            ],
        }));

        const result = runCommand(state, {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { minionUid: 'captain-1', baseIndex: 0 },
        });

        expect(result.success).toBe(true);
        const base = result.finalState.core.bases[0];
        const captain = base.minions.find((minion) => minion.uid === 'captain-1')!;
        const ally = base.minions.find((minion) => minion.uid === 'ally-1')!;
        const enemy = base.minions.find((minion) => minion.uid === 'enemy-1')!;

        expect(getEffectivePower(result.finalState.core, captain, 0)).toBe(6);
        expect(getEffectivePower(result.finalState.core, ally, 0)).toBe(3);
        expect(getEffectivePower(result.finalState.core, enemy, 0)).toBe(3);
    });

    it('心灵女士在场后可发动天赋，选择另一名玩家的随从并压制其能力直到你下回合开始', () => {
        const state = makeMatchState(makeState({
            currentPlayerIndex: 0,
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base_ninja_dojo', [
                    makeMinion('mind-1', 'superheroes_mind_lady', '0', 5),
                    makeMinion('captain-1', 'superheroes_captain_amazing', '1', 5),
                    makeMinion('burst-1', 'superheroes_the_burst', '1', 5),
                ]),
                makeBase('base_pirate_cove', []),
            ],
        }));

        const activated = runCommand(state, {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { minionUid: 'mind-1', baseIndex: 0 },
        });

        expect(activated.success).toBe(true);
        const prompt = getSimpleChoicePrompt(activated.finalState, 'superheroes_mind_lady');
        const target = getPromptOption(prompt, (option) => option.value?.minionUid === 'captain-1', '心灵女士候选随从');

        const resolved = respondToPromptOption(activated.finalState, (option) => option.id === target.id, '心灵女士候选随从', '0');
        expect(resolved.success).toBe(true);

        const suppressed = resolved.finalState.core.suppressedCardsUntilTurnStart ?? [];
        expect(suppressed.map((entry) => entry.cardUid)).toEqual(['captain-1']);
        expect(resolved.finalState.core.bases[0].minions.find((minion) => minion.uid === 'mind-1')?.talentUsed).toBe(true);

        const destroyedMindLady = applyEvents(resolved.finalState.core, [makeMinionDestroyedEvent({minionUid: 'mind-1',
                minionDefId: 'superheroes_mind_lady',
                fromBaseIndex: 0,
                ownerId: '0',
                controllerId: '0',
                destroyerId: '1',
                reason: 'test', timestamp: 1000 }) as any]);

        const opponentTurnState = makeMatchState({
            ...destroyedMindLady,
            currentPlayerIndex: 1,
        });
        opponentTurnState.sys.phase = 'playCards';

        const blockedTalent = runCommand(opponentTurnState, {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '1',
            payload: { minionUid: 'captain-1', baseIndex: 0 },
        });

        expect(blockedTalent.success).toBe(false);

        const cleared = applyEvents(destroyedMindLady, [{
            type: SU_EVENTS.TURN_STARTED,
            payload: { playerId: '0', turnNumber: (destroyedMindLady.turnNumber ?? 0) + 1 },
            timestamp: 1101,
        } as any]);
        expect(cleared.suppressedCardsUntilTurnStart ?? []).toEqual([]);

        const recoveredTurnState = makeMatchState({
            ...cleared,
            currentPlayerIndex: 1,
        });
        recoveredTurnState.sys.phase = 'playCards';

        const recoveredTalent = runCommand(recoveredTurnState, {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '1',
            payload: { minionUid: 'captain-1', baseIndex: 0 },
        });

        expect(recoveredTalent.success).toBe(true);
    });

    it('强化能力真实打出会附着到己方随从并提供 +1 力量', () => {
        const state = makeMatchState(makeState({
            currentPlayerIndex: 0,
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('exp-1', 'superheroes_expanded_power', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base_ninja_dojo', [
                    makeMinion('ally-1', 'superheroes_captain_amazing', '0', 5),
                ]),
            ],
        }));

        const played = runCommand(state, {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'exp-1', targetBaseIndex: 0, targetMinionUid: 'ally-1' },
        });

        expect(played.success).toBe(true);
        const ally = played.finalState.core.bases[0].minions.find((minion) => minion.uid === 'ally-1')!;
        expect(ally.attachedActions.map((action) => action.uid)).toContain('exp-1');
        expect(getEffectivePower(played.finalState.core, ally, 0)).toBe(6);
    });

    it('秘密基地真实打出会附着到基地并保留持续保护', () => {
        const state = makeMatchState(makeState({
            currentPlayerIndex: 0,
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('secret-1', 'superheroes_secret_base', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base_ninja_dojo', [
                    makeMinion('ally-1', 'superheroes_captain_amazing', '0', 5),
                ]),
            ],
        }));

        const played = runCommand(state, {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'secret-1', targetBaseIndex: 0 },
        });

        expect(played.success).toBe(true);
        expect(played.finalState.core.bases[0].ongoingActions.map((action) => action.uid)).toContain('secret-1');
    });

    it('我唯一的弱点会在附着期间压制目标随从能力，失去附着后恢复', () => {
        const state = makeMatchState(makeState({
            currentPlayerIndex: 0,
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('weak-1', 'superheroes_my_only_weakness', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base_ninja_dojo', [
                    makeMinion('captain-1', 'superheroes_captain_amazing', '1', 5),
                ]),
            ],
        }));

        const played = runCommand(state, {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'weak-1', targetBaseIndex: 0, targetMinionUid: 'captain-1' },
        });

        expect(played.success).toBe(true);
        const attachedCaptain = played.finalState.core.bases[0].minions.find((minion) => minion.uid === 'captain-1')!;
        expect(attachedCaptain.attachedActions.map((action) => action.uid)).toContain('weak-1');

        const blockedTurnState = makeMatchState({
            ...played.finalState.core,
            currentPlayerIndex: 1,
        });
        blockedTurnState.sys.phase = 'playCards';

        const blockedTalent = runCommand(blockedTurnState, {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '1',
            payload: { minionUid: 'captain-1', baseIndex: 0 },
        });

        expect(blockedTalent.success).toBe(false);

        const detached = applyEvents(played.finalState.core, [{
            type: SU_EVENTS.ONGOING_DETACHED,
            payload: {
                cardUid: 'weak-1',
                defId: 'superheroes_my_only_weakness',
                ownerId: '0',
                reason: 'test',
            },
            timestamp: 1200,
        } as any]);

        const recoveredTurnState = makeMatchState({
            ...detached,
            currentPlayerIndex: 1,
        });
        recoveredTurnState.sys.phase = 'playCards';

        const recoveredTalent = runCommand(recoveredTurnState, {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '1',
            payload: { minionUid: 'captain-1', baseIndex: 0 },
        });

        expect(recoveredTalent.success).toBe(true);
    });

    it('并没真死会让你从弃牌堆中选择最多 2 个力量 2 或以下的随从回手', () => {
        const state = makeMatchState(makeState({
            currentPlayerIndex: 0,
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('nrd-1', 'superheroes_not_really_dead', 'action', '0')],
                    discard: [
                        makeCard('small-1', 'pirate_first_mate', 'minion', '0'),
                        makeCard('small-2', 'dragons_hatchling', 'minion', '0'),
                        makeCard('big-1', 'alien_invader', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
        }));

        const played = runCommand(state, {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'nrd-1' },
        });

        expect(played.success).toBe(true);
        const prompt = getSimpleChoicePrompt(played.finalState, 'superheroes_not_really_dead');
        const small1 = getPromptOption(prompt, (option) => option.value?.cardUid === 'small-1', '并没真死候选 small-1');
        const small2 = getPromptOption(prompt, (option) => option.value?.cardUid === 'small-2', '并没真死候选 small-2');

        const resolved = respondToPromptOptions(played.finalState, [small1.id, small2.id], '0');

        expect(resolved.success).toBe(true);
        expect(resolved.finalState.core.players['0'].hand.map((card) => card.uid).sort()).toEqual(['small-1', 'small-2']);
        expect(resolved.finalState.core.players['0'].discard.map((card) => card.uid).sort()).toEqual(['big-1', 'nrd-1']);
    });

    it('黄金时代会让你把弃牌堆中选择的随从放到牌库底', () => {
        const state = makeMatchState(makeState({
            currentPlayerIndex: 0,
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('ga-1', 'superheroes_golden_age', 'action', '0')],
                    deck: [makeCard('deck-0', 'wizard_zap', 'action', '0')],
                    discard: [
                        makeCard('minion-1', 'pirate_first_mate', 'minion', '0'),
                        makeCard('minion-2', 'alien_invader', 'minion', '0'),
                        makeCard('action-1', 'wizard_zap', 'action', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
        }));

        const played = runCommand(state, {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'ga-1' },
        });

        expect(played.success).toBe(true);
        const prompt = getSimpleChoicePrompt(played.finalState, 'superheroes_golden_age');
        const minion1 = getPromptOption(prompt, (option) => option.value?.cardUid === 'minion-1', '黄金时代候选 minion-1');
        const minion2 = getPromptOption(prompt, (option) => option.value?.cardUid === 'minion-2', '黄金时代候选 minion-2');

        const resolved = respondToPromptOptions(played.finalState, [minion1.id, minion2.id], '0');

        expect(resolved.success).toBe(true);
        expect(resolved.finalState.core.players['0'].deck.map((card) => card.uid)).toEqual(['deck-0', 'minion-1', 'minion-2']);
        expect(resolved.finalState.core.players['0'].discard.map((card) => card.uid).sort()).toEqual(['action-1', 'ga-1']);
    });

    it('正义伙伴会让你所有当前力量 5 或以上的随从本回合 +2 力量', () => {
        const state = makeMatchState(makeState({
            currentPlayerIndex: 0,
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('jf-1', 'superheroes_justice_friends', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base_ninja_dojo', [
                    makeMinion('captain-1', 'superheroes_captain_amazing', '0', 5),
                    makeMinion('small-1', 'pirate_first_mate', '0', 4),
                    makeMinion('enemy-1', 'alien_invader', '1', 5),
                ]),
                makeBase('base_pirate_cove', [
                    makeMinion('burst-1', 'superheroes_the_burst', '0', 5),
                ]),
            ],
        }));

        const played = runCommand(state, {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'jf-1' },
        });

        expect(played.success).toBe(true);
        const base0 = played.finalState.core.bases[0];
        const base1 = played.finalState.core.bases[1];
        const captain = base0.minions.find((minion) => minion.uid === 'captain-1')!;
        const small = base0.minions.find((minion) => minion.uid === 'small-1')!;
        const enemy = base0.minions.find((minion) => minion.uid === 'enemy-1')!;
        const burst = base1.minions.find((minion) => minion.uid === 'burst-1')!;

        expect(getEffectivePower(played.finalState.core, captain, 0)).toBe(7);
        expect(getEffectivePower(played.finalState.core, small, 0)).toBe(4);
        expect(getEffectivePower(played.finalState.core, enemy, 0)).toBe(5);
        expect(getEffectivePower(played.finalState.core, burst, 1)).toBe(7);
    });

    it('正义伙伴会按当前有效力量判定，已被增益到 5 的己方随从也会获得 +2', () => {
        const state = makeMatchState(makeState({
            currentPlayerIndex: 0,
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('jf-1', 'superheroes_justice_friends', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base_ninja_dojo', [
                    makeMinion('boosted-1', 'pirate_first_mate', '0', 4, { powerModifier: 1 }),
                    makeMinion('small-1', 'dragons_hatchling', '0', 2),
                ]),
            ],
        }));

        const played = runCommand(state, {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'jf-1' },
        });

        expect(played.success).toBe(true);
        const boosted = played.finalState.core.bases[0].minions.find((minion) => minion.uid === 'boosted-1')!;
        const small = played.finalState.core.bases[0].minions.find((minion) => minion.uid === 'small-1')!;

        expect(getEffectivePower(played.finalState.core, boosted, 0)).toBe(7);
        expect(getEffectivePower(played.finalState.core, small, 0)).toBe(2);
    });

    it('助手在多基地可选时会先选基地，再给该基地一个力量 2 或以下的额外随从额度', () => {
        const state = makeMatchState(makeState({
            currentPlayerIndex: 0,
            players: {
                '0': makePlayer('0', {
                    hand: [
                        makeCard('sidekick-1', 'superheroes_sidekick', 'action', '0'),
                        makeCard('small-1', 'pirate_first_mate', 'minion', '0'),
                    ],
                    minionsPlayed: 1,
                }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base_ninja_dojo', [
                    makeMinion('power-0', 'superheroes_captain_amazing', '0', 5),
                ]),
                makeBase('base_pirate_cove', [
                    makeMinion('power-1', 'superheroes_the_burst', '0', 5),
                ]),
            ],
        }));

        const played = runCommand(state, {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'sidekick-1' },
        });

        expect(played.success).toBe(true);
        const prompt = getSimpleChoicePrompt(played.finalState, 'superheroes_sidekick');
        const targetBase = getPromptOption(prompt, (option) => option.value?.baseIndex === 1, '助手目标基地候选');

        const chosen = runCommand(
            played.finalState,
            respondCommand(targetBase.id, '0'),
        );

        expect(chosen.success).toBe(true);

        const extraPlay = runCommand(chosen.finalState, {
            type: SU_COMMANDS.PLAY_MINION,
            playerId: '0',
            payload: { cardUid: 'small-1', baseIndex: 1 },
        });

        expect(extraPlay.success).toBe(true);
        expect(extraPlay.finalState.core.bases[1].minions.map((minion) => minion.uid)).toContain('small-1');
    });

    it('放射暴露会消灭己方目标随从，并把牌库中更高力量的随从原地额外打出', () => {
        const state = makeMatchState(makeState({
            currentPlayerIndex: 0,
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('radio-1', 'superheroes_radioactive_exposure', 'action', '0')],
                    deck: [
                        makeCard('captain-deck', 'superheroes_captain_amazing', 'minion', '0'),
                        makeCard('equal-deck', 'pirate_first_mate', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base_ninja_dojo', [
                    makeMinion('target-1', 'superheroes_mild_mannered_citizen', '0', 2),
                ]),
            ],
        }));

        const played = runCommand(state, {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'radio-1', targetBaseIndex: 0, targetMinionUid: 'target-1' },
        });

        expect(played.success).toBe(true);
        const searchPrompt = getSimpleChoicePrompt(played.finalState, 'superheroes_radioactive_exposure_search');
        expect(searchPrompt.autoResolveIfSingle).toBe(false);
        expect(getPromptOptions(searchPrompt).map((option) => option.value?.cardUid)).toEqual(['captain-deck']);
        expect(played.finalState.core.bases[0].minions).toHaveLength(0);
        expect(played.finalState.core.players['0'].deck.map((card) => card.uid)).toEqual(['captain-deck', 'equal-deck']);

        const searched = respondToPromptOption(
            played.finalState,
            option => option.value?.cardUid === 'captain-deck',
            '放射暴露选择唯一更高力量随从',
            '0',
            dummyRandom,
        );
        expect(searched.finalState.core.bases[0].minions.map((minion) => minion.uid)).toEqual(['captain-deck']);
        expect(searched.finalState.core.players['0'].deck.map((card) => card.uid)).toEqual(['equal-deck']);
        expect(searched.finalState.core.players['0'].hand.map((card) => card.uid)).toEqual([]);
    });

    it('放射暴露在没有更高力量候选时仍会消灭目标，但不会额外打出新随从', () => {
        const state = makeMatchState(makeState({
            currentPlayerIndex: 0,
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('radio-1', 'superheroes_radioactive_exposure', 'action', '0')],
                    deck: [makeCard('small-deck', 'pirate_first_mate', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base_ninja_dojo', [
                    makeMinion('target-1', 'superheroes_captain_amazing', '0', 5),
                ]),
            ],
        }));

        const played = runCommand(state, {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'radio-1', targetBaseIndex: 0, targetMinionUid: 'target-1' },
        });

        expect(played.success).toBe(true);
        expect(getOptionalSimpleChoicePrompt(played.finalState, 'superheroes_radioactive_exposure_search')).toBeUndefined();
        expect(played.finalState.core.bases[0].minions.map((minion) => minion.uid)).toEqual([]);
        expect(played.finalState.core.players['0'].deck.map((card) => card.uid)).toEqual(['small-deck']);
    });

    it('放射暴露的检索候选只包含严格更高力量的随从，不包含等于或更低者', () => {
        const state = makeMatchState(makeState({
            currentPlayerIndex: 0,
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('radio-1', 'superheroes_radioactive_exposure', 'action', '0')],
                    deck: [
                        makeCard('equal-deck', 'pirate_first_mate', 'minion', '0'),
                        makeCard('higher-deck', 'alien_invader', 'minion', '0'),
                        makeCard('highest-deck', 'superheroes_captain_amazing', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base_ninja_dojo', [
                    makeMinion('target-1', 'superheroes_mild_mannered_citizen', '0', 2),
                ]),
            ],
        }));

        const played = runCommand(state, {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'radio-1', targetBaseIndex: 0, targetMinionUid: 'target-1' },
        });

        expect(played.success).toBe(true);
        const prompt = getSimpleChoicePrompt(played.finalState, 'superheroes_radioactive_exposure_search');
        const optionUids = getPromptOptions(prompt)
            .map((option) => option.value?.cardUid)
            .filter(Boolean);

        expect(optionUids).toContain('higher-deck');
        expect(optionUids).toContain('highest-deck');
        expect(optionUids).not.toContain('equal-deck');
    });

    it('水晶堡垒会在你打出随从后让你可把弃牌堆中的一个随从放到牌库底', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    deck: [makeCard('deck-0', 'wizard_zap', 'action', '0')],
                    discard: [
                        makeCard('minion-1', 'pirate_first_mate', 'minion', '0'),
                        makeCard('action-1', 'wizard_zap', 'action', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base_crystal_fortress', [
                    makeMinion('played-1', 'superheroes_captain_amazing', '0', 5),
                ]),
            ],
        });

        const triggered = triggerBaseAbilityWithMS('base_crystal_fortress', 'onMinionPlayed', {
            state: core,
            baseIndex: 0,
            baseDefId: 'base_crystal_fortress',
            playerId: '0',
            minionUid: 'played-1',
            minionDefId: 'superheroes_captain_amazing',
            now: 1000,
        });

        const prompt = getSimpleChoicePrompt(triggered.matchState!, 'base_crystal_fortress');
        const target = getPromptOption(prompt, (option) => option.value?.cardUid === 'minion-1', '水晶堡垒候选随从');

        const resolved = respondToPromptOption(
            triggered.matchState!,
            (option) => option.id === target.id,
            '水晶堡垒候选随从',
            '0',
        );

        expect(resolved.success).toBe(true);
        expect(resolved.finalState.core.players['0'].deck.map((card) => card.uid)).toEqual(['deck-0', 'minion-1']);
        expect(resolved.finalState.core.players['0'].discard.map((card) => card.uid)).toEqual(['action-1']);
    });

    it('水晶堡垒允许跳过，不会改动牌库和弃牌堆', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    deck: [makeCard('deck-0', 'wizard_zap', 'action', '0')],
                    discard: [makeCard('minion-1', 'pirate_first_mate', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base_crystal_fortress', [
                    makeMinion('played-1', 'superheroes_captain_amazing', '0', 5),
                ]),
            ],
        });

        const triggered = triggerBaseAbilityWithMS('base_crystal_fortress', 'onMinionPlayed', {
            state: core,
            baseIndex: 0,
            baseDefId: 'base_crystal_fortress',
            playerId: '0',
            minionUid: 'played-1',
            minionDefId: 'superheroes_captain_amazing',
            now: 1000,
        });

        const resolved = respondToPromptOption(
            triggered.matchState!,
            (option) => option.value?.skip === true,
            '水晶堡垒跳过按钮',
            '0',
        );

        expect(resolved.success).toBe(true);
        expect(resolved.finalState.core.players['0'].deck.map((card) => card.uid)).toEqual(['deck-0']);
        expect(resolved.finalState.core.players['0'].discard.map((card) => card.uid)).toEqual(['minion-1']);
    });

    it('水晶堡垒在弃牌堆没有随从时不创建交互', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    discard: [makeCard('action-1', 'wizard_zap', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base_crystal_fortress', [
                    makeMinion('played-1', 'superheroes_captain_amazing', '0', 5),
                ]),
            ],
        });

        const triggered = triggerBaseAbilityWithMS('base_crystal_fortress', 'onMinionPlayed', {
            state: core,
            baseIndex: 0,
            baseDefId: 'base_crystal_fortress',
            playerId: '0',
            minionUid: 'played-1',
            minionDefId: 'superheroes_captain_amazing',
            now: 1000,
        });

        expect(triggered.events).toEqual([]);
        expect(triggered.matchState?.sys.interaction.current).toBeUndefined();
        expect(triggered.matchState?.sys.interaction.queue ?? []).toEqual([]);
    });

    it('爆发会在别的基地打出随从后让其控制者可把爆发移动过去', () => {
        const state = makeMatchState(makeState({
            currentPlayerIndex: 1,
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1', {
                    hand: [makeCard('enemy-minion-1', 'pirate_first_mate', 'minion', '1')],
                }),
            },
            bases: [
                makeBase('base_ninja_dojo', [
                    makeMinion('burst-1', 'superheroes_the_burst', '0', 5),
                ]),
                makeBase('base_pirate_cove', []),
            ],
        }));

        const played = runCommand(state, {
            type: SU_COMMANDS.PLAY_MINION,
            playerId: '1',
            payload: { cardUid: 'enemy-minion-1', baseIndex: 1 },
        });

        expect(played.success).toBe(true);
        const prompt = getSimpleChoicePrompt(played.finalState, 'superheroes_the_burst');
        const moveOption = getPromptOption(prompt, (option) => option.value?.move === true, '爆发移动按钮');

        const resolved = runCommand(played.finalState, respondCommand(moveOption.id, '0'));

        expect(resolved.success).toBe(true);
        expect(resolved.finalState.core.bases[0].minions.map((minion) => minion.uid)).toEqual([]);
        expect(resolved.finalState.core.bases[1].minions.map((minion) => minion.uid)).toEqual(['enemy-minion-1', 'burst-1']);
    });

    it('爆发在秘密基地同基地保护下点击移动仍会真实移到对手打出随从的基地', () => {
        const state = makeMatchState(makeState({
            currentPlayerIndex: 0,
            turnOrder: ['0', '1', '2'],
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('enemy-minion-1', 'huluwawa_da_wa', 'minion', '0')],
                }),
                '1': makePlayer('1'),
                '2': makePlayer('2'),
            },
            bases: [
                makeBase('base_inventors_salon', []),
                makeBase('base_crystal_fortress', []),
                makeBase('base_dragons_lair', []),
                makeBase({
                    defId: 'base_huluwawa_mountain',
                    minions: [makeMinion('burst-1', 'superheroes_the_burst', '2', 5)],
                    ongoingActions: [{ uid: 'secret-1', defId: 'superheroes_secret_base', ownerId: '2' }],
                }),
                makeBase('base_seven_colored_lotus', []),
            ],
        }));

        const played = runCommand(state, {
            type: SU_COMMANDS.PLAY_MINION,
            playerId: '0',
            payload: { cardUid: 'enemy-minion-1', baseIndex: 4 },
        });

        expect(played.success).toBe(true);
        const prompt = getSimpleChoicePrompt(played.finalState, 'superheroes_the_burst');
        expect(prompt.playerId).toBe('2');
        const moveOption = getPromptOption(prompt, (option) => option.value?.move === true, '爆发移动按钮');

        const resolved = runCommand(played.finalState, respondCommand(moveOption.id, '2'));

        expect(resolved.success).toBe(true);
        expect(resolved.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: SU_EVENTS.MINION_MOVED,
                payload: expect.objectContaining({
                    minionUid: 'burst-1',
                    fromBaseIndex: 3,
                    toBaseIndex: 4,
                    reason: 'superheroes_the_burst',
                }),
            }),
        ]));
        expect(resolved.finalState.core.bases[3].minions.map((minion) => minion.uid)).toEqual([]);
        expect(resolved.finalState.core.bases[4].minions.map((minion) => minion.uid)).toEqual(['enemy-minion-1', 'burst-1']);
    });

    it('爆发允许留在原地，不会移动自己', () => {
        const state = makeMatchState(makeState({
            currentPlayerIndex: 1,
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1', {
                    hand: [makeCard('enemy-minion-1', 'pirate_first_mate', 'minion', '1')],
                }),
            },
            bases: [
                makeBase('base_ninja_dojo', [
                    makeMinion('burst-1', 'superheroes_the_burst', '0', 5),
                ]),
                makeBase('base_pirate_cove', []),
            ],
        }));

        const played = runCommand(state, {
            type: SU_COMMANDS.PLAY_MINION,
            playerId: '1',
            payload: { cardUid: 'enemy-minion-1', baseIndex: 1 },
        });

        expect(played.success).toBe(true);
        const prompt = getSimpleChoicePrompt(played.finalState, 'superheroes_the_burst');
        const stayOption = getPromptOption(prompt, (option) => option.value?.move === false, '爆发留在原地按钮');

        const resolved = runCommand(played.finalState, respondCommand(stayOption.id, '0'));

        expect(resolved.success).toBe(true);
        expect(resolved.finalState.core.bases[0].minions.map((minion) => minion.uid)).toEqual(['burst-1']);
        expect(resolved.finalState.core.bases[1].minions.map((minion) => minion.uid)).toEqual(['enemy-minion-1']);
    });

    it('爆发在同基地打出随从时不会创建多余交互', () => {
        const state = makeMatchState(makeState({
            currentPlayerIndex: 1,
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1', {
                    hand: [makeCard('enemy-minion-1', 'pirate_first_mate', 'minion', '1')],
                }),
            },
            bases: [
                makeBase('base_ninja_dojo', [
                    makeMinion('burst-1', 'superheroes_the_burst', '0', 5),
                ]),
                makeBase('base_pirate_cove', []),
            ],
        }));

        const played = runCommand(state, {
            type: SU_COMMANDS.PLAY_MINION,
            playerId: '1',
            payload: { cardUid: 'enemy-minion-1', baseIndex: 0 },
        });

        expect(played.success).toBe(true);
        expect(getOptionalSimpleChoicePrompt(played.finalState, 'superheroes_the_burst')).toBeUndefined();
        expect(played.finalState.core.bases[0].minions.map((minion) => minion.uid)).toEqual(['burst-1', 'enemy-minion-1']);
    });

    it('温和市民会在你的回合开始时可自毁，并把牌库中力量 5+ 的随从额外打到这里', () => {
        const core = makeState({
            currentPlayerIndex: 0,
            players: {
                '0': makePlayer('0', {
                    deck: [
                        makeCard('captain-deck', 'superheroes_captain_amazing', 'minion', '0'),
                        makeCard('burst-deck', 'superheroes_the_burst', 'minion', '0'),
                        makeCard('small-deck', 'pirate_first_mate', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base_ninja_dojo', [
                    makeMinion('citizen-1', 'superheroes_mild_mannered_citizen', '0', 2),
                ]),
            ],
        });
        const matchState = makeMatchState(core);
        matchState.sys.phase = 'startTurn';

        const triggered = fireTriggers(core, 'onTurnStart', {
            state: core,
            matchState,
            playerId: '0',
            random: dummyRandom,
            now: 1000,
        });

        const confirmPrompt = getSimpleChoicePrompt(triggered.matchState!, 'superheroes_mild_mannered_citizen');
        const destroyOption = getPromptOption(confirmPrompt, (option) => option.value?.destroy === true, '温和市民自毁按钮');

        const afterDestroyChoice = respondToPromptOption(
            triggered.matchState!,
            (option) => option.id === destroyOption.id,
            '温和市民自毁按钮',
            '0',
            dummyRandom,
        );

        expect(afterDestroyChoice.success).toBe(true);
        expect(afterDestroyChoice.finalState.core.bases[0].minions.map((minion) => minion.uid)).not.toContain('citizen-1');

        const searchPrompt = getSimpleChoicePrompt(afterDestroyChoice.finalState, 'superheroes_mild_mannered_citizen_search');
        const burstOption = getPromptOption(searchPrompt, (option) => option.value?.cardUid === 'burst-deck', '温和市民检索爆发');

        const resolved = respondToPromptOption(
            afterDestroyChoice.finalState,
            (option) => option.id === burstOption.id,
            '温和市民检索爆发',
            '0',
            dummyRandom,
        );

        expect(resolved.success).toBe(true);
        expect(resolved.finalState.core.bases[0].minions.map((minion) => minion.uid)).toEqual(['burst-deck']);
        expect(resolved.finalState.core.players['0'].deck.map((card) => card.uid)).toEqual(['captain-deck', 'small-deck']);
        expect(resolved.finalState.core.players['0'].hand.map((card) => card.uid)).toEqual([]);
    });

    it('温和市民允许在回合开始时跳过，不会自毁或创建后续检索交互', () => {
        const core = makeState({
            currentPlayerIndex: 0,
            players: {
                '0': makePlayer('0', {
                    deck: [makeCard('captain-deck', 'superheroes_captain_amazing', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base_ninja_dojo', [
                    makeMinion('citizen-1', 'superheroes_mild_mannered_citizen', '0', 2),
                ]),
            ],
        });
        const matchState = makeMatchState(core);
        matchState.sys.phase = 'startTurn';

        const triggered = fireTriggers(core, 'onTurnStart', {
            state: core,
            matchState,
            playerId: '0',
            random: dummyRandom,
            now: 1000,
        });

        const resolved = respondToPromptOption(
            triggered.matchState!,
            (option) => option.value?.destroy === false,
            '温和市民跳过按钮',
            '0',
            dummyRandom,
        );

        expect(resolved.success).toBe(true);
        expect(resolved.finalState.core.bases[0].minions.map((minion) => minion.uid)).toEqual(['citizen-1']);
        expect(getOptionalSimpleChoicePrompt(resolved.finalState, 'superheroes_mild_mannered_citizen_search')).toBeUndefined();
    });

    it('超赞男会让其他玩家的真实消灭行动无法选择同基地己方受保护随从', () => {
        const ally = makeMinion('ally-1', 'pirate_first_mate', '0', 3);
        const awesomeGuy = makeMinion('awesome-1', 'superheroes_awesome_guy', '0', 5);
        const enemy = makeMinion('enemy-1', 'dragons_hatchling', '1', 2);
        const enemyTwo = makeMinion('enemy-2', 'sharks_mako', '1', 3);
        const state = makeMatchState(makeState({
            currentPlayerIndex: 1,
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1', {
                    hand: [makeCard('torn-1', 'sharks_torn_apart', 'action', '1')],
                    deck: [makeCard('draw-1', 'sharks_mako', 'minion', '1')],
                }),
            },
            bases: [
                makeBase('base_ninja_dojo', [awesomeGuy, ally, enemy, enemyTwo]),
            ],
        }));
        const core = state.core;

        expect(isMinionProtected(core, ally, 0, '1', 'destroy')).toBe(true);
        expect(isMinionProtected(core, awesomeGuy, 0, '1', 'destroy')).toBe(true);
        expect(isMinionProtected(core, enemy, 0, '0', 'destroy')).toBe(false);
        expect(isMinionProtected(core, enemyTwo, 0, '0', 'destroy')).toBe(false);

        const played = runCommand(state, {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '1',
            payload: { cardUid: 'torn-1' },
        });

        expect(played.success).toBe(true);
        const prompt = getSimpleChoicePrompt(played.finalState, 'sharks_torn_apart');
        const optionUids = getPromptOptions(prompt)
            .map((option) => option.value?.minionUid)
            .filter(Boolean);

        expect(optionUids).not.toContain('ally-1');
        const target = getPromptOption(prompt, (option) => option.value?.minionUid === 'enemy-1', '撕裂未受保护目标');
        const resolved = respondToPromptOption(
            played.finalState,
            (option) => option.id === target.id,
            '撕裂未受保护目标',
            '1',
        );

        expect(resolved.success).toBe(true);
        const finalMinionUids = resolved.finalState.core.bases[0].minions.map((minion) => minion.uid);
        expect(finalMinionUids).toContain('ally-1');
        expect(finalMinionUids).toContain('awesome-1');
        expect(finalMinionUids).not.toContain('enemy-1');
    });

    it('强化能力会给附着随从 +1 力量，并保护其不被其他玩家消灭', () => {
        const boosted = makeMinion('boosted-1', 'pirate_first_mate', '0', 3, {
            attachedActions: [{ uid: 'exp-1', defId: 'superheroes_expanded_power', ownerId: '0' }],
        });
        const core = makeState({
            bases: [
                makeBase('base_ninja_dojo', [boosted]),
            ],
        });

        expect(getEffectivePower(core, boosted, 0)).toBe(4);
        expect(isMinionProtected(core, boosted, 0, '1', 'destroy')).toBe(true);
        expect(isMinionProtected(core, boosted, 0, '0', 'destroy')).toBe(false);
    });

    it('秘密基地会保护这里你力量 3 或以下的随从，但不保护更高力量或对手随从', () => {
        const weakAlly = makeMinion('weak-1', 'pirate_first_mate', '0', 3);
        const strongAlly = makeMinion('strong-1', 'superheroes_captain_amazing', '0', 5);
        const enemy = makeMinion('enemy-1', 'dragons_hatchling', '1', 2);
        const core = makeState({
            bases: [
                makeBase({
                    defId: 'base_ninja_dojo',
                    minions: [weakAlly, strongAlly, enemy],
                    ongoingActions: [{ uid: 'secret-1', defId: 'superheroes_secret_base', ownerId: '0' }],
                }),
            ],
        });

        expect(isMinionProtected(core, weakAlly, 0, '1', 'destroy')).toBe(true);
        expect(isMinionProtected(core, strongAlly, 0, '1', 'destroy')).toBe(false);
        expect(isMinionProtected(core, enemy, 0, '0', 'destroy')).toBe(false);
    });

    it('改造洞穴会保护这里力量 2 或以下的随从不被非控制者消灭', () => {
        const weak = makeMinion('weak-1', 'pirate_first_mate', '0', 2);
        const strong = makeMinion('strong-1', 'alien_invader', '0', 3);
        const core = makeState({
            bases: [
                makeBase('base_converted_cave', [weak, strong]),
            ],
        });

        expect(isMinionProtected(core, weak, 0, '1', 'destroy')).toBe(true);
        expect(isMinionProtected(core, weak, 0, '0', 'destroy')).toBe(false);
        expect(isMinionProtected(core, strong, 0, '1', 'destroy')).toBe(false);
    });
});
