/**
 * Chapter IV · THE DEEP, movement III · GROW: THE FLESH, as a material. Turns a light concrete slab
 * into cold, dark, wet tissue and back, with no texture files: everything is drawn in the shader.
 *
 * The look is locked in docs/mockups/deep-tree-12.html (tab "biological") and the spec
 * docs/superpowers/specs/2026-10-02-chapter-iv-tree-and-bio.md ("Looks locked"): mycelium threads,
 * sinew and blood vessels; one deep arterial red for the pulse; near black-red, bruise purple and
 * wet gunmetal, bone-pale ribbing. No mushrooms, no sacs, no eyes, no mirror symmetry, no beige,
 * nothing digital.
 *
 * ANY FLAT SURFACE. The pattern is drawn in WORLD space, projected along the surface's dominant
 * axis: the top of a 3D slab, a flat quad seen straight from above (orthographic plan) and a vertical
 * cross-section all get the same tissue, and the veins run on across neighbouring plates and the
 * bridges between them. Curved things (tendrils, hands) use their own UVs instead (mode 'uv').
 *
 * THE STATE IS UNIFORMS, independent of geometry, per mesh:
 *   uFront   how far the flesh has spread from uOrigin, in world units (0 = none, uFrontEnd = all)
 *   uOrigin  where it spreads from (world): the edge that touches the body
 *   uNecro   0 alive, 1 necrotic (grey, still, dry)
 *   uHint    0 to 1: the body leans over this plate's edge (it is reachable; 1 under the cursor)
 *   uPulse   how strong the arterial pulse runs in it
 * and shared by every flesh material: uTime and uHeart (the pulse runs outward from the heart).
 *
 * One shader program for every flesh mesh (customProgramCacheKey); each mesh has its own material
 * instance only to hold its uniform values. Nothing is allocated per frame.
 */

import * as THREE from 'three';

/* ------------------------------------------------------------------ the palette (sRGB hex) */
export const PLATE = 0xd5dbe3;          // the concrete the flesh grows over (scene.js)
export const PULSE_RED = 0xa8132c;      // THE arterial red. The only red that glows.
export const FLESH_COLOURS = {
    dark: 0x12070a,         // near black-red
    bruise: 0x2a1426,       // bruise purple
    gunmetal: 0x1d2328,     // wet gunmetal
    muscle: 0x4a2a36,       // sinew bellies, blood under the cold
    muscleDeep: 0x170b10,
    artery: 0x2c1219,       // a vessel's wall
    arteryCore: 0x5c1422,
    hyphae: 0xb9c4ca,       // mycelium: cold, pale
    bone: 0xb8bab4,         // ribbing, bone-pale (dimmed in the shader)
    ash: 0x3a3d40,          // necrotic
};

/** Seconds a plate takes to turn. */
export const FLESH_SECONDS = 2;
/** Seconds necrosis takes to grey an organ (and to come back). */
export const NECRO_SECONDS = 1.4;
/** How far, in world units, the body leans over a reachable plate's edge. */
export const HINT_REACH = 0.5;
/** The breath: radians a second, and how far a slab swells on its vertical axis (a share). */
export const BREATH_RATE = 0.9;
export const BREATH_SCALE = 0.035;
/** Seconds a heartbeat takes, and world units a second the pulse runs out from the heart. */
export const BEAT_PERIOD = 1.7;
export const PULSE_SPEED = 3.2;

/** Shared by every flesh material: one clock, one heart. */
export const fleshShared = {
    uTime: { value: 0 },
    uHeart: { value: new THREE.Vector3(0, 0, 0) },
};

