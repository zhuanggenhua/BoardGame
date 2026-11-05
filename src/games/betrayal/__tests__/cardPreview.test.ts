import { describe, expect, it } from 'vitest';
import { getCardPreviewAspectRatio } from '../../../components/common/media/CardPreview';
import '../cardPreview';
import { getBetrayalEventPreviewRef, getBetrayalRoomPreviewRef } from '../cardPreview';

describe('Betrayal card preview aspect ratios', () => {
    it('room preview uses square room-tile ratio', () => {
        const ratio = getCardPreviewAspectRatio(getBetrayalRoomPreviewRef('observatory'));
        expect(ratio).toBeCloseTo(1, 6);
    });

    it('event preview uses the real vertical card ratio', () => {
        const ratio = getCardPreviewAspectRatio(getBetrayalEventPreviewRef('无线电广播'));
        expect(ratio).toBeCloseTo(675 / 1275, 6);
    });
});
