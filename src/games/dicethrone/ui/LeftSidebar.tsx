import React from 'react';
import type { CSSProperties, RefObject } from 'react';
import type { HeroState, TurnPhase } from '../types';
import type { TokenDef } from '../domain/tokenTypes';
import { PhaseIndicator } from './PhaseIndicator';
import { StatusEffectsContainer, TokensContainer, type StatusAtlases } from './statusEffects';
import { PlayerStats } from './PlayerStats';
import { DrawDeck } from './DrawDeck';
import { STATUS_IDS, TOKEN_IDS } from '../domain/ids';
import type { HitStopConfig } from '../../../components/common/animations';
import { UI_Z_INDEX } from '../../../core';
import { AutoResponseToggle } from './AutoResponseToggle';
import { buildBoardShellInlineUnitValue } from '../../../shared/runtimeLayoutUnits';

const dtUnit = buildBoardShellInlineUnitValue;

export const LeftSidebar = ({
    currentPhase,
    viewPlayer,
    playerId,
    locale,
    statusIconAtlas,
    selfBuffRef,
    selfHpRef,
    selfCpRef,
    hitStopActive,
    hitStopConfig,
    drawDeckRef,
    onPurifyClick,
    canUsePurify,
    onFlightClick,
    canUseFlight,
    onNyraBondHealClick,
    canUseNyraBondHeal,
    tokenDefinitions,
    onKnockdownClick,
    canRemoveKnockdown,
    isSelfShaking,
    isSelfCpShaking,
    selfDamageFlashActive,
    selfDamageFlashDamage,
    overrideHp,
    onAutoResponseToggle,
    responseTokenIds,
    onResponseTokenClick,
    activeTokenIds,
    onActiveTokenClick,
    isHandHidden,
    onToggleHandHidden,
}: {
    currentPhase: TurnPhase;
    viewPlayer: HeroState;
    playerId?: string;
    locale?: string;
    statusIconAtlas?: StatusAtlases | null;
    selfBuffRef?: RefObject<HTMLDivElement | null>;
    selfHpRef?: RefObject<HTMLDivElement | null>;
    selfCpRef?: RefObject<HTMLDivElement | null>;
    hitStopActive?: boolean;
    hitStopConfig?: HitStopConfig;
    drawDeckRef?: RefObject<HTMLDivElement | null>;
    /** 点击净化 Token 的回调 */
    onPurifyClick?: () => void;
    /** 是否可以使用净化（有净化 Token 且有负面状态） */
    canUsePurify?: boolean;
    /** 点击飞行 Token 的回调 */
    onFlightClick?: () => void;
    /** 是否可以使用飞行（进攻/防御掷骰阶段且有待处理攻击） */
    canUseFlight?: boolean;
    /** 点击妮拉之系 Token 主动治疗妮拉的回调 */
    onNyraBondHealClick?: () => void;
    /** 是否可以主动消耗妮拉之系治疗妮拉 */
    canUseNyraBondHeal?: boolean;
    /** Token 定义列表（用于判断哪些 Token 可点击） */
    tokenDefinitions?: TokenDef[];
    /** 点击击倒状态的回调 */
    onKnockdownClick?: () => void;
    /** 是否可以移除击倒（有击倒状态且 CP >= 2 且在正确阶段） */
    canRemoveKnockdown?: boolean;
    /** 自己是否正在震动（受击） */
    isSelfShaking?: boolean;
    /** 自己 CP 条是否正在震动 */
    isSelfCpShaking?: boolean;
    /** 自己受击 DamageFlash 是否激活 */
    selfDamageFlashActive?: boolean;
    /** 自己受击伤害值 */
    selfDamageFlashDamage?: number;
    /** 视觉状态缓冲覆盖的 HP 值（飞行动画到达前冻结） */
    overrideHp?: number;
    /** 自动响应开关回调 */
    onAutoResponseToggle?: (enabled: boolean) => void;
    /** 当前响应中可直接点击使用的 Token。提示与跳过由手牌上方的共享响应框承接。 */
    responseTokenIds?: string[];
    onResponseTokenClick?: (tokenId: string) => void;
    /** 当前非响应窗口中可从 Token 本体主动点击使用的 Token。 */
    activeTokenIds?: string[];
    onActiveTokenClick?: (tokenId: string) => void;
    /** 手牌层是否临时隐藏，仅影响本地 UI。 */
    isHandHidden?: boolean;
    onToggleHandHidden?: () => void;
}) => {
    const leftSidebarStyle = {
        zIndex: UI_Z_INDEX.hud,
        left: dtUnit(1.5),
        bottom: dtUnit(1.5),
        width: dtUnit(16),
    } as CSSProperties;
    const clickableTokenIds = React.useMemo(() => Array.from(new Set([
        ...(responseTokenIds ?? []),
        ...(activeTokenIds ?? []),
        ...(canUsePurify
            ? (tokenDefinitions ?? []).filter(def => def.activeUse?.effect.type === 'removeDebuff').map(def => def.id)
            : []),
        ...(canUseFlight ? [TOKEN_IDS.FLIGHT] : []),
        ...(canUseNyraBondHeal ? [TOKEN_IDS.NYRAS_BOND] : []),
    ])), [
        activeTokenIds,
        canUseFlight,
        canUseNyraBondHeal,
        canUsePurify,
        responseTokenIds,
        tokenDefinitions,
    ]);

    return (
        <div
            className="dt-left-sidebar absolute top-0 flex flex-col items-center pointer-events-none"
            style={leftSidebarStyle}
            data-testid="left-sidebar"
            data-dicethrone-left-hud-density="normal"
        >
            {/* 回合顺序 - 上移 */}
            <div
                className="dt-left-sidebar__turn-order-panel w-full pt-[0.2rem]"
                style={{ paddingInline: dtUnit(1) }}
                data-testid="turn-order-panel"
            >
                <PhaseIndicator currentPhase={currentPhase} />
            </div>
            <div className="flex-grow" />
            <div
                className="dt-left-sidebar__self-panel-group relative w-full flex flex-col items-center pointer-events-auto"
                style={{ gap: dtUnit(0.5) }}
                data-testid="self-player-panel-group"
            >
                {/*
                 * selfBuffRef is used as the end position for buff/status flying effects.
                 * Use a small offset above the HP container so the effect doesn't land too low.
                 */}
                <div
                    className="dt-left-sidebar__status-tokens relative w-full flex flex-col-reverse"
                    style={{ gap: dtUnit(0.3), paddingInline: dtUnit(1.2) }}
                    ref={selfBuffRef}
                    data-tutorial-id="status-tokens"
                >
                    <TokensContainer
                        tokens={viewPlayer.tokens ?? {}}
                        maxPerRow={5}
                        size="normal"
                        gapUnits={0.3}
                        className="flex-wrap-reverse justify-start"
                        locale={locale}
                        atlas={statusIconAtlas}
                        characterId={viewPlayer.characterId}
                        tokenDefinitions={tokenDefinitions}
                        tokenStackLimits={viewPlayer.tokenStackLimits}
                        testIdPrefix={playerId ? `dt-player-${playerId}-token` : undefined}
                        onTokenClick={(tokenId) => {
                            if (responseTokenIds?.includes(tokenId)) {
                                onResponseTokenClick?.(tokenId);
                                return;
                            }
                            if (activeTokenIds?.includes(tokenId)) {
                                onActiveTokenClick?.(tokenId);
                                return;
                            }
                            if (tokenId === TOKEN_IDS.FLIGHT && onFlightClick) {
                                onFlightClick();
                                return;
                            }
                            if (tokenId === TOKEN_IDS.NYRAS_BOND && canUseNyraBondHeal && onNyraBondHealClick) {
                                onNyraBondHealClick();
                                return;
                            }
                            // 从定义中查找该 Token 是否有 removeDebuff 效果（即净化类 Token）
                            const tokenDef = tokenDefinitions?.find(def => def.id === tokenId);
                            if (tokenDef?.activeUse?.effect.type === 'removeDebuff' && onPurifyClick) {
                                onPurifyClick();
                            }
                        }}
                        clickableTokens={clickableTokenIds}
                    />
                    <StatusEffectsContainer
                        effects={viewPlayer.statusEffects ?? {}}
                        maxPerRow={5}
                        size="normal"
                        gapUnits={0.3}
                        className="flex-wrap-reverse justify-start"
                        locale={locale}
                        atlas={statusIconAtlas}
                        characterId={viewPlayer.characterId}
                        testIdPrefix={playerId ? `dt-player-${playerId}-status` : undefined}
                        onEffectClick={(effectId) => {
                            if (effectId === STATUS_IDS.KNOCKDOWN && onKnockdownClick) {
                                onKnockdownClick();
                            }
                        }}
                        clickableEffects={canRemoveKnockdown ? [STATUS_IDS.KNOCKDOWN] : []}
                    />
                </div>
                {/* 血条和自动响应开关容器 */}
                <div
                    className="dt-left-sidebar__stats w-full"
                    style={{ paddingInline: dtUnit(1) }}
                    data-testid="dt-player-stats-panel"
                    data-tutorial-id="player-stats"
                >
                    <div className="w-full flex flex-col" style={{ gap: dtUnit(0.4) }}>
                        <PlayerStats
                            player={viewPlayer}
                            hpRef={selfHpRef}
                            cpRef={selfCpRef}
                            hitStopActive={hitStopActive}
                            hitStopConfig={hitStopConfig}
                            isHpShaking={isSelfShaking}
                            isCpShaking={isSelfCpShaking}
                            damageFlashActive={selfDamageFlashActive}
                            damageFlashDamage={selfDamageFlashDamage}
                            overrideHp={overrideHp}
                        />
                        {/* 自动响应开关 - 相对血条居中 */}
                        <div className="flex justify-center">
                            <AutoResponseToggle
                                onToggle={onAutoResponseToggle}
                            />
                        </div>
                    </div>
                </div>
                <div
                    className="dt-left-sidebar__draw-deck w-full"
                    style={{ paddingInline: dtUnit(1), paddingTop: dtUnit(0.3) }}
                    data-tutorial-id="draw-deck"
                    data-player-seat-anchor={playerId}
                >
                    <DrawDeck
                        ref={drawDeckRef}
                        count={viewPlayer.deck.length}
                        locale={locale}
                        isHandHidden={isHandHidden}
                        onToggleHandHidden={onToggleHandHidden}
                    />
                </div>
            </div>
        </div>
    );
};
