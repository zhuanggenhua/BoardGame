import { describe, expect, it } from 'vitest';
import { getAllCardDefs } from '../data/cards';
import {
    buildReactionOptions,
    getSmashUpReactionSession,
    startSmashUpReactionSession,
    type ReactionChoiceValue,
} from '../domain/reactionSession';
import { createScoringBaseRef, createScoringSession, setScoringSession } from '../domain/scoringSession';
import type { ActionCardDef, SmashUpReactionSession } from '../domain/types';
import { getActionPlayTargetMode } from '../domain/playLegality';
import { getActionLikeResponseWindowTiming } from '../domain/utils';
import { makeBase, makeCard, makeMatchState, makeMinion, makePlayer, makeState } from './helpers';

describe('SmashUp reaction session response action target context', () => {
    it('response-window play_action choices can carry targetMinionUid for minion-target action cards', () => {
        const respondableIds: string[] = [];
        const minionTargetRespondableIds: string[] = [];

        for (const def of getAllCardDefs()) {
            if (def.type !== 'action') continue;
            const actionDef = def as ActionCardDef;
            const timing = getActionLikeResponseWindowTiming(actionDef);
            if (!timing) continue;

            respondableIds.push(def.id);
            if (getActionPlayTargetMode(actionDef) === 'minion') {
                minionTargetRespondableIds.push(`${def.id} (${timing})`);
            }
        }

        const typedChoice: Extract<ReactionChoiceValue, { kind: 'play_action' }> = {
            kind: 'play_action',
            playerId: '0',
            cardUid: 'sun-tattoo',
            targetBaseIndex: 0,
            targetMinionUid: 'host',
        };

        expect(respondableIds.length, 'response action contract audit must not be empty').toBeGreaterThan(10);
        expect(minionTargetRespondableIds).toContain('polynesian_voyagers_sun_tattoo (afterScoring)');
        expect(typedChoice.targetMinionUid).toBe('host');
    });

    it('太阳纹身在计分后响应窗口生成带宿主随从目标的行动选项', () => {
        const host = makeMinion('host', 'polynesian_voyagers_moai', '0', 3);
        const enemy = makeMinion('enemy', 'polynesian_voyagers_tiki', '1', 3);
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('sun-tattoo', 'polynesian_voyagers_sun_tattoo', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base_island_chain', [host, enemy]),
                makeBase('base_island_peak', []),
            ],
        });
        let state = makeMatchState(core);
        state = {
            ...state,
            sys: {
                ...state.sys,
                phase: 'scoreBases',
            } as typeof state.sys,
        };
        const baseRef = createScoringBaseRef(state.core, 0);
        if (!baseRef) throw new Error('无法构造太阳纹身响应窗口测试的计分基地引用');

        state = setScoringSession(state, {
            ...createScoringSession(state.core, [0]),
            currentBaseRef: baseRef,
            currentStep: 'awaiting-response-window',
        });
        const sessionSeed: SmashUpReactionSession = {
            frameId: 'score-after:sun-tattoo:test',
            frameKind: 'score-after',
            phase: 'optional',
            activePlayerId: '0',
            currentPlayerId: '0',
            consecutivePasses: 0,
            passedPlayerIds: [],
            responseWindowType: 'afterScoring',
        };
        state = startSmashUpReactionSession(state, sessionSeed);

        const session = getSmashUpReactionSession(state) ?? sessionSeed;
        const options = buildReactionOptions(state, session, 100);

        expect(options.some(option => (
            option.value.kind === 'play_action'
            && option.value.cardUid === 'sun-tattoo'
            && option.value.targetBaseIndex === 0
            && option.value.targetMinionUid === 'host'
        ))).toBe(true);
        expect(options.some(option => (
            option.value.kind === 'play_action'
            && option.value.cardUid === 'sun-tattoo'
            && option.value.targetMinionUid === 'enemy'
        ))).toBe(false);
    });
});
