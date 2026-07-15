import { beforeEach, describe, expect, it } from 'vitest';

import { initAllAbilities, resetAbilityInit } from '../../abilities';
import { ALL_STARS_CARDS } from '../../data/factions/all_stars';
import { SHEEP_CARDS } from '../../data/factions/sheep';
import { collectTriggers, fireTriggers } from '../../domain/ongoingEffects';
import { getEffectivePower } from '../../domain/ongoingModifiers';
import { maybeResolveReactionQueue } from '../../domain/reactionQueue';
import { SU_EVENTS } from '../../domain/types';
import {
    applyEvents,
    expectRegisteredAbilityContract,
    getOptionalSimpleChoicePrompt,
    getPromptSourceId,
    getSimpleChoicePrompt,
    invokeRegisteredAbilityContract,
    makeBase,
    makeCard,
    makeMatchState,
    makeMinion,
    makePlayer,
    makeState,
    resolveAffectedMinions,
    resolveDestroyedMinions,
    resolveMovedMinions,
    respondToPromptOption,
    triggerBaseAbilityWithMS,
} from '../helpers';

const FIXED_RANDOM = {
    random: () => 0,
    d: () => 1,
    range: (min: number) => min,
    shuffle: <T>(items: T[]) => [...items],
};

describe('Promo 绵羊与全明星代表性玩法行为', () => {
    beforeEach(() => {
        resetAbilityInit();
        initAllAbilities();
    });

    it('两派系数据里的可执行能力入口均已注册', () => {
        const executableTags = new Set(['onPlay', 'talent', 'special']);
        for (const card of [...SHEEP_CARDS, ...ALL_STARS_CARDS]) {
            for (const tag of card.abilityTags ?? []) {
                if (!executableTags.has(tag)) continue;
                expect(expectRegisteredAbilityContract(card.id, tag as any), `${card.id}::${tag}`).toBeTypeOf('function');
            }
        }
    });

    it('剪羊毛立即抽牌、持续 -2，并在控制者回合开始返回手牌', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    deck: [makeCard('drawn', 'sheep_flock', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_the_pasture', [
                makeMinion('host', 'sheep_ram', '0', 4, {
                    attachedActions: [{ uid: 'shearing', defId: 'sheep_shearing', ownerId: '0' }],
                }),
            ])],
        });

        const onPlay = invokeRegisteredAbilityContract('sheep_shearing', 'onPlay', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'shearing',
            defId: 'sheep_shearing',
            baseIndex: 0,
            targetMinionUid: 'host',
            random: FIXED_RANDOM,
            now: 10,
        });
        const afterDraw = applyEvents(core, onPlay.events);
        expect(afterDraw.players['0'].hand.map(card => card.uid)).toEqual(['drawn']);
        expect(getEffectivePower(core, core.bases[0].minions[0], 0)).toBe(2);

        const turnStart = fireTriggers(core, 'onTurnStart', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            random: FIXED_RANDOM,
            now: 11,
        });
        expect(turnStart.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: SU_EVENTS.ONGOING_DETACHED,
                payload: expect.objectContaining({
                    cardUid: 'shearing',
                    destination: 'hand',
                    reason: 'sheep_shearing',
                }),
            }),
        ]));
    });

    it('羊群跟随同基地随从移动，黑色牧羊在新随从进场后离开该基地', () => {
        const flockCore = makeState({
            bases: [
                makeBase('base_the_pasture', [
                    makeMinion('flock', 'sheep_flock', '0', 2),
                    makeMinion('leader', 'sheep_ram', '0', 4),
                ]),
                makeBase('base_stadium'),
            ],
        });
        const moved = resolveMovedMinions(
            makeMatchState(flockCore),
            '0',
            [{ minionUid: 'leader', minionDefId: 'sheep_ram', fromBaseIndex: 0, toBaseIndex: 1 }],
            FIXED_RANDOM,
            20,
        );
        const flockQueued = moved.events.find(event => event.type === SU_EVENTS.TRIGGER_QUEUED) as any;
        expect(flockQueued?.payload?.triggers?.[0]).toMatchObject({ sourceDefId: 'sheep_flock' });
        const resolvedFlock = maybeResolveReactionQueue(
            makeMatchState({ ...flockCore, triggerQueue: flockQueued.payload.triggers } as any),
            FIXED_RANDOM,
            20,
        );
        expect(resolvedFlock?.events ?? []).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: SU_EVENTS.MINION_MOVED,
                payload: expect.objectContaining({
                    minionUid: 'flock',
                    toBaseIndex: 1,
                    reason: 'sheep_flock',
                }),
            }),
        ]));

        const blackSheepCore = makeState({
            bases: [
                makeBase('base_the_pasture', [
                    makeMinion('black', 'sheep_black_sheep', '0', 4),
                    makeMinion('entrant', 'sheep_flock', '1', 2),
                ]),
                makeBase('base_stadium'),
            ],
        });
        const entered = fireTriggers(blackSheepCore, 'onMinionPlayed', {
            state: blackSheepCore,
            matchState: makeMatchState(blackSheepCore),
            playerId: '1',
            baseIndex: 0,
            triggerMinionUid: 'entrant',
            triggerMinionDefId: 'sheep_flock',
            random: FIXED_RANDOM,
            now: 21,
        });
        expect(entered.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: SU_EVENTS.MINION_MOVED,
                payload: expect.objectContaining({
                    minionUid: 'black',
                    toBaseIndex: 1,
                    reason: 'sheep_black_sheep',
                }),
            }),
        ]));
    });

    it('少尉可把对手行动对同基地己方另一个随从的影响改到自己身上', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_the_pasture', [
                makeMinion('ensign', 'all_stars_ensign', '0', 2),
                makeMinion('ally', 'sheep_flock', '0', 2),
            ])],
        });
        const destroyedByOpponentAction = {
            type: SU_EVENTS.MINION_DESTROYED,
            payload: {
                minionUid: 'ally',
                minionDefId: 'sheep_flock',
                fromBaseIndex: 0,
                ownerId: '0',
                controllerId: '0',
                destroyerId: '1',
                sourcePlayerId: '1',
                sourceDefId: 'all_stars_square_deal',
                sourceKind: 'action',
                reason: 'test_opponent_action',
            },
            timestamp: 31,
        } as any;

        const prompted = resolveAffectedMinions(
            makeMatchState(core),
            '1',
            [destroyedByOpponentAction],
            FIXED_RANDOM,
            31,
        );
        expect(prompted.events).toEqual([]);
        expect(getPromptSourceId(getSimpleChoicePrompt(prompted.matchState!))).toBe('all_stars_ensign');

        const redirected = respondToPromptOption(
            prompted.matchState!,
            option => option.value?.redirect === true,
            'redirect opponent action to Ensign',
            '0',
            FIXED_RANDOM,
        );

        expect(redirected.finalState.core.bases[0].minions.map(minion => minion.uid)).toEqual(['ally']);
        expect(redirected.finalState.core.players['0'].discard.map(card => card.uid)).toEqual(['ensign']);
    });

    it('少尉跳过改向后原始影响只结算一次', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_the_pasture', [
                makeMinion('ensign', 'all_stars_ensign', '0', 2),
                makeMinion('ally', 'sheep_flock', '0', 2),
            ])],
        });
        const returnedByOpponentAction = {
            type: SU_EVENTS.MINION_RETURNED,
            payload: {
                minionUid: 'ally',
                minionDefId: 'sheep_flock',
                fromBaseIndex: 0,
                toPlayerId: '0',
                sourcePlayerId: '1',
                sourceDefId: 'all_stars_square_deal',
                sourceKind: 'action',
                reason: 'test_opponent_action',
            },
            timestamp: 32,
        } as any;

        const prompted = resolveAffectedMinions(
            makeMatchState(core),
            '1',
            [returnedByOpponentAction],
            FIXED_RANDOM,
            32,
        );
        const skipped = respondToPromptOption(
            prompted.matchState!,
            option => option.value?.skip === true,
            'skip Ensign redirect',
            '0',
            FIXED_RANDOM,
        );

        expect(skipped.finalState.core.bases[0].minions.map(minion => minion.uid)).toEqual(['ensign']);
        expect(skipped.finalState.core.players['0'].hand.map(card => card.uid)).toEqual(['ally']);
    });

    it('少尉不响应己方行动或非行动来源', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_the_pasture', [
                makeMinion('ensign', 'all_stars_ensign', '0', 2),
                makeMinion('ally', 'sheep_flock', '0', 2),
            ])],
        });
        const ownActionDestroy = {
            type: SU_EVENTS.MINION_DESTROYED,
            payload: {
                minionUid: 'ally',
                minionDefId: 'sheep_flock',
                fromBaseIndex: 0,
                ownerId: '0',
                controllerId: '0',
                destroyerId: '0',
                sourcePlayerId: '0',
                sourceDefId: 'all_stars_square_deal',
                sourceKind: 'action',
                reason: 'test_own_action',
            },
            timestamp: 33,
        } as any;
        const nonActionDestroy = {
            ...ownActionDestroy,
            payload: {
                ...ownActionDestroy.payload,
                destroyerId: '1',
                sourcePlayerId: '1',
                sourceDefId: 'all_stars_imperial_dragon',
                sourceKind: 'nonAction',
                reason: 'test_non_action',
            },
            timestamp: 34,
        } as any;

        const ownAction = resolveAffectedMinions(makeMatchState(core), '0', [ownActionDestroy], FIXED_RANDOM, 33);
        const nonAction = resolveAffectedMinions(makeMatchState(core), '1', [nonActionDestroy], FIXED_RANDOM, 34);

        expect(ownAction.events).toEqual([ownActionDestroy]);
        expect(nonAction.events).toEqual([nonActionDestroy]);
        expect(getOptionalSimpleChoicePrompt(ownAction.matchState!)).toBeUndefined();
        expect(getOptionalSimpleChoicePrompt(nonAction.matchState!)).toBeUndefined();
    });
    it('母羊 Shall Pass 移动己方随从、抽牌并授予额外行动', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    deck: [makeCard('drawn', 'sheep_flock', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base_the_pasture', [
                    makeMinion('ally', 'sheep_flock', '0', 2),
                ]),
                makeBase('base_stadium'),
            ],
        });
        const result = invokeRegisteredAbilityContract('sheep_ewe_shall_pass', 'onPlay', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'ewe',
            defId: 'sheep_ewe_shall_pass',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 30,
        });
        const resolved = respondToPromptOption(
            result.matchState!,
            option => option.value?.minionUid === 'ally',
            'move sheep ally',
            '0',
            FIXED_RANDOM,
        );

        expect(resolved.finalState.core.bases[0].minions.map(minion => minion.uid)).toEqual([]);
        expect(resolved.finalState.core.bases[1].minions.map(minion => minion.uid)).toEqual(['ally']);
        expect(resolved.finalState.core.players['0'].hand.map(card => card.uid)).toEqual(['drawn']);
        expect(resolved.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: SU_EVENTS.LIMIT_MODIFIED,
                payload: expect.objectContaining({ reason: 'sheep_ewe_shall_pass' }),
            }),
        ]));
    });

    it('公羊移动到新基地后可把力量 2 或以下随从返回手牌', () => {
        const core = makeState({
            bases: [
                makeBase('base_the_pasture', [
                    makeMinion('ram', 'sheep_ram', '0', 4),
                ]),
                makeBase('base_stadium', [
                    makeMinion('small', 'all_stars_fan', '1', 2),
                ]),
            ],
        });
        const talent = invokeRegisteredAbilityContract('sheep_ram', 'talent', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'ram',
            defId: 'sheep_ram',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 40,
        });
        const resolved = respondToPromptOption(
            talent.matchState!,
            option => option.value?.baseIndex === 1,
            'move Ram to occupied base',
            '0',
            FIXED_RANDOM,
        );

        expect(resolved.finalState.core.bases[0].minions.map(minion => minion.uid)).toEqual([]);
        expect(resolved.finalState.core.bases[1].minions.map(minion => minion.uid)).toEqual(['ram']);
        expect(resolved.finalState.core.players['1'].hand.map(card => card.uid)).toEqual(['small']);
    });

    it('满月只强化该基地己方随从，公正待遇按最低对手手牌差抽牌', () => {
        const fullMoonCore = makeState({
            bases: [makeBase({
                defId: 'base_stadium',
                ongoingActions: [{ uid: 'full-moon', defId: 'all_stars_full_moon', ownerId: '0' }],
                minions: [
                    makeMinion('own', 'all_stars_puck', '0', 3),
                    makeMinion('enemy', 'sheep_flock', '1', 2),
                ],
            })],
        });
        expect(getEffectivePower(fullMoonCore, fullMoonCore.bases[0].minions[0], 0)).toBe(4);
        expect(getEffectivePower(fullMoonCore, fullMoonCore.bases[0].minions[1], 0)).toBe(2);

        const squareDealCore = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('h', 'all_stars_king_rex', 'minion', '0')],
                    deck: [
                        makeCard('d1', 'all_stars_puck', 'minion', '0'),
                        makeCard('d2', 'all_stars_fan', 'minion', '0'),
                        makeCard('d3', 'all_stars_king_rex', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1', {
                    hand: [
                        makeCard('o1', 'sheep_flock', 'minion', '1'),
                        makeCard('o2', 'sheep_ram', 'minion', '1'),
                        makeCard('o3', 'sheep_black_sheep', 'minion', '1'),
                    ],
                }),
            },
        });
        const squareDeal = invokeRegisteredAbilityContract('all_stars_square_deal', 'onPlay', {
            state: squareDealCore,
            matchState: makeMatchState(squareDealCore),
            playerId: '0',
            cardUid: 'square',
            defId: 'all_stars_square_deal',
            random: FIXED_RANDOM,
            now: 50,
        });
        const afterDraw = applyEvents(squareDealCore, squareDeal.events);
        expect(afterDraw.players['0'].hand.map(card => card.uid)).toEqual(['h', 'd1', 'd2', 'd3']);
    });

    it('友情的力量移动己方随从，并把本行动从弃牌堆回手', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    discard: [makeCard('friendship', 'all_stars_friendship_power', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base_locker_room', [
                    makeMinion('mover', 'all_stars_puck', '0', 3),
                ]),
                makeBase('base_stadium', [
                    makeMinion('anchor', 'all_stars_fan', '0', 2),
                ]),
            ],
        });
        const result = invokeRegisteredAbilityContract('all_stars_friendship_power', 'onPlay', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'friendship',
            defId: 'all_stars_friendship_power',
            random: FIXED_RANDOM,
            now: 60,
        });
        const resolved = respondToPromptOption(
            result.matchState!,
            option => option.value?.minionUid === 'mover',
            'move with Friendship Power',
            '0',
            FIXED_RANDOM,
        );

        expect(resolved.finalState.core.bases[0].minions.map(minion => minion.uid)).toEqual([]);
        expect(resolved.finalState.core.bases[1].minions.map(minion => minion.uid)).toEqual(['anchor', 'mover']);
        expect(resolved.finalState.core.players['0'].hand.map(card => card.uid)).toEqual(['friendship']);
    });

    it('非无穷循环选择手牌行动作为额外行动打出，并开启回手选择', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('square', 'all_stars_square_deal', 'action', '0')],
                    deck: [makeCard('drawn', 'all_stars_fan', 'minion', '0')],
                    discard: [makeCard('loop', 'all_stars_non_infinite_loop', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
        });
        const result = invokeRegisteredAbilityContract('all_stars_non_infinite_loop', 'onPlay', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'loop',
            defId: 'all_stars_non_infinite_loop',
            random: FIXED_RANDOM,
            now: 70,
        });
        const played = respondToPromptOption(
            result.matchState!,
            option => option.value?.cardUid === 'square',
            'play Square Deal through Non-Infinite Loop',
            '0',
            FIXED_RANDOM,
        );

        expect(played.finalState.core.players['0'].hand.map(card => card.uid)).toEqual(['drawn']);
        expect(played.finalState.core.players['0'].discard.map(card => card.uid)).toContain('square');
        expect(getPromptSourceId(getSimpleChoicePrompt(played.finalState))).toBe('geeks_non_infinite_loop_return');

        const returned = respondToPromptOption(
            played.finalState,
            option => option.value?.returnToHand === true,
            'return replayed action to hand',
            '0',
            FIXED_RANDOM,
        );
        expect(returned.finalState.core.players['0'].hand.map(card => card.uid)).toEqual(expect.arrayContaining(['drawn', 'square']));
    });

    it('基因工程生命体可指定牌库中的非 G.E.L.F. 小随从并把自己洗回牌库', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    deck: [
                        makeCard('fan-card', 'all_stars_fan', 'minion', '0'),
                        makeCard('rex-card', 'all_stars_king_rex', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_stadium', [
                makeMinion('gelf-live', 'all_stars_gelf', '0', 4),
            ])],
        });
        const result = invokeRegisteredAbilityContract('all_stars_gelf', 'talent', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'gelf-live',
            defId: 'all_stars_gelf',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 72,
        });
        const resolved = respondToPromptOption(
            result.matchState!,
            option => option.value?.cardUid === 'fan-card',
            'choose Fan for G.E.L.F.',
            '0',
            FIXED_RANDOM,
        );

        expect(resolved.finalState.core.bases[0].minions.map(minion => minion.uid)).toEqual(['fan-card']);
        expect(resolved.finalState.core.players['0'].deck.map(card => card.uid)).toEqual(['rex-card', 'gelf-live']);
    });

    it('是不是要跟着先随机展示弃牌堆行动，再由玩家选择打出或返回并抽牌', () => {
        const playCore = makeState({
            players: {
                '0': makePlayer('0', {
                    deck: [
                        makeCard('draw-a', 'all_stars_fan', 'minion', '0'),
                        makeCard('draw-b', 'all_stars_puck', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1', {
                    discard: [makeCard('borrowed-square', 'all_stars_square_deal', 'action', '1')],
                }),
            },
        });
        const choosePlayer = invokeRegisteredAbilityContract('sheep_to_follow_or_not', 'onPlay', {
            state: playCore,
            matchState: makeMatchState(playCore),
            playerId: '0',
            cardUid: 'follow',
            defId: 'sheep_to_follow_or_not',
            random: FIXED_RANDOM,
            now: 73,
        });
        const revealed = respondToPromptOption(
            choosePlayer.matchState!,
            option => option.value?.playerId === '1',
            'choose discard owner',
            '0',
            FIXED_RANDOM,
        );
        expect(getPromptSourceId(getSimpleChoicePrompt(revealed.finalState))).toBe('sheep_to_follow_or_not_resolve');
        const played = respondToPromptOption(
            revealed.finalState,
            option => option.value?.mode === 'play',
            'play revealed action',
            '0',
            FIXED_RANDOM,
        );
        expect(played.finalState.core.players['0'].hand.map(card => card.uid)).toEqual(['draw-a', 'draw-b']);
        expect(played.finalState.core.players['1'].discard.map(card => card.uid)).toContain('borrowed-square');

        const returnCore = makeState({
            players: {
                '0': makePlayer('0', { deck: [makeCard('draw-only', 'all_stars_fan', 'minion', '0')] }),
                '1': makePlayer('1', { discard: [makeCard('kept-square', 'all_stars_square_deal', 'action', '1')] }),
            },
        });
        const returnChoose = invokeRegisteredAbilityContract('sheep_to_follow_or_not', 'onPlay', {
            state: returnCore,
            matchState: makeMatchState(returnCore),
            playerId: '0',
            cardUid: 'follow-return',
            defId: 'sheep_to_follow_or_not',
            random: FIXED_RANDOM,
            now: 74,
        });
        const returnRevealed = respondToPromptOption(returnChoose.matchState!, option => option.value?.playerId === '1', 'choose return owner', '0', FIXED_RANDOM);
        const returned = respondToPromptOption(returnRevealed.finalState, option => option.value?.mode === 'return', 'return revealed action', '0', FIXED_RANDOM);
        expect(returned.finalState.core.players['0'].hand.map(card => card.uid)).toEqual(['draw-only']);
        expect(returned.finalState.core.players['1'].discard.map(card => card.uid)).toEqual(['kept-square']);
    });

    it('你好，多莉！可在对手打出行动后作为可选反应打出，并复制该行动能力', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('hello', 'sheep_hello_dolly', 'action', '0')],
                    deck: [
                        makeCard('copy-draw-a', 'all_stars_fan', 'minion', '0'),
                        makeCard('copy-draw-b', 'all_stars_puck', 'minion', '0'),
                        makeCard('copy-draw-c', 'sheep_flock', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1', {
                    hand: [
                        makeCard('opp-a', 'sheep_flock', 'minion', '1'),
                        makeCard('opp-b', 'sheep_ram', 'minion', '1'),
                    ],
                    discard: [makeCard('square-played', 'all_stars_square_deal', 'action', '1')],
                }),
            },
        });
        const triggerQueued = collectTriggers(core, 'onActionPlayed', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '1',
            triggerCardUid: 'square-played',
            triggerCardDefId: 'all_stars_square_deal',
            triggerCardOwnerId: '1',
            random: FIXED_RANDOM,
            now: 74,
        });
        expect(triggerQueued?.payload?.triggers?.[0]).toMatchObject({
            sourceDefId: 'sheep_hello_dolly',
            ownerPlayerId: '0',
            eventPlayerId: '1',
        });

        const prompted = maybeResolveReactionQueue(
            makeMatchState({
                ...core,
                triggerQueue: triggerQueued!.payload.triggers,
            } as any),
            FIXED_RANDOM,
            74,
        );
        const copied = respondToPromptOption(
            prompted!.state,
            option => option.value?.triggerId === triggerQueued!.payload.triggers[0].id,
            'play Hello, Dolly! reaction',
            '0',
            FIXED_RANDOM,
        );

        expect(copied.finalState.core.players['0'].discard.map(card => card.uid)).toContain('hello');
        expect(copied.finalState.core.players['0'].hand.map(card => card.uid)).toEqual([
            'copy-draw-a',
            'copy-draw-b',
            'copy-draw-c',
        ]);
        expect(copied.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: SU_EVENTS.ACTION_PLAYED,
                payload: expect.objectContaining({
                    playerId: '0',
                    cardUid: 'hello',
                    defId: 'sheep_hello_dolly',
                    isExtraAction: true,
                }),
            }),
        ]));
    });

    it('木材换羊展示随机手牌，可返回或交出一张牌来打出展示行动', () => {
        const playCore = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('gift', 'sheep_flock', 'minion', '0')],
                    deck: [
                        makeCard('wood-draw-a', 'all_stars_fan', 'minion', '0'),
                        makeCard('wood-draw-b', 'all_stars_puck', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1', {
                    hand: [makeCard('revealed-square', 'all_stars_square_deal', 'action', '1')],
                }),
            },
        });
        const choosePlayer = invokeRegisteredAbilityContract('sheep_wood_for_sheep', 'onPlay', {
            state: playCore,
            matchState: makeMatchState(playCore),
            playerId: '0',
            cardUid: 'wood',
            defId: 'sheep_wood_for_sheep',
            random: FIXED_RANDOM,
            now: 75,
        });
        const revealed = respondToPromptOption(choosePlayer.matchState!, option => option.value?.playerId === '1', 'choose trade target', '0', FIXED_RANDOM);
        expect(revealed.events.some(event => event.type === SU_EVENTS.REVEAL_HAND)).toBe(true);
        expect(getPromptSourceId(getSimpleChoicePrompt(revealed.finalState))).toBe('sheep_wood_for_sheep_resolve');
        const traded = respondToPromptOption(
            revealed.finalState,
            option => option.value?.giveCardUid === 'gift' && option.value?.mode === 'play',
            'trade gift and play revealed action',
            '0',
            FIXED_RANDOM,
        );
        expect(traded.finalState.core.players['0'].hand.map(card => card.uid)).toEqual(['wood-draw-a', 'wood-draw-b']);
        expect(traded.finalState.core.players['1'].hand.map(card => card.uid)).toEqual(['gift']);
        expect(traded.finalState.core.players['1'].discard.map(card => card.uid)).toContain('revealed-square');

        const minionCore = makeState({
            players: {
                '0': makePlayer('0', { hand: [makeCard('gift-minion', 'sheep_flock', 'minion', '0')] }),
                '1': makePlayer('1', { hand: [makeCard('revealed-fan', 'all_stars_fan', 'minion', '1')] }),
            },
            bases: [makeBase('base_stadium')],
        });
        const minionChoose = invokeRegisteredAbilityContract('sheep_wood_for_sheep', 'onPlay', {
            state: minionCore,
            matchState: makeMatchState(minionCore),
            playerId: '0',
            cardUid: 'wood-minion',
            defId: 'sheep_wood_for_sheep',
            random: FIXED_RANDOM,
            now: 77,
        });
        const minionRevealed = respondToPromptOption(minionChoose.matchState!, option => option.value?.playerId === '1', 'choose minion trade target', '0', FIXED_RANDOM);
        const minionPlayed = respondToPromptOption(
            minionRevealed.finalState,
            option => option.value?.giveCardUid === 'gift-minion' && option.value?.playKind === 'minion' && option.value?.targetBaseIndex === 0,
            'trade gift and play revealed minion',
            '0',
            FIXED_RANDOM,
        );
        expect(minionPlayed.finalState.core.players['0'].hand.map(card => card.uid)).toEqual([]);
        expect(minionPlayed.finalState.core.players['1'].hand.map(card => card.uid)).toEqual(['gift-minion']);
        expect(minionPlayed.finalState.core.bases[0].minions.map(minion => minion.uid)).toEqual(['revealed-fan']);
        const returnCore = makeState({
            players: {
                '0': makePlayer('0', { hand: [makeCard('gift-return', 'sheep_flock', 'minion', '0')] }),
                '1': makePlayer('1', { hand: [makeCard('return-square', 'all_stars_square_deal', 'action', '1')] }),
            },
        });
        const returnChoose = invokeRegisteredAbilityContract('sheep_wood_for_sheep', 'onPlay', {
            state: returnCore,
            matchState: makeMatchState(returnCore),
            playerId: '0',
            cardUid: 'wood-return',
            defId: 'sheep_wood_for_sheep',
            random: FIXED_RANDOM,
            now: 76,
        });
        const returnRevealed = respondToPromptOption(returnChoose.matchState!, option => option.value?.playerId === '1', 'choose return trade target', '0', FIXED_RANDOM);
        const returned = respondToPromptOption(returnRevealed.finalState, option => option.value?.mode === 'return', 'return revealed hand card', '0', FIXED_RANDOM);
        expect(returned.finalState.core.players['0'].hand.map(card => card.uid)).toEqual(['gift-return']);
        expect(returned.finalState.core.players['1'].hand.map(card => card.uid)).toEqual(['return-square']);
    });
    it('准备战斗按玩家选择拿一张，另一张置于牌库底', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    deck: [
                        makeCard('top-a', 'all_stars_puck', 'minion', '0'),
                        makeCard('top-b', 'all_stars_fan', 'minion', '0'),
                        makeCard('tail', 'all_stars_king_rex', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
        });
        const result = invokeRegisteredAbilityContract('all_stars_prepare_for_battle', 'onPlay', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'prepare',
            defId: 'all_stars_prepare_for_battle',
            random: FIXED_RANDOM,
            now: 80,
        });
        const resolved = respondToPromptOption(
            result.matchState!,
            option => option.value?.cardUid === 'top-b',
            'draw second revealed card',
            '0',
            FIXED_RANDOM,
        );

        expect(resolved.finalState.core.players['0'].hand.map(card => card.uid)).toEqual(['top-b']);
        expect(resolved.finalState.core.players['0'].deck.map(card => card.uid)).toEqual(['tail', 'top-a']);
    });

    it('更衣室与体育场基地能力，以及帝国龙触发抽牌', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    deck: [
                        makeCard('locker-draw', 'all_stars_fan', 'minion', '0'),
                        makeCard('dragon-draw', 'all_stars_puck', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1', {
                    deck: [makeCard('stadium-draw', 'sheep_flock', 'minion', '1')],
                }),
            },
            bases: [makeBase('base_locker_room', [
                makeMinion('dragon', 'all_stars_imperial_dragon', '0', 3),
                makeMinion('ally', 'all_stars_fan', '0', 2),
            ])],
        });

        const locker = triggerBaseAbilityWithMS('base_locker_room', 'onTurnStart', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 90,
        });
        expect(applyEvents(core, locker.events).players['0'].hand.map(card => card.uid)).toEqual(['locker-draw']);

        const stadiumCore = {
            ...core,
            bases: [makeBase('base_stadium', [
                makeMinion('victim', 'sheep_flock', '1', 2),
            ])],
        };
        const destroyedAtStadium = resolveDestroyedMinions(
            makeMatchState(stadiumCore),
            '0',
            [{
                minionUid: 'victim',
                minionDefId: 'sheep_flock',
                fromBaseIndex: 0,
                ownerId: '1',
                destroyerId: '0',
                reason: 'test_destroy',
                timestamp: 91,
            }],
            FIXED_RANDOM,
            91,
        );
        const stadiumQueued = destroyedAtStadium.events.find(event => event.type === SU_EVENTS.TRIGGER_QUEUED) as any;
        expect(stadiumQueued?.payload?.triggers?.[0]).toMatchObject({ sourceDefId: 'base_stadium' });
        const stadiumResolved = maybeResolveReactionQueue(
            makeMatchState({
                ...stadiumCore,
                triggerQueue: stadiumQueued.payload.triggers,
            } as any),
            FIXED_RANDOM,
            91,
        );
        const stadiumChosen = respondToPromptOption(
            stadiumResolved!.state,
            option => option.value?.triggerId === stadiumQueued.payload.triggers[0].id,
            'choose Stadium optional reaction',
            '1',
            FIXED_RANDOM,
        );
        expect(stadiumChosen.finalState.core.players['1'].hand.map(card => card.uid)).toEqual(['stadium-draw']);

        const dragon = fireTriggers(core, 'onMinionPlayed', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '1',
            baseIndex: 0,
            triggerMinionUid: 'entrant',
            triggerMinionDefId: 'sheep_flock',
            random: FIXED_RANDOM,
            now: 92,
        });
        expect(applyEvents(core, dragon.events).players['0'].hand.map(card => card.uid)).toEqual(['locker-draw']);
    });
});
