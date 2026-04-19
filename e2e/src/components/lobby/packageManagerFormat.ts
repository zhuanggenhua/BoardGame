export const formatPackageBytes = (bytes: number | undefined, unknownLabel: string) => {
    if (typeof bytes !== 'number' || !Number.isFinite(bytes) || bytes <= 0) {
        return unknownLabel;
    }

    const units = ['B', 'KB', 'MB', 'GB'];
    let value = bytes;
    let unitIndex = 0;
    while (value >= 1024 && unitIndex < units.length - 1) {
        value /= 1024;
        unitIndex += 1;
    }

    const digits = value >= 100 || unitIndex === 0 ? 0 : value >= 10 ? 1 : 2;
    return `${value.toFixed(digits)} ${units[unitIndex]}`;
};

export const hasKnownPackageBytes = (bytes: number | undefined) => (
    typeof bytes === 'number'
    && Number.isFinite(bytes)
    && bytes > 0
);
