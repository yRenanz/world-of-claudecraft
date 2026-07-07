// Protect Yumi maze interior: procedural walls/floor/accents for the far-east
// maze band, one view per match slot, built lazily by the renderer when the
// player is near (the arena pattern). Geometry derives from the SAME
// yumiMazeLayout the sim collides against, so what you see is exactly what
// blocks movement, spells, and the camera. Also owns the two team beacons:
// tall translucent pillars over each cat, readable above the 5yd walls from
// anywhere in the maze and identical on every gfx tier (the objective's
// position is actionable info per the fairness invariant; nothing here is
// tier-gated).
import * as THREE from 'three';
import { groundHeight } from '../sim/world';
import { YUMI_MAZE_WALL_HEIGHT, yumiMazeLayout } from '../sim/yumi_maze_layout';
import type { IWorld } from '../world_api';
import { surfaceMat } from './gfx';
import { stoneTexture } from './textures';

const TEAM_BLUE = 0x2f6fe0;
const TEAM_RED = 0xd8342c;
const CENTER_GOLD = 0xcaa84a;
const WALL_COLOR = 0x6b6257;
const FLOOR_COLOR = 0x4c463e;
const BEACON_HEIGHT = 12;
const BEACON_RADIUS = 0.7;

export interface YumiMazeView {
  group: THREE.Group;
  /** Per-frame: anchors the two team beacons to the live cat positions. */
  update(world: IWorld): void;
  dispose(): void;
}

export function buildYumiMaze(origin: { x: number; z: number }, seed: number): YumiMazeView {
  const group = new THREE.Group();
  const layout = yumiMazeLayout();
  const floorY = groundHeight(origin.x, origin.z, seed);
  group.position.set(origin.x, floorY, origin.z);

  // Walls: every stub (interior + shell) is one instance of a unit box,
  // scaled to its rect, so the whole maze is a single draw call.
  const stubs = [...layout.shell, ...layout.walls];
  const wallMat = surfaceMat({ color: WALL_COLOR, map: stoneTexture(), roughness: 0.9 });
  const walls = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), wallMat, stubs.length);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const pos = new THREE.Vector3();
  const scl = new THREE.Vector3();
  for (let i = 0; i < stubs.length; i++) {
    const s = stubs[i];
    pos.set(s.x, YUMI_MAZE_WALL_HEIGHT / 2, s.z);
    scl.set(s.hw * 2, YUMI_MAZE_WALL_HEIGHT, s.hd * 2);
    m.compose(pos, q, scl);
    walls.setMatrixAt(i, m);
  }
  walls.instanceMatrix.needsUpdate = true;
  walls.castShadow = false;
  walls.receiveShadow = true;
  group.add(walls);

  // Floor: one plane over the whole footprint.
  const floorTex = stoneTexture().clone();
  floorTex.wrapS = THREE.RepeatWrapping;
  floorTex.wrapT = THREE.RepeatWrapping;
  floorTex.repeat.set(12, 12);
  floorTex.needsUpdate = true;
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(layout.halfExtent * 2 + 2, layout.halfExtent * 2 + 2),
    surfaceMat({ color: FLOOR_COLOR, map: floorTex, roughness: 0.95 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0.02;
  floor.receiveShadow = true;
  group.add(floor);

  // Team accents: an emissive pad under each spawn plaza plus a neutral gold
  // ring at the center plaza, so orientation reads at a glance.
  const plazaHalf = layout.pitch * 2 - layout.wallHalf * 2;
  const accent = (cx: number, cz: number, color: number) => {
    const pad = new THREE.Mesh(
      new THREE.PlaneGeometry(plazaHalf, plazaHalf),
      surfaceMat({ color, emissive: color, emissiveIntensity: 0.55, roughness: 0.6 }),
    );
    pad.rotation.x = -Math.PI / 2;
    pad.position.set(cx, 0.05, cz);
    group.add(pad);
  };
  const spawnACenter = {
    x: (layout.spawnA[0].x + layout.spawnA[4].x) / 2,
    z: (layout.spawnA[0].z + layout.spawnA[4].z) / 2,
  };
  const spawnBCenter = {
    x: (layout.spawnB[0].x + layout.spawnB[4].x) / 2,
    z: (layout.spawnB[0].z + layout.spawnB[4].z) / 2,
  };
  accent(spawnACenter.x, spawnACenter.z, TEAM_BLUE);
  accent(spawnBCenter.x, spawnBCenter.z, TEAM_RED);
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(2.4, 3.2, 40),
    surfaceMat({
      color: CENTER_GOLD,
      emissive: CENTER_GOLD,
      emissiveIntensity: 0.6,
      roughness: 0.5,
      side: THREE.DoubleSide,
    }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.06;
  group.add(ring);

  // The two cat beacons: world-anchored, so they live on the SCENE-space
  // subgroup (the cats' coordinates are world coords, not maze-local).
  const beacons = new THREE.Group();
  beacons.position.set(-origin.x, -floorY, -origin.z); // undo the group offset
  group.add(beacons);
  const beacon = (color: number) => {
    const mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(BEACON_RADIUS, BEACON_RADIUS * 1.6, BEACON_HEIGHT, 12, 1, true),
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.32,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
      }),
    );
    mesh.visible = false;
    beacons.add(mesh);
    return mesh;
  };
  const beaconA = beacon(TEAM_BLUE);
  const beaconB = beacon(TEAM_RED);
  const lastA = { x: Number.NaN, z: Number.NaN, on: false };
  const lastB = { x: Number.NaN, z: Number.NaN, on: false };

  const place = (
    mesh: THREE.Mesh,
    last: { x: number; z: number; on: boolean },
    view: { x: number; z: number; alive: boolean } | undefined,
  ) => {
    const on = !!view?.alive;
    if (on !== last.on) {
      mesh.visible = on;
      last.on = on;
    }
    if (!view || !on) return;
    if (view.x !== last.x || view.z !== last.z) {
      const gy = groundHeight(view.x, view.z, seed);
      mesh.position.set(view.x, gy + BEACON_HEIGHT / 2, view.z);
      last.x = view.x;
      last.z = view.z;
    }
  };

  return {
    group,
    update(world: IWorld): void {
      const yumi = world.arenaInfo?.match?.yumi;
      place(beaconA, lastA, yumi?.yumiA);
      place(beaconB, lastB, yumi?.yumiB);
    },
    dispose(): void {
      group.removeFromParent();
      walls.dispose();
    },
  };
}
