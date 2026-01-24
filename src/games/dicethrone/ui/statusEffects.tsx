import type { CSSProperties } from 'react';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { buildLocalizedImageSet, getLocalizedAssetPath } from '../../../core';
import { InfoTooltip } from '../../../components/common/overlays/InfoTooltip';
import { resolveI18nList } from './utils';
import { ASSETS } from './assets';

const STATUS_ICON_ATLAS_JSON = 'dicethrone/images/monk/status-icons-atlas.json';

type StatusIconAtlasFrame = { x: number; y: number; w: number; h: number };
export type StatusIconAtlasConfig = {
    imageW: number;
    imageH: number;
    frames: Record<string, StatusIconAtlasFrame>;
};

type StatusIconAtlasResponse = {
    meta: { size: { w: number; h: number } };
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

export const loadStatusIconAtlasConfig = async (): Promise<StatusIconAtlasConfig> => {
    const url = getLocalizedAssetPath(STATUS_ICON_ATLAS_JSON);
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`状态图标图集加载失败: ${STATUS_ICON_ATLAS_JSON}`);
    }
    const data: unknown = await response.json();
    if (!isStatusIconAtlasResponse(data)) {
        throw new Error(`状态图标图集格式不正确: ${STATUS_ICON_ATLAS_JSON}`);
    }
    const frames = Object.fromEntries(
        Object.entries(data.frames).map(([key, entry]) => [key, entry.frame])
    );
    return { imageW: data.meta.size.w, imageH: data.meta.size.h, frames };
};

export type StatusEffectMeta = {
    color?: string;
    icon?: string;
    frameId?: string;
};

export const STATUS_EFFECT_META: Record<string, StatusEffectMeta> = {
    evasive: {
        frameId: 'dodge',
    },
    taiji: {
        frameId: 'tai-chi',
    },
    stun: {
        frameId: 'knockdown',
    },
    purify: {
        frameId: 'purify',
    },
    chi: {
        icon: '🔥',
        color: 'from-orange-500 to-red-500',
    },
};

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
    size: 'small' | 'normal' | 'fly' | 'choice',
    atlas?: StatusIconAtlasConfig | null
) => {
    const frame = meta.frameId ? atlas?.frames[meta.frameId] : undefined;
    if (!frame || !atlas) {
        return <span className="drop-shadow-md">{meta.icon ?? '❓'}</span>;
    }
    const sizeClass = size === 'choice' ? 'w-full h-full' : 'w-full h-full';
    const frameStyle = getStatusIconFrameStyle(atlas, frame);

    return (
        <span
            className={`block ${sizeClass} drop-shadow-md`}
            style={{
                backgroundImage: buildLocalizedImageSet(ASSETS.EFFECT_ICONS, locale),
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
}: {
    effectId: string;
    stacks: number;
    size?: 'normal' | 'small';
    locale?: string;
    atlas?: StatusIconAtlasConfig | null;
}) => {
    const { t } = useTranslation('game-dicethrone');
    const meta = STATUS_EFFECT_META[effectId] || { icon: '❓', color: 'from-gray-500 to-gray-600' };
    const hasSprite = Boolean(meta.frameId && atlas?.frames[meta.frameId]);
    const description = resolveI18nList(
        t(`statusEffects.${effectId}.description`, { returnObjects: true, defaultValue: [] })
    );
    const info = {
        ...meta,
        name: t(`statusEffects.${effectId}.name`, { defaultValue: effectId }) as string,
        description,
    };
    const [isHovered, setIsHovered] = React.useState(false);
    const sizeClass = size === 'small' ? 'w-[2vw] h-[2vw] text-[0.8vw]' : 'w-[2.5vw] h-[2.5vw] text-[1vw]';
    const stackSizeClass = size === 'small' ? 'text-[0.5vw] min-w-[0.8vw] h-[0.8vw]' : 'text-[0.6vw] min-w-[1vw] h-[1vw]';

    return (
        <div
            className="relative group"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            <div
                className={`
                    ${sizeClass} rounded-full flex items-center justify-center overflow-hidden
                    ${hasSprite
                        ? 'bg-transparent border-0 shadow-none'
                        : `bg-gradient-to-br ${info.color ?? 'from-gray-500 to-gray-600'} shadow-lg border border-white/30`}
                    transition-transform duration-200 hover:scale-110 cursor-help
                `}
            >
                {getStatusEffectIconNode(info, locale, size === 'small' ? 'small' : 'normal', atlas)}
            </div>
            {stacks > 1 && (
                <div className={`absolute -bottom-[0.2vw] -right-[0.2vw] ${stackSizeClass} bg-black/80 text-white font-bold rounded-full flex items-center justify-center border border-white/50`}>
                    {stacks}
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

export const StatusEffectsContainer = ({
    effects,
    maxPerRow = 3,
    size = 'normal',
    className = '',
    locale,
    atlas,
}: {
    effects: Record<string, number>;
    maxPerRow?: number;
    size?: 'normal' | 'small';
    className?: string;
    locale?: string;
    atlas?: StatusIconAtlasConfig | null;
}) => {
    const activeEffects = Object.entries(effects).filter(([, stacks]) => stacks > 0);
    if (activeEffects.length === 0) return null;

    return (
        <div className={`flex flex-wrap gap-[0.3vw] ${className}`} style={{ maxWidth: `${maxPerRow * 3}vw` }}>
            {activeEffects.map(([effectId, stacks]) => (
                <StatusEffectBadge
                    key={effectId}
                    effectId={effectId}
                    stacks={stacks}
                    size={size}
                    locale={locale}
                    atlas={atlas}
                />
            ))}
        </div>
    );
};
