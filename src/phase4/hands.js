/**
 * Chapter IV · THE DEEP, movement III · GROW: THE MACHINE'S HANDS. When the body reaches the machine
 * house, the three picture tubes on the arms are overgrown and become hands: a fist (rock), a flat
 * hand (paper), two fingers (scissors). The game was always a game of hands. See
 * docs/superpowers/specs/2026-10-03-chapter-iv-rebuild.md, "III · GROW".
 *
 * Built from capsules in the flesh material (flesh.js), with bone-pale knuckles and tendons. Nothing
 * here edits machine-model.js: the hands hang on the arm heads the machine already has, found in its
 * group by findArmHeads(), and they throw on the machine's own rhythm (the same game clock as
 * machine-model.js: arm i plays game g when g % 3 === i, and the throw lands at 0.48 of a game).
 *
 * The integration can skip findArmHeads by exposing the heads from createMachine (`arms[i].head`)
 * and the game clock (`gc`), and handing them to attach() and step() / sync().
 *
 * Usage:
 *   const hands = createHands({ envMap });
 *   hands.attach(findArmHeads(machine.group));
 *   hands.overgrow();                 // the tubes give way to hands over OVERGROW_SECONDS
 *   per frame: hands.step(dt, machineTempo.throws);
 */

import * as THREE from 'three';
import { makeFleshMaterial, fleshify } from './flesh.js';

/** The three throws, in the machine's arm order (gem, file-text, scissors on the tubes). */
export const THROWS = ['rock', 'paper', 'scissors'];
/** Seconds the tubes take to be overgrown and the hands to grow out of them. */
export const OVERGROW_SECONDS = 3.2;
/** How big a hand is: it has to read against the dark at the home view. */
export const HAND_SCALE = 3.2;
/** When in a game the throw lands (machine-model.js poseAt / land). */
const LAND = 0.48;

const BONE = 0xa9aca6;
const D2R = Math.PI / 180;

/* the curl of each finger's three joints, and the spread, for each shape */
const SHAPES = {
    fist: { fingers: [[95, 100, 70], [100, 105, 70], [100, 100, 70], [95, 95, 65]], spread: [-4, 0, 4, 8], thumb: [55, 40] },
    flat: { fingers: [[4, 3, 2], [2, 2, 1], [4, 3, 2], [6, 4, 3]], spread: [-9, -2, 5, 13], thumb: [-10, 5] },
    vee: { fingers: [[3, 2, 1], [3, 2, 1], [100, 100, 70], [95, 95, 65]], spread: [-14, 12, 6, 10], thumb: [55, 40] },
    rest: { fingers: [[38, 40, 25], [42, 44, 28], [46, 46, 30], [50, 48, 32]], spread: [-6, 0, 5, 10], thumb: [20, 20] },
};
const GESTURE = { rock: 'fist', paper: 'flat', scissors: 'vee' };

/**
 * The three arm heads of a createMachine() group, in arm order, found by shape: an arm is a group
 * directly in the machine whose shoulder holds an elbow holding the head, and a real head carries
 * the tube, its cage and its face (the after-image arms carry two parts and start hidden).
 * @param {THREE.Object3D} machineGroup
 * @returns {THREE.Object3D[]}
 */
export function findArmHeads(machineGroup) {
    const heads = [];
    for (const base of machineGroup.children) {
        if (!base.isGroup || !base.visible) continue;
        const shoulder = base.children.find((o) => o.isGroup);
        const elbow = shoulder && shoulder.children.find((o) => o.isGroup);
        const head = elbow && elbow.children.find((o) => o.isGroup);
        if (head && head.children.length > 3) heads.push(head);
    }
    return heads.slice(0, 3);
}

function capsule(r, len, mat) {
    const g = new THREE.CapsuleGeometry(r, len, 4, 10);
    g.rotateZ(-Math.PI / 2);                // along +x
    g.translate(len / 2 + r * 0.6, 0, 0);    // from its root outwards
    return new THREE.Mesh(g, mat);
}

