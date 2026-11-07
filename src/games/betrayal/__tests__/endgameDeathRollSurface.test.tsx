/* @vitest-environment happy-dom */
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import i18next from 'i18next';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import gameLocale from '../../../../public/locales/zh-CN/game-betrayal.json';
import commonLocale from '../../../../public/locales/zh-CN/common.json';
import englishGameLocale from '../../../../public/locales/en/game-betrayal.json';
import englishCommonLocale from '../../../../public/locales/en/common.json';
import { EndgameScreen } from '../endgameScreen';
import { playMummyScenarioToTraitorVictory } from '../testing/firstScenarioTestUtils';
import type { BetrayalCore } from '../game';

vi.mock('../../../components/common/media/OptimizedImage', () => ({
  OptimizedImage: ({ src, alt }: React.ImgHTMLAttributes<HTMLImageElement>) => <img alt={alt} data-src={src} />,
}));

afterEach(cleanup);

async function renderEndgame(core: BetrayalCore, language: 'zh-CN' | 'en' = 'zh-CN') {
  const i18n = i18next.createInstance();
  await i18n.use(initReactI18next).init({
    lng: language, fallbackLng: language, defaultNS: 'game-betrayal',
    resources: {
      'zh-CN': { 'game-betrayal': gameLocale, common: commonLocale },
      en: { 'game-betrayal': englishGameLocale, common: englishCommonLocale },
    },
    interpolation: { escapeValue: false },
  });
  return render(<I18nextProvider i18n={i18n}><MemoryRouter><EndgameScreen core={core} effectiveLocale={language} /></MemoryRouter></I18nextProvider>);
}

function endgameWithDeathRoll(): BetrayalCore {
  const core = playMummyScenarioToTraitorVictory();
  const explorer = core.currentExplorer;
  explorer.displayName = '测试英雄';
  core.scenarioRuntime.deadExplorerPlayerIds = [explorer.playerId];
  core.recentRoll = {
    id: 'death-review', kind: 'deathPrevention', playerId: explorer.playerId,
    sourceTitle: '头骨死亡保护', dice: [0, 1, 1], passiveBonus: 0,
    latestLabel: '正常死亡', consumedRabbitFootCardIds: ['rope'],
    lastRabbitFootRerollPreviousDice: [2, 0, 0],
    deathPrevention: { minTotal: 4 },
  } as BetrayalCore['recentRoll'];
  return core;
}

describe('结局死亡骰卡片', () => {
  it('终局挂载时隐藏门户 HUD，卸载时恢复', async () => {
    const view = await renderEndgame(endgameWithDeathRoll());
    expect(document.documentElement).toHaveAttribute('data-betrayal-endgame', 'true');
    view.unmount();
    expect(document.documentElement).not.toHaveAttribute('data-betrayal-endgame');
  });

  it('以真实中文文案显示玩家、骰子和非因果提示，并可继续查看报告', async () => {
    await renderEndgame(endgameWithDeathRoll());
    const card = screen.getByTestId('betrayal-endgame-recent-death-roll');
    expect(card).toHaveTextContent('测试英雄 最近保留的死亡检定');
    expect(card).toHaveTextContent('此检定不一定与本局胜利直接相关');
    expect(card).toHaveTextContent('重投前: 2 · 0 · 0');
    expect(card).toHaveTextContent('重投后: 0 · 1 · 1');
    expect(card).toHaveTextContent('总计 2，阻止死亡需 4');
    expect(within(card).queryByText(/board\.endgame\./)).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('betrayal-endgame-ending-continue'));
    expect(screen.getByTestId('betrayal-endgame-result-report')).toBeInTheDocument();
  });

  it('没有死亡骰时不显示卡片', async () => {
    const core = endgameWithDeathRoll();
    core.recentRoll = null;
    await renderEndgame(core);
    expect(screen.queryByTestId('betrayal-endgame-recent-death-roll')).not.toBeInTheDocument();
  });

  it('英文资源插值完整显示长连续玩家名与门槛，不显示翻译键', async () => {
    const core = endgameWithDeathRoll();
    const longName = 'AnExceptionallyLongUnbrokenExplorerNameForDisplay';
    core.currentExplorer.displayName = longName;
    await renderEndgame(core, 'en');
    const card = screen.getByTestId('betrayal-endgame-recent-death-roll');
    expect(card).toHaveTextContent(`${longName}: most recent retained death check`);
    expect(card).toHaveTextContent('This check may not have caused the victory');
    expect(card).toHaveTextContent('Before reroll: 2 · 0 · 0');
    expect(card).toHaveTextContent('After reroll: 0 · 1 · 1');
    expect(card).toHaveTextContent('Total 2; 4 needed to prevent death');
    expect(card).not.toHaveTextContent('board.endgame.');
    expect(card).not.toHaveTextContent('{{');
  });

  it('英雄胜利时不显示卡片', async () => {
    const core = endgameWithDeathRoll();
    core.endgameResult!.outcome = 'survivors';
    await renderEndgame(core);
    expect(screen.queryByTestId('betrayal-endgame-recent-death-roll')).not.toBeInTheDocument();
  });
});
