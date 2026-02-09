import { type RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle } from 'lucide-react';
import type { HeroState } from '../types';
import { RESOURCE_IDS } from '../domain/resources';
import { ShakeContainer } from '../../../components/common/animations/ShakeContainer';
import {
    HitStopContainer,
    type HitStopConfig,
} from '../../../components/common/animations';
import { StatusEffectsContainer, TokensContainer, type StatusAtlases } from './statusEffects';
import { getPortraitStyle } from './assets';

type ViewMode = 'self' | 'opponent';

export const OpponentHeader = ({
    opponent,
    opponentName,
    viewMode,
    isOpponentShaking,
    hitStopActive,
    hitStopConfig,
    shouldAutoObserve,
    onToggleView,
    headerError,
    opponentBuffRef,
    opponentHpRef,
    statusIconAtlas,
    locale,
    containerRef,
}: {
    opponent: HeroState;
    opponentName: string;
    viewMode: ViewMode;
    isOpponentShaking: boolean;
    hitStopActive?: boolean;
    hitStopConfig?: HitStopConfig;
    shouldAutoObserve: boolean;
    onToggleView: () => void;
    headerError?: string | null;
    opponentBuffRef?: RefObject<HTMLDivElement | null>;
    opponentHpRef?: RefObject<HTMLDivElement | null>;
    statusIconAtlas?: StatusAtlases | null;
    locale?: string;
    /** 对手悬浮窗容器引用（用于卡牌特写动画起点） */
    containerRef?: RefObject<HTMLDivElement | null>;
}) => {
    const { t } = useTranslation('game-dicethrone');
    const heroLabel = t(`hero.${opponent.characterId}`);

    return (
        <div ref={containerRef} className="absolute top-3 left-0 right-0 z-50 flex flex-col items-center gap-1 pointer-events-none">
            {headerError && (
                <div className="px-[1.5vw] py-[0.5vw] bg-red-600/90 text-white font-bold text-[0.9vw] rounded-full shadow-2xl border border-red-400/50 backdrop-blur-md animate-in slide-in-from-top-4 pointer-events-auto flex items-center gap-[0.4vw]">
                    <AlertTriangle className="w-[1.1vw] h-[1.1vw]" />
                    <span>{headerError}</span>
                </div>
            )}
            <div className="flex justify-center items-center gap-[1vw] pointer-events-auto">
                <ShakeContainer
                    isShaking={isOpponentShaking}
                    onClick={() => {
                        if (shouldAutoObserve) return;
                        onToggleView();
                    }}
                    className={`
                        relative overflow-visible group px-[0.7vw] py-[0.3vw] rounded-[0.8vw] shadow-lg cursor-pointer transition-all duration-300
                        border
                        ${viewMode === 'opponent'
                            ? 'bg-amber-900/80 border-amber-500/50 shadow-[0_0_12px_rgba(245,158,11,0.2)]'
                            : 'bg-slate-900/95 border-white/10 hover:bg-slate-800 hover:border-white/20'}
                        ${isOpponentShaking ? '!border-red-500 !shadow-[0_0_12px_rgba(239,68,68,0.3)]' : ''}
                    `}
                >
                    <HitStopContainer
                        isActive={!!hitStopActive}
                        {...(hitStopConfig ?? {})}
                        className="w-full h-full"
                    >
                        <div className="relative flex items-center gap-[0.6vw] overflow-visible">
                            <div className="w-[2.8vw] h-[4vw] rounded-[0.4vw] border border-white/10 overflow-hidden relative bg-slate-950 shadow-inner">
                                <div className="w-full h-full transform transition-transform duration-500 group-hover:scale-110" style={getPortraitStyle(opponent.characterId, locale)} />
                                <div className={`absolute inset-0 bg-black/40 flex items-center justify-center backdrop-blur-[2px] transition-all duration-300 ${viewMode === 'opponent' ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                                    <svg viewBox="0 0 24 24" className="w-[1.6vw] h-[1.6vw] fill-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.9)]">
                                        <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-2.135-4.695-6.305-7.5-11-7.5zm0 12.5c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z" />
                                    </svg>
                                </div>
                            </div>
                            <div className="flex flex-col gap-[0.2vw] items-start">
                                <div className="flex items-center gap-[0.6vw]">
                                    <span className={`font-black text-[0.9vw] tracking-wider truncate max-w-[10vw] ${viewMode === 'opponent' ? 'text-amber-400' : 'text-slate-100'}`}>
                                        {opponentName}
                                    </span>
                                    <span className="px-[0.3vw] py-[0.1vw] bg-amber-500/10 text-amber-500 text-[0.55vw] font-bold uppercase tracking-widest rounded border border-amber-500/20 shadow-sm">{heroLabel}</span>

                                    <div ref={opponentHpRef} className="flex items-center gap-[0.4vw] ml-[0.2vw]">
                                        <div className="flex items-center gap-[0.2vw]">
                                            <div className="w-[0.5vw] h-[0.5vw] bg-red-500 rounded-full shadow-[0_0_6px_rgba(239,68,68,0.4)]"></div>
                                            <span className="text-red-400 font-bold text-[0.75vw]">{opponent.resources[RESOURCE_IDS.HP] ?? 0}</span>
                                        </div>
                                        <div className="flex items-center gap-[0.2vw]">
                                            <div className="w-[0.5vw] h-[0.5vw] bg-amber-500 rounded-full shadow-[0_0_6px_rgba(245,158,11,0.4)]"></div>
                                            <span className="text-amber-500 font-bold text-[0.75vw]">{opponent.resources[RESOURCE_IDS.CP] ?? 0}</span>
                                        </div>
                                        {opponent.damageShields && opponent.damageShields.length > 0 && (
                                            <div className="relative w-[1.1vw] h-[1.1vw] flex items-center justify-center">
                                                <svg className="w-full h-full text-cyan-500 drop-shadow-md" viewBox="0 1 24 25" fill="currentColor">
                                                    <path d="M12 2L3 7v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-9-5z" />
                                                </svg>
                                                <span className="absolute inset-0 flex items-center justify-center text-[0.5vw] font-bold text-white drop-shadow-md z-10 pb-[1px]">
                                                    {opponent.damageShields.reduce((sum, s) => sum + s.value, 0)}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div ref={opponentBuffRef} className="flex gap-[0.2vw] min-h-[1.2vw]">
                                    <TokensContainer
                                        tokens={opponent.tokens || {}}
                                        size="tiny"
                                        maxPerRow={10}
                                        locale={locale}
                                        atlas={statusIconAtlas}
                                    />
                                    <StatusEffectsContainer
                                        effects={opponent.statusEffects || {}}
                                        size="tiny"
                                        maxPerRow={10}
                                        locale={locale}
                                        atlas={statusIconAtlas}
                                    />
                                </div>
                            </div>

                        </div>
                    </HitStopContainer>
                </ShakeContainer>
            </div>
        </div>
    );
};
