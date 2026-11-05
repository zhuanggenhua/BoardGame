import { test, expect } from '../framework';
import type { Page } from '@playwright/test';
import { TOKEN_IDS } from '../../src/games/dicethrone/domain/ids';
import { RESOURCE_IDS } from '../../src/games/dicethrone/domain/resources';

async function dispatch(page: Page, type: string, playerId: string, payload: Record<string, unknown> = {}) {
  await page.evaluate(async ({ type, playerId, payload }) => {
    const harness = (window as any).__BG_TEST_HARNESS__;
    if (!harness?.command?.dispatch) throw new Error('TestHarness command.dispatch unavailable');
    await harness.command.dispatch({ type, playerId, payload });
  }, { type, playerId, payload });
}

async function setState(page: Page, state: unknown) {
  await page.evaluate(async (nextState) => {
    const harness = (window as any).__BG_TEST_HARNESS__;
    if (!harness?.state?.set) throw new Error('TestHarness state.set unavailable');
    await harness.state.set(nextState);
  }, state);
}

test.describe('线上反馈 699c566fe05635721c17516b', () => {
  test('破隐一击后武僧防御确认应显示太极响应入口并可收口', async ({ page, game }) => {
    test.setTimeout(120000);
    await game.openTestGame('dicethrone', {
      playerID: '0',
      disableLocalAiAutomation: true,
      seat0: 'human',
      seat1: 'human',
    });
    await game.setupScene({
      gameId: 'dicethrone',
      player0: {
        resources: { [RESOURCE_IDS.CP]: 0, [RESOURCE_IDS.HP]: 35 },
        tokens: {},
      },
      player1: {
        resources: { [RESOURCE_IDS.CP]: 0, [RESOURCE_IDS.HP]: 35 },
        tokens: { [TOKEN_IDS.TAIJI]: 2 },
      },
      currentPlayer: '0',
      phase: 'offensiveRoll',
      extra: {
        selectedCharacters: { '0': 'shadow_thief', '1': 'monk' },
        activePlayerId: '0',
        hostStarted: true,
        rollCount: 1,
        rollLimit: 1,
        rollDiceCount: 5,
        rollConfirmed: true,
        dice: [1, 2, 3, 4, 5].map((value, id) => ({ id, value, isKept: false, playerId: '0' })),
        pendingAttack: null,
        pendingDamage: undefined,
        pendingBonusDiceSettlement: undefined,
        seatControllers: { '0': { type: 'human' }, '1': { type: 'human' } },
      },
    });

    await dispatch(page, 'SELECT_ABILITY', '0', { abilityId: 'kidney-shot' });
    await dispatch(page, 'ADVANCE_PHASE', '0');
    await expect.poll(async () => (await game.getState())?.sys?.phase ?? null, { timeout: 10000 }).toBe('defensiveRoll');

    await dispatch(page, 'SELECT_ABILITY', '1', { abilityId: 'meditation' });
    await page.evaluate(() => (window as any).__BG_TEST_HARNESS__?.dice?.setValues?.([1, 1, 1, 1, 1]));
    await dispatch(page, 'ROLL_DICE', '1');
    await dispatch(page, 'CONFIRM_ROLL', '1');
    await dispatch(page, 'ADVANCE_PHASE', '1');

    const state = await game.getState();
    expect(state?.sys?.phase).toBe('defensiveRoll');
    expect(state?.sys?.interaction?.current?.kind).toBe('dt:token-response');
    expect(state?.sys?.interaction?.current?.playerId).toBe('1');
    expect(state?.core?.pendingDamage?.responderId).toBe('1');

    const defenderPage = await page.context().newPage();
    try {
      const defenderUrl = new URL('/play/dicethrone?playerID=1&disableLocalAiAutomation=true', page.url()).toString();
      await defenderPage.goto(defenderUrl, { waitUntil: 'commit', timeout: 45000 });
      await defenderPage.waitForFunction(() => Boolean((window as any).__BG_TEST_HARNESS__), { timeout: 15000 });
      await defenderPage.waitForFunction(() => Boolean((window as any).__BG_TEST_HARNESS__?.state?.isRegistered?.()), { timeout: 15000 });
      await setState(defenderPage, state);

      const passButton = defenderPage.getByTestId('dicethrone-response-pass-button');
      await expect(passButton).toBeVisible({ timeout: 10000 });
      await expect(passButton).toBeEnabled({ timeout: 5000 });
      await passButton.click();
      await expect.poll(async () => defenderPage.evaluate(() => (window as any).__BG_TEST_HARNESS__?.state?.get?.()?.sys?.phase ?? null), { timeout: 10000 }).toBe('main2');
    } finally {
      await defenderPage.close();
    }
  });
});
