import { test, expect } from '../framework';

async function openNinjaScene(
  game: any,
  options: {
    ongoingActions: Array<{ uid: string; defId: string; ownerId?: string }>;
  },
): Promise<void> {
  await game.openTestGame('smashup', {
    p0: 'ninjas,aliens',
    p1: 'dinosaurs,wizards',
    skipFactionSelect: true,
    skipInitialization: false,
    seed: 12345,
  }, 20000);

  await game.setupScene({
    gameId: 'smashup',
    player0: {
      hand: ['ninja_infiltrate'],
      actionsPlayed: 0,
      actionLimit: 1,
      minionsPlayed: 0,
      minionLimit: 1,
    },
    player1: {
      hand: [],
      deck: [],
      discard: [],
    },
    bases: [
      {
        ongoingActions: options.ongoingActions,
      },
    ],
    currentPlayer: '0',
    phase: 'playCards',
  });
}

async function getBase0Ongoing(game: any): Promise<any[]> {
  const state = await game.getState();
  return state.core.bases[0].ongoingActions;
}

async function getInteractionOptions(game: any): Promise<any[]> {
  return await game.getInteractionOptions();
}

async function waitForNoInteraction(game: any): Promise<void> {
  await expect.poll(async () => {
    const state = await game.getState();
    return state.sys?.interaction?.current?.data?.sourceId ?? null;
  }).toBe(null);
}

test.describe('测试框架试点 - 忍者渗透完整流程', () => {
  test.setTimeout(60000);
  test('应该能选择并消灭基地上的战术卡（完整流程）', async ({ game }, testInfo) => {
    await openNinjaScene(game, {
      ongoingActions: [
        { uid: 'ongoing-1', defId: 'alien_supreme_overlord', ownerId: '1' },
        { uid: 'ongoing-2', defId: 'dinosaur_king_rex', ownerId: '1' },
      ],
    });

    await game.expectCardInHand('ninja_infiltrate');
    await game.screenshot('01-initial-state', testInfo);

    await game.playCard('ninja_infiltrate', { targetBaseIndex: 0 });
    await game.waitForInteraction('ninja_infiltrate_destroy');
    await game.screenshot('02-select-prompt', testInfo);

    const options = await getInteractionOptions(game);
    const alienOption = options.find((entry: any) =>
      entry?.value?.cardUid === 'ongoing-1'
      || entry?.value?.defId === 'alien_supreme_overlord'
      || String(entry?.id ?? '').includes('alien_supreme_overlord'),
    );

    expect(alienOption, '交互中未找到 alien_supreme_overlord 选项').toBeTruthy();
    await game.selectOption(alienOption.id);
    await waitForNoInteraction(game);
    await game.screenshot('03-final-state', testInfo);

    const base0Ongoing = await getBase0Ongoing(game);
    expect(base0Ongoing.length).toBe(2);
    expect(base0Ongoing.some((card: any) => card.defId === 'ninja_infiltrate')).toBe(true);
    expect(base0Ongoing.some((card: any) => card.defId === 'dinosaur_king_rex')).toBe(true);
    expect(base0Ongoing.some((card: any) => card.defId === 'alien_supreme_overlord')).toBe(false);
  });

  test('应该能跳过渗透交互（没有战术卡时）', async ({ game }, testInfo) => {
    await openNinjaScene(game, {
      ongoingActions: [],
    });

    await game.screenshot('01-no-tactics-initial', testInfo);
    await game.playCard('ninja_infiltrate', { targetBaseIndex: 0 });
    await waitForNoInteraction(game);
    await game.screenshot('02-no-tactics-final', testInfo);

    const base0Ongoing = await getBase0Ongoing(game);
    expect(base0Ongoing.some((card: any) => card.defId === 'ninja_infiltrate')).toBe(true);
  });

  test('应该能选择多个战术卡中的一个', async ({ game }, testInfo) => {
    await openNinjaScene(game, {
      ongoingActions: [
        { uid: 'ongoing-1', defId: 'alien_supreme_overlord', ownerId: '1' },
        { uid: 'ongoing-2', defId: 'dinosaur_king_rex', ownerId: '1' },
        { uid: 'ongoing-3', defId: 'wizard_arcane_power', ownerId: '1' },
      ],
    });

    await game.screenshot('01-three-tactics-initial', testInfo);
    await game.playCard('ninja_infiltrate', { targetBaseIndex: 0 });
    await game.waitForInteraction('ninja_infiltrate_destroy');
    await game.screenshot('02-three-tactics-prompt', testInfo);

    const options = await getInteractionOptions(game);
    expect(options.length).toBe(3);

    const kingRexOption = options.find((entry: any) =>
      entry?.value?.cardUid === 'ongoing-2'
      || entry?.value?.defId === 'dinosaur_king_rex',
    );

    expect(kingRexOption, '交互中未找到 dinosaur_king_rex 选项').toBeTruthy();
    await game.selectOption(kingRexOption.id);
    await waitForNoInteraction(game);
    await game.screenshot('03-three-tactics-final', testInfo);

    const base0Ongoing = await getBase0Ongoing(game);
    expect(base0Ongoing.length).toBe(3);
    expect(base0Ongoing.some((card: any) => card.defId === 'ninja_infiltrate')).toBe(true);
    expect(base0Ongoing.some((card: any) => card.defId === 'alien_supreme_overlord')).toBe(true);
    expect(base0Ongoing.some((card: any) => card.defId === 'wizard_arcane_power')).toBe(true);
    expect(base0Ongoing.some((card: any) => card.defId === 'dinosaur_king_rex')).toBe(false);
  });
});
