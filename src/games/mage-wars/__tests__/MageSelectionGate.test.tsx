import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CSSProperties } from 'react';
import { MageWarsMageSelectionGate } from '../ui/MageSelectionGate';
import { resolveMageWarsLocalSetup } from '../runtimeAdapter';
import { MAGE_WARS_SAVED_SPELLBOOKS_STORAGE_KEY } from '../domain/savedSpellbooks';
import { getMageWarsDefaultSpellbookEntries } from '../roomSetup';

vi.mock('react-i18next', () => ({
    initReactI18next: { type: '3rdParty', init: vi.fn() },
    useTranslation: () => ({
        i18n: { language: 'zh-CN' },
        t: (key: string, params?: Record<string, string | number>) => {
            const labels: Record<string, string> = {
                'setup.mageSelection.eyebrow': '标准起始法术书',
                'setup.mageSelection.title': '选择双方学徒法师',
                'setup.mageSelection.description': '每个席位选择一名法师。确认后初始化开局。',
                'setup.mageSelection.confirm': '确认角色并开始',
                'setup.mageSelection.seats': '席位',
                'setup.mageSelection.mageGrid': '可选法师',
                'setup.mageSelection.summary': '开局摘要',
                'setup.mageSelection.spellbookLibrary': '法术书库',
                'setup.mageSelection.activeSpellbookAria': '所选法师的法术书库',
                'setup.mageSelection.activeSpellbookTitle': '所选法师法术书',
                'setup.mageSelection.editCurrentSpellbook': '编辑选中书',
                'setup.mageSelection.spellbookLibraryHelp': '标准起始书和命名副本在同一库里；新书从选中书另存命名副本。',
                'setup.mageSelection.standardSpellbook': '标准起始书',
                'setup.mageSelection.activeSpellbookStatus': '已使用',
                'setup.mageSelection.inactiveSpellbookStatus': '点击使用',
                'setup.mageSelection.editAndSaveCopy': '编辑并另存',
                'setup.mageSelection.noNamedCopies': '暂无命名副本',
                'setup.mageSelection.edit': '编辑',
                'setup.mageSelection.delete': '删除',
                'setup.seat0Mage.label': 'P1 法师',
                'setup.seat1Mage.label': 'P2 法师',
                'spellbookBuilder.eyebrow': '法师战争 / 法术书构筑器',
                'spellbookBuilder.title': '法术书构筑',
                'spellbookBuilder.mageContextAria': '{{mage}}，查看法师规则卡',
                'spellbookBuilder.viewMageAbilityCard': '点击查看能力牌',
                'spellbookBuilder.libraryAria': '法术书库',
                'spellbookBuilder.libraryTitle': '法术书库',
                'spellbookBuilder.libraryDescription': '标准起始书和命名副本同级；新书从选中书保存命名副本',
                'spellbookBuilder.importList': '导入列表',
                'spellbookBuilder.savedListAria': '法术书库列表',
                'spellbookBuilder.standardSpellbook': '标准起始书',
                'spellbookBuilder.noNamedCopies': '暂无命名副本',
                'spellbookBuilder.saveNameLabel': '法术书名称',
                'spellbookBuilder.saveNamePlaceholder': '命名副本名称',
                'spellbookBuilder.saveAsNew': '保存命名副本',
                'spellbookBuilder.updateSaved': '更新选中副本',
                'spellbookBuilder.capacityAria': '法术书容量与构筑限制',
                'spellbookBuilder.abilityCardLimit': '能力牌上限',
                'spellbookBuilder.currentCompositionLabel': '书内构成',
                'spellbookBuilder.poolAria': '法术牌库',
                'spellbookBuilder.poolTitle': '法术牌库',
                'spellbookBuilder.poolDescription': '点卡牌加入；数量和移除在右侧清单处理',
                'spellbookBuilder.filterAria': '法术筛选',
                'spellbookBuilder.searchPlaceholder': '搜索法术',
                'spellbookBuilder.searchAria': '搜索法术',
                'spellbookBuilder.typeFilterAria': '类型筛选',
                'spellbookBuilder.schoolFilterAria': '学派筛选',
                'spellbookBuilder.schoolAll': '学派 / 系：全部',
                'spellbookBuilder.levelFilterAria': '等级筛选',
                'spellbookBuilder.statusFilterAria': '状态筛选',
                'spellbookBuilder.cardStatusRestricted': '不可加入',
                'spellbookBuilder.cardStatusAtLimit': '已达上限；先从清单移除',
                'spellbookBuilder.cardStatusInBook': '已在书内',
                'spellbookBuilder.cardStatusAdd': '加入',
                'spellbookBuilder.currentListAria': '法术书清单',
                'spellbookBuilder.currentListTitle': '法术书清单',
                'spellbookBuilder.currentListDescription': '真实缩略、数量上限与本条占用',
                'spellbookBuilder.scrollWholeBook': '滚动查看整本书',
                'spellbookBuilder.back': '返回',
                'spellbookBuilder.confirm': '确认法术书',
                'spellbookBuilder.mageDetailAria': '法师规则卡',
                'spellbookBuilder.mageDetailDescription': '这份构筑按这张法师能力牌的训练方向计算。需要更换法师时，返回选角页先选择法师。',
                'spellbookBuilder.trainedDirection': '受训方向',
                'spellbookBuilder.opposedDirection': '相斥方向',
                'spellbookBuilder.currentListLabel': '法术书清单',
                'spellbookBuilder.none': '无',
                'spellbookBuilder.close': '关闭',
            };
            if (key === 'setup.mageSelection.spellbookCardSummary') return `${params?.count} 张 · ${params?.status}`;
            if (key === 'setup.mageSelection.spellbookCount') return `法术书 ${params?.count}`;
            if (key === 'setup.mageSelection.summaryLine') return `法术书 ${params?.spellbook} 张`;
            if (key === 'spellbookBuilder.standardPresetSummary') return `${params?.count}张 · 规则书预设`;
            if (key === 'spellbookBuilder.savedCopySummary') return `${params?.count}张 · 命名副本`;
            if (key === 'spellbookBuilder.loadSavedAria') return `载入 ${params?.name}`;
            if (key === 'spellbookBuilder.deleteSavedAria') return `删除 ${params?.name}`;
            if (key === 'spellbookBuilder.pointsUsed') return `法术点 ${params?.used} / ${params?.limit}`;
            if (key === 'spellbookBuilder.currentComposition') return `${params?.cards} 张 / ${params?.entries} 条`;
            if (key === 'spellbookBuilder.filteredCount') return `${params?.filtered} / ${params?.total} 张`;
            if (key === 'spellbookBuilder.cardStatusPointBlocked') return `需 ${params?.points} 点；先腾出容量`;
            if (key === 'spellbookBuilder.cardTitle') return `${params?.name}：${params?.status}`;
            if (key === 'spellbookBuilder.cardAria') return `${params?.name}，${params?.status}`;
            if (key === 'spellbookBuilder.visibleRange') return `显示 ${params?.range} / ${params?.total} 条`;
            if (key === 'spellbookBuilder.schoolTrainingSummary') return `${params?.schools} · ${params?.training}`;
            if (key === 'spellbookBuilder.pointsCompact') return `${params?.points}点`;
            if (key === 'spellbookBuilder.removeCardAria') return `移除 ${params?.name}`;
            if (key === 'spellbookBuilder.addCardAria') return `加入 ${params?.name}`;
            if (key === 'spellbookBuilder.status.saved') return `已保存 ${params?.name}`;
            if (key === 'spellbookBuilder.status.updated') return `已更新 ${params?.name}`;
            if (key === 'spellbookBuilder.status.loadedSaved') return `已载入 ${params?.name}`;
            if (key === 'spellbookBuilder.status.deleted') return `已删除 ${params?.name}`;
            return labels[key]?.replace(/\{\{(\w+)\}\}/g, (_, token: string) => String(params?.[token] ?? '')) ?? key;
        },
    }),
}));

