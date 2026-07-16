import { type RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Layers } from 'lucide-react';
import type { HeroState } from '../types';
import { getDiceThroneCharacterNameKey } from '../domain/types';
import { RESOURCE_IDS } from '../domain/resources';
import type { TokenDef } from '../domain/tokenTypes';
import { ShakeContainer } from '../../../components/common/animations/ShakeContainer';
import {
    HitStopContainer,
    DamageFlash,
    type HitStopConfig,
} from '../../../components/common/animations';
import { useMobileViewport } from '../../../hooks/ui/useMobileViewport';
import { StatusEffectsContainer, TokensContainer, type StatusAtlases } from './statusEffects';
import { getPortraitStyle } from './assets';

type ViewMode = 'self' | 'opponent';
type HeaderTone = 'enemy' | 'ally';
type HeaderLayout = 'floating' | 'inline';

interface OpponentHeaderProps {
    opponent: HeroState;
    playerId?: string;
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
    opponentCpRef?: RefObject<HTMLDivElement | null>;
    statusIconAtlas?: StatusAtlases | null;
    locale?: string;
    containerRef?: RefObject<HTMLDivElement | null>;
    tokenDefinitions?: TokenDef[];
    damageFlashActive?: boolean;
    damageFlashDamage?: number;
    overrideHp?: number;
    selected?: boolean;
    observed?: boolean;
    compact?: boolean;
    tone?: HeaderTone;
    containerClassName?: string;
    allowPointerEvents?: boolean;
    layout?: HeaderLayout;
    disabled?: boolean;
    testId?: string;
}

