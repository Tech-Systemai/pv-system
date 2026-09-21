import * as THREE from 'three';

// The furniture and the robots, built once and reused. Everything is plain
// geometry so the scene stays light enough to run inside the portal.

export const ROOM = { w: 24, d: 17 };

export const DESKS: { x: number; z: number }[] = [
  { x: -8, z: -5 }, { x: -3, z: -5 }, { x: 2, z: -5 },
  { x: -8, z: 0 }, { x: -3, z: 0 }, { x: 2, z: 0 },
  { x: -8, z: 5 }, { x: -3, z: 5 }, { x: 2, z: 5 },
];
/** The chair sits in front of its desk, facing it. */
export const seatOf = (d: { x: number; z: number }) => ({ x: d.x, z: d.z + 1.6 });

export const SCREEN_COLORS = [0x38bdf8, 0xfb923c, 0xa78bfa, 0x34d399, 0xf472b6, 0xfacc15];

const WHITE = 0xf7f9fc;
const GREY = 0xd7dee8;
const DARK = 0x23262e;

const mat = (color: number, opts: THREE.MeshStandardMaterialParameters = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.75, metalness: 0.05, ...opts });

function box(w: number, h: number, d: number, color: number, opts?: THREE.MeshStandardMaterialParameters) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color, opts));
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

export function makeRoom() {
  const g = new THREE.Group();

  const floor = box(ROOM.w, 0.6, ROOM.d, 0xfdfdff);
  floor.position.y = -0.3;
  floor.receiveShadow = true;
  g.add(floor);

  // A faint grid so the floor reads as a floor.
  const grid = new THREE.GridHelper(Math.max(ROOM.w, ROOM.d), Math.max(ROOM.w, ROOM.d), 0xdfe6ee, 0xeef2f7);
  grid.position.y = 0.011;
  (grid.material as THREE.Material).transparent = true;
  (grid.material as THREE.Material).opacity = 0.5;
  g.add(grid);

  // Glass along the two far walls, with slim mullions.
  const glass = new THREE.MeshPhysicalMaterial({ color: 0xdcecff, transparent: true, opacity: 0.28, roughness: 0.05, metalness: 0, transmission: 0.6, side: THREE.DoubleSide });
  const back = new THREE.Mesh(new THREE.PlaneGeometry(ROOM.w, 6), glass);
  back.position.set(0, 3, -ROOM.d / 2);
  g.add(back);
  const left = new THREE.Mesh(new THREE.PlaneGeometry(ROOM.d, 6), glass);
  left.rotation.y = Math.PI / 2;
  left.position.set(-ROOM.w / 2, 3, 0);
  g.add(left);
  for (let i = -ROOM.w / 2; i <= ROOM.w / 2; i += 2.6) {
    const m = box(0.08, 6, 0.08, WHITE);
    m.position.set(i, 3, -ROOM.d / 2);
    g.add(m);
  }
  for (let i = -ROOM.d / 2; i <= ROOM.d / 2; i += 2.6) {
    const m = box(0.08, 6, 0.08, WHITE);
    m.position.set(-ROOM.w / 2, 3, i);
    g.add(m);
  }

  return g;
}

export function makeDesk(screen: number) {
  const g = new THREE.Group();
  const top = box(3.2, 0.12, 1.6, WHITE);
  top.position.y = 1.05;
  g.add(top);
  for (const [x, z] of [[-1.5, -0.7], [1.5, -0.7], [-1.5, 0.7], [1.5, 0.7]]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.05, 8), mat(GREY));
    leg.position.set(x, 0.52, z);
    g.add(leg);
  }
  const stand = box(0.12, 0.35, 0.12, GREY);
  stand.position.set(0, 1.28, -0.45);
  g.add(stand);
  const monitor = box(1.5, 0.9, 0.07, 0xeef2f7);
  monitor.position.set(0, 1.9, -0.45);
  g.add(monitor);
  const face = new THREE.Mesh(new THREE.PlaneGeometry(1.36, 0.76), new THREE.MeshBasicMaterial({ color: screen }));
  face.position.set(0, 1.9, -0.41);
  g.add(face);
  const keyboard = box(0.9, 0.04, 0.3, 0xe6ecf3);
  keyboard.position.set(0, 1.13, 0.25);
  g.add(keyboard);
  return g;
}

