import type { CSSProperties } from 'react';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Check } from 'lucide-react';
import { buildLocalizedImageSet, getLocalizedAssetPath } from '../../../core';
import { InfoTooltip } from '../../../components/common/overlays/InfoTooltip';
import { resolveI18nList } from './utils';

import { STATUS_IDS } from '../domain/ids';
import { CHARACTER_DATA_MAP } from '../domain/characters';
import type { TokenDef } from '../domain/tokenTypes';

// 从 CharacterData 自动收集图集路径（Single Source of Truth）
const STATUS_ATLAS_PATHS: Record<string, string> = (() => {
    const paths: Record<string, string> = {};
    for (const data of Object.values(CHARACTER_DATA_MAP)) {
        if (!paths[data.statusAtlasId]) {
            paths[data.statusAtlasId] = data.statusAtlasPath;
        }
    }
    return paths;
})();

type StatusIconAtlasFrame = { x: number; y: number; w: number; h: number };
export type StatusIconAtlasConfig = {
    imageW: number;
    imageH: number;
    frames: Record<string, StatusIconAtlasFrame>;
    imagePath?: string;
};

type StatusIconAtlasResponse = {
    meta: { image: string; size: { w: number; h: number } };
    frames: Record<string, { frame: StatusIconAtlasFrame }>;
};

const isStatusIconAtlasResponse = (value: unknown): value is StatusIconAtlasResponse => {
    if (!value || typeof value !== 'object') return false;
    const data = value as StatusIconAtlasResponse;
    const size = data.meta?.size;
    const frames = data.frames;
    if (!size || typeof size.w !== 'number' || typeof size.h !== 'number') return false;
    if (!frames || typeof frames !== 'object') return false;
    return Object.values(frames).every((entry) => {
        const frame = entry?.frame;
        return Boolean(frame)
            && typeof frame.x === 'number'
            && typeof frame.y === 'number'
            && typeof frame.w === 'number'
            && typeof frame.h === 'number';
    });
};

// Map of Atlas ID -> Config
export type StatusAtlases = Record<string, StatusIconAtlasConfig>;

export const loadStatusAtlases = async (locale?: string): Promise<StatusAtlases> => {
    const promises = Object.entries(STATUS_ATLAS_PATHS).map(async ([id, path]) => {
        try {
            const url = getLocalizedAssetPath(path, locale);
            const response = await fetch(url);
            if (!response.ok) return null;
            const data: unknown = await response.json();
            if (!isStatusIconAtlasResponse(data)) return null;

            // 图片路径也需要经过 getLocalizedAssetPath 处理（去掉 .json 后缀，加上图片文件名）
            const baseDir = path.substring(0, path.lastIndexOf('/') + 1);
            const imagePath = `${baseDir}${data.meta.image.replace('.png', '')}`;  // 去掉扩展名，让 buildLocalizedImageSet 处理

            const frames = Object.fromEntries(
                Object.entries(data.frames).map(([key, entry]) => [key, entry.frame])
            );
            // 临时调试：打印 paladin atlas 帧数据
            if (id.includes('paladin')) {
                console.log('[ATLAS DEBUG] paladin frames:', JSON.stringify(frames, null, 2));
                console.log('[ATLAS DEBUG] fetch URL:', url);
            }
            return { id, config: { imageW: data.meta.size.w, imageH: data.meta.size.h, frames, imagePath } };
        } catch (e) {
            console.warn(`Failed to load status atlas: ${id}`, e);
            return null;
        }
    });

    const results = await Promise.all(promises);
    return results.reduce((acc, curr) => {
        if (curr) acc[curr.id] = curr.config;
        return acc;
    }, {} as StatusAtlases);
};

import { STATUS_EFFECT_META, TOKEN_META, type StatusEffectMeta } from '../domain/statusEffects';

// Re-export for consumers that import from ui/statusEffects
export { STATUS_EFFECT_META, TOKEN_META, type StatusEffectMeta };

const getStatusIconFrameStyle = (atlas: StatusIconAtlasConfig, frame: StatusIconAtlasFrame, debugFrameId?: string) => {
    const xPos = atlas.imageW === frame.w ? 0 : (frame.x / (atlas.imageW - frame.w)) * 100;
    const yPos = atlas.imageH === frame.h ? 0 : (frame.y / (atlas.imageH - frame.h)) * 100;
    const bgSizeX = (atlas.imageW / frame.w) * 100;
    const bgSizeY = (atlas.imageH / frame.h) * 100;
    // 临时调试
    if (debugFrameId === 'holy-strike') {
        console.log(`[ATLAS DEBUG] holy-strike render: frame=${JSON.stringify(frame)}, xPos=${xPos}%, bgSize=${bgSizeX}%`);
    }
    return {
        backgroundSize: `${bgSizeX}% ${bgSizeY}%`,
        backgroundPosition: `${xPos}% ${yPos}%`,
    } as CSSProperties;
};

