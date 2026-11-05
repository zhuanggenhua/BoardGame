import { describe, expect, it, vi } from 'vitest';
import { createHandDiscardInteractionContract } from '../handDiscardInteractionContract';

const interaction = {
    id: 'discard-cost-1',
    playerId: '0',
    type: 'selectHandCard' as const,
    titleKey: 'interaction.selectHandCardToDiscard',
    selectCount: 1,
    candidateCardIds: ['card-a'],
    allowCancel: true,
};

const makeContract = (overrides: Partial<Parameters<typeof createHandDiscardInteractionContract>[0]> = {}) => (
    createHandDiscardInteractionContract({
        interaction,
        handCardIds: ['card-a', 'card-b'],
        currentPlayerId: '0',
        canOperate: true,
        onSelectCard: vi.fn(),
        onCancel: vi.fn(),
        ...overrides,
    })
);

describe('hand discard interaction contract', () => {
    it('binds the required hand-area hint, live hand candidates, and original select/cancel actions', () => {
        const onSelectCard = vi.fn();
        const onCancel = vi.fn();
        const contract = makeContract({ onSelectCard, onCancel });

        expect(contract).toMatchObject({
            kind: 'hand-discard',
            interactionId: 'discard-cost-1',
            candidates: { region: 'hand', cardIds: ['card-a'], selectCount: 1 },
            hint: { key: 'interaction.selectHandCardToDiscard' },
            actions: { cancel: { kind: 'cancel', labelKey: 'common.cancel' } },
        });

        contract?.actions.selectCard('card-b');
        expect(onSelectCard).not.toHaveBeenCalled();
        contract?.actions.selectCard('card-a');
        expect(onSelectCard).toHaveBeenCalledWith('discard-cost-1', 'card-a');
        contract?.actions.cancel?.onActivate();
        expect(onCancel).toHaveBeenCalledOnce();
    });

    it('keeps the existing single-card hand route when the descriptor omits its default count', () => {
        const contract = makeContract({ interaction: { ...interaction, selectCount: undefined } });

        expect(contract?.candidates).toEqual({ region: 'hand', cardIds: ['card-a'], selectCount: 1 });
    });

    it('does not create a hand interaction contract for the wrong owner, route, title, or selection count', () => {
        expect(makeContract({ currentPlayerId: '1' })).toBeUndefined();
        expect(makeContract({ interaction: { ...interaction, type: 'selectDeckCard' } })).toBeUndefined();
        expect(makeContract({ interaction: { ...interaction, titleKey: 'interaction.selectCard' } })).toBeUndefined();
        expect(makeContract({ interaction: { ...interaction, selectCount: 2 } })).toBeUndefined();
        expect(makeContract({ canOperate: false })).toBeUndefined();
    });

    it('fails loudly when an active single-card cost has no current hand candidate', () => {
        expect(() => makeContract({ handCardIds: ['card-b'] })).toThrow(/no current hand candidate/);
    });
});
