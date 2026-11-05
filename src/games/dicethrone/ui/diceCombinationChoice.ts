export interface DiceCombinationChoiceOption {
    id: string;
    customId?: string;
    disabled?: boolean;
    value?: number;
    dicePreview?: {
        characterId: string;
        dice: Array<{ index: number; value: number }>;
    };
}

export interface DiceCombinationChoice {
    characterId: string;
    selectCount: number;
    allowedDieIds: number[];
    dice: Array<{ id: number; value: number }>;
    options: Array<{ id: string; dieIds: number[] }>;
}

/**
 * Recognize a complete set of visible dice combinations. The returned IDs map
 * the existing DiceTray selection back to the original, server-authored option.
 */
export function describeDiceCombinationChoice(
    options: readonly DiceCombinationChoiceOption[],
    expectedCharacterId?: string,
): DiceCombinationChoice | undefined {
    if (options.length < 2 || options.some(option => option.disabled || !option.id || !option.dicePreview)) {
        return undefined;
    }

    const first = options[0]!;
    const characterId = first.dicePreview!.characterId;
    const customId = first.customId;
    const selectCount = first.dicePreview!.dice.length;
    if (
        !characterId
        || (expectedCharacterId && expectedCharacterId !== characterId)
        || !customId
        || selectCount < 1
        || options.some(option => (
            option.customId !== customId
            || option.dicePreview?.characterId !== characterId
            || option.dicePreview.dice.length !== selectCount
        ))
    ) return undefined;

    const diceById = new Map<number, number>();
    const optionKeys = new Set<string>();
    const projectedOptions: Array<{ id: string; dieIds: number[] }> = [];

    for (const option of options) {
        const previewDice = option.dicePreview!.dice;
        const dieIds = previewDice.map(die => die.index).sort((left, right) => left - right);
        if (
            new Set(dieIds).size !== selectCount
            || dieIds.some(id => !Number.isInteger(id) || id < 0)
            || previewDice.some(die => !Number.isInteger(die.value) || die.value < 1 || die.value > 6)
        ) return undefined;

        const key = dieIds.join(',');
        if (optionKeys.has(key)) return undefined;
        optionKeys.add(key);

        for (const die of previewDice) {
            const existingValue = diceById.get(die.index);
            if (existingValue !== undefined && existingValue !== die.value) return undefined;
            diceById.set(die.index, die.value);
        }

        if (option.value !== undefined && option.value !== previewDice.reduce((sum, die) => sum + die.value, 0)) {
            return undefined;
        }
        projectedOptions.push({ id: option.id, dieIds });
    }

    const allowedDieIds = Array.from(diceById.keys()).sort((left, right) => left - right);
    if (allowedDieIds.length <= selectCount) return undefined;

    const choose = (n: number, k: number): number => {
        const count = Math.min(k, n - k);
        let result = 1;
        for (let index = 1; index <= count; index += 1) {
            result = result * (n - count + index) / index;
        }
        return result;
    };
    if (choose(allowedDieIds.length, selectCount) !== options.length) return undefined;

    return {
        characterId,
        selectCount,
        allowedDieIds,
        dice: allowedDieIds.map(id => ({ id, value: diceById.get(id)! })),
        options: projectedOptions,
    };
}
