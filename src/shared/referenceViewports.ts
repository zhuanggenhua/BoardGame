export const DESKTOP_REFERENCE_VIEWPORT = {
    width: 1920,
    height: 1080,
} as const;

// 手机横屏设计基线：2340x1080（13:6）。
export const MOBILE_LANDSCAPE_DESIGN_VIEWPORT = {
    width: 2340,
    height: 1080,
} as const;

// 手机横屏 E2E 采样视口：保持 13:6，同时落在移动断点内。
export const MOBILE_LANDSCAPE_E2E_VIEWPORT = {
    width: 936,
    height: 432,
} as const;

export const MOBILE_LANDSCAPE_REFERENCE_VIEWPORT = MOBILE_LANDSCAPE_E2E_VIEWPORT;

// 手机横屏放大基线：覆盖 900px 设计宽度上限的移动横屏布局。
export const MOBILE_LANDSCAPE_CAPPED_REFERENCE_VIEWPORT = {
    width: 1000,
    height: 500,
} as const;

export const MOBILE_REFERENCE_VIEWPORT = {
    width: 375,
    height: 812,
} as const;
