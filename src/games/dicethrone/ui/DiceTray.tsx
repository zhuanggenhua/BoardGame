import type { Dispatch, SetStateAction } from 'react';
import { useTranslation } from 'react-i18next';
import type { Die, TurnPhase } from '../types';
import { buildLocalizedImageSet } from '../../../core';
import { ASSETS, DICE_BG_SIZE, getDiceSpritePosition } from './assets';

const Dice3D = ({
    value,
    isRolling,
    index,
    size = '4.5vw',
    locale,
}: {
    value: number;
    isRolling: boolean;
    index: number;
    size?: string;
    locale?: string;
}) => {
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

    return (
        <div
            className="relative perspective-1000"
            style={{ width: size, height: size }}
        >
            <div
                className={`relative w-full h-full transform-style-3d transition-transform duration-[1000ms] ease-out ${isRolling ? 'animate-tumble' : ''}`}
                style={{
                    transform: isRolling
                        ? `rotateX(${720 + index * 90}deg) rotateY(${720 + index * 90}deg)`
                        : getFinalTransform(value)
                }}
            >
                {faces.map((face) => {
                    const { xPos, yPos } = getDiceSpritePosition(face.id);
                    const needsFlip = face.id === 1 || face.id === 6;
                    const faceTransform = needsFlip ? `${face.trans} rotateZ(180deg)` : face.trans;
                    return (
                        <div
                            key={face.id}
                            className="absolute inset-0 w-full h-full bg-slate-900 rounded-[0.5vw] backface-hidden border border-slate-700/50 shadow-inner"
                            style={{
                                transform: faceTransform,
                                backgroundImage: buildLocalizedImageSet(ASSETS.DICE_SPRITE, locale),
                                backgroundSize: DICE_BG_SIZE,
                                backgroundPosition: `${xPos}% ${yPos}%`,
                                boxShadow: 'inset 0 0 1vw rgba(0,0,0,0.8)',
                                imageRendering: 'auto'
                            }}
                        />
                    );
                })}
            </div>
            <style>{`
                .perspective-1000 { perspective: 1000px; }
                .transform-style-3d { transform-style: preserve-3d; }
                .backface-hidden { backface-visibility: hidden; }
                @keyframes tumble {
                    0% { transform: rotateX(0) rotateY(0); }
                    100% { transform: rotateX(1440deg) rotateY(1440deg); }
                }
                .animate-tumble { animation: tumble 1s linear infinite; }
            `}</style>
        </div>
    );
};

export const DiceTray = ({
    dice,
    onToggleLock,
    currentPhase,
    canInteract,
    isRolling,
    locale,
}: {
    dice: Die[];
    onToggleLock: (id: number) => void;
    currentPhase: TurnPhase;
    canInteract: boolean;
    isRolling: boolean;
    locale?: string;
}) => {
    const { t } = useTranslation('game-dicethrone');
    const isRollPhase = currentPhase === 'offensiveRoll' || currentPhase === 'defensiveRoll';
    const diceSize = '4vw';

    return (
        <div className="flex flex-col items-center bg-slate-900/90 p-[0.6vw] rounded-[1vw] border border-slate-700 backdrop-blur-lg shadow-2xl gap-[0.5vw] w-[5.6vw] shrink-0 relative overflow-hidden">
            {!canInteract && isRollPhase && (
                <div className="absolute inset-0 bg-black/60 z-[100] flex items-center justify-center backdrop-blur-[2px] p-[1vw] text-center">
                    <div className="flex flex-col items-center gap-[0.5vw]">
                        <div className="w-[1.5vw] h-[1.5vw] border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                        <span className="text-amber-500 font-bold text-[0.7vw] uppercase tracking-tighter">{t('dice.waitingOpponent')}</span>
                    </div>
                </div>
            )}

            <div className="flex flex-col gap-[0.5vw] items-center justify-center w-full p-[0.2vw]">
                {dice.map((d, i) => (
                    <div
                        key={d.id}
                        onClick={() => !isRolling && canInteract && onToggleLock(d.id)}
                        className={`
                            relative flex-shrink-0 cursor-pointer group
                            ${d.isKept ? 'opacity-80' : 'hover:scale-110'}
                            ${!canInteract ? 'cursor-not-allowed opacity-50' : ''}
                            transition-transform duration-200
                         `}
                    >
                        <Dice3D value={d.value} isRolling={isRolling && !d.isKept} index={i} size={diceSize} locale={locale} />
                        {d.isKept && (
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
                                <div className="text-[0.6vw] font-black text-white bg-black/50 px-[0.4vw] py-[0.1vw] rounded uppercase tracking-wider backdrop-blur-sm shadow-sm border border-white/20">
                                    {t('dice.locked')}
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};

export const DiceActions = ({
    rollCount,
    rollLimit,
    rollConfirmed,
    onRoll,
    onConfirm,
    currentPhase,
    canInteract,
    isRolling,
    setIsRolling,
}: {
    rollCount: number;
    rollLimit: number;
    rollConfirmed: boolean;
    onRoll: () => void;
    onConfirm: () => void;
    currentPhase: TurnPhase;
    canInteract: boolean;
    isRolling: boolean;
    setIsRolling: Dispatch<SetStateAction<boolean>>;
}) => {
    const { t } = useTranslation('game-dicethrone');
    const isRollPhase = currentPhase === 'offensiveRoll' || currentPhase === 'defensiveRoll';

    const handleRollClick = () => {
        if (!isRollPhase || !canInteract || rollConfirmed || rollCount >= rollLimit) return;
        setIsRolling(true);
        onRoll();
        setTimeout(() => setIsRolling(false), 600);
    };

    return (
        <div className="w-[10.2vw] grid grid-cols-2 gap-[0.6vw]">
            <button
                onClick={handleRollClick}
                disabled={!canInteract || rollConfirmed || (rollCount >= rollLimit)}
                className={`
                    w-full py-[0.8vw] rounded-[0.6vw] font-bold text-[0.75vw] uppercase tracking-wider shadow-lg transition-all active:scale-95
                    ${isRollPhase && canInteract && !rollConfirmed && rollCount < rollLimit
                        ? 'bg-gradient-to-r from-amber-600 to-orange-600 text-white hover:brightness-110 shadow-amber-900/50'
                        : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'}
                `}
            >
                {isRolling ? t('dice.rolling') : t('dice.roll', { current: rollCount, total: rollLimit })}
            </button>
            <button
                onClick={onConfirm}
                disabled={rollConfirmed || rollCount === 0 || !canInteract}
                className={`
                    w-full py-[0.8vw] rounded-[0.6vw] font-bold text-[0.75vw] uppercase tracking-wider shadow-lg transition-all active:scale-95
                    ${rollConfirmed
                        ? 'bg-emerald-700 text-emerald-100 border border-emerald-500/60'
                        : (canInteract ? 'bg-slate-800 text-slate-300 hover:bg-emerald-700/80 border border-slate-600' : 'bg-slate-900 text-slate-600 border border-slate-800')}
                    ${rollCount === 0 || !canInteract ? 'opacity-60 cursor-not-allowed' : ''}
                    ${isRollPhase ? '' : 'opacity-0 pointer-events-none'}
                `}
            >
                {rollConfirmed ? t('dice.confirmed') : t('dice.confirm')}
            </button>
        </div>
    );
};
