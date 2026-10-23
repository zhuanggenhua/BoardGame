import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = import.meta.dirname;
const html = readFileSync(path.join(root, 'index-v6.html'), 'utf8');
const tokens = path.join(root, 'assets', 'tokens');
const assets = path.join(root, 'assets');

describe('Fate/Domination Open Design v6 layout contract', () => {
  it('drops topbar and utility orb, keeps v6 table language', () => {
    expect(html).not.toContain('class="topbar"');
    expect(html).not.toContain('class="top-seats"');
    expect(html).not.toContain('class="utility-orb"');
    expect(html).not.toContain('card-meta');
    expect(html).not.toContain('基础威力 18');
    expect(html).not.toContain('18/03M');
    expect(html).toContain('class="phase-orb"');
    expect(html).toContain('class="you-stamp"');
    expect(html).toContain('冬木市圣杯战争');
    expect(html).toContain('浑身の一撃');
    expect(html).toContain('消耗 0 魔力，基本威力 4');
    expect(html).toContain('消耗 3 魔力，基本威力 3');
  });

  it('restores the original next-phase control and centers the map with a left pile gutter', () => {
    expect(html).toContain('.map-stage { position: absolute; inset: 0; z-index: 1; }');
    expect(html).not.toContain('inset: 0 214px 390px 0');
    expect(html).toContain('.phase-control { position: absolute; right: 0; bottom: -2px;');
    expect(html).toContain('下一阶段');
    expect(html).toContain('PHASE 04');
    expect(html).not.toContain('right: 226px');
    expect(html).not.toContain('.phase-copy { display: none; }');
    expect(html).toContain('const PILE_GUTTER = 214');
    expect(html).toContain('tx = inset.left + (availW - usedW) / 2 + PILE_GUTTER * scale');
    expect(html).toContain('ty = inset.top + (availH - usedH) / 2');
    expect(html).not.toContain('tx = inset.left;');
  });

  it('splits hands, docks stacked command-seal cards, and puts opponents on the right rail', () => {
    expect(html).toContain('class="attack-hand"');
    expect(html).toContain('class="skill-hand"');
    expect(html).toContain('class="command-seals"');
    expect(html).toContain('class="self-piles"');
    expect(html).toContain('class="opp-rail"');
    expect(html).toContain('class="opp-avatars"');
    expect(html).toContain('class="opp-master-token"');
    expect(html).toContain('class="opp-servant-token"');
    expect(html).toContain('border-radius: 50%');
    expect(html).not.toContain('class="opp-servant"');
    expect(html).not.toContain('height: 82px');
    expect(html).toContain('id="side-inspect"');
    expect(html).toContain('id="opp-skills"');
    expect(html).not.toContain('class="hover-peek"');
    expect(html).not.toContain('id="opp-skill"');
    expect(html).toContain('class="map-viewport"');
    expect(html).toContain('pile-events { left: -6.4%; top: 16.5%; }');
    expect(html).toContain('pile-miyama { left: -6.4%; top: 49.5%; }');
    expect(html).toContain('pile-shinto { left: -6.4%; top: 80.8%; }');
    expect(html).toContain('event-miyama-1 { left: 25.5%; top: 50.5%;');
    expect(html).toContain('event-shinto-2 { left: 44.75%; top: 82.0%; width: 12.2%; }');
    expect(html).toContain('class="map-card event-slot event-miyama-1"');
    expect(html).toContain('class="map-card pile-events"');
    expect(html).toContain('assets/event-back.webp');
    expect(html).not.toContain('pile-miyama { left: 22.6%;');
    expect(html).not.toContain('class="opp-played"');
    expect(html).not.toContain('data-opp-played="shinji"');
    expect(html).not.toContain('class="opp-played-row"');
    expect(html).toContain('id="opp-played-left"');
    expect(html).toContain("['assets/attack-magic-mid.webp', '中位魔术', 'attack-magic-mid']");
    expect(html).toContain("['assets/attack-magic-high.webp', '高位魔术', 'attack-magic-high']");
    expect(html).not.toMatch(/kirei:[\s\S]{0,400}skill-moment\.webp/);
    expect(html).not.toMatch(/kirei:[\s\S]{0,400}skill-luck\.webp/);
    expect(html).not.toContain('class="hand-row"');
    expect(html).toContain('.attack-hand {\n      position: absolute;\n      left: 236px;');
    expect(html).toContain('.skill-hand {\n      position: absolute;\n      right: 118px;');
    expect(html).toContain('grid-auto-flow: row');
    expect(html).toContain('--card-gap: 12px');
    expect(html).not.toContain('--card-overlap');
    expect(html).not.toContain('--card-peek');
    expect(html).toContain('white-space: nowrap');
    expect(html).not.toContain('.opp-copy b { display: block;');
    expect(html).toContain('piece-shirou { left: 59.99%; top: 14.03%; }');
    expect(html).toContain('piece-shinji { left: 70.52%; top: 46.14%; }');
    expect(html).toContain('piece-kirei { left: 70.47%; top: 78.03%; }');
    expect(html).toContain('piece-rin { left: 11.05%; top: 81.26%; }');
    expect(html).toContain('transform: translate(-50%, -50%)');
    expect(html).toContain('object-fit: cover');
    expect(html).not.toContain('object-fit: fill');
    expect(html).toContain('间桐慎二');
    expect(html).toContain('言峰绮礼');
    expect(html).toContain('远坂凛');
    expect(html).toContain('卫宫士郎');
    expect(html).toContain('assets/tokens/token-matou-shinji.png');
    expect(html).toContain('assets/tokens/token-kotomine-kirei.png');
    expect(html).toContain('assets/tokens/token-tohsaka-rin.png');
    expect(html).toContain('assets/tokens/token-emiya-shirou.png');
    expect(html).toContain('assets/command-seal-shirou.png');
    expect(html).not.toContain('assets/seals/seal-branch.png');
    expect(html).not.toContain('待补图');
    expect(html).not.toContain('asset-missing');
  });

  it('uses three Saber skills, formal card backs, and click-to-play attack zone', () => {
    expect(html).toContain('对魔力');
    expect(html).toContain('风王结界');
    expect(html).toContain('誓约胜利之剑');
    expect(html).toContain('assets/skill-magic-resistance.png');
    expect(html).toContain('assets/skill-invisible-air.png');
    expect(html).toContain('assets/skill-excalibur-artoria.png');
    const skillHand = html.match(/class="skill-hand"[\s\S]*?<\/section>/)?.[0] ?? '';
    expect(skillHand).toContain('对魔力');
    expect(skillHand).toContain('风王结界');
    expect(skillHand).toContain('誓约胜利之剑');
    expect(skillHand).not.toContain('干将·莫邪');
    expect(skillHand).not.toContain('都牟刈村正');
    expect(html).toContain('投影：将干将·莫邪加入技能区');
    expect(html).not.toContain('都牟刈村正');
    expect(html).toContain('assets/back-skill-red.png');
    expect(html).toContain('assets/back-attack-blue.png');
    expect(html).toContain('assets/back-servant-gold.png');
    expect(html).toContain('class="attack-zone"');
    expect(html).toContain('合计威力');
    expect(html).toContain('const withdrawAttack');
    expect(html).toContain('const playAttack');
    expect(html).toContain('id="opp-played-left"');
    expect(html).toContain('const openOpp');
    expect(html).toContain('const placeOppPlayedLeft');
    expect(html).not.toContain('id="opp-played"');
    expect(html).not.toContain('data-opp-played');
    expect(html).not.toContain('class="attack-slot"');
  });

  it('requires circular master tokens, Saber skills, backs and command-seal cards on disk', () => {
    const requiredTokens = [
      'token-matou-shinji.png',
      'token-kotomine-kirei.png',
      'token-tohsaka-rin.png',
      'token-emiya-shirou.png',
    ];
    for (const file of requiredTokens) {
      expect(existsSync(path.join(tokens, file)), file).toBe(true);
    }
    const requiredAssets = [
      'skill-magic-resistance.png',
      'skill-invisible-air.png',
      'skill-excalibur-artoria.png',
      'back-skill-red.png',
      'back-attack-blue.png',
      'back-servant-gold.png',
      'command-seal-shirou.png',
    ];
    for (const file of requiredAssets) {
      expect(existsSync(path.join(assets, file)), file).toBe(true);
    }
  });
});
