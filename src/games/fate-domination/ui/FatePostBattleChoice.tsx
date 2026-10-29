import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ModalBase } from '../../../components/common/overlays/ModalBase';
import { CardPreview } from '../../../components/common/media/CardPreview';
import type { InteractionDescriptor, SimpleChoiceData } from '../../../engine/systems/InteractionSystem';
import { FATE_EVENTS } from '../data';
import { fateCardPreview } from '../data/cardArtwork';
import './post-battle-choice.css';

interface Props {
    interaction: InteractionDescriptor<SimpleChoiceData>;
    viewerId: string | null;
    rollbackRevision?: number;
    onConfirm: (interactionId: string, optionId: string) => void;
}
export function FatePostBattleChoice({ interaction, viewerId, onConfirm, rollbackRevision = 0 }: Props) {
    const { t } = useTranslation('game-fate-domination');
    const [selection, setSelection] = useState<{ interactionId: string; optionId: string } | null>(null);
    const firstButton = useRef<HTMLButtonElement>(null);
    useEffect(() => setSelection(null), [interaction.id, rollbackRevision]);
    const selected = selection?.interactionId === interaction.id ? selection.optionId : null;
    const source = FATE_EVENTS.find(card => card.id === 'fuyuki_E12')!;
    useEffect(() => {
        const previous = document.activeElement as HTMLElement | null;
        firstButton.current?.focus();
        return () => previous?.focus();
    }, [interaction.id, viewerId]);
    if (viewerId !== interaction.playerId) return null;
    return <ModalBase closeOnBackdrop={false} overlayClassName="!bg-black/75">
        <section data-tutorial-id="fate-post-battle" className="fd-post-battle-choice" role="dialog" aria-modal="true" aria-label={t('ui.postBattleChoice.dialogLabel')} onKeyDown={event => {
            if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); }
            if (event.key === 'Tab') {
                const buttons = event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not([disabled])');
                const first = buttons[0], last = buttons[buttons.length - 1];
                if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
                else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
            }
        }}>
            <header><h2>{t('ui.postBattleChoice.title')}</h2><span>{t('ui.postBattleChoice.player', { number: Number(interaction.playerId) + 1 })}</span></header>
            <div className="fd-post-battle-content">
                <div className="fd-post-battle-source"><CardPreview previewRef={fateCardPreview(source.assetPath)} title={source.name} style={{ width: '100%' }} /></div>
                <div className="fd-post-battle-options">
                    {interaction.data.options.map((option, index) => <button ref={index === 0 ? firstButton : undefined} key={option.id} type="button" disabled={option.disabled}
                        aria-pressed={selected === option.id} onClick={() => setSelection({ interactionId: interaction.id, optionId: option.id })}>{option.labelKey === 'ui.postBattleChoice.restore' ? t('ui.postBattleChoice.restore') : option.labelKey === 'ui.postBattleChoice.decline' ? t('ui.postBattleChoice.decline') : option.label}</button>)}
                    <button type="button" className="fd-post-battle-confirm" disabled={!selected || !interaction.data.options.some(option => option.id === selected && !option.disabled)}
                        onClick={() => { if (selected) onConfirm(interaction.id, selected); }}>{t('ui.postBattleChoice.confirm')}</button>
                </div>
            </div>
        </section>
    </ModalBase>;
}
