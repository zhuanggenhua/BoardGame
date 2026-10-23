import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { GameChangelogContent } from '../GameChangelogContent';

afterEach(cleanup);
describe('公开更新日志正文', () => {
    it('把真实日志的标题与项目列表呈现为阅读结构，而不是原始标记', () => {
        const { container } = render(<GameChangelogContent content={'本次改进体验。\n\n## 修复\n- 修复响应窗口\n- 保留 **骰面** 结果'} />);
        expect(screen.getByRole('heading', { name: '修复' })).toBeVisible();
        expect(screen.getAllByRole('listitem')).toHaveLength(2);
        expect(container.textContent).not.toContain('##');
        expect(container.textContent).not.toContain('**');
        expect(container.querySelector('strong')?.textContent).toBe('骰面');
    });
    it('保留纯文本段落且不把正文中的原始脚本当成界面执行', () => {
        const { container } = render(<GameChangelogContent content={'第一段。\n\n第二段。\n\n<script>alert(1)</script>'} />);
        expect(screen.getByText('第一段。')).toBeVisible();
        expect(screen.getByText('第二段。')).toBeVisible();
        expect(container.querySelector('script')).toBeNull();
    });
});
