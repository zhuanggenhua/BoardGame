import { describe, expect, it } from 'vitest';
import { makeBase, makeCard, makeMatchState, makePlayer, makeState } from './helpers';
import { resolveMinionUiPlayPlan } from '../ui/resolveMinionUiPlayPlan';

describe('resolveMinionUiPlayPlan', () => {
    it('阿尔戈英雄在随从额度用完但战术额度可用时，应允许按战术位打出', () => {
        const state = makeMatchState(makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('argonaut-card', 'mythic_greeks_argonaut', 'minion', '0')],
                    minionsPlayed: 1,
                    minionLimit: 1,
                    actionsPlayed: 0,
                    actionLimit: 1,
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_oracle_at_delphi', [])],
        }));

        const card = state.core.players['0'].hand[0];
        const plan = resolveMinionUiPlayPlan(state, '0', card, 0);

        expect(plan.validation.valid).toBe(true);
        expect(plan.playAsAction).toBe(true);
    });

    it('普通小随从在随从额度用完时，不应被 UI 误判为可打出', () => {
        const state = makeMatchState(makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('spartan-card', 'mythic_greeks_spartan', 'minion', '0')],
                    minionsPlayed: 1,
                    minionLimit: 1,
                    actionsPlayed: 0,
                    actionLimit: 1,
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_oracle_at_delphi', [])],
        }));

        const card = state.core.players['0'].hand[0];
        const plan = resolveMinionUiPlayPlan(state, '0', card, 0);

        expect(plan.validation.valid).toBe(false);
        expect(plan.playAsAction).toBe(false);
    });
});
