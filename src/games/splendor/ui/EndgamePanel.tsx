import React from 'react';
import { Crown, RotateCcw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { OptimizedImage } from '../../../components/common/media/OptimizedImage';
import type { ContentSlotProps } from '../../../components/game/framework/widgets/EndgameOverlay';
import type { RematchButtonProps } from '../../../components/game/framework/widgets/RematchActions';
import { SPLENDOR_ASSETS } from '../assets';
import './endgame.css';

export interface SplendorEndgameStanding {
    id: string;
    name: string;
    score: number;
    /** 已购发展卡数量（平分时少者胜） */
    cardCount: number;
    isWinner: boolean;
}

export interface SplendorEndgameContentProps extends ContentSlotProps {
    standings: SplendorEndgameStanding[];
}

export const SPLENDOR_ENDGAME_FRAME_CLASS = 'splendor-endgame-frame';

export function renderSplendorButton({ role, label, onClick, disabled }: RematchButtonProps): React.ReactNode {
    if (role === 'restarting') {
        return (
            <div data-testid="rematch-restarting" role="status" className="splendor-endgame__button">
                {label}
            </div>
        );
    }

    const isPrimary = role === 'playAgain' || role === 'vote';
    return (
        <button
            type="button"
            data-testid={'splendor-endgame-' + role}
            onClick={onClick}
            disabled={disabled}
            className={isPrimary ? 'splendor-endgame__button splendor-endgame__button--primary' : 'splendor-endgame__button'}
        >
            {isPrimary && <RotateCcw size={16} className="shrink-0" aria-hidden="true" />}
            {label}
        </button>
    );
}

export function SplendorEndgameContent({ result, playerID, standings }: SplendorEndgameContentProps) {
    const { t } = useTranslation('game-splendor');
    const { t: tCommon } = useTranslation('common');

    const winners = result?.winners?.map(String)
        ?? (result?.winner !== undefined ? [String(result.winner)] : []);
    const isDraw = result?.draw === true;
    const me = playerID != null ? String(playerID) : undefined;
    const isWinner = me !== undefined && winners.includes(me);
    const isLoser = me !== undefined && winners.length > 0 && !isWinner;
    const outcome = isDraw ? 'draw' : isWinner ? 'victory' : isLoser ? 'defeat' : 'gameOver';

    return (
        <section
            aria-labelledby="splendor-result"
            data-testid="splendor-endgame-content"
            className="splendor-endgame"
            data-outcome={outcome}
        >
            <header className="splendor-endgame__hero">
                <h2 id="splendor-result" data-testid="splendor-endgame-title">
                    {tCommon('endgame.' + outcome)}
                </h2>
                <div className="splendor-endgame__medallion" aria-hidden="true">
                    <OptimizedImage src={SPLENDOR_ASSETS.TOKEN_BLUE} alt="" className="splendor-endgame__gem" />
                </div>
            </header>

            <div className="splendor-endgame__ledger">
                <h3>{t('endgame.standings')}</h3>
                <ol className="splendor-endgame__standings">
                    {standings.map((standing, index) => (
                        <li
                            key={standing.id}
                            data-testid={'splendor-endgame-standing-' + standing.id}
                            className="splendor-endgame__standing"
                            data-winner={standing.isWinner && !isDraw}
                        >
                            <span className="splendor-endgame__rank">{index + 1}</span>
                            <span className="flex min-w-0 items-center gap-2">
                                <span className="truncate text-sm font-semibold" title={standing.name}>{standing.name}</span>
                                {standing.isWinner && !isDraw && <Crown size={15} className="shrink-0 text-[#f5ce82]" aria-hidden="true" />}
                            </span>
                            <strong className="splendor-endgame__score">
                                {t('endgame.points', { count: standing.score })}
                            </strong>
                            <span className="splendor-endgame__cards">
                                {t('endgame.cards', { count: standing.cardCount })}
                            </span>
                        </li>
                    ))}
                </ol>
            </div>
        </section>
    );
}
