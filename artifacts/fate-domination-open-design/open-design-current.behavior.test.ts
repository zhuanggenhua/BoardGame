import { readFileSync } from 'node:fs';
import path from 'node:path';
import { JSDOM } from 'jsdom';
import { afterEach, describe, expect, it } from 'vitest';
const html = readFileSync(path.join(import.meta.dirname, 'index-v6.html'), 'utf8');
const windows: JSDOM[] = [];
function setup() {
    const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://example.test/' });
    windows.push(dom);
    return dom.window.document;
}
afterEach(() => { for (const dom of windows.splice(0)) dom.window.close(); });
describe('当前工作稿详情行为', () => {
    it('四位玩家可直接切换，隐藏从者和技能不能泄露，详情不承载已打出', () => {
        const doc = setup();
        expect(doc.querySelectorAll('#opp-player-switch button')).toHaveLength(4);
        (doc.querySelector('.opp-seat[data-player="kirei"]') as HTMLElement).click();
        expect(doc.querySelector('#opp-title')?.textContent).toBe('言峰绮礼');
        expect(doc.querySelector('#opp-stats')?.textContent).toContain('当前威力16');
        expect(doc.querySelector('#opp-ability')?.textContent).toContain('两幅面孔');
        expect(doc.querySelector('#opp-servant-card')?.getAttribute('src')).toBe('assets/back-servant-gold.png');
        expect([...doc.querySelectorAll('#opp-skills img')].map(node => node.getAttribute('src'))).toEqual(Array(3).fill('assets/back-skill-red.png'));
        expect(doc.querySelector('#opp-played-left')).toBeNull();
        expect(doc.querySelector('#opp-overlay #player-drawer')).toBeNull();
        (doc.querySelector('#opp-player-switch [data-player="rin"]') as HTMLElement).click();
        expect(doc.querySelector('#opp-title')?.textContent).toBe('远坂凛');
        expect(doc.querySelector('#opp-overlay .opp-inspect-card')).toBeNull();
    });
    it('本人详情读取当前出牌和剩余令咒，工房不凭空增加地利威力', () => {
        const doc = setup();
        (doc.querySelector('#opp-player-switch [data-player="shirou"]') as HTMLElement).click();
        expect(doc.querySelector('#opp-stats')?.textContent).toContain('当前威力4');
        expect(doc.querySelector('#opp-stats')?.textContent).toContain('令咒3');
        (doc.querySelector('#close-opp') as HTMLElement).click();
        (doc.querySelector('.seal') as HTMLElement).click();
        const confirm = doc.querySelector('#confirm-seal-choice') as HTMLButtonElement;
        expect(confirm.disabled).toBe(true);
        (doc.querySelector('[data-seal-choice="mana"]') as HTMLElement).click();
        expect(doc.querySelectorAll('.seal:not(.is-spent)')).toHaveLength(3);
        expect(doc.querySelector('[data-seal-choice="mana"]')?.getAttribute('aria-pressed')).toBe('true');
        expect(confirm.disabled).toBe(false);
        confirm.click();
        confirm.click();
        (doc.querySelector('#opp-player-switch [data-player="shirou"]') as HTMLElement).click();
        expect(doc.querySelector('#opp-stats')?.textContent).toContain('令咒2');
        expect(doc.querySelector('#opp-stats')?.textContent).toContain('魔力8');
        expect(doc.querySelector('#own-mana')?.textContent).toBe('8');
    });
    it('切换玩家时替换图片节点，加载期间不把上一位御主的牌面配到新名字上', () => {
        const doc = setup();
        (doc.querySelector('#opp-player-switch [data-player="shinji"]') as HTMLElement).click();
        const oldMaster = doc.querySelector('#opp-master');
        (doc.querySelector('#opp-player-switch [data-player="kirei"]') as HTMLElement).click();
        expect(doc.querySelector('#opp-master')).not.toBe(oldMaster);
        expect(doc.querySelector('#opp-master')?.getAttribute('src')).toBe('assets/master-kirei.png');
        (doc.querySelector('#opp-player-switch [data-player="shirou"]') as HTMLElement).click();
        const ownServant = doc.querySelector('#opp-servant-card');
        (doc.querySelector('#opp-player-switch [data-player="rin"]') as HTMLElement).click();
        expect(doc.querySelector('#opp-servant-card')).not.toBe(ownServant);
        expect(doc.querySelector('#opp-servant-card')?.getAttribute('src')).toBe('assets/back-servant-gold.png');
    });

    it('头像选中展开本席位抽屉，点击才打开详情，关闭回到原抽屉', () => {
        const doc = setup(); const win = doc.defaultView!;
        const kirei = doc.querySelector('.opp-seat[data-player="kirei"]') as HTMLElement;
        kirei.dispatchEvent(new win.MouseEvent('pointerenter'));
        const drawer = doc.querySelector('#player-drawer') as HTMLElement;
        expect(drawer.hidden).toBe(false);
        expect(kirei.nextElementSibling).toBe(drawer);
        expect([...drawer.querySelectorAll('img')].map(node => node.alt)).toEqual(['中位魔术', '高位魔术']);
        expect(doc.querySelector('#opp-overlay')?.classList.contains('is-open')).toBe(false);
        kirei.click();
        expect(drawer.hidden).toBe(true);
        expect(doc.querySelector('#opp-overlay')?.classList.contains('is-open')).toBe(true);
        (doc.querySelector('#close-opp') as HTMLElement).click();
        expect(drawer.hidden).toBe(false);
        expect(doc.querySelector('#opp-overlay')?.classList.contains('is-open')).toBe(false);
        (doc.querySelector('.opp-seat[data-player="rin"]') as HTMLElement).dispatchEvent(new win.MouseEvent('pointerenter'));
        expect(drawer.querySelectorAll('img')).toHaveLength(0);
        expect(drawer.textContent).toContain('远坂凛');
        doc.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        expect(drawer.hidden).toBe(true);
    });

    it('退出键只关闭当前检视层，取消令咒不会消耗或残留待选令咒', () => {
        const doc = setup();
        const win = doc.defaultView!;
        (doc.querySelector('#opp-player-switch [data-player="shirou"]') as HTMLElement).click();
        const cameraBefore = (doc.querySelector('#map-content') as HTMLElement).style.transform;
        doc.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        expect(doc.querySelector('#opp-overlay')?.classList.contains('is-open')).toBe(false);
        expect((doc.querySelector('#map-content') as HTMLElement).style.transform).toBe(cameraBefore);
        (doc.querySelector('.seal') as HTMLElement).click();
        doc.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        expect(doc.querySelector('#seal-overlay')?.classList.contains('is-open')).toBe(false);
        (doc.querySelector('[data-seal-choice="mana"]') as HTMLElement).click();
        expect(doc.querySelectorAll('.seal:not(.is-spent)')).toHaveLength(3);
    });

});

describe('当前工作稿采集合同', () => {
    it('真实选择头像、点击详情、确认令咒，采集本身不能签发视觉通过', () => {
        const capture = readFileSync(path.join(import.meta.dirname, 'capture-current.mjs'), 'utf8');
        expect(capture).toContain('headless: true, chromiumSandbox: true');
        expect(capture).not.toContain("dispatchEvent('pointerenter')");
        expect(capture).toContain("await page.locator('#confirm-seal-choice').click()");
        expect(capture).toContain('beforeConfirm.seals === 3');
        expect(capture).toContain('m6.seals === 2');
        expect(capture).toContain('m1.handGap <= 40');
        expect(capture).not.toContain('#opp-played-left');
        expect(capture).toContain('visualVerdict: "REVISE"');
    });
});
