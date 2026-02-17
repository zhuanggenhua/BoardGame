/**
 * 召唤师战争 - PLAY_EVENT 命令处理
 *
 * 从 execute.ts 拆分，包含所有事件卡的执行逻辑。
 */

import type { GameEvent } from '../../../../engine/types';
import type {
  SummonerWarsCore,
  PlayerId,
  EventCard,
  CellCoord,
} from '../types';
import { SW_EVENTS } from '../types';
import {
  getUnitAt,
  getStructureAt,
  getSummoner,
  manhattanDistance,
  isValidCoord,
  isCellEmpty,
  isForceMovePathClear,
  getPlayerUnits,
  calculatePushPullPosition,
  getUnitAbilities,
  isInStraightLine,
  BOARD_ROWS,
  BOARD_COLS,
} from '../helpers';
import {
  emitDestroyWithTriggers,
  createAbilityTriggeredEvent,
} from './helpers';
import { getBaseCardId, CARD_IDS } from '../ids';

export function executePlayEvent(
  events: GameEvent[],
  core: SummonerWarsCore,
  playerId: PlayerId,
  payload: Record<string, unknown>,
  timestamp: number
): void {
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
    
    const cardBaseId = getBaseCardId(eventCard.id);
    const isAttachment = cardBaseId === CARD_IDS.NECRO_HELLFIRE_BLADE;
    const isStructureEvent = eventCard.life !== undefined; // 建筑类事件卡
    const summoner = getSummoner(core, playerId);
    
    events.push({
      type: SW_EVENTS.EVENT_PLAYED,
      payload: { 
        playerId, cardId, card: eventCard,
        isActive: eventCard.isActive ?? false, isAttachment,
        isStructureEvent, // 标记为建筑类事件卡
      },
      timestamp,
    });

    // 建筑类事件卡：有 life 字段的事件卡打出后变成建筑
    if (isStructureEvent && targets && targets.length > 0) {
      const position = targets[0];
      events.push({
        type: SW_EVENTS.STRUCTURE_BUILT,
        payload: {
          playerId, // 添加 playerId 字段，与 reduce 处理器一致
          cardId: eventCard.id,
          position,
          card: {
            id: eventCard.id,
            cardType: 'structure' as const,
            name: eventCard.name,
            faction: eventCard.faction,
            cost: eventCard.cost,
            life: eventCard.life,
            isGate: false,
            deckSymbols: eventCard.deckSymbols,
            spriteIndex: eventCard.spriteIndex,
            spriteAtlas: eventCard.spriteAtlas,
          },
          owner: playerId,
        },
        timestamp,
      });
      // 建筑类事件卡打出后不进入 activeEvents，直接返回
      return;
    }

    switch (cardBaseId) {
      case CARD_IDS.NECRO_HELLFIRE_BLADE: {
        if (targets && targets.length > 0) {
          events.push({
            type: SW_EVENTS.EVENT_ATTACHED,
            payload: { playerId, cardId, card: eventCard, targetPosition: targets[0] },
            timestamp,
          });
        }
        break;
      }
      case CARD_IDS.NECRO_ANNIHILATE: {
        const damageTargets = payload.damageTargets as (CellCoord | null)[] | undefined;
        if (targets && targets.length > 0) {
          for (let i = 0; i < targets.length; i++) {
            const damageTarget = damageTargets?.[i];
            if (damageTarget) {
              const damageUnit = getUnitAt(core, damageTarget);
              const damageStructure = getStructureAt(core, damageTarget);
              if (damageUnit) {
                events.push({
                  type: SW_EVENTS.UNIT_DAMAGED,
                  payload: {
                    position: damageTarget,
                    damage: 2,
                    cardId: damageUnit.cardId,
                    instanceId: damageUnit.instanceId,
                    source: 'annihilate',
                    sourcePlayerId: playerId,
                  },
                  timestamp,
                });
              }
              if (damageStructure) {
                events.push({
                  type: SW_EVENTS.UNIT_DAMAGED,
                  payload: {
                    position: damageTarget,
                    cardId: damageStructure.cardId,
                    damage: 2,
                    source: 'annihilate',
                    sourcePlayerId: playerId,
                  },
                  timestamp,
                });
              }
            }
          }
          for (const targetPos of targets) {
            const targetUnit = getUnitAt(core, targetPos);
            if (targetUnit && targetUnit.owner === playerId) {
              events.push(...emitDestroyWithTriggers(core, targetUnit, targetPos, { playerId, timestamp }));
            }
          }
        }
        break;
      }

      // ============ 欺心巫族事件卡 ============

      case CARD_IDS.TRICKSTER_MIND_CONTROL: {
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
                    targetUnitId: targetUnit.instanceId,
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

      case CARD_IDS.TRICKSTER_STORM_ASSAULT: {
        // 风暴侵袭（ACTIVE）：单位必须减少移动1格
        // isActive=true，已由 EVENT_PLAYED 处理放入主动区域
        // 实际效果在移动验证时检查主动事件区
        break;
      }

      case CARD_IDS.TRICKSTER_STUN: {
        // 震慑：召唤师3格直线内的一个士兵或英雄，推拉1-3格可穿过单位，对目标和被穿过的单位各造成1伤害
        // targets[0] = 目标位置
        // payload.stunDirection = 'push' | 'pull'
        // payload.stunDistance = 1-3
        const stunSummoner = getSummoner(core, playerId);
        if (stunSummoner && targets && targets.length > 0) {
          const stunTarget = targets[0];
          const stunUnit = getUnitAt(core, stunTarget);
          if (stunUnit && stunUnit.card.unitClass !== 'summoner') {
            // 执行层验证：距离≤3 且直线
            const stunDist = manhattanDistance(stunSummoner.position, stunTarget);
            if (stunDist > 3 || stunDist === 0 || !isInStraightLine(stunSummoner.position, stunTarget)) break;

            const stunDirection = (payload.stunDirection as 'push' | 'pull') ?? 'push';
            const stunDistance = Math.min(3, Math.max(1, (payload.stunDistance as number) ?? 1));

            // 稳固免疫检查：有 stable 技能的单位不受推拉，但仍受伤害
            const isStable = getUnitAbilities(stunUnit, core).includes('stable');

            if (!isStable) {
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
              let lastEmptyPos: CellCoord | null = null;
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
                    payload: { position: nextPos, damage: 1, reason: 'stun_passthrough', sourcePlayerId: playerId },
                    timestamp,
                  });
                  // 继续穿过（震慑可穿过士兵和英雄）
                  currentPos = nextPos;
                } else if (getStructureAt(core, nextPos)) {
                  // 建筑阻挡，停止
                  break;
                } else {
                  // 空格：记录为最后一个可停留位置
                  currentPos = nextPos;
                  lastEmptyPos = nextPos;
                }
              }

              // 移动目标到最终空位置
              const finalPos = lastEmptyPos ?? (
                (currentPos.row !== stunTarget.row || currentPos.col !== stunTarget.col)
                  && isCellEmpty(core, currentPos) ? currentPos : null
              );
              if (finalPos) {
                events.push({
                  type: SW_EVENTS.UNIT_PUSHED,
                  payload: { targetPosition: stunTarget, newPosition: finalPos },
                  timestamp,
                });
              }
            }

            // 对目标造成1伤害（无论是否有 stable，伤害都生效）
            events.push({
              type: SW_EVENTS.UNIT_DAMAGED,
              payload: { position: stunTarget, damage: 1, reason: 'stun', sourcePlayerId: playerId },
              timestamp,
            });
          }
        }
        break;
      }

      case CARD_IDS.TRICKSTER_HYPNOTIC_LURE: {
        // 催眠引诱：拉目标向召唤师靠近1格 + ACTIVE（攻击该目标时+1战力）
        // targets[0] = 目标位置
        // isActive=true，已由 EVENT_PLAYED 处理放入主动区域
        // payload.skipPull = true 时跳过拉动（"你可以"可选效果）
        const lureSummoner = getSummoner(core, playerId);
        if (lureSummoner && targets && targets.length > 0) {
          const lureTarget = targets[0];
          const lureUnit = getUnitAt(core, lureTarget);
          if (lureUnit && lureUnit.card.unitClass !== 'summoner') {
            // 拉向召唤师1格（可选，且需检查 stable 免疫）
            const skipPull = payload.skipPull as boolean | undefined;
            if (!skipPull) {
              const isLureStable = getUnitAbilities(lureUnit, core).includes('stable');
              if (!isLureStable) {
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
              }
            }
            // 标记被催眠的目标（用于主动事件区的战力加成）
            events.push({
              type: SW_EVENTS.HYPNOTIC_LURE_MARKED,
              payload: { playerId, cardId, targetUnitId: lureUnit.instanceId },
              timestamp,
            });
          }
        }
        break;
      }

      // ============ 洞穴地精事件卡 ============

      case CARD_IDS.GOBLIN_FRENZY: {
        // 群情激愤（传奇）：所有0费友方单位获得额外攻击
        const frenzyUnits = getPlayerUnits(core, playerId);
        for (const u of frenzyUnits) {
          if (u.card.cost === 0 && u.card.unitClass !== 'summoner') {
            events.push({
              type: SW_EVENTS.EXTRA_ATTACK_GRANTED,
              payload: {
                targetPosition: u.position,
                targetUnitId: u.instanceId,
                sourceAbilityId: 'goblin_frenzy',
              },
              timestamp,
            });
          }
        }
        break;
      }

      case CARD_IDS.GOBLIN_SNEAK: {
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

      case CARD_IDS.GOBLIN_RELENTLESS: {
        // 不屈不挠（ACTIVE）：友方士兵被消灭时返回手牌
        // isActive=true，已由 EVENT_PLAYED 处理放入主动区域
        // 实际效果在 UNIT_DESTROYED 处理时检查主动事件区
        break;
      }

      case CARD_IDS.GOBLIN_SWARM: {
        // 成群结队（ACTIVE）：友方单位获得围攻（每有一个友方相邻目标+1战力）
        // isActive=true，已由 EVENT_PLAYED 处理放入主动区域
        // 实际效果在 calculateEffectiveStrength 中检查
        break;
      }

      // ============ 先锋军团事件卡 ============

      case CARD_IDS.PALADIN_HOLY_JUDGMENT: {
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

      case CARD_IDS.PALADIN_HOLY_PROTECTION: {
        // 圣灵庇护（ACTIVE）：召唤师3格内友方士兵获得庇护
        // isActive=true，已由 EVENT_PLAYED 处理放入主动区域
        // 实际效果在伤害计算时检查
        break;
      }

      case CARD_IDS.PALADIN_MASS_HEALING: {
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

      case CARD_IDS.PALADIN_REKINDLE_HOPE: {
        // 重燃希望（ACTIVE）：可在任意阶段召唤，可召唤到召唤师相邻
        // isActive=true，已由 EVENT_PLAYED 处理放入主动区域
        // 实际效果在召唤验证时检查
        break;
      }

      // ============ 极地矮人事件卡 ============

      case CARD_IDS.FROST_ICE_RAM: {
        // 寒冰冲撞（传奇/ACTIVE）：友方建筑移动/推拉后对相邻单位造成1伤+推拉1格
        // isActive=true，已由 EVENT_PLAYED 处理放入主动区域
        // 实际效果在建筑移动/推拉时检查
        break;
      }

      case CARD_IDS.FROST_GLACIAL_SHIFT: {
        // 冰川位移：召唤师3格内至多3个友方建筑推拉1-2格
        // targets = 选中的友方建筑位置列表
        // payload.shiftDirections = 每个建筑的推拉方向和目标位置
        // 注意：友方建筑包括普通建筑和 mobile_structure 单位（寒冰魔像）
        const gsSummoner = getSummoner(core, playerId);
        const shiftDirections = payload.shiftDirections as { position: CellCoord; newPosition: CellCoord }[] | undefined;
        if (gsSummoner && shiftDirections && shiftDirections.length > 0) {
          for (const sd of shiftDirections) {
            const structure = getStructureAt(core, sd.position);
            const sdUnit = getUnitAt(core, sd.position);
            const isAllyStructure = (structure && structure.owner === playerId)
              || (sdUnit && sdUnit.owner === playerId
                && getUnitAbilities(sdUnit, core).includes('mobile_structure'));
            if (isAllyStructure) {
              const dist = manhattanDistance(gsSummoner.position, sd.position);
              // 强制移动必须沿直线，路径上每一格都必须为空
              if (dist <= 3 && isValidCoord(sd.newPosition)
                && isInStraightLine(sd.position, sd.newPosition)
                && manhattanDistance(sd.position, sd.newPosition) <= 2
                && isForceMovePathClear(core, sd.position, sd.newPosition)) {
                events.push({
                  type: SW_EVENTS.UNIT_PUSHED,
                  payload: { targetPosition: sd.position, newPosition: sd.newPosition, isStructure: !!(structure) },
                  timestamp,
                });
              }
            }
          }
        }
        break;
      }

      case CARD_IDS.FROST_ICE_REPAIR: {
        // 寒冰修补：每个友方建筑移除2点伤害
        // 注意：友方建筑包括普通建筑和 mobile_structure 单位（寒冰魔像）
        for (let r = 0; r < BOARD_ROWS; r++) {
          for (let c = 0; c < BOARD_COLS; c++) {
            const pos = { row: r, col: c };
            const structure = getStructureAt(core, pos);
            if (structure && structure.owner === playerId && structure.damage > 0) {
              events.push({
                type: SW_EVENTS.STRUCTURE_HEALED,
                payload: { position: pos, amount: 2, reason: 'ice_repair' },
                timestamp,
              });
            }
            // mobile_structure 单位也视为建筑，用 UNIT_HEALED 治疗
            const unit = getUnitAt(core, pos);
            if (unit && unit.owner === playerId && unit.damage > 0
              && getUnitAbilities(unit, core).includes('mobile_structure')) {
              events.push({
                type: SW_EVENTS.UNIT_HEALED,
                payload: { position: pos, amount: 2, sourceAbilityId: 'ice_repair' },
                timestamp,
              });
            }
          }
        }
        break;
      }

      // ============ 炽原精灵事件卡 ============

      case CARD_IDS.BARBARIC_CHANT_OF_POWER: {
        // 力量颂歌（传奇）：目标获得 power_up 直到回合结束
        // targets[0] = 目标位置（召唤师3格内的士兵或英雄）
        if (targets && targets.length > 0) {
          const cpTarget = getUnitAt(core, targets[0]);
          const sourcePosition = summoner?.position ?? targets[0];
          const sourceUnitId = summoner?.instanceId ?? eventCard.id;
          if (cpTarget && cpTarget.owner === playerId
            && cpTarget.card.unitClass !== 'summoner') {
            events.push({
              type: SW_EVENTS.ABILITY_TRIGGERED,
              payload: {
                abilityId: 'chant_of_power',
                abilityName: 'chant_of_power',
                sourceUnitId,
                sourcePosition,
                targetPosition: targets[0],
                targetUnitId: cpTarget.instanceId,
                grantedAbility: 'power_up',
                duration: 'end_of_turn',
              },
              timestamp,
            });
          }
        }
        break;
      }

      case CARD_IDS.BARBARIC_CHANT_OF_GROWTH: {
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

      case CARD_IDS.BARBARIC_CHANT_OF_ENTANGLEMENT: {
        // 交缠颂歌（ACTIVE）：两个友方士兵共享技能
        // isActive=true，已由 EVENT_PLAYED 处理放入主动区域
        // 实际效果在技能查询时检查主动事件区
        if (targets && targets.length >= 2) {
          const entTarget1 = getUnitAt(core, targets[0]);
          const entTarget2 = getUnitAt(core, targets[1]);
          if (entTarget1 && entTarget2) {
            const sourcePosition = summoner?.position ?? targets[0];
            const sourceUnitId = summoner?.instanceId ?? eventCard.id;
            events.push(createAbilityTriggeredEvent('chant_of_entanglement', sourceUnitId, sourcePosition, timestamp, {
              targetUnitId1: entTarget1.instanceId,
              targetUnitId2: entTarget2.instanceId,
            }));
          }
        }
        break;
      }

      case CARD_IDS.BARBARIC_CHANT_OF_WEAVING: {
        // 编织颂歌（ACTIVE）：可在目标相邻召唤，召唤时充能目标
        // isActive=true，已由 EVENT_PLAYED 处理放入主动区域
        if (targets && targets.length > 0) {
          const cwTarget = getUnitAt(core, targets[0]);
          if (cwTarget && cwTarget.owner === playerId) {
            // 标记 activeEvent 的目标单位（复用 HYPNOTIC_LURE_MARKED 的 reduce 逻辑）
            events.push({
              type: SW_EVENTS.HYPNOTIC_LURE_MARKED,
              payload: { playerId, cardId, targetUnitId: cwTarget.instanceId },
              timestamp,
            });
            const sourcePosition = summoner?.position ?? targets[0];
            const sourceUnitId = summoner?.instanceId ?? eventCard.id;
            events.push(createAbilityTriggeredEvent('chant_of_weaving', sourceUnitId, sourcePosition, timestamp, {
              targetUnitId: cwTarget.instanceId,
              targetPosition: targets[0],
            }));
          }
        }
        break;
      }
    }
  }
}
