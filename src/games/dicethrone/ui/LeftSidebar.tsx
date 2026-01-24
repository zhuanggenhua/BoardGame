import type { RefObject } from 'react';
import type { HeroState, TurnPhase } from '../types';
import { PhaseIndicator } from './PhaseIndicator';
import { StatusEffectsContainer, type StatusIconAtlasConfig } from './statusEffects';
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
}: {
    currentPhase: TurnPhase;
    viewPlayer: HeroState;
    locale?: string;
    statusIconAtlas?: StatusIconAtlasConfig | null;
    selfBuffRef?: RefObject<HTMLDivElement | null>;
    selfHpRef?: RefObject<HTMLDivElement | null>;
    drawDeckRef?: RefObject<HTMLDivElement | null>;
}) => {
    return (
        <div className="absolute left-[1.5vw] top-0 bottom-[1.5vw] w-[15vw] flex flex-col items-center pointer-events-auto z-[60]">
            <div className="w-full pt-[1vw] px-[1vw]"><PhaseIndicator currentPhase={currentPhase} /></div>
            <div className="flex-grow" />
            <div className="w-full flex flex-col items-center gap-[1.5vw]">
                <div className="w-full px-[1vw]" ref={selfBuffRef}>
                    <StatusEffectsContainer
                        effects={viewPlayer.statusEffects ?? {}}
                        maxPerRow={3}
                        size="normal"
                        className="justify-center"
                        locale={locale}
                        atlas={statusIconAtlas}
                    />
                </div>
                <div className="w-full px-[1vw]"><PlayerStats player={viewPlayer} hpRef={selfHpRef} /></div>
                <DrawDeck ref={drawDeckRef} count={viewPlayer.deck.length} locale={locale} />
            </div>
        </div>
    );
};
