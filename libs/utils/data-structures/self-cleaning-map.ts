/**
 * Self-cleaning Map that automatically removes old entries
 * to prevent memory leaks from unbounded growth
 */
export class SelfCleaningMap<K, V> extends Map<K, V> {
    private logger = console; // Use console for utility class
    private maxSize: number;
    private accessTime: Map<K, number> = new Map();
    private readonly cleanupPercentage: number;

    /**
     * @param maxSize Maximum number of entries before cleanup triggers (default: 10000)
     * @param cleanupPercentage Percentage of oldest entries to remove on cleanup (default: 0.2 = 20%)
     */
    constructor(maxSize: number = 10000, cleanupPercentage: number = 0.2) {
        super();
        this.maxSize = maxSize;
        this.cleanupPercentage = cleanupPercentage;
    }

    set(key: K, value: V): this {
        super.set(key, value);
        this.accessTime.set(key, Date.now());

        // Trigger cleanup if size exceeds max
        if (this.size > this.maxSize) {
            this.cleanup();
        }

        return this;
    }

    get(key: K): V | undefined {
        const value = super.get(key);
        if (value !== undefined) {
            // Update access time on get
            this.accessTime.set(key, Date.now());
        }
        return value;
    }

    delete(key: K): boolean {
        this.accessTime.delete(key);
        return super.delete(key);
    }

    clear(): void {
        super.clear();
        this.accessTime.clear();
    }

    /**
     * Manually trigger cleanup of old entries
     */
    public cleanup(): void {
        const entriesToRemove = Math.floor(this.size * this.cleanupPercentage);

        if (entriesToRemove === 0) {
            return;
        }

        // Sort entries by access time (oldest first)
        const entries = Array.from(this.accessTime.entries()).sort(
            (a, b) => a[1] - b[1],
        );

        // Remove oldest entries
        for (let i = 0; i < entriesToRemove && i < entries.length; i++) {
            const [key] = entries[i];
            this.delete(key);
        }

        this.logger.log(
            `[SelfCleaningMap] Cleaned up ${entriesToRemove} entries. Current size: ${this.size}`,
        );
    }

    /**
     * Remove entries older than specified milliseconds
     */
    public cleanupOlderThan(maxAge: number): void {
        const now = Date.now();
        const keysToDelete: K[] = [];

        for (const [key, timestamp] of this.accessTime.entries()) {
            if (now - timestamp > maxAge) {
                keysToDelete.push(key);
            }
        }

        keysToDelete.forEach((key) => this.delete(key));

        if (keysToDelete.length > 0) {
            this.logger.log(
                `[SelfCleaningMap] Cleaned up ${keysToDelete.length} old entries. Current size: ${this.size}`,
            );
        }
    }

    /**
     * Get statistics about the map
     */
    public getStats() {
        const now = Date.now();
        const timestamps = Array.from(this.accessTime.values());

        if (timestamps.length === 0) {
            return {
                size: 0,
                oldestEntry: null,
                newestEntry: null,
                averageAge: null,
            };
        }

        const oldest = Math.min(...timestamps);
        const newest = Math.max(...timestamps);
        const totalAge = timestamps.reduce((sum, ts) => sum + (now - ts), 0);

        return {
            size: this.size,
            oldestEntry: now - oldest,
            newestEntry: now - newest,
            averageAge: totalAge / timestamps.length,
        };
    }
}

