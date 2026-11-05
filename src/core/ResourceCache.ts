/** Bounded strong references; resource owners may dispose native handles on eviction. */
export class ResourceCache<K, V> extends Map<K, V> {
    private total = 0;
    private readonly references = new Map<V, { count: number; cost: number }>();
    private readonly limit: number;
    private readonly byteLimit: number;
    private readonly measure: (value: V) => number;
    private readonly isPinned: (key: K) => boolean;
    private readonly onEvict: (value: V, key: K) => void;
    constructor(
        limit: number,
        byteLimit = Number.POSITIVE_INFINITY,
        measure: (value: V) => number = () => 0,
        isPinned: (key: K) => boolean = () => false,
        onEvict: (value: V, key: K) => void = () => {},
    ) {
        super();
        this.limit = limit;
        this.byteLimit = byteLimit;
        this.measure = measure;
        this.isPinned = isPinned;
        this.onEvict = onEvict;
    }

    override get(key: K): V | undefined {
        const value = super.get(key);
        if (super.has(key)) {
            super.delete(key);
            super.set(key, value!);
        }
        return value;
    }
    override set(key: K, value: V): this {
        if (super.has(key) && super.get(key) === value) {
            super.delete(key);
        } else {
            this.delete(key);
            const previous = this.references.get(value);
            if (previous) previous.count += 1;
            else this.references.set(value, { count: 1, cost: 0 });
        }
        const cost = Math.max(0, this.measure(value));
        const reference = this.references.get(value)!;
        this.total += cost - reference.cost;
        reference.cost = cost;
        super.set(key, value);
        this.trim();
        return this;
    }
    peek(key: K): V | undefined { return super.get(key); }
    trim(): void {
        while (this.size > this.limit || this.total > this.byteLimit) {
            const oldest = [...this.keys()].find(candidate => !this.isPinned(candidate));
            if (oldest === undefined) break;
            this.delete(oldest);
        }
    }
    override delete(key: K): boolean {
        const value = super.get(key), existed = super.has(key);
        const deleted = super.delete(key);
        if (existed) {
            const reference = this.references.get(value!)!;
            if (--reference.count === 0) {
                this.total -= reference.cost;
                this.references.delete(value!);
                this.onEvict(value!, key);
            }
        }
        return deleted;
    }
    override clear(): void {
        const previous = new Map<V, K>();
        for (const [key, value] of this) previous.set(value, key);
        super.clear();
        this.references.clear();
        this.total = 0;
        for (const [value, key] of previous) this.onEvict(value, key);
    }
    get estimatedBytes(): number { return this.total; }
}
