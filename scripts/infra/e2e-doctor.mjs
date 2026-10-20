import { DEV_SERVER_PORTS, E2E_SINGLE_WORKER_PORTS, toPortArray } from './e2e-port-config.js';
import { formatRuntimeSummary, listRuntimes } from './e2e-runtime-registry.js';
import { evaluateBudgetGate, formatGlobalHeavyBudgetEntry, listGlobalHeavyBudgetEntries, pruneGlobalHeavyBudget } from './global-heavy-budget.mjs';
import { formatTaskGuardSummary, listTaskGuards, pruneTaskGuards } from './heavy-task-guard.mjs';
import { getPortPids, isPortInUse } from './port-allocator.js';
import os from 'node:os';

function printSection(title) {
    console.log(`\n=== ${title} ===`);
}

function printPortState(label, ports) {
    const portEntries = Object.entries(ports);
    for (const [name, port] of portEntries) {
        const inUse = isPortInUse(port);
        const pids = inUse ? getPortPids(port) : [];
        console.log(`- ${label}.${name}: ${port} | ${inUse ? `占用中 pid=${pids.join(',') || 'unknown'}` : '空闲'}`);
    }
}

pruneTaskGuards();
await pruneGlobalHeavyBudget();

printSection('重任务登记（不按任务名称互斥）');
const guards = listTaskGuards();
if (guards.length === 0) {
    console.log('无活跃重任务。');
} else {
    for (const guard of guards) {
        console.log(`- ${formatTaskGuardSummary(guard)}`);
    }
}

printSection('E2E Runtime');
const runtimes = listRuntimes().filter(runtime => runtime.status === 'active' || runtime.status === 'active-unhealthy');
if (runtimes.length === 0) {
    console.log('无活跃 E2E runtime。');
} else {
    for (const runtime of runtimes) {
        console.log(`- ${formatRuntimeSummary(runtime)}`);
    }
}

printSection('全局资源登记（不设任务数量上限）');
const budgetEntries = await listGlobalHeavyBudgetEntries();
if (budgetEntries.length === 0) {
    console.log('无活跃全局预算占用。');
} else {
    for (const entry of budgetEntries) {
        console.log(`- ${formatGlobalHeavyBudgetEntry(entry)}`);
    }
}

printSection('启动资源检查');
const admission = await evaluateBudgetGate();
console.log(`- ${admission.allowed ? '允许启动' : `等待：${admission.reason}`}`);
console.log(`- 当前 CPU: ${admission.snapshot.cpuUsagePercent.toFixed(1)}%`);
console.log(`- 当前可用内存: ${admission.snapshot.freeMemoryGb.toFixed(2)}GB；下限 ${admission.snapshot.config.memoryMinFreeGb}GB`);

printSection('关键端口');
printPortState('dev', DEV_SERVER_PORTS);
printPortState('e2e-single', E2E_SINGLE_WORKER_PORTS);

printSection('摘要');
const busyDevPorts = toPortArray(DEV_SERVER_PORTS).filter(port => isPortInUse(port));
const busyE2EPorts = toPortArray(E2E_SINGLE_WORKER_PORTS).filter(port => isPortInUse(port));
const freeMemoryGb = os.freemem() / (1024 ** 3);
console.log(`- 活跃重任务数: ${guards.length}`);
console.log(`- 活跃 E2E runtime 数: ${runtimes.length}`);
console.log(`- 活跃全局预算占用数: ${budgetEntries.length}`);
console.log(`- 占用中的 dev 关键端口数: ${busyDevPorts.length}`);
console.log(`- 占用中的 e2e 单 worker 关键端口数: ${busyE2EPorts.length}`);
console.log(`- 当前可用内存: ${freeMemoryGb.toFixed(2)}GB`);
