import { describe, expect, it } from 'vitest';
import {
  GRAPH_RING_RATIO,
  computeRadialLayout,
  type GraphLayoutInput,
} from '../src/lib/graphLayout';

function input(): GraphLayoutInput {
  return {
    width: 800,
    height: 600,
    nodes: [
      { key: 'contact:1', type: 'contact', isFocus: false },
      { key: 'file:2', type: 'file', isFocus: false },
      { key: 'project:1', type: 'project', isFocus: false },
      { key: 'topic:1', type: 'topic', isFocus: false },
      { key: 'file:1', type: 'file', isFocus: false },
      { key: 'project:9', type: 'project', isFocus: true },
    ],
  };
}

describe('radial graph layout', () => {
  it('puts the focus at the center and the neighbours on one ring', () => {
    const result = computeRadialLayout(input());
    const byKey = new Map(result.nodes.map((node) => [node.key, node]));

    expect(result.centerX).toBe(400);
    expect(result.centerY).toBe(300);
    expect(result.radius).toBe(600 * GRAPH_RING_RATIO);

    const focus = byKey.get('project:9');
    expect(focus).toEqual({ key: 'project:9', x: 400, y: 300 });

    for (const node of result.nodes) {
      if (node.key === 'project:9') continue;
      const distance = Math.hypot(node.x - 400, node.y - 300);
      expect(distance).toBeCloseTo(result.radius, 6);
    }
  });

  it('is deterministic for repeated runs', () => {
    const first = computeRadialLayout(input());
    const second = computeRadialLayout(input());
    expect(second).toEqual(first);
  });

  it('assigns sectors in project -> file -> contact -> topic order', () => {
    const result = computeRadialLayout(input());
    const byKey = new Map(result.nodes.map((node) => [node.key, node]));

    // 从正上方顺时针：项目 72°，文件 2 个共 144°，联系人 72°，专题 72°
    const angleOf = (key: string) => {
      const node = byKey.get(key);
      if (!node) throw new Error(`missing ${key}`);
      return Math.atan2(node.y - 300, node.x - 400);
    };

    expect(angleOf('project:1')).toBeCloseTo((-Math.PI * 3) / 10, 6);
    expect(angleOf('file:1')).toBeCloseTo(Math.PI / 10, 6);
    expect(angleOf('file:2')).toBeCloseTo(Math.PI / 2, 6);
    expect(angleOf('contact:1')).toBeCloseTo((Math.PI * 9) / 10, 6);
    expect(angleOf('topic:1')).toBeCloseTo((-Math.PI * 7) / 10, 6);
  });

  it('returns only the focus when there are no neighbours', () => {
    const result = computeRadialLayout({
      width: 400,
      height: 300,
      nodes: [{ key: 'file:1', type: 'file', isFocus: true }],
    });

    expect(result.nodes).toEqual([{ key: 'file:1', x: 200, y: 150 }]);
  });
});
