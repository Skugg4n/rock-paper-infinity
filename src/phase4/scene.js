/**
 * Chapter IV · THE DEEP: the model. A true 3D view of the colony, built from
 * the rules in deep.js and the positions in layout.js. Ported from the locked
 * visual reference, docs/mockups/deep-3d-8.html: two colours, sharp slabs,
 * floors round a shaft, a seeded map on every plate, people on a walking graph,
 * stairs taken on foot through the openings in the shaft wall.
 *
 * The scene knows nothing about buying or time. It is handed a state and a
 * layout and it draws them; `step(dt)` moves the people and renders. Game time
 * is advanced by the phase, never here.
 *
 * three.js and its addons come from the importmap in index.html: the one place
 * the CDN is named.
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { placeChamber, floorCount } from './layout.js';
import { digCost } from './deep.js';

/* TWO COLOURS, and since v1.41.1 they are the other way round (Ola: "we build in
   life and light, buried in black stone"). ROCK is the background and everything cut
   into a slab: the lanes, the houses, the openings. PLATE is every slab, every bridge,
   the shaft, in one flat light colour, and the lamp above leaves the tops brighter
   than the sides. The people are dark dots on that light ground. */
const ROCK = 0x0a0d12;
const PLATE = 0xd5dbe3;
/* v1.43.0 (B059): the playtest could not see anyone. Dark dots on black lanes were
   invisible, so the lanes are now a mid grey cut into the light slab (the houses stay
   rock), and the people are bright white and one step larger: white on grey reads,
   and white on the light slab still reads as a spark where they cross it. */
const LANE = 0x7b8595;
const PEOPLE = 0xffffff;
const PEOPLE_SIZE = 0.085;

const PITCH = 2.6;        // cell to cell
const PLATE_W = 2.0;      // a slab is this wide, so the street between two is 0.6
const PLATE_H = 0.26;     // and this thin
const FLOOR_GAP = 3.2;
const SHAFT_R = 0.52;
const WALK_Y = 0.17;      // the people walk just above the lanes
const LANE_W = 0.14;
const SIDE_W = 0.10;
const STUB_W = 0.07;
const R_ROOM = 0.55;      // the ring runs at this radius around a room
const R_HUB = 0.80;       // wider on a landing, so it clears the shaft and the hatch
const EDGE = 0.97;        // nothing is cut closer than this to the slab's edge
const MAX_DOTS = 160;     // the colony grows past counting; the crowd does not
/* THE SHAFT UP AND THE CRUST (v1.45.0). Ola: "we mention a shaft up to the earth but there is
   nothing graphic." Now there is: a pipe in plate colour from the hatch on the lid up to the
   crust, a flat slab of burnt ground over the colony that carries the ring. The top of the pipe
   is rubble until the first party goes out, then a dark opening. Parties are dots that climb a
   stair wound round the outside of the pipe and vanish into the crust; they come down the same
   way, or they do not. */
const CRUST = 0x353e4a;         // burnt ground: darker than a plate, lighter than the rock
const CRUST_LIT = 0x8b97a8;     // the day the colony goes up and there is a sky
const RUBBLE = 0x4a5361;
const CRUST_Y = 4.4;            // the underside of the crust, over the lid
const CRUST_T = 0.34;
const CRUST_W = 4.6;
const SHAFT_UP_R = 0.34;
const LID_TOP = PLATE_H / 2 + 0.24;     // the top of the bar across the hatch
const MAX_SCOUT_DOTS = 14;      // a party of sixty is drawn as fourteen
const SCOUT_BUFFER = MAX_SCOUT_DOTS * 3;   // one party going up while one comes down, and a spare
const SCOUT_SECONDS = 6;        // the walk to the hatch and the climb, start to finish
/* a party is amber, the colour of the line on the ring they go up to read: white dots on the
   plate-coloured pipe would vanish against it */
const SCOUT = 0xe0a24f;
const SCOUT_SIZE = 0.17;
/* Chapter I's own three glyphs (rock is the gem there), and the star a win makes. */
const MACHINE_HTML = '<span class="deep-machine">'
    + '<span class="rps is-on"><i data-lucide="gem" class="w-3.5 h-3.5"></i></span>'
    + '<span class="rps"><i data-lucide="file-text" class="w-3.5 h-3.5"></i></span>'
    + '<span class="rps"><i data-lucide="scissors" class="w-3.5 h-3.5"></i></span>'
    + '<span class="win"><i data-lucide="star" class="w-3.5 h-3.5"></i></span></span>';

/* THE BASE SOFTENS (v1.46.0). While the colony sleeps the Watcher keeps the structure, and as
   its stability falls the plates, the lanes cut into them and the shaft lose their rigidity:
   every vertex is moved by a slow swell, a sag and a fine jitter, all functions of where it
   stands in the world and of the time, so neighbouring slabs bend together. Done in the vertex
   shader (one uniform for the amplitude), so it costs nothing per frame on the CPU and the
   two colours stay two colours. A click snaps it rigid again, with a soft flash. */
const SOFT_AMP = 0.42;          // world units of movement at full softness (a slab is 0.26 thick)
const SOFT_FOLLOW = 0.8;        // how fast the softness follows the stability, per second
const SNAP_EASE = 0.28;         // seconds the snap takes
const SNAP_HOLD = 1.6;          // seconds it stays rigid before it starts to give again
const SNAP_RETURN = 0.22;       // and how slowly it gives, per second
const SOFT_GLSL = `
uniform float uSoft;
uniform float uTime;
vec3 deepSoft(vec3 p) {
    if (uSoft <= 0.0) return vec3(0.0);
    float swell = sin(p.x * 1.3 + uTime * 0.9) * sin(p.z * 1.1 - uTime * 0.7);
    float sag = sin(p.x * 0.55 + p.z * 0.4 + uTime * 0.45);
    float jit = sin(p.x * 9.0 + uTime * 17.0) * sin(p.z * 8.0 - uTime * 13.0);
    return uSoft * vec3(
        0.22 * sin(p.y * 0.9 + p.z * 0.8 + uTime * 0.6) + 0.04 * jit,
        0.55 * swell + 0.35 * sag + 0.06 * jit,
        0.22 * sin(p.y * 0.8 + p.x * 0.9 - uTime * 0.5) + 0.04 * jit);
}
`;

/** Which glyph stands for which room. */
export const ROOM_ICON = { mine: 'pickaxe', farm: 'sprout', generator: 'zap', dorm: 'bed', cryo: 'snowflake' };

// sides of a ring: 0 north, 1 east, 2 south, 3 west
const SIDE_OUT = [[0, -1], [1, 0], [0, 1], [-1, 0]];
const SIDE_ALONG = [[1, 0], [0, 1], [-1, 0], [0, -1]];
const DIR_SIDE = { '0,-1': 0, '1,0': 1, '0,1': 2, '-1,0': 3 };
// how big a house can be: width along the lane, depth away from it
const HOUSE = [
    [0.16, 0.16], [0.26, 0.18], [0.40, 0.14], [0.20, 0.24],
    [0.32, 0.22], [0.14, 0.22], [0.46, 0.13], [0.22, 0.20],
];

