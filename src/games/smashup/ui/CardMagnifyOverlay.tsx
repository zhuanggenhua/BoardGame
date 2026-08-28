/**
 * 大杀四方 - 卡牌放大预览覆盖层
 *
 * 通用组件，供 Board / FactionSelection / PromptOverlay 等复用。
 * 基于 MagnifyOverlay 通用壳 + SmashUp 卡牌数据。
 */

import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { MagnifyOverlay } from '../../../components/common/overlays/MagnifyOverlay';
import { CardPreview } from '../../../components/common/media/CardPreview';
import { getCardDef, getBaseDef, getBasePodVariantId, resolveCardName, resolveCardText } from '../data/cards';
import { getSmashUpRendererPreviewRef } from './cardPreviewHelper';
import { useSmashUpOverlay } from './SmashUpOverlayContext';

export const SMASHUP_FORCE_DISMISS_EVENT = 'smashup:force-dismiss-popup';
const CARD_ASPECT_RATIO = 0.714;
const BASE_CARD_ASPECT_RATIO = 1.43;

function magnifyFrameStyle(isBase: boolean): React.CSSProperties {
    const width = isBase ? '40vw' : '25vw';
    const maxWidth = isBase ? '600px' : '400px';
    const aspectRatio = isBase ? BASE_CARD_ASPECT_RATIO : CARD_ASPECT_RATIO;
    return {
        width,
        maxWidth,
        height: `calc(${width} / ${aspectRatio})`,
        maxHeight: `calc(${maxWidth} / ${aspectRatio})`,
        aspectRatio: `${aspectRatio} / 1`,
    };
}

export interface CardMagnifyTarget {
    defId: string;
    type: 'minion' | 'base' | 'action' | 'titan';
    overlayDefId?: string;
}

interface Props {
    target: CardMagnifyTarget | null;
    onClose: () => void;
}

export const CardMagnifyOverlay: React.FC<Props> = ({ target, onClose }) => {
    const { t } = useTranslation('game-smashup');
    const { selectedFactions } = useSmashUpOverlay();

    useEffect(() => {
        if (!target || typeof window === 'undefined') return;
        const handleForceDismiss = () => {
            onClose();
        };
        window.addEventListener(SMASHUP_FORCE_DISMISS_EVENT, handleForceDismiss);
        return () => {
            window.removeEventListener(SMASHUP_FORCE_DISMISS_EVENT, handleForceDismiss);
        };
    }, [onClose, target]);

    if (!target) return null;

    const baseDef = target.type === 'base' ? getBaseDef(target.defId) : undefined;
    const resolvedBaseDefId = baseDef ? getBasePodVariantId(baseDef, selectedFactions) : target.defId;
    const def = target.type === 'base'
        ? (getBaseDef(resolvedBaseDefId) ?? baseDef)
        : getCardDef(target.defId);
    if (!def) return null;

    const previewDefId = target.type === 'base' ? resolvedBaseDefId : target.defId;
    const resolvedName = resolveCardName(def, t) || previewDefId;
    const resolvedText = resolveCardText(def, t);
    const isBase = target.type === 'base';
    const previewRef = getSmashUpRendererPreviewRef(previewDefId, {
        forceShowOverlay: true,
        overlayDefId: target.type === 'minion' ? target.overlayDefId : undefined,
    });

    return (
        <MagnifyOverlay isOpen onClose={onClose} overlayTestId="su-card-magnify-overlay">
            <div
                data-testid="su-card-magnify-content"
                data-card-type={target.type}
                data-card-def-id={target.defId}
                className="relative bg-transparent"
                style={magnifyFrameStyle(isBase)}
            >
                <button
                    onClick={onClose}
                    className="smashup-close-button absolute -top-4 -right-4 rounded-full w-8 h-8 font-black border-2 z-50 hover:scale-110 transition-transform"
                >
                    X
                </button>
                <CardPreview
                    previewRef={previewRef ?? undefined}
                    className="w-full h-full rounded-xl shadow-2xl"
                    title={resolvedName}
                />
                {!previewRef && (
                    <div className="smashup-paper-panel absolute inset-0 rounded-xl p-6 border-4 flex flex-col items-center justify-center text-center">
                        <h2 className="text-3xl font-black uppercase mb-4">{resolvedName}</h2>
                        <p className="font-mono text-lg">{resolvedText}</p>
                    </div>
                )}
            </div>
        </MagnifyOverlay>
    );
};
