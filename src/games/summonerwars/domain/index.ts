/**
 * 召唤师战争 - 领域核心
 */

import type { DomainCore, GameEvent, ValidationResult } from '../../../engine/types';
import { FLOW_EVENTS } from '../../../engine';
import type {
  SummonerWarsCore,
  PlayerId,
  PlayerState,
  GamePhase,
  UnitCard,
  EventCard,
  StructureCard,
  CellCoord,
  BoardCell,
} from './types';
import { SW_COMMANDS, SW_EVENTS } from './types';
import {
  BOARD_ROWS,
  BOARD_COLS,
  FIRST_PLAYER_MAGIC,
  SECOND_PLAYER_MAGIC,
  MAX_MOVES_PER_TURN,
  MAX_ATTACKS_PER_TURN,
  HAND_SIZE,
  getUnitAt,
  canMoveTo,
  canAttack,
  getValidSummonPositions,
  getValidBuildPositions,
  hasEnoughMagic,
  clampMagic,
  getNextPhase,
  isLastPhase,
  getSummoner,
  drawCards,
  getAttackType,
} from './helpers';
import { createNecromancerDeck } from '../config/factions';
import { rollDice, countHits } from '../config/dice';
import { calculateEffectiveStrength, triggerAbilities, triggerAllUnitsAbilities } from './abilityResolver';
import type { AbilityContext } from './abilityResolver';

// 重新导出类型
export type { SummonerWarsCore } from './types';
export { SW_COMMANDS, SW_EVENTS } from './types';

// ============================================================================
// 辅助函数
// ============================================================================

/** 获取阶段显示名称 */
function getPhaseDisplayName(phase: GamePhase): string {
  const names: Record<GamePhase, string> = {
    summon: '召唤阶段',
    move: '移动阶段',
    build: '建造阶段',
    attack: '攻击阶段',
    magic: '魔力阶段',
    draw: '抽牌阶段',
  };
  return names[phase] ?? phase;
}// ============================================================================
// 初始化辅助
// ============================================================================

/** 创建空棋盘 */
function createEmptyBoard(): BoardCell[][] {
  return Array.from({ length: BOARD_ROWS }, () =>
    Array.from({ length: BOARD_COLS }, () => ({}))
  );
}

/** 创建初始玩家状态 */
function createPlayerState(playerId: PlayerId, isFirst: boolean): PlayerState {
  return {
    id: playerId,
    magic: isFirst ? FIRST_PLAYER_MAGIC : SECOND_PLAYER_MAGIC,
    hand: [],
    deck: [],
    discard: [],
    activeEvents: [],
    summonerId: '',
    moveCount: 0,
    attackCount: 0,
    hasAttackedEnemy: false,
  };
}

// ============================================================================
// 领域核心实现
// ============================================================================

