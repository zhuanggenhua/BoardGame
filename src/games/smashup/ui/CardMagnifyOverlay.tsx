/**
 * 大杀四方 - 卡牌放大预览覆盖层
 *
 * 通用组件，供 Board / FactionSelection / PromptOverlay 等复用。
 * 基于 MagnifyOverlay 通用壳 + SmashUp 卡牌数据。
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { MagnifyOverlay } from '../../../components/common/overlays/MagnifyOverlay';
import { CardPreview } from '../../../components/common/media/CardPreview';
import { getCardDef, getBaseDef, resolveCardName, resolveCardText } from '../data/cards';

export interface CardMagnifyTarget {
    defId: string;
    type: 'minion' | 'base' | 'action';
}

interface Props {
    target: CardMagnifyTarget | null;
    onClose: () => void;
}

export const CardMagnifyOverlay: React.FC<Props> = ({ target, onClose }) => {
    const { t } = useTranslation('game-smashup');
    if (!target) return null;

    const def = target.type === 'base' ? getBaseDef(target.defId) : getCardDef(target.defId);
    if (!def) return null;

    const resolvedName = resolveCardName(def, t) || target.defId;
    const resolvedText = resolveCardText(def, t);
    const isBase = target.type === 'base';

    return (
        <MagnifyOverlay isOpen onClose={onClose}>
            <div
                className={`relative bg-transparent ${isBase ? 'w-[40vw] max-w-[600px] aspect-[1.43]' : 'w-[25vw] max-w-[400px] aspect-[0.714]'}`}
            >
                <button
                    onClick={onClose}
                    className="absolute -top-4 -right-4 bg-white text-black rounded-full w-8 h-8 font-black border-2 border-black z-50 hover:scale-110 transition-transform"
                >
                    X
                </button>
                <CardPreview
                    previewRef={def.previewRef}
                    className="w-full h-full object-contain rounded-xl shadow-2xl"
                    title={resolvedName}
                />
                {!def.previewRef && (
                    <div className="absolute inset-0 bg-white rounded-xl p-6 border-4 border-slate-800 flex flex-col items-center justify-center text-center">
                        <h2 className="text-3xl font-black uppercase mb-4">{resolvedName}</h2>
                        <p className="font-mono text-lg">{resolvedText}</p>
                    </div>
                )}
            </div>
        </MagnifyOverlay>
    );
};
