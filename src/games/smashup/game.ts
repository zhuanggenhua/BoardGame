/**
 * 大杀四方 (Smash Up) - 游戏适配器组装
 */

import type { EngineSystem } from '../../engine/systems/types';
import {
    createGameAdapter,
    createFlowSystem,
    createCheatSystem,
    createActionLogSystem,
    createEventStreamSystem,
    createLogSystem,
    createInteractionSystem,
    createRematchSystem,
    createResponseWindowSystem,
    createTutorialSystem,
    createUndoSystem,
} from '../../engine';
import { SmashUpDomain, SU_COMMANDS, type SmashUpCommand, type SmashUpCore, type SmashUpEvent } from './domain';
import type { ActionCardDef } from './domain/types';
import { getCardDef } from './data/cards';
import { smashUpFlowHooks } from './domain/index';
import { initAllAbilities } from './abilities';
import { createSmashUpEventSystem } from './domain/systems';
import { smashUpCheatModifier } from './cheatModifier';
import { ACTION_ALLOWLIST, formatSmashUpActionEntry } from './actionLog';
import { registerCardPreviewGetter } from '../../components/game/registry/cardPreviewRegistry';
import { getSmashUpCardPreviewRef } from './ui/cardPreviewHelper';
import { registerCriticalImageResolver } from '../../core';
import { smashUpCriticalImageResolver } from './criticalImageResolver';

// 注册所有派系能力
initAllAbilities();

// ============================================================================
// 系统组装（展开 createBaseSystems，替换 ActionLogSystem 为带配置版本）
// ============================================================================

const systems: EngineSystem<SmashUpCore>[] = [
    createFlowSystem<SmashUpCore>({ hooks: smashUpFlowHooks }),
    createLogSystem(),
    createActionLogSystem<SmashUpCore>({
        commandAllowlist: ACTION_ALLOWLIST,
        formatEntry: formatSmashUpActionEntry,
    }),
    createUndoSystem({ maxSnapshots: 3, snapshotCommandAllowlist: ACTION_ALLOWLIST }),
    createInteractionSystem(),
    createRematchSystem(),
    createResponseWindowSystem({
        allowedCommands: ['su:play_action'],
        commandWindowTypeConstraints: {
            'su:play_action': ['meFirst'],
        },
        responseAdvanceEvents: [
            { eventType: 'su:action_played', windowTypes: ['meFirst'] },
        ],
        loopUntilAllPass: true,
        hasRespondableContent: (state, playerId, windowType) => {
            if (windowType !== 'meFirst') return true;
            const core = state as SmashUpCore;
            const player = core.players[playerId];
            if (!player) return false;
            return player.hand.some(c => {
                if (c.type !== 'action') return false;
                const def = getCardDef(c.defId) as ActionCardDef | undefined;
                return def?.subtype === 'special';
            });
        },
    }),
    createTutorialSystem(),
    createEventStreamSystem(),
    createSmashUpEventSystem(),
    createCheatSystem<SmashUpCore>(smashUpCheatModifier),
];

export const SmashUp = createGameAdapter<SmashUpCore, SmashUpCommand, SmashUpEvent>({
    domain: SmashUpDomain,
    systems,
    minPlayers: 2,
    maxPlayers: 4,
    commandTypes: [...Object.values(SU_COMMANDS)],
});

export default SmashUp;

// 导出系统配置供测试复用
export { systems as smashUpSystemsForTest };

// ============================================================================
// 卡牌预览注册（放文件末尾，避免 Vite SSR 函数提升陷阱）
// ============================================================================
registerCardPreviewGetter('smashup', getSmashUpCardPreviewRef);
registerCriticalImageResolver('smashup', smashUpCriticalImageResolver);
