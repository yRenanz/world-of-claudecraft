import { isBlocked, resolvePosition } from './colliders';
import { groundHeight, WATER_LEVEL } from './world';

// Local A* over a 1-yard grid, used for short forced moves (warrior Charge).
// The search window is the start/goal bounding box plus a margin, so cost
// stays tiny (Charge range is ~25yd). Cells are blocked by static colliders,
// deep water, and uphill steps too steep to climb; the caller supplies those
// thresholds so they can't drift from the movement rules in sim.ts.

export interface PathOpts {
  seed: number;
  bodyRadius: number;
  maxClimbSlope: number; // rise/run above which an uphill step is a wall
  minGround: number; // ground below this height is impassable (deep water)
  maxSpan?: number; // max searched cells per axis
}

const CELL = 1; // yards
const MARGIN = 8; // yards of slack around the start/goal bounding box
const MAX_SPAN = 64; // cells per axis; beyond this fall back to a straight line

export const PLAYER_BODY_RADIUS = 0.5;
export const PLAYER_MAX_CLIMB_SLOPE = 1.5;
export const PLAYER_SWIM_DEPTH = 0.8;

// Returns world-space waypoints from `from` to `to`, excluding the start and
// ending exactly at `to`. Falls back to [to] (straight line) when the window
// is too large, the goal is unreachable, or start and goal share a cell.
export function findPath(
  from: { x: number; z: number }, to: { x: number; z: number }, o: PathOpts,
): { x: number; z: number }[] {
  const minX = Math.min(from.x, to.x) - MARGIN;
  const minZ = Math.min(from.z, to.z) - MARGIN;
  const W = Math.ceil((Math.max(from.x, to.x) + MARGIN - minX) / CELL);
  const H = Math.ceil((Math.max(from.z, to.z) + MARGIN - minZ) / CELL);
  const maxSpan = o.maxSpan ?? MAX_SPAN;
  if (W > maxSpan || H > maxSpan) return [{ x: to.x, z: to.z }];
  const cx = (gx: number) => minX + (gx + 0.5) * CELL;
  const cz = (gz: number) => minZ + (gz + 0.5) * CELL;
  const toCell = (x: number, z: number) => ({
    gx: Math.min(W - 1, Math.max(0, Math.floor((x - minX) / CELL))),
    gz: Math.min(H - 1, Math.max(0, Math.floor((z - minZ) / CELL))),
  });
  const start = toCell(from.x, from.z);
  const goal = toCell(to.x, to.z);
  const startIdx = start.gz * W + start.gx;
  const goalIdx = goal.gz * W + goal.gx;
  if (startIdx === goalIdx) return [{ x: to.x, z: to.z }];

  // lazy per-cell caches: walkability and ground height
  const walk = new Int8Array(W * H); // 0 unknown, 1 walkable, -1 blocked
  const height = new Float64Array(W * H).fill(NaN);
  const groundAt = (i: number): number => {
    if (Number.isNaN(height[i])) height[i] = groundHeight(cx(i % W), cz((i / W) | 0), o.seed);
    return height[i];
  };
  const walkable = (i: number): boolean => {
    if (walk[i] === 0) {
      // the start and goal cells are always traversable: the mover is already
      // standing on one, and the slide in resolvePosition owns the last yard
      const ok = i === startIdx || i === goalIdx
        || (groundAt(i) >= o.minGround && !isBlocked(o.seed, cx(i % W), cz((i / W) | 0), o.bodyRadius));
      walk[i] = ok ? 1 : -1;
    }
    return walk[i] === 1;
  };

  const gScore = new Float64Array(W * H).fill(Infinity);
  const cameFrom = new Int32Array(W * H).fill(-1);
  // binary min-heap of [fScore, idx]
  const heap: number[][] = [];
  const heapPush = (item: number[]) => {
    heap.push(item);
    let i = heap.length - 1;
    while (i > 0) {
      const par = (i - 1) >> 1;
      if (heap[par][0] <= heap[i][0]) break;
      [heap[par], heap[i]] = [heap[i], heap[par]];
      i = par;
    }
  };
  const heapPop = (): number[] => {
    const top = heap[0];
    const last = heap.pop()!;
    if (heap.length > 0) {
      heap[0] = last;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1, r = l + 1;
        let m = i;
        if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
        if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
        if (m === i) break;
        [heap[m], heap[i]] = [heap[i], heap[m]];
        i = m;
      }
    }
    return top;
  };
  const octile = (gx: number, gz: number): number => {
    const dx = Math.abs(gx - goal.gx), dz = Math.abs(gz - goal.gz);
    return (Math.max(dx, dz) + (Math.SQRT2 - 1) * Math.min(dx, dz)) * CELL;
  };

  gScore[startIdx] = 0;
  heapPush([octile(start.gx, start.gz), startIdx]);
  let found = false;
  while (heap.length > 0) {
    const [, cur] = heapPop();
    if (cur === goalIdx) { found = true; break; }
    const gx = cur % W, gz = (cur / W) | 0;
    const hCur = groundAt(cur);
    for (let dz = -1; dz <= 1; dz++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dz === 0) continue;
        const nx = gx + dx, nz = gz + dz;
        if (nx < 0 || nx >= W || nz < 0 || nz >= H) continue;
        const n = nz * W + nx;
        if (!walkable(n)) continue;
        // diagonals only when both orthogonal cells are clear (no corner clipping)
        if (dx !== 0 && dz !== 0 && (!walkable(gz * W + nx) || !walkable(nz * W + gx))) continue;
        const stepLen = (dx !== 0 && dz !== 0 ? Math.SQRT2 : 1) * CELL;
        const rise = groundAt(n) - hCur;
        if (rise > 0 && rise / stepLen > o.maxClimbSlope) continue;
        const g = gScore[cur] + stepLen;
        if (g < gScore[n]) {
          gScore[n] = g;
          cameFrom[n] = cur;
          heapPush([g + octile(nx, nz), n]);
        }
      }
    }
  }
  if (!found) return [{ x: to.x, z: to.z }];

  // reconstruct, dropping collinear interior points
  const cells: number[] = [];
  for (let i = goalIdx; i !== -1; i = cameFrom[i]) cells.push(i);
  cells.reverse();
  const path: { x: number; z: number }[] = [];
  for (let k = 1; k < cells.length - 1; k++) {
    const dirIn = cells[k] - cells[k - 1];
    const dirOut = cells[k + 1] - cells[k];
    if (dirIn !== dirOut) path.push({ x: cx(cells[k] % W), z: cz((cells[k] / W) | 0) });
  }
  path.push({ x: to.x, z: to.z });
  return path;
}

