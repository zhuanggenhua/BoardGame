import { render, screen, cleanup } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { GameDetailsChangelogSection, changelogTitleIncludesVersion } from '../GameDetailsChangelogSection';
const load = vi.hoisted(() => vi.fn());
vi.mock('../../../api/game-changelogs', () => ({getGameChangelogs:load}));
vi.mock('react-i18next', () => ({useTranslation:()=>({t:(key:string)=>key,i18n:{language:'zh-CN'}})}));
afterEach(cleanup);
it('标题已含版本时只显示一次，日期仍在', async () => {
 load.mockResolvedValue([{id:'one',title:'王权骰铸 0.6.12：伤害修复',versionLabel:'0.6.12',content:'修复响应',publishedAt:'2026-07-18T00:00:00Z'}]);
 const {container}=render(<GameDetailsChangelogSection gameId="dicethrone"/>);
 await screen.findByRole('heading',{name:'王权骰铸 0.6.12：伤害修复'});
 expect(screen.queryByText('0.6.12',{exact:true})).toBeNull();
 expect(container.querySelector('.game-changelog-date')).toBeTruthy();
});
it('标题未含版本时保留结构化版本徽标', async () => {
 load.mockResolvedValue([{id:'two',title:'伤害修复',versionLabel:'0.6.12',content:'修复响应',publishedAt:'2026-07-18T00:00:00Z'}]);
 render(<GameDetailsChangelogSection gameId="dicethrone"/>);
 expect(await screen.findByText('0.6.12',{exact:true})).toBeTruthy();
});
it('版本边界不把短版本误匹配为较长版本，兼容常见前缀', () => {
 expect(changelogTitleIncludesVersion('版本0.6.12更新','0.6.1')).toBe(false);
 expect(changelogTitleIncludesVersion('版本0.6.12更新','v0.6.12')).toBe(true);
 expect(changelogTitleIncludesVersion('更新 V0.6.12','0.6.12')).toBe(true);
 expect(changelogTitleIncludesVersion('更新','')).toBe(false);
});
