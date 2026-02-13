/**
 * 召唤师战争 - 命令执行器
 * 
 * 将命令转换为事件序列
 */

import type { GameEvent, RandomFn } from '../../../engine/types';
import type { MatchState } from '../../../engine/types';
import type {
  SummonerWarsCore,
  PlayerId,
  UnitCard,
  StructureCard,
  CellCoord,
} from './types';
import { SW_COMMANDS, SW_EVENTS, SW_SELECTION_EVENTS } from './types';
import {
  BOARD_ROWS,
  BOARD_COLS,
  getUnitAt,
  isCellEmpty,
  isValidCoord,
  manhattanDistance,
  canAttackEnhanced,
  getSummoner,
  getAttackType,
  getNextPhase,
  isLastPhase,
  getEvasionUnits,
  getEntangleUnits,
  getPlayerUnits,
  getUnitAbilities,
  getUnitMoveEnhancements,
  getPassedThroughUnitPositions,
  findUnitPosition,
  HAND_SIZE,
} from './helpers';
import { rollDice, countHits } from '../config/dice';
import { createDeckByFactionId } from '../config/factions';
import { buildGameDeckFromCustom } from '../config/deckBuilder';
import { calculateEffectiveStrength, getEffectiveLife, getEffectiveStructureLife, triggerAbilities, hasHellfireBlade } from './abilityResolver';
import { reduceEvent } from './reduce';
import type { AbilityContext } from './abilityResolver';
import {
  findBoardUnitByCardId,
  createAbilityTriggeredEvent,
  emitDestroyWithTriggers,
  postProcessDeathChecks,
  getFuneralPyreChargeEvents,
} from './execute/helpers';
import { executeActivateAbility } from './execute/abilities';
import { executePlayEvent } from './execute/eventCards';
import { getBaseCardId, CARD_IDS } from './ids';

// 辅助函数已迁移到 execute/helpers.ts
// 保留 getPhaseDisplayName 的导出以保持向后兼容
export { getPhaseDisplayName } from './execute/helpers';

// ============================================================================
// 命令执行
// ============================================================================

/**
 * 执行命令并返回事件
 */
