import { describe, expect, it } from 'vitest';
import { getAllCardDefs } from '../data/cards';
import type { ActionCardDef } from '../domain/types';
import { actionLikeNeedsPlayMinion, getActionLikeResponseWindowTiming } from '../domain/utils';

describe('SmashUp reaction session response action target context', () => {
    it('response-window action cards must not require play-time targetMinionUid until reaction choices carry it', () => {
        const respondableIds: string[] = [];
        const violations: string[] = [];

        for (const def of getAllCardDefs()) {
            if (def.type !== 'action') continue;
            const actionDef = def as ActionCardDef;
            const timing = getActionLikeResponseWindowTiming(actionDef);
            if (!timing) continue;

            respondableIds.push(def.id);
            const needsPlayMinion = actionLikeNeedsPlayMinion(actionDef)
                || (actionDef.subtype === 'ongoing' && actionDef.ongoingTarget === 'minion');
            if (needsPlayMinion) {
                violations.push(`${def.id} (${timing})`);
            }
        }

        expect(respondableIds.length, 'response action contract audit must not be empty').toBeGreaterThan(10);
        expect(violations, 'reaction choice play_action currently lacks targetMinionUid').toEqual([]);
    });
});
