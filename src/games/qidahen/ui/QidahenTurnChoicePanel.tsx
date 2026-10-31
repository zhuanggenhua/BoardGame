import type { useQidahenTurnInput } from './useQidahenTurnInput';
import { CardPreview } from '../../../components/common/media/CardPreview';
import { CardInspectButton } from '../../../components/common/overlays/CardInspectButton';
import type { CardPreviewRef } from '../../../core/types';
import { getQidahenSetupCharacterPreview } from './setupCardPreviews';
import type { QidahenFactionId } from '../domain/types';
import { useTranslation } from 'react-i18next';

/** 沿用正式右侧行动槽；地图、部队与手牌本体继续承担选择输入。 */
export function QidahenTurnChoicePanel({ input, dock, locale, onInspect }: { input: ReturnType<typeof useQidahenTurnInput>; dock: { left: number; top: number; width: number }; locale?: string; onInspect: (previewRef: CardPreviewRef, title: string) => void }) {
    const { t } = useTranslation('game-qidahen');
    if (!input.active) return null;
    const spatial = input.mapCandidateIds.length > 0 || input.pieceIds.length > 0;
    const buttonOptions = input.options.filter(option => !input.mapCandidateIds.includes(option.id) && !input.cardIds.includes(option.id) && !input.pieceIds.includes(option.id));
    return <section className="pointer-events-auto absolute z-[85] max-h-[660px] overflow-y-auto rounded border-[3px] border-[#c7a26b] bg-[#6d291deF] p-4 text-[#fff0d2] shadow-xl"
        data-testid="qidahen-turn-choice" data-turn-step={input.step}
        style={{ left: `calc(${dock.left}px + var(--qidahen-mobile-edge-pull, 0px))`, top: dock.top, width: dock.width }}>
        <h2 className="text-[19px] font-bold leading-6">{input.title}</h2>
        {input.pieceIds.length > 0 ? <p className="mt-2 text-[15px]" data-testid="qidahen-turn-selected-count">{input.step === 'upkeep' ? t('board.turnChoice.selectedSupport', { cards: input.selectedCardIds.length, units: input.selectedPieceIds.length }) : t('board.turnChoice.selectedTroops', { units: input.selectedPieceIds.length })}</p> : null}
        {input.cardIds.length > 0 ? <p className="mt-2 text-[15px]">{input.step === 'upkeep' ? t('board.turnChoice.supportOrRemove') : t('board.turnChoice.selectHand')}</p> : null}
        {spatial && input.selectedRegionId ? <p className="mt-2 text-[15px]">{input.options.find(option => option.id === input.selectedRegionId)?.label}</p> : null}
        {buttonOptions.length > 0 ? <div className="mt-3 flex flex-col gap-2">
            {buttonOptions.map(option => {
                const factionId = option.id.split('-')[0] as QidahenFactionId;
                const preview = ['ming', 'mongol', 'jin'].includes(factionId) ? getQidahenSetupCharacterPreview(factionId, option.id) : null;
                return <div key={option.id} className="relative flex gap-2">
                {preview ? <div className="relative w-[72px] shrink-0">
                    <CardPreview previewRef={preview} locale={locale} className="aspect-[487/672] w-full" />
                    <CardInspectButton ariaLabel={option.label} alwaysVisible buttonSize="30px" onInspect={() => onInspect(preview, option.label)} testId={`qidahen-turn-inspect-${option.id}`} />
                </div> : null}
                <button type="button" data-testid={`qidahen-turn-option-${option.id}`} data-tutorial-id={`qidahen-turn-option-${option.id}`} disabled={!input.canAct || option.disabled}
                aria-pressed={input.selectedIds.includes(option.id)} onClick={() => input.toggle(option.id)}
                className={`min-h-11 flex-1 rounded border-2 px-3 py-2 text-left text-[16px] font-bold disabled:opacity-50 ${input.selectedIds.includes(option.id) ? 'border-[#ffe49b] bg-[#e3ce9e] text-[#342612]' : 'border-[#b59b73] bg-[#f2e5c6] text-[#423118]'}`}>
                {option.label}
            </button></div>; })}
        </div> : null}
        <button type="button" data-testid="qidahen-turn-confirm" data-tutorial-id="qidahen-turn-confirm" disabled={!input.canConfirm} onClick={input.confirm}
            className="mt-4 min-h-11 w-full rounded border-2 border-[#ffe49b] bg-[#e3ce9e] px-3 py-2 text-[16px] font-bold text-[#342612] disabled:opacity-40">{t('board.turnChoice.confirm')}</button>
    </section>;
}
