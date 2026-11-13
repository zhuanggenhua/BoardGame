import { expect, it } from 'vitest';
import CardiaDomain from '../domain';
import type { CardiaCore } from '../domain/types';

it('一方打出本轮最后一张牌时等待对手同时出牌后再判断无牌胜负', () => {
  const core = CardiaDomain.setup(['p1', 'p2'], { random: () => 0.5 });
  const testCore: CardiaCore = {
    ...core,
    phase: 'play',
    players: { ...core.players, p1: { ...core.players.p1, hand: [], deck: [], currentCard: core.players.p1.hand[0], hasPlayed: true } },
  };
  expect(CardiaDomain.isGameOver(testCore)).toBeUndefined();
});
