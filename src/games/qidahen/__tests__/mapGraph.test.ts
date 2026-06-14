import { describe, expect, it } from 'vitest';
import {
    buildQidahenRegionMaskColorMap,
    findQidahenRegionGraphEdge,
    getQidahenBoundaryTypeMeta,
    getQidahenDirectedPassage,
    getQidahenDirectedPassageBetween,
    getQidahenPrintedRegionIdsForRuntimeRegionId,
    getQidahenRuntimeRegionIdsForPrintedRegionId,
    getQidahenSharedPrintedRegionAudits,
    QIDAHEN_MASK_REGION_BY_ID,
    QIDAHEN_MASK_REGION_DEFINITIONS,
    QIDAHEN_PRINTED_REGION_GRAPH_EDGES,
    QIDAHEN_PRINTED_REGION_GRAPH_NODES,
    QIDAHEN_PRINTED_REGION_GRAPH_NODE_BY_ID,
    QIDAHEN_REGION_GRAPH_EDGES,
    QIDAHEN_REGION_GRAPH_NODE_BY_ID,
    QIDAHEN_REGION_GRAPH_NODES,
    QIDAHEN_RUNTIME_REGION_DEFINITIONS,
    QIDAHEN_RUNTIME_REGION_SOURCE_BY_ID,
    QIDAHEN_RUNTIME_REGION_SOURCE_DEFINITIONS,
    normalizeQidahenPassageId,
    parseQidahenRegionGraph,
    qidahenRegionColorKey,
    resolveQidahenRuntimeRegionIdFromPrintedRegionId,
} from '../ui/mapGraph';

