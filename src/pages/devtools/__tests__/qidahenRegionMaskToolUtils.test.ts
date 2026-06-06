import { describe, expect, it } from 'vitest';
import {
    EMPTY_REGION,
    applyBrushToAssignments,
    applyBrushToBinaryMask,
    buildBarrierMask,
    buildBarrierInteriorSelectionMask,
    buildMaskBoundaryRing,
    buildGradientBarrierMask,
    buildMaskPixelBuffer,
    buildRadialBoundarySelectionMask,
    buildRadialBoundaryStrokeMask,
    buildRegionOutlinePixelBuffer,
    composeBarrierMask,
    computeRegionCenters,
    closeBinaryMask,
    isMagicSelectionUsable,
    maskContainsPoint,
    countMaskPixels,
    createRegionAssignments,
    expandMaskColorBoundedArea,
    analyzeOpenBoundaryComponents,
    extractBoundaryPartitionComponents,
    extractClosedBoundaryInteriorComponents,
    rankOpenBoundaryHintsForTargets,
    floodFillColorBoundedArea,
    floodFillContiguousArea,
    fillMaskInternalHoles,
    getRegionComponentSummary,
    growMaskTowardBoundary,
    hexToRgb,
    analyzeMaskBoundaryChainsNearSupport,
    keepBoundaryComponentsSealingInterior,
    keepBoundaryPixelsTouchingClosedInteriors,
    keepBoundaryPixelsTouchingSeedPartitions,
    keepMaskBoundaryChainsNearSupport,
    keepMaskComponentsTouchingSupportMask,
    rasterizePolygonMask,
    rasterizeStrokeMask,
    replaceRegionWithSelection,
    sampleRegionBoundaryPoints,
    scoreMaskBoundaryAlignment,
    snapBoundaryMaskToSupport,
    unionBinaryMasks,
} from '../qidahenRegionMaskToolUtils';

