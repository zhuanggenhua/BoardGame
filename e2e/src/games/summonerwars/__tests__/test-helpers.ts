/**
 * 召唤师战争 - 测试辅助函数
 * 
 * 提供已完成阵营选择的初始化状态，供测试直接使用
 */

import { SummonerWarsDomain } from '../domain';
import { SW_SELECTION_EVENTS } from '../domain/types';
import type { SummonerWarsCore, FactionId, PlayerId, CellCoord, BoardUnit, UnitCard } from '../domain/types';
import type { RandomFn } from '../../../engine/types';
import { createDeckByFactionId } from '../config/factions';
import { generateInstanceId, resetInstanceCounter } from '../domain/utils';

/**
 * 测试用：在指定位置放置单位，自动生成 instanceId
 */
export function placeTestUnit(
  state: SummonerWarsCore,
  pos: CellCoord,
  overrides: Partial<BoardUnit> & { card: UnitCard; owner: PlayerId },
): BoardUnit {
  const cardId = overrides.cardId ?? overrides.card.id;
  const unit: BoardUnit = {
    instanceId: overrides.instanceId ?? generateInstanceId(cardId),
    cardId,
    card: overrides.card,
    owner: overrides.owner,
    position: pos,
    damage: overrides.damage ?? 0,
    boosts: overrides.boosts ?? 0,
    hasMoved: overrides.hasMoved ?? false,
    hasAttacked: overrides.hasAttacked ?? false,
    extraAttacks: overrides.extraAttacks,
    attachedCards: overrides.attachedCards,
    healingMode: overrides.healingMode,
    wasAttackedThisTurn: overrides.wasAttackedThisTurn,
    tempAbilities: overrides.tempAbilities,
    originalOwner: overrides.originalOwner,
    attachedUnits: overrides.attachedUnits,
  };
  state.board[pos.row][pos.col].unit = unit;
  return unit;
}

export { generateInstanceId, resetInstanceCounter };

/**
 * 创建已完成阵营选择的游戏状态
 * 默认双方都使用亡灵法师（与之前 MVP 行为一致）
 */
export function createInitializedCore(
  playerIds: string[],
  random: RandomFn,
  options?: {
    faction0?: FactionId;
    faction1?: FactionId;
  }
): SummonerWarsCore {
  const faction0 = options?.faction0 ?? 'necromancer';
  const faction1 = options?.faction1 ?? 'necromancer';

  // 1. 调用 setup 获取空状态
  let core = SummonerWarsDomain.setup(playerIds, random);

  // 2. 模拟选角事件
  core = SummonerWarsDomain.reduce(core, {
    type: SW_SELECTION_EVENTS.FACTION_SELECTED,
    payload: { playerId: '0' as PlayerId, factionId: faction0 },
    timestamp: 0,
  });
  core = SummonerWarsDomain.reduce(core, {
    type: SW_SELECTION_EVENTS.FACTION_SELECTED,
    payload: { playerId: '1' as PlayerId, factionId: faction1 },
    timestamp: 0,
  });
  core = SummonerWarsDomain.reduce(core, {
    type: SW_SELECTION_EVENTS.PLAYER_READY,
    payload: { playerId: '1' as PlayerId },
    timestamp: 0,
  });
  core = SummonerWarsDomain.reduce(core, {
    type: SW_SELECTION_EVENTS.HOST_STARTED,
    payload: { playerId: '0' as PlayerId },
    timestamp: 0,
  });

  // 3. 触发 SELECTION_COMPLETE 初始化棋盘（附带确定性洗牌结果）
  const shuffledDecks: Record<string, unknown[]> = {};
  for (const pid of ['0', '1'] as PlayerId[]) {
    const fid = pid === '0' ? faction0 : faction1;
    const deckData = createDeckByFactionId(fid);
    const deckWithIds = deckData.deck.map((c, i) => ({ ...c, id: `${c.id}-${pid}-${i}` }));
    shuffledDecks[pid] = random.shuffle(deckWithIds);
  }
  core = SummonerWarsDomain.reduce(core, {
    type: SW_SELECTION_EVENTS.SELECTION_COMPLETE,
    payload: {
      factions: { '0': faction0, '1': faction1 },
      shuffledDecks,
    },
    timestamp: 0,
  });

  return core;
}
