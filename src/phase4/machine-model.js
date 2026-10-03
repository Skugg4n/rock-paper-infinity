/**
 * Chapter IV · THE DEEP: the star machine on top of the colony (deep-machine, step 3). The model
 * from the locked visual reference docs/mockups/deep-machine-12.html, at the scene's own scale (one
 * plate is 2.0 by 0.26 in both): a hub on a bolted deck, three arms ending in bare picture tubes in
 * steel cages (gem, file-text, scissors on their faces), a fixed tube on a mast showing what it
 * plays against, meshing gears, a flywheel with spokes and a chain, pistons that throw the arms,
 * a heat sink and an exhaust that puffs smoke, armoured cables with the energy pulse inside that
 * climb up from the lid below into its base. Steel is the one metal accent. No walls.
 *
 * Its origin is the middle of its plate. It knows nothing about the rules: the phase hands it a
 * tempo (machine.js machineTempo) and it runs. What does not move is merged into a few meshes per
 * material; nothing is allocated per frame.
 */

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { lampLevel } from './machine.js';

const PLATE = 0xd5dbe3;
const LANE = 0x7b8595;
const JOINT = 0x5b6676;
const ARMOUR = 0x3a434f;
const ENERGY = 0x4f9bff;
const STEEL = 0x8f9cab;          // the one metal accent: brushed, cool, a little blue
const RUBBER = 0x1f252c;

const PLATE_W = 2.0, PLATE_H = 0.26;
const TOP = PLATE_H / 2;
const H0 = 0.58;                 // the shoulders
const R0 = 0.2;
const L1 = 0.38, L2 = 0.34;
const RING_Y = H0 + 0.3;
const CRT_Y = 1.24;              // the tube at the top
const D2R = Math.PI / 180;
const GLYPHS = ['gem', 'file-text', 'scissors'];
const DECK_H = 0.04;
const DECK = TOP + DECK_H;
const MOD = 0.02;                // every gear has the same tooth, so they mesh
const GEAR_Y = DECK + 0.06;
const PUL_Y = DECK + 0.27;
const R_P2 = 0.05, R_P1 = 0.08;
const FR = 0.22;                 // the flywheel's rim
const N_PUFFS = 24;
const N_SPARKS = 400;
const N_STARS = 6;
const SCREEN_HZ = 30;
const GHOST_O = [0.34, 0.2, 0.1];   // the after-images of an arm too fast to see
const UP = new THREE.Vector3(0, 1, 0);
const X_AXIS = new THREE.Vector3(1, 0, 0);

/* lucide's own paths for chapter I's three glyphs, drawn on the tubes */
const PATHS = {
    'gem': ['M6 3h12l4 6-10 13L2 9Z', 'M11 3 8 9l4 13 4-13-3-6', 'M2 9h20'],
    'file-text': ['M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z', 'M14 2v4a2 2 0 0 0 2 2h4', 'M10 9H8', 'M16 13H8', 'M16 17H8'],
    'scissors': ['M9 6a3 3 0 1 1-6 0a3 3 0 1 1 6 0', 'M9 18a3 3 0 1 1-6 0a3 3 0 1 1 6 0', 'M20 4 8.12 15.88', 'M14.47 14.48 20 20', 'M8.12 8.12 12 12'],
};
const STAR_SVG = '<svg viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>';

const dirOf = (a) => new THREE.Vector3(Math.cos(a), 0, -Math.sin(a));
const P = (r, y, a) => new THREE.Vector3(Math.cos(a) * r, y, -Math.sin(a) * r);

/**
 * @param {object} [opts]
 * @param {number} [opts.below] - where the lid's top is, relative to this plate's middle (negative):
 *        the cables start there
 * @returns {{group:THREE.Group, plate:THREE.Mesh, setTempo:Function, step:Function, hits:Function,
 *            topAt:THREE.Vector3, stats:object, dispose:Function}}
 */