/** One hand: a palm along +x, palm down (-y), fingers out of its far edge. */
function buildHand(flesh, bone, side) {
    const hand = new THREE.Group();
    const palm = new THREE.Group();
    hand.add(palm);
    // the palm: a thick, uneven slab of capsules, nothing ruled
    const pw = 0.03, pl = 0.05;
    for (let k = 0; k < 3; k++) {
        const c = capsule(pw * (0.58 + 0.05 * k), pl * (0.9 - 0.1 * k), flesh);
        c.position.set(-0.006 + k * 0.002, (k - 1) * 0.004, (k - 1) * 0.016);
        c.scale.set(1, 0.72, 1);
        palm.add(c);
    }
    // the wrist: a tendon sheath back into the arm
    const wrist = capsule(0.016, 0.045, flesh);
    wrist.position.x = -0.05;
    palm.add(wrist);
    const fingers = [];
    const lens = [[0.024, 0.017, 0.013], [0.027, 0.019, 0.014], [0.025, 0.018, 0.013], [0.019, 0.014, 0.011]];
    for (let f = 0; f < 4; f++) {
        const root = new THREE.Group();
        root.position.set(pl + 0.008 - Math.abs(f - 1.4) * 0.004, 0.002, (f - 1.5) * 0.0165 * side);
        palm.add(root);
        const joints = [];
        let parent = root;
        for (let j = 0; j < 3; j++) {
            const jg = new THREE.Group();
            if (j > 0) jg.position.x = lens[f][j - 1] + 0.006;
            parent.add(jg);
            const r = 0.0088 - j * 0.0012 - (f === 3 ? 0.001 : 0);
            jg.add(capsule(r, lens[f][j], flesh));
            // a bone-pale knuckle on the back of each joint
            const kn = new THREE.Mesh(new THREE.SphereGeometry(r * 0.75, 8, 6), bone);
            kn.position.set(0.002, r * 0.55, 0);
            kn.scale.set(1.2, 0.6, 1);
            jg.add(kn);
            joints.push(jg);
            parent = jg;
        }
        // a tendon down the back of the palm to the finger
        const t = capsule(0.0022, pl * 0.75, bone);
        t.position.set(0.004, 0.012, (f - 1.5) * 0.012 * side);
        palm.add(t);
        fingers.push({ root, joints });
    }
    // the thumb, off the near side, turned in
    const tRoot = new THREE.Group();
    tRoot.position.set(0.012, -0.004, -0.036 * side);
    tRoot.rotation.y = 50 * D2R * side;
    palm.add(tRoot);
    const tj = [];
    let tp = tRoot;
    for (let j = 0; j < 2; j++) {
        const jg = new THREE.Group();
        if (j > 0) jg.position.x = 0.021;
        tp.add(jg);
        jg.add(capsule(0.0095 - j * 0.0014, 0.018, flesh));
        tj.push(jg);
        tp = jg;
    }
    return { hand, palm, fingers, thumb: tj, cur: null };
}

function shapeArrays(name) {
    const s = SHAPES[name];
    return { fingers: s.fingers.map((a) => a.map((v) => v * D2R)), spread: s.spread.map((v) => v * D2R), thumb: s.thumb.map((v) => v * D2R) };
}
const PRE = { fist: shapeArrays('fist'), flat: shapeArrays('flat'), vee: shapeArrays('vee'), rest: shapeArrays('rest') };

function poseHand(h, target, k) {
    // k: how far toward the target this frame (0 to 1); joints bend palm-ward (about +z, down)
    for (let f = 0; f < 4; f++) {
        const fg = h.fingers[f];
        fg.root.rotation.y += (target.spread[f] - fg.root.rotation.y) * k;
        for (let j = 0; j < 3; j++) {
            const jg = fg.joints[j];
            jg.rotation.z += (-target.fingers[f][j] - jg.rotation.z) * k;
        }
    }
    h.thumb[0].rotation.z += (-target.thumb[0] - h.thumb[0].rotation.z) * k;
    h.thumb[1].rotation.z += (-target.thumb[1] - h.thumb[1].rotation.z) * k;
}

/**
 * The three hands. Nothing is shown until attach() and overgrow().
 * @param {object} [opts] - { envMap, scale = HAND_SCALE, overgrowArms = true }
 */
