import type { Dispatch, SetStateAction } from 'react';
import { useTranslation } from 'react-i18next';
import type { Die, TurnPhase } from '../types';
import { Dice3D } from './Dice3D';

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
                    w-full py-[0.8vw] rounded-[0.6vw] font-bold text-[0.75vw] uppercase tracking-wider shadow-lg transition-[transform,filter] duration-200 active:scale-95
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
                    w-full py-[0.8vw] rounded-[0.6vw] font-bold text-[0.75vw] uppercase tracking-wider shadow-lg transition-[transform,background-color,opacity] duration-200 active:scale-95
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
