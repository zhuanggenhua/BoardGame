import { EndgameOverlay, type EndgameOverlayProps } from '../../../components/game/framework/widgets/EndgameOverlay';
import type { GameOverResult } from '../../../engine/types';
import './endgame.css';

interface Props extends Omit<EndgameOverlayProps, 'result' | 'renderContent'> {
    result?: GameOverResult;
    nameFor: (playerId: string) => string;
}

function FateResult({ result, nameFor }: { result: GameOverResult; nameFor: Props['nameFor'] }) {
    const winners = result.winners ?? (result.winner !== undefined ? [result.winner] : []);
    const title = result.draw ? '平局' : winners.length
        ? `${winners.map(nameFor).join('、')}赢得圣杯战争`
        : '所有御主败北';
    return <section className="fd-endgame-results" aria-label="圣杯战争结果">
        <h2>{title}</h2>
        <ol aria-label="最终战果">
            {Object.entries(result.scores ?? {}).sort((a, b) => b[1] - a[1]).map(([id, score]) =>
                <li key={id} data-winner={winners.includes(id) || undefined}>
                    <span>{nameFor(id)}</span><strong aria-label={`${nameFor(id)}战果`}>{score}</strong>
                </li>)}
        </ol>
    </section>;
}

/** The shared overlay owns blocking, rematch and exit; Fate only presents its formal result. */
export function FateEndgame({ nameFor, ...props }: Props) {
    return <EndgameOverlay {...props} contentWrapperClassName="fd-endgame-panel" scrollMode="content"
        renderContent={({ result }) => result ? <FateResult result={result} nameFor={nameFor}/> : null}/>;
}
