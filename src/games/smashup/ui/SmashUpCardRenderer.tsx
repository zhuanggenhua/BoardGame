import React, { useEffect, useMemo, useReducer } from 'react';
import type { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { CardPreview, registerCardPreviewRenderer } from '../../../components/common/media/CardPreview';
import type { CardPreviewRef } from '../../../core';
import smashUpEnglishMap from '../data/englishAtlasMap.json';
import {
    getCardDef,
    getBaseDef,
    getBasePodVariantId,
    getTitanDef,
    isBasePodVariantSelected,
    resolveCardName,
    resolveCardText,
} from '../data/cards';
import { SMASHUP_ATLAS_IDS } from '../domain/ids';
import { useSmashUpOverlay } from './SmashUpOverlayContext';
import { ensureSmashUpAtlasRegistered } from './cardAtlas';

type EnglishMapConfig = { atlasId: string; index: number };

const TTS_MAP = smashUpEnglishMap as Record<string, EnglishMapConfig>;
interface SmashUpRendererArgs {
    previewRef: CardPreviewRef;
    locale?: string;
    className?: string;
    style?: CSSProperties;
    onClick?: () => void;
    onMouseEnter?: () => void;
    onMouseLeave?: () => void;
}

const HULUWAWA_TITAN_DEF_ID = 'huluwawa_little_king_kong';

function wrapSvgTextLines(text: string, maxCharsPerLine: number): string[] {
    const lines: string[] = [];
    for (const paragraph of text.split('\n')) {
        let currentLine = '';
        for (const char of [...paragraph]) {
            if (currentLine.length >= maxCharsPerLine) {
                lines.push(currentLine);
                currentLine = char;
            } else {
                currentLine += char;
            }
        }
        if (currentLine) {
            lines.push(currentLine);
        }
    }
    return lines;
}

function renderHuluwawaTitanFallback(
    name: string,
    text: string,
    className?: string,
    style?: CSSProperties,
) {
    const effectLines = wrapSvgTextLines(text, 18);
    const orbColors = ['#ef4444', '#f97316', '#facc15', '#22c55e', '#38bdf8', '#6366f1', '#a855f7'];
    const orbPositions = [
        { x: 182, y: 272 },
        { x: 278, y: 230 },
        { x: 382, y: 214 },
        { x: 488, y: 230 },
        { x: 562, y: 292 },
        { x: 528, y: 384 },
        { x: 218, y: 394 },
    ];

    return (
        <svg
            viewBox="0 0 714 1000"
            preserveAspectRatio="none"
            className={className}
            style={style}
            role="img"
            aria-label={name}
        >
            <defs>
                <linearGradient id="huluwawa-card-bg" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f6eed9" />
                    <stop offset="45%" stopColor="#efdfb1" />
                    <stop offset="100%" stopColor="#d9b26d" />
                </linearGradient>
                <linearGradient id="huluwawa-header-bg" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#166534" />
                    <stop offset="50%" stopColor="#1f8a43" />
                    <stop offset="100%" stopColor="#166534" />
                </linearGradient>
                <linearGradient id="huluwawa-art-bg" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#e7f9b9" />
                    <stop offset="34%" stopColor="#fde68a" />
                    <stop offset="100%" stopColor="#fdba74" />
                </linearGradient>
                <radialGradient id="huluwawa-art-glow" cx="50%" cy="30%" r="32%">
                    <stop offset="0%" stopColor="rgba(254,240,138,0.98)" />
                    <stop offset="100%" stopColor="rgba(254,240,138,0)" />
                </radialGradient>
                {orbColors.map((color, index) => (
                    <radialGradient key={color} id={`huluwawa-orb-${index}`} cx="35%" cy="35%" r="65%">
                        <stop offset="0%" stopColor="#fff7ed" />
                        <stop offset="35%" stopColor={color} />
                        <stop offset="100%" stopColor="#7c2d12" />
                    </radialGradient>
                ))}
            </defs>

            <rect x="0" y="0" width="714" height="1000" rx="28" fill="url(#huluwawa-card-bg)" />
            <rect x="12" y="12" width="690" height="976" rx="26" fill="none" stroke="#a96a16" strokeWidth="16" />
            <rect x="30" y="30" width="654" height="940" rx="20" fill="none" stroke="#f5deb3" strokeWidth="6" />

            <rect x="42" y="42" width="630" height="126" rx="18" fill="url(#huluwawa-header-bg)" />
            <text x="58" y="92" fill="#fef3c7" fontSize="32" fontWeight="700">Titan</text>
            <text x="54" y="146" fill="#fef3c7" fontSize="58" fontWeight="700">{name}</text>

            <rect x="502" y="56" width="152" height="60" rx="14" fill="#14532d" />
            <text x="524" y="95" fill="#ecfccb" fontSize="24" fontWeight="700">DIY Faction</text>

            <rect x="48" y="188" width="92" height="92" rx="18" fill="#1d4ed8" />
            <text x="75" y="257" fill="#e0f2fe" fontSize="66" fontWeight="700">4</text>

            <rect x="58" y="198" width="598" height="348" rx="24" fill="url(#huluwawa-art-bg)" />
            <circle cx="357" cy="304" r="176" fill="url(#huluwawa-art-glow)" />
            {orbPositions.map((orb, index) => (
                <g key={`${orb.x}-${orb.y}`}>
                    <circle cx={orb.x} cy={orb.y} r="36" fill={`url(#huluwawa-orb-${index})`} />
                    <circle cx={orb.x} cy={orb.y} r="38.5" fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth="5" />
                </g>
            ))}
            <text x="222" y="432" fill="rgba(14,78,35,0.92)" fontSize="180" fontWeight="700">葫</text>
            <text x="192" y="500" fill="rgba(255,255,255,0.92)" fontSize="44" fontWeight="700">七兄弟合体泰坦</text>

            <rect x="54" y="578" width="606" height="330" rx="22" fill="#0f172a" />
            <text x="82" y="626" fill="#fef3c7" fontSize="30" fontWeight="700">效果</text>
            <text x="82" y="670" fill="#f8fafc" fontSize="24" fontWeight="400">
                {effectLines.map((line, index) => (
                    <tspan key={`${line}-${index}`} x="82" dy={index === 0 ? 0 : 34}>
                        {line}
                    </tspan>
                ))}
            </text>
        </svg>
    );
}

export const SmashUpCardRenderer: React.FC<SmashUpRendererArgs> = ({
  previewRef,
  locale,
  className,
  style,
}) => {
    // Hooks 必须在所有 early return 之前调用
    const { t, i18n } = useTranslation('game-smashup');
    const { overlayEnabled, selectedFactions } = useSmashUpOverlay();
    
    const effectiveLocale = locale || i18n.language || 'zh-CN';
    
    // 渲染器必须拿到具体的 defId 才能读取中文字典和做图集覆写
    // 由于只有 renderer 类型的 previewRef 能任意传参，我们假设这里的 payload 透传了 defId
    const defId = previewRef.type === 'renderer' ? (previewRef.payload?.defId as string | undefined) : undefined;
    const cardUid = previewRef.type === 'renderer' ? (previewRef.payload?.cardUid as string | undefined) : undefined;
    const disableHoverOverlay = previewRef.type === 'renderer' ? (previewRef.payload?.disableHoverOverlay as boolean | undefined) ?? false : false;
    const forceShowOverlay = previewRef.type === 'renderer' ? (previewRef.payload?.forceShowOverlay as boolean | undefined) ?? false : false;
    const [, forceAtlasRefresh] = useReducer((n: number) => n + 1, 0);

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
        const titanDef = getTitanDef(defId);
        if (titanDef?.previewRef?.type === 'atlas') {
            return { originalAtlasId: titanDef.previewRef.atlasId, originalIndex: titanDef.previewRef.index };
        }
        return { originalAtlasId: '', originalIndex: 0 };
    }, [defId]);

    const isEnglishVariant = effectiveLocale === 'en' || effectiveLocale === 'en-US';
    const {
        finalAtlasId,
        finalIndex,
        baseDef,
        isBase,
        basePodVariantId,
        isPodVersion,
        shouldUseEnglishAtlas,
    } = useMemo(() => {
        const resolvedBaseDef = defId ? getBaseDef(defId) : undefined;
        const resolvedIsBase = !!resolvedBaseDef;
        const resolvedBasePodVariantId = resolvedBaseDef ? getBasePodVariantId(resolvedBaseDef, selectedFactions) : undefined;
        const resolvedIsSelectedPodBase = resolvedBaseDef ? isBasePodVariantSelected(resolvedBaseDef, selectedFactions) : false;
        const resolvedIsPodVersion = defId ? (defId.endsWith('_pod') || resolvedIsSelectedPodBase) : false;
        const resolvedShouldUseEnglishAtlas = resolvedIsBase && resolvedIsSelectedPodBase;

        let resolvedAtlasId = originalAtlasId;
        let resolvedIndex = originalIndex;

        // 只有在英文模式下，或者该卡牌是 POD 专属卡牌，或者基地卡被选中，才去查 TTS 高清英文图集。
        // 否则在中文模式下，保留原版 originalAtlasId（会读取 cards1 等带有内嵌中文的低清图）
        // 特殊情况：如果 originalAtlasId 为空，同样回退使用英文图集（兜底逻辑）
        if (isEnglishVariant || resolvedIsPodVersion || resolvedShouldUseEnglishAtlas || !originalAtlasId) {
            let lookupKey = defId || '';
            if (resolvedIsBase && resolvedIsPodVersion && resolvedBasePodVariantId) {
                lookupKey = resolvedBasePodVariantId;
            }

            if (lookupKey) {
                const mapped = TTS_MAP[lookupKey];
                if (mapped) {
                    resolvedAtlasId = mapped.atlasId;
                    resolvedIndex = mapped.index;
                }
            }
        }

        // Pixie POD：同一 defId 有两张不同卡图（tts_atlas_6 第二排第 4/5 张：index 8/9）
        // 当渲染器拿到了 cardUid（来自手牌/弃牌/展示等真实实例）时，按 uid 稳定分配两张图。
        if (defId === 'trickster_pixie_pod') {
            resolvedAtlasId = 'tts_atlas_6';
            if (cardUid) {
                const sum = cardUid.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
                resolvedIndex = 8 + (sum % 2); // 8 或 9
            } else {
                resolvedIndex = 8;
            }
        }

        return {
            finalAtlasId: resolvedAtlasId,
            finalIndex: resolvedIndex,
            baseDef: resolvedBaseDef,
            isBase: resolvedIsBase,
            basePodVariantId: resolvedBasePodVariantId,
            isSelectedPodBase: resolvedIsSelectedPodBase,
            isPodVersion: resolvedIsPodVersion,
            shouldUseEnglishAtlas: resolvedShouldUseEnglishAtlas,
        };
    }, [cardUid, defId, isEnglishVariant, originalAtlasId, originalIndex, selectedFactions]);

    useEffect(() => {
        if (!finalAtlasId) return;
        if (ensureSmashUpAtlasRegistered(finalAtlasId)) {
            forceAtlasRefresh();
        }
    }, [finalAtlasId, forceAtlasRefresh]);

    // 获取当前语言的翻译用于覆盖层显示
    const { name, text } = useMemo(() => {
        if (!defId) return { name: '', text: '' };
        const cDef = getCardDef(defId);
        if (cDef) return { name: resolveCardName(cDef, t), text: resolveCardText(cDef, t) };
        const bDef = baseDef ?? getBaseDef(defId);
        if (bDef) {
            const localizedBaseDef = basePodVariantId && basePodVariantId !== bDef.id
                ? { ...bDef, id: basePodVariantId }
                : bDef;
            return { name: resolveCardName(localizedBaseDef, t), text: resolveCardText(localizedBaseDef, t) };
        }
        return { name: '', text: '' };
    }, [baseDef, basePodVariantId, defId, t]);
    
    // Early returns after all hooks
    if (previewRef.type !== 'renderer' || !defId) {
        return null;
    }

    if (defId === HULUWAWA_TITAN_DEF_ID) {
        return renderHuluwawaTitanFallback(name, text, className, style);
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

    // 检查是否使用了 TTS 英文图集（图集 ID 以 tts_atlas_ 开头）
    const usesTtsAtlas = finalAtlasId.startsWith('tts_atlas_');

    // 悬浮窗显示逻辑：只有使用了英文图集的卡牌才需要悬浮窗
    // 1. POD 派系卡牌 → 需要悬浮窗（图片是英文的）
    // 2. 基地卡且玩家选择了 POD 版派系 → 需要悬浮窗（图片是英文的）
    // 3. 使用了 TTS 英文图集 → 需要悬浮窗（图片是英文的）
    // 4. 基础派系的基地卡 → 不需要悬浮窗（图片本身包含中文）
    const needsOverlay = (isPodVersion || shouldUseEnglishAtlas || usesTtsAtlas) && !isEnglishVariant;
    // 用户在英文环境下可以关闭覆盖层
    const shouldShowOverlay = needsOverlay && overlayEnabled;
    const overlayVisibilityClass = forceShowOverlay
        ? 'opacity-100'
        : disableHoverOverlay
            ? 'opacity-0'
            : 'opacity-0 group-hover:opacity-100';
    
    // 图片语言选择：
    // 1. POD 派系卡牌 → 使用英文 locale（图片在 en/smashup/pod-assets/）
    // 2. 基地卡且玩家选择了 POD 版派系 → 使用英文 locale（图片在 en/smashup/pod-assets/）
    // 3. 使用了 TTS 英文图集（图集 ID 以 tts_atlas_ 开头）→ 使用英文 locale
    // 4. 原生泰坦图集当前只有本地资源，需要强制回到 zh-CN 目录
    // 5. 其他情况（基础派系） → 使用当前语言（图片在 zh-CN/smashup/）
    const usesNativeTitanAtlas = finalAtlasId === SMASHUP_ATLAS_IDS.TITANS;
    const isBuiltInAtlas = finalAtlasId.startsWith('smashup:');
    const imageLocale = usesNativeTitanAtlas
        ? 'zh-CN'
        : (isPodVersion || shouldUseEnglishAtlas || usesTtsAtlas)
            ? 'en'
            : (isEnglishVariant && isBuiltInAtlas)
                // Pretty Pretty 等新增原版派系目前仍复用内建中文 atlas；
                // 若英文环境下没有命中 TTS 高清映射，强制回退 zh-CN 资源，避免整张卡空白。
                ? 'zh-CN'
                : effectiveLocale;

    // 直接返回完整的卡牌（图片 + 覆盖层）
    return (
        <div className={`relative group ${className || ''}`} style={style} title={name}>
            <CardPreview
                previewRef={{ type: 'atlas', atlasId: finalAtlasId, index: finalIndex }}
                locale={imageLocale}
                className="w-full h-full"
                onError={(e) => {
                    console.error('[SmashUpCardRenderer] CardPreview image load failed:', {
                        defId,
                        atlasId: finalAtlasId,
                        index: finalIndex,
                        locale: imageLocale,
                        error: e,
                    });
                }}
            />
            {/* 覆盖层：仅在需要时显示，且未禁用 hover 时才响应 hover */}
            {shouldShowOverlay && (
                <div
                    data-testid="su-card-text-overlay"
                    data-overlay-visibility={forceShowOverlay ? 'always' : (disableHoverOverlay ? 'disabled' : 'hover')}
                    className={`absolute inset-0 z-10 pointer-events-none flex flex-col justify-between p-[4%] transition-opacity duration-200 bg-black/20
                    ${overlayVisibilityClass}`}
                >
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
