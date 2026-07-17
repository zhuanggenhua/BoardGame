import { beforeEach, describe, expect, it } from 'vitest';

import { initAllAbilities, resetAbilityInit } from '../../abilities';
import { postProcessSystemEvents, SU_EVENTS } from '../../domain';
import { clearRegistry } from '../../domain/abilityRegistry';
import { buildMinionTargetOptions } from '../../domain/abilityHelpers';
import { clearBaseAbilityRegistry } from '../../domain/baseAbilities';
import { isMinionProtected } from '../../domain/ongoingEffects';
import { getEffectivePower } from '../../domain/ongoingModifiers';
import { hasCardActivatableAbility } from '../../domain/activationMetadata';
import { SU_COMMANDS } from '../../domain/types';
import {
    applyEvents,
    getPromptOptionsGenerator,
    getPromptOptions,
    getPromptsBySourceId,
    getReactionPrompt,
    getReactionPromptOptionBySourceDefId,
    getPromptTitle,
    getSimpleChoicePrompt,
    makeBase,
    makeCard,
    makeMatchState,
    makeMinion,
    makePlayer,
    makeState,
    respondToPrompt,
    respondToPromptOptions,
    triggerBaseAbilityWithMS,
} from '../helpers';
import { runCommand } from '../testRunner';

