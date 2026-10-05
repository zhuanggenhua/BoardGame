import { test, expect } from '../framework';

test.describe('线上反馈 69d47f8 炸药桶连锁消灭', () => {
  test.setTimeout(120000);

  test('牺牲海盗王后，同基地力量4的激光三角龙也应被消灭', async ({ game }) => {
    await game.openTestGame('smashup', { skipInitialization: true }, 20000);
    await game.setupScene({
      gameId: 'smashup',
      player0: {
        factions: ['pirates_pod', 'frankenstein_pod'],
        hand: [{ uid: 'powderkeg-hand', defId: 'pirate_powderkeg_pod', type: 'action', owner: '0' }],
      },
      player1: { factions: ['dinosaurs_pod', 'wizards'] },
      bases: [
        {
          defId: 'base_the_jungle_pod',
          minions: [
            { uid: 'pirate-king', defId: 'pirate_king_pod', controller: '0', owner: '0', basePower: 5 },
            { uid: 'laseratops', defId: 'dino_laser_triceratops_pod', controller: '1', owner: '1', basePower: 4 },
          ],
          ongoingActions: [{ uid: 'grave-situation', defId: 'frankenstein_grave_situation_pod', ownerId: '0' }],
        },
        { defId: 'base_the_workshop_pod', minions: [] },
        { defId: 'base_the_mothership_pod', minions: [] },
      ],
      currentPlayer: '0',
      phase: 'playCards',
    });

    await game.playCard('pirate_powderkeg_pod');
    await game.waitForInteraction('pirate_powderkeg');
    await game.selectOption((await game.getInteractionOptions()).find((option: any) => option.value?.minionUid === 'pirate-king')?.id);
    await game.waitForNoInteraction();

    const state = await game.getState();
    expect(state.core.bases[0].minions.some((minion: any) => minion.uid === 'laseratops')).toBe(false);
    expect(state.core.players['1'].discard.some((card: any) => card.uid === 'laseratops')).toBe(true);
    expect(state.core.players['0'].hand.some((card: any) => card.uid === 'pirate-king')).toBe(true);
  });
});
