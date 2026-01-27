import type { RefObject } from 'react';
import type { HeroState, TurnPhase } from '../types';
import type { TokenDef } from '../../../systems/TokenSystem';
import { PhaseIndicator } from './PhaseIndicator';
import { StatusEffectsContainer, TokensContainer, type StatusIconAtlasConfig } from './statusEffects';
import { PlayerStats } from './PlayerStats';
import { DrawDeck } from './DrawDeck';


export const LeftSidebar = ({
    currentPhase,
    viewPlayer,
    locale,
    statusIconAtlas,
    selfBuffRef,
    selfHpRef,
    drawDeckRef,
    onPurifyClick,
    canUsePurify,
    tokenDefinitions,
    onStunClick,
    canRemoveStun,
}: {
    currentPhase: TurnPhase;
    viewPlayer: HeroState;
    locale?: string;
    statusIconAtlas?: StatusIconAtlasConfig | null;
    selfBuffRef?: RefObject<HTMLDivElement | null>;
    selfHpRef?: RefObject<HTMLDivElement | null>;
    drawDeckRef?: RefObject<HTMLDivElement | null>;
    /** 点击净化 Token 的回调 */
    onPurifyClick?: () => void;
    /** 是否可以使用净化（有净化 Token 且有负面状态） */
    canUsePurify?: boolean;
    /** Token 定义列表（用于判断哪些 Token 可点击） */
    tokenDefinitions?: TokenDef[];
    /** 点击击倒状态的回调 */
    onStunClick?: () => void;
    /** 是否可以移除击倒（有击倒状态且 CP >= 2 且在正确阶段） */
    canRemoveStun?: boolean;
}) => {
    return (
        <div className="absolute left-[1.5vw] top-0 bottom-[1.5vw] w-[15vw] flex flex-col items-center pointer-events-auto z-[60]">
            <div className="w-full pt-[1vw] px-[1vw]"><PhaseIndicator currentPhase={currentPhase} /></div>
            <div className="flex-grow" />
            <div className="w-full flex flex-col items-center gap-[1.5vw]">
                {/*
                 * selfBuffRef is used as the end position for buff/status flying effects.
                 * Use a small offset above the HP container so the effect doesn't land too low.
                 */}
                <div className="w-full px-[1vw] flex flex-col-reverse gap-[0.5vw] -mt-[0.6vw]" ref={selfBuffRef}>
                    <TokensContainer
                        tokens={viewPlayer.tokens ?? {}}
                        maxPerRow={5}
                        size="normal"
                        className="flex-wrap-reverse justify-start"
                        locale={locale}
                        atlas={statusIconAtlas}
                        onTokenClick={(tokenId) => {
                            // 从定义中查找该 Token 是否有 removeDebuff 效果（即净化类 Token）
                            const tokenDef = tokenDefinitions?.find(def => def.id === tokenId);
                            if (tokenDef?.useEffect?.type === 'removeDebuff' && onPurifyClick) {
                                onPurifyClick();
                            }
                        }}
                        clickableTokens={canUsePurify
                            ? (tokenDefinitions ?? []).filter(def => def.useEffect?.type === 'removeDebuff').map(def => def.id)
                            : []
                        }
                    />
                    <StatusEffectsContainer
                        effects={viewPlayer.statusEffects ?? {}}
                        maxPerRow={5}
                        size="normal"
                        className="flex-wrap-reverse justify-start"
                        locale={locale}
                        atlas={statusIconAtlas}
                        onEffectClick={(effectId) => {
                            if (effectId === 'stun' && onStunClick) {
                                onStunClick();
                            }
                        }}
                        clickableEffects={canRemoveStun ? ['stun'] : []}
                    />
                </div>
                <div className="w-full px-[1vw]"><PlayerStats player={viewPlayer} hpRef={selfHpRef} /></div>
                <DrawDeck ref={drawDeckRef} count={viewPlayer.deck.length} locale={locale} />
            </div>
        </div>
    );
};
