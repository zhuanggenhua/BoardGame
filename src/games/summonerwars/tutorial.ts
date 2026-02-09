/**
 * 召唤师战争 - 教学配置（亡灵法师 vs 亡灵法师）
 *
 * 设计原则：每一步只讲一个概念，并高亮对应的 UI 元素。
 * 带着玩家走一遍完整回合，而不是一股脑把信息扔给玩家。
 *
 * 使用作弊命令设置固定手牌和弃牌堆，确保教学流程可控：
 * - 给玩家发地狱火教徒（cost=0, 远程）、亡灵疫病体（cost=1, 近战）和狱火铸剑（事件卡）
 * - 设置魔力为5，确保有足够资源召唤
 * - 弃牌堆预置亡灵战士，用于演示召唤师技能「复活死灵」
 * - 狱火铸剑用于建造阶段演示事件卡施放
 */

import type { TutorialManifest } from '../../engine/types';
import { SW_COMMANDS, SW_EVENTS } from './domain';
import { FLOW_COMMANDS, FLOW_EVENTS } from '../../engine/systems/FlowSystem';
import { CHEAT_COMMANDS } from '../../engine/systems/CheatSystem';
import { SPRITE_INDEX } from './config/factions/necromancer';

// 事件匹配器
const MATCH_PHASE_MOVE = { type: FLOW_EVENTS.PHASE_CHANGED, match: { to: 'move' } };
const MATCH_PHASE_BUILD = { type: FLOW_EVENTS.PHASE_CHANGED, match: { to: 'build' } };
const MATCH_PHASE_ATTACK = { type: FLOW_EVENTS.PHASE_CHANGED, match: { to: 'attack' } };
const MATCH_PHASE_MAGIC = { type: FLOW_EVENTS.PHASE_CHANGED, match: { to: 'magic' } };
const MATCH_PHASE_DRAW = { type: FLOW_EVENTS.PHASE_CHANGED, match: { to: 'draw' } };

