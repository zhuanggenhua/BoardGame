import React from 'react';
import type { LucideProps } from 'lucide-react';

/**
 * 遵循项目 Lucide 风格的自定义 SVG 图标库
 */

const SourceIconSvg = ({ size = 24, children, ...props }: LucideProps & { children: React.ReactNode }) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        viewBox="0 0 512 512"
        fill="currentColor"
        aria-hidden="true"
        {...props}
    >
        {children}
    </svg>
);

// SVG Repo Magic Lamp, CC0: https://www.svgrepo.com/svg/321082/magic-lamp
export const SvgRepoMagicLampIcon = (props: LucideProps) => (
    <SourceIconSvg {...props}>
        <path d="M203.72 87.938c-2.082.017-4.18.31-6.282.874-13.45 3.608-21.412 17.53-17.782 31.094 1.384 5.172 4.235 9.52 8 12.75-31.85 15.446-53.498 45.172-59.28 78.72l-22.532 7.593c-11.235-2.877-21.416-4.2-30.53-4.095-14.696.167-26.65 4.02-35.908 10.97-18.518 13.896-23.316 38.02-19.53 60.655 3.784 22.636 15.81 45.127 34.343 59.344 18.532 14.216 44.715 18.96 71.03 4.875 4.43-2.373 8.776-4.81 12.813-6.97 2.993 10.772 14.018 17.16 24.75 14.28 10.253-2.75 16.547-12.963 14.656-23.31 16.984 10.05 34.495 15.674 52.186 17.405-14.094 20.893-32.316 39.57-53.97 54.78 27.754 27.726 224.764-24.853 229.626-61.592-26.89-2.484-52.525-9.935-75.562-21.563 67.995-43.983 128.655-133.27 160.656-234.563l-42.47 14.344c-44.11 67.313-122.214 103.81-167.155 28-16.198-7.454-34.36-10.948-53-9.593 1.656-4.69 1.95-9.913.564-15.093-3.063-11.443-13.392-18.998-24.625-18.906zM76.062 233.53c5.11-.027 10.865.51 17.312 1.75 18.656 36.728 39.31 63.938 61.188 82.845-.767.113-1.546.263-2.313.47-.146.038-.293.08-.438.124-2.846.324-5.588 1.044-8.218 1.936-9.64 3.27-18.73 9.084-27.156 13.594-20.655 11.056-36.95 7.41-50.844-3.25-13.895-10.66-24.256-29.5-27.28-47.594-3.027-18.094.948-34.097 12.31-42.625 5.683-4.263 13.943-7.186 25.438-7.25z" />
    </SourceIconSvg>
);

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

// 4. 蚂蚁图标 (Ant) - 用于巨蚁派系
export const AntIcon = ({ size = 24, strokeWidth = 2, ...props }: LucideProps) => (
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
        {/* 头部 */}
        <circle cx="12" cy="6" r="2.5" />

        {/* 触角 */}
        <path d="M10.5 4.5 L8 2" />
        <path d="M13.5 4.5 L16 2" />

        {/* 胸部（中间节） */}
        <ellipse cx="12" cy="11" rx="2" ry="2.5" />

        {/* 腹部（后节，较大） */}
        <ellipse cx="12" cy="17" rx="3" ry="4" />

        {/* 6条腿（3对） */}
        {/* 前腿 */}
        <path d="M10.5 9.5 L7 8" />
        <path d="M13.5 9.5 L17 8" />
        {/* 中腿 */}
        <path d="M10 11.5 L6 12" />
        <path d="M14 11.5 L18 12" />
        {/* 后腿 */}
        <path d="M10.5 13 L7 16" />
        <path d="M13.5 13 L17 16" />
    </svg>
);

// 5. 双斧图标 (Double Axe) - 用于维京人派系
export const DoubleAxeIcon = ({ size = 24, strokeWidth = 2, ...props }: LucideProps) => (
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
        <path d="M7 3L17 21" />
        <path d="M17 3L7 21" />
        <path d="M6.5 4.5C4.5 5.5 3.5 7 3.5 9.5C5.8 9.5 7.7 8.5 9 6.5" />
        <path d="M17.5 4.5C19.5 5.5 20.5 7 20.5 9.5C18.2 9.5 16.3 8.5 15 6.5" />
        <path d="M6 19.5C4.4 18.8 3.5 17.4 3.5 15.5C5.5 15.5 7.2 16.2 8.5 17.8" />
        <path d="M18 19.5C19.6 18.8 20.5 17.4 20.5 15.5C18.5 15.5 16.8 16.2 15.5 17.8" />
    </svg>
);

// 6. 金字塔图标 (Pyramid) - 用于古埃及人派系
export const PyramidIcon = ({ size = 24, strokeWidth = 2, ...props }: LucideProps) => (
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
        <path d="M12 3L3 20.5H21L12 3Z" />
        <path d="M12 3V20.5" />
        <path d="M8 11H16" />
        <path d="M6 15.5H18" />
    </svg>
);

// 7. 牛仔帽图标 (Cowboy Hat) - 用于牛仔派系
export const CowboyHatIcon = ({ size = 24, strokeWidth = 2, ...props }: LucideProps) => (
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
        <path d="M8 8C8.6 5.2 10 3.5 12 3.5C14 3.5 15.4 5.2 16 8" />
        <path d="M7 8C6.8 10 6.4 11.8 5.8 13.4C7.6 14.3 9.8 14.8 12 14.8C14.2 14.8 16.4 14.3 18.2 13.4C17.6 11.8 17.2 10 17 8" />
        <path d="M2.5 14.5C4.8 13.6 7.8 13.2 12 13.2C16.2 13.2 19.2 13.6 21.5 14.5" />
        <path d="M3.5 16C5.8 18 8.5 19 12 19C15.5 19 18.2 18 20.5 16" />
        <path d="M9.5 9.5H14.5" />
    </svg>
);

// 8. 变形者图标 (Shapeshifter) - 用于变形者派系，避免与科学怪人重复
export const ShapeshifterIcon = ({ size = 24, strokeWidth = 2, ...props }: LucideProps) => (
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
        <path d="M12 3L16 7L12 11L8 7L12 3Z" />
        <path d="M8 7L5 12L8 17L12 21L16 17L19 12L16 7" />
        <path d="M8.5 12H15.5" />
        <path d="M10 9.5L14 14.5" />
        <path d="M14 9.5L10 14.5" />
    </svg>
);

// 9. 武士刀图标 (Katana) - 用于武士派系
export const KatanaIcon = ({ size = 24, strokeWidth = 2, ...props }: LucideProps) => (
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
        <path d="M4 19L17.5 5.5C18.6 4.4 20 3.8 21 4.2C21.4 5.2 20.8 6.6 19.7 7.7L6.2 21.2" />
        <path d="M3 21H7" />
        <path d="M5.3 17.7L7.8 20.2" />
        <path d="M8.3 14.7L10.8 17.2" />
        <path d="M2.5 21.5L6.5 17.5" />
    </svg>
);
