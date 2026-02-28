import type { TokenDef, TokenState } from '../../domain/tokenTypes';
import { TOKEN_IDS, STATUS_IDS, DICETHRONE_STATUS_ATLAS_IDS } from '../../domain/ids';

const tokenText = (id: string, field: 'name' | 'description') => `tokens.${id}.${field}`;
const statusText = (id: string, field: 'name' | 'description') => `statusEffects.${id}.${field}`;

export const SHADOW_THIEF_TOKENS: TokenDef[] = [
    {
        id: TOKEN_IDS.SNEAK,
        name: tokenText(TOKEN_IDS.SNEAK, 'name'),
        category: 'buff',
        colorTheme: 'bg-gradient-to-br from-indigo-500 to-purple-800',
        description: tokenText(TOKEN_IDS.SNEAK, 'description') as unknown as string[],
        stackLimit: 1,
        // 潜行不再通过 onDamageReceived 被动触发
        // 而是在攻击流程中（offensiveRoll 阶段退出时）主动检查：
        // 若防御方有潜行，跳过防御掷骰、免除伤害、消耗潜行
        // 详见 flowHooks.ts 的 offensiveRoll 退出逻辑
        frameId: 'shadow-soul',
        atlasId: DICETHRONE_STATUS_ATLAS_IDS.SHADOW_THIEF,
    },
    {
        id: TOKEN_IDS.SNEAK_ATTACK,
        name: tokenText(TOKEN_IDS.SNEAK_ATTACK, 'name'),
        category: 'consumable',
        colorTheme: 'bg-gradient-to-br from-red-500 to-orange-800',
        description: tokenText(TOKEN_IDS.SNEAK_ATTACK, 'description') as unknown as string[],
        stackLimit: 1,
        activeUse: {
            timing: ['beforeDamageDealt'],
            consumeAmount: 1,
            effect: {
                type: 'modifyDamageDealt',
                value: 0, // 实际逻辑在 shadow_thief-sneak-attack-use custom action 中
            }
        },
        frameId: 'sneak-attack',
        atlasId: DICETHRONE_STATUS_ATLAS_IDS.SHADOW_THIEF,
    },
    // 中毒状态效果定义（暗影刺客引入）
    {
        id: STATUS_IDS.POISON,
        name: statusText(STATUS_IDS.POISON, 'name'),
        category: 'debuff',
        colorTheme: 'bg-gradient-to-br from-green-600 to-emerald-900',
        description: statusText(STATUS_IDS.POISON, 'description') as unknown as string[],
        stackLimit: 3,
        passiveTrigger: {
            timing: 'onTurnStart',
            removable: true,
            // value 仅为占位，实际伤害按 stacks 数量计算（见 flowHooks.ts）
            actions: [{ type: 'damage', target: 'self', value: 1 }],
        },
        frameId: 'poison',
        atlasId: DICETHRONE_STATUS_ATLAS_IDS.SHADOW_THIEF,
    },
];

export const SHADOW_THIEF_INITIAL_TOKENS: TokenState = {
    [TOKEN_IDS.SNEAK]: 0,
    [TOKEN_IDS.SNEAK_ATTACK]: 0,
    [STATUS_IDS.POISON]: 0,
};
