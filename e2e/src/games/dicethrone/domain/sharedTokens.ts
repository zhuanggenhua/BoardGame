/**
 * 共享 Token 定义
 * 
 * 这些 token 被多个角色使用，统一在此定义避免重复
 */

import type { TokenDef } from './tokenTypes';
import { STATUS_IDS, TOKEN_IDS, DICETHRONE_STATUS_ATLAS_IDS } from './ids';
import { RESOURCE_IDS } from './resources';

const statusText = (id: string, key: string) => `statusEffects.${id}.${key}`;
const tokenText = (id: string, key: string) => `tokens.${id}.${key}`;

/**
 * 共享状态效果和 Token 定义
 */
export const SHARED_TOKENS: TokenDef[] = [
    /**
     * 击倒（Knockdown）- 跳过下个回合的进攻投掷阶段
     * 
     * 使用角色：火法师、武僧、枪手、武士
     */
    {
        id: STATUS_IDS.KNOCKDOWN,
        name: statusText(STATUS_IDS.KNOCKDOWN, 'name'),
        colorTheme: 'from-red-600 to-orange-500',
        description: statusText(STATUS_IDS.KNOCKDOWN, 'description') as unknown as string[],
        sfxKey: 'fantasy.medieval_fantasy_sound_fx_pack_vol.weapons.pot_explosion',
        stackLimit: 1,
        category: 'debuff',
        passiveTrigger: {
            timing: 'onPhaseEnter',
            removable: true,
            removalCost: { resource: RESOURCE_IDS.CP, amount: 2 },
        },
        frameId: 'knockdown',
        atlasId: DICETHRONE_STATUS_ATLAS_IDS.MONK,
    },

    /**
     * 闪避（Evasive）- 下次攻击完全闪避
     * 
     * 使用角色：月精灵、武僧、枪手
     */
    {
        id: TOKEN_IDS.EVASIVE,
        name: tokenText(TOKEN_IDS.EVASIVE, 'name'),
        colorTheme: 'from-cyan-500 to-blue-500',
        description: tokenText(TOKEN_IDS.EVASIVE, 'description') as unknown as string[],
        sfxKey: 'fantasy.medieval_fantasy_sound_fx_pack_vol.weapons.weapon_power_up_wind',
        stackLimit: 1,
        category: 'buff',
        passiveTrigger: {
            timing: 'onDefense',
            removable: true,
            actions: [{ type: 'evade' }],
        },
        frameId: 'evasive',
        atlasId: DICETHRONE_STATUS_ATLAS_IDS.MOON_ELF,
    },

    /**
     * 晕眩（Daze）- 攻击结算后立即触发额外攻击
     * 
     * 规则：
     * - Player A 攻击 Player B，并对 Player B 施加晕眩
     * - 当前攻击结算后，立即移除 Player B 的晕眩
     * - Player A 立即再次攻击（额外攻击）
     * 
     * 使用角色：狂战士、火法师
     * 
     * 注意：晕眩在攻击结束后立即触发，不会在 buff 区显示
     */
    {
        id: STATUS_IDS.DAZE,
        name: statusText(STATUS_IDS.DAZE, 'name'),
        colorTheme: 'from-yellow-600 to-amber-500',
        description: statusText(STATUS_IDS.DAZE, 'description') as unknown as string[],
        sfxKey: 'fantasy.medieval_fantasy_sound_fx_pack_vol.weapons.weapon_power_up_lightning',
        stackLimit: 1,
        category: 'debuff',
        passiveTrigger: {
            timing: 'onAttackEnd', // 在攻击结束时触发额外攻击
            removable: true, // 攻击结束后自动移除（但可被净化）
            actions: [{ type: 'extraAttack', target: 'self' }], // 攻击方获得额外攻击（target 字段未使用，实际逻辑在 checkDazeExtraAttack）
        },
        frameId: 'stun',
        atlasId: DICETHRONE_STATUS_ATLAS_IDS.BARBARIAN,
    },
];

/**
 * 共享 Token ID 到定义的映射
 */
export const SHARED_TOKEN_MAP: Record<string, TokenDef> =
    Object.fromEntries(SHARED_TOKENS.map(t => [t.id, t])) as Record<string, TokenDef>;
