/**
 * 大杀四方 - onDestroy 机制专项测试
 *
 * 覆盖：
 * - onDestroy 消灭事件后处理管线
 * - onDestroy 与基地 onMinionDestroyed 联动
 */

import { beforeAll, describe, expect, it } from 'vitest';
import type { RandomFn } from '../../../../engine/types';
import { initAllAbilities, resetAbilityInit } from '../../abilities';
import { clearRegistry } from '../../domain/abilityRegistry';
import { clearBaseAbilityRegistry } from '../../domain/baseAbilities';
import type { SmashUpCore } from '../../domain/types';
import { SU_COMMANDS, SU_EVENTS } from '../../domain/types';
import {
    getPromptOption,
    getSimpleChoicePrompt,
    makeCard,
    makeMatchState,
    makeMinion,
    makePlayer,
    makeState,
    respondToPrompt,
} from '../helpers';
import { runCommand } from '../testRunner';

beforeAll(() => {
    clearRegistry();
    clearBaseAbilityRegistry();
    resetAbilityInit();
    initAllAbilities();
});

const defaultRandom: RandomFn = {
    shuffle: (arr: any[]) => [...arr],
    random: () => 0.5,
    d: (_max: number) => 1,
    range: (_min: number, _max: number) => _min,
};

function runAction(core: SmashUpCore, command: { type: string; playerId: string; payload: any }) {
    const result = runCommand(makeMatchState(core), command as any, defaultRandom);
    expect(result.success, result.error).toBe(true);
    return result.events;
}

function playBearNecessitiesAndDestroyMinion(core: SmashUpCore, minionUid: string, playerId = '0') {
    const playResult = runCommand(
        makeMatchState(core),
        {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId,
            payload: { cardUid: 'c1' },
        } as any,
        defaultRandom,
    );
    expect(playResult.success, playResult.error).toBe(true);
    expect(playResult.events.some(event => event.type === SU_EVENTS.MINION_DESTROYED)).toBe(false);

    const prompt = getSimpleChoicePrompt(playResult.finalState, 'bear_cavalry_bear_necessities');
    const option = getPromptOption(
        prompt,
        entry => entry?.value?.type === 'minion' && entry?.value?.uid === minionUid,
        `bear necessities target option for ${minionUid}`,
    );
    const respondResult = respondToPrompt(playResult.finalState, option.id, playerId, defaultRandom);
    expect(respondResult.success, respondResult.error).toBe(true);
    return [...playResult.events, ...respondResult.events];
}

describe('onDestroy 基础设施', () => {
    it('bear_cavalry_bear_necessities 不应把自己控制但真实 owner 不同的 borrowed ongoing 当成对手行动目标', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('c1', 'bear_cavalry_bear_necessities', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'base_a',
                minions: [],
                ongoingActions: [{
                    uid: 'borrowed-ongoing',
                    defId: 'trickster_hideout_pod',
                    ownerId: '1',
                    metadata: {
                        sourcePlayerId: '0',
                        sourceControllerId: '0',
                    },
                } as any],
            }],
        });

        const events = runAction(core, {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'c1' },
        });

        expect(events.some(event => event.type === SU_EVENTS.ACTION_PLAYED)).toBe(true);
        expect(events.some(event => event.type === SU_EVENTS.ONGOING_DETACHED)).toBe(false);
        expect(
            events.some(
                event => event.type === SU_EVENTS.ABILITY_FEEDBACK
                    && (event as any).payload?.messageKey === 'feedback.no_valid_targets',
            ),
        ).toBe(true);
    });

    it('消灭无 onDestroy 能力的随从不产生额外事件（单目标自动执行）', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('c1', 'bear_cavalry_bear_necessities', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'base_a',
                minions: [
                    makeMinion('m1', 'test_minion', '1', 1),
                ],
                ongoingActions: [],
            }],
        });

        const events = playBearNecessitiesAndDestroyMinion(core, 'm1');

        const types = events.map(e => e.type);
        expect(types).toContain(SU_EVENTS.ACTION_PLAYED);
        expect(types).toContain(SU_EVENTS.MINION_DESTROYED);
        const destroyIdx = types.indexOf(SU_EVENTS.MINION_DESTROYED);
        const afterDestroy = events.slice(destroyIdx + 1);
        const abilityEvents = afterDestroy.filter(e =>
            e.type === SU_EVENTS.CARDS_DRAWN || e.type === SU_EVENTS.CARDS_DISCARDED
        );
        expect(abilityEvents.length).toBe(0);
    });

    it('onDestroy 与基地 onMinionDestroyed 同时触发', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('c1', 'bear_cavalry_bear_necessities', 'action', '0')],
                }),
                '1': makePlayer('1', {
                    deck: [makeCard('d1', 'test_card', 'minion', '1')],
                }),
            },
            bases: [{
                defId: 'base_cave_of_shinies',
                minions: [
                    makeMinion('gremlin', 'trickster_gremlin', '1', 2, { powerModifier: 0 }),
                ],
                ongoingActions: [],
            }],
        });

        const events = playBearNecessitiesAndDestroyMinion(core, 'gremlin');

        const types = events.map(e => e.type);
        expect(types).toContain(SU_EVENTS.MINION_DESTROYED);
        expect(types).toContain(SU_EVENTS.CARDS_DRAWN);
        expect(types).toContain(SU_EVENTS.VP_AWARDED);
        const vpEvt = events.find(e => e.type === SU_EVENTS.VP_AWARDED) as any;
        expect(vpEvt?.payload?.playerId).toBe('1');
    });
});
