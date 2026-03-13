/**
 * 大杀四方 (Smash Up) - 教学配置（恐龙+米斯卡塔尼克大学 vs 机器人+巫师）
 *
 * 设计原则：每一步只讲一个概念，并高亮对应的 UI 元素。
 * 带着玩家走一遍完整回合，而不是一股脑把信息扔给玩家。
 *
 * 使用作弊命令设置固定手牌，确保教学流程可控：
 * - 玩家派系：恐龙（力量型，简单直观）+ 米斯卡塔尼克大学（含天赋随从，用于演示天赋）
 * - 对手派系：机器人 + 巫师
 * - 通过 MERGE_STATE 设置玩家手牌为教学指定卡牌
 *
 * 教学手牌设计（P0）：
 * - 图书管理员 (miskatonic_librarian, 力量4, talent) — 天赋随从，用于演示天赋激活
 *   天赋效果：弃1张疯狂卡 → 抽1张牌。教学中注入1张疯狂卡，激活后弃疯狂卡+抽牌，无 Prompt。
 * - 嚎叫 (dino_howl, 标准行动) — 无交互行动卡（己方随从全体+1力量），用于演示打出行动
 * - 疯狂卡 (special_madness) — 注入1张，供图书管理员天赋消耗
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
 * 教学用固定手牌（P0）：
 * - 图书管理员：天赋随从（力量4），玩家打出后激活天赋（弃疯狂卡→抽牌）
 * - 嚎叫：无交互行动卡（己方随从全体+1力量），教学打出行动
 * - 疯狂卡：供图书管理员天赋消耗，天赋执行后弃掉并抽1张牌
 * uid 使用 'tut-' 前缀避免与游戏生成的 uid 冲突
 */