/* ------------------------------------------------------------------ the shader */
const COMMON = /* glsl */`
uniform float uTime;
uniform vec3 uHeart;
uniform float uFront;
uniform float uFrontEnd;
uniform vec3 uOrigin;
uniform float uNecro;
uniform float uHint;
uniform float uPulse;
uniform vec3 uBase;
uniform float uMode;
uniform vec2 uUvScale;
uniform float uScale;
uniform float uSeed;
uniform float uBulge;
uniform float uThick;
uniform float uSinew;
uniform float uTint;
varying vec3 vFleshW;
varying vec3 vFleshN;
varying vec2 vFleshUv;
float fh(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
vec2 fg(vec2 p) { float a = fh(p) * 6.2831853; return vec2(cos(a), sin(a)); }
float gn(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
    return mix(mix(dot(fg(i), f), dot(fg(i + vec2(1.0, 0.0)), f - vec2(1.0, 0.0)), u.x),
               mix(dot(fg(i + vec2(0.0, 1.0)), f - vec2(0.0, 1.0)), dot(fg(i + vec2(1.0, 1.0)), f - vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) {
    float s = 0.0, a = 0.5;
    for (int i = 0; i < 4; i++) { s += a * gn(p); p = mat2(1.6, 1.2, -1.2, 1.6) * p + 7.3; a *= 0.5; }
    return s;
}
float fleshFront() { return max(uFront, uHint * ${HINT_REACH.toFixed(3)} * (0.82 + 0.18 * sin(uTime * 1.6))); }
`;

const VERT_HEAD = COMMON;
const VERT_BODY = /* glsl */`
#include <begin_vertex>
{
    vec4 fw0 = modelMatrix * vec4(transformed, 1.0);
    float fd = length(fw0.xyz - uOrigin) + gn(fw0.xz * 2.2 + uSeed) * 0.35;
    float fm = 1.0 - smoothstep(-0.18, 0.12, fd - fleshFront());
    // the top half of a slab swells where the flesh is; coincident vertices move alike, so no cracks
    float top = smoothstep(-uThick, uThick, transformed.y);
    float lump = 0.45 + 0.9 * (gn(fw0.xz * 1.15 + uSeed) + 0.5 * gn(fw0.xz * 3.1 - uSeed));
    transformed.y += uBulge * fm * top * max(0.0, lump);
    // and its sides swell out between top and bottom, away from the middle, so corners stay shut
    float mid = 1.0 - pow(clamp(abs(position.y) / max(uThick, 1e-3), 0.0, 1.0), 2.0);
    vec2 outw = position.xz / max(length(position.xz), 1e-3);
    transformed.xz += outw * uBulge * 1.4 * fm * mid * max(0.0, lump);
    vFleshW = (modelMatrix * vec4(transformed, 1.0)).xyz;
    vFleshN = normalize(mat3(modelMatrix) * objectNormal);
    vFleshUv = uv;
}
`;

const FRAG_HEAD = COMMON + /* glsl */`
vec3 fleshL(float r, float g, float b) { return pow(vec3(r, g, b) / 255.0, vec3(2.2)); }
// a rounded ridge on the zero line of v: 1 on the line, 0 at w, softened by the pixel's size
float ridge(float v, float w) { float x = abs(v) / (w + fwidth(v) * 0.9 + 1e-4); return clamp(1.0 - x * x, 0.0, 1.0); }
// how much of a fine pattern survives at this distance (fades instead of shimmering)
float fine(float v, float k) { return clamp(1.0 - fwidth(v) * k, 0.0, 1.0); }
float beat(float t) {
    float ph = fract(t / ${BEAT_PERIOD.toFixed(3)});
    return exp(-ph * 13.0) + 0.6 * exp(-max(ph - 0.19, 0.0) * 15.0) * step(0.19, ph);
}
vec3 fleshPerturb(vec3 surf_pos, vec3 surf_norm, vec2 dHdxy, float faceDir) {
    vec3 sx = dFdx(surf_pos), sy = dFdy(surf_pos);
    vec3 r1 = cross(sy, surf_norm), r2 = cross(surf_norm, sx);
    float det = dot(sx, r1) * faceDir;
    vec3 g = sign(det) * (dHdxy.x * r1 + dHdxy.y * r2);
    return normalize(abs(det) * surf_norm - g);
}
`;

