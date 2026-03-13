import React from 'react';
import { createScopedLogger } from '../../../lib/logger';
import {
    DICE_BG_SIZE,
    getDiceSpritePosition,
    getDiceSpriteUrls,
} from './assets';

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

type SpriteLoadState = 'loading' | 'ready' | 'error';
interface SpriteState {
    status: SpriteLoadState;
    url?: string;
}
const dice3DLogger = createScopedLogger('dicethrone:dice3d');

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

    const faces = [
        { id: 1, trans: `translateZ(${translateZ})` },
        { id: 6, trans: `rotateY(180deg) rotateZ(180deg) translateZ(${translateZ})` },
        { id: 3, trans: `rotateY(90deg) translateZ(${translateZ})` },
        { id: 4, trans: `rotateY(-90deg) translateZ(${translateZ})` },
        { id: 2, trans: `rotateX(90deg) translateZ(${translateZ})` },
        { id: 5, trans: `rotateX(-90deg) translateZ(${translateZ})` },
    ];

    const spriteUrls = React.useMemo(
        () => getDiceSpriteUrls(definitionId, characterId, locale),
        [characterId, definitionId, locale],
    );
    const [spriteState, setSpriteState] = React.useState<SpriteState>(() => ({
        status: spriteUrls.length > 0 ? 'loading' : 'error',
        url: spriteUrls[0],
    }));

    React.useEffect(() => {
        dice3DLogger.debug('sprite-candidates', {
            definitionId: definitionId ?? null,
            characterId,
            locale: locale ?? null,
            spriteUrls,
        });
    }, [characterId, definitionId, locale, spriteUrls]);

    React.useEffect(() => {
        if (!spriteUrls.length) {
            dice3DLogger.warn('sprite-candidates-empty', {
                definitionId: definitionId ?? null,
                characterId,
                locale: locale ?? null,
            });
            setSpriteState({ status: 'error', url: undefined });
            return undefined;
        }

        if (typeof Image === 'undefined') {
            dice3DLogger.warn('image-constructor-unavailable', {
                definitionId: definitionId ?? null,
                characterId,
                locale: locale ?? null,
                selectedUrl: spriteUrls[0],
            });
            setSpriteState({ status: 'ready', url: spriteUrls[0] });
            return undefined;
        }

        setSpriteState({ status: 'loading', url: undefined });
        let cancelled = false;

        const tryLoad = (index: number) => {
            if (cancelled) return;
            if (index >= spriteUrls.length) {
                dice3DLogger.error('sprite-all-failed', {
                    definitionId: definitionId ?? null,
                    characterId,
                    locale: locale ?? null,
                    spriteUrls,
                });
                setSpriteState({ status: 'error', url: undefined });
                return;
            }

            const candidateUrl = spriteUrls[index];
            dice3DLogger.debug('sprite-probe-start', {
                index,
                candidateUrl,
            });
            const image = new Image();
            image.onload = () => {
                if (!cancelled) {
                    dice3DLogger.info('sprite-probe-success', {
                        index,
                        candidateUrl,
                        naturalWidth: image.naturalWidth,
                        naturalHeight: image.naturalHeight,
                    });
                    setSpriteState({ status: 'ready', url: candidateUrl });
                }
            };
            image.onerror = () => {
                if (!cancelled) {
                    dice3DLogger.warn('sprite-probe-fail', {
                        index,
                        candidateUrl,
                    });
                    tryLoad(index + 1);
                }
            };
            image.src = candidateUrl;
        };
        tryLoad(0);

        return () => {
            cancelled = true;
        };
    }, [characterId, definitionId, locale, spriteUrls]);

    React.useEffect(() => {
        dice3DLogger.debug('sprite-render-state', {
            definitionId: definitionId ?? null,
            characterId,
            locale: locale ?? null,
            spriteLoadState: spriteState.status,
            resolvedSpriteUrl: spriteState.url ?? null,
        });
    }, [characterId, definitionId, locale, spriteState.status, spriteState.url]);

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

    const isSpotlight = variant === 'spotlight';
    const resolvedSpriteUrl = spriteState.url;
    const isSpriteReady = spriteState.status === 'ready' && Boolean(resolvedSpriteUrl);
    const animationClass = isSpotlight ? 'animate-dice3d-bonus-tumble' : 'animate-dice3d-tumble';
    const borderRadius = isSpotlight ? 'rounded-[1vw]' : 'rounded-[0.5vw]';
    const borderStyle = isSpotlight ? 'border-2 border-slate-600/50' : 'border border-slate-700/50';
    const boxShadow = isSpotlight ? 'inset 0 0 2vw rgba(0,0,0,0.8)' : 'inset 0 0 1vw rgba(0,0,0,0.8)';
    const transitionDuration = isSpotlight ? '600ms' : '1000ms';

    return (
        <div
            className="relative dice3d-perspective"
            style={{ width: size, height: size }}
            data-testid="dice-3d"
            data-sprite-ready={isSpriteReady ? 'true' : 'false'}
            data-definition-id={definitionId ?? ''}
            data-sprite-candidates={String(spriteUrls.length)}
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

                    return (
                        <div
                            key={face.id}
                            className={`absolute inset-0 flex items-center justify-center bg-slate-900 ${borderRadius} dice3d-backface-hidden ${borderStyle} shadow-inner`}
                            style={{
                                transform: faceTransform,
                                backgroundImage: isSpriteReady && resolvedSpriteUrl ? `url("${resolvedSpriteUrl}")` : undefined,
                                backgroundSize: isSpriteReady ? DICE_BG_SIZE : undefined,
                                backgroundPosition: isSpriteReady ? `${xPos}% ${yPos}%` : undefined,
                                boxShadow,
                                imageRendering: 'auto',
                            }}
                            data-face-id={face.id}
                        />
                    );
                })}
            </div>
            <style>{`
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
            `}</style>
        </div>
    );
};

export default Dice3D;
