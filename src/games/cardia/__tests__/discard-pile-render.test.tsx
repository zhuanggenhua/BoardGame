import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { DiscardPile } from '../ui/DiscardPile';
import type { CardInstance } from '../domain/core-types';

function createCard(overrides: Partial<CardInstance> = {}): CardInstance {
    return {
        uid: overrides.uid ?? 'card-1',
        defId: overrides.defId ?? 'deck_i_card_01',
        ownerId: overrides.ownerId ?? '0',
        baseInfluence: overrides.baseInfluence ?? 1,
        faction: overrides.faction ?? 'guild',
        abilityIds: overrides.abilityIds ?? [],
        difficulty: overrides.difficulty ?? 1,
        modifiers: overrides.modifiers ?? { entries: [], nextOrder: 0 },
        tags: overrides.tags ?? { entries: [], nextOrder: 0 },
        signets: overrides.signets ?? 0,
        ongoingMarkers: overrides.ongoingMarkers ?? [],
        imageIndex: overrides.imageIndex ?? 0,
        imagePath: overrides.imagePath ?? '',
    };
}

describe('DiscardPile', () => {
    it('有弃牌时应该渲染最新卡牌图片和数量标记', () => {
        const html = renderToStaticMarkup(
            <DiscardPile
                cards={[
                    createCard({ uid: 'c1', baseInfluence: 3 }),
                    createCard({ uid: 'c2', baseInfluence: 7 }),
                ]}
            />
        );

        expect(html).toContain('absolute bottom-0');
        expect(html).toContain('alt="Card 3"');
        expect(html).toContain('alt="Card 7"');
        expect(html).toContain('width:142px');
        expect(html).toContain('left:36px');
    });

    it('空弃牌堆时应该显示空状态', () => {
        const html = renderToStaticMarkup(<DiscardPile cards={[]} />);

        expect(html).toContain('空');
    });
});