export function findPlayerPath(
  seed: number,
  from: { x: number; z: number },
  to: { x: number; z: number },
  maxSpan = 128,
): { x: number; z: number }[] {
  return findPath(from, to, {
    seed,
    bodyRadius: PLAYER_BODY_RADIUS,
    maxClimbSlope: PLAYER_MAX_CLIMB_SLOPE,
    minGround: WATER_LEVEL - PLAYER_SWIM_DEPTH,
    maxSpan,
  });
}

function playerDestinationWalkable(seed: number, p: { x: number; z: number }): boolean {
  return groundHeight(p.x, p.z, seed) >= WATER_LEVEL - PLAYER_SWIM_DEPTH
    && !isBlocked(seed, p.x, p.z, PLAYER_BODY_RADIUS);
}

export function resolvePlayerDestination(seed: number, target: { x: number; z: number }): { x: number; z: number } {
  const pushed = resolvePosition(seed, target.x, target.z, PLAYER_BODY_RADIUS);
  if (playerDestinationWalkable(seed, pushed)) return pushed;

  let best: { x: number; z: number } | null = null;
  let bestD2 = Infinity;
  const rings = 24;
  for (let ring = 1; ring <= rings; ring++) {
    const radius = ring * 0.75;
    const samples = Math.max(12, Math.ceil(radius * 10));
    for (let i = 0; i < samples; i++) {
      const a = (i / samples) * Math.PI * 2;
      const raw = {
        x: target.x + Math.sin(a) * radius,
        z: target.z + Math.cos(a) * radius,
      };
      const p = resolvePosition(seed, raw.x, raw.z, PLAYER_BODY_RADIUS);
      if (!playerDestinationWalkable(seed, p)) continue;
      const dx = p.x - target.x, dz = p.z - target.z;
      const d2 = dx * dx + dz * dz;
      if (d2 < bestD2) {
        best = p;
        bestD2 = d2;
      }
    }
    if (best) return best;
  }
  return pushed;
}
