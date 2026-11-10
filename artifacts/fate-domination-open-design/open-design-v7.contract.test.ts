import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = import.meta.dirname;
const html = readFileSync(path.join(root, 'index-v7.html'), 'utf8');
const v7 = path.join(root, 'assets', 'v7');

describe('Fate/Domination Open Design v7 contract', () => {
  it('locks CHM printed board, Chinese zones, play chain, and private/public split', () => {
    expect(html).toContain('assets/v7/board-fuyuki.png');
    expect(html).toContain('局势库');
    expect(html).toContain('局势');
    expect(html).toContain('事件库');
    expect(html).toContain('深山事件');
    expect(html).toContain('新都事件');
    expect(html).toContain('工房');
    expect(html).toContain('深山町');
    expect(html).toContain('新都');
    expect(html).toContain('侦察');
    expect(html).toContain('战果');
    expect(html).toContain('从者未公开');
    expect(html).toContain('结束行动');
    expect(html).toContain('white-space: nowrap');
    expect(html).toContain('id="slot-1"');
    expect(html).toContain('id="slot-2"');
    expect(html).toContain('alt="局势 转机"');
    expect(html).toContain('alt="深山事件 强度测验"');
    expect(html).toContain('alt="深山事件 命运之战"');
    expect(html).toContain('交战');
    const body = html.slice(html.indexOf('<body>'));
    expect(body.indexOf('class="hand-col"')).toBeLessThan(body.indexOf('class="atk-col"'));
    expect(html).not.toContain('待补图');
    expect(html).not.toContain('GRID');
    expect(html).not.toContain('Objectives');
    expect(html).not.toContain('Events/Objectives');
  });

  it('requires first-batch visible-subject files on disk', () => {
    const required = [
      'board-fuyuki.png',
      'situation-turning.png',
      'event-fate-battle.png',
      'event-strength-test.png',
      'event-suppression.png',
      'event-sanctuary.png',
      'master-shirou.png',
      'servant-arturia.png',
      'master-rin.png',
      'master-kirei.png',
      'master-shinji.png',
      'skill-excalibur.png',
      'skill-luck.png',
      'skill-kanshou.png',
      'attack-strength.webp',
      'attack-magic.webp',
      'attack-agility.webp',
    ];
    for (const file of required) {
      expect(existsSync(path.join(v7, file)), file).toBe(true);
    }
  });
});
