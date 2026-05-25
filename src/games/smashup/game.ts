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
import { getMinionLikePower } from './data/cards';
import { isOperationRestricted } from './domain/ongoingEffects';
import {
    canCardBePlayedInResponseWindow,
    getResponseWindowPlayableBaseIndicesForCard,
    isCardActionLike,
    isCardMinionLike,
} from './domain/utils';
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
            
            // 检查响应窗口可打出的行动卡
            const hasRespondableAction = !actionRestrictionError && player.hand.some(c => {
                if (!isCardActionLike(c)) return false;
                if (!canCardBePlayedInResponseWindow(core, c, windowType)) return false;
                const baseIndices = getResponseWindowPlayableBaseIndicesForCard(core, c.defId, windowType);
                if (baseIndices.length === 0) return true;
                return baseIndices.some(baseIndex => !isOperationRestricted(core, baseIndex, playerId, 'play_action', {
                    cardUid: c.uid,
                    activationWindow: windowType,
                }));
            });
            
            // 检查 beforeScoringPlayable 随从（如影舞者）- 只在 meFirst 窗口可用
            const hasBeforeScoringMinion = windowType === 'meFirst' && !minionRestrictionError && player.hand.some(c => {
                if (!isCardMinionLike(c)) return false;
                if (!canCardBePlayedInResponseWindow(core, c, windowType)) return false;
                const basePower = getMinionLikePower(c.defId) ?? 0;
                return getResponseWindowPlayableBaseIndicesForCard(core, c.defId, windowType).some(baseIndex =>
                    !isOperationRestricted(core, baseIndex, playerId, 'play_minion', {
                        minionDefId: c.defId,
                        basePower,
                        usesBaseLimitedMinionQuota: false,
                        cardUid: c.uid,
                        fromDiscard: false,
                        activationWindow: windowType,
                    }),
                );
            });

            const responseProbeState = {
                core,
                sys: {
                    phase: 'scoreBases',
                    interaction: { current: undefined, queue: [] },
                    responseWindow: {
                        current: {
                            id: `smashup_response_content_probe_${windowType}_${playerId}`,
                            windowType,
                            sourceId: 'smashup_reaction_choose',
                            responderQueue: [playerId],
                            currentResponderIndex: 0,
                            passedPlayers: [],
                        },
                    },
                },
            };

            const hasBoardSpecial = core.bases.some((base, baseIndex) =>
                base.minions.some(minion =>
                    minion.controller === playerId
                    && SmashUpDomain.validate(responseProbeState as any, {
                        type: SU_COMMANDS.ACTIVATE_SPECIAL,
                        playerId,
                        payload: { minionUid: minion.uid, baseIndex },
                    } as any).valid,
                ),
            );

            return hasRespondableAction || hasBeforeScoringMinion || hasBoardSpecial;
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
