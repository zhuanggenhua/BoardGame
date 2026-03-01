/**
 * 卡迪亚 (Cardia) - 教学配置
 *
 * 设计原则：每一步只讲一个概念，并高亮对应的 UI 元素。
 * 带着玩家走一遍完整回合，而不是一股脑把信息扔给玩家。
 *
 * 使用作弊命令设置固定手牌，确保教学流程可控：
 * - 玩家手牌：学徒（抽1张牌）、盗贼（对手弃1张牌）
 * - 通过 MERGE_STATE 设置玩家手牌为教学指定卡牌
 */

import type { TutorialManifest } from '../../engine/types';
import type { CardInstance } from './domain/types';
import { CARDIA_COMMANDS } from './domain/commands';
import { CARDIA_EVENTS } from './domain/events';
import { FLOW_COMMANDS, FLOW_EVENTS } from '../../engine/systems/FlowSystem';
import { CHEAT_COMMANDS } from '../../engine/systems/CheatSystem';
import { ABILITY_IDS } from './domain/ids';

// ============================================================================
// 事件匹配器常量
// ============================================================================

/** 匹配进入打牌阶段 */
const MATCH_PHASE_PLAY = { type: FLOW_EVENTS.PHASE_CHANGED, match: { to: 'play' } };

/** 匹配进入能力阶段 */
const MATCH_PHASE_ABILITY = { type: FLOW_EVENTS.PHASE_CHANGED, match: { to: 'ability' } };

/** 匹配进入结束阶段 */
const MATCH_PHASE_END = { type: FLOW_EVENTS.PHASE_CHANGED, match: { to: 'end' } };

// ============================================================================
// 教学固定手牌
// ============================================================================

/**
 * 教学用固定手牌：
 * - 学徒：简单的抽牌能力（抽1张牌）
 * - 盗贼：简单的弃牌能力（对手随机弃1张牌）
 * uid 使用 'tut-' 前缀避免与游戏生成的 uid 冲突
 */
const TUTORIAL_HAND_P0: CardInstance[] = [
    { uid: 'tut-1', defId: 'apprentice', owner: '0' },
    { uid: 'tut-2', defId: 'thief', owner: '0' },
];

// ============================================================================
// 教学 Manifest
// ============================================================================

