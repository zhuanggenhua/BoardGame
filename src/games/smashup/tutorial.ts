/**
 * 大杀四方 (Smash Up) - 教学配置（恐龙+海盗 vs 机器人+巫师）
 *
 * 设计原则：每一步只讲一个概念，并高亮对应的 UI 元素。
 * 带着玩家走一遍完整回合，而不是一股脑把信息扔给玩家。
 *
 * 使用作弊命令设置固定手牌，确保教学流程可控：
 * - 玩家派系：恐龙（力量型，简单直观）+ 海盗（移动型，便于演示）
 * - 对手派系：机器人 + 巫师
 * - 通过 MERGE_STATE 设置玩家手牌为教学指定卡牌
 *
 * 教学手牌设计（P0）：
 * - 战争猛禽 (dino_war_raptor, 力量2) — 简单随从，用于演示打出随从
 * - 重装剑龙 (dino_armor_stego, 力量3) — 持续能力随从，丰富手牌
 * - 大副 (pirate_first_mate, 力量2) — 海盗随从，展示混搭派系
 * - 机能强化 (dino_augmentation, 标准行动) — 简单行动卡，用于演示打出行动
 * - 虚张声势 (pirate_swashbuckling, 标准行动) — 海盗行动卡，丰富手牌
 */

import type { TutorialManifest } from '../../engine/types';
import type { CardInstance } from './domain/types';
import { SU_COMMANDS, SU_EVENTS } from './domain/types';
import { FLOW_COMMANDS, FLOW_EVENTS } from '../../engine/systems/FlowSystem';
import { CHEAT_COMMANDS } from '../../engine/systems/CheatSystem';
import { SMASHUP_FACTION_IDS } from './domain/ids';

// ============================================================================
// 事件匹配器常量
// ============================================================================

/** 匹配进入出牌阶段 */
const MATCH_PHASE_PLAY = { type: FLOW_EVENTS.PHASE_CHANGED, match: { to: 'playCards' } };

/** 匹配进入基地记分阶段 */
const MATCH_PHASE_SCORE = { type: FLOW_EVENTS.PHASE_CHANGED, match: { to: 'scoreBases' } };

/** 匹配进入抽牌阶段 */
const MATCH_PHASE_DRAW = { type: FLOW_EVENTS.PHASE_CHANGED, match: { to: 'draw' } };

/** 匹配进入回合结束阶段 */
const MATCH_PHASE_END_TURN = { type: FLOW_EVENTS.PHASE_CHANGED, match: { to: 'endTurn' } };

/** 匹配进入回合开始阶段 */
const MATCH_PHASE_START_TURN = { type: FLOW_EVENTS.PHASE_CHANGED, match: { to: 'startTurn' } };

// 导出事件匹配器供后续步骤使用（4.3-4.6）
export {
    MATCH_PHASE_PLAY,
    MATCH_PHASE_SCORE,
    MATCH_PHASE_DRAW,
    MATCH_PHASE_END_TURN,
    MATCH_PHASE_START_TURN,
    SU_COMMANDS,
    SU_EVENTS,
    FLOW_COMMANDS,
    FLOW_EVENTS,
    CHEAT_COMMANDS,
};

// ============================================================================
// 教学固定手牌（P0）
// ============================================================================

/**
 * 教学用固定手牌：2 张随从 + 2 张行动 + 1 张备用随从
 * uid 使用 'tut-' 前缀避免与游戏生成的 uid 冲突
 */
const TUTORIAL_HAND: CardInstance[] = [
    { uid: 'tut-1', defId: 'dino_war_raptor', type: 'minion', owner: '0' },
    { uid: 'tut-2', defId: 'dino_armor_stego', type: 'minion', owner: '0' },
    { uid: 'tut-3', defId: 'pirate_first_mate', type: 'minion', owner: '0' },
    { uid: 'tut-4', defId: 'dino_augmentation', type: 'action', owner: '0' },
    { uid: 'tut-5', defId: 'pirate_swashbuckling', type: 'action', owner: '0' },
];

// ============================================================================
// 教学 Manifest
// ============================================================================