export const SummonerWarsDomain: DomainCore<SummonerWarsCore> = {
  gameId: 'summonerwars',

  /**
   * 初始化游戏状态
   */
  setup: (_playerIds, random) => {
    const board = createEmptyBoard();
    
    // 创建玩家状态
    const players: Record<PlayerId, PlayerState> = {
      '0': createPlayerState('0', true),
      '1': createPlayerState('1', false),
    };

    // 为两个玩家创建牌组（MVP：都使用亡灵法师）
    // 
    // 配置使用【左下角原点】坐标系（玩家0视角，row 0=底部）
    // 数组使用【左上角原点】（row 0=顶部）
    // 需要转换：arrayRow = BOARD_ROWS - 1 - configRow
    //
    // 玩家0在底部，玩家1在顶部（镜像）
    const setupPlayer = (playerId: PlayerId, isBottom: boolean) => {
      const deckData = createNecromancerDeck();
      const player = players[playerId];
      
      // 配置坐标（左下角原点）转数组索引（左上角原点）
      const toArrayCoord = (pos: { row: number; col: number }): { row: number; col: number } => {
        if (isBottom) {
          // 玩家0：row 翻转（左下角→左上角）
          return { 
            row: BOARD_ROWS - 1 - pos.row, 
            col: pos.col 
          };
        } else {
          // 玩家1：完全镜像（row 不翻转，col 翻转）
          return { 
            row: pos.row, 
            col: BOARD_COLS - 1 - pos.col 
          };
        }
      };
      
      // 设置召唤师
      const summonerCard: UnitCard = {
        ...deckData.summoner,
        id: `${deckData.summoner.id}-${playerId}`,
      };
      player.summonerId = summonerCard.id;
      
      // 放置召唤师
      const summonerPos = toArrayCoord(deckData.summonerPosition);
      board[summonerPos.row][summonerPos.col].unit = {
        cardId: summonerCard.id,
        card: summonerCard,
        owner: playerId,
        position: summonerPos,
        damage: 0,
        boosts: 0,
        hasMoved: false,
        hasAttacked: false,
      };
      
      // 放置起始城门
      const gateCard: StructureCard = {
        ...deckData.startingGate,
        id: `${deckData.startingGate.id}-${playerId}`,
      };
      const gatePos = toArrayCoord(deckData.startingGatePosition);
      board[gatePos.row][gatePos.col].structure = {
        cardId: gateCard.id,
        card: gateCard,
        owner: playerId,
        position: gatePos,
        damage: 0,
      };
      
      // 放置起始单位
      deckData.startingUnits.forEach((startUnit) => {
        const unitCard: UnitCard = { ...startUnit.unit, id: `${startUnit.unit.id}-${playerId}` };
        const unitPos = toArrayCoord(startUnit.position);
        board[unitPos.row][unitPos.col].unit = {
          cardId: unitCard.id,
          card: unitCard,
          owner: playerId,
          position: unitPos,
          damage: 0,
          boosts: 0,
          hasMoved: false,
          hasAttacked: false,
        };
      });
      
      // 洗牌并发初始手牌
      const deckWithIds = deckData.deck.map((c, i) => ({ ...c, id: `${c.id}-${playerId}-${i}` }));
      const shuffledDeck = random.shuffle(deckWithIds);
      
      // 抽5张初始手牌
      player.hand = shuffledDeck.slice(0, HAND_SIZE);
      player.deck = shuffledDeck.slice(HAND_SIZE);
    };
    
    setupPlayer('0', true);   // 玩家0在底部
    setupPlayer('1', false);  // 玩家1在顶部

    return {
      board,
      players,
      phase: 'summon',
      currentPlayer: '0',
      turnNumber: 1,
    };
  },

  /**
   * 执行命令并返回事件
   */
  execute: (state, command): GameEvent[] => {
    const events: GameEvent[] = [];
    const core = state.core;
    const playerId = core.currentPlayer;
    const payload = command.payload as Record<string, unknown>;
    const timestamp = command.timestamp ?? Date.now();

    switch (command.type) {
      case SW_COMMANDS.SELECT_UNIT: {
        // 选择单位（用于移动/攻击）
        events.push({
          type: 'sw:unit_selected',
          payload: { position: payload.position },
          timestamp,
        });
        break;
      }

      case SW_COMMANDS.SUMMON_UNIT: {
        const cardId = payload.cardId as string;
        const position = payload.position as CellCoord;
        const player = core.players[playerId];
        const card = player.hand.find(c => c.id === cardId);
        
        if (card && card.cardType === 'unit') {
          const unitCard = card as UnitCard;
          // 扣除魔力
          if (unitCard.cost > 0) {
            events.push({
              type: SW_EVENTS.MAGIC_CHANGED,
              payload: { playerId, delta: -unitCard.cost },
              timestamp,
            });
          }
          // 召唤单位
          events.push({
            type: SW_EVENTS.UNIT_SUMMONED,
            payload: { playerId, cardId, position, card: unitCard },
            timestamp,
          });
        }
        break;
      }

      case SW_COMMANDS.BUILD_STRUCTURE: {
        const cardId = payload.cardId as string;
        const position = payload.position as CellCoord;
        const player = core.players[playerId];
        const card = player.hand.find(c => c.id === cardId);
        
        if (card && card.cardType === 'structure') {
          const structureCard = card as StructureCard;
          // 扣除魔力
          if (structureCard.cost > 0) {
            events.push({
              type: SW_EVENTS.MAGIC_CHANGED,
              payload: { playerId, delta: -structureCard.cost },
              timestamp,
            });
          }
          // 建造建筑
          events.push({
            type: SW_EVENTS.STRUCTURE_BUILT,
            payload: { playerId, cardId, position, card: structureCard },
            timestamp,
          });
        }
        break;
      }

      case SW_COMMANDS.MOVE_UNIT: {
        const from = payload.from as CellCoord;
        const to = payload.to as CellCoord;
        const unit = getUnitAt(core, from);
        if (unit && canMoveTo(core, from, to)) {
          events.push({
            type: SW_EVENTS.UNIT_MOVED,
            payload: { from, to, unitId: unit.cardId },
            timestamp,
          });
        }
        break;
      }

      case SW_COMMANDS.DECLARE_ATTACK: {
        const attacker = payload.attacker as CellCoord;
        const target = payload.target as CellCoord;
        const attackerUnit = getUnitAt(core, attacker);
        if (attackerUnit && canAttack(core, attacker, target)) {
          // 使用技能系统计算有效战力（考虑暴怒、力量强化等）
          const effectiveStrength = calculateEffectiveStrength(attackerUnit, core);
          const attackType = getAttackType(core, attacker, target);
          const diceResults = rollDice(effectiveStrength);
          const hits = countHits(diceResults, attackType);
          
          events.push({
            type: SW_EVENTS.UNIT_ATTACKED,
            payload: {
              attacker,
              target,
              attackerId: attackerUnit.cardId,
              attackType,
              diceCount: effectiveStrength,
              baseStrength: attackerUnit.card.strength,
              diceResults,
              hits,
            },
            timestamp,
          });

          if (hits > 0) {
            events.push({
              type: SW_EVENTS.UNIT_DAMAGED,
              payload: { position: target, damage: hits },
              timestamp,
            });
            
            // 检测是否会造成摧毁
            const targetCell = core.board[target.row]?.[target.col];
            if (targetCell?.unit) {
              const newDamage = targetCell.unit.damage + hits;
              if (newDamage >= targetCell.unit.card.life) {
                events.push({
                  type: SW_EVENTS.UNIT_DESTROYED,
                  payload: { 
                    position: target, 
                    cardId: targetCell.unit.cardId,
                    cardName: targetCell.unit.card.name,
                    owner: targetCell.unit.owner,
                  },
                  timestamp,
                });
                
                // 触发击杀相关技能（感染、灵魂转移）
                const killerCtx: AbilityContext = {
                  state: core,
                  sourceUnit: attackerUnit,
                  sourcePosition: attacker,
                  ownerId: playerId,
                  victimUnit: targetCell.unit,
                  victimPosition: target,
                  timestamp,
                };
                events.push(...triggerAbilities('onKill', killerCtx));
                
                // 触发被消灭单位的死亡技能（献祭）
                const victimCtx: AbilityContext = {
                  state: core,
                  sourceUnit: targetCell.unit,
                  sourcePosition: target,
                  ownerId: targetCell.unit.owner,
                  killerUnit: attackerUnit,
                  timestamp,
                };
                events.push(...triggerAbilities('onDeath', victimCtx));
                
                // 触发所有单位的 onUnitDestroyed 技能（血腥狂怒、灵魂转移）
                events.push(...triggerAllUnitsAbilities('onUnitDestroyed', core, playerId, {
                  victimUnit: targetCell.unit,
                  victimPosition: target,
                }));
              }
            } else if (targetCell?.structure) {
              const newDamage = targetCell.structure.damage + hits;
              if (newDamage >= targetCell.structure.card.life) {
                events.push({
                  type: SW_EVENTS.STRUCTURE_DESTROYED,
                  payload: { 
                    position: target, 
                    cardId: targetCell.structure.cardId,
                    cardName: targetCell.structure.card.name,
                    owner: targetCell.structure.owner,
                  },
                  timestamp,
                });
              }
            }
          }
        }
        break;
      }

      case SW_COMMANDS.DISCARD_FOR_MAGIC: {
        const cardIds = payload.cardIds as string[];
        const player = core.players[playerId];
        const validCards = cardIds.filter(id => 
          player.hand.some(c => c.id === id)
        );
        if (validCards.length > 0) {
          events.push({
            type: SW_EVENTS.MAGIC_CHANGED,
            payload: { playerId, delta: validCards.length },
            timestamp,
          });
          for (const cardId of validCards) {
            events.push({
              type: SW_EVENTS.CARD_DISCARDED,
              payload: { playerId, cardId },
              timestamp,
            });
          }
        }
        break;
      }

      case SW_COMMANDS.PLAY_EVENT: {
        const cardId = payload.cardId as string;
        const player = core.players[playerId];
        const card = player.hand.find(c => c.id === cardId);
        
        if (card && card.cardType === 'event') {
          const eventCard = card as EventCard;
          
          // 扣除魔力
          if (eventCard.cost > 0) {
            events.push({
              type: SW_EVENTS.MAGIC_CHANGED,
              payload: { playerId, delta: -eventCard.cost },
              timestamp,
            });
          }
          
          // 施放事件
          events.push({
            type: SW_EVENTS.EVENT_PLAYED,
            payload: { 
              playerId, 
              cardId, 
              card: eventCard,
              isActive: eventCard.isActive ?? false,
            },
            timestamp,
          });
        }
        break;
      }

      case SW_COMMANDS.END_PHASE: {
        const currentPhase = core.phase;
        const nextPhase = getNextPhase(currentPhase);
        
        // 攻击阶段结束时检查不活动惩罚
        if (currentPhase === 'attack' && !core.players[playerId].hasAttackedEnemy) {
          const summoner = getSummoner(core, playerId);
          if (summoner) {
            events.push({
              type: SW_EVENTS.UNIT_DAMAGED,
              payload: { position: summoner.position, damage: 1, reason: 'inaction' },
              timestamp,
            });
          }
        }

        // 抽牌阶段：自动抽牌至5张
        if (currentPhase === 'draw') {
          const player = core.players[playerId];
          const drawCount = Math.max(0, HAND_SIZE - player.hand.length);
          const actualDraw = Math.min(drawCount, player.deck.length);
          
          if (actualDraw > 0) {
            events.push({
              type: SW_EVENTS.CARD_DRAWN,
              payload: { playerId, count: actualDraw },
              timestamp,
            });
          }
        }

        events.push({
          type: SW_EVENTS.PHASE_CHANGED,
          payload: { from: currentPhase, to: nextPhase },
          timestamp,
        });

        // 抽牌阶段结束后切换回合
        if (isLastPhase(currentPhase)) {
          const nextPlayer = playerId === '0' ? '1' : '0';
          events.push({
            type: SW_EVENTS.TURN_CHANGED,
            payload: { from: playerId, to: nextPlayer },
            timestamp,
          });
        }
        break;
      }

      default:
        console.warn('[SummonerWars] 未处理的命令:', command.type);
    }

    return events;
  },

  /**
   * 应用事件到状态
   */
  reduce: (core: SummonerWarsCore, event: GameEvent): SummonerWarsCore => {
    const payload = event.payload as Record<string, unknown>;
    
    switch (event.type) {
      case 'sw:unit_selected': {
        return {
          ...core,
          selectedUnit: payload.position as CellCoord,
        };
      }

      case SW_EVENTS.UNIT_SUMMONED: {
        const { playerId, cardId, position, card } = payload as {
          playerId: PlayerId;
          cardId: string;
          position: CellCoord;
          card: UnitCard;
        };
        const newBoard = core.board.map(row => row.map(cell => ({ ...cell })));
        
        // 放置单位到棋盘
        newBoard[position.row][position.col].unit = {
          cardId,
          card,
          owner: playerId,
          position,
          damage: 0,
          boosts: 0,
          hasMoved: false,
          hasAttacked: false,
        };
        
        // 从手牌移除
        const player = core.players[playerId as PlayerId];
        const newHand = player.hand.filter(c => c.id !== cardId);
        
        return {
          ...core,
          board: newBoard,
          players: {
            ...core.players,
            [playerId]: {
              ...player,
              hand: newHand,
            },
          },
        };
      }

      case SW_EVENTS.STRUCTURE_BUILT: {
        const { playerId, cardId, position, card } = payload as {
          playerId: PlayerId;
          cardId: string;
          position: CellCoord;
          card: StructureCard;
        };
        const newBoard = core.board.map(row => row.map(cell => ({ ...cell })));
        
        // 放置建筑到棋盘
        newBoard[position.row][position.col].structure = {
          cardId,
          card,
          owner: playerId,
          position,
          damage: 0,
        };
        
        // 从手牌移除
        const player = core.players[playerId];
        const newHand = player.hand.filter(c => c.id !== cardId);
        
        return {
          ...core,
          board: newBoard,
          players: {
            ...core.players,
            [playerId]: {
              ...player,
              hand: newHand,
            },
          },
        };
      }

      case SW_EVENTS.CARD_DRAWN: {
        const { playerId, count } = payload as { playerId: PlayerId; count: number };
        const player = core.players[playerId];
        const { drawn, remaining } = drawCards(player.deck, count);
        
        return {
          ...core,
          players: {
            ...core.players,
            [playerId]: {
              ...player,
              hand: [...player.hand, ...drawn],
              deck: remaining,
            },
          },
        };
      }

      case SW_EVENTS.CARD_DISCARDED: {
        const { playerId, cardId } = payload as { playerId: PlayerId; cardId: string };
        const player = core.players[playerId];
        const card = player.hand.find(c => c.id === cardId);
        
        if (!card) return core;
        
        return {
          ...core,
          players: {
            ...core.players,
            [playerId]: {
              ...player,
              hand: player.hand.filter(c => c.id !== cardId),
              discard: [...player.discard, card],
            },
          },
        };
      }

      case SW_EVENTS.EVENT_PLAYED: {
        const { playerId, cardId, card, isActive } = payload as {
          playerId: PlayerId;
          cardId: string;
          card: EventCard;
          isActive: boolean;
        };
        const player = core.players[playerId];
        
        // 从手牌移除
        const newHand = player.hand.filter(c => c.id !== cardId);
        
        if (isActive) {
          // 主动事件：放入主动事件区
          return {
            ...core,
            players: {
              ...core.players,
              [playerId]: {
                ...player,
                hand: newHand,
                activeEvents: [...player.activeEvents, card],
              },
            },
          };
        } else {
          // 普通事件：直接弃置
          return {
            ...core,
            players: {
              ...core.players,
              [playerId]: {
                ...player,
                hand: newHand,
                discard: [...player.discard, card],
              },
            },
          };
        }
      }

      case SW_EVENTS.ACTIVE_EVENT_DISCARDED: {
        const { playerId, cardId } = payload as { playerId: PlayerId; cardId: string };
        const player = core.players[playerId];
        const card = player.activeEvents.find(c => c.id === cardId);
        
        if (!card) return core;
        
        return {
          ...core,
          players: {
            ...core.players,
            [playerId]: {
              ...player,
              activeEvents: player.activeEvents.filter(c => c.id !== cardId),
              discard: [...player.discard, card],
            },
          },
        };
      }

      case SW_EVENTS.UNIT_MOVED: {
        const { from, to } = payload as { from: CellCoord; to: CellCoord };
        const newBoard = core.board.map(row => row.map(cell => ({ ...cell })));
        const unit = newBoard[from.row][from.col].unit;
        
        if (unit) {
          newBoard[from.row][from.col].unit = undefined;
          newBoard[to.row][to.col].unit = {
            ...unit,
            position: to,
            hasMoved: true,
          };
        }

        const playerId = unit?.owner as PlayerId;
        return {
          ...core,
          board: newBoard,
          selectedUnit: undefined,
          players: {
            ...core.players,
            [playerId]: {
              ...core.players[playerId],
              moveCount: core.players[playerId].moveCount + 1,
            },
          },
        };
      }

      case SW_EVENTS.UNIT_ATTACKED: {
        const { attacker } = payload as { attacker: CellCoord };
        const newBoard = core.board.map(row => row.map(cell => ({ ...cell })));
        const unit = newBoard[attacker.row][attacker.col].unit;
        
        if (unit) {
          newBoard[attacker.row][attacker.col].unit = {
            ...unit,
            hasAttacked: true,
          };
        }

        const playerId = unit?.owner as PlayerId;
        return {
          ...core,
          board: newBoard,
          players: {
            ...core.players,
            [playerId]: {
              ...core.players[playerId],
              attackCount: core.players[playerId].attackCount + 1,
              hasAttackedEnemy: true,
            },
          },
        };
      }

      case SW_EVENTS.UNIT_DAMAGED: {
        const { position, damage } = payload as { position: CellCoord; damage: number };
        const newBoard = core.board.map(row => row.map(cell => ({ ...cell })));
        const cell = newBoard[position.row][position.col];
        
        if (cell.unit) {
          const newDamage = cell.unit.damage + damage;
          const life = cell.unit.card.life;
          
          if (newDamage >= life) {
            // 单位被摧毁 - 敌方获得魔力奖励
            const destroyedOwner = cell.unit.owner;
            const attackingPlayer = destroyedOwner === '0' ? '1' : '0';
            const destroyedCard = cell.unit.card;
            
            // 将卡牌加入所有者的弃牌堆
            const ownerPlayer = core.players[destroyedOwner as PlayerId];
            
            cell.unit = undefined;
            
            // 返回新状态，包含魔力奖励和弃牌
            return {
              ...core,
              board: newBoard,
              players: {
                ...core.players,
                [destroyedOwner]: {
                  ...ownerPlayer,
                  discard: [...ownerPlayer.discard, destroyedCard],
                },
                [attackingPlayer]: {
                  ...core.players[attackingPlayer as PlayerId],
                  magic: clampMagic(core.players[attackingPlayer as PlayerId].magic + 1),
                },
              },
            };
          } else {
            cell.unit = { ...cell.unit, damage: newDamage };
          }
        } else if (cell.structure) {
          const newDamage = cell.structure.damage + damage;
          const life = cell.structure.card.life;
          
          if (newDamage >= life) {
            // 建筑被摧毁 - 敌方获得魔力奖励
            const destroyedOwner = cell.structure.owner;
            const attackingPlayer = destroyedOwner === '0' ? '1' : '0';
            const destroyedCard = cell.structure.card;
            
            const ownerPlayer = core.players[destroyedOwner as PlayerId];
            
            cell.structure = undefined;
            
            return {
              ...core,
              board: newBoard,
              players: {
                ...core.players,
                [destroyedOwner]: {
                  ...ownerPlayer,
                  discard: [...ownerPlayer.discard, destroyedCard],
                },
                [attackingPlayer]: {
                  ...core.players[attackingPlayer as PlayerId],
                  magic: clampMagic(core.players[attackingPlayer as PlayerId].magic + 1),
                },
              },
            };
          } else {
            cell.structure = { ...cell.structure, damage: newDamage };
          }
        }

        return { ...core, board: newBoard };
      }

      case SW_EVENTS.MAGIC_CHANGED: {
        const { playerId, delta } = payload as { playerId: PlayerId; delta: number };
        return {
          ...core,
          players: {
            ...core.players,
            [playerId]: {
              ...core.players[playerId],
              magic: clampMagic(core.players[playerId].magic + delta),
            },
          },
        };
      }

      case SW_EVENTS.PHASE_CHANGED: {
        const { to } = payload as { to: GamePhase };
        return {
          ...core,
          phase: to,
          selectedUnit: undefined,
          attackTargetMode: undefined,
        };
      }

      case FLOW_EVENTS.PHASE_CHANGED: {
        const { to } = payload as { to: GamePhase };
        return {
          ...core,
          phase: to,
          selectedUnit: undefined,
          attackTargetMode: undefined,
        };
      }

      case SW_EVENTS.TURN_CHANGED: {
        const { to } = payload as { to: PlayerId };
        // 重置回合状态
        const newBoard = core.board.map(row => row.map(cell => {
          const newCell = { ...cell };
          if (newCell.unit) {
            newCell.unit = { ...newCell.unit, hasMoved: false, hasAttacked: false };
          }
          return newCell;
        }));

        return {
          ...core,
          board: newBoard,
          currentPlayer: to,
          phase: 'summon',
          turnNumber: core.turnNumber + (to === '0' ? 1 : 0),
          players: {
            ...core.players,
            [to]: {
              ...core.players[to],
              moveCount: 0,
              attackCount: 0,
              hasAttackedEnemy: false,
            },
          },
        };
      }

      // ========== 技能系统事件 ==========

      case SW_EVENTS.UNIT_HEALED: {
        const { position, amount } = payload as { position: CellCoord; amount: number };
        const newBoard = core.board.map(row => row.map(cell => ({ ...cell })));
        const cell = newBoard[position.row][position.col];
        
        if (cell.unit) {
          const newDamage = Math.max(0, cell.unit.damage - amount);
          cell.unit = { ...cell.unit, damage: newDamage };
        }

        return { ...core, board: newBoard };
      }

      case SW_EVENTS.UNIT_CHARGED: {
        const { position, delta, newValue } = payload as { 
          position: CellCoord; 
          delta: number;
          newValue?: number;
        };
        const newBoard = core.board.map(row => row.map(cell => ({ ...cell })));
        const cell = newBoard[position.row][position.col];
        
        if (cell.unit) {
          const currentBoosts = cell.unit.boosts ?? 0;
          const finalValue = newValue !== undefined 
            ? newValue 
            : Math.max(0, currentBoosts + delta);
          cell.unit = { ...cell.unit, boosts: finalValue };
        }

        return { ...core, board: newBoard };
      }

      case SW_EVENTS.ABILITY_TRIGGERED: {
        // 技能触发事件（用于 UI 显示和日志）
        // 不修改状态，仅作为通知
        return core;
      }

      case SW_EVENTS.STRENGTH_MODIFIED: {
        // 战力修改事件（临时效果，在攻击计算时应用）
        // 不修改状态，仅作为通知
        return core;
      }

      case SW_EVENTS.SUMMON_FROM_DISCARD_REQUESTED: {
        // 从弃牌堆召唤请求（需要玩家选择卡牌）
        // 不修改状态，由 UI 处理选择流程
        return core;
      }

      default:
        return core;
    }
  },

  /**
   * 验证命令合法性
   */
  validate: (state, command): ValidationResult => {
    const core = state.core;
    const playerId = core.currentPlayer;
    const payload = command.payload as Record<string, unknown>;

    switch (command.type) {
      case SW_COMMANDS.SUMMON_UNIT: {
        const cardId = payload.cardId as string;
        const position = payload.position as CellCoord;
        
        if (core.phase !== 'summon') {
          return { valid: false, error: '当前不是召唤阶段' };
        }
        
        const player = core.players[playerId];
        const card = player.hand.find(c => c.id === cardId);
        
        if (!card || card.cardType !== 'unit') {
          return { valid: false, error: '无效的单位卡牌' };
        }
        
        const unitCard = card as UnitCard;
        if (!hasEnoughMagic(core, playerId, unitCard.cost)) {
          return { valid: false, error: '魔力不足' };
        }
        
        const validPositions = getValidSummonPositions(core, playerId);
        const isValidPosition = validPositions.some(
          p => p.row === position.row && p.col === position.col
        );
        
        if (!isValidPosition) {
          return { valid: false, error: '无效的召唤位置（必须在城门相邻的空格）' };
        }
        
        return { valid: true };
      }

      case SW_COMMANDS.BUILD_STRUCTURE: {
        const cardId = payload.cardId as string;
        const position = payload.position as CellCoord;
        
        if (core.phase !== 'build') {
          return { valid: false, error: '当前不是建造阶段' };
        }
        
        const player = core.players[playerId];
        const card = player.hand.find(c => c.id === cardId);
        
        if (!card || card.cardType !== 'structure') {
          return { valid: false, error: '无效的建筑卡牌' };
        }
        
        const structureCard = card as StructureCard;
        if (!hasEnoughMagic(core, playerId, structureCard.cost)) {
          return { valid: false, error: '魔力不足' };
        }
        
        const validPositions = getValidBuildPositions(core, playerId);
        const isValidPosition = validPositions.some(
          p => p.row === position.row && p.col === position.col
        );
        
        if (!isValidPosition) {
          return { valid: false, error: '无效的建造位置（必须在后3排或召唤师相邻的空格）' };
        }
        
        return { valid: true };
      }

      case SW_COMMANDS.MOVE_UNIT: {
        const from = payload.from as CellCoord;
        const to = payload.to as CellCoord;
        if (core.phase !== 'move') {
          return { valid: false, error: '当前不是移动阶段' };
        }
        if (core.players[playerId].moveCount >= MAX_MOVES_PER_TURN) {
          return { valid: false, error: '本回合移动次数已用完' };
        }
        const unit = getUnitAt(core, from);
        if (!unit || unit.owner !== playerId) {
          return { valid: false, error: '无法移动该单位' };
        }
        if (unit.hasMoved) {
          return { valid: false, error: '该单位本回合已移动' };
        }
        if (!canMoveTo(core, from, to)) {
          return { valid: false, error: '无法移动到目标位置' };
        }
        return { valid: true };
      }

      case SW_COMMANDS.DECLARE_ATTACK: {
        const attackerPos = payload.attacker as CellCoord;
        const targetPos = payload.target as CellCoord;
        if (core.phase !== 'attack') {
          return { valid: false, error: '当前不是攻击阶段' };
        }
        if (core.players[playerId].attackCount >= MAX_ATTACKS_PER_TURN) {
          return { valid: false, error: '本回合攻击次数已用完' };
        }
        const attacker = getUnitAt(core, attackerPos);
        if (!attacker || attacker.owner !== playerId) {
          return { valid: false, error: '无法使用该单位攻击' };
        }
        if (attacker.hasAttacked) {
          return { valid: false, error: '该单位本回合已攻击' };
        }
        if (!canAttack(core, attackerPos, targetPos)) {
          return { valid: false, error: '无法攻击该目标' };
        }
        return { valid: true };
      }

      case SW_COMMANDS.PLAY_EVENT: {
        const cardId = payload.cardId as string;
        const player = core.players[playerId];
        const card = player.hand.find(c => c.id === cardId);
        
        if (!card || card.cardType !== 'event') {
          return { valid: false, error: '无效的事件卡' };
        }
        
        const eventCard = card as EventCard;
        
        // 检查魔力
        if (!hasEnoughMagic(core, playerId, eventCard.cost)) {
          return { valid: false, error: '魔力不足' };
        }
        
        // 检查施放阶段
        if (eventCard.playPhase !== 'any' && eventCard.playPhase !== core.phase) {
          return { valid: false, error: `该事件只能在${getPhaseDisplayName(eventCard.playPhase)}施放` };
        }
        
        return { valid: true };
      }

      case SW_COMMANDS.END_PHASE: {
        return { valid: true };
      }

      default:
        return { valid: true };
    }
  },

  /**
   * 判定游戏是否结束
   */
  isGameOver: (core) => {
    const summoner0 = getSummoner(core, '0');
    const summoner1 = getSummoner(core, '1');

    if (!summoner0 && !summoner1) {
      // 同时死亡，当前回合玩家获胜
      return { winner: core.currentPlayer };
    }
    if (!summoner0) {
      return { winner: '1' };
    }
    if (!summoner1) {
      return { winner: '0' };
    }
    return undefined;
  },
};
