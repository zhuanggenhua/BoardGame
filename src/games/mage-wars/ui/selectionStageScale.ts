export const MAGE_SELECTION_STAGE_WIDTH = 1920;
export const MAGE_SELECTION_STAGE_HEIGHT = 1080;

export const resolveMageSelectionStageScale = (
    viewportWidth: number,
    viewportHeight: number,
    isBoardShellMobileViewport: boolean,
) => {
    if (isBoardShellMobileViewport) {
        return 1;
    }

    const nextScale = Math.min(
        viewportWidth / MAGE_SELECTION_STAGE_WIDTH,
        viewportHeight / MAGE_SELECTION_STAGE_HEIGHT,
    );
    return Number.isFinite(nextScale) && nextScale > 0 ? nextScale : 1;
};