const FRAG_FIELDS = /* glsl */`
#include <map_fragment>
vec3 fleshCol = uBase;
float fleshH = 0.0;
float fleshRough = 0.92;
float fleshMetal = 0.0;
float fleshWet = 0.0;
vec3 fleshEmit = vec3(0.0);
{
    vec3 an = abs(normalize(vFleshN));
    float side = 1.0 - smoothstep(0.55, 0.8, an.y);
    vec2 P = an.y >= max(an.x, an.z) ? vFleshW.xz : (an.x > an.z ? vFleshW.zy : vFleshW.xy);
    if (uMode > 0.5) { P = vFleshUv * uUvScale; side = 0.0; }
    P = P * uScale + vec2(uSeed * 1.37, -uSeed * 0.71);
    float d = length(vFleshW - uOrigin);
    float frontNoise = fbm(P * 1.6 + 3.1);
    float fd = d + frontNoise * 0.7;
    float front = fleshFront();
    float fm = 1.0 - smoothstep(-0.05, 0.05, fd - front);          // flesh here
    float ahead = 1.0 - smoothstep(0.0, 0.42, fd - front);         // vessels creep ahead of it
    float necro = uNecro;
    if (fd - front < 0.7) {
        // the ground the veins grow in, warped so nothing is ruled or mirrored
        vec2 w = vec2(fbm(P * 0.7 + 1.7), fbm(P * 0.7 + 9.2));
        vec2 Q = P + w * 1.8;
        float patchA = fbm(P * 0.5 + 21.0);
        float patchB = fbm(P * 1.2 - 4.0);
        // the big soft forms the light rolls over
        float lumps = fbm(P * 1.05 + w * 0.8);
        // arteries: the zero line of a slow field, thick where a second field says so; a vein is a
        // rounded wall with a core
        float a1 = gn(Q * 0.95);
        float trunk = smoothstep(-0.16, 0.32, patchA);
        float wA = 0.003 + 0.034 * trunk * trunk;
        float art = ridge(a1, wA) * smoothstep(0.0, 0.3, trunk);        // trunks taper out: no closed loops
        float core = ridge(a1, wA * 0.3) * smoothstep(0.35, 0.8, trunk);
        // branches: only near a trunk, thinner the farther out
        float near = (1.0 - smoothstep(0.015, 0.2, abs(a1))) * smoothstep(0.1, 0.5, trunk);
        float a2 = gn(Q * 2.6 + 5.0);
        float art2 = ridge(a2, 0.003 + 0.007 * near) * near;
        float a3 = gn(Q * 6.0 + w * 3.0);
        float cap = ridge(a3, 0.005) * smoothstep(0.05, 0.3, patchB) * fine(a3, 10.0);
        // mycelium: fine pale threads, stretched one way and another, in patches
        vec2 R1 = vec2(Q.x * 13.0 + w.y * 5.0, Q.y * 4.5);
        vec2 R2 = mat2(0.6, -0.8, 0.8, 0.6) * Q * vec2(17.0, 5.0) + w * 5.0;
        float h1 = gn(R1), h2 = gn(R2);
        float myc = max(ridge(h1, 0.006) * fine(h1, 5.0), 0.75 * ridge(h2, 0.005) * fine(h2, 5.0));
        myc *= smoothstep(0.05, 0.32, fbm(P * 1.3 + 40.0)) * (1.0 - 0.75 * side);
        // sinew: long striated bellies laid along one axis
        float belly = max(uSinew, smoothstep(0.0, 0.22, fbm(vec2(P.x * 0.42, P.y * 1.9) + 11.0)));
        float striV = Q.y * 46.0 + gn(Q * vec2(1.2, 5.0)) * 6.0;
        float stri = (0.5 + 0.5 * sin(striV)) * fine(striV, 0.9);
        // ribbing: bone-pale ridges across the fibre, mostly on the slab's sides
        float ribW = sin(P.x * 19.0 + w.x * 1.3 + gn(P * vec2(0.8, 3.0)) * 1.5);
        float rib = smoothstep(0.6, 0.97, ribW) * max(side, smoothstep(0.3, 0.5, patchB) * 0.5) * fine(Q.x * 2.7, 1.5);
        // the colour, layer on layer
        float m1 = smoothstep(-0.3, 0.3, fbm(P * 1.9 + 2.0));
        float m2 = smoothstep(0.0, 0.35, fbm(P * 0.8 - 13.0));
        vec3 c = mix(fleshL(14.0, 6.0, 9.0), fleshL(40.0, 19.0, 37.0), m1 * 0.85);   // near black-red, bruise purple
        c = mix(c, fleshL(27.0, 33.0, 38.0), m2 * 0.75);                               // wet gunmetal
        c = mix(c, mix(fleshL(20.0, 9.0, 14.0), fleshL(70.0, 40.0, 52.0), stri), belly * 0.8);
        c = mix(c, fleshL(150.0, 152.0, 146.0) * (0.35 + 0.3 * smoothstep(0.8, 1.0, ribW)), rib * 0.6);
        c = mix(c, fleshL(40.0, 15.0, 22.0), max(art2 * 0.9, cap * 0.5));
        c = mix(c, fleshL(38.0, 13.0, 20.0), art);
        c = mix(c, fleshL(84.0, 16.0, 30.0), core * 0.8);
        c = mix(c, fleshL(185.0, 196.0, 202.0) * 0.45, myc * 0.38);
        // necrosis: ash, dry, the threads go to mould
        float lum = dot(c, vec3(0.3, 0.55, 0.15));
        vec3 ash = fleshL(58.0, 61.0, 64.0) * (0.5 + 2.4 * lum) + fleshL(16.0, 17.0, 18.0) * art;
        ash = mix(ash, fleshL(150.0, 155.0, 158.0) * 0.6, myc * 0.7);
        c *= uTint;
        c = mix(c, ash, necro);
        float h = 5.0 * lumps + 0.9 * art + 0.5 * art2 + 0.2 * cap + 0.05 * myc + 0.5 * rib + 0.35 * belly * stri;
        h = mix(h, 0.6 * h + 0.6 * fbm(P * 4.0), necro);            // dry: cracked, less round
        // the wet rolling lip at the front
        float lip = exp(-abs(fd - front) * 9.0) * step(front, uFrontEnd - 0.05) * step(0.001, front);
        h += lip * 1.6;
        // what the flesh is: wet, a little metal in the gunmetal, the vessels shiniest
        float rough = mix(0.36, 0.2, max(art, art2)) - 0.08 * m2 + 0.08 * belly;
        rough = mix(rough, 0.86, necro);
        float metal = mix(0.04, 0.3, m2) * (1.0 - necro) * (1.0 - uSinew);
        // the pulse: a double beat running out from the heart along the vessels' cores
        float hd = length(vFleshW - uHeart);
        float b = beat(uTime - hd / ${PULSE_SPEED.toFixed(3)});
        vec3 red = fleshL(168.0, 19.0, 44.0);
        vec3 emit = red * (core + 0.15 * art2) * (0.012 + 0.8 * b) * uPulse;
        emit += red * lip * 0.12;
        emit *= (1.0 - necro);
        // the vessels that run ahead of the front, dark on the concrete
        float creep = ahead * (1.0 - fm) * max(art, max(art2, cap));
        creep = clamp(creep * 1.4, 0.0, 1.0);
        vec3 concrete = mix(uBase, fleshL(44.0, 18.0, 25.0), creep * 0.85);
        concrete = mix(concrete, concrete * 0.82, ahead * (1.0 - fm) * 0.5);    // a damp stain
        fleshCol = mix(concrete, c, fm);
        fleshH = mix(0.4 * creep, h, fm);
        fleshRough = mix(0.92, rough, fm);
        fleshMetal = metal * fm;
        fleshWet = fm * (1.0 - 0.85 * necro) * (0.7 + 0.3 * max(art, m2));
        fleshEmit = emit * fm + red * creep * 0.08 * (1.0 - necro);
    }
    // a reachable plate: a faint warmth near the edge the body leans over
    // (on the damp ground where the vessels creep, not on the clean concrete: no pink plates)
    float damp = 1.0 - smoothstep(0.0, 0.6, length(vFleshW - uOrigin) - fleshFront());
    fleshEmit += fleshL(168.0, 19.0, 44.0) * uHint * (1.0 - fm) * damp * (exp(-d * 1.0) * (0.22 + 0.1 * sin(uTime * 1.6)) + exp(-d * 4.0) * (0.5 + 0.25 * sin(uTime * 1.6)));
}
diffuseColor.rgb = fleshCol;
`;