const TUTORIAL_HAND_P0: CardInstance[] = [
    { uid: 'tut-1', defId: 'miskatonic_librarian', type: 'minion', owner: '0' },
    { uid: 'tut-2', defId: 'dino_howl', type: 'action', owner: '0' },
    { uid: 'tut-mad', defId: 'special_madness', type: 'action', owner: '0' },
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

        // 0: 初始化 — AI 顺序双选 + 作弊设置手牌
        {
            id: 'setup',
            content: 'game-smashup:tutorial.steps.setup',
            position: 'center',
            requireAction: false,
            showMask: true,
            aiActions: [
                // 顺序双选：P0 → P0 → P1 → P1
                { commandType: SU_COMMANDS.SELECT_FACTION, playerId: '0', payload: { factionId: SMASHUP_FACTION_IDS.DINOSAURS } },
                { commandType: SU_COMMANDS.SELECT_FACTION, playerId: '0', payload: { factionId: SMASHUP_FACTION_IDS.MISKATONIC_UNIVERSITY } },
                { commandType: SU_COMMANDS.SELECT_FACTION, playerId: '1', payload: { factionId: SMASHUP_FACTION_IDS.ROBOTS } },
                { commandType: SU_COMMANDS.SELECT_FACTION, playerId: '1', payload: { factionId: SMASHUP_FACTION_IDS.WIZARDS } },
                // 注意：不需要显式 ADVANCE_PHASE。
                // ALL_FACTIONS_SELECTED 事件清除 factionSelection 后，
                // FlowSystem.onAutoContinueCheck 会自动推进 factionSelect → startTurn → playCards。
                // 如果加了显式 ADVANCE_PHASE，会从 playCards 多推一整轮，导致轮到对手。
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

        // 1: 欢迎 — 高亮基地区域，介绍基地是争夺目标
        {
            id: 'welcome',
            content: 'game-smashup:tutorial.steps.welcome',
            highlightTarget: 'su-base-area',
            position: 'bottom',
            infoStep: true,
        },

        // 2: 记分板介绍 — 高亮记分板，介绍 VP 追踪
        {
            id: 'scoreboard',
            content: 'game-smashup:tutorial.steps.scoreboard',
            highlightTarget: 'su-scoreboard',
            position: 'left',
            infoStep: true,
        },

        // 3: 手牌介绍 — 高亮手牌区，介绍卡牌类型（随从和行动）
        {
            id: 'handIntro',
            content: 'game-smashup:tutorial.steps.handIntro',
            highlightTarget: 'su-hand-area',
            position: 'top',
            infoStep: true,
        },

        // 4: 回合追踪器 — 高亮回合追踪器，介绍阶段流程
        {
            id: 'turnTracker',
            content: 'game-smashup:tutorial.steps.turnTracker',
            highlightTarget: 'su-turn-tracker',
            position: 'right',
            infoStep: true,
        },

        // 5: 结束按钮 — 高亮结束回合按钮，介绍其功能
        {
            id: 'endTurnBtn',
            content: 'game-smashup:tutorial.steps.endTurnBtn',
            highlightTarget: 'su-end-turn-btn',
            position: 'left',
            infoStep: true,
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
            infoStep: true,
        },

        // 7: 打出随从 — 玩家打出星之眷族（天赋随从，力量5）
        {
            id: 'playMinion',
            content: 'game-smashup:tutorial.steps.playMinion',
            highlightTarget: 'su-hand-area',
            position: 'top',
            requireAction: true,
            allowedCommands: [SU_COMMANDS.PLAY_MINION],
            allowedTargets: ['tut-1'],
            advanceOnEvents: [{ type: SU_EVENTS.MINION_PLAYED }],
        },

        // 8: 打出行动 — 玩家必须打出一张行动卡（嚎叫：无交互，己方随从全体+1力量）
        {
            id: 'playAction',
            content: 'game-smashup:tutorial.steps.playAction',
            highlightTarget: 'su-hand-area',
            position: 'top',
            requireAction: true,
            allowedCommands: [SU_COMMANDS.PLAY_ACTION],
            allowedTargets: ['tut-2'],
            advanceOnEvents: [{ type: SU_EVENTS.ACTION_PLAYED }],
        },

        // 9: 使用天赋 — 点击基地上图书管理员激活天赋（弃疯狂卡→抽1张牌，有明显反馈，无 Prompt）
        {
            id: 'useTalent',
            content: 'game-smashup:tutorial.steps.useTalent',
            highlightTarget: 'su-base-area',
            position: 'bottom',
            requireAction: true,
            allowedCommands: [SU_COMMANDS.USE_TALENT],
            allowedTargets: ['tut-1'],
            advanceOnEvents: [{ type: SU_EVENTS.TALENT_USED }],
        },

        // 10: 结束出牌 — 引导玩家点击结束按钮推进到下一阶段
        {
            id: 'endPlayCards',
            content: 'game-smashup:tutorial.steps.endPlayCards',
            highlightTarget: 'su-end-turn-btn',
            position: 'left',
            requireAction: true,
            allowedCommands: [FLOW_COMMANDS.ADVANCE_PHASE],
            advanceOnEvents: [MATCH_PHASE_SCORE],
        },

        // ================================================================
        // 第四部分：基地记分与抽牌教学（信息步骤 + AI 自动推进）
        // ================================================================

        // 10: 基地记分概念 — 介绍临界点机制
        {
            id: 'baseScoring',
            content: 'game-smashup:tutorial.steps.baseScoring',
            position: 'center',
            infoStep: true,
        },

        // 11: VP 奖励说明 — 高亮记分板，介绍 1st/2nd/3rd 排名奖励
        {
            id: 'vpAwards',
            content: 'game-smashup:tutorial.steps.vpAwards',
            highlightTarget: 'su-scoreboard',
            position: 'left',
            infoStep: true,
        },

        // 12: 记分阶段自动推进 — 此步骤不设 infoStep，
        // FlowSystem.onAutoContinueCheck 自动推进 scoreBases → draw → endTurn → ...
        // 整个链条会一口气跑完，步骤仅作为过渡信息展示。
        {
            id: 'scoringPhase',
            content: 'game-smashup:tutorial.steps.scoringPhase',
            position: 'center',
            requireAction: false,
            showMask: true,
        },

        // 13: 抽牌阶段说明 — 高亮牌库/弃牌区，介绍每回合抽 2 张
        {
            id: 'drawExplain',
            content: 'game-smashup:tutorial.steps.drawExplain',
            highlightTarget: 'su-deck-discard',
            position: 'top',
            infoStep: true,
        },

        // 14: 手牌上限说明 — 介绍 10 张上限 + 弃牌规则
        {
            id: 'handLimit',
            content: 'game-smashup:tutorial.steps.handLimit',
            position: 'center',
            infoStep: true,
        },

        // ================================================================
        // 第五部分：结束抽牌 + 对手回合 + 总结
        // ================================================================

        // 15: 抽牌完成说明 — 抽牌阶段自动推进（手牌不超限时无需操作）
        {
            id: 'endDraw',
            content: 'game-smashup:tutorial.steps.endDraw',
            position: 'center',
            infoStep: true,
        },

        // 16: 对手回合
        // P1 的回合流程：playCards → scoreBases(auto) → draw → endTurn(auto) → startTurn(P0)
        // 多轮 afterEvents 会自动推进整个链条，只需一次 ADVANCE_PHASE
        {
            id: 'opponentTurn',
            content: 'game-smashup:tutorial.steps.opponentTurn',
            position: 'center',
            requireAction: false,
            showMask: true,
            viewAs: '1', // 切换到对手视角，让玩家看到 AI 在操作
            aiActions: [
                // P1 出牌阶段 → 直接结束（不打牌），后续阶段自动推进直到切回 P0
                { commandType: FLOW_COMMANDS.ADVANCE_PHASE, payload: undefined, playerId: '1' },
            ],
            advanceOnEvents: [
                { type: SU_EVENTS.TURN_STARTED, match: { playerId: '0' } },
            ],
        },

        // 17: 回合循环说明 — 介绍回合交替机制
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

        // 20: 完成 — 教学结束（infoStep=true 确保玩家点 Next 后才退出，lastTutorialStepIdRef 能记录到 'finish'）
        {
            id: 'finish',
            content: 'game-smashup:tutorial.steps.finish',
            highlightTarget: 'su-base-area',
            position: 'bottom',
            infoStep: true,
        },
    ],
};

export default SMASH_UP_TUTORIAL;
