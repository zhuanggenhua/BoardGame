import { EndgameOverlay, type EndgameOverlayProps } from '../../../components/game/framework/widgets/EndgameOverlay';
import { useTranslation } from 'react-i18next';
import type { GameOverResult } from '../../../engine/types';
import type { FateGameResult } from '../domain/types';
import './endgame.css';

interface Props extends Omit<EndgameOverlayProps, 'result' | 'renderContent'> {
    result?: GameOverResult;
    nameFor: (playerId: string) => string;
    victoryCondition?: FateGameResult['victoryCondition'];
}

function FateResult({ result, nameFor, victoryCondition }: Pick<Props, 'nameFor' | 'victoryCondition'> & { result: GameOverResult }) {
    const { t } = useTranslation('game-fate-domination');
    const winners = result.winners ?? (result.winner !== undefined ? [result.winner] : []);
    const title = result.draw ? t('ui.endgame.draw') : winners.length
        ? t('ui.endgame.winners', { names: winners.map(nameFor).join(t('ui.endgame.nameSeparator')) })
        : t('ui.endgame.allMastersDefeated');
    return <section className="fd-endgame-results" aria-label={t('ui.endgame.results')}>
        <h2>{title}</h2>
        {victoryCondition === 'excalibur' && <p className="fd-endgame-victory-condition">{t('ui.endgame.excaliburVictory')}</p>}
        <ol aria-label={t('ui.endgame.finalScores')}>
            {Object.entries(result.scores ?? {}).sort((a, b) => b[1] - a[1]).map(([id, score]) =>
                <li key={id} data-winner={winners.includes(id) || undefined}>
                    <span>{nameFor(id)}</span><strong aria-label={t('ui.endgame.playerScore', { name: nameFor(id) })}>{score}</strong>
                </li>)}
        </ol>
    </section>;
}

/** The shared overlay owns blocking, rematch and exit; Fate only presents its formal result. */
export function FateEndgame({ nameFor, victoryCondition, ...props }: Props) {
    return <EndgameOverlay {...props} contentWrapperClassName="fd-endgame-panel" scrollMode="content"
        renderContent={({ result }) => result ? <FateResult result={result} nameFor={nameFor} victoryCondition={victoryCondition}/> : null}/>;
}
