import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { HandAreaSkeleton } from '../HandAreaSkeleton';

describe('HandAreaSkeleton filterCode', () => {
  it('使用 ctx 过滤归属与区域', () => {
    const cards = [
      { id: 'c1', name: '牌1', ownerId: 'p1', zone: 'hand' },
      { id: 'c2', name: '牌2', ownerId: 'p2', zone: 'hand' },
      { id: 'c3', name: '牌3', ownerId: 'p1', zone: 'discard' },
    ];
    const filterCode = `(card, ctx) => {
  if (ctx.bindEntity && String(card[ctx.bindEntity]) !== String(ctx.resolvedPlayerId)) return false;
  if (ctx.zoneField && ctx.zoneValue && String(card[ctx.zoneField]) !== String(ctx.zoneValue)) return false;
  return true;
}`;

    const html = renderToStaticMarkup(
      <HandAreaSkeleton
        cards={cards}
        filterCode={filterCode}
        filterContext={{
          playerIds: ['p1', 'p2'],
          currentPlayerId: 'p1',
          currentPlayerIndex: 0,
          resolvedPlayerId: 'p1',
          resolvedPlayerIndex: 0,
          bindEntity: 'ownerId',
          zoneField: 'zone',
          zoneValue: 'hand',
        }}
        renderCard={(card) => <div>{String(card.name)}</div>}
      />
    );

    expect(html).toContain('data-card-id="c1"');
    expect(html).not.toContain('data-card-id="c2"');
    expect(html).not.toContain('data-card-id="c3"');
  });
});
