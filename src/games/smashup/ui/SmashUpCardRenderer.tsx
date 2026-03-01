import React, { useMemo } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { CardPreview, registerCardPreviewRenderer } from '../../../components/common/media/CardPreview';
import type { CardPreviewRef } from '../../../core';
import smashUpEnglishMap from '../data/englishAtlasMap.json';
import { getCardDef, getBaseDef, resolveCardName, resolveCardText } from '../data/cards';
import { useSmashUpOverlay } from './SmashUpOverlayContext';

type EnglishMapConfig = { atlasId: string; index: number };

const TTS_MAP = smashUpEnglishMap as Record<string, EnglishMapConfig>;

interface SmashUpRendererArgs {
    previewRef: CardPreviewRef;
    locale?: string;
    className?: string;
    style?: CSSProperties;
}

export function SmashUpCardRenderer({ previewRef, locale, className, style }: SmashUpRendererArgs): ReactNode {
    // Hooks 必须在所有 early return 之前调用
    const { t, i18n } = useTranslation('game-smashup');
    const { overlayEnabled } = useSmashUpOverlay();
    
    const effectiveLocale = locale || i18n.language || 'zh-CN';
    
    // 渲染器必须拿到具体的 defId 才能读取中文字典和做图集覆写
    // 由于只有 renderer 类型的 previewRef 能任意传参，我们假设这里的 payload 透传了 defId
    const defId = previewRef.type === 'renderer' ? (previewRef.payload?.defId as string | undefined) : undefined;

    // 默认回退为原始数据的图集坐标，如果没有配置过的话
    const { originalAtlasId, originalIndex } = useMemo(() => {
        if (!defId) return { originalAtlasId: '', originalIndex: 0 };
        const cardDef = getCardDef(defId);
        if (cardDef?.previewRef?.type === 'atlas') {
            return { originalAtlasId: cardDef.previewRef.atlasId, originalIndex: cardDef.previewRef.index };
        }
        const baseDef = getBaseDef(defId);
        if (baseDef?.previewRef?.type === 'atlas') {
            return { originalAtlasId: baseDef.previewRef.atlasId, originalIndex: baseDef.previewRef.index };
        }
        return { originalAtlasId: '', originalIndex: 0 };
    }, [defId]);

    let finalAtlasId = originalAtlasId;
    let finalIndex = originalIndex;

    // 基础牌默认使用高清英文图集（由于缺少低清中文资源），POD 版本也全都是高清英文图集
    const isBase = !!getBaseDef(defId);
    const isPodVersion = defId.endsWith('_pod') || (isBase && getBaseDef(defId)?.faction?.endsWith('_pod'));

    // 只有在英文模式下，或者该卡牌是 POD 专属卡牌，或者本身是基地（Bases 资源只有高分英版），才去查 TTS 高清英文图集。
    // 否则在中文模式下，保留原版 originalAtlasId（会读取 cards1 等带有内嵌中文的低清图）
    // 特殊情况：如果 originalAtlasId 为空，同样回退使用英文图集
    const isEnglishVariant = effectiveLocale === 'en' || effectiveLocale === 'en-US';
    if (isEnglishVariant || isPodVersion || isBase || !originalAtlasId) {
        const mapped = TTS_MAP[defId];
        if (mapped) {
            finalAtlasId = mapped.atlasId;
            finalIndex = mapped.index;
        }
    }

    // 获取当前语言的翻译用于覆盖层显示
    const { name, text } = useMemo(() => {
        if (!defId) return { name: '', text: '' };
        const cDef = getCardDef(defId);
        if (cDef) return { name: resolveCardName(cDef, t), text: resolveCardText(cDef, t) };
        const bDef = getBaseDef(defId);
        if (bDef) return { name: resolveCardName(bDef, t), text: resolveCardText(bDef, t) };
        return { name: '', text: '' };
    }, [defId, t]);
    
    // Early returns after all hooks
    if (previewRef.type !== 'renderer' || !defId) {
        return null;
    }

    // 如果未配置任何图集，只渲染外框和名字
    if (!finalAtlasId) {
        return (
            <div className={`relative bg-[#f3f0e8] flex flex-col items-center justify-center p-2 border-2 border-slate-300 rounded overflow-hidden ${className || ''}`} style={style}>
                <div className="text-[1vw] font-black uppercase text-slate-800 mb-1">{name}</div>
                <div className="text-[0.6vw] text-slate-600 text-center font-mono leading-tight">{text}</div>
            </div>
        );
    }

    // 硬编码逻辑：POD/base 卡牌只有英文资源，中文 UI 时需要显示覆盖层
    const needsOverlay = (isPodVersion || isBase) && !isEnglishVariant;
    // 用户在英文环境下可以关闭覆盖层
    const shouldShowOverlay = needsOverlay && overlayEnabled;
    
    // POD/base 卡牌强制使用英文图片，普通卡牌使用 UI 语言
    const imageLocale = (isPodVersion || isBase) ? 'en' : effectiveLocale;

    // 直接返回完整的卡牌（图片 + 覆盖层）
    return (
        <div className={`relative group ${className || ''}`} style={style} title={name}>
            <CardPreview
                previewRef={{ type: 'atlas', atlasId: finalAtlasId, index: finalIndex }}
                locale={imageLocale}
                className="w-full h-full"
            />
            {/* 覆盖层：仅在需要时显示 */}
            {shouldShowOverlay && (
                <div className="absolute inset-0 z-10 pointer-events-none flex flex-col justify-between p-[4%] opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-black/20">
                    {/* 标题 */}
                    <div className={`w-fit max-w-full bg-black/80 backdrop-blur-sm text-white font-bold rounded px-2 shadow 
                        ${isBase ? 'text-[1vw] max-w-[50%]' : 'text-[1.2vw]'}`}
                    >
                        {name}
                    </div>
                    {/* 文本 —— 仅在有内容时渲染 */}
                    {!!text && (
                        <div className={`w-full bg-white/90 backdrop-blur-md text-slate-900 rounded shadow-md font-medium leading-tight
                            ${isBase ? 'text-[0.7vw] mb-[25%] p-2' : 'text-[0.8vw] mb-[5%] p-1.5'}`}
                        >
                            {text}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}


// 注册渲染器（模块加载时自动执行）
registerCardPreviewRenderer('smashup-card-renderer', SmashUpCardRenderer);
