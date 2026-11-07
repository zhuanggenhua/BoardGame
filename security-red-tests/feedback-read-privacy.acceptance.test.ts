// @vitest-environment node
import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import type { ExecutionContext } from '@nestjs/common';
import type { Model } from 'mongoose';
import type { Cache } from 'cache-manager';
import type { Server } from 'socket.io';
import { FeedbackAdminController, FeedbackController } from '../apps/api/src/modules/feedback/feedback.controller';
import { FeedbackService } from '../apps/api/src/modules/feedback/feedback.service';
import { FeedbackSchema, FeedbackStatus, type FeedbackDocument } from '../apps/api/src/modules/feedback/feedback.schema';
import type { CreateFeedbackDto } from '../apps/api/src/modules/feedback/dto';
import type { UserDocument } from '../apps/api/src/modules/auth/schemas/user.schema';
import { OptionalJwtAuthGuard } from '../apps/api/src/shared/guards/optional-jwt-auth.guard';
import { createDustHauntCore } from '../src/games/betrayal/testing/firstScenarioTestUtils';
import { engineConfig } from '../src/games/betrayal/game';
import { createInitialSystemState } from '../src/engine/pipeline';
import { TransportStateSynchronizer } from '../src/engine/transport/transportStateSynchronizer';
import { buildCommandFailureFeedbackPayload } from '../src/engine/transport/commandFailureFeedbackPayload';
import { buildCommandFailureFeedbackRequestBody } from '../src/engine/transport/transportFeedbackReporter';
import type { MatchState } from '../src/engine/types';

/**
 * Feedback GET privacy contract. Only persistence is replaced: the game view,
 * capture builders, guards, controller, role lookup and service are real.
 * No database, HTTP server, credentials or external files are used.
 *
 * Read scope: users own USER rows; responsible developers and admins may read
 * their allowed rows. Anonymous readers receive SYSTEM summaries only.
 * Every ordinary response projects safe diagnostics, never private game state,
 * account data or privateReplay. Only admins receive contact details and use
 * the separate privateReplay endpoint. The Mongo double evaluates query filters.
 */
type Row = Record<string, unknown>;
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const OWNER_ID = '000000000000000000000001';
const FEEDBACK_ID = '100000000000000000000001';
const CONTACT = 'synthetic-contact@example.invalid';
const EMAIL = 'synthetic-account@example.invalid';
const COMMAND_MARKER = 'SYNTHETIC_PRIVATE_COMMAND';
const LEGACY_SEED = 'SYNTHETIC_LEGACY_SEED';
const DIAGNOSTIC_FIELDS = ['stateSnapshot', 'diagnosticPacket', 'actionLog', 'clientContext', 'errorContext'] as const;
const actors = [
    { name: 'anonymous', id: null, role: null, developerGameIds: [], reads: ['system'], manages: [] },
    { name: 'other ordinary user', id: '000000000000000000000002', role: 'user', developerGameIds: [], reads: [], manages: [] },
    { name: 'feedback owner', id: OWNER_ID, role: 'user', developerGameIds: [], reads: ['user'], manages: ['user'] },
    { name: 'responsible developer', id: '000000000000000000000003', role: 'developer', developerGameIds: ['betrayal'], reads: ['user', 'system'], manages: ['user', 'system'] },
    { name: 'administrator', id: '000000000000000000000004', role: 'admin', developerGameIds: [], reads: ['user', 'system'], manages: ['user', 'system'] },
    { name: 'unrelated developer', id: '000000000000000000000005', role: 'developer', developerGameIds: ['dicethrone'], reads: [], manages: [] },
];

function pathValue(row: unknown, path: string): unknown {
    return path.split('.').reduce<unknown>((value, key) => value && typeof value === 'object' ? (value as Row)[key] : undefined, row);
}