function patchShader(shader, u) {
    Object.assign(shader.uniforms, fleshShared, u);
    shader.vertexShader = VERT_HEAD + shader.vertexShader.replace('#include <begin_vertex>', VERT_BODY);
    shader.fragmentShader = FRAG_HEAD + shader.fragmentShader
        .replace('#include <map_fragment>', FRAG_FIELDS)
        .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = fleshRough;')
        .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nmetalnessFactor = fleshMetal;')
        .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\nnormal = fleshPerturb(-vViewPosition, normal, vec2(dFdx(fleshH), dFdy(fleshH)) * 0.022, faceDirection);')
        .replace('#include <clearcoat_normal_fragment_begin>', '#include <clearcoat_normal_fragment_begin>\n#ifdef USE_CLEARCOAT\nclearcoatNormal = normalize(mix(clearcoatNormal, normal, 0.75));\n#endif')
        .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += fleshEmit;')
        .replace('#include <lights_physical_fragment>', '#include <lights_physical_fragment>\n#ifdef USE_CLEARCOAT\nmaterial.clearcoat *= fleshWet;\n#endif');
}

/**
 * A flesh material. Every one shares one shader program; this instance holds one mesh's state.
 * @param {object} [opts]
 * @param {number} [opts.base=PLATE] - the concrete it grows over (hex)
 * @param {number} [opts.front=99] - how far it has spread (world units); 99 = all flesh
 * @param {THREE.Vector3} [opts.origin] - where it spreads from (world)
 * @param {'world'|'uv'} [opts.mode='world'] - world: any flat surface; uv: tubes, hands
 * @param {number[]} [opts.uvScale=[1,1]] - in uv mode, how many pattern units the uv square spans
 * @param {number} [opts.scale=1] - pattern scale (bigger = finer)
 * @param {number} [opts.bulge=0] - how far a slab's top swells where it is flesh (world units)
 * @param {number} [opts.thick=0.13] - half a slab's thickness: only its top half swells
 * @param {number} [opts.seed] - so neighbouring organs are not alike
 * @param {number} [opts.pulse=1] - the pulse's strength
 * @param {number} [opts.sinew=0] - 0 to 1: how much of it is striated muscle (tendrils, arms)
 * @param {number} [opts.tint=1] - lifts the tissue's own colour (the hands, small against the dark)
 * @param {THREE.Texture} [opts.envMap] - reflections for the wet sheen (see makeWetEnvironment)
 * @returns {THREE.MeshPhysicalMaterial} with `userData.flesh` = its uniforms
 */
