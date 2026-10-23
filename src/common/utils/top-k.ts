// Returns the k items with the highest score, best first.
// A min-heap of size k keeps the current best k; its root is the weakest of
// them, so each new item costs O(log k): O(n log k) total instead of the
// O(n log n) of sorting everything.
export function topK<T>(
  items: Iterable<T>,
  k: number,
  score: (item: T) => number,
): T[] {
  if (k <= 0) return [];
  const heap: { item: T; s: number }[] = [];

  const swap = (i: number, j: number) =>
    ([heap[i], heap[j]] = [heap[j], heap[i]]);
  const up = (i: number) => {
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (heap[p].s <= heap[i].s) return;
      swap(i, p);
      i = p;
    }
  };
  const down = (i: number) => {
    for (;;) {
      const l = 2 * i + 1;
      const r = l + 1;
      let m = i;
      if (l < heap.length && heap[l].s < heap[m].s) m = l;
      if (r < heap.length && heap[r].s < heap[m].s) m = r;
      if (m === i) return;
      swap(i, m);
      i = m;
    }
  };

  for (const item of items) {
    const s = score(item);
    if (heap.length < k) {
      heap.push({ item, s });
      up(heap.length - 1);
    } else if (s > heap[0].s) {
      heap[0] = { item, s };
      down(0);
    }
  }
  return heap.sort((a, b) => b.s - a.s).map((h) => h.item);
}

// Cosine similarity of two unit vectors is just their dot product.
export function dot(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += a[i] * b[i];
  return sum;
}

export function normalize(v: number[]): number[] {
  const len = Math.sqrt(dot(v, v)) || 1;
  return v.map((x) => x / len);
}