export function makeChair() {
  const g = new THREE.Group();
  const seat = box(0.78, 0.12, 0.72, 0xdbe3ec);
  seat.position.y = 0.62;
  g.add(seat);
  const back = box(0.74, 0.7, 0.1, 0xcdd7e3);
  back.position.set(0, 1.0, 0.33);
  g.add(back);
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.55, 8), mat(0xb3bdca));
  stem.position.y = 0.3;
  g.add(stem);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.06, 12), mat(0xc7d0dc));
  base.position.y = 0.05;
  g.add(base);
  return g;
}

export function makePlant() {
  const g = new THREE.Group();
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.26, 0.5, 12), mat(0xe2e8f0));
  pot.position.y = 0.25;
  g.add(pot);
  for (const [x, y, z, r] of [[0, 0.95, 0, 0.55], [-0.3, 0.75, 0.15, 0.36], [0.28, 0.8, -0.12, 0.32]]) {
    const leaf = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 0), mat(0x4ea15c, { flatShading: true }));
    leaf.position.set(x, y, z);
    g.add(leaf);
  }
  return g;
}

export function makeCouch() {
  const g = new THREE.Group();
  const seat = box(3.4, 0.5, 1.5, 0xcfd9e6);
  seat.position.y = 0.4;
  g.add(seat);
  const back = box(3.4, 0.8, 0.3, 0xbac7d8);
  back.position.set(0, 0.9, -0.6);
  g.add(back);
  return g;
}

export function makeCabinet(w = 1.6, h = 1.2) {
  const g = new THREE.Group();
  const body = box(w, h, 0.7, 0xeef2f7);
  body.position.y = h / 2;
  g.add(body);
  for (let i = 1; i < Math.round(h / 0.4); i++) {
    const line = box(w * 0.98, 0.02, 0.72, 0xdbe3ec);
    line.position.y = i * 0.4;
    g.add(line);
  }
  return g;
}

/** One agent: white shell, dark visor, red eyes, status colour across the chest. */
export function makeRobot(color: number) {
  const g = new THREE.Group();

  const hips = box(0.5, 0.18, 0.34, GREY);
  hips.position.y = 0.72;
  g.add(hips);
  const legs = new THREE.Group();
  for (const x of [-0.14, 0.14]) {
    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.5, 4, 8), mat(0xe7ebf1));
    leg.position.set(x, 0.42, 0);
    legs.add(leg);
  }
  legs.name = 'legs';
  g.add(legs);

  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 0.5, 6, 12), mat(WHITE));
  torso.position.y = 1.2;
  g.add(torso);
  const core = box(0.3, 0.42, 0.26, DARK);
  core.position.set(0, 1.18, 0.12);
  g.add(core);
  const chest = box(0.5, 0.1, 0.3, color, { emissive: color, emissiveIntensity: 0.35 });
  chest.position.set(0, 1.46, 0.06);
  chest.name = 'chest';
  g.add(chest);

  for (const x of [-0.38, 0.38]) {
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.08, 0.45, 4, 8), mat(0xe7ebf1));
    arm.position.set(x, 1.18, 0);
    g.add(arm);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), mat(DARK));
    hand.position.set(x, 0.9, 0);
    g.add(hand);
  }

  const neck = box(0.14, 0.12, 0.14, 0x3c4048);
  neck.position.y = 1.62;
  g.add(neck);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.29, 18, 14), mat(WHITE, { roughness: 0.4 }));
  head.position.y = 1.9;
  head.scale.set(1, 1.08, 0.95);
  g.add(head);
  const visor = new THREE.Mesh(new THREE.SphereGeometry(0.265, 18, 14, 0, Math.PI, Math.PI * 0.22, Math.PI * 0.42), mat(0x14161c, { roughness: 0.25 }));
  visor.position.y = 1.9;
  visor.rotation.y = Math.PI / 2;
  g.add(visor);
  for (const x of [-0.1, 0.1]) {
    const eye = new THREE.Mesh(new THREE.PlaneGeometry(0.09, 0.035), new THREE.MeshBasicMaterial({ color: 0xff3b30 }));
    eye.position.set(x, 1.92, 0.265);
    eye.rotation.z = x < 0 ? 0.25 : -0.25;
    g.add(eye);
  }

  g.traverse(o => { if ((o as THREE.Mesh).isMesh) { o.castShadow = true; } });
  return g;
}
