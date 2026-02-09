import type { CSSProperties } from 'react';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { buildLocalizedImageSet, getLocalizedAssetPath } from '../../../core';
import { InfoTooltip } from '../../../components/common/overlays/InfoTooltip';
import { resolveI18nList } from './utils';

import { STATUS_IDS, DICETHRONE_STATUS_ATLAS_IDS } from '../domain/ids';



// Hardcoded paths for now, could be dynamic or from ASSETS
const STATUS_ATLAS_PATHS: Record<string, string> = {
    [DICETHRONE_STATUS_ATLAS_IDS.MONK]: 'dicethrone/images/monk/status-icons-atlas.json',
    [DICETHRONE_STATUS_ATLAS_IDS.BARBARIAN]: 'dicethrone/images/barbarian/status-icons-atlas.json',
    [DICETHRONE_STATUS_ATLAS_IDS.PYROMANCER]: 'dicethrone/images/pyromancer/status-icons-atlas.json',
};

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

export const loadStatusAtlases = async (): Promise<StatusAtlases> => {
    const promises = Object.entries(STATUS_ATLAS_PATHS).map(async ([id, path]) => {
        try {
            const url = getLocalizedAssetPath(path);
            const response = await fetch(url);
            if (!response.ok) return null;
            const data: unknown = await response.json();
            if (!isStatusIconAtlasResponse(data)) return null;

            const baseDir = path.substring(0, path.lastIndexOf('/') + 1);
            const imagePath = `${baseDir}${data.meta.image}`;

            const frames = Object.fromEntries(
                Object.entries(data.frames).map(([key, entry]) => [key, entry.frame])
            );
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

const getStatusIconFrameStyle = (atlas: StatusIconAtlasConfig, frame: StatusIconAtlasFrame) => {
    const xPos = atlas.imageW === frame.w ? 0 : (frame.x / (atlas.imageW - frame.w)) * 100;
    const yPos = atlas.imageH === frame.h ? 0 : (frame.y / (atlas.imageH - frame.h)) * 100;
    const bgSizeX = (atlas.imageW / frame.w) * 100;
    const bgSizeY = (atlas.imageH / frame.h) * 100;
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
        return <span className="drop-shadow-md">{meta.icon ?? '❓'}</span>;
    }
    const sizeClass = size === 'choice' ? 'w-full h-full' : 'w-full h-full';
    const frameStyle = getStatusIconFrameStyle(targetAtlas, frame);

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
    const meta = STATUS_EFFECT_META[effectId] || { icon: '❓', color: 'from-gray-500 to-gray-600' };

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
    size = 'normal',
    locale,
    atlas,
    onClick,
    clickable = false,
}: {
    tokenId: string;
    amount: number;
    size?: 'normal' | 'small' | 'tiny';
    locale?: string;
    atlas?: StatusAtlases | null;
    onClick?: () => void;
    clickable?: boolean;
}) => {
    const { t } = useTranslation('game-dicethrone');
    const meta = TOKEN_META[tokenId] || { icon: '❓', color: 'from-gray-500 to-gray-600' };

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
            {amount > 1 && (
                <div className={`absolute -bottom-[0.2vw] -right-[0.2vw] ${stackSizeClass} bg-black/80 text-white font-bold rounded-full flex items-center justify-center border border-white/50`}>
                    {amount}
                </div>
            )}

            <InfoTooltip
                title={`${info.name}${amount > 1 ? ` ×${amount}` : ''}`}
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
}) => {
    const activeTokens = Object.entries(tokens).filter(([, amount]) => amount > 0);
    if (activeTokens.length === 0) return null;

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
    const meta = STATUS_EFFECT_META[effectId] || TOKEN_META[effectId] || { icon: '❓', color: 'from-gray-500 to-gray-600' };

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
                    <span className="text-[0.6vw] text-white font-bold">✓</span>
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
