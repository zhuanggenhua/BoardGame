import { describe, expect, it } from 'vitest';
import {
    buildQidahenRegionMaskColorMap,
    findQidahenRegionGraphEdge,
    getQidahenBoundaryTypeMeta,
    getQidahenDirectedPassage,
    getQidahenDirectedPassageBetween,
    QIDAHEN_MASK_REGION_DEFINITIONS,
    QIDAHEN_REGION_GRAPH_EDGES,
    QIDAHEN_REGION_GRAPH_NODES,
    normalizeQidahenPassageId,
    parseQidahenRegionGraph,
    qidahenRegionColorKey,
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

    it('正式图谱已从当前区域 mask 回填中心、面积和粗连线', () => {
        expect(QIDAHEN_REGION_GRAPH_NODES).toHaveLength(QIDAHEN_MASK_REGION_DEFINITIONS.length);
        expect(QIDAHEN_REGION_GRAPH_NODES.every((node) => node.center != null && node.pixelCount > 0)).toBe(true);
        expect(QIDAHEN_REGION_GRAPH_EDGES.length).toBeGreaterThanOrEqual(77);
        expect(getQidahenDirectedPassageBetween('city-region-1', 'city-region-20')).not.toBeNull();
        expect(getQidahenDirectedPassageBetween('city-region-16', 'jinzhou')).toMatchObject({
            boundaryType: 'city',
            battleWidth: 1,
        });
    });

    it('已把当前高置信地图区名回写到图谱与 mask 元数据', () => {
        const graphNameById = new Map(QIDAHEN_REGION_GRAPH_NODES.map((node) => [node.id, node.name]));
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

    it('保留本轮补齐后的关键粗值通路消耗', () => {
        expect(getQidahenDirectedPassageBetween('city-region-14', 'jinzhou')?.travelCost).toBe(3);
        expect(getQidahenDirectedPassageBetween('city-region-19', 'jinzhou')?.travelCost).toBe(2);
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
        expect(getQidahenDirectedPassageBetween('city-region-24', 'city-region-28')?.travelCost).toBe(2);
        expect(getQidahenDirectedPassageBetween('city-region-13', 'city-region-15')?.travelCost).toBe(2);
        expect(getQidahenDirectedPassageBetween('city-region-15', 'city-region-17')?.travelCost).toBe(2);
        expect(getQidahenDirectedPassageBetween('city-region-26', 'city-region-31')?.travelCost).toBe(3);
        expect(getQidahenDirectedPassageBetween('city-region-27', 'city-region-30')?.travelCost).toBe(3);
        expect(getQidahenDirectedPassageBetween('city-region-22', 'city-region-32')?.travelCost).toBe(2);
        expect(getQidahenDirectedPassageBetween('city-region-22', 'city-region-32')?.boundaryType).toBe('coast');
        expect(getQidahenDirectedPassageBetween('city-region-22', 'city-region-32')?.unitCap).toBe(2);
        expect(getQidahenDirectedPassageBetween('city-region-22', 'city-region-28')?.travelCost).toBe(3);
        expect(getQidahenDirectedPassageBetween('city-region-14', 'city-region-19')?.travelCost).toBe(2);
        expect(getQidahenDirectedPassageBetween('city-region-17', 'city-region-19')?.travelCost).toBe(2);
        expect(getQidahenDirectedPassageBetween('city-region-27', 'city-region-28')?.travelCost).toBe(2);
        expect(getQidahenDirectedPassageBetween('city-region-10', 'city-region-14')?.travelCost).toBe(3);
        expect(getQidahenDirectedPassageBetween('city-region-15', 'city-region-7')?.travelCost).toBe(3);
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

    it('区域链接都有对应通路边值，水路边显式保留 2 部队上限', () => {
        for (const region of QIDAHEN_MASK_REGION_DEFINITIONS) {
            for (const adjacentRegionId of region.links) {
                expect(
                    getQidahenDirectedPassageBetween(region.id, adjacentRegionId),
                    `${region.id} -> ${adjacentRegionId} 缺少通路边值`,
                ).not.toBeNull();
            }
        }

        for (const [from, to] of [
            ['city-region-15', 'song-jin'],
            ['city-region-18', 'city-region-29'],
            ['city-region-18', 'xian-xing'],
            ['city-region-19', 'song-jin'],
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
