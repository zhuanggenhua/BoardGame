/**
 * DiceThrone 视觉元数据（Single Source of Truth）
 *
 * STATUS_EFFECT_META 和 TOKEN_META 从 ALL_TOKEN_DEFINITIONS 自动构建，
 * 不再手动维护。添加新 Token 只需在英雄 tokens.ts 中补充 frameId/atlasId。
 */
import { ALL_TOKEN_DEFINITIONS } from './characters';
import type { TokenDef } from './tokenTypes';

export type StatusEffectMeta = {
    color?: string;
    frameId?: string;
    atlasId?: string;
    iconPath?: string;
    sfxKey?: string;
};

/**
 * 从 TokenDef 自动构建视觉元数据
 * - STATUS_EFFECT_META: debuff 类别（对应 HeroState.statusEffects）
 * - TOKEN_META: consumable/buff/unique 类别（对应 HeroState.tokens）
 */
const buildStatusEffectMeta = (def: TokenDef): StatusEffectMeta => ({
    frameId: def.frameId,
    atlasId: def.atlasId,
    color: def.colorTheme,
    iconPath: def.iconPath,
    sfxKey: def.sfxKey,
});

function buildVisualMeta(): {
    status: Record<string, StatusEffectMeta>;
    token: Record<string, StatusEffectMeta>;
} {
    const status: Record<string, StatusEffectMeta> = {};
    const token: Record<string, StatusEffectMeta> = {};

    for (const def of ALL_TOKEN_DEFINITIONS) {
        const meta = buildStatusEffectMeta(def);

        if (def.category === 'debuff') {
            status[def.id] = meta;
        } else {
            token[def.id] = meta;
        }
    }

    return { status, token };
}

const { status: _statusMeta, token: _tokenMeta } = buildVisualMeta();

/** 被动状态效果元数据（自动从 TokenDef 构建） */
export const STATUS_EFFECT_META: Record<string, StatusEffectMeta> = _statusMeta;

/** Token 元数据（自动从 TokenDef 构建） */
export const TOKEN_META: Record<string, StatusEffectMeta> = _tokenMeta;

/**
 * 按“当前展示实体 ID”解析视觉元数据。
 * 某些 debuff 仍存放在 players.tokens 中，因此 token UI 需要允许回退到 STATUS_EFFECT_META。
 * preferredDefinitions 用于同名状态（例如不同英雄都有 bleed）按当前玩家英雄定义优先取图集。
 */
export const getVisualMetaById = (
    id: string,
    preferredDefinitions?: TokenDef[],
): StatusEffectMeta | undefined => {
    const preferred = preferredDefinitions?.find(def => def.id === id);
    if (preferred) {
        return buildStatusEffectMeta(preferred);
    }
    return TOKEN_META[id] ?? STATUS_EFFECT_META[id];
};
