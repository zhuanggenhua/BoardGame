import type { RefObject } from 'react';
import type { HeroState } from '../types';
import { useTranslation } from 'react-i18next';

export const PlayerStats = ({
    player,
    hpRef,
}: {
    player: HeroState;
    hpRef?: RefObject<HTMLDivElement | null>;
}) => {
    const { t } = useTranslation('game-dicethrone');
    return (
        <div className="flex flex-col gap-[0.8vw] w-full bg-slate-900/80 p-[0.8vw] rounded-[0.8vw] border border-slate-600/50 shadow-xl backdrop-blur-md z-20 hover:bg-slate-900 transition-colors">
            <div ref={hpRef} className="relative w-full h-[1.8vw] bg-black/50 rounded-full border border-white/10 overflow-hidden group/hp">
                <div
                    className="absolute top-0 bottom-0 left-0 bg-gradient-to-r from-red-900 to-red-600 transition-all duration-500 ease-out"
                    style={{ width: `${(player.health / 50) * 100}%` }}
                />
                <div className="absolute inset-0 flex items-center justify-between px-[0.8vw]">
                    <span className="text-[0.8vw] font-bold text-red-200/80 tracking-wider">{t('hud.health')}</span>
                    <span className="text-[1.1vw] font-black text-white drop-shadow-md">{player.health}</span>
                </div>
            </div>

            <div className="relative w-full h-[1.8vw] bg-black/50 rounded-full border border-white/10 overflow-hidden group/cp">
                <div
                    className="absolute top-0 bottom-0 left-0 bg-gradient-to-r from-amber-800 to-amber-500 transition-all duration-500 ease-out"
                    style={{ width: `${Math.min(100, (player.cp / 6) * 100)}%` }}
                />
                <div className="absolute inset-0 flex items-center justify-between px-[0.8vw]">
                    <span className="text-[0.8vw] font-bold text-amber-200/80 tracking-wider">{t('hud.energy')}</span>
                    <span className="text-[1.1vw] font-black text-white drop-shadow-md">{player.cp}</span>
                </div>
            </div>
        </div>
    );
};