export function executeCommand(
  state: MatchState<SummonerWarsCore>,
  command: { type: string; payload: unknown; playerId?: string; timestamp?: number },
  random: RandomFn
): GameEvent[] {
  const events: GameEvent[] = [];
  const core = state.core;
  const playerId = core.currentPlayer;
  const payload = command.payload as Record<string, unknown>;
  const timestamp = typeof command.timestamp === 'number' ? command.timestamp : 0;

  switch (command.type) {
    case SW_COMMANDS.SELECT_UNIT: {
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
        if (unitCard.cost > 0) {
          events.push({
            type: SW_EVENTS.MAGIC_CHANGED,
            payload: { playerId, delta: -unitCard.cost },
            timestamp,
          });
        }
        events.push({
          type: SW_EVENTS.UNIT_SUMMONED,
          payload: { playerId, cardId, position, card: unitCard },
          timestamp,
        });

        // 聚能（gather_power）：召唤后充能
        if ((unitCard.abilities ?? []).includes('gather_power')) {
          events.push({
            type: SW_EVENTS.UNIT_CHARGED,
            payload: { position, delta: 1, sourceAbilityId: 'gather_power' },
            timestamp,
          });
        }

        // 编织颂歌：召唤到目标相邻位置时，充能目标
        const cwEvent = player.activeEvents.find(ev =>
          getBaseCardId(ev.id) === CARD_IDS.BARBARIC_CHANT_OF_WEAVING && ev.targetUnitId
        );
        if (cwEvent) {
          const cwTargetPos = findUnitPosition(core, cwEvent.targetUnitId!);
          if (cwTargetPos && manhattanDistance(position, cwTargetPos) === 1) {
            events.push({
              type: SW_EVENTS.UNIT_CHARGED,
              payload: { position: cwTargetPos, delta: 1, sourceAbilityId: 'chant_of_weaving' },
              timestamp,
            });
          }
        }
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
        if (structureCard.cost > 0) {
          events.push({
            type: SW_EVENTS.MAGIC_CHANGED,
            payload: { playerId, delta: -structureCard.cost },
            timestamp,
          });
        }
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
      if (unit) {
        // 缠斗检查：离开时相邻敌方有缠斗技能的单位造成1点伤害
        const entangleUnits = getEntangleUnits(core, from, unit.owner);
        for (const eu of entangleUnits) {
          // 检查移动后是否确实远离了缠斗单位
          const wasDist = 1; // 移动前一定相邻（因为 getEntangleUnits 只返回相邻的）
          const newDist = Math.abs(to.row - eu.position.row) + Math.abs(to.col - eu.position.col);
          if (newDist > wasDist) {
            events.push({
              type: SW_EVENTS.UNIT_DAMAGED,
              payload: {
                position: from,
                damage: 1,
                reason: 'entangle',
                sourceUnitId: eu.cardId,
                sourcePlayerId: eu.owner,
              },
              timestamp,
            });
          }
        }

        events.push({
          type: SW_EVENTS.UNIT_MOVED,
          payload: { from, to, unitId: unit.cardId },
          timestamp,
        });

        // 冲锋加成：直线移动3+格时获得+1战力（通过 boosts 标记）
        const unitAbilities = getUnitAbilities(unit, core);
        if (unitAbilities.includes('charge')) {
          const moveDist = manhattanDistance(from, to);
          if (moveDist >= 3 && (from.row === to.row || from.col === to.col)) {
            events.push({
              type: SW_EVENTS.UNIT_CHARGED,
              payload: { position: to, delta: 1 },
              timestamp,
            });
          }
        }

        // 践踏伤害：穿过敌方士兵时造成伤害（数据驱动，读取 damageOnPassThrough）
        const moveEnhancements = getUnitMoveEnhancements(core, from);
        if (moveEnhancements.damageOnPassThrough > 0) {
          const passedPositions = getPassedThroughUnitPositions(core, from, to, unit.owner);
          for (const pos of passedPositions) {
            events.push({
              type: SW_EVENTS.UNIT_DAMAGED,
              payload: {
                position: pos,
                damage: moveEnhancements.damageOnPassThrough,
                reason: 'trample',
                sourceUnitId: unit.cardId,
                sourcePlayerId: unit.owner,
              },
              timestamp,
            });
          }
        }

        // 抓附检查：友方单位从抓附手相邻位置移动后，抓附手可跟随
        if (unit.owner === playerId) {
          const grabbers = getPlayerUnits(core, playerId).filter(u =>
            u.cardId !== unit.cardId
            && getUnitAbilities(u, core).includes('grab')
            && manhattanDistance(u.position, from) === 1
          );
          for (const grabber of grabbers) {
            events.push({
              type: SW_EVENTS.GRAB_FOLLOW_REQUESTED,
              payload: {
                grabberUnitId: grabber.cardId,
                grabberPosition: grabber.position,
                movedUnitId: unit.cardId,
                movedTo: to,
              },
              timestamp,
            });
          }
        }

        // ================================================================
        // afterMove 技能自动触发（模式与 afterAttack 相同）
        // ================================================================
        if (unit.owner === playerId) {
          // 启悟（inspire）：无需选择，自动充能相邻友方
          if (unitAbilities.includes('inspire')) {
            const adjDirs = [
              { row: -1, col: 0 }, { row: 1, col: 0 },
              { row: 0, col: -1 }, { row: 0, col: 1 },
            ];
            for (const d of adjDirs) {
              const adjPos = { row: to.row + d.row, col: to.col + d.col };
              if (!isValidCoord(adjPos)) continue;
              const adjUnit = getUnitAt(core, adjPos);
              if (adjUnit && adjUnit.owner === playerId && adjUnit.cardId !== unit.cardId) {
                events.push({
                  type: SW_EVENTS.UNIT_CHARGED,
                  payload: { position: adjPos, delta: 1, sourceAbilityId: 'inspire' },
                  timestamp,
                });
              }
            }
          }
          // 需要玩家选择的 afterMove 技能 → 发射 ABILITY_TRIGGERED 供 UI 消费
          const afterMoveChoiceAbilities = [
            'spirit_bond',       // 祖灵交流：充能自身 / 消耗充能转移
            'ancestral_bond',    // 祖灵羁绊：充能+转移给3格内友方
            'structure_shift',   // 结构变换：推拉3格内友方建筑
            'frost_axe',         // 冰霜战斧：充能 / 消耗充能附加
          ];
          for (const abilityId of afterMoveChoiceAbilities) {
            if (unitAbilities.includes(abilityId)) {
              events.push(createAbilityTriggeredEvent(`afterMove:${abilityId}`, unit.cardId, to, timestamp));
            }
          }
        }
      }
      break;
    }

    case SW_COMMANDS.DECLARE_ATTACK: {
      const attacker = payload.attacker as CellCoord;
      const target = payload.target as CellCoord;
      let attackerUnit = getUnitAt(core, attacker);
      let workingCore = core;
      let beforeAttackBonus = 0;
      let beforeAttackMultiplier = 1;
      const rawBeforeAttack = payload.beforeAttack as
        | { abilityId: string; targetUnitId?: string; targetCardId?: string; discardCardIds?: string[] }
        | Array<{ abilityId: string; targetUnitId?: string; targetCardId?: string; discardCardIds?: string[] }>
        | undefined;
      const beforeAttackList = rawBeforeAttack
        ? (Array.isArray(rawBeforeAttack) ? rawBeforeAttack : [rawBeforeAttack])
        : [];
      const applyBeforeAttackEvents = (newEvents: GameEvent[]) => {
        for (const event of newEvents) {
          events.push(event);
          workingCore = reduceEvent(workingCore, event);
        }
      };

      if (attackerUnit && beforeAttackList.length > 0) {
        for (const beforeAttack of beforeAttackList) {
          const sourceUnit = getUnitAt(workingCore, attacker);
          if (!sourceUnit) {
            break;
          }
          const sourceAbilities = getUnitAbilities(sourceUnit, core);
          if (!sourceAbilities.includes(beforeAttack.abilityId)) {
            continue;
          }

          const abilityTriggeredEvent = createAbilityTriggeredEvent(beforeAttack.abilityId, sourceUnit.cardId, attacker, timestamp);

          switch (beforeAttack.abilityId) {
            case 'life_drain': {
              if (!beforeAttack.targetUnitId) {
                applyBeforeAttackEvents([abilityTriggeredEvent]);
                break;
              }
              const victim = findBoardUnitByCardId(workingCore, beforeAttack.targetUnitId, playerId);
              const lifeDrainEvents: GameEvent[] = [abilityTriggeredEvent];
              if (victim) {
                lifeDrainEvents.push(...emitDestroyWithTriggers(workingCore, victim.unit, victim.position, {
                  killer: { unit: sourceUnit, position: attacker },
                  playerId, timestamp, reason: 'life_drain', triggerOnDeath: true,
                }));
                lifeDrainEvents.push({
                  type: SW_EVENTS.STRENGTH_MODIFIED,
                  payload: { position: attacker, multiplier: 2, sourceAbilityId: 'life_drain' },
                  timestamp,
                });
                beforeAttackMultiplier *= 2;
              }
              applyBeforeAttackEvents(lifeDrainEvents);
              break;
            }

            case 'holy_arrow': {
              const discardCardIds = beforeAttack.discardCardIds ?? [];
              const haPlayer = workingCore.players[playerId];
              const validDiscards = discardCardIds.filter(id => haPlayer.hand.some(c => c.id === id));
              const holyArrowEvents: GameEvent[] = [abilityTriggeredEvent];
              if (validDiscards.length > 0) {
                holyArrowEvents.push({
                  type: SW_EVENTS.MAGIC_CHANGED,
                  payload: { playerId, delta: validDiscards.length },
                  timestamp,
                });
                for (const cardId of validDiscards) {
                  holyArrowEvents.push({
                    type: SW_EVENTS.CARD_DISCARDED,
                    payload: { playerId, cardId },
                    timestamp,
                  });
                }
                holyArrowEvents.push({
                  type: SW_EVENTS.UNIT_CHARGED,
                  payload: { position: attacker, delta: validDiscards.length },
                  timestamp,
                });
                beforeAttackBonus += validDiscards.length;
              }
              applyBeforeAttackEvents(holyArrowEvents);
              break;
            }

            case 'healing': {
              const healDiscardId = beforeAttack.targetCardId;
              const healPlayer = workingCore.players[playerId];
              const healingEvents: GameEvent[] = [abilityTriggeredEvent];
              if (healDiscardId && healPlayer.hand.some(c => c.id === healDiscardId)) {
                healingEvents.push({
                  type: SW_EVENTS.CARD_DISCARDED,
                  payload: { playerId, cardId: healDiscardId },
                  timestamp,
                });
                healingEvents.push({
                  type: SW_EVENTS.HEALING_MODE_SET,
                  payload: { position: attacker, unitId: sourceUnit.cardId },
                  timestamp,
                });
              }
              applyBeforeAttackEvents(healingEvents);
              break;
            }

            default:
              applyBeforeAttackEvents([abilityTriggeredEvent]);
              break;
          }
        }
      }

      attackerUnit = getUnitAt(workingCore, attacker);
      const applyBeforeAttackStrength = (strength: number) =>
        Math.max(0, Math.floor((strength + beforeAttackBonus) * beforeAttackMultiplier));

      // 治疗模式独立路径：绕过 canAttackEnhanced（它会拒绝友方目标）
      if (attackerUnit?.healingMode) {
        const healTargetCell = workingCore.board[target.row]?.[target.col];
        const healTargetUnit = healTargetCell?.unit;
        if (healTargetUnit && healTargetUnit.owner === attackerUnit.owner) {
          const healStrengthBase = calculateEffectiveStrength(attackerUnit, workingCore, healTargetUnit);
          const healStrength = applyBeforeAttackStrength(healStrengthBase);
          const healAttackType = getAttackType(workingCore, attacker, target);
          const healDiceResults = rollDice(healStrength, () => random.random());

          events.push({
            type: SW_EVENTS.UNIT_ATTACKED,
            payload: {
              attacker, target,
              attackerId: attackerUnit.cardId,
              attackType: healAttackType, diceCount: healStrength,
              baseStrength: attackerUnit.card.strength,
              diceResults: healDiceResults, hits: 0,
            },
            timestamp,
          });

          // 计算治疗量：melee 面数量
          const healAmount = healDiceResults.filter(r => r === 'melee').length;
          if (healAmount > 0) {
            events.push({
              type: SW_EVENTS.UNIT_HEALED,
              payload: { position: target, amount: healAmount, sourceAbilityId: 'healing' },
              timestamp,
            });
          }
          break;
        }
      }

      if (attackerUnit && canAttackEnhanced(workingCore, attacker, target)) {
        const targetCell = workingCore.board[target.row]?.[target.col];
        const effectiveStrengthBase = calculateEffectiveStrength(attackerUnit, workingCore, targetCell?.unit ?? undefined);
        const effectiveStrength = applyBeforeAttackStrength(effectiveStrengthBase);
        const attackType = getAttackType(workingCore, attacker, target);
        const diceResults = rollDice(effectiveStrength, () => random.random());
        let hits = countHits(diceResults, attackType);

        // 冰霜战斧：附加了frost_axe的单位攻击时，⚔️面始终计为命中
        if (attackerUnit.attachedUnits?.some(au => au.card.abilities?.includes('frost_axe'))) {
          hits = diceResults.filter(f => f === 'melee' || f === attackType).length;
        }
        
        // 迷魂减伤：检查攻击者相邻是否有敌方掷术师（evasion）
        const hasSpecialDice = diceResults.some(r => r === 'special');
        if (hasSpecialDice) {
          const evasionUnits = getEvasionUnits(workingCore, attacker, attackerUnit.owner);
          if (evasionUnits.length > 0) {
            // 每个迷魂单位减伤1点（多个可叠加）
            const reduction = evasionUnits.length;
            hits = Math.max(0, hits - reduction);
            for (const eu of evasionUnits) {
              events.push({
                type: SW_EVENTS.DAMAGE_REDUCED,
                payload: {
                  sourceUnitId: eu.cardId,
                  sourcePosition: eu.position,
                  value: 1,
                  condition: 'onSpecialDice',
                  sourceAbilityId: 'evasion',
                },
                timestamp,
              });
            }
          }
        }

        // 神圣护盾：科琳3格内友方城塞单位被攻击时，投2骰减伤
        if (targetCell?.unit && targetCell.unit.card.id.includes('fortress')) {
          const targetOwner = targetCell.unit.owner;
          // 查找目标方拥有 divine_shield 的单位（科琳）
          for (let row = 0; row < BOARD_ROWS; row++) {
            for (let col = 0; col < BOARD_COLS; col++) {
              const shieldUnit = workingCore.board[row]?.[col]?.unit;
              if (shieldUnit && shieldUnit.owner === targetOwner
                && getUnitAbilities(shieldUnit, workingCore).includes('divine_shield')
                && manhattanDistance({ row, col }, target) <= 3) {
                // 投掷2个骰子，计算 melee（❤️）数量
                const shieldDice = rollDice(2, () => random.random());
                const shieldMelee = shieldDice.filter(r => r === 'melee').length;
                if (shieldMelee > 0) {
                  const reduction = Math.min(shieldMelee, hits - 1); // 战力最少为1
                  if (reduction > 0) {
                    hits = hits - reduction;
                    events.push({
                      type: SW_EVENTS.DAMAGE_REDUCED,
                      payload: {
                        sourceUnitId: shieldUnit.cardId,
                        sourcePosition: { row, col },
                        value: reduction,
                        condition: 'divine_shield',
                        sourceAbilityId: 'divine_shield',
                        shieldDice,
                      },
                      timestamp,
                    });
                  }
                }
              }
            }
          }
        }

        events.push({
          type: SW_EVENTS.UNIT_ATTACKED,
          payload: {
            attacker, target,
            attackerId: attackerUnit.cardId,
            attackType, diceCount: effectiveStrength,
            baseStrength: attackerUnit.card.strength,
            diceResults, hits,
          },
          timestamp,
        });

        // 心灵捕获检查：攻击者有 mind_capture 且伤害足以消灭目标
        const attackerAbilities = getUnitAbilities(attackerUnit, core);
        const hasMindCapture = attackerAbilities.includes('mind_capture');
        
        if (hasMindCapture && hits > 0 && targetCell?.unit) {
          const targetUnit = targetCell.unit;
          const wouldKill = targetUnit.damage + hits >= getEffectiveLife(targetUnit, core);
          if (wouldKill && targetUnit.owner !== attackerUnit.owner) {
            // 生成心灵捕获请求事件（UI 让玩家选择：控制 or 伤害）
            events.push({
              type: SW_EVENTS.MIND_CAPTURE_REQUESTED,
              payload: {
                sourceUnitId: attackerUnit.cardId,
                sourcePosition: attacker,
                targetPosition: target,
                targetUnitId: targetUnit.cardId,
                ownerId: playerId,
                hits,
              },
              timestamp,
            });
            // 不立即造成伤害，等玩家选择
            // afterAttack 技能也在选择后触发
            break;
          }
        }

        if (hits > 0) {
          // 圣灵庇护：召唤师3格内友方士兵首次被攻击时伤害上限1
          if (targetCell?.unit && !targetCell.unit.wasAttackedThisTurn) {
            const targetOwner = targetCell.unit.owner;
            const targetPlayer = workingCore.players[targetOwner];
            const hasHolyProtection = targetPlayer.activeEvents.some(ev => {
              return getBaseCardId(ev.id) === CARD_IDS.PALADIN_HOLY_PROTECTION;
            });
            if (hasHolyProtection && targetCell.unit.card.unitClass === 'common') {
              // 检查目标是否在召唤师3格内
              const summoner = getSummoner(workingCore, targetOwner);
              if (summoner && manhattanDistance(summoner.position, target) <= 3) {
                if (hits > 1) {
                  events.push({
                    type: SW_EVENTS.DAMAGE_REDUCED,
                    payload: {
                      sourceAbilityId: 'holy_protection',
                      value: hits - 1,
                      condition: 'first_attack_protection',
                    },
                    timestamp,
                  });
                  hits = 1;
                }
              }
            }
          }

          // 伤害逻辑（治疗模式已在前面独立路径处理，此处一定是正常攻击）
          const attackerHasSoulless = attackerAbilities.includes('soulless');
          events.push({
            type: SW_EVENTS.UNIT_DAMAGED,
            payload: {
              position: target,
              damage: hits,
              sourcePlayerId: playerId,
              ...(attackerHasSoulless ? { skipMagicReward: true } : {}),
            },
            timestamp,
          });
          
          if (targetCell?.unit) {
            const newDamage = targetCell.unit.damage + hits;
            if (newDamage >= getEffectiveLife(targetCell.unit, workingCore)) {
              events.push(...emitDestroyWithTriggers(workingCore, targetCell.unit, target, {
                killer: { unit: attackerUnit, position: attacker },
                playerId,
                skipMagicReward: attackerHasSoulless,
                timestamp,
                triggerOnKill: true,
                triggerOnDeath: true,
              }));
            }
          } else if (targetCell?.structure) {
            const newDamage = targetCell.structure.damage + hits;
            if (newDamage >= getEffectiveStructureLife(core, targetCell.structure)) {
              events.push({
                type: SW_EVENTS.STRUCTURE_DESTROYED,
                payload: { 
                  position: target, 
                  cardId: targetCell.structure.cardId,
                  cardName: targetCell.structure.card.name,
                  owner: targetCell.structure.owner,
                  killerPlayerId: playerId,
                },
                timestamp,
              });
            }
          }
        }
        
        // 狱火铸剑诅咒效果
        if (hasHellfireBlade(attackerUnit)) {
          const meleeHits = diceResults.filter(r => r === 'melee').length;
          if (meleeHits > 0) {
            events.push({
              type: SW_EVENTS.UNIT_DAMAGED,
              payload: { position: attacker, damage: meleeHits, reason: 'curse', sourcePlayerId: playerId },
              timestamp,
            });
          }
        }

        // afterAttack 技能触发（念力、高阶念力、读心传念、威势、连续射击）
        const afterAttackCtx: AbilityContext = {
          state: core,
          sourceUnit: attackerUnit,
          sourcePosition: attacker,
          ownerId: playerId,
          targetUnit: targetCell?.unit,
          targetPosition: target,
          diceResults,
          timestamp,
        };
        const afterAttackEvents = triggerAbilities('afterAttack', afterAttackCtx);
        // afterAttack 技能需要玩家选择目标（推拉方向、额外攻击目标等）
        // 生成请求事件，由 UI 处理
        events.push(...afterAttackEvents);

        // 连续射击（rapid_fire）：afterAttack 触发后，消耗1充能授予额外攻击
        const hasRapidFireTrigger = afterAttackEvents.some(e =>
          e.type === SW_EVENTS.ABILITY_TRIGGERED
          && (e.payload as Record<string, unknown>).abilityId === 'rapid_fire_extra_attack'
        );
        if (hasRapidFireTrigger && (attackerUnit.boosts ?? 0) >= 1) {
          events.push({
            type: SW_EVENTS.UNIT_CHARGED,
            payload: { position: attacker, delta: -1, sourceAbilityId: 'rapid_fire' },
            timestamp,
          });
          events.push({
            type: SW_EVENTS.EXTRA_ATTACK_GRANTED,
            payload: {
              targetPosition: attacker,
              targetUnitId: attackerUnit.cardId,
              sourceAbilityId: 'rapid_fire',
            },
            timestamp,
          });
        }
      }
      break;
    }

    case SW_COMMANDS.DISCARD_FOR_MAGIC: {
      const cardIds = payload.cardIds as string[];
      const player = core.players[playerId];
      const validCards = cardIds.filter(id => player.hand.some(c => c.id === id));
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
      executePlayEvent(events, core, playerId, payload, timestamp);
      break;
    }

    case SW_COMMANDS.BLOOD_SUMMON_STEP: {
      const targetPos = payload.targetUnitPosition as CellCoord;
      const summonCardId = payload.summonCardId as string;
      const summonPos = payload.summonPosition as CellCoord;
      const player = core.players[playerId];
      const targetUnit = getUnitAt(core, targetPos);
      const summonCard = player.hand.find(c => c.id === summonCardId);
      
      if (targetUnit && targetUnit.owner === playerId && summonCard && summonCard.cardType === 'unit') {
        const unitCard = summonCard as UnitCard;
        events.push({
          type: SW_EVENTS.UNIT_SUMMONED,
          payload: { playerId, cardId: summonCardId, position: summonPos, card: unitCard },
          timestamp,
        });
        events.push({
          type: SW_EVENTS.UNIT_DAMAGED,
          payload: { position: targetPos, damage: 2, reason: 'blood_summon', sourcePlayerId: playerId },
          timestamp,
        });
        const newDamage = targetUnit.damage + 2;
        if (newDamage >= getEffectiveLife(targetUnit, core)) {
          events.push(...emitDestroyWithTriggers(core, targetUnit, targetPos, { playerId, timestamp }));
        }
      }
      break;
    }

    case SW_COMMANDS.END_PHASE: {
      const currentPhase = core.phase;
      const nextPhase = getNextPhase(currentPhase);
      
      if (currentPhase === 'attack' && !core.players[playerId].hasAttackedEnemy) {
        const summoner = getSummoner(core, playerId);
        if (summoner) {
          events.push({
            type: SW_EVENTS.UNIT_DAMAGED,
            payload: { position: summoner.position, damage: 1, reason: 'inaction', sourcePlayerId: playerId },
            timestamp,
          });
        }
      }

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

    case SW_COMMANDS.ACTIVATE_ABILITY: {
      executeActivateAbility(events, core, playerId, payload, timestamp);
      break;
    }

    case SW_COMMANDS.FUNERAL_PYRE_HEAL: {
      const fpCardId = payload.cardId as string;
      const fpTargetPos = payload.targetPosition as CellCoord | undefined;
      const fpSkip = payload.skip as boolean | undefined;
      const fpPlayer = core.players[playerId];
      const fpEvent = fpPlayer.activeEvents.find(c => c.id === fpCardId);
      
      if (fpEvent) {
        if (!fpSkip && fpTargetPos) {
          const charges = fpEvent.charges ?? 0;
          if (charges > 0) {
            events.push({
              type: SW_EVENTS.UNIT_HEALED,
              payload: { position: fpTargetPos, amount: charges, sourceAbilityId: 'funeral_pyre' },
              timestamp,
            });
          }
        }
        events.push({
          type: SW_EVENTS.ACTIVE_EVENT_DISCARDED,
          payload: { playerId, cardId: fpCardId },
          timestamp,
        });
      }
      break;
    }

    case SW_COMMANDS.SELECT_FACTION: {
      events.push({
        type: SW_SELECTION_EVENTS.FACTION_SELECTED,
        payload: { playerId: command.playerId, factionId: payload.factionId },
        timestamp,
      });
      break;
    }

    case SW_COMMANDS.SELECT_CUSTOM_DECK: {
      const deckData = payload.deckData as import('./types').SerializedCustomDeck;
      // 生成 FACTION_SELECTED 事件，使用召唤师所属阵营作为 factionId
      // 同时附带 customDeckData 标记，让 reduce 层存储自定义牌组数据
      events.push({
        type: SW_SELECTION_EVENTS.FACTION_SELECTED,
        payload: {
          playerId: command.playerId,
          factionId: deckData.summonerFaction,
          customDeckData: deckData,
        },
        timestamp,
      });
      break;
    }

    case SW_COMMANDS.PLAYER_READY: {
      events.push({
        type: SW_SELECTION_EVENTS.PLAYER_READY,
        payload: { playerId: command.playerId },
        timestamp,
      });
      break;
    }

    case SW_COMMANDS.HOST_START_GAME: {
      events.push({
        type: SW_SELECTION_EVENTS.HOST_STARTED,
        payload: { playerId: command.playerId },
        timestamp,
      });
      const allSelected = (['0', '1'] as PlayerId[]).every(pid => {
        const faction = core.selectedFactions[pid];
        return faction && faction !== 'unselected';
      });
      const allNonHostReady = (['0', '1'] as PlayerId[]).every(pid =>
        pid === core.hostPlayerId || core.readyPlayers[pid]
      );
      if (allSelected && allNonHostReady) {
        // 在 execute 层使用确定性随机洗牌，将洗好的牌序附带在事件中
        // reduce 只做状态写入，不再自行洗牌
        const shuffledDecks: Record<PlayerId, (import('./types').UnitCard | import('./types').EventCard | import('./types').StructureCard)[]> = {} as any;
        for (const pid of ['0', '1'] as PlayerId[]) {
          const factionId = core.selectedFactions[pid];
          if (factionId && factionId !== 'unselected') {
            // 检测自定义牌组：优先使用自定义牌组数据
            const customDeckData = core.customDeckData?.[pid];
            const deckData = customDeckData
              ? buildGameDeckFromCustom(customDeckData)
              : createDeckByFactionId(factionId as import('./types').FactionId);
            const deckWithIds = deckData.deck.map((c, i) => ({ ...c, id: `${c.id}-${pid}-${i}` }));
            shuffledDecks[pid] = random.shuffle(deckWithIds);
          }
        }
        events.push({
          type: SW_SELECTION_EVENTS.SELECTION_COMPLETE,
          payload: {
            factions: { '0': core.selectedFactions['0'], '1': core.selectedFactions['1'] },
            shuffledDecks,
          },
          timestamp,
        });
      }
      break;
    }

    default:
      console.warn('[SummonerWars] 未处理的命令:', command.type);
  }

  // 后处理1：自动补全死亡检测（UNIT_DAMAGED → UNIT_DESTROYED）
  const processedEvents = postProcessDeathChecks(events, core);

  // 后处理2：扫描所有 UNIT_DESTROYED 事件，为殉葬火堆生成充能事件
  const destroyCount = processedEvents.filter(e => e.type === SW_EVENTS.UNIT_DESTROYED).length;
  if (destroyCount > 0) {
    for (let i = 0; i < destroyCount; i++) {
      processedEvents.push(...getFuneralPyreChargeEvents(core, timestamp));
    }
  }

  // 后处理3：交缠颂歌清理 — 被消灭的单位是交缠目标时，弃置交缠颂歌
  const destroyedCardIds = processedEvents
    .filter(e => e.type === SW_EVENTS.UNIT_DESTROYED)
    .map(e => (e.payload as Record<string, unknown>).cardId as string);
  if (destroyedCardIds.length > 0) {
    for (const pid of ['0', '1'] as import('./types').PlayerId[]) {
      const player = core.players[pid];
      if (!player) continue;
      for (const ev of player.activeEvents) {
        if (getBaseCardId(ev.id) !== CARD_IDS.BARBARIC_CHANT_OF_ENTANGLEMENT) continue;
        if (!ev.entanglementTargets) continue;
        const [t1, t2] = ev.entanglementTargets;
        if (destroyedCardIds.includes(t1) || destroyedCardIds.includes(t2)) {
          processedEvents.push({
            type: SW_EVENTS.ACTIVE_EVENT_DISCARDED,
            payload: { playerId: pid, cardId: ev.id },
            timestamp,
          });
        }
      }
    }
  }

  // 后处理4：寒冰冲撞 — 建筑推拉/移动后发射触发事件，由玩家选择目标
  // 收集建筑推拉事件
  const structurePushEvents = processedEvents.filter(e =>
    (e.type === SW_EVENTS.UNIT_PUSHED || e.type === SW_EVENTS.UNIT_PULLED)
    && (e.payload as Record<string, unknown>).isStructure
    && (e.payload as Record<string, unknown>).newPosition
  );
  // 收集 mobile_structure 单位的正常移动事件
  const mobileStructureMoveEvents = processedEvents.filter(e => {
    if (e.type !== SW_EVENTS.UNIT_MOVED) return false;
    const p = e.payload as { from: CellCoord; to: CellCoord; unitId: string };
    // 检查移动的单位是否有 mobile_structure 技能
    const unit = findBoardUnitByCardId(core, p.unitId);
    return unit && getUnitAbilities(unit, core).includes('mobile_structure');
  });
  const allStructureMoveEvents = [...structurePushEvents, ...mobileStructureMoveEvents];
  if (allStructureMoveEvents.length > 0) {
    for (const pid of ['0', '1'] as import('./types').PlayerId[]) {
      const player = core.players[pid];
      if (!player) continue;
      const hasIceRam = player.activeEvents.some(ev =>
        getBaseCardId(ev.id) === CARD_IDS.FROST_ICE_RAM
      );
      if (!hasIceRam) continue;
      for (const moveEvent of allStructureMoveEvents) {
        let structureNewPos: CellCoord;
        let structureOwner: string | undefined;
        if (moveEvent.type === SW_EVENTS.UNIT_MOVED) {
          // mobile_structure 正常移动
          const mp = moveEvent.payload as { from: CellCoord; to: CellCoord; unitId: string };
          structureNewPos = mp.to;
          const unit = findBoardUnitByCardId(core, mp.unitId);
          structureOwner = unit?.owner;
        } else {
          // 建筑推拉
          const pp = moveEvent.payload as { targetPosition: CellCoord; newPosition: CellCoord };
          structureNewPos = pp.newPosition;
          const origStructure = core.board[pp.targetPosition.row]?.[pp.targetPosition.col]?.structure;
          // 也检查 mobile_structure 单位
          const origUnit = getUnitAt(core, pp.targetPosition);
          structureOwner = origStructure?.owner
            ?? (origUnit && getUnitAbilities(origUnit, core).includes('mobile_structure') ? origUnit.owner : undefined);
        }
        if (structureOwner !== pid) continue;
        // 检查建筑新位置是否有相邻单位（任意阵营）
        const adjDirs = [
          { row: -1, col: 0 }, { row: 1, col: 0 },
          { row: 0, col: -1 }, { row: 0, col: 1 },
        ];
        const hasAdjacentUnit = adjDirs.some(d => {
          const adjPos = { row: structureNewPos.row + d.row, col: structureNewPos.col + d.col };
          if (adjPos.row < 0 || adjPos.row >= BOARD_ROWS || adjPos.col < 0 || adjPos.col >= BOARD_COLS) return false;
          return !!getUnitAt(core, adjPos);
        });
        if (hasAdjacentUnit) {
          processedEvents.push(createAbilityTriggeredEvent(
            'ice_ram_trigger', 'ice_ram', structureNewPos, timestamp,
            { iceRamOwner: pid, structurePosition: structureNewPos },
          ));
        }
      }
    }
  }

  return processedEvents;
}