const SUMMONER_WARS_TUTORIAL: TutorialManifest = {
  id: 'summonerwars-basic',
  randomPolicy: { mode: 'fixed', values: [1] },
  steps: [
    // ================================================================
    // 第一部分：初始化 + 逐步介绍界面元素
    // ================================================================

    // 0: 初始化 - 自动选阵营 + 作弊设置
    {
      id: 'setup',
      content: 'game-summonerwars:tutorial.steps.setup',
      position: 'center',
      requireAction: false,
      showMask: true,
      aiActions: [
        { commandType: SW_COMMANDS.SELECT_FACTION, payload: { factionId: 'necromancer' } },
        { commandType: SW_COMMANDS.SELECT_FACTION, payload: { factionId: 'necromancer' }, playerId: '1' },
        { commandType: SW_COMMANDS.PLAYER_READY, payload: {}, playerId: '1' },
        { commandType: SW_COMMANDS.HOST_START_GAME, payload: {} },
        { commandType: CHEAT_COMMANDS.SET_RESOURCE, payload: { playerId: '0', resourceId: 'magic', value: 5 } },
        { commandType: CHEAT_COMMANDS.DEAL_CARD_BY_ATLAS_INDEX, payload: { playerId: '0', atlasIndex: SPRITE_INDEX.COMMON_HELLFIRE_CULTIST } },
        { commandType: CHEAT_COMMANDS.DEAL_CARD_BY_ATLAS_INDEX, payload: { playerId: '0', atlasIndex: SPRITE_INDEX.COMMON_PLAGUE_ZOMBIE } },
        { commandType: CHEAT_COMMANDS.DEAL_CARD_BY_ATLAS_INDEX, payload: { playerId: '0', atlasIndex: SPRITE_INDEX.EVENT_HELLFIRE_BLADE } },
        { commandType: CHEAT_COMMANDS.DEAL_CARD_TO_DISCARD, payload: { playerId: '0', atlasIndex: SPRITE_INDEX.COMMON_UNDEAD_WARRIOR } },
      ],
    },

    // 1: 欢迎 — 高亮棋盘全局
    {
      id: 'welcome',
      content: 'game-summonerwars:tutorial.steps.welcome',
      highlightTarget: 'sw-map-area',
      position: 'right',
      requireAction: false,
      blockedCommands: [FLOW_COMMANDS.ADVANCE_PHASE],
    },

    // 2: 你的召唤师 — 高亮己方召唤师
    {
      id: 'summoner-intro',
      content: 'game-summonerwars:tutorial.steps.summonerIntro',
      highlightTarget: 'sw-my-summoner',
      position: 'right',
      requireAction: false,
      blockedCommands: [FLOW_COMMANDS.ADVANCE_PHASE],
    },

    // 3: 敌方召唤师 — 高亮敌方召唤师
    {
      id: 'enemy-summoner',
      content: 'game-summonerwars:tutorial.steps.enemySummoner',
      highlightTarget: 'sw-enemy-summoner',
      position: 'right',
      requireAction: false,
      blockedCommands: [FLOW_COMMANDS.ADVANCE_PHASE],
    },

    // 4: 城门 — 高亮己方城门
    {
      id: 'gate-intro',
      content: 'game-summonerwars:tutorial.steps.gateIntro',
      highlightTarget: 'sw-my-gate',
      position: 'right',
      requireAction: false,
      blockedCommands: [FLOW_COMMANDS.ADVANCE_PHASE],
    },

    // 5: 手牌区 — 高亮手牌
    {
      id: 'hand-intro',
      content: 'game-summonerwars:tutorial.steps.handIntro',
      highlightTarget: 'sw-hand-area',
      position: 'top',
      requireAction: false,
      blockedCommands: [FLOW_COMMANDS.ADVANCE_PHASE],
    },

    // 6: 卡牌属性 — 高亮第一张手牌
    {
      id: 'card-anatomy',
      content: 'game-summonerwars:tutorial.steps.cardAnatomy',
      highlightTarget: 'sw-first-hand-card',
      position: 'top',
      requireAction: false,
      blockedCommands: [FLOW_COMMANDS.ADVANCE_PHASE],
    },

    // 7: 魔力条 — 高亮玩家信息栏
    {
      id: 'magic-intro',
      content: 'game-summonerwars:tutorial.steps.magicIntro',
      highlightTarget: 'sw-player-bar',
      position: 'right',
      requireAction: false,
      blockedCommands: [FLOW_COMMANDS.ADVANCE_PHASE],
    },

    // 8: 阶段指示器 — 高亮阶段追踪器
    {
      id: 'phase-intro',
      content: 'game-summonerwars:tutorial.steps.phaseIntro',
      highlightTarget: 'sw-phase-tracker',
      position: 'left',
      requireAction: false,
      blockedCommands: [FLOW_COMMANDS.ADVANCE_PHASE],
    },

    // ================================================================
    // 第二部分：召唤阶段
    // ================================================================

    // 9: 召唤阶段说明 — 高亮状态横幅
    {
      id: 'summon-explain',
      content: 'game-summonerwars:tutorial.steps.summonExplain',
      highlightTarget: 'sw-action-banner',
      position: 'bottom',
      requireAction: false,
      blockedCommands: [FLOW_COMMANDS.ADVANCE_PHASE],
    },

    // 10: 召唤操作 — 高亮手牌区
    {
      id: 'summon-action',
      content: 'game-summonerwars:tutorial.steps.summonAction',
      highlightTarget: 'sw-hand-area',
      position: 'top',
      requireAction: true,
      allowedCommands: [SW_COMMANDS.SUMMON_UNIT],
      advanceOnEvents: [{ type: SW_EVENTS.UNIT_SUMMONED }],
    },

    // 11: 召唤师技能说明 — 高亮己方召唤师
    {
      id: 'ability-explain',
      content: 'game-summonerwars:tutorial.steps.abilityExplain',
      highlightTarget: 'sw-my-summoner',
      position: 'right',
      requireAction: false,
      blockedCommands: [FLOW_COMMANDS.ADVANCE_PHASE],
    },

    // 12: 使用技能 — 高亮弃牌堆
    {
      id: 'ability-action',
      content: 'game-summonerwars:tutorial.steps.abilityAction',
      highlightTarget: 'sw-discard-pile',
      position: 'left',
      requireAction: true,
      allowedCommands: [SW_COMMANDS.ACTIVATE_ABILITY],
      blockedCommands: [FLOW_COMMANDS.ADVANCE_PHASE],
      advanceOnEvents: [
        { type: SW_EVENTS.ABILITY_TRIGGERED, match: { abilityId: 'revive_undead' } },
        { type: SW_EVENTS.UNIT_SUMMONED },
      ],
    },

    // 13: 结束召唤阶段 — 高亮结束按钮
    {
      id: 'end-summon',
      content: 'game-summonerwars:tutorial.steps.endSummon',
      highlightTarget: 'sw-end-phase-btn',
      position: 'left',
      requireAction: true,
      allowedCommands: [FLOW_COMMANDS.ADVANCE_PHASE],
      advanceOnEvents: [MATCH_PHASE_MOVE],
    },

    // ================================================================
    // 第三部分：移动阶段
    // ================================================================

    // 14: 移动阶段说明 — 高亮阶段追踪器
    {
      id: 'move-explain',
      content: 'game-summonerwars:tutorial.steps.moveExplain',
      highlightTarget: 'sw-phase-tracker',
      position: 'left',
      requireAction: false,
      blockedCommands: [FLOW_COMMANDS.ADVANCE_PHASE],
    },

    // 15: 移动操作 — 高亮棋盘
    {
      id: 'move-action',
      content: 'game-summonerwars:tutorial.steps.moveAction',
      highlightTarget: 'sw-map-area',
      position: 'right',
      requireAction: true,
      allowedCommands: [SW_COMMANDS.SELECT_UNIT, SW_COMMANDS.MOVE_UNIT],
      advanceOnEvents: [{ type: SW_EVENTS.UNIT_MOVED }],
    },

    // 16: 结束移动阶段
    {
      id: 'end-move',
      content: 'game-summonerwars:tutorial.steps.endMove',
      highlightTarget: 'sw-end-phase-btn',
      position: 'left',
      requireAction: true,
      allowedCommands: [SW_COMMANDS.SELECT_UNIT, SW_COMMANDS.MOVE_UNIT, FLOW_COMMANDS.ADVANCE_PHASE],
      advanceOnEvents: [MATCH_PHASE_BUILD],
    },

    // ================================================================
    // 第四部分：建造阶段 + 事件卡教学
    // ================================================================

    // 17: 建造阶段说明 — 高亮城门
    {
      id: 'build-explain',
      content: 'game-summonerwars:tutorial.steps.buildExplain',
      highlightTarget: 'sw-my-gate',
      position: 'right',
      requireAction: false,
      blockedCommands: [FLOW_COMMANDS.ADVANCE_PHASE],
    },

    // 18: 事件卡说明 — 高亮手牌区
    {
      id: 'event-card-explain',
      content: 'game-summonerwars:tutorial.steps.eventCardExplain',
      highlightTarget: 'sw-hand-area',
      position: 'top',
      requireAction: false,
      blockedCommands: [FLOW_COMMANDS.ADVANCE_PHASE],
    },

    // 19: 施放事件卡操作 — 高亮手牌区
    {
      id: 'event-card-action',
      content: 'game-summonerwars:tutorial.steps.eventCardAction',
      highlightTarget: 'sw-hand-area',
      position: 'top',
      requireAction: true,
      allowedCommands: [SW_COMMANDS.PLAY_EVENT],
      blockedCommands: [FLOW_COMMANDS.ADVANCE_PHASE],
      advanceOnEvents: [{ type: SW_EVENTS.EVENT_PLAYED }],
    },

    // 20: 结束建造阶段 — 高亮结束按钮
    {
      id: 'build-action',
      content: 'game-summonerwars:tutorial.steps.buildAction',
      highlightTarget: 'sw-end-phase-btn',
      position: 'left',
      requireAction: true,
      allowedCommands: [SW_COMMANDS.BUILD_STRUCTURE, FLOW_COMMANDS.ADVANCE_PHASE],
      advanceOnEvents: [MATCH_PHASE_ATTACK],
    },

    // ================================================================
    // 第五部分：攻击阶段
    // ================================================================

    // 21: 攻击阶段说明 — 高亮阶段追踪器
    {
      id: 'attack-explain',
      content: 'game-summonerwars:tutorial.steps.attackExplain',
      highlightTarget: 'sw-phase-tracker',
      position: 'left',
      requireAction: false,
      blockedCommands: [FLOW_COMMANDS.ADVANCE_PHASE],
    },

    // 22: 近战说明 — 高亮棋盘（近战单位在棋盘上）
    {
      id: 'melee-explain',
      content: 'game-summonerwars:tutorial.steps.meleeExplain',
      highlightTarget: 'sw-map-area',
      position: 'right',
      requireAction: false,
      blockedCommands: [FLOW_COMMANDS.ADVANCE_PHASE],
    },

    // 23: 远程说明 — 高亮己方召唤师（远程单位）
    {
      id: 'ranged-explain',
      content: 'game-summonerwars:tutorial.steps.rangedExplain',
      highlightTarget: 'sw-my-summoner',
      position: 'right',
      requireAction: false,
      blockedCommands: [FLOW_COMMANDS.ADVANCE_PHASE],
    },

    // 24: 攻击操作
    {
      id: 'attack-action',
      content: 'game-summonerwars:tutorial.steps.attackAction',
      highlightTarget: 'sw-map-area',
      position: 'right',
      requireAction: true,
      allowedCommands: [SW_COMMANDS.SELECT_UNIT, SW_COMMANDS.DECLARE_ATTACK],
      blockedCommands: [FLOW_COMMANDS.ADVANCE_PHASE],
      advanceOnEvents: [{ type: SW_EVENTS.UNIT_ATTACKED }],
    },

    // 25: 攻击结果 — 高亮敌方召唤师
    {
      id: 'attack-result',
      content: 'game-summonerwars:tutorial.steps.attackResult',
      highlightTarget: 'sw-enemy-summoner',
      position: 'right',
      requireAction: false,
      blockedCommands: [FLOW_COMMANDS.ADVANCE_PHASE],
    },

    // 26: 结束攻击阶段
    {
      id: 'end-attack',
      content: 'game-summonerwars:tutorial.steps.endAttack',
      highlightTarget: 'sw-end-phase-btn',
      position: 'left',
      requireAction: true,
      allowedCommands: [SW_COMMANDS.DECLARE_ATTACK, FLOW_COMMANDS.ADVANCE_PHASE],
      advanceOnEvents: [MATCH_PHASE_MAGIC],
    },

    // ================================================================
    // 第六部分：魔力阶段
    // ================================================================

    // 27: 魔力阶段说明 — 高亮手牌
    {
      id: 'magic-explain',
      content: 'game-summonerwars:tutorial.steps.magicExplain',
      highlightTarget: 'sw-hand-area',
      position: 'top',
      requireAction: false,
      blockedCommands: [FLOW_COMMANDS.ADVANCE_PHASE],
    },

    // 28: 魔力操作
    {
      id: 'magic-action',
      content: 'game-summonerwars:tutorial.steps.magicAction',
      highlightTarget: 'sw-end-phase-btn',
      position: 'left',
      requireAction: true,
      allowedCommands: [SW_COMMANDS.DISCARD_FOR_MAGIC, FLOW_COMMANDS.ADVANCE_PHASE],
      advanceOnEvents: [MATCH_PHASE_DRAW],
    },

    // ================================================================
    // 第七部分：抽牌阶段
    // ================================================================

    // 29: 抽牌阶段说明 — 高亮抽牌堆
    {
      id: 'draw-explain',
      content: 'game-summonerwars:tutorial.steps.drawExplain',
      highlightTarget: 'sw-deck-draw',
      position: 'right',
      requireAction: false,
      blockedCommands: [FLOW_COMMANDS.ADVANCE_PHASE],
    },

    // 30: 结束抽牌阶段
    {
      id: 'end-draw',
      content: 'game-summonerwars:tutorial.steps.endDraw',
      highlightTarget: 'sw-end-phase-btn',
      position: 'left',
      requireAction: true,
      allowedCommands: [FLOW_COMMANDS.ADVANCE_PHASE],
      advanceOnEvents: [{ type: SW_EVENTS.TURN_CHANGED }],
    },

    // ================================================================
    // 第八部分：对手回合 + 总结
    // ================================================================

    // 31: 对手回合 - AI 自动执行
    {
      id: 'opponent-turn',
      content: 'game-summonerwars:tutorial.steps.opponentTurn',
      highlightTarget: 'sw-enemy-summoner',
      position: 'right',
      requireAction: false,
      aiActions: [
        { commandType: FLOW_COMMANDS.ADVANCE_PHASE, payload: {}, playerId: '1' },
        { commandType: SW_COMMANDS.MOVE_UNIT, payload: { from: { row: 5, col: 3 }, to: { row: 4, col: 3 } }, playerId: '1' },
        { commandType: FLOW_COMMANDS.ADVANCE_PHASE, payload: {}, playerId: '1' },
        { commandType: FLOW_COMMANDS.ADVANCE_PHASE, payload: {}, playerId: '1' },
        { commandType: FLOW_COMMANDS.ADVANCE_PHASE, payload: {}, playerId: '1' },
        { commandType: FLOW_COMMANDS.ADVANCE_PHASE, payload: {}, playerId: '1' },
        { commandType: FLOW_COMMANDS.ADVANCE_PHASE, payload: {}, playerId: '1' },
      ],
      advanceOnEvents: [
        { type: SW_EVENTS.TURN_CHANGED, match: { to: '0' } },
      ],
    },

    // 32: 不活动惩罚 — 高亮敌方召唤师（受到惩罚伤害）
    {
      id: 'inaction-penalty',
      content: 'game-summonerwars:tutorial.steps.inactionPenalty',
      highlightTarget: 'sw-enemy-summoner',
      position: 'right',
      requireAction: false,
    },

    // 33: 胜利条件 — 高亮己方召唤师
    {
      id: 'victory-condition',
      content: 'game-summonerwars:tutorial.steps.victoryCondition',
      highlightTarget: 'sw-my-summoner',
      position: 'right',
      requireAction: false,
    },

    // 34: 教学完成 — 高亮棋盘全局
    {
      id: 'finish',
      content: 'game-summonerwars:tutorial.steps.finish',
      highlightTarget: 'sw-map-area',
      position: 'right',
      requireAction: false,
    },
  ],
};

export default SUMMONER_WARS_TUTORIAL;
