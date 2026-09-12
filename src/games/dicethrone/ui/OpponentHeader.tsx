import { type CSSProperties, type RefObject } from 'react';
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
import { StatusEffectsContainer, TokensContainer, type StatusAtlases } from './statusEffects';
import { getPortraitStyle } from './assets';
import { buildBoardShellInlineUnitValue } from '../../../shared/runtimeLayoutUnits';

type ViewMode = 'self' | 'opponent';
type HeaderTone = 'enemy' | 'ally';
type HeaderLayout = 'floating' | 'inline';
const dtUnit = buildBoardShellInlineUnitValue;

interface OpponentHeaderProps {
    opponent: HeroState;
    playerId?: string;
    opponentName: string;
    viewMode: ViewMode;
    isOpponentShaking: boolean;
    isOpponentCpShaking?: boolean;
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
    isOpponentCpShaking,
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
    const heroLabel = t(getDiceThroneCharacterNameKey(opponent.characterId) ?? 'selection.notSelected');
    const isObserved = observed ?? viewMode === 'opponent';
    const pointerEventsClassName = allowPointerEvents ? 'pointer-events-auto' : 'pointer-events-none';
    const feedbackPlayerId = playerId ?? opponent.id;
    const baseContainerClassName = `flex flex-col items-center ${pointerEventsClassName}`;
    const baseContainerStyle: CSSProperties = { gap: dtUnit(0.4) };
    const floatingPositionClassName = 'absolute left-0 right-0 z-50';
    const defaultContainerClassName = layout === 'inline'
        ? `relative ${baseContainerClassName}`
        : `${floatingPositionClassName} ${baseContainerClassName}`;
    const wrapperClassName = containerClassName
        ? `${defaultContainerClassName} ${containerClassName}`
        : defaultContainerClassName;
    const wrapperStyle: CSSProperties = layout === 'inline'
        ? baseContainerStyle
        : { ...baseContainerStyle, top: dtUnit(0.625) };

    const accent = tone === 'ally'
        ? {
            active: 'bg-emerald-950/85 border-emerald-400/60 shadow-[0_0_14px_rgba(16,185,129,0.25)]',
            selected: 'bg-slate-900/95 border-emerald-300/45 shadow-[0_0_10px_rgba(16,185,129,0.18)]',
            idle: 'bg-slate-900/95 border-white/10 hover:bg-slate-800 hover:border-emerald-300/35',
            text: isObserved || selected ? 'text-emerald-300' : 'text-slate-100',
            badge: 'bg-emerald-500/10 text-emerald-300 border-emerald-400/20',
            eye: 'fill-emerald-300',
            eyeFilter: `drop-shadow(0 0 ${dtUnit(0.42)} rgba(52,211,153,0.9))`,
        }
        : {
            active: 'bg-amber-900/80 border-amber-500/50 shadow-[0_0_14px_rgba(245,158,11,0.22)]',
            selected: 'bg-slate-900/95 border-amber-300/45 shadow-[0_0_10px_rgba(245,158,11,0.16)]',
            idle: 'bg-slate-900/95 border-white/10 hover:bg-slate-800 hover:border-amber-300/35',
            text: isObserved || selected ? 'text-amber-400' : 'text-slate-100',
            badge: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
            eye: 'fill-amber-400',
            eyeFilter: `drop-shadow(0 0 ${dtUnit(0.42)} rgba(251,191,36,0.9))`,
        };

