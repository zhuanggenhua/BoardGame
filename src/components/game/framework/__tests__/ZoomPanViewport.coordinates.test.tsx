/* @vitest-environment happy-dom */
import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ZoomPanViewport } from '../ZoomPanViewport';

describe('地图拖拽的屏幕坐标到画布坐标映射', () => {
    it.each([
        { screenWidth: 1000, coordinates: undefined, x: 100, y: 80 },
        { screenWidth: 500, coordinates: undefined, x: 200, y: 160 },
        { screenWidth: 500, coordinates: { width: 2000, height: 1600 }, x: 400, y: 320 },
        { screenWidth: 0, coordinates: undefined, x: 100, y: 80 },
    ])('在渲染宽度 $screenWidth 和显式坐标 $coordinates 下保持跟手', async ({ screenWidth, coordinates, x, y }) => {
        render(<ZoomPanViewport panBoundsMode="free" inertiaEnabled={false} coordinateSize={coordinates} containerTestId="viewport" contentTestId="content"><div>map</div></ZoomPanViewport>);
        const viewport = screen.getByTestId('viewport');
        Object.defineProperties(viewport, {
            offsetWidth: { configurable: true, value: 1000 },
            offsetHeight: { configurable: true, value: 800 },
        });
        viewport.getBoundingClientRect = () => ({ width: screenWidth, height: screenWidth * 0.8, left: 0, top: 0 } as DOMRect);
        await act(async () => {
            fireEvent.touchStart(viewport, { touches: [{ clientX: 100, clientY: 100 }] });
        });
        await act(async () => {
            fireEvent.touchMove(viewport, { touches: [{ clientX: 200, clientY: 180 }] });
        });
        expect(screen.getByTestId('content').style.transform).toContain(`translate(${x}px, ${y}px)`);
        await act(async () => { fireEvent.touchEnd(viewport, { touches: [] }); });
    });
});
