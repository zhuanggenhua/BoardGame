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
    createTutorialSystem,
    createUndoSystem,
} from '../../engine';
import { createGameEngine } from '../../engine/adapter';
import { SmashUpDomain, SU_COMMANDS, type SmashUpCommand, type SmashUpCore, type SmashUpEvent } from './domain';
import { smashUpFlowHooks } from './domain/index';
import { initAllAbilities } from './abilities';
import { createSmashUpEventSystem } from './domain/systems';
import { SMASHUP_CHEAT_COMMANDS, smashUpCheatModifier } from './cheatModifier';
import { ACTION_ALLOWLIST, UNDO_ALLOWLIST, formatSmashUpActionEntry } from './actionLog';
import { registerCardPreviewGetter } from '../../components/game/registry/cardPreviewRegistry';
import { getSmashUpCardPreviewRef } from './ui/cardPreviewHelper';
import { registerCriticalImageResolver } from '../../core';
import { smashUpCriticalImageResolver } from './criticalImageResolver';
import { registerGameAiRuntime } from '../../engine/ai';
import { smashUpAiRuntime } from './ai';
import { resolveSmashUpLocalPregameControlledPlayerId } from './localPregameControl';
import { formatSmashUpEventTelemetry } from './eventTelemetry';
import {
    createSmashUpLocalTestInitialStateFactory,
    createSmashUpLocalTestSetupCommandsFactory,
} from './localTestBootstrap';
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
    commandTypes: [...Object.values(SU_COMMANDS), ...Object.values(SMASHUP_CHEAT_COMMANDS)],
    eventTelemetry: formatSmashUpEventTelemetry,
};

function hasSmashUpFactionPayload(payload: unknown): payload is { factionId: string } {
    return Boolean(payload)
        && typeof payload === 'object'
        && !Array.isArray(payload)
        && typeof (payload as { factionId?: unknown }).factionId === 'string';
}

// 引擎配置
export const engineConfig = {
    ...createGameEngine<SmashUpCore, SmashUpCommand, SmashUpEvent>(adapterConfig),
    resolveLocalPregameControlledPlayerId: resolveSmashUpLocalPregameControlledPlayerId,
    createLocalTestInitialState: createSmashUpLocalTestInitialStateFactory(systems),
    createLocalTestSetupCommands: createSmashUpLocalTestSetupCommandsFactory(),
    onlineAiRecovery: {
        publicPregameLegalActionPhases: ['factionSelect'],
        autoSelectFirstTriggerOnlySimpleChoiceSourceIds: ['smashup_reaction_choose'],
        legacyResponseWindowMirrorSourceIds: ['smashup_reaction_choose'],
        resolveManualSetupSelectionActionKindFromCommand: ({ type, payload }) => (
            type === SU_COMMANDS.SELECT_FACTION && hasSmashUpFactionPayload(payload)
                ? 'select-faction'
                : undefined
        ),
        allowForceCommandAfterLegalActionExhausted: ({ phase, previousCandidate, nextCandidate }) => phase === 'scoreBases'
            || phase === 'endTurn'
            || (
                phase === 'playCards'
                && previousCandidate.reason === 'active-turn'
                && previousCandidate.legalActionOnly !== true
                && nextCandidate.reason === 'active-turn'
                && nextCandidate.legalActionOnly !== true
            ),
    },
};
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