    const shellClassName = compact
        ? 'px-0 py-0 rounded-none'
        : 'px-0 py-0 rounded-none';
    const shellStyle: CSSProperties = compact
        ? { paddingInline: dtUnit(0.55), paddingBlock: dtUnit(0.28), borderRadius: dtUnit(0.7) }
        : { paddingInline: dtUnit(0.7), paddingBlock: dtUnit(0.3), borderRadius: dtUnit(0.8) };
    const bodyGapStyle: CSSProperties = { gap: compact ? dtUnit(0.45) : dtUnit(0.6) };
    const portraitStyle: CSSProperties = compact
        ? { width: dtUnit(2.2), height: dtUnit(3.2), borderRadius: dtUnit(0.35) }
        : { width: dtUnit(2.8), height: dtUnit(4), borderRadius: dtUnit(0.4) };
    const nameClassName = compact
        ? 'font-black tracking-wider truncate'
        : 'font-black tracking-wider truncate';
    const nameStyle: CSSProperties = compact
        ? { fontSize: dtUnit(0.72), maxWidth: dtUnit(7.5) }
        : { fontSize: dtUnit(0.9), maxWidth: dtUnit(10) };
    const badgeStyle: CSSProperties = compact
        ? { paddingInline: dtUnit(0.24), paddingBlock: dtUnit(0.08), fontSize: dtUnit(0.48) }
        : { paddingInline: dtUnit(0.3), paddingBlock: dtUnit(0.1), fontSize: dtUnit(0.55) };
    const statStyle: CSSProperties = { fontSize: compact ? dtUnit(0.66) : dtUnit(0.75) };
    const resourceStatClassName = 'relative flex items-center justify-center';
    const resourceStatStyle: CSSProperties = compact
        ? {
            height: dtUnit(1.08),
            minWidth: dtUnit(1.45),
            gap: dtUnit(0.16),
            paddingInline: dtUnit(0.08),
            fontSize: dtUnit(0.68),
            filter: `drop-shadow(0 1px ${dtUnit(0.35)} rgba(0,0,0,0.9))`,
        }
        : {
            height: dtUnit(1.24),
            minWidth: dtUnit(1.72),
            gap: dtUnit(0.2),
            paddingInline: dtUnit(0.1),
            fontSize: dtUnit(0.78),
            filter: `drop-shadow(0 1px ${dtUnit(0.35)} rgba(0,0,0,0.9))`,
        };
    const resourceDotStyle: CSSProperties = compact
        ? { width: dtUnit(0.36), height: dtUnit(0.36), boxShadow: `0 0 ${dtUnit(0.45)} rgba(248,113,113,0.72)` }
        : { width: dtUnit(0.44), height: dtUnit(0.44), boxShadow: `0 0 ${dtUnit(0.45)} rgba(248,113,113,0.72)` };
    const cpDotStyle: CSSProperties = { ...resourceDotStyle, boxShadow: `0 0 ${dtUnit(0.45)} rgba(252,211,77,0.72)` };
    const handIconStyle: CSSProperties = compact
        ? { width: dtUnit(0.62), height: dtUnit(0.62) }
        : { width: dtUnit(0.7), height: dtUnit(0.7) };
    const shieldStyle: CSSProperties = compact
        ? { width: dtUnit(0.95), height: dtUnit(0.95) }
        : { width: dtUnit(1.1), height: dtUnit(1.1) };
    const shieldTextStyle: CSSProperties = { fontSize: compact ? dtUnit(0.42) : dtUnit(0.5) };
    const eyeStyle: CSSProperties = compact
        ? { width: dtUnit(1.25), height: dtUnit(1.25), filter: accent.eyeFilter }
        : { width: dtUnit(1.6), height: dtUnit(1.6), filter: accent.eyeFilter };
    const buffStyle: CSSProperties = {
        gap: dtUnit(0.2),
        minHeight: compact ? dtUnit(1) : dtUnit(1.2),
    };
    const headerErrorStyle: CSSProperties = {
        paddingInline: dtUnit(1.2),
        paddingBlock: dtUnit(0.4),
        fontSize: dtUnit(0.8),
        gap: dtUnit(0.35),
    };

    const stateClassName = disabled
        ? 'bg-slate-950/85 border-white/5 opacity-55 saturate-75'
        : isObserved
        ? accent.active
        : selected
            ? accent.selected
            : accent.idle;
    const hpValue = overrideHp ?? (opponent.resources[RESOURCE_IDS.HP] ?? 0);
    const cpValue = opponent.resources[RESOURCE_IDS.CP] ?? 0;