vi.mock('../../../components/common/media/CardPreview', () => ({
    CardPreview: ({
        className,
        style,
        title,
    }: {
        className?: string;
        style?: CSSProperties;
        title?: string;
    }) => (
        <div
            data-testid="mock-card-preview"
            data-card-atlas-frame="true"
            data-card-atlas-aspect-ratio={String(style?.aspectRatio ?? '')}
            data-card-title={title ?? ''}
            className={className}
            style={style}
        />
    ),
}));

vi.mock('../../../components/common/media/OptimizedImage', () => ({
    OptimizedImage: ({
        className,
        style,
        alt,
        title,
        ...rest
    }: {
        className?: string;
        style?: CSSProperties;
        alt?: string;
        title?: string;
    }) => (
        <img
            data-testid="mock-optimized-image"
            className={className}
            style={style}
            alt={alt ?? ''}
            title={title}
            {...rest}
        />
    ),
}));

function renderGate(onConfirm = vi.fn()) {
    render(
        <MageWarsMageSelectionGate
            mode="local"
            searchParams={new URLSearchParams()}
            initialSetup={resolveMageWarsLocalSetup({ searchParams: new URLSearchParams() })}
            onConfirm={onConfirm}
        />,
    );
    return onConfirm;
}

function countText(root: HTMLElement, pattern: RegExp): number {
    return Array.from((root.textContent ?? '').matchAll(pattern)).length;
}