export const getStatusEffectIconNode = (
    meta: StatusEffectMeta,
    locale: string | undefined,
    size: 'tiny' | 'small' | 'normal' | 'fly' | 'choice',
    atlas?: StatusAtlases | null
) => {
    let frame: StatusIconAtlasFrame | undefined;
    let targetAtlas: StatusIconAtlasConfig | undefined;

    if (meta.atlasId && atlas?.[meta.atlasId]) {
        targetAtlas = atlas[meta.atlasId];
        frame = meta.frameId ? targetAtlas.frames[meta.frameId] : undefined;
    } else if (atlas && meta.frameId) {
        // Fallback: Search in all atlases
        for (const config of Object.values(atlas)) {
            if (config.frames[meta.frameId]) {
                targetAtlas = config;
                frame = config.frames[meta.frameId];
                // For debug:
                // console.log(`Found ${meta.frameId} in ${id}`);
                break;
            }
        }
    }

    if (!frame || !targetAtlas) {
        // 无精灵图时不显示内容，外层渐变背景已提供视觉标识
        return <span className="block w-full h-full" />;
    }
    const sizeClass = size === 'choice' ? 'w-full h-full' : 'w-full h-full';
    const frameStyle = getStatusIconFrameStyle(targetAtlas, frame, meta.frameId);

    return (
        <span
            className={`block ${sizeClass} drop-shadow-md`}
            style={{
                backgroundImage: targetAtlas.imagePath
                    ? buildLocalizedImageSet(targetAtlas.imagePath, locale)
                    : undefined,
                backgroundSize: frameStyle.backgroundSize,
                backgroundPosition: frameStyle.backgroundPosition,
                backgroundRepeat: 'no-repeat',
            }}
        />
    );
};

export const StatusEffectBadge = ({
    effectId,
    stacks,
    size = 'normal',
    locale,
    atlas,
    onClick,
    clickable = false,
}: {
    effectId: string;
    stacks: number;
    size?: 'normal' | 'small' | 'tiny';
    locale?: string;
    atlas?: StatusAtlases | null;
    onClick?: () => void;
    clickable?: boolean;
}) => {
    const { t } = useTranslation('game-dicethrone');
    const meta = STATUS_EFFECT_META[effectId] || { color: 'from-gray-500 to-gray-600' };

    // Check if sprite exists in the resolved atlas
    let hasSprite = false;
    if (atlas && meta.frameId) {
        if (meta.atlasId && atlas[meta.atlasId]) {
            hasSprite = Boolean(atlas[meta.atlasId].frames[meta.frameId]);
        } else {
            // Fallback check
            hasSprite = Object.values(atlas).some(config => Boolean(config.frames[meta.frameId!]));
        }
    }
    const description = resolveI18nList(
        t(`statusEffects.${effectId}.description`, { returnObjects: true })
    );
    const info = {
        ...meta,
        name: t(`statusEffects.${effectId}.name`) as string,
        description,
    };
    const [isHovered, setIsHovered] = React.useState(false);
    const sizeClass = size === 'tiny' ? 'w-[1.5vw] h-[1.5vw] text-[0.6vw]' : size === 'small' ? 'w-[2vw] h-[2vw] text-[0.8vw]' : 'w-[2.5vw] h-[2.5vw] text-[1vw]';
    const stackSizeClass = size === 'tiny' ? 'text-[0.4vw] min-w-[0.6vw] h-[0.6vw]' : size === 'small' ? 'text-[0.5vw] min-w-[0.8vw] h-[0.8vw]' : 'text-[0.6vw] min-w-[1vw] h-[1vw]';

    const isClickable = clickable && onClick;

    return (
        <div
            className={`relative group ${isClickable ? 'cursor-pointer' : ''}`}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            onClick={isClickable ? onClick : undefined}
        >
            <div
                className={`
                    ${sizeClass} rounded-full flex items-center justify-center overflow-hidden
                    ${hasSprite
                        ? 'bg-transparent border-0 shadow-none'
                        : `bg-gradient-to-br ${info.color ?? 'from-gray-500 to-gray-600'} shadow-lg border border-white/30`}
                    transition-transform duration-200 hover:scale-110 ${isClickable ? 'cursor-pointer' : 'cursor-help'}
                    ${isClickable ? 'ring-2 ring-amber-400/50 hover:ring-amber-400 animate-pulse' : ''}
                `}
            >
                {getStatusEffectIconNode(info, locale, size, atlas)}
            </div>
            {stacks > 1 && (
                <div className={`absolute -bottom-[0.2vw] -right-[0.2vw] ${stackSizeClass} bg-black/80 text-white font-bold rounded-full flex items-center justify-center border border-white/50`}>
                    {stacks}
                </div>
            )}

            <InfoTooltip
                title={`${info.name}${stacks > 1 ? ` ×${stacks}` : ''}`}
                content={isClickable ? [...info.description, t(`statusEffects.${STATUS_IDS.KNOCKDOWN}.clickToRemove`)] : info.description}
                isVisible={isHovered}
                position="right"
            />
        </div>
    );
};

