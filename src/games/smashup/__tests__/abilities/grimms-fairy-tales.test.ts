import { beforeEach, describe, expect, it } from 'vitest';
import { initAllAbilities, resetAbilityInit } from '../../abilities';
import { GRIMMS_FAIRY_TALES_BASES, GRIMMS_FAIRY_TALES_CARDS } from '../../data/factions/grimms_fairy_tales';
import { getMinionPower } from '../../domain/abilityHelpers';
import { collectTriggers } from '../../domain/ongoingEffects';
import { maybeResolveReactionQueue } from '../../domain/reactionQueue';
import { SU_EVENTS } from '../../domain/types';
import {
    applyEvents,
    expectRegisteredAbilityContract,
    expectRegisteredInteractionHandlerContract,
    getSimpleChoicePrompt,
    invokeRegisteredAbilityContract,
    makeBase,
    makeCard,
    makeMatchState,
    makeMinion,
    makePlayer,
    makeState,
    resolveDestroyedMinions,
    respondToPromptOption,
    respondToPromptOptions,
    triggerBaseAbilityWithMS,
} from '../helpers';

const FIXED_RANDOM = {
    random: () => 0,
    d: () => 1,
    range: (min: number) => min,
    shuffle: <T>(items: T[]) => [...items],
};

describe('格林童话代表性玩法行为', () => {
    beforeEach(() => {
        resetAbilityInit();
        initAllAbilities();
    });

    it('静态牌组合同保持 18 张唯一卡面、20 张实体牌和 2 张基地', () => {
        expect(GRIMMS_FAIRY_TALES_CARDS).toHaveLength(18);
        expect(GRIMMS_FAIRY_TALES_CARDS.reduce((total, card) => total + card.count, 0)).toBe(20);
        expect(GRIMMS_FAIRY_TALES_CARDS.map(card => card.previewRef?.index).sort((a, b) => Number(a) - Number(b))).toEqual(
            Array.from({ length: 18 }, (_, index) => index + 13),
        );
        expect(GRIMMS_FAIRY_TALES_BASES.map(base => base.id).sort()).toEqual([
            'base_gingerbread_house',
            'base_woodland_cottage',
        ]);
    });

    it('格林童话本批 L2 能力入口与交互续算已注册', () => {
        const registrations = [
            ['grimms_fairy_tales_fairy_godmothers_blessing', 'onPlay'],
            ['grimms_fairy_tales_another_story', 'onPlay'],
            ['grimms_fairy_tales_breadcrumbs', 'onPlay'],
            ['grimms_fairy_tales_mouse_bird_and_sausage', 'onPlay'],
            ['grimms_fairy_tales_basket_of_goodies', 'onPlay'],
            ['grimms_fairy_tales_big_bad_wolf', 'onPlay'],
            ['grimms_fairy_tales_rumpelstiltskin', 'onPlay'],
            ['grimms_fairy_tales_prince_charming', 'talent'],
            ['grimms_fairy_tales_charming_princess', 'talent'],
        ] as const;

        for (const [defId, tag] of registrations) {
            expect(expectRegisteredAbilityContract(defId, tag), `${defId}::${tag}`).toBeTypeOf('function');
        }

        for (const sourceId of [
            'grimms_fairy_tales_fairy_godmothers_blessing',
            'grimms_fairy_tales_another_story',
            'grimms_fairy_tales_breadcrumbs',
            'grimms_fairy_tales_breadcrumbs_destination',
            'grimms_fairy_tales_mouse_bird_and_sausage',
            'grimms_fairy_tales_big_bad_wolf',
            'grimms_fairy_tales_big_bad_wolf_destroyed',
            'grimms_fairy_tales_the_frog_prince',
            'base_gingerbread_house',
            'base_woodland_cottage',
        ]) {
            expect(expectRegisteredInteractionHandlerContract(sourceId), sourceId).toBeTypeOf('function');
        }
    });

    it('汉瑟/格雷特、另一个白雪公主/红玫瑰与小红帽持续力量按条件生效', () => {
        const core = makeState({
            bases: [
                makeBase('base_gingerbread_house', [
                    makeMinion('hansel', 'grimms_fairy_tales_hansel', '0', 2),
                    makeMinion('gretel', 'grimms_fairy_tales_gretel', '0', 2),
                ]),
                makeBase('base_woodland_cottage', [
                    makeMinion('snow', 'grimms_fairy_tales_the_other_snow_white', '0', 2),
                    makeMinion('rose', 'grimms_fairy_tales_rose_red', '0', 2),
                ]),
                makeBase('test_base', [
                    makeMinion('hood', 'grimms_fairy_tales_red_riding_hood', '0', 3),
                    makeMinion('ally', 'test_minion', '0', 2),
                    makeMinion('enemy', 'test_minion', '1', 2),
                ]),
            ],
        });

        expect(getMinionPower(core, core.bases[0].minions[0], 0)).toBe(4);
        expect(getMinionPower(core, core.bases[0].minions[1], 0)).toBe(4);
        expect(getMinionPower(core, core.bases[1].minions[0], 1)).toBe(4);
        expect(getMinionPower(core, core.bases[1].minions[1], 1)).toBe(4);
        expect(getMinionPower(core, core.bases[2].minions[0], 2)).toBe(4);
        expect(getMinionPower(core, core.bases[2].minions[1], 2)).toBe(3);
        expect(getMinionPower(core, core.bases[2].minions[2], 2)).toBe(2);

        const wolfCore = makeState({
            bases: [
                core.bases[2],
                makeBase('test_base', [makeMinion('wolf', 'grimms_fairy_tales_big_bad_wolf', '0', 6)]),
            ],
        });
        expect(getMinionPower(wolfCore, wolfCore.bases[0].minions[1], 0)).toBe(2);
    });

    it('仙女教母的祝福从牌库选择随从放到牌库顶', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    deck: [
                        makeCard('action-1', 'grimms_fairy_tales_another_story', 'action', '0'),
                        makeCard('minion-1', 'grimms_fairy_tales_hansel', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
        });
        const result = invokeRegisteredAbilityContract('grimms_fairy_tales_fairy_godmothers_blessing', 'onPlay', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'blessing',
            defId: 'grimms_fairy_tales_fairy_godmothers_blessing',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 10,
        });

        expect(result.events.some(event => event.type === SU_EVENTS.DECK_INSPECTED)).toBe(true);
        const selected = respondToPromptOption(
            result.matchState!,
            option => option.value?.cardUid === 'minion-1',
            'choose minion from deck',
            '0',
            FIXED_RANDOM,
        );

        expect(selected.finalState.core.players['0'].deck.map(card => card.uid)).toEqual(['minion-1', 'action-1']);
    });

    it('另一个故事在有合法弃牌时允许跳过，也能把至多三张弃牌洗回牌库', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    deck: [makeCard('deck-1', 'grimms_fairy_tales_hansel', 'minion', '0')],
                    discard: [
                        makeCard('discard-1', 'grimms_fairy_tales_gretel', 'minion', '0'),
                        makeCard('discard-2', 'grimms_fairy_tales_basket_of_goodies', 'action', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
        });

        const skipResult = invokeRegisteredAbilityContract('grimms_fairy_tales_another_story', 'onPlay', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'story',
            defId: 'grimms_fairy_tales_another_story',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 20,
        });
        const skipped = respondToPromptOption(skipResult.matchState!, option => option.value?.skip === true, 'skip 另一个故事', '0', FIXED_RANDOM);
        expect(skipped.finalState.core.players['0'].deck.map(card => card.uid)).toEqual(['deck-1']);
        expect(skipped.finalState.core.players['0'].discard.map(card => card.uid)).toEqual(['discard-1', 'discard-2']);

        const playResult = invokeRegisteredAbilityContract('grimms_fairy_tales_another_story', 'onPlay', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'story',
            defId: 'grimms_fairy_tales_another_story',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 21,
        });
        const prompt = getSimpleChoicePrompt(playResult.matchState!, 'grimms_fairy_tales_another_story');
        const selectedIds = prompt.options
            .filter((option: any) => ['discard-1', 'discard-2'].includes(option.value?.cardUid))
            .map((option: any) => option.id);
        const resolved = respondToPromptOptions(playResult.matchState!, selectedIds, '0', FIXED_RANDOM);

        expect(resolved.finalState.core.players['0'].deck.map(card => card.uid)).toEqual(['deck-1', 'discard-1', 'discard-2']);
        expect(resolved.finalState.core.players['0'].discard).toEqual([]);
    });

    it('面包屑能把同一基地至多两个己方随从移动到另一个基地', () => {
        const core = makeState({
            bases: [
                makeBase('base_gingerbread_house', [
                    makeMinion('hansel', 'grimms_fairy_tales_hansel', '0', 2),
                    makeMinion('gretel', 'grimms_fairy_tales_gretel', '0', 2),
                ]),
                makeBase('base_woodland_cottage'),
            ],
        });
        const result = invokeRegisteredAbilityContract('grimms_fairy_tales_breadcrumbs', 'onPlay', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'breadcrumbs',
            defId: 'grimms_fairy_tales_breadcrumbs',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 30,
        });
        const prompt = getSimpleChoicePrompt(result.matchState!, 'grimms_fairy_tales_breadcrumbs');
        const selectedIds = prompt.options
            .filter((option: any) => ['hansel', 'gretel'].includes(option.value?.minionUid))
            .map((option: any) => option.id);
        const choseMinions = respondToPromptOptions(result.matchState!, selectedIds, '0', FIXED_RANDOM);
        const moved = respondToPromptOption(
            choseMinions.finalState,
            option => option.value?.baseIndex === 1,
            'choose destination base',
            '0',
            FIXED_RANDOM,
        );

        expect(moved.finalState.core.bases[0].minions).toEqual([]);
        expect(moved.finalState.core.bases[1].minions.map(minion => minion.uid).sort()).toEqual(['gretel', 'hansel']);
    });

    it('老鼠、鸟和香肠给同一基地同派系的至多两个随从临时 +2', () => {
        const core = makeState({
            bases: [
                makeBase('base_gingerbread_house', [
                    makeMinion('hansel', 'grimms_fairy_tales_hansel', '0', 2),
                    makeMinion('gretel', 'grimms_fairy_tales_gretel', '0', 2),
                    makeMinion('enemy', 'pirate_first_mate', '1', 2),
                ]),
            ],
        });
        const result = invokeRegisteredAbilityContract('grimms_fairy_tales_mouse_bird_and_sausage', 'onPlay', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'sausage',
            defId: 'grimms_fairy_tales_mouse_bird_and_sausage',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 40,
        });
        const prompt = getSimpleChoicePrompt(result.matchState!, 'grimms_fairy_tales_mouse_bird_and_sausage');
        const selectedIds = prompt.options
            .filter((option: any) => ['hansel', 'gretel'].includes(option.value?.minionUid))
            .map((option: any) => option.id);
        const resolved = respondToPromptOptions(result.matchState!, selectedIds, '0', FIXED_RANDOM);

        expect(resolved.finalState.core.bases[0].minions.find(minion => minion.uid === 'hansel')?.tempPowerModifier).toBe(2);
        expect(resolved.finalState.core.bases[0].minions.find(minion => minion.uid === 'gretel')?.tempPowerModifier).toBe(2);
        expect(resolved.finalState.core.bases[0].minions.find(minion => minion.uid === 'enemy')?.tempPowerModifier ?? 0).toBe(0);
    });

    it('白马王子和迷人的公主在同基地互相满足天赋条件', () => {
        const core = makeState({
            bases: [
                makeBase('base_gingerbread_house', [
                    makeMinion('prince', 'grimms_fairy_tales_prince_charming', '0', 4),
                    makeMinion('princess', 'grimms_fairy_tales_charming_princess', '0', 4),
                ]),
            ],
        });

        const prince = invokeRegisteredAbilityContract('grimms_fairy_tales_prince_charming', 'talent', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'prince',
            defId: 'grimms_fairy_tales_prince_charming',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 50,
        });
        expect(prince.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.LIMIT_MODIFIED,
            payload: expect.objectContaining({ playerId: '0', limitType: 'action', delta: 1 }),
        }));

        const princess = invokeRegisteredAbilityContract('grimms_fairy_tales_charming_princess', 'talent', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'princess',
            defId: 'grimms_fairy_tales_charming_princess',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 51,
        });
        expect(princess.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.LIMIT_MODIFIED,
            payload: expect.objectContaining({ playerId: '0', limitType: 'minion', delta: 1, restrictToBase: 0 }),
        }));
    });

    it('大灰狼在小红帽不在场时可消灭这里力量 4 或以下的随从', () => {
        const core = makeState({
            bases: [
                makeBase('base_gingerbread_house', [
                    makeMinion('wolf', 'grimms_fairy_tales_big_bad_wolf', '0', 6),
                    makeMinion('target', 'grimms_fairy_tales_hansel', '1', 2),
                    makeMinion('large', 'grimms_fairy_tales_prince_charming', '1', 5),
                ]),
            ],
        });
        const result = invokeRegisteredAbilityContract('grimms_fairy_tales_big_bad_wolf', 'onPlay', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'wolf',
            defId: 'grimms_fairy_tales_big_bad_wolf',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 55,
        });
        const prompt = getSimpleChoicePrompt(result.matchState!, 'grimms_fairy_tales_big_bad_wolf');
        expect(prompt.options.some((option: any) => option.value?.minionUid === 'large')).toBe(false);

        const destroyed = respondToPromptOption(
            result.matchState!,
            option => option.value?.minionUid === 'target',
            'destroy power 4 or lower minion',
            '0',
            FIXED_RANDOM,
        );
        expect(destroyed.finalState.core.bases[0].minions.map(minion => minion.uid)).not.toContain('target');
        expect(destroyed.finalState.core.players['1'].discard.map(card => card.uid)).toContain('target');

        const blockedByHood = invokeRegisteredAbilityContract('grimms_fairy_tales_big_bad_wolf', 'onPlay', {
            state: makeState({
                bases: [
                    makeBase('base_gingerbread_house', [
                        makeMinion('wolf', 'grimms_fairy_tales_big_bad_wolf', '0', 6),
                        makeMinion('hood', 'grimms_fairy_tales_red_riding_hood', '1', 3),
                        makeMinion('target', 'grimms_fairy_tales_hansel', '1', 2),
                    ]),
                ],
            }),
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'wolf',
            defId: 'grimms_fairy_tales_big_bad_wolf',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 56,
        });
        expect(blockedByHood.events).toEqual([]);
        expect(blockedByHood.matchState).toBeUndefined();
    });

    it('大灰狼被消灭后会从弃牌堆额外打出另一个随从到原基地', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    discard: [makeCard('discard-hansel', 'grimms_fairy_tales_hansel', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base_gingerbread_house', [
                    makeMinion('wolf', 'grimms_fairy_tales_big_bad_wolf', '0', 6),
                ]),
            ],
        });
        const processed = resolveDestroyedMinions(
            makeMatchState(core),
            '0',
            [{
                minionUid: 'wolf',
                minionDefId: 'grimms_fairy_tales_big_bad_wolf',
                fromBaseIndex: 0,
                ownerId: '0',
                destroyerId: '1',
                reason: 'test_destroy',
            }],
            FIXED_RANDOM,
            57,
        );
        const stateWithPrompt = {
            ...(processed.matchState ?? makeMatchState(core)),
            core: applyEvents(core, processed.events),
        };
        const played = respondToPromptOption(
            stateWithPrompt!,
            option => option.value?.cardUid === 'discard-hansel',
            'play discard minion after 大灰狼 destroyed',
            '0',
            FIXED_RANDOM,
        );

        expect(played.finalState.core.bases[0].minions.map(minion => minion.uid)).toEqual(['discard-hansel']);
        expect(played.finalState.core.players['0'].discard.map(card => card.uid)).toEqual(['wolf']);
    });

    it('青蛙王子见证你在同基地打出另一个随从后，可洗回牌库并从弃牌堆额外打出随从', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    deck: [makeCard('deck-card', 'grimms_fairy_tales_basket_of_goodies', 'action', '0')],
                    discard: [makeCard('discard-gretel', 'grimms_fairy_tales_gretel', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base_gingerbread_house', [
                    makeMinion('frog', 'grimms_fairy_tales_the_frog_prince', '0', 3),
                    makeMinion('played', 'grimms_fairy_tales_hansel', '0', 2),
                ]),
            ],
        });
        const queued = collectTriggers(core, 'onMinionPlayed', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            baseIndex: 0,
            triggerMinionUid: 'played',
            triggerMinionDefId: 'grimms_fairy_tales_hansel',
            triggerMinion: core.bases[0].minions[1],
            random: FIXED_RANDOM,
            now: 65,
        });
        expect(queued?.payload.triggers.map(trigger => trigger.sourceDefId)).toContain('grimms_fairy_tales_the_frog_prince');

        const prompted = maybeResolveReactionQueue(
            makeMatchState({ ...core, triggerQueue: queued!.payload.triggers } as any),
            FIXED_RANDOM,
            66,
        );
        const selectedTrigger = respondToPromptOption(
            prompted!.state,
            option => option.value?.triggerId === queued!.payload.triggers[0].id,
            'choose 青蛙王子 trigger',
            '0',
            FIXED_RANDOM,
        );
        const played = respondToPromptOption(
            selectedTrigger.finalState,
            option => option.value?.cardUid === 'discard-gretel',
            'play discard minion with 青蛙王子',
            '0',
            FIXED_RANDOM,
        );

        expect(played.finalState.core.bases[0].minions.map(minion => minion.uid).sort()).toEqual(['discard-gretel', 'played'].sort());
        expect(played.finalState.core.players['0'].deck.map(card => card.uid).sort()).toEqual(['deck-card', 'frog'].sort());
        expect(played.finalState.core.players['0'].discard).toEqual([]);
    });

    it('姜饼屋计分前可让两个同力量己方随从直到回合结束各 +2', () => {
        const core = makeState({
            bases: [
                makeBase('base_gingerbread_house', [
                    makeMinion('left', 'grimms_fairy_tales_prince_charming', '0', 4),
                    makeMinion('right', 'grimms_fairy_tales_charming_princess', '0', 4),
                    makeMinion('enemy', 'pirate_first_mate', '1', 2),
                ]),
            ],
        });
        const result = triggerBaseAbilityWithMS('base_gingerbread_house', 'beforeScoring', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            baseIndex: 0,
            baseDefId: 'base_gingerbread_house',
            random: FIXED_RANDOM,
            now: 60,
        });
        const resolved = respondToPromptOption(result.matchState!, option => option.value?.minionUids?.includes('left'), 'choose same-power pair', '0', FIXED_RANDOM);

        expect(resolved.finalState.core.bases[0].minions.find(minion => minion.uid === 'left')?.tempPowerModifier).toBe(2);
        expect(resolved.finalState.core.bases[0].minions.find(minion => minion.uid === 'right')?.tempPowerModifier).toBe(2);
        expect(resolved.finalState.core.bases[0].minions.find(minion => minion.uid === 'enemy')?.tempPowerModifier ?? 0).toBe(0);
    });

    it('林中小屋在你于此打出随从后每回合一次可检索力量 3 或以下随从进手牌', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    deck: [
                        makeCard('small', 'grimms_fairy_tales_hansel', 'minion', '0'),
                        makeCard('large', 'grimms_fairy_tales_big_bad_wolf', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base_woodland_cottage', [
                    makeMinion('played', 'pirate_first_mate', '0', 2),
                ]),
            ],
        });
        const result = triggerBaseAbilityWithMS('base_woodland_cottage', 'onMinionPlayed', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            baseIndex: 0,
            baseDefId: 'base_woodland_cottage',
            minionUid: 'played',
            minionDefId: 'pirate_first_mate',
            minionPower: 2,
            random: FIXED_RANDOM,
            now: 70,
        });
        const resolved = respondToPromptOption(result.matchState!, option => option.value?.cardUid === 'small', 'choose small minion', '0', FIXED_RANDOM);

        expect(resolved.finalState.core.players['0'].hand.map(card => card.uid)).toEqual(['small']);
        expect(resolved.finalState.core.players['0'].deck.map(card => card.uid)).toEqual(['large']);
        expect(resolved.finalState.core.bases[0].metadata?.woodlandCottageUsedTurn_0).toBe(1);

        const second = triggerBaseAbilityWithMS('base_woodland_cottage', 'onMinionPlayed', {
            state: resolved.finalState.core,
            matchState: resolved.finalState,
            playerId: '0',
            baseIndex: 0,
            baseDefId: 'base_woodland_cottage',
            minionUid: 'played-2',
            minionDefId: 'pirate_first_mate',
            minionPower: 2,
            random: FIXED_RANDOM,
            now: 71,
        });
        expect(second.events).toEqual([]);
        expect(second.matchState).toBeUndefined();
    });
    it('格林兄弟的祝福激活后可作为缺失搭档名参与持续力量判断', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    deck: [makeCard('owned-gretel', 'grimms_fairy_tales_gretel', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase({
                    defId: 'base_gingerbread_house',
                    minions: [
                        makeMinion('hansel', 'grimms_fairy_tales_hansel', '0', 2),
                        makeMinion('ally', 'pirate_first_mate', '0', 2),
                    ],
                    ongoingActions: [{ uid: 'blessing', defId: 'grimms_fairy_tales_grimms_blessing', ownerId: '0' }],
                }),
            ],
        });

        expect(getMinionPower(core, core.bases[0].minions[0], 0)).toBe(4);
    });

    it('樵夫的斧子可销毁打在基地上的行动并给予额外行动', () => {
        const core = makeState({
            bases: [
                makeBase({
                    defId: 'base_gingerbread_house',
                    minions: [],
                    ongoingActions: [{ uid: 'ongoing-action', defId: 'grimms_fairy_tales_grimms_blessing', ownerId: '1' }],
                }),
            ],
        });
        const result = invokeRegisteredAbilityContract('grimms_fairy_tales_the_woodsmans_axe', 'onPlay', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'axe',
            defId: 'grimms_fairy_tales_the_woodsmans_axe',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 80,
        });
        const resolved = respondToPromptOption(result.matchState!, option => option.value?.actionUid === 'ongoing-action', 'destroy base action', '0', FIXED_RANDOM);

        expect(resolved.finalState.core.bases[0].ongoingActions).toEqual([]);
        expect(resolved.finalState.core.players['0'].actionLimit).toBe(2);
    });

    it('樵夫的斧子可销毁大灰狼并从牌库额外打出随从到同一基地', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    deck: [makeCard('deck-hansel', 'grimms_fairy_tales_hansel', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base_gingerbread_house', [
                    makeMinion('wolf', 'grimms_fairy_tales_big_bad_wolf', '1', 6),
                ]),
            ],
        });
        const result = invokeRegisteredAbilityContract('grimms_fairy_tales_the_woodsmans_axe', 'onPlay', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'axe',
            defId: 'grimms_fairy_tales_the_woodsmans_axe',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 81,
        });
        const destroyedWolf = respondToPromptOption(result.matchState!, option => option.value?.minionUid === 'wolf', 'destroy 大灰狼', '0', FIXED_RANDOM);
        expect(destroyedWolf.finalState.core.bases[0].minions.map(minion => minion.uid)).not.toContain('wolf');

        const played = respondToPromptOption(
            destroyedWolf.finalState,
            option => option.value?.cardUid === 'deck-hansel',
            'play deck minion after 樵夫的斧子',
            '0',
            FIXED_RANDOM,
        );

        expect(played.finalState.core.bases[0].minions.map(minion => minion.uid)).toEqual(['deck-hansel']);
        expect(played.finalState.core.players['0'].deck).toEqual([]);
    });

    it('团队合作可按所选随从能力文字中的名字检索并额外打出匹配随从', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    deck: [makeCard('deck-gretel', 'grimms_fairy_tales_gretel', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base_gingerbread_house', [
                    makeMinion('hansel', 'grimms_fairy_tales_hansel', '0', 2),
                ]),
                makeBase('base_woodland_cottage'),
            ],
        });
        const result = invokeRegisteredAbilityContract('grimms_fairy_tales_teamwork', 'onPlay', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'teamwork',
            defId: 'grimms_fairy_tales_teamwork',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 82,
        });
        const choseMinion = respondToPromptOption(result.matchState!, option => option.value?.minionUid === 'hansel', 'choose 汉瑟', '0', FIXED_RANDOM);
        const played = respondToPromptOption(
            choseMinion.finalState,
            option => option.value?.cardUid === 'deck-gretel' && option.value?.mode === 'play' && option.value?.baseIndex === 1,
            'play matching 格雷特',
            '0',
            FIXED_RANDOM,
        );

        expect(played.finalState.core.bases[1].minions.map(minion => minion.uid)).toEqual(['deck-gretel']);
        expect(played.finalState.core.players['0'].deck).toEqual([]);
    });

    it('团队合作也可将匹配的弃牌堆随从加入手牌', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    discard: [makeCard('discard-hood', 'grimms_fairy_tales_red_riding_hood', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base_gingerbread_house', [
                    makeMinion('wolf', 'grimms_fairy_tales_big_bad_wolf', '0', 6),
                ]),
            ],
        });
        const result = invokeRegisteredAbilityContract('grimms_fairy_tales_teamwork', 'onPlay', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'teamwork',
            defId: 'grimms_fairy_tales_teamwork',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 83,
        });
        const choseMinion = respondToPromptOption(result.matchState!, option => option.value?.minionUid === 'wolf', 'choose 大灰狼', '0', FIXED_RANDOM);
        const returned = respondToPromptOption(
            choseMinion.finalState,
            option => option.value?.cardUid === 'discard-hood' && option.value?.mode === 'toHand',
            'return matching 小红帽',
            '0',
            FIXED_RANDOM,
        );

        expect(returned.finalState.core.players['0'].hand.map(card => card.uid)).toEqual(['discard-hood']);
        expect(returned.finalState.core.players['0'].discard).toEqual([]);
    });
});
