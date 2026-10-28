import { describe, expect, it } from 'vitest';
import { normalizeSidebarOrder, resolveSidebarDragOrder } from '../src/lib/sidebarOrder';

// 与 src/stores/useUiStore.ts 的 DEFAULT_SIDEBAR_ORDER / Sidebar.tsx 的 NAV_DEFS 保持一致
const ALL_KEYS = ['inbox', 'calendar', 'contacts', 'projects', 'kb', 'web', 'graph'] as const;
type Key = (typeof ALL_KEYS)[number];
const VALID: Key[] = [...ALL_KEYS];

/** 旧版本持久化数据：网页/关系图功能加入前的顺序（只有 5 项） */
const LEGACY_ORDER: Key[] = ['inbox', 'calendar', 'contacts', 'projects', 'kb'];

describe('normalizeSidebarOrder', () => {
  it('完整顺序原样返回', () => {
    expect(normalizeSidebarOrder(VALID, VALID)).toEqual(VALID);
  });

  it('末尾按 validKeys 顺序补全新增项', () => {
    expect(normalizeSidebarOrder(LEGACY_ORDER, VALID)).toEqual([
      'inbox',
      'calendar',
      'contacts',
      'projects',
      'kb',
      'web',
      'graph',
    ]);
  });

  it('过滤非法 key', () => {
    const withInvalid: string[] = [...LEGACY_ORDER, 'settings'];
    expect(normalizeSidebarOrder(withInvalid, VALID)).toEqual([...ALL_KEYS]);
  });

  it('去重', () => {
    const dup: Key[] = ['inbox', 'inbox', 'calendar'];
    expect(normalizeSidebarOrder(dup, VALID)).toEqual([...ALL_KEYS]);
  });

  it('幂等：归一化结果再次归一化不变', () => {
    const once = normalizeSidebarOrder(LEGACY_ORDER, VALID);
    expect(normalizeSidebarOrder(once, VALID)).toEqual(once);
  });
});

describe('resolveSidebarDragOrder', () => {
  it('向下换位', () => {
    const next = resolveSidebarDragOrder(VALID, VALID, 'calendar', 'contacts');
    expect(next).toEqual(['inbox', 'contacts', 'calendar', 'projects', 'kb', 'web', 'graph']);
  });

  it('向上换位', () => {
    const next = resolveSidebarDragOrder(VALID, VALID, 'contacts', 'calendar');
    expect(next).toEqual(['inbox', 'contacts', 'calendar', 'projects', 'kb', 'web', 'graph']);
  });

  it('拖到原位置返回 null', () => {
    expect(resolveSidebarDragOrder(VALID, VALID, 'inbox', 'inbox')).toBeNull();
  });

  it('active/over 不在合法列表中返回 null', () => {
    const order: string[] = [...VALID];
    const keys: string[] = [...VALID];
    expect(resolveSidebarDragOrder(order, keys, 'settings', 'inbox')).toBeNull();
    expect(resolveSidebarDragOrder(order, keys, 'inbox', 'settings')).toBeNull();
  });

  // 回归：旧版持久化顺序（缺 web/graph）下拖动新增项，松手后不得复位
  it('回归：旧持久化顺序 + 拖动末尾新增项（web/graph）向上，必须生效且自愈', () => {
    // 渲染列表 = [inbox, calendar, contacts, projects, kb, web, graph]
    // 用户拖最底部的 graph 到 calendar 位置
    const next = resolveSidebarDragOrder(LEGACY_ORDER, VALID, 'graph', 'calendar');
    expect(next).not.toBeNull();
    expect(next).toEqual(['inbox', 'graph', 'calendar', 'contacts', 'projects', 'kb', 'web']);
    // 自愈：写回的顺序包含全部 7 项，再次归一化不变
    expect(normalizeSidebarOrder(next!, VALID)).toEqual(next);
  });

  it('回归：旧持久化顺序 + 相邻两项（kb↔web）向上交换，不得复位', () => {
    const next = resolveSidebarDragOrder(LEGACY_ORDER, VALID, 'web', 'kb');
    expect(next).toEqual(['inbox', 'calendar', 'contacts', 'projects', 'web', 'kb', 'graph']);
  });

  it('回归：旧持久化顺序 + 相邻两项（web↔graph）向上交换，不得复位', () => {
    const next = resolveSidebarDragOrder(LEGACY_ORDER, VALID, 'graph', 'web');
    expect(next).toEqual(['inbox', 'calendar', 'contacts', 'projects', 'kb', 'graph', 'web']);
  });

  it('回归：旧持久化顺序 + 向下拖到新增项上', () => {
    const next = resolveSidebarDragOrder(LEGACY_ORDER, VALID, 'projects', 'web');
    expect(next).toEqual(['inbox', 'calendar', 'contacts', 'kb', 'web', 'projects', 'graph']);
  });

  it('结果不含 undefined 且长度等于合法项总数', () => {
    const next = resolveSidebarDragOrder(LEGACY_ORDER, VALID, 'graph', 'inbox');
    expect(next).toHaveLength(VALID.length);
    expect(next).not.toContain(undefined);
  });
});
