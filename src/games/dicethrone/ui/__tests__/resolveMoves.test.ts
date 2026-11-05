import { describe, expect, it, vi } from 'vitest';
import { resolveMoves } from '../resolveMoves';

describe('resolveMoves', () => {
    it('passes the current card interaction id when removing a selected status', () => {
        const dispatch = vi.fn();
        const moves = resolveMoves(dispatch);

        moves.removeStatus('1', 'hypnosis', 'dt-interaction-card-get-away-1');

        expect(dispatch).toHaveBeenCalledWith('REMOVE_STATUS', {
            targetPlayerId: '1',
            statusId: 'hypnosis',
            interactionId: 'dt-interaction-card-get-away-1',
        });
    });

    it('passes the current card interaction id when resolving legacy card choices', () => {
        const dispatch = vi.fn();
        const moves = resolveMoves(dispatch);

        moves.resolveInteraction(['1'], undefined, 'dt-interaction-card-target-1');

        expect(dispatch).toHaveBeenCalledWith('RESOLVE_INTERACTION', {
            selectedPlayerIds: ['1'],
            selectedCardIds: undefined,
            interactionId: 'dt-interaction-card-target-1',
        });
    });
});