const getContainerStyle = (maxPerRow: number, size: 'normal' | 'small' | 'tiny') => {
    const itemWidth = size === 'tiny' ? 1.5 : size === 'small' ? 2 : 2.5;
    const gap = 0.3;
    const maxWidth = maxPerRow * itemWidth + (maxPerRow - 1) * gap;
    return { maxWidth: `${maxWidth}vw` };
};

export const StatusEffectsContainer = ({
    effects,
    maxPerRow = 3,
    size = 'normal',
    className = '',
    locale,
    atlas,
    onEffectClick,
    clickableEffects,
}: {
    effects: Record<string, number>;
    maxPerRow?: number;
    size?: 'normal' | 'small' | 'tiny';
    className?: string;
    locale?: string;
    atlas?: StatusAtlases | null;
    /** 点击状态效果的回调 */
    onEffectClick?: (effectId: string) => void;
    /** 可点击的状态效果 ID 列表 */
    clickableEffects?: string[];
}) => {
    const activeEffects = Object.entries(effects).filter(([, stacks]) => stacks > 0);
    if (activeEffects.length === 0) return null;

    return (
        <div
            className={`flex flex-wrap gap-[0.3vw] ${className}`}
            style={getContainerStyle(maxPerRow, size)}
        >
            {activeEffects.map(([effectId, stacks]) => {
                const isClickable = clickableEffects?.includes(effectId) ?? false;
                return (
                    <StatusEffectBadge
                        key={effectId}
                        effectId={effectId}
                        stacks={stacks}
                        size={size}
                        locale={locale}
                        atlas={atlas}
                        onClick={isClickable ? () => onEffectClick?.(effectId) : undefined}
                        clickable={isClickable}
                    />
                );
            })}
        </div>
    );
};

/** Token 徽章组件 */
export const TokenBadge = ({
    tokenId,
    amount,
    maxAmount,
    size = 'normal',
    locale,
    atlas,
    onClick,
    clickable = false,
}: {
    tokenId: string;
    amount: number;
    /** 堆叠上限（>1 时显示 数量/上限） */
    maxAmount?: number;
    size?: 'normal' | 'small' | 'tiny';
    locale?: string;
    atlas?: StatusAtlases | null;
    onClick?: () => void;
    clickable?: boolean;
}) => {
    const { t } = useTranslation('game-dicethrone');
    const meta = TOKEN_META[tokenId] || { color: 'from-gray-500 to-gray-600' };

    let hasSprite = false;
    if (atlas && meta.frameId) {
        if (meta.atlasId && atlas[meta.atlasId]) {
            hasSprite = Boolean(atlas[meta.atlasId].frames[meta.frameId]);
        } else {
            hasSprite = Object.values(atlas).some(config => Boolean(config.frames[meta.frameId!]));
        }
    }
    const description = resolveI18nList(
        t(`tokens.${tokenId}.description`, { returnObjects: true })
    );
    const info = {
        ...meta,
        name: t(`tokens.${tokenId}.name`) as string,
        description,
    };
    const [isHovered, setIsHovered] = React.useState(false);
    const sizeClass = size === 'tiny' ? 'w-[1.5vw] h-[1.5vw] text-[0.6vw]' : size === 'small' ? 'w-[2vw] h-[2vw] text-[0.8vw]' : 'w-[2.5vw] h-[2.5vw] text-[1vw]';
    const stackSizeClass = size === 'tiny' ? 'text-[0.4vw] min-w-[0.6vw] h-[0.6vw]' : size === 'small' ? 'text-[0.5vw] min-w-[0.8vw] h-[0.8vw]' : 'text-[0.6vw] min-w-[1vw] h-[1vw]';

    const isClickable = clickable && onClick;

    return (
        <div
            className={`relative group ${isClickable ? 'cursor-pointer' : ''}`}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            onClick={isClickable ? onClick : undefined}
        >
            <div
                className={`
                    ${sizeClass} rounded-full flex items-center justify-center overflow-hidden
                    ${hasSprite
                        ? 'bg-transparent border-0 shadow-none'
                        : `bg-gradient-to-br ${info.color ?? 'from-gray-500 to-gray-600'} shadow-lg border border-white/30`}
                    transition-transform duration-200 hover:scale-110 ${isClickable ? 'cursor-pointer' : 'cursor-help'}
                    ${isClickable ? 'ring-2 ring-amber-400/50 hover:ring-amber-400 animate-pulse' : ''}
                `}
            >
                {getStatusEffectIconNode(info, locale, size, atlas)}
            </div>
            {/* 有上限(>1)时始终显示 数量/上限；否则仅 amount>1 时显示数量 */}
            {(maxAmount != null && maxAmount > 1) ? (
                <div className={`absolute -bottom-[0.2vw] -right-[0.2vw] ${stackSizeClass} bg-black/80 text-white font-bold rounded-full flex items-center justify-center border border-white/50 px-[0.15vw]`}>
                    {amount}/{maxAmount}
                </div>
            ) : amount > 1 ? (
                <div className={`absolute -bottom-[0.2vw] -right-[0.2vw] ${stackSizeClass} bg-black/80 text-white font-bold rounded-full flex items-center justify-center border border-white/50`}>
                    {amount}
                </div>
            ) : null}

            <InfoTooltip
                title={`${info.name}${maxAmount != null && maxAmount > 1 ? ` ${amount}/${maxAmount}` : amount > 1 ? ` ×${amount}` : ''}`}
                content={info.description}
                isVisible={isHovered}
                position="right"
            />
        </div>
    );
};

