import React from 'react';
import { useTranslation } from 'react-i18next';

import { GameModal } from './components/GameModal';
import { OpponentHeader } from './OpponentHeader';
import type { PendingDefenderChoice, HeroState } from '../domain/types';
import type { PlayerId } from '../../../engine/types';

interface DefenderChoiceModalProps {
    choice: (PendingDefenderChoice & { id: string; playerId: PlayerId }) | null | undefined;
    canSelect: boolean;
    onSelect: (defenderId: PlayerId) => void;
    players: Record<PlayerId, HeroState>;
    playerNames: Record<PlayerId, string>;
    currentPlayerId: PlayerId;
    teamIdByPlayerId?: Record<PlayerId, string>;
    locale?: string;
}

export const DefenderChoiceModal: React.FC<DefenderChoiceModalProps> = ({
    choice,
    canSelect,
    onSelect,
    players,
    playerNames,
    currentPlayerId,
    teamIdByPlayerId,
    locale,
}) => {
    const { t } = useTranslation('game-dicethrone');

    if (!choice || choice.options.length === 0) {
        return null;
    }

    const resolveTone = (targetPlayerId: PlayerId): 'ally' | 'enemy' => {
        const currentTeamId = teamIdByPlayerId?.[currentPlayerId];
        const targetTeamId = teamIdByPlayerId?.[targetPlayerId];
        if (currentTeamId && targetTeamId && currentTeamId === targetTeamId) {
            return 'ally';
        }
        return 'enemy';
    };

    return (
        <GameModal
            isOpen
            title={t('choices.title')}
            width="xl"
            className="max-w-4xl"
            closeOnBackdrop={false}
        >
            <div className="flex w-full flex-col items-center gap-6">
                <p className="text-lg text-slate-200 font-medium">
                    {t(choice.titleKey)}
                </p>

                <div className="w-full max-w-[42rem] flex flex-col gap-3" data-testid="dt-defender-choice-panel">
                    {choice.options.map((option) => {
                        const targetPlayer = players[option.playerId];
                        if (!targetPlayer) {
                            return null;
                        }

                        return (
                            <div
                                key={option.playerId}
                                className="relative w-full"
                                data-testid={`dt-defender-choice-${option.playerId}`}
                            >
                                <OpponentHeader
                                    opponent={targetPlayer}
                                    playerId={option.playerId}
                                    opponentName={playerNames[option.playerId] ?? `P${Number(option.playerId) + 1}`}
                                    viewMode="opponent"
                                    isOpponentShaking={false}
                                    shouldAutoObserve={false}
                                    onToggleView={() => {
                                        if (!canSelect || option.disabled) return;
                                        onSelect(option.playerId);
                                    }}
                                    tone={resolveTone(option.playerId)}
                                    selected={!option.disabled}
                                    observed={false}
                                    compact={false}
                                    locale={locale}
                                    layout="inline"
                                    allowPointerEvents
                                    containerClassName="w-full"
                                    disabled={option.disabled}
                                    testId={`dt-defender-choice-option-${option.playerId}`}
                                />
                                {option.disabled && (
                                    <div className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full border border-white/10 bg-black/55 px-3 py-1 text-[11px] font-bold tracking-[0.18em] text-slate-300">
                                        {t('selection.targetOptionDisabled')}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </GameModal>
    );
};

export default DefenderChoiceModal;
