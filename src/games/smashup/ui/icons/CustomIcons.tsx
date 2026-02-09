import React from 'react';
import type { LucideProps } from 'lucide-react';

/**
 * 遵循项目 Lucide 风格的自定义 SVG 图标库
 */

// 1. 忍者的手里剑 (Shuriken)
export const ShurikenIcon = ({ size = 24, strokeWidth = 2, ...props }: LucideProps) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        {...props}
    >
        {/* 中心圆孔 */}
        <circle cx="12" cy="12" r="2.5" />
        {/* 四个锋利的角，带有流线型弧度 */}
        <path d="M12 2 L15 9 L22 12 L15 15 L12 22 L9 15 L2 12 L9 9 Z" />
        <path d="M11 11 L6 6" />
        <path d="M13 11 L18 6" />
        <path d="M11 13 L6 18" />
        <path d="M13 13 L18 18" />
    </svg>
);

// 2. 章鱼头/触手头 (Tentacled Head) - 优化为更具异形感的 Cthulhu 风格
export const OctopusHeadIcon = ({ size = 24, strokeWidth = 2, ...props }: LucideProps) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        {...props}
    >
        {/* 脑状头部轮廓 - 梨形，上方略宽带褶皱感 */}
        <path d="M12 2C9.5 2 7 4 7 8C7 11 9 12 10 13" />
        <path d="M12 2C14.5 2 17 4 17 8C17 11 15 12 14 13" />

        {/* 深邃的多眼感 */}
        <circle cx="9.5" cy="8" r="1" fill="currentColor" />
        <circle cx="14.5" cy="8" r="1" fill="currentColor" />
        <circle cx="12" cy="10" r="0.8" fill="currentColor" stroke="none" />

        {/* 脸部交织卷曲的触手 */}
        <path d="M9 13C7 15 6 18 8 21" />
        <path d="M11 13C10 16 10 19 11 22" />
        <path d="M13 13C14 16 14 19 13 22" />
        <path d="M15 13C17 15 18 18 16 21" />

        {/* 横向的小触手增强异形感 */}
        <path d="M8 11C6 11 4 13 5 15" />
        <path d="M16 11C18 11 20 13 19 15" />
    </svg>
);

// 3. 星形头 (Elder Thing Star Head) - 备选，专门用于远古物种
export const StarHeadIcon = ({ size = 24, strokeWidth = 2, ...props }: LucideProps) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        {...props}
    >
        {/* 五角星头 */}
        <path d="M12 4 L14 10 L20 10 L15 14 L17 21 L12 17 L7 21 L9 14 L4 10 L10 10 Z" />
        {/* 顶部的触角感 */}
        <circle cx="12" cy="12" r="1.5" />
    </svg>
);
