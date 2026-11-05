import { useTranslation } from 'react-i18next';
import { createPortal } from 'react-dom';
import { UI_Z_INDEX } from '../../../core';
import type { PlayerId } from '../../../engine/types';
import {
    MAGE_WARS_OBJECT_ABILITY_IDS,
    type MageWarsMageAbilityId,
    type MageWarsObjectAbilityId,
} from '../domain/ids';

function getMageWarsObjectAbilityButtonTestId(abilityId: MageWarsObjectAbilityId): string {
    if (abilityId === MAGE_WARS_OBJECT_ABILITY_IDS.ASYRAN_CLERIC_HEALING_LIGHT) {
        return 'mage-wars-selected-object-ability-healing-light';
    }
    return `mage-wars-selected-object-ability-${abilityId.replace(/[^a-z0-9]+/gi, '-')}`;
}

function getObjectAbilityActionLabel(
    abilityId: MageWarsObjectAbilityId,
    abilityName: string,
    labels: { activate: string; rebind: string },
): { label: string; visual: 'text-action' | 'action-label' } {
    if (abilityId === MAGE_WARS_OBJECT_ABILITY_IDS.ELEMENTAL_STAFF_BIND
        || abilityId === MAGE_WARS_OBJECT_ABILITY_IDS.MAGE_STAFF_BIND) {
        return { label: labels.rebind, visual: 'action-label' };
    }
    if (abilityId === MAGE_WARS_OBJECT_ABILITY_IDS.BEAST_STAFF) {
        return { label: labels.activate, visual: 'action-label' };
    }
    return { label: abilityName, visual: 'text-action' };
}

const ACTION_BUTTON_CLASS = 'h-12 min-h-12 min-w-[8.5rem] shrink-0 whitespace-nowrap rounded-[0.25rem] bg-amber-200 px-4 py-2 text-sm font-black text-stone-950 shadow-[0_8px_18px_rgba(0,0,0,0.36)] transition hover:bg-amber-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-100';
const GUARD_BUTTON_CLASS = 'h-12 min-h-12 min-w-[8.5rem] shrink-0 whitespace-nowrap rounded-[0.25rem] bg-emerald-200 px-4 py-2 text-sm font-black text-stone-950 shadow-[0_8px_18px_rgba(0,0,0,0.36)] transition hover:bg-emerald-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-100';
const MAGE_BUTTON_CLASS = 'h-12 min-h-12 min-w-[8.5rem] shrink-0 whitespace-nowrap rounded-[0.25rem] bg-cyan-200 px-4 py-2 text-sm font-black text-stone-950 shadow-[0_8px_18px_rgba(0,0,0,0.36)] transition hover:bg-cyan-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-100';
const SPELLBOOK_CARD_HEIGHT = 'clamp(13.75rem, min(29vh, 14.85vw), 24rem)';
const ACTION_DOCK_GAP = '2.5rem';
const ACTION_DOCK_BOTTOM = `calc(${SPELLBOOK_CARD_HEIGHT} + ${ACTION_DOCK_GAP})`;
const ACTION_DOCK_BAR_CLASS = 'pointer-events-auto flex h-12 min-h-12 w-[min(32rem,calc(100vw-2rem))] flex-nowrap items-center justify-center gap-2';

export type MageWarsAbilityModeChoice = {
    id: string;
    label: string;
    mode?: string;
    onSelect: () => void;
};

