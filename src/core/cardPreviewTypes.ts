/** Serializable preview references shared by rules, transport and UI. */
export type CardPreviewRef =
    | {
        type: 'image';
        src: string;
        /** 卡牌宽高比（宽/高），用于预览尺寸自适应；未提供时使用默认竖向比例 */
        aspectRatio?: number;
    }
    | {
        type: 'atlas';
        atlasId: string;
        index: number;
        /** 卡牌宽高比（宽/高），用于预览尺寸自适应；未提供时使用默认竖向比例 */
        aspectRatio?: number;
    }
    | {
        type: 'svg';
        svgId: string;
        props?: Record<string, string | number>;
    }
    | {
        type: 'renderer';
        rendererId: string;
        payload?: Record<string, unknown>;
    };
