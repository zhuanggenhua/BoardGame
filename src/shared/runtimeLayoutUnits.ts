const formatRuntimeUnitMultiplier = (value: number) => {
    if (!Number.isFinite(value)) {
        return '0';
    }

    const normalized = Number.parseFloat(value.toFixed(4));
    return Number.isInteger(normalized) ? String(normalized) : String(normalized);
};

export const buildRuntimeInlineUnitValue = (multiplier: number, fallback = '1vw') =>
    `calc(var(--mobile-layout-inline-unit, ${fallback}) * ${formatRuntimeUnitMultiplier(multiplier)})`;

export const buildRuntimeBlockUnitValue = (multiplier: number, fallback = '1vh') =>
    `calc(var(--mobile-layout-block-unit, ${fallback}) * ${formatRuntimeUnitMultiplier(multiplier)})`;
