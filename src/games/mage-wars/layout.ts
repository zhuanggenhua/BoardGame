export const MAGE_WARS_PHASE_PROGRESS_RAIL_WIDTH = 'clamp(216px, 18vh, 235px)';
export const MAGE_WARS_PHASE_PROGRESS_RAIL_VIEWPORT_RATIO = 0.18;
export const MAGE_WARS_PHASE_PROGRESS_RAIL_MIN_WIDTH_PX = 216;
export const MAGE_WARS_PHASE_PROGRESS_RAIL_MAX_WIDTH_PX = 235;
export const MAGE_WARS_PHASE_PROGRESS_RAIL_SIDE_INSET_PX = 16;
export const MAGE_WARS_PHASE_PROGRESS_RAIL_TOP = 'var(--mage-wars-desktop-top-inset, 0.875rem)';
export const MAGE_WARS_PHASE_PROGRESS_RAIL_SELF_HUD_GAP = 'clamp(4rem, 4.2vw, 5rem)';
export const MAGE_WARS_GAME_HUD_FAB_BASE_LEFT_PX = 80;
export const MAGE_WARS_GAME_HUD_FAB_PHASE_RAIL_GAP_PX = 8;
export const MAGE_WARS_GAME_HUD_FAB_STORAGE_KEY = 'game_hud_fab_position:mage-wars:v4';

export const resolveMageWarsPhaseProgressRailWidth = (viewportHeight: number) => Math.min(
    MAGE_WARS_PHASE_PROGRESS_RAIL_MAX_WIDTH_PX,
    Math.max(
        MAGE_WARS_PHASE_PROGRESS_RAIL_MIN_WIDTH_PX,
        Math.round(viewportHeight * MAGE_WARS_PHASE_PROGRESS_RAIL_VIEWPORT_RATIO),
    ),
);

export const resolveMageWarsGameHudFabInitialOffset = (viewportHeight: number) => ({
    left: Math.max(
        136,
        resolveMageWarsPhaseProgressRailWidth(viewportHeight)
        + MAGE_WARS_PHASE_PROGRESS_RAIL_SIDE_INSET_PX
        + MAGE_WARS_GAME_HUD_FAB_PHASE_RAIL_GAP_PX
        - MAGE_WARS_GAME_HUD_FAB_BASE_LEFT_PX,
    ),
});
