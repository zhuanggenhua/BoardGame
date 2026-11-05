import { beforeEach, describe, expect, it } from 'vitest';

import { initAllAbilities, resetAbilityInit } from '../../abilities';
import { BIG_HERO_6_CARDS } from '../../data/factions/big_hero_6';
import { FROZEN_CARDS } from '../../data/factions/frozen';
import { LION_KING_CARDS } from '../../data/factions/lion_king';
import { MULAN_CARDS } from '../../data/factions/mulan';
import { moveMinion } from '../../domain/abilityHelpers';
import { getEffectivePower, getPlayerEffectivePowerOnBase } from '../../domain/ongoingModifiers';
import { fireTriggers, getModifiedBaseVp, interceptEvent, isMinionProtected } from '../../domain/ongoingEffects';
import type { AbilityTag } from '../../domain/types';
import { SU_COMMANDS, SU_EVENTS } from '../../domain/types';
import { runCommand } from '../testRunner';
import {
    applyEvents,
    expectRegisteredAbilityContract,
    getPromptOption,
    getPromptHandlerData,
    getPromptOptions,
    getReactionPrompt,
    getReactionPromptOptionBySourceDefId,
    getSimpleChoicePrompt,
    invokeRegisteredAbilityContract,
    makeBase,
    makeCard,
    makeMatchState,
    makeMinion,
    makePlayer,
    makeState,
    respondToPrompt,
    respondToPromptOption,
    respondToPromptOptions,
} from '../helpers';

const FIXED_RANDOM = {
    random: () => 0,
    d: () => 1,
    range: (min: number) => min,
    shuffle: <T>(items: T[]) => [...items],
};

const EXECUTABLE_TAGS = new Set<AbilityTag>(['onPlay', 'talent', 'special', 'onDestroy']);
const DISNEY_CARDS = [
    ...BIG_HERO_6_CARDS,
    ...FROZEN_CARDS,
    ...LION_KING_CARDS,
    ...MULAN_CARDS,
];

