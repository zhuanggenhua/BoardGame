import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react';
import { UI_Z_INDEX } from '../../../core';
import { syncProxyValueToTextEntry } from '../../../lib/textEntry';
import { MobileTextEntryProxyLayer } from '../MobileTextEntryProxyLayer';

let visualViewportResizeHandler: ((event: Event) => void) | null = null;

const ensureVisualViewportStub = () => {
    Object.defineProperty(window, 'visualViewport', {
        configurable: true,
        value: {
            height: 564,
            offsetTop: 0,
            addEventListener: vi.fn((eventName: string, handler: (event: Event) => void) => {
                if (eventName === 'resize') {
                    visualViewportResizeHandler = handler;
                }
            }),
            removeEventListener: vi.fn((eventName: string, handler: (event: Event) => void) => {
                if (eventName === 'resize' && visualViewportResizeHandler === handler) {
                    visualViewportResizeHandler = null;
                }
            }),
        },
    });
};

describe('MobileTextEntryProxyLayer', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        cleanup();
        document.body.innerHTML = '<div id="modal-root"></div>';
        document.documentElement.style.setProperty('--keyboard-inset-height', '280px');
        Object.defineProperty(window, 'innerHeight', { configurable: true, value: 844 });
        Object.defineProperty(document.documentElement, 'clientHeight', { configurable: true, value: 844 });
        Object.defineProperty(window, 'matchMedia', {
            configurable: true,
            value: vi.fn().mockReturnValue({ matches: true }),
        });
        visualViewportResizeHandler = null;
        ensureVisualViewportStub();
    });

    afterEach(() => {
        vi.runOnlyPendingTimers();
        vi.useRealTimers();
        cleanup();
        document.body.innerHTML = '';
        document.documentElement.style.removeProperty('--keyboard-inset-height');
        visualViewportResizeHandler = null;
    });

    it('在键盘弹起时为移动端输入框创建代理输入，不限 modal 作用域', async () => {
        const sourceInput = document.createElement('input');
        sourceInput.type = 'text';
        sourceInput.placeholder = 'feedback';
        sourceInput.value = 'hello';
        document.body.appendChild(sourceInput);

        render(<MobileTextEntryProxyLayer />);

        await act(async () => {
            sourceInput.focus();
            fireEvent.focusIn(sourceInput);
            await vi.advanceTimersByTimeAsync(60);
        });

        const proxyInput = screen.getByTestId('mobile-text-entry-proxy-input');
        expect(proxyInput).toBeTruthy();
        expect((proxyInput as HTMLInputElement).value).toBe('hello');
        expect(sourceInput.readOnly).toBe(true);
        expect(sourceInput.getAttribute('data-mobile-text-entry-proxy-source')).toBe('true');
    });

    it('代理输入失焦切到另一个可代理输入时，不应先闪退再重建', async () => {
        const modalRoot = document.getElementById('modal-root');
        if (!modalRoot) throw new Error('missing modal root');

        const firstInput = document.createElement('input');
        firstInput.type = 'text';
        firstInput.placeholder = 'first';
        firstInput.value = 'alpha';

        const secondInput = document.createElement('input');
        secondInput.type = 'text';
        secondInput.placeholder = 'second';
        secondInput.value = 'beta';

        modalRoot.appendChild(firstInput);
        modalRoot.appendChild(secondInput);

        render(<MobileTextEntryProxyLayer />);

        await act(async () => {
            firstInput.focus();
            fireEvent.focusIn(firstInput);
            await vi.advanceTimersByTimeAsync(60);
        });

        const initialProxy = screen.getByTestId('mobile-text-entry-proxy-input');
        expect((initialProxy as HTMLInputElement).value).toBe('alpha');

        await act(async () => {
            fireEvent.pointerDown(secondInput);
            fireEvent.blur(initialProxy);
            secondInput.focus();
            fireEvent.focusIn(secondInput);
            fireEvent.focusOut(firstInput);
            await vi.advanceTimersByTimeAsync(160);
        });

        const proxies = screen.getAllByTestId('mobile-text-entry-proxy-input');
        expect(proxies).toHaveLength(1);
        expect((proxies[0] as HTMLInputElement).value).toBe('beta');
        expect(firstInput.readOnly).toBe(false);
        expect(secondInput.readOnly).toBe(true);
    });

    it('代理输入失焦后若无手势却跳到同一表单下一个输入框，应直接切换代理', async () => {
        const modalRoot = document.getElementById('modal-root');
        if (!modalRoot) throw new Error('missing modal root');

        const form = document.createElement('form');
        const firstInput = document.createElement('input');
        firstInput.type = 'text';
        firstInput.placeholder = 'first';
        firstInput.value = 'alpha';

        const secondInput = document.createElement('input');
        secondInput.type = 'text';
        secondInput.placeholder = 'second';
        secondInput.value = '';

        form.appendChild(firstInput);
        form.appendChild(secondInput);
        modalRoot.appendChild(form);

        render(<MobileTextEntryProxyLayer />);

        await act(async () => {
            firstInput.focus();
            fireEvent.focusIn(firstInput);
            await vi.advanceTimersByTimeAsync(60);
        });

        const initialProxy = screen.getByTestId('mobile-text-entry-proxy-input');

        await act(async () => {
            fireEvent.blur(initialProxy);
            secondInput.focus();
            fireEvent.focusIn(secondInput);
            fireEvent.focusOut(firstInput);
            await vi.advanceTimersByTimeAsync(160);
        });

        const proxyInput = screen.getByTestId('mobile-text-entry-proxy-input') as HTMLInputElement;
        expect(proxyInput.value).toBe('');
        expect(firstInput.readOnly).toBe(false);
        expect(secondInput.readOnly).toBe(true);
    });

    it('非文本按钮获得焦点时延迟关闭代理，避免吞掉同一触摸链的点击', async () => {
        const modalRoot = document.getElementById('modal-root');
        if (!modalRoot) throw new Error('missing modal root');

        const sourceInput = document.createElement('input');
        sourceInput.type = 'text';
        sourceInput.value = 'alpha';
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = 'discard';
        modalRoot.appendChild(sourceInput);
        modalRoot.appendChild(button);

        render(<MobileTextEntryProxyLayer />);

        await act(async () => {
            sourceInput.focus();
            fireEvent.focusIn(sourceInput);
            await vi.advanceTimersByTimeAsync(60);
        });

        const proxyInput = screen.getByTestId('mobile-text-entry-proxy-input');
        expect(proxyInput).toBeTruthy();

        await act(async () => {
            button.focus();
            fireEvent.focusIn(button);
            await vi.advanceTimersByTimeAsync(80);
        });

        expect(screen.getByTestId('mobile-text-entry-proxy-input')).toBe(proxyInput);

        await act(async () => {
            await vi.advanceTimersByTimeAsync(90);
        });

        expect(screen.queryByTestId('mobile-text-entry-proxy-input')).toBeNull();
    });

    it('代理层不应让整块表单拦截底部按钮点击，只允许代理输入自己接收事件', async () => {
        const sourceInput = document.createElement('input');
        sourceInput.type = 'text';
        sourceInput.value = 'alpha';
        document.body.appendChild(sourceInput);

        render(<MobileTextEntryProxyLayer />);

        await act(async () => {
            sourceInput.focus();
            fireEvent.focusIn(sourceInput);
            await vi.advanceTimersByTimeAsync(60);
        });

        const proxyInput = screen.getByTestId('mobile-text-entry-proxy-input') as HTMLInputElement;
        const proxyForm = proxyInput.closest('form');
        expect(proxyForm).not.toBeNull();
        expect(proxyForm?.className).toContain('pointer-events-none');
        expect(proxyInput.className).toContain('pointer-events-auto');
    });

    it('代理输入层级应高于标准 modal 内容层，避免被弹窗盖住', async () => {
        const sourceInput = document.createElement('input');
        sourceInput.type = 'text';
        sourceInput.value = 'alpha';
        document.body.appendChild(sourceInput);

        render(<MobileTextEntryProxyLayer />);

        await act(async () => {
            sourceInput.focus();
            fireEvent.focusIn(sourceInput);
            await vi.advanceTimersByTimeAsync(60);
        });

        const proxyLayer = screen.getByTestId('mobile-text-entry-proxy');
        expect(proxyLayer).toHaveStyle({ zIndex: String(UI_Z_INDEX.textEntryProxy) });
        expect(UI_Z_INDEX.textEntryProxy).toBeGreaterThan(UI_Z_INDEX.modalContent);
        expect(UI_Z_INDEX.textEntryProxy).toBeGreaterThan(UI_Z_INDEX.modalTooltip);
    });

    it('代理输入改值时不应重建节点或丢失焦点', async () => {
        const modalRoot = document.getElementById('modal-root');
        if (!modalRoot) throw new Error('missing modal root');

        const sourceInput = document.createElement('input');
        sourceInput.type = 'text';
        sourceInput.value = 'a';
        modalRoot.appendChild(sourceInput);

        render(<MobileTextEntryProxyLayer />);

        await act(async () => {
            sourceInput.focus();
            fireEvent.focusIn(sourceInput);
            await vi.advanceTimersByTimeAsync(60);
        });

        const initialProxy = screen.getByTestId('mobile-text-entry-proxy-input') as HTMLInputElement;
        expect(document.activeElement).toBe(initialProxy);

        await act(async () => {
            fireEvent.change(initialProxy, { target: { value: 'ab' } });
            await vi.advanceTimersByTimeAsync(20);
        });

        const currentProxy = screen.getByTestId('mobile-text-entry-proxy-input') as HTMLInputElement;
        expect(currentProxy).toBe(initialProxy);
        expect(document.activeElement).toBe(currentProxy);
        expect(currentProxy.value).toBe('ab');
        expect(sourceInput.readOnly).toBe(true);
    });

    it('透明源输入会给代理层补可见背景', async () => {
        const modalRoot = document.getElementById('modal-root');
        if (!modalRoot) throw new Error('missing modal root');

        const sourceInput = document.createElement('input');
        sourceInput.type = 'text';
        sourceInput.value = 'visible';
        sourceInput.style.backgroundColor = 'transparent';
        modalRoot.appendChild(sourceInput);

        render(<MobileTextEntryProxyLayer />);

        await act(async () => {
            sourceInput.focus();
            fireEvent.focusIn(sourceInput);
            await vi.advanceTimersByTimeAsync(60);
        });

        const proxyInput = screen.getByTestId('mobile-text-entry-proxy-input') as HTMLInputElement;
        expect(proxyInput.style.backgroundColor).toBe('rgba(255, 248, 240, 0.98)');
    });

    it('单行非表单代理输入默认使用 done enterKeyHint', async () => {
        const modalRoot = document.getElementById('modal-root');
        if (!modalRoot) throw new Error('missing modal root');

        const sourceInput = document.createElement('input');
        sourceInput.type = 'text';
        modalRoot.appendChild(sourceInput);

        render(<MobileTextEntryProxyLayer />);

        await act(async () => {
            sourceInput.focus();
            fireEvent.focusIn(sourceInput);
            await vi.advanceTimersByTimeAsync(60);
        });

        const proxyInput = screen.getByTestId('mobile-text-entry-proxy-input') as HTMLInputElement;
        expect(proxyInput.getAttribute('enterkeyhint')).toBe('done');
    });

    it('单行表单代理输入默认使用 enter enterKeyHint', async () => {
        const modalRoot = document.getElementById('modal-root');
        if (!modalRoot) throw new Error('missing modal root');

        const form = document.createElement('form');
        const sourceInput = document.createElement('input');
        sourceInput.type = 'text';
        form.appendChild(sourceInput);
        modalRoot.appendChild(form);

        render(<MobileTextEntryProxyLayer />);

        await act(async () => {
            sourceInput.focus();
            fireEvent.focusIn(sourceInput);
            await vi.advanceTimersByTimeAsync(60);
        });

        const proxyInput = screen.getByTestId('mobile-text-entry-proxy-input') as HTMLInputElement;
        expect(proxyInput.getAttribute('enterkeyhint')).toBe('enter');
    });

    it('密码输入代理会保留 password 类型并禁用宿主交互而不隐藏宿主内容', async () => {
        const modalRoot = document.getElementById('modal-root');
        if (!modalRoot) throw new Error('missing modal root');

        const host = document.createElement('div');
        host.setAttribute('data-mobile-text-entry-proxy-host', 'true');
        const sourceInput = document.createElement('input');
        sourceInput.type = 'password';
        host.appendChild(sourceInput);
        modalRoot.appendChild(host);

        const view = render(<MobileTextEntryProxyLayer />);

        await act(async () => {
            sourceInput.focus();
            fireEvent.focusIn(sourceInput);
            await vi.advanceTimersByTimeAsync(60);
        });

        const proxyInput = screen.getByTestId('mobile-text-entry-proxy-input') as HTMLInputElement;
        expect(proxyInput.type).toBe('password');
        expect(host.style.opacity).toBe('');
        expect(host.style.pointerEvents).toBe('none');
        expect(sourceInput.style.opacity).toBe('');

        view.unmount();

        expect(host.style.pointerEvents).toBe('');
    });

    it('邮箱代理输入会回退为 text 并保留 email 键盘布局', async () => {
        const modalRoot = document.getElementById('modal-root');
        if (!modalRoot) throw new Error('missing modal root');

        const sourceInput = document.createElement('input');
        sourceInput.type = 'email';
        sourceInput.value = 'abc@example.com';
        modalRoot.appendChild(sourceInput);

        render(<MobileTextEntryProxyLayer />);

        await act(async () => {
            sourceInput.focus();
            fireEvent.focusIn(sourceInput);
            await vi.advanceTimersByTimeAsync(60);
        });

        const proxyInput = screen.getByTestId('mobile-text-entry-proxy-input') as HTMLInputElement;
        expect(proxyInput.type).toBe('text');
        expect(proxyInput.inputMode).toBe('email');
        expect(proxyInput.value).toBe('abc@example.com');
    });

    it('visualViewport resize 先于 CSS 变量更新时不应误判键盘关闭', async () => {
        const modalRoot = document.getElementById('modal-root');
        if (!modalRoot) throw new Error('missing modal root');

        const sourceInput = document.createElement('input');
        sourceInput.type = 'text';
        sourceInput.value = 'keep-open';
        modalRoot.appendChild(sourceInput);

        render(<MobileTextEntryProxyLayer />);

        await act(async () => {
            sourceInput.focus();
            fireEvent.focusIn(sourceInput);
            await vi.advanceTimersByTimeAsync(60);
        });

        const proxyInput = screen.getByTestId('mobile-text-entry-proxy-input') as HTMLInputElement;
        expect(document.activeElement).toBe(proxyInput);

        document.documentElement.style.setProperty('--keyboard-inset-height', '0px');

        await act(async () => {
            visualViewportResizeHandler?.(new Event('resize'));
            await vi.advanceTimersByTimeAsync(20);
        });

        expect(screen.getByTestId('mobile-text-entry-proxy-input')).toBe(proxyInput);
        expect(document.activeElement).toBe(proxyInput);
    });

    it('代理层卸载后会恢复原始 input 的可编辑状态', async () => {
        const modalRoot = document.getElementById('modal-root');
        if (!modalRoot) throw new Error('missing modal root');

        const sourceInput = document.createElement('input');
        sourceInput.type = 'text';
        sourceInput.value = 'persist me';
        modalRoot.appendChild(sourceInput);

        const view = render(<MobileTextEntryProxyLayer />);

        await act(async () => {
            sourceInput.focus();
            fireEvent.focusIn(sourceInput);
            await vi.advanceTimersByTimeAsync(60);
        });

        expect(screen.getByTestId('mobile-text-entry-proxy-input')).toBeTruthy();
        expect(sourceInput.readOnly).toBe(true);
        expect(sourceInput.style.opacity).toBe('');
        expect(sourceInput.getAttribute('data-mobile-text-entry-proxy-source')).toBe('true');

        view.unmount();

        expect(sourceInput.readOnly).toBe(false);
        expect(sourceInput.style.opacity).toBe('');
        expect(sourceInput.style.caretColor).toBe('');
        expect(sourceInput.hasAttribute('data-mobile-text-entry-proxy-source')).toBe(false);
    });

    it('代理层卸载后会恢复原始 contenteditable 的可编辑状态', async () => {
        const modalRoot = document.getElementById('modal-root');
        if (!modalRoot) throw new Error('missing modal root');

        const editable = document.createElement('div');
        editable.setAttribute('contenteditable', 'true');
        editable.textContent = 'editable text';
        modalRoot.appendChild(editable);

        const view = render(<MobileTextEntryProxyLayer />);

        await act(async () => {
            editable.focus();
            fireEvent.focusIn(editable);
            await vi.advanceTimersByTimeAsync(60);
        });

        expect(screen.getByTestId('mobile-text-entry-proxy-textarea')).toBeTruthy();
        expect(editable.getAttribute('contenteditable')).toBe('false');
        expect(editable.getAttribute('data-mobile-text-entry-proxy-source')).toBe('true');

        view.unmount();

        expect(editable.getAttribute('contenteditable')).toBe('true');
        expect(editable.style.opacity).toBe('');
        expect(editable.style.caretColor).toBe('');
        expect(editable.hasAttribute('data-mobile-text-entry-proxy-source')).toBe(false);
    });

    it('多行代理输入应使用紧凑高度而不是继承源 textarea 的大高度', async () => {
        const modalRoot = document.getElementById('modal-root');
        if (!modalRoot) throw new Error('missing modal root');

        const sourceTextarea = document.createElement('textarea');
        sourceTextarea.value = 'feedback';
        sourceTextarea.style.height = '240px';
        sourceTextarea.style.minHeight = '240px';
        sourceTextarea.style.maxHeight = '240px';
        modalRoot.appendChild(sourceTextarea);

        render(<MobileTextEntryProxyLayer />);

        await act(async () => {
            sourceTextarea.focus();
            fireEvent.focusIn(sourceTextarea);
            await vi.advanceTimersByTimeAsync(60);
        });

        const proxyTextarea = screen.getByTestId('mobile-text-entry-proxy-textarea') as HTMLTextAreaElement;
        expect(proxyTextarea.style.minHeight).toBe('96px');
        expect(proxyTextarea.style.height).toBe('auto');
        expect(proxyTextarea.style.maxHeight).not.toBe('240px');
        expect(proxyTextarea.getAttribute('style')).not.toContain('240px');
    });

    it('会把代理输入同步回 React 受控 input', () => {
        const ControlledInput = () => {
            const [value, setValue] = React.useState('');
            return (
                <input
                    data-testid="controlled-input"
                    value={value}
                    onChange={(event) => setValue(event.target.value)}
                />
            );
        };

        render(<ControlledInput />);
        const input = screen.getByTestId('controlled-input') as HTMLInputElement;

        expect(syncProxyValueToTextEntry(input, '代理同步值')).toBe(true);
        expect(input.value).toBe('代理同步值');
    });

    it('会把代理输入同步回被代理层冻结为只读的源 input', () => {
        const input = document.createElement('input');
        input.type = 'text';
        input.value = '';
        input.readOnly = true;
        input.setAttribute('data-mobile-text-entry-proxy-source', 'true');
        document.body.appendChild(input);

        expect(syncProxyValueToTextEntry(input, '冻结输入同步值')).toBe(true);
        expect(input.value).toBe('冻结输入同步值');
        expect(input.readOnly).toBe(true);
    });

    it('冻结源输入同步值时不应重新抢占焦点', () => {
        const input = document.createElement('input');
        input.type = 'text';
        input.value = '';
        input.readOnly = true;
        input.setAttribute('data-mobile-text-entry-proxy-source', 'true');
        const focusSpy = vi.spyOn(input, 'focus');
        document.body.appendChild(input);

        expect(syncProxyValueToTextEntry(input, '保持代理焦点')).toBe(true);
        expect(focusSpy).not.toHaveBeenCalled();
    });

    it('会把代理输入同步回被代理层冻结为 contenteditable=false 的源节点', () => {
        const editable = document.createElement('div');
        editable.setAttribute('contenteditable', 'false');
        editable.setAttribute('data-mobile-text-entry-proxy-source', 'true');
        editable.textContent = 'before';
        document.body.appendChild(editable);

        expect(syncProxyValueToTextEntry(editable, 'after')).toBe(true);
        expect(editable.textContent).toBe('after');
    });

    it('单行非表单代理输入默认按 Enter 时只关闭代理', async () => {
        const modalRoot = document.getElementById('modal-root');
        if (!modalRoot) throw new Error('missing modal root');

        const sourceInput = document.createElement('input');
        sourceInput.type = 'text';
        sourceInput.placeholder = 'feedback';
        modalRoot.appendChild(sourceInput);

        render(<MobileTextEntryProxyLayer />);

        await act(async () => {
            sourceInput.focus();
            fireEvent.focusIn(sourceInput);
            await vi.advanceTimersByTimeAsync(60);
        });

        const proxyInput = screen.getByTestId('mobile-text-entry-proxy-input');

        await act(async () => {
            fireEvent.change(proxyInput, { target: { value: 'hello from proxy' } });
            fireEvent.keyDown(proxyInput, { key: 'Enter', code: 'Enter' });
            await vi.advanceTimersByTimeAsync(20);
        });

        expect(screen.queryByTestId('mobile-text-entry-proxy-input')).toBeNull();
    });

    it('单行表单代理输入默认按 Enter 时会提交源表单', async () => {
        const modalRoot = document.getElementById('modal-root');
        if (!modalRoot) throw new Error('missing modal root');

        const form = document.createElement('form');
        const sourceInput = document.createElement('input');
        sourceInput.type = 'text';
        sourceInput.placeholder = 'feedback';
        const submitButton = document.createElement('button');
        submitButton.type = 'submit';
        submitButton.textContent = 'send';
        const onSubmit = vi.fn((event: Event) => event.preventDefault());
        form.addEventListener('submit', onSubmit);
        form.appendChild(sourceInput);
        form.appendChild(submitButton);
        modalRoot.appendChild(form);

        render(<MobileTextEntryProxyLayer />);

        await act(async () => {
            sourceInput.focus();
            fireEvent.focusIn(sourceInput);
            await vi.advanceTimersByTimeAsync(60);
        });

        const proxyInput = screen.getByTestId('mobile-text-entry-proxy-input');

        await act(async () => {
            fireEvent.change(proxyInput, { target: { value: 'hello from proxy' } });
            fireEvent.keyDown(proxyInput, { key: 'Enter', code: 'Enter' });
            await vi.advanceTimersByTimeAsync(20);
        });

        expect(onSubmit).toHaveBeenCalledTimes(1);
        expect(screen.queryByTestId('mobile-text-entry-proxy-input')).toBeNull();
    });

    it('动作型 enterKeyHint 会让单行代理输入按 Enter 时提交源表单', async () => {
        const modalRoot = document.getElementById('modal-root');
        if (!modalRoot) throw new Error('missing modal root');

        const form = document.createElement('form');
        const sourceInput = document.createElement('input');
        sourceInput.type = 'text';
        sourceInput.placeholder = 'chat';
        sourceInput.setAttribute('enterkeyhint', 'send');
        const submitButton = document.createElement('button');
        submitButton.type = 'submit';
        submitButton.textContent = 'send';
        const onSubmit = vi.fn((event: Event) => event.preventDefault());
        form.addEventListener('submit', onSubmit);
        form.appendChild(sourceInput);
        form.appendChild(submitButton);
        modalRoot.appendChild(form);

        render(<MobileTextEntryProxyLayer />);

        await act(async () => {
            sourceInput.focus();
            fireEvent.focusIn(sourceInput);
            await vi.advanceTimersByTimeAsync(60);
        });

        const proxyInput = screen.getByTestId('mobile-text-entry-proxy-input');

        await act(async () => {
            fireEvent.change(proxyInput, { target: { value: 'hello from proxy' } });
            fireEvent.keyDown(proxyInput, { key: 'Enter', code: 'Enter' });
            await vi.advanceTimersByTimeAsync(20);
        });

        expect(onSubmit).toHaveBeenCalledTimes(1);
        expect(screen.queryByTestId('mobile-text-entry-proxy-input')).toBeNull();
    });

    it('代理表单 submit 会提交源表单并关闭代理输入', async () => {
        const modalRoot = document.getElementById('modal-root');
        if (!modalRoot) throw new Error('missing modal root');

        const form = document.createElement('form');
        const sourceInput = document.createElement('input');
        sourceInput.type = 'text';
        const submitButton = document.createElement('button');
        submitButton.type = 'submit';
        submitButton.textContent = 'send';
        const onSubmit = vi.fn((event: Event) => event.preventDefault());
        form.addEventListener('submit', onSubmit);
        form.appendChild(sourceInput);
        form.appendChild(submitButton);
        modalRoot.appendChild(form);

        render(<MobileTextEntryProxyLayer />);

        await act(async () => {
            sourceInput.focus();
            fireEvent.focusIn(sourceInput);
            await vi.advanceTimersByTimeAsync(60);
        });

        const proxyInput = screen.getByTestId('mobile-text-entry-proxy-input');
        const proxyForm = proxyInput.closest('form');
        expect(proxyForm).not.toBeNull();

        await act(async () => {
            fireEvent.submit(proxyForm!);
            await vi.advanceTimersByTimeAsync(20);
        });

        expect(onSubmit).toHaveBeenCalledTimes(1);
        expect(screen.queryByTestId('mobile-text-entry-proxy-input')).toBeNull();
    });
});
