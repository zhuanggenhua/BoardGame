import React from 'react';

export const QidahenHudViewport = React.createContext({ width: 1920, height: 1080, isMobileLandscape: false });
export const QIDAHEN_MOBILE_HAND_LAYOUT = {
    cardWidth: 128,
    cardHeight: Math.round(128 * 251 / 182),
    sideReserve: 504,
    centerOffset: 68,
    selectedLift: 20,
    accessoryHeight: 44,
} as const;

/** HUD 子区只消费壳层测量结果，不再各自监听 window 并重算断点。 */
export const useQidahenHudViewport = () => React.useContext(QidahenHudViewport);
