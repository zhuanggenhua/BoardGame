import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { test, expect } from '@playwright/test';
import { setChineseLocale, disableAudio } from '../helpers/common';

test.use({ channel: 'chromium', launchOptions: { args: [] } });
test('PC骰子文字填充诊断，非最终验收证据', async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 1920, height: 1080 });
    await setChineseLocale(page); await disableAudio(page);
    await page.goto('/play/qidahen/tutorial/basic-opening', { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('qidahen-action-wheel')).toBeVisible({ timeout: 75_000 });
    const result = await page.evaluate(async () => {
        const host = document.createElement('div'); host.id = 'private-text-diagnostic';
        host.className = 'pointer-events-none fixed z-[170] [--spacing:4px]';
        Object.assign(host.style, { left: '620px', top: '360px', width: '620px', height: '370px' });
        const section = document.createElement('section');
        section.className = 'flex h-full flex-col text-[#fff3dc]';
        section.style.height = '370px'; section.style.textShadow = '0 2px 4px #241309, 0 0 2px #241309, 0 0 8px #241309';
        section.innerHTML = '<div id="diag-stage" class="shrink-0 text-center text-[22px] font-black leading-7">步兵阶段</div><div id="diag-side" class="shrink-0 text-center text-[16px] font-bold leading-6">攻方</div><div id="diag-total" class="text-[22px] leading-7">合计 10</div><div id="diag-damage" class="text-[16px] leading-6">造成 3 损伤</div>';
        host.append(section); document.body.append(host);
        await document.fonts.ready;
        await new Promise<void>(r => requestAnimationFrame(() => requestAnimationFrame(() => r())));
        const nodeInfo = (el: Element) => {
            const s = getComputedStyle(el); const range = document.createRange(); range.selectNodeContents(el);
            const r = range.getBoundingClientRect();
            return { id: el.id, className: el.className, text: el.textContent, color: s.color, webkitTextFillColor: s.webkitTextFillColor,
                font: s.font, fontFamily: s.fontFamily, fontSize: s.fontSize, fontWeight: s.fontWeight,
                textShadow: s.textShadow, opacity: s.opacity, visibility: s.visibility, display: s.display,
                filter: s.filter, mixBlendMode: s.mixBlendMode, rect: { x: r.x, y: r.y, width: r.width, height: r.height } };
        };
        const rules: string[] = []; const walk = (items: CSSRuleList) => { for (const rule of [...items]) {
            if (rule.cssText.includes('fff3dc') || rule.cssText.includes('text-fill')) rules.push(rule.cssText.slice(0, 2000));
            if ('cssRules' in rule) walk((rule as CSSGroupingRule).cssRules);
        } };
        const sheets = [...document.styleSheets].map(s => { try { walk(s.cssRules); return { href: s.href, rules: s.cssRules.length, owner: (s.ownerNode as Element)?.getAttribute('data-vite-dev-id') }; } catch (e) { return { href:s.href, error: String(e) }; } });
        return { mode: 'private-equivalent-markup-diagnostic-not-e2e-evidence', url: location.href, nodes: [document.body, host, section, ...section.children].map(nodeInfo), rules, sheets,
            fontFaces: [...document.fonts].map(f => ({family:f.family, status:f.status})) };
    });
    const dir = 'C:/Users/zhuagenbao/AppData/Local/Temp/BoardGame-qidahen-annual-20261030/r132-text-diagnostic';
    mkdirSync(dir,{recursive:true}); writeFileSync(resolve(dir,'computed-text.json'),JSON.stringify(result,null,2));
    await page.screenshot({path:resolve(dir,'equivalent-markup-private.png')});
    console.log('TEXT_DIAGNOSTIC', JSON.stringify(result.nodes));
    const moduleReport = await page.evaluate(async () => {
        document.querySelector('#private-text-diagnostic')?.remove();
        const sequencePath = '/src/games/qidahen/ui/QidahenBattleRollSequence.tsx';
        const source = await (await fetch(sequencePath)).text();
        const reactPath = source.match(/from\s+["']([^"']*\/react\.js[^"']*)["']/)?.[1];
        const clientPath = performance.getEntriesByType('resource').map(e => e.name).find(n => n.includes('/react-dom_client.js'));
        if (!reactPath || !clientPath) throw new Error('Exact current module imports unavailable: '+JSON.stringify({reactPath,clientPath,head:source.slice(0,800)}));
        const ReactModule = await import(reactPath); const React = ReactModule.default ?? ReactModule;
        const ClientModule = await import(clientPath); const Client = ClientModule.default ?? ClientModule;
        const { QidahenBattleRollSequence } = await import(sequencePath);
        const host = document.createElement('div'); host.id = 'private-real-sequence-diagnostic';
        host.className = 'pointer-events-none fixed z-[170] [--spacing:4px]';
        Object.assign(host.style, { left: '620px', top: '360px', width: '620px', height: '370px' }); document.body.append(host);
        Client.createRoot(host).render(React.createElement(QidahenBattleRollSequence, { sourceName:'辽北',targetName:'叶赫部',attacker:{name:'大明'},defender:{name:'蒙古'},onComplete:()=>{},rolls:{stages:[{phase:'infantry',attackerRolls:[{dieSides:10,raw:10,value:10}],defenderRolls:[{dieSides:10,raw:6,value:6}],attackerTotal:10,defenderTotal:6,attackerDamage:3,defenderDamage:2}]}}));
        return {reactPath,clientPath};
    });
    await expect(page.getByTestId('qidahen-battle-roll-sequence')).toHaveAttribute('data-battle-roll-state','damage',{timeout:45000});
    const live = await page.evaluate(() => {
        const panel = document.querySelector('[data-testid="qidahen-battle-roll-sequence"]')!;
        return [panel,...panel.querySelectorAll('div,canvas')].map(el => {
            const s=getComputedStyle(el); const r=el.getBoundingClientRect();
            return {tag:el.tagName, id:el.getAttribute('data-testid'),text:el.children.length===0?el.textContent:undefined,className:el.className,color:s.color,webkitTextFillColor:s.webkitTextFillColor,font:s.font,visibility:s.visibility,opacity:s.opacity,position:s.position,zIndex:s.zIndex,background:s.backgroundColor,overflow:s.overflow,rect:{x:r.x,y:r.y,width:r.width,height:r.height}};
        });
    });
    writeFileSync(resolve(dir,'actual-sequence-computed.json'),JSON.stringify({moduleReport,live},null,2));
    const cdp=await page.context().newCDPSession(page);
    const pixels=await cdp.send('Page.captureScreenshot',{format:'jpeg',quality:85,fromSurface:true});
    writeFileSync(resolve(dir,'actual-sequence-cdp-private.jpg'),Buffer.from(pixels.data,'base64'));
    await cdp.detach();
    await page.screenshot({path:resolve(dir,'actual-sequence-damage-private.png')});
});
