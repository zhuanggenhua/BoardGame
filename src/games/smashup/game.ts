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
import type { ActionCardDef } from './domain/types';
import { getCardDef } from './data/cards';
import { smashUpFlowHooks } from './domain/index';
import { initAllAbilities } from './abilities';
import { createSmashUpEventSystem } from './domain/systems';
import { smashUpCheatModifier } from './cheatModifier';
import { ACTION_ALLOWLIST, UNDO_ALLOWLIST, formatSmashUpActionEntry } from './actionLog';
import { registerCardPreviewGetter } from '../../components/game/registry/cardPreviewRegistry';
import { getSmashUpCardPreviewRef } from './ui/cardPreviewHelper';
import { registerCriticalImageResolver } from '../../core';
import { smashUpCriticalImageResolver } from './criticalImageResolver';
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
        allowedCommands: ['su:play_action'],
        responderExemptCommands: [],
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
                if (def?.subtype !== 'special') return false;
                
                // 特殊检查：便衣忍者需要手牌中有随从才能使用
                if (c.defId === 'ninja_hidden_ninja') {
                    return player.hand.some(card => card.type === 'minion');
                }
                
                // 其他 special 卡默认可用
                return true;
            });
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

export default engineConfig;

// 导出系统配置供测试复用
export { systems as smashUpSystemsForTest };

// ============================================================================
// 卡牌预览注册（放文件末尾，避免 Vite SSR 函数提升陷阱）
// ============================================================================
registerCardPreviewGetter('smashup', getSmashUpCardPreviewRef, { maxDim: 220 });
registerCriticalImageResolver('smashup', smashUpCriticalImageResolver);
