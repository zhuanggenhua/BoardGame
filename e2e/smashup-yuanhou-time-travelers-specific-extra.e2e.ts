import { expect, test } from './framework';
import { setChineseLocale } from './helpers/common';

function hasUid(items: unknown, uid: string): boolean {
  return Array.isArray(items)
    && items.some(item => typeof item === 'object' && item !== null && (item as { uid?: unknown }).uid === uid);
}

function hasSkipOption(options: unknown): boolean {
  return Array.isArray(options)
    && options.some(option =>
      typeof option === 'object'
      && option !== null
      && (option as { id?: unknown; value?: { skip?: unknown } }).id === 'skip'
      && (option as { value?: { skip?: unknown } }).value?.skip === true,
    );
}

test.describe('SmashUp yuanhou 时间旅行者 specific extra minion 真实入口', () => {
  test('时间旅行者-Do Over-真实入口只能重新打出刚返回手牌的那张随从', async ({ page, game }, testInfo) => {
    test.setTimeout(90000);
    await setChineseLocale(page.context());
    await game.openTestGame('smashup', { skipInitialization: true }, 45000);
    await game.setupScene({
      gameId: 'smashup',
      currentPlayer: '0',
      phase: 'playCards',
      extra: {
        core: {
          turnOrder: ['0', '1'],
          currentPlayerIndex: 0,
          turnNumber: 1,
          nextUid: 1000,
          players: {
            '0': {
              id: '0',
              vp: 0,
              hand: [
                { uid: 'do-over-hand', defId: 'time_travelers_do_over', type: 'action', owner: '0' },
                { uid: 'same-jumper-hand', defId: 'time_travelers_jumper', type: 'minion', owner: '0' },
                { uid: 'wrong-mako-hand', defId: 'sharks_mako', type: 'minion', owner: '0' },
              ],
              deck: [],
              discard: [],
              factions: ['time_travelers'],
              minionsPlayed: 0,
              minionLimit: 1,
              actionsPlayed: 0,
              actionLimit: 1,
            },
            '1': {
              id: '1',
              vp: 0,
              hand: [],
              deck: [],
              discard: [],
              factions: ['time_travelers'],
              minionsPlayed: 0,
              minionLimit: 1,
              actionsPlayed: 0,
              actionLimit: 1,
            },
          },
          bases: [
            {
              defId: 'base_portal_room',
              breakpoint: 20,
              minions: [
                {
                  uid: 'jumper-board',
                  defId: 'time_travelers_jumper',
                  controller: '0',
                  owner: '0',
                  basePower: 2,
                  powerCounters: 0,
                  powerModifier: 0,
                  tempPowerModifier: 0,
                  talentUsed: false,
                  playedThisTurn: false,
                  attachedActions: [],
                },
              ],
              ongoingActions: [],
            },
          ],
          baseDeck: ['base_the_nexus'],
          baseDiscard: [],
        },
      },
    });

    await page.locator('[data-card-uid="do-over-hand"]').click();
    await page.locator('[data-minion-uid="jumper-board"]').click();

    await expect.poll(async () => {
      const state = await game.getState();
      const prompt = state?.sys?.interaction?.current;
      const minions = state?.core?.bases?.[0]?.minions ?? [];
      const hand = state?.core?.players?.['0']?.hand ?? [];
      const promptCardUids = (prompt?.data?.options ?? [])
        .map((option: any) => option?.value?.cardUid)
        .filter((uid: unknown): uid is string => typeof uid === 'string');
      return prompt?.data?.sourceId === 'smashup_immediate_extra_minion'
        && prompt?.playerId === '0'
        && hasUid(hand, 'jumper-board')
        && hasUid(hand, 'same-jumper-hand')
        && hasUid(hand, 'wrong-mako-hand')
        && !hasUid(minions, 'jumper-board')
        && promptCardUids.includes('jumper-board')
        && !promptCardUids.includes('same-jumper-hand')
        && !promptCardUids.includes('wrong-mako-hand')
        && hasSkipOption(prompt?.data?.options);
    }, {
      message: 'Do Over 返回 Jumper 后应只允许重新打出刚返回手牌的 jumper-board，不能列出同名手牌或非同名手牌',
      timeout: 15000,
    }).toBe(true);

    await expect(page.locator('[data-tutorial-id="su-hand-area"] [data-card-uid="jumper-board"]')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('[data-tutorial-id="su-hand-area"] [data-card-uid="same-jumper-hand"]')).toHaveCount(0);
    await expect(page.locator('[data-tutorial-id="su-hand-area"] [data-card-uid="wrong-mako-hand"]')).toHaveCount(0);
    await game.screenshot('yuanhou-do-over-specific-card-extra-prompt', testInfo);

    await page.locator('[data-card-uid="jumper-board"]').click();

    await expect.poll(async () => {
      const state = await game.getState();
      const minions = state?.core?.bases?.[0]?.minions ?? [];
      const hand = state?.core?.players?.['0']?.hand ?? [];
      return state?.sys?.interaction?.current == null
        && hasUid(minions, 'jumper-board')
        && hasUid(hand, 'same-jumper-hand')
        && hasUid(hand, 'wrong-mako-hand')
        && !hasUid(hand, 'jumper-board');
    }, {
      message: 'Do Over 选择刚返回随从后应把同一张牌打回基地并收口，其他手牌保持不动',
      timeout: 15000,
    }).toBe(true);

    await expect(page.getByRole('button', { name: '放弃这次额外随从' })).toBeHidden({ timeout: 15000 });
    await game.screenshot('yuanhou-do-over-returned-minion-replayed', testInfo);
  });

  test('时间旅行者-Doctor When-真实入口只允许额外打回刚返回的另一随从', async ({ page, game }, testInfo) => {
    test.setTimeout(90000);
    await setChineseLocale(page.context());
    await game.openTestGame('smashup', { skipInitialization: true }, 45000);
    await game.setupScene({
      gameId: 'smashup',
      currentPlayer: '0',
      phase: 'playCards',
      extra: {
        core: {
          turnOrder: ['0', '1'],
          currentPlayerIndex: 0,
          turnNumber: 1,
          nextUid: 1000,
          players: {
            '0': {
              id: '0',
              vp: 0,
              hand: [
                { uid: 'doctor-hand', defId: 'time_travelers_doctor_when', type: 'minion', owner: '0' },
                { uid: 'same-raider-hand', defId: 'time_travelers_time_raider', type: 'minion', owner: '0' },
              ],
              deck: [],
              discard: [],
              factions: ['time_travelers'],
              minionsPlayed: 0,
              minionLimit: 1,
              actionsPlayed: 0,
              actionLimit: 1,
            },
            '1': {
              id: '1',
              vp: 0,
              hand: [],
              deck: [],
              discard: [],
              factions: ['time_travelers'],
              minionsPlayed: 0,
              minionLimit: 1,
              actionsPlayed: 0,
              actionLimit: 1,
            },
          },
          bases: [
            {
              defId: 'base_portal_room',
              breakpoint: 20,
              minions: [
                {
                  uid: 'jumper-a',
                  defId: 'time_travelers_jumper',
                  controller: '0',
                  owner: '0',
                  basePower: 2,
                  powerCounters: 0,
                  powerModifier: 0,
                  tempPowerModifier: 0,
                  talentUsed: false,
                  playedThisTurn: false,
                  attachedActions: [],
                },
                {
                  uid: 'raider-a',
                  defId: 'time_travelers_time_raider',
                  controller: '0',
                  owner: '0',
                  basePower: 3,
                  powerCounters: 0,
                  powerModifier: 0,
                  tempPowerModifier: 0,
                  talentUsed: false,
                  playedThisTurn: false,
                  attachedActions: [],
                },
              ],
              ongoingActions: [],
            },
          ],
          baseDeck: ['base_the_nexus'],
          baseDiscard: [],
        },
      },
    });

    await page.locator('[data-card-uid="doctor-hand"]').click();
    await page.getByTestId('base-zone-0').click();

    await expect.poll(async () => {
      const state = await game.getState();
      const prompt = state?.sys?.interaction?.current;
      const optionIds = (prompt?.data?.options ?? []).map((option: any) => option?.id);
      return prompt?.data?.sourceId === 'time_travelers_doctor_when_choose'
        && prompt?.playerId === '0'
        && optionIds.includes('jumper-a')
        && optionIds.includes('raider-a')
        && !optionIds.includes('doctor-hand')
        && hasSkipOption(prompt?.data?.options);
    }, {
      message: 'Doctor When 打出后应选择另一个己方随从或跳过，不能把 Doctor 自身列为候选',
      timeout: 15000,
    }).toBe(true);

    await expect(page.locator('[data-minion-uid="jumper-a"]')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('[data-minion-uid="raider-a"]')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('[data-option-id="raider-a"]')).toHaveCount(0);
    await game.screenshot('yuanhou-doctor-when-specific-return-choice-prompt', testInfo);

    await page.locator('[data-minion-uid="raider-a"]').click();

    await expect.poll(async () => {
      const state = await game.getState();
      const prompt = state?.sys?.interaction?.current;
      const minions = state?.core?.bases?.[0]?.minions ?? [];
      const hand = state?.core?.players?.['0']?.hand ?? [];
      const promptCardUids = (prompt?.data?.options ?? [])
        .map((option: any) => option?.value?.cardUid)
        .filter((uid: unknown): uid is string => typeof uid === 'string');
      return prompt?.data?.sourceId === 'smashup_immediate_extra_minion'
        && prompt?.playerId === '0'
        && hasUid(hand, 'raider-a')
        && hasUid(hand, 'same-raider-hand')
        && !hasUid(minions, 'raider-a')
        && promptCardUids.includes('raider-a')
        && !promptCardUids.includes('same-raider-hand')
        && !promptCardUids.includes('doctor-hand')
        && hasSkipOption(prompt?.data?.options);
    }, {
      message: 'Doctor When 返回 Raider 后应只允许额外打回刚返回的 raider-a，不能列同名手牌诱饵',
      timeout: 15000,
    }).toBe(true);

    await expect(page.locator('[data-tutorial-id="su-hand-area"] [data-card-uid="raider-a"]')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('[data-tutorial-id="su-hand-area"] [data-card-uid="same-raider-hand"]')).toHaveCount(0);
    await game.screenshot('yuanhou-doctor-when-specific-extra-minion-prompt', testInfo);

    await page.locator('[data-card-uid="raider-a"]').click();

    await expect.poll(async () => {
      const state = await game.getState();
      const minions = state?.core?.bases?.[0]?.minions ?? [];
      const hand = state?.core?.players?.['0']?.hand ?? [];
      return state?.sys?.interaction?.current == null
        && hasUid(minions, 'doctor-hand')
        && hasUid(minions, 'jumper-a')
        && hasUid(minions, 'raider-a')
        && !hasUid(hand, 'raider-a')
        && hasUid(hand, 'same-raider-hand');
    }, {
      message: 'Doctor When 选择刚返回随从后应把同一张 Raider 打回基地并收口，同名手牌保留',
      timeout: 15000,
    }).toBe(true);

    await expect(page.getByRole('button', { name: '放弃这次额外随从' })).toBeHidden({ timeout: 15000 });
    await game.screenshot('yuanhou-doctor-when-specific-returned-minion-replayed', testInfo);
  });

  test('时间旅行者-Do Over-真实入口放弃额外随从后应直接收口并保留刚返回的那张牌', async ({ page, game }, testInfo) => {
    test.setTimeout(90000);
    await setChineseLocale(page.context());
    await game.openTestGame('smashup', { skipInitialization: true }, 45000);
    await game.setupScene({
      gameId: 'smashup',
      currentPlayer: '0',
      phase: 'playCards',
      extra: {
        core: {
          turnOrder: ['0', '1'],
          currentPlayerIndex: 0,
          turnNumber: 1,
          nextUid: 1000,
          players: {
            '0': {
              id: '0',
              vp: 0,
              hand: [
                { uid: 'do-over-skip-hand', defId: 'time_travelers_do_over', type: 'action', owner: '0' },
              ],
              deck: [],
              discard: [],
              factions: ['time_travelers'],
              minionsPlayed: 0,
              minionLimit: 1,
              actionsPlayed: 0,
              actionLimit: 1,
            },
            '1': {
              id: '1',
              vp: 0,
              hand: [],
              deck: [],
              discard: [],
              factions: ['time_travelers'],
              minionsPlayed: 0,
              minionLimit: 1,
              actionsPlayed: 0,
              actionLimit: 1,
            },
          },
          bases: [
            {
              defId: 'base_portal_room',
              breakpoint: 20,
              minions: [
                {
                  uid: 'do-over-skip-jumper',
                  defId: 'time_travelers_jumper',
                  controller: '0',
                  owner: '0',
                  basePower: 2,
                  powerCounters: 0,
                  powerModifier: 0,
                  tempPowerModifier: 0,
                  talentUsed: false,
                  playedThisTurn: false,
                  attachedActions: [],
                },
              ],
              ongoingActions: [],
            },
          ],
          baseDeck: ['base_the_nexus'],
          baseDiscard: [],
        },
      },
    });

    await page.locator('[data-card-uid="do-over-skip-hand"]').click();
    await page.locator('[data-minion-uid="do-over-skip-jumper"]').click();

    await expect.poll(async () => {
      const state = await game.getState();
      const prompt = state?.sys?.interaction?.current;
      const hand = state?.core?.players?.['0']?.hand ?? [];
      const minions = state?.core?.bases?.[0]?.minions ?? [];
      return prompt?.data?.sourceId === 'smashup_immediate_extra_minion'
        && prompt?.playerId === '0'
        && hasUid(hand, 'do-over-skip-jumper')
        && !hasUid(minions, 'do-over-skip-jumper')
        && hasSkipOption(prompt?.data?.options);
    }, {
      message: 'Do Over 返回随从后应真实进入可跳过的额外随从 prompt',
      timeout: 15000,
    }).toBe(true);

    await expect(page.locator('[data-tutorial-id="su-hand-area"] [data-card-uid="do-over-skip-jumper"]')).toBeVisible({ timeout: 15000 });
    await game.screenshot('yuanhou-do-over-skip-extra-prompt', testInfo);
    await page.getByRole('button', { name: '放弃这次额外随从', exact: true }).click();

    await expect.poll(async () => {
      const state = await game.getState();
      const hand = state?.core?.players?.['0']?.hand ?? [];
      const minions = state?.core?.bases?.[0]?.minions ?? [];
      return state?.sys?.interaction?.current == null
        && !hasUid(minions, 'do-over-skip-jumper')
        && hasUid(hand, 'do-over-skip-jumper')
        && !hasUid(hand, 'do-over-skip-hand');
    }, {
      message: 'Do Over 选择放弃额外随从后应直接收口，刚返回的 Jumper 保留在手牌',
      timeout: 15000,
    }).toBe(true);

    await expect(page.getByRole('button', { name: '放弃这次额外随从', exact: true })).toBeHidden({ timeout: 15000 });
    await game.screenshot('yuanhou-do-over-skip-extra-resolved', testInfo);
  });

  test('时间旅行者-Doctor When-真实入口放弃额外随从后应直接收口并保留刚返回的那张牌', async ({ page, game }, testInfo) => {
    test.setTimeout(90000);
    await setChineseLocale(page.context());
    await game.openTestGame('smashup', { skipInitialization: true }, 45000);
    await game.setupScene({
      gameId: 'smashup',
      currentPlayer: '0',
      phase: 'playCards',
      extra: {
        core: {
          turnOrder: ['0', '1'],
          currentPlayerIndex: 0,
          turnNumber: 1,
          nextUid: 1000,
          players: {
            '0': {
              id: '0',
              vp: 0,
              hand: [
                { uid: 'doctor-skip-hand', defId: 'time_travelers_doctor_when', type: 'minion', owner: '0' },
              ],
              deck: [],
              discard: [],
              factions: ['time_travelers'],
              minionsPlayed: 0,
              minionLimit: 1,
              actionsPlayed: 0,
              actionLimit: 1,
            },
            '1': {
              id: '1',
              vp: 0,
              hand: [],
              deck: [],
              discard: [],
              factions: ['time_travelers'],
              minionsPlayed: 0,
              minionLimit: 1,
              actionsPlayed: 0,
              actionLimit: 1,
            },
          },
          bases: [
            {
              defId: 'base_portal_room',
              breakpoint: 20,
              minions: [
                {
                  uid: 'doctor-skip-raider',
                  defId: 'time_travelers_time_raider',
                  controller: '0',
                  owner: '0',
                  basePower: 3,
                  powerCounters: 0,
                  powerModifier: 0,
                  tempPowerModifier: 0,
                  talentUsed: false,
                  playedThisTurn: false,
                  attachedActions: [],
                },
              ],
              ongoingActions: [],
            },
          ],
          baseDeck: ['base_the_nexus'],
          baseDiscard: [],
        },
      },
    });

    await page.locator('[data-card-uid="doctor-skip-hand"]').click();
    await page.getByTestId('base-zone-0').click();

    await expect.poll(async () => {
      const state = await game.getState();
      const prompt = state?.sys?.interaction?.current;
      return prompt?.data?.sourceId === 'time_travelers_doctor_when_choose'
        && prompt?.playerId === '0';
    }, {
      message: 'Doctor When 打出后应先进入返回另一随从的选择 prompt',
      timeout: 15000,
    }).toBe(true);

    await expect(page.locator('[data-minion-uid="doctor-skip-raider"]')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('[data-option-id="doctor-skip-raider"]')).toHaveCount(0);
    await page.locator('[data-minion-uid="doctor-skip-raider"]').click();

    await expect.poll(async () => {
      const state = await game.getState();
      const prompt = state?.sys?.interaction?.current;
      const hand = state?.core?.players?.['0']?.hand ?? [];
      const minions = state?.core?.bases?.[0]?.minions ?? [];
      return prompt?.data?.sourceId === 'smashup_immediate_extra_minion'
        && prompt?.playerId === '0'
        && hasUid(hand, 'doctor-skip-raider')
        && !hasUid(minions, 'doctor-skip-raider')
        && hasSkipOption(prompt?.data?.options);
    }, {
      message: 'Doctor When 返回 Raider 后应真实进入可跳过的额外随从 prompt',
      timeout: 15000,
    }).toBe(true);

    await expect(page.locator('[data-tutorial-id="su-hand-area"] [data-card-uid="doctor-skip-raider"]')).toBeVisible({ timeout: 15000 });
    await game.screenshot('yuanhou-doctor-when-skip-extra-prompt', testInfo);
    await page.getByRole('button', { name: '放弃这次额外随从', exact: true }).click();

    await expect.poll(async () => {
      const state = await game.getState();
      const hand = state?.core?.players?.['0']?.hand ?? [];
      const minions = state?.core?.bases?.[0]?.minions ?? [];
      return state?.sys?.interaction?.current == null
        && hasUid(minions, 'doctor-skip-hand')
        && !hasUid(minions, 'doctor-skip-raider')
        && hasUid(hand, 'doctor-skip-raider');
    }, {
      message: 'Doctor When 选择放弃额外随从后应直接收口，刚返回的 Raider 保留在手牌',
      timeout: 15000,
    }).toBe(true);

    await expect(page.getByRole('button', { name: '放弃这次额外随从', exact: true })).toBeHidden({ timeout: 15000 });
    await game.screenshot('yuanhou-doctor-when-skip-extra-resolved', testInfo);
  });
});
