/**
 * 调试面板内的布局保存按钮
 * 从 Board.tsx 提取
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import type { AbilityOverlaysHandle } from './AbilityOverlays';
import {
    getPlayerBoardDimensions,
    getPlayerBoardLayoutVersion,
} from './abilitySlotLayout';

export const LayoutSaveButton = ({
    abilityOverlaysRef,
    characterId,
}: {
    abilityOverlaysRef: React.RefObject<AbilityOverlaysHandle | null>;
    characterId: string;
}) => {
    const { t } = useTranslation('game-dicethrone');
    const [isSaving, setIsSaving] = React.useState(false);
    const [saveHint, setSaveHint] = React.useState<string | null>(null);
    const layoutVersion = getPlayerBoardLayoutVersion(characterId);
    const dimensions = getPlayerBoardDimensions(characterId);

    const handleSave = React.useCallback(async () => {
        if (!abilityOverlaysRef.current) return;
        setIsSaving(true);
        setSaveHint(null);
        const result = await abilityOverlaysRef.current.saveLayout();
        setSaveHint(result.hint);
        setIsSaving(false);
    }, [abilityOverlaysRef]);

    return (
        <div className="space-y-1">
            <div className="rounded border border-slate-700 bg-slate-900/70 px-2 py-1 text-[10px] text-slate-300">
                {t('layout.currentLayout', {
                    version: layoutVersion.toUpperCase(),
                    width: dimensions.width,
                    height: dimensions.height,
                })}
            </div>
            <button
                onClick={handleSave}
                disabled={isSaving}
                className={`w-full py-2 rounded font-bold text-xs border transition-[background-color] duration-200 ${isSaving ? 'bg-emerald-300 border-emerald-200 text-black/70' : 'bg-emerald-600 border-emerald-400 text-white hover:bg-emerald-500'}`}
            >
                {isSaving ? t('layout.saving') : t('layout.saveLayout', { version: layoutVersion.toUpperCase() })}
            </button>
            {saveHint && (
                <p className="text-[10px] text-emerald-400 bg-black/40 px-2 py-1 rounded">{saveHint}</p>
            )}
        </div>
    );
};