export function makeFleshMaterial(opts = {}) {
    const u = {
        uFront: { value: Number.isFinite(opts.front) ? opts.front : 99 },
        uFrontEnd: { value: 99 },
        uOrigin: { value: (opts.origin || new THREE.Vector3()).clone() },
        uNecro: { value: 0 },
        uHint: { value: 0 },
        uPulse: { value: Number.isFinite(opts.pulse) ? opts.pulse : 1 },
        uBase: { value: new THREE.Color(opts.base ?? PLATE) },
        uMode: { value: opts.mode === 'uv' ? 1 : 0 },
        uUvScale: { value: new THREE.Vector2(...(opts.uvScale || [1, 1])) },
        uScale: { value: opts.scale ?? 1 },
        uSeed: { value: opts.seed ?? Math.random() * 50 },
        uBulge: { value: opts.bulge ?? 0 },
        uThick: { value: opts.thick ?? 0.13 },
        uSinew: { value: opts.sinew ?? 0 },
        uTint: { value: opts.tint ?? 1 },
    };
    const mat = new THREE.MeshPhysicalMaterial({
        color: 0xffffff, roughness: 0.5, metalness: 0,
        clearcoat: 1, clearcoatRoughness: 0.2,
        sheen: 1, sheenRoughness: 0.45, sheenColor: new THREE.Color(0x2a0710),
        envMap: opts.envMap || null, envMapIntensity: opts.envMapIntensity ?? 1,
    });
    mat.userData.flesh = u;
    mat.onBeforeCompile = (shader) => patchShader(shader, u);
    mat.customProgramCacheKey = () => 'deep-flesh-1';
    return mat;
}

/* ------------------------------------------------------------------ the living registry */
let envDefault = null;
const live = [];            // one record per flesh mesh
const tendrils = [];        // growing tubes
let clock = 0;

function recOf(mesh) { return live.find((r) => r.mesh === mesh) || null; }
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/** Sets the envMap new flesh materials get by default (call once with makeWetEnvironment's result). */
export function setFleshEnvironment(tex) { envDefault = tex; }

/** The farthest any part of `mesh` is from `origin` (world), plus the noisy edge. */
function reachOf(mesh, origin) {
    const box = new THREE.Box3().setFromObject(mesh);
    let far = 0;
    const q = new THREE.Vector3();
    for (let i = 0; i < 8; i++) {
        q.set(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z);
        far = Math.max(far, q.distanceTo(origin));
    }
    return far + 0.9;
}

