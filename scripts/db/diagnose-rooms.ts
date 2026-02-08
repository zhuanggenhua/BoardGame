/**
 * 房间诊断脚本
 *
 * 输出当前 MongoDB 中所有房间的状态与“未清理原因”推断（仅诊断，不做删除）。
 *
 * 使用方法：
 *   npx tsx scripts/db/diagnose-rooms.ts
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDB, disconnectDB } from '../src/server/db';
import { mongoStorage } from '../src/server/storage/MongoStorage';

const GRACE_MS = 5 * 60 * 1000;

type PlayerSeat = { name?: string; credentials?: string; isConnected?: boolean | null };

type MatchDoc = {
    matchID: string;
    gameName: string;
    ttlSeconds?: number;
    expiresAt?: Date | null;
    updatedAt?: Date | null;
    metadata?: {
        setupData?: { ownerKey?: string; ownerType?: string };
        players?: Record<string, PlayerSeat>;
        disconnectedSince?: number | null;
    } | null;
};

const toIso = (value?: Date | null) => (value ? new Date(value).toISOString() : 'null');

const summarizeMatch = (doc: MatchDoc, now: number) => {
    const ttlSeconds = doc.ttlSeconds ?? 0;
    const players = doc.metadata?.players ?? {};
    const playerValues = Object.values(players);
    const connectedCount = playerValues.filter(player => Boolean(player?.isConnected)).length;
    const occupiedCount = playerValues.filter(player => Boolean(player?.isConnected || player?.name || player?.credentials)).length;
    const disconnectedSince = doc.metadata?.disconnectedSince ?? null;
    const updatedAtMs = doc.updatedAt ? new Date(doc.updatedAt).getTime() : now;
    const idleMs = now - updatedAtMs;
    const ownerKey = doc.metadata?.setupData?.ownerKey ?? 'null';
    const ownerType = doc.metadata?.setupData?.ownerType ?? 'unknown';

    let reason = 'unknown';
    if (ttlSeconds > 0) {
        reason = `ttl_seconds_keep`;
    } else if (connectedCount > 0) {
        reason = `connected`;
    } else if (!disconnectedSince) {
        reason = `missing_disconnected_since`;
    } else if (now - disconnectedSince < GRACE_MS) {
        reason = `grace_wait`;
    } else {
        reason = `should_cleanup`;
    }

    console.log(
        `[RoomDiag] matchID=${doc.matchID} game=${doc.gameName} ttlSeconds=${ttlSeconds} `
        + `ownerKey=${ownerKey} ownerType=${ownerType} connected=${connectedCount} occupied=${occupiedCount} `
        + `disconnectedSince=${disconnectedSince ?? 'null'} updatedAt=${toIso(doc.updatedAt)} idleMs=${idleMs} `
        + `expiresAt=${toIso(doc.expiresAt)} reason=${reason}`
    );
};

async function main() {
    console.log('🧪 开始诊断房间...');

    await connectDB();
    await mongoStorage.connect();

    const Match = mongoose.models.Match as mongoose.Model<MatchDoc> | undefined;
    if (!Match) {
        console.error('❌ 未找到 Match 模型，请确认 mongoStorage.connect() 已完成');
        await disconnectDB();
        return;
    }

    const docs = await Match.find({})
        .select('matchID gameName ttlSeconds expiresAt updatedAt metadata')
        .lean<MatchDoc[]>();

    const now = Date.now();
    console.log(`📦 房间总数: ${docs.length}`);

    docs.forEach(doc => summarizeMatch(doc, now));

    await disconnectDB();
    console.log('✅ 诊断完成');
}

main().catch((error) => {
    console.error('❌ 诊断失败:', error);
    process.exit(1);
});
