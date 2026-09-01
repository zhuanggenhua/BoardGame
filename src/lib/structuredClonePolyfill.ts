const cloneSerializableValue = <T>(value: T): T => (
    JSON.parse(JSON.stringify(value)) as T
);

if (typeof globalThis.structuredClone !== 'function') {
    Object.defineProperty(globalThis, 'structuredClone', {
        configurable: true,
        writable: true,
        value: cloneSerializableValue,
    });
}
