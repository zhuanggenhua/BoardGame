// @asset-pipeline-allow
// @asset-pipeline-allow
import React from 'react';
import { createScopedLogger } from '../../../lib/logger';
import { SHIMMER_BG } from '../../../components/common/media/OptimizedImage';
import {
    DICE_BG_SIZE,
    getDiceSpritePosition,
    getDiceSpriteAssetPath,
} from './assets';
import {
    getLocalizedImageCandidateUrls,
    getPreloadedImageElement,
    markImageLoaded,
} from '../../../core';

export interface Dice3DProps {
    /** 骰子值 (1-6) */
    value: number;
    /** 是否正在播放滚动动画 */
    isRolling: boolean;
    /** 骰子大小 (CSS 单位) */
    size?: string;
    /** 语言 */
    locale?: string;
    /** 动画序号，用于错峰滚动 */
    index?: number;
    /** 变体：default 用于骰盘，spotlight 用于特写 */
    variant?: 'default' | 'spotlight';
    /** 角色 ID，用于回退路径和兜底字形 */
    characterId?: string;
    /** 骰子定义 ID，优先从定义读取 spriteSheet */
    definitionId?: string;
}

const dice3DLogger = createScopedLogger('dicethrone:dice3d');
const DICE3D_STYLE_ELEMENT_ID = 'dicethrone-dice3d-styles';
const DICE3D_STYLE_TEXT = `
.dice3d-perspective { perspective: 1000px; }
.dice3d-preserve-3d { transform-style: preserve-3d; }
.dice3d-backface-hidden { backface-visibility: hidden; }
@keyframes dice3d-tumble {
    0% { transform: rotateX(0) rotateY(0); }
    100% { transform: rotateX(1440deg) rotateY(1440deg); }
}
@keyframes dice3d-bonus-tumble {
    0% { transform: rotateX(0) rotateY(0); }
    100% { transform: rotateX(1440deg) rotateY(1440deg); }
}
.animate-dice3d-tumble { animation: dice3d-tumble 1s linear infinite; }
.animate-dice3d-bonus-tumble { animation: dice3d-bonus-tumble 0.8s linear infinite; }
`;

