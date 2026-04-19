/**
 * 卡迪亚 (Cardia) - 教学配置
 *
 * 设计原则：每一步只讲一个概念，并高亮对应的 UI 元素。
 * 带着玩家走一遍完整回合，而不是一股脑把信息扔给玩家。
 *
 * 使用作弊命令设置固定手牌，确保教学流程可控：
 * - 玩家手牌：外科医生（演示能力阶段）
 * - 对手手牌：宫廷卫士（保证首回合对局能结算出失败方）
 */

import type { TutorialManifest } from '../../engine/types';
import type { CardInstance } from './domain/types';
import { CARDIA_COMMANDS } from './domain/commands';
import { CARDIA_EVENTS } from './domain/events';
import { FLOW_EVENTS } from '../../engine/systems/FlowSystem';
import { CHEAT_COMMANDS } from '../../engine/systems/CheatSystem';
import { CARD_IDS_DECK_I, type CardId } from './domain/ids';
import cardRegistry from './domain/cardRegistry';
import { createModifierStack } from '../../engine/primitives/modifier';
import { createTagContainer } from '../../engine/primitives/tags';

// ============================================================================
// 教学固定手牌
// ============================================================================

function createTutorialCard(uid: string, defId: CardId, ownerId: '0' | '1'): CardInstance {
    const def = cardRegistry.get(defId);
    if (!def) {
        throw new Error(`[CardiaTutorial] 未找到卡牌定义: ${defId}`);
    }
    return {
        uid,
        defId,
        ownerId,
        baseInfluence: def.influence,
        faction: def.faction,
        abilityIds: [...def.abilityIds],
        difficulty: def.difficulty,
        modifiers: createModifierStack(),
        tags: createTagContainer(),
        signets: 0,
        ongoingMarkers: [],
        imagePath: def.imagePath,
    };
}

/**
 * 教学固定手牌（真实卡牌定义 + 固定 UID，保证教程步骤可控）
 * - P0: 外科医生（-5 到你下一张打出的牌）
 * - P1: 宫廷卫士（高影响力，保证 P0 本回合为失败方，能进入能力教学）
 */
const TUTORIAL_HAND_P0: CardInstance[] = [
    createTutorialCard('tut-1', CARD_IDS_DECK_I.CARD_03, '0'),
];

const TUTORIAL_HAND_P1: CardInstance[] = [
    createTutorialCard('tut-op-1', CARD_IDS_DECK_I.CARD_07, '1'),
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
                                '1': { hand: TUTORIAL_HAND_P1 },
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

        // 7: 打出第一张牌 — 玩家打出外科医生
        {
            id: 'playFirstCard',
            content: 'game-cardia:tutorial.steps.playFirstCard',
            highlightTarget: 'cardia-hand-area',
            position: 'top',
            requireAction: true,
            allowedCommands: [CARDIA_COMMANDS.PLAY_CARD],
            allowedTargets: ['tut-1'],
            advanceOnEvents: [{ type: CARDIA_EVENTS.CARD_PLAYED, match: { playerId: '0' } }],
        },

        // 8: 对手打牌（AI 自动）— 触发遭遇结算，推进到能力阶段
        {
            id: 'opponentPlayCard',
            content: 'game-cardia:tutorial.steps.opponentPlayCard',
            position: 'center',
            requireAction: false,
            showMask: true,
            viewAs: '1',
            aiActions: [
                {
                    commandType: CARDIA_COMMANDS.PLAY_CARD,
                    payload: { cardUid: 'tut-op-1' },
                    playerId: '1',
                },
            ],
            advanceOnEvents: [{ type: FLOW_EVENTS.PHASE_CHANGED, match: { to: 'ability' } }],
        },

        // ================================================================
        // 第四部分：能力阶段教学
        // ================================================================

        // 9: 能力阶段说明 — 介绍能力激活
        {
            id: 'abilityPhaseExplain',
            content: 'game-cardia:tutorial.steps.abilityPhaseExplain',
            position: 'center',
            infoStep: true,
        },

        // 10: 激活能力 — 玩家激活外科医生能力
        {
            id: 'activateAbility',
            content: 'game-cardia:tutorial.steps.activateAbility',
            highlightTarget: 'cardia-activate-ability-btn',
            position: 'left',
            requireAction: true,
            allowedCommands: [CARDIA_COMMANDS.ACTIVATE_ABILITY],
            advanceOnEvents: [{ type: CARDIA_EVENTS.ABILITY_ACTIVATED }],
        },

        // ================================================================
        // 第五部分：遭遇战解析
        // ================================================================

        // 11: 遭遇战说明 — 介绍遭遇战机制
        {
            id: 'encounterExplain',
            content: 'game-cardia:tutorial.steps.encounterExplain',
            position: 'center',
            infoStep: true,
        },

        // 12: 影响力计算 — 介绍影响力计算规则
        {
            id: 'influenceExplain',
            content: 'game-cardia:tutorial.steps.influenceExplain',
            highlightTarget: 'cardia-battlefield',
            position: 'bottom',
            infoStep: true,
        },

        // ================================================================
        // 第六部分：总结
        // ================================================================

        // 13: 教学总结 — 核心要点回顾
        {
            id: 'summary',
            content: 'game-cardia:tutorial.steps.summary',
            position: 'center',
            requireAction: false,
        },

        // 14: 完成 — 教学结束
        {
            id: 'finish',
            content: 'game-cardia:tutorial.steps.finish',
            position: 'center',
            infoStep: true,
        },
    ],
};

export default CARDIA_TUTORIAL;
