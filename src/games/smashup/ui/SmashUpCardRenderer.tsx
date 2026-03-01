import React, { useMemo } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { CardPreview } from '../../../components/common/media/CardPreview';
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
    // 渲染器必须拿到具体的 defId 才能读取中文字典和做图集覆写
    // 由于只有 renderer 类型的 previewRef 能任意传参，我们假设这里的 payload 透传了 defId
    if (previewRef.type !== 'renderer') return null;

    const defId = previewRef.payload?.defId as string | undefined;
    if (!defId) return null;

    const { t, i18n } = useTranslation('game-smashup');
    const effectiveLocale = locale || i18n.language || 'zh-CN';

    // 默认回退为原始数据的图集坐标，如果没有配置过的话
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const { originalAtlasId, originalIndex } = useMemo(() => {
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

    const isEnglishVariant = effectiveLocale === 'en' || effectiveLocale === 'en-US';
    // 基础牌默认使用高清英文图集（由于缺少低清中文资源），POD 版本也全都是高清英文图集
    const isBase = !!getBaseDef(defId);
    const isPodVersion = defId.endsWith('_pod') || (isBase && getBaseDef(defId)?.faction?.endsWith('_pod'));

    // 只有在英文模式下，或者该卡牌是 POD 专属卡牌，或者本身是基地（Bases 资源只有高分英版），才去查 TTS 高清英文图集。
    // 否则在中文模式下，保留原版 originalAtlasId（会读取 cards1 等带有内嵌中文的低清图）
    // 特殊情况：如果 originalAtlasId 为空，同样回退使用英文图集
    if (isEnglishVariant || isPodVersion || isBase || !originalAtlasId) {
        const mapped = TTS_MAP[defId];
        if (mapped) {
            finalAtlasId = mapped.atlasId;
            finalIndex = mapped.index;
        }
    }

    // 强制获取中文翻译用于覆盖层显示
    const { name, text } = useMemo(() => {
        const zhT = (key: string) => t(key, { lng: 'zh-CN' });
        const cDef = getCardDef(defId);
        if (cDef) return { name: resolveCardName(cDef, zhT), text: resolveCardText(cDef, zhT) };
        const bDef = getBaseDef(defId);
        if (bDef) return { name: resolveCardName(bDef, zhT), text: resolveCardText(bDef, zhT) };
        return { name: '', text: '' };
    }, [defId, t]);

    // `isBase` 定义已经被提取到了更上面，在此删除冗余声明

    // 如果未配置任何图集，只渲染外框和名字
    if (!finalAtlasId) {
        return (
            <div className={`relative bg-[#f3f0e8] flex flex-col items-center justify-center p-2 border-2 border-slate-300 rounded overflow-hidden ${className || ''}`} style={style}>
                <div className="text-[1vw] font-black uppercase text-slate-800 mb-1">{name}</div>
                <div className="text-[0.6vw] text-slate-600 text-center font-mono leading-tight">{text}</div>
            </div>
        );
    }

    // 英文环境下：如果玩家关闭了中文覆盖层，或者中文环境下：图像已经自带中文（非POD卡），则不需要叠加文字
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const { overlayEnabled } = useSmashUpOverlay();

    // 中文模式下，原版卡片图集（特指随从和行动）自带中文字型，所以跳过覆盖层。
    // 但 POD 版是纯英文图集，所以需要覆盖层。对于基地（Base）来说，由于我们使用了 TTS 的高清英版图集（即使是中文模式下），所以基地也强制需要覆盖层。
    const imageHasChineseText = !isEnglishVariant && !isPodVersion && !isBase;
    const userWantsToSkipOverlay = isEnglishVariant && !overlayEnabled;

    if (imageHasChineseText || userWantsToSkipOverlay) {
        return (
            <CardPreview
                previewRef={{ type: 'atlas', atlasId: finalAtlasId, index: finalIndex }}
                locale="en"
                className={className}
                style={style}
                title={name}
            />
        );
    }

    // 英文环境下或无内嵌中文的卡片（如所有基地、POD 卡）：画上卡图 + Overlay 中文文本

    // 由于图集是通过 background-image 渲染在 div 上的
    // 我们在此用绝对定位画一个标题和技能文字区域的 Overlay
    // 在真正完善前可以通过粗糙一些的底色方块，确保能看清楚中文
    return (
        <div className={`relative group ${className || ''}`} style={style} title={name}>
            {/* 底层原版图集 —— 明确传 locale='en' 使 AssetLoader 去找本地压缩图 */}
            <CardPreview
                previewRef={{ type: 'atlas', atlasId: finalAtlasId, index: finalIndex }}
                locale="en"
                className="w-full h-full absolute inset-0 rounded overflow-hidden pointer-events-none"
            />
            {/* 顶层中文叠加 —— 默认隐藏，悬浮时淡入 */}
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
        </div>
    );
}