export function MageWarsSelectedAbilityActionDock({
    objectId,
    objectAbilities,
    magePlayerId,
    mageAbility,
    canGuard,
    boundSpellCast,
    modeChoices,
    onGuard,
    onObjectAbilitySelect,
    onMageAbilitySelect,
}: {
    objectId?: string;
    objectAbilities?: readonly { id: MageWarsObjectAbilityId; name: string }[];
    magePlayerId?: PlayerId;
    mageAbility?: { abilityId: MageWarsMageAbilityId; name: string };
    canGuard: boolean;
    boundSpellCast?: { spellCardId: number; name: string; onSelect: () => void };
    modeChoices?: readonly MageWarsAbilityModeChoice[];
    onGuard: () => void;
    onObjectAbilitySelect: (sourceObjectId: string, abilityId: MageWarsObjectAbilityId) => void;
    onMageAbilitySelect: (playerId: PlayerId, abilityId: MageWarsMageAbilityId) => void;
}) {
    const { t } = useTranslation('game-mage-wars');
    const availableObjectAbilities = objectAbilities ?? [];
    const objectAbilityLabels = {
        activate: t('actions.activateAbility'),
        rebind: t('actions.rebindSpell'),
    };
    const sourceKey = objectId != null
        ? `object:${objectId}`
        : magePlayerId != null
            ? `mage:${magePlayerId}`
            : null;
    const hasModeChoices = Boolean(modeChoices && modeChoices.length > 0);
    const hasPrimaryActions = availableObjectAbilities.length > 0 || Boolean(mageAbility) || canGuard || Boolean(boundSpellCast);
    if (!hasModeChoices && !hasPrimaryActions) return null;
    if (typeof document === 'undefined') return null;

    const dock = (
        <aside
            className="pointer-events-none fixed inset-x-0 z-[2200] flex justify-center px-4"
            style={{ bottom: ACTION_DOCK_BOTTOM, zIndex: UI_Z_INDEX.modalContent }}
            data-testid="mage-wars-selected-ability-action-dock"
            data-tutorial-id="mw-ability-action-dock"
            data-ability-action-placement="middle-lower-action-dock"
            data-ability-source-key={sourceKey}
        >
            <section className={ACTION_DOCK_BAR_CLASS}>
                {hasModeChoices ? modeChoices!.map((choice) => (
                    <button
                        key={choice.id}
                        type="button"
                        className={ACTION_BUTTON_CLASS}
                        data-testid="mage-wars-object-ability-choice-option"
                        data-mode={choice.mode}
                        data-choice-id={choice.id}
                        data-ability-action-placement="middle-lower-action-dock"
                        onClick={choice.onSelect}
                    >
                        {choice.label}
                    </button>
                )) : (
                    <>
                        {canGuard ? (
                            <button
                                type="button"
                                className={GUARD_BUTTON_CLASS}
                                aria-label={t('actions.guardCreature')}
                                title={t('actions.guardCreature')}
                                data-testid="mage-wars-selected-unit-guard"
                                data-tutorial-id="mw-selected-unit-guard"
                                data-action-kind="guard"
                                data-action-visual="text-action"
                                data-action-placement="middle-lower-action-dock"
                                onClick={onGuard}
                            >
                                {t('actions.guardCreature')}
                            </button>
                        ) : null}
                        {boundSpellCast ? (
                            <button
                                type="button"
                                className={ACTION_BUTTON_CLASS}
                                aria-label={t('actions.castBoundSpell', { name: boundSpellCast.name })}
                                title={t('actions.castBoundSpell', { name: boundSpellCast.name })}
                                data-testid="mage-wars-selected-bound-spell-cast"
                                data-bound-spell-card-id={boundSpellCast.spellCardId}
                                data-ability-visual="action-label"
                                data-ability-action-placement="middle-lower-action-dock"
                                onClick={boundSpellCast.onSelect}
                            >
                                {t('actions.castBoundSpell', { name: boundSpellCast.name })}
                            </button>
                        ) : null}
                        {objectId ? availableObjectAbilities.map((ability) => {
                            const action = getObjectAbilityActionLabel(ability.id, ability.name, objectAbilityLabels);
                            return (
                                <button
                                    key={ability.id}
                                    type="button"
                                    className={ACTION_BUTTON_CLASS}
                                    aria-label={ability.name}
                                    title={ability.name}
                                    data-testid={getMageWarsObjectAbilityButtonTestId(ability.id)}
                                    data-tutorial-id={ability.id === MAGE_WARS_OBJECT_ABILITY_IDS.ASYRAN_CLERIC_HEALING_LIGHT
                                        ? 'mw-ability-healing-light'
                                        : `mw-object-ability-${ability.id.replace(/[^a-z0-9]+/gi, '-')}`}
                                    data-ability-id={ability.id}
                                    data-ability-visual={action.visual}
                                    data-ability-action-placement="middle-lower-action-dock"
                                    onClick={() => onObjectAbilitySelect(objectId, ability.id)}
                                >
                                    {action.label}
                                </button>
                            );
                        }) : null}
                        {magePlayerId && mageAbility ? (
                            <button
                                type="button"
                                className={MAGE_BUTTON_CLASS}
                                aria-label={mageAbility.name}
                                title={mageAbility.name}
                                data-testid="mage-wars-selected-mage-ability-restore"
                                data-tutorial-id="mw-ability-restore"
                                data-ability-visual="text-action"
                                data-ability-action-placement="middle-lower-action-dock"
                                onClick={() => onMageAbilitySelect(magePlayerId, mageAbility.abilityId)}
                            >
                                {mageAbility.name}
                            </button>
                        ) : null}
                    </>
                )}
            </section>
        </aside>
    );

    return createPortal(dock, document.body);
}