function mulberry32(a) {
    return function () {
        a |= 0; a = a + 0x6D2B79F5 | 0;
        let t = Math.imul(a ^ a >>> 15, 1 | a);
        t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
}
/** A plate's map is grown from where it is, so it is the same on every reload
 *  and different from every other plate. */
function plateSeed(fi, x, z) {
    return mulberry32(((fi + 1) * 73856093 ^ (x + 9) * 19349663 ^ (z + 9) * 83492791) >>> 0);
}

/** True when this browser can draw the deep at all. */
export function supportsWebGL() {
    try {
        const c = document.createElement('canvas');
        return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
    } catch {
        return false;
    }
}

/** What the scene needs to know it must be rebuilt rather than refreshed. */
function structureKey(state, layout) {
    return [
        state.chambers,
        (layout.slots || []).map((s) => s || '.').join(''),
        Object.keys(state.auto).sort().map((t) => `${t}${state.auto[t]}`).join(''),
    ].join('|');
}

/**
 * Builds the model inside `container` and hands back the handful of things the
 * phase needs. The scene owns no timers: the phase calls `step(dt)` per frame.
 *
 * @param {HTMLElement} container - the element the canvas fills
 * @param {object} [opts]
 * @param {HTMLElement} [opts.labelHost] - where the CSS2D labels are put (defaults to `container`)
 * @param {Function} [opts.onInteract] - called the first time the player rotates or zooms
 * @param {Function} [opts.onLabels] - called after labels are (re)built, so icons can be drawn
 * @returns {{setState:Function, step:Function, resize:Function, resetView:Function, dispose:Function}}
 */
export function createScene(container, opts = {}) {
    const labelHost = opts.labelHost || container;
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    let W = container.clientWidth || window.innerWidth;
    let H = container.clientHeight || window.innerHeight;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(W, H);
    renderer.setClearColor(ROCK, 1);
    container.appendChild(renderer.domElement);

    const labelRenderer = new CSS2DRenderer({ element: labelHost });
    labelRenderer.setSize(W, H);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(ROCK);

    let defPos = new THREE.Vector3(12.5, 6.8, 17);
    let defTgt = new THREE.Vector3(0.8, -4.6, 0);

    const camera = new THREE.PerspectiveCamera(40, W / H, 0.1, 400);
    camera.position.copy(defPos);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.copy(defTgt);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.enablePan = true;                 // right drag
    controls.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN };
    controls.enableZoom = true;
    controls.minDistance = 9;
    controls.maxDistance = 70;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.3;
    controls.minPolarAngle = 0.42;             // never straight above
    controls.maxPolarAngle = 1.33;             // never under the floors
    controls.update();

    let touched = false;
    function tookHold() {
        if (touched) return;
        touched = true;
        controls.autoRotate = false;
        opts.onInteract?.();
    }
    controls.addEventListener('start', tookHold);
    renderer.domElement.addEventListener('wheel', tookHold, { passive: true });

    // one lamp, hanging where they came in: everything below it falls away into the rock
    scene.add(new THREE.AmbientLight(0xffffff, 0.34));
    const lamp = new THREE.PointLight(0xffffff, 26, 0, 1.25);
    lamp.position.set(1.2, 8, 1.6);
    scene.add(lamp);

    // the softening: one amplitude and one clock, shared by every material the base is made of
    const softU = { uSoft: { value: 0 }, uTime: { value: 0 } };
    function soften(mat) {
        mat.onBeforeCompile = (shader) => {
            shader.uniforms.uSoft = softU.uSoft;
            shader.uniforms.uTime = softU.uTime;
            shader.vertexShader = SOFT_GLSL + shader.vertexShader.replace('#include <project_vertex>', [
                'vec4 mvPosition = modelMatrix * vec4( transformed, 1.0 );',
                'mvPosition.xyz += deepSoft( mvPosition.xyz );',
                'mvPosition = viewMatrix * mvPosition;',
                'gl_Position = projectionMatrix * mvPosition;',
            ].join('\n'));
        };
        mat.customProgramCacheKey = () => 'deep-soft';
        return mat;
    }
    let softTarget = 0;             // 0..1, from the Watcher's stability
    let softNow = 0;                // where it stands this frame
    let snapping = null;            // { k, from } while the snap eases the base rigid
    let snapHold = 0;               // seconds left of rigid after a snap
    let flash = 0;                  // the soft flash of a snap, 1 to 0
    let softClock = 0;

    const plateMat = soften(new THREE.MeshLambertMaterial({ color: PLATE }));
    const crustMat = new THREE.MeshLambertMaterial({ color: CRUST });
    const rubbleMat = new THREE.MeshLambertMaterial({ color: RUBBLE });
    const holeMat = new THREE.MeshBasicMaterial({ color: ROCK });
    const rockMat = soften(new THREE.MeshLambertMaterial({ color: ROCK }));
    const laneMat = soften(new THREE.MeshBasicMaterial({ color: LANE }));
    // subdivided, so a slab can swell and sag in its middle and a long lane bends with it
    const unitBox = new THREE.BoxGeometry(1, 1, 1, 6, 1, 6);
    const plateGeo = new THREE.BoxGeometry(PLATE_W, PLATE_H, PLATE_W, 10, 1, 10);
    const bridgeGeo = new THREE.BoxGeometry(PITCH - PLATE_W + 0.04, PLATE_H, 0.84, 3, 1, 3);
    const LANE_Y = PLATE_H / 2 + 0.012;

    // ---- the people: tiny points that keep to the lanes ----
    const pos = new Float32Array(MAX_DOTS * 3);
    const dots = new THREE.BufferGeometry();
    dots.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    dots.setDrawRange(0, 0);
    const peopleMesh = new THREE.Points(dots, new THREE.PointsMaterial({ color: PEOPLE, size: PEOPLE_SIZE }));
    peopleMesh.frustumCulled = false;
    scene.add(peopleMesh);

    // ---- the shaft up and the crust: built once, the lid never moves ----
    const above = new THREE.Group();
    scene.add(above);
    const crustTop = CRUST_Y + CRUST_T;
    const crustSlab = new THREE.Mesh(new THREE.BoxGeometry(CRUST_W, CRUST_T, CRUST_W), crustMat);
    crustSlab.position.set(0, CRUST_Y + CRUST_T / 2, 0);
    above.add(crustSlab);
    const shaftUpH = CRUST_Y - LID_TOP + 0.02;
    const shaftUp = new THREE.Mesh(new THREE.CylinderGeometry(SHAFT_UP_R, SHAFT_UP_R, shaftUpH, 28, 10), plateMat);
    shaftUp.position.set(0, LID_TOP + shaftUpH / 2, 0);
    above.add(shaftUp);
    // the rubble the boom left on top of the pipe, and the opening under it once it is cleared
    const rubble = new THREE.Group();
    const rr = mulberry32(8012);
    for (let i = 0; i < 9; i++) {
        const w = 0.16 + rr() * 0.26, h = 0.1 + rr() * 0.2, d = 0.16 + rr() * 0.26;
        const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), rubbleMat);
        const a = rr() * Math.PI * 2, r0 = rr() * 0.42;
        m.position.set(Math.cos(a) * r0, crustTop + h / 2, Math.sin(a) * r0);
        m.rotation.y = rr() * Math.PI;
        rubble.add(m);
    }
    above.add(rubble);
    const hole = new THREE.Mesh(new THREE.CylinderGeometry(SHAFT_UP_R + 0.08, SHAFT_UP_R + 0.08, 0.02, 28), holeMat);
    hole.position.set(0, crustTop + 0.012, 0);
    hole.visible = false;
    above.add(hole);
    // the ring stands over the hatch in the crust: a point straight above the pipe projects above
    // it from every side the camera can orbit to, so the label never covers the opening
    const crustHost = document.createElement('div');
    crustHost.className = 'deep-crust-label';
    const crustLabel = new CSS2DObject(crustHost);
    crustLabel.position.set(0, crustTop + 1.1, 0);
    above.add(crustLabel);
    let shaftOpen = false;
    function openShaft(open) {
        if (open === shaftOpen) return;
        shaftOpen = open;
        rubble.visible = !open;
        hole.visible = open;
    }

    // ---- scout parties: their own few dots, on their own routes ----
    const scoutPos = new Float32Array(SCOUT_BUFFER * 3);
    const scoutGeo = new THREE.BufferGeometry();
    scoutGeo.setAttribute('position', new THREE.BufferAttribute(scoutPos, 3));
    scoutGeo.setDrawRange(0, 0);
    const scoutMesh = new THREE.Points(scoutGeo, new THREE.PointsMaterial({ color: SCOUT, size: SCOUT_SIZE }));
    scoutMesh.frustumCulled = false;
    scene.add(scoutMesh);
    let outings = [];               // { dir:'up'|'down', k, dur, dots:[{ path, pathAt, delay }] }

    // ---- what the current build left behind ----
    let world = new THREE.Group();
    scene.add(world);
    let solids = [];        // what a label can hide behind
    let labels = [];        // { obj, inner, kind, key }
    let nodes = [];         // the walk graph
    let floors = [];        // { y, doors: [], nodes: [] }
    let folk = [];
    let structure = '';
    let digLabel = null;
    let lastState = null;
    let lastPlan = null;                    // what the home view was last fitted to
    let dead = false;                       // disposed: a late timer must not touch the buffers
    let march = null;                       // everyone walking somewhere at once: cryo, or the way up
    let machine = null;                     // the rock, paper, scissors machine on the lid
    let machineRate = 0;                    // its throws a second
    let machinePhase = 0, machineThrow = 0, machineWin = 0;
    const cryoAt = new THREE.Vector3(0, 0, 0);
    const rnd = mulberry32(20260921);

    function clearWorld() {
        for (const l of labels) l.obj.removeFromParent();
        labels = [];
        world.traverse((o) => { if (o.isMesh && o.geometry && o.geometry !== unitBox && o.geometry !== plateGeo && o.geometry !== bridgeGeo) o.geometry.dispose(); });
        world.removeFromParent();
        world = new THREE.Group();
        scene.add(world);
        solids = []; nodes = []; floors = []; folk = []; digLabel = null; machine = null;
        march = null;
        cryoAt.set(0, 0, 0);
        dots.setDrawRange(0, 0);
    }

    function addPlate(x, y, z) {
        const m = new THREE.Mesh(plateGeo, plateMat);
        m.position.set(x, y, z);
        world.add(m); solids.push(m);
    }
    /** A bridge is the floor itself, only narrower: same height, same thickness,
     *  so a floor reads as one sharp slab and not as plates with sticks between. */
    function addBridge(ax, az, bx, bz, y) {
        const m = new THREE.Mesh(bridgeGeo, plateMat);
        m.position.set((ax + bx) / 2 * PITCH, y, (az + bz) / 2 * PITCH);
        if (az !== bz) m.rotation.y = Math.PI / 2;
        world.add(m); solids.push(m);
    }
    /** Lanes are cut in a mid grey, houses in rock: the same rock as the background,
     *  seen through the slab. */
    function cut(cx, y, cz, w, d, mat = laneMat) {
        const m = new THREE.Mesh(unitBox, mat);
        m.scale.set(w, 0.02, d);
        m.position.set(cx, y + LANE_Y, cz);
        world.add(m);
    }
    function addCylinder(r, h, x, y, z, mat) {
        const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 32, Math.max(1, Math.ceil(h / 0.5))), mat);
        m.position.set(x, y, z);
        world.add(m); solids.push(m);
        return m;
    }
    function makeLabel(html, x, y, z, kind) {
        const wrap = document.createElement('div');
        wrap.className = 'deep-lbl';
        const inner = document.createElement('div');
        inner.className = 'deep-lbl-in';
        inner.innerHTML = html;
        wrap.appendChild(inner);
        const obj = new CSS2DObject(wrap);
        obj.position.set(x, y, z);
        world.add(obj);
        const rec = { obj, inner, kind };
        labels.push(rec);
        return rec;
    }
    function addNode(x, y, z, kind, floor) {
        nodes.push({ p: new THREE.Vector3(x, y, z), adj: [], kind, floor });
        return nodes.length - 1;
    }
    function link(a, b) { nodes[a].adj.push(b); nodes[b].adj.push(a); }
    function sidePoint(s, t, r) {
        const o = SIDE_OUT[s], a = SIDE_ALONG[s];
        return [o[0] * r - a[0] * r + a[0] * 2 * r * t, o[1] * r - a[1] * r + a[1] * 2 * r * t];
    }
    function overlaps(box, list) {
        for (const b of list) {
            if (box[0] < b[2] && box[2] > b[0] && box[1] < b[3] && box[3] > b[1]) return true;
        }
        return false;
    }

    /** The ring on the chamber being dug: it fills as the ore for it comes in. */
    const RING_LEN = 113;
    const RING_SVG = '<svg viewBox="0 0 40 40" style="width:34px;height:34px;">'
        + '<circle class="ring-base" cx="20" cy="20" r="18" fill="none" stroke-width="2"></circle>'
        + `<circle class="ring-fg" cx="20" cy="20" r="18" fill="none" stroke-width="3" stroke-dasharray="${RING_LEN}" `
        + `stroke-dashoffset="${RING_LEN}" style="stroke:#4a5666;"></circle></svg>`;

    /** The cells of a floor: its landing, and every chamber dug on it. */
    function planFloors(state, layout) {
        const slots = layout.slots || [];
        const deepest = Math.max(floorCount(slots.length) - 1, placeChamber(slots.length).floor);
        const plan = [];
        for (let f = 0; f <= deepest; f++) plan.push({ y: -f * FLOOR_GAP, cells: [{ x: 0, z: 0, hub: true, lid: f === 0 }], doors: [], people: 0 });
        slots.forEach((type, i) => {
            const p = placeChamber(i);
            plan[p.floor].cells.push({
                x: p.x, z: p.z, room: type || null, slot: i,
                lvl: type ? (state.level[type] || 0) : 0,
                auto: type ? (state.auto[type] || 0) > 0 : false,
            });
        });
        return plan;
    }

    function build(state, layout) {
        clearWorld();
        const plan = planFloors(state, layout);
        floors = plan;
        const bottom = plan[plan.length - 1].y;

        // ---- the shaft: plate colour, and it is also the stairs ----
        const shaftH = -0.05 - bottom;
        addCylinder(SHAFT_R, shaftH, 0, bottom + shaftH / 2, 0, plateMat);

        plan.forEach((floor, fi) => {
            const taken = new Map();
            floor.cells.forEach((c) => taken.set(`${c.x},${c.z}`, c));

            floor.cells.forEach((c) => {
                const cx = c.x * PITCH, cz = c.z * PITCH, y = floor.y;
                const isHub = !!c.hub;
                const r = isHub ? R_HUB : R_ROOM;
                const prnd = plateSeed(fi, c.x, c.z);
                addPlate(cx, y, cz);

                // the ring
                const span = 2 * r + LANE_W;
                cut(cx, y, cz - r, span, LANE_W);
                cut(cx, y, cz + r, span, LANE_W);
                cut(cx - r, y, cz, LANE_W, span);
                cut(cx + r, y, cz, LANE_W, span);

                // what a house may not be cut into: the ground a bridge takes
                const blocked = [];
                [0, 1, 2, 3].forEach((s) => {
                    const o = SIDE_OUT[s];
                    if (!taken.has(`${c.x + o[0]},${c.z + o[1]}`)) return;
                    const a = (r + 1.0) / 2, h = (1.0 - r) / 2;
                    blocked.push([
                        Math.min(o[0] * (a - h), o[0] * (a + h)) - (o[0] ? 0 : LANE_W),
                        Math.min(o[1] * (a - h), o[1] * (a + h)) - (o[1] ? 0 : LANE_W),
                        Math.max(o[0] * (a - h), o[0] * (a + h)) + (o[0] ? 0 : LANE_W),
                        Math.max(o[1] * (a - h), o[1] * (a + h)) + (o[1] ? 0 : LANE_W),
                    ]);
                });

                // the ring's nodes: four corners, and whatever is spliced into a side
                const corner = [0, 1, 2, 3].map((s) => {
                    const p = sidePoint(s, 0, r);
                    return addNode(cx + p[0], y + WALK_Y, cz + p[1], 'lane', fi);
                });
                const items = [[], [], [], []];
                c.mid = [0, 1, 2, 3].map((s) => {
                    const p = sidePoint(s, 0.5, r);
                    const n = addNode(cx + p[0], y + WALK_Y, cz + p[1], 'lane', fi);
                    items[s].push({ t: 0.5, n });
                    return n;
                });

                // side lanes: one or two little cross streets cut toward the edge
                const lanes = [];
                const nLanes = isHub ? 0 : (prnd() < 0.55 ? 2 : 1);
                for (let i = 0; i < nLanes; i++) {
                    const s = Math.floor(prnd() * 4);
                    const t = prnd() < 0.5 ? 0.14 + prnd() * 0.2 : 0.66 + prnd() * 0.2;
                    const o = SIDE_OUT[s], a = SIDE_ALONG[s];
                    const base = sidePoint(s, t, r);
                    const out = 0.88;
                    const len = out - r;
                    const midR = (r + out) / 2;
                    const box = [
                        Math.min(base[0], base[0] + o[0] * len) - SIDE_W,
                        Math.min(base[1], base[1] + o[1] * len) - SIDE_W,
                        Math.max(base[0], base[0] + o[0] * len) + SIDE_W,
                        Math.max(base[1], base[1] + o[1] * len) + SIDE_W,
                    ];
                    if (overlaps(box, blocked)) continue;
                    blocked.push(box);
                    const proj = base[0] * a[0] + base[1] * a[1];
                    cut(cx + a[0] * proj + o[0] * midR, y, cz + a[1] * proj + o[1] * midR,
                        o[0] ? len : SIDE_W, o[0] ? SIDE_W : len);
                    const nb = addNode(cx + base[0], y + WALK_Y, cz + base[1], 'lane', fi);
                    items[s].push({ t, n: nb });
                    const ex = a[0] * proj + o[0] * out;
                    const ez = a[1] * proj + o[1] * out;
                    const ne = addNode(cx + ex, y + WALK_Y, cz + ez, 'lane', fi);
                    link(nb, ne);
                    lanes.push({ s, endR: out, ex, ez, node: ne, along: a, out: o });
                }

                // the houses: three to seven, each standing beside a lane with a
                // short stub to its door, never touching the lane itself
                const nHouses = isHub ? 0 : 3 + Math.floor(prnd() * 5);
                for (let i = 0; i < nHouses; i++) {
                    for (let att = 0; att < 16; att++) {
                        const size = HOUSE[Math.floor(prnd() * HOUSE.length)];
                        const onLane = lanes.length && prnd() < 0.38;
                        let bx, bz, dir, along, gap, hostNode = null, side = 0, sideT = 0;
                        if (onLane) {
                            const L = lanes[Math.floor(prnd() * lanes.length)];
                            const sign = prnd() < 0.5 ? 1 : -1;
                            const pick = 0.45 + prnd() * 0.5;   // how far out along the lane
                            const o = L.out, a = L.along;
                            const proj = L.ex * a[0] + L.ez * a[1];
                            const rr = r + (L.endR - r) * pick;
                            bx = a[0] * proj + o[0] * rr;
                            bz = a[1] * proj + o[1] * rr;
                            dir = [a[0] * sign, a[1] * sign];
                            along = o;
                            gap = SIDE_W / 2 + 0.09;
                            hostNode = L.node;
                        } else {
                            const s = Math.floor(prnd() * 4);
                            const t = 0.1 + prnd() * 0.8;
                            const o = SIDE_OUT[s], a = SIDE_ALONG[s];
                            const p = sidePoint(s, t, r);
                            bx = p[0]; bz = p[1];
                            dir = o; along = a; side = s; sideT = t;
                            gap = LANE_W / 2 + 0.10;
                        }
                        const hw = size[0] / 2, hd = size[1] / 2;
                        const px = bx + dir[0] * (gap + hd);
                        const pz = bz + dir[1] * (gap + hd);
                        const ex = Math.abs(along[0]) * hw + Math.abs(dir[0]) * hd;
                        const ez = Math.abs(along[1]) * hw + Math.abs(dir[1]) * hd;
                        const box = [px - ex - 0.03, pz - ez - 0.03, px + ex + 0.03, pz + ez + 0.03];
                        if (Math.abs(px) + ex > EDGE || Math.abs(pz) + ez > EDGE) continue;
                        if (overlaps(box, blocked)) continue;
                        blocked.push(box);
                        // the house, and the stub from the lane to its door
                        cut(cx + px, y, cz + pz, 2 * ex, 2 * ez, rockMat);
                        cut(cx + bx + dir[0] * gap / 2, y, cz + bz + dir[1] * gap / 2,
                            dir[0] ? gap : STUB_W, dir[0] ? STUB_W : gap);
                        const dn = addNode(cx + px - dir[0] * hd, y + WALK_Y, cz + pz - dir[1] * hd, 'spot', fi);
                        if (onLane) {
                            link(dn, hostNode);
                        } else {
                            const bn = addNode(cx + bx, y + WALK_Y, cz + bz, 'lane', fi);
                            items[side].push({ t: sideT, n: bn });
                            link(bn, dn);
                        }
                        break;
                    }
                }

                // chain every side: corner, then its items in order, then the next corner
                for (let s = 0; s < 4; s++) {
                    items[s].sort((a, b) => a.t - b.t);
                    let prev = corner[s];
                    items[s].forEach((it) => { link(prev, it.n); prev = it.n; });
                    link(prev, corner[(s + 1) % 4]);
                }

                if (c.lid) {
                    // the way in from chapter III, closed: a raised rim in plate, a
                    // well of rock sunk inside it, and the bar laid across
                    addCylinder(0.62, 0.18, 0, y + PLATE_H / 2 + 0.04, 0, plateMat);
                    addCylinder(0.47, 0.2, 0, y + PLATE_H / 2 + 0.02, 0, rockMat);
                    const bar = new THREE.Mesh(unitBox, plateMat);
                    bar.scale.set(1.34, 0.14, 0.24);
                    bar.position.set(0, y + PLATE_H / 2 + 0.14, 0);
                    world.add(bar); solids.push(bar);
                    // the star machine from chapter I came down the hole with them: it sits on
                    // the lid and plays rock, paper, scissors with the colony's surplus
                    machine = makeLabel(MACHINE_HTML, 0.9, y + 0.55, -0.9, 'machine');
                    machine.glyphs = [...machine.inner.querySelectorAll('.rps')];
                } else if (c.room) {
                    let html = `<i data-lucide="${ROOM_ICON[c.room] || 'square'}" class="w-7 h-7"></i>`;
                    // the cryo hall has no ladder of its own: its level is which tier is bought
                    if (c.room !== 'cryo') html += `<span class="lvl mono">${c.lvl}</span>`;
                    if (c.auto) html += '<i data-lucide="repeat" class="auto w-3.5 h-3.5"></i><span class="pulse"></span>';
                    // a room that stopped while the colony slept, and a chamber something took
                    html += '<span class="stall hidden"></span>';
                    html += '<span class="dark hidden"></span>';
                    html += '<span class="building"></span>';
                    const rec = makeLabel(html, cx, y + 0.45, cz, 'room');
                    if (c.auto) rec.inner.classList.add('is-auto');
                    rec.cell = c;
                    rec.lvlEl = rec.inner.querySelector('.lvl');
                    rec.stallEl = rec.inner.querySelector('.stall');
                    rec.darkEl = rec.inner.querySelector('.dark');
                    rec.buildEl = rec.inner.querySelector('.building');
                    rec.darkEl.addEventListener('click', () => opts.onClearDark?.(c.slot));
                    if (c.room === 'cryo') cryoAt.set(cx, y + WALK_Y, cz);
                }

                /* the way into the shaft: on a landing, two or three lanes run from
                   the ring straight in to an opening in the wall. Nobody takes the
                   stairs anywhere else. */
                if (isHub) {
                    const inner = c.lid ? 0.62 : SHAFT_R;      // the rim, or the wall
                    const nDoors = 2 + (prnd() < 0.5 ? 1 : 0);
                    const chosen = [];
                    while (chosen.length < nDoors) {
                        const s = Math.floor(prnd() * 4);
                        if (chosen.indexOf(s) < 0) chosen.push(s);
                    }
                    chosen.forEach((s) => {
                        const o = SIDE_OUT[s];
                        const from = r - LANE_W / 2, to = inner - 0.02;
                        const len = from - to;
                        const midR = (from + to) / 2;
                        cut(cx + o[0] * midR, y, cz + o[1] * midR, o[0] ? len : SIDE_W, o[0] ? SIDE_W : len);
                        const dr = inner + 0.05;
                        const dn = addNode(cx + o[0] * dr, y + WALK_Y, cz + o[1] * dr, 'door', fi);
                        link(dn, c.mid[s]);
                        floor.doors.push(dn);
                        if (!c.lid) {
                            // a dark opening in the wall of the shaft
                            const op = new THREE.Mesh(unitBox, rockMat);
                            op.scale.set(0.30, 0.34, 0.12);
                            op.position.set(o[0] * (SHAFT_R - 0.05), y + PLATE_H / 2 + 0.17, o[1] * (SHAFT_R - 0.05));
                            if (o[0]) op.rotation.y = Math.PI / 2;
                            world.add(op);
                        }
                    });
                }
            });

            // bridges, and the lane that runs over them
            floor.cells.forEach((c) => {
                const r = c.hub ? R_HUB : R_ROOM;
                [[1, 0], [0, 1]].forEach((d) => {
                    const n = taken.get(`${c.x + d[0]},${c.z + d[1]}`);
                    if (!n) return;
                    const nr = n.hub ? R_HUB : R_ROOM;
                    addBridge(c.x, c.z, n.x, n.z, floor.y);
                    const s1 = DIR_SIDE[`${d[0]},${d[1]}`], s2 = DIR_SIDE[`${-d[0]},${-d[1]}`];
                    const m1 = (r + 1.0) / 2, l1 = 1.0 - r;
                    cut(c.x * PITCH + d[0] * m1, floor.y, c.z * PITCH + d[1] * m1,
                        d[0] ? l1 : LANE_W, d[0] ? LANE_W : l1);
                    const m2 = (nr + 1.0) / 2, l2 = 1.0 - nr;
                    cut(n.x * PITCH - d[0] * m2, floor.y, n.z * PITCH - d[1] * m2,
                        d[0] ? l2 : LANE_W, d[0] ? LANE_W : l2);
                    cut((c.x + n.x) / 2 * PITCH, floor.y, (c.z + n.z) / 2 * PITCH,
                        d[0] ? PITCH - PLATE_W + 0.04 : LANE_W,
                        d[0] ? LANE_W : PITCH - PLATE_W + 0.04);
                    if (c.auto || n.auto) return;
                    const b = addNode((c.x + n.x) / 2 * PITCH, floor.y + WALK_Y, (c.z + n.z) / 2 * PITCH, 'lane', fi);
                    link(b, c.mid[s1]);
                    link(b, n.mid[s2]);
                });
            });
        });

        // an automated room is one nobody walks to: cut its slab off the network
        plan.forEach((floor, fi) => {
            floor.cells.forEach((c) => {
                if (!c.auto) return;
                const near = (o) => o.floor === fi
                    && Math.abs(o.p.x - c.x * PITCH) < 1.02 && Math.abs(o.p.z - c.z * PITCH) < 1.02;
                nodes.forEach((nd) => { if (near(nd)) nd.adj.length = 0; });
                nodes.forEach((nd) => { nd.adj = nd.adj.filter((i) => !near(nodes[i])); });
            });
        });

        // the next chamber: a ring where the shovel will go
        const next = placeChamber((layout.slots || []).length);
        digLabel = makeLabel(RING_SVG, next.x * PITCH, plan[next.floor].y + 0.42, next.z * PITCH, 'dig');
        digLabel.ring = digLabel.inner.querySelector('.ring-fg');

        // where the people may stand, floor by floor
        plan.forEach((floor, fi) => {
            floor.nodes = [];
            nodes.forEach((n, i) => { if (n.floor === fi && n.adj.length) floor.nodes.push(i); });
        });

        framing(plan);
        opts.onLabels?.();
    }

    const FIT_MARGIN = 1.14;        // air around the colony so nothing touches the window's edge

    /**
     * The home view: the whole colony, fitted to the window. Every plate goes into a box,
     * the box into a sphere (the camera orbits, so the worst rotation is the one that has to
     * fit), and the distance falls out of whichever of the two field-of-view angles is the
     * tighter. That way it fills the window on a wide monitor and on a narrow one alike, and
     * a colony ten floors deep is framed as honestly as one with three chambers.
     *
     * Recomputed whenever the colony's shape changes and whenever the window does. The camera
     * only jumps there if the player has not taken hold of it; the reset button is how they
     * ask for it back.
     */
    function framing(plan) {
        if (!plan || !plan.length) return;
        lastPlan = plan;
        const box = new THREE.Box3();
        plan.forEach((f) => f.cells.forEach((c) => {
            box.expandByPoint(new THREE.Vector3(c.x * PITCH - PLATE_W / 2, f.y - PLATE_H, c.z * PITCH - PLATE_W / 2));
            // the labels float above their plate, so the top of the box is above the slab
            box.expandByPoint(new THREE.Vector3(c.x * PITCH + PLATE_W / 2, f.y + 0.9, c.z * PITCH + PLATE_W / 2));
        }));
        if (box.isEmpty()) return;
        // the crust and its ring are part of the colony's picture: the goal is over their heads
        box.expandByPoint(new THREE.Vector3(-CRUST_W / 2, crustTop + 1.5, -CRUST_W / 2));
        box.expandByPoint(new THREE.Vector3(CRUST_W / 2, crustTop + 1.5, CRUST_W / 2));
        const tgt = box.getCenter(new THREE.Vector3());
        const dir = new THREE.Vector3(0.498, 0.485, 0.723).normalize();
        // The exact fit, not a bounding sphere: a sphere around a wide flat colony is mostly
        // air, and the model ends up a postage stamp in the middle of the window. Project the
        // eight corners of the box into the camera's own axes and take the distance at which
        // the last of them is still inside the frustum. Both angles are used, so it fills a
        // wide monitor and a narrow one alike.
        const up = new THREE.Vector3(0, 1, 0);
        const right = new THREE.Vector3().crossVectors(up, dir).normalize();
        const camUp = new THREE.Vector3().crossVectors(dir, right).normalize();
        const vFov = camera.fov * Math.PI / 180;
        const tanV = Math.tan(vFov / 2);
        const tanH = tanV * Math.max(0.2, camera.aspect);
        let dist = 1;
        const q = new THREE.Vector3();
        for (let i = 0; i < 8; i++) {
            q.set(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z).sub(tgt);
            const need = q.dot(dir) + Math.max(Math.abs(q.dot(right)) / tanH, Math.abs(q.dot(camUp)) / tanV);
            dist = Math.max(dist, need);
        }
        dist *= FIT_MARGIN;
        const wasDefault = camera.position.distanceTo(defPos) < 0.001;
        defTgt = tgt;
        defPos = tgt.clone().addScaledVector(dir, dist);
        controls.maxDistance = Math.max(70, dist * 1.8);   // never clamp the fit away
        controls.minDistance = Math.min(9, dist * 0.35);
        if (!touched || wasDefault) {
            camera.position.copy(defPos);
            controls.target.copy(defTgt);
            controls.update();
        }
    }

    /** Keeps the crowd in step with the colony without rebuilding the model. */
    function setPeople(state) {
        const walkable = floors.reduce((a, f) => a + (f.nodes?.length ? 1 : 0), 0);
        if (!walkable) { folk = []; dots.setDrawRange(0, 0); return; }
        const target = Math.min(MAX_DOTS, Math.max(0, Math.round(state.humans || 0)));
        const share = floors.map((f) => (f.nodes?.length || 0));
        const total = share.reduce((a, b) => a + b, 0) || 1;
        const want = share.map((s) => Math.round(target * s / total));
        const have = floors.map((_, fi) => folk.filter((p) => p.home === fi).length);
        floors.forEach((f, fi) => {
            let need = want[fi] - have[fi];
            while (need > 0 && f.nodes.length) {
                const at = f.nodes[Math.floor(rnd() * f.nodes.length)];
                folk.push({
                    home: fi, floor: fi, at, prev: at, to: at, t: 1, len: 1,
                    speed: 0.34 + rnd() * 0.3, state: 'walk', clock: 0, dur: 0,
                    from3: new THREE.Vector3(), to3: new THREE.Vector3(),
                });
                need--;
            }
            while (need < 0) {
                const i = folk.findIndex((p) => p.home === fi);
                if (i < 0) break;
                folk.splice(i, 1);
                need++;
            }
        });
        if (folk.length > MAX_DOTS) folk.length = MAX_DOTS;
        dots.setDrawRange(0, folk.length);
    }

    function refresh(state) {
        lastState = state;
        // the ring on the chamber being dug: while an order is under way it shows how far
        // along the digging is, and before that how much of its price has been brought in
        const digJob = (state.builds || []).find((j) => j.kind === 'dig');
        const darkSlots = state.darkSlots || [];
        for (const l of labels) {
            if (l.kind !== 'room' || !l.cell?.room) continue;
            if (l.lvlEl) {
                const want = String(state.level[l.cell.room] || 0);
                if (l.lvlEl.textContent !== want) l.lvlEl.textContent = want;
            }
            l.stallEl?.classList.toggle('hidden', !state.stalled?.[l.cell.room]);
            l.darkEl?.classList.toggle('hidden', darkSlots.indexOf(l.cell.slot) < 0);
        }
        if (digLabel?.ring) {
            let frac;
            if (digJob) {
                const span = digJob.doneDay - digJob.startDay;
                frac = span > 0 ? (state.day - digJob.startDay) / span : 1;
            } else {
                const cost = digCost(state.chambers);
                frac = cost > 0 ? (state.minerals || 0) / cost : 0;
            }
            frac = Math.max(0, Math.min(1, frac));
            digLabel.ring.setAttribute('stroke-dashoffset', (RING_LEN * (1 - frac)).toFixed(1));
            digLabel.inner.classList.toggle('is-building', !!digJob);
        }
        // and a ring on any plate whose room is being built or upgraded
        for (const l of labels) {
            if (l.kind !== 'room' || !l.cell?.room || !l.buildEl) continue;
            const job = (state.builds || []).find((j) => j.type === l.cell.room && j.kind !== 'dig');
            l.buildEl.classList.toggle('is-on', !!job);
            if (job) {
                const span = job.doneDay - job.startDay;
                const p = span > 0 ? Math.max(0, Math.min(1, (state.day - job.startDay) / span)) : 1;
                l.buildEl.style.setProperty('--p', `${Math.round(p * 100)}%`);
            }
        }
        // the rubble on the pipe goes the first time anyone climbs it; the scene clears it when
        // the first of them gets to the top, not the moment the order is given
        wantOpen = !!(state.shaftOpen || (state.probesSent || 0) > 0 || state.ascended);
        if (!wantOpen) openShaft(false);
        else if (!outings.some((o) => o.dir === 'up')) openShaft(true);
        // asleep, everyone is in the hall and the plates are empty
        if (!march) {
            if (state.asleep) { folk = []; dots.setDrawRange(0, 0); } else setPeople(state);
        }
    }

    /** One frame of the machine: a throw every 1/rate seconds, and every third throw a win. */
    function stepMachine(dt) {
        if (!machine?.glyphs?.length) return;
        if (machineWin > 0) {
            machineWin -= dt;
            if (machineWin <= 0) machine.inner.classList.remove('is-win');
        }
        if (!(machineRate > 0)) return;
        machinePhase += dt * machineRate;
        if (machinePhase < 1) return;
        machinePhase %= 1;
        machine.glyphs[machineThrow % 3].classList.remove('is-on');
        machineThrow++;
        machine.glyphs[machineThrow % 3].classList.add('is-on');
        if (machineThrow % 3 === 0) { machine.inner.classList.add('is-win'); machineWin = 0.35; }
    }

    function chooseNext(p) {
        const adj = nodes[p.at].adj;
        if (!adj.length) return;
        let n = adj[Math.floor(rnd() * adj.length)];
        if (adj.length > 1 && n === p.prev && rnd() < 0.75) n = adj[Math.floor(rnd() * adj.length)];
        p.prev = p.at; p.to = n; p.t = 0;
        p.len = nodes[p.at].p.distanceTo(nodes[n].p);
    }

    function stepPerson(p, dt) {
        if (p.state === 'walk') {
            p.t += p.speed * dt / Math.max(0.12, p.len);
            if (p.t < 1) return;
            p.at = p.to; p.t = 1;
            const here = nodes[p.at];
            if (here.kind === 'spot' && rnd() < 0.8) {
                p.state = 'pause'; p.clock = 0; p.dur = 0.5 + rnd() * 2.2;
                return;
            }
            // at an opening in the shaft wall, most take the stairs
            if (here.kind === 'door' && rnd() < 0.8) {
                let next = p.floor + (rnd() < 0.72 ? 1 : -1);
                if (next < 0) next = 1;
                if (next >= floors.length) next = p.floor - 1;
                if (next >= 0 && next !== p.floor && floors[next].doors.length) {
                    p.next = next; p.state = 'enter'; p.clock = 0;
                    p.from3.copy(here.p);
                    p.to3.set(0, floors[p.floor].y - 0.2, 0);
                    p.dur = p.from3.distanceTo(p.to3) / p.speed;
                    return;
                }
            }
            chooseNext(p);
        } else if (p.state === 'pause') {
            p.clock += dt;
            if (p.clock >= p.dur) { p.state = 'walk'; chooseNext(p); }
        } else {
            p.clock += dt;
            if (p.clock < p.dur) return;
            if (p.state === 'enter') {
                // in the shaft now, and out of sight: they walk it at their own pace
                p.state = 'stairs'; p.clock = 0;
                p.from3.set(0, floors[p.floor].y - 0.2, 0);
                p.to3.set(0, floors[p.next].y - 0.2, 0);
                p.dur = p.from3.distanceTo(p.to3) / p.speed;
            } else if (p.state === 'stairs') {
                p.floor = p.next;
                const doors = floors[p.floor].doors;
                p.at = doors[Math.floor(rnd() * doors.length)];
                p.prev = p.at;
                p.state = 'exit'; p.clock = 0;
                p.from3.set(0, floors[p.floor].y - 0.2, 0);
                p.to3.copy(nodes[p.at].p);
                p.dur = p.from3.distanceTo(p.to3) / p.speed;
            } else {
                p.state = 'walk';
                chooseNext(p);
            }
        }
    }

    function personPosition(p, out) {
        if (p.state === 'walk') out.lerpVectors(nodes[p.prev].p, nodes[p.to].p, p.t);
        else if (p.state === 'pause') out.copy(nodes[p.at].p);
        else out.lerpVectors(p.from3, p.to3, Math.min(1, p.clock / p.dur));
    }

    // ---- labels: crisp, sized with the zoom, hidden when something is in front ----
    const ray = new THREE.Raycaster();
    const tmp = new THREE.Vector3();
    function updateLabels() {
        for (const l of labels) {
            l.obj.getWorldPosition(tmp);
            const dist = camera.position.distanceTo(tmp);
            const s = Math.min(1.2, Math.max(0.4, 20 / dist));
            l.inner.style.transform = `scale(${s.toFixed(3)})`;
            ray.set(camera.position, tmp.clone().sub(camera.position).normalize());
            const hit = ray.intersectObjects(solids, false)[0];
            l.inner.style.opacity = (hit && hit.distance < dist - 0.5) ? '0' : '1';
        }
    }

    const ease = (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
    let tween = null;

    /** One frame of the softening: follow the stability, or the snap, and the flash. */
    function stepSoft(dt) {
        softClock += dt;
        if (snapping) {
            snapping.k = Math.min(1, snapping.k + dt / SNAP_EASE);
            softNow = snapping.from * (1 - ease(snapping.k));
            if (snapping.k >= 1) { snapping = null; snapHold = SNAP_HOLD; softNow = 0; }
        } else if (snapHold > 0) {
            snapHold -= dt;
            softNow = 0;
        } else {
            // it gives slowly after a snap, and follows the meter a little faster otherwise
            const rate = softNow < softTarget ? SNAP_RETURN : SOFT_FOLLOW;
            softNow += (softTarget - softNow) * Math.min(1, dt * rate * 3);
            if (Math.abs(softTarget - softNow) < 1e-4) softNow = softTarget;
        }
        softU.uSoft.value = softNow * SOFT_AMP;
        softU.uTime.value = softClock;
        if (flash > 0) {
            flash = Math.max(0, flash - dt / 0.5);
            plateMat.emissive.setScalar(0.3 * flash);
        }
    }
    const p3 = new THREE.Vector3();

    /* ---- everyone at once: into the cryo hall, back out of it, or up and away ----
       The walking graph is not thrown away. Each person keeps the node they were standing
       on, so when they pour out again they carry on exactly where they left off. The route
       is the one they would walk anyway: out to the shaft on their own floor, down or up
       the shaft, and out onto the plate at the other end. */
    const here3 = new THREE.Vector3();
    function shaftPoint(floorIndex) {
        const y = floors[floorIndex] ? floors[floorIndex].y : 0;
        return new THREE.Vector3(0, y - 0.2, 0);
    }
    function cryoPoint() {
        if (cryoAt.lengthSq() > 0) return cryoAt.clone();
        return new THREE.Vector3(0, (floors[0] ? floors[0].y : 0) + WALK_Y, 0);
    }
    /** Cumulative lengths along a person's route, so everyone moves at one pace. */
    function measure(p) {
        p.pathAt = [0];
        for (let i = 1; i < p.path.length; i++) p.pathAt.push(p.pathAt[i - 1] + p.path[i - 1].distanceTo(p.path[i]));
    }
    function pathPoint(p, u, out) {
        const total = p.pathAt[p.pathAt.length - 1];
        if (!(total > 0)) return out.copy(p.path[p.path.length - 1]);
        const d = u * total;
        let i = 1;
        while (i < p.pathAt.length - 1 && p.pathAt[i] < d) i++;
        const span = p.pathAt[i] - p.pathAt[i - 1] || 1;
        return out.lerpVectors(p.path[i - 1], p.path[i], Math.max(0, Math.min(1, (d - p.pathAt[i - 1]) / span)));
    }
    /* ---- scout parties (v1.45.0): out through the hatch, up the pipe, into the crust ---- */
    let wantOpen = false;
    /** The walk from where someone is to an opening on the lid, on the graph they already walk. */
    function routeToHatch(from) {
        const doors = new Set(floors[0]?.doors || []);
        if (!doors.size || from == null) return [];
        const prev = new Map([[from, -1]]);
        const queue = [from];
        let found = -1;
        while (queue.length) {
            const at = queue.shift();
            if (doors.has(at)) { found = at; break; }
            for (const nb of nodes[at].adj) if (!prev.has(nb)) { prev.set(nb, at); queue.push(nb); }
        }
        if (found < 0) found = [...doors][Math.floor(rnd() * doors.size)];   // cut off: straight across
        const route = [];
        for (let at = found; at >= 0 && at !== undefined; at = prev.has(at) ? prev.get(at) : -1) route.unshift(at);
        if (route[0] !== from) route.unshift(from);
        return route.map((i) => nodes[i].p.clone());
    }
    /** Round the outside of the pipe, a turn and a half, from the lid to the underside of the crust. */
    function stair(fromAngle) {
        const pts = [];
        const r = SHAFT_UP_R + 0.07;
        const turns = 1.5, steps = 24;
        for (let i = 0; i <= steps; i++) {
            const k = i / steps;
            const a = fromAngle + k * turns * Math.PI * 2;
            pts.push(new THREE.Vector3(Math.cos(a) * r, LID_TOP + k * (CRUST_Y - 0.08 - LID_TOP), Math.sin(a) * r));
        }
        pts.push(new THREE.Vector3(0, CRUST_Y + CRUST_T / 2, 0));    // into the crust, and out of sight
        return pts;
    }
    function scoutRoute() {
        const start = floors[0]?.nodes?.length ? floors[0].nodes[Math.floor(rnd() * floors[0].nodes.length)] : null;
        const walk = routeToHatch(start);
        const door = walk.length ? walk[walk.length - 1] : new THREE.Vector3(0.7, WALK_Y, 0);
        const angle = Math.atan2(door.z, door.x);
        return [...walk, new THREE.Vector3(Math.cos(angle) * 0.42, LID_TOP, Math.sin(angle) * 0.42), ...stair(angle)];
    }
    /**
     * A party leaves (`up`) or comes home (`down`): `n` people, drawn as at most MAX_SCOUT_DOTS.
     * @returns {number} the dots drawn
     */
    function startOuting(dir, n) {
        const count = Math.min(MAX_SCOUT_DOTS, Math.max(0, Math.round(n)));
        if (!count || !floors.length) return 0;
        const dots = [];
        for (let i = 0; i < count; i++) {
            const path = scoutRoute();
            const p = { path: dir === 'up' ? path : path.slice().reverse(), delay: rnd() * 0.3 };
            measure(p);
            dots.push(p);
        }
        outings.push({ dir, k: 0, dur: SCOUT_SECONDS, dots });
        return count;
    }
    function stepOutings(dt) {
        if (!outings.length) { if (scoutGeo.drawRange.count) scoutGeo.setDrawRange(0, 0); return; }
        let i = 0;
        for (const o of outings) {
            o.k = Math.min(1, o.k + dt / o.dur);
            for (const d of o.dots) {
                if (i >= SCOUT_BUFFER) break;
                const u = Math.max(0, Math.min(1, (o.k - d.delay) / (1 - d.delay)));
                pathPoint(d, u, p3);
                scoutPos[i * 3] = p3.x; scoutPos[i * 3 + 1] = p3.y; scoutPos[i * 3 + 2] = p3.z;
                i++;
            }
        }
        scoutGeo.setDrawRange(0, i);
        scoutGeo.attributes.position.needsUpdate = true;
        outings = outings.filter((o) => o.k < 1);
        if (wantOpen && !shaftOpen && !outings.some((o) => o.dir === 'up' && o.k < 0.85)) openShaft(true);
    }

    /**
     * @param {'gather'|'release'|'ascend'} mode
     * @param {number} seconds - how long the whole crowd takes, stagger included
     * @returns {Promise<void>} resolves when the last of them is through
     */
    function startMarch(mode, seconds) {
        if (mode === 'release' && lastState) setPeople(lastState);
        if (!folk.length) {
            if (mode !== 'release') dots.setDrawRange(0, 0);
            return Promise.resolve();
        }
        const cryo = cryoPoint();
        const cryoShaft = new THREE.Vector3(0, cryo.y - WALK_Y - 0.2, 0);
        const hatch = new THREE.Vector3(0, LID_TOP, 0);
        const sky = new THREE.Vector3(0, CRUST_Y + CRUST_T / 2, 0);     // up the pipe, into the crust
        for (const p of folk) {
            const mine = shaftPoint(p.floor);
            if (mode === 'release') {
                p.path = [cryo.clone(), cryoShaft.clone(), mine, nodes[p.at] ? nodes[p.at].p.clone() : cryo.clone()];
            } else if (mode === 'ascend') {
                personPosition(p, here3);
                p.path = [here3.clone(), mine, hatch.clone(), sky.clone()];
            } else {
                personPosition(p, here3);
                p.path = [here3.clone(), mine, cryoShaft.clone(), cryo.clone()];
            }
            measure(p);
            p.delay = rnd() * 0.32;
        }
        dots.setDrawRange(0, folk.length);
        // The march is driven by the frame loop, and a browser stops handing out frames to a
        // tab nobody is looking at. Without a wall clock behind it, a player who switches tabs
        // mid-press would come back to a colony frozen halfway into the ice, for good. So the
        // timer finishes what the frames did not, and the sequence always ends.
        return new Promise((resolve) => {
            let done = false;
            const finish = () => {
                if (done) return;
                done = true;
                clearTimeout(guard);
                resolve();
            };
            const guard = setTimeout(() => {
                if (dead) { finish(); return; }
                if (march && march.resolve === finish) { march.k = 1; stepMarch(0); return; }
                finish();
            }, Math.ceil(Math.max(0.1, seconds) * 1000) + 400);
            march = { mode, k: 0, dur: Math.max(0.1, seconds), resolve: finish };
        });
    }
    function stepMarch(dt) {
        march.k = Math.min(1, march.k + dt / march.dur);
        for (let i = 0; i < folk.length; i++) {
            const p = folk[i];
            const u = Math.max(0, Math.min(1, (march.k - p.delay) / (1 - p.delay)));
            pathPoint(p, march.mode === 'release' ? u : ease(u), p3);
            pos[i * 3] = p3.x; pos[i * 3 + 1] = p3.y; pos[i * 3 + 2] = p3.z;
        }
        dots.attributes.position.needsUpdate = true;
        if (march.k < 1) return;
        const { mode, resolve } = march;
        march = null;
        if (mode === 'release') {
            for (const p of folk) { p.state = 'walk'; p.prev = p.at; p.to = p.at; p.t = 1; p.len = 1; chooseNext(p); }
            if (lastState) setPeople(lastState);
        } else {
            dots.setDrawRange(0, 0);       // the plates are empty: everyone is under the ice, or gone up
        }
        resolve();
    }

    return {
        /** Draws this state. Rebuilds only when the colony's shape changed. */
        setState(state, layout) {
            const key = structureKey(state, layout);
            if (key !== structure) { structure = key; build(state, layout); }
            refresh(state);
        },
        /** One frame. Moves the people and renders; never touches game time. */
        step(dt) {
            if (march) {
                stepMarch(dt);
            } else {
                for (let i = 0; i < folk.length; i++) {
                    stepPerson(folk[i], dt);
                    personPosition(folk[i], p3);
                    pos[i * 3] = p3.x; pos[i * 3 + 1] = p3.y; pos[i * 3 + 2] = p3.z;
                }
                dots.attributes.position.needsUpdate = true;
            }
            if (tween) {
                tween.k = Math.min(1, tween.k + dt / 1.2);
                const k = ease(tween.k);
                camera.position.lerpVectors(tween.p, defPos, k);
                controls.target.lerpVectors(tween.t, defTgt, k);
                if (tween.k >= 1) tween = null;
            }
            stepMachine(dt);
            stepOutings(dt);
            stepSoft(dt);
            controls.update();
            updateLabels();
            renderer.render(scene, camera);
            labelRenderer.render(scene, camera);
        },
        resize() {
            W = container.clientWidth || window.innerWidth;
            H = container.clientHeight || window.innerHeight;
            camera.aspect = W / H;
            camera.updateProjectionMatrix();
            renderer.setSize(W, H);
            labelRenderer.setSize(W, H);
            framing(lastPlan);              // a narrower window needs a longer lens
        },
        /**
         * How fast the machine on the lid plays: in proportion to the stars a day, on a log
         * scale (the rate climbs ten orders of magnitude over the chapter), and still at none.
         */
        setMachine(starsPerDay) {
            const v = Math.max(0, starsPerDay || 0);
            machineRate = v > 0 ? Math.min(8, 0.4 + 0.8 * Math.log10(1 + v)) : 0;
        },
        /** Everyone walks to the cryo hall and is gone. Resolves when the last one is in. */
        gather(seconds = 1.5) { return startMarch('gather', seconds); },
        /** And out again, back to the lanes they were walking. */
        release(seconds = 1.2) { return startMarch('release', seconds); },
        /** Up the shaft and out: the last thing this chapter's model does. */
        ascend(seconds = 2.0) { return startMarch('ascend', seconds); },
        /** A scout party leaves: dots walk to the hatch and climb the pipe into the crust. */
        scoutsUp(n) { return startOuting('up', n); },
        /** A party comes home: dots climb down out of the crust and walk off into the colony. */
        scoutsDown(n) { return startOuting('down', n); },
        /** How soft the base should be, 0 (rigid) to 1: the Watcher's stability, read by watcher.js's
         *  softness(). Awake it is 0 and the base firms up again. */
        setSoftness(k) { softTarget = Math.max(0, Math.min(1, k || 0)); },
        /** A click on the base while the colony sleeps: rigid again, with a soft flash. */
        snap() {
            snapping = { k: 0, from: softNow };
            flash = 1;
        },
        /** Where the crust's ring is drawn: an element on the slab, for crust.js to fill. */
        crustHost,
        /** The crust the day they go up: burnt ground with a sky over it. */
        lighten() { crustMat.color.set(CRUST_LIT); },
        /** Back to the view we started from. */
        resetView() {
            tween = { p: camera.position.clone(), t: controls.target.clone(), k: 0 };
        },
        dispose() {
            dead = true;
            clearWorld();
            controls.dispose();
            dots.dispose();
            peopleMesh.material.dispose();
            unitBox.dispose(); plateGeo.dispose(); bridgeGeo.dispose();
            above.traverse((o) => { if (o.isMesh) o.geometry.dispose(); });
            above.removeFromParent();
            scoutGeo.dispose(); scoutMesh.material.dispose();
            outings = [];
            plateMat.dispose(); rockMat.dispose(); laneMat.dispose();
            crustMat.dispose(); rubbleMat.dispose(); holeMat.dispose();
            renderer.dispose();
            renderer.domElement.remove();
            labelHost.innerHTML = '';
        },
        /** Test hook: what the scene believes it is drawing. */
        get stats() {
            return {
                floors: floors.length, labels: labels.length, people: folk.length, nodes: nodes.length, marching: !!march,
                throws: machineThrow, machineRate, shaftOpen,
                soft: softNow, softTarget, softAmp: softU.uSoft.value, snapping: !!snapping || snapHold > 0, flash,
                scouts: outings.map((o) => ({ dir: o.dir, dots: o.dots.length, k: o.k })),
            };
        },
        /** Test hook: where the scout dots stand right now (the first `n` of the buffer). */
        scoutDots() { return Array.from(scoutPos.slice(0, scoutGeo.drawRange.count * 3)); },
    };
}
