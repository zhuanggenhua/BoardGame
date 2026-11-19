#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const HOTSPOT_LIMIT = 10;

function summarizeProfile(profile, fileName) {
    const { nodes, samples, timeDeltas, startTime, endTime } = profile;
    if (!Array.isArray(nodes) || !Array.isArray(samples) || samples.length === 0
        || !Array.isArray(timeDeltas) || samples.length !== timeDeltas.length
        || !Number.isFinite(startTime) || !Number.isFinite(endTime) || endTime < startTime) {
        throw new Error(`${fileName} 缺少有效的 V8 CPU 采样数据`);
    }

    const frames = new Map(nodes.map(({ id, callFrame }) => [id, callFrame]));
    const totals = new Map();
    let sampledMicros = 0;
    for (const [index, nodeId] of samples.entries()) {
        const delta = timeDeltas[index];
        const frame = frames.get(nodeId);
        if (!frame || !Number.isFinite(delta) || delta < 0) {
            throw new Error(`${fileName} 的采样节点或间隔无效`);
        }
        const functionName = frame.functionName || '(anonymous)';
        const script = frame.url ? path.posix.basename(frame.url.replaceAll('\\', '/').split(/[?#]/, 1)[0]) : undefined;
        const line = frame.lineNumber >= 0 ? frame.lineNumber + 1 : undefined;
        const column = frame.columnNumber >= 0 ? frame.columnNumber + 1 : undefined;
        const key = JSON.stringify([functionName, frame.url, line, column]);
        const entry = totals.get(key) ?? { functionName, script, line, column, sampleCount: 0, micros: 0 };
        entry.sampleCount += 1;
        entry.micros += delta;
        sampledMicros += delta;
        totals.set(key, entry);
    }

    return {
        fileName,
        durationMs: Math.round((endTime - startTime) / 1000),
        sampleCount: samples.length,
        // 只统计采样栈顶的归属；等待、GC 和其他活动都可能出现，不能代替根因判定。
        topSelfFrames: [...totals.values()].sort((a, b) => b.micros - a.micros)
            .slice(0, HOTSPOT_LIMIT).map(({ micros, ...entry }) => ({
                ...entry,
                sampledMs: Math.round(micros / 1000),
                sampleWindowPercent: sampledMicros > 0 ? Math.round(micros / sampledMicros * 10000) / 100 : 0,
            })),
    };
}

try {
    const profiles = process.argv.slice(2);
    if (profiles.length === 0) throw new Error('请传入需要分析的 .cpuprofile 本地文件');
    const summaries = [];
    for (const file of profiles) {
        summaries.push(summarizeProfile(JSON.parse(await readFile(file, 'utf8')), path.basename(file)));
    }
    console.log(JSON.stringify(summaries, null, 2));
} catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
}
