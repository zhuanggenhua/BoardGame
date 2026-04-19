import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { TutorialSelectionGate } from '../TutorialSelectionGate';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('../../../system/LoadingScreen', () => ({
  LoadingScreen: ({
    description,
    anchor,
    className,
    descriptionClassName,
  }: {
    description?: string;
    anchor?: string;
    className?: string;
    descriptionClassName?: string;
  }) => (
    <div
      data-loading="true"
      data-anchor={anchor ?? 'viewport'}
      data-class={className ?? ''}
      data-description-class={descriptionClassName ?? ''}
    >
      {description ?? 'loading'}
    </div>
  ),
}));

describe('TutorialSelectionGate', () => {
  it('教程模式下显示加载文案并屏蔽子内容', () => {
    const html = renderToStaticMarkup(
      <TutorialSelectionGate
        isTutorialMode={true}
        loadingText="加载中"
      >
        <div>子内容</div>
      </TutorialSelectionGate>
    );

    expect(html).toContain('加载中');
    expect(html).not.toContain('子内容');
    expect(html).toContain('data-anchor="container"');
  });

  it('非教程模式下渲染子内容', () => {
    const html = renderToStaticMarkup(
      <TutorialSelectionGate
        isTutorialMode={false}
        isTutorialActive={false}
        loadingText="加载中"
      >
        <div>子内容</div>
      </TutorialSelectionGate>
    );

    expect(html).toContain('子内容');
    expect(html).not.toContain('加载中');
  });
});
