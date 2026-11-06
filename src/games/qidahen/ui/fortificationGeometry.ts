/** 原地图1265×893像素坐标；沿印刷墙体主轴核准，不使用地区中心连线。 */
export const QIDAHEN_FORTIFICATION_GEOMETRY: Readonly<Record<string, {
    points: readonly (readonly [number, number])[];
    labelAnchor: readonly [number, number];
    costMarker: { x: number; y: number; radius: number };
}>> = {
    'inner-wall': {
        points: [[177,640],[190,642],[205,648],[220,655],[237,661],[250,662],[268,657],[284,655],[300,656],[320,657],[340,659],[359,658],[377,654],[395,647],[413,634],[428,618],[440,599],[444,580],[444,561],[443,549],[448,537],[458,522],[469,513]],
        labelAnchor: [346,643],
        costMarker: { x: 302, y: 657, radius: 12 },
    },
    'outer-wall': {
        points: [[76,748],[85,731],[95,714],[107,703],[121,695],[136,690],[149,678],[163,661],[177,640],[189,623],[202,611],[217,602],[233,597],[249,594],[251,584],[255,571],[260,561],[266,554],[276,548],[286,540],[295,531],[306,521],[319,515],[329,512],[336,516],[351,512],[365,506],[379,491],[394,487],[410,486],[424,479],[438,470],[449,466],[458,474],[464,490],[470,507],[477,511],[487,511],[500,503],[515,494],[529,487],[537,487],[542,494],[544,505],[551,511],[561,511],[576,507],[592,503],[603,503],[613,508],[621,515]],
        labelAnchor: [350,470],
        costMarker: { x: 340, y: 510, radius: 14 },
    },
};

export function getQidahenFortificationGeometry(id: string | null) {
    const geometry = id ? QIDAHEN_FORTIFICATION_GEOMETRY[id] : undefined;
    if (!geometry) return null;
    const xs = geometry.points.map(([x]) => x), ys = geometry.points.map(([,y]) => y);
    return { ...geometry, bounds: { left: Math.min(...xs) - 12, top: Math.min(...ys) - 20,
        width: Math.max(...xs) - Math.min(...xs) + 24, height: Math.max(...ys) - Math.min(...ys) + 40 } };
}