describe('迪士尼四派系代表性玩法行为', () => {
    beforeEach(() => {
        resetAbilityInit();
        initAllAbilities();
    });

    it('四派系代表性主动能力入口已注册', () => {
        for (const card of DISNEY_CARDS) {
            for (const tag of card.abilityTags ?? []) {
                if (!EXECUTABLE_TAGS.has(tag)) continue;
                expect(expectRegisteredAbilityContract(card.id, tag), `${card.name}（${card.id}）::${tag}`).toBeTypeOf('function');
            }
        }
    });

    it('超能陆战队：微型机器群、新来的学生、升级、团队的努力按指示物/额外出牌结算', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    deck: [
                        makeCard('draw-1', 'frozen_snowgie', 'minion', '0'),
                        makeCard('draw-2', 'frozen_snowgie', 'minion', '0'),
                    ],
                    discard: [
                        makeCard('discarded-swarm-a', 'big_hero_6_microbot_swarm', 'minion', '0'),
                        makeCard('discarded-swarm-b', 'big_hero_6_microbot_swarm', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_sfit_robotics_lab', [
                makeMinion('swarm', 'big_hero_6_microbot_swarm', '0', 2),
                makeMinion('baymax', 'big_hero_6_baymax', '0', 3, { powerCounters: 1 }),
                makeMinion('enemy', 'frozen_snowgie', '1', 2),
            ])],
        });

        const recovered = invokeRegisteredAbilityContract('big_hero_6_microbot_swarm', 'onPlay', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'swarm',
            defId: 'big_hero_6_microbot_swarm',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 10,
        });
        expect(recovered.events).toEqual([]);
        const recoveredPrompt = getSimpleChoicePrompt(recovered.matchState!, 'disney_four_factions_prompt');
        expect(recoveredPrompt.autoResolveIfSingle).toBe(false);
        expect(getPromptOptions(recoveredPrompt).map(option => option.value?.cardUid)).toEqual(['discarded-swarm-a', 'discarded-swarm-b']);
        const recoveredSwarm = respondToPromptOption(
            recovered.matchState!,
            option => option.value?.cardUid === 'discarded-swarm-b',
            '微型机器群弃牌堆目标',
            '0',
            FIXED_RANDOM,
        );
        expect(recoveredSwarm.success, recoveredSwarm.error).toBe(true);
        expect(recoveredSwarm.finalState.core.players['0'].hand.map(card => card.uid)).toContain('discarded-swarm-b');
        expect(recoveredSwarm.finalState.core.players['0'].discard.map(card => card.uid)).toContain('discarded-swarm-a');

        const talent = invokeRegisteredAbilityContract('big_hero_6_microbot_swarm', 'talent', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'swarm',
            defId: 'big_hero_6_microbot_swarm',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 11,
        });
        const afterTalent = applyEvents(core, talent.events);
        expect(afterTalent.bases[0].minions.find(minion => minion.uid === 'swarm')?.powerCounters).toBe(1);

        const newStudent = invokeRegisteredAbilityContract('big_hero_6_new_student', 'onPlay', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'new-student',
            defId: 'big_hero_6_new_student',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 12,
        });
        expect(newStudent.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.MINION_PLAY_EFFECT_QUEUED,
            payload: expect.objectContaining({ playerId: '0', effect: 'addPowerCounter', amount: 1 }),
        }));
        expect(newStudent.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.LIMIT_MODIFIED,
            payload: expect.objectContaining({ playerId: '0', limitType: 'minion', powerMax: 3 }),
        }));

        const upgrades = invokeRegisteredAbilityContract('big_hero_6_upgrades', 'onPlay', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'upgrades',
            defId: 'big_hero_6_upgrades',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 13,
        });
        expect(upgrades.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.LIMIT_MODIFIED,
            payload: expect.objectContaining({ playerId: '0', limitType: 'action' }),
        }));
        const upgradesPrompt = getSimpleChoicePrompt(upgrades.matchState!, 'disney_four_factions_prompt');
        const upgradesTarget = getPromptOption(upgradesPrompt, option => option.value?.minionUid === 'swarm', '升级目标');
        const upgraded = respondToPromptOption(upgrades.matchState!, option => option.id === upgradesTarget.id, 'resolve upgrades', '0', FIXED_RANDOM);
        expect(upgraded.finalState.core.bases[0].minions.find(minion => minion.uid === 'swarm')?.powerCounters).toBe(2);

        const teamEffort = invokeRegisteredAbilityContract('big_hero_6_team_effort', 'onPlay', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'team-effort',
            defId: 'big_hero_6_team_effort',
            baseIndex: 0,
            targetBaseIndex: 0,
            random: FIXED_RANDOM,
            now: 14,
        });
        const teamPrompt = getSimpleChoicePrompt(teamEffort.matchState!, 'disney_four_factions_prompt');
        expect(getPromptOptions(teamPrompt)).toHaveLength(1);
        const drawn = respondToPromptOption(teamEffort.matchState!, option => option.value?.baseIndex === 0, '团队的努力基地', '0', FIXED_RANDOM);
        expect(drawn.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.CARDS_DRAWN,
            payload: expect.objectContaining({ playerId: '0', count: 1, cardUids: ['draw-1'] }),
        }));
    });

    it('超能陆战队：控制面具搜微型机器群时由玩家选择，不自动拿第一张', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    deck: [
                        makeCard('swarm-first', 'big_hero_6_microbot_swarm', 'minion', '0'),
                        makeCard('swarm-chosen', 'big_hero_6_microbot_swarm', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
        });

        const result = invokeRegisteredAbilityContract('big_hero_6_control_mask', 'onPlay', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'control-mask',
            defId: 'big_hero_6_control_mask',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 15,
        });

        const prompt = getSimpleChoicePrompt(result.matchState!, 'disney_four_factions_prompt');
        expect(prompt.autoResolveIfSingle).toBe(false);
        expect(getPromptOptions(prompt).map(option => option.value?.cardUid)).toEqual(['swarm-first', 'swarm-chosen']);

        const resolved = respondToPromptOption(
            result.matchState!,
            option => option.value?.cardUid === 'swarm-chosen',
            '控制面具选择第二张微型机器群',
            '0',
            FIXED_RANDOM,
        );

        expect(resolved.finalState.core.players['0'].hand.map(card => card.uid)).toContain('swarm-chosen');
        expect(resolved.finalState.core.players['0'].deck.map(card => card.uid)).toContain('swarm-first');
    });

    it('超能陆战队：升级从真实出牌管线打开选择后，应离开手牌并进入弃牌堆', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('hand-upgrades', 'big_hero_6_upgrades', 'action', '0')],
                    deck: [makeCard('draw-after-counter', 'frozen_snowgie', 'minion', '0')],
                    actionLimit: 1,
                    actionsPlayed: 0,
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_sfit_robotics_lab', [
                makeMinion('microbot-target', 'big_hero_6_microbot_swarm', '0', 2),
            ])],
        });

        const played = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'hand-upgrades' },
        });

        expect(played.success).toBe(true);
        expect(played.finalState.core.players['0'].hand.some(card => card.uid === 'hand-upgrades')).toBe(false);
        expect(played.finalState.core.players['0'].discard.some(card => card.uid === 'hand-upgrades')).toBe(true);
        expect(played.finalState.core.players['0'].actionsPlayed).toBe(1);
        expect(getSimpleChoicePrompt(played.finalState, 'disney_four_factions_prompt')).toBeTruthy();

        const resolved = respondToPromptOption(
            played.finalState,
            option => option.value?.minionUid === 'microbot-target',
            '升级目标微型机器群',
            '0',
            FIXED_RANDOM,
        );

        expect(resolved.success).toBe(true);
        const player0 = resolved.finalState.core.players['0'];
        expect(player0.hand.some(card => card.uid === 'hand-upgrades')).toBe(false);
        expect(player0.hand.some(card => card.uid === 'draw-after-counter')).toBe(true);
        expect(player0.discard.some(card => card.uid === 'hand-upgrades')).toBe(true);
        expect(player0.actionsPlayed).toBe(1);
        expect(player0.actionLimit).toBe(2);
        expect(resolved.finalState.core.bases[0].minions.find(minion => minion.uid === 'microbot-target')?.powerCounters).toBe(2);
        expect(resolved.finalState.sys.interaction?.current).toBeUndefined();
    });

});
