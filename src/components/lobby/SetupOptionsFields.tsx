import { useMemo } from 'react';
import type { TFunction } from 'i18next';
import type { GameManifestEntry } from '../../shared/gameManifest.types';
import {
    isMultiSelectField,
    isSelectField,
    type GameSetupSelections,
} from '../../shared/gameSetupOptions';

interface SetupOptionsFieldsProps {
    gameManifest: GameManifestEntry;
    selections: GameSetupSelections;
    onSelectionsChange: (next: GameSetupSelections) => void;
    t: TFunction;
    gameNamespace: string;
    numPlayers: number;
}

export function SetupOptionsFields({
    gameManifest,
    selections,
    onSelectionsChange,
    t,
    gameNamespace,
    numPlayers,
}: SetupOptionsFieldsProps) {
    const setupEntries = useMemo(
        () => Object.entries(gameManifest.setupOptions ?? {}),
        [gameManifest.setupOptions],
    );

    if (setupEntries.length === 0) {
        return null;
    }

    const resolveSetupLabel = (labelKey: string): string => {
        const gamePrefix = `games.${gameManifest.id}.`;
        if (labelKey.startsWith(gamePrefix)) {
            return t(labelKey.slice(gamePrefix.length), {
                ns: gameNamespace,
                defaultValue: labelKey,
            });
        }
        const gameScopedLabel = t(labelKey, {
            ns: gameNamespace,
            defaultValue: labelKey,
        });
        if (gameScopedLabel !== labelKey) {
            return gameScopedLabel;
        }
        return t(labelKey, { defaultValue: labelKey });
    };

    const updateSelectField = (fieldKey: string, value: string) => {
        onSelectionsChange({
            ...selections,
            [fieldKey]: value,
        });
    };

    const toggleMultiSelectFieldValue = (fieldKey: string, optionValue: string) => {
        const currentRaw = selections[fieldKey];
        const current = Array.isArray(currentRaw) ? currentRaw : [];
        const next = current.includes(optionValue)
            ? current.filter((value) => value !== optionValue)
            : [...current, optionValue];

        onSelectionsChange({
            ...selections,
            [fieldKey]: next,
        });
    };

    return (
        <div className="space-y-4">
            {setupEntries.map(([fieldKey, field]) => {
                const fieldValue = selections[fieldKey];

                if (isSelectField(field)) {
                    const options = field.optionsByPlayerCount?.[numPlayers] ?? field.options ?? [];
                    const fallbackValue = (
                        field.default && options.some((option) => option.value === field.default)
                            ? field.default
                            : options[0]?.value
                    ) ?? '';
                    const selectedValue = (
                        typeof fieldValue === 'string' && options.some((option) => option.value === fieldValue)
                            ? fieldValue
                            : fallbackValue
                    );

                    if (field.presentation === 'segmented') {
                        return (
                            <div key={fieldKey}>
                                <label className="block text-sm font-bold text-parchment-base-text mb-2">
                                    {resolveSetupLabel(field.labelKey)}
                                </label>
                                <div className="flex flex-wrap gap-2">
                                    {options.map((option) => {
                                        const selected = option.value === selectedValue;
                                        const optionLabel = resolveSetupLabel(option.labelKey);
                                        return (
                                            <button
                                                key={option.value}
                                                type="button"
                                                onClick={() => updateSelectField(fieldKey, option.value)}
                                                aria-pressed={selected}
                                                data-testid={`setup-option-select-${fieldKey}-${option.value}`}
                                                className={`inline-flex items-center rounded-[4px] border px-3 py-2 text-sm font-bold transition-colors cursor-pointer ${
                                                    selected
                                                        ? 'border-[#875b3b] bg-[#875b3b] text-[#f6e6cd] shadow-sm'
                                                        : 'border-parchment-card-border/30 bg-parchment-base-bg/40 text-parchment-light-text hover:border-parchment-base-text/40 hover:bg-parchment-card-bg hover:text-parchment-base-text'
                                                }`}
                                            >
                                                <span>{optionLabel}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    }

                    return (
                        <div key={fieldKey}>
                            <label className="block text-sm font-bold text-parchment-base-text mb-2">
                                {resolveSetupLabel(field.labelKey)}
                            </label>
                            <select
                                data-testid={`setup-option-select-${fieldKey}`}
                                value={selectedValue}
                                onChange={(event) => updateSelectField(fieldKey, event.target.value)}
                                className="w-full px-4 py-2.5 rounded-[4px] text-base sm:text-sm border border-parchment-card-border/30 bg-parchment-card-bg text-parchment-base-text focus:outline-none focus:border-parchment-base-text cursor-pointer appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2212%22%20height%3D%2212%22%20viewBox%3D%220%200%2012%2012%22%3E%3Cpath%20fill%3D%22%23433422%22%20d%3D%22M2%204l4%204%204-4%22%2F%3E%3C%2Fsvg%3E')] bg-no-repeat bg-[right_12px_center]"
                            >
                                {options.map((option) => (
                                    <option key={option.value} value={option.value}>
                                        {resolveSetupLabel(option.labelKey)}
                                    </option>
                                ))}
                            </select>
                        </div>
                    );
                }

                if (!isMultiSelectField(field)) {
                    return null;
                }

                const selectedValues = Array.isArray(fieldValue)
                    ? fieldValue
                    : [...(field.default ?? field.options.map((option) => option.value))];

                return (
                    <div key={fieldKey}>
                        <label className="block text-sm font-bold text-parchment-base-text mb-2">
                            {resolveSetupLabel(field.labelKey)}
                        </label>
                        <div className="flex flex-wrap gap-2">
                            {field.options.map((option) => {
                                const enabled = selectedValues.includes(option.value);
                                const optionLabel = resolveSetupLabel(option.labelKey);

                                return (
                                    <button
                                        key={option.value}
                                        type="button"
                                        onClick={() => toggleMultiSelectFieldValue(fieldKey, option.value)}
                                        aria-pressed={enabled}
                                        aria-label={enabled
                                            ? t('createRoom.disableOption', { label: optionLabel })
                                            : t('createRoom.enableOption', { label: optionLabel })}
                                        data-testid={`setup-option-toggle-${fieldKey}-${option.value}`}
                                        className={`inline-flex items-center rounded-[4px] border px-3 py-2 text-sm transition-colors cursor-pointer ${
                                            enabled
                                                ? 'border-emerald-700/70 bg-emerald-50 text-emerald-900 shadow-sm'
                                                : 'border-parchment-card-border/30 bg-parchment-base-bg/40 text-parchment-light-text hover:border-parchment-base-text/40 hover:bg-parchment-card-bg hover:text-parchment-base-text'
                                        }`}
                                    >
                                        <span>{optionLabel}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