describe('qidahenRegionMaskToolUtils', () => {
    it('buildBarrierMask + floodFillContiguousArea 只在闭合边界内扩散', () => {
        const width = 7;
        const height = 7;
        const source = new Uint8ClampedArray(width * height * 4);

        const setPixel = (x: number, y: number, rgb: [number, number, number]) => {
            const offset = (y * width + x) * 4;
            source[offset] = rgb[0];
            source[offset + 1] = rgb[1];
            source[offset + 2] = rgb[2];
            source[offset + 3] = 255;
        };

        for (let y = 1; y <= 5; y += 1) {
            setPixel(1, y, [54, 42, 35]);
            setPixel(5, y, [54, 42, 35]);
        }
        for (let x = 1; x <= 5; x += 1) {
            setPixel(x, 1, [54, 42, 35]);
            setPixel(x, 5, [54, 42, 35]);
        }

        const barriers = buildBarrierMask({
            source,
            width,
            height,
            rules: [{ id: 'line', rgb: [54, 42, 35], tolerance: 0 }],
        });
        const fill = floodFillContiguousArea({
            width,
            height,
            startX: 3,
            startY: 3,
            barrierMask: barriers,
        });

        expect(countMaskPixels(fill)).toBe(9);
        expect(fill[3 * width + 3]).toBe(1);
        expect(fill[0]).toBe(0);
        expect(fill[1 * width + 3]).toBe(0);
    });

    it('keepBoundaryComponentsSealingInterior 丢弃未封口线段，只保留能围出内部的边界', () => {
        const width = 12;
        const height = 10;
        const mask = new Uint8Array(width * height);
        const setPixel = (x: number, y: number) => {
            mask[y * width + x] = 1;
        };

        for (let x = 2; x <= 6; x += 1) {
            setPixel(x, 2);
            setPixel(x, 6);
        }
        for (let y = 2; y <= 6; y += 1) {
            setPixel(2, y);
            setPixel(6, y);
        }
        for (let y = 1; y <= 7; y += 1) {
            setPixel(9, y);
        }

        const sealedOnly = keepBoundaryComponentsSealingInterior({
            mask,
            width,
            minInteriorPixels: 4,
            anchors: [[4, 4]],
        });

        expect(sealedOnly[2 * width + 2]).toBe(1);
        expect(sealedOnly[6 * width + 6]).toBe(1);
        expect(sealedOnly[4 * width + 9]).toBe(0);
        expect(countMaskPixels(sealedOnly)).toBe(16);
    });

    it('keepBoundaryComponentsSealingInterior 会丢弃没有正式区域锚点的封闭装饰框', () => {
        const width = 12;
        const height = 10;
        const mask = new Uint8Array(width * height);
        const setPixel = (x: number, y: number) => {
            mask[y * width + x] = 1;
        };

        for (let x = 1; x <= 4; x += 1) {
            setPixel(x, 1);
            setPixel(x, 4);
        }
        for (let y = 1; y <= 4; y += 1) {
            setPixel(1, y);
            setPixel(4, y);
        }
        for (let x = 7; x <= 10; x += 1) {
            setPixel(x, 5);
            setPixel(x, 8);
        }
        for (let y = 5; y <= 8; y += 1) {
            setPixel(7, y);
            setPixel(10, y);
        }

        const sealedOnly = keepBoundaryComponentsSealingInterior({
            mask,
            width,
            minInteriorPixels: 4,
            anchors: [[8, 6]],
        });

        expect(sealedOnly[1 * width + 1]).toBe(0);
        expect(sealedOnly[5 * width + 7]).toBe(1);
        expect(countMaskPixels(sealedOnly)).toBe(12);
    });

    it('keepBoundaryPixelsTouchingClosedInteriors 会剪掉连在闭合边界上的开放尾巴', () => {
        const width = 14;
        const height = 10;
        const mask = new Uint8Array(width * height);
        const setPixel = (x: number, y: number) => {
            mask[y * width + x] = 1;
        };

        for (let x = 2; x <= 6; x += 1) {
            setPixel(x, 2);
            setPixel(x, 6);
        }
        for (let y = 2; y <= 6; y += 1) {
            setPixel(2, y);
            setPixel(6, y);
        }
        for (let x = 7; x <= 10; x += 1) {
            setPixel(x, 4);
        }

        const result = keepBoundaryPixelsTouchingClosedInteriors({
            mask,
            width,
            minInteriorPixels: 4,
            anchors: [[4, 4]],
            keepThicknessIterations: 0,
        });

        expect(result.closedFaceCount).toBe(1);
        expect(result.anchoredClosedFaceCount).toBe(1);
        expect(result.mask[4 * width + 6]).toBe(1);
        expect(result.mask[4 * width + 7]).toBe(0);
        expect(result.mask[4 * width + 10]).toBe(0);
        expect(result.discardedPixelCount).toBe(4);
    });

    it('keepBoundaryPixelsTouchingClosedInteriors 会丢弃未命中正式 seed 的封闭装饰框', () => {
        const width = 14;
        const height = 11;
        const mask = new Uint8Array(width * height);
        const setPixel = (x: number, y: number) => {
            mask[y * width + x] = 1;
        };

        for (let x = 1; x <= 4; x += 1) {
            setPixel(x, 1);
            setPixel(x, 4);
        }
        for (let y = 1; y <= 4; y += 1) {
            setPixel(1, y);
            setPixel(4, y);
        }
        for (let x = 8; x <= 11; x += 1) {
            setPixel(x, 6);
            setPixel(x, 9);
        }
        for (let y = 6; y <= 9; y += 1) {
            setPixel(8, y);
            setPixel(11, y);
        }

        const result = keepBoundaryPixelsTouchingClosedInteriors({
            mask,
            width,
            minInteriorPixels: 4,
            anchors: [[9, 7]],
            keepThicknessIterations: 0,
        });

        expect(result.closedFaceCount).toBe(2);
        expect(result.anchoredClosedFaceCount).toBe(1);
        expect(result.mask[1 * width + 1]).toBe(0);
        expect(result.mask[6 * width + 8]).toBe(1);
        expect(countMaskPixels(result.mask)).toBe(12);
    });

    it('scoreMaskBoundaryAlignment 能区分更贴边界的选区轮廓', () => {
        const width = 8;
        const height = 6;
        const barrierMask = new Uint8Array(width * height);
        for (let y = 1; y <= 4; y += 1) {
            barrierMask[y * width + 4] = 1;
        }

        const alignedMask = new Uint8Array(width * height);
        for (let y = 1; y <= 4; y += 1) {
            for (let x = 1; x <= 3; x += 1) {
                alignedMask[y * width + x] = 1;
            }
        }

        const driftingMask = new Uint8Array(width * height);
        for (let y = 1; y <= 4; y += 1) {
            for (let x = 1; x <= 2; x += 1) {
                driftingMask[y * width + x] = 1;
            }
        }

        const aligned = scoreMaskBoundaryAlignment({
            mask: alignedMask,
            barrierMask,
            width,
            height,
            supportRadius: 1,
        });
        const drifting = scoreMaskBoundaryAlignment({
            mask: driftingMask,
            barrierMask,
            width,
            height,
            supportRadius: 1,
        });

        expect(aligned.supportRatio).toBeGreaterThan(drifting.supportRatio);
    });

    it('maskContainsPoint 只在点真的落在 mask 内时返回 true', () => {
        const mask = new Uint8Array(16);
        mask[(2 * 4) + 1] = 1;

        expect(maskContainsPoint({ mask, width: 4, x: 1, y: 2 })).toBe(true);
        expect(maskContainsPoint({ mask, width: 4, x: 0, y: 0 })).toBe(false);
        expect(maskContainsPoint({ mask, width: 4, x: 9, y: 2 })).toBe(false);
        expect(maskContainsPoint({ mask: null, width: 4, x: 1, y: 2 })).toBe(false);
    });

    it('growMaskTowardBoundary 会外扩选区但不会把障碍像素并进去', () => {
        const width = 7;
        const height = 7;
        const mask = new Uint8Array(width * height);
        mask[(3 * width) + 3] = 1;

        const barrierMask = new Uint8Array(width * height);
        for (let y = 0; y < height; y += 1) {
            barrierMask[(y * width) + 5] = 1;
        }

        const grown = growMaskTowardBoundary({
            mask,
            barrierMask,
            width,
            height,
            iterations: 2,
        });

        expect(countMaskPixels(grown)).toBeGreaterThan(1);
        expect(grown[(3 * width) + 5]).toBe(0);
        expect(grown[(3 * width) + 4]).toBe(1);
    });

    it('keepMaskComponentsTouchingSupportMask 只保留贴近 support ring 的组件', () => {
        const width = 8;
        const mask = new Uint8Array(width * 6);
        const clipMask = new Uint8Array(mask.length);
        clipMask.fill(1);
        const supportMask = new Uint8Array(mask.length);

        for (let y = 1; y <= 3; y += 1) {
            mask[(y * width) + 1] = 1;
            mask[(y * width) + 5] = 1;
        }
        supportMask[(2 * width) + 1] = 1;

        const kept = keepMaskComponentsTouchingSupportMask({
            mask,
            width,
            clipMask,
            supportMask,
        });

        expect(kept[(2 * width) + 1]).toBe(1);
        expect(kept[(2 * width) + 5]).toBe(0);
    });

    it('buildMaskBoundaryRing 只提取 mask 内边界并可按需扩成边界带', () => {
        const width = 7;
        const height = 7;
        const mask = new Uint8Array(width * height);
        for (let y = 1; y <= 5; y += 1) {
            for (let x = 1; x <= 5; x += 1) {
                mask[(y * width) + x] = 1;
            }
        }

        const ring = buildMaskBoundaryRing({
            mask,
            width,
            height,
        });
        const expandedRing = buildMaskBoundaryRing({
            mask,
            width,
            height,
            expandIterations: 1,
        });

        expect(countMaskPixels(ring)).toBe(16);
        expect(ring[(3 * width) + 3]).toBe(0);
        expect(ring[(1 * width) + 3]).toBe(1);
        expect(countMaskPixels(expandedRing)).toBeGreaterThan(countMaskPixels(ring));
    });

    it('buildBarrierMask 的线状过滤会保留长边界并丢掉块状噪声', () => {
        const width = 10;
        const height = 6;
        const source = new Uint8ClampedArray(width * height * 4);
        const setPixel = (x: number, y: number, rgb: [number, number, number]) => {
            const offset = (y * width + x) * 4;
            source[offset] = rgb[0];
            source[offset + 1] = rgb[1];
            source[offset + 2] = rgb[2];
            source[offset + 3] = 255;
        };

        for (let x = 1; x <= 8; x += 1) {
            setPixel(x, 1, [54, 42, 35]);
        }
        setPixel(4, 3, [54, 42, 35]);
        setPixel(5, 3, [54, 42, 35]);
        setPixel(4, 4, [54, 42, 35]);
        setPixel(5, 4, [54, 42, 35]);

        const barriers = buildBarrierMask({
            source,
            width,
            height,
            rules: [{ id: 'line', rgb: [54, 42, 35], tolerance: 0 }],
            lineFilter: {
                minPixels: 3,
                minSpan: 5,
                maxAverageThickness: 1.6,
            },
        });

        expect(barriers[1 * width + 4]).toBe(1);
        expect(barriers[3 * width + 4]).toBe(0);
        expect(barriers[4 * width + 5]).toBe(0);
    });

    it('keepMaskBoundaryChainsNearSupport 会保留边界带附近链路并剪掉同色装饰分支', () => {
        const width = 18;
        const height = 14;
        const mask = new Uint8Array(width * height);
        const clipMask = new Uint8Array(width * height);
        const supportMask = new Uint8Array(width * height);

        clipMask.fill(1);
        for (let y = 2; y <= 11; y += 1) {
            supportMask[y * width + 2] = 1;
            mask[y * width + 3] = 1;
        }

        for (let x = 4; x <= 14; x += 1) {
            mask[6 * width + x] = 1;
        }
        for (let y = 4; y <= 8; y += 1) {
            for (let x = 13; x <= 15; x += 1) {
                mask[y * width + x] = 1;
            }
        }

        const kept = keepMaskBoundaryChainsNearSupport({
            mask,
            width,
            clipMask,
            supportMask,
            maxDistance: 2,
            minPixels: 6,
            minSpan: 5,
            maxAverageThickness: 2,
        });

        expect(kept[6 * width + 3]).toBe(1);
        expect(kept[10 * width + 3]).toBe(1);
        expect(kept[6 * width + 4]).toBe(0);
        expect(kept[6 * width + 8]).toBe(0);
        expect(kept[6 * width + 14]).toBe(0);
    });

    it('keepMaskBoundaryChainsNearSupport 会修剪挂在主链上的短装饰枝杈', () => {
        const width = 16;
        const height = 12;
        const mask = new Uint8Array(width * height);
        const clipMask = new Uint8Array(width * height);
        const supportMask = new Uint8Array(width * height);

        clipMask.fill(1);
        for (let y = 2; y <= 9; y += 1) {
            supportMask[y * width + 3] = 1;
            mask[y * width + 4] = 1;
        }
        for (let x = 4; x <= 7; x += 1) {
            mask[5 * width + x] = 1;
        }

        const kept = keepMaskBoundaryChainsNearSupport({
            mask,
            width,
            clipMask,
            supportMask,
            maxDistance: 5,
            minPixels: 6,
            minSpan: 5,
            maxAverageThickness: 2,
        });

        expect(kept[5 * width + 4]).toBe(1);
        expect(kept[5 * width + 7]).toBe(0);
        expect(countMaskPixels(kept)).toBeLessThan(countMaskPixels(mask));
    });

    it('keepMaskBoundaryChainsNearSupport 会把落在 support ring 上的边界链算作接触', () => {
        const width = 12;
        const height = 12;
        const mask = new Uint8Array(width * height);
        const clipMask = new Uint8Array(width * height);
        const supportMask = new Uint8Array(width * height);

        clipMask.fill(1);
        for (let y = 2; y <= 9; y += 1) {
            supportMask[y * width + 4] = 1;
            mask[y * width + 4] = 1;
        }
        for (let x = 5; x <= 8; x += 1) {
            mask[5 * width + x] = 1;
        }

        const kept = keepMaskBoundaryChainsNearSupport({
            mask,
            width,
            clipMask,
            supportMask,
            maxDistance: 3,
            minPixels: 6,
            minSpan: 6,
            maxAverageThickness: 2,
        });

        expect(kept[4 * width + 4]).toBe(1);
        expect(kept[8 * width + 4]).toBe(1);
        expect(kept[5 * width + 8]).toBe(0);
    });

    it('keepMaskBoundaryChainsNearSupport 在无直接接触时允许边界带附近链路作为锚点', () => {
        const width = 14;
        const height = 12;
        const mask = new Uint8Array(width * height);
        const clipMask = new Uint8Array(width * height);
        const supportMask = new Uint8Array(width * height);

        clipMask.fill(1);
        for (let y = 2; y <= 9; y += 1) {
            supportMask[y * width + 2] = 1;
            mask[y * width + 5] = 1;
        }
        for (let x = 6; x <= 10; x += 1) {
            mask[5 * width + x] = 1;
        }

        const kept = keepMaskBoundaryChainsNearSupport({
            mask,
            width,
            clipMask,
            supportMask,
            maxDistance: 6,
            minPixels: 6,
            minSpan: 6,
            maxAverageThickness: 2,
        });

        expect(kept[3 * width + 5]).toBe(1);
        expect(kept[8 * width + 5]).toBe(1);
        expect(kept[5 * width + 10]).toBe(0);
    });

    it('keepMaskBoundaryChainsNearSupport 可桥接边界色主链上的短缺口', () => {
        const width = 12;
        const height = 12;
        const mask = new Uint8Array(width * height);
        const clipMask = new Uint8Array(width * height);
        const supportMask = new Uint8Array(width * height);

        clipMask.fill(1);
        for (let y = 2; y <= 9; y += 1) {
            supportMask[y * width + 3] = 1;
            if (y !== 6) {
                mask[y * width + 4] = 1;
            }
        }

        const withoutClosing = keepMaskBoundaryChainsNearSupport({
            mask,
            width,
            clipMask,
            supportMask,
            maxDistance: 4,
            minPixels: 6,
            minSpan: 7,
            maxAverageThickness: 1.5,
            gapClosingIterations: 0,
        });
        const withClosing = keepMaskBoundaryChainsNearSupport({
            mask,
            width,
            clipMask,
            supportMask,
            maxDistance: 4,
            minPixels: 6,
            minSpan: 7,
            maxAverageThickness: 1.5,
            gapClosingIterations: 1,
        });

        expect(countMaskPixels(withoutClosing)).toBe(0);
        expect(withClosing[6 * width + 4]).toBe(1);
        expect(withClosing[8 * width + 4]).toBe(1);
    });

    it('snapBoundaryMaskToSupport 会把手绘线贴到附近候选轮廓', () => {
        const width = 16;
        const height = 10;
        const sourceMask = new Uint8Array(width * height);
        const supportMask = new Uint8Array(width * height);
        const clipMask = new Uint8Array(width * height);
        clipMask.fill(1);

        for (let y = 2; y <= 7; y += 1) {
            sourceMask[y * width + 4] = 1;
            supportMask[y * width + 6] = 1;
        }

        const result = snapBoundaryMaskToSupport({
            sourceMask,
            supportMask,
            width,
            clipMask,
            maxDistance: 3,
            minPixels: 3,
            minSpan: 3,
            maxAverageThickness: 2,
        });

        expect(result.matchedSourcePixelCount).toBe(6);
        expect(result.matchedSupportPixelCount).toBe(6);
        expect(result.mask[4 * width + 6]).toBe(1);
        expect(result.mask[4 * width + 4]).toBe(0);
    });

    it('snapBoundaryMaskToSupport 默认保留没有候选支撑的手绘段', () => {
        const width = 16;
        const height = 10;
        const sourceMask = new Uint8Array(width * height);
        const supportMask = new Uint8Array(width * height);
        const clipMask = new Uint8Array(width * height);
        clipMask.fill(1);

        for (let y = 2; y <= 7; y += 1) {
            sourceMask[y * width + 4] = 1;
        }
        sourceMask[8 * width + 12] = 1;
        for (let y = 2; y <= 7; y += 1) {
            supportMask[y * width + 6] = 1;
        }

        const result = snapBoundaryMaskToSupport({
            sourceMask,
            supportMask,
            width,
            clipMask,
            maxDistance: 3,
            minPixels: 3,
            minSpan: 3,
            maxAverageThickness: 2,
        });

        expect(result.keptOriginalPixelCount).toBe(1);
        expect(result.mask[8 * width + 12]).toBe(1);
    });

    it('keepMaskBoundaryChainsNearSupport 不会把过长缺口强行桥接成边界', () => {
        const width = 12;
        const height = 12;
        const mask = new Uint8Array(width * height);
        const clipMask = new Uint8Array(width * height);
        const supportMask = new Uint8Array(width * height);

        clipMask.fill(1);
        for (let y = 2; y <= 9; y += 1) {
            supportMask[y * width + 3] = 1;
            if (y <= 4 || y >= 8) {
                mask[y * width + 4] = 1;
            }
        }

        const kept = keepMaskBoundaryChainsNearSupport({
            mask,
            width,
            clipMask,
            supportMask,
            maxDistance: 4,
            minPixels: 6,
            minSpan: 7,
            maxAverageThickness: 1.5,
            gapClosingIterations: 1,
        });

        expect(countMaskPixels(kept)).toBe(0);
    });

    it('analyzeMaskBoundaryChainsNearSupport 会暴露边界链被拒绝的原因', () => {
        const width = 12;
        const height = 10;
        const mask = new Uint8Array(width * height);
        const clipMask = new Uint8Array(width * height);
        const supportMask = new Uint8Array(width * height);

        clipMask.fill(1);
        for (let y = 2; y <= 7; y += 1) {
            supportMask[y * width + 2] = 1;
            for (let x = 3; x <= 8; x += 1) {
                mask[y * width + x] = 1;
            }
        }

        const analysis = analyzeMaskBoundaryChainsNearSupport({
            mask,
            width,
            clipMask,
            supportMask,
            maxDistance: 8,
            minPixels: 6,
            minSpan: 4,
            maxAverageThickness: 2,
        });

        expect(countMaskPixels(analysis.mask)).toBe(0);
        expect(analysis.componentCount).toBe(1);
        expect(analysis.rejectedTooThickCount).toBe(1);
        expect(analysis.largestRejectedAverageThickness).toBeGreaterThan(2);
    });

    it('buildGradientBarrierMask 能识别深色高对比边界', () => {
        const width = 7;
        const height = 5;
        const source = new Uint8ClampedArray(width * height * 4);
        const setPixel = (x: number, y: number, rgb: [number, number, number]) => {
            const offset = (y * width + x) * 4;
            source[offset] = rgb[0];
            source[offset + 1] = rgb[1];
            source[offset + 2] = rgb[2];
            source[offset + 3] = 255;
        };

        for (let y = 0; y < height; y += 1) {
            for (let x = 0; x < width; x += 1) {
                setPixel(x, y, x < 3 ? [198, 170, 120] : [104, 82, 60]);
            }
        }
        for (let y = 0; y < height; y += 1) {
            setPixel(3, y, [36, 27, 21]);
        }

        const barriers = buildGradientBarrierMask({
            source,
            width,
            height,
            blurRadius: 0,
            strongGradientThreshold: 18,
            moderateGradientThreshold: 10,
            darkLuminanceThreshold: 120,
            lowChromaThreshold: 90,
            lineFilter: null,
        });

        expect(barriers[2 * width + 2] || barriers[2 * width + 4]).toBe(1);
        expect(barriers[2 * width + 1]).toBe(0);
    });

    it('unionBinaryMasks 会合并颜色边界和梯度边界', () => {
        const left = new Uint8Array([1, 0, 0, 1]);
        const right = new Uint8Array([0, 1, 0, 0]);
        expect(Array.from(unionBinaryMasks(left, right))).toEqual([1, 1, 0, 1]);
    });

    it('buildRadialBoundarySelectionMask 能从种子向最近边界环收口', () => {
        const width = 21;
        const height = 21;
        const barriers = new Uint8Array(width * height);
        for (let x = 5; x <= 15; x += 1) {
            barriers[5 * width + x] = 1;
            barriers[15 * width + x] = 1;
        }
        for (let y = 5; y <= 15; y += 1) {
            barriers[y * width + 5] = 1;
            barriers[y * width + 15] = 1;
        }

        const selection = buildRadialBoundarySelectionMask({
            width,
            height,
            startX: 10,
            startY: 10,
            barrierMask: barriers,
            maxRadius: 12,
            rayCount: 72,
            minHitRatio: 0.8,
        });

        expect(selection).not.toBeNull();
        expect(selection![10 * width + 10]).toBe(1);
        expect(selection![0]).toBe(0);
        expect(countMaskPixels(selection!)).toBeGreaterThan(50);
        expect(countMaskPixels(selection!)).toBeLessThan(140);
    });

    it('buildRadialBoundarySelectionMask 遇到局部缺边时不会直接膨胀到最大半径', () => {
        const width = 25;
        const height = 25;
        const barriers = new Uint8Array(width * height);
        for (let x = 6; x <= 18; x += 1) {
            barriers[6 * width + x] = 1;
            barriers[18 * width + x] = 1;
        }
        for (let y = 6; y <= 18; y += 1) {
            barriers[y * width + 6] = 1;
            barriers[y * width + 18] = 1;
        }
        barriers[6 * width + 12] = 0;
        barriers[6 * width + 13] = 0;
        barriers[6 * width + 14] = 0;

        const selection = buildRadialBoundarySelectionMask({
            width,
            height,
            startX: 12,
            startY: 12,
            barrierMask: barriers,
            maxRadius: 14,
            rayCount: 96,
            minHitRatio: 0.55,
        });

        expect(selection).not.toBeNull();
        expect(countMaskPixels(selection!)).toBeLessThan(190);
        expect(selection![0]).toBe(0);
    });

    it('closeBinaryMask 能补齐细小边界裂缝', () => {
        const width = 7;
        const height = 7;
        const mask = new Uint8Array(width * height);
        for (let x = 1; x <= 5; x += 1) {
            mask[1 * width + x] = 1;
            mask[5 * width + x] = 1;
        }
        for (let y = 1; y <= 5; y += 1) {
            mask[y * width + 1] = 1;
            mask[y * width + 5] = 1;
        }
        mask[1 * width + 3] = 0;

        const closed = closeBinaryMask({
            mask,
            width,
            height,
            iterations: 1,
        });

        expect(closed[1 * width + 3]).toBe(1);
        expect(closed[3 * width + 3]).toBe(0);
    });

    it('buildBarrierInteriorSelectionMask 会在 roi 内抠出被边界包住的内部块', () => {
        const width = 21;
        const height = 21;
        const roiMask = new Uint8Array(width * height);
        for (let y = 4; y <= 16; y += 1) {
            for (let x = 4; x <= 16; x += 1) {
                roiMask[y * width + x] = 1;
            }
        }

        const barrierMask = new Uint8Array(width * height);
        for (let x = 6; x <= 14; x += 1) {
            barrierMask[6 * width + x] = 1;
            barrierMask[14 * width + x] = 1;
        }
        for (let y = 6; y <= 14; y += 1) {
            barrierMask[y * width + 6] = 1;
            barrierMask[y * width + 14] = 1;
        }
        barrierMask[6 * width + 10] = 0;

        const selection = buildBarrierInteriorSelectionMask({
            width,
            height,
            startX: 10,
            startY: 10,
            roiMask,
            barrierMask,
            closingIterations: 1,
        });

        expect(selection).not.toBeNull();
        expect(selection![10 * width + 10]).toBe(1);
        expect(selection![4 * width + 4]).toBe(0);
        expect(countMaskPixels(selection!)).toBeGreaterThan(30);
        expect(countMaskPixels(selection!)).toBeLessThan(120);
    });

    it('buildBarrierInteriorSelectionMask 不会把起点落入的 1px 孤岛当成最终内部块', () => {
        const width = 24;
        const height = 24;
        const roiMask = new Uint8Array(width * height);
        for (let y = 2; y <= 21; y += 1) {
            for (let x = 2; x <= 21; x += 1) {
                roiMask[y * width + x] = 1;
            }
        }

        const barrierMask = new Uint8Array(width * height);

        for (let x = 10; x <= 18; x += 1) {
            barrierMask[8 * width + x] = 1;
            barrierMask[18 * width + x] = 1;
        }
        for (let y = 8; y <= 18; y += 1) {
            barrierMask[y * width + 10] = 1;
            barrierMask[y * width + 18] = 1;
        }

        for (let x = 4; x <= 8; x += 1) {
            barrierMask[4 * width + x] = 1;
            barrierMask[8 * width + x] = 1;
        }
        for (let y = 4; y <= 8; y += 1) {
            barrierMask[y * width + 4] = 1;
            barrierMask[y * width + 8] = 1;
        }

        const selection = buildBarrierInteriorSelectionMask({
            width,
            height,
            startX: 6,
            startY: 6,
            roiMask,
            barrierMask,
            closingIterations: 1,
        });

        expect(selection).not.toBeNull();
        expect(selection![6 * width + 6]).toBe(0);
        expect(selection![12 * width + 12]).toBe(1);
        expect(countMaskPixels(selection!)).toBeGreaterThan(40);
    });

    it('buildRadialBoundaryStrokeMask 会闭合首尾并可与内部抠取组合使用', () => {
        const width = 25;
        const height = 25;
        const barriers = new Uint8Array(width * height);
        for (let x = 6; x <= 18; x += 1) {
            barriers[6 * width + x] = 1;
            barriers[18 * width + x] = 1;
        }
        for (let y = 6; y <= 18; y += 1) {
            barriers[y * width + 6] = 1;
            barriers[y * width + 18] = 1;
        }
        barriers[6 * width + 12] = 0;
        barriers[6 * width + 13] = 0;
        barriers[6 * width + 14] = 0;

        const radialMask = buildRadialBoundarySelectionMask({
            width,
            height,
            startX: 12,
            startY: 12,
            barrierMask: barriers,
            maxRadius: 14,
            rayCount: 96,
            minHitRatio: 0.55,
        });
        const strokeMask = buildRadialBoundaryStrokeMask({
            width,
            height,
            startX: 12,
            startY: 12,
            barrierMask: barriers,
            maxRadius: 14,
            rayCount: 96,
            minHitRatio: 0.55,
            radius: 1.8,
        });

        expect(radialMask).not.toBeNull();
        expect(strokeMask).not.toBeNull();

        const interior = buildBarrierInteriorSelectionMask({
            width,
            height,
            startX: 12,
            startY: 12,
            roiMask: radialMask!,
            barrierMask: unionBinaryMasks(barriers, strokeMask!),
            closingIterations: 1,
        });

        expect(interior).not.toBeNull();
        expect(interior![12 * width + 12]).toBe(1);
        expect(countMaskPixels(interior!)).toBeGreaterThan(40);
        expect(countMaskPixels(interior!)).toBeLessThan(190);
    });

    it('floodFillColorBoundedArea 同时受底色容差和边界阻断约束', () => {
        const width = 5;
        const height = 3;
        const source = new Uint8ClampedArray(width * height * 4);
        const setPixel = (x: number, y: number, rgb: [number, number, number]) => {
            const offset = (y * width + x) * 4;
            source[offset] = rgb[0];
            source[offset + 1] = rgb[1];
            source[offset + 2] = rgb[2];
            source[offset + 3] = 255;
        };

        for (let y = 0; y < height; y += 1) {
            setPixel(0, y, [180, 160, 120]);
            setPixel(1, y, [181, 161, 121]);
            setPixel(2, y, [54, 42, 35]);
            setPixel(3, y, [180, 160, 120]);
            setPixel(4, y, [180, 160, 120]);
        }

        const barriers = buildBarrierMask({
            source,
            width,
            height,
            rules: [{ id: 'line', rgb: [54, 42, 35], tolerance: 0 }],
        });
        const fill = floodFillColorBoundedArea({
            source,
            width,
            height,
            startX: 0,
            startY: 1,
            barrierMask: barriers,
            colorTolerance: 3,
        });

        expect(countMaskPixels(fill)).toBe(6);
        expect(fill[1]).toBe(1);
        expect(fill[3]).toBe(0);
    });

    it('floodFillColorBoundedArea 的 edgeStopFactor 会在边界裂缝处按跨边跳变停线', () => {
        const width = 5;
        const height = 3;
        const source = new Uint8ClampedArray(width * height * 4);
        const setPixel = (x: number, y: number, rgb: [number, number, number]) => {
            const offset = (y * width + x) * 4;
            source[offset] = rgb[0];
            source[offset + 1] = rgb[1];
            source[offset + 2] = rgb[2];
            source[offset + 3] = 255;
        };

        for (let y = 0; y < height; y += 1) {
            setPixel(0, y, [184, 164, 124]);
            setPixel(1, y, [183, 163, 123]);
            setPixel(2, y, [182, 162, 122]);
            setPixel(3, y, [120, 88, 56]);
            setPixel(4, y, [119, 87, 55]);
        }

        const barrierMask = new Uint8Array(width * height);
        barrierMask[0 * width + 2] = 1;
        barrierMask[2 * width + 2] = 1;

        const fill = floodFillColorBoundedArea({
            source,
            width,
            height,
            startX: 0,
            startY: 1,
            barrierMask,
            colorTolerance: 80,
            edgeStopFactor: 0.82,
        });

        expect(fill[1 * width + 2]).toBe(1);
        expect(fill[1 * width + 3]).toBe(0);
        expect(fill[1 * width + 4]).toBe(0);
    });

    it('expandMaskColorBoundedArea 可用 profileMask 降低同一区域不同点击点的颜色画像漂移', () => {
        const width = 5;
        const height = 2;
        const source = new Uint8ClampedArray(width * height * 4);
        const setPixel = (x: number, y: number, rgb: [number, number, number]) => {
            const offset = (y * width + x) * 4;
            source[offset] = rgb[0];
            source[offset + 1] = rgb[1];
            source[offset + 2] = rgb[2];
            source[offset + 3] = 255;
        };

        for (let y = 0; y < height; y += 1) {
            setPixel(0, y, [150, 122, 90]);
            setPixel(1, y, [160, 132, 100]);
            setPixel(2, y, [170, 142, 110]);
            setPixel(3, y, [182, 154, 122]);
            setPixel(4, y, [60, 46, 38]);
        }

        const barrierMask = new Uint8Array(width * height);
        barrierMask[0 * width + 4] = 1;
        barrierMask[1 * width + 4] = 1;

        const seedMask = new Uint8Array(width * height);
        seedMask[0] = 1;
        seedMask[width] = 1;
        const profileMask = new Uint8Array(width * height);
        profileMask[0] = 1;
        profileMask[1] = 1;
        profileMask[2] = 1;
        profileMask[width] = 1;
        profileMask[width + 1] = 1;
        profileMask[width + 2] = 1;

        const fillWithoutProfile = expandMaskColorBoundedArea({
            source,
            width,
            height,
            startX: 0,
            startY: 0,
            seedMask,
            barrierMask,
            colorTolerance: 12,
            seedSampleRadius: 0,
        });
        const fillWithProfile = expandMaskColorBoundedArea({
            source,
            width,
            height,
            startX: 0,
            startY: 0,
            seedMask,
            barrierMask,
            colorTolerance: 12,
            seedSampleRadius: 0,
            profileMask,
        });

        expect(countMaskPixels(fillWithProfile)).toBeGreaterThan(countMaskPixels(fillWithoutProfile));
    });

    it('rasterizePolygonMask 支持绳索闭合范围', () => {
        const mask = rasterizePolygonMask({
            width: 10,
            height: 10,
            polygon: [[2, 2], [8, 2], [8, 8], [2, 8]],
        });

        expect(countMaskPixels(mask)).toBe(36);
        expect(mask[4 * 10 + 4]).toBe(1);
        expect(mask[1 * 10 + 1]).toBe(0);
    });

    it('fillMaskInternalHoles 填平内部图标/文字造成的空洞但不越过外部', () => {
        const width = 7;
        const height = 7;
        const mask = new Uint8Array(width * height);
        for (let y = 1; y <= 5; y += 1) {
            for (let x = 1; x <= 5; x += 1) {
                mask[y * width + x] = 1;
            }
        }
        mask[3 * width + 3] = 0;

        const filled = fillMaskInternalHoles({ mask, width, height });

        expect(filled[3 * width + 3]).toBe(1);
        expect(filled[0]).toBe(0);
        expect(countMaskPixels(filled)).toBe(25);
    });

    it('extractClosedBoundaryInteriorComponents 只返回闭合边界围出的面', () => {
        const width = 10;
        const height = 8;
        const closed = new Uint8Array(width * height);
        for (let x = 2; x <= 6; x += 1) {
            closed[2 * width + x] = 1;
            closed[5 * width + x] = 1;
        }
        for (let y = 2; y <= 5; y += 1) {
            closed[y * width + 2] = 1;
            closed[y * width + 6] = 1;
        }
        for (let x = 7; x <= 8; x += 1) {
            closed[1 * width + x] = 1;
        }

        const components = extractClosedBoundaryInteriorComponents({
            barrierMask: closed,
            width,
            minPixels: 1,
        });

        expect(components).toHaveLength(1);
        expect(components[0].pixelCount).toBe(6);
        expect(components[0].mask[3 * width + 3]).toBe(1);
        expect(components[0].mask[1 * width + 7]).toBe(0);
    });

    it('extractClosedBoundaryInteriorComponents 对断线边界不生成面', () => {
        const width = 8;
        const height = 8;
        const open = new Uint8Array(width * height);
        for (let x = 2; x <= 5; x += 1) {
            open[2 * width + x] = 1;
            open[5 * width + x] = 1;
        }
        for (let y = 2; y <= 5; y += 1) {
            open[y * width + 2] = 1;
        }

        expect(extractClosedBoundaryInteriorComponents({
            barrierMask: open,
            width,
            minPixels: 1,
        })).toHaveLength(0);
    });

    it('extractClosedBoundaryInteriorComponents 不把斜向单线误判成闭合面', () => {
        const width = 10;
        const height = 10;
        const diagonal = new Uint8Array(width * height);
        for (let offset = 0; offset < 5; offset += 1) {
            diagonal[(2 + offset) * width + (2 + offset)] = 1;
        }

        expect(extractClosedBoundaryInteriorComponents({
            barrierMask: diagonal,
            width,
            minPixels: 1,
        })).toHaveLength(0);
    });

    it('extractBoundaryPartitionComponents 用连接到边缘的边界线分割整块地图', () => {
        const width = 12;
        const height = 6;
        const barrier = new Uint8Array(width * height);
        for (let y = 0; y < height; y += 1) {
            barrier[y * width + 5] = 1;
        }

        const components = extractBoundaryPartitionComponents({
            barrierMask: barrier,
            width,
            seeds: [
                { x: 2, y: 2 },
                { x: 9, y: 2 },
            ],
        });

        expect(components).toHaveLength(2);
        expect(components.map((component) => component.seedIndexes)).toEqual([[1], [0]]);
        expect(components.find((component) => component.seedIndexes[0] === 0)?.pixelCount).toBe(30);
        expect(components.find((component) => component.seedIndexes[0] === 1)?.pixelCount).toBe(36);
    });

    it('extractBoundaryPartitionComponents 不把未接边缘的开放线段当作有效分割', () => {
        const width = 12;
        const height = 6;
        const barrier = new Uint8Array(width * height);
        for (let y = 1; y <= 4; y += 1) {
            barrier[y * width + 5] = 1;
        }

        const components = extractBoundaryPartitionComponents({
            barrierMask: barrier,
            width,
            seeds: [
                { x: 2, y: 2 },
                { x: 9, y: 2 },
            ],
        });

        expect(components).toHaveLength(1);
        expect(components[0].seedIndexes).toEqual([0, 1]);
    });

    it('keepBoundaryPixelsTouchingSeedPartitions 保留能分割 seed 的边界线并丢弃无效开放噪声', () => {
        const width = 12;
        const height = 8;
        const barrier = new Uint8Array(width * height);
        for (let y = 0; y < height; y += 1) {
            barrier[y * width + 5] = 1;
        }
        for (let x = 8; x <= 10; x += 1) {
            barrier[6 * width + x] = 1;
        }

        const result = keepBoundaryPixelsTouchingSeedPartitions({
            mask: barrier,
            width,
            seeds: [
                { x: 2, y: 3 },
                { x: 9, y: 3 },
            ],
            keepThicknessIterations: 0,
        });

        expect(result.partitionCount).toBe(2);
        expect(result.anchoredPartitionCount).toBe(2);
        expect(result.mask[3 * width + 5]).toBe(1);
        expect(result.mask[6 * width + 9]).toBe(0);
        expect(result.discardedPixelCount).toBe(3);
    });

    it('keepBoundaryPixelsTouchingSeedPartitions 保留接边分区线组件而不是裁成碎片', () => {
        const width = 20;
        const height = 12;
        const barrier = new Uint8Array(width * height);
        for (let y = 0; y < height; y += 1) {
            barrier[y * width + 6] = 1;
        }
        for (let x = 6; x < width; x += 1) {
            barrier[3 * width + x] = 1;
            barrier[7 * width + x] = 1;
        }
        for (let x = 10; x <= 12; x += 1) {
            barrier[5 * width + x] = 1;
        }

        const result = keepBoundaryPixelsTouchingSeedPartitions({
            mask: barrier,
            width,
            seeds: [
                { x: 2, y: 5 },
                { x: 10, y: 1 },
                { x: 10, y: 4 },
            ],
            keepThicknessIterations: 0,
        });

        expect(result.partitionCount).toBe(4);
        expect(result.anchoredPartitionCount).toBe(3);
        expect(result.mask[0 * width + 6]).toBe(1);
        expect(result.mask[3 * width + 18]).toBe(1);
        expect(result.mask[7 * width + 18]).toBe(1);
        expect(result.mask[5 * width + 11]).toBe(0);
        expect(result.discardedPixelCount).toBe(3);
    });

    it('analyzeOpenBoundaryComponents 标出没有围出内部的开放线段', () => {
        const width = 12;
        const height = 8;
        const mask = new Uint8Array(width * height);
        for (let x = 2; x <= 5; x += 1) {
            mask[2 * width + x] = 1;
            mask[5 * width + x] = 1;
        }
        for (let y = 2; y <= 5; y += 1) {
            mask[y * width + 2] = 1;
            mask[y * width + 5] = 1;
        }
        for (let x = 8; x <= 10; x += 1) {
            mask[3 * width + x] = 1;
        }

        const analysis = analyzeOpenBoundaryComponents({
            barrierMask: mask,
            width,
            minPixels: 2,
        });

        expect(analysis.openComponentCount).toBe(1);
        expect(analysis.hints).toHaveLength(1);
        expect(analysis.hints[0].pixelCount).toBe(3);
        expect(analysis.hints[0].endpoints).toEqual([
            { x: 10, y: 3 },
            { x: 8, y: 3 },
        ]);
    });

    it('analyzeOpenBoundaryComponents 把斜向手绘线视为同一条开放线段', () => {
        const width = 12;
        const height = 12;
        const mask = new Uint8Array(width * height);
        for (let offset = 0; offset < 5; offset += 1) {
            mask[(2 + offset) * width + (3 + offset)] = 1;
        }

        const analysis = analyzeOpenBoundaryComponents({
            barrierMask: mask,
            width,
            minPixels: 2,
        });

        expect(analysis.openComponentCount).toBe(1);
        expect(analysis.hints).toHaveLength(1);
        expect(analysis.hints[0].pixelCount).toBe(5);
        expect(analysis.hints[0].endpoints).toEqual([
            { x: 7, y: 6 },
            { x: 3, y: 2 },
        ]);
    });

    it('rankOpenBoundaryHintsForTargets 优先提示未命中 seed 附近的开放线段', () => {
        const hints = [
            {
                pixelCount: 80,
                bounds: { left: 80, top: 80, right: 95, bottom: 82 },
                center: { x: 88, y: 81 },
                endpoints: [{ x: 80, y: 80 }, { x: 95, y: 82 }] as const,
            },
            {
                pixelCount: 18,
                bounds: { left: 12, top: 10, right: 18, bottom: 12 },
                center: { x: 15, y: 11 },
                endpoints: [{ x: 12, y: 10 }, { x: 18, y: 12 }] as const,
            },
        ];

        const ranked = rankOpenBoundaryHintsForTargets({
            hints,
            targets: [
                { id: 'shan-hai-guan', name: '山海关', seed: { x: 16, y: 14 } },
            ],
        });

        expect(ranked[0].nearestTarget?.name).toBe('山海关');
        expect(ranked[0].pixelCount).toBe(18);
        expect(ranked[1].pixelCount).toBe(80);
    });

    it('applyBrushToAssignments + replaceRegionWithSelection 能更新区域归属', () => {
        const width = 8;
        const height = 8;
        const assignments = createRegionAssignments(width, height);

        const bounds = applyBrushToAssignments({
            assignments,
            width,
            height,
            centerX: 2,
            centerY: 2,
            radius: 1.4,
            regionIndex: 0,
        });

        expect(bounds).not.toBeNull();
        expect(assignments[2 * width + 2]).toBe(0);

        const selection = new Uint8Array(width * height);
        selection[5 * width + 5] = 1;
        selection[5 * width + 6] = 1;
        selection[6 * width + 5] = 1;
        replaceRegionWithSelection({
            assignments,
            selectionMask: selection,
            regionIndex: 0,
        });

        expect(assignments[2 * width + 2]).toBe(EMPTY_REGION);
        expect(assignments[5 * width + 5]).toBe(0);
        expect(assignments[6 * width + 5]).toBe(0);
    });

    it('applyBrushToBinaryMask + composeBarrierMask 支持手工补边和去噪', () => {
        const width = 6;
        const height = 4;
        const baseMask = new Uint8Array(width * height);
        baseMask[1 * width + 1] = 1;
        baseMask[1 * width + 2] = 1;
        baseMask[2 * width + 1] = 1;

        const addMask = new Uint8Array(width * height);
        const removeMask = new Uint8Array(width * height);
        const addBounds = applyBrushToBinaryMask({
            mask: addMask,
            width,
            height,
            centerX: 4,
            centerY: 2,
            radius: 0.8,
            value: 1,
        });
        const removeBounds = applyBrushToBinaryMask({
            mask: removeMask,
            width,
            height,
            centerX: 1,
            centerY: 1,
            radius: 0.8,
            value: 1,
        });

        expect(addBounds).not.toBeNull();
        expect(removeBounds).not.toBeNull();

        const combined = composeBarrierMask({
            baseMask,
            addMask,
            removeMask,
        });

        expect(combined[1 * width + 1]).toBe(0);
        expect(combined[2 * width + 4]).toBe(1);
        expect(combined[1 * width + 2]).toBe(1);
    });

    it('buildMaskPixelBuffer 使用当前 palette 渲染 PNG 真相源颜色', () => {
        const assignments = createRegionAssignments(2, 2);
        assignments[0] = 0;
        assignments[3] = 1;

        const pixels = buildMaskPixelBuffer({
            assignments,
            palette: [hexToRgb('#d64c3a'), hexToRgb('#4f88d2')],
            width: 2,
            height: 2,
        });

        expect(Array.from(pixels.slice(0, 4))).toEqual([214, 76, 58, 255]);
        expect(Array.from(pixels.slice(12, 16))).toEqual([79, 136, 210, 255]);
        expect(Array.from(pixels.slice(4, 8))).toEqual([0, 0, 0, 0]);
    });

    it('buildRegionOutlinePixelBuffer 只渲染选中区域边界', () => {
        const assignments = createRegionAssignments(4, 4);
        for (let y = 1; y <= 2; y += 1) {
            for (let x = 1; x <= 2; x += 1) {
                assignments[y * 4 + x] = 0;
            }
        }

        const pixels = buildRegionOutlinePixelBuffer({
            assignments,
            width: 4,
            height: 4,
            regionIndex: 0,
            color: [255, 244, 214],
        });

        expect(Array.from(pixels.slice(((1 * 4) + 1) * 4, ((1 * 4) + 1) * 4 + 4))).toEqual([255, 244, 214, 255]);
        expect(Array.from(pixels.slice(0, 4))).toEqual([0, 0, 0, 0]);
    });

    it('computeRegionCenters 从区域归属计算路径图节点中心', () => {
        const assignments = createRegionAssignments(4, 3);
        assignments[0] = 0;
        assignments[1] = 0;
        assignments[4] = 0;
        assignments[10] = 1;
        assignments[11] = 1;

        const centers = computeRegionCenters({
            assignments,
            width: 4,
            regionCount: 2,
        });

        expect(centers).toEqual([
            { regionIndex: 0, x: 0, y: 0, pixelCount: 3 },
            { regionIndex: 1, x: 3, y: 2, pixelCount: 2 },
        ]);
    });

    it('rasterizeStrokeMask 支持锁链式局部修边', () => {
        const mask = rasterizeStrokeMask({
            width: 12,
            height: 8,
            points: [[2, 2], [9, 2], [9, 5]],
            radius: 1.2,
        });

        expect(mask[2 * 12 + 2]).toBe(1);
        expect(mask[2 * 12 + 6]).toBe(1);
        expect(mask[5 * 12 + 9]).toBe(1);
        expect(mask[7 * 12 + 0]).toBe(0);
    });

    it('getRegionComponentSummary 能识别碎岛并统计最大连通块', () => {
        const assignments = createRegionAssignments(6, 4);
        assignments[1] = 0;
        assignments[2] = 0;
        assignments[7] = 0;
        assignments[22] = 0;

        expect(getRegionComponentSummary({
            assignments,
            width: 6,
            regionIndex: 0,
        })).toEqual({
            componentCount: 2,
            largestPixelCount: 3,
            totalPixelCount: 4,
        });
    });

    it('sampleRegionBoundaryPoints 只采样当前区域边界点', () => {
        const assignments = createRegionAssignments(6, 6);
        for (let y = 1; y <= 4; y += 1) {
            for (let x = 1; x <= 4; x += 1) {
                assignments[y * 6 + x] = 0;
            }
        }

        const points = sampleRegionBoundaryPoints({
            assignments,
            width: 6,
            regionIndex: 0,
            maxPoints: 20,
        });

        expect(points).toEqual(expect.arrayContaining([
            { x: 1, y: 1 },
            { x: 4, y: 4 },
        ]));
        expect(points).not.toContainEqual({ x: 2, y: 2 });
    });

    it('isMagicSelectionUsable 拒绝明显漏到整图的大选区', () => {
        expect(isMagicSelectionUsable(10, 100, 0.2)).toBe(true);
        expect(isMagicSelectionUsable(90, 100, 0.2)).toBe(false);
        expect(isMagicSelectionUsable(0, 100, 0.2)).toBe(false);
    });
});
