import { expect, test } from '@playwright/test';
import { getMatchState, injectMatchState } from '../helpers/state-injection';
import { waitForSummonerWarsUI } from '../helpers/summonerwars';
import { createSummonerWarsMobileEvidenceState } from '../../src/games/summonerwars/mobileEvidence';
import { createSeededRandom } from '../../src/engine/pipeline';
import { countHits, rollDice } from '../../src/games/summonerwars/config/dice';
import { createSummonerWarsOnlineAiMatch, readSummonerWarsRandomSeed } from './onlineAiFixtures';

test('在线 AI 疫病体击杀后选择弃牌堆疫病体并交还真人', async ({ browser }, testInfo) => {
  test.setTimeout(120000);
  const { context, page, matchId, access, live } = await createSummonerWarsOnlineAiMatch(
    browser, testInfo.project.use.baseURL as string | undefined, '__sw_ai_infection',
  );
  try {
    const prepared = createSummonerWarsMobileEvidenceState({ faction0: 'paladin', faction1: 'necromancer' });
    const core = prepared.core;
    const attackerCell = core.board.flat().find(cell => cell.unit?.owner === '1'
      && cell.unit.card.abilities.includes('infection'));
    const attacker = attackerCell?.unit;
    if (!attacker || !attackerCell) throw new Error('亡灵起始疫病体缺失');
    const ai = core.players['1'];
    const candidates = ai.deck.filter(card => card.cardType === 'unit' && card.unitTags?.includes('carrier')).slice(0, 2);
    expect(candidates).toHaveLength(2);
    ai.deck = ai.deck.filter(card => !candidates.some(candidate => candidate.id === card.id));
    ai.discard.push(...candidates);
    const human = core.players['0'];
    const victimIndex = human.deck.findIndex(card => card.cardType === 'unit' && card.id.startsWith('paladin-temple-priest-'));
    expect(victimIndex).toBeGreaterThanOrEqual(0);
    const victimCard = human.deck.splice(victimIndex, 1)[0];
    if (victimCard.cardType !== 'unit') throw new Error('祭司不是单位牌');

    // 保留棋盘上其他对象，限制它们本回合攻击；中间两格用于可复现的相邻战斗。
    const attackerPosition = { row: 3, col: 1 };
    const victimPosition = { row: 3, col: 0 };
    expect(core.board[3][1].unit ?? core.board[3][1].structure).toBeUndefined();
    expect(core.board[3][0].unit ?? core.board[3][0].structure).toBeUndefined();
    for (const cell of core.board.flat()) if (cell.unit?.owner === '1') cell.unit.hasAttacked = true;
    attackerCell.unit = undefined;
    core.board[3][1].unit = { ...attacker, position: attackerPosition, hasAttacked: false, hasMoved: true };
    core.board[3][0].unit = {
      instanceId: `${victimCard.id}#infection-victim`, cardId: victimCard.id, card: victimCard,
      owner: '0', position: victimPosition, damage: victimCard.life - 1,
      boosts: 0, hasMoved: false, hasAttacked: false,
    };
    ai.attackCount = 0;
    ai.hasAttackedEnemy = false;
    core.currentPlayer = '1';
    core.phase = 'attack';
    core.turnNumber = 5;

    // 使用真实服务端种子选取一段连续命中骰面，避免随机落空造成假失败。
    const random = createSeededRandom(await readSummonerWarsRandomSeed(matchId, access.credentials));
    const values = Array.from({ length: 512 }, () => random.random());
    const cursor = values.findIndex((_, index) => index + 8 <= values.length
      && values.slice(index, index + 8).every(value => countHits(rollDice(1, () => value), 'melee') > 0));
    expect(cursor).toBeGreaterThanOrEqual(0);
    await injectMatchState(matchId, {
      ...live, core,
      sys: { ...live.sys, ...prepared.sys, matchId: live.sys.matchId, phase: 'attack',
        turnOrder: ['0', '1'], currentPlayerIndex: 1, turnNumber: 5, flowHalted: false,
        interaction: { current: undefined, queue: [], isBlocked: false }, responseWindow: { current: undefined } },
    }, undefined, access, { randomCursor: cursor });
    await waitForSummonerWarsUI(page, 30000);
    let selectedId = '';
    await expect.poll(async () => {
      const state = await getMatchState(matchId, page);
      const current = state.core as typeof core;
      const unit = current.board[victimPosition.row][victimPosition.col].unit;
      selectedId = unit && unit.owner === '1' && candidates.some(card => card.id === unit.cardId) ? unit.cardId : '';
      return selectedId;
    }, { timeout: 30000, message: '等待 AI 击杀并从两张弃牌中选择一张疫病体' }).not.toBe('');
    const after = (await getMatchState(matchId, page)).core as typeof core;
    expect(after.players['1'].discard.some(card => card.id === selectedId)).toBe(false);
    expect(after.players['1'].discard.filter(card => candidates.some(candidate => candidate.id === card.id))).toHaveLength(1);
    await expect(page.getByTestId(`sw-unit-${victimPosition.row}-${victimPosition.col}`)).toHaveAttribute('data-owner', '1');
    await expect.poll(async () => ((await getMatchState(matchId, page)).core as typeof core).currentPlayer,
      { timeout: 60000, message: 'AI 后续回合应收口并交还真人' }).toBe('0');
    const endPhase = page.getByTestId('sw-end-phase');
    await expect(endPhase).toBeEnabled({ timeout: 15000 });
    await endPhase.click();
  } finally {
    await context.close();
  }
});