export function createMachine(opts = {}) {
    const below = Number.isFinite(opts.below) ? opts.below : -1.6;
    const group = new THREE.Group();
    group.name = 'machine';

    const plateMat = new THREE.MeshLambertMaterial({ color: PLATE });
    const jointMat = new THREE.MeshLambertMaterial({ color: JOINT });
    const laneMat = new THREE.MeshBasicMaterial({ color: LANE });
    const steelMat = new THREE.MeshPhongMaterial({ color: STEEL, specular: 0x5a6878, shininess: 38 });
    const glassMat = new THREE.MeshPhongMaterial({ color: 0x1a2229, specular: 0x9aaab8, shininess: 90, side: THREE.DoubleSide });
    const sheenMat = new THREE.MeshPhongMaterial({ color: 0xffffff, specular: 0xffffff, shininess: 140, transparent: true, opacity: 0.07, depthWrite: false });
    const rubberMat = new THREE.MeshLambertMaterial({ color: RUBBER });
    const armourMat = new THREE.MeshLambertMaterial({ color: ARMOUR });
    const mats = [plateMat, jointMat, laneMat, steelMat, glassMat, sheenMat, rubberMat, armourMat];

    /* ------------------------------------------------ what does not move: merged per material */
    const statics = new Map();      // material -> geometries in the group's frame
    const tmpM = new THREE.Matrix4(), tmpQ = new THREE.Quaternion(), tmpE = new THREE.Euler(), tmpS = new THREE.Vector3();
    function still(geo, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, q = null) {
        if (q) tmpQ.copy(q); else tmpQ.setFromEuler(tmpE.set(rx, ry, rz));
        tmpM.compose(tmpS.set(x, y, z), tmpQ, new THREE.Vector3(1, 1, 1));
        const g = geo.index ? geo.toNonIndexed() : geo.clone();
        if (geo.index) geo.dispose();
        g.applyMatrix4(tmpM);
        for (const name of Object.keys(g.attributes)) if (name !== 'position' && name !== 'normal') g.deleteAttribute(name);
        if (!statics.has(mat)) statics.set(mat, []);
        statics.get(mat).push(g);
        return g;
    }
    const bolt = (x, y, z, s = 1, mat = plateMat) => still(new THREE.CylinderGeometry(0.013 * s, 0.013 * s, 0.012, 6), mat, x, y, z);
    /** A moving part: its own mesh, in `parent`. */
    const part = (geo, mat, parent = group) => { const m = new THREE.Mesh(geo, mat); parent.add(m); return m; };

    // the plate, its ring of lanes and the way out to the passage (east)
    const plateGeo = new THREE.BoxGeometry(PLATE_W, PLATE_H, PLATE_W);
    const plate = part(plateGeo, plateMat);
    plate.name = 'machine-plate';
    const R = 0.8, LW = 0.14, span = 2 * R + LW;
    [[0, -R, span, LW], [0, R, span, LW], [-R, 0, LW, span], [R, 0, LW, span], [(R + 0.97) / 2, 0, 0.97 - R, LW]].forEach((c) => {
        still(new THREE.BoxGeometry(c[2], 0.02, c[3]), laneMat, c[0], TOP + 0.002, c[1]);
    });

    // the deck
    still(new THREE.BoxGeometry(1.22, DECK_H, 1.22), jointMat, 0, TOP + DECK_H / 2, 0);
    [[-0.56, -0.56], [0.56, -0.56], [-0.56, 0.56], [0.56, 0.56], [0, -0.58], [0, 0.58], [-0.58, 0], [0.58, 0]].forEach((p) => bolt(p[0], DECK + 0.006, p[1], 1.3));

    /* ------------------------------------------------ the gear train */
    function gearGeo(n, depth) {
        const r = MOD * n / 2, ro = r + MOD, rr = r - 1.25 * MOD;
        const sh = new THREE.Shape();
        const p = Math.PI * 2 / n;
        for (let i = 0; i < n; i++) {
            const a = i * p;
            [[rr, a - p * 0.5], [rr, a - p * 0.26], [ro, a - p * 0.12], [ro, a + p * 0.12], [rr, a + p * 0.26]].forEach((q, k) => {
                const x = Math.cos(q[1]) * q[0], y = Math.sin(q[1]) * q[0];
                if (i === 0 && k === 0) sh.moveTo(x, y); else sh.lineTo(x, y);
            });
        }
        sh.closePath();
        const hole = new THREE.Path();
        hole.absarc(0, 0, Math.max(0.018, r * 0.14), 0, Math.PI * 2, true);
        sh.holes.push(hole);
        if (n >= 16) {
            for (let k = 0; k < 5; k++) {
                const a = k / 5 * Math.PI * 2, hp = new THREE.Path();
                hp.absarc(Math.cos(a) * r * 0.56, Math.sin(a) * r * 0.56, r * 0.19, 0, Math.PI * 2, true);
                sh.holes.push(hp);
            }
        }
        const g = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: false, curveSegments: 10 });
        g.translate(0, 0, -depth / 2);
        g.rotateX(-Math.PI / 2);
        return { geo: g, r, ro };
    }
    const blurMats = [];
    function makeGear(n, at, depth) {
        const gg = gearGeo(n, depth);
        const grp = new THREE.Group();
        grp.position.copy(at);
        group.add(grp);
        part(gg.geo, steelMat, grp);
        part(new THREE.CylinderGeometry(gg.r * 0.24, gg.r * 0.24, depth * 1.6, 12), jointMat, grp);
        for (let k = 0; k < 4; k++) {
            const a = k / 4 * Math.PI * 2 + 0.4;
            const b = part(new THREE.CylinderGeometry(0.009, 0.009, 0.012, 6), jointMat, grp);
            b.position.set(Math.cos(a) * gg.r * 0.33, depth * 0.8, -Math.sin(a) * gg.r * 0.33);
        }
        // the blur when it spins too fast to see the teeth
        const blur = new THREE.MeshPhongMaterial({ color: STEEL, specular: 0x5a6878, shininess: 38, transparent: true, opacity: 0, depthWrite: false });
        blurMats.push(blur);
        const bm = part(new THREE.CylinderGeometry(gg.ro, gg.ro, depth * 1.08, 40), blur);
        bm.position.copy(at);
        bm.visible = false;
        return { grp, n, r: gg.r, blur, blurMesh: bm, theta: 0, phi: 0 };
    }
    still(new THREE.CylinderGeometry(0.035, 0.035, 0.12, 16), jointMat, 0, DECK + 0.06, 0);
    const G1 = makeGear(28, new THREE.Vector3(0, GEAR_Y, 0), 0.034);
    const A2 = -30 * D2R, A3 = 210 * D2R;
    const G2 = makeGear(12, dirOf(A2).multiplyScalar(MOD * (28 + 12) / 2).setY(GEAR_Y), 0.034);
    const G3 = makeGear(10, dirOf(A3).multiplyScalar(MOD * (28 + 10) / 2).setY(GEAR_Y), 0.034);
    G2.phi = A2; G3.phi = A3;

    function shaft(at, top) {
        still(new THREE.CylinderGeometry(0.016, 0.016, top - DECK, 10), jointMat, at.x, (top + DECK) / 2, at.z);
        still(new THREE.BoxGeometry(0.09, 0.035, 0.09), jointMat, at.x, DECK + 0.0175, at.z);
        [[-0.032, -0.032], [0.032, 0.032], [0.032, -0.032], [-0.032, 0.032]].forEach((b) => bolt(at.x + b[0], DECK + 0.04, at.z + b[1], 0.8));
    }
    shaft(G2.grp.position, PUL_Y + 0.03);
    shaft(G3.grp.position, GEAR_Y + 0.04);
    function pulley(at, r, seg) {
        const p = new THREE.Group();
        p.position.copy(at);
        group.add(p);
        part(new THREE.CylinderGeometry(r, r, 0.026, seg), jointMat, p);
        [-1, 1].forEach((s) => { part(new THREE.CylinderGeometry(r + 0.012, r + 0.012, 0.006, seg), plateMat, p).position.y = s * 0.015; });
        part(new THREE.BoxGeometry(r * 1.65, 0.008, 0.013), plateMat, p).position.y = 0.02;
        return p;
    }
    const pulley2 = pulley(new THREE.Vector3(G2.grp.position.x, PUL_Y, G2.grp.position.z), R_P2, 20);

    // the flywheel at the back, with spokes and a weight, on its own shaft with the big pulley
    const FLY_C = dirOf(90 * D2R).multiplyScalar(0.66);
    shaft(FLY_C, PUL_Y + 0.03);
    const fly = new THREE.Group();
    fly.position.set(FLY_C.x, DECK + 0.075, FLY_C.z);
    group.add(fly);
    part(new THREE.TorusGeometry(FR, 0.024, 10, 56), plateMat, fly).rotation.x = Math.PI / 2;
    for (let i = 0; i < 5; i++) {
        const sp = part(new THREE.BoxGeometry(FR, 0.016, 0.026), plateMat, fly);
        sp.rotation.y = i * Math.PI * 2 / 5;
        sp.position.set(Math.cos(i * Math.PI * 2 / 5) * FR / 2, 0, -Math.sin(i * Math.PI * 2 / 5) * FR / 2);
    }
    part(new THREE.CylinderGeometry(0.05, 0.05, 0.05, 16), jointMat, fly);
    part(new THREE.BoxGeometry(0.07, 0.06, 0.06), jointMat, fly).position.set(FR, 0, 0);
    const flyBlurMat = new THREE.MeshLambertMaterial({ color: PLATE, transparent: true, opacity: 0, depthWrite: false });
    const flyBlur = part(new THREE.CylinderGeometry(FR + 0.02, FR + 0.02, 0.05, 48), flyBlurMat);
    flyBlur.position.copy(fly.position);
    flyBlur.visible = false;
    const pulley1 = pulley(new THREE.Vector3(FLY_C.x, PUL_Y, FLY_C.z), R_P1, 24);

    // the chain: a loop round both pulleys, links that travel with it
    const chainCurve = (() => {
        const pts = [];
        [[pulley2.position, R_P2 + 0.006], [pulley1.position, R_P1 + 0.006]].forEach((c) => {
            for (let k = 0; k < 48; k++) { const a = k / 48 * Math.PI * 2; pts.push([c[0].x + Math.cos(a) * c[1], c[0].z + Math.sin(a) * c[1]]); }
        });
        pts.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
        const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
        const lo = [], hi = [];
        pts.forEach((p) => { while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); });
        pts.slice().reverse().forEach((p) => { while (hi.length >= 2 && cross(hi[hi.length - 2], hi[hi.length - 1], p) <= 0) hi.pop(); hi.push(p); });
        const hull = lo.slice(0, -1).concat(hi.slice(0, -1));
        return new THREE.CatmullRomCurve3(hull.map((p) => new THREE.Vector3(p[0], PUL_Y, p[1])), true, 'centripetal');
    })();
    const CHAIN_LEN = chainCurve.getLength();
    still(new THREE.TubeGeometry(chainCurve, 120, 0.006, 6, true), jointMat);
    const N_LINKS = Math.floor(CHAIN_LEN / 0.03);
    const linkGeo = new THREE.BoxGeometry(0.018, 0.016, 0.014);
    const links = new THREE.InstancedMesh(linkGeo, steelMat, N_LINKS);
    group.add(links);
    // the chain's points, sampled once: the links walk an index, never the curve, per frame
    const CHAIN_SAMPLES = 512;
    const chainMats = [];
    {
        const p = new THREE.Vector3(), t = new THREE.Vector3(), q = new THREE.Quaternion(), one = new THREE.Vector3(1, 1, 1);
        for (let i = 0; i < CHAIN_SAMPLES; i++) {
            chainCurve.getPointAt(i / CHAIN_SAMPLES, p);
            chainCurve.getTangentAt(i / CHAIN_SAMPLES, t);
            q.setFromUnitVectors(X_AXIS, t);
            chainMats.push(new THREE.Matrix4().compose(p, q, one));
        }
    }

    // the hub: on a bolted flange, a ring of bolts round its cap, an inspection plate
    still(new THREE.CylinderGeometry(0.2, 0.2, 0.02, 32), jointMat, 0, TOP + 0.14, 0);
    still(new THREE.CylinderGeometry(0.13, 0.16, 0.36, 24), plateMat, 0, TOP + 0.31, 0);
    for (let k = 0; k < 8; k++) {
        const a = k / 8 * Math.PI * 2 + 0.2;
        bolt(Math.cos(a) * 0.18, TOP + 0.145, -Math.sin(a) * 0.18, 0.9, jointMat);
        bolt(Math.cos(a) * 0.115, TOP + 0.535, -Math.sin(a) * 0.115, 0.7, plateMat);
    }
    {
        const a = Math.PI * 1.5 + Math.PI / 3;
        const at = dirOf(a).multiplyScalar(0.148);
        still(new THREE.BoxGeometry(0.012, 0.14, 0.1), jointMat, at.x, TOP + 0.3, at.z, 0, a, 0);
    }
    still(new THREE.TorusGeometry(0.142, 0.02, 8, 32), jointMat, 0, H0 - 0.035, 0, Math.PI / 2);
    still(new THREE.CylinderGeometry(0.1, 0.13, 0.04, 24), jointMat, 0, TOP + 0.51, 0);

    // a heat sink and an exhaust stack, front left
    {
        const a = 205 * D2R;
        const HS = dirOf(a).multiplyScalar(0.74);
        still(new THREE.BoxGeometry(0.24, 0.05, 0.2), jointMat, HS.x, TOP + 0.025, HS.z, 0, a, 0);
        for (let k = 0; k < 8; k++) {
            const off = (k - 3.5) * 0.024;
            still(new THREE.BoxGeometry(0.22, 0.15, 0.009), plateMat, HS.x + Math.sin(a) * off, TOP + 0.125, HS.z + Math.cos(a) * off, 0, a, 0);
        }
    }
    const EX = dirOf(232 * D2R).multiplyScalar(0.8);
    still(new THREE.CylinderGeometry(0.03, 0.036, 0.52, 14), jointMat, EX.x, TOP + 0.26, EX.z);
    still(new THREE.CylinderGeometry(0.045, 0.034, 0.04, 14), jointMat, EX.x, TOP + 0.54, EX.z);
    [0.12, 0.32].forEach((y) => still(new THREE.TorusGeometry(0.037, 0.007, 6, 18), plateMat, EX.x, TOP + y, EX.z, Math.PI / 2));
    const EX_TOP = new THREE.Vector3(EX.x, TOP + 0.57, EX.z);

    // the ring, and the mast that carries it and the tube above it
    const mastTop = CRT_Y - 0.13;
    still(new THREE.CylinderGeometry(0.018, 0.018, mastTop - (TOP + 0.53), 8), jointMat, 0, (mastTop + TOP + 0.53) / 2, 0);
    still(new THREE.TorusGeometry(0.085, 0.017, 10, 40), plateMat, 0, RING_Y, 0, Math.PI / 2);

    /* ------------------------------------------------ the picture tubes */
    const P2D = {};
    for (const k of Object.keys(PATHS)) P2D[k] = PATHS[k].map((d) => new Path2D(d));
    function makeScreen(glyph) {
        const c = document.createElement('canvas');
        c.width = 128; c.height = 96;
        const ctx = c.getContext('2d');
        const tex = new THREE.CanvasTexture(c);
        tex.colorSpace = THREE.SRGBColorSpace;
        const mat = new THREE.MeshBasicMaterial({ map: tex });
        const vignette = ctx.createRadialGradient(64, 48, 96 * 0.3, 64, 48, 128 * 0.66);
        vignette.addColorStop(0, 'rgba(0,0,0,0)');
        vignette.addColorStop(1, 'rgba(0,0,0,0.7)');
        return { c, ctx, tex, mat, glyph, win: 0, noise: 0, roll: Math.random(), vignette };
    }
    function drawScreen(sc, time) {
        const ctx = sc.ctx, w = 128, h = 96;
        const hot = sc.win > 0;
        ctx.fillStyle = hot ? '#2a1b07' : '#06110f';
        ctx.fillRect(0, 0, w, h);
        if (sc.noise > 0) {
            for (let i = 0; i < 200; i++) {
                ctx.fillStyle = Math.random() < 0.5 ? 'rgba(207,238,230,0.6)' : 'rgba(207,238,230,0.25)';
                ctx.fillRect(Math.random() * w, Math.random() * h, 2, 1);
            }
        } else {
            const col = hot ? '#ffd27e' : '#cdeee5';
            ctx.save();
            const k = 2.6;
            ctx.translate(w / 2 - 12 * k, h / 2 - 12 * k);
            ctx.scale(k, k);
            ctx.lineWidth = 2;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.strokeStyle = col;
            ctx.shadowColor = col;
            ctx.shadowBlur = 6;
            for (const p of P2D[sc.glyph]) ctx.stroke(p);
            ctx.restore();
        }
        ctx.fillStyle = 'rgba(0,0,0,0.38)';
        for (let y = 0; y < h; y += 3) ctx.fillRect(0, y, w, 1);
        const y0 = ((time * 34 + sc.roll * 120) % 130) - 18;
        ctx.fillStyle = 'rgba(255,255,255,0.06)';
        ctx.fillRect(0, y0, w, 12);
        ctx.fillStyle = sc.vignette;
        ctx.fillRect(0, 0, w, h);
        sc.tex.needsUpdate = true;
    }
    function facePlane(w, h, bulge) {
        const g = new THREE.PlaneGeometry(w, h, 12, 10);
        const p = g.attributes.position;
        for (let i = 0; i < p.count; i++) {
            const x = p.getX(i) / (w / 2), y = p.getY(i) / (h / 2);
            p.setZ(i, bulge * (1 - 0.5 * (x * x + y * y)));
        }
        g.computeVertexNormals();
        return g;
    }

    // the tube at the top: a bare cathode ray tube, no cabinet, in a steel cage on the mast
    const crt = new THREE.Group();
    crt.position.y = CRT_Y;
    crt.rotation.y = 0.7;
    group.add(crt);
    const mainScreen = makeScreen('gem');
    const glass = part(facePlane(0.25, 0.19, 0.024), mainScreen.mat, crt);
    glass.position.z = 0.1;
    part(facePlane(0.262, 0.2, 0.034), sheenMat, crt).position.z = 0.1;
    const funnel = part(new THREE.CylinderGeometry(0.032, 0.15, 0.2, 28, 1, true), glassMat, crt);
    funnel.rotation.x = -Math.PI / 2;
    funnel.scale.set(1, 1, 0.8);
    const neck = part(new THREE.CylinderGeometry(0.03, 0.03, 0.15, 16), glassMat, crt);
    neck.rotation.x = Math.PI / 2;
    neck.position.z = -0.17;
    const socket = part(new THREE.CylinderGeometry(0.038, 0.034, 0.04, 16), jointMat, crt);
    socket.rotation.x = Math.PI / 2;
    socket.position.z = -0.26;
    const ringF = part(new THREE.TorusGeometry(0.152, 0.009, 8, 40), steelMat, crt);
    ringF.scale.set(1, 0.8, 1);
    ringF.position.z = 0.075;
    part(new THREE.TorusGeometry(0.045, 0.008, 8, 24), steelMat, crt).position.z = -0.14;
    [[0.11, 0.08], [-0.11, 0.08], [0.11, -0.08], [-0.11, -0.08]].forEach((c) => {
        const a = new THREE.Vector3(c[0], c[1] * 0.95, 0.075), b = new THREE.Vector3(c[0] * 0.3, c[1] * 0.38, -0.14);
        const rod = part(new THREE.CylinderGeometry(0.006, 0.006, a.distanceTo(b), 6), steelMat, crt);
        rod.position.copy(a).add(b).multiplyScalar(0.5);
        rod.quaternion.setFromUnitVectors(UP, b.clone().sub(a).normalize());
    });
    part(new THREE.BoxGeometry(0.14, 0.018, 0.2), steelMat, crt).position.set(0, -0.135, -0.03);
    [-1, 1].forEach((sx) => { part(new THREE.BoxGeometry(0.014, 0.075, 0.016), steelMat, crt).position.set(sx * 0.11, -0.095, 0.07); });
    [[0.012, 0.3], [-0.014, -0.3]].forEach((c) => {
        const curve = new THREE.CatmullRomCurve3([
            new THREE.Vector3(c[0], 0.005, -0.28), new THREE.Vector3(c[0] * 2, -0.02, -0.33),
            new THREE.Vector3(c[0] * 3 + c[1] * 0.1, -0.1, -0.3), new THREE.Vector3(c[0], -0.15, -0.16), new THREE.Vector3(0, -0.2, -0.02),
        ]);
        part(new THREE.TubeGeometry(curve, 24, 0.009, 6, false), rubberMat, crt);
    });

    // the stars a win throws up, over the tube
    const starEls = [];
    for (let i = 0; i < N_STARS; i++) {
        // the renderer owns the wrapper's transform; the one-shot animates the star inside it
        const at = document.createElement('div');
        const el = document.createElement('div');
        el.className = 'deep-machine-star';
        el.innerHTML = STAR_SVG;
        at.appendChild(el);
        const o = new CSS2DObject(at);
        o.position.set(0, CRT_Y + 0.3, 0);
        group.add(o);
        starEls.push(el);
    }
    let starNext = 0, starLast = -1;
    function flashStar(time) {
        if (time - starLast < 0.12) return;
        starLast = time;
        const el = starEls[starNext++ % starEls.length];
        el.classList.remove('is-go');
        void el.offsetWidth;
        el.classList.add('is-go');
    }

    /* ------------------------------------------------ the arms, with tubes for heads */
    function makeArm(m, withHead, glyph) {
        const base = new THREE.Group();
        const shoulder = new THREE.Group();
        shoulder.position.set(R0, H0, 0);
        base.add(shoulder);
        const sj = part(new THREE.CylinderGeometry(0.042, 0.042, 0.1, 16), m.joint, shoulder);
        sj.rotation.x = Math.PI / 2;
        part(new THREE.BoxGeometry(L1, 0.05, 0.06), m.plate, shoulder).position.x = L1 / 2;
        const elbow = new THREE.Group();
        elbow.position.x = L1;
        shoulder.add(elbow);
        const ej = part(new THREE.CylinderGeometry(0.034, 0.034, 0.085, 14), m.joint, elbow);
        ej.rotation.x = Math.PI / 2;
        part(new THREE.BoxGeometry(L2, 0.042, 0.05), m.plate, elbow).position.x = L2 / 2;
        const head = new THREE.Group();
        head.position.x = L2 + 0.02;
        head.rotation.z = 0.55;
        elbow.add(head);
        const hf = part(new THREE.CylinderGeometry(0.011, 0.04, 0.07, 16, 1, true), m.glass || m.joint, head);
        hf.rotation.z = -Math.PI / 2;
        hf.scale.set(1, 1, 0.82);
        const hn = part(new THREE.CylinderGeometry(0.011, 0.011, 0.04, 10), m.glass || m.joint, head);
        hn.rotation.z = Math.PI / 2;
        hn.position.x = -0.055;
        let screen = null;
        if (withHead) {
            const cl = part(new THREE.TorusGeometry(0.03, 0.006, 6, 18), steelMat, head);
            cl.rotation.y = Math.PI / 2;
            cl.position.x = -0.006;
            cl.scale.set(1, 1, 0.84);
            part(new THREE.BoxGeometry(0.05, 0.014, 0.012), steelMat, head).position.set(-0.03, -0.028, 0);
            screen = makeScreen(glyph);
            const f = part(facePlane(0.062, 0.05, 0.007), screen.mat, head);
            f.rotation.y = Math.PI / 2;
            f.position.x = 0.035;
            const sh = part(facePlane(0.066, 0.054, 0.011), sheenMat, head);
            sh.rotation.y = Math.PI / 2;
            sh.position.x = 0.035;
            part(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
                new THREE.Vector3(-0.075, 0, 0), new THREE.Vector3(-0.1, -0.02, 0.01), new THREE.Vector3(-0.12, -0.05, 0.0),
            ]), 8, 0.006, 5, false), rubberMat, head);
        }
        group.add(base);
        return { base, shoulder, elbow, head, screen };
    }
    const arms = [], ghosts = [];
    // the ghosts share two materials per layer: three layers of after-image, nine arms
    const ghostMats = [0, 1, 2].map(() => [
        new THREE.MeshLambertMaterial({ color: PLATE, transparent: true, opacity: 0, depthWrite: false }),
        new THREE.MeshLambertMaterial({ color: JOINT, transparent: true, opacity: 0, depthWrite: false }),
    ]);
    for (let i = 0; i < 3; i++) {
        const a = makeArm({ plate: plateMat, joint: jointMat, glass: glassMat }, true, GLYPHS[i]);
        const yaw = i * 2 * Math.PI / 3 + Math.PI / 6;
        a.base.rotation.y = yaw;
        arms.push(a);
        const gs = [];
        for (let k = 0; k < 3; k++) {
            const g = makeArm({ plate: ghostMats[k][0], joint: ghostMats[k][1] }, false);
            g.base.rotation.y = yaw;
            g.base.visible = false;
            gs.push(g);
        }
        ghosts.push(gs);
    }
    const screens = [mainScreen, ...arms.map((a) => a.screen)];

    function ik(x, y) {
        const d2 = x * x + y * y;
        const c = Math.max(-1, Math.min(1, (d2 - L1 * L1 - L2 * L2) / (2 * L1 * L2)));
        const phi = Math.acos(c);
        const theta = Math.atan2(y, x) - Math.atan2(L2 * Math.sin(phi), L1 + L2 * Math.cos(phi));
        return [theta, phi];
    }
    const HIT = ik(-R0 + 0.15, RING_Y + 0.06 - H0);

    /* ------------------------------------------------ the energy, through cables
       Armoured cables come up from the lid below, climb beside the neck, pass up through the plate
       and the deck and run under brackets into the hub's junction box and each arm's shoulder.
       The energy is seen INSIDE: a glowing core through the gaps between the armour rings, pulses
       climbing it, faster and brighter the better the machine is fed. */
    const cableU = { uFlow: { value: 0 }, uGlow: { value: 0 }, uBright: { value: 0.5 }, uColor: { value: new THREE.Color(ENERGY) } };
    const cableMats = [];
    function makeCable(points, rs) {
        const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal');
        const len = curve.getLength();
        const mat = new THREE.ShaderMaterial({
            uniforms: { ...cableU, uLen: { value: len }, uOff: { value: Math.random() } },
            vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
            fragmentShader: [
                'uniform float uFlow, uGlow, uBright, uLen, uOff; uniform vec3 uColor; varying vec2 vUv;',
                'void main(){',
                '  float s = vUv.x * uLen;',
                '  float ph = fract((s - uFlow - uOff) / 0.45);',
                '  float p = smoothstep(0.0, 0.05, ph) * (1.0 - smoothstep(0.05, 0.3, ph));',
                '  float k = mix(0.16 + 1.7 * p, 1.25, uGlow) * uBright;',
                '  gl_FragColor = vec4(uColor * k + vec3(0.6, 0.8, 1.0) * p * uBright * 0.35 * (1.0 - uGlow), 1.0);',
                '}',
            ].join('\n'),
        });
        cableMats.push(mat);
        part(new THREE.TubeGeometry(curve, Math.ceil(len * 50), rs * 0.6, 8, false), mat);
        // the armour: rings with gaps, the core shows between them; one instanced mesh a cable
        const STEP = rs * 1.9;
        const n = Math.floor(len / STEP);
        const rings = new THREE.InstancedMesh(new THREE.CylinderGeometry(rs, rs, rs * 1.15, 10), armourMat, n);
        const m = new THREE.Matrix4(), q = new THREE.Quaternion(), one = new THREE.Vector3(1, 1, 1);
        const pt = new THREE.Vector3(), tg = new THREE.Vector3();
        for (let i = 0; i < n; i++) {
            const t = (i + 0.5) * STEP / len;
            curve.getPointAt(t, pt);
            curve.getTangentAt(t, tg);
            q.setFromUnitVectors(UP, tg);
            m.compose(pt, q, one);
            rings.setMatrixAt(i, m);
        }
        group.add(rings);
        return { curve, len, rs };
    }
    function grommet(at, rs) {
        still(new THREE.TorusGeometry(rs + 0.012, 0.011, 8, 20), jointMat, at.x, DECK + 0.004, at.z, Math.PI / 2);
    }
    function bracket(cab, t) {
        const p = cab.curve.getPointAt(t), tan = cab.curve.getTangentAt(t);
        const a = Math.atan2(-tan.z, tan.x);
        const h = cab.rs * 2 + 0.014, w = cab.rs * 2 + 0.03;
        const rot = new THREE.Quaternion().setFromAxisAngle(UP, a);
        const local = (x, y, z) => new THREE.Vector3(x, y, z).applyQuaternion(rot).add(new THREE.Vector3(p.x, DECK, p.z));
        const at = local(0, h, 0);
        still(new THREE.BoxGeometry(0.03, 0.01, w), plateMat, at.x, at.y, at.z, 0, 0, 0, rot);
        [-1, 1].forEach((s) => {
            const leg = local(0, h / 2, s * w / 2);
            still(new THREE.BoxGeometry(0.03, h, 0.01), plateMat, leg.x, leg.y, leg.z, 0, 0, 0, rot);
            const foot = local(0, 0.003, s * (w / 2 + 0.014));
            still(new THREE.BoxGeometry(0.03, 0.006, 0.03), plateMat, foot.x, foot.y, foot.z, 0, 0, 0, rot);
            const b = local(0, 0.01, s * (w / 2 + 0.016));
            bolt(b.x, b.y, b.z, 0.6, jointMat);
        });
    }
    // the climb from the lid: out from under the plate's edge, down beside the neck to the lid
    const climb = (r, a) => [P(r + 0.22, below + 0.02, a + 0.22), P(r + 0.2, below + 0.2, a + 0.18), P(r + 0.1, below * 0.5, a + 0.08), P(r, -0.15, a)];
    let lampAt = null;
    {
        const a = 300 * D2R, rs = 0.03;
        const jb = P(0.21, DECK + 0.04, a);
        still(new THREE.BoxGeometry(0.1, 0.08, 0.09), jointMat, jb.x, jb.y, jb.z, 0, a, 0);
        bolt(jb.x, DECK + 0.085, jb.z, 0.9);
        lampAt = new THREE.Vector3(jb.x, DECK + 0.095, jb.z).addScaledVector(dirOf(a), 0.03);
        const cab = makeCable([
            ...climb(0.74, a),
            P(0.72, DECK - 0.02, a), P(0.69, DECK + rs + 0.02, a - 0.01), P(0.58, DECK + rs, a + 0.02),
            P(0.42, DECK + rs, a - 0.015), P(0.3, DECK + rs + 0.004, a), P(0.26, DECK + 0.04, a),
        ], rs);
        grommet(P(0.72, DECK, a), rs);
        bracket(cab, 0.84); bracket(cab, 0.92);
    }
    for (let i = 0; i < 3; i++) {
        const ay = i * 2 * Math.PI / 3 + Math.PI / 6;
        const a = ay + 0.26, rs = 0.019;
        const sh = P(R0, H0, ay), tg = new THREE.Vector3(Math.sin(ay), 0, Math.cos(ay));
        const end = sh.clone().addScaledVector(tg, 0.06);
        const cab = makeCable([
            ...climb(0.66, a),
            P(0.64, DECK - 0.02, a), P(0.62, DECK + rs + 0.02, a - 0.01), P(0.52, DECK + rs, a + 0.01), P(0.42, DECK + rs, a),
            P(0.36, DECK + 0.12, a - 0.04), P(0.3, DECK + 0.26, a - 0.12), end.clone().addScaledVector(tg, 0.05).setY(H0 - 0.08), end,
        ], rs);
        grommet(P(0.64, DECK, a), rs);
        bracket(cab, 0.8);
    }
    // the lamp on the junction box: steady awake, the automated rooms' rhythm asleep
    const lampMat = new THREE.MeshBasicMaterial({ color: ENERGY });
    const lamp = part(new THREE.SphereGeometry(0.014, 10, 8), lampMat);
    lamp.position.copy(lampAt);

    /* ------------------------------------------------ the pistons that throw the arms */
    const pistons = [];
    const sleeveGeo = new THREE.CylinderGeometry(0.022, 0.024, 0.17, 12);
    const rodGeo = new THREE.CylinderGeometry(0.01, 0.01, 1, 8);
    const eyeGeo = new THREE.SphereGeometry(0.016, 10, 8);
    for (let i = 0; i < 3; i++) {
        const ay = i * 2 * Math.PI / 3 + Math.PI / 6;
        const base = P(0.37, DECK + 0.03, ay);
        still(new THREE.BoxGeometry(0.06, 0.04, 0.05), jointMat, base.x, DECK + 0.02, base.z, 0, ay, 0);
        bolt(base.x + Math.sin(ay) * 0.035, DECK + 0.045, base.z + Math.cos(ay) * 0.035, 0.7);
        bolt(base.x - Math.sin(ay) * 0.035, DECK + 0.045, base.z - Math.cos(ay) * 0.035, 0.7);
        pistons.push({ base, sleeve: part(sleeveGeo, jointMat), rod: part(rodGeo, plateMat), eye: part(eyeGeo, jointMat), arm: i });
    }
    const pv = new THREE.Vector3(), pdir = new THREE.Vector3(), pq = new THREE.Quaternion();
    function updatePistons() {
        group.updateMatrixWorld();
        for (const p of pistons) {
            arms[p.arm].shoulder.localToWorld(pv.set(0.14, -0.03, 0));
            group.worldToLocal(pv);
            pdir.copy(pv).sub(p.base);
            const dist = pdir.length();
            pdir.normalize();
            pq.setFromUnitVectors(UP, pdir);
            p.sleeve.quaternion.copy(pq);
            p.sleeve.position.copy(p.base).addScaledVector(pdir, 0.085);
            const rl = Math.max(0.02, dist - 0.05);
            p.rod.quaternion.copy(pq);
            p.rod.scale.set(1, rl, 1);
            p.rod.position.copy(pv).addScaledVector(pdir, -rl / 2);
            p.eye.position.copy(pv);
        }
    }

    /* ------------------------------------------------ smoke */
    const puffGeo = new THREE.IcosahedronGeometry(1, 1);
    const puffs = [];
    for (let i = 0; i < N_PUFFS; i++) {
        const mat = new THREE.MeshLambertMaterial({ color: 0xc6cfd9, emissive: 0x4a535e, transparent: true, depthWrite: false });
        const m = part(puffGeo, mat);
        m.visible = false;
        puffs.push({ m, life: 0, max: 1, sx: 1, drift: new THREE.Vector3(), thick: 1 });
    }
    let puffNext = 0, puffClock = 0;

    /* ------------------------------------------------ sparks */
    const spPos = new Float32Array(N_SPARKS * 3), spCol = new Float32Array(N_SPARKS * 3);
    const spVel = new Float32Array(N_SPARKS * 3), spLife = new Float32Array(N_SPARKS), spMax = new Float32Array(N_SPARKS);
    for (let i = 0; i < N_SPARKS; i++) spPos[i * 3 + 1] = -100;
    const spGeo = new THREE.BufferGeometry();
    spGeo.setAttribute('position', new THREE.BufferAttribute(spPos, 3));
    spGeo.setAttribute('color', new THREE.BufferAttribute(spCol, 3));
    const sparkMat = new THREE.PointsMaterial({ size: 0.035, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    const sparks = new THREE.Points(spGeo, sparkMat);
    sparks.frustumCulled = false;
    group.add(sparks);
    let spNext = 0, sparksLive = 0;
    const tmpV = new THREE.Vector3();
    function burst(at, n) {
        for (let k = 0; k < n; k++) {
            const i = spNext++ % N_SPARKS;
            spPos[i * 3] = at.x; spPos[i * 3 + 1] = at.y; spPos[i * 3 + 2] = at.z;
            const a = Math.random() * Math.PI * 2, u = Math.random() * 2 - 1, s = 0.6 + Math.random() * 1.1;
            const rr = Math.sqrt(1 - u * u);
            spVel[i * 3] = Math.cos(a) * rr * s; spVel[i * 3 + 1] = Math.abs(u) * s + 0.5; spVel[i * 3 + 2] = Math.sin(a) * rr * s;
            spMax[i] = spLife[i] = 0.35 + Math.random() * 0.45;
        }
        sparksLive = 1.0;
    }
    function updateSparks(dt) {
        if (sparksLive <= 0) return;
        sparksLive -= dt;
        for (let i = 0; i < N_SPARKS; i++) {
            if (spLife[i] <= 0) continue;
            spLife[i] -= dt;
            spVel[i * 3 + 1] -= 3.2 * dt;
            spPos[i * 3] += spVel[i * 3] * dt; spPos[i * 3 + 1] += spVel[i * 3 + 1] * dt; spPos[i * 3 + 2] += spVel[i * 3 + 2] * dt;
            const f = Math.max(0, spLife[i] / spMax[i]);
            spCol[i * 3] = f; spCol[i * 3 + 1] = f * (0.55 + 0.4 * f); spCol[i * 3 + 2] = f * f * 0.6;
            if (spLife[i] <= 0) { spPos[i * 3 + 1] = -100; spCol[i * 3] = spCol[i * 3 + 1] = spCol[i * 3 + 2] = 0; }
        }
        spGeo.attributes.position.needsUpdate = true;
        spGeo.attributes.color.needsUpdate = true;
    }

    /* ------------------------------------------------ the merge: what does not move, one mesh per material */
    const merged = [];
    for (const [mat, geos] of statics) {
        const g = mergeGeometries(geos, false);
        geos.forEach((x) => x.dispose());
        if (!g) continue;
        const m = new THREE.Mesh(g, mat);
        group.add(m);
        merged.push(m);
    }
    statics.clear();

    // what a hover hits: one invisible drum round the whole machine, its plate included
    const proxy = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.0, 1.75, 16), new THREE.MeshBasicMaterial());
    proxy.position.y = 0.75;
    proxy.visible = false;
    group.add(proxy);

    /* ------------------------------------------------ the drive */
    let throws = 0, drive = 0, quiet = 1, asleep = false;
    let gc = 0, ringThrow = 0, chainPos = 0, time = 0, screenClock = 0;
    let wins = 0, games = 0, bursts = 0;
    // the arms at rest: hanging when starved, standing when fed (written into `restAt`, never a new array)
    const restAt = [0, 0];
    function rest(i) {
        const k = Math.sqrt(drive);
        restAt[0] = (-24 + 30 * k) * D2R + Math.sin(time * (0.5 + k) + i * 2.1) * (0.5 + 2.5 * k) * D2R;
        restAt[1] = (-14 + 10 * k) * D2R;
        return restAt;
    }
    const inOut = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
    const easeIn = (t) => t * t * t;
    const pose = [0, 0];
    function poseAt(i, g0) {
        const r = rest(i);
        const g = Math.floor(g0), p = g0 - g;
        if (g0 <= 0 || ((g % 3) + 3) % 3 !== i) { pose[0] = r[0]; pose[1] = r[1]; return pose; }
        const w0 = r[0] - 12 * D2R, w1 = r[1] - 26 * D2R;
        let a, b, t;
        if (p < 0.22) { t = inOut(p / 0.22); a = r[0] + (w0 - r[0]) * t; b = r[1] + (w1 - r[1]) * t; }
        else if (p < 0.48) { t = easeIn((p - 0.22) / 0.26); a = w0 + (HIT[0] - w0) * t; b = w1 + (HIT[1] - w1) * t; }
        else if (p < 0.62) { const k = Math.sin((p - 0.48) / 0.14 * Math.PI) * 4 * D2R; a = HIT[0] + k; b = HIT[1] - k * 0.6; }
        else { t = inOut((p - 0.62) / 0.38); a = HIT[0] + (r[0] - HIT[0]) * t; b = HIT[1] + (r[1] - HIT[1]) * t; }
        pose[0] = a; pose[1] = b;
        return pose;
    }
    function apply(arm, ps) { arm.shoulder.rotation.z = ps[0]; arm.elbow.rotation.z = ps[1]; }
    function newGame() {
        ringThrow = Math.floor(Math.random() * 3);
        mainScreen.glyph = GLYPHS[ringThrow];
        games++;
    }
    function land(g) {
        const i = ((g % 3) + 3) % 3;
        const d = (i - ringThrow + 3) % 3;       // 1: the arm wins, 2: the ring wins, 0: a draw
        if (d !== 1) return;
        wins++;
        arms[i].screen.win = 0.35;
        mainScreen.noise = 0.18;
        if (bursts < 2 && quiet > 0) {
            bursts++;
            arms[i].head.getWorldPosition(tmpV); group.worldToLocal(tmpV);
            burst(tmpV, Math.round((throws > 6 ? 8 : 18) * quiet));
            glass.getWorldPosition(tmpV); group.worldToLocal(tmpV);
            burst(tmpV, Math.round((throws > 6 ? 6 : 12) * quiet));
        }
        flashStar(time);
    }
    function meshAngle(g, theta1) {
        return -(28 / g.n) * (theta1 - g.phi) + g.phi + Math.PI + Math.PI / g.n;
    }
    function updateDrive(dt) {
        const w1 = throws <= 0 ? 0.05 : 0.05 + 1.1 * throws;
        G1.theta += w1 * dt;
        G1.grp.rotation.y = G1.theta;
        G2.grp.rotation.y = meshAngle(G2, G1.theta);
        G3.grp.rotation.y = meshAngle(G3, G1.theta);
        const w2 = w1 * 28 / 12;
        pulley2.rotation.y = G2.grp.rotation.y;
        const v = w2 * R_P2;
        chainPos += v * dt;
        pulley1.rotation.y -= (v / R_P1) * dt;
        fly.rotation.y = pulley1.rotation.y;
        const gb = Math.max(0, Math.min(0.85, (w1 - 6) / 14)), gb2 = Math.max(0, Math.min(0.85, (w2 - 6) / 14));
        G1.blur.opacity = gb; G2.blur.opacity = gb2; G3.blur.opacity = gb2;
        G1.blurMesh.visible = gb > 0.01; G2.blurMesh.visible = gb2 > 0.01; G3.blurMesh.visible = gb2 > 0.01;
        flyBlurMat.opacity = Math.max(0, Math.min(0.7, (v / R_P1 - 6) / 16));
        flyBlur.visible = flyBlurMat.opacity > 0.01;
        for (let i = 0; i < N_LINKS; i++) {
            const t = (((i * 0.03 + chainPos) / CHAIN_LEN) % 1 + 1) % 1;
            links.setMatrixAt(i, chainMats[Math.floor(t * CHAIN_SAMPLES) % CHAIN_SAMPLES]);
        }
        links.instanceMatrix.needsUpdate = true;
        // the cables: pulses climbing, faster and brighter when fed; at a blur, a steady glow
        cableU.uFlow.value += (throws <= 0 ? 0.05 : 0.25 + 1.8 * drive) * dt;
        cableU.uBright.value = (throws <= 0 ? 0.3 : 0.4 + 0.9 * drive) * (0.55 + 0.45 * quiet);
        cableU.uGlow.value += ((throws > 9 ? 1 : 0) - cableU.uGlow.value) * Math.min(1, dt * 3);
        // smoke: a puff now and then, often when it works hard; thin when starved or asleep
        puffClock += dt;
        const every = throws <= 0 ? 2.6 : Math.max(0.08, 1.1 - 0.9 * drive) / Math.max(0.3, quiet);
        if (puffClock > every) {
            puffClock = 0;
            const p = puffs[puffNext++ % puffs.length];
            p.life = p.max = 1.8 + Math.random() * 0.8;
            p.sx = 0.8 + Math.random() * 0.5;
            p.thick = (0.3 + 0.7 * drive) * quiet;
            p.m.position.copy(EX_TOP);
            p.m.visible = true;
            p.drift.set((Math.random() - 0.3) * 0.05, 0.22 + Math.random() * 0.08, (Math.random() - 0.5) * 0.05);
        }
        for (const p of puffs) {
            if (p.life <= 0) { if (p.m.visible) p.m.visible = false; continue; }
            p.life -= dt;
            const k = 1 - p.life / p.max;
            p.m.position.addScaledVector(p.drift, dt);
            p.m.scale.set((0.035 + k * 0.13) * p.sx, 0.03 + k * 0.1, 0.035 + k * 0.12);
            p.m.material.opacity = 0.55 * p.thick * Math.pow(1 - k, 1.4);
        }
        updatePistons();
    }

    return {
        group,
        plate,
        /** deep-grow: the three arm heads (the tubes), in arm order, for the hands (hands.js). */
        armHeads: arms.map((a) => a.head),
        /** deep-grow: the game clock, so the hands throw on the machine's own rhythm. */
        get gc() { return gc; },
        /** Where the star flash rises from, in the group's frame. */
        topAt: new THREE.Vector3(0, CRT_Y + 0.3, 0),
        /**
         * @param {{throws:number, drive:number, quiet:number}} t - machine.js machineTempo
         * @param {boolean} [sleeping]
         */
        setTempo(t, sleeping = false) {
            throws = Math.max(0, (t && t.throws) || 0);
            drive = Math.max(0, Math.min(1, (t && t.drive) || 0));
            quiet = Math.max(0, Math.min(1, t && Number.isFinite(t.quiet) ? t.quiet : 1));
            asleep = !!sleeping;
        },
        /** One frame. */
        step(dt) {
            time += dt;
            bursts = 0;
            const before = gc;
            let rate = throws;
            if (!(rate > 0) && gc > Math.floor(gc)) rate = 0.25;    // a throw under way is finished
            gc += rate * dt;
            if (!(throws > 0) && Math.floor(gc) > Math.floor(before)) gc = Math.floor(gc);
            const gFrom = Math.max(Math.floor(before), Math.floor(gc) - 6);
            for (let g = gFrom; g <= Math.floor(gc); g++) {
                if (g > Math.floor(before)) newGame();
                if (g + 0.48 > before && g + 0.48 <= gc) land(g);
            }
            const T = throws > 0 ? 1 / throws : Infinity;
            const blur = Math.max(0, Math.min(1, (1.0 - T) / 0.7));
            for (let k = 0; k < 3; k++) {
                const o = blur * GHOST_O[k];
                ghostMats[k][0].opacity = o; ghostMats[k][1].opacity = o;
            }
            for (let i = 0; i < 3; i++) {
                apply(arms[i], poseAt(i, gc));
                const gs = ghosts[i];
                for (let k = 0; k < 3; k++) {
                    const on = blur * GHOST_O[k] > 0.01;
                    gs[k].base.visible = on;
                    if (on) apply(gs[k], poseAt(i, gc - (k + 1) * 0.055));
                }
            }
            // the tubes: flicker always, dim when starved, dimmer asleep
            const bright = (0.45 + 0.55 * drive) * (0.6 + 0.4 * quiet);
            screenClock += dt;
            for (const sc of screens) {
                sc.win = Math.max(0, sc.win - dt);
                sc.noise = Math.max(0, sc.noise - dt);
                const dip = Math.random() < 0.02 ? 0.55 : 1;
                sc.mat.color.setScalar(bright * (0.84 + Math.random() * 0.16) * dip);
            }
            if (screenClock > 1 / SCREEN_HZ) {
                screenClock = 0;
                for (const sc of screens) drawScreen(sc, time);
            }
            // the lamp: steady awake, the automated rooms' rhythm asleep
            lampMat.color.setHex(ENERGY).multiplyScalar(asleep ? lampLevel(time) : (throws > 0 ? 1 : 0.3));
            updateDrive(dt);
            updateSparks(dt);
        },
        /** Does this ray (the scene's, set from the camera) land on the machine? */
        hits(raycaster) {
            return raycaster.intersectObject(proxy, false).length > 0;
        },
        get stats() {
            return { throws, drive, quiet, asleep, games, wins, meshes: group.children.filter((o) => o.isMesh).length, merged: merged.length };
        },
        dispose() {
            group.traverse((o) => {
                if (o.isMesh || o.isPoints || o.isInstancedMesh) o.geometry?.dispose();
            });
            for (const m of [...mats, flyBlurMat, lampMat, sparkMat, proxy.material, ...blurMats, ...cableMats, ...ghostMats.flat(), ...puffs.map((p) => p.m.material)]) m.dispose();
            for (const sc of screens) { sc.tex.dispose(); sc.mat.dispose(); }
            for (const el of starEls) el.parentElement?.remove();
            group.removeFromParent();
        },
    };
}
