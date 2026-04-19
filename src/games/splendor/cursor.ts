import type { CursorTheme } from '../../core/cursor/types';
import { buildCursors, registerCursorThemes } from '../../core/cursor/themes';

const crystalSvgs = {
    default: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><defs><linearGradient id="sp-d" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#f8fafc"/><stop offset="55%" stop-color="#38bdf8"/><stop offset="100%" stop-color="#1d4ed8"/></linearGradient></defs><path d="M6 3 L6 26 L12 20 L18 28 L22 26 L16 18 L24 18 Z" fill="url(#sp-d)" stroke="#0f172a" stroke-width="1.5" stroke-linejoin="round"/></svg>`,
    pointer: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><defs><linearGradient id="sp-p" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#e0f2fe"/><stop offset="100%" stop-color="#2563eb"/></linearGradient></defs><path d="M14 3 C14 3 14 14 14 14 L10 12 C9 11.5 7.5 12 8 13.5 L12 20 L12 27 L22 27 L24 20 C24 20 26 14 26 13 C26 11.5 24 11 23 12 L22 13 C22 12 21 10.5 19.5 11 L19 12 C19 11 17.5 9.5 16.5 10.5 L16 12 L16 3 C16 1.5 14 1.5 14 3 Z" fill="url(#sp-p)" stroke="#0f172a" stroke-width="1.4" stroke-linejoin="round"/></svg>`,
    grabbing: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><defs><linearGradient id="sp-g" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#e2e8f0"/><stop offset="100%" stop-color="#2563eb"/></linearGradient></defs><path d="M8 15 C8 13 10 12 11 13 L11 16 M11 13 C11 11 13 10 14 11 L14 16 M14 11 C14 9 16 9 17 10 L17 16 M17 10 C17 9 19 8.5 20 10 L20 16 L20 22 C20 25 17 28 13 28 C9 28 7 25 7 22 L7 18 C7 16 8 15 8 15 Z" fill="url(#sp-g)" stroke="#0f172a" stroke-width="1.4" stroke-linejoin="round"/></svg>`,
    zoomIn: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><circle cx="13" cy="13" r="9" fill="#e0f2fe" stroke="#0f172a" stroke-width="2"/><line x1="20" y1="20" x2="28" y2="28" stroke="#0f172a" stroke-width="3" stroke-linecap="round"/><line x1="9" y1="13" x2="17" y2="13" stroke="#2563eb" stroke-width="2.2" stroke-linecap="round"/><line x1="13" y1="9" x2="13" y2="17" stroke="#2563eb" stroke-width="2.2" stroke-linecap="round"/></svg>`,
    notAllowed: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><circle cx="16" cy="16" r="12" fill="#1e3a8a" stroke="#0f172a" stroke-width="2"/><line x1="8" y1="16" x2="24" y2="16" stroke="#ef4444" stroke-width="3" stroke-linecap="round"/></svg>`,
    help: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><circle cx="16" cy="16" r="12" fill="#dbeafe" stroke="#0f172a" stroke-width="2"/><text x="16" y="22" text-anchor="middle" font-size="17" font-weight="bold" font-family="Arial,sans-serif" fill="#1d4ed8">?</text></svg>`,
};

const crystalTheme: CursorTheme = {
    id: 'splendor-crystal',
    gameId: 'splendor',
    label: 'Splendor',
    variantLabel: 'Crystal',
    previewSvgs: crystalSvgs,
    ...buildCursors(crystalSvgs, { zoomIn: [13, 13] }),
};

registerCursorThemes([crystalTheme]);
