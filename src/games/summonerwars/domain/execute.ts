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
  EventCard,
  StructureCard,
  CellCoord,
  BoardUnit,
} from './types';
import { SW_COMMANDS, SW_EVENTS, SW_SELECTION_EVENTS } from './types';
import {
  BOARD_ROWS,
  BOARD_COLS,
  getUnitAt,
  getStructureAt,
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
  calculatePushPullPosition,
  getPlayerUnits,
  HAND_SIZE,
} from './helpers';
import { rollDice, countHits } from '../config/dice';
import { createDeckByFactionId } from '../config/factions';
import { calculateEffectiveStrength, getEffectiveLife, triggerAbilities, triggerAllUnitsAbilities, hasHellfireBlade } from './abilityResolver';
import { reduceEvent } from './reduce';
import type { AbilityContext } from './abilityResolver';

// ============================================================================
// 辅助函数
// ============================================================================

/**
 * 检查双方主动事件区是否有殉葬火堆，有则生成充能事件
 */
function getFuneralPyreChargeEvents(core: SummonerWarsCore, timestamp: number): GameEvent[] {
  const events: GameEvent[] = [];
  for (const pid of ['0', '1'] as PlayerId[]) {
    const player = core.players[pid];
    for (const ev of player.activeEvents) {
      if (ev.name === '殉葬火堆' || ev.id.includes('funeral-pyre')) {
        events.push({
          type: SW_EVENTS.FUNERAL_PYRE_CHARGED,
          payload: { playerId: pid, cardId: ev.id },
          timestamp,
        });
      }
    }
  }
  return events;
}