export const OpponentHeader = ({
    opponent,
    playerId,
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
    opponentCpRef,
    statusIconAtlas,
    locale,
    containerRef,
    tokenDefinitions,
    damageFlashActive,
    damageFlashDamage,
    overrideHp,
    selected = false,
    observed,
    compact = false,
    tone = 'enemy',
    containerClassName,
    allowPointerEvents = false,
    layout = 'floating',
    disabled = false,
    testId,
}: OpponentHeaderProps) => {
    const { t } = useTranslation('game-dicethrone');
    const isMobileNarrowViewport = useMobileViewport();
    const heroLabel = t(getDiceThroneCharacterNameKey(opponent.characterId) ?? 'selection.notSelected');
    const isObserved = observed ?? viewMode === 'opponent';
    const pointerEventsClassName = allowPointerEvents ? 'pointer-events-auto' : 'pointer-events-none';
    const baseContainerClassName = isMobileNarrowViewport
        ? `flex flex-col items-center gap-[0.4vw] ${pointerEventsClassName} scale-[0.88] origin-top`
        : `flex flex-col items-center gap-1 ${pointerEventsClassName}`;
    const floatingPositionClassName = isMobileNarrowViewport
        ? 'absolute top-[0.2vw] left-0 right-0 z-50'
        : 'absolute top-3 left-0 right-0 z-50';
    const defaultContainerClassName = layout === 'inline'
        ? `relative ${baseContainerClassName}`
        : `${floatingPositionClassName} ${baseContainerClassName}`;
    const wrapperClassName = containerClassName
        ? `${defaultContainerClassName} ${containerClassName}`
        : defaultContainerClassName;

    const accent = tone === 'ally'
        ? {
            active: 'bg-emerald-950/85 border-emerald-400/60 shadow-[0_0_14px_rgba(16,185,129,0.25)]',
            selected: 'bg-slate-900/95 border-emerald-300/45 shadow-[0_0_10px_rgba(16,185,129,0.18)]',
            idle: 'bg-slate-900/95 border-white/10 hover:bg-slate-800 hover:border-emerald-300/35',
            text: isObserved || selected ? 'text-emerald-300' : 'text-slate-100',
            badge: 'bg-emerald-500/10 text-emerald-300 border-emerald-400/20',
            eye: 'fill-emerald-300 drop-shadow-[0_0_8px_rgba(52,211,153,0.9)]',
        }
        : {
            active: 'bg-amber-900/80 border-amber-500/50 shadow-[0_0_14px_rgba(245,158,11,0.22)]',
            selected: 'bg-slate-900/95 border-amber-300/45 shadow-[0_0_10px_rgba(245,158,11,0.16)]',
            idle: 'bg-slate-900/95 border-white/10 hover:bg-slate-800 hover:border-amber-300/35',
            text: isObserved || selected ? 'text-amber-400' : 'text-slate-100',
            badge: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
            eye: 'fill-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.9)]',
        };

    const shellClassName = compact
        ? 'px-[0.55vw] py-[0.28vw] rounded-[0.7vw]'
        : 'px-[0.7vw] py-[0.3vw] rounded-[0.8vw]';
    const bodyGapClassName = compact ? 'gap-[0.45vw]' : 'gap-[0.6vw]';
    const portraitClassName = compact
        ? 'w-[2.2vw] h-[3.2vw] rounded-[0.35vw]'
        : 'w-[2.8vw] h-[4vw] rounded-[0.4vw]';
    const nameClassName = compact
        ? 'font-black text-[0.72vw] tracking-wider truncate max-w-[7.5vw]'
        : 'font-black text-[0.9vw] tracking-wider truncate max-w-[10vw]';
    const badgeClassName = compact
        ? 'px-[0.24vw] py-[0.08vw] text-[0.48vw]'
        : 'px-[0.3vw] py-[0.1vw] text-[0.55vw]';
    const statClassName = compact ? 'text-[0.66vw]' : 'text-[0.75vw]';
    const iconDotClassName = compact ? 'w-[0.42vw] h-[0.42vw]' : 'w-[0.5vw] h-[0.5vw]';
    const handIconClassName = compact ? 'w-[0.62vw] h-[0.62vw]' : 'w-[0.7vw] h-[0.7vw]';
    const shieldClassName = compact ? 'w-[0.95vw] h-[0.95vw]' : 'w-[1.1vw] h-[1.1vw]';
    const shieldTextClassName = compact ? 'text-[0.42vw]' : 'text-[0.5vw]';
    const eyeClassName = compact ? 'w-[1.25vw] h-[1.25vw]' : 'w-[1.6vw] h-[1.6vw]';
    const buffMinHeightClassName = compact ? 'min-h-[1vw]' : 'min-h-[1.2vw]';

    const stateClassName = disabled
        ? 'bg-slate-950/85 border-white/5 opacity-55 saturate-75'
        : isObserved
        ? accent.active
        : selected
            ? accent.selected
            : accent.idle;

    return (
        <div
            ref={containerRef}
            className={wrapperClassName}
            data-testid={testId}
            data-team-tone={tone}
            data-player-id={playerId}
            data-player-seat-anchor={playerId}
        >
            {headerError && (
                <div className="px-[1.2vw] py-[0.4vw] bg-red-600/90 text-white font-bold text-[0.8vw] rounded-full shadow-2xl border border-red-400/50 backdrop-blur-md animate-in slide-in-from-top-4 pointer-events-auto flex items-center gap-[0.35vw]">
                    <AlertTriangle className="w-[0.95vw] h-[0.95vw]" />
                    <span>{headerError}</span>
                </div>
            )}

            <div className="flex justify-center items-center pointer-events-auto">
                <ShakeContainer
                    isShaking={isOpponentShaking}
                    onClick={() => {
                        if (disabled || shouldAutoObserve) return;
                        onToggleView();
                    }}
                    className={[
                        'relative overflow-visible group shadow-lg transition-all duration-300 border',
                        disabled ? 'cursor-not-allowed' : 'cursor-pointer',
                        shellClassName,
                        stateClassName,
                        isOpponentShaking ? '!border-red-500 !shadow-[0_0_12px_rgba(239,68,68,0.3)]' : '',
                    ].join(' ')}
                >
                    <HitStopContainer
                        isActive={!!hitStopActive}
                        {...(hitStopConfig ?? {})}
                        className="w-full h-full"
                    >
                        <div className={`relative flex items-center ${bodyGapClassName} overflow-visible`}>
                            <div className={`${portraitClassName} border border-white/10 overflow-hidden relative bg-slate-950 shadow-inner`}>
                                <div className="w-full h-full transform transition-transform duration-500 group-hover:scale-110" style={getPortraitStyle(opponent.characterId, locale)} />
                                <div className={`absolute inset-0 pointer-events-none bg-black/40 flex items-center justify-center backdrop-blur-[2px] transition-all duration-300 ${isObserved ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                                    <svg viewBox="0 0 24 24" className={`${eyeClassName} ${accent.eye}`}>
                                        <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-2.135-4.695-6.305-7.5-11-7.5zm0 12.5c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z" />
                                    </svg>
                                </div>
                            </div>

                            <div className="flex flex-col gap-[0.2vw] items-start">
                                <div className={`flex items-center ${bodyGapClassName}`}>
                                    <span className={`${nameClassName} ${accent.text}`}>
                                        {opponentName}
                                    </span>
                                    <span className={`${badgeClassName} ${accent.badge} font-bold uppercase tracking-widest rounded border shadow-sm`}>
                                        {heroLabel}
                                    </span>

                                    <div ref={opponentHpRef} className={`flex items-center gap-[0.3vw] ${compact ? 'ml-[0.05vw]' : 'ml-[0.2vw]'}`}>
                                        <div className="flex items-center gap-[0.2vw]">
                                            <div className={`${iconDotClassName} bg-red-500 rounded-full shadow-[0_0_6px_rgba(239,68,68,0.4)]`} />
                                            <span
                                                className={`text-red-400 font-bold ${statClassName}`}
                                                data-testid={testId ? `${testId}-hp` : undefined}
                                            >
                                                {overrideHp ?? (opponent.resources[RESOURCE_IDS.HP] ?? 0)}
                                            </span>
                                        </div>
                                        <div ref={opponentCpRef} className="flex items-center gap-[0.2vw]">
                                            <div className={`${iconDotClassName} bg-amber-500 rounded-full shadow-[0_0_6px_rgba(245,158,11,0.4)]`} />
                                            <span className={`text-amber-500 font-bold ${statClassName}`}>{opponent.resources[RESOURCE_IDS.CP] ?? 0}</span>
                                        </div>
                                        <div className="flex items-center gap-[0.2vw]">
                                            <Layers className={`${handIconClassName} text-sky-400 drop-shadow-[0_0_4px_rgba(56,189,248,0.5)]`} />
                                            <span className={`text-sky-400 font-bold ${statClassName}`}>{opponent.hand.length}</span>
                                        </div>
                                        {opponent.damageShields && opponent.damageShields.length > 0 && (
                                            <div className={`relative ${shieldClassName} flex items-center justify-center`}>
                                                <svg className="w-full h-full text-cyan-500 drop-shadow-md" viewBox="0 1 24 25" fill="currentColor">
                                                    <path d="M12 2L3 7v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-9-5z" />
                                                </svg>
                                                <span className={`absolute inset-0 flex items-center justify-center font-bold text-white drop-shadow-md z-10 pb-[1px] ${shieldTextClassName}`}>
                                                    {opponent.damageShields.reduce((sum, s) => sum + s.value, 0)}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div ref={opponentBuffRef} className={`flex gap-[0.2vw] ${buffMinHeightClassName}`}>
                                    <TokensContainer
                                        tokens={opponent.tokens || {}}
                                        size="tiny"
                                        maxPerRow={10}
                                        locale={locale}
                                        atlas={statusIconAtlas}
                                        tokenDefinitions={tokenDefinitions}
                                        tokenStackLimits={opponent.tokenStackLimits}
                                        testIdPrefix={playerId ? `dt-player-${playerId}-token` : undefined}
                                    />
                                    <StatusEffectsContainer
                                        effects={opponent.statusEffects || {}}
                                        size="tiny"
                                        maxPerRow={10}
                                        locale={locale}
                                        atlas={statusIconAtlas}
                                        testIdPrefix={playerId ? `dt-player-${playerId}-status` : undefined}
                                    />
                                </div>
                            </div>
                        </div>
                    </HitStopContainer>

                    <DamageFlash
                        active={!!damageFlashActive}
                        damage={damageFlashDamage ?? 1}
                        intensity={(damageFlashDamage ?? 0) >= 5 ? 'strong' : 'normal'}
                        showNumber={false}
                    />
                </ShakeContainer>
            </div>
        </div>
    );
};
