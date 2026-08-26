/**
 * afterScoring 响应窗口交互锁定测试
 *
 * 用户原始症状：同一计分窗口里有两个大副时，先点的那张大副在目标基地尚未选择前
 * 被系统推进/结束；合同要求必须完整完成当前大副的来源->目标交互后，才继续下一个大副。
 */

import { beforeAll, describe, expect, it } from 'vitest';
import { GameTestRunner } from '../../../engine/testing/GameTestRunner';
import { createInitialSystemState } from '../../../engine/pipeline';
import type { MatchState, PlayerId, RandomFn } from '../../../engine/types';
import { initAllAbilities, resetAbilityInit } from '../abilities';
import { SmashUpDomain, smashUpSystemsForTest } from '../game';
import type { SmashUpCommand, SmashUpCore, SmashUpEvent } from '../domain/types';
import {
    getPromptOption,
    getPromptOptions,
    getSimpleChoicePrompt,
    makeBase,
    makeMinion,
} from './helpers';

const PLAYER_IDS: PlayerId[] = ['0', '1'];

function createRunner(
    setupCore: (core: SmashUpCore) => void,
): GameTestRunner<SmashUpCore, SmashUpCommand, SmashUpEvent> {
    return new GameTestRunner<SmashUpCore, SmashUpCommand, SmashUpEvent>({
        domain: SmashUpDomain,
        systems: smashUpSystemsForTest,
        playerIds: PLAYER_IDS,
        setup: (ids: PlayerId[], random: RandomFn): MatchState<SmashUpCore> => {
            const core = SmashUpDomain.setup(ids, random);
            const sys = createInitialSystemState(ids, smashUpSystemsForTest, undefined);
            core.factionSelection = undefined;
            core.currentPlayerIndex = 0;
            core.turnOrder = [...PLAYER_IDS];
            sys.phase = 'playCards';
            setupCore(core);
            return { core, sys };
        },
    });
}

function resolveCurrentOption(
    runner: GameTestRunner<SmashUpCore, SmashUpCommand, SmashUpEvent>,
    optionId: string,
    playerId = '0',
) {
    const result = runner.resolveInteraction(playerId, { optionId });
    expect(result.success).toBe(true);
    return result.finalState;
}

function getReactionOptionBySourceUid(
    state: MatchState<SmashUpCore>,
    prompt: any,
    sourceUid: string,
) {
    const queueById = new Map((state.core.triggerQueue ?? []).map((trigger: any) => [trigger.id, trigger]));
    return getPromptOption(
        prompt,
        (option: any) => queueById.get(option.value?.triggerId)?.sourceCardUid === sourceUid,
        `reaction option for source uid ${sourceUid}`,
    );
}

function expectFirstMateTargetPromptFor(
    state: MatchState<SmashUpCore>,
    mateUid: string,
) {
    const prompt = getSimpleChoicePrompt(state, 'pirate_first_mate_choose_base');
    const targetOptions = getPromptOptions(prompt).filter((option: any) => !option.value?.skip);
    expect(targetOptions.length).toBeGreaterThan(0);
    for (const option of targetOptions) {
        expect(option.value?.sourceUid).toBe(mateUid);
        expect(option.value?.minionUid).toBe(mateUid);
    }
    return prompt;
}

beforeAll(() => {
    resetAbilityInit();
    initAllAbilities();
});

describe('afterScoring 响应窗口交互锁定', () => {
    it.each([
        ['mate-a', 'mate-b', 1, 2],
        ['mate-b', 'mate-a', 2, 1],
    ])('两个大副同一计分窗口内先点 %s 时，必须完整完成目标选择才继续 %s', (
        firstMateUid,
        secondMateUid,
        firstDestinationBaseIndex,
        secondDestinationBaseIndex,
    ) => {
        const runner = createRunner((core) => {
            core.bases = [
                makeBase('base_tar_pits', [
                    makeMinion('mate-a', 'pirate_first_mate', '0', 2),
                    makeMinion('mate-b', 'pirate_first_mate', '0', 2),
                    makeMinion('strong-1', 'robot_warbot', '0', 13),
                ]),
                makeBase('base_secret_garden'),
                makeBase('base_the_factory'),
            ];
            core.baseDeck = ['base_the_mothership'];
            core.players['0'].hand = [];
            core.players['1'].hand = [];
        });

        const advance = runner.dispatch('ADVANCE_PHASE', { playerId: '0' });
        expect(advance.success).toBe(true);

        let state = runner.getState();
        let reactionPrompt = getSimpleChoicePrompt(state, 'smashup_reaction_choose');
        const mateAReaction = getReactionOptionBySourceUid(state, reactionPrompt, 'mate-a');
        const mateBReaction = getReactionOptionBySourceUid(state, reactionPrompt, 'mate-b');
        expect(mateAReaction.id).not.toBe(mateBReaction.id);
        const firstMateReaction = getReactionOptionBySourceUid(state, reactionPrompt, firstMateUid);

        state = resolveCurrentOption(runner, firstMateReaction.id);
        const firstMateTargetPrompt = expectFirstMateTargetPromptFor(state, firstMateUid);
        expect(state.core.bases[0].minions.map(minion => minion.uid)).toEqual(
            expect.arrayContaining(['mate-a', 'mate-b']),
        );

        const blockedAdvance = runner.dispatch('ADVANCE_PHASE', { playerId: '0' });
        expect(blockedAdvance.success).toBe(false);
        expect(blockedAdvance.error).toBeTruthy();
        state = runner.getState();
        expectFirstMateTargetPromptFor(state, firstMateUid);
        expect(state.core.bases[0].minions.map(minion => minion.uid)).toEqual(
            expect.arrayContaining(['mate-a', 'mate-b']),
        );

        const moveFirstMate = getPromptOption(
            firstMateTargetPrompt,
            (option: any) => option.value?.baseIndex === firstDestinationBaseIndex,
            `${firstMateUid} destination option`,
        );
        state = resolveCurrentOption(runner, moveFirstMate.id);
        expect(state.core.bases[firstDestinationBaseIndex].minions.map(minion => minion.uid)).toContain(firstMateUid);

        reactionPrompt = getSimpleChoicePrompt(state, 'smashup_reaction_choose');
        const nextSecondMateReaction = getReactionOptionBySourceUid(state, reactionPrompt, secondMateUid);
        state = resolveCurrentOption(runner, nextSecondMateReaction.id);
        const secondMateTargetPrompt = expectFirstMateTargetPromptFor(state, secondMateUid);
        const moveSecondMate = getPromptOption(
            secondMateTargetPrompt,
            (option: any) => option.value?.baseIndex === secondDestinationBaseIndex,
            `${secondMateUid} destination option`,
        );
        state = resolveCurrentOption(runner, moveSecondMate.id);

        expect(state.core.bases[firstDestinationBaseIndex].minions.map(minion => minion.uid)).toContain(firstMateUid);
        expect(state.core.bases[secondDestinationBaseIndex].minions.map(minion => minion.uid)).toContain(secondMateUid);
    });
});
