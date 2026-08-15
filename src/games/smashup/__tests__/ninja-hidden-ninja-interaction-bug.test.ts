/**
 * 便衣忍者交互创建失败 Bug 回归。
 *
 * 不变量：在 Me First! 窗口打出便衣忍者后，如果玩家手牌里有可打出的随从，
 * 必须创建 `ninja_hidden_ninja` prompt，而不是只记录 specialLimitUsed 后静默结束。
 */

import { beforeAll, describe, expect, it } from 'vitest';
import { initAllAbilities, resetAbilityInit } from '../abilities';
import { SU_COMMANDS } from '../domain/types';
import { createScoringBaseRef, createScoringSession, setScoringSession } from '../domain/scoringSession';
import { startSmashUpReactionSession } from '../domain/reactionSession';
import {
    getPromptOptions,
    getPromptSourceId,
    getSimpleChoicePrompt,
    makeBase,
    makeCard,
    makeMatchState,
    makeMinion,
    makePlayer,
    makeState,
} from './helpers';
import { runCommand } from './testRunner';

beforeAll(() => {
    resetAbilityInit();
    initAllAbilities();
});

function makeMeFirstState() {
    const core = makeState({
        players: {
            '0': makePlayer('0', {
                factions: ['ninjas', 'pirates'] as [string, string],
                hand: [
                    makeCard('c23', 'ninja_tiger_assassin', 'minion', '0'),
                    makeCard('c28', 'ninja_acolyte', 'minion', '0'),
                    makeCard('c35', 'ninja_hidden_ninja', 'action', '0'),
                ],
                minionsPlayed: 1,
                minionsPlayedPerBase: { '0': 1 },
            }),
            '1': makePlayer('1', {
                factions: ['dinosaurs', 'aliens'] as [string, string],
                minionsPlayed: 1,
                minionsPlayedPerBase: { '0': 1 },
            }),
        },
        bases: [
            makeBase('base_the_mothership', [
                makeMinion('m1', 'pirate_saucy_wench', '0', 3),
                makeMinion('opp1', 'test_minion', '1', 10),
            ]),
        ],
        scoringEligibleBaseIndices: [0],
    });
    const matchState = makeMatchState(core);
    matchState.sys.phase = 'scoreBases';
    const baseRef = createScoringBaseRef(core, 0);
    if (!baseRef) {
        throw new Error('无法构造便衣忍者 Me First 回归测试的基地引用');
    }
    const scoringState = setScoringSession(matchState, {
        ...createScoringSession(core, [0]),
        currentBaseRef: baseRef,
        currentStep: 'awaiting-response-window',
    });
    return startSmashUpReactionSession(scoringState, {
        frameId: 'score-before:0:hidden-ninja-interaction-bug',
        frameKind: 'score-before',
        phase: 'optional',
        activePlayerId: '0',
        currentPlayerId: '0',
        consecutivePasses: 0,
        sourceBaseIndex: 0,
        responseWindowType: 'meFirst',
    });
}

describe('便衣忍者交互创建 Bug', () => {
    it('Me First 窗口中打出后会创建手牌随从选择 prompt', () => {
        const result = runCommand(makeMeFirstState(), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: {
                cardUid: 'c35',
                targetBaseIndex: 0,
            },
        } as any);

        expect(result.success).toBe(true);
        expect(result.finalState.core.specialLimitUsed).toEqual({ ninja_hidden_ninja: [0] });

        const prompt = getSimpleChoicePrompt(result.finalState, 'ninja_hidden_ninja');
        expect(getPromptSourceId(prompt)).toBe('ninja_hidden_ninja');
        expect(prompt.playerId).toBe('0');
        expect(getPromptOptions(prompt).map(option => option.value?.cardUid)).toEqual(
            expect.arrayContaining(['c23', 'c28']),
        );
    });
});
