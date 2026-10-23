import { dot, normalize, topK } from './top-k';

describe('topK', () => {
  it('returns the k highest scores, best first', () => {
    expect(topK([5, 1, 9, 3, 7, 2], 3, (x) => x)).toEqual([9, 7, 5]);
  });

  it('handles k larger than the input and k = 0', () => {
    expect(topK([2, 1], 5, (x) => x)).toEqual([2, 1]);
    expect(topK([2, 1], 0, (x) => x)).toEqual([]);
  });

  it('matches a full sort on random data', () => {
    const data = Array.from({ length: 500 }, () => Math.random());
    const expected = [...data].sort((a, b) => b - a).slice(0, 10);
    expect(topK(data, 10, (x) => x)).toEqual(expected);
  });
});

describe('vectors', () => {
  it('normalized vectors have dot product 1 with themselves', () => {
    const v = normalize([3, 4]);
    expect(dot(v, v)).toBeCloseTo(1);
    expect(v).toEqual([0.6, 0.8]);
  });
});
