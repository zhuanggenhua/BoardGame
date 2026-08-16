import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import {
  RENDER_QUALITY_STORAGE_KEY,
  readRenderQualityPreference,
} from '../../../../../engine/renderPipeline';
import { RenderQualitySettingsSection } from '../RenderQualitySettingsSection';

const t = (key: string) => key;

describe('RenderQualitySettingsSection', () => {
  afterEach(() => {
    window.localStorage.clear();
  });

  it('渲染低中高三个画质按钮，并默认选中高档', () => {
    render(<RenderQualitySettingsSection t={t} />);

    expect(screen.getByTestId('render-quality-settings')).toBeInTheDocument();
    expect(screen.getByTestId('render-quality-option-low')).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByTestId('render-quality-option-medium')).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByTestId('render-quality-option-high')).toHaveAttribute('aria-pressed', 'true');
  });

  it('点击画质按钮会写入玩家偏好并更新选中态', () => {
    render(<RenderQualitySettingsSection t={t} />);

    fireEvent.click(screen.getByTestId('render-quality-option-low'));

    expect(readRenderQualityPreference()).toBe('low');
    expect(window.localStorage.getItem(RENDER_QUALITY_STORAGE_KEY)).toBe('low');
    expect(screen.getByTestId('render-quality-option-low')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('render-quality-option-high')).toHaveAttribute('aria-pressed', 'false');
  });
});