const SMASH_UP_TUTORIAL: TutorialManifest = {
    id: 'smashup-basic',
    randomPolicy: { mode: 'fixed', values: [1] },
    steps: [
        // ================================================================
        // 第一部分：初始化
        // ================================================================

        // 0: 初始化 — AI 蛇形选秀 + 作弊设置手牌
        {
            id: 'setup',
            content: 'game-smashup:tutorial.steps.setup',
            position: 'center',
            requireAction: false,
            showMask: true,
            aiActions: [
                // 蛇形选秀：P0 → P1 → P1 → P0
                { commandType: SU_COMMANDS.SELECT_FACTION, payload: { factionId: SMASHUP_FACTION_IDS.DINOSAURS } },
                { commandType: SU_COMMANDS.SELECT_FACTION, payload: { factionId: SMASHUP_FACTION_IDS.ROBOTS }, playerId: '1' },
                { commandType: SU_COMMANDS.SELECT_FACTION, payload: { factionId: SMASHUP_FACTION_IDS.WIZARDS }, playerId: '1' },
                { commandType: SU_COMMANDS.SELECT_FACTION, payload: { factionId: SMASHUP_FACTION_IDS.PIRATES } },
                // 推进阶段：factionSelect → startTurn → playCards
                { commandType: FLOW_COMMANDS.ADVANCE_PHASE, payload: undefined },
                // 作弊：替换 P0 手牌为教学指定卡牌
                {
                    commandType: CHEAT_COMMANDS.MERGE_STATE,
                    payload: {
                        fields: {
                            players: {
                                '0': { hand: TUTORIAL_HAND },
                            },
                        },
                    },
                },
            ],
        },

        // ================================================================
        // 第二部分：UI 元素介绍（信息步骤，玩家只需点击 Next）
        // ================================================================

        // 1: 欢迎 — 高亮基地区域，介绍基地是争夺目标
        {
            id: 'welcome',
            content: 'game-smashup:tutorial.steps.welcome',
            highlightTarget: 'su-base-area',
            position: 'bottom',
            requireAction: false,
            blockedCommands: [FLOW_COMMANDS.ADVANCE_PHASE],
        },

        // 2: 记分板介绍 — 高亮记分板，介绍 VP 追踪
        {
            id: 'scoreboard',
            content: 'game-smashup:tutorial.steps.scoreboard',
            highlightTarget: 'su-scoreboard',
            position: 'left',
            requireAction: false,
            blockedCommands: [FLOW_COMMANDS.ADVANCE_PHASE],
        },

        // 3: 手牌介绍 — 高亮手牌区，介绍卡牌类型（随从和行动）
        {
            id: 'handIntro',
            content: 'game-smashup:tutorial.steps.handIntro',
            highlightTarget: 'su-hand-area',
            position: 'top',
            requireAction: false,
            blockedCommands: [FLOW_COMMANDS.ADVANCE_PHASE],
        },

        // 4: 回合追踪器 — 高亮回合追踪器，介绍阶段流程
        {
            id: 'turnTracker',
            content: 'game-smashup:tutorial.steps.turnTracker',
            highlightTarget: 'su-turn-tracker',
            position: 'right',
            requireAction: false,
            blockedCommands: [FLOW_COMMANDS.ADVANCE_PHASE],
        },

        // 5: 结束按钮 — 高亮结束回合按钮，介绍其功能
        {
            id: 'endTurnBtn',
            content: 'game-smashup:tutorial.steps.endTurnBtn',
            highlightTarget: 'su-end-turn-btn',
            position: 'left',
            requireAction: false,
            blockedCommands: [FLOW_COMMANDS.ADVANCE_PHASE],
        },

        // ================================================================
        // 第三部分：出牌阶段教学（玩家实际操作）
        // ================================================================

        // 6: 出牌阶段说明 — 高亮手牌区，介绍每回合可打 1 随从 + 1 行动
        {
            id: 'playCardsExplain',
            content: 'game-smashup:tutorial.steps.playCardsExplain',
            highlightTarget: 'su-hand-area',
            position: 'top',
            requireAction: false,
            blockedCommands: [FLOW_COMMANDS.ADVANCE_PHASE],
        },

        // 7: 打出随从 — 玩家必须打出一张随从卡
        {
            id: 'playMinion',
            content: 'game-smashup:tutorial.steps.playMinion',
            highlightTarget: 'su-hand-area',
            position: 'top',
            requireAction: true,
            allowedCommands: [SU_COMMANDS.PLAY_MINION],
            advanceOnEvents: [{ type: SU_EVENTS.MINION_PLAYED }],
        },

        // 8: 打出行动 — 玩家必须打出一张行动卡
        {
            id: 'playAction',
            content: 'game-smashup:tutorial.steps.playAction',
            highlightTarget: 'su-hand-area',
            position: 'top',
            requireAction: true,
            allowedCommands: [SU_COMMANDS.PLAY_ACTION],
            advanceOnEvents: [{ type: SU_EVENTS.ACTION_PLAYED }],
        },

        // 9: 结束出牌 — 引导玩家点击结束按钮推进到下一阶段
        {
            id: 'endPlayCards',
            content: 'game-smashup:tutorial.steps.endPlayCards',
            highlightTarget: 'su-end-turn-btn',
            position: 'left',
            requireAction: true,
            allowedCommands: [FLOW_COMMANDS.ADVANCE_PHASE],
        },

        // ================================================================
        // 第四部分：基地记分与抽牌教学（信息步骤 + AI 自动推进）
        // ================================================================

        // 10: 基地记分概念 — 介绍临界点机制
        {
            id: 'baseScoring',
            content: 'game-smashup:tutorial.steps.baseScoring',
            position: 'center',
            requireAction: false,
            blockedCommands: [FLOW_COMMANDS.ADVANCE_PHASE],
        },

        // 11: VP 奖励说明 — 高亮记分板，介绍 1st/2nd/3rd 排名奖励
        {
            id: 'vpAwards',
            content: 'game-smashup:tutorial.steps.vpAwards',
            highlightTarget: 'su-scoreboard',
            position: 'left',
            requireAction: false,
            blockedCommands: [FLOW_COMMANDS.ADVANCE_PHASE],
        },

        // 12: 记分阶段 AI 自动推进 — 自动通过记分阶段
        {
            id: 'scoringPhase',
            content: 'game-smashup:tutorial.steps.scoringPhase',
            position: 'center',
            requireAction: false,
            showMask: true,
            aiActions: [
                { commandType: FLOW_COMMANDS.ADVANCE_PHASE, payload: undefined },
            ],
        },

        // 13: 抽牌阶段说明 — 高亮牌库/弃牌区，介绍每回合抽 2 张
        {
            id: 'drawExplain',
            content: 'game-smashup:tutorial.steps.drawExplain',
            highlightTarget: 'su-deck-discard',
            position: 'top',
            requireAction: false,
            blockedCommands: [FLOW_COMMANDS.ADVANCE_PHASE],
        },

        // 14: 手牌上限说明 — 介绍 10 张上限 + 弃牌规则
        {
            id: 'handLimit',
            content: 'game-smashup:tutorial.steps.handLimit',
            position: 'center',
            requireAction: false,
            blockedCommands: [FLOW_COMMANDS.ADVANCE_PHASE],
        },

        // ================================================================
        // 第五部分：结束抽牌 + 对手回合 + 总结
        // ================================================================

        // 15: 结束抽牌 — 引导玩家点击结束按钮推进阶段
        {
            id: 'endDraw',
            content: 'game-smashup:tutorial.steps.endDraw',
            highlightTarget: 'su-end-turn-btn',
            position: 'left',
            requireAction: true,
            allowedCommands: [FLOW_COMMANDS.ADVANCE_PHASE],
        },

        // 16: 对手回合 — AI 自动执行对手的完整回合
        // P1 的回合流程：playCards → scoreBases(auto) → draw → endTurn(auto) → startTurn(P0)
        {
            id: 'opponentTurn',
            content: 'game-smashup:tutorial.steps.opponentTurn',
            position: 'center',
            requireAction: false,
            showMask: true,
            aiActions: [
                // P1 出牌阶段 → 直接结束（不打牌）
                { commandType: FLOW_COMMANDS.ADVANCE_PHASE, payload: undefined, playerId: '1' },
                // P1 抽牌阶段 → 结束（draw → endTurn(auto) → startTurn(auto, 切回 P0)）
                { commandType: FLOW_COMMANDS.ADVANCE_PHASE, payload: undefined, playerId: '1' },
            ],
            advanceOnEvents: [
                { type: SU_EVENTS.TURN_STARTED, match: { playerId: '0' } },
            ],
        },

        // 17: 天赋能力说明 — 介绍天赋机制
        {
            id: 'talentIntro',
            content: 'game-smashup:tutorial.steps.talentIntro',
            position: 'center',
            requireAction: false,
        },

        // 18: 回合循环说明 — 介绍回合交替机制
        {
            id: 'turnCycle',
            content: 'game-smashup:tutorial.steps.turnCycle',
            position: 'center',
            requireAction: false,
        },

        // 19: 教学总结 — 核心要点回顾
        {
            id: 'summary',
            content: 'game-smashup:tutorial.steps.summary',
            position: 'center',
            requireAction: false,
        },

        // 20: 完成 — 教学结束
        {
            id: 'finish',
            content: 'game-smashup:tutorial.steps.finish',
            highlightTarget: 'su-base-area',
            position: 'bottom',
            requireAction: false,
        },
    ],
};

export default SMASH_UP_TUTORIAL;