describe('七大恨区域图谱运行时解析', () => {
    it('按无向区域对规范化通路 id', () => {
        expect(normalizeQidahenPassageId('song-jin', 'jinzhou')).toBe('jinzhou::song-jin');
    });

    it('解析工具保存的边界类型与战场宽度', () => {
        const graph = parseQidahenRegionGraph({
            boundaryTypes: [
                { id: 'plain', label: '平原', note: '战场宽度 3', travelCost: 1, battleWidth: 3 },
                { id: 'mountain', label: '山脉', note: '战场宽度 2', travelCost: 2, battleWidth: 2 },
            ],
            nodes: [
                { id: 'jinzhou', name: '锦州', center: { x: 774, y: 414 }, pixelCount: 13439 },
                { id: 'song-jin', name: '皮岛', center: { x: 732, y: 565 }, pixelCount: 13202 },
            ],
            edges: [
                {
                    id: 'jinzhou::song-jin',
                    from: 'jinzhou',
                    to: 'song-jin',
                    bidirectional: true,
                    boundaryType: 'mountain',
                    boundaryLabel: '山脉',
                    travelCost: 2,
                    battleWidth: 2,
                    ruleNote: '战场宽度 2',
                },
            ],
        });

        expect(graph.nodes).toHaveLength(2);
        expect(graph.edges).toHaveLength(1);
        expect(findQidahenRegionGraphEdge(graph.edges, 'song-jin', 'jinzhou')).toMatchObject({
            id: 'jinzhou::song-jin',
            boundaryType: 'mountain',
            travelCost: 2,
            battleWidth: 2,
            reverseBoundaryType: 'mountain',
            reverseTravelCost: 2,
            reverseBattleWidth: 2,
        });
    });

    it('支持方向型边界配置', () => {
        const graph = parseQidahenRegionGraph({
            boundaryTypes: [
                { id: 'plain', label: '平原', note: '战场宽度 3', travelCost: 1, battleWidth: 3 },
                { id: 'wall-convex', label: '攻入长城', note: '凸面战场宽度 1', travelCost: 1, battleWidth: 1 },
                { id: 'wall-flat', label: '出长城', note: '平面战场宽度 3', travelCost: 1, battleWidth: 3 },
            ],
            nodes: [
                { id: 'outside', name: '墙外', center: { x: 10, y: 10 }, pixelCount: 10 },
                { id: 'inside', name: '墙内', center: { x: 20, y: 20 }, pixelCount: 10 },
            ],
            edges: [
                {
                    id: 'outside::inside',
                    from: 'outside',
                    to: 'inside',
                    bidirectional: true,
                    boundaryType: 'wall-convex',
                    boundaryLabel: '攻入长城',
                    travelCost: 1,
                    battleWidth: 1,
                    ruleNote: '凸面战场宽度 1',
                    reverseBoundaryType: 'wall-flat',
                    reverseBoundaryLabel: '出长城',
                    reverseTravelCost: 1,
                    reverseBattleWidth: 3,
                    reverseRuleNote: '平面战场宽度 3',
                },
            ],
        });

        const edge = graph.edges[0];
        expect(getQidahenDirectedPassage(edge, 'outside', 'inside')).toMatchObject({
            boundaryType: 'wall-convex',
            travelCost: 1,
            battleWidth: 1,
        });
        expect(getQidahenDirectedPassage(edge, 'inside', 'outside')).toMatchObject({
            boundaryType: 'wall-flat',
            travelCost: 1,
            battleWidth: 3,
        });
    });

    it('从区域 mask 元数据建立颜色到区域 id 的映射', () => {
        const colorMap = buildQidahenRegionMaskColorMap({
            regions: [
                { id: 'jinzhou', color: '#d64c3a' },
                { id: 'song-jin', color: '#e4a93a' },
            ],
        });

        expect(colorMap[qidahenRegionColorKey(214, 76, 58)]).toBe('jinzhou');
        expect(colorMap[qidahenRegionColorKey(228, 169, 58)]).toBe('song-jin');
    });

    it('保留运行时默认边界类型元数据', () => {
        expect(getQidahenBoundaryTypeMeta('mountain')).toMatchObject({
            label: '山脉',
            travelCost: 2,
            battleWidth: 2,
        });
        expect(getQidahenBoundaryTypeMeta('coast')).toMatchObject({
            label: '海岸/水路',
            unitCap: 2,
        });
    });

    it('正式印刷图谱已从当前区域 mask 回填中心、面积和粗连线', () => {
        expect(QIDAHEN_PRINTED_REGION_GRAPH_NODES).toHaveLength(QIDAHEN_MASK_REGION_DEFINITIONS.length);
        expect(QIDAHEN_PRINTED_REGION_GRAPH_NODES.every((node) => node.center != null && node.pixelCount > 0)).toBe(true);
        expect(QIDAHEN_PRINTED_REGION_GRAPH_EDGES.length).toBeGreaterThanOrEqual(77);
        expect(QIDAHEN_PRINTED_REGION_GRAPH_NODE_BY_ID.get('city-region-21')).toMatchObject({
            name: '喀喇沁部',
            pixelCount: 12649,
        });
    });

    it('运行时图谱继续保留当前 33 区邻接与通路定义', () => {
        expect(QIDAHEN_REGION_GRAPH_NODES).toHaveLength(QIDAHEN_RUNTIME_REGION_SOURCE_DEFINITIONS.length);
        expect(QIDAHEN_REGION_GRAPH_NODES.every((node) => node.center != null && node.pixelCount > 0)).toBe(true);
        expect(QIDAHEN_REGION_GRAPH_EDGES.length).toBeGreaterThanOrEqual(77);
        expect(getQidahenDirectedPassageBetween('city-region-1', 'city-region-20')).not.toBeNull();
        expect(getQidahenDirectedPassageBetween('city-region-16', 'jinzhou')).toMatchObject({
            boundaryType: 'city',
            battleWidth: 1,
        });
    });

    it('已把当前高置信地图区名回写到图谱与 mask 元数据', () => {
        const graphNameById = new Map(QIDAHEN_PRINTED_REGION_GRAPH_NODES.map((node) => [node.id, node.name]));
        const maskNameById = new Map(QIDAHEN_MASK_REGION_DEFINITIONS.map((region) => [region.id, region.name]));

        for (const [regionId, expectedName] of [
            ['city-region-2', '外喀尔喀部'],
            ['city-region-3', '科尔沁部'],
            ['city-region-4', '乌喇部'],
            ['city-region-5', '辉发部'],
            ['city-region-6', '扎鲁特部'],
            ['city-region-7', '叶赫部'],
            ['city-region-8', '巴林部'],
            ['city-region-9', '哈达部'],
            ['city-region-10', '内喀尔喀部'],
            ['city-region-11', '长白'],
            ['city-region-13', '建州'],
            ['city-region-14', '察哈尔部'],
            ['city-region-15', '辽北'],
            ['city-region-16', '克什克腾部'],
            ['city-region-17', '奈曼部'],
            ['city-region-19', '敖汉部'],
            ['city-region-20', '土默特部'],
            ['city-region-21', '喀喇沁部'],
            ['city-region-24', '宣府'],
            ['city-region-26', '鄂尔多斯部'],
            ['city-region-27', '保定'],
            ['city-region-28', '顺天'],
            ['city-region-30', '山西'],
            ['city-region-31', '延绥'],
            ['city-region-32', '登莱'],
            ['city-region-33', '山东'],
        ] as const) {
            expect(graphNameById.get(regionId)).toBe(expectedName);
            expect(maskNameById.get(regionId)).toBe(expectedName);
        }
    });

    it('运行时区域定义与 runtime persisted 区域/图谱节点保持一一对应，并显式声明印刷区映射', () => {
        expect(QIDAHEN_RUNTIME_REGION_DEFINITIONS).toHaveLength(QIDAHEN_RUNTIME_REGION_SOURCE_DEFINITIONS.length);
        expect(QIDAHEN_RUNTIME_REGION_DEFINITIONS.map((region) => region.id).sort()).toEqual(
            QIDAHEN_RUNTIME_REGION_SOURCE_DEFINITIONS.map((region) => region.id).sort(),
        );

        for (const region of QIDAHEN_RUNTIME_REGION_DEFINITIONS) {
            const persistedRegion = QIDAHEN_RUNTIME_REGION_SOURCE_BY_ID.get(region.id);
            const graphNode = QIDAHEN_REGION_GRAPH_NODE_BY_ID.get(region.id);

            expect(persistedRegion, `${region.id} 缺少 persisted region`).toBeDefined();
            expect(graphNode, `${region.id} 缺少 graph node`).toBeDefined();
            expect(region.name).toBe(persistedRegion?.name);
            expect(graphNode?.name).toBe(persistedRegion?.name);
            expect(region.seed).toEqual(persistedRegion?.seed ?? null);
            expect(region.center).toEqual(graphNode?.center ?? graphNode?.seed ?? persistedRegion?.seed ?? null);
            expect(region.pixelCount).toBe(graphNode?.pixelCount ?? 0);
            expect(region.printedRegionIds.every((printedRegionId) => QIDAHEN_MASK_REGION_BY_ID.has(printedRegionId))).toBe(true);
        }

        expect(QIDAHEN_RUNTIME_REGION_DEFINITIONS.find((region) => region.id === 'city-region-20')?.printedRegionIds).toEqual([
            'city-region-20',
            'city-region-21',
        ]);
    });

    it('印刷区点击可解析到对应 runtime 区，并支持反查整个 runtime 的印刷区集合', () => {
        expect(getQidahenRuntimeRegionIdsForPrintedRegionId('city-region-21')).toEqual(['city-region-20']);
        expect(resolveQidahenRuntimeRegionIdFromPrintedRegionId('city-region-21')).toBe('city-region-20');
        expect(getQidahenPrintedRegionIdsForRuntimeRegionId('city-region-20')).toEqual(['city-region-20', 'city-region-21']);
        expect(getQidahenRuntimeRegionIdsForPrintedRegionId('city-region-15')).toEqual(['city-region-15', 'city-region-15-liaodong']);
        expect(resolveQidahenRuntimeRegionIdFromPrintedRegionId('city-region-15')).toBe('city-region-15');
        expect(resolveQidahenRuntimeRegionIdFromPrintedRegionId('city-region-15', ['city-region-15-liaodong'])).toBe('city-region-15-liaodong');
        expect(getQidahenRuntimeRegionIdsForPrintedRegionId('city-region-19')).toEqual(['city-region-19', 'city-region-19-liaoxi']);
        expect(resolveQidahenRuntimeRegionIdFromPrintedRegionId('city-region-19')).toBe('city-region-19');
        expect(resolveQidahenRuntimeRegionIdFromPrintedRegionId('city-region-19', ['city-region-19-liaoxi'])).toBe('city-region-19-liaoxi');
        expect(getQidahenRuntimeRegionIdsForPrintedRegionId('city-region-28')).toEqual(['city-region-28-jizhen', 'city-region-28']);
        expect(resolveQidahenRuntimeRegionIdFromPrintedRegionId('city-region-28')).toBe('city-region-28-jizhen');
        expect(resolveQidahenRuntimeRegionIdFromPrintedRegionId('city-region-28', ['city-region-28'])).toBe('city-region-28');
    });

    it('正式 shared printed 映射与 authoritative guide 已覆盖当前已锁定真相', () => {
        expect(getQidahenSharedPrintedRegionAudits()).toEqual([
            {
                printedRegionId: 'city-region-15',
                runtimeRegionIds: ['city-region-15', 'city-region-15-liaodong'],
                missingAuthoritativeRuntimeIds: [],
            },
            {
                printedRegionId: 'city-region-19',
                runtimeRegionIds: ['city-region-19', 'city-region-19-liaoxi'],
                missingAuthoritativeRuntimeIds: [],
            },
            {
                printedRegionId: 'city-region-28',
                runtimeRegionIds: ['city-region-28-jizhen', 'city-region-28'],
                missingAuthoritativeRuntimeIds: [],
            },
        ]);
    });

    it('运行时邻接/代价/边界类型与 runtime directed passage 保持一致', () => {
        for (const region of QIDAHEN_RUNTIME_REGION_DEFINITIONS) {
            const persistedRegion = QIDAHEN_RUNTIME_REGION_SOURCE_BY_ID.get(region.id);
            const expectedAdjacentRegionIds = [...(persistedRegion?.links ?? [])]
                .filter((adjacentRegionId) => QIDAHEN_RUNTIME_REGION_SOURCE_BY_ID.has(adjacentRegionId))
                .sort();

            expect(region.adjacentRegionIds).toEqual(expectedAdjacentRegionIds);
            expect(Object.keys(region.travelCostByRegionId).sort()).toEqual(expectedAdjacentRegionIds);
            expect(Object.keys(region.movementCostByRegionId).sort()).toEqual(expectedAdjacentRegionIds);
            expect(Object.keys(region.boundaryTypeByRegionId).sort()).toEqual(expectedAdjacentRegionIds);

            for (const adjacentRegionId of expectedAdjacentRegionIds) {
                const passage = getQidahenDirectedPassageBetween(region.id, adjacentRegionId);
                expect(passage, `${region.id} -> ${adjacentRegionId} 缺少 directed passage`).not.toBeNull();
                expect(region.travelCostByRegionId[adjacentRegionId]).toBe(passage?.travelCost);
                expect(region.movementCostByRegionId[adjacentRegionId]).toBe(passage?.battleWidth);
                expect(region.boundaryTypeByRegionId[adjacentRegionId]).toBe(passage?.boundaryType);
            }
        }
    });

    it('保留本轮补齐后的关键粗值通路消耗', () => {
        expect(getQidahenDirectedPassageBetween('city-region-14', 'jinzhou')?.travelCost).toBe(3);
        expect(getQidahenDirectedPassageBetween('city-region-19-liaoxi', 'jinzhou')?.travelCost).toBe(2);
        expect(getQidahenDirectedPassageBetween('city-region-20', 'city-region-24')?.travelCost).toBe(2);
        expect(getQidahenDirectedPassageBetween('city-region-24', 'city-region-20')?.travelCost).toBe(2);
        expect(getQidahenDirectedPassageBetween('city-region-24', 'jinzhou')?.travelCost).toBe(3);
        expect(getQidahenDirectedPassageBetween('city-region-16', 'jinzhou')?.travelCost).toBe(3);
        expect(getQidahenDirectedPassageBetween('city-region-16', 'city-region-20')?.travelCost).toBe(3);
        expect(getQidahenDirectedPassageBetween('jinzhou', 'city-region-25')?.travelCost).toBe(2);
        expect(getQidahenDirectedPassageBetween('city-region-27', 'city-region-33')?.travelCost).toBe(3);
        expect(getQidahenDirectedPassageBetween('city-region-3', 'city-region-4')?.travelCost).toBe(3);
        expect(getQidahenDirectedPassageBetween('city-region-10', 'city-region-15')?.travelCost).toBe(3);
        expect(getQidahenDirectedPassageBetween('city-region-10', 'city-region-17')?.travelCost).toBe(2);
        expect(getQidahenDirectedPassageBetween('city-region-11', 'city-region-13')?.travelCost).toBe(2);
        expect(getQidahenDirectedPassageBetween('city-region-14', 'city-region-17')?.travelCost).toBe(2);
        expect(getQidahenDirectedPassageBetween('city-region-20', 'city-region-26')?.travelCost).toBe(3);
        expect(getQidahenDirectedPassageBetween('city-region-30', 'city-region-31')?.travelCost).toBe(3);
        expect(getQidahenDirectedPassageBetween('city-region-32', 'city-region-33')?.travelCost).toBe(3);
        expect(getQidahenDirectedPassageBetween('city-region-14', 'city-region-16')?.travelCost).toBe(3);
        expect(getQidahenDirectedPassageBetween('city-region-8', 'city-region-16')?.travelCost).toBe(3);
        expect(getQidahenDirectedPassageBetween('city-region-24', 'city-region-25')?.travelCost).toBe(2);
        expect(getQidahenDirectedPassageBetween('city-region-24', 'city-region-27')?.travelCost).toBe(2);
        expect(getQidahenDirectedPassageBetween('city-region-24', 'city-region-28-jizhen')?.travelCost).toBe(2);
        expect(getQidahenDirectedPassageBetween('city-region-13', 'city-region-15-liaodong')?.travelCost).toBe(2);
        expect(getQidahenDirectedPassageBetween('city-region-15', 'city-region-17')?.travelCost).toBe(2);
        expect(getQidahenDirectedPassageBetween('city-region-26', 'city-region-31')?.travelCost).toBe(3);
        expect(getQidahenDirectedPassageBetween('city-region-27', 'city-region-30')?.travelCost).toBe(3);
        expect(getQidahenDirectedPassageBetween('city-region-22', 'city-region-32')?.travelCost).toBe(2);
        expect(getQidahenDirectedPassageBetween('city-region-22', 'city-region-32')?.boundaryType).toBe('coast');
        expect(getQidahenDirectedPassageBetween('city-region-22', 'city-region-32')?.unitCap).toBe(2);
        expect(getQidahenDirectedPassageBetween('city-region-22', 'city-region-28-jizhen')?.travelCost).toBe(3);
        expect(getQidahenDirectedPassageBetween('city-region-14', 'city-region-19')?.travelCost).toBe(2);
        expect(getQidahenDirectedPassageBetween('city-region-17', 'city-region-19')?.travelCost).toBe(2);
        expect(getQidahenDirectedPassageBetween('city-region-27', 'city-region-28-jizhen')?.travelCost).toBe(2);
        expect(getQidahenDirectedPassageBetween('city-region-10', 'city-region-14')?.travelCost).toBe(3);
        expect(getQidahenDirectedPassageBetween('city-region-15-liaodong', 'city-region-7')?.travelCost).toBe(3);
        expect(getQidahenDirectedPassageBetween('city-region-4', 'city-region-5')?.travelCost).toBe(3);
        expect(getQidahenDirectedPassageBetween('city-region-3', 'city-region-7')?.travelCost).toBe(3);
        expect(getQidahenDirectedPassageBetween('city-region-14', 'city-region-8')?.travelCost).toBe(3);
        expect(getQidahenDirectedPassageBetween('city-region-15', 'city-region-19')?.travelCost).toBe(2);
        expect(getQidahenDirectedPassageBetween('city-region-14', 'city-region-6')?.travelCost).toBe(3);
        expect(getQidahenDirectedPassageBetween('city-region-13', 'city-region-7')?.travelCost).toBe(3);
        expect(getQidahenDirectedPassageBetween('city-region-5', 'city-region-11')?.travelCost).toBe(3);
        expect(getQidahenDirectedPassageBetween('city-region-5', 'city-region-9')?.travelCost).toBe(3);
        expect(getQidahenDirectedPassageBetween('city-region-5', 'xian-xing')?.travelCost).toBe(3);
        expect(getQidahenDirectedPassageBetween('city-region-22', 'song-jin')?.unitCap).toBe(2);
    });

    it('运行时区域链接都有对应通路边值，水路边显式保留 2 部队上限', () => {
        for (const region of QIDAHEN_RUNTIME_REGION_SOURCE_DEFINITIONS) {
            for (const adjacentRegionId of region.links) {
                expect(
                    getQidahenDirectedPassageBetween(region.id, adjacentRegionId),
                    `${region.id} -> ${adjacentRegionId} 缺少通路边值`,
                ).not.toBeNull();
            }
        }

        for (const [from, to] of [
            ['city-region-15-liaodong', 'song-jin'],
            ['city-region-18', 'city-region-29'],
            ['city-region-18', 'xian-xing'],
            ['city-region-19-liaoxi', 'song-jin'],
            ['city-region-22', 'city-region-29'],
            ['city-region-22', 'song-jin'],
        ]) {
            expect(getQidahenDirectedPassageBetween(from, to)).toMatchObject({
                boundaryType: 'coast',
                unitCap: 2,
            });
        }
    });
});
