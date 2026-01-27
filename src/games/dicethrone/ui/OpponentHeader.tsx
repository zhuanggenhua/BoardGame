import type { RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import type { HeroState } from '../types';
import { RESOURCE_IDS } from '../domain/resources';
import { ShakeContainer } from '../../../components/common/animations/ShakeContainer';
import { StatusEffectsContainer, TokensContainer, type StatusIconAtlasConfig } from './statusEffects';
import { getPortraitStyle } from './assets';

type ViewMode = 'self' | 'opponent';

export const OpponentHeader = ({
    opponent,
    opponentName,
    viewMode,
    isOpponentShaking,
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
    shouldAutoObserve: boolean;
    onToggleView: () => void;
    headerError?: string | null;
    opponentBuffRef?: RefObject<HTMLDivElement | null>;
    opponentHpRef?: RefObject<HTMLDivElement | null>;
    statusIconAtlas?: StatusIconAtlasConfig | null;
    locale?: string;
    /** 对手悬浮窗容器引用（用于卡牌特写动画起点） */
    containerRef?: RefObject<HTMLDivElement | null>;
}) => {
    const { t } = useTranslation('game-dicethrone');

    return (
        <div ref={containerRef} className="absolute top-[0.8vw] left-0 right-0 z-50 flex flex-col items-center gap-[0.5vw]">
            {headerError && (
                <div className="px-[1.5vw] py-[0.5vw] bg-red-600/90 text-white font-bold text-[0.9vw] rounded-full shadow-2xl border border-red-400/50 backdrop-blur-md animate-in slide-in-from-top-4">
                    ⚠️ {headerError}
                </div>
            )}
            <div className="flex justify-center items-center gap-[1vw]">
                <ShakeContainer
                    isShaking={isOpponentShaking}
                    onClick={() => {
                        if (shouldAutoObserve) return;
                        onToggleView();
                    }}
                    className={`group bg-slate-900/80 backdrop-blur-md border border-slate-700 px-[0.75vw] py-[0.3vw] rounded-[0.8vw] shadow-2xl flex items-center gap-[0.8vw] cursor-pointer hover:bg-slate-800 transition-[background-color] duration-200 ${viewMode === 'opponent' ? 'border-amber-500/50 bg-slate-800' : ''} ${isOpponentShaking ? 'border-red-500' : ''}`}
                >
                    <div className="w-[2.6vw] h-[3.4vw] rounded-[0.3vw] border border-slate-600 overflow-hidden relative bg-slate-800">
                        <div className="w-full h-full" style={getPortraitStyle(opponent.characterId, locale)} />
                        <div className={`absolute inset-0 bg-amber-500/40 flex items-center justify-center backdrop-blur-[1px] transition-opacity duration-200 ${viewMode === 'opponent' ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                            <svg viewBox="0 0 24 24" className="w-[1.6vw] h-[1.6vw] fill-white drop-shadow-[0_0_8px_rgba(251,191,36,0.9)]">
                                <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-2.135-4.695-6.305-7.5-11-7.5zm0 12.5c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z" />
                            </svg>
                        </div>
                    </div>
                    <div className="flex flex-col">
                        <div className="flex items-center gap-[0.4vw]">
                            <span className={`font-black text-[0.9vw] tracking-wider truncate max-w-[8vw] ${viewMode === 'opponent' ? 'text-amber-400' : 'text-white'}`}>
                                {opponentName}
                            </span>
                            <span className="px-[0.4vw] py-[0.1vw] bg-amber-500/20 text-amber-400 text-[0.55vw] rounded border border-amber-500/30">{t('hero.monk')}</span>
                            <div ref={opponentHpRef} className="flex items-center gap-[0.5vw] ml-[0.3vw]">
                                <div className="flex items-center gap-[0.3vw]">
                                    <div className="w-[0.6vw] h-[0.6vw] bg-red-500 rounded-full shadow-red-500/50"></div>
                                    <span className="text-red-400 font-bold text-[0.8vw]">{opponent.resources[RESOURCE_IDS.HP] ?? 0}</span>
                                </div>
                                {opponent.damageShields && opponent.damageShields.length > 0 && (
                                    <div className="relative w-[1.2vw] h-[1.2vw]">
                                        <svg className="w-full h-full text-cyan-500" viewBox="0 1 24 25" fill="currentColor">
                                            <path d="M12 2L3 7v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-9-5z" />
                                        </svg>
                                        <span className="absolute inset-0 flex items-center justify-center text-[0.55vw] font-bold text-white drop-shadow-md">
                                            {opponent.damageShields.reduce((sum, s) => sum + s.value, 0)}
                                        </span>
                                    </div>
                                )}
                                <div className="flex items-center gap-[0.3vw]">
                                    <div className="w-[0.7vw] h-[0.7vw] bg-amber-500 rounded-full shadow-amber-500/50"></div>
                                    <span className="text-amber-400 font-bold text-[0.8vw]">{opponent.resources[RESOURCE_IDS.CP] ?? 0}</span>
                                </div>
                            </div>
                        </div>
                        <div ref={opponentBuffRef} className="flex gap-[0.25vw] mt-[0.15vw]">
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
                </ShakeContainer>
            </div>
        </div>
    );
};