describe('MageWarsMageSelectionGate spellbook builder', () => {
    beforeEach(() => {
        window.localStorage.clear();
    });

    it('opens a standard-based spellbook library without seat, detail, xN, blank, or duplicate overall capacity owners', () => {
        renderGate();

        fireEvent.click(screen.getByTestId('mage-wars-open-spellbook-builder'));

        const builder = screen.getByTestId('mage-wars-spellbook-builder');
        expect(builder).toBeVisible();
        expect(within(builder).getByText('法术书构筑')).toBeInTheDocument();
        expect(within(builder).getByTestId('mage-wars-spellbook-builder-filter-type')).toBeInTheDocument();
        expect(within(builder).getByTestId('mage-wars-spellbook-builder-filter-school')).toBeInTheDocument();
        expect(within(builder).getByTestId('mage-wars-spellbook-builder-filter-level')).toBeInTheDocument();
        expect(within(builder).getByTestId('mage-wars-spellbook-builder-filter-legality')).toBeInTheDocument();

        expect(builder.textContent).not.toMatch(/席位|\bP1\b|\bP2\b|xN|兽王标准书|当前法师：|当前法术书|当前法师法术书库|编辑当前书|更新当前副本|给当前书取名|新书从当前书|当前书内|详情|缺图|DIY 法术书|空白自组|还没有 DIY/u);
        expect(countText(builder, /法术点/g)).toBe(1);
        expect(countText(builder, /120\s*\/\s*120/g)).toBe(1);
        expect(countText(builder, /兽王/g)).toBeLessThanOrEqual(1);
        expect(builder.querySelectorAll('.mage-context[data-mage-detail-open]').length).toBe(1);
        expect(builder.querySelectorAll('[data-testid^="mage-wars-spellbook-builder-mage-option-"]').length).toBe(0);
        expect(builder.querySelector('.mage-detail-trigger')).toBeNull();
        expect(builder.querySelector('[data-testid="mage-wars-spellbook-builder-blank"]')).toBeNull();
        expect(within(builder).getByTestId('mage-wars-spellbook-builder-save-name')).toBeInTheDocument();
        expect(within(builder).getByTestId('mage-wars-spellbook-builder-save-new')).toBeInTheDocument();
        expect(within(builder).getByTestId('mage-wars-spellbook-builder-saved-list')).toHaveTextContent('标准起始书');
        expect(within(builder).getByTestId('mage-wars-spellbook-builder-saved-list')).toHaveTextContent('暂无命名副本');
        expect(within(builder).getByTestId('mage-wars-spellbook-builder-standard')).toHaveAttribute('data-active', 'true');

        const deckRows = within(builder).getAllByTestId('mage-wars-spellbook-builder-deck-row');
        expect(deckRows.length).toBeGreaterThan(20);
        for (const row of deckRows.slice(0, 8)) {
            expect(
                row.querySelector('[data-card-atlas-frame="true"], img[data-card-fallback]'),
            ).not.toBeNull();
            expect(row.textContent).toMatch(/\d+\s*\/\s*\d+/u);
            expect(row.textContent).toMatch(/\d+点/u);
        }
    });

    it('uses the active mage itself to open rule-card details', () => {
        renderGate();

        fireEvent.click(screen.getByTestId('mage-wars-open-spellbook-builder'));
        const builder = screen.getByTestId('mage-wars-spellbook-builder');
        fireEvent.click(within(builder).getByTestId('mage-wars-spellbook-builder-mage-context'));

        const detail = within(builder).getByTestId('mage-wars-spellbook-builder-mage-detail');
        expect(detail).toBeVisible();
        expect(within(detail).getByTestId('mock-card-preview')).toHaveAttribute('data-card-title', '兽王');
        expect(detail).toHaveTextContent('受训方向');
        expect(detail).toHaveTextContent('相斥方向');
    });

    it('saves a named spellbook copy from the selected mage standard spellbook and sends it into setupData', () => {
        const onConfirm = renderGate();

        fireEvent.click(screen.getByTestId('mage-wars-open-spellbook-builder'));
        const builder = screen.getByTestId('mage-wars-spellbook-builder');
        fireEvent.change(within(builder).getByTestId('mage-wars-spellbook-builder-save-name'), {
            target: { value: '兽王标准命名书' },
        });
        fireEvent.click(within(builder).getByTestId('mage-wars-spellbook-builder-save-new'));

        const standardEntries = getMageWarsDefaultSpellbookEntries('beastmaster_apprentice');
        const stored = JSON.parse(window.localStorage.getItem(MAGE_WARS_SAVED_SPELLBOOKS_STORAGE_KEY) ?? '[]');
        expect(stored).toHaveLength(1);
        expect(stored[0]).toMatchObject({
            mageId: 'beastmaster_apprentice',
            name: '兽王标准命名书',
        });
        expect(stored[0].entries).toHaveLength(standardEntries.length);
        expect(stored[0].entries.reduce((total: number, entry: { count: number }) => total + entry.count, 0)).toBe(67);
        expect(stored[0].entries).toContainEqual({ spellCardId: 2906, count: 2 });
        expect(within(builder).getByTestId('mage-wars-spellbook-builder-save-status')).toHaveTextContent('已保存 兽王标准命名书');
        expect(within(builder).getByTestId('mage-wars-spellbook-builder-saved-list')).toHaveTextContent('标准起始书');
        expect(within(builder).getByTestId('mage-wars-spellbook-builder-saved-spellbook')).toHaveTextContent('兽王标准命名书');
        expect(within(builder).getByTestId('mage-wars-spellbook-builder-update-saved')).toBeEnabled();

        fireEvent.click(within(builder).getByTestId('mage-wars-spellbook-builder-standard'));
        expect(within(builder).getAllByTestId('mage-wars-spellbook-builder-deck-row').length).toBeGreaterThan(20);
        fireEvent.click(within(builder).getByTestId('mage-wars-spellbook-builder-saved-spellbook'));
        const deckRows = within(builder).getAllByTestId('mage-wars-spellbook-builder-deck-row');
        expect(deckRows).toHaveLength(standardEntries.length);
        const lynxRow = deckRows.find((row) => row.getAttribute('data-source-card-id') === '2906');
        expect(lynxRow).toBeTruthy();
        expect(lynxRow).toHaveTextContent('2 / 6');

        fireEvent.click(within(builder).getByTestId('mage-wars-spellbook-builder-confirm'));
        expect(screen.getByTestId('mage-wars-mage-selection-saved-spellbook-list')).toHaveTextContent('标准起始书');
        expect(screen.getByTestId('mage-wars-mage-selection-saved-spellbook-list')).toHaveTextContent('兽王标准命名书');
        expect(screen.getByTestId('mage-wars-mage-selection-summary-0')).toHaveAttribute(
            'data-saved-spellbook-id',
            stored[0].id,
        );
        fireEvent.click(screen.getByTestId('mage-wars-mage-selection-confirm'));

        expect(onConfirm).toHaveBeenCalledTimes(1);
        const submittedEntries = onConfirm.mock.calls[0][0].setupData.mageWarsSeat0SpellbookEntries;
        expect(submittedEntries).toHaveLength(standardEntries.length);
        expect(submittedEntries).toContainEqual({ spellCardId: 2906, count: 2 });
    });

    it('keeps saved spellbooks scoped to the mage selected before opening the builder', () => {
        renderGate();

        fireEvent.click(screen.getByTestId('mage-wars-open-spellbook-builder'));
        let builder = screen.getByTestId('mage-wars-spellbook-builder');
        fireEvent.change(within(builder).getByTestId('mage-wars-spellbook-builder-save-name'), {
            target: { value: '兽王标准副本' },
        });
        fireEvent.click(within(builder).getByTestId('mage-wars-spellbook-builder-save-new'));
        fireEvent.click(within(builder).getByText('返回'));

        fireEvent.click(screen.getByTestId('mage-wars-mage-selection-card-priestess_apprentice'));
        fireEvent.click(screen.getByTestId('mage-wars-open-spellbook-builder'));
        builder = screen.getByTestId('mage-wars-spellbook-builder');

        expect(builder).toHaveAttribute('data-mage-id', 'priestess_apprentice');
        expect(within(builder).getByTestId('mage-wars-spellbook-builder-saved-list')).toHaveTextContent('标准起始书');
        expect(within(builder).getByTestId('mage-wars-spellbook-builder-saved-list')).not.toHaveTextContent('兽王标准副本');
        expect(within(builder).getByTestId('mage-wars-spellbook-builder-saved-list')).toHaveTextContent('暂无命名副本');
    });

    it('surfaces standard and named spellbooks on the same selection-page library for direct use, edit, and delete', () => {
        renderGate();

        fireEvent.click(screen.getByTestId('mage-wars-open-spellbook-builder'));
        let builder = screen.getByTestId('mage-wars-spellbook-builder');
        fireEvent.change(within(builder).getByTestId('mage-wars-spellbook-builder-save-name'), {
            target: { value: '兽王命名副本' },
        });
        fireEvent.click(within(builder).getByTestId('mage-wars-spellbook-builder-save-new'));
        fireEvent.click(within(builder).getByText('返回'));

        const stored = JSON.parse(window.localStorage.getItem(MAGE_WARS_SAVED_SPELLBOOKS_STORAGE_KEY) ?? '[]');
        const savedId = stored[0].id as string;
        const savedList = screen.getByTestId('mage-wars-mage-selection-saved-spellbook-list');
        expect(savedList).toHaveTextContent('标准起始书');
        expect(savedList).toHaveTextContent('兽王命名副本');
        expect(screen.getByTestId('mage-wars-mage-selection-summary-0')).toHaveAttribute('data-saved-spellbook-id', savedId);

        fireEvent.click(screen.getByTestId('mage-wars-mage-selection-card-priestess_apprentice'));
        fireEvent.click(screen.getByTestId('mage-wars-mage-selection-card-beastmaster_apprentice'));
        expect(screen.getByTestId('mage-wars-mage-selection-summary-0')).toHaveAttribute('data-saved-spellbook-id', '');
        expect(screen.getByTestId('mage-wars-mage-selection-standard-spellbook')).toHaveAttribute('data-active', 'true');
        fireEvent.click(within(savedList).getByTestId('mage-wars-mage-selection-use-saved-spellbook'));
        expect(screen.getByTestId('mage-wars-mage-selection-summary-0')).toHaveTextContent('法术书 67 张');
        expect(screen.getByTestId('mage-wars-mage-selection-summary-0')).toHaveAttribute('data-saved-spellbook-id', savedId);

        fireEvent.click(within(savedList).getByTestId('mage-wars-mage-selection-edit-saved-spellbook'));
        builder = screen.getByTestId('mage-wars-spellbook-builder');
        expect(within(builder).getByTestId('mage-wars-spellbook-builder-save-name')).toHaveValue('兽王命名副本');
        const lynxRow = builder.querySelector('[data-testid="mage-wars-spellbook-builder-deck-row"][data-source-card-id="2906"]') as HTMLElement;
        expect(lynxRow).toHaveTextContent('2 / 6');
        fireEvent.click(within(lynxRow).getByLabelText(/移除/u));
        expect(lynxRow).toHaveTextContent('1 / 6');
        fireEvent.change(within(builder).getByTestId('mage-wars-spellbook-builder-save-name'), {
            target: { value: '兽王命名更新书' },
        });
        fireEvent.click(within(builder).getByTestId('mage-wars-spellbook-builder-update-saved'));
        expect(within(builder).getByTestId('mage-wars-spellbook-builder-save-status')).toHaveTextContent('已更新 兽王命名更新书');
        fireEvent.click(within(builder).getByText('返回'));
        expect(savedList).toHaveTextContent('兽王命名更新书');
        expect(savedList).toHaveTextContent('66 张');

        fireEvent.click(within(savedList).getByTestId('mage-wars-mage-selection-delete-saved-spellbook'));
        expect(savedList).toHaveTextContent('标准起始书');
        expect(savedList).toHaveTextContent('暂无命名副本');
        expect(JSON.parse(window.localStorage.getItem(MAGE_WARS_SAVED_SPELLBOOKS_STORAGE_KEY) ?? '[]')).toEqual([]);
    });
});
