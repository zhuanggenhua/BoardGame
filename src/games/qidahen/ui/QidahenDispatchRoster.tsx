import { useTranslation } from 'react-i18next';
import { QidahenArmyBlock } from './QidahenArmyBlock';
import type { QidahenMapToken, QidahenPiece } from '../domain/types';
import { QIDAHEN_DISPATCH_QUANTITY_ANCHOR_ID, QIDAHEN_DISPATCH_ROSTER_ID } from './dispatchRosterAnchor';
import { buildDispatchGroups } from './dispatchGroupSelection';
import type { useQidahenTurnInput } from './useQidahenTurnInput';

type Props = {
    input: ReturnType<typeof useQidahenTurnInput>;
    regionName: string;
    tokens: readonly QidahenMapToken[];
    pieces: readonly QidahenPiece[];
    trainedIds: readonly string[];
    recommendedIds?: readonly string[];
};

export function QidahenDispatchRoster({ input, regionName, tokens, pieces, trainedIds, recommendedIds }: Props) {
    const { t } = useTranslation('game-qidahen');
    const targeting = input.step === 'dispatch-target';
    const visibleIds = new Set(targeting ? input.committedPieceIds : input.dispatchEligiblePieceIds);
    const selectedIds = new Set(input.selectedPieceIds);
    const lineup = buildDispatchGroups(tokens, pieces, visibleIds, new Set(trainedIds));
    const selectedCount = targeting ? visibleIds.size : selectedIds.size;
    const back = input.options.find(option => option.id === 'back');
    const targetName = targeting ? input.options.find(option => option.id === input.selectedRegionId)?.label : undefined;
    return <section aria-labelledby="qidahen-dispatch-title" data-testid={QIDAHEN_DISPATCH_ROSTER_ID} data-tutorial-id={QIDAHEN_DISPATCH_ROSTER_ID} data-dispatch-step={input.step}
        className="pointer-events-auto absolute bottom-[13%] left-1/2 z-[85] flex w-max max-w-[min(860px,70%)] -translate-x-1/2 items-center gap-4 rounded-md border border-[#b48c58] bg-[#39291e] px-4 py-2.5 text-[#fff0d2] shadow-xl">
        <div className="shrink-0" data-tutorial-id={targeting ? undefined : QIDAHEN_DISPATCH_QUANTITY_ANCHOR_ID}>
            <h2 id="qidahen-dispatch-title" className="text-lg font-black">{regionName}</h2>
            <p aria-live="polite" className="text-sm text-[#e1c798]">
                {t(targeting ? 'board.turnChoice.dispatchCommitted' : 'board.turnChoice.dispatchSelectionCount', { units: selectedCount, limit: input.dispatchLimit })}
            </p>
        </div>
        <div className={targeting ? 'flex min-w-0 gap-3 overflow-x-auto p-1' : 'grid max-h-[162px] w-[410px] min-w-0 gap-1 overflow-y-auto p-1 [scrollbar-width:thin]'}
            data-testid={targeting ? 'qidahen-battle-roster-attacker' : 'qidahen-dispatch-lineup'}>
            {lineup.map(({ token, piece, pieceIds, trained }) => {
                const selected = targeting ? pieceIds : pieceIds.filter(id => selectedIds.has(id));
                const count = selected.length;
                const limit = Math.min(pieceIds.length, input.dispatchLimit - selectedCount + count);
                const recommended = !targeting && pieceIds.some(id => recommendedIds?.includes(id));
                const kind = t(`board.wheelRecruitTrain.${piece.troopKind}`);
                const traits = [
                    piece.location === 'city' ? t('board.turnChoice.dispatchGarrison') : '',
                    trained ? t('board.turnChoice.dispatchTrained') : '',
                ].filter(Boolean).join(' · ');
                const quantityLabel = t('board.turnChoice.dispatchQuantityLabel', { unit: `${piece.label} · ${piece.level}${traits ? ` · ${traits}` : ''}` });
                const face = token.imageSrc ? <QidahenArmyBlock imageSrc={token.imageSrc}
                    rotation={token.rotationDeg} quantity={pieceIds.length} className={targeting ? 'size-12' : 'size-9'} /> : null;
                return <div key={token.id} data-testid={`qidahen-dispatch-unit-${pieceIds[0]}`} data-piece-ids={pieceIds.join(' ')}
                    data-qidahen-dispatch-selected={count}
                    data-selected-piece-ids={selected.join(' ')}
                    className={targeting ? 'flex w-14 shrink-0 flex-col items-center gap-1' : 'grid min-h-12 grid-cols-[minmax(88px,1fr)_minmax(45px,1fr)_80px] items-center gap-2 rounded px-2'}
                    style={targeting ? undefined : { backgroundColor: count > 0 ? '#62482f' : '#443429', boxShadow: recommended ? 'inset 2px 0 #93ad70' : undefined }}
                    data-qidahen-dispatch-recommended={recommended ? 'true' : undefined}>
                    {targeting ? <>{face ?? kind}{count > 1 ? <span className="text-sm font-bold tabular-nums">×{count}</span> : null}</>
                        : <>
                            <div className="flex min-w-0 items-center gap-2.5" title={piece.label}>
                                {face}
                                <span className="min-w-0 text-sm font-semibold leading-tight">{kind}
                                    {traits ? <small className="block text-[#dcc49c]">{traits}</small> : null}
                                </span>
                            </div>
                            <input type="range" min={0} max={limit} step={1} value={count} aria-label={t('board.turnChoice.dispatchSliderLabel', { unit: kind })}
                                className="w-full min-w-0 accent-[#f0cc7e] disabled:opacity-40" disabled={limit === 0}
                                onChange={event => input.setDispatchQuantity(pieceIds, event.currentTarget.valueAsNumber)} />
                            <div className="flex items-center justify-end gap-1.5 text-sm tabular-nums">
                                <input type="number" inputMode="numeric" min={0} max={limit} step={1} value={count} aria-label={quantityLabel}
                                    data-testid={`qidahen-dispatch-quantity-${pieceIds[0]}`}
                                    disabled={limit === 0}
                                    onFocus={event => event.currentTarget.select()}
                                    onChange={event => input.setDispatchQuantity(pieceIds, Number(event.currentTarget.value))}
                                    className="h-8 w-11 rounded border border-[#be975a] bg-[#fff4d7] px-1 text-center font-bold text-[#342612] [appearance:textfield] enabled:hover:border-[#fff3b0] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#ffdfa0] disabled:opacity-50 [&::-webkit-inner-spin-button]:appearance-none" />
                                <span className="text-[#e1c798]">/ {pieceIds.length}</span>
                            </div>
                        </>}
                </div>;
            })}
        </div>
        <div className="flex shrink-0 flex-col items-start gap-1">
            {back ? <button type="button" data-testid="qidahen-turn-option-back" data-tutorial-id="qidahen-turn-option-back"
                disabled={back.disabled} onClick={() => input.choose(back.id)}
                className="min-h-9 rounded px-2 text-left text-sm font-bold text-[#f8dfad] hover:bg-white/10 disabled:opacity-40">
                {targeting ? back.label : t('board.turnChoice.changeDispatchSource')}
            </button> : null}
            {!targeting || targetName ? <button type="button" data-testid="qidahen-turn-confirm" data-tutorial-id="qidahen-turn-confirm"
                disabled={!input.canConfirm} onClick={input.confirm}
                className="min-h-11 rounded border border-[#ffe49b] bg-[#e3ce9e] px-4 font-bold text-[#342612] disabled:opacity-40">
                {targetName ? t('board.turnChoice.confirmDispatchTarget', { target: targetName }) : t('board.turnChoice.chooseDispatchTarget')}
            </button> : null}
            {!targeting && selectedCount > 0 && !input.troopsCanReach ? <small role="status" className="max-w-36 text-[#ffe0ad]">
                {t('board.turnChoice.dispatchUnreachable')}
            </small> : null}
        </div>
    </section>;
}
