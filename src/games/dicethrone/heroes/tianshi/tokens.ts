/** 炽天使状态与标记定义 */

import type { TokenDef, TokenState } from '../../domain/tokenTypes';
import { MONK_TOKENS } from '../monk/tokens';
import { PALADIN_TOKENS } from '../paladin/tokens';
import { DICETHRONE_STATUS_ATLAS_IDS, STATUS_IDS, TOKEN_IDS } from '../../domain/ids';

const tokenText = (id: string, field: 'name' | 'description') => `tokens.${id}.${field}`;

const sharedPurify = MONK_TOKENS.find(token => token.id === TOKEN_IDS.PURIFY);
const sharedBlessing = PALADIN_TOKENS.find(token => token.id === TOKEN_IDS.BLESSING_OF_DIVINITY);

if (!sharedPurify || !sharedBlessing) {
    throw new Error('[DiceThrone] 炽天使依赖的净化或神圣祝福定义缺失');
}

export const TIANSHI_TOKENS: TokenDef[] = [
    sharedPurify,
    {
        id: TOKEN_IDS.FLIGHT,
        name: tokenText(TOKEN_IDS.FLIGHT, 'name'),
        colorTheme: 'from-sky-400 to-cyan-500',
        description: tokenText(TOKEN_IDS.FLIGHT, 'description') as unknown as string[],
        sfxKey: 'magic.general.modern_magic_sound_fx_pack_vol.divine_magic.divine_magic_grace_whisper_001',
        stackLimit: 3,
        category: 'consumable',
        activeUse: {
            timing: ['beforeDamageDealt', 'beforeDamageReceived', 'duringRoll'],
            consumeAmount: 1,
            effect: { type: 'modifyDamageDealt', value: 0 },
            customActionId: 'tianshi-use-flight',
        },
        frameId: TOKEN_IDS.FLIGHT,
        atlasId: DICETHRONE_STATUS_ATLAS_IDS.TIANSHI,
    },
    {
        id: TOKEN_IDS.DIVINE_ARRIVAL,
        name: tokenText(TOKEN_IDS.DIVINE_ARRIVAL, 'name'),
        colorTheme: 'from-violet-400 to-indigo-500',
        description: tokenText(TOKEN_IDS.DIVINE_ARRIVAL, 'description') as unknown as string[],
        sfxKey: 'magic.general.modern_magic_sound_fx_pack_vol.divine_magic.divine_magic_celestial_choir_001',
        stackLimit: 2,
        category: 'buff',
        passiveTrigger: {
            timing: 'onPhaseEnter',
            removable: true,
            actions: [{ type: 'custom', target: 'allOpponents', customActionId: 'tianshi-divine-arrival-upkeep' }],
        },
        frameId: TOKEN_IDS.DIVINE_ARRIVAL,
        atlasId: DICETHRONE_STATUS_ATLAS_IDS.TIANSHI,
    },
    {
        id: STATUS_IDS.DAZZLE,
        name: tokenText(STATUS_IDS.DAZZLE, 'name'),
        colorTheme: 'from-fuchsia-400 to-purple-600',
        description: tokenText(STATUS_IDS.DAZZLE, 'description') as unknown as string[],
        sfxKey: 'magic.general.modern_magic_sound_fx_pack_vol.divine_magic.divine_magic_hallowed_beam_001',
        stackLimit: 1,
        category: 'debuff',
        passiveTrigger: {
            // 眩光的消耗时机由攻击掷骰阶段共享流程处理；Token 类型暂不伪造不存在的被动时机。
            timing: 'manual',
            removable: true,
            consumeOnTrigger: true,
            actions: [{ type: 'custom', target: 'self', customActionId: 'tianshi-dazzle-roll' }],
        },
        frameId: STATUS_IDS.DAZZLE,
        atlasId: DICETHRONE_STATUS_ATLAS_IDS.TIANSHI,
    },
    sharedBlessing,
];

export const TIANSHI_TOKEN_MAP: Record<string, TokenDef> = Object.fromEntries(
    TIANSHI_TOKENS.map(token => [token.id, token]),
) as Record<string, TokenDef>;

export const TIANSHI_INITIAL_TOKENS: TokenState = {
    [TOKEN_IDS.PURIFY]: 0,
    [TOKEN_IDS.FLIGHT]: 0,
    [TOKEN_IDS.DIVINE_ARRIVAL]: 0,
    [TOKEN_IDS.BLESSING_OF_DIVINITY]: 0,
};

export const TIANSHI_INITIAL_STATUS_EFFECTS: Record<string, number> = {
    [STATUS_IDS.DAZZLE]: 0,
};
