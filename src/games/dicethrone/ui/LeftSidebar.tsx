import type { RefObject } from 'react';
import type { HeroState, TurnPhase } from '../types';
import type { TokenDef } from '../domain/tokenTypes';
import { PhaseIndicator } from './PhaseIndicator';
import { StatusEffectsContainer, TokensContainer, type StatusAtlases } from './statusEffects';
import { PlayerStats } from './PlayerStats';
import { DrawDeck } from './DrawDeck';
import { STATUS_IDS } from '../domain/ids';
import type { HitStopConfig } from '../../../components/common/animations';
import { UI_Z_INDEX } from '../../../core';


export const LeftSidebar = ({
    currentPhase,
    viewPlayer,
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
    tokenDefinitions,
    onKnockdownClick,
    canRemoveKnockdown,
    isSelfShaking,
    selfDamageFlashActive,
    selfDamageFlashDamage,
    overrideHp,
}: {
    currentPhase: TurnPhase;
    viewPlayer: HeroState;
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
    /** Token 定义列表（用于判断哪些 Token 可点击） */
    tokenDefinitions?: TokenDef[];
    /** 点击击倒状态的回调 */
    onKnockdownClick?: () => void;
    /** 是否可以移除击倒（有击倒状态且 CP >= 2 且在正确阶段） */
    canRemoveKnockdown?: boolean;
    /** 自己是否正在震动（受击） */
    isSelfShaking?: boolean;
    /** 自己受击 DamageFlash 是否激活 */
    selfDamageFlashActive?: boolean;
    /** 自己受击伤害值 */
    selfDamageFlashDamage?: number;
    /** 视觉状态缓冲覆盖的 HP 值（飞行动画到达前冻结） */
    overrideHp?: number;
}) => {
    return (
        <div
            className="absolute left-[1.5vw] top-0 bottom-[1.5vw] w-[15vw] flex flex-col items-center pointer-events-auto"
            style={{ zIndex: UI_Z_INDEX.hud }}
        >
            <div className="w-full pt-[1.125rem] px-[1vw]"><PhaseIndicator currentPhase={currentPhase} /></div>
            <div className="flex-grow" />
            <div className="w-full flex flex-col items-center gap-[0.5vw]">
                {/*
                 * selfBuffRef is used as the end position for buff/status flying effects.
                 * Use a small offset above the HP container so the effect doesn't land too low.
                 */}
                <div
                    className="w-full px-[1.2vw] flex flex-col-reverse gap-[0.3vw]"
                    ref={selfBuffRef}
                    data-tutorial-id="status-tokens"
                >
                    <TokensContainer
                        tokens={viewPlayer.tokens ?? {}}
                        maxPerRow={5}
                        size="normal"
                        className="flex-wrap-reverse justify-start gap-[0.3vw]"
                        locale={locale}
                        atlas={statusIconAtlas}
                        tokenDefinitions={tokenDefinitions}
                        tokenStackLimits={viewPlayer.tokenStackLimits}
                        onTokenClick={(tokenId) => {
                            // 从定义中查找该 Token 是否有 removeDebuff 效果（即净化类 Token）
                            const tokenDef = tokenDefinitions?.find(def => def.id === tokenId);
                            if (tokenDef?.activeUse?.effect.type === 'removeDebuff' && onPurifyClick) {
                                onPurifyClick();
                            }
                        }}
                        clickableTokens={canUsePurify
                            ? (tokenDefinitions ?? []).filter(def => def.activeUse?.effect.type === 'removeDebuff').map(def => def.id)
                            : []
                        }
                    />
                    <StatusEffectsContainer
                        effects={viewPlayer.statusEffects ?? {}}
                        maxPerRow={5}
                        size="normal"
                        className="flex-wrap-reverse justify-start gap-[0.3vw]"
                        locale={locale}
                        atlas={statusIconAtlas}
                        onEffectClick={(effectId) => {
                            if (effectId === STATUS_IDS.KNOCKDOWN && onKnockdownClick) {
                                onKnockdownClick();
                            }
                        }}
                        clickableEffects={canRemoveKnockdown ? [STATUS_IDS.KNOCKDOWN] : []}
                    />
                </div>
                <div className="w-full px-[1vw]" data-tutorial-id="player-stats">
                    <PlayerStats
                        player={viewPlayer}
                        hpRef={selfHpRef}
                        cpRef={selfCpRef}
                        hitStopActive={hitStopActive}
                        hitStopConfig={hitStopConfig}
                        isShaking={isSelfShaking}
                        damageFlashActive={selfDamageFlashActive}
                        damageFlashDamage={selfDamageFlashDamage}
                        overrideHp={overrideHp}
                    />
                </div>
                <div className="w-full px-[1vw] pt-[0.5vw]" data-tutorial-id="draw-deck">
                    <DrawDeck ref={drawDeckRef} count={viewPlayer.deck.length} locale={locale} />
                </div>
            </div>
        </div>
    );
};