/** Token 容器组件 */
export const TokensContainer = ({
    tokens,
    maxPerRow = 3,
    size = 'normal',
    className = '',
    locale,
    atlas,
    onTokenClick,
    clickableTokens,
    tokenDefinitions,
    tokenStackLimits,
}: {
    tokens: Record<string, number>;
    maxPerRow?: number;
    size?: 'normal' | 'small' | 'tiny';
    className?: string;
    locale?: string;
    atlas?: StatusAtlases | null;
    /** 点击 Token 的回调 */
    onTokenClick?: (tokenId: string) => void;
    /** 可点击的 Token ID 列表 */
    clickableTokens?: string[];
    /** Token 定义列表（用于获取 stackLimit） */
    tokenDefinitions?: TokenDef[];
    /** 玩家级别的堆叠上限覆盖（技能可永久提高上限） */
    tokenStackLimits?: Record<string, number>;
}) => {
    const activeTokens = Object.entries(tokens).filter(([, amount]) => amount > 0);
    if (activeTokens.length === 0) return null;

    /** 获取某个 token 的有效上限（玩家覆盖 > 定义 > 不显示） */
    const getEffectiveMax = (tokenId: string): number | undefined => {
        // 玩家级别覆盖优先
        const override = tokenStackLimits?.[tokenId];
        if (typeof override === 'number') {
            return override === 0 ? undefined : override; // 0 = 无限，不显示上限
        }
        const def = tokenDefinitions?.find(d => d.id === tokenId);
        const base = def?.stackLimit;
        if (base == null || base <= 1 || base === 0) return undefined; // 无限或上限1，不显示
        return base;
    };

    return (
        <div
            className={`flex flex-wrap gap-[0.3vw] ${className}`}
            style={getContainerStyle(maxPerRow, size)}
        >
            {activeTokens.map(([tokenId, amount]) => {
                const isClickable = clickableTokens?.includes(tokenId) ?? false;
                return (
                    <TokenBadge
                        key={tokenId}
                        tokenId={tokenId}
                        amount={amount}
                        maxAmount={getEffectiveMax(tokenId)}
                        size={size}
                        locale={locale}
                        atlas={atlas}
                        onClick={isClickable ? () => onTokenClick?.(tokenId) : undefined}
                        clickable={isClickable}
                    />
                );
            })}
        </div>
    );
};

// ============================================================================
// 可选择的状态效果组件（用于卡牌交互）
// ============================================================================