const fixedRandom = {
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

describe('极客派系隐藏实现批', () => {
    it('粉丝会暴露为仅限出牌阶段的手牌 special 入口', () => {
        expect(hasCardActivatableAbility('geeks_fan', {
            kind: 'special',
            zone: 'hand',
            window: 'playCards',
        })).toBe(true);
        expect(hasCardActivatableAbility('geeks_fan', {
            kind: 'special',
            zone: 'hand',
            window: 'beforeScoring',
        })).toBe(false);
    });

    it('粉丝可在你的回合从手牌弃掉并摸 1 张牌', () => {
        const state = makeMatchState(makeState({
            currentPlayerIndex: 0,
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('fan-1', 'geeks_fan', 'minion', '0')],
                    deck: [makeCard('draw-1', 'wizard_zap', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_a', [])],
        }));

        const activated = runCommand(state, {
            type: SU_COMMANDS.ACTIVATE_SPECIAL,
            playerId: '0',
            payload: { handCardUid: 'fan-1', baseIndex: 0 },
        });

        expect(activated.success).toBe(true);
        expect(activated.finalState.core.players['0'].hand.map((card) => card.uid)).toEqual(['draw-1']);
        expect(activated.finalState.core.players['0'].discard.map((card) => card.uid)).toEqual(['fan-1']);
        expect(activated.finalState.core.players['0'].minionsPlayed).toBe(0);
        expect(activated.finalState.core.players['0'].actionsPlayed).toBe(0);
    });

    it('菲丽希亚会把其他基地上的所有随从同时移动到自己这里', () => {
        const state = makeMatchState(makeState({
            currentPlayerIndex: 0,
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('felicia-1', 'geeks_felicia_day', 'minion', '0')],
                }),
                '1': makePlayer('1'),
                '2': makePlayer('2'),
            },
            turnOrder: ['0', '1', '2'],
            bases: [
                makeBase('base_a', []),
                makeBase('base_b', [
                    makeMinion('enemy-1', 'alien_invader', '1', 3),
                ]),
                makeBase('base_c', [
                    makeMinion('ally-1', 'pirate_first_mate', '0', 2),
                    makeMinion('enemy-2', 'wizard_apprentice', '2', 2),
                ]),
            ],
        }));

        const played = runCommand(state, {
            type: SU_COMMANDS.PLAY_MINION,
            playerId: '0',
            payload: { cardUid: 'felicia-1', baseIndex: 0 },
        });

        expect(played.success).toBe(true);
        expect(played.finalState.core.bases[0].minions.map((minion) => minion.uid)).toEqual([
            'felicia-1',
            'enemy-1',
            'ally-1',
            'enemy-2',
        ]);
        expect(played.finalState.core.bases[1].minions).toHaveLength(0);
        expect(played.finalState.core.bases[2].minions).toHaveLength(0);
    });

    it('菲丽希亚的同批移动不会让组内的幼熊斥候去消灭同批移入的弱随从', () => {
        const state = makeMatchState(makeState({
            currentPlayerIndex: 0,
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('felicia-1', 'geeks_felicia_day', 'minion', '0')],
                }),
                '1': makePlayer('1'),
                '2': makePlayer('2'),
            },
            turnOrder: ['0', '1', '2'],
            bases: [
                makeBase('base_a', []),
                makeBase('base_b', [
                    makeMinion('scout-1', 'bear_cavalry_cub_scout', '1', 3),
                ]),
                makeBase('base_c', [
                    makeMinion('weak-1', 'geeks_fan', '2', 2),
                ]),
            ],
        }));

        const played = runCommand(state, {
            type: SU_COMMANDS.PLAY_MINION,
            playerId: '0',
            payload: { cardUid: 'felicia-1', baseIndex: 0 },
        });

        expect(played.success).toBe(true);
        expect(played.finalState.core.bases[0].minions.map((minion) => minion.uid)).toEqual([
            'felicia-1',
            'scout-1',
            'weak-1',
        ]);
        expect(played.finalState.core.players['2'].discard.map((card) => card.uid)).not.toContain('weak-1');
    });

    it('菲丽希亚把敌方帝国龙一起移走时，帝国龙只会因自己的那次移动摸 1 张牌', () => {
        const state = makeMatchState(makeState({
            currentPlayerIndex: 0,
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('felicia-1', 'geeks_felicia_day', 'minion', '0')],
                }),
                '1': makePlayer('1', {
                    deck: [
                        makeCard('draw-1', 'wizard_zap', 'action', '1'),
                        makeCard('draw-2', 'pirate_broadside', 'action', '1'),
                    ],
                }),
                '2': makePlayer('2'),
            },
            turnOrder: ['0', '1', '2'],
            bases: [
                makeBase('base_a', []),
                makeBase('base_b', [
                    makeMinion('dragon-1', 'dragons_imperial_dragon', '1', 5),
                ]),
                makeBase('base_c', [
                    makeMinion('other-1', 'alien_invader', '2', 3),
                ]),
            ],
        }));

        const played = runCommand(state, {
            type: SU_COMMANDS.PLAY_MINION,
            playerId: '0',
            payload: { cardUid: 'felicia-1', baseIndex: 0 },
        });

        expect(played.success).toBe(true);
        expect(played.finalState.core.players['1'].hand.map((card) => card.uid)).toEqual(['draw-1']);
        expect(played.finalState.core.players['1'].deck.map((card) => card.uid)).toEqual(['draw-2']);
    });

    it('禁卡表会先命名再看手牌，并把该玩家手里的所有同名牌放到底牌', () => {
        const state = makeMatchState(makeState({
            currentPlayerIndex: 0,
            players: {
                '0': makePlayer('0', {
                    factions: ['geeks', 'wizards'],
                    hand: [makeCard('banned-1', 'geeks_banned_list', 'action', '0')],
                }),
                '1': makePlayer('1', {
                    factions: ['aliens', 'pirates'],
                    hand: [
                        makeCard('collector-a', 'alien_collector', 'minion', '1'),
                        makeCard('collector-b', 'alien_collector_pod', 'minion', '1'),
                        makeCard('other-a', 'wizard_zap', 'action', '1'),
                    ],
                    deck: [makeCard('p1-deck-1', 'pirate_first_mate', 'minion', '1')],
                }),
                '2': makePlayer('2', {
                    hand: [makeCard('p2-hand-1', 'pirate_broadside', 'action', '2')],
                }),
            },
            turnOrder: ['0', '1', '2'],
            bases: [makeBase('base_a', [])],
        }));

        const played = runCommand(state, {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'banned-1' },
        });

        const firstPrompt = getSimpleChoicePrompt(played.finalState, 'geeks_banned_list');
        expect(getPromptTitle(firstPrompt)).toContain('玩家二');
        const collectorOption = firstPrompt.options.find((option: any) => option.value?.defId === 'alien_collector');
        expect(collectorOption).toBeTruthy();

        const afterFirstResolve = respondToPrompt(played.finalState, collectorOption.id, '0', fixedRandom as any);
        expect(afterFirstResolve.events.some((event: any) => event.type === SU_EVENTS.REVEAL_HAND)).toBe(true);
        expect(afterFirstResolve.finalState.core.players['1'].hand.map((card) => card.uid)).toEqual(['other-a']);
        expect(afterFirstResolve.finalState.core.players['1'].deck.map((card) => card.uid)).toEqual([
            'p1-deck-1',
            'collector-a',
            'collector-b',
        ]);

        const secondPrompt = getSimpleChoicePrompt(afterFirstResolve.finalState, 'geeks_banned_list');
        expect(getPromptTitle(secondPrompt)).toContain('玩家三');
        const missOption = secondPrompt.options.find((option: any) => option.value?.defId && option.value.defId !== 'pirate_broadside');
        expect(missOption).toBeTruthy();

        const resolved = respondToPrompt(afterFirstResolve.finalState, missOption.id, '0', fixedRandom as any);
        expect(resolved.events.some((event: any) => event.type === SU_EVENTS.REVEAL_HAND)).toBe(true);
        expect(resolved.finalState.core.players['2'].hand.map((card) => card.uid)).toEqual(['p2-hand-1']);
        expect(resolved.finalState.core.players['2'].deck).toHaveLength(0);
    });

    it('禁卡表只提供当前对局已选派系的卡牌候选，并使用卡图模式', () => {
        const state = makeMatchState(makeState({
            currentPlayerIndex: 0,
            players: {
                '0': makePlayer('0', {
                    factions: ['geeks', 'wizards'],
                    hand: [makeCard('banned-1', 'geeks_banned_list', 'action', '0')],
                }),
                '1': makePlayer('1', {
                    factions: ['aliens', 'pirates'],
                    hand: [makeCard('collector-a', 'alien_collector', 'minion', '1')],
                }),
            },
            turnOrder: ['0', '1'],
            bases: [makeBase('base_a', [])],
        }));

        const played = runCommand(state, {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'banned-1' },
        });

        const prompt = getSimpleChoicePrompt(played.finalState, 'geeks_banned_list');
        expect(prompt?.targetType).toBe('generic');

        const optionValues = (prompt?.options ?? []).map((option: any) => option.value?.defId).filter(Boolean);
        expect(optionValues).toContain('alien_collector');
        expect(optionValues).toContain('pirate_first_mate');
        expect(optionValues).toContain('wizard_scry');
        expect(optionValues).toContain('geeks_banned_list');
        expect(optionValues).not.toContain('zombie_walker');

        const collectorOption = prompt?.options.find((option: any) => option.value?.defId === 'alien_collector');
        expect(collectorOption?.displayMode).toBe('card');
    });

    it('禁卡表会跳过手牌为空的对手，直接处理下一位', () => {
        const state = makeMatchState(makeState({
            currentPlayerIndex: 0,
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('banned-1', 'geeks_banned_list', 'action', '0')],
                }),
                '1': makePlayer('1'),
                '2': makePlayer('2', {
                    hand: [makeCard('p2-hand-1', 'wizard_zap', 'action', '2')],
                }),
            },
            turnOrder: ['0', '1', '2'],
            bases: [makeBase('base_a', [])],
        }));

        const played = runCommand(state, {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'banned-1' },
        });

        const prompt = getSimpleChoicePrompt(played.finalState, 'geeks_banned_list');
        expect(getPromptTitle(prompt)).toContain('玩家三');
    });

    it('平衡可以查看对手手牌后选择跳过，跳过后不会转移或打出任何牌', () => {
        const state = makeMatchState(makeState({
            currentPlayerIndex: 0,
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('minmax-1', 'geeks_min_maxing', 'action', '0')],
                }),
                '1': makePlayer('1', {
                    hand: [makeCard('justice-1', 'superheroes_justice_friends', 'action', '1')],
                }),
            },
            bases: [makeBase('base_a', [])],
        }));

        const played = runCommand(state, {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'minmax-1' },
        });

        const prompt = getSimpleChoicePrompt(played.finalState, 'geeks_min_maxing_action');
        expect(prompt).toBeTruthy();
        expect(prompt?.targetType).toBe('generic');
        const resolved = respondToPrompt(played.finalState, 'skip', '0', fixedRandom as any);

        expect(resolved.finalState.core.players['1'].hand.map((card) => card.uid)).toEqual(['justice-1']);
        expect(resolved.finalState.core.players['0'].hand).toHaveLength(0);
        expect(resolved.finalState.core.players['0'].discard.map((card) => card.uid)).toEqual(['minmax-1']);
        expect(resolved.finalState.core.players['1'].discard).toHaveLength(0);
    });

    it('平衡可从对手手牌额外打出无目标行动，并在结算后进入拥有者弃牌堆', () => {
        const state = makeMatchState(makeState({
            currentPlayerIndex: 0,
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('minmax-1', 'geeks_min_maxing', 'action', '0')],
                }),
                '1': makePlayer('1', {
                    hand: [makeCard('justice-1', 'superheroes_justice_friends', 'action', '1')],
                }),
            },
            bases: [makeBase('base_a', [
                makeMinion('dragon-1', 'dragons_imperial_dragon', '0', 5),
            ])],
        }));

        const played = runCommand(state, {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'minmax-1' },
        });

        const prompt = getSimpleChoicePrompt(played.finalState, 'geeks_min_maxing_action');
        expect(prompt?.targetType).toBe('generic');
        const justiceOption = prompt.options.find((option: any) => option.value?.cardUid === 'justice-1');
        expect(justiceOption).toBeTruthy();

        const resolved = respondToPrompt(played.finalState, justiceOption.id, '0', fixedRandom as any);
        const dragon = resolved.finalState.core.bases[0].minions.find((minion) => minion.uid === 'dragon-1')!;

        expect(getEffectivePower(resolved.finalState.core, dragon, 0)).toBe(7);
        expect(resolved.finalState.core.players['1'].hand).toHaveLength(0);
        expect(resolved.finalState.core.players['1'].discard.map((card) => card.uid)).toEqual(['justice-1']);
        expect(resolved.finalState.core.players['0'].discard.map((card) => card.uid)).toEqual(['minmax-1']);
    });

    it('平衡可从对手手牌额外打出附着到随从的行动，并按当前玩家身份生效', () => {
        const state = makeMatchState(makeState({
            currentPlayerIndex: 0,
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('minmax-1', 'geeks_min_maxing', 'action', '0')],
                }),
                '1': makePlayer('1', {
                    hand: [makeCard('expand-1', 'superheroes_expanded_power', 'action', '1')],
                }),
            },
            bases: [makeBase('base_a', [
                makeMinion('fan-1', 'geeks_fan', '0', 2),
            ])],
        }));

        const played = runCommand(state, {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'minmax-1' },
        });

        const actionPrompt = getSimpleChoicePrompt(played.finalState, 'geeks_min_maxing_action');
        expect(actionPrompt?.targetType).toBe('generic');
        const expandOption = actionPrompt.options.find((option: any) => option.value?.cardUid === 'expand-1');
        expect(expandOption).toBeTruthy();

        const afterActionChoice = respondToPrompt(played.finalState, expandOption.id, '0', fixedRandom as any);
        const minionPrompt = getSimpleChoicePrompt(afterActionChoice.finalState, 'geeks_min_maxing_minion');
        const fanOption = minionPrompt.options.find((option: any) => option.value?.minionUid === 'fan-1' || option.value?.uid === 'fan-1');
        expect(fanOption).toBeTruthy();

        const resolved = respondToPrompt(afterActionChoice.finalState, fanOption.id, '0', fixedRandom as any);
        const fan = resolved.finalState.core.bases[0].minions.find((minion) => minion.uid === 'fan-1')!;

        expect(getEffectivePower(resolved.finalState.core, fan, 0)).toBe(3);
        expect(fan.attachedActions.map((action) => action.uid)).toEqual(['expand-1']);
        expect(isMinionProtected(resolved.finalState.core, fan, 0, '1', 'destroy')).toBe(true);
        expect(resolved.finalState.core.players['1'].hand).toHaveLength(0);
        expect(resolved.finalState.core.players['1'].discard).toHaveLength(0);
    });

    it('无限循环可额外打出无目标标准行动，并在结算后再选择是否收入手牌', () => {
        const state = makeMatchState(makeState({
            currentPlayerIndex: 0,
            players: {
                '0': makePlayer('0', {
                    hand: [
                        makeCard('loop-1', 'geeks_non_infinite_loop', 'action', '0'),
                        makeCard('justice-1', 'superheroes_justice_friends', 'action', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_a', [
                makeMinion('dragon-1', 'dragons_imperial_dragon', '0', 5),
            ])],
        }));

        const played = runCommand(state, {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'loop-1' },
        });

        const actionPrompt = getSimpleChoicePrompt(played.finalState, 'geeks_non_infinite_loop_action');
        const justiceOption = actionPrompt.options.find((option: any) => option.value?.cardUid === 'justice-1');
        expect(justiceOption).toBeTruthy();

        const afterPlay = respondToPrompt(played.finalState, justiceOption.id, '0', fixedRandom as any);
        expect(afterPlay.success).toBe(true);
        expect(afterPlay.finalState.core.players['0'].discard.map((card) => card.uid)).toEqual(['loop-1', 'justice-1']);

        const returnPrompt = getSimpleChoicePrompt(afterPlay.finalState, 'geeks_non_infinite_loop_return');
        expect(getPromptTitle(returnPrompt)).toBe('ui.geeks_non_infinite_loop_return_title');
        expect(returnPrompt.titleKey).toBe('ui.geeks_non_infinite_loop_return_title');
        expect(returnPrompt.titleParams).toEqual(expect.objectContaining({ actionName: expect.any(String) }));

        const returned = respondToPrompt(afterPlay.finalState, 'return', '0', fixedRandom as any);
        expect(returned.finalState.core.players['0'].hand.map((card) => card.uid)).toEqual(['justice-1']);
        expect(returned.finalState.core.players['0'].discard.map((card) => card.uid)).toEqual(['loop-1']);
    });

    it('无限循环打出会自己创建 prompt 的标准行动时，会先完成该行动交互再出现回手提示', () => {
        const state = makeMatchState(makeState({
            currentPlayerIndex: 0,
            players: {
                '0': makePlayer('0', {
                    hand: [
                        makeCard('loop-1', 'geeks_non_infinite_loop', 'action', '0'),
                        makeCard('banned-1', 'geeks_banned_list', 'action', '0'),
                    ],
                }),
                '1': makePlayer('1', {
                    hand: [makeCard('target-1', 'wizard_zap', 'action', '1')],
                }),
            },
            turnOrder: ['0', '1'],
            bases: [makeBase('base_a', [])],
        }));

        const played = runCommand(state, {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'loop-1' },
        });

        const actionPrompt = getSimpleChoicePrompt(played.finalState, 'geeks_non_infinite_loop_action');
        const bannedOption = actionPrompt.options.find((option: any) => option.value?.cardUid === 'banned-1');
        expect(bannedOption).toBeTruthy();

        const afterPlay = respondToPrompt(played.finalState, bannedOption.id, '0', fixedRandom as any);
        expect(getSimpleChoicePrompt(afterPlay.finalState, 'geeks_banned_list')).toBeTruthy();
        expect(getPromptsBySourceId(afterPlay.finalState, 'geeks_non_infinite_loop_return')).toHaveLength(1);

        const bannedPrompt = getSimpleChoicePrompt(afterPlay.finalState, 'geeks_banned_list');
        const missOption = bannedPrompt.options.find((option: any) => option.value?.defId && option.value.defId !== 'wizard_zap');
        expect(missOption).toBeTruthy();

        const afterBannedResolve = respondToPrompt(afterPlay.finalState, missOption.id, '0', fixedRandom as any);
        expect(afterBannedResolve.finalState.core.players['1'].hand.map((card) => card.uid)).toEqual(['target-1']);

        const returnPrompt = getSimpleChoicePrompt(afterBannedResolve.finalState, 'geeks_non_infinite_loop_return');
        expect(returnPrompt).toBeTruthy();

        const returned = respondToPrompt(afterBannedResolve.finalState, 'return', '0', fixedRandom as any);
        expect(returned.finalState.core.players['0'].hand.map((card) => card.uid)).toEqual(['banned-1']);
        expect(returned.finalState.core.players['0'].discard.map((card) => card.uid)).toEqual(['loop-1']);
    });

    it('控制仆从正常打出后会取得目标随从控制权，并在回合结束恢复', () => {
        const state = makeMatchState(makeState({
            currentPlayerIndex: 0,
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('control-1', 'geeks_control_minion', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            bases: [makeBase('base_a', [
                makeMinion('enemy-1', 'alien_invader', '1', 3),
            ])],
        }));

        const played = runCommand(state, {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'control-1', targetBaseIndex: 0, targetMinionUid: 'enemy-1' },
        });

        expect(played.success).toBe(true);
        expect(played.finalState.core.bases[0].minions.find((minion) => minion.uid === 'enemy-1')?.controller).toBe('0');
        expect(played.finalState.core.players['0'].discard.map((card) => card.uid)).toContain('control-1');

        const restoredCore = applyEvents(played.finalState.core, [{
            type: SU_EVENTS.TURN_ENDED,
            payload: { playerId: '0', nextPlayerIndex: 1 },
            timestamp: 1200,
        } as any]);

        expect(restoredCore.bases[0].minions.find((minion) => minion.uid === 'enemy-1')?.controller).toBe('1');
    });

    it('控制仆从会在其他玩家打出随从后作为手牌 special 触发，并在该回合结束时归还控制权', () => {
        const state = makeMatchState(makeState({
            currentPlayerIndex: 1,
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('control-1', 'geeks_control_minion', 'action', '0')],
                }),
                '1': makePlayer('1', {
                    hand: [makeCard('fan-1', 'geeks_fan', 'minion', '1')],
                }),
            },
            turnOrder: ['0', '1'],
            bases: [makeBase('base_a', [])],
        }));

        const playedMinion = runCommand(state, {
            type: SU_COMMANDS.PLAY_MINION,
            playerId: '1',
            payload: { cardUid: 'fan-1', baseIndex: 0 },
        });

        expect(playedMinion.success).toBe(true);
        const reactionPrompt = getReactionPrompt(playedMinion.finalState);
        const reactionOption = getReactionPromptOptionBySourceDefId(playedMinion.finalState, reactionPrompt, 'geeks_control_minion');
        const reactionResolved = respondToPrompt(playedMinion.finalState, reactionOption.id, '0', fixedRandom as any);

        const prompt = getSimpleChoicePrompt(reactionResolved.finalState, 'geeks_control_minion_triggered');
        expect(prompt).toBeTruthy();

        const resolved = respondToPrompt(reactionResolved.finalState, 'play', '0', fixedRandom as any);
        expect(resolved.finalState.core.bases[0].minions.find((minion) => minion.uid === 'fan-1')?.controller).toBe('0');
        expect(resolved.finalState.core.players['0'].discard.map((card) => card.uid)).toContain('control-1');

        const restoredCore = applyEvents(resolved.finalState.core, [{
            type: SU_EVENTS.TURN_ENDED,
            payload: { playerId: '1', nextPlayerIndex: 0 },
            timestamp: 1300,
        } as any]);

        expect(restoredCore.bases[0].minions.find((minion) => minion.uid === 'fan-1')?.controller).toBe('1');
    });

    it('维尔的力量会在对手打出标准行动时作为 special 使其无效', () => {
        const state = makeMatchState(makeState({
            currentPlayerIndex: 0,
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('justice-1', 'superheroes_justice_friends', 'action', '0')],
                }),
                '1': makePlayer('1', {
                    hand: [makeCard('force-1', 'geeks_force_of_wil', 'action', '1')],
                }),
            },
            turnOrder: ['0', '1'],
            bases: [makeBase('base_a', [
                makeMinion('dragon-1', 'dragons_imperial_dragon', '0', 5),
            ])],
        }));

        const played = runCommand(state, {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'justice-1' },
        });

        const counterPrompt = getSimpleChoicePrompt(played.finalState, 'smashup_action_counter_choose');
        const forceOption = counterPrompt.options.find((option: any) => option.value?.cardUid === 'force-1');
        expect(forceOption).toBeTruthy();

        const resolved = respondToPrompt(played.finalState, forceOption.id, '1', fixedRandom as any);
        const dragon = resolved.finalState.core.bases[0].minions.find((minion) => minion.uid === 'dragon-1')!;

        expect(getEffectivePower(resolved.finalState.core, dragon, 0)).toBe(5);
        expect(resolved.finalState.core.players['0'].discard.map((card) => card.uid)).toEqual(['justice-1']);
        expect(resolved.finalState.core.players['1'].discard.map((card) => card.uid)).toEqual(['force-1']);
    });

    it('维尔的力量使 ongoing 行动无效时，会阻止附着并把该行动送入拥有者弃牌堆', () => {
        const state = makeMatchState(makeState({
            currentPlayerIndex: 0,
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('expand-1', 'superheroes_expanded_power', 'action', '0')],
                }),
                '1': makePlayer('1', {
                    hand: [makeCard('force-1', 'geeks_force_of_wil', 'action', '1')],
                }),
            },
            turnOrder: ['0', '1'],
            bases: [makeBase('base_a', [
                makeMinion('fan-1', 'geeks_fan', '0', 2),
            ])],
        }));

        const played = runCommand(state, {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'expand-1', targetBaseIndex: 0, targetMinionUid: 'fan-1' },
        });

        const counterPrompt = getSimpleChoicePrompt(played.finalState, 'smashup_action_counter_choose');
        const forceOption = counterPrompt.options.find((option: any) => option.value?.cardUid === 'force-1');
        expect(forceOption).toBeTruthy();

        const resolved = respondToPrompt(played.finalState, forceOption.id, '1', fixedRandom as any);
        const fan = resolved.finalState.core.bases[0].minions.find((minion) => minion.uid === 'fan-1')!;

        expect(getEffectivePower(resolved.finalState.core, fan, 0)).toBe(2);
        expect(fan.attachedActions).toHaveLength(0);
        expect(resolved.finalState.core.players['0'].discard.map((card) => card.uid)).toEqual(['expand-1']);
        expect(resolved.finalState.core.players['1'].discard.map((card) => card.uid)).toEqual(['force-1']);
    });

    it('维尔会在对手打出行动时作为手牌 special 打到你选的基地，并让该行动无效', () => {
        const state = makeMatchState(makeState({
            currentPlayerIndex: 0,
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('justice-1', 'superheroes_justice_friends', 'action', '0')],
                }),
                '1': makePlayer('1', {
                    hand: [makeCard('wil-1', 'geeks_wil_wheaton', 'minion', '1')],
                }),
            },
            turnOrder: ['0', '1'],
            bases: [
                makeBase('base_a', [
                    makeMinion('dragon-1', 'dragons_imperial_dragon', '0', 5),
                ]),
                makeBase('base_b', []),
            ],
        }));

        const played = runCommand(state, {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'justice-1' },
        });

        const counterPrompt = getSimpleChoicePrompt(played.finalState, 'smashup_action_counter_choose');
        const wilOption = counterPrompt.options.find((option: any) => option.value?.cardUid === 'wil-1');
        expect(wilOption).toBeTruthy();

        const afterWilChoice = respondToPrompt(played.finalState, wilOption.id, '1', fixedRandom as any);
        const basePrompt = getSimpleChoicePrompt(afterWilChoice.finalState, 'smashup_action_counter_wil_base');
        const baseOption = basePrompt.options.find((option: any) => option.value?.baseIndex === 1);
        expect(baseOption).toBeTruthy();

        const resolved = respondToPrompt(afterWilChoice.finalState, baseOption.id, '1', fixedRandom as any);
        const dragon = resolved.finalState.core.bases[0].minions.find((minion) => minion.uid === 'dragon-1')!;

        expect(getEffectivePower(resolved.finalState.core, dragon, 0)).toBe(5);
        expect(resolved.finalState.core.bases[1].minions.map((minion) => minion.uid)).toEqual(['wil-1']);
        expect(resolved.finalState.core.players['1'].minionsPlayed).toBe(0);
        expect(resolved.finalState.core.players['0'].discard.map((card) => card.uid)).toEqual(['justice-1']);
    });

    it('维尔的力量可以反制另一张维尔的力量，被反制后的原行动会继续正常结算', () => {
        const state = makeMatchState(makeState({
            currentPlayerIndex: 0,
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('justice-1', 'superheroes_justice_friends', 'action', '0')],
                }),
                '1': makePlayer('1', {
                    hand: [makeCard('force-1', 'geeks_force_of_wil', 'action', '1')],
                }),
                '2': makePlayer('2', {
                    hand: [makeCard('force-2', 'geeks_force_of_wil', 'action', '2')],
                }),
            },
            turnOrder: ['0', '1', '2'],
            bases: [makeBase('base_a', [
                makeMinion('dragon-1', 'dragons_imperial_dragon', '0', 5),
            ])],
        }));

        const played = runCommand(state, {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'justice-1' },
        });

        const firstCounterPrompt = getSimpleChoicePrompt(played.finalState, 'smashup_action_counter_choose');
        const forceOneOption = firstCounterPrompt.options.find((option: any) => option.value?.cardUid === 'force-1');
        expect(forceOneOption).toBeTruthy();

        const afterForceOne = respondToPrompt(played.finalState, forceOneOption.id, '1', fixedRandom as any);
        const secondCounterPrompt = getSimpleChoicePrompt(afterForceOne.finalState, 'smashup_action_counter_choose');
        const forceTwoOption = secondCounterPrompt.options.find((option: any) => option.value?.cardUid === 'force-2');
        expect(forceTwoOption).toBeTruthy();

        const resolved = respondToPrompt(afterForceOne.finalState, forceTwoOption.id, '2', fixedRandom as any);
        const dragon = resolved.finalState.core.bases[0].minions.find((minion) => minion.uid === 'dragon-1')!;

        expect(getEffectivePower(resolved.finalState.core, dragon, 0)).toBe(7);
        expect(resolved.finalState.core.players['0'].discard.map((card) => card.uid)).toEqual(['justice-1']);
        expect(resolved.finalState.core.players['1'].discard.map((card) => card.uid)).toEqual(['force-1']);
        expect(resolved.finalState.core.players['2'].discard.map((card) => card.uid)).toEqual(['force-2']);
    });

    it('规则咬定者可以把基地上的持续行动移到另一基地，并保留原控制者语义', () => {
        const state = makeMatchState(makeState({
            currentPlayerIndex: 0,
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('lawyer-1', 'geeks_rules_lawyer', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase({
                    defId: 'base_a',
                    minions: [makeMinion('minion-a', 'geeks_fan', '1', 2)],
                    ongoingActions: [{
                        uid: 'lands-1',
                        defId: 'dragons_dragon_lands',
                        ownerId: '0',
                        talentUsed: true,
                        metadata: { sourceControllerId: '1' },
                    } as any],
                }),
                makeBase('base_b', [
                    makeMinion('minion-b', 'geeks_fan', '1', 2),
                ]),
            ],
        }));

        const played = runCommand(state, {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'lawyer-1' },
        });

        const actionPrompt = getSimpleChoicePrompt(played.finalState, 'geeks_rules_lawyer_action');
        expect(actionPrompt.targetType).toBe('ongoing');
        const movedAction = actionPrompt.options.find((option: any) => option.value?.cardUid === 'lands-1');
        expect(movedAction).toBeTruthy();

        const afterActionChoice = respondToPrompt(played.finalState, movedAction.id, '0', fixedRandom as any);
        const basePrompt = getSimpleChoicePrompt(afterActionChoice.finalState, 'geeks_rules_lawyer_target_base');
        const baseOption = basePrompt.options.find((option: any) => option.value?.baseIndex === 1);
        expect(baseOption).toBeTruthy();

        const resolved = respondToPrompt(afterActionChoice.finalState, baseOption.id, '0', fixedRandom as any);
        expect(getEffectivePower(resolved.finalState.core, resolved.finalState.core.bases[0].minions[0], 0)).toBe(2);
        expect(getEffectivePower(resolved.finalState.core, resolved.finalState.core.bases[1].minions[0], 1)).toBe(3);
        expect(resolved.finalState.core.bases[0].ongoingActions).toHaveLength(0);
        expect(resolved.finalState.core.bases[1].ongoingActions.map((action) => action.uid)).toEqual(['lands-1']);
        expect((resolved.finalState.core.bases[1].ongoingActions[0] as any).metadata?.sourceControllerId).toBe('1');
        expect(resolved.finalState.core.bases[1].ongoingActions[0].talentUsed).toBe(true);
    });

    it('规则咬定者可以把附着在随从上的行动移到另一随从，且效果跟着转移', () => {
        const state = makeMatchState(makeState({
            currentPlayerIndex: 0,
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('lawyer-1', 'geeks_rules_lawyer', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_a', [
                makeMinion('host-a', 'geeks_fan', '0', 2, {
                    attachedActions: [{ uid: 'expand-1', defId: 'superheroes_expanded_power', ownerId: '0', talentUsed: true } as any],
                }),
                makeMinion('host-b', 'wizard_apprentice', '0', 2),
            ])],
        }));

        const played = runCommand(state, {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'lawyer-1' },
        });

        const actionPrompt = getSimpleChoicePrompt(played.finalState, 'geeks_rules_lawyer_action');
        expect(actionPrompt.targetType).toBe('ongoing');
        const movedAction = actionPrompt.options.find((option: any) => option.value?.cardUid === 'expand-1');
        expect(movedAction).toBeTruthy();

        const afterActionChoice = respondToPrompt(played.finalState, movedAction.id, '0', fixedRandom as any);
        const minionPrompt = getSimpleChoicePrompt(afterActionChoice.finalState, 'geeks_rules_lawyer_target_minion');
        const hostBOption = minionPrompt.options.find((option: any) => option.value?.minionUid === 'host-b' || option.value?.uid === 'host-b');
        expect(hostBOption).toBeTruthy();

        const resolved = respondToPrompt(afterActionChoice.finalState, hostBOption.id, '0', fixedRandom as any);
        const hostA = resolved.finalState.core.bases[0].minions.find((minion) => minion.uid === 'host-a')!;
        const hostB = resolved.finalState.core.bases[0].minions.find((minion) => minion.uid === 'host-b')!;

        expect(getEffectivePower(resolved.finalState.core, hostA, 0)).toBe(2);
        expect(getEffectivePower(resolved.finalState.core, hostB, 0)).toBe(3);
        expect(hostA.attachedActions).toHaveLength(0);
        expect(hostB.attachedActions.map((action) => action.uid)).toEqual(['expand-1']);
        expect(hostB.attachedActions[0].talentUsed).toBe(true);
    });

    it('游戏专家只会阻止其他玩家的能力影响，不会阻止其他玩家的行动牌影响', () => {
        const core = makeState({
            bases: [makeBase('base_a', [
                makeMinion('guru-1', 'geeks_game_guru', '0', 3),
            ])],
        });
        const guru = core.bases[0].minions[0];

        expect(isMinionProtected(core, guru, 0, '1', 'affect', { sourceKind: 'nonAction' })).toBe(true);
        expect(isMinionProtected(core, guru, 0, '1', 'affect', { sourceKind: 'action' })).toBe(false);

        const abilityTargets = buildMinionTargetOptions([{
            uid: guru.uid,
            defId: guru.defId,
            baseIndex: 0,
            label: '游戏专家',
        }], {
            state: core,
            sourcePlayerId: '1',
            sourceKind: 'nonAction',
            effectType: 'affect',
        });
        const actionTargets = buildMinionTargetOptions([{
            uid: guru.uid,
            defId: guru.defId,
            baseIndex: 0,
            label: '游戏专家',
        }], {
            state: core,
            sourcePlayerId: '1',
            sourceKind: 'action',
            effectType: 'affect',
        });

        expect(abilityTargets).toHaveLength(0);
        expect(actionTargets).toHaveLength(1);
    });

    it('角色扮演在你获得 VP 后会给出可选打出提示，打出后额外获得 1 VP 并进入弃牌堆', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('cosplay-1', 'geeks_cosplay', 'action', '0')],
                    vp: 0,
                }),
                '1': makePlayer('1'),
            },
        });
        const matchState = makeMatchState(core);
        const result = postProcessSystemEvents(core, [{
            type: SU_EVENTS.VP_AWARDED,
            payload: {
                playerId: '0',
                amount: 2,
                reason: 'test_vp',
            },
            timestamp: 1000,
        } as any], fixedRandom as any, matchState);

        const reactionPrompt = getReactionPrompt(result.matchState!);
        const reactionOption = getReactionPromptOptionBySourceDefId(result.matchState!, reactionPrompt, 'geeks_cosplay');
        const reactionResolved = respondToPrompt(result.matchState!, reactionOption.id, '0', fixedRandom as any);

        const prompt = getSimpleChoicePrompt(reactionResolved.finalState, 'geeks_cosplay');
        const playOption = prompt.options.find((option: any) => option.value?.cardUid === 'cosplay-1');
        expect(playOption).toBeTruthy();

        const resolved = respondToPrompt(reactionResolved.finalState, playOption.id, '0', fixedRandom as any);
        const actionEvents = resolved.events.filter((event: any) => event.type === SU_EVENTS.ACTION_PLAYED);
        const vpEvents = resolved.events.filter((event: any) => event.type === SU_EVENTS.VP_AWARDED);
        expect(actionEvents).toHaveLength(1);
        expect(vpEvents).toHaveLength(1);
        expect(vpEvents[0].payload.amount).toBe(1);
        expect(vpEvents[0].payload.reason).toBe('geeks_cosplay');
        expect(resolved.finalState.core.players['0'].vp).toBe(3);
        expect(resolved.finalState.core.players['0'].hand).toHaveLength(0);
        expect(resolved.finalState.core.players['0'].discard.map((card) => card.uid)).toContain('cosplay-1');
    });

    it('角色扮演会响应基地计分获得的 VP', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('cosplay-1', 'geeks_cosplay', 'action', '0')],
                    vp: 0,
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_a', [])],
        });
        const matchState = makeMatchState(core);
        const result = postProcessSystemEvents(core, [{
            type: SU_EVENTS.BASE_SCORED,
            payload: {
                baseIndex: 0,
                baseDefId: 'base_a',
                rankings: [{ playerId: '0', power: 5, vp: 2 }],
            },
            timestamp: 1000,
        } as any], fixedRandom as any, matchState);

        const reactionPrompt = getReactionPrompt(result.matchState!);
        const reactionOption = getReactionPromptOptionBySourceDefId(result.matchState!, reactionPrompt, 'geeks_cosplay');
        const reactionResolved = respondToPrompt(result.matchState!, reactionOption.id, '0', fixedRandom as any);
        const prompt = getSimpleChoicePrompt(reactionResolved.finalState, 'geeks_cosplay');
        const resolved = respondToPrompt(reactionResolved.finalState, getPromptOptions(prompt)[0].id, '0', fixedRandom as any);

        expect(resolved.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.VP_AWARDED,
            payload: expect.objectContaining({ playerId: '0', amount: 1, reason: 'geeks_cosplay' }),
        }));
        expect(resolved.finalState.core.players['0'].vp).toBe(3);
    });

    it('角色扮演在你获得 VP 后可以选择跳过，跳过后不会额外加分且仍留在手里', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('cosplay-1', 'geeks_cosplay', 'action', '0')],
                    vp: 0,
                }),
                '1': makePlayer('1'),
            },
        });
        const matchState = makeMatchState(core);
        const result = postProcessSystemEvents(core, [{
            type: SU_EVENTS.VP_AWARDED,
            payload: {
                playerId: '0',
                amount: 1,
                reason: 'test_vp',
            },
            timestamp: 1000,
        } as any], fixedRandom as any, matchState);

        const reactionPrompt = getReactionPrompt(result.matchState!);
        const reactionOption = getReactionPromptOptionBySourceDefId(result.matchState!, reactionPrompt, 'geeks_cosplay');
        const reactionResolved = respondToPrompt(result.matchState!, reactionOption.id, '0', fixedRandom as any);

        const resolved = respondToPrompt(reactionResolved.finalState, 'skip', '0', fixedRandom as any);
        expect(resolved.finalState.core.players['0'].vp).toBe(1);
        expect(resolved.finalState.core.players['0'].hand.map((card) => card.uid)).toContain('cosplay-1');
        expect(resolved.finalState.core.players['0'].discard).toHaveLength(0);
    });

    it('展会会让这里其他同派系随从本回合 +1 力量，不影响不同派系和刚打出的随从', () => {
        const state = makeMatchState(makeState({
            currentPlayerIndex: 0,
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('fan-1', 'geeks_fan', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base_the_con', [
                    makeMinion('guru-1', 'geeks_game_guru', '0', 3),
                    makeMinion('wil-1', 'geeks_wil_wheaton', '1', 4),
                    makeMinion('alien-1', 'alien_invader', '1', 3),
                ]),
            ],
        }));

        const played = runCommand(state, {
            type: SU_COMMANDS.PLAY_MINION,
            playerId: '0',
            payload: { cardUid: 'fan-1', baseIndex: 0 },
        });

        expect(played.success).toBe(true);
        const base = played.finalState.core.bases[0];
        const guru = base.minions.find((minion) => minion.uid === 'guru-1')!;
        const wil = base.minions.find((minion) => minion.uid === 'wil-1')!;
        const alien = base.minions.find((minion) => minion.uid === 'alien-1')!;
        const fan = base.minions.find((minion) => minion.uid === 'fan-1')!;

        expect(getEffectivePower(played.finalState.core, guru, 0)).toBe(4);
        expect(getEffectivePower(played.finalState.core, wil, 0)).toBe(5);
        expect(getEffectivePower(played.finalState.core, alien, 0)).toBe(3);
        expect(getEffectivePower(played.finalState.core, fan, 0)).toBe(2);
    });

    it('桌游桌在计分后会让冠军抽 3 张牌，再从更新后的手牌中选择 2 张弃掉', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('hand-0', 'wizard_zap', 'action', '0')],
                    deck: [
                        makeCard('deck-1', 'pirate_first_mate', 'minion', '0'),
                        makeCard('deck-2', 'alien_invader', 'minion', '0'),
                        makeCard('deck-3', 'sharks_mako', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_tabletop', [])],
        });

        const triggered = triggerBaseAbilityWithMS('base_tabletop', 'afterScoring', {
            state: core,
            baseIndex: 0,
            baseDefId: 'base_tabletop',
            playerId: '0',
            rankings: [{ playerId: '0', power: 10, vp: 4 }],
            random: fixedRandom as any,
            now: 1000,
        });

        const afterDrawState = {
            ...triggered.matchState!,
            core: applyEvents(core, triggered.events as any),
        };

        const prompt = getSimpleChoicePrompt(afterDrawState, 'base_tabletop');
        const liveOptions = getPromptOptionsGenerator(prompt)?.(afterDrawState, prompt.data) ?? [];
        const optionUids = liveOptions
            .map((option) => option.value?.cardUid)
            .filter(Boolean);
        expect(optionUids).toEqual(expect.arrayContaining(['hand-0', 'deck-1', 'deck-2', 'deck-3']));

        const handOption = liveOptions.find((option) => option.value?.cardUid === 'hand-0');
        const deckOption = liveOptions.find((option) => option.value?.cardUid === 'deck-2');
        expect(handOption).toBeTruthy();
        expect(deckOption).toBeTruthy();

        const resolved = respondToPromptOptions(afterDrawState, [handOption!.id, deckOption!.id], '0', fixedRandom as any);

        expect(resolved.success).toBe(true);
        expect(resolved.finalState.core.players['0'].hand.map((card) => card.uid).sort()).toEqual(['deck-1', 'deck-3']);
        expect(resolved.finalState.core.players['0'].discard.map((card) => card.uid).sort()).toEqual(['deck-2', 'hand-0']);
    });

    it('桌游桌在抽牌后手牌不足 3 张时不会创建交互，而是直接弃掉全部手牌', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    deck: [makeCard('deck-1', 'pirate_first_mate', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_tabletop', [])],
        });

        const triggered = triggerBaseAbilityWithMS('base_tabletop', 'afterScoring', {
            state: core,
            baseIndex: 0,
            baseDefId: 'base_tabletop',
            playerId: '0',
            rankings: [{ playerId: '0', power: 10, vp: 4 }],
            random: fixedRandom as any,
            now: 1000,
        });

        expect(triggered.matchState).toBeUndefined();
        const finalCore = applyEvents(core, triggered.events as any);
        expect(finalCore.players['0'].hand.map((card) => card.uid)).toEqual([]);
        expect(finalCore.players['0'].discard.map((card) => card.uid)).toEqual(['deck-1']);
    });

    it('嘲讽会按顺序处理多个对手，并分别执行所选效果', () => {
        const state = makeMatchState(makeState({
            currentPlayerIndex: 0,
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('griefer-1', 'geeks_griefer', 'action', '0')],
                }),
                '1': makePlayer('1', {
                    hand: [
                        makeCard('p1-hand-a', 'wizard_zap', 'action', '1'),
                        makeCard('p1-hand-b', 'pirate_broadside', 'action', '1'),
                    ],
                    discard: [makeCard('p1-discard-1', 'alien_invader', 'minion', '1')],
                }),
                '2': makePlayer('2', {
                    hand: [makeCard('p2-hand-a', 'wizard_zap', 'action', '2')],
                    deck: [makeCard('p2-deck-1', 'pirate_first_mate', 'minion', '2')],
                    discard: [makeCard('p2-discard-1', 'alien_invader', 'minion', '2')],
                }),
            },
            turnOrder: ['0', '1', '2'],
            bases: [makeBase('base_a', [])],
        }));

        const played = runCommand(state, {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'griefer-1' },
        });

        const firstPrompt = getSimpleChoicePrompt(played.finalState, 'geeks_griefer');
        expect(getPromptTitle(firstPrompt)).toContain('玩家二');
        const firstDiscardOption = firstPrompt.options.find((option: any) => option.value?.mode === 'discard');
        expect(firstDiscardOption).toBeTruthy();

        const afterFirstResolve = respondToPrompt(played.finalState, firstDiscardOption.id, '0', fixedRandom as any);
        expect(afterFirstResolve.finalState.core.players['1'].hand.map((card) => card.uid)).toEqual(['p1-hand-a']);
        expect(afterFirstResolve.finalState.core.players['1'].discard.map((card) => card.uid).sort()).toEqual(['p1-discard-1', 'p1-hand-b']);

        const secondPrompt = getSimpleChoicePrompt(afterFirstResolve.finalState, 'geeks_griefer');
        expect(getPromptTitle(secondPrompt)).toContain('玩家三');
        const secondShuffleOption = secondPrompt.options.find((option: any) => option.value?.mode === 'shuffle');
        expect(secondShuffleOption).toBeTruthy();

        const resolved = respondToPrompt(afterFirstResolve.finalState, secondShuffleOption.id, '0', fixedRandom as any);
        expect(resolved.finalState.core.players['2'].deck.map((card) => card.uid)).toEqual(['p2-deck-1', 'p2-discard-1']);
        expect(resolved.finalState.core.players['2'].discard).toHaveLength(0);
    });

    it('嘲讽在只有“消灭一个自己的随从”可用时，会直接进入目标选择并按目标玩家自己的身份消灭', () => {
        const state = makeMatchState(makeState({
            currentPlayerIndex: 0,
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('griefer-1', 'geeks_griefer', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_a', [
                makeMinion('awesome-1', 'superheroes_awesome_guy', '1', 5),
                makeMinion('fan-1', 'geeks_fan', '1', 2),
            ])],
        }));

        const played = runCommand(state, {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'griefer-1' },
        });

        const destroyPrompt = getSimpleChoicePrompt(played.finalState, 'geeks_griefer_destroy');
        const fanOption = destroyPrompt.options.find((option: any) => option.value?.minionUid === 'fan-1' || option.value?.uid === 'fan-1');
        expect(fanOption).toBeTruthy();

        const resolved = respondToPrompt(played.finalState, fanOption.id, '0', fixedRandom as any);
        const destroyEvent = resolved.events.find((event: any) => event.type === SU_EVENTS.MINION_DESTROYED);

        expect(destroyEvent?.payload?.destroyerId).toBe('1');
        expect(resolved.finalState.core.bases[0].minions.map((minion) => minion.uid)).toEqual(['awesome-1']);
        expect(resolved.finalState.core.players['1'].discard.map((card) => card.uid)).toContain('fan-1');
    });

    it('嘲讽会跳过没有任何合法效果的对手，直接处理下一位', () => {
        const state = makeMatchState(makeState({
            currentPlayerIndex: 0,
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('griefer-1', 'geeks_griefer', 'action', '0')],
                }),
                '1': makePlayer('1'),
                '2': makePlayer('2', {
                    hand: [makeCard('p2-hand-a', 'wizard_zap', 'action', '2')],
                    discard: [makeCard('p2-discard-1', 'alien_invader', 'minion', '2')],
                }),
            },
            turnOrder: ['0', '1', '2'],
            bases: [makeBase('base_a', [])],
        }));

        const played = runCommand(state, {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'griefer-1' },
        });

        const prompt = getSimpleChoicePrompt(played.finalState, 'geeks_griefer');
        expect(getPromptTitle(prompt)).toContain('玩家三');
    });

    it('Mulligan 选择全部加入手牌时，会拿走顶五张并把其余手牌洗回牌库', () => {
        const state = makeMatchState(makeState({
            currentPlayerIndex: 0,
            players: {
                '0': makePlayer('0', {
                    hand: [
                        makeCard('mulligan-1', 'geeks_mulligan', 'action', '0'),
                        makeCard('hand-a', 'wizard_zap', 'action', '0'),
                        makeCard('hand-b', 'alien_invader', 'minion', '0'),
                    ],
                    deck: [
                        makeCard('top-1', 'pirate_first_mate', 'minion', '0'),
                        makeCard('top-2', 'pirate_broadside', 'action', '0'),
                        makeCard('top-3', 'geeks_fan', 'minion', '0'),
                        makeCard('top-4', 'wizard_summon', 'action', '0'),
                        makeCard('top-5', 'superheroes_sidekick', 'minion', '0'),
                        makeCard('rest-1', 'sharks_mako', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_a', [])],
        }));

        const played = runCommand(state, {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'mulligan-1' },
        });

        const prompt = getSimpleChoicePrompt(played.finalState, 'geeks_mulligan');
        expect(prompt.titleKey).toBe('ui.geeks_mulligan_title');
        expect(prompt.titleParams).toEqual({ count: 5 });

        const resolved = respondToPrompt(played.finalState, 'draw', '0', fixedRandom as any);
        expect(resolved.finalState.core.players['0'].hand.map((card) => card.uid)).toEqual([
            'top-1',
            'top-2',
            'top-3',
            'top-4',
            'top-5',
        ]);
        expect(resolved.finalState.core.players['0'].deck.map((card) => card.uid)).toEqual([
            'rest-1',
            'hand-a',
            'hand-b',
        ]);
        expect(resolved.finalState.core.players['0'].discard.map((card) => card.uid)).toContain('mulligan-1');
    });

    it('Mulligan 选择保持原样时，不会改动顶牌顺序或当前手牌', () => {
        const state = makeMatchState(makeState({
            currentPlayerIndex: 0,
            players: {
                '0': makePlayer('0', {
                    hand: [
                        makeCard('mulligan-1', 'geeks_mulligan', 'action', '0'),
                        makeCard('hand-a', 'wizard_zap', 'action', '0'),
                    ],
                    deck: [
                        makeCard('top-1', 'pirate_first_mate', 'minion', '0'),
                        makeCard('top-2', 'pirate_broadside', 'action', '0'),
                        makeCard('top-3', 'geeks_fan', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_a', [])],
        }));

        const played = runCommand(state, {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'mulligan-1' },
        });

        const resolved = respondToPrompt(played.finalState, 'keep', '0', fixedRandom as any);
        expect(resolved.finalState.core.players['0'].hand.map((card) => card.uid)).toEqual(['hand-a']);
        expect(resolved.finalState.core.players['0'].deck.map((card) => card.uid)).toEqual(['top-1', 'top-2', 'top-3']);
        expect(resolved.finalState.core.players['0'].discard.map((card) => card.uid)).toContain('mulligan-1');
    });

    it('Mulligan 在牌库不足 5 张时会先把弃牌堆洗回牌库，再查看并拿走补足后的顶五张', () => {
        const state = makeMatchState(makeState({
            currentPlayerIndex: 0,
            players: {
                '0': makePlayer('0', {
                    hand: [
                        makeCard('mulligan-1', 'geeks_mulligan', 'action', '0'),
                        makeCard('hand-a', 'wizard_zap', 'action', '0'),
                    ],
                    deck: [
                        makeCard('deck-1', 'pirate_first_mate', 'minion', '0'),
                        makeCard('deck-2', 'pirate_broadside', 'action', '0'),
                    ],
                    discard: [
                        makeCard('discard-1', 'geeks_fan', 'minion', '0'),
                        makeCard('discard-2', 'wizard_summon', 'action', '0'),
                        makeCard('discard-3', 'superheroes_sidekick', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_a', [])],
        }));

        const played = runCommand(state, {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'mulligan-1' },
        });

        const prompt = getSimpleChoicePrompt(played.finalState, 'geeks_mulligan');
        expect(prompt.titleKey).toBe('ui.geeks_mulligan_title');
        expect(prompt.titleParams).toEqual({ count: 5 });

        const resolved = respondToPrompt(played.finalState, 'draw', '0', fixedRandom as any);
        expect(resolved.finalState.core.players['0'].hand.map((card) => card.uid)).toEqual([
            'deck-1',
            'deck-2',
            'discard-1',
            'discard-2',
            'discard-3',
        ]);
        expect(resolved.finalState.core.players['0'].deck.map((card) => card.uid)).toEqual(['hand-a']);
        expect(resolved.finalState.core.players['0'].discard.map((card) => card.uid)).toEqual(['mulligan-1']);
    });
});
