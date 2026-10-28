// 轻量四叉树：用于图谱节点命中检测
// 只依赖坐标，不引入第三方依赖；节点数量在 200 级别时查询为对数复杂度。

export interface QuadTreePoint {
  key: string;
  x: number;
  y: number;
}

export interface QuadBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

const DEFAULT_CAPACITY = 8;
const DEFAULT_MAX_DEPTH = 8;

function contains(bounds: QuadBounds, x: number, y: number): boolean {
  return (
    x >= bounds.x &&
    x <= bounds.x + bounds.width &&
    y >= bounds.y &&
    y <= bounds.y + bounds.height
  );
}

/** 点到矩形区域的最短距离平方 */
function distanceToBoundsSq(bounds: QuadBounds, x: number, y: number): number {
  const dx =
    x < bounds.x ? bounds.x - x : x > bounds.x + bounds.width ? x - (bounds.x + bounds.width) : 0;
  const dy =
    y < bounds.y ? bounds.y - y : y > bounds.y + bounds.height ? y - (bounds.y + bounds.height) : 0;
  return dx * dx + dy * dy;
}

class QuadTreeNode {
  private points: QuadTreePoint[] = [];
  private children: QuadTreeNode[] | null = null;

  constructor(
    private readonly bounds: QuadBounds,
    private readonly depth: number,
    private readonly capacity: number,
    private readonly maxDepth: number,
  ) {}

  insert(point: QuadTreePoint): void {
    if (!contains(this.bounds, point.x, point.y)) return;

    if (this.children) {
      for (const child of this.children) child.insert(point);
      return;
    }

    if (this.points.length < this.capacity || this.depth >= this.maxDepth) {
      this.points.push(point);
      return;
    }

    const children = this.subdivide();
    const existing = this.points;
    this.points = [];
    for (const item of existing) {
      for (const child of children) child.insert(item);
    }
    for (const child of children) child.insert(point);
  }

  private subdivide(): QuadTreeNode[] {
    const { x, y, width, height } = this.bounds;
    const halfWidth = width / 2;
    const halfHeight = height / 2;
    this.children = [
      new QuadTreeNode(
        { x, y, width: halfWidth, height: halfHeight },
        this.depth + 1,
        this.capacity,
        this.maxDepth,
      ),
      new QuadTreeNode(
        { x: x + halfWidth, y, width: halfWidth, height: halfHeight },
        this.depth + 1,
        this.capacity,
        this.maxDepth,
      ),
      new QuadTreeNode(
        { x, y: y + halfHeight, width: halfWidth, height: halfHeight },
        this.depth + 1,
        this.capacity,
        this.maxDepth,
      ),
      new QuadTreeNode(
        {
          x: x + halfWidth,
          y: y + halfHeight,
          width: halfWidth,
          height: halfHeight,
        },
        this.depth + 1,
        this.capacity,
        this.maxDepth,
      ),
    ];
    return this.children;
  }

  search(x: number, y: number, best: { point: QuadTreePoint | null; distSq: number }): void {
    if (distanceToBoundsSq(this.bounds, x, y) >= best.distSq) return;

    for (const point of this.points) {
      const dx = point.x - x;
      const dy = point.y - y;
      const distSq = dx * dx + dy * dy;
      if (distSq < best.distSq) {
        best.distSq = distSq;
        best.point = point;
      }
    }

    if (this.children) {
      for (const child of this.children) child.search(x, y, best);
    }
  }
}

export class QuadTree {
  private readonly root: QuadTreeNode;

  constructor(
    points: QuadTreePoint[],
    bounds: QuadBounds,
    capacity = DEFAULT_CAPACITY,
    maxDepth = DEFAULT_MAX_DEPTH,
  ) {
    this.root = new QuadTreeNode(bounds, 0, capacity, maxDepth);
    for (const point of points) this.root.insert(point);
  }

  /** 返回离目标点最近的节点；没有任何节点时返回 null */
  nearest(x: number, y: number): QuadTreePoint | null {
    const best: { point: QuadTreePoint | null; distSq: number } = {
      point: null,
      distSq: Number.POSITIVE_INFINITY,
    };
    this.root.search(x, y, best);
    return best.point;
  }
}

/** 由节点坐标构建四叉树；空数组返回 null */
export function buildQuadTree(
  points: QuadTreePoint[],
  options?: { capacity?: number; maxDepth?: number },
): QuadTree | null {
  if (points.length === 0) return null;

  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const point of points) {
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  }

  const padding = 1;
  const bounds: QuadBounds = {
    x: minX - padding,
    y: minY - padding,
    width: Math.max(maxX - minX + padding * 2, padding * 2),
    height: Math.max(maxY - minY + padding * 2, padding * 2),
  };

  return new QuadTree(points, bounds, options?.capacity, options?.maxDepth);
}
