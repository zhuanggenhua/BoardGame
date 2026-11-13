import React from 'react';
import { useTranslation } from 'react-i18next';
import type { TableCard } from '../foundation';
import type { SettlementChoice, SettlementOption, SettlementStep } from '../domain/settlement';
import './settlementChoices.css';

interface SettlementChoicesProps {
    step: SettlementStep;
    overflow: boolean;
    isMyTurn: boolean;
    currentPlayerName: string;
    options: SettlementOption[];
    renderCard: (card: TableCard) => React.ReactNode;
    onChoose: (choice: SettlementChoice) => void;
}

export function SettlementChoices({ step, overflow, isMyTurn, currentPlayerName, options, renderCard, onChoose }: SettlementChoicesProps) {
    const { t } = useTranslation('game-fantasyrealms');
    const [bookTarget, setBookTarget] = React.useState<string | null>(null);
    const [page, setPage] = React.useState(0);
    React.useEffect(() => { setBookTarget(null); setPage(0); }, [step, isMyTurn, overflow]);

    const isBook = step === 'book' && !overflow;
    const cards = isBook
        ? options.filter((entry, index, all) => entry.choice.cardId && all.findIndex((other) => other.choice.cardId === entry.choice.cardId) === index)
        : options.filter((entry) => entry.card && !entry.choice.suit);
    const suits = isBook && bookTarget ? options.filter((entry) => entry.choice.cardId === bookTarget && entry.choice.suit) : [];
    const skip = options.find((entry) => entry.choice.skip);
    const pageSize = 6;
    const pageCount = Math.max(1, Math.ceil(cards.length / pageSize));
    const visibleCards = cards.slice(page * pageSize, (page + 1) * pageSize);

    return (
        <div className="fr-settlement-overlay" data-testid="fantasyrealms-settlement">
            <section className="fr-settlement-stage" aria-label={t('settlement.title')}>
                {isMyTurn ? (
                    <>
                        <h2 className="fr-settlement-prompt">{t(`settlement.${overflow ? 'overflow' : step}`)}</h2>
                        <div className="fr-settlement-options" data-testid="fantasyrealms-settlement-cards" tabIndex={0}>
                            {visibleCards.map((entry) => (
                                <button
                                    key={entry.choice.cardId}
                                    className={`fr-settlement-option${bookTarget === entry.choice.cardId ? ' fr-settlement-option--selected' : ''}`}
                                    onClick={() => isBook ? setBookTarget(entry.choice.cardId!) : onChoose(entry.choice)}
                                    data-testid={`fantasyrealms-settlement-option-${options.indexOf(entry)}`}
                                >
                                    {entry.card ? renderCard(entry.card) : entry.label}
                                </button>
                            ))}
                        </div>
                        {pageCount > 1 && (
                            <nav className="fr-settlement-pages" aria-label={t('settlement.pages')}>
                                <button type="button" aria-label={t('settlement.previousPage')} disabled={page === 0} onClick={() => setPage((value) => value - 1)}>‹</button>
                                <span>{page + 1} / {pageCount}</span>
                                <button type="button" aria-label={t('settlement.nextPage')} disabled={page >= pageCount - 1} onClick={() => setPage((value) => value + 1)}>›</button>
                            </nav>
                        )}
                        {suits.length > 0 && (
                            <div className="fr-settlement-suits">
                                {suits.map((entry) => (
                                    <button key={entry.choice.suit} className="fr-settlement-suit" onClick={() => onChoose(entry.choice)} data-testid={`fantasyrealms-settlement-option-${options.indexOf(entry)}`}>
                                        {t(`settlement.suit.${entry.choice.suit}`)}
                                    </button>
                                ))}
                            </div>
                        )}
                        {skip && <button className="fr-settlement-skip" onClick={() => onChoose(skip.choice)}>{t('settlement.skip')}</button>}
                    </>
                ) : <p className="fr-settlement-prompt">{t('settlement.wait', { player: currentPlayerName })}</p>}
            </section>
        </div>
    );
}
