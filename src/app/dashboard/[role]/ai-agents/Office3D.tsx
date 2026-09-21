'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CSS2DObject, CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { ACTIVITY_META, type Activity, type Agent } from '@/lib/aiAgents/types';
import { DESKS, ROOM, SCREEN_COLORS, makeCabinet, makeChair, makeCouch, makeDesk, makePlant, makeRobot, makeRoom, seatOf } from './officeScene';
import type { Bubble } from './BuildingView';

// The office as a room you can walk your eye around. Nothing here is invented:
// an agent sits at a desk when it is really working and walks the floor when it
// is free. The movement is only how that live state is drawn.

type Props = {
  agents: Agent[];
  activityOf: (id: string) => Activity | 'offline';
  taskOf: (id: string) => string;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  bubbles: Bubble[];
};

const BUSY: (Activity | 'offline')[] = ['working', 'reviewing', 'revising'];
const GREETINGS = ['Hey 👋', 'Morning!', 'Need anything?', 'Welcome back'];
const CHATTER = ['coffee?', 'nice one', 'ha', 'all yours'];
const loungeSpot = () => new THREE.Vector3(5.5 + Math.random() * 4.6, 0, -5.5 + Math.random() * 11);

type Body = {
  group: THREE.Group;
  legs: THREE.Object3D[];
  chest?: THREE.MeshStandardMaterial;
  el: HTMLDivElement;
  nameEl: HTMLElement;
  taskEl: HTMLElement;
  bubbleEl: HTMLElement;
  target: THREE.Vector3;
  phase: number;
};