// Minimal Mongo expression evaluation at the DB boundary, not a copy of the
// privacy policy. Applying the actual service $project is essential: returning
// an unprojected row here would falsely report summaryOnly snapshot leakage.
function expression(value: unknown, row: Row): unknown {
    if (typeof value === 'string' && value.startsWith('$')) return pathValue(row, value.slice(1));
    if (Array.isArray(value)) return value.map(item => expression(item, row));
    if (!value || typeof value !== 'object' || value instanceof RegExp) return value;
    const object = value as Row;
    const operator = Object.keys(object).find(key => key.startsWith('$'));
    if (!operator) return Object.fromEntries(Object.entries(object).map(([key, item]) => [key, expression(item, row)]));
    const args = expression(object[operator], row);
    const list = Array.isArray(args) ? args : [];
    switch (operator) {
        case '$ifNull': return list[0] ?? list[1];
        case '$cond': return list[0] ? list[1] : list[2];
        case '$eq': return list[0] === list[1];
        case '$gt': return Number(list[0]) > Number(list[1]);
        case '$toString': return String(args);
        case '$substrCP': return Array.from(String(list[0])).slice(Number(list[1]), Number(list[1]) + Number(list[2])).join('');
        case '$strLenCP': return Array.from(String(args)).length;
        case '$size': return (args as unknown[]).length;
        case '$objectToArray': return Object.entries(args as Row).map(([k, v]) => ({ k, v }));
        case '$regexMatch': {
            const { input, regex } = args as { input: string; regex: RegExp };
            return regex.test(input);
        }
        default: throw new Error(`DB mock needs support for actual Mongo operator ${operator}`);
    }
}

function project(row: Row, projection: Row): Row {
    if (Object.values(projection).every(value => value === 0)) {
        return Object.fromEntries(Object.entries(row).filter(([key]) => projection[key] !== 0));
    }
    return Object.fromEntries(Object.entries(projection).filter(([, value]) => value !== 0).map(([key, value]) => [
        key, value === 1 ? pathValue(row, key) : expression(value, row),
    ]));
}

function populate(rows: Row[], select: string): Row[] {
    return rows.map(row => ({
        ...row,
        ...(row.userId && typeof row.userId === 'object' ? {
            userId: project(row.userId as Row, Object.fromEntries(['_id', ...select.split(/\s+/)].map(key => [key, 1]))),
        } : {}),
    }));
}

function buildFixture(legacy: boolean, reporterType: 'user' | 'system' = 'system') {
    const core = createDustHauntCore();
    const state = { core, sys: createInitialSystemState(core.playerIds, engineConfig.systems, 'synthetic-feedback-audit') };
    const originalState = JSON.stringify(state);
    const synchronizer = new TransportStateSynchronizer({} as Server);
    const ownerView = synchronizer.stripForTraining(synchronizer.applyPlayerView({ engineConfig, state }, '0')) as typeof state;
    const otherView = synchronizer.applyPlayerView({ engineConfig, state }, '1') as typeof state;
    const payload = buildCommandFailureFeedbackPayload({
        matchId: 'synthetic-feedback-audit', gameId: 'betrayal', state,
        playerId: '0', commandType: 'SYNTHETIC_AUDIT', reason: 'pipeline_error',
        commandPayload: { privateChoice: COMMAND_MARKER }, progressMarker: 'audit', stateIdBefore: 1,
        visibleState: ownerView as MatchState<unknown>, feedbackSource: 'player-command-failure',
        aiContext: { seatControllerType: 'human', legalActions: null },
    });
    const body = buildCommandFailureFeedbackRequestBody(payload);
    const row: Row = {
        _id: FEEDBACK_ID, ...body, gameId: 'betrayal', status: 'open', reporterType, source: reporterType === 'user' ? 'feedback-modal' : body.source,
        userId: { _id: OWNER_ID, username: 'Synthetic reporter', avatar: '', email: EMAIL },
        contactInfo: CONTACT,
        closedReason: 'SYNTHETIC_PRIVATE_CLOSURE_NOTE', resolvedMethod: 'SYNTHETIC_PRIVATE_REPAIR_NOTE',
        diagnosticPacket: JSON.parse(String(body.diagnosticPacket)),
        clientContext: { ...(body.clientContext as Row), route: '/synthetic-private-route', lastUserAction: { type: COMMAND_MARKER }, recentUserActions: [{ type: COMMAND_MARKER }, { type: 'click' }] },
        errorContext: { ...(body.errorContext as Row), message: 'SYNTHETIC_PRIVATE_ERROR', stack: 'SYNTHETIC_PRIVATE_STACK' },
        privateReplay: 'SYNTHETIC_ADMIN_ONLY_REPLAY',
        unknownFutureDiagnostic: 'SYNTHETIC_UNKNOWN_PRIVATE_FIELD',
    };
    if (legacy) {
        row.stateSnapshot = JSON.stringify({ state, randomSeed: LEGACY_SEED });
        row.diagnosticPacket = { ...(row.diagnosticPacket as Row), snapshots: { at: { state, randomSeed: LEGACY_SEED } } };
    }
    return { row, state, originalState, ownerView, otherView };
}