const CARDIA_TUTORIAL: TutorialManifest = {
    id: 'cardia-basic',
    randomPolicy: { mode: 'fixed', values: [1] },
    steps: [
        // ================================================================
        // 第一部分：初始化
        // ================================================================

        // 0: 初始化 — AI 自动设置手牌
        {
            id: 'setup',
            content: 'game-cardia:tutorial.steps.setup',
            position: 'center',
            requireAction: false,
            showMask: true,
            aiActions: [
                // 作弊：替换 P0 手牌为教学指定卡牌
                {
                    commandType: CHEAT_COMMANDS.MERGE_STATE,
                    payload: {
                        fields: {
                            players: {
                                '0': { hand: TUTORIAL_HAND_P0 },
                            },
                        },
                    },
                },
            ],
        },

        // ================================================================
        // 第二部分：UI 元素介绍（信息步骤，玩家只需点击 Next）
        // ================================================================

        // 1: 欢迎 — 介绍游戏目标
        {
            id: 'welcome',
            content: 'game-cardia:tutorial.steps.welcome',
            position: 'center',
            infoStep: true,
        },

        // 2: 手牌介绍 — 高亮手牌区
        {
            id: 'handIntro',
            content: 'game-cardia:tutorial.steps.handIntro',
            highlightTarget: 'cardia-hand-area',
            position: 'top',
            infoStep: true,
        },

        // 3: 战场介绍 — 高亮战场区
        {
            id: 'battlefieldIntro',
            content: 'game-cardia:tutorial.steps.battlefieldIntro',
            highlightTarget: 'cardia-battlefield',
            position: 'bottom',
            infoStep: true,
        },

        // 4: 印戒介绍 — 高亮印戒显示
        {
            id: 'signetIntro',
            content: 'game-cardia:tutorial.steps.signetIntro',
            highlightTarget: 'cardia-signet-display',
            position: 'left',
            infoStep: true,
        },

        // 5: 阶段介绍 — 高亮阶段指示器
        {
            id: 'phaseIntro',
            content: 'game-cardia:tutorial.steps.phaseIntro',
            highlightTarget: 'cardia-phase-indicator',
            position: 'right',
            infoStep: true,
        },

        // ================================================================
        // 第三部分：打牌阶段教学（玩家实际操作）
        // ================================================================

        // 6: 打牌阶段说明 — 介绍打牌规则
        {
            id: 'playPhaseExplain',
            content: 'game-cardia:tutorial.steps.playPhaseExplain',
            highlightTarget: 'cardia-hand-area',
            position: 'top',
            infoStep: true,
        },

        // 7: 打出第一张牌 — 玩家打出学徒
        {
            id: 'playFirstCard',
            content: 'game-cardia:tutorial.steps.playFirstCard',
            highlightTarget: 'cardia-hand-area',
            position: 'top',
            requireAction: true,
            allowedCommands: [CARDIA_COMMANDS.PLAY_CARD],
            allowedTargets: ['tut-1'],
            advanceOnEvents: [{ type: CARDIA_EVENTS.CARD_PLAYED }],
        },

        // ================================================================
        // 第四部分：能力阶段教学
        // ================================================================

        // 8: 能力阶段说明 — 介绍能力激活
        {
            id: 'abilityPhaseExplain',
            content: 'game-cardia:tutorial.steps.abilityPhaseExplain',
            position: 'center',
            infoStep: true,
        },

        // 9: 激活能力 — 玩家激活学徒的能力（抽1张牌）
        {
            id: 'activateAbility',
            content: 'game-cardia:tutorial.steps.activateAbility',
            highlightTarget: 'cardia-battlefield',
            position: 'bottom',
            requireAction: true,
            allowedCommands: [CARDIA_COMMANDS.ACTIVATE_ABILITY],
            advanceOnEvents: [{ type: CARDIA_EVENTS.ABILITY_ACTIVATED }],
        },

        // ================================================================
        // 第五部分：结束回合
        // ================================================================

        // 10: 结束回合说明 — 介绍结束回合按钮
        {
            id: 'endTurnExplain',
            content: 'game-cardia:tutorial.steps.endTurnExplain',
            highlightTarget: 'cardia-end-turn-btn',
            position: 'left',
            infoStep: true,
        },

        // 11: 结束回合 — 玩家点击结束回合
        {
            id: 'endTurn',
            content: 'game-cardia:tutorial.steps.endTurn',
            highlightTarget: 'cardia-end-turn-btn',
            position: 'left',
            requireAction: true,
            allowedCommands: [CARDIA_COMMANDS.END_TURN],
            advanceOnEvents: [{ type: CARDIA_EVENTS.TURN_ENDED }],
        },

        // ================================================================
        // 第六部分：对手回合
        // ================================================================

        // 12: 对手回合 — AI 自动操作
        {
            id: 'opponentTurn',
            content: 'game-cardia:tutorial.steps.opponentTurn',
            position: 'center',
            requireAction: false,
            showMask: true,
            viewAs: '1',
            aiActions: [
                // P1 打出一张牌
                { commandType: CARDIA_COMMANDS.PLAY_CARD, payload: { cardUid: 'any' }, playerId: '1' },
                // P1 跳过能力
                { commandType: CARDIA_COMMANDS.SKIP_ABILITY, payload: {}, playerId: '1' },
                // P1 结束回合
                { commandType: CARDIA_COMMANDS.END_TURN, payload: {}, playerId: '1' },
            ],
            advanceOnEvents: [
                { type: CARDIA_EVENTS.TURN_ENDED, match: { playerId: '1' } },
            ],
        },

        // ================================================================
        // 第七部分：遭遇战解析
        // ================================================================

        // 13: 遭遇战说明 — 介绍遭遇战机制
        {
            id: 'encounterExplain',
            content: 'game-cardia:tutorial.steps.encounterExplain',
            position: 'center',
            infoStep: true,
        },

        // 14: 影响力计算 — 介绍影响力计算规则
        {
            id: 'influenceExplain',
            content: 'game-cardia:tutorial.steps.influenceExplain',
            highlightTarget: 'cardia-battlefield',
            position: 'bottom',
            infoStep: true,
        },

        // ================================================================
        // 第八部分：总结
        // ================================================================

        // 15: 教学总结 — 核心要点回顾
        {
            id: 'summary',
            content: 'game-cardia:tutorial.steps.summary',
            position: 'center',
            requireAction: false,
        },

        // 16: 完成 — 教学结束
        {
            id: 'finish',
            content: 'game-cardia:tutorial.steps.finish',
            position: 'center',
            infoStep: true,
        },
    ],
};

export default CARDIA_TUTORIAL;
