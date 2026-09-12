import type { TFunction } from 'i18next';

export interface OperationGuideFabEntry {
    id: string;
    label: string;
    description: string;
}

type OperationGuideActionInput = {
    id: string;
    label: string;
};

const resolveOperationGuideFabDescriptionKey = (id: string) => {
    if (id.startsWith('undo-') || id === 'undo') return 'undo';

    switch (id) {
        case 'action-log':
            return 'actionLog';
        case 'display-theme':
            return 'displayTheme';
        case 'download-app':
            return 'downloadApp';
        case 'check-update':
            return 'checkUpdate';
        case 'force-actions':
            return 'forceActions';
        case 'seat-swap':
            return 'seatSwap';
        default:
            return id;
    }
};

export const resolveOperationGuideFabLabel = (t: TFunction, id: string) => {
    const descriptionKey = resolveOperationGuideFabDescriptionKey(id);
    return String(t(`hud.operationGuide.fabLabels.${descriptionKey}`, {
        defaultValue: t(`hud.actions.${descriptionKey}`, {
            defaultValue: id,
        }),
    }));
};

export const buildOperationGuideFabEntries = (
    t: TFunction,
    actions: OperationGuideActionInput[],
): OperationGuideFabEntry[] => actions
    .filter((action) => action.id !== 'operation-guide')
    .map((action) => ({
        id: action.id,
        label: action.label,
        description: String(t(`hud.operationGuide.fab.${resolveOperationGuideFabDescriptionKey(action.id)}`, {
            defaultValue: t('hud.operationGuide.fab.custom'),
        })),
    }));
