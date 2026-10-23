// Least-recently-used cache in O(1) per operation. A JS Map remembers
// insertion order, so: on read, delete + re-insert moves a key to the
// "newest" end; on overflow, the first key is the least recently used.
export class LruCache<K, V> {
  private readonly map = new Map<K, V>();

  constructor(private readonly capacity: number) {}

  get(key: K): V | undefined {
    const value = this.map.get(key);
    if (value === undefined) return undefined;
    this.map.delete(key);
    this.map.set(key, value);
    return value;
  }

  set(key: K, value: V): void {
    this.map.delete(key);
    this.map.set(key, value);
    if (this.map.size > this.capacity) {
      this.map.delete(this.map.keys().next().value as K);
    }
  }
}