    return (
        <div
            ref={containerRef}
            className={wrapperClassName}
            style={wrapperStyle}
            data-testid={testId}
            data-team-tone={tone}
            data-player-id={playerId}
            data-player-seat-anchor={playerId}
        >
            {headerError && (
                <div
                    className="bg-red-600/90 text-white font-bold rounded-full shadow-2xl border border-red-400/50 backdrop-blur-md animate-in slide-in-from-top-4 pointer-events-auto flex items-center"
                    style={headerErrorStyle}
                >
                    <AlertTriangle style={{ width: dtUnit(0.95), height: dtUnit(0.95) }} />
                    <span>{headerError}</span>
                </div>
            )}

            <div className="flex justify-center items-center pointer-events-auto">
                <div
                    onClick={() => {
                        if (disabled) return;
                        onToggleView();
                    }}
                    className={[
                        'relative overflow-visible group shadow-lg transition-[background-color,border-color,box-shadow,opacity,filter] duration-300 border',
                        disabled ? 'cursor-not-allowed' : 'cursor-pointer',
                        shellClassName,
                        stateClassName,
                    ].join(' ')}
                    style={shellStyle}
                >
                    <div className="relative flex items-center overflow-visible" style={bodyGapStyle}>
                        <div className="border border-white/10 overflow-hidden relative bg-slate-950 shadow-inner" style={portraitStyle}>
                            <div className="w-full h-full transform transition-transform duration-500 group-hover:scale-110" style={getPortraitStyle(opponent.characterId, locale)} />
                            <div className={`absolute inset-0 pointer-events-none bg-black/40 flex items-center justify-center backdrop-blur-[2px] transition-[opacity,background-color] duration-300 ${isObserved ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                                <svg viewBox="0 0 24 24" className={accent.eye} style={eyeStyle}>
                                    <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-2.135-4.695-6.305-7.5-11-7.5zm0 12.5c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z" />
                                </svg>
                            </div>
                        </div>

                        <div className="flex flex-col items-start" style={{ gap: dtUnit(0.2) }}>
                            <div className="flex items-center" style={bodyGapStyle}>
                                <span className={`${nameClassName} ${accent.text}`} style={nameStyle}>
                                    {opponentName}
                                </span>
                                <span className={`${accent.badge} font-bold uppercase tracking-widest rounded border shadow-sm`} style={badgeStyle}>
                                    {heroLabel}
                                </span>

                                <div
                                    className="flex items-center"
                                    style={{ gap: dtUnit(0.32), marginLeft: compact ? dtUnit(0.05) : dtUnit(0.2) }}
                                >
                                    <div ref={opponentHpRef}>
                                        <ShakeContainer isShaking={isOpponentShaking}>
                                            <HitStopContainer
                                                isActive={!!hitStopActive}
                                                {...(hitStopConfig ?? {})}
                                                className="w-full"
                                            >
                                                <div
                                                    className={`${resourceStatClassName} text-red-100`}
                                                    style={resourceStatStyle}
                                                    data-testid={testId ? `${testId}-hp` : undefined}
                                                    data-feedback-game="dicethrone"
                                                    data-feedback-player-id={feedbackPlayerId}
                                                    data-feedback-resource={RESOURCE_IDS.HP}
                                                    data-feedback-resource-value={hpValue}
                                                    aria-label={`HP ${hpValue}`}
                                                    title={`HP ${hpValue}`}
                                                >
                                                    <span
                                                        className="rounded-full bg-red-400"
                                                        style={resourceDotStyle}
                                                        aria-hidden="true"
                                                        data-testid={testId ? `${testId}-hp-dot` : undefined}
                                                    />
                                                    <span
                                                        className="font-black leading-none tabular-nums tracking-wide"
                                                        data-testid={testId ? `${testId}-hp-value` : undefined}
                                                    >
                                                        {hpValue}
                                                    </span>
                                                    <DamageFlash
                                                        active={!!damageFlashActive}
                                                        damage={damageFlashDamage ?? 1}
                                                        intensity={(damageFlashDamage ?? 0) >= 5 ? 'strong' : 'normal'}
                                                        showNumber={false}
                                                    />
                                                </div>
                                            </HitStopContainer>
                                        </ShakeContainer>
                                    </div>
                                    <div ref={opponentCpRef}>
                                        <ShakeContainer isShaking={!!isOpponentCpShaking}>
                                            <div
                                                className={`${resourceStatClassName} text-amber-100`}
                                                style={resourceStatStyle}
                                                data-testid={testId ? `${testId}-cp` : undefined}
                                                data-feedback-game="dicethrone"
                                                data-feedback-player-id={feedbackPlayerId}
                                                data-feedback-resource={RESOURCE_IDS.CP}
                                                data-feedback-resource-value={cpValue}
                                                aria-label={`CP ${cpValue}`}
                                                title={`CP ${cpValue}`}
                                            >
                                                <span
                                                    className="rounded-full bg-amber-300"
                                                    style={cpDotStyle}
                                                    aria-hidden="true"
                                                    data-testid={testId ? `${testId}-cp-dot` : undefined}
                                                />
                                                <span
                                                    className="font-black leading-none tabular-nums tracking-wide"
                                                    data-testid={testId ? `${testId}-cp-value` : undefined}
                                                >
                                                    {cpValue}
                                                </span>
                                            </div>
                                        </ShakeContainer>
                                    </div>
                                    <div className="flex items-center" style={{ gap: dtUnit(0.2) }}>
                                        <Layers
                                            className="text-sky-400"
                                            style={{ ...handIconStyle, filter: `drop-shadow(0 0 ${dtUnit(0.2)} rgba(56,189,248,0.5))` }}
                                        />
                                        <span className="text-sky-400 font-bold" style={statStyle}>{opponent.hand.length}</span>
                                    </div>
                                    {opponent.damageShields && opponent.damageShields.length > 0 && (
                                        <div className="relative flex items-center justify-center" style={shieldStyle}>
                                            <svg className="w-full h-full text-cyan-500 drop-shadow-md" viewBox="0 1 24 25" fill="currentColor">
                                                <path d="M12 2L3 7v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-9-5z" />
                                            </svg>
                                            <span className="absolute inset-0 flex items-center justify-center font-bold text-white drop-shadow-md z-10 pb-[1px]" style={shieldTextStyle}>
                                                {opponent.damageShields.reduce((sum, s) => sum + s.value, 0)}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div ref={opponentBuffRef} className="flex" style={buffStyle}>
                                <TokensContainer
                                    tokens={opponent.tokens || {}}
                                    size="tiny"
                                    maxPerRow={10}
                                    locale={locale}
                                    atlas={statusIconAtlas}
                                    characterId={opponent.characterId}
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
                                    characterId={opponent.characterId}
                                    testIdPrefix={playerId ? `dt-player-${playerId}-status` : undefined}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
