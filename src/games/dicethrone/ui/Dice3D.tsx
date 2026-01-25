import { buildLocalizedImageSet } from '../../../core';
import { ASSETS, DICE_BG_SIZE, getDiceSpritePosition } from './assets';

export interface Dice3DProps {
    /** 骰子值 (1-6) */
    value: number;
    /** 是否正在投掷动画 */
    isRolling: boolean;
    /** 骰子大小 (CSS 单位) */
    size?: string;
    /** 语言 */
    locale?: string;
    /** 动画序号（用于错开动画，可选） */
    index?: number;
    /** 变体：'default' 用于托盘，'spotlight' 用于特写 */
    variant?: 'default' | 'spotlight';
}

/** 3D 骰子组件 */
export const Dice3D = ({
    value,
    isRolling,
    size = '4.5vw',
    locale,
    index = 0,
    variant = 'default',
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
    const animationClass = isSpotlight ? 'animate-dice3d-bonus-tumble' : 'animate-dice3d-tumble';
    const borderRadius = isSpotlight ? 'rounded-[1vw]' : 'rounded-[0.5vw]';
    const borderStyle = isSpotlight ? 'border-2 border-slate-600/50' : 'border border-slate-700/50';
    const boxShadow = isSpotlight ? 'inset 0 0 2vw rgba(0,0,0,0.8)' : 'inset 0 0 1vw rgba(0,0,0,0.8)';
    const transitionDuration = isSpotlight ? '800ms' : '1000ms';

    return (
        <div
            className="relative dice3d-perspective"
            style={{ width: size, height: size }}
        >
            <div
                className={`relative w-full h-full dice3d-preserve-3d ${isRolling ? animationClass : ''}`}
                style={{
                    transform: isRolling
                        ? `rotateX(${720 + index * 90}deg) rotateY(${720 + index * 90}deg)`
                        : getFinalTransform(value),
                    transition: isRolling ? 'none' : `transform ${transitionDuration} ease-out`
                }}
            >
                {faces.map((face) => {
                    const { xPos, yPos } = getDiceSpritePosition(face.id);
                    const needsFlip = face.id === 1 || face.id === 6;
                    const faceTransform = needsFlip ? `${face.trans} rotateZ(180deg)` : face.trans;
                    return (
                        <div
                            key={face.id}
                            className={`absolute inset-0 w-full h-full bg-slate-900 ${borderRadius} dice3d-backface-hidden ${borderStyle} shadow-inner`}
                            style={{
                                transform: faceTransform,
                                backgroundImage: buildLocalizedImageSet(ASSETS.DICE_SPRITE, locale),
                                backgroundSize: DICE_BG_SIZE,
                                backgroundPosition: `${xPos}% ${yPos}%`,
                                boxShadow,
                                imageRendering: 'auto'
                            }}
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
