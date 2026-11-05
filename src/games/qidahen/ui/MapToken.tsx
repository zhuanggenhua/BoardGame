import React from 'react';
import type { QidahenMapToken } from '../domain';
import { useTranslation } from 'react-i18next';
import { factionTone, armyHiddenBackColorByFaction } from './boardReadModel';
import { QIDAHEN_MAP_WIDTH, QIDAHEN_MAP_HEIGHT } from '../data/mapRegions';
import { UI_STYLE, MAP_TOKEN_IDLE_OUTLINE } from './boardLayout';
import { OptimizedImage } from '../../../components/common/media/OptimizedImage';

export const MapToken: React.FC<{
    token: QidahenMapToken;
    revealFront: boolean;
    grantPardonSourceSelectable?: boolean;
    grantPardonSourceSelected?: boolean;
    onSelectGrantPardonSource?: (regionId: string, tokenId: string) => void;
    pendingCommittedSelected?: boolean;
    pendingCommittedSelectable?: boolean;
    onSelectPendingCommittedTroops?: (committedTroops: number) => void;
    pincerAdvanceSelected?: boolean;
    pincerAdvanceSelectable?: boolean;
    onTogglePincerAdvanceTroop?: (choiceId: string) => void;
    instigateDefectionSelectable?: boolean;
    onResolveInstigateDefection?: (choiceId: string) => void;
    wuzhenChaohaSelectable?: boolean;
    onResolveWuzhenChaoha?: (choiceId: string) => void;
    tutorialResultArtilleryFocus?: boolean;
}> = ({
    token,
    revealFront,
    grantPardonSourceSelectable = false,
    grantPardonSourceSelected = false,
    onSelectGrantPardonSource,
    pendingCommittedSelected = false,
    pendingCommittedSelectable = false,
    onSelectPendingCommittedTroops,
    pincerAdvanceSelected = false,
    pincerAdvanceSelectable = false,
    onTogglePincerAdvanceTroop,
    instigateDefectionSelectable = false,
    onResolveInstigateDefection,
    wuzhenChaohaSelectable = false,
    onResolveWuzhenChaoha,
    tutorialResultArtilleryFocus = false,
}) => {
    const { t } = useTranslation('game-qidahen');
    const size = token.size ?? 30;
    const tone = factionTone[token.faction === 'neutral' ? 'ming' : token.faction];
    const isArmyToken = token.type === 'army';
    const tokenShapeClass = isArmyToken ? 'rounded-[6px]' : token.type === 'control' ? 'rounded-full' : '';
    const showImageValueBadge = token.type === 'control' && typeof token.value === 'number';
    const tokenImageSrc = token.imageSrc;
    const showTokenImage = tokenImageSrc !== undefined && (!isArmyToken || revealFront);
    const pendingCommittedTone = pendingCommittedSelected
        ? {
              opacity: 1,
              boxShadow: '0 0 0 1px rgba(29, 83, 36, 0.72), 0 0 7px rgba(112, 238, 124, 0.34)',
              filter: 'brightness(1.07) saturate(1.08)',
          }
        : pendingCommittedSelectable
          ? {
                opacity: 1,
                boxShadow: '0 0 0 1px rgba(29, 83, 36, 0.6), 0 0 5px rgba(91, 215, 101, 0.28)',
                filter: 'brightness(1.04) saturate(1.05)',
            }
          : undefined;
    const pincerAdvanceTone = pincerAdvanceSelected
        ? {
              opacity: 1,
              boxShadow: '0 0 0 1.5px rgba(42, 109, 48, 0.88), 0 0 8px rgba(124, 244, 134, 0.48)',
              filter: 'brightness(1.08) saturate(1.1)',
          }
        : pincerAdvanceSelectable
          ? {
                opacity: 1,
                boxShadow: '0 0 0 1px rgba(42, 109, 48, 0.72), 0 0 5px rgba(100, 220, 112, 0.32)',
                filter: 'brightness(1.04) saturate(1.05)',
            }
          : undefined;
    const instigateDefectionTone = instigateDefectionSelectable
        ? {
              opacity: 1,
              boxShadow: '0 0 0 1.5px rgba(42, 109, 48, 0.9), 0 0 8px rgba(124, 244, 134, 0.5)',
              filter: 'brightness(1.08) saturate(1.1)',
          }
        : undefined;
    const wuzhenChaohaTone = wuzhenChaohaSelectable
        ? {
              opacity: 1,
              boxShadow: '0 0 0 1.5px rgba(42, 109, 48, 0.9), 0 0 8px rgba(124, 244, 134, 0.5)',
              filter: 'brightness(1.08) saturate(1.1)',
          }
        : undefined;
    const grantPardonSourceTone = grantPardonSourceSelected
        ? {
              opacity: 1,
              boxShadow:
                  '0 0 0 3px rgba(255, 225, 145, 0.98), 0 0 16px rgba(118, 255, 141, 0.92), 0 0 30px rgba(255, 214, 102, 0.72)',
              filter: 'brightness(1.2) saturate(1.2)',
          }
        : grantPardonSourceSelectable
          ? {
                opacity: 1,
                boxShadow: '0 0 0 2px rgba(138, 255, 152, 0.96), 0 0 12px rgba(105, 255, 128, 0.72)',
                filter: 'brightness(1.1) saturate(1.14)',
            }
          : undefined;
    const tutorialResultArtilleryTone = tutorialResultArtilleryFocus
        ? {
              opacity: 1,
              boxShadow: '0 0 0 3px rgba(255, 226, 161, 0.98), 0 0 18px rgba(255, 214, 102, 0.9)',
              filter: 'brightness(1.22) saturate(1.18)',
          }
        : undefined;
    const resolvedSelectionTone =
        tutorialResultArtilleryTone ??
        grantPardonSourceTone ??
        wuzhenChaohaTone ??
        instigateDefectionTone ??
        pincerAdvanceTone ??
        pendingCommittedTone;
    const tokenSelectable =
        grantPardonSourceSelectable ||
        pendingCommittedSelectable ||
        pincerAdvanceSelectable ||
        instigateDefectionSelectable ||
        wuzhenChaohaSelectable;
    const resolvedBoxShadow = resolvedSelectionTone?.boxShadow;
    return (
        <div
            className={`${tokenSelectable ? 'pointer-events-auto cursor-pointer' : 'pointer-events-none'} absolute grid place-items-center text-[13px] font-black ${tokenShapeClass}`}
            data-testid={`qidahen-map-token-${token.id}`}
            data-qidahen-map-token-type={token.type}
            data-qidahen-map-token-faction={token.faction}
            data-qidahen-map-token-region={token.regionId}
            data-qidahen-map-token-troop-kind={isArmyToken ? token.troopKind : undefined}
            data-qidahen-map-token-outlined="true"
            data-qidahen-army-face={isArmyToken ? (revealFront ? 'front' : 'hidden-back') : undefined}
            data-grant-pardon-source-selectable={grantPardonSourceSelectable ? 'true' : undefined}
            data-grant-pardon-source-selected={
                grantPardonSourceSelectable ? String(grantPardonSourceSelected) : undefined
            }
            data-pending-committed-selectable={pendingCommittedSelectable ? 'true' : undefined}
            data-pending-committed-selected={pendingCommittedSelectable ? String(pendingCommittedSelected) : undefined}
            data-pending-committed-index={pendingCommittedSelectable ? token.troopIndex : undefined}
            data-pincer-advance-selectable={pincerAdvanceSelectable ? 'true' : undefined}
            data-pincer-advance-selected={pincerAdvanceSelectable ? String(pincerAdvanceSelected) : undefined}
            data-instigate-defection-selectable={instigateDefectionSelectable ? 'true' : undefined}
            data-wuzhen-chaoha-selectable={wuzhenChaohaSelectable ? 'true' : undefined}
            role={tokenSelectable ? 'button' : undefined}
            aria-pressed={
                tokenSelectable && !instigateDefectionSelectable && !wuzhenChaohaSelectable
                    ? grantPardonSourceSelectable
                        ? grantPardonSourceSelected
                        : pincerAdvanceSelectable
                          ? pincerAdvanceSelected
                          : pendingCommittedSelected
                    : undefined
            }
            data-tutorial-id={
                tutorialResultArtilleryFocus
                    ? 'qidahen-tutorial-result-artillery'
                    : grantPardonSourceSelectable || grantPardonSourceSelected
                      ? `qidahen-grant-pardon-source-token-${token.id}`
                      : undefined
            }
            tabIndex={tokenSelectable ? 0 : undefined}
            onClick={
                grantPardonSourceSelectable
                    ? () => onSelectGrantPardonSource?.(token.regionId, token.id)
                    : wuzhenChaohaSelectable
                      ? () => onResolveWuzhenChaoha?.(token.id)
                      : instigateDefectionSelectable
                        ? () => onResolveInstigateDefection?.(token.id)
                        : pincerAdvanceSelectable
                          ? () => onTogglePincerAdvanceTroop?.(token.id)
                          : pendingCommittedSelectable && token.troopIndex
                            ? () => onSelectPendingCommittedTroops?.(token.troopIndex!)
                            : undefined
            }
            onKeyDown={
                tokenSelectable
                    ? (event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault();
                              if (grantPardonSourceSelectable) {
                                  onSelectGrantPardonSource?.(token.regionId, token.id);
                              } else if (wuzhenChaohaSelectable) {
                                  onResolveWuzhenChaoha?.(token.id);
                              } else if (instigateDefectionSelectable) {
                                  onResolveInstigateDefection?.(token.id);
                              } else if (pincerAdvanceSelectable) {
                                  onTogglePincerAdvanceTroop?.(token.id);
                              } else if (token.troopIndex) {
                                  onSelectPendingCommittedTroops?.(token.troopIndex);
                              }
                          }
                      }
                    : undefined
            }
            style={{
                left: token.x * QIDAHEN_MAP_WIDTH,
                top: token.y * QIDAHEN_MAP_HEIGHT,
                width: size,
                height: size,
                color: UI_STYLE.ink,
                transform: `translate(-50%, -50%) rotate(${token.rotationDeg ?? 0}deg) scale(${tutorialResultArtilleryFocus ? 1.45 : 1})`,
                opacity: resolvedSelectionTone?.opacity,
                filter: resolvedSelectionTone?.filter,
                boxShadow: resolvedBoxShadow ?? MAP_TOKEN_IDLE_OUTLINE,
                zIndex: tutorialResultArtilleryFocus ? 72 : tokenSelectable ? 64 : undefined,
            }}
        >
            {showTokenImage ? (
                <>
                    <OptimizedImage
                        src={tokenImageSrc}
                        alt={token.id}
                        className={`h-full w-full object-cover ${tokenShapeClass}`}
                        draggable={false}
                        placeholder={false}
                        style={{ boxShadow: tokenSelectable ? 'none' : `0 2px 8px ${UI_STYLE.shadowSoft}` }}
                    />
                    {showImageValueBadge ? (
                        <span
                            className={`absolute -bottom-1 -right-1 grid min-h-[18px] min-w-[18px] place-items-center border-[2px] px-1 text-[11px] leading-none ${tokenShapeClass}`}
                            style={{
                                borderColor: tone.border,
                                background: UI_STYLE.paperLight,
                                color: UI_STYLE.ink,
                                boxShadow: `0 2px 6px ${UI_STYLE.shadowSoft}`,
                            }}
                        >
                            {token.value}
                        </span>
                    ) : null}
                </>
            ) : isArmyToken ? (
                <span
                    className={`grid h-full w-full place-items-center border-2 ${tokenShapeClass}`}
                    data-qidahen-army-face="hidden-back"
                    style={{
                        borderColor: UI_STYLE.mapInk,
                        background: armyHiddenBackColorByFaction[token.faction],
                        boxShadow: `inset 0 0 0 1px rgba(255,241,205,0.22), 0 2px 8px ${UI_STYLE.shadowSoft}`,
                    }}
                    aria-label={t('board.map.armyBackAlt', { defaultValue: '部队背面' })}
                />
            ) : (
                <span
                    className={`grid h-full w-full place-items-center border-2 ${tokenShapeClass}`}
                    style={{ borderColor: tone.border, background: UI_STYLE.paperLight }}
                >
                    {token.value}
                </span>
            )}
            {pendingCommittedSelectable ? (
                <span
                    aria-hidden="true"
                    data-testid={`qidahen-pending-committed-highlight-${token.id}`}
                    className={`pointer-events-none absolute inset-[-2px] ${tokenShapeClass}`}
                    style={{
                        border: pendingCommittedSelected ? '1.5px solid #8cf694' : '1.5px solid #69d873',
                        background: pendingCommittedSelected
                            ? 'rgba(101, 255, 128, 0.045)'
                            : 'rgba(87, 240, 103, 0.028)',
                        boxShadow: pendingCommittedSelected
                            ? '0 0 6px rgba(134, 255, 145, 0.42), inset 0 0 3px rgba(134, 255, 145, 0.14)'
                            : '0 0 5px rgba(93, 240, 108, 0.34), inset 0 0 2px rgba(93, 240, 108, 0.1)',
                    }}
                />
            ) : null}
            {pincerAdvanceSelectable ? (
                <span
                    aria-hidden="true"
                    data-testid={`qidahen-pincer-advance-highlight-${token.id}`}
                    className={`pointer-events-none absolute inset-[-2px] ${tokenShapeClass}`}
                    style={{
                        border: pincerAdvanceSelected ? '1.5px solid #8cf694' : '1.25px solid #69d873',
                        background: pincerAdvanceSelected ? 'rgba(101, 255, 128, 0.05)' : 'rgba(87, 240, 103, 0.025)',
                        boxShadow: pincerAdvanceSelected
                            ? '0 0 7px rgba(134, 255, 145, 0.46), inset 0 0 3px rgba(134, 255, 145, 0.14)'
                            : '0 0 4px rgba(93, 240, 108, 0.28)',
                    }}
                />
            ) : null}
            {grantPardonSourceSelectable ? (
                <span
                    aria-hidden="true"
                    data-testid={`qidahen-grant-pardon-source-highlight-${token.id}`}
                    className={`pointer-events-none absolute inset-[-4px] ${tokenShapeClass}`}
                    style={{
                        border: grantPardonSourceSelected ? '3px solid #ffe29a' : '2px solid #8cff9a',
                        background: grantPardonSourceSelected
                            ? 'rgba(255, 214, 102, 0.14)'
                            : 'rgba(116, 255, 137, 0.06)',
                        boxShadow: grantPardonSourceSelected
                            ? '0 0 14px rgba(255, 226, 154, 0.9), inset 0 0 8px rgba(116, 255, 137, 0.42)'
                            : '0 0 9px rgba(116, 255, 137, 0.68), inset 0 0 4px rgba(116, 255, 137, 0.2)',
                    }}
                />
            ) : null}
            {grantPardonSourceSelected ? (
                <span
                    className="pointer-events-none absolute -right-4 -top-5 z-50 rounded border-2 border-[#ffe29a] bg-[rgba(23,83,43,0.96)] px-2 py-1 text-[11px] font-black tracking-wide text-[#fff4c9] shadow-[0_3px_10px_rgba(36,93,46,0.82)]"
                    data-testid={`qidahen-grant-pardon-source-selected-badge-${token.id}`}
                >
                    {t('board.map.grantPardonSourceSelected', { defaultValue: '已选来源' })}
                </span>
            ) : null}
        </div>
    );
};
