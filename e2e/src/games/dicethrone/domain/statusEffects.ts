/**
 * DiceThrone 视觉元数据（Single Source of Truth）
 *
 * STATUS_EFFECT_META 和 TOKEN_META 从 ALL_TOKEN_DEFINITIONS 自动构建，
 * 不再手动维护。添加新 Token 只需在英雄 tokens.ts 中补充 frameId/atlasId。
 */
import { ALL_TOKEN_DEFINITIONS } from './characters';

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
function buildVisualMeta(): {
    status: Record<string, StatusEffectMeta>;
    token: Record<string, StatusEffectMeta>;
} {
    const status: Record<string, StatusEffectMeta> = {};
    const token: Record<string, StatusEffectMeta> = {};

    for (const def of ALL_TOKEN_DEFINITIONS) {
        const meta: StatusEffectMeta = {
            frameId: def.frameId,
            atlasId: def.atlasId,
            color: def.colorTheme,
            iconPath: def.iconPath,
            sfxKey: def.sfxKey,
        };

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
 */
export const getVisualMetaById = (id: string): StatusEffectMeta | undefined => (
    TOKEN_META[id] ?? STATUS_EFFECT_META[id]
);