function ensure(mesh, opts = {}) {
    let r = recOf(mesh);
    if (r) return r;
    const prev = mesh.material;
    const base = prev && prev.color ? prev.color.getHex() : PLATE;
    const mat = makeFleshMaterial({
        base, front: 0, origin: opts.from, bulge: opts.bulge ?? 0, thick: opts.thick,
        seed: opts.seed, scale: opts.scale, envMap: opts.envMap || envDefault, envMapIntensity: opts.envMapIntensity, pulse: opts.pulse,
        mode: opts.mode, uvScale: opts.uvScale, sinew: opts.sinew, tint: opts.tint,
    });
    mesh.material = mat;
    r = {
        mesh, mat, u: mat.userData.flesh, prev,
        front: null, necro: null, hint: 0, hintTo: 0,
        breathe: opts.breathe !== false, phase: 0, baseY: mesh.scale.y,
        swallow: [], flesh: false,
    };
    live.push(r);
    return r;
}

/**
 * The flesh takes `mesh` over `duration` seconds: a front spreads from `from` (world, the edge that
 * touches the body) across it. Things on the slab (`swallow`: lanes, houses) sink into it as the
 * front passes them.
 * @param {THREE.Mesh} mesh
 * @param {object} [opts] - { duration, from: Vector3, swallow: Object3D[], bulge, breathe, seed, onDone,
 *        mode, uvScale (for parts that move: 'uv', so the tissue does not swim) }
 */
export function fleshify(mesh, opts = {}) {
    const from = opts.from ? opts.from.clone() : mesh.getWorldPosition(new THREE.Vector3());
    const r = ensure(mesh, { ...opts, from });
    r.u.uOrigin.value.copy(from);
    const end = reachOf(mesh, from);
    r.u.uFrontEnd.value = end;
    r.front = { t: 0, dur: Math.max(0.01, opts.duration ?? FLESH_SECONDS), from: r.u.uFront.value, to: end, onDone: opts.onDone || null };
    r.flesh = true;
    r.phase = from.length() * 0.9;
    r.breathe = opts.breathe !== false;
    const at = new THREE.Vector3();
    for (const o of opts.swallow || []) {
        o.getWorldPosition(at);
        r.swallow.push({ obj: o, d: at.distanceTo(from), y0: o.position.y, k: 0 });
    }
    return r.mat;
}

/** Back to concrete at once: the material it had, its scale, the things it swallowed. */
export function unflesh(mesh) {
    const i = live.findIndex((r) => r.mesh === mesh);
    if (i < 0) return;
    const r = live[i];
    mesh.material = r.prev;
    mesh.scale.y = r.baseY;
    for (const s of r.swallow) { s.obj.position.y = s.y0; s.obj.visible = true; }
    r.mat.dispose();
    live.splice(i, 1);
}

/** Necrosis on (greys, stills, dries) or off (it comes back), over NECRO_SECONDS. */
export function setNecrotic(mesh, on, opts = {}) {
    const r = recOf(mesh);
    if (!r) return;
    r.necro = { t: 0, dur: opts.duration ?? NECRO_SECONDS, from: r.u.uNecro.value, to: on ? 1 : 0 };
}

/**
 * A plate the body can take: the flesh leans over its edge at `from` and it glows faintly.
 * `level` 1 is the plate under the cursor; 0 takes the hint away.
 */
export function setReachable(mesh, level, opts = {}) {
    const lv = Math.max(0, Math.min(1.6, Number(level) || 0));
    let r = recOf(mesh);
    if (!r) {
        if (!lv) return;
        r = ensure(mesh, { ...opts, from: opts.from || mesh.getWorldPosition(new THREE.Vector3()) });
    }
    if (opts.from && !r.flesh) r.u.uOrigin.value.copy(opts.from);
    r.hintTo = r.flesh ? 0 : lv;
}

/** Is this mesh flesh (or turning)? */
export function isFlesh(mesh) { const r = recOf(mesh); return !!(r && r.flesh); }

/**
 * Sinew and vessels reaching across a bridge from one organ to the next: a few tubes along jittered
 * curves, in the flesh, growing out over `duration` seconds. Returns their group, already added to
 * `opts.parent` (or the from-mesh's parent).
 */
