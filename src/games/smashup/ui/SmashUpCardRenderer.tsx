import React, { useMemo } from 'react';
import type { CSSProperties } from 'react';
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
    onClick?: () => void;
    onMouseEnter?: () => void;
    onMouseLeave?: () => void;
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
    const disableHoverOverlay = previewRef.type === 'renderer' ? (previewRef.payload?.disableHoverOverlay as boolean | undefined) ?? false : false;

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
        console.log('[SmashUpCardRenderer] No previewRef found:', { defId, cardDef: !!cardDef, baseDef: !!baseDef });
        return { originalAtlasId: '', originalIndex: 0 };
    }, [defId]);

    let finalAtlasId = originalAtlasId;
    let finalIndex = originalIndex;
    
    // 基础牌默认使用高清英文图集（由于缺少低清中文资源），POD 版本也全都是高清英文图集
    const isBase = defId ? !!getBaseDef(defId) : false;
    
    // 判断是否为 POD 版本：
    // 1. 卡牌 ID 以 _pod 结尾（POD 派系的卡牌）
    // 2. 基地卡：只有当玩家选择了该基地对应派系的 POD 版本时，才使用 POD 图集
    //    例如：base_wizard_academy (faction: 'wizards') 只有在玩家选择了 'wizards_pod' 时才用 POD 图集
    //    如果玩家选择的是基础版 'wizards' + 其他 POD 派系，巫师基地仍然用中文图集
    const isPodVersion = defId ? (defId.endsWith('_pod') || (isBase && (() => {
        const baseDef = getBaseDef(defId);
        if (!baseDef?.faction) return false;
        // 检查玩家是否选择了该派系的 POD 版本（而不是基础版）
        const podFactionId = `${baseDef.faction}_pod`;
        return selectedFactions.has(podFactionId);
    })())) : false;
    
    // 判断基地卡是否应该使用英文图集：
    // 只有当玩家选择了该派系的 POD 版本时，才使用英文 POD 图集
    // 基础版派系的基地卡继续使用中文图集（smashup:base1 等）
    const shouldUseEnglishAtlas = defId && isBase && (() => {
        const baseDef = getBaseDef(defId);
        if (!baseDef?.faction) return false;
        // 只检查 POD 版本
        const podFactionId = `${baseDef.faction}_pod`;
        return selectedFactions.has(podFactionId);
    })();

    // 只有在英文模式下，或者该卡牌是 POD 专属卡牌，或者基地卡被选中，才去查 TTS 高清英文图集。
    // 否则在中文模式下，保留原版 originalAtlasId（会读取 cards1 等带有内嵌中文的低清图）
    // 特殊情况：如果 originalAtlasId 为空，同样回退使用英文图集（兜底逻辑）
    const isEnglishVariant = effectiveLocale === 'en' || effectiveLocale === 'en-US';
    
    if (isEnglishVariant || isPodVersion || shouldUseEnglishAtlas || !originalAtlasId) {
        // 对于基地卡，根据是否为 POD 版本选择不同的映射 key
        let lookupKey = defId || '';
        if (isBase && isPodVersion && defId) {
            // POD 版本基地：使用 base_xxx_pod 映射
            lookupKey = `${defId}_pod`;
        }
        // 否则使用原始 defId（基础版基地用 base_xxx，POD 卡牌用 xxx_pod）
        
        if (lookupKey) {
            const mapped = TTS_MAP[lookupKey];
            if (mapped) {
                finalAtlasId = mapped.atlasId;
                finalIndex = mapped.index;
            }
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
        console.log('[SmashUpCardRenderer] Early return:', { previewRefType: previewRef.type, defId });
        return null;
    }

    // 如果未配置任何图集，只渲染外框和名字
    if (!finalAtlasId) {
        console.log('[SmashUpCardRenderer] No atlas, fallback render:', { defId, name });
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
    
    // 图片语言选择：
    // 1. POD 派系卡牌 → 使用英文 locale（图片在 en/smashup/pod-assets/）
    // 2. 基地卡且玩家选择了 POD 版派系 → 使用英文 locale（图片在 en/smashup/pod-assets/）
    // 3. 使用了 TTS 英文图集（图集 ID 以 tts_atlas_ 开头）→ 使用英文 locale
    // 4. 其他情况（基础派系） → 使用当前语言（图片在 zh-CN/smashup/）
    const imageLocale = (isPodVersion || shouldUseEnglishAtlas || usesTtsAtlas) ? 'en' : effectiveLocale;

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
                <div className={`absolute inset-0 z-10 pointer-events-none flex flex-col justify-between p-[4%] transition-opacity duration-200 bg-black/20
                    ${disableHoverOverlay ? 'opacity-0' : 'opacity-0 group-hover:opacity-100'}`}
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