/** 获取阶段显示名称 */
export function getPhaseDisplayName(phase: string): string {
  const names: Record<string, string> = {
    summon: '召唤阶段',
    move: '移动阶段',
    build: '建造阶段',
    attack: '攻击阶段',
    magic: '魔力阶段',
    draw: '抽牌阶段',
  };
  return names[phase] ?? phase;
}

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
  const timestamp = command.timestamp ?? Date.now();

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
                position: from, // 伤害发生在离开的位置（移动前）
                damage: 1,
                reason: 'entangle',
                sourceUnitId: eu.cardId,
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
        const unitAbilities = unit.card.abilities ?? [];
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

        // 抓附检查：友方单位从抓附手相邻位置移动后，抓附手可跟随
        if (unit.owner === playerId) {
          const grabbers = getPlayerUnits(core, playerId).filter(u =>
            u.cardId !== unit.cardId
            && (u.card.abilities ?? []).includes('grab')
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
          const sourceAbilities = sourceUnit.card.abilities ?? [];
          if (!sourceAbilities.includes(beforeAttack.abilityId)) {
            continue;
          }

          const abilityTriggeredEvent: GameEvent = {
            type: SW_EVENTS.ABILITY_TRIGGERED,
            payload: {
              abilityId: beforeAttack.abilityId,
              abilityName: beforeAttack.abilityId,
              sourceUnitId: sourceUnit.cardId,
              sourcePosition: attacker,
            },
            timestamp,
          };

          switch (beforeAttack.abilityId) {
            case 'life_drain': {
              if (!beforeAttack.targetUnitId) {
                applyBeforeAttackEvents([abilityTriggeredEvent]);
                break;
              }
              let victimUnit: BoardUnit | undefined;
              let victimPosition: CellCoord | undefined;
              for (let row = 0; row < BOARD_ROWS; row++) {
                for (let col = 0; col < BOARD_COLS; col++) {
                  const unit = workingCore.board[row]?.[col]?.unit;
                  if (unit && unit.cardId === beforeAttack.targetUnitId && unit.owner === playerId) {
                    victimUnit = unit;
                    victimPosition = { row, col };
                    break;
                  }
                }
                if (victimUnit) break;
              }
              const lifeDrainEvents: GameEvent[] = [abilityTriggeredEvent];
              if (victimUnit && victimPosition) {
                const onDestroyedEvents = triggerAllUnitsAbilities('onUnitDestroyed', workingCore, playerId, {
                  victimUnit,
                  victimPosition,
                  timestamp,
                });
                lifeDrainEvents.push({
                  type: SW_EVENTS.UNIT_DESTROYED,
                  payload: {
                    position: victimPosition,
                    cardId: victimUnit.cardId,
                    cardName: victimUnit.card.name,
                    owner: victimUnit.owner,
                    reason: 'life_drain',
                  },
                  timestamp,
                });
                const victimCtx: AbilityContext = {
                  state: workingCore,
                  sourceUnit: victimUnit,
                  sourcePosition: victimPosition,
                  ownerId: victimUnit.owner,
                  killerUnit: sourceUnit,
                  timestamp,
                };
                lifeDrainEvents.push(...triggerAbilities('onDeath', victimCtx));
                lifeDrainEvents.push(...onDestroyedEvents);
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
                && (shieldUnit.card.abilities ?? []).includes('divine_shield')
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
        const attackerAbilities = attackerUnit.card.abilities ?? [];
        const hasMindCapture = attackerAbilities.includes('mind_capture');
        
        if (hasMindCapture && hits > 0 && targetCell?.unit) {
          const targetUnit = targetCell.unit;
          const wouldKill = targetUnit.damage + hits >= getEffectiveLife(targetUnit);
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
              const baseId = ev.id.replace(/-\d+-\d+$/, '').replace(/-\d+$/, '');
              return baseId === 'paladin-holy-protection';
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
            payload: { position: target, damage: hits, ...(attackerHasSoulless ? { skipMagicReward: true } : {}) },
            timestamp,
          });
          
          if (targetCell?.unit) {
            const newDamage = targetCell.unit.damage + hits;
            if (newDamage >= getEffectiveLife(targetCell.unit)) {
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
                state: workingCore,
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
                state: workingCore,
                sourceUnit: targetCell.unit,
                sourcePosition: target,
                ownerId: targetCell.unit.owner,
                killerUnit: attackerUnit,
                timestamp,
              };
              events.push(...triggerAbilities('onDeath', victimCtx));
              
              // 触发所有单位的 onUnitDestroyed 技能（血腥狂怒）
              events.push(...triggerAllUnitsAbilities('onUnitDestroyed', workingCore, playerId, {
                victimUnit: targetCell.unit,
                victimPosition: target,
                timestamp,
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
        
        // 狱火铸剑诅咒效果
        if (hasHellfireBlade(attackerUnit)) {
          const meleeHits = diceResults.filter(r => r === 'melee').length;
          if (meleeHits > 0) {
            events.push({
              type: SW_EVENTS.UNIT_DAMAGED,
              payload: { position: attacker, damage: meleeHits, reason: 'curse' },
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
      const cardId = payload.cardId as string;
      const targets = payload.targets as CellCoord[] | undefined;
      const player = core.players[playerId];
      const card = player.hand.find(c => c.id === cardId);
      
      if (card && card.cardType === 'event') {
        const eventCard = card as EventCard;
        
        if (eventCard.cost > 0) {
          events.push({
            type: SW_EVENTS.MAGIC_CHANGED,
            payload: { playerId, delta: -eventCard.cost },
            timestamp,
          });
        }
        
        const baseId = eventCard.id.replace(/-\d+-\d+$/, '').replace(/-\d+$/, '');
        const isAttachment = baseId === 'necro-hellfire-blade';
        
        events.push({
          type: SW_EVENTS.EVENT_PLAYED,
          payload: { 
            playerId, cardId, card: eventCard,
            isActive: eventCard.isActive ?? false, isAttachment,
          },
          timestamp,
        });

        switch (baseId) {
          case 'necro-hellfire-blade': {
            if (targets && targets.length > 0) {
              events.push({
                type: SW_EVENTS.EVENT_ATTACHED,
                payload: { playerId, cardId, card: eventCard, targetPosition: targets[0] },
                timestamp,
              });
            }
            break;
          }
          case 'necro-annihilate': {
            const damageTargets = payload.damageTargets as (CellCoord | null)[] | undefined;
            if (targets && targets.length > 0) {
              for (let i = 0; i < targets.length; i++) {
                const damageTarget = damageTargets?.[i];
                if (damageTarget) {
                  const damageUnit = getUnitAt(core, damageTarget);
                  const damageStructure = getStructureAt(core, damageTarget);
                  if (damageUnit || damageStructure) {
                    events.push({
                      type: SW_EVENTS.UNIT_DAMAGED,
                      payload: {
                        position: damageTarget,
                        cardId: damageUnit?.cardId ?? damageStructure?.cardId,
                        damage: 2, source: 'annihilate',
                      },
                      timestamp,
                    });
                  }
                }
              }
              for (const targetPos of targets) {
                const targetUnit = getUnitAt(core, targetPos);
                if (targetUnit && targetUnit.owner === playerId) {
                  events.push({
                    type: SW_EVENTS.UNIT_DESTROYED,
                    payload: {
                      position: targetPos, cardId: targetUnit.cardId,
                      cardName: targetUnit.card.name, owner: targetUnit.owner,
                    },
                    timestamp,
                  });
                  events.push(...triggerAllUnitsAbilities('onUnitDestroyed', core, playerId, {
                    victimUnit: targetUnit,
                    victimPosition: targetPos,
                    timestamp,
                  }));
                }
              }
            }
            break;
          }

          // ============ 欺心巫族事件卡 ============

          case 'trickster-mind-control': {
            // 心灵操控（传奇）：召唤师2格内任意数量敌方士兵和英雄，获得控制权直到回合结束
            // targets = 选中的敌方单位位置列表
            const summoner = getSummoner(core, playerId);
            if (summoner && targets && targets.length > 0) {
              for (const targetPos of targets) {
                const targetUnit = getUnitAt(core, targetPos);
                if (targetUnit && targetUnit.owner !== playerId
                  && targetUnit.card.unitClass !== 'summoner') {
                  const dist = manhattanDistance(summoner.position, targetPos);
                  if (dist <= 2) {
                    events.push({
                      type: SW_EVENTS.CONTROL_TRANSFERRED,
                      payload: {
                        targetPosition: targetPos,
                        targetUnitId: targetUnit.cardId,
                        newOwner: playerId,
                        temporary: true, // 标记为临时控制（回合结束归还）
                        originalOwner: targetUnit.owner,
                      },
                      timestamp,
                    });
                  }
                }
              }
            }
            break;
          }

          case 'trickster-storm-assault': {
            // 风暴侵袭（ACTIVE）：单位必须减少移动1格
            // isActive=true，已由 EVENT_PLAYED 处理放入主动区域
            // 实际效果在移动验证时检查主动事件区
            break;
          }

          case 'trickster-stun': {
            // 震慑：召唤师3格直线内的一个士兵或英雄，推拉1-3格可穿过单位，对目标和被穿过的单位各造成1伤害
            // targets[0] = 目标位置
            // payload.stunDirection = 'push' | 'pull'
            // payload.stunDistance = 1-3
            const stunSummoner = getSummoner(core, playerId);
            if (stunSummoner && targets && targets.length > 0) {
              const stunTarget = targets[0];
              const stunUnit = getUnitAt(core, stunTarget);
              if (stunUnit && stunUnit.card.unitClass !== 'summoner') {
                const stunDirection = (payload.stunDirection as 'push' | 'pull') ?? 'push';
                const stunDistance = Math.min(3, Math.max(1, (payload.stunDistance as number) ?? 1));

                // 计算推拉方向向量
                const dr = stunTarget.row - stunSummoner.position.row;
                const dc = stunTarget.col - stunSummoner.position.col;
                let moveRow = 0;
                let moveCol = 0;
                if (stunDirection === 'push') {
                  if (Math.abs(dr) >= Math.abs(dc)) { moveRow = dr > 0 ? 1 : -1; }
                  else { moveCol = dc > 0 ? 1 : -1; }
                } else {
                  if (Math.abs(dr) >= Math.abs(dc)) { moveRow = dr > 0 ? -1 : 1; }
                  else { moveCol = dc > 0 ? -1 : 1; }
                }

                // 逐格推拉，可穿过士兵和英雄，对穿过的单位造成1伤害
                let currentPos = { ...stunTarget };
                for (let step = 0; step < stunDistance; step++) {
                  const nextPos = {
                    row: currentPos.row + moveRow,
                    col: currentPos.col + moveCol,
                  };
                  if (!isValidCoord(nextPos)) break;

                  const occupant = getUnitAt(core, nextPos);
                  if (occupant) {
                    // 穿过单位：对被穿过的单位造成1伤害
                    events.push({
                      type: SW_EVENTS.UNIT_DAMAGED,
                      payload: { position: nextPos, damage: 1, reason: 'stun_passthrough' },
                      timestamp,
                    });
                    // 继续穿过（震慑可穿过士兵和英雄）
                  } else if (getStructureAt(core, nextPos)) {
                    // 建筑阻挡，停止
                    break;
                  }
                  currentPos = nextPos;
                }

                // 对目标造成1伤害
                events.push({
                  type: SW_EVENTS.UNIT_DAMAGED,
                  payload: { position: stunTarget, damage: 1, reason: 'stun' },
                  timestamp,
                });

                // 移动目标到最终位置（如果位置变了且目标位置为空）
                if (currentPos.row !== stunTarget.row || currentPos.col !== stunTarget.col) {
                  if (isCellEmpty(core, currentPos)) {
                    events.push({
                      type: SW_EVENTS.UNIT_PUSHED,
                      payload: { targetPosition: stunTarget, newPosition: currentPos },
                      timestamp,
                    });
                  }
                }
              }
            }
            break;
          }

          case 'trickster-hypnotic-lure': {
            // 催眠引诱：拉目标向召唤师靠近1格 + ACTIVE（攻击该目标时+1战力）
            // targets[0] = 目标位置
            // isActive=true，已由 EVENT_PLAYED 处理放入主动区域
            const lureSummoner = getSummoner(core, playerId);
            if (lureSummoner && targets && targets.length > 0) {
              const lureTarget = targets[0];
              const lureUnit = getUnitAt(core, lureTarget);
              if (lureUnit && lureUnit.card.unitClass !== 'summoner') {
                // 拉向召唤师1格
                const pullPos = calculatePushPullPosition(
                  core, lureTarget, lureSummoner.position, 1, 'pull'
                );
                if (pullPos) {
                  events.push({
                    type: SW_EVENTS.UNIT_PULLED,
                    payload: { targetPosition: lureTarget, newPosition: pullPos },
                    timestamp,
                  });
                }
                // 标记被催眠的目标（用于主动事件区的战力加成）
                events.push({
                  type: SW_EVENTS.HYPNOTIC_LURE_MARKED,
                  payload: { playerId, cardId, targetUnitId: lureUnit.cardId },
                  timestamp,
                });
              }
            }
            break;
          }

          // ============ 洞穴地精事件卡 ============

          case 'goblin-frenzy': {
            // 群情激愤（传奇）：所有0费友方单位获得额外攻击
            const frenzyUnits = getPlayerUnits(core, playerId);
            for (const u of frenzyUnits) {
              if (u.card.cost === 0 && u.card.unitClass !== 'summoner') {
                events.push({
                  type: SW_EVENTS.EXTRA_ATTACK_GRANTED,
                  payload: {
                    targetPosition: u.position,
                    targetUnitId: u.cardId,
                    sourceAbilityId: 'goblin_frenzy',
                  },
                  timestamp,
                });
              }
            }
            break;
          }

          case 'goblin-sneak': {
            // 潜行：推拉任意数量0费友方单位1格
            // targets = 选中的友方单位位置列表
            // payload.sneakDirections = 每个目标的推拉方向和目标位置
            const sneakDirections = payload.sneakDirections as { position: CellCoord; newPosition: CellCoord }[] | undefined;
            if (sneakDirections && sneakDirections.length > 0) {
              for (const sd of sneakDirections) {
                const sneakUnit = getUnitAt(core, sd.position);
                if (sneakUnit && sneakUnit.owner === playerId && sneakUnit.card.cost === 0
                  && sneakUnit.card.unitClass !== 'summoner') {
                  if (isCellEmpty(core, sd.newPosition) && isValidCoord(sd.newPosition)
                    && manhattanDistance(sd.position, sd.newPosition) === 1) {
                    events.push({
                      type: SW_EVENTS.UNIT_PUSHED,
                      payload: { targetPosition: sd.position, newPosition: sd.newPosition },
                      timestamp,
                    });
                  }
                }
              }
            }
            break;
          }

          case 'goblin-relentless': {
            // 不屈不挠（ACTIVE）：友方士兵被消灭时返回手牌
            // isActive=true，已由 EVENT_PLAYED 处理放入主动区域
            // 实际效果在 UNIT_DESTROYED 处理时检查主动事件区
            break;
          }

          case 'goblin-swarm': {
            // 成群结队（ACTIVE）：友方单位获得围攻（每有一个友方相邻目标+1战力）
            // isActive=true，已由 EVENT_PLAYED 处理放入主动区域
            // 实际效果在 calculateEffectiveStrength 中检查
            break;
          }

          // ============ 先锋军团事件卡 ============

          case 'paladin-holy-judgment': {
            // 圣洁审判（传奇/ACTIVE）：放置2点充能，友方士兵+1战力
            // isActive=true，已由 EVENT_PLAYED 处理放入主动区域
            // 设置初始充能为2
            events.push({
              type: SW_EVENTS.FUNERAL_PYRE_CHARGED,
              payload: { playerId, eventCardId: cardId, charges: 2 },
              timestamp,
            });
            break;
          }

          case 'paladin-holy-protection': {
            // 圣灵庇护（ACTIVE）：召唤师3格内友方士兵获得庇护
            // isActive=true，已由 EVENT_PLAYED 处理放入主动区域
            // 实际效果在伤害计算时检查
            break;
          }

          case 'paladin-mass-healing': {
            // 群体治疗：召唤师2格内每个友方士兵和英雄移除2点伤害
            const mhSummoner = getSummoner(core, playerId);
            if (mhSummoner) {
              const mhUnits = getPlayerUnits(core, playerId);
              for (const u of mhUnits) {
                if (u.card.unitClass !== 'summoner' && u.damage > 0) {
                  const dist = manhattanDistance(mhSummoner.position, u.position);
                  if (dist <= 2) {
                    events.push({
                      type: SW_EVENTS.UNIT_HEALED,
                      payload: { position: u.position, amount: 2, sourceAbilityId: 'mass_healing' },
                      timestamp,
                    });
                  }
                }
              }
            }
            break;
          }

          case 'paladin-rekindle-hope': {
            // 重燃希望（ACTIVE）：可在任意阶段召唤，可召唤到召唤师相邻
            // isActive=true，已由 EVENT_PLAYED 处理放入主动区域
            // 实际效果在召唤验证时检查
            break;
          }

          // ============ 极地矮人事件卡 ============

          case 'frost-ice-ram': {
            // 寒冰冲撞（传奇/ACTIVE）：友方建筑移动/推拉后对相邻单位造成1伤+推拉1格
            // isActive=true，已由 EVENT_PLAYED 处理放入主动区域
            // 实际效果在建筑移动/推拉时检查
            break;
          }

          case 'frost-glacial-shift': {
            // 冰川位移：召唤师3格内至多3个友方建筑推拉1-2格
            // targets = 选中的友方建筑位置列表
            // payload.shiftDirections = 每个建筑的推拉方向和目标位置
            const gsSummoner = getSummoner(core, playerId);
            const shiftDirections = payload.shiftDirections as { position: CellCoord; newPosition: CellCoord }[] | undefined;
            if (gsSummoner && shiftDirections && shiftDirections.length > 0) {
              for (const sd of shiftDirections) {
                const structure = getStructureAt(core, sd.position);
                if (structure && structure.owner === playerId) {
                  const dist = manhattanDistance(gsSummoner.position, sd.position);
                  if (dist <= 3 && isValidCoord(sd.newPosition)
                    && isCellEmpty(core, sd.newPosition)
                    && manhattanDistance(sd.position, sd.newPosition) <= 2) {
                    events.push({
                      type: SW_EVENTS.UNIT_PUSHED,
                      payload: { targetPosition: sd.position, newPosition: sd.newPosition, isStructure: true },
                      timestamp,
                    });
                  }
                }
              }
            }
            break;
          }

          case 'frost-ice-repair': {
            // 寒冰修补：每个友方建筑移除2点伤害
            for (let r = 0; r < BOARD_ROWS; r++) {
              for (let c = 0; c < BOARD_COLS; c++) {
                const structure = getStructureAt(core, { row: r, col: c });
                if (structure && structure.owner === playerId && structure.damage > 0) {
                  events.push({
                    type: SW_EVENTS.STRUCTURE_HEALED,
                    payload: { position: { row: r, col: c }, amount: 2, reason: 'ice_repair' },
                    timestamp,
                  });
                }
              }
            }
            break;
          }

          // ============ 炽原精灵事件卡 ============

          case 'barbaric-chant-of-power': {
            // 力量颂歌（传奇）：目标获得 power_up 直到回合结束
            // targets[0] = 目标位置（召唤师3格内的士兵或英雄）
            if (targets && targets.length > 0) {
              const cpTarget = getUnitAt(core, targets[0]);
              if (cpTarget && cpTarget.owner === playerId
                && cpTarget.card.unitClass !== 'summoner') {
                events.push({
                  type: SW_EVENTS.ABILITY_TRIGGERED,
                  payload: {
                    abilityId: 'chant_of_power',
                    targetPosition: targets[0],
                    targetUnitId: cpTarget.cardId,
                    grantedAbility: 'power_up',
                    duration: 'end_of_turn',
                  },
                  timestamp,
                });
              }
            }
            break;
          }

          case 'barbaric-chant-of-growth': {
            // 生长颂歌：将目标和每个相邻友方单位充能
            if (targets && targets.length > 0) {
              const cgTarget = getUnitAt(core, targets[0]);
              if (cgTarget && cgTarget.owner === playerId) {
                // 充能目标
                events.push({
                  type: SW_EVENTS.UNIT_CHARGED,
                  payload: { position: targets[0], delta: 1, sourceAbilityId: 'chant_of_growth' },
                  timestamp,
                });
                // 充能相邻友方
                const adjDirs = [
                  { row: -1, col: 0 }, { row: 1, col: 0 },
                  { row: 0, col: -1 }, { row: 0, col: 1 },
                ];
                for (const d of adjDirs) {
                  const adjPos = { row: targets[0].row + d.row, col: targets[0].col + d.col };
                  if (!isValidCoord(adjPos)) continue;
                  const adjUnit = getUnitAt(core, adjPos);
                  if (adjUnit && adjUnit.owner === playerId) {
                    events.push({
                      type: SW_EVENTS.UNIT_CHARGED,
                      payload: { position: adjPos, delta: 1, sourceAbilityId: 'chant_of_growth' },
                      timestamp,
                    });
                  }
                }
              }
            }
            break;
          }

          case 'barbaric-chant-of-entanglement': {
            // 交缠颂歌（ACTIVE）：两个友方士兵共享技能
            // isActive=true，已由 EVENT_PLAYED 处理放入主动区域
            // 实际效果在技能查询时检查主动事件区
            if (targets && targets.length >= 2) {
              const entTarget1 = getUnitAt(core, targets[0]);
              const entTarget2 = getUnitAt(core, targets[1]);
              if (entTarget1 && entTarget2) {
                events.push({
                  type: SW_EVENTS.ABILITY_TRIGGERED,
                  payload: {
                    abilityId: 'chant_of_entanglement',
                    targetUnitId1: entTarget1.cardId,
                    targetUnitId2: entTarget2.cardId,
                  },
                  timestamp,
                });
              }
            }
            break;
          }

          case 'barbaric-chant-of-weaving': {
            // 编织颂歌（ACTIVE）：可在目标相邻召唤，召唤时充能目标
            // isActive=true，已由 EVENT_PLAYED 处理放入主动区域
            // 实际效果在召唤验证和召唤执行时检查
            if (targets && targets.length > 0) {
              const cwTarget = getUnitAt(core, targets[0]);
              if (cwTarget && cwTarget.owner === playerId) {
                events.push({
                  type: SW_EVENTS.ABILITY_TRIGGERED,
                  payload: {
                    abilityId: 'chant_of_weaving',
                    targetUnitId: cwTarget.cardId,
                    targetPosition: targets[0],
                  },
                  timestamp,
                });
              }
            }
            break;
          }
        }
      }
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
          payload: { position: targetPos, damage: 2, reason: 'blood_summon' },
          timestamp,
        });
        const newDamage = targetUnit.damage + 2;
        if (newDamage >= getEffectiveLife(targetUnit)) {
          events.push({
            type: SW_EVENTS.UNIT_DESTROYED,
            payload: {
              position: targetPos, cardId: targetUnit.cardId,
              cardName: targetUnit.card.name, owner: targetUnit.owner,
            },
            timestamp,
          });
          events.push(...triggerAllUnitsAbilities('onUnitDestroyed', core, playerId, {
            victimUnit: targetUnit,
            victimPosition: targetPos,
            timestamp,
          }));
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
            payload: { position: summoner.position, damage: 1, reason: 'inaction' },
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
            const deckData = createDeckByFactionId(factionId as import('./types').FactionId);
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

  // 后处理：扫描所有 UNIT_DESTROYED 事件，为殉葬火堆生成充能事件
  const destroyCount = events.filter(e => e.type === SW_EVENTS.UNIT_DESTROYED).length;
  if (destroyCount > 0) {
    for (let i = 0; i < destroyCount; i++) {
      events.push(...getFuneralPyreChargeEvents(core, timestamp));
    }
  }

  return events;
}

// ============================================================================
// ACTIVATE_ABILITY 子命令处理
// ============================================================================

function executeActivateAbility(
  events: GameEvent[],
  core: SummonerWarsCore,
  playerId: PlayerId,
  payload: Record<string, unknown>,
  timestamp: number
): void {
  const abilityId = payload.abilityId as string;
  const sourceUnitId = payload.sourceUnitId as string;
  const targetCardId = payload.targetCardId as string | undefined;
  const targetPosition = payload.targetPosition as CellCoord | undefined;
  const targetUnitId = payload.targetUnitId as string | undefined;
  
  // 查找源单位
  let sourceUnit: BoardUnit | undefined;
  let sourcePosition: CellCoord | undefined;
  for (let row = 0; row < BOARD_ROWS; row++) {
    for (let col = 0; col < BOARD_COLS; col++) {
      const unit = core.board[row]?.[col]?.unit;
      if (unit && unit.cardId === sourceUnitId) {
        sourceUnit = unit;
        sourcePosition = { row, col };
        break;
      }
    }
    if (sourceUnit) break;
  }
  
  if (!sourceUnit || !sourcePosition) {
    console.warn('[SummonerWars] 技能源单位未找到:', sourceUnitId);
    return;
  }

  events.push({
    type: SW_EVENTS.ABILITY_TRIGGERED,
    payload: { abilityId, abilityName: abilityId, sourceUnitId, sourcePosition },
    timestamp,
  });

  switch (abilityId) {
    case 'revive_undead': {
      if (!targetCardId || !targetPosition) break;
      events.push({
        type: SW_EVENTS.UNIT_DAMAGED,
        payload: { position: sourcePosition, damage: 2, reason: 'revive_undead' },
        timestamp,
      });
      const player = core.players[playerId];
      const card = player.discard.find(c => c.id === targetCardId);
      if (card && card.cardType === 'unit') {
        events.push({
          type: SW_EVENTS.UNIT_SUMMONED,
          payload: { playerId, cardId: targetCardId, position: targetPosition, card: card as UnitCard, fromDiscard: true },
          timestamp,
        });
      }
      break;
    }

    case 'fire_sacrifice_summon': {
      if (!targetUnitId) break;
      let victimUnit: BoardUnit | undefined;
      let victimPosition: CellCoord | undefined;
      for (let row = 0; row < BOARD_ROWS; row++) {
        for (let col = 0; col < BOARD_COLS; col++) {
          const unit = core.board[row]?.[col]?.unit;
          if (unit && unit.cardId === targetUnitId && unit.owner === playerId) {
            victimUnit = unit;
            victimPosition = { row, col };
            break;
          }
        }
        if (victimUnit) break;
      }
      if (victimUnit && victimPosition) {
        events.push({
          type: SW_EVENTS.UNIT_DESTROYED,
          payload: { position: victimPosition, cardId: victimUnit.cardId, cardName: victimUnit.card.name, owner: victimUnit.owner, reason: 'fire_sacrifice_summon' },
          timestamp,
        });
        events.push(...triggerAllUnitsAbilities('onUnitDestroyed', core, playerId, {
          victimUnit,
          victimPosition,
          timestamp,
        }));
        events.push({
          type: SW_EVENTS.UNIT_MOVED,
          payload: { from: sourcePosition, to: victimPosition, unitId: sourceUnitId, reason: 'fire_sacrifice_summon' },
          timestamp,
        });
      }
      break;
    }

    case 'life_drain': {
      if (!targetUnitId) break;
      let victimUnit: BoardUnit | undefined;
      let victimPosition: CellCoord | undefined;
      for (let row = 0; row < BOARD_ROWS; row++) {
        for (let col = 0; col < BOARD_COLS; col++) {
          const unit = core.board[row]?.[col]?.unit;
          if (unit && unit.cardId === targetUnitId && unit.owner === playerId) {
            victimUnit = unit;
            victimPosition = { row, col };
            break;
          }
        }
        if (victimUnit) break;
      }
      if (victimUnit && victimPosition) {
        events.push({
          type: SW_EVENTS.UNIT_DESTROYED,
          payload: { position: victimPosition, cardId: victimUnit.cardId, cardName: victimUnit.card.name, owner: victimUnit.owner, reason: 'life_drain' },
          timestamp,
        });
        events.push(...triggerAllUnitsAbilities('onUnitDestroyed', core, playerId, {
          victimUnit,
          victimPosition,
          timestamp,
        }));
        events.push({
          type: SW_EVENTS.STRENGTH_MODIFIED,
          payload: { position: sourcePosition, multiplier: 2, sourceAbilityId: 'life_drain' },
          timestamp,
        });
      }
      break;
    }

    case 'infection': {
      if (!targetCardId || !targetPosition) break;
      const player = core.players[playerId];
      const card = player.discard.find(c => c.id === targetCardId);
      if (card && card.cardType === 'unit') {
        events.push({
          type: SW_EVENTS.UNIT_SUMMONED,
          payload: { playerId, cardId: targetCardId, position: targetPosition, card: card as UnitCard, fromDiscard: true },
          timestamp,
        });
      }
      break;
    }

    case 'soul_transfer': {
      if (!targetPosition) break;
      events.push({
        type: SW_EVENTS.UNIT_MOVED,
        payload: { from: sourcePosition, to: targetPosition, unitId: sourceUnitId, reason: 'soul_transfer' },
        timestamp,
      });
      break;
    }

    case 'mind_capture_resolve': {
      // 心灵捕获决策：控制目标 or 造成伤害
      const choice = payload.choice as 'control' | 'damage';
      const captureTargetPos = payload.targetPosition as CellCoord | undefined;
      const captureHits = payload.hits as number | undefined;
      if (!captureTargetPos) break;
      
      if (choice === 'control') {
        // 控制目标：转移控制权
        const captureTarget = getUnitAt(core, captureTargetPos);
        if (captureTarget && captureTarget.owner !== playerId) {
          events.push({
            type: SW_EVENTS.CONTROL_TRANSFERRED,
            payload: {
              targetPosition: captureTargetPos,
              targetUnitId: captureTarget.cardId,
              newOwner: playerId,
              duration: 'permanent',
              sourceAbilityId: 'mind_capture',
            },
            timestamp,
          });
        }
      } else if (choice === 'damage' && captureHits) {
        // 造成伤害（正常攻击流程）
        events.push({
          type: SW_EVENTS.UNIT_DAMAGED,
          payload: { position: captureTargetPos, damage: captureHits },
          timestamp,
        });
        const captureTarget = getUnitAt(core, captureTargetPos);
        if (captureTarget) {
          const newDamage = captureTarget.damage + captureHits;
          if (newDamage >= getEffectiveLife(captureTarget)) {
            events.push({
              type: SW_EVENTS.UNIT_DESTROYED,
              payload: {
                position: captureTargetPos, cardId: captureTarget.cardId,
                cardName: captureTarget.card.name, owner: captureTarget.owner,
              },
              timestamp,
            });
            const killerCtx: AbilityContext = {
              state: core,
              sourceUnit,
              sourcePosition,
              ownerId: playerId,
              victimUnit: captureTarget,
              victimPosition: captureTargetPos,
              timestamp,
            };
            events.push(...triggerAbilities('onKill', killerCtx));

            const victimCtx: AbilityContext = {
              state: core,
              sourceUnit: captureTarget,
              sourcePosition: captureTargetPos,
              ownerId: captureTarget.owner,
              killerUnit: sourceUnit,
              timestamp,
            };
            events.push(...triggerAbilities('onDeath', victimCtx));

            events.push(...triggerAllUnitsAbilities('onUnitDestroyed', core, playerId, {
              victimUnit: captureTarget,
              victimPosition: captureTargetPos,
              timestamp,
            }));
          }
        }
      }
      break;
    }

    case 'telekinesis':
    case 'high_telekinesis': {
      // 念力/高阶念力：推拉目标1格
      const pushPullTargetPos = payload.targetPosition as CellCoord | undefined;
      const pushPullDirection = payload.direction as 'push' | 'pull' | undefined;
      if (!pushPullTargetPos || !pushPullDirection) break;
      
      const pushPullTarget = getUnitAt(core, pushPullTargetPos);
      if (!pushPullTarget || pushPullTarget.card.unitClass === 'summoner') break;
      
      // 检查稳固免疫
      if ((pushPullTarget.card.abilities ?? []).includes('stable')) break;
      
      // 检查范围
      const maxRange = abilityId === 'high_telekinesis' ? 3 : 2;
      const dist = manhattanDistance(sourcePosition, pushPullTargetPos);
      if (dist > maxRange) break;
      
      // 计算推拉方向向量
      const dr = pushPullTargetPos.row - sourcePosition.row;
      const dc = pushPullTargetPos.col - sourcePosition.col;
      let moveRow = 0;
      let moveCol = 0;
      if (pushPullDirection === 'push') {
        if (Math.abs(dr) >= Math.abs(dc)) { moveRow = dr > 0 ? 1 : -1; }
        else { moveCol = dc > 0 ? 1 : -1; }
      } else {
        if (Math.abs(dr) >= Math.abs(dc)) { moveRow = dr > 0 ? -1 : 1; }
        else { moveCol = dc > 0 ? -1 : 1; }
      }
      
      const newPos = { row: pushPullTargetPos.row + moveRow, col: pushPullTargetPos.col + moveCol };
      if (isValidCoord(newPos) && isCellEmpty(core, newPos)) {
        const eventType = pushPullDirection === 'pull' ? SW_EVENTS.UNIT_PULLED : SW_EVENTS.UNIT_PUSHED;
        events.push({
          type: eventType,
          payload: { targetPosition: pushPullTargetPos, newPosition: newPos },
          timestamp,
        });
      }
      break;
    }

    case 'mind_transmission': {
      // 读心传念：给友方士兵额外攻击
      const extraAttackTargetPos = payload.targetPosition as CellCoord | undefined;
      if (!extraAttackTargetPos) break;
      
      const extraAttackTarget = getUnitAt(core, extraAttackTargetPos);
      if (!extraAttackTarget) break;
      if (extraAttackTarget.owner !== playerId) break;
      if (extraAttackTarget.card.unitClass !== 'common') break;
      
      const extraDist = manhattanDistance(sourcePosition, extraAttackTargetPos);
      if (extraDist > 3) break;
      
      events.push({
        type: SW_EVENTS.EXTRA_ATTACK_GRANTED,
        payload: {
          targetPosition: extraAttackTargetPos,
          targetUnitId: extraAttackTarget.cardId,
          sourceAbilityId: 'mind_transmission',
        },
        timestamp,
      });
      break;
    }

    // ============ 洞穴地精技能 ============

    case 'vanish': {
      // 神出鬼没：与0费友方单位交换位置
      const vanishTargetPos = payload.targetPosition as CellCoord | undefined;
      if (!vanishTargetPos) break;
      const vanishTarget = getUnitAt(core, vanishTargetPos);
      if (!vanishTarget || vanishTarget.owner !== playerId || vanishTarget.card.cost !== 0) break;
      
      events.push({
        type: SW_EVENTS.UNITS_SWAPPED,
        payload: {
          positionA: sourcePosition,
          positionB: vanishTargetPos,
          unitIdA: sourceUnit.cardId,
          unitIdB: vanishTarget.cardId,
        },
        timestamp,
      });
      break;
    }

    case 'blood_rune': {
      // 鲜血符文：自伤1 或 花1魔力充能
      const brChoice = payload.choice as 'damage' | 'charge';
      if (brChoice === 'damage') {
        events.push({
          type: SW_EVENTS.UNIT_DAMAGED,
          payload: { position: sourcePosition, damage: 1, reason: 'blood_rune' },
          timestamp,
        });
      } else if (brChoice === 'charge') {
        events.push({
          type: SW_EVENTS.MAGIC_CHANGED,
          payload: { playerId, delta: -1 },
          timestamp,
        });
        events.push({
          type: SW_EVENTS.UNIT_CHARGED,
          payload: { position: sourcePosition, delta: 1 },
          timestamp,
        });
      }
      break;
    }

    case 'feed_beast': {
      // 喂养巨食兽：移除相邻友方单位或自毁
      const fbChoice = payload.choice as string | undefined;
      if (fbChoice === 'self_destroy') {
        events.push({
          type: SW_EVENTS.UNIT_DESTROYED,
          payload: {
            position: sourcePosition, cardId: sourceUnit.cardId,
            cardName: sourceUnit.card.name, owner: sourceUnit.owner,
            reason: 'feed_beast_self',
          },
          timestamp,
        });
      } else {
        const fbTargetPos = payload.targetPosition as CellCoord | undefined;
        if (!fbTargetPos) break;
        const fbTarget = getUnitAt(core, fbTargetPos);
        if (!fbTarget || fbTarget.owner !== playerId) break;
        events.push({
          type: SW_EVENTS.UNIT_DESTROYED,
          payload: {
            position: fbTargetPos, cardId: fbTarget.cardId,
            cardName: fbTarget.card.name, owner: fbTarget.owner,
            reason: 'feed_beast',
          },
          timestamp,
        });
      }
      break;
    }

    case 'magic_addiction': {
      // 魔力成瘾：有魔力扣1，无魔力自毁
      if (core.players[playerId].magic >= 1) {
        events.push({
          type: SW_EVENTS.MAGIC_CHANGED,
          payload: { playerId, delta: -1 },
          timestamp,
        });
      } else {
        events.push({
          type: SW_EVENTS.UNIT_DESTROYED,
          payload: {
            position: sourcePosition, cardId: sourceUnit.cardId,
            cardName: sourceUnit.card.name, owner: sourceUnit.owner,
            reason: 'magic_addiction',
          },
          timestamp,
        });
      }
      break;
    }

    case 'grab': {
      // 抓附跟随：将抓附手移动到目标位置
      const grabTargetPos = payload.targetPosition as CellCoord | undefined;
      if (!grabTargetPos) break;
      if (!isCellEmpty(core, grabTargetPos)) break;
      events.push({
        type: SW_EVENTS.UNIT_MOVED,
        payload: { from: sourcePosition, to: grabTargetPos, unitId: sourceUnitId, reason: 'grab' },
        timestamp,
      });
      break;
    }

    // ============ 先锋军团技能 ============

    case 'fortress_power': {
      // 城塞之力：从弃牌堆拿取一张城塞单位到手牌
      if (!targetCardId) break;
      const fpPlayer = core.players[playerId];
      const fpCard = fpPlayer.discard.find(c => c.id === targetCardId);
      if (!fpCard || fpCard.cardType !== 'unit') break;
      if (!(fpCard as UnitCard).id.includes('fortress')) break;
      events.push({
        type: SW_EVENTS.CARD_RETRIEVED,
        payload: { playerId, cardId: targetCardId, source: 'discard' },
        timestamp,
      });
      break;
    }

    case 'guidance': {
      // 指引：抓取2张卡牌
      const guidancePlayer = core.players[playerId];
      const guidanceDraw = Math.min(2, guidancePlayer.deck.length);
      if (guidanceDraw > 0) {
        events.push({
          type: SW_EVENTS.CARD_DRAWN,
          payload: { playerId, count: guidanceDraw },
          timestamp,
        });
      }
      break;
    }

    case 'holy_arrow': {
      // 圣光箭：弃除手牌中非同名单位，每张+1魔力+1战力
      const discardCardIds = payload.discardCardIds as string[] | undefined;
      if (!discardCardIds || discardCardIds.length === 0) break;
      const haPlayer = core.players[playerId];
      const validDiscards = discardCardIds.filter(id => haPlayer.hand.some(c => c.id === id));
      if (validDiscards.length > 0) {
        // 获得魔力
        events.push({
          type: SW_EVENTS.MAGIC_CHANGED,
          payload: { playerId, delta: validDiscards.length },
          timestamp,
        });
        // 弃除卡牌
        for (const cardId of validDiscards) {
          events.push({
            type: SW_EVENTS.CARD_DISCARDED,
            payload: { playerId, cardId },
            timestamp,
          });
        }
        // 战力加成（通过 boosts 标记）
        events.push({
          type: SW_EVENTS.UNIT_CHARGED,
          payload: { position: sourcePosition, delta: validDiscards.length },
          timestamp,
        });
      }
      break;
    }

    case 'healing': {
      // 治疗：弃除手牌，标记本单位为治疗模式
      const healDiscardId = payload.targetCardId as string | undefined;
      if (!healDiscardId) break;
      const healPlayer = core.players[playerId];
      if (!healPlayer.hand.some(c => c.id === healDiscardId)) break;
      // 弃除卡牌
      events.push({
        type: SW_EVENTS.CARD_DISCARDED,
        payload: { playerId, cardId: healDiscardId },
        timestamp,
      });
      // 标记治疗模式
      events.push({
        type: SW_EVENTS.HEALING_MODE_SET,
        payload: { position: sourcePosition, unitId: sourceUnit.cardId },
        timestamp,
      });
      break;
    }

    // ============ 极地矮人技能 ============

    case 'structure_shift': {
      // 结构变换：推拉3格内友方建筑1格
      const ssTargetPos = payload.targetPosition as CellCoord | undefined;
      const ssNewPos = payload.newPosition as CellCoord | undefined;
      if (!ssTargetPos) break;
      const ssStructure = getStructureAt(core, ssTargetPos);
      if (!ssStructure || ssStructure.owner !== playerId) break;
      const ssDist = manhattanDistance(sourcePosition, ssTargetPos);
      if (ssDist > 3) break;
      if (ssNewPos && isValidCoord(ssNewPos) && isCellEmpty(core, ssNewPos)
        && manhattanDistance(ssTargetPos, ssNewPos) === 1) {
        events.push({
          type: SW_EVENTS.UNIT_PUSHED,
          payload: { targetPosition: ssTargetPos, newPosition: ssNewPos, isStructure: true },
          timestamp,
        });
      }
      break;
    }

    case 'ice_shards': {
      // 寒冰碎屑：消耗1点充能，对每个和友方建筑相邻的敌方单位造成1伤
      if ((sourceUnit.boosts ?? 0) < 1) break;
      // 消耗1点充能
      events.push({
        type: SW_EVENTS.UNIT_CHARGED,
        payload: { position: sourcePosition, delta: -1 },
        timestamp,
      });
      // 收集所有和友方建筑相邻的敌方单位（去重）
      const damagedSet = new Set<string>();
      for (let r = 0; r < BOARD_ROWS; r++) {
        for (let c = 0; c < BOARD_COLS; c++) {
          const structure = getStructureAt(core, { row: r, col: c });
          // 友方建筑 或 友方活体结构单位
          const isAllyStructure = (structure && structure.owner === playerId)
            || (getUnitAt(core, { row: r, col: c })?.owner === playerId
              && (getUnitAt(core, { row: r, col: c })?.card.abilities ?? []).includes('mobile_structure'));
          if (!isAllyStructure) continue;
          const adjDirs = [
            { row: -1, col: 0 }, { row: 1, col: 0 },
            { row: 0, col: -1 }, { row: 0, col: 1 },
          ];
          for (const d of adjDirs) {
            const adjPos = { row: r + d.row, col: c + d.col };
            if (!isValidCoord(adjPos)) continue;
            const adjUnit = getUnitAt(core, adjPos);
            if (adjUnit && adjUnit.owner !== playerId && !damagedSet.has(adjUnit.cardId)) {
              damagedSet.add(adjUnit.cardId);
              events.push({
                type: SW_EVENTS.UNIT_DAMAGED,
                payload: { position: adjPos, damage: 1, reason: 'ice_shards' },
                timestamp,
              });
            }
          }
        }
      }
      break;
    }

    // ============ 炽原精灵技能 ============

    case 'ancestral_bond': {
      // 祖灵羁绊：充能目标并将自身所有充能转移到目标
      const abTargetPos = payload.targetPosition as CellCoord | undefined;
      if (!abTargetPos) break;
      const abTarget = getUnitAt(core, abTargetPos);
      if (!abTarget || abTarget.owner !== playerId) break;
      const abDist = manhattanDistance(sourcePosition, abTargetPos);
      if (abDist > 3) break;
      // 先充能目标1点
      events.push({
        type: SW_EVENTS.UNIT_CHARGED,
        payload: { position: abTargetPos, delta: 1, sourceAbilityId: 'ancestral_bond' },
        timestamp,
      });
      // 转移自身所有充能到目标
      const selfCharges = sourceUnit.boosts ?? 0;
      if (selfCharges > 0) {
        events.push({
          type: SW_EVENTS.UNIT_CHARGED,
          payload: { position: sourcePosition, delta: -selfCharges, sourceAbilityId: 'ancestral_bond' },
          timestamp,
        });
        events.push({
          type: SW_EVENTS.UNIT_CHARGED,
          payload: { position: abTargetPos, delta: selfCharges, sourceAbilityId: 'ancestral_bond' },
          timestamp,
        });
      }
      break;
    }

    case 'prepare': {
      // 预备：充能自身（代替移动）
      events.push({
        type: SW_EVENTS.UNIT_CHARGED,
        payload: { position: sourcePosition, delta: 1, sourceAbilityId: 'prepare' },
        timestamp,
      });
      break;
    }

    case 'inspire': {
      // 启悟：将相邻所有友方单位充能
      const adjDirs = [
        { row: -1, col: 0 }, { row: 1, col: 0 },
        { row: 0, col: -1 }, { row: 0, col: 1 },
      ];
      for (const d of adjDirs) {
        const adjPos = { row: sourcePosition.row + d.row, col: sourcePosition.col + d.col };
        if (!isValidCoord(adjPos)) continue;
        const adjUnit = getUnitAt(core, adjPos);
        if (adjUnit && adjUnit.owner === playerId && adjUnit.cardId !== sourceUnit.cardId) {
          events.push({
            type: SW_EVENTS.UNIT_CHARGED,
            payload: { position: adjPos, delta: 1, sourceAbilityId: 'inspire' },
            timestamp,
          });
        }
      }
      break;
    }

    case 'withdraw': {
      // 撤退：消耗1充能或1魔力，推拉自身1-2格
      const wdCostType = payload.costType as 'charge' | 'magic';
      const wdNewPos = payload.targetPosition as CellCoord | undefined;
      if (!wdNewPos) break;
      if (wdCostType === 'charge') {
        if ((sourceUnit.boosts ?? 0) < 1) break;
        events.push({
          type: SW_EVENTS.UNIT_CHARGED,
          payload: { position: sourcePosition, delta: -1, sourceAbilityId: 'withdraw' },
          timestamp,
        });
      } else {
        if (core.players[playerId].magic < 1) break;
        events.push({
          type: SW_EVENTS.MAGIC_CHANGED,
          payload: { playerId, delta: -1 },
          timestamp,
        });
      }
      // 移动自身到目标位置
      const wdDist = manhattanDistance(sourcePosition, wdNewPos);
      if (wdDist >= 1 && wdDist <= 2 && isCellEmpty(core, wdNewPos)) {
        events.push({
          type: SW_EVENTS.UNIT_MOVED,
          payload: { from: sourcePosition, to: wdNewPos, unitId: sourceUnitId, reason: 'withdraw' },
          timestamp,
        });
      }
      break;
    }

    case 'spirit_bond': {
      // 祖灵交流：充能自身，或消耗1充能给3格内友方充能
      const sbChoice = payload.choice as 'self' | 'transfer';
      if (sbChoice === 'self') {
        events.push({
          type: SW_EVENTS.UNIT_CHARGED,
          payload: { position: sourcePosition, delta: 1, sourceAbilityId: 'spirit_bond' },
          timestamp,
        });
      } else if (sbChoice === 'transfer') {
        const sbTargetPos = payload.targetPosition as CellCoord | undefined;
        if (!sbTargetPos) break;
        if ((sourceUnit.boosts ?? 0) < 1) break;
        const sbTarget = getUnitAt(core, sbTargetPos);
        if (!sbTarget || sbTarget.owner !== playerId) break;
        const sbDist = manhattanDistance(sourcePosition, sbTargetPos);
        if (sbDist > 3) break;
        events.push({
          type: SW_EVENTS.UNIT_CHARGED,
          payload: { position: sourcePosition, delta: -1, sourceAbilityId: 'spirit_bond' },
          timestamp,
        });
        events.push({
          type: SW_EVENTS.UNIT_CHARGED,
          payload: { position: sbTargetPos, delta: 1, sourceAbilityId: 'spirit_bond' },
          timestamp,
        });
      }
      break;
    }

    default:
      console.warn('[SummonerWars] 未处理的技能:', abilityId);
  }
}
