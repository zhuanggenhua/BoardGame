import React from 'react';
import { Crown, RotateCcw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { ContentSlotProps } from '../../../components/game/framework/widgets/EndgameOverlay';
import type { RematchButtonProps } from '../../../components/game/framework/widgets/RematchActions';
import './endgame.css';

export interface FantasyRealmsEndgameStanding {
    id: string;
    name: string;
    score: number;
    isWinner: boolean;
}

export interface FantasyRealmsEndgameContentProps extends ContentSlotProps {
    standings: FantasyRealmsEndgameStanding[];
    actions?: React.ReactNode;
}

export function FantasyRealmsRematchButton({ role, label, onClick, disabled }: RematchButtonProps): React.ReactNode {
    if (role === 'restarting') {
        return (
            <div data-testid="rematch-restarting" role="status" className="fr-endgame__button">
                {label}
            </div>
        );
    }

    const isPrimary = role === 'playAgain' || role === 'vote';
    return (
        <button
            type="button"
            data-testid={'fantasyrealms-endgame-' + role}
            onClick={onClick}
            disabled={disabled}
            className={isPrimary ? 'fr-endgame__button fr-endgame__button--primary' : 'fr-endgame__button'}
        >
            {isPrimary && <RotateCcw size={16} className="shrink-0" aria-hidden="true" />}
            {label}
        </button>
    );
}

export function FantasyRealmsEndgameContent({ result, playerID, standings, actions }: FantasyRealmsEndgameContentProps) {
    const { t: tCommon } = useTranslation('common');
    const { t } = useTranslation('game-fantasyrealms');

    const winners = result?.winners?.map(String)
        ?? (result?.winner !== undefined ? [String(result.winner)] : []);
    const isDraw = result?.draw === true;
    const me = playerID != null ? String(playerID) : undefined;
    const isWinner = me !== undefined && winners.includes(me);
    const isLoser = me !== undefined && winners.length > 0 && !isWinner;
    const outcome = isDraw ? 'draw' : isWinner ? 'victory' : isLoser ? 'defeat' : 'gameOver';

    return (
        <section
            aria-labelledby="fantasyrealms-result"
            data-testid="fantasyrealms-endgame-content"
            className="fr-endgame"
            data-outcome={outcome}
        >
            <header className="fr-endgame__heading">
                <h2 id="fantasyrealms-result" data-testid="fantasyrealms-endgame-title">
                    {outcome === 'draw' ? tCommon('endgame.draw') : outcome === 'victory' ? tCommon('endgame.victory') : outcome === 'defeat' ? tCommon('endgame.defeat') : tCommon('endgame.gameOver')}
                </h2>
            </header>
            <div className="fr-endgame__ledger">
                <h3>{t('progress.finalStandings')}</h3>
                <ol className="fr-endgame__standings">
                    {standings.map((standing, index) => (
                        <li
                            key={standing.id}
                            data-testid={'fantasyrealms-endgame-standing-' + standing.id}
                            className="fr-endgame__standing"
                            data-winner={standing.isWinner && !isDraw}
                        >
                            <span className="fr-endgame__rank">{index + 1}</span>
                            <span className="flex min-w-0 items-center gap-2">
                                <span className="truncate text-sm font-semibold" title={standing.name}>{standing.name}</span>
                                {standing.isWinner && !isDraw && <Crown size={15} className="shrink-0" aria-hidden="true" />}
                            </span>
                            <strong className="fr-endgame__score">{standing.score}</strong>
                        </li>
                    ))}
                </ol>
            </div>
            {actions && <footer className="fr-endgame__actions">{actions}</footer>}
        </section>
    );
}