/** 3D 骰子组件 */
export const Dice3D = ({
    value,
    isRolling,
    size = '4.5vw',
    locale,
    index = 0,
    variant = 'default',
    characterId = 'monk',
    definitionId,
}: Dice3DProps) => {
    const translateZ = `calc(${size} / 2)`;
    const rootRef = React.useRef<HTMLDivElement | null>(null);
    const lastInspectKeyRef = React.useRef<string | null>(null);
    const spriteAssetPath = React.useMemo(
        () => getDiceSpriteAssetPath(definitionId, characterId),
        [characterId, definitionId],
    );
    const effectiveLocale = locale ?? 'zh-CN';

    const faces = [
        { id: 1, trans: `translateZ(${translateZ})` },
        { id: 6, trans: `rotateY(180deg) rotateZ(180deg) translateZ(${translateZ})` },
        { id: 3, trans: `rotateY(90deg) translateZ(${translateZ})` },
        { id: 4, trans: `rotateY(-90deg) translateZ(${translateZ})` },
        { id: 2, trans: `rotateX(90deg) translateZ(${translateZ})` },
        { id: 5, trans: `rotateX(-90deg) translateZ(${translateZ})` },
    ];

    const [resolvedSpriteUrl, setResolvedSpriteUrl] = React.useState<string | null>(null);
    const [isSpriteReady, setIsSpriteReady] = React.useState(false);

    React.useEffect(() => {
        if (typeof document === 'undefined') return;
        if (document.getElementById(DICE3D_STYLE_ELEMENT_ID)) return;
        const style = document.createElement('style');
        style.id = DICE3D_STYLE_ELEMENT_ID;
        style.textContent = DICE3D_STYLE_TEXT;
        document.head.appendChild(style);
    }, []);

    React.useEffect(() => {
        let cancelled = false;
        setIsSpriteReady(false);
        setResolvedSpriteUrl(null);

        if (!spriteAssetPath) return () => {
            cancelled = true;
        };

        const candidates = getLocalizedImageCandidateUrls(spriteAssetPath, effectiveLocale);
        const findLoadedCandidate = () => candidates.find((url) => {
            const el = getPreloadedImageElement(url);
            return el?.naturalWidth && el.naturalWidth > 0;
        });

        const loaded = findLoadedCandidate();
        if (loaded) {
            setResolvedSpriteUrl(loaded);
            setIsSpriteReady(true);
            return () => { cancelled = true; };
        }

        setResolvedSpriteUrl(candidates[0] ?? null);

        const tryLoad = (index: number) => {
            if (cancelled) return;
            if (index >= candidates.length) return;
            const url = candidates[index];
            const img = new Image();
            img.onload = () => {
                if (cancelled) return;
                markImageLoaded(url, undefined, img);
                markImageLoaded(spriteAssetPath, effectiveLocale, img);
                setResolvedSpriteUrl(url);
                setIsSpriteReady(true);
            };
            img.onerror = () => {
                if (cancelled) return;
                tryLoad(index + 1);
            };
            img.src = url;
        };

        tryLoad(0);

        return () => {
            cancelled = true;
        };
    }, [effectiveLocale, spriteAssetPath]);

    React.useEffect(() => {
        dice3DLogger.debug('sprite-resolved', {
            definitionId: definitionId ?? null,
            characterId,
            locale: effectiveLocale,
            spriteAssetPath: spriteAssetPath ?? null,
            spriteUrl: resolvedSpriteUrl ?? null,
            isSpriteReady,
        });
    }, [characterId, definitionId, effectiveLocale, isSpriteReady, resolvedSpriteUrl, spriteAssetPath]);

    const isSpotlight = variant === 'spotlight';

    React.useEffect(() => {
        if (typeof window === 'undefined') return;
        const root = rootRef.current;
        if (!root) return;
        const inspectKey = [
            resolvedSpriteUrl ?? 'null',
            isSpriteReady ? 'ready' : 'not-ready',
            size,
            value,
        ].join('|');
        if (lastInspectKeyRef.current === inspectKey) return;
        lastInspectKeyRef.current = inspectKey;

        const faceEl = root.querySelector('[data-face-id="1"]') as HTMLElement | null;
        if (!faceEl) {
            dice3DLogger.warn('sprite-inspect-missing-face', {
                definitionId: definitionId ?? null,
                characterId,
                locale: locale ?? null,
            });
            return;
        }

        const style = window.getComputedStyle(faceEl);
        dice3DLogger.info('sprite-inspect', {
            definitionId: definitionId ?? null,
            characterId,
            locale: locale ?? null,
            spriteUrl: resolvedSpriteUrl ?? null,
            isSpriteReady,
            size,
            value,
            diceBgSize: DICE_BG_SIZE,
            backgroundImage: style.backgroundImage,
            backgroundSize: style.backgroundSize,
            backgroundPosition: style.backgroundPosition,
            backgroundRepeat: style.backgroundRepeat,
            opacity: style.opacity,
            visibility: style.visibility,
            display: style.display,
        });
    }, [characterId, definitionId, isSpriteReady, locale, resolvedSpriteUrl, size, value]);

    const getFinalTransform = (val: number) => {
        switch (val) {
            case 1: return 'rotateX(0deg) rotateY(0deg)';
            case 6: return 'rotateX(180deg) rotateY(0deg)';
            case 2: return 'rotateX(-90deg) rotateY(0deg)';
            case 5: return 'rotateX(90deg) rotateY(0deg)';
            case 3: return 'rotateX(0deg) rotateY(-90deg)';
            case 4: return 'rotateX(0deg) rotateY(90deg)';
            default: return 'rotateY(0deg)';
        }
    };

    const animationClass = isSpotlight ? 'animate-dice3d-bonus-tumble' : 'animate-dice3d-tumble';
    const borderRadius = isSpotlight ? 'rounded-[1vw]' : 'rounded-[0.5vw]';
    const borderStyle = isSpotlight ? 'border-2 border-slate-600/50' : 'border border-slate-700/50';
    const boxShadow = isSpotlight ? 'inset 0 0 2vw rgba(0,0,0,0.8)' : 'inset 0 0 1vw rgba(0,0,0,0.8)';
    const transitionDuration = isSpotlight ? '600ms' : '1000ms';

    return (
        <div
            ref={rootRef}
            className="relative dice3d-perspective"
            style={{ width: size, height: size }}
            data-testid="dice-3d"
            data-sprite-ready={isSpriteReady ? 'true' : 'false'}
            data-definition-id={definitionId ?? ''}
            data-sprite-url={resolvedSpriteUrl ?? ''}
        >
            <div
                className={`relative w-full h-full dice3d-preserve-3d ${isRolling ? animationClass : ''}`}
                style={{
                    transform: isRolling
                        ? `rotateX(${720 + index * 90}deg) rotateY(${720 + index * 90}deg)`
                        : getFinalTransform(value),
                    transition: isRolling ? 'none' : `transform ${transitionDuration} ease-out`,
                }}
            >
                {faces.map((face) => {
                    const { xPos, yPos } = getDiceSpritePosition(face.id);
                    const needsFlip = face.id === 1 || face.id === 6;
                    const faceTransform = needsFlip ? `${face.trans} rotateZ(180deg)` : face.trans;
                    const hasSprite = Boolean(isSpriteReady && resolvedSpriteUrl);

                    return (
                        <div
                            key={face.id}
                            className={`absolute inset-0 flex items-center justify-center bg-slate-900 ${borderRadius} dice3d-backface-hidden ${borderStyle} shadow-inner overflow-hidden`}
                            style={{
                                transform: faceTransform,
                                ...(hasSprite && resolvedSpriteUrl ? {
                                    backgroundImage: `url("${resolvedSpriteUrl}")`,
                                    backgroundSize: DICE_BG_SIZE,
                                    backgroundPosition: `${xPos}% ${yPos}%`,
                                    backgroundRepeat: 'no-repeat',
                                } : {
                                    backgroundColor: SHIMMER_BG.backgroundColor,
                                    backgroundImage: SHIMMER_BG.backgroundImage,
                                    backgroundSize: SHIMMER_BG.backgroundSize,
                                    backgroundPosition: SHIMMER_BG.backgroundPosition,
                                    backgroundRepeat: 'no-repeat',
                                    animation: SHIMMER_BG.animation,
                                }),
                                boxShadow,
                                imageRendering: 'auto',
                            }}
                            data-face-id={face.id}
                            data-face-fallback={hasSprite ? 'false' : 'loading'}
                        >
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default Dice3D;
