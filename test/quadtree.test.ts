import { describe, expect, it } from 'vitest';
import { buildQuadTree } from '../src/lib/quadtree';

describe('quadtree hit testing', () => {
  it('returns the nearest point', () => {
    const tree = buildQuadTree([
      { key: 'a', x: 0, y: 0 },
      { key: 'b', x: 100, y: 100 },
      { key: 'c', x: -50, y: 20 },
    ]);

    expect(tree?.nearest(2, 1)?.key).toBe('a');
    expect(tree?.nearest(96, 90)?.key).toBe('b');
    expect(tree?.nearest(-40, 18)?.key).toBe('c');
  });

  it('handles many points after internal subdivision', () => {
    const points = Array.from({ length: 200 }, (_, index) => ({
      key: `n${index}`,
      x: (index % 20) * 10,
      y: Math.floor(index / 20) * 10,
    }));
    const tree = buildQuadTree(points);

    expect(tree?.nearest(51, 21)?.key).toBe('n45');
    expect(tree?.nearest(-10, -10)?.key).toBe('n0');
  });

  it('returns null for an empty input', () => {
    expect(buildQuadTree([])).toBeNull();
  });
});