export function growTendrils(fromMesh, toMesh, opts = {}) {
    const a = fromMesh.getWorldPosition(new THREE.Vector3());
    const b = toMesh.getWorldPosition(new THREE.Vector3());
    const ta = new THREE.Box3().setFromObject(fromMesh).max.y;
    const tb = new THREE.Box3().setFromObject(toMesh).max.y;
    const dir = b.clone().sub(a).setY(0);
    const len = dir.length() || 1;
    dir.divideScalar(len);
    const perp = new THREE.Vector3(-dir.z, 0, dir.x);
    const parent = opts.parent || fromMesh.parent;
    const group = new THREE.Group();
    group.name = 'tendrils';
    parent.add(group);
    const seed = opts.seed ?? Math.floor(Math.random() * 1e6);
    let s = seed >>> 0;
    const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
    const n = opts.count ?? 4;
    const reachA = opts.reachFrom ?? 0.55, reachB = opts.reachTo ?? 0.62;
    for (let i = 0; i < n; i++) {
        const thick = i === 0 ? 0.1 : 0.035 + rnd() * 0.04;
        const off = (rnd() - 0.5) * (opts.spread ?? 0.75);
        const p0 = a.clone().addScaledVector(dir, len * 0.5 - reachA - rnd() * 0.25).addScaledVector(perp, off * 0.8).setY(ta - thick * 0.3);
        const p3 = b.clone().addScaledVector(dir, -len * 0.5 + reachB + rnd() * 0.3).addScaledVector(perp, off + (rnd() - 0.5) * 0.3).setY(tb - thick * 0.3);
        const mid = p0.clone().lerp(p3, 0.5);
        const lift = 0.05 + rnd() * 0.12 + thick;
        const p1 = p0.clone().lerp(p3, 0.3 + rnd() * 0.1).addScaledVector(perp, (rnd() - 0.5) * 0.3);
        p1.y = Math.max(ta, tb) + lift * (0.6 + rnd() * 0.5);
        const p2 = mid.clone().lerp(p3, 0.4 + rnd() * 0.2).addScaledVector(perp, (rnd() - 0.5) * 0.3);
        p2.y = Math.max(ta, tb) + lift * (0.4 + rnd() * 0.5);
        const pts = [p0, p1, p2, p3].map((p) => group.worldToLocal(p.clone()));
        const curve = new THREE.CatmullRomCurve3(pts);
        const segs = 40, radial = 10;
        const geo = new THREE.TubeGeometry(curve, segs, thick, radial, false);
        // taper: thick at the root, thin where it holds on; and lumpy
        const pos = geo.attributes.position;
        const c = new THREE.Vector3(), v = new THREE.Vector3();
        for (let j = 0; j <= segs; j++) {
            curve.getPointAt(j / segs, c);
            const t = j / segs;
            const k = (1 - 0.6 * t) * (0.85 + 0.3 * Math.sin(t * 17 + i * 3)) * (t > 0.92 ? 1 + (t - 0.92) * 9 : 1);
            for (let q = 0; q <= radial; q++) {
                const idx = j * (radial + 1) + q;
                v.fromBufferAttribute(pos, idx).sub(c).multiplyScalar(k).add(c);
                pos.setXYZ(idx, v.x, v.y, v.z);
            }
        }
        geo.computeVertexNormals();
        const mat = makeFleshMaterial({ mode: 'uv', uvScale: [len * 2.2, 0.7], seed: seed % 97 + i * 11, envMap: opts.envMap || envDefault, envMapIntensity: 0.55, pulse: i === 0 ? 1.4 : 0.8, sinew: i === 0 ? 0.4 : 0.9 });
        const m = new THREE.Mesh(geo, mat);
        m.userData.tendril = true;
        geo.setDrawRange(0, 0);
        group.add(m);
        tendrils.push({ mesh: m, t: -i * 0.15, dur: opts.duration ?? 1.6, total: geo.index.count, ring: radial * 6, segs });
    }
    return group;
}

/** Greys (or revives) a group of tendrils with their organ. */
export function setTendrilsNecrotic(group, on) {
    group.traverse((o) => {
        if (!o.isMesh || !o.material?.userData?.flesh) return;
        o.material.userData.flesh.uNecro.value = on ? 1 : 0;
    });
}

