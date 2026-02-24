import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

/**
 * 生成唯一 ID，兼容非 Secure Context（HTTP 环境）。
 * crypto.randomUUID() 仅在 HTTPS 或 localhost 下可用，HTTP 生产环境会抛错。
 */
export function generateId(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }
    // 降级：RFC 4122 v4 UUID 格式
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
}

/**
 * 复制文本到剪贴板，兼容非 Secure Context（HTTP 环境）。
 * navigator.clipboard 仅在 HTTPS 或 localhost 下可用，HTTP 下降级为 execCommand。
 * @returns 是否复制成功
 */
export async function copyToClipboard(text: string): Promise<boolean> {
    // 优先使用现代 Clipboard API（Secure Context）
    if (navigator.clipboard?.writeText) {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch {
            // 权限被拒绝时降级
        }
    }
    // 降级：document.execCommand（HTTP 环境 / 旧浏览器）
    try {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.cssText = 'position:fixed;top:-9999px;left:-9999px;opacity:0';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        const ok = document.execCommand('copy');
        document.body.removeChild(textarea);
        return ok;
    } catch {
        return false;
    }
}