/** 可选择的状态效果徽章 */
export const SelectableStatusBadge = ({
    effectId,
    stacks,
    isSelected,
    isHighlighted,
    onSelect,
    size = 'normal',
    locale,
    atlas,
}: {
    effectId: string;
    stacks: number;
    isSelected?: boolean;
    isHighlighted?: boolean;
    onSelect?: () => void;
    size?: 'normal' | 'small';
    locale?: string;
    atlas?: StatusAtlases | null;
}) => {
    const { t } = useTranslation('game-dicethrone');
    const meta = STATUS_EFFECT_META[effectId] || TOKEN_META[effectId] || { color: 'from-gray-500 to-gray-600' };

    let hasSprite = false;
    if (atlas && meta.frameId) {
        if (meta.atlasId && atlas[meta.atlasId]) {
            hasSprite = Boolean(atlas[meta.atlasId].frames[meta.frameId]);
        } else {
            hasSprite = Object.values(atlas).some(config => Boolean(config.frames[meta.frameId!]));
        }
    }
    const description = resolveI18nList(
        t(`statusEffects.${effectId}.description`, { returnObjects: true })
    );
    const info = {
        ...meta,
        name: t(`statusEffects.${effectId}.name`) as string,
        description,
    };
    const [isHovered, setIsHovered] = React.useState(false);
    const sizeClass = size === 'small' ? 'w-[2vw] h-[2vw] text-[0.8vw]' : 'w-[2.5vw] h-[2.5vw] text-[1vw]';
    const stackSizeClass = size === 'small' ? 'text-[0.5vw] min-w-[0.8vw] h-[0.8vw]' : 'text-[0.6vw] min-w-[1vw] h-[1vw]';

    const clickable = Boolean(onSelect);

    return (
        <div
            className={`relative group ${clickable ? 'cursor-pointer' : ''
                }`}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            onClick={() => clickable && onSelect?.()}
        >
            <div
                className={`
                    ${sizeClass} rounded-full flex items-center justify-center overflow-hidden
                    ${hasSprite
                        ? 'bg-transparent border-0 shadow-none'
                        : `bg-gradient-to-br ${info.color ?? 'from-gray-500 to-gray-600'} shadow-lg border border-white/30`}
                    transition-all duration-200
                    ${clickable ? 'hover:scale-110' : ''}
                    ${isHighlighted ? 'ring-2 ring-amber-400 ring-offset-1 ring-offset-slate-900' : ''}
                    ${isSelected ? 'ring-2 ring-green-400 ring-offset-1 ring-offset-slate-900 scale-110' : ''}
                `}
            >
                {getStatusEffectIconNode(info, locale, size === 'small' ? 'small' : 'normal', atlas)}
            </div>
            {stacks > 1 && (
                <div className={`absolute -bottom-[0.2vw] -right-[0.2vw] ${stackSizeClass} bg-black/80 text-white font-bold rounded-full flex items-center justify-center border border-white/50`}>
                    {stacks}
                </div>
            )}
            {isSelected && (
                <div className="absolute -top-[0.3vw] -right-[0.3vw] w-[1vw] h-[1vw] bg-green-500 rounded-full flex items-center justify-center z-30">
                    <Check size={12} className="text-white" strokeWidth={3} />
                </div>
            )}
            <InfoTooltip
                title={`${info.name}${stacks > 1 ? ` ×${stacks}` : ''}`}
                content={info.description}
                isVisible={isHovered}
                position="right"
            />
        </div>
    );
};

/** 可选择的状态效果容器 */
export const SelectableEffectsContainer = ({
    effects,
    tokens,
    selectedId,
    highlightAll,
    onSelectEffect,
    maxPerRow = 3,
    size = 'normal',
    className = '',
    locale,
    atlas,
}: {
    effects: Record<string, number>;
    tokens?: Record<string, number>;
    selectedId?: string;
    highlightAll?: boolean;
    onSelectEffect?: (effectId: string) => void;
    maxPerRow?: number;
    size?: 'normal' | 'small';
    className?: string;
    locale?: string;
    atlas?: StatusAtlases | null;
}) => {
    const activeEffects = Object.entries(effects).filter(([, stacks]) => stacks > 0);
    const activeTokens = tokens ? Object.entries(tokens).filter(([, amount]) => amount > 0) : [];
    const allItems = [...activeEffects, ...activeTokens];

    if (allItems.length === 0) return null;

    return (
        <div className={`flex flex-wrap gap-[0.3vw] ${className}`} style={{ maxWidth: `${maxPerRow * 3}vw` }}>
            {allItems.map(([id, stacks]) => (
                <SelectableStatusBadge
                    key={id}
                    effectId={id}
                    stacks={stacks}
                    isSelected={selectedId === id}
                    isHighlighted={highlightAll}
                    onSelect={() => onSelectEffect?.(id)}
                    size={size}
                    locale={locale}
                    atlas={atlas}
                />
            ))}
        </div>
    );
};