function matches(row: Row, filter: Row): boolean {
    const scalar = (value: unknown): unknown => value && typeof value === 'object'
        ? String((value as Row)._id ?? value) : value;
    return Object.entries(filter).every(([key, value]) => {
        if (key === '$or') return (value as Row[]).some(part => matches(row, part));
        if (key === '$and') return (value as Row[]).every(part => matches(row, part));
        const actual = pathValue(row, key);
        if (value && typeof value === 'object' && '$in' in value) return ((value as Row).$in as unknown[]).some(item => scalar(item) === scalar(actual));
        return scalar(actual) === scalar(value);
    });
}

function createService(row: Row, options: { createMode?: 'create' | 'preflight' | 'race'; calls?: { creates: number; captureReads: number } } = {}) {
    const publicStoredRow = () => Object.fromEntries(Object.entries(clone(row)).filter(([key]) => FeedbackSchema.path(key)?.options.select !== false));
    function query(initial: Row[], single = false) {
        let rows = initial;
        return {
            sort() { return this; }, skip() { return this; }, limit() { return this; },
            populate(_path: string, select: string) { rows = populate(rows, select); return this; },
            select(selection: Row | string) {
                if (selection === '+privateReplay') rows = rows.map(item => ({ ...item, privateReplay: row.privateReplay }));
                else if (typeof selection === 'object') rows = rows.map(item => project(item, selection));
                else throw new Error(`Unexpected query select ${selection}`);
                return this;
            },
            lean() { return this; },
            exec: async () => clone(single ? rows[0] ?? null : rows),
            then(resolve: (value: Row | Row[] | null) => unknown, reject: (reason: unknown) => unknown) {
                return Promise.resolve(clone(single ? rows[0] ?? null : rows)).then(resolve, reject);
            },
        };
    }
    const feedbackModel = {
        findById: (id: string) => query(String(row._id) === id ? [publicStoredRow()] : [], true),
        findOne: (filter: Row) => {
            if (filter.autoCaptureKey && options.createMode) {
                if (options.calls) options.calls.captureReads += 1;
                if (options.createMode === 'create' || (options.createMode === 'race' && options.calls?.captureReads === 1)) {
                    return query([], true);
                }
            }
            return query(matches(row, filter) ? [publicStoredRow()] : [], true);
        },
        find: (filter: Row) => query(matches(row, filter) ? [publicStoredRow()] : []),
        countDocuments: async (filter: Row) => matches(row, filter) ? 1 : 0,
        findOneAndUpdate: async (filter: Row, update: Row) => {
            if (!matches(row, filter)) return null;
            Object.assign(row, update.$set);
            for (const key of Object.keys((update.$unset ?? {}) as Row)) delete row[key];
            return publicStoredRow();
        },
        create: async (value: Row) => {
            if (options.calls) options.calls.creates += 1;
            if (options.createMode === 'race') throw { code: 11000 };
            // Store exactly the real service's projected payload at the model boundary.
            Object.assign(row, clone(value));
            return clone(row);
        },
        aggregate: (pipeline: Row[]) => {
            let rows = [clone(row)];
            for (const stage of pipeline) {
                if (stage.$match) rows = rows.filter(item => matches(item, stage.$match as Row));
                else if (stage.$project) rows = rows.map(item => project(item, stage.$project as Row));
                else if (stage.$addFields) rows = rows.map(item => ({ ...item, ...(expression(stage.$addFields, item) as Row) }));
                else if (!Object.keys(stage).some(key => ['$match', '$sort', '$skip', '$limit'].includes(key))) {
                    throw new Error(`Unexpected aggregate stage ${Object.keys(stage).join(',')}`);
                }
            }
            return { exec: async () => clone(rows) };
        },
        populate: async (rows: Row[], options: { select: string }) => populate(rows, options.select),
    };
    const userModel = {
        findById: (id: string) => ({ select: () => ({ lean: async () => actors.find(actor => actor.id === id) }) }),
        updateOne: () => ({ exec: async () => ({ modifiedCount: 1 }) }),
    };
    return new FeedbackService(feedbackModel as unknown as Model<FeedbackDocument>, userModel as unknown as Model<UserDocument>);
}

