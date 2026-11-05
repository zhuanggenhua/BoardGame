import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CardSelectorOverlay } from '../CardSelectorOverlay';
import type { Card } from '../../domain/types';

vi.mock('react-i18next', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-i18next')>();
  return {
    ...actual,
    useTranslation: () => ({
      t: (key: string) => key,
      i18n: { exists: () => true },
    }),
  };
});

vi.mock('../CardSprite', () => ({
  CardSprite: ({ atlasId, frameIndex }: { atlasId: string; frameIndex: number }) => (
    <div data-testid="card-sprite" data-atlas-id={atlasId} data-frame-index={frameIndex} />
  ),
}));

vi.mock('../cardAtlas', () => ({
  resolveCardAtlasId: (card: { id: string }) => `atlas:${card.id}`,
}));

function makeCard(id: string): Card {
  return {
    id,
    cardType: 'unit',
    name: `测试卡 ${id}`,
    faction: 'necromancer',
    unitClass: 'common',
    strength: 1,
    life: 1,
    cost: 1,
    attackType: 'melee',
    attackRange: 1,
    deckSymbols: [],
  };
}

describe('CardSelectorOverlay', () => {
  it('从弃牌堆选卡时支持鼠标滚轮横向浏览', () => {
    render(
      <CardSelectorOverlay
        title="选择弃牌堆卡牌"
        cards={[makeCard('discard-1'), makeCard('discard-2'), makeCard('discard-3')]}
        onSelect={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    const scroll = screen.getByTestId('sw-card-selector-scroll');

    expect(scroll.scrollLeft).toBe(0);

    fireEvent.wheel(scroll, { deltaY: 120, deltaX: 0 });

    expect(scroll.scrollLeft).toBe(120);
  });
});
