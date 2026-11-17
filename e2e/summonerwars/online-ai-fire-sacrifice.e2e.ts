import { expect, test } from '@playwright/test';
import { waitForSummonerWarsUI } from '../helpers/summonerwars';
import { getMatchState, injectMatchState } from '../helpers/state-injection';
import { createSummonerWarsMobileEvidenceState } from '../../src/games/summonerwars/mobileEvidence';
import { createDeckByFactionId } from '../../src/games/summonerwars/config/factions';
import { createSummonerWarsOnlineAiMatch } from './onlineAiFixtures';

test('召唤师战争在线预置前态 AI 选择友军火祀召唤并交还真人', async ({ browser }, testInfo) => {
  test.setTimeout(120_000);
  const { context, page, matchId, access, live } = await createSummonerWarsOnlineAiMatch(
    browser, testInfo.project.use.baseURL as string | undefined, '__sw_ai_fire_sacrifice',
  );
  try {
    const prepared = createSummonerWarsMobileEvidenceState({ faction0: 'paladin', faction1: 'necromancer' });
    const champion = createDeckByFactionId('necromancer').deck.find((card) => card.id === 'necro-elut-bar');
    if (!champion || champion.cardType !== 'unit') throw new Error('真实伊路特-巴尔卡牌缺失');
    const core = prepared.core;
    const candidates = core.board.flat().flatMap((cell) => cell.unit?.owner === '1'
      && cell.unit.card.unitClass !== 'summoner' ? [cell.unit] : []);
    expect(candidates.length).toBeGreaterThan(0);
    const previousUnits = new Map(candidates.map((unit) => [unit.instanceId, unit.position]));
    core.players['1'].hand = [{ ...champion, id: 'e2e-ai-elut-bar' }];
    core.players['1'].magic = champion.cost;
    core.currentPlayer = '1';
    core.phase = 'summon';
    core.turnNumber = 5;
    await injectMatchState(matchId!, {
      ...live,
      core,
      sys: { ...live.sys, ...prepared.sys, matchId: live.sys.matchId, phase: 'summon',
        turnOrder: ['0', '1'], currentPlayerIndex: 1, turnNumber: 5, flowHalted: false,
        interaction: { current: undefined, queue: [], isBlocked: false }, responseWindow: { current: undefined } },
    }, undefined, access);
    await waitForSummonerWarsUI(page, 30000);
    let chosenPosition: { row: number; col: number } | undefined;
    await expect.poll(async () => {
      const state = await getMatchState(matchId!, page);
      const board = (state.core as typeof core).board;
      for (const [id, position] of previousUnits) {
        const unit = board[position.row]?.[position.col]?.unit;
        if (unit?.owner === '1' && unit.cardId === 'e2e-ai-elut-bar' && unit.instanceId !== id) {
          chosenPosition = position;
          return true;
        }
      }
      return false;
    }, { timeout: 30000, message: 'AI 应牺牲合法友军并将伊路特-巴尔召唤到该位置' }).toBe(true);
    expect(chosenPosition).toBeDefined();
    await expect(page.getByTestId(`sw-unit-${chosenPosition!.row}-${chosenPosition!.col}`)).toBeVisible();
    await expect.poll(async () => ((await getMatchState(matchId!, page)).core as typeof core).currentPlayer,
      { timeout: 60000, message: 'AI 回合应结束并交还真人' }).toBe('0');
    const before = (await getMatchState(matchId!, page)).core as typeof core;
    const endPhase = page.getByTestId('sw-end-phase');
    await expect(endPhase).toBeEnabled({ timeout: 15000 });
    await endPhase.click();
    await expect.poll(async () => {
      const current = (await getMatchState(matchId!, page)).core as typeof core;
      return current.currentPlayer !== '0' || current.phase !== before.phase;
    }, { timeout: 15000, message: '真人通过页面操作后对局应继续' }).toBe(true);
  } finally {
    await context.close();
  }
});
