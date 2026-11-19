import { useId, useState, type ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';

const topics = [
    'arena', 'rounds', 'actions', 'movement', 'walls', 'spellbook', 'castingSources', 'enchantments',
    'targets', 'attackDice', 'defense', 'creatures', 'conditions', 'traits', 'upkeep',
] as const;

type Topic = (typeof topics)[number];

export function MageWarsRulesReference() {
    const { t } = useTranslation('game-mage-wars');
    const [topic, setTopic] = useState<Topic>('arena');
    const fieldId = useId();

    return (
        <details className="mb-3 rounded-md border border-[#d3ccba] bg-[#f4f1eb] text-[#362b1f]" data-testid="mage-wars-rules-reference">
            <summary className="cursor-pointer px-3 py-2.5 text-sm font-bold focus-visible:outline focus-visible:outline-2">
                {t('rulesReference.title')}
            </summary>
            <div className="grid gap-2 px-3 pb-3">
                <label className="text-xs font-semibold" htmlFor={fieldId}>{t('rulesReference.topicLabel')}</label>
                <select
                    id={fieldId}
                    className="w-full rounded border border-[#b8aa95] bg-white px-2 py-1.5 text-sm"
                    value={topic}
                    onChange={(event: ChangeEvent<HTMLSelectElement>) => setTopic(event.currentTarget.value as Topic)}
                >
                    {topics.map((key) => <option key={key} value={key}>{t(`rulesReference.topics.${key}.title`)}</option>)}
                </select>
                <p className="select-text text-sm leading-relaxed" aria-live="polite" data-testid="mage-wars-rules-description">
                    {t(`rulesReference.topics.${topic}.description`)}
                </p>
            </div>
        </details>
    );
}
