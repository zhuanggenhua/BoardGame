import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { HandArea } from '../ui/HandArea';
import type { Card } from '../domain/types';

vi.mock('react-i18next', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-i18next')>();
  return {
    ...actual,
    useTranslation: () => ({
      t: (key: string) => key === 'actions.magnify' ? '放大查看' : key,
    }),
  };
});

vi.mock('../../../contexts/ToastContext', () => ({
  useToast: () => ({
    warning: vi.fn(),
  }),
}));

vi.mock('../ui/CardSprite', () => ({
  CardSprite: ({ atlasId, frameIndex, className }: { atlasId: string; frameIndex: number; className?: string }) => (
    <div data-testid="sw-card-sprite" data-atlas-id={atlasId} data-frame-index={frameIndex} className={className} />
  ),
}));

vi.mock('../../../hooks/ui/useCoarsePointer', () => ({
  useCoarsePointer: () => false,
}));

vi.mock('../../../hooks/ui/useTouchLongPress', () => ({
  useTouchLongPress: () => ({
    handlePointerDown: vi.fn(),
    handlePointerMove: vi.fn(),
    handlePointerUp: vi.fn(),
    shouldBlockClick: () => false,
  }),
}));

const baseCard: Card = {
  id: 'phoenix-archer-1',
  name: '弓箭手',
  cardType: 'unit',
  faction: 'phoenix_elves',
  cost: 1,
  life: 1,
  attack: 1,
  attackType: 'ranged',
  move: 1,
  unitClass: 'common',
  spriteIndex: 0,
};

describe('SummonerWars HandArea render', () => {
  it('放大按钮渲染时不会因未绑定翻译函数崩溃', () => {
    render(
      <HandArea
        cards={[baseCard]}
        phase="attack"
        isMyTurn
        currentMagic={3}
        onCardClick={vi.fn()}
        onCardSelect={vi.fn()}
        onMagnifyCard={vi.fn()}
      />,
    );

    expect(screen.getByLabelText('放大查看')).toBeInTheDocument();
  });
});
