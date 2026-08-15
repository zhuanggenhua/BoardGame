import { beforeEach, describe, expect, it } from 'vitest';
import { initAllAbilities, resetAbilityInit } from '../abilities';
import { SU_COMMANDS } from '../domain/types';
import { createScoringBaseRef, createScoringSession, setScoringSession } from '../domain/scoringSession';
import { startSmashUpReactionSession } from '../domain/reactionSession';
import {
    getPromptOption,
    getPromptSourceId,
    makeBase,
    makeCard,
    makeMatchState,
    makeMinion,
    makePlayer,
    makeState,
    resolveInteractionChain,
} from './helpers';
import { runCommand } from './testRunner';

beforeEach(() => {
    resetAbilityInit();
    initAllAbilities();
});

function createScoreBasesMeFirstState() {
    const core = makeState({
        players: {
            '0': makePlayer('0', {
                factions: ['ninjas', 'pirates'] as [string, string],
                hand: [
                    makeCard('hidden', 'ninja_hidden_ninja', 'action', '0'),
                    makeCard('tiger', 'ninja_tiger_assassin', 'minion', '0'),
                ],
            }),
            '1': makePlayer('1'),
        },
        turnOrder: ['0', '1'],
        currentPlayerIndex: 0,
        bases: [
            makeBase('base_ninja_dojo', [
                makeMinion('enemy', 'pirate_first_mate', '1', 2),
            ]),
        ],
        scoringEligibleBaseIndices: [0],
    });
    const matchState = makeMatchState(core);
    matchState.sys.phase = 'scoreBases';
    const baseRef = createScoringBaseRef(core, 0);
    if (!baseRef) {
        throw new Error('无法构造 Hidden Ninja 计分窗口测试的基地引用');
    }
    const scoringState = setScoringSession(matchState, {
        ...createScoringSession(core, [0]),
        currentBaseRef: baseRef,
        currentStep: 'awaiting-response-window',
    });
    return startSmashUpReactionSession(scoringState, {
        frameId: 'score-before:0:hidden-ninja',
        frameKind: 'score-before',
        phase: 'optional',
        activePlayerId: '0',
        currentPlayerId: '0',
        consecutivePasses: 0,
        sourceBaseIndex: 0,
        responseWindowType: 'meFirst',
    });
}

describe('忍者计分窗口打出随从 onPlay 回归', () => {
    it('便衣忍者在 scoreBases 窗口打出猛虎刺客后，会继续触发猛虎刺客的 onPlay 消灭', () => {
        const play = runCommand(createScoreBasesMeFirstState(), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'hidden', targetBaseIndex: 0 },
        } as any);
        expect(play.success, play.error).toBe(true);

        const resolved = resolveInteractionChain(play.finalState, (prompt) => {
            const sourceId = getPromptSourceId(prompt);
            if (sourceId === 'ninja_hidden_ninja') {
                const tiger = getPromptOption(prompt, option => option.value?.cardUid === 'tiger', 'Hidden Ninja tiger option');
                return { optionId: tiger.id };
            }
            if (sourceId === 'ninja_tiger_assassin') {
                const enemy = getPromptOption(prompt, option => option.value?.minionUid === 'enemy', 'Tiger Assassin enemy option');
                return { optionId: enemy.id };
            }
            throw new Error(`unexpected prompt source: ${String(sourceId)}`);
        });

        expect(resolved.finalState.core.bases[0].minions.some(minion => minion.uid === 'enemy')).toBe(false);
        expect(resolved.finalState.core.bases[0].minions.some(minion => minion.uid === 'tiger')).toBe(true);
    });
});