describe('feedback read privacy through real capture builders, controller and service', () => {
    it('anonymous GET routes really accept no token and only use the optional guard', async () => {
        expect(Reflect.getMetadata(GUARDS_METADATA, FeedbackAdminController) ?? []).toEqual([]);
        for (const method of ['findAll', 'findOne'] as const) {
            expect(Reflect.getMetadata(GUARDS_METADATA, FeedbackAdminController.prototype[method])).toEqual([OptionalJwtAuthGuard]);
        }
        const guard = new OptionalJwtAuthGuard({ get: async () => undefined } as unknown as Cache);
        for (const headers of [{}, { authorization: 'not-bearer' }, { authorization: 'Bearer synthetic.invalid.token' }]) {
            expect(await guard.canActivate({ switchToHttp: () => ({ getRequest: () => ({ headers }) }) } as ExecutionContext)).toBe(true);
        }
    });

    it('the real capture redacts owner-only tokens and command payload without mutating authority', () => {
        const fixture = buildFixture(false);
        const ownerTokens = fixture.ownerView.core.scenarioRuntime.dust!.sicknessTokensByPlayerId['0'];
        const hiddenTokens = fixture.otherView.core.scenarioRuntime.dust!.sicknessTokensByPlayerId['0'];
        expect(ownerTokens.some(token => token.value !== null)).toBe(true);
        expect(hiddenTokens.every(token => token.value === null)).toBe(true);
        expect(String(fixture.row.stateSnapshot)).not.toContain('sicknessTokensByPlayerId');
        expect(JSON.stringify(fixture.row.diagnosticPacket)).not.toContain('sicknessTokensByPlayerId');
        expect(String(fixture.row.actionLog)).not.toContain(COMMAND_MARKER);
        expect(JSON.stringify(fixture.row)).not.toContain('randomSeed');
        expect(JSON.stringify(fixture.state)).toBe(fixture.originalState);
    });

    const assertSafeDiagnostics = (result: Row) => {
        const wire = JSON.stringify(result);
        for (const secret of [COMMAND_MARKER, LEGACY_SEED, EMAIL, 'SYNTHETIC_PRIVATE_ERROR',
            'SYNTHETIC_PRIVATE_STACK', 'sicknessTokensByPlayerId', 'SYNTHETIC_ADMIN_ONLY_REPLAY',
            'SYNTHETIC_UNKNOWN_PRIVATE_FIELD']) expect(wire).not.toContain(secret);
        expect(result).not.toHaveProperty('userId');
        expect(result).not.toHaveProperty('privateReplay');
        expect(result).not.toHaveProperty('unknownFutureDiagnostic');
    };

    it.each(['pointerdown', 'click', 'submit', 'keydown'])('retains real diagnostic event %s while rejecting arbitrary event text', async type => {
        const fixture = buildFixture(false);
        fixture.row.clientContext = { lastUserAction: { type }, recentUserActions: [{ type }, { type: COMMAND_MARKER }] };
        const adminId = actors.find(actor => actor.role === 'admin')!.id!;
        const result = await createService(fixture.row).findOne(adminId, FEEDBACK_ID);
        expect(result?.clientContext?.lastUserAction?.type).toBe(type);
        expect(result?.clientContext?.recentUserActions?.[0].type).toBe(type);
        expect(JSON.stringify(result)).not.toContain(COMMAND_MARKER);
        expect(result?.closedReason).toBe('SYNTHETIC_PRIVATE_CLOSURE_NOTE');
        expect(result?.resolvedMethod).toBe('SYNTHETIC_PRIVATE_REPAIR_NOTE');
    });

    for (const legacy of [false, true]) {
        for (const reporterType of ['user', 'system'] as const) {
            for (const actor of actors) {
                for (const endpoint of ['full list', 'summary list', 'detail'] as const) {
                    it(`${legacy ? 'historical' : 'new'} ${reporterType}, ${actor.name}: ${endpoint} enforces scope and projection`, async () => {
                        const fixture = buildFixture(legacy, reporterType);
                        const storedBefore = JSON.stringify(fixture.row);
                        const controller = new FeedbackAdminController(createService(fixture.row));
                        const request = actor.id ? { user: { userId: actor.id } } : {};
                        const canRead = actor.reads.includes(reporterType);
                        let raw: unknown;
                        if (endpoint === 'detail') {
                            const pending = controller.findOne(request, FEEDBACK_ID);
                            if (!canRead) {
                                await expect(pending).rejects.toThrow('feedback not found');
                                expect(JSON.stringify(fixture.row)).toBe(storedBefore);
                                return;
                            }
                            raw = await pending;
                        } else {
                            const response = await controller.findAll(request, { summaryOnly: endpoint === 'summary list' });
                            expect(response.total).toBe(canRead ? 1 : 0);
                            expect(response.items).toHaveLength(canRead ? 1 : 0);
                            if (!canRead) {
                                expect(JSON.stringify(fixture.row)).toBe(storedBefore);
                                return;
                            }
                            raw = response.items[0];
                        }
                        const result = clone(raw) as Row;
                        expect(result.canManage).toBe(actor.manages.includes(reporterType));
                        assertSafeDiagnostics(result);
                        expect(result.contactInfo).toBe(actor.role === 'admin' && endpoint !== 'summary list' ? CONTACT : undefined);
                        if (!actor.id) {
                            expect(result).not.toHaveProperty('content');
                            expect(result).not.toHaveProperty('closedReason');
                            expect(result).not.toHaveProperty('resolvedMethod');
                            expect(result).not.toHaveProperty('incidentKey');
                            expect(result).not.toHaveProperty('aggregationKey');
                            expect(JSON.stringify(result)).not.toContain('synthetic-feedback-audit');
                            expect(JSON.stringify(result)).not.toContain('SYNTHETIC_PRIVATE_CLOSURE_NOTE');
                            expect(JSON.stringify(result)).not.toContain('SYNTHETIC_PRIVATE_REPAIR_NOTE');
                        }
                        if (endpoint === 'summary list') {
                            expect(result).not.toHaveProperty('stateSnapshot');
                            expect(result).not.toHaveProperty('actionLog');
                            expect(result).not.toHaveProperty('diagnosticPacket');
                            expect(result.contentPreview).toBe(actor.id ? String(fixture.row.content) : '系统自动诊断');
                        }
                        expect(JSON.stringify(fixture.row)).toBe(storedBefore);
                        expect(JSON.stringify(fixture.state)).toBe(fixture.originalState);
                    });
                }
            }
        }
    }

    for (const reporterType of ['user', 'system'] as const) {
        for (const actor of actors.filter(actor => actor.id !== null)) {
            for (const status of [FeedbackStatus.CLOSED, FeedbackStatus.RESOLVED]) {
                it(`${reporterType}, ${actor.name}: PATCH ${status} preserves scope and never returns raw diagnostics`, async () => {
                    const fixture = buildFixture(true, reporterType);
                    const oldDiagnostics = Object.fromEntries(DIAGNOSTIC_FIELDS.map(field => [field, clone(fixture.row[field])]));
                    const controller = new FeedbackAdminController(createService(fixture.row));
                    const pending = controller.updateStatus({ user: { userId: actor.id! } }, FEEDBACK_ID, {
                        status, closedReason: 'Synthetic close reason', resolvedMethod: 'Synthetic fix',
                    });
                    if (!actor.manages.includes(reporterType)) {
                        await expect(pending).rejects.toThrow('feedback not found');
                        expect(fixture.row.status).toBe('open');
                        return;
                    }
                    const result = clone(await pending) as Row;
                    expect(result.status).toBe(status);
                    expect(result.contactInfo).toBe(actor.role === 'admin' ? CONTACT : undefined);
                    assertSafeDiagnostics(result);
                    for (const field of DIAGNOSTIC_FIELDS) expect(fixture.row[field]).toEqual(oldDiagnostics[field]);
                    expect(JSON.stringify(fixture.state)).toBe(fixture.originalState);
                });
            }
        }
    }

    for (const actor of actors) {
        for (const createMode of ['create', 'preflight', 'race'] as const) {
            it(`${actor.name}: public POST ${createMode} returns a safe receipt`, async () => {
                const fixture = buildFixture(true);
                fixture.row.userId = actor.id;
                fixture.row.source = 'client-auto-report';
                const packet = fixture.row.diagnosticPacket as Row;
                fixture.row.autoCaptureKey = `client-auto-report:${packet.captureId}`;
                const calls = { creates: 0, captureReads: 0 };
                const controller = new FeedbackController(createService(fixture.row, { createMode, calls }));
                const dto = {
                    content: fixture.row.content, source: fixture.row.source,
                    gameName: 'betrayal', contactInfo: CONTACT,
                    ...Object.fromEntries(DIAGNOSTIC_FIELDS.map(field => [field, fixture.row[field]])),
                } as CreateFeedbackDto;
                const result = clone(await controller.create(actor.id ? { user: { userId: actor.id } } : {}, dto)) as Row;
                expect(result._id).toBe(FEEDBACK_ID);
                expect(result.content).toBe(actor.id ? dto.content : undefined);
                expect(result).not.toHaveProperty('contactInfo');
                assertSafeDiagnostics(result);
                expect(calls.creates).toBe(createMode === 'preflight' ? 0 : 1);
                expect(calls.captureReads).toBe(createMode === 'race' ? 2 : 1);
                if (createMode === 'create') {
                    expect(String(fixture.row.stateSnapshot)).not.toContain(LEGACY_SEED);
                    expect(JSON.stringify(fixture.row.diagnosticPacket)).not.toContain(LEGACY_SEED);
                }
            });
        }
    }

    for (const actor of actors.filter(actor => actor.id !== null)) {
        it(`${actor.name}: only the explicit administrator endpoint releases privateReplay`, async () => {
            const fixture = buildFixture(true);
            const service = createService(fixture.row);
            const pending = service.findPrivateReplay(actor.id!, FEEDBACK_ID);
            if (actor.role === 'admin') await expect(pending).resolves.toEqual({ privateReplay: fixture.row.privateReplay });
            else await expect(pending).rejects.toThrow('仅管理员可读取权威复现场景');
        });
    }
});
