// @vitest-environment jsdom
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { PlatformNavigation } from '../PlatformNavigation';

beforeAll(() => {
    HTMLDialogElement.prototype.showModal = function () { this.open = true; };
    HTMLDialogElement.prototype.close = function () { this.open = false; };
});

describe('平台导航的单一入口与抽屉返回', () => {
    const items = [{ id: 'discover', label: '发现' }, { id: 'library', label: '收藏库' }, { id: 'upload', label: '上传' }];
    it('同一导航集合提交选择，当前页面有可访问状态', () => {
        const select = vi.fn();
        render(<PlatformNavigation items={items} selected="discover" onSelect={select} menuLabel="菜单" closeLabel="关闭菜单" utility={<button>操作指南</button>} />);
        fireEvent.click(screen.getByRole('button', { name: '收藏库' }));
        expect(select).toHaveBeenCalledWith('library');
        expect(screen.getByRole('button', { name: '发现' }).getAttribute('aria-current')).toBe('page');
    });
    it('抽屉可显式关闭，Escape 返回菜单触发器', () => {
        render(<PlatformNavigation items={items} selected="discover" onSelect={() => {}} menuLabel="菜单" closeLabel="关闭菜单" utility={<button>操作指南</button>} />);
        const trigger = screen.getByRole('button', { name: '菜单' });
        trigger.focus();
        fireEvent.click(trigger);
        expect(screen.getByRole('dialog', { name: '菜单' })).toBeTruthy();
        fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
        expect(screen.queryByRole('dialog')).toBeNull();
        expect(document.activeElement).toBe(trigger);
        fireEvent.click(trigger);
        fireEvent.click(screen.getByRole('button', { name: '关闭菜单' }));
        expect(screen.queryByRole('dialog')).toBeNull();
    });
    it('从菜单启动全局面板时先退出原生抽屉，不把新面板挡在顶层之后', () => {
        render(<PlatformNavigation items={items} selected="discover" onSelect={() => {}} menuLabel="菜单" closeLabel="关闭菜单"
            utility={<button>桌面指南</button>} mobileUtility={close => <button onClick={close}>打开指南</button>} />);
        fireEvent.click(screen.getByRole('button', { name: '菜单' }));
        fireEvent.click(screen.getByRole('button', { name: '打开指南' }));
        expect(screen.queryByRole('dialog')).toBeNull();
    });

});