export default function Office3D({ agents, activityOf, taskOf, selectedId, onSelect, bubbles }: Props) {
  const host = useRef<HTMLDivElement>(null);
  // The scene is built once and lives outside React; the latest props reach the
  // animation loop through this ref, refreshed after every render.
  const live = useRef<Props>(null);
  useEffect(() => { live.current = { agents, activityOf, taskOf, selectedId, onSelect, bubbles }; });

  useEffect(() => {
    const mount = host.current;
    if (!mount) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      const note = document.createElement('div');
      note.className = 'of-empty';
      note.textContent = 'This browser cannot show the 3D office.';
      mount.appendChild(note);
      return;
    }

    const width = () => mount.clientWidth || 900;
    const height = () => Math.max(420, Math.round(width() * 0.54));

    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
    renderer.setSize(width(), height());
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    mount.appendChild(renderer.domElement);

    const labels = new CSS2DRenderer();
    labels.setSize(width(), height());
    labels.domElement.className = 'o3-labels';
    mount.appendChild(labels.domElement);

    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(36, width() / height(), 0.1, 200);
    camera.position.set(17, 15, 21);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(-1, 1.2, 0);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 7;
    controls.maxDistance = 48;
    controls.maxPolarAngle = Math.PI / 2.15;
    controls.update();

    scene.add(new THREE.HemisphereLight(0xffffff, 0xccd7e6, 2.1));
    const sun = new THREE.DirectionalLight(0xffffff, 1.6);
    sun.position.set(13, 20, 9);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = -20;
    sun.shadow.camera.right = 20;
    sun.shadow.camera.top = 20;
    sun.shadow.camera.bottom = -20;
    sun.shadow.bias = -0.0008;
    scene.add(sun);

    scene.add(makeRoom());
    DESKS.forEach((d, i) => {
      const desk = makeDesk(SCREEN_COLORS[i % SCREEN_COLORS.length]);
      desk.position.set(d.x, 0, d.z);
      scene.add(desk);
      const chair = makeChair();
      const s = seatOf(d);
      chair.position.set(s.x, 0, s.z + 0.18);
      scene.add(chair);
    });

    const couch = makeCouch();
    couch.position.set(9.8, 0, 4.4);
    couch.rotation.y = -Math.PI / 2;
    scene.add(couch);
    for (const [x, z] of [[11.6, -7], [-11.4, 7.4], [9.2, -1.5]]) {
      const plant = makePlant();
      plant.position.set(x, 0, z);
      scene.add(plant);
    }
    const cabinet = makeCabinet(3, 1.4);
    cabinet.position.set(6, 0, -ROOM.d / 2 + 0.6);
    scene.add(cabinet);
    const shelf = makeCabinet(1.4, 2.4);
    shelf.position.set(10.4, 0, -ROOM.d / 2 + 0.6);
    scene.add(shelf);

    // The ring that marks whoever is open in the side panel.
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.62, 0.78, 32),
      new THREE.MeshBasicMaterial({ color: 0x7c3aed, transparent: true, opacity: 0.85, side: THREE.DoubleSide }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.03;
    ring.visible = false;
    scene.add(ring);

    // ── The people ───────────────────────────────────────────────────────────
    const bodies = new Map<string, Body>();

    // Someone already at work is put straight at their desk; everyone else
    // appears on the floor and walks from there.
    const ensure = (agent: Agent, at?: THREE.Vector3) => {
      const found = bodies.get(agent.id);
      if (found) return found;

      const group = makeRobot(0x94a3b8);
      group.userData.agentId = agent.id;
      group.position.copy(at ?? loungeSpot());

      const el = document.createElement('div');
      el.className = 'o3-label';
      const bubbleEl = document.createElement('i');
      bubbleEl.className = 'o3-bubble';
      const nameEl = document.createElement('b');
      const taskEl = document.createElement('span');
      el.append(bubbleEl, nameEl, taskEl);
      const label = new CSS2DObject(el);
      label.position.set(0, 2.55, 0);
      group.add(label);
      scene.add(group);

      const chestMesh = group.getObjectByName('chest') as THREE.Mesh | undefined;
      const body: Body = {
        group,
        legs: group.getObjectByName('legs')?.children ?? [],
        chest: chestMesh?.material as THREE.MeshStandardMaterial | undefined,
        el, nameEl, taskEl, bubbleEl,
        target: group.position.clone(),
        phase: Math.random() * 6,
      };
      bodies.set(agent.id, body);
      return body;
    };

    const drop = (id: string, b: Body) => {
      scene.remove(b.group);
      b.el.remove();
      b.group.traverse(o => {
        const m = o as THREE.Mesh;
        if (m.isMesh) m.geometry.dispose();
      });
      bodies.delete(id);
    };

    // ── Clicking someone, without stealing the drag from the camera ──────────
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let down: { x: number; y: number } | null = null;

    const onDown = (e: PointerEvent) => { down = { x: e.clientX, y: e.clientY }; };
    const onUp = (e: PointerEvent) => {
      const start = down;
      down = null;
      if (!start || Math.hypot(e.clientX - start.x, e.clientY - start.y) > 5) return;
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects([...bodies.values()].map(b => b.group), true);
      let node: THREE.Object3D | null = hits[0]?.object ?? null;
      while (node && !node.userData.agentId) node = node.parent;
      const id = node?.userData.agentId as string | undefined;
      const now = live.current;
      if (now) now.onSelect(id ? (now.selectedId === id ? null : id) : null);
    };
    renderer.domElement.addEventListener('pointerdown', onDown);
    renderer.domElement.addEventListener('pointerup', onUp);

    // Someone free says hello when you come back to the screen, and they trade
    // the odd word when they end up standing together.
    const said = new Map<string, { text: string; until: number }>();
    const say = (id: string, text: string, ms: number) => said.set(id, { text, until: Date.now() + ms });
    let lastSeen = Date.now();
    let lastHello = 0;
    const onMove = () => {
      const now = Date.now();
      const away = now - lastSeen;
      lastSeen = now;
      if (away < 60_000 || now - lastHello < 90_000) return;
      const free = (live.current?.agents ?? []).filter(a => a.in_office && !BUSY.includes(live.current!.activityOf(a.id)));
      const who = free[Math.floor(Math.random() * free.length)];
      if (!who) return;
      lastHello = now;
      say(who.id, GREETINGS[Math.floor(Math.random() * GREETINGS.length)], 4200);
    };
    window.addEventListener('mousemove', onMove, { passive: true });

    const resize = () => {
      const [w, h] = [width(), height()];
      renderer.setSize(w, h);
      labels.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(mount);

    const colour = new THREE.Color();
    const step = new THREE.Vector3();
    const started = performance.now();
    let last = started;
    let raf = 0;
    let nextWander = 0;

    const tick = () => {
      raf = requestAnimationFrame(tick);
      const state = live.current;
      if (!state) return;
      const stamp = performance.now();
      const dt = Math.min(0.05, (stamp - last) / 1000);
      last = stamp;
      const t = (stamp - started) / 1000;
      const now = Date.now();

      const staff = state.agents.filter(a => a.in_office && a.status !== 'archived');
      const seats = new Map<string, number>();
      staff.filter(a => BUSY.includes(state.activityOf(a.id))).forEach((a, i) => seats.set(a.id, i % DESKS.length));

      for (const [id, b] of bodies) if (!staff.some(a => a.id === id)) drop(id, b);

      // Everyone who is free picks a new spot now and then, and two of them
      // sometimes end up in the same corner.
      if (t > nextWander) {
        nextWander = t + 6.5;
        const free = staff.filter(a => !seats.has(a.id));
        for (const a of free) if (Math.random() < 0.6) ensure(a).target.copy(loungeSpot());
        if (free.length > 1 && Math.random() < 0.45) {
          const a = free[Math.floor(Math.random() * free.length)];
          const b = free[Math.floor(Math.random() * free.length)];
          if (a.id !== b.id) {
            const at = loungeSpot();
            ensure(a).target.copy(at);
            ensure(b).target.set(at.x + 1.7, 0, at.z + 0.4);
            say(a.id, CHATTER[Math.floor(Math.random() * CHATTER.length)], 2600);
          }
        }
      }

      for (const agent of staff) {
        const act = state.activityOf(agent.id);
        const desk = seats.get(agent.id);
        const seated = desk !== undefined;
        const seat = seated ? seatOf(DESKS[desk]) : null;
        const b = ensure(agent, seat ? new THREE.Vector3(seat.x, 0, seat.z + 0.1) : undefined);

        if (b.chest) {
          colour.set(ACTIVITY_META[act].color);
          b.chest.color.copy(colour);
          b.chest.emissive.copy(colour);
        }

        if (seat) b.target.set(seat.x, 0, seat.z + 0.1);

        const pos = b.group.position;
        const gap = Math.hypot(b.target.x - pos.x, b.target.z - pos.z);
        const walking = gap > 0.08;
        if (walking) {
          step.set(b.target.x - pos.x, 0, b.target.z - pos.z).normalize();
          const by = Math.min(gap, dt * (seated ? 3.6 : 1.8));
          pos.x += step.x * by;
          pos.z += step.z * by;
          b.group.rotation.y = Math.atan2(step.x, step.z);
        } else if (seated) {
          b.group.rotation.y = Math.PI;
        }

        const swing = Math.sin(t * 7 + b.phase);
        b.legs.forEach((leg, i) => { leg.rotation.x = seated ? -1.15 : walking ? swing * (i === 0 ? 0.42 : -0.42) : 0; });
        pos.y = seated ? 0.06 : walking ? Math.abs(swing) * 0.05 : Math.sin(t * 1.6 + b.phase) * 0.015;

        if (state.selectedId === agent.id) {
          ring.visible = true;
          ring.position.set(pos.x, 0.03, pos.z);
        }

        const task = state.taskOf(agent.id);
        const heard = said.get(agent.id);
        const bubble = state.bubbles.filter(x => x.agentId === agent.id).at(-1)?.text
          ?? (heard && heard.until > now ? heard.text : '');
        b.el.className = `o3-label${state.selectedId === agent.id ? ' sel' : ''}${seated ? ' busy' : ''}`;
        b.nameEl.textContent = agent.name;
        b.taskEl.textContent = seated && task ? (task.length > 34 ? `${task.slice(0, 34)}…` : task) : '';
        b.bubbleEl.textContent = bubble;
        b.bubbleEl.style.display = bubble ? '' : 'none';
      }

      // Nobody stands inside anybody else.
      const free = staff.filter(a => !seats.has(a.id)).map(a => bodies.get(a.id)).filter(Boolean) as Body[];
      for (let i = 0; i < free.length; i++) {
        for (let j = i + 1; j < free.length; j++) {
          const [p, q] = [free[i].group.position, free[j].group.position];
          const gap = Math.hypot(p.x - q.x, p.z - q.z);
          if (gap > 0.95 || gap < 0.001) continue;
          const push = (0.95 - gap) / 2;
          const ux = (p.x - q.x) / gap;
          const uz = (p.z - q.z) / gap;
          p.x += ux * push; p.z += uz * push;
          q.x -= ux * push; q.z -= uz * push;
        }
      }

      if (!state.selectedId || !bodies.has(state.selectedId)) ring.visible = false;

      controls.update();
      renderer.render(scene, camera);
      labels.render(scene, camera);
    };
    tick();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener('mousemove', onMove);
      renderer.domElement.removeEventListener('pointerdown', onDown);
      renderer.domElement.removeEventListener('pointerup', onUp);
      controls.dispose();
      scene.traverse(o => {
        const m = o as THREE.Mesh;
        if (!m.isMesh) return;
        m.geometry.dispose();
        for (const mat of Array.isArray(m.material) ? m.material : [m.material]) mat.dispose();
      });
      renderer.dispose();
      for (const b of bodies.values()) b.el.remove();
      bodies.clear();
      renderer.domElement.remove();
      labels.domElement.remove();
    };
  }, []);

  return <div ref={host} className="o3-stage" />;
}