/** One frame: the clock, the fronts, necrosis, the hint, the breath, the tendrils. */
export function stepFlesh(dt) {
    clock += dt;
    fleshShared.uTime.value = clock;
    for (let i = 0; i < live.length; i++) {
        const r = live[i];
        if (r.front) {
            r.front.t += dt;
            const k = Math.min(1, r.front.t / r.front.dur);
            const f = r.front.from + (r.front.to - r.front.from) * ease(k);
            r.u.uFront.value = f;
            for (let j = 0; j < r.swallow.length; j++) {
                const s = r.swallow[j];
                if (s.k >= 1 || s.d > f - 0.25) continue;
                s.k = Math.min(1, s.k + dt * 2.2);
                s.obj.position.y = s.y0 - 0.16 * s.k;
                if (s.k >= 1) s.obj.visible = false;
            }
            if (k >= 1) {
                const done = r.front.onDone;
                r.front = null;
                for (let j = 0; j < r.swallow.length; j++) { r.swallow[j].obj.visible = false; r.swallow[j].k = 1; }
                if (done) done(r.mesh);
            }
        }
        if (r.necro) {
            r.necro.t += dt;
            const k = Math.min(1, r.necro.t / r.necro.dur);
            r.u.uNecro.value = r.necro.from + (r.necro.to - r.necro.from) * ease(k);
            if (k >= 1) r.necro = null;
        }
        if (r.hint !== r.hintTo) {
            const step = dt * 2.5;
            r.hint += Math.max(-step, Math.min(step, r.hintTo - r.hint));
            r.u.uHint.value = r.hint;
        }
        if (r.flesh && r.breathe) {
            const alive = 1 - r.u.uNecro.value;
            const grown = Math.min(1, r.u.uFront.value / Math.max(0.01, r.u.uFrontEnd.value));
            r.mesh.scale.y = r.baseY * (1 + BREATH_SCALE * alive * grown * Math.sin(clock * BREATH_RATE - r.phase));
        }
    }
    for (let i = 0; i < tendrils.length; i++) {
        const t = tendrils[i];
        if (t.t >= t.dur) continue;
        t.t += dt;
        const k = Math.max(0, Math.min(1, t.t / t.dur));
        const rings = Math.ceil(ease(k) * t.segs);
        t.mesh.geometry.setDrawRange(0, Math.min(t.total, rings * t.ring));
    }
}

/**
 * Reflections for the wet sheen: a dark room with a cold strip light overhead and a cold wash to one
 * side, prefiltered once. Hand the result to setFleshEnvironment (or to makeFleshMaterial's envMap).
 */
export function makeWetEnvironment(renderer) {
    const env = new THREE.Scene();
    env.background = new THREE.Color(0x050607);
    const strip = (w, h, col, x, y, z, ry = 0, rx = 0) => {
        const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: col, side: THREE.DoubleSide }));
        m.position.set(x, y, z);
        m.rotation.set(rx, ry, 0);
        env.add(m);
    };
    strip(9, 1.1, 0xe8eef4, 0, 6, -1, 0, Math.PI / 2);       // the lamp over the shaft
    strip(2.2, 6, 0x6d7e92, -7, 2, 2, Math.PI / 2);           // a cold wash from the side
    strip(3, 0.5, 0x9fb0c2, 5, 3.5, 4, -0.8);                 // a glint
    strip(6, 0.6, 0x2a0a10, 0, -3, 5, 0, -0.4);               // the body's own glow, low
    const pmrem = new THREE.PMREMGenerator(renderer);
    const tex = pmrem.fromScene(env, 0.035).texture;
    pmrem.dispose();
    env.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });
    return tex;
}

/** What the flesh is doing, for tests and the prototype's readout. */
export function fleshStats() {
    return {
        meshes: live.length,
        flesh: live.filter((r) => r.flesh).length,
        turning: live.filter((r) => r.front).length,
        necrotic: live.filter((r) => r.u.uNecro.value > 0.5).length,
        hinted: live.filter((r) => r.hint > 0.01).length,
        tendrils: tendrils.length,
    };
}

/** Lets go of everything (a new scene). The meshes keep whatever material they have now. */
export function disposeFlesh() {
    for (const r of live) r.mat.dispose();
    live.length = 0;
    for (const t of tendrils) { t.mesh.geometry.dispose(); t.mesh.material.dispose(); }
    tendrils.length = 0;
}
