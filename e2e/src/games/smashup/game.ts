/**
 * 大杀四方 (Smash Up) - 游戏适配器组装
 */

import type { EngineSystem } from '../../engine/systems/types';
import {
    createFlowSystem,
    createCheatSystem,
    createActionLogSystem,
    createEventStreamSystem,
    createInteractionSystem,
    createSimpleChoiceSystem,
    createMultistepChoiceSystem,
    createRematchSystem,
    createResponseWindowSystem,
    createTutorialSystem,
    createUndoSystem,
} from '../../engine';
import { createGameEngine } from '../../engine/adapter';
import { SmashUpDomain, SU_COMMANDS, type SmashUpCommand, type SmashUpCore, type SmashUpEvent } from './domain';
import type { ActionCardDef, FusionCardDef } from './domain/types';
import { getCardDef } from './data/cards';
import { actionLikeNeedsResponseWindowBase, getMeFirstPlayableBaseIndicesForCard, isActionLikeRespondableInWindow, isCardActionLike, isCardMinionLike } from './domain/utils';
import { getActionPlayRestrictionError, getMinionPlayRestrictionError } from './domain/playLegality';
import { smashUpFlowHooks } from './domain/index';
import { initAllAbilities } from './abilities';
import { createSmashUpEventSystem } from './domain/systems';
import { smashUpCheatModifier } from './cheatModifier';
import { ACTION_ALLOWLIST, UNDO_ALLOWLIST, formatSmashUpActionEntry } from './actionLog';
import { registerCardPreviewGetter } from '../../components/game/registry/cardPreviewRegistry';
import { getSmashUpCardPreviewRef } from './ui/cardPreviewHelper';
import { registerCriticalImageResolver } from '../../core';
import { smashUpCriticalImageResolver } from './criticalImageResolver';
import { registerGameAiRuntime } from '../../engine/ai';
import { smashUpAiRuntime } from './ai';
import './ui/SmashUpCardRenderer'; // 注册卡牌渲染器

// 注册所有派系能力
initAllAbilities();


// ============================================================================
// 系统组装（展开 createBaseSystems，替换 ActionLogSystem 为带配置版本）
// ============================================================================

const systems: EngineSystem<SmashUpCore>[] = [
    createFlowSystem<SmashUpCore>({ hooks: smashUpFlowHooks }),
    createActionLogSystem<SmashUpCore>({
        commandAllowlist: ACTION_ALLOWLIST,
        formatEntry: formatSmashUpActionEntry,
    }),
    createUndoSystem({ maxSnapshots: 3, snapshotCommandAllowlist: UNDO_ALLOWLIST }),
    createInteractionSystem(),
    createSimpleChoiceSystem(),
    createMultistepChoiceSystem(),
    createRematchSystem(),
    createResponseWindowSystem({
        allowedCommands: ['su:play_action', 'su:play_minion'],
        responderExemptCommands: [],
        commandWindowTypeConstraints: {
            'su:play_action': ['meFirst', 'afterScoring'],
            'su:play_minion': ['meFirst'],
        },
        responseAdvanceEvents: [
            { eventType: 'su:action_played', windowTypes: ['meFirst', 'afterScoring'] },
            { eventType: 'su:minion_played', windowTypes: ['meFirst'] },
        ],
        loopUntilAllPass: true,
        interactionLock: {
            requestEvent: 'SYS_INTERACTION_REQUESTED',
        },
        hasRespondableContent: (state, playerId, windowType) => {
            if (windowType !== 'meFirst' && windowType !== 'afterScoring') return true;
            const core = state as SmashUpCore;
            const player = core.players[playerId];
            if (!player) return false;
            const actionRestrictionError = getActionPlayRestrictionError(core, playerId);
            const minionRestrictionError = getMinionPlayRestrictionError(core, playerId);
            
            // 检查响应窗口可打出的行动卡（special 或显式标记了 responseWindowTiming 的普通行动卡）
            const hasRespondableAction = !actionRestrictionError && player.hand.some(c => {
                if (!isCardActionLike(c)) return false;
                const def = getCardDef(c.defId) as ActionCardDef | FusionCardDef | undefined;
                if (!def) return false;
                if (!isActionLikeRespondableInWindow(def, windowType)) return false;

                if (windowType === 'meFirst'
                    && actionLikeNeedsResponseWindowBase(def)
                    && getMeFirstPlayableBaseIndicesForCard(core, c.defId).length === 0) {
                    return false;
                }

                // 便衣忍者还需要手牌里存在可打出的随从。
                if (c.defId === 'ninja_hidden_ninja' && !player.hand.some(isCardMinionLike)) {
                    return false;
                }
                
                // 其他响应牌默认可用
                return true;
            });
            
            // 检查 beforeScoringPlayable 随从（如影舞者）- 只在 meFirst 窗口可用
            const hasBeforeScoringMinion = windowType === 'meFirst' && !minionRestrictionError && player.hand.some(c => {
                if (!isCardMinionLike(c)) return false;
                if (getMeFirstPlayableBaseIndicesForCard(core, c.defId).length > 0) {
                    return true;
                }
                return false;
            });
            
            return hasRespondableAction || hasBeforeScoringMinion;
        },
    }),
    createTutorialSystem(),
    createEventStreamSystem(),
    createSmashUpEventSystem(),
    createCheatSystem<SmashUpCore>(smashUpCheatModifier),
];

// 适配器配置
const adapterConfig = {
    domain: SmashUpDomain,
    systems,
    minPlayers: 2,
    maxPlayers: 4,
    commandTypes: [...Object.values(SU_COMMANDS)],
};

// 引擎配置
export const engineConfig = createGameEngine<SmashUpCore, SmashUpCommand, SmashUpEvent>(adapterConfig);
registerGameAiRuntime(smashUpAiRuntime);

export default engineConfig;

// 导出系统配置供测试复用
export { systems as smashUpSystemsForTest };

// 导出 Domain 和 FlowHooks 供测试使用
export { SmashUpDomain, smashUpFlowHooks };

// ============================================================================
// 卡牌预览注册（放文件末尾，避免 Vite SSR 函数提升陷阱）
// ============================================================================
registerCardPreviewGetter('smashup', getSmashUpCardPreviewRef, { maxDim: 220 });
registerCriticalImageResolver('smashup', smashUpCriticalImageResolver);
