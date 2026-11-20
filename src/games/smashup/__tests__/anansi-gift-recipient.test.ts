import { describe, expect, it } from 'vitest';
import { resolveSmashUpHandPromptUiMode } from '../ui/interactionMode';

describe('手牌与接收者组合选择', () => {
    it('同一手牌对应不同接收者时必须保留独立选项', () => {
        const currentPrompt = {
            playerId: '0',
            options: [
                { id: 'give-to-1', displayMode: 'card', value: { cardUid: 'gift', targetPlayerId: '1' } },
                { id: 'give-to-2', displayMode: 'card', value: { cardUid: 'gift', targetPlayerId: '2' } },
            ],
        };
        expect(resolveSmashUpHandPromptUiMode({ currentPrompt, playerID: '0', targetType: 'hand', hand: [{ uid: 'gift' }] })).toBe('overlay');
    });

    it('每张牌只有一个可选项时仍可直接点击手牌', () => {
        const currentPrompt = { playerId: '0', options: [{ id: 'give-to-1', displayMode: 'card', value: { cardUid: 'gift', targetPlayerId: '1' } }] };
        expect(resolveSmashUpHandPromptUiMode({ currentPrompt, playerID: '0', targetType: 'hand', hand: [{ uid: 'gift' }] })).toBe('direct');
    });
});