export function createHands(opts = {}) {
    const flesh = makeFleshMaterial({ mode: 'uv', uvScale: [1.1, 0.7], seed: 31, envMap: opts.envMap, pulse: 0.7, tint: 2.2 });
    const bone = new THREE.MeshPhysicalMaterial({ color: BONE, roughness: 0.38, metalness: 0.05, clearcoat: 0.8, clearcoatRoughness: 0.2, envMap: opts.envMap || null });
    const scale = opts.scale ?? HAND_SCALE;
    const hands = THROWS.map((_, i) => {
        const h = buildHand(flesh, bone, i === 1 ? -1 : 1);
        h.hand.scale.setScalar(0.0001);
        h.hand.visible = false;
        poseHand(h, PRE.rest, 1);
        h.shake = 0;
        return h;
    });
    let heads = [];
    let tubes = [];             // the head's own parts, to shrink away
    let grow = -1;              // -1: not yet; 0 to 1: overgrowing; 1: hands
    let gc = 0;                 // the game clock, as the machine keeps it
    let time = 0;

    return {
        hands: hands.map((h) => h.hand),
        material: flesh,
        /** Hangs a hand on each head (the machine's arm heads, in arm order). */
        attach(list) {
            heads = (list || []).slice(0, 3);
            tubes = heads.map((hd) => hd.children.slice());
            heads.forEach((hd, i) => {
                const h = hands[i];
                h.hand.position.set(-0.02, 0, 0);
                h.hand.rotation.set(0, 0, -0.2);
                hd.add(h.hand);
            });
        },
        /** The tubes give way and the hands grow out of them; the arms turn to sinew. */
        overgrow(seconds = OVERGROW_SECONDS) {
            if (!heads.length) return;
            grow = 0;
            this._dur = seconds;
            if (opts.overgrowArms !== false) {
                for (const hd of heads) {
                    const elbow = hd.parent, shoulder = elbow && elbow.parent;
                    const from = (shoulder || hd).getWorldPosition(new THREE.Vector3());
                    for (const g of [shoulder, elbow]) {
                        if (!g) continue;
                        for (const m of g.children) {
                            if (!m.isMesh) continue;
                            fleshify(m, { from, duration: seconds * 0.8, mode: 'uv', uvScale: [1.6, 0.8], breathe: false, envMap: opts.envMap, sinew: 0.5, pulse: 0.4, tint: 1.5 });
                        }
                    }
                }
            }
        },
        /** The game clock straight from the machine, if it exposes it (then step's own is ignored). */
        sync(machineGc) { gc = machineGc; this._synced = true; },
        /**
         * One frame. `throws` is the machine's tempo (machine.js machineTempo().throws): games a second.
         */
        step(dt, throws = 0) {
            time += dt;
            if (grow >= 0 && grow < 1) {
                grow = Math.min(1, grow + dt / (this._dur || OVERGROW_SECONDS));
                const k = grow * grow * (3 - 2 * grow);
                heads.forEach((hd, i) => {
                    const h = hands[i];
                    h.hand.visible = true;
                    h.hand.scale.setScalar(Math.max(0.0001, scale * Math.min(1, k * 1.15)));
                    for (const t of tubes[i]) {
                        if (t === h.hand) continue;
                        const s = Math.max(0.0001, 1 - k * 1.4);
                        t.scale.setScalar(s);
                        if (s <= 0.001) t.visible = false;
                    }
                });
            }
            if (grow < 0) return;
            if (!this._synced) {
                // the machine's own clock: the same rule as machine-model.js step()
                let rate = throws;
                if (!(rate > 0) && gc > Math.floor(gc)) rate = 0.25;
                const before = gc;
                gc += rate * dt;
                if (!(throws > 0) && Math.floor(gc) > Math.floor(before)) gc = Math.floor(gc);
            }
            const g = Math.floor(gc), p = gc - g;
            const fast = throws > 6;
            for (let i = 0; i < 3; i++) {
                const h = hands[i];
                const mine = gc > 0 && ((g % 3) + 3) % 3 === i;
                let target = PRE.rest, k = 1 - Math.exp(-dt * 6);
                if (mine) {
                    if (p < LAND) { target = PRE.fist; k = 1 - Math.exp(-dt * 14); }      // wind up: a fist
                    else if (p < 0.7) { target = PRE[GESTURE[THROWS[i]]]; k = 1 - Math.exp(-dt * 40); }   // shoot
                    else { target = PRE[GESTURE[THROWS[i]]]; k = 1 - Math.exp(-dt * 3); }
                }
                if (fast) { target = PRE[GESTURE[THROWS[i]]]; k = 1 - Math.exp(-dt * 10); }
                poseHand(h, target, k);
                // a tremor in the palm, the body's own: slow, never the same in two hands
                h.palm.rotation.x = 0.06 * Math.sin(time * 1.3 + i * 2.1);
                h.palm.rotation.y = 0.04 * Math.sin(time * 0.9 + i * 1.3);
            }
        },
        /** Starved: the hands grey with the rest (the material's necrosis). */
        setNecrotic(on) { flesh.userData.flesh.uNecro.value = on ? 1 : 0; },
        get stats() {
            return { attached: heads.length, grow, gc, visible: hands.filter((h) => h.hand.visible).length };
        },
        dispose() {
            hands.forEach((h) => {
                h.hand.removeFromParent();
                h.hand.traverse((o) => { if (o.isMesh) o.geometry.dispose(); });
            });
            flesh.dispose();
            bone.dispose();
        },
    };
}
