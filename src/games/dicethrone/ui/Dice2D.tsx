// @asset-pipeline-allow: sprite cropping and fallback background are mutually exclusive.
import React from 'react';
import {
    DICE_BG_SIZE,
    getDiceSpritePosition,
    getDiceSpriteUrls,
} from './assets';

export interface Dice2DProps {
    value: number;
    isRolling: boolean;
    size?: string;
    locale?: string;
    characterId?: string;
    definitionId?: string;
}

const DICE_2D_CUBE_STYLE_ELEMENT_ID = 'dicethrone-dice2d-cube-styles';
const DICE_2D_CUBE_STYLE_TEXT = `
.dice2d-cube-perspective { perspective: 1000px; }
.dice2d-cube-preserve-3d { transform-style: preserve-3d; }
.dice2d-cube-backface-hidden { backface-visibility: hidden; }
@keyframes dice2d-cube-tumble {
    0% { transform: rotateX(0) rotateY(0); }
    100% { transform: rotateX(1440deg) rotateY(1440deg); }
}
.animate-dice2d-cube-tumble { animation: dice2d-cube-tumble 1s linear infinite; }
`;

const loadedDiceSpriteUrls = new Set<string>();

export const __resetDice2DLoadedSpriteUrlsForTests = () => {
    loadedDiceSpriteUrls.clear();
};

const getSettledTransform = (faceValue: number) => {
    switch (faceValue) {
        case 1: return 'rotateX(0deg) rotateY(0deg)';
        case 6: return 'rotateX(180deg) rotateY(0deg)';
        case 2: return 'rotateX(-90deg) rotateY(0deg)';
        case 5: return 'rotateX(90deg) rotateY(0deg)';
        case 3: return 'rotateX(0deg) rotateY(-90deg)';
        case 4: return 'rotateX(0deg) rotateY(90deg)';
        default: return 'rotateY(0deg)';
    }
};

/** 直接裁切英雄骰图，用 CSS 六面体恢复原 2D 骰子的立体翻滚；不创建 WebGL 或 Canvas 渲染器。 */
export const Dice2D: React.FC<Dice2DProps> = ({
    value,
    isRolling,
    size = '4vw',
    locale,
    characterId = 'monk',
    definitionId,
}) => {
    const spriteUrls = React.useMemo(
        () => getDiceSpriteUrls(definitionId, characterId, locale),
        [characterId, definitionId, locale],
    );
    const [spriteIndex, setSpriteIndex] = React.useState(0);
    const [isSpriteReady, setIsSpriteReady] = React.useState(() => (
        Boolean(spriteUrls[0] && loadedDiceSpriteUrls.has(spriteUrls[0]))
    ));

    React.useEffect(() => {
        setSpriteIndex(0);
        setIsSpriteReady(Boolean(spriteUrls[0] && loadedDiceSpriteUrls.has(spriteUrls[0])));
    }, [spriteUrls]);

    React.useEffect(() => {
        if (typeof document === 'undefined') return;
        if (document.getElementById(DICE_2D_CUBE_STYLE_ELEMENT_ID)) return;
        const style = document.createElement('style');
        style.id = DICE_2D_CUBE_STYLE_ELEMENT_ID;
        style.textContent = DICE_2D_CUBE_STYLE_TEXT;
        document.head.appendChild(style);
    }, []);

    const spriteUrl = spriteUrls[spriteIndex];
    const hasFallbackCandidate = spriteIndex < spriteUrls.length - 1;
    const translateZ = `calc(${size} / 2)`;
    const faces = React.useMemo(() => ([
        { id: 1, transform: `translateZ(${translateZ})` },
        { id: 6, transform: `rotateY(180deg) rotateZ(180deg) translateZ(${translateZ})` },
        { id: 3, transform: `rotateY(90deg) translateZ(${translateZ})` },
        { id: 4, transform: `rotateY(-90deg) translateZ(${translateZ})` },
        { id: 2, transform: `rotateX(90deg) translateZ(${translateZ})` },
        { id: 5, transform: `rotateX(-90deg) translateZ(${translateZ})` },
    ]), [translateZ]);
    const settledTransform = getSettledTransform(value);

    return (
        <div
            className="relative dice2d-cube-perspective"
            data-testid="dice-2d"
            data-face-value={value}
            data-sprite-ready={isSpriteReady ? 'true' : 'false'}
            data-sprite-url={spriteUrl ?? ''}
            data-visual-mode="css-2d-cube"
            data-roll-animation={isRolling ? 'dice2d-cube-tumble' : 'settled'}
            style={{ width: size, height: size }}
        >
            {spriteUrl && (
                <img
                    key={spriteUrl}
                    src={spriteUrl}
                    alt=""
                    aria-hidden="true"
                    className="pointer-events-none absolute h-px w-px opacity-0"
                    onLoad={() => {
                        loadedDiceSpriteUrls.add(spriteUrl);
                        setIsSpriteReady(true);
                    }}
                    onError={() => {
                        if (hasFallbackCandidate) {
                            setSpriteIndex((index) => index + 1);
                            return;
                        }
                        setIsSpriteReady(false);
                    }}
                />
            )}
            <div
                className="pointer-events-none absolute left-[10%] right-[10%] bottom-[2%] z-0 h-[18%] rounded-full bg-black/30 blur-[0.18vw]"
                aria-hidden="true"
            />
            <div
                className={`relative z-10 h-full w-full dice2d-cube-preserve-3d ${isRolling ? 'animate-dice2d-cube-tumble' : ''}`}
                data-testid="dice-2d-cube"
                style={{
                    transform: isRolling
                        ? 'rotateX(720deg) rotateY(720deg)'
                        : settledTransform,
                    transition: isRolling ? 'none' : 'transform 1000ms ease-out',
                }}
            >
                {faces.map((face) => {
                    const { xPos, yPos } = getDiceSpritePosition(face.id);
                    const needsFlip = face.id === 1 || face.id === 6;
                    const faceTransform = needsFlip ? `${face.transform} rotateZ(180deg)` : face.transform;
                    const hasSprite = Boolean(isSpriteReady && spriteUrl);

                    return (
                        <div
                            key={face.id}
                            className="absolute inset-0 flex items-center justify-center overflow-hidden rounded-[0.5vw] border border-slate-700/50 bg-slate-900 shadow-inner dice2d-cube-backface-hidden"
                            data-face-id={face.id}
                            data-face-fallback={hasSprite ? 'false' : 'glyph'}
                            style={{
                                transform: faceTransform,
                                ...(hasSprite && spriteUrl ? {
                                    backgroundImage: `url("${spriteUrl}")`,
                                    backgroundSize: DICE_BG_SIZE,
                                    backgroundPosition: `${xPos}% ${yPos}%`,
                                    backgroundRepeat: 'no-repeat',
                                } : {
                                    background: 'linear-gradient(145deg, #fff8eb 0%, #f0e4cd 54%, #d8c7aa 100%)',
                                }),
                                boxShadow: 'inset 0 0 1vw rgba(0,0,0,0.8)',
                                imageRendering: 'auto',
                            }}
                        >
                            {!hasSprite && (
                                <span
                                    className="pointer-events-none select-none text-[1.1vw] font-black uppercase tracking-[0.08em] text-slate-100"
                                    style={{
                                        textShadow: '0 0 0.4vw rgba(0, 0, 0, 0.75)',
                                    }}
                                >
                                    {face.id}
                                </span>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default Dice2D;
