/**
 * Chapter IV · THE DEEP: THE STRATA VIEW (direction B, chosen by Ola 2026-10-03). A vertical cross
 * section through the earth that replaces the 3D colony for the whole chapter: TEND, SLEEP and GROW.
 * The visual reference is docs/mockups/deep-views-13.html, tab B, with two things taken in from the
 * other directions: from A, the hallucinations are SCREEN GHOSTS (an afterimage, a wrong frame); from
 * C, THE LIGHT: the floor the camera is on is lit and everything deeper falls into black.
 *
 * What it draws, top to bottom: the sky over the dead surface (rain); the years the colony slept,
 * one sediment layer per sleep, as thick as the log of its years, each boundary's year on the ruler
 * at the right; YEAR 0, the crust they came down through, sealed by the lid; the old ground; the
 * machine house with the real machine (machine-model.js) seen from the side; the floors, a row of
 * flat chambers each, on a corridor, the shaft through their middle; tiny people walking the
 * corridors and the shaft. In GROW: the flesh (flesh.js, its cross-section projection) filling the
 * chambers, roots and vessels pushing up through every layer, the shaft a spine, the hands
 * (hands.js) rising out of the machine house, and the RISE through all the years to the surface.
 *
 * Positions come from strata.js (pure, tested). The view knows nothing about rules or time: it is
 * handed a state and a layout, and the orchestrator calls step(dt) every frame.
 *
 * ---------------------------------------------------------------------------------------------
 * THE SURFACE (the same as scene.js createScene, so the orchestrator can swap one for the other):
 *   setState(state, layout)    draw this colony (rebuilds only when its shape changed). The view
 *                              keeps the state by reference and reads watcher.sleptYears/sleeps
 *                              every frame, so the top layer thickens while the colony sleeps.
 *   step(dt)  resize()  dispose()  resetView()
 *   setMachine(tempo, asleep)  setSoftness(k)  snap()  lighten()
 *   gather(s)  release(s)  ascend(s)  climbAlone(s)          Promises, a wall clock behind each
 *   hitsBase(x, y)  slotAt(x, y)  machineAt(x, y)  screenOfSlot(slot)  screenOfMachine()
 *   visibleSlots(slots)  setLamps(spec)  emptySlots()
 *   setCandidates()  sealAnim()  scoutsUp()  scoutsDown()   the cut sector/scout calls: no-ops
 * THE VIEW HOOKS (view-hooks.js's contract, extended; `extendHooks` below wraps createViewHooks):
 *   emptyAt(x, y)              the empty chamber under a client point, or -1
 *   showEmpty(slots|null)      which empty chambers carry the "+" (null: every unclaimed one)
 *   screenOfSlot(slot)         where the room ring opens (client px of the chamber's middle)
 *   hallucinate(kind, on)      'lamp' a lamp in an empty chamber (or a room that was never dug, up
 *                              in the young rock), 'figure' the tall thin figure on the surface line
 *                              (or on the highest year line in view), 'breathe' a chamber's walls
 *                              breathe, 'afterimage' the frame before drifting over this one,
 *                              'wrong' now and then a frame that is wrong for a moment
 *   flickerHallucinations(on)  snapClear() -> Promise     the snap: a flicker, and every false thing goes
 *   hallucinating              what shows now
 * GROW (new):
 *   setBody(bodyIds, necroticIds, reachableIds)   growth.js ids: 's<slot>', 'h<floor>', 'machine'.
 *                              Build the body's graph with strata.js sectionPlace so it is the row
 *                              the player sees: graphFromSlots(layout.slots, sectionPlace).
 *   onChamberClick(cb)         cb(id, {slot, x, y}) on a click (not a drag) on a chamber, a landing
 *                              in the shaft ('h<f>') or the machine house; returns an unsubscribe
 *   setHands(on)               three sinew arms rise out of the machine house, ending in hands
 *   rise(onDone) -> Promise    the body pushes up through every layer to the surface line
 * deep-swap (the default view since then; index.js makes it unless ?view=3d or the ☰ menu says 3D):
 *   chamberPlace               exported: where chamber i sits here (strata.js sectionPlace); index.js
 *                              hands it to grow.js setChamberPlace, so the body's graph is this row
 *   setDigOffer(o) digPlusAt() the "+" where the next chamber is dug (in opts.labelHost), opts.onDig
 *   setGrowMode(on)  chamberAt(x, y)  screenOfNode(id)  buildingSlots()
 *   focusFloor(f)  focusMachine(s)   the camera follows the front; on the hands it looks closer for s
 *                              seconds (FOCUS_PPU), panning sideways, the colony fading at the sides
 *   onChamberHover(cb)  setThrows(n)  bodyStats  centre()   (the counter stands at centre())
 *   setHands(false) takes the arms back; setHands(true, {instant}) for a reload
 *   setCandidates(sectors, hover)    an older save's sector choice glows; sealAnim() a flash
 *   state.strata (years per sleep, kept in the save by index.js) wins over the view's own count
 * ---------------------------------------------------------------------------------------------
 *
 * Nothing is allocated per frame. The chambers are one instanced draw from a canvas atlas drawn at
 * start; the strata, the old ground, the bedrock and the sky are one shader on one quad; the light
 * is one quad over the colony.
 */

import * as THREE from 'three';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { createMachine } from './machine-model.js';
import { createHands, OVERGROW_SECONDS } from './hands.js';
import {
    makeFleshMaterial, fleshify, setNecrotic, stepFlesh, makeWetEnvironment, setFleshEnvironment, disposeFlesh,
} from './flesh.js';
import { emptyChambers, sectorOf } from './layout.js';
import { slotOf, MACHINE } from './growth.js';
import { makeOrganArt } from './organ-art.js';
import { digCost } from './deep.js';
import * as S from './strata.js';

/**
 * deep-swap: where chamber number i sits in THIS view, for the body's graph (grow.js
 * setChamberPlace): a row outward from the shaft, -1, +1, -2, +2, ... So a chamber that glows as
 * reachable always lies beside the body on the screen.
 */
export const chamberPlace = S.sectionPlace;

/* ------------------------------------------------------------------ the palette (scene.js, mockup B) */
const ROCK = 0x0a0d12;
const PLATE = '#d5dbe3';
const INK = '#8fa1b6';
const HYC = 0xb9c4ca;              // mycelium threads
const MAX_DOTS = 160;              // people drawn (scene.js MAX_DOTS)
const MAX_TILES = 160;
const MAX_ROOTS = 18;
const MAX_HYPHAE = 9000;           // line segments
const MAX_DEBRIS = 220;
const PERSON_H = 0.26;
const LIGHT_SECONDS = 1.2;         // the colony goes dark (or lit) over this when they sleep (wake)
const CLICK_PX = 6;
/** deep-pass4 (B417): the ruler's YEAR labels: at least this far apart on the screen, at most this many. */
const LABEL_GAP_PX = 30;
const LABELS_SHOWN = 3;

/* the atlas: every chamber look, drawn once at start (2 px per mockup px) */
const TILE_W = 200, TILE_H = 160;          // a chamber tile, in atlas px
const CH_PX = 184;                         // the chamber's width in atlas px = S.CH_W units
const U = S.CH_W / CH_PX;                  // units per atlas px
const ATLAS_W = 2048, ATLAS_H = 576;
const TYPE_IX = { empty: 0, mine: 1, farm: 2, generator: 3, dorm: 4, cryo: 5 };
const HOUSE_TILE = { x: 0, y: 320, w: 520, h: 200 };
const HOUSE_DARK_X = 520;
const VAT_TILE = { x: 1040, y: 320 };
const GHOST_TILE = { x: 1240, y: 320 };
/* where the floor line sits in a tile, from its bottom, in units */
const TILE_FLOOR = 12 * U;
const HOUSE_FLOOR = 16 * U;

/* ------------------------------------------------------------------ small things */
function mulberry32(a) {
    return function () {
        a |= 0; a = a + 0x6D2B79F5 | 0;
        let t = Math.imul(a ^ a >>> 15, 1 | a);
        t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
}
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const clamp01 = (v) => Math.max(0, Math.min(1, v));

const GLSL_NOISE = /* glsl */`
float sh(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
vec2 sg(vec2 p) { float a = sh(p) * 6.2831853; return vec2(cos(a), sin(a)); }
float sn(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(dot(sg(i), f), dot(sg(i + vec2(1.0, 0.0)), f - vec2(1.0, 0.0)), u.x),
               mix(dot(sg(i + vec2(0.0, 1.0)), f - vec2(0.0, 1.0)), dot(sg(i + vec2(1.0, 1.0)), f - vec2(1.0, 1.0)), u.x), u.y);
}
float sline(float d, float w) { float fw = fwidth(d); return 1.0 - smoothstep(w, w + fw * 1.4, abs(d)); }
vec3 sL(vec3 c) { return pow(c, vec3(2.2)); }
`;

/* ------------------------------------------------------------------ the strata shader */
const BACK_VERT = /* glsl */`
varying vec2 vW;
void main() {
    vec4 w = modelMatrix * vec4(position, 1.0);
    vW = w.xy;
    gl_Position = projectionMatrix * viewMatrix * w;
}`;
const BACK_FRAG = /* glsl */`
uniform float uB[${S.MAX_LAYERS}];
uniform int uN;
uniform float uTime;
uniform float uDawn;
uniform float uRiseY;
uniform float uRise;
uniform float uQuake;
uniform float uSleep;
uniform float uPx;
uniform vec3 uTone[8];
varying vec2 vW;
${GLSL_NOISE}
float wv(float x, float s) { return 0.13 * (0.55 * sin(x * 0.33 + s * 1.7) + 0.31 * sin(x * 1.06 + s * 3.1) + 0.14 * sin(x * 3.2 + s * 5.3)); }
// the grain is drawn in screen pixels (uPx = units a pixel), so it stays grain at any scale
float dotsP(vec2 p, float cellPx, float rPx, float seed) {
    float cell = cellPx * uPx, r = rPx * uPx;
    vec2 c = floor(p / cell);
    vec2 f = p - (c + 0.5) * cell;
    vec2 o = (vec2(sh(c + seed), sh(c + seed + 17.0)) - 0.5) * cell * 0.55;
    return 1.0 - smoothstep(r, r + uPx * 0.9, length(f - o));
}
float hlines(float y, float spPx) { float sp = spPx * uPx; float d = abs(fract(y / sp + 0.5) - 0.5) * sp; return 1.0 - smoothstep(0.35 * uPx, 1.0 * uPx, d); }
void main() {
    vec2 p = vW;
    if (uRise > 0.0) {
        // the layers over the rising body bow up before it breaks them
        float above = p.y - uRiseY;
        p.y -= uRise * 0.85 * exp(-p.x * p.x / 8.0) * exp(-max(above, 0.0) * 0.5) * step(0.0, above);
    }
    vec3 pale = sL(vec3(0.835, 0.859, 0.89));
    float surf = uN > 0 ? uB[uN - 1] : 0.0;
    float ysurf = surf + wv(p.x, float(uN) + 1.0);
    float y0w = wv(p.x, 0.0);
    vec3 col;
    if (p.y > ysurf) {
        // the sky over the dead surface: dark, rain
        float t = clamp((p.y - ysurf) / 7.0, 0.0, 1.0);
        col = mix(sL(vec3(0.082, 0.106, 0.137)), sL(vec3(0.012, 0.016, 0.024)), t);
        float cl = smoothstep(0.1, 0.6, sn(vec2(p.x * 0.05, p.y * 0.3) + 3.0) + 0.5 * sn(vec2(p.x * 0.12, p.y * 0.7)));
        col = mix(col, sL(vec3(0.118, 0.153, 0.2)), cl * 0.4 * smoothstep(ysurf + 0.6, ysurf + 3.5, p.y));
        vec2 q = vec2(p.x + p.y * 0.38, p.y);
        float cw = 9.0 * uPx;
        float c = floor(q.x / cw);
        float rx = abs(fract(q.x / cw) - 0.5) * cw;
        float per = 2.4 + sh(vec2(c, 7.7)) * 2.4;
        float ry = fract((q.y + uTime * (6.0 + sh(vec2(c, 3.1)) * 6.0) + sh(vec2(c, 1.3)) * 40.0) / per);
        float len = (0.18 + sh(vec2(c, 5.2)) * 0.45) / per;
        float streak = step(ry, len) * (1.0 - smoothstep(0.0, uPx * 1.2, rx - 0.004));
        streak *= step(0.35, sh(vec2(c, 2.2)));
        col += sL(vec3(0.56, 0.63, 0.71)) * streak * (0.02 + sh(vec2(c, 9.9)) * 0.06) * (1.0 - uDawn * 0.85);
        col = mix(col, sL(vec3(0.42, 0.47, 0.52)), uDawn * (1.0 - t) * 0.7);
    } else if (p.y > y0w) {
        // the years: one layer per sleep, grain and varves, never busy
        int idx = 0;
        float lo = y0w;
        float hi = ysurf;
        for (int i = 0; i < ${S.MAX_LAYERS}; i++) {
            if (i >= uN) break;
            float b = uB[i] + wv(p.x, float(i) + 1.0);
            if (p.y <= b) { idx = i; hi = b; break; }
            lo = b;
        }
        col = uTone[idx - (idx / 8) * 8];
        float th = max(hi - lo, 0.05);
        if (idx - (idx / 2) * 2 == 1) col = mix(col, pale, dotsP(p, 7.0, 0.55, float(idx)) * 0.13 + dotsP(p + 3.0 * uPx, 9.0, 0.45, float(idx) + 4.0) * 0.08);
        else col = mix(col, pale, hlines(p.y - lo, 4.0) * 0.07);
        float n = max(2.0, floor(th / (5.0 * uPx)));
        float t = (p.y - lo) / th * n;
        float f = fract(t);
        float dv = min(f, 1.0 - f) * th / n;
        float vl = 1.0 - smoothstep(0.3 * uPx, 1.1 * uPx, dv);
        float pl = step(mod(floor(t + 0.5), 3.0), 0.5);
        col = mix(col, mix(vec3(0.0), pale, pl), vl * mix(0.17, 0.04, pl));
        col = mix(col, vec3(0.0), sline(p.y - hi, 0.01) * 0.4);
        col *= 1.0 - 0.12 * uSleep;
    } else {
        // the old ground, then the bedrock the colony is cut into
        float b1 = -0.48 + wv(p.x, 11.0), b2 = -1.22 + wv(p.x, 12.0), b3 = -1.78 + wv(p.x, 13.0);
        float b4 = -2.52 + wv(p.x, 14.0), b5 = -3.04 + wv(p.x, 15.0);
        if (p.y > b1) {
            col = sL(vec3(0.208, 0.243, 0.29));
            col = mix(col, pale, dotsP(p, 9.0, 0.8, 1.0) * 0.15 + dotsP(p + 4.0 * uPx, 8.0, 0.6, 2.0) * 0.1);
        } else if (p.y > b2) {
            col = sL(vec3(0.106, 0.129, 0.161));
            vec2 cl = vec2(18.0, 11.0) * uPx;
            vec2 f = fract(p / cl) * cl;
            col = mix(col, pale, step(3.0 * uPx, f.y) * step(f.y, 4.0 * uPx) * step(f.x, 7.0 * uPx) * 0.12);
        } else if (p.y > b3) {
            col = sL(vec3(0.137, 0.165, 0.2));
            col = mix(col, pale, dotsP(p, 10.0, 0.7, 3.0) * 0.12);
        } else if (p.y > b4) {
            col = sL(vec3(0.086, 0.106, 0.133));
            vec2 cell = vec2(28.0, 16.0) * uPx;
            vec2 f = fract(p / cell) * cell - vec2(7.0, 5.0) * uPx;
            float e = length(f / (vec2(5.0, 1.6) * uPx));
            col = mix(col, pale, (1.0 - smoothstep(0.08, 0.32, abs(e - 1.0))) * 0.05);
        } else if (p.y > b5) {
            col = sL(vec3(0.122, 0.145, 0.18));
            col = mix(col, pale, hlines(p.y, 4.0) * 0.08);
        } else {
            col = sL(vec3(0.043, 0.055, 0.075));
            float nn = sn(p * 0.42) + 0.45 * sn(p * 1.15 + 7.0);
            float crack = sline(nn, 0.006) * smoothstep(0.0, 0.4, sn(p * 0.17 + 3.0));
            col = mix(col, sL(vec3(0.09, 0.114, 0.149)), crack * 0.6);
        }
        float bl = max(max(sline(p.y - b1, 0.01), sline(p.y - b2, 0.01)), max(sline(p.y - b3, 0.01), max(sline(p.y - b4, 0.01), sline(p.y - b5, 0.01))));
        col = mix(col, vec3(0.0), bl * 0.35);
    }
    col = mix(col, sL(vec3(0.357, 0.4, 0.463)), sline(p.y - y0w, 0.016) * 0.9);
    if (uN > 0) col = mix(col, sL(vec3(0.357, 0.4, 0.463)), sline(p.y - ysurf, 0.013) * 0.85);
    if (uRise > 0.0) {
        // cracks run out from the front of the rising body
        vec2 d = vW - vec2(0.0, uRiseY);
        float r = length(d);
        float a = atan(d.y, d.x);
        float cr = sline(fract(a * 2.6 + sn(vW * 1.4) * 0.35) - 0.5, 0.03 + r * 0.004);
        col = mix(col, vec3(0.0), cr * uRise * (1.0 - smoothstep(0.4, 2.2, r)) * step(0.0, d.y + 0.6) * 0.7);
    }
    if (uQuake > 0.0) {
        // deep-pass4 (B410): the finale: cracks run up from the crust over the colony, further with every room
        vec2 d = vW - vec2(0.0, -0.3);
        float r = length(d);
        float a = atan(d.y, d.x);
        float cr = sline(fract(a * 3.3 + sn(vW * 0.9) * 0.5) - 0.5, 0.018 + r * 0.003);
        float reach = 1.2 + 7.5 * uQuake;
        col = mix(col, vec3(0.0), cr * (1.0 - smoothstep(reach * 0.55, reach, r)) * step(0.0, d.y) * 0.9);
    }
    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
}`;

/* ------------------------------------------------------------------ the light over the colony */
const LIGHT_FRAG = /* glsl */`
uniform float uFocusY;
uniform float uAsleep;
uniform vec3 uSide;
varying vec2 vW;
void main() {
    float y = vW.y;
    float deep = smoothstep(0.35, 3.4, uFocusY - y) * 0.985;
    float night = uAsleep * 0.42 * smoothstep(0.2, -0.8, y);
    // deep-swap: zoomed in past the fit, the colony fades out where the panel and the ruler are
    float side = uSide.z * (1.0 - smoothstep(-0.6, 0.3, y)) * max(1.0 - smoothstep(uSide.x, uSide.x + 1.4, vW.x), smoothstep(uSide.y - 1.4, uSide.y, vW.x));
    deep = max(deep, side * 0.96);
    float a = 1.0 - (1.0 - deep) * (1.0 - night);
    if (a < 0.002) discard;
    gl_FragColor = vec4(0.0, 0.0, 0.0, a);
}`;

/* ------------------------------------------------------------------ the chamber tiles */
const TILE_VERT = /* glsl */`
attribute vec4 aUv;
attribute vec2 aDk;
attribute vec4 aSt;
uniform float uTime;
varying vec2 vUv;
varying vec2 vLoc;
varying vec2 vDk;
varying vec4 vSt;
void main() {
    vec3 p = position;
    if (aSt.z > 0.0) {
        float b = sin(uTime * 1.25 + instanceMatrix[3].x);
        p.y *= 1.0 + 0.09 * b * aSt.z;
        p.x *= 1.0 - 0.045 * b * aSt.z;
    }
    vLoc = uv;
    vUv = aUv.xy + uv * aUv.zw;
    vDk = aDk;
    vSt = aSt;
    gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(p, 1.0);
}`;
const TILE_FRAG = /* glsl */`
uniform sampler2D uAtlas;
uniform float uLit;
varying vec2 vUv;
varying vec2 vLoc;
varying vec2 vDk;
varying vec4 vSt;
void main() {
    vec4 lit = texture2D(uAtlas, vUv);
    vec4 dk = texture2D(uAtlas, vUv + vDk);
    vec4 c = mix(dk, lit, clamp(uLit * vSt.x, 0.0, 1.0));
    if (vSt.y >= 0.0) {
        // under way: the room shows faint, a bar fills along its floor
        c.a *= 0.5;
        float bar = step(0.06, vLoc.x) * step(vLoc.x, 0.06 + 0.88 * vSt.y) * step(0.1, vLoc.y) * step(vLoc.y, 0.2);
        c = mix(c, vec4(0.66, 0.72, 0.78, 1.0), bar);
    }
    c.a *= vSt.w;
    if (c.a < 0.004) discard;
    gl_FragColor = c;
    #include <colorspace_fragment>
}`;

/* ------------------------------------------------------------------ people, glows, the post pass */
const DOT_VERT = /* glsl */`
attribute float aA;
uniform float uSize;
varying float vA;
void main() {
    vA = aA;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = uSize;
}`;
const DOT_FRAG = /* glsl */`
uniform vec3 uCol;
varying float vA;
void main() {
    vec2 c = gl_PointCoord;
    float head = 1.0 - smoothstep(0.1, 0.14, length(c - vec2(0.5, 0.2)));
    float body = step(0.41, c.x) * step(c.x, 0.59) * step(0.34, c.y) * step(c.y, 0.99);
    float a = max(head, body) * vA;
    if (a < 0.02) discard;
    gl_FragColor = vec4(uCol, a);
    #include <colorspace_fragment>
}`;
const GLOW_VERT = /* glsl */`
attribute float aHot;
uniform float uTime;
varying vec2 vUv;
varying vec3 vCol;
varying float vHot;
void main() {
    vUv = uv;
    vCol = instanceColor;
    vHot = aHot;
    gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
}`;
const GLOW_FRAG = /* glsl */`
uniform float uTime;
uniform float uCore;
uniform float uPulse;
varying vec2 vUv;
varying vec3 vCol;
varying float vHot;
void main() {
    vec2 d = vUv - 0.5;
    float r = length(d) * 2.0;
    float g = exp(-r * r * 4.0) * (1.0 - smoothstep(0.85, 1.0, r));
    float core = uCore * (1.0 - smoothstep(0.05, 0.075, r));
    float pulse = 1.0 - uPulse * (0.35 - 0.35 * sin(uTime * 1.6 + vHot * 9.0));
    vec3 c = vCol * (g * pulse * (1.0 + 0.9 * step(1.0, vHot)) + core);
    gl_FragColor = vec4(c, 1.0);
    #include <colorspace_fragment>
}`;
const POST_VERT = /* glsl */`
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
const POST_FRAG = /* glsl */`
uniform sampler2D tCur;
uniform sampler2D tGhost;
uniform float uGhost;
uniform vec2 uDrift;
uniform float uWrong;
uniform float uFlick;
uniform float uFlash;
uniform float uSoft;
uniform float uTime;
varying vec2 vUv;
void main() {
    vec2 uv = vUv;
    uv.x += sin(uv.y * 34.0 + uTime * 1.7) * 0.0024 * uSoft;
    uv.y += sin(uv.x * 21.0 + uTime * 1.3) * 0.0016 * uSoft;
    if (uWrong > 0.5 && uWrong < 1.5) uv.x = 1.0 - uv.x;                 // mirrored
    if (uWrong > 1.5 && uWrong < 2.5) uv.y = fract(uv.y + 0.137);        // a floor out of place
    vec4 c = texture2D(tCur, uv);
    if (uWrong > 2.5) c = texture2D(tGhost, uv);                          // a frame from before
    vec3 g = texture2D(tGhost, uv - uDrift).rgb;
    c.rgb = max(c.rgb, g * uGhost * vec3(0.85, 0.92, 1.0));
    c.rgb = mix(c.rgb, vec3(0.7) - c.rgb * 0.5, uFlick * 0.55);
    c.rgb += uFlash * 0.16;
    gl_FragColor = vec4(c.rgb, 1.0);
    #include <colorspace_fragment>
}`;
const COPY_FRAG = /* glsl */`
uniform sampler2D tCur;
varying vec2 vUv;
void main() { gl_FragColor = texture2D(tCur, vUv); }`;

/* the flesh in a section: where the front has not come yet, the chamber shows through */
const SECTION_ALPHA = /* glsl */`
{
    vec2 sP = vFleshW.xy * uScale + vec2(uSeed * 1.37, -uSeed * 0.71);
    float sfd = length(vFleshW - uOrigin) + fbm(sP * 1.6 + 3.1) * 0.7;
    diffuseColor.a *= 1.0 - smoothstep(-0.02, 0.45, sfd - fleshFront());
}`;
function sectionAlpha(mat) {
    if (!mat || mat.userData.sectionAlpha) return mat;
    mat.userData.sectionAlpha = true;
    const orig = mat.onBeforeCompile;
    mat.onBeforeCompile = (shader, r) => {
        orig(shader, r);
        shader.fragmentShader = shader.fragmentShader
            .replace('float side = 1.0 - smoothstep(0.55, 0.8, an.y);', 'float side = 0.0;')
            .replace('diffuseColor.rgb = fleshCol;', `diffuseColor.rgb = fleshCol;\n${SECTION_ALPHA}`);
    };
    mat.customProgramCacheKey = () => 'deep-flesh-1-section';
    mat.transparent = true;
    mat.depthWrite = false;
    mat.needsUpdate = true;
    return mat;
}

/* ------------------------------------------------------------------ the atlas */
function drawAtlas() {
    const cv = document.createElement('canvas');
    cv.width = ATLAS_W;
    cv.height = ATLAS_H;
    const g = cv.getContext('2d');
    const arch = (x, y, w, h) => {
        const p = new Path2D();
        p.moveTo(x, y + h);
        p.lineTo(x + 0.6, y + 12);
        p.quadraticCurveTo(x + 2, y + 0.4, x + 16, y - 0.3);
        p.lineTo(x + w * 0.5, y - 2.2);
        p.lineTo(x + w - 16, y + 0.5);
        p.quadraticCurveTo(x + w - 2, y - 0.4, x + w - 0.5, y + 12);
        p.lineTo(x + w, y + h);
        p.closePath();
        return p;
    };
    const content = (t, x, y, w, h, col) => {
        const fy = y + h - 10;
        g.fillStyle = col; g.strokeStyle = col;
        if (t === 'mine') {
            g.beginPath(); g.moveTo(x + 14, fy); g.lineTo(x + 30, fy - 16); g.lineTo(x + 40, fy - 11); g.lineTo(x + 52, fy - 22); g.lineTo(x + 66, fy); g.closePath(); g.fill();
        } else if (t === 'farm') {
            g.lineWidth = 1.6;
            for (let i = 0; i < 7; i++) { g.beginPath(); g.moveTo(x + 18 + i * 9, fy); g.lineTo(x + 18 + i * 9, fy - 10 - (i % 3) * 3); g.stroke(); }
        } else if (t === 'generator') {
            g.fillRect(x + w / 2 - 9, fy - 26, 18, 26);
            g.beginPath(); g.ellipse(x + w / 2, fy - 26, 9, 3, 0, 0, Math.PI * 2); g.fill();
            g.globalAlpha *= 0.7; g.fillRect(x + w / 2 + 14, fy - 12, 10, 12);
        } else if (t === 'dorm') {
            g.fillRect(x + 12, fy - 8, 30, 3); g.fillRect(x + 12, fy - 20, 30, 3); g.fillRect(x + 52, fy - 8, 28, 3); g.fillRect(x + 52, fy - 20, 28, 3);
            for (const d of [12, 40, 52, 78]) g.fillRect(x + d, fy - 22, 2, 22);
        } else if (t === 'cryo' || t === 'vat') {
            g.lineWidth = 1.6;
            for (const d of [18, 34, 50, 66]) {
                g.beginPath(); g.roundRect(x + d, fy - 34, 10, 34, 5); g.stroke();
            }
        }
    };
    const person = (px, py, col) => {
        g.fillStyle = col;
        g.fillRect(px - 1, py - 6, 2.2, 6);
        g.beginPath(); g.arc(px + 0.1, py - 8, 1.6, 0, Math.PI * 2); g.fill();
    };
    const lampCone = (x, y, w, h, x0) => {
        const grad = g.createLinearGradient(0, y, 0, y + h - 10);
        grad.addColorStop(0, 'rgba(244,247,250,0.22)');
        grad.addColorStop(1, 'rgba(244,247,250,0.02)');
        g.fillStyle = grad;
        g.beginPath(); g.moveTo(x0 - 3, y + 4); g.lineTo(x0 + 3, y + 4); g.lineTo(x + w - 6, y + h - 10); g.lineTo(x + 6, y + h - 10); g.closePath(); g.fill();
        const glow = g.createRadialGradient(x0, y + 4, 0, x0, y + 4, 11);
        glow.addColorStop(0, 'rgba(232,240,248,0.35)');
        glow.addColorStop(1, 'rgba(232,240,248,0)');
        g.fillStyle = glow;
        g.beginPath(); g.arc(x0, y + 4, 11, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#ffffff';
        g.beginPath(); g.arc(x0, y + 4, 2.4, 0, Math.PI * 2); g.fill();
    };
    // one chamber, in mockup px (the context is scaled by 2)
    const chamber = (t, lit) => {
        const x = 4, y = 8, w = 92, h = 66, x0 = x + w / 2;
        if (t === 'empty') {
            const p = arch(x, y, w, h);
            g.fillStyle = '#05070a'; g.fill(p);
            g.setLineDash([4, 4]); g.lineWidth = 1;
            g.strokeStyle = INK; g.globalAlpha = lit ? 0.5 : 0.18; g.stroke(p);
            g.setLineDash([]);
            g.globalAlpha = lit ? 0.65 : 0.2; g.lineWidth = 1.3;
            g.beginPath(); g.moveTo(x0 - 6, y + h / 2); g.lineTo(x0 + 6, y + h / 2); g.moveTo(x0, y + h / 2 - 6); g.lineTo(x0, y + h / 2 + 6); g.stroke();
            g.globalAlpha = 1;
            return;
        }
        const p = arch(x, y, w, h);
        if (t !== 'vat') {
            g.fillStyle = '#030405'; g.fill(p);
            g.strokeStyle = '#262f3b'; g.lineWidth = 1; g.stroke(p);
        }
        if (lit && t !== 'vat') lampCone(x, y, w, h, x0);
        const cryo = t === 'cryo';
        if (t !== 'vat' && t !== 'ghost') {
            g.fillStyle = lit ? PLATE : cryo ? '#4a5564' : '#2a313b';
            g.fillRect(x + 3, y + h - 10, w - 6, 8);
        }
        if (t === 'ghost') {
            g.fillStyle = PLATE; g.fillRect(x + 3, y + h - 10, w - 6, 8);
            person(x + 20, y + h - 11, '#ffffff');
            return;
        }
        g.globalAlpha = t === 'vat' ? 0.55 : lit ? 0.85 : cryo ? 0.8 : 0.5;
        content(t, x, y, w, h, t === 'vat' ? '#d9dad3' : lit ? '#aeb8c4' : cryo ? INK : '#1c232c');
        g.globalAlpha = 1;
        if (!lit && cryo) {
            const glow = g.createRadialGradient(x0, y + h - 26, 0, x0, y + h - 26, 44);
            glow.addColorStop(0, 'rgba(232,240,248,0.2)');
            glow.addColorStop(1, 'rgba(232,240,248,0)');
            g.fillStyle = glow;
            g.save(); g.translate(x0, y + h - 26); g.scale(1, 20 / 44); g.translate(-x0, -(y + h - 26));
            g.beginPath(); g.arc(x0, y + h - 26, 44, 0, Math.PI * 2); g.fill(); g.restore();
        }
    };
    const tile = (px, py, fn) => { g.save(); g.translate(px, py); g.scale(2, 2); fn(); g.restore(); };
    const types = ['empty', 'mine', 'farm', 'generator', 'dorm', 'cryo'];
    types.forEach((t, i) => {
        tile(i * TILE_W, 0, () => chamber(t, true));
        tile(i * TILE_W, TILE_H, () => chamber(t, false));
    });
    // the machine house: a wide room, its lamp, its floor (the machine itself is the 3D model)
    const house = (lit) => {
        const x = 10, y = 8, w = 240, h = 84, x0 = x + w / 2;
        const p = arch(x, y, w, h);
        g.fillStyle = '#030405'; g.fill(p);
        g.strokeStyle = '#262f3b'; g.lineWidth = 1; g.stroke(p);
        if (lit) {
            const grad = g.createLinearGradient(0, y, 0, y + h - 10);
            grad.addColorStop(0, 'rgba(244,247,250,0.2)');
            grad.addColorStop(1, 'rgba(244,247,250,0.02)');
            g.fillStyle = grad;
            g.beginPath(); g.moveTo(x0 - 4, y + 5); g.lineTo(x0 + 4, y + 5); g.lineTo(x + w - 10, y + h - 10); g.lineTo(x + 10, y + h - 10); g.closePath(); g.fill();
            const glow = g.createRadialGradient(x0, y + 5, 0, x0, y + 5, 14);
            glow.addColorStop(0, 'rgba(232,240,248,0.35)');
            glow.addColorStop(1, 'rgba(232,240,248,0)');
            g.fillStyle = glow; g.beginPath(); g.arc(x0, y + 5, 14, 0, Math.PI * 2); g.fill();
            g.fillStyle = '#fff'; g.beginPath(); g.arc(x0, y + 5, 2.6, 0, Math.PI * 2); g.fill();
        }
        g.fillStyle = lit ? PLATE : '#2a313b';
        g.fillRect(x + 3, y + h - 10, w - 6, 8);
    };
    tile(HOUSE_TILE.x, HOUSE_TILE.y, () => house(true));
    tile(HOUSE_TILE.x + HOUSE_DARK_X, HOUSE_TILE.y, () => house(false));
    tile(VAT_TILE.x, VAT_TILE.y, () => chamber('vat', true));
    tile(GHOST_TILE.x, GHOST_TILE.y, () => chamber('ghost', true));
    return cv;
}

/* the tall thin figure, standing on y = 0 of its own frame */
function figureShape() {
    const s = new THREE.Shape();
    const pts = [
        [-0.05, 0], [-0.045, 0.9], [-0.07, 1.25], [-0.1, 1.35], [-0.12, 1.75], [-0.105, 2.02], [-0.06, 2.12],
        [-0.035, 2.16], [-0.05, 2.22], [-0.055, 2.33], [-0.03, 2.4], [0, 2.41], [0.03, 2.39], [0.05, 2.32],
        [0.045, 2.22], [0.03, 2.16], [0.06, 2.12], [0.1, 2.0], [0.115, 1.72], [0.095, 1.34], [0.07, 1.25],
        [0.05, 0.9], [0.055, 0],
    ];
    s.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) s.lineTo(pts[i][0], pts[i][1]);
    s.closePath();
    // and the arms, too long, hanging
    const arm = (sx) => {
        const a = new THREE.Shape();
        a.moveTo(0.1 * sx, 2.0); a.lineTo(0.135 * sx, 1.6); a.lineTo(0.14 * sx, 1.05); a.lineTo(0.125 * sx, 1.03); a.lineTo(0.11 * sx, 1.6); a.lineTo(0.085 * sx, 1.98);
        a.closePath();
        return a;
    };
    return [s, arm(1), arm(-1)];
}

/* an arched outline (a chamber's), in units, standing on y = 0 */
function archShape(w, h, grow = 0) {
    const x = -w / 2 - grow, r = w + grow * 2, top = h + grow;
    const s = new THREE.Shape();
    s.moveTo(x, -grow * 0.3);
    s.lineTo(x + 0.01, top - 0.26);
    s.quadraticCurveTo(x + 0.04, top - 0.01, x + 0.35, top);
    s.lineTo(x + r * 0.5, top + 0.05);
    s.lineTo(x + r - 0.35, top);
    s.quadraticCurveTo(x + r - 0.04, top - 0.01, x + r - 0.01, top - 0.26);
    s.lineTo(x + r, -grow * 0.3);
    s.closePath();
    return s;
}

/* a tube that tapers, with its index count per ring, for growing by draw range */
function taperTube(points, radius, tip, radial = 7, segs = 48) {
    const curve = new THREE.CatmullRomCurve3(points);
    const geo = new THREE.TubeGeometry(curve, segs, radius, radial, false);
    const pos = geo.attributes.position;
    const c = new THREE.Vector3(), v = new THREE.Vector3();
    for (let j = 0; j <= segs; j++) {
        curve.getPointAt(j / segs, c);
        const t = j / segs;
        const k = (1 - (1 - tip) * t) * (0.88 + 0.24 * Math.sin(t * 13 + points.length));
        for (let q = 0; q <= radial; q++) {
            const idx = j * (radial + 1) + q;
            v.fromBufferAttribute(pos, idx).sub(c).multiplyScalar(k).add(c);
            pos.setXYZ(idx, v.x, v.y, v.z);
        }
    }
    geo.computeVertexNormals();
    return { geo, curve, ring: radial * 6, segs, total: geo.index.count };
}

/**
 * @param {HTMLElement} container - the element the canvas fills (it gets position: relative if static)
 * @param {object} [opts]
 * @param {number} [opts.insetLeft=0] - pixels on the left the instrument panel covers: the colony is
 *        centred in the rest
 * @param {Function} [opts.onInteract] - the first time the player scrolls or drags the view
 * @param {Function} [opts.onClearDark] - (slot) a click on a chamber that stands dark
 * @param {Function} [opts.onLabels] - unused (scene.js draws lucide icons in labels; this view has none)
 * @param {HTMLElement} [opts.labelHost] - deep-swap: where the DOM labels go (the "+" where the next
 *        chamber is dug); defaults to a layer of its own over the canvas
 * @param {Function} [opts.onDig] - deep-swap: a click on that "+"; returns whether it dug
 */
export function createStrataView(container, opts = {}) {
    const insetLeft = opts.insetLeft || 0;
    if (getComputedStyle(container).position === 'static') container.style.position = 'relative';
    injectStyle();

    /* ------------------------------------------------ renderer, camera, the DOM over it */
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    let W = container.clientWidth || window.innerWidth;
    let H = container.clientHeight || window.innerHeight;
    let dpr = Math.min(window.devicePixelRatio || 1, 2);
    renderer.setPixelRatio(dpr);
    renderer.setSize(W, H);
    renderer.setClearColor(ROCK, 1);
    renderer.domElement.classList.add('strata-canvas');
    container.appendChild(renderer.domElement);

    // deep-swap: the labels share the HUD's label layer (#deep-labels) when the game hands one over
    const labelHost = opts.labelHost || null;
    const css2d = labelHost ? new CSS2DRenderer({ element: labelHost }) : new CSS2DRenderer();
    css2d.setSize(W, H);
    if (!labelHost) {
        css2d.domElement.className = 'strata-stars';
        container.appendChild(css2d.domElement);
    }

    const ui = document.createElement('div');
    ui.className = 'strata-ui';
    container.appendChild(ui);
    const ruler = document.createElement('div');
    ruler.className = 'strata-ruler';
    ui.appendChild(ruler);
    const upTag = document.createElement('div');
    upTag.className = 'strata-up';
    ui.appendChild(upTag);
    const labelEls = [];
    for (let i = 0; i < S.MAX_LAYERS + 2; i++) {
        const el = document.createElement('div');
        el.className = 'strata-label';
        el.hidden = true;
        ui.appendChild(el);
        labelEls.push({ el, y: NaN, text: '', shown: false, gone: false, sy: NaN });
    }

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 200);
    camera.position.set(0, 0, 60);

    scene.add(new THREE.AmbientLight(0xc8d2de, 0.6));
    const key = new THREE.DirectionalLight(0xffffff, 2.8);
    key.position.set(-2.2, 6.5, 6);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0x8fa1b6, 0.45);
    fill.position.set(6, -1, 4);
    scene.add(fill);

    const env = makeWetEnvironment(renderer);
    setFleshEnvironment(env);

    /* ------------------------------------------------ shared clock and light */
    const time = { value: 0 };
    const lit = { value: 1 };            // the colony's lamps: 1 awake, 0 asleep
    let litTarget = 1;

    /* ------------------------------------------------ the backdrop: sky, years, old ground, bedrock */
    const tones = ['#2f3743', '#262d37', '#343c48', '#2a313b', '#3a4350', '#2c333e', '#363e4a', '#29303a'].map((c) => new THREE.Color(c));
    const backU = {
        uB: { value: new Float32Array(S.MAX_LAYERS) }, uN: { value: 0 }, uTime: time, uDawn: { value: 0 },
        uRiseY: { value: 0 }, uRise: { value: 0 }, uQuake: { value: 0 }, uSleep: { value: 0 }, uPx: { value: 1 / 46 }, uTone: { value: tones },
    };
    const quad = new THREE.PlaneGeometry(1, 1);
    const backMat = new THREE.ShaderMaterial({ uniforms: backU, vertexShader: BACK_VERT, fragmentShader: BACK_FRAG, depthWrite: true });
    const back = new THREE.Mesh(quad, backMat);
    back.position.z = -20;
    back.frustumCulled = false;
    back.renderOrder = -10;
    scene.add(back);

    const lightU = { uFocusY: { value: S.FLOOR0 }, uAsleep: { value: 0 }, uSide: { value: new THREE.Vector3(-1e3, 1e3, 0) } };
    const lightMat = new THREE.ShaderMaterial({
        uniforms: lightU, vertexShader: BACK_VERT, fragmentShader: LIGHT_FRAG,
        transparent: true, depthTest: false, depthWrite: false,
    });
    const shade = new THREE.Mesh(quad, lightMat);
    shade.position.z = 10;
    shade.frustumCulled = false;
    shade.renderOrder = 900;
    scene.add(shade);

    /* ------------------------------------------------ the tiles: every chamber in one draw */
    const atlasTex = new THREE.CanvasTexture(drawAtlas());
    atlasTex.colorSpace = THREE.SRGBColorSpace;
    atlasTex.anisotropy = 4;
    const tileU = { uAtlas: { value: atlasTex }, uLit: lit, uTime: time };
    const tileMat = new THREE.ShaderMaterial({
        uniforms: tileU, vertexShader: TILE_VERT, fragmentShader: TILE_FRAG,
        transparent: true, depthWrite: false,
    });
    function tileGeometry(wPx, hPx, floorFromBottom, n) {
        const g = new THREE.PlaneGeometry(wPx * U, hPx * U);
        g.translate(0, hPx * U / 2 - floorFromBottom, 0);
        g.setAttribute('aUv', new THREE.InstancedBufferAttribute(new Float32Array(n * 4), 4));
        g.setAttribute('aDk', new THREE.InstancedBufferAttribute(new Float32Array(n * 2), 2));
        g.setAttribute('aSt', new THREE.InstancedBufferAttribute(new Float32Array(n * 4), 4));
        return g;
    }
    const tileGeo = tileGeometry(TILE_W, TILE_H, TILE_FLOOR, MAX_TILES);
    const tiles = new THREE.InstancedMesh(tileGeo, tileMat, MAX_TILES);
    tiles.count = 0;
    tiles.frustumCulled = false;
    tiles.renderOrder = 10;
    tiles.position.z = -8;
    scene.add(tiles);
    const houseGeo = tileGeometry(HOUSE_TILE.w, HOUSE_TILE.h, HOUSE_FLOOR, 1);
    const houseTile = new THREE.InstancedMesh(houseGeo, tileMat, 1);
    houseTile.frustumCulled = false;
    houseTile.renderOrder = 10;
    houseTile.position.set(0, S.HOUSE.y0, -9);
    houseTile.setMatrixAt(0, new THREE.Matrix4());
    setTileUv(houseGeo, 0, HOUSE_TILE.x, HOUSE_TILE.y, HOUSE_TILE.w, HOUSE_TILE.h, HOUSE_DARK_X, 0);
    setTileSt(houseGeo, 0, 1, -1, 0, 1);
    scene.add(houseTile);
    // the hallucinated room: a lamp where nothing is, and its after-image
    const ghostGeo = tileGeometry(TILE_W, TILE_H, TILE_FLOOR, 2);
    const ghostMat = new THREE.ShaderMaterial({
        uniforms: { uAtlas: { value: atlasTex }, uLit: { value: 1 }, uTime: time }, vertexShader: TILE_VERT, fragmentShader: TILE_FRAG,
        transparent: true, depthWrite: false, depthTest: false,
    });
    const ghostRoom = new THREE.InstancedMesh(ghostGeo, ghostMat, 2);
    ghostRoom.frustumCulled = false;
    ghostRoom.renderOrder = 950;
    ghostRoom.visible = false;
    for (let i = 0; i < 2; i++) {
        setTileUv(ghostGeo, i, GHOST_TILE.x, GHOST_TILE.y, TILE_W, TILE_H, 0, 0);
        setTileSt(ghostGeo, i, 1, -1, 0, i ? 0.25 : 0.92);
    }
    scene.add(ghostRoom);
    // the vats: the cryo's capsules over a dormitory the body took
    const vatGeo = tileGeometry(TILE_W, TILE_H, TILE_FLOOR, 40);
    const vats = new THREE.InstancedMesh(vatGeo, ghostMat, 40);
    vats.count = 0;
    vats.frustumCulled = false;
    vats.renderOrder = 22;
    vats.position.z = -5.5;
    scene.add(vats);

    function setTileUv(geo, i, px, py, w, h, dkX, dkY) {
        const a = geo.attributes.aUv.array, d = geo.attributes.aDk.array;
        a[i * 4] = px / ATLAS_W;
        a[i * 4 + 1] = 1 - (py + h) / ATLAS_H;
        a[i * 4 + 2] = w / ATLAS_W;
        a[i * 4 + 3] = h / ATLAS_H;
        d[i * 2] = dkX / ATLAS_W;
        d[i * 2 + 1] = -dkY / ATLAS_H;
        geo.attributes.aUv.needsUpdate = true;
        geo.attributes.aDk.needsUpdate = true;
    }
    function setTileSt(geo, i, litFlag, build, breathe, alpha) {
        const s = geo.attributes.aSt.array;
        s[i * 4] = litFlag; s[i * 4 + 1] = build; s[i * 4 + 2] = breathe; s[i * 4 + 3] = alpha;
        geo.attributes.aSt.needsUpdate = true;
    }

    /* ------------------------------------------------ the structure: shaft, corridors, the lid */
    const structMat = new THREE.MeshBasicMaterial({ vertexColors: true });
    const structure = new THREE.Mesh(new THREE.BufferGeometry(), structMat);
    structure.position.z = -10;
    structure.frustumCulled = false;
    scene.add(structure);

    /* ------------------------------------------------ the machine in its house */
    const MACH_SCALE = 1.05;
    const machine = createMachine({ below: -0.32 });
    machine.group.scale.setScalar(MACH_SCALE);
    machine.group.position.set(0, S.HOUSE.y0 + 0.17 + 0.13 * MACH_SCALE, -1.2);
    machine.group.rotation.y = 0.18;
    scene.add(machine.group);
    let machineTempo = { throws: 0, drive: 0, quiet: 1 };

    /* ------------------------------------------------ people */
    const dotPos = new Float32Array(MAX_DOTS * 3);
    const dotA = new Float32Array(MAX_DOTS);
    const dotGeo = new THREE.BufferGeometry();
    dotGeo.setAttribute('position', new THREE.BufferAttribute(dotPos, 3));
    dotGeo.setAttribute('aA', new THREE.BufferAttribute(dotA, 1));
    dotGeo.setDrawRange(0, 0);
    const dotU = { uSize: { value: 10 }, uCol: { value: new THREE.Color(0xffffff) } };
    const dotMat = new THREE.ShaderMaterial({ uniforms: dotU, vertexShader: DOT_VERT, fragmentShader: DOT_FRAG, transparent: true, depthWrite: false });
    const dots = new THREE.Points(dotGeo, dotMat);
    dots.frustumCulled = false;
    dots.renderOrder = 40;
    dots.position.z = -4;
    scene.add(dots);
    const folk = [];
    for (let i = 0; i < MAX_DOTS; i++) {
        folk.push({
            floor: 0, x: 0, y: 0, tx: 0, ty: 0, toFloor: 0, mode: 0, wait: 0, speed: 0.5, a: 0, aTo: 1, gone: 0, viaShaft: false,
            path: new Float32Array(10), pn: 0, plen: 0, delay: 0, out: 0, into: false,
        });
    }
    let folkN = 0;
    const floorTargets = [];          // per floor: x of the rooms people walk to (and the shaft, 0)

    /* ------------------------------------------------ glows: the lamps over the dark, the body's reach */
    function makeGlows(n, core, pulse, order) {
        const g = new THREE.PlaneGeometry(1, 1);
        g.setAttribute('aHot', new THREE.InstancedBufferAttribute(new Float32Array(n), 1));
        const m = new THREE.ShaderMaterial({
            uniforms: { uTime: time, uCore: { value: core }, uPulse: { value: pulse } },
            vertexShader: GLOW_VERT, fragmentShader: GLOW_FRAG,
            transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending,
        });
        const mesh = new THREE.InstancedMesh(g, m, n);
        mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3);
        mesh.count = 0;
        mesh.frustumCulled = false;
        mesh.renderOrder = order;
        scene.add(mesh);
        return mesh;
    }
    const lamps = makeGlows(32, 1.2, 0, 950);
    const reach = makeGlows(48, 0, 1, 30);
    const tmpM = new THREE.Matrix4(), tmpQ = new THREE.Quaternion(), tmpS = new THREE.Vector3(), tmpP = new THREE.Vector3();
    const tmpC = new THREE.Color();
    function placeGlow(mesh, i, x, y, sx, sy, color, hot = 0) {
        tmpM.compose(tmpP.set(x, y, 0), tmpQ.identity(), tmpS.set(sx, sy, 1));
        mesh.setMatrixAt(i, tmpM);
        mesh.setColorAt(i, tmpC.set(color));
        mesh.geometry.attributes.aHot.array[i] = hot;
    }
    function glowsDone(mesh, n) {
        mesh.count = n;
        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
        mesh.geometry.attributes.aHot.needsUpdate = true;
    }

    /* ------------------------------------------------ the figure */
    const figureMat = new THREE.MeshBasicMaterial({ color: 0x07090c, transparent: true, depthTest: false });
    const figureGeo = new THREE.ShapeGeometry(figureShape(), 6);
    const figure = new THREE.Mesh(figureGeo, figureMat);
    figure.renderOrder = 955;
    figure.visible = false;
    const hazeMat = new THREE.ShaderMaterial({
        uniforms: { uTime: time, uCore: { value: 0 }, uPulse: { value: 0.4 } },
        vertexShader: /* glsl */`varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: /* glsl */`uniform float uTime; varying vec2 vUv; void main() { vec2 d = (vUv - 0.5) * vec2(2.4, 1.0); float a = exp(-dot(d, d) * 5.0) * (0.11 + 0.03 * sin(uTime * 0.7)); gl_FragColor = vec4(0.85, 0.9, 0.95, a); }`,
        transparent: true, depthTest: false, depthWrite: false,
    });
    const haze = new THREE.Mesh(quad, hazeMat);
    haze.scale.set(2.2, 3.6, 1);
    haze.position.set(0, 1.25, -0.1);
    haze.renderOrder = 954;
    figure.add(haze);
    scene.add(figure);

    /* ------------------------------------------------ GROW: flesh, roots, threads, arms, hands */
    const fleshGroup = new THREE.Group();
    fleshGroup.position.z = -6;
    scene.add(fleshGroup);
    const rootGroup = new THREE.Group();
    rootGroup.position.z = -14;
    scene.add(rootGroup);
    const baseMat = new THREE.MeshBasicMaterial({ color: 0x080a0d });
    const chamberFleshGeo = new THREE.ShapeGeometry(archShape(S.CH_W, S.CH_H, 0.07), 6);
    const organs = new Map();         // id -> { mesh, flesh, necrotic }
    const corridorSegs = new Map();   // 'f:a:b' -> { mesh, a, b, flesh }
    const roots = [];                 // { mesh, t, dur, total, ring, segs }
    const hyPos = new Float32Array(MAX_HYPHAE * 6);
    const hyGeo = new THREE.BufferGeometry();
    hyGeo.setAttribute('position', new THREE.BufferAttribute(hyPos, 3));
    hyGeo.setDrawRange(0, 0);
    const hyMat = new THREE.LineBasicMaterial({ color: HYC, transparent: true, opacity: 0.26, depthWrite: false });
    const hyphae = new THREE.LineSegments(hyGeo, hyMat);
    hyphae.frustumCulled = false;
    hyphae.renderOrder = 5;
    hyphae.position.z = -13;
    scene.add(hyphae);
    let hyN = 0, hyShown = 0;
    const hyBatches = [];             // { from, to, root } segments revealed with their root
    let body = new Set(), necrotic = new Set(), reachSet = [];
    let lone = new Set();             // deep-grow2: the grafts, flesh joined to nothing
    // deep-organs: what each chamber of the body grew into, drawn in it (organ-art.js); the take in
    // progress grows its organ in as it fills; the hearts beat on the heartbeat
    let organMap = null;              // id -> 'vat' | 'gut' | 'heart' | 'nerve' (null: an old body, the dormitories are vats)
    const organArt = new Map();       // id -> { organ, art }
    let beatPhase = null;
    let hoverId = '';
    const handsArms = { on: false, arms: [], anchors: [], hands: null, grow: -1, cracks: null };
    let rising = null;
    const debrisPos = new Float32Array(MAX_DEBRIS * 3);
    const debrisVel = new Float32Array(MAX_DEBRIS * 3);
    const debrisA = new Float32Array(MAX_DEBRIS);
    const debrisGeo = new THREE.BufferGeometry();
    debrisGeo.setAttribute('position', new THREE.BufferAttribute(debrisPos, 3));
    debrisGeo.setAttribute('aA', new THREE.BufferAttribute(debrisA, 1));
    const debrisMat = new THREE.ShaderMaterial({
        uniforms: { uSize: { value: 5 }, uCol: { value: new THREE.Color(0x5b6676) } },
        vertexShader: DOT_VERT,
        fragmentShader: /* glsl */`uniform vec3 uCol; varying float vA; void main() { vec2 c = gl_PointCoord - 0.5; if (abs(c.x) + abs(c.y) > 0.5) discard; gl_FragColor = vec4(uCol, vA); }`,
        transparent: true, depthTest: false, depthWrite: false,
    });
    const debris = new THREE.Points(debrisGeo, debrisMat);
    debris.frustumCulled = false;
    debris.renderOrder = 960;
    debris.visible = false;
    scene.add(debris);

    /* ------------------------------------------------ the post pass: ghosts, wrong frames, the snap */
    const rtOpts = { type: THREE.HalfFloatType, depthBuffer: true, samples: 4 };
    const rtCur = new THREE.WebGLRenderTarget(W * dpr, H * dpr, rtOpts);
    const rtGhost = new THREE.WebGLRenderTarget(W * dpr, H * dpr, rtOpts);
    const postU = {
        tCur: { value: rtCur.texture }, tGhost: { value: rtGhost.texture }, uGhost: { value: 0 }, uDrift: { value: new THREE.Vector2() },
        uWrong: { value: 0 }, uFlick: { value: 0 }, uFlash: { value: 0 }, uSoft: { value: 0 }, uTime: time,
    };
    const postMat = new THREE.ShaderMaterial({ uniforms: postU, vertexShader: POST_VERT, fragmentShader: POST_FRAG, depthTest: false, depthWrite: false });
    const copyMat = new THREE.ShaderMaterial({ uniforms: { tCur: postU.tCur }, vertexShader: POST_VERT, fragmentShader: COPY_FRAG, depthTest: false, depthWrite: false });
    const postQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), postMat);
    postQuad.frustumCulled = false;
    const postScene = new THREE.Scene();
    postScene.add(postQuad);
    const postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    /* ------------------------------------------------ the state of the view */
    let lastState = null;
    let built = false;
    let lastLayout = { slots: [] };
    let structKey = '';
    let floors = 1;
    let chambers = [];                // per dug chamber: { slot, floor, col, x, y, type, tile }
    let emptyOverride = null;
    let emptyShown = [];
    let history = [];
    let layers = [];
    let labels = [];
    let surface = 0;
    let seenYears = -1, seenSleeps = -1;
    let labelsDirty = true;
    let lampSpec = null;
    const shown = { lamp: false, figure: false, breathe: false, afterimage: false, wrong: false };
    let lampAt = null;                // { slot } or { x, y } in the rock
    let breatheTile = -1;
    let flick = 0, flash = 0, soft = 0, softTarget = 0;
    let ghostAge = 0, wrongIn = 0, wrongFor = 0, wrongMode = 0, captureGhost = false;
    let dawn = 0;
    let dead = false;
    let march = null;
    const clickers = new Set();
    const hovers = new Set();
    let growMode = false;
    let handsThrows = 0.6;            // the machine's throws a second, for the hands (hooks.step)
    let candSectors = null, candHover = -1;   // an older save's sector choice (v1.52.0)

    /* ------------------------------------------------ deep-swap: the "+" where the next chamber is dug */
    const DIG_RING = 113;
    const digEl = document.createElement('div');
    digEl.className = 'deep-lbl strata-dig';
    digEl.innerHTML = '<div class="deep-lbl-in"><svg viewBox="0 0 40 40" style="width:34px;height:34px;">'
        + '<circle class="ring-base" cx="20" cy="20" r="18" fill="none" stroke-width="2"></circle>'
        + `<circle class="ring-fg" cx="20" cy="20" r="18" fill="none" stroke-width="3" stroke-dasharray="${DIG_RING}" stroke-dashoffset="${DIG_RING}" style="stroke:#4a5666;"></circle></svg>`
        + '<button class="dig-plus" type="button" aria-label="Dig a chamber here"></button><span class="dig-price deep-mono"></span></div>';
    const dig = {
        obj: new CSS2DObject(digEl), inner: digEl.firstChild, ring: digEl.querySelector('.ring-fg'),
        plus: digEl.querySelector('.dig-plus'), price: digEl.querySelector('.dig-price'), offer: { html: '', ok: false, on: true }, at: -1,
    };
    dig.obj.visible = false;
    scene.add(dig.obj);
    dig.plus.addEventListener('click', (e) => {
        e.stopPropagation();
        const ok = opts.onDig ? opts.onDig() : false;
        if (!ok) { dig.inner.classList.remove('is-no'); void dig.inner.offsetWidth; dig.inner.classList.add('is-no'); }
    });
    function paintDig() {
        if (dig.price.dataset.html !== dig.offer.html) { dig.price.dataset.html = dig.offer.html; dig.price.innerHTML = dig.offer.html; }
        dig.inner.classList.toggle('is-dig-ok', !!dig.offer.ok);
        dig.inner.classList.toggle('is-dig-off', !dig.offer.on);
    }

    /* ------------------------------------------------ camera */
    let ppu = S.MAX_PPU, ppuTarget = S.MAX_PPU, shaftPx = W / 2, shaftTarget = W / 2;
    // deep-tension: the drawer covers this much of the right (past the ruler): the colony is framed to
    // its left, so nothing the panel points to is hidden under it
    let insetRight = 0;
    let camX = 0, camY = -6, camTarget = -6, homeMode = true, touched = false;
    // deep-swap: sideways. 0 is the shaft in the middle of what the panel and the ruler leave free
    let panX = 0, panTarget = 0, panMax = 0, activeX = null, digsAhead = 0;
    let focusZoom = 0, focusUntil = 0;     // a short look closer (focusMachine), then back to the fit
    let focusY = S.floorLine(0);
    let shake = 0;
    let quakeK = 0;                    // deep-pass4: the finale's cracks over the colony (quake)
    const viewH = () => H / ppu;
    function deepestLine() { return S.floorLine(Math.max(0, floors - 1)); }
    function home() { return lastState && lastState.asleep && !rising ? S.sleepHomeY(viewH(), ppu) : S.homeY(viewH(), floors); }
    const freeHalf = () => Math.max(100, W - insetRight - insetLeft - S.RULER_PX - 32) / 2 / ppu;
    const lim = { min: 0, max: 0 };
    function limits() {
        S.cameraLimits(viewH(), floors, surface, lim);
        // asleep the camera rests higher (the years over YEAR 0): that is always within reach
        const h = home();
        lim.max = Math.max(lim.max, h);
        lim.min = Math.min(lim.min, h);
        if (rising) lim.max = Math.max(lim.max, surface + 2);
        return lim;
    }
    let zoomOverride = 0;
    function fit() {
        // the chambers, those being dug and the "+" for the next: all of them fit between the panel and the ruler
        const maxCol = S.widestColumn(Math.max(chambers.length + (growMode ? 0 : digsAhead + 1), 4));
        const f = S.fitScale(W - insetRight, insetLeft, maxCol);
        ppuTarget = zoomOverride || (focusZoom ? Math.max(f.ppu, focusZoom) : f.ppu);
        shaftTarget = f.shaftPx;
        if (!built) shaftPx = shaftTarget;
        panMax = S.panLimit(W - insetRight, insetLeft, maxCol, ppuTarget);
        labelsDirty = true;
    }
    /** deep-swap: where things happen now (the "+" to dig, the body's front): the camera keeps it in view. */
    function follow(x) { if (Number.isFinite(x) && !focusZoom) activeX = x; }
    function applyCamera() {
        const hw = W / 2 / ppu, hh = H / 2 / ppu;
        camX = (W / 2 - shaftPx) / ppu + panX;
        const sx = shake ? (Math.sin(time.value * 61) * 0.05 * shake) : 0;
        const sy = shake ? (Math.sin(time.value * 47 + 1) * 0.05 * shake) : 0;
        camera.left = -hw; camera.right = hw; camera.top = hh; camera.bottom = -hh;
        camera.position.set(camX + sx, camY + sy, 60);
        camera.updateProjectionMatrix();
        back.position.set(camX, camY, -20);
        back.scale.set(hw * 2 + 2, hh * 2 + 2, 1);
        shade.position.set(camX, camY, 10);
        shade.scale.set(hw * 2 + 2, hh * 2 + 2, 1);
        const sv = lightU.uSide.value;
        sv.x = camX + (insetLeft - W / 2) / ppu;
        sv.y = camX + (W - S.RULER_PX - 16 - W / 2) / ppu;
        sv.z += ((panMax > 0.05 && !rising ? 1 : 0) - sv.z) * 0.08;
        backU.uPx.value = 1 / ppu;
        dotU.uSize.value = PERSON_H * ppu * dpr * 1.25;
        debrisMat.uniforms.uSize.value = Math.max(3, 0.12 * ppu * dpr);
    }
    const toScreenX = (x) => W / 2 + (x - camX) * ppu;
    const toScreenY = (y) => H / 2 - (y - camY) * ppu;
    function toWorld(clientX, clientY, out) {
        const r = renderer.domElement.getBoundingClientRect();
        out.x = camX + (clientX - r.left - W / 2) / ppu;
        out.y = camY - (clientY - r.top - H / 2) / ppu;
        return r;
    }
    const wp = { x: 0, y: 0 };

    /* ------------------------------------------------ building the colony */
    function keyOf(state, layout) {
        return [
            state.chambers, (layout.slots || []).map((s) => s || '.').join(''),
            (state.darkSlots || []).join(','), (state.takenSlots || []).join(','),
        ].join('|');
    }
    function build(state, layout) {
        const slots = layout.slots || [];
        chambers = slots.map((type, slot) => {
            const p = S.chamberPos(slot);
            return { slot, floor: p.floor, col: p.col, x: p.x, y: p.y, type: type || null, isBody: body.has(`s${slot}`), tile: -1 };
        });
        floors = Math.max(1, ...chambers.map((c) => c.floor + 1));
        fit();
        if (!built) { built = true; ppu = ppuTarget; shaftPx = shaftTarget; camY = camTarget = home(); focusY = deepestLine(); }
        // the shaft, the corridors, the lid: flat rects with a colour each
        const pos = [], col = [];
        const rect = (x0, y0, x1, y1, hex) => {
            const c = new THREE.Color(hex);
            pos.push(x0, y0, 0, x1, y0, 0, x1, y1, 0, x0, y0, 0, x1, y1, 0, x0, y1, 0);
            for (let i = 0; i < 6; i++) col.push(c.r, c.g, c.b);
        };
        const bottom = deepestLine();
        const hw = S.SHAFT_W / 2;
        rect(-hw, bottom + 0.04, hw, 0, '#030405');
        rect(-hw - 0.02, bottom + 0.04, -hw, 0, '#3a424e');
        rect(hw, bottom + 0.04, hw + 0.02, 0, '#3a424e');
        for (let f = 0; f < floors; f++) {
            const row = chambers.filter((c) => c.floor === f);
            let x0 = -hw, x1 = hw;
            for (const c of row) { x0 = Math.min(x0, c.x); x1 = Math.max(x1, c.x); }
            const y = S.floorLine(f);
            rect(x0, y + 0.04, x1, y + S.CORRIDOR_H, '#030405');
            rect(x0, y - 0.03, x1, y + 0.035, '#7b8595');
            floorTargets[f] = row.filter((c) => c.type && c.type !== 'cryo' && !c.isBody).map((c) => c.x);
        }
        floorTargets.length = floors;
        syncFolkTargets();
        rect(-0.32, -0.08, 0.32, 0.08, '#8b97a8');
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
        structure.geometry.dispose();
        structure.geometry = geo;
        // a person standing where a chamber went: let them walk on
        for (let i = 0; i < folkN; i++) if (folk[i].floor >= floors) folk[i].floor = floors - 1;
        breatheTile = -1;
    }
    /** The tiles, from the state: each chamber's look, its light, what is under way in it. */
    function paintTiles(state) {
        const slots = lastLayout.slots || [];
        const dark = new Set([...(state.darkSlots || []), ...(state.takenSlots || [])]);
        const claimed = new Map();
        for (const j of state.builds || []) if (j.kind === 'room' && j.slot >= 0) claimed.set(j.slot, j);
        const free = emptyChambers(state, lastLayout);
        emptyShown = emptyOverride ? emptyOverride.filter((s) => free.includes(s)) : free;
        const showPlus = new Set(emptyShown);
        let n = 0;
        const progress = (j) => {
            const span = Math.max(1e-6, (j.doneDay ?? 0) - (j.startDay ?? 0));
            return clamp01(((state.day || 0) - (j.startDay ?? 0)) / span);
        };
        for (let slot = 0; slot < slots.length && n < MAX_TILES; slot++) {
            const c = chambers[slot];
            if (!c) continue;
            const job = claimed.get(slot);
            const type = job ? job.type : (slots[slot] || 'empty');
            const ix = TYPE_IX[type] ?? 0;
            tmpM.makeTranslation(c.x, c.y, 0);
            tiles.setMatrixAt(n, tmpM);
            setTileUv(tileGeo, n, ix * TILE_W, 0, TILE_W, TILE_H, 0, TILE_H);
            const flagLit = dark.has(slot) || (type === 'empty' && !showPlus.has(slot)) ? 0 : 1;
            setTileSt(tileGeo, n, flagLit, job ? progress(job) : -1, n === breatheTile ? 1 : 0, 1);
            c.tile = n;
            n++;
        }
        // chambers being dug: a faint outline that fills
        let next = slots.length;
        for (const j of state.builds || []) {
            if (j.kind !== 'dig' || n >= MAX_TILES) continue;
            const p = S.chamberPos(next++);
            tmpM.makeTranslation(p.x, p.y, 0);
            tiles.setMatrixAt(n, tmpM);
            setTileUv(tileGeo, n, 0, 0, TILE_W, TILE_H, 0, TILE_H);
            setTileSt(tileGeo, n, 1, progress(j), 0, 0.7);
            n++;
        }
        tiles.count = n;
        tiles.instanceMatrix.needsUpdate = true;
        // the "+" sits where the next chamber after those under way will be; its ring fills with the ore for it
        const p = S.chamberPos(next);
        if (next !== dig.at) { digsAhead = next - slots.length; dig.at = next; fit(); }
        dig.obj.position.set(p.x, p.cy, 0);
        dig.obj.visible = !growMode && !state.asleep;
        if (!growMode) follow(p.x);
        const cost = digCost(state.chambers || 0);
        const frac = clamp01(cost > 0 ? (state.minerals || 0) / cost : 0);
        dig.ring.setAttribute('stroke-dashoffset', (DIG_RING * (1 - frac)).toFixed(1));
    }

    /* ------------------------------------------------ people */
    // deep-swap (B294): in the body they walk INTO its organs and the vats and do not come out of an
    // organ; the vats (dormitories the body took) give people back: they step out of one and walk on
    const floorVats = [];             // per floor: x of the living vats
    const floorOrgans = [];           // per floor: x of the living organs that eat (not vats)
    function personY(f) { return S.floorLine(f) + 0.16 + PERSON_H / 2; }
    function walkable(f) { return (floorTargets[f] && floorTargets[f].length) || (floorVats[f] && floorVats[f].length); }
    function vatList() {
        const out = [];
        for (let f = 0; f < floors; f++) for (const x of floorVats[f] || []) out.push({ f, x });
        return out;
    }
    function pickTarget(p, rnd) {
        p.into = false;
        if (!walkable(p.floor)) {
            // nothing left here to walk to: down or up the shaft to a floor that has
            const ok = [];
            for (let f = 0; f < floors; f++) if (f !== p.floor && walkable(f)) ok.push(f);
            if (!ok.length) { p.gone = 1 + rnd() * 2; return; }
            p.toFloor = ok[Math.floor(rnd() * ok.length)]; p.viaShaft = true; p.tx = (rnd() - 0.5) * 0.12; p.mode = 1;
            return;
        }
        if (floors > 1 && rnd() < 0.16) {
            let to = p.floor + (rnd() < 0.5 ? -1 : 1);
            to = Math.max(0, Math.min(floors - 1, to));
            if (to !== p.floor && walkable(to)) { p.toFloor = to; p.viaShaft = true; p.tx = (rnd() - 0.5) * 0.12; p.mode = 1; return; }
        }
        p.viaShaft = false;
        const org = floorOrgans[p.floor] || [], vat = floorVats[p.floor] || [];
        if ((org.length || vat.length) && rnd() < 0.22) {
            // the body calls: into an organ (eaten) or into a vat (taken back in)
            const list = org.length && (!vat.length || rnd() < 0.7) ? org : vat;
            p.tx = list[Math.floor(rnd() * list.length)] + (rnd() - 0.5) * 0.5;
            p.into = true;
            p.mode = 1;
            return;
        }
        const xs = floorTargets[p.floor] && floorTargets[p.floor].length ? floorTargets[p.floor] : vat;
        p.tx = xs && xs.length ? xs[Math.floor(rnd() * xs.length)] + (rnd() - 0.5) * 1.4 : (rnd() - 0.5) * 2;
        p.mode = 1;
    }
    const rnd = mulberry32(9127);
    function setPeople(state, wake = false) {
        if (state.asleep && !wake) return;
        const want = march ? folkN : Math.min(MAX_DOTS, Math.max(0, Math.round(state.humans || 0)));
        const living = [];
        for (let f = 0; f < floors; f++) if (walkable(f)) living.push(f);
        if (!living.length) { folkN = 0; dotGeo.setDrawRange(0, 0); return; }
        while (folkN < want) {
            const p = folk[folkN++];
            p.floor = living[Math.floor(rnd() * living.length)];
            const xs = floorTargets[p.floor] && floorTargets[p.floor].length ? floorTargets[p.floor] : floorVats[p.floor];
            p.x = xs[Math.floor(rnd() * xs.length)] + (rnd() - 0.5) * 1.2;
            p.y = personY(p.floor);
            p.mode = 0; p.wait = rnd() * 3; p.speed = 0.45 + rnd() * 0.4; p.a = 0; p.aTo = 1; p.gone = 0; p.out = 0; p.into = false;
        }
        folkN = Math.min(folkN, want);
        dotGeo.setDrawRange(0, folkN);
    }
    function inBodyChamber(p) {
        if (!body.size) return false;
        for (let i = 0; i < chambers.length; i++) {
            const c = chambers[i];
            if (c.floor === p.floor && Math.abs(c.x - p.x) < S.CH_W / 2 - 0.15 && c.isBody) return true;
        }
        return false;
    }
    /** The body lets one go: out of a vat if it has any, else down the shaft onto a living floor. */
    function respawn(p) {
        const vats = vatList();
        if (vats.length && rnd() < 0.7) {
            const v = vats[Math.floor(rnd() * vats.length)];
            p.floor = v.f; p.x = v.x + (rnd() - 0.5) * 0.6; p.out = 2.2;
        } else {
            for (let k = 0; k < 6; k++) {
                const f = Math.floor(rnd() * floors);
                if (walkable(f)) { p.floor = f; break; }
            }
            const xs = floorTargets[p.floor] && floorTargets[p.floor].length ? floorTargets[p.floor] : floorVats[p.floor];
            p.x = xs && xs.length ? xs[Math.floor(rnd() * xs.length)] + (rnd() - 0.5) * 1.2 : 0;
            p.out = 0;
        }
        p.y = personY(p.floor); p.aTo = 1; p.into = false;
        if (p.out > 0) pickTarget(p, rnd); else { p.mode = 0; p.wait = 0.5 + rnd() * 3; }
    }
    function stepPerson(p, dt) {
        if (p.out > 0) p.out -= dt;
        if (p.gone > 0) {
            p.gone -= dt;
            p.aTo = 0;
            if (p.gone <= 0) respawn(p);
        } else if (p.mode === 0) {
            p.wait -= dt;
            if (p.wait <= 0) pickTarget(p, rnd);
        } else if (p.mode === 1) {
            const d = p.tx - p.x;
            const s = p.speed * dt;
            if (Math.abs(d) <= s) {
                p.x = p.tx;
                if (p.into) { p.into = false; p.gone = 2 + rnd() * 4; } else if (p.viaShaft) { p.mode = 2; p.ty = personY(p.toFloor); } else { p.mode = 0; p.wait = 1 + rnd() * 4; }
            } else p.x += Math.sign(d) * s;
            if (!p.into && !(p.out > 0) && p.gone <= 0 && inBodyChamber(p)) { p.gone = 2 + rnd() * 4; }
        } else {
            const d = p.ty - p.y;
            const s = 1.1 * dt;
            if (Math.abs(d) <= s) { p.y = p.ty; p.floor = p.toFloor; p.mode = 0; p.wait = 0.3 + rnd(); } else p.y += Math.sign(d) * s;
        }
        p.a += Math.max(-dt * 2, Math.min(dt * 2, p.aTo - p.a));
    }

    /* the marches: everyone walks one path (to the hall, out of it, up and away) */
    function cryoSpot() {
        const c = chambers.find((k) => k.type === 'cryo');
        return c ? { x: c.x, y: personY(c.floor) } : { x: 0, y: personY(0) };
    }
    function startMarch(mode, seconds) {
        if (mode === 'release' && lastState && !folkN) {
            setPeople(lastState, true);
            for (let i = 0; i < folkN; i++) folk[i].a = 0;
        }
        if (!folkN) return Promise.resolve();
        const cs = cryoSpot();
        for (let i = 0; i < folkN; i++) {
            const p = folk[i];
            const P = p.path;
            const hy = personY(p.floor);
            if (mode === 'gather') {
                P.set([p.x, p.y, 0, p.y, 0, cs.y, cs.x, cs.y]); p.pn = 4;
            } else if (mode === 'release') {
                const xs = floorTargets[p.floor] || [0];
                const tx = xs.length ? xs[Math.floor(rnd() * xs.length)] + (rnd() - 0.5) : 0;
                P.set([cs.x, cs.y, 0, cs.y, 0, hy, tx, hy]); p.pn = 4;
                p.x = tx; p.y = hy;
            } else {
                P.set([p.x, p.y, 0, p.y, 0, S.HOUSE.y0 + 0.3, 0, surface + 0.2]); p.pn = 4;
            }
            let len = 0;
            for (let k = 1; k < p.pn; k++) len += Math.hypot(P[k * 2] - P[k * 2 - 2], P[k * 2 + 1] - P[k * 2 - 1]);
            p.plen = Math.max(1e-6, len);
            p.delay = rnd() * 0.3;
        }
        return new Promise((resolve) => {
            let done = false;
            const finish = () => { if (done) return; done = true; clearTimeout(guard); resolve(); };
            const guard = setTimeout(() => {
                if (dead) { finish(); return; }
                if (march && march.resolve === finish) { march.k = 1; stepMarch(0); return; }
                finish();
            }, Math.ceil(Math.max(0.1, seconds) * 1000) + 400);
            march = { mode, k: 0, dur: Math.max(0.1, seconds), resolve: finish };
        });
    }
    function pathAt(p, u) {
        let want = u * p.plen;
        const P = p.path;
        for (let k = 1; k < p.pn; k++) {
            const ax = P[k * 2 - 2], ay = P[k * 2 - 1], bx = P[k * 2], by = P[k * 2 + 1];
            const L = Math.hypot(bx - ax, by - ay);
            if (want <= L || k === p.pn - 1) {
                const t = L > 0 ? Math.min(1, want / L) : 1;
                p.x = ax + (bx - ax) * t; p.y = ay + (by - ay) * t;
                return;
            }
            want -= L;
        }
    }
    function stepMarch(dt) {
        march.k = Math.min(1, march.k + dt / march.dur);
        for (let i = 0; i < folkN; i++) {
            const p = folk[i];
            const u = clamp01((march.k - p.delay) / (1 - p.delay));
            pathAt(p, march.mode === 'release' ? 1 - ease(1 - u) : ease(u));
            p.a = march.mode === 'release' ? Math.min(1, u * 4) : march.mode === 'gather' ? Math.min(1, (1 - u) * 6) : 1;
        }
        if (march.k < 1) return;
        const { mode, resolve } = march;
        march = null;
        if (mode === 'release') {
            for (let i = 0; i < folkN; i++) { const p = folk[i]; p.mode = 0; p.wait = rnd() * 2; p.a = 1; p.aTo = 1; p.y = personY(p.floor); }
        } else {
            folkN = 0;
            dotGeo.setDrawRange(0, 0);
        }
        resolve();
    }
    function writeDots() {
        for (let i = 0; i < folkN; i++) {
            const p = folk[i];
            dotPos[i * 3] = p.x; dotPos[i * 3 + 1] = p.y; dotPos[i * 3 + 2] = 0;
            dotA[i] = p.a;
        }
        dotGeo.attributes.position.needsUpdate = true;
        dotGeo.attributes.aA.needsUpdate = true;
        dotGeo.setDrawRange(0, folkN);
    }

    /* ------------------------------------------------ the strata: history, uniforms, labels */
    /** deep-swap: the layers the game keeps (state.strata, years per sleep) win over the view's own count. */
    function applyLayers() {
        layers = S.strataLayers(history);
        const arr = backU.uB.value;
        for (let i = 0; i < S.MAX_LAYERS; i++) arr[i] = i < layers.length ? layers[i].y1 : 0;
        backU.uN.value = layers.length;
        surface = S.surfaceY(layers);
        labelsDirty = true;
    }
    function syncYears(force) {
        const kept = lastState && Array.isArray(lastState.strata) ? lastState.strata : null;
        if (kept) {
            if (kept === keptRef && !force) return;
            keptRef = kept;
            history = S.compactHistory(kept.map(Number).filter((v) => v >= 0));
            applyLayers();
            return;
        }
        const w = lastState && lastState.watcher;
        if (!w) { if (force) applyLayers(); return; }
        const total = w.sleptYears || 0;
        const sleeps = w.sleeps || 0;
        if (!force && total === seenYears && sleeps === seenSleeps) return;
        seenYears = total; seenSleeps = sleeps;
        const next = S.trackHistory(history, total, sleeps);
        if (next === history && !force) return;
        history = next;
        applyLayers();
    }
    let keptRef = null;
    let labelClock = 0;
    let rulerPos = -1;
    // deep-swap: the HUD on the right (what we hold, the buttons and the lever): no year label under it
    let avoidRects = [], avoidClock = 0;
    function underHud(sy) {
        for (const r of avoidRects) if (sy > r.top - 12 && sy < r.bottom + 18) return true;   // deep-pass4: a label never just under a counter
        return false;
    }
    let labelYear = -1;
    function updateLabels(dt) {
        labelClock -= dt;
        // deep-pass3 (B407): the top of the ruler is the clock's year, so it moves with the clock ("YEAR 0" stood
        // still at the right while the clock said 682), and every boundary reads as a year ("8", "50", "82")
        const yearNow = Math.floor(Math.max(0, (lastState && lastState.day) || 0) / 365);
        if (yearNow !== labelYear) { labelYear = yearNow; labelsDirty = true; }
        if (labelsDirty && labelClock <= 0) {
            labels = S.strataLabels(layers, Math.max(0.4, LABEL_GAP_PX / ppu));
            labelClock = 0.1;
            labelsDirty = false;
            for (let i = 0; i < labelEls.length; i++) {
                const L = labels[i];
                const rec = labelEls[i];
                if (!L) { rec.y = NaN; continue; }
                const top0 = labels[0];
                const offset = Math.max(0, yearNow - ((top0 && top0.years) || 0));
                const txt = i === 0 ? `YEAR ${S.formatYears(yearNow)}` : L.kind === 'zero' ? 'YEAR 0' : `YEAR ${S.formatYears(L.years + offset)}`;
                if (rec.text !== txt) { rec.el.textContent = txt; rec.text = txt; }
                rec.el.classList.toggle('is-zero', L.kind !== 'year');
                rec.y = L.y;
            }
            const upText = 'SURFACE ↑';
            if (upTag.textContent !== upText) upTag.textContent = upText;
        }
        const viewTop = camY + viewH() / 2;
        avoidClock -= dt;
        if (avoidClock <= 0 && opts.avoid) {
            avoidClock = 0.25;
            const cr = cv.getBoundingClientRect();
            avoidRects = (opts.avoid() || []).filter((r) => r && r.width > 0 && r.right > cr.right - 230 && r.left < cr.right - 30)
                .map((r) => ({ top: r.top - cr.top, bottom: r.bottom - cr.top }));
        }
        // deep-pass4 (B417): THIN THEM. The human pass saw the YEAR labels stack down the right edge and under
        // the people counter. From the newest down: at most LABELS_SHOWN years (and YEAR 0), each at least
        // LABEL_GAP_PX below the one shown above it, none under the counters
        let shownN = 0, lastY = -Infinity;
        for (let i = 0; i < labelEls.length; i++) {
            const rec = labelEls[i];
            const sy = Number.isFinite(rec.y) ? toScreenY(rec.y) : NaN;
            const zero = labels[i] && labels[i].kind === 'zero';
            const on = sy > 30 && sy < H - 8 && !underHud(sy) && sy - lastY >= LABEL_GAP_PX && (zero || shownN < LABELS_SHOWN);
            if (on) { lastY = sy; if (!zero) shownN++; }
            if (on !== rec.shown) { rec.el.hidden = !on; rec.shown = on; }
            if (on && !(Math.abs(sy - rec.sy) <= 0.25)) { rec.el.style.transform = `translate3d(0, ${sy.toFixed(1)}px, 0)`; rec.sy = sy; }
            const gone = !!rising && rec.y < rising.frontY && Number.isFinite(rec.y);
            if (gone !== rec.gone) { rec.el.classList.toggle('is-gone', gone); rec.gone = gone; }
        }
        const up = surface + 0.2 > viewTop && layers.length > 0;
        if (upTag.hidden === up) upTag.hidden = !up;
        const rp = Math.round(((toScreenY(0) % 20) + 20) % 20);
        if (rp !== rulerPos) { rulerPos = rp; ruler.style.backgroundPositionY = `${rp}px`; }
    }

    /* ------------------------------------------------ hallucinations */
    function visibleChamber(pred) {
        const top = camY + viewH() / 2 - 0.5, bot = camY - viewH() / 2 + 0.5;
        const list = chambers.filter((c) => c.y > bot && c.y + S.CH_H < top && pred(c));
        return list.length ? list[Math.floor(rnd() * list.length)] : null;
    }
    function placeGhostRoom() {
        let x, y;
        if (lampAt && lampAt.slot != null) {
            const c = chambers[lampAt.slot];
            if (!c) { ghostRoom.visible = false; return; }
            x = c.x; y = c.y;
        } else if (lampAt) { x = lampAt.x; y = lampAt.y; } else { ghostRoom.visible = false; return; }
        tmpM.makeTranslation(x, y, 0);
        ghostRoom.setMatrixAt(0, tmpM);
        tmpM.makeTranslation(x + 0.11, y - 0.07, 0);
        ghostRoom.setMatrixAt(1, tmpM);
        ghostRoom.instanceMatrix.needsUpdate = true;
        ghostRoom.visible = true;
    }
    function figureLine() {
        // the surface line if it is in view, else the highest year line that is, else YEAR 0
        const top = camY + viewH() / 2 - 3.6, bot = camY - viewH() / 2 + 0.3;
        if (surface <= top && surface >= bot) return surface;
        for (let i = layers.length - 1; i >= 0; i--) if (layers[i].y1 <= top && layers[i].y1 >= bot) return layers[i].y1;
        return 0;
    }
    function hallucinate(kind, on) {
        if (!(kind in shown)) return false;
        on = !!on;
        if (kind === 'lamp') {
            if (!on) { lampAt = null; shown.lamp = false; ghostRoom.visible = false; return false; }
            if (!lampAt) {
                const c = visibleChamber((k) => emptyShown.includes(k.slot));
                if (c) lampAt = { slot: c.slot };
                else {
                    // a room that was never dug, up in the young rock (or the old ground)
                    const yTop = Math.min(surface, camY + viewH() / 2 - 2.2);
                    const yb = Math.max(0.6, yTop - 1.6);
                    lampAt = { x: 6.1 + rnd() * 2, y: layers.length ? yb : -2.6 };
                }
            }
            placeGhostRoom();
            shown.lamp = true;
            return true;
        }
        if (kind === 'figure') {
            shown.figure = on;
            figure.visible = on;
            if (on) { figure.position.set(5.2 + rnd() * 1.5, figureLine(), 0); figure.scale.setScalar(1.35); figureMat.opacity = 1; }
            return on;
        }
        if (kind === 'breathe') {
            if (!on) { breatheTile = -1; shown.breathe = false; if (lastState) paintTiles(lastState); return false; }
            if (breatheTile < 0) {
                const c = visibleChamber((k) => !!k.type);
                breatheTile = c ? c.tile : (chambers[0] ? chambers[0].tile : -1);
            }
            shown.breathe = breatheTile >= 0;
            if (lastState) paintTiles(lastState);
            return shown.breathe;
        }
        if (kind === 'afterimage') {
            shown.afterimage = on;
            if (on) { captureGhost = true; ghostAge = 0; }
            return on;
        }
        if (kind === 'wrong') {
            shown.wrong = on;
            if (on) { captureGhost = true; wrongIn = 0.8 + rnd() * 1.5; } else { wrongFor = 0; wrongMode = 0; }
            return on;
        }
        return false;
    }
    function flickerHallucinations(on) {
        flick = on ? 1 : 0;
        figureMat.opacity = on ? 0.2 : 1;
        ghostMat.uniforms.uLit.value = on ? 0.2 : 1;
    }
    function snapClear() {
        const any = Object.values(shown).some(Boolean);
        if (!any) return Promise.resolve();
        const steps = [true, false, true, false];
        return new Promise((resolve) => {
            steps.forEach((on, i) => setTimeout(() => { if (!dead) flickerHallucinations(on); }, i * 60));
            setTimeout(() => {
                if (!dead) {
                    flickerHallucinations(false);
                    for (const k of Object.keys(shown)) hallucinate(k, false);
                }
                resolve();
            }, steps.length * 60 + 30);
        });
    }
    function postActive() {
        return shown.afterimage || shown.wrong || flick > 0 || flash > 0.002 || soft > 0.01 || wrongFor > 0;
    }
    function stepGhosts(dt) {
        if (shown.afterimage) {
            ghostAge += dt;
            postU.uGhost.value = Math.min(0.26, ghostAge * 0.3) * (0.75 + 0.25 * Math.sin(time.value * 2.3));
            postU.uDrift.value.set(0.0035 * ghostAge, -0.0018 * ghostAge);
            if (ghostAge > 5.5) { captureGhost = true; ghostAge = 0; }
        } else postU.uGhost.value = 0;
        if (shown.wrong) {
            if (wrongFor > 0) {
                wrongFor -= dt;
                if (wrongFor <= 0) { wrongMode = 0; wrongIn = 2.5 + rnd() * 4.5; captureGhost = true; }
            } else {
                wrongIn -= dt;
                if (wrongIn <= 0) { wrongMode = 1 + Math.floor(rnd() * 3); wrongFor = 0.09 + rnd() * 0.16; }
            }
        }
        postU.uWrong.value = wrongFor > 0 ? wrongMode : 0;
        postU.uFlick.value = flick;
        flash = Math.max(0, flash - dt * 2.2);
        postU.uFlash.value = flash;
        soft += (softTarget - soft) * (1 - Math.exp(-dt * 0.8));
        postU.uSoft.value = soft;
        if (shown.figure) figure.position.y += (figureLine() - figure.position.y) * (1 - Math.exp(-dt * 3));
    }

    /* ------------------------------------------------ lamps over the dark (the lamp game, the ghost) */
    function paintLamps() {
        let n = 0;
        if (lampSpec) {
            // deep-pass3 (B400): a lamp in the sequence lights the whole chamber, big ("one lamp I barely saw")
            const add = (list, color, hot, big = false) => {
                for (const slot of list || []) {
                    const c = chambers[slot];
                    if (!c || n >= 32) continue;
                    if (big) placeGlow(lamps, n++, c.x, c.y + S.CH_H - 0.12, 1.8, 1.8, color, hot);
                    else placeGlow(lamps, n++, c.x, c.y + S.CH_H - 0.12, 0.9, 0.9, color, hot);
                }
            };
            add(lampSpec.lit, 0xe8f0f8, 0);
            add(lampSpec.flash, 0xffffff, 0.5, true);
            add(lampSpec.wrong, 0xe0a24f, 0.25, true);
        }
        glowsDone(lamps, n);
    }

    /* ------------------------------------------------ GROW */
    function idPos(id, out) {
        if (id === MACHINE) { out.x = 0; out.y = (S.HOUSE.y0 + S.HOUSE.y1) / 2; return out; }
        const slot = slotOf(id);
        if (slot >= 0) {
            const c = chambers[slot] || S.chamberPos(slot);
            out.x = c.x; out.y = (c.y ?? 0) + S.CH_H * 0.45;
            return out;
        }
        const f = Number(String(id).slice(1)) || 0;
        out.x = 0; out.y = S.floorLine(f) + 0.3;
        return out;
    }
    const v3 = new THREE.Vector3();
    function organMesh(id) {
        let o = organs.get(id);
        if (o) return o;
        let mesh;
        if (id === MACHINE) {
            mesh = new THREE.Mesh(new THREE.PlaneGeometry(S.HOUSE.x1 - S.HOUSE.x0 - 0.1, 0.42), baseMat);
            mesh.geometry.translate(0, 0.21, 0);
            mesh.position.set(0, S.HOUSE.y0 - 0.02, 0.6);
        } else if (slotOf(id) >= 0) {
            const slot = slotOf(id);
            const c = chambers[slot] || S.chamberPos(slot);
            mesh = new THREE.Mesh(chamberFleshGeo, baseMat);
            mesh.position.set(c.x, c.y, 0);
        } else {
            // a landing: the shaft through this floor becomes the spine, from the floor above
            const f = Number(String(id).slice(1)) || 0;
            const top = f === 0 ? S.HOUSE.y0 : S.floorLine(f - 1);
            const bot = S.floorLine(f) + 0.02;
            mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.66, top - bot), baseMat);
            mesh.geometry.translate(0, (top - bot) / 2, 0);
            mesh.position.set(0, bot, 0.1);
        }
        mesh.renderOrder = 20;
        fleshGroup.add(mesh);
        o = { mesh, flesh: false, necrotic: false };
        organs.set(id, o);
        return o;
    }
    function fleshOrigin(id) {
        idPos(id, wp);
        if (id === MACHINE) return v3.set(0, S.HOUSE.y0, fleshGroup.position.z);
        if (slotOf(id) >= 0) {
            const c = chambers[slotOf(id)];
            const sx = c ? c.x : wp.x;
            const y = c ? c.y + 0.35 : wp.y;
            return v3.set(sx - Math.sign(sx) * S.CH_W / 2, y, fleshGroup.position.z);
        }
        const f = Number(String(id).slice(1)) || 0;
        return v3.set(0, f === 0 ? S.HOUSE.y0 : S.floorLine(f - 1), fleshGroup.position.z);
    }
    function corridorKey(f, a, b) { return `${f}:${a}:${b}`; }
    function syncCorridors() {
        // the corridor between two body chambers (or a body chamber and its landing) is one muscle
        for (let f = 0; f < floors; f++) {
            const row = chambers.filter((c) => c.floor === f).sort((a, b) => a.col - b.col);
            const nodes = [{ col: 0, id: `h${f}`, x: 0 }, ...row.map((c) => ({ col: c.col, id: `s${c.slot}`, x: c.x }))].sort((a, b) => a.col - b.col);
            for (let i = 0; i + 1 < nodes.length; i++) {
                const a = nodes[i], b = nodes[i + 1];
                if (b.col - a.col !== 1) continue;
                if (!(body.has(a.id) && body.has(b.id)) || lone.has(a.id) || lone.has(b.id)) continue;
                const k = corridorKey(f, a.col, b.col);
                if (corridorSegs.has(k)) continue;
                const x0 = a.col === 0 ? S.SHAFT_W / 2 : a.x + S.CH_W / 2 - 0.05;
                const x1 = b.col === 0 ? -S.SHAFT_W / 2 : b.x - S.CH_W / 2 + 0.05;
                const mesh = new THREE.Mesh(new THREE.PlaneGeometry(Math.max(0.05, x1 - x0), 0.46), baseMat);
                mesh.geometry.translate(0, 0.23, 0);
                mesh.position.set((x0 + x1) / 2, S.floorLine(f) - 0.02, 0.05);
                mesh.renderOrder = 19;
                fleshGroup.add(mesh);
                const near = Math.abs(a.col) < Math.abs(b.col) ? x0 : x1;
                sectionAlpha(fleshify(mesh, { from: v3.set(near, S.floorLine(f) + 0.2, fleshGroup.position.z), duration: 1.4, sinew: 0.9, scale: 0.8, seed: f * 7 + a.col + 30, breathe: false, tint: 2.0 }));
                corridorSegs.set(k, { mesh });
            }
        }
    }
    function syncVats() {
        let n = 0;
        // deep-organs: a vat is drawn by its organ art; the old capsule tile stays for an old body
        if (organMap) { vats.count = 0; vats.instanceMatrix.needsUpdate = true; return; }
        for (const id of body) {
            const slot = slotOf(id);
            if (slot < 0 || n >= 40) continue;
            const c = chambers[slot];
            if (!c || c.type !== 'dorm' || necrotic.has(id)) continue;
            tmpM.makeTranslation(c.x, c.y, 0);
            vats.setMatrixAt(n, tmpM);
            setTileUv(vatGeo, n, VAT_TILE.x, VAT_TILE.y, TILE_W, TILE_H, 0, 0);
            setTileSt(vatGeo, n, 1, -1, 0, 0.75);
            n++;
        }
        vats.count = n;
        vats.instanceMatrix.needsUpdate = true;
    }
    function fleshMachine() {
        const from = new THREE.Vector3(0, S.HOUSE.y0, 0);
        machine.group.updateMatrixWorld(true);
        const list = [];
        machine.group.traverse((o) => { if (o.isMesh && !o.isInstancedMesh && o.visible && o.material && !o.material.userData?.flesh) list.push(o); });
        for (const m of list) fleshify(m, { from, duration: 2.6, breathe: false, scale: 2.2, pulse: 0.7, sinew: 0.5 });
    }
    /* roots: up from the body through every layer the years laid down */
    function rootAnchors() {
        const out = [];
        const ids = [...body].filter((id) => !necrotic.has(id) && !lone.has(id));
        ids.sort((a, b) => idPos(a, { x: 0, y: 0 }).y < idPos(b, { x: 0, y: 0 }).y ? 1 : -1);
        for (const id of ids) {
            const q = idPos(id, { x: 0, y: 0 });
            if (slotOf(id) >= 0) out.push({ x: q.x, y: q.y + S.CH_H * 0.55 });
            else if (id === MACHINE) out.push({ x: -1.8, y: S.HOUSE.y1 }, { x: 1.9, y: S.HOUSE.y1 });
        }
        return out;
    }
    function growRoots() {
        const anchors = rootAnchors();
        const want = Math.min(MAX_ROOTS, Math.floor((body.size - lone.size) * 0.75));
        while (roots.length < want && anchors.length) {
            const i = roots.length;
            const r = mulberry32(7700 + i * 131);
            const a = anchors[i % anchors.length];
            const x0 = a.x + (r() - 0.5) * 1.1;
            // the first roots reach the old ground; later ones go through every layer, past the surface
            const reach = Math.min(1, (i + 2) / 10);
            const top = -1.2 + (surface + 0.8 + 1.2) * reach;
            const pts = [];
            let x = x0, y = a.y;
            const dir = x0 === 0 ? (r() < 0.5 ? -1 : 1) : Math.sign(x0);
            pts.push(new THREE.Vector3(x, y, 0));
            while (y < top) {
                y = Math.min(top, y + 0.55 + r() * 0.5);
                x += (r() - 0.5) * 0.9 + dir * (y < -3 ? 0.35 : 0.05);
                if (y > S.HOUSE.y0 - 0.3 && y < S.HOUSE.y1 + 0.3 && Math.abs(x) < S.HOUSE.x1 + 0.3) x = dir * (S.HOUSE.x1 + 0.5 + r() * 0.8);
                pts.push(new THREE.Vector3(x, y, (r() - 0.5) * 0.2));
            }
            if (pts.length < 2) break;
            const tube = taperTube(pts, i < 4 ? 0.21 : 0.15, 0.3, 7, Math.min(140, pts.length * 7));
            const len = tube.curve.getLength();
            const mat = makeFleshMaterial({ mode: 'uv', uvScale: [len * 0.9, 0.5], seed: 5 + i * 7, envMap: env, envMapIntensity: 0.35, pulse: 1.6, sinew: 0.2, tint: 2.4 });
            const mesh = new THREE.Mesh(tube.geo, mat);
            mesh.geometry.setDrawRange(0, 0);
            rootGroup.add(mesh);
            const dur = 2.4 + len * 0.18;
            roots.push({ mesh, t: -(i % 3) * 0.3, dur, total: tube.total, ring: tube.ring, segs: tube.segs });
            // a few branches off it, and the mycelium threads along it
            for (let b = 0; b < 2; b++) {
                const k = 0.3 + r() * 0.5;
                const p0 = tube.curve.getPointAt(k);
                const side = r() < 0.5 ? -1 : 1;
                const bp = [p0.clone(), p0.clone().add(new THREE.Vector3(side * (0.5 + r() * 0.6), 0.4 + r() * 0.5, 0)), p0.clone().add(new THREE.Vector3(side * (1 + r() * 1.2), 0.9 + r() * 0.9, 0))];
                const bt = taperTube(bp, 0.07, 0.2, 5, 18);
                const bm = new THREE.Mesh(bt.geo, makeFleshMaterial({ mode: 'uv', uvScale: [3, 0.4], seed: 9 + i * 7 + b, envMap: env, envMapIntensity: 0.3, pulse: 1.1, sinew: 0.2, tint: 2.4 }));
                bm.geometry.setDrawRange(0, 0);
                rootGroup.add(bm);
                roots.push({ mesh: bm, t: -dur * k - 0.2, dur: 1.2, total: bt.total, ring: bt.ring, segs: bt.segs });
            }
            const from = hyN;
            for (let h = 0; h < 40 && hyN < MAX_HYPHAE - 20; h++) {
                const p = tube.curve.getPointAt(r());
                let hx = p.x, hy = p.y, ang = r() * Math.PI * 2;
                const steps = 6 + Math.floor(r() * 12);
                for (let s = 0; s < steps && hyN < MAX_HYPHAE; s++) {
                    ang += (r() - 0.5) * 0.6;
                    const nx = hx + Math.cos(ang) * 0.075, ny = hy + Math.sin(ang) * 0.075;
                    hyPos.set([hx, hy, 0, nx, ny, 0], hyN * 6);
                    hyN++;
                    hx = nx; hy = ny;
                }
            }
            hyGeo.attributes.position.needsUpdate = true;
            hyBatches.push({ from, to: hyN, root: roots.length - 3 });
        }
    }
    function syncFolkTargets() {
        for (let f = 0; f < floors; f++) {
            const row = chambers.filter((c) => c.floor === f && c.isBody && !necrotic.has(`s${c.slot}`));
            const isVat = (c) => (organMap ? organMap[`s${c.slot}`] === 'vat' : c.type === 'dorm');
            floorVats[f] = row.filter(isVat).map((c) => c.x);
            floorOrgans[f] = row.filter((c) => !isVat(c)).map((c) => c.x);
        }
        floorVats.length = floors;
        floorOrgans.length = floors;
    }
    function setBody(bodyIds, necroticIds, reachableIds, loneIds) {
        lone = new Set(loneIds || []);
        const next = new Set(bodyIds || []);
        const dead2 = new Set(necroticIds || []);
        for (const id of next) {
            const o = organMesh(id);
            if (!o.flesh) {
                o.flesh = true;
                if (id === MACHINE) fleshMachine();
                sectionAlpha(fleshify(o.mesh, {
                    from: fleshOrigin(id).clone(), duration: id.startsWith('h') ? 1.6 : 2.2, scale: 0.75,
                    seed: (slotOf(id) + 3) * 3.7, sinew: id.startsWith('h') ? 0.85 : 0.45, breathe: slotOf(id) >= 0, pulse: 1.2, tint: 2.3,
                }));
            }
            const dn = dead2.has(id);
            if (dn !== o.necrotic) { o.necrotic = dn; setNecrotic(o.mesh, dn); }
        }
        body = next;
        necrotic = dead2;
        for (let i = 0; i < chambers.length; i++) chambers[i].isBody = body.has(`s${chambers[i].slot}`);
        for (let f = 0; f < floors; f++) floorTargets[f] = chambers.filter((c) => c.floor === f && c.type && c.type !== 'cryo' && !c.isBody).map((c) => c.x);
        syncFolkTargets();
        reachSet = (reachableIds || []).slice();
        // the camera keeps the front in view: the reachable chamber nearest the newest taken one
        const newest = [...next].reverse().find((id) => slotOf(id) >= 0);
        if (newest) {
            const nc = chambers[slotOf(newest)];
            const near = reachSet.map((id) => chambers[slotOf(id)]).filter((c) => c && nc && c.floor === nc.floor)
                .sort((a, b) => Math.abs(a.x - nc.x) - Math.abs(b.x - nc.x))[0];
            follow(near ? near.x : nc ? nc.x : 0);
        }
        syncCorridors();
        syncVats();
        growRoots();
        paintReach();
    }
    function paintReach() {
        let n = 0;
        for (const id of reachSet) {
            if (n >= 48) break;
            idPos(id, wp);
            const hot = id === hoverId ? 1.6 : 0.6;
            const big = id === MACHINE ? 2.6 : slotOf(id) >= 0 ? 1.0 : 0.55;
            placeGlow(reach, n++, wp.x, wp.y, 2.6 * big * (id === hoverId ? 1.15 : 1), 1.9 * big, 0x7a2a22, hot + n * 0.13);
        }
        glowsDone(reach, n);
    }
    /**
     * deep-organs: the organs in their chambers. `map` id -> organ for the body; `taking` the take in
     * progress ({ id, organ, k }), its organ growing in as k fills; `dead` the necrotic ids.
     */
    function setOrgans(map, { taking = null, dead = [] } = {}) {
        organMap = map ? { ...map } : null;
        const want = new Map();
        for (const [id, o] of Object.entries(organMap || {})) if (slotOf(id) >= 0 && body.has(id)) want.set(id, { organ: o, k: 1 });
        if (taking && slotOf(taking.id) >= 0 && taking.organ && taking.organ !== 'hands') want.set(taking.id, { organ: taking.organ, k: Math.max(0.04, taking.k || 0), grow: true });
        for (const [id, rec] of organArt) {
            const w = want.get(id);
            if (!w || w.organ !== rec.organ) { rec.art.dispose(); organArt.delete(id); }
        }
        const deadSet = new Set(dead || []);
        for (const [id, w] of want) {
            let rec = organArt.get(id);
            if (!rec) {
                const c = chambers[slotOf(id)];
                if (!c) continue;
                const art = makeOrganArt(w.organ, { w: S.CH_W * 0.78, h: S.CH_H * 0.62, seed: slotOf(id) + 11, env });
                art.group.position.set(c.x, c.y + S.CH_H * 0.42, 0.3);
                art.group.traverse((o) => { o.renderOrder = 24; });
                fleshGroup.add(art.group);
                rec = { organ: w.organ, art };
                organArt.set(id, rec);
            }
            rec.art.setGrow(w.k);
            rec.art.setNecrotic(deadSet.has(id));
        }
        syncVats();
        syncFolkTargets();
    }
    function stepOrgans(dt) {
        // zoomed in past the fit the colony fades out at the sides (the light's uSide): the organs with it
        const sv = lightU.uSide.value;
        for (const rec of organArt.values()) {
            const x = rec.art.group.position.x;
            rec.art.group.visible = !(sv.z > 0.3 && (x < sv.x + 0.4 || x > sv.y - 0.4));
            if (rec.art.group.visible) rec.art.step(dt, beatPhase);
        }
    }
    /** The hands go back into the house: the arms, the hands and the cracks are taken away. */
    function dropHands() {
        if (!handsArms.on) return false;
        for (const a of handsArms.arms) { scene.remove(a.mesh); a.mesh.geometry.dispose(); a.mesh.material.dispose?.(); }
        for (const an of handsArms.anchors) scene.remove(an);
        handsArms.hands?.dispose();
        if (handsArms.cracks) { scene.remove(handsArms.cracks); handsArms.cracks.geometry.dispose(); handsArms.cracks.material.dispose(); }
        handsArms.on = false; handsArms.arms = []; handsArms.anchors = []; handsArms.hands = null; handsArms.grow = -1; handsArms.cracks = null;
        return false;
    }
    function setHands(on, { instant = false } = {}) {
        if (!on) return dropHands();
        if (handsArms.on) return true;
        handsArms.on = true;
        const paths = [
            [[-0.55, -5.7], [-0.75, -4.7], [-1.35, -3.6], [-2.2, -2.75]],
            [[0, -5.6], [0.05, -4.5], [0.12, -3.2], [0.2, -2.0]],
            [[0.55, -5.7], [0.85, -4.7], [1.5, -3.6], [2.35, -2.75]],
        ];
        handsArms.hands = createHands({ scale: 21, envMap: env, overgrowArms: false });
        paths.forEach((P, i) => {
            const pts = P.map(([x, y]) => new THREE.Vector3(x, y, 1.4));
            const tube = taperTube(pts, 0.3, 0.6, 12, 40);
            const mat = makeFleshMaterial({ mode: 'uv', uvScale: [4, 0.9], seed: 40 + i * 9, envMap: env, envMapIntensity: 0.4, pulse: 0.9, sinew: 0.95, tint: 2.0 });
            const mesh = new THREE.Mesh(tube.geo, mat);
            mesh.geometry.setDrawRange(0, 0);
            scene.add(mesh);
            const anchor = new THREE.Group();
            const end = tube.curve.getPointAt(1);
            const tan = tube.curve.getTangentAt(1);
            const X = new THREE.Vector3(tan.x, tan.y, 0).normalize();
            const Z = new THREE.Vector3(X.y, -X.x, 0);
            const Y = new THREE.Vector3().crossVectors(Z, X);
            anchor.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(X, Y, Z));
            anchor.position.copy(end);
            anchor.userData.base = end.clone();
            anchor.userData.curve = tube.curve;
            scene.add(anchor);
            handsArms.arms.push({ mesh, tube });
            handsArms.anchors.push(anchor);
        });
        handsArms.hands.attach(handsArms.anchors);
        handsArms.hands.overgrow(instant ? 0.05 : OVERGROW_SECONDS);
        handsArms.grow = instant ? 0.999 : 0;
        // the rock cracks where the arms break out of the house
        const cp = [];
        const r = mulberry32(4411);
        for (const x of [-0.9, 0.05, 1.0]) {
            for (let k = 0; k < 6; k++) {
                let a = Math.PI / 2 + (r() - 0.5) * 2.4, px = x, py = S.HOUSE.y1 + 0.05;
                for (let j = 0; j < 4; j++) {
                    a += (r() - 0.5) * 0.8;
                    const nx = px + Math.cos(a) * (0.22 + r() * 0.3), ny = py + Math.sin(a) * (0.22 + r() * 0.3);
                    cp.push(px, py, 0, nx, ny, 0);
                    px = nx; py = ny;
                }
            }
        }
        const cg = new THREE.BufferGeometry();
        cg.setAttribute('position', new THREE.Float32BufferAttribute(cp, 3));
        handsArms.cracks = new THREE.LineSegments(cg, new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.85 }));
        handsArms.cracks.position.z = -12;
        handsArms.cracks.renderOrder = 6;
        scene.add(handsArms.cracks);
        return true;
    }
    function stepGrow(dt) {
        stepOrgans(dt);
        for (let i = 0; i < roots.length; i++) {
            const t = roots[i];
            if (t.t >= t.dur) continue;
            t.t += dt;
            const k = clamp01(t.t / t.dur);
            t.mesh.geometry.setDrawRange(0, Math.min(t.total, Math.ceil(ease(k) * t.segs) * t.ring));
        }
        // the threads show as their root is through
        let show = hyShown;
        for (let i = 0; i < hyBatches.length; i++) {
            const b = hyBatches[i];
            const r = roots[b.root];
            if (!r) continue;
            const k = clamp01(r.t / r.dur);
            if (k > 0.2) show = Math.max(show, b.from + Math.floor((b.to - b.from) * Math.min(1, (k - 0.2) / 0.8)));
        }
        if (show !== hyShown) { hyShown = show; hyGeo.setDrawRange(0, hyShown * 2); }
        if (handsArms.on) {
            if (handsArms.grow >= 0 && handsArms.grow < 1) {
                handsArms.grow = Math.min(1, handsArms.grow + dt / OVERGROW_SECONDS);
                const k = ease(handsArms.grow);
                for (let i = 0; i < handsArms.arms.length; i++) {
                    const a = handsArms.arms[i];
                    a.mesh.geometry.setDrawRange(0, Math.min(a.tube.total, Math.ceil(k * a.tube.segs) * a.tube.ring));
                    const an = handsArms.anchors[i];
                    an.userData.curve.getPointAt(Math.max(0.02, k), an.position);
                    if (rising) an.position.y += rising.lift;
                }
            } else if (rising) {
                for (let i = 0; i < handsArms.anchors.length; i++) {
                    const an = handsArms.anchors[i];
                    an.position.set(an.userData.base.x, an.userData.base.y + rising.lift, an.userData.base.z);
                }
            }
            handsArms.hands.step(dt, handsThrows || machineTempo.throws || 0.6);
        }
    }

    /* the rise: the body pushes up through every layer to the surface line */
    function rise(onDone) {
        if (rising) return rising.promise;
        if (!handsArms.on) setHands(true);
        const top = surface + 1.6;
        const h = top - S.HOUSE.y0;
        // a trunk of flesh: wide at the house, lumpy, a rounded crown
        const shape = new THREE.Shape();
        const r = mulberry32(991);
        const left = [], right = [];
        const crown = top - 1.4;
        for (let y = S.HOUSE.y1 - 0.6; y <= crown; y += 0.3) {
            const k = (y - S.HOUSE.y0) / h;
            const half = 3.1 - 1.2 * k;
            const lump = 0.32 * Math.sin(y * 1.3 + 0.7) + 0.22 * Math.sin(y * 2.9 + 2.1) + (r() - 0.5) * 0.12;
            const lump2 = 0.3 * Math.sin(y * 1.1 + 2.4) + 0.2 * Math.sin(y * 3.3 + 0.3) + (r() - 0.5) * 0.12;
            left.push([-half - lump, y]); right.push([half + lump2, y]);
        }
        const hw = (right[right.length - 1][0] - left[left.length - 1][0]) / 2;
        shape.moveTo(left[0][0], left[0][1]);
        for (const p of left) shape.lineTo(p[0], p[1]);
        for (let a = 1; a < 12; a++) {
            const t = Math.PI - (a / 12) * Math.PI;
            shape.lineTo(Math.cos(t) * hw + (r() - 0.5) * 0.12, crown + Math.sin(t) * 1.4 * (0.9 + 0.2 * r()));
        }
        for (let i = right.length - 1; i >= 0; i--) shape.lineTo(right[i][0], right[i][1]);
        shape.closePath();
        const mesh = new THREE.Mesh(new THREE.ShapeGeometry(shape, 4), baseMat);
        mesh.position.z = 0.3;
        mesh.renderOrder = 25;
        fleshGroup.add(mesh);
        const dur = Math.max(6, Math.min(10, h / 2.6));     // deep-swap: at most ten seconds of pushing
        const from = new THREE.Vector3(0, S.HOUSE.y0, fleshGroup.position.z + 0.3);
        sectionAlpha(fleshify(mesh, { from, duration: dur, sinew: 0.6, scale: 0.55, seed: 77, breathe: false, pulse: 1.5, tint: 2.5 }));
        for (const t of roots) t.dur = Math.min(t.dur, Math.max(0.1, t.t + 1.5));
        homeMode = false;
        if (focusZoom) { focusZoom = 0; fit(); }
        activeX = null;
        let resolveIt;
        const promise = new Promise((res) => { resolveIt = res; });
        rising = { mesh, u: mesh.material.userData.flesh, top, frontY: S.HOUSE.y0, lift: 0, t: 0, t0: performance.now(), dur, burst: -1, burstAt: 0, onDone, resolve: resolveIt, promise };
        backU.uRise.value = 1;
        // a wall clock behind it, for a hidden tab
        setTimeout(() => { if (rising && !rising.done) finishRise(); }, (dur + 4) * 1000);
        return promise;
    }
    function finishRise() {
        if (!rising || rising.done) return;
        rising.done = true;
        const { onDone, resolve } = rising;
        try { onDone?.(); } finally { resolve(); }
    }
    function stepRise(dt) {
        if (!rising) return;
        // the body stays risen: flesh.js's own clock (slower on a slow frame) must not pull its front back
        if (rising.done) { rising.u.uFront.value = rising.u.uFrontEnd.value; return; }
        // deep-swap: on a wall clock, so a slow frame rate (or a hidden tab) still rises in its time
        const wall = (performance.now() - rising.t0) / 1000;
        rising.t = Math.max(rising.t + dt, wall);
        const u = rising.u;
        const want = u.uFrontEnd.value * ease(clamp01(rising.t / rising.dur));
        if (want > u.uFront.value) u.uFront.value = want;
        const front = u.uFront.value;
        rising.frontY = S.HOUSE.y0 + front;
        backU.uRiseY.value = rising.frontY;
        rising.lift = Math.max(0, rising.frontY - 1.1 - (-2.0));
        shake = rising.burst < 0 ? Math.min(1, 0.25 + rising.t * 0.1) : Math.max(0, shake - dt * 0.6);
        camTarget = Math.min(limits().max, rising.frontY - 0.12 * viewH());
        if (rising.burst < 0 && rising.frontY >= surface - 0.1) {
            rising.burst = 0;
            rising.burstAt = wall;
            debris.visible = true;
            const r = mulberry32(31);
            for (let i = 0; i < MAX_DEBRIS; i++) {
                debrisPos[i * 3] = (r() - 0.5) * 3.4;
                debrisPos[i * 3 + 1] = surface + r() * 0.3;
                debrisPos[i * 3 + 2] = 0;
                const a = Math.PI / 2 + (r() - 0.5) * 2.2;
                const sp = 2 + r() * 6;
                debrisVel[i * 3] = Math.cos(a) * sp; debrisVel[i * 3 + 1] = Math.sin(a) * sp; debrisVel[i * 3 + 2] = 0;
                debrisA[i] = 0.6 + r() * 0.4;
            }
            flash = 0.9;
        }
        if (rising.burst >= 0) {
            rising.burst += dt;
            dawn = Math.min(1, dawn + dt * 0.5);
            for (let i = 0; i < MAX_DEBRIS; i++) {
                debrisVel[i * 3 + 1] -= 9 * dt;
                debrisPos[i * 3] += debrisVel[i * 3] * dt;
                debrisPos[i * 3 + 1] += debrisVel[i * 3 + 1] * dt;
                debrisA[i] = Math.max(0, debrisA[i] - dt * 0.35);
            }
            debrisGeo.attributes.position.needsUpdate = true;
            debrisGeo.attributes.aA.needsUpdate = true;
            if (rising.burst > 2.2 || wall - rising.burstAt > 2.4) finishRise();
        }
    }

    /* ------------------------------------------------ input: scroll and drag, clicks */
    let press = null;
    const cv = renderer.domElement;
    function tookHold() {
        homeMode = false;
        if (touched) return;
        touched = true;
        opts.onInteract?.();
    }
    function onWheel(e) {
        if (rising) return;
        e.preventDefault();
        tookHold();
        const l = limits();
        // a sideways swipe (or shift and the wheel) pans along the floors when they are wider than the screen
        const dx = e.shiftKey && !e.deltaX ? e.deltaY : e.deltaX;
        if (Math.abs(dx) > Math.abs(e.deltaY) || e.shiftKey) {
            panTarget = Math.max(-panMax, Math.min(panMax, panTarget + dx / ppu * 0.8));
            return;
        }
        camTarget = Math.max(l.min, Math.min(l.max, camTarget - e.deltaY / ppu * 0.8));
    }
    function onDown(e) {
        if (e.button !== 0) return;
        press = { x: e.clientX, y: e.clientY, cam: camTarget, pan: panTarget, drag: false, t: performance.now() };
    }
    let hoverOut = '';
    function onMove(e) {
        toWorld(e.clientX, e.clientY, wp);
        const onCanvas = e.target === cv;
        const id = onCanvas ? idAtWorld(wp.x, wp.y) : '';
        const h = id && reachSet.includes(id) ? id : '';
        if (h !== hoverId) { hoverId = h; paintReach(); }
        if (candSectors) {
            const slot = slotOf(id);
            const k = slot >= 0 ? sectorOf(slot) : -1;
            if (k !== candHover) { candHover = k; paintCandidates(); }
        }
        cv.style.cursor = h ? 'pointer' : '';
        // deep-swap: what is under the cursor, for the price over a chamber (hooks.onChamberHover)
        if (hovers.size && (id || hoverOut)) { hoverOut = id; for (const cb of hovers) cb(id, e.clientX, e.clientY); }
        if (!press || rising) return;
        const dy = e.clientY - press.y;
        if (!press.drag && Math.abs(dy) > CLICK_PX) { press.drag = true; tookHold(); }
        if (!press.drag && Math.abs(e.clientX - press.x) > CLICK_PX && panMax > 0) { press.drag = true; tookHold(); }
        if (press.drag) {
            const l = limits();
            camTarget = Math.max(l.min, Math.min(l.max, press.cam + dy / ppu));
            camY = camTarget;
            panTarget = Math.max(-panMax, Math.min(panMax, press.pan - (e.clientX - press.x) / ppu));
            panX = panTarget;
        }
    }
    function onUp(e) {
        const p = press;
        press = null;
        if (!p || p.drag || e.button !== 0) return;
        if (Math.hypot(e.clientX - p.x, e.clientY - p.y) > CLICK_PX) return;
        toWorld(e.clientX, e.clientY, wp);
        const id = idAtWorld(wp.x, wp.y);
        if (!id) return;
        const slot = slotOf(id);
        if (slot >= 0 && lastState && (lastState.darkSlots || []).includes(slot)) opts.onClearDark?.(slot);
        for (const cb of clickers) cb(id, { slot, x: e.clientX, y: e.clientY });
    }
    function onLeave() { if (hoverId) { hoverId = ''; paintReach(); } if (hoverOut) { hoverOut = ''; for (const cb of hovers) cb('', 0, 0); } }
    cv.addEventListener('wheel', onWheel, { passive: false });
    cv.addEventListener('pointerdown', onDown);
    cv.addEventListener('pointerleave', onLeave);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);

    /* an older save's sector choice (v1.52.0): the chambers of the sectors it may seal glow amber */
    const cand = makeGlows(48, 0, 1, 31);
    function paintCandidates() {
        let n = 0;
        if (candSectors) {
            for (const c of chambers) {
                if (n >= 48) break;
                const k = sectorOf(c.slot);
                if (!candSectors.includes(k)) continue;
                placeGlow(cand, n++, c.x, c.y + S.CH_H * 0.45, 2.7, 2.0, k === candHover ? 0xe0a24f : 0x8a6a3a, k === candHover ? 1.6 : 0.5);
            }
        }
        glowsDone(cand, n);
    }
    function slotAtWorld(x, y) {
        for (const c of chambers) {
            if (Math.abs(x - c.x) <= S.CH_W / 2 + 0.04 && y >= c.y - 0.05 && y <= c.y + S.CH_H + 0.1) return c.slot;
        }
        return -1;
    }
    function inHouse(x, y) { return x >= S.HOUSE.x0 && x <= S.HOUSE.x1 && y >= S.HOUSE.y0 - 0.05 && y <= S.HOUSE.y1 + 0.1; }
    function idAtWorld(x, y) {
        const slot = slotAtWorld(x, y);
        if (slot >= 0) return `s${slot}`;
        if (inHouse(x, y)) return MACHINE;
        if (Math.abs(x) < 0.55 && y < S.HOUSE.y0 && y > deepestLine() - 0.3) {
            if (y > S.floorLine(0) + 1.3) return 'h0';
            const f = Math.max(0, Math.min(floors - 1, Math.round((S.floorLine(0) + 0.4 - y) / S.FLOOR_PITCH)));
            return `h${f}`;
        }
        return '';
    }
    function hitsWorld(x, y) {
        if (slotAtWorld(x, y) >= 0 || inHouse(x, y)) return true;
        if (Math.abs(x) <= S.SHAFT_W && y <= 0.1 && y >= deepestLine() - 0.1) return true;
        for (let f = 0; f < floors; f++) {
            const fy = S.floorLine(f);
            if (y < fy - 0.08 || y > fy + S.CORRIDOR_H + 0.05) continue;
            let x0 = 0, x1 = 0;
            for (const c of chambers) if (c.floor === f) { x0 = Math.min(x0, c.x); x1 = Math.max(x1, c.x); }
            if (x >= x0 && x <= x1) return true;
        }
        return false;
    }

    /* ------------------------------------------------ the frame */
    function render() {
        if (!postActive()) {
            renderer.setRenderTarget(null);
            renderer.render(scene, camera);
            css2d.render(scene, camera);
            return;
        }
        renderer.setRenderTarget(rtCur);
        renderer.render(scene, camera);
        if (captureGhost) {
            captureGhost = false;
            postQuad.material = copyMat;
            renderer.setRenderTarget(rtGhost);
            renderer.render(postScene, postCam);
            postQuad.material = postMat;
        }
        renderer.setRenderTarget(null);
        renderer.render(postScene, postCam);
        css2d.render(scene, camera);
    }

    function step(dt) {
        if (dead) return;
        dt = Math.min(0.1, Math.max(0, dt || 0));
        time.value += dt;
        if (lastState) syncYears(false);
        // the lamps: dark while they sleep
        lit.value += Math.max(-dt / LIGHT_SECONDS, Math.min(dt / LIGHT_SECONDS, litTarget - lit.value));
        lightU.uAsleep.value = 1 - lit.value;
        backU.uSleep.value = 1 - lit.value;
        backU.uDawn.value = dawn;
        // the camera
        if (focusZoom && time.value > focusUntil) { focusZoom = 0; activeX = null; fit(); }
        ppu += (ppuTarget - ppu) * (1 - Math.exp(-dt * 3));
        shaftPx += (shaftTarget - shaftPx) * (1 - Math.exp(-dt * 5));
        if (homeMode && !rising) camTarget = home();
        // sideways: back to the shaft when everything fits, else keep where things happen in view
        if (rising) panTarget = 0;
        else if (!touched) panTarget = activeX === null ? 0 : S.panToShow(activeX, panTarget, freeHalf(), panMax);
        panTarget = Math.max(-panMax, Math.min(panMax, panTarget));
        panX += (panTarget - panX) * (1 - Math.exp(-dt * 4));
        const l = limits();
        if (!rising) camTarget = Math.max(l.min, Math.min(l.max, camTarget));
        camY += (camTarget - camY) * (1 - Math.exp(-dt * (rising ? 3 : 7)));
        if (!rising) shake = Math.max(0, shake - dt);
        applyCamera();
        // the light: the floor the camera is on, every floor above it; deeper falls to black
        const nearHome = Math.abs(camY - home()) < 0.6;
        let fTarget;
        if (nearHome || rising) fTarget = deepestLine();
        else {
            const yAt = camY - 0.22 * viewH();
            const f = Math.max(0, Math.min(floors - 1, Math.round((S.FLOOR0 + 0.6 - yAt) / S.FLOOR_PITCH)));
            fTarget = S.floorLine(f);
        }
        focusY += (fTarget - focusY) * (1 - Math.exp(-dt * 3.5));
        lightU.uFocusY.value = focusY;
        // people
        if (march) stepMarch(dt);
        else if (!(lastState && lastState.asleep)) for (let i = 0; i < folkN; i++) stepPerson(folk[i], dt);
        writeDots();
        // the lamp game blinks
        if (lampSpec && lampSpec.flash && lampSpec.flash.length) lamps.material.uniforms.uCore.value = 0.6 + 0.6 * (Math.sin(time.value * 9) > 0 ? 1 : 0);
        machine.setTempo(machineTempo, !!(lastState && lastState.asleep));
        machine.step(dt);
        stepFlesh(dt);
        stepGrow(dt);
        stepRise(dt);
        stepGhosts(dt);
        updateLabels(dt);
        render();
    }

    function resize() {
        W = container.clientWidth || window.innerWidth;
        H = container.clientHeight || window.innerHeight;
        dpr = Math.min(window.devicePixelRatio || 1, 2);
        renderer.setPixelRatio(dpr);
        renderer.setSize(W, H);
        css2d.setSize(W, H);
        rtCur.setSize(W * dpr, H * dpr);
        rtGhost.setSize(W * dpr, H * dpr);
        fit();
        ppu = ppuTarget;
        shaftPx = shaftTarget;
        labelsDirty = true;
    }

    const screenOf = (x, y) => {
        const r = cv.getBoundingClientRect();
        return { x: r.left + toScreenX(x), y: r.top + toScreenY(y) };
    };

    return {
        /** Draws this state. Rebuilds the colony's shape only when it changed. */
        setState(state, layout) {
            lastState = state;
            lastLayout = layout || { slots: [] };
            const k = keyOf(state, lastLayout);
            if (k !== structKey) { structKey = k; build(state, lastLayout); }
            paintTiles(state);
            litTarget = state.asleep ? 0 : 1;
            setPeople(state);
            syncYears(false);
        },
        step,
        resize,
        dispose() {
            dead = true;
            cv.removeEventListener('wheel', onWheel);
            cv.removeEventListener('pointerdown', onDown);
            cv.removeEventListener('pointerleave', onLeave);
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', onUp);
            if (handsArms.hands) handsArms.hands.dispose();
            disposeFlesh();
            machine.dispose();
            scene.traverse((o) => {
                if (o.geometry && o.geometry !== quad) o.geometry.dispose();
                const m = o.material;
                if (m && m !== tileMat && m !== ghostMat) (Array.isArray(m) ? m : [m]).forEach((x) => x.dispose?.());
            });
            quad.dispose(); tileMat.dispose(); ghostMat.dispose(); atlasTex.dispose(); env.dispose?.();
            postMat.dispose(); copyMat.dispose(); postQuad.geometry.dispose();
            rtCur.dispose(); rtGhost.dispose();
            renderer.dispose();
            cv.remove();
            if (labelHost) { scene.remove(dig.obj); digEl.remove(); } else css2d.domElement.remove();
            ui.remove();
        },
        resetView() { homeMode = true; touched = false; },
        /** The machine's tempo (machine.js machineTempo) and whether the colony sleeps. */
        setMachine(tempo, asleep = false) {
            machineTempo = { throws: 0, drive: 0, quiet: 1, ...(tempo || {}) };
            machine.setTempo(machineTempo, asleep);
        },
        showMachine(on) { machine.group.visible = !!on; },
        /** How loose the Watcher's mind is, 0 to 1 (watcher.js softness): the picture wavers. */
        setSoftness(k) { softTarget = clamp01(k || 0); },
        /** A click on the base while they sleep: rigid again, a soft flash. */
        snap() { soft = 0; flash = Math.max(flash, 0.5); },
        /** The day they go up (the old ending): a pale sky over the crust. */
        lighten() { dawn = 1; },
        gather(seconds = 1.5) { return startMarch('gather', seconds); },
        release(seconds = 1.2) { return startMarch('release', seconds); },
        ascend(seconds = 2.0) { return startMarch('ascend', seconds); },
        climbAlone(seconds = 4.5) {
            if (!folkN) { folkN = 1; const p = folk[0]; p.x = 0; p.y = personY(0); p.a = 1; p.floor = 0; }
            folkN = 1;
            startMarch('ascend', seconds);
            return new Promise((resolve) => setTimeout(resolve, Math.ceil(seconds * 1000) + 200));
        },
        // the scouts were cut in deep-rebuild; an older save's party comes home without a picture
        scoutsUp() { return 0; },
        scoutsDown() { return 0; },
        /** An older save's sector choice (v1.52.0): the sectors it may seal glow, the hovered one brighter. */
        setCandidates(sectors, hover = -1) {
            candSectors = Array.isArray(sectors) && sectors.length ? sectors.slice() : null;
            candHover = hover;
            paintCandidates();
        },
        /** A sector sealed (an older save): a short flash; the chambers go dark with the state. */
        sealAnim() { flash = Math.max(flash, 0.4); return 0; },
        /* --- deep-swap: what the orchestrator asks of the 3D view, answered here too --- */
        /** The "+" where the next chamber is dug: its price on hover, whether it can be paid, whether it shows. */
        setDigOffer(offer) { dig.offer = { ...dig.offer, ...(offer || {}) }; paintDig(); },
        /** Where that "+" is on the screen, or null (tests). */
        digPlusAt() {
            if (!dig.obj.visible) return null;
            const r = dig.plus.getBoundingClientRect();
            return r.width ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : null;
        },
        /** The chambers that show an order under way (tests; the 3D view answers the same). */
        buildingSlots() {
            const slots = lastLayout.slots || [];
            return (lastState?.builds || []).filter((j) => j.kind === 'room' && j.slot >= 0 && j.slot < slots.length).map((j) => j.slot);
        },
        /** Movement III: no digging, no rooms; the "+" goes. */
        setGrowMode(on) { growMode = !!on; dig.obj.visible = !growMode && dig.at >= 0; fit(); if (lastState) paintTiles(lastState); },
        /** The node under a point of the screen (growth.js id: 's12', 'h1', 'machine'), or ''. */
        chamberAt(clientX, clientY) { toWorld(clientX, clientY, wp); return idAtWorld(wp.x, wp.y); },
        /** Where a node is on the screen (client px), or null when it is off it. */
        screenOfNode(id) {
            idPos(id, wp);
            const p = screenOf(wp.x, wp.y);
            const r = cv.getBoundingClientRect();
            if (p.x < r.left + 4 || p.x > r.right - 4 || p.y < r.top + 4 || p.y > r.bottom - 4) return null;
            return p;
        },
        /** deep-tension: the drawer is open over `px` on the right (0: closed): the colony moves left of it. */
        setInsetRight(px) {
            const next = Math.max(0, (px || 0) - S.RULER_PX);
            if (Math.abs(next - insetRight) < 1) return;
            insetRight = next;
            fit();
        },
        /** The camera eases to the floor of the body's front, unless the player holds it. */
        focusFloor(floor) {
            if (touched) return false;
            homeMode = false;
            if (focusZoom) { focusZoom = 0; fit(); }
            const f = Math.max(0, Math.min(floors - 1, floor | 0));
            camTarget = S.floorLine(f) + 0.18 * viewH();
            return true;
        },
        /** The camera eases to the machine house (the hands), unless the player holds it. */
        focusMachine(seconds = 7) {
            if (touched) return false;
            homeMode = false;
            // closer, for as long as the game holds the look (index.js: seven seconds), then back to the fit
            focusZoom = S.FOCUS_PPU;
            focusUntil = time.value + Math.max(1, seconds);
            fit();
            activeX = 0;
            panTarget = 0;
            camTarget = (S.HOUSE.y0 + S.HOUSE.y1) / 2 + 0.08 * (H / ppuTarget);
            return true;
        },
        /** The rise moves the camera by itself; this only lets go of the player's hold. */
        focusRise() { homeMode = false; return true; },
        /**
         * deep-swap: where the HUD's middle things go (client px): x is the shaft (the colony's middle,
         * not the window's), y the middle of the years over YEAR 0 for the counter while they sleep.
         */
        centre() {
            const r = cv.getBoundingClientRect();
            const y0 = toScreenY(0), top = Math.max(16, toScreenY(surface));
            const y = Math.max(205, Math.min(H * 0.46, (top + y0) / 2, y0 - 205));
            return { x: r.left + toScreenX(0), y: r.top + y };
        },
        /** cb(id, x, y) as the cursor moves over the view: the node under it, or '' (the price tip). */
        onChamberHover(cb) { hovers.add(cb); return () => hovers.delete(cb); },
        /** How fast the machine throws (hooks.step): the hands keep its rhythm. */
        setThrows(n) { handsThrows = Number(n) > 0 ? Number(n) : 0.6; },
        hitsBase(clientX, clientY) { toWorld(clientX, clientY, wp); return hitsWorld(wp.x, wp.y); },
        slotAt(clientX, clientY) { toWorld(clientX, clientY, wp); return slotAtWorld(wp.x, wp.y); },
        machineAt(clientX, clientY) { toWorld(clientX, clientY, wp); return inHouse(wp.x, wp.y); },
        /** Where a chamber's middle is on the screen (client px): the ring opens here. */
        screenOfSlot(slot) {
            const c = chambers[slot];
            if (!c) return null;
            const p = screenOf(c.x, c.y + S.CH_H / 2);
            const r = cv.getBoundingClientRect();
            if (p.x < r.left || p.x > r.right || p.y < r.top || p.y > r.bottom) return null;
            return p;
        },
        screenOfMachine() { return screenOf(0, S.HOUSE.y0 + 1.0); },
        /** Of these chambers, the ones on the screen and in the light. */
        visibleSlots(slots) {
            const top = camY + viewH() / 2, bot = camY - viewH() / 2;
            return (slots || []).filter((s) => {
                const c = chambers[s];
                return c && c.y > bot && c.y + S.CH_H < top && c.y > focusY - 1.2;
            });
        },
        /** The lamp game: `lit` steady, `flash` blinking, `wrong` amber, over the dark; null: none. */
        setLamps(spec) {
            lampSpec = spec || null;
            if (!lampSpec) lamps.material.uniforms.uCore.value = 1.2;
            paintLamps();
        },
        emptySlots() { return emptyShown.slice(); },
        /* --- the view hooks --- */
        emptyAt(clientX, clientY) {
            toWorld(clientX, clientY, wp);
            const slot = slotAtWorld(wp.x, wp.y);
            return slot >= 0 && emptyShown.includes(slot) ? slot : -1;
        },
        showEmpty(slots) { emptyOverride = Array.isArray(slots) ? slots.slice() : null; if (lastState) paintTiles(lastState); },
        hallucinate,
        flickerHallucinations,
        snapClear,
        get hallucinating() {
            return { lamp: lampAt ? (lampAt.slot ?? 'rock') : -1, figure: shown.figure, breathe: shown.breathe ? breatheTile : -1, afterimage: shown.afterimage, wrong: shown.wrong };
        },
        /* --- GROW --- */
        setBody,
        /** deep-organs: the organs in their chambers, the take in progress growing in (see setOrgans). */
        setOrgans,
        /** deep-organs: the heartbeat's phase (0 on the thump): the hearts beat on it. */
        setBeat(phase) { beatPhase = Number.isFinite(phase) ? phase : null; },
        /** deep-organs: about how big a node is on the screen (px, its half height), for the fill ring. */
        nodeRadius(id) { return id === MACHINE ? 1.1 * ppu : slotOf(id) >= 0 ? S.CH_W * 0.46 * ppu : 0.45 * ppu; },
        get organArt() { return [...organArt.entries()].map(([id, r]) => ({ id, organ: r.organ, grow: r.art.grow, necrotic: r.art.necrotic })); },
        onChamberClick(cb) { clickers.add(cb); return () => clickers.delete(cb); },
        setHands,
        rise,
        /** deep-pass4 (B410): THE FINALE. k 0 to 1 (how much of the deepest floor is body once every floor
         *  above it is full): the layers over the colony bow and crack, more with k; `jolt` shakes the view. */
        quake(k, { jolt = false } = {}) {
            quakeK = Math.max(0, Math.min(1, Number(k) || 0));
            if (jolt) shake = Math.max(shake, 0.35 + 0.4 * quakeK);
            backU.uQuake.value = quakeK;
            if (!rising) { backU.uRise.value = quakeK > 0 ? 0.15 + 0.35 * quakeK : 0; backU.uRiseY.value = -0.4; }
        },
        get quakeK() { return quakeK; },
        /** The body as the hooks report it (view-hooks.js bodyStats). */
        get bodyStats() {
            return {
                body: body.size, necrotic: necrotic.size, reach: reachSet.length, hands: handsArms.on,
                handsGrow: handsArms.on ? handsArms.grow : -1, rising: rising ? +rising.t.toFixed(2) : -1,
                broke: !!(rising && rising.burst >= 0), meshes: organs.size, spine: [...body].some((id) => /^h[1-9]/.test(id)),
            };
        },
        /* --- the strata --- */
        /** The years per sleep the view draws (to save with the game, if wanted). */
        get strata() { return history.slice(); },
        set strata(h) { if (Array.isArray(h)) { history = S.compactHistory(h.map(Number)); keptRef = null; applyLayers(); } },
        crustHost: null,
        /** Test hook: what the view believes it draws. */
        get stats() {
            return {
                chambers: chambers.length, floors, tiles: tiles.count, people: folkN, layers: layers.length, surface,
                camY, home: home(), ppu, focusY, lit: lit.value, marching: !!march,
                body: body.size, necrotic: necrotic.size, reachable: reachSet.length, roots: roots.length,
                hands: handsArms.on, rising: rising ? { frontY: rising.frontY, burst: rising.burst, done: !!rising.done } : null,
                post: postActive(), draws: renderer.info.render.calls, triangles: renderer.info.render.triangles,
            };
        },
        /** Test hook: move the camera (units, world y of its middle); null goes home. */
        lookAt(y, zoomPpu) {
            zoomOverride = zoomPpu || 0;
            fit();
            ppu = ppuTarget;
            shaftPx = shaftTarget;
            if (y == null) { homeMode = true; return; }
            homeMode = false; camTarget = y; camY = y;
        },
    };
}

/**
 * The view hooks for the strata view: createViewHooks(view, ...) from view-hooks.js (the room ring,
 * the "+" test) with the kinds this view adds and the GROW calls passed through.
 * Usage: const hooks = extendHooks(createViewHooks(view, { ringHost, isEmpty, onIcons }), view);
 */
export function extendHooks(base, view) {
    const extra = ['afterimage', 'wrong'];
    return {
        emptyAt: (x, y) => view.emptyAt(x, y),
        openRoomRing: (...a) => base.openRoomRing(...a),
        closeRoomRing: () => base.closeRoomRing(),
        get ringSlot() { return base.ringSlot; },
        hallucinate(kind, on) { return extra.includes(kind) ? view.hallucinate(kind, on) : base.hallucinate(kind, on); },
        reapply() { base.reapply(); },
        get showing() { const h = view.hallucinating; return { ...base.showing, afterimage: h.afterimage, wrong: h.wrong }; },
        snapClear() { return Promise.all([base.snapClear(), view.snapClear()]).then(() => undefined); },
        showEmpty: (slots) => view.showEmpty(slots),
        screenOfSlot: (slot) => view.screenOfSlot(slot),
        setBody: (...a) => view.setBody(...a),
        onChamberClick: (cb) => view.onChamberClick(cb),
        // deep-grow2: the marks and the floating words live on the overlay over the view (view-hooks.js)
        markChamber: (id, on, from) => base.markChamber(id, on, from),
        clearMarks: () => base.clearMarks(),
        floatText: (id, text, cls) => base.floatText(id, text, cls),
        callChamber: (id) => base.callChamber(id),
        get marks() { return base.marks; },
        // deep-swap (B294): the rest of the body's contract. The view steps its own flesh in its own
        // step(); the hooks' step hands it the machine's throws, so the hands keep its rhythm
        onChamberHover: (cb) => view.onChamberHover(cb),
        step: (dt, throws) => { view.setThrows(throws); base.stepOverlay(); },
        // deep-organs: the organs are the view's; the ring, the fill ring and the pump's wave the overlay's
        setOrgans: (map, o) => view.setOrgans(map, o),
        setBeat: (phase) => view.setBeat(phase),
        get organArt() { return view.organArt; },
        openOrganRing: (...a) => base.openOrganRing(...a),
        closeOrganRing: () => base.closeOrganRing(),
        get organRingAt() { return base.organRingAt; },
        setTaking: (t) => base.setTaking(t),
        pumpWave: (ids, o) => base.pumpWave(ids, o),
        get waves() { return base.waves; },
        setHands: (on, o) => view.setHands(on, o),
        rise: (cb) => view.rise(cb),
        quake: (k, o) => view.quake?.(k, o),
        get bodyStats() { return view.bodyStats; },
    };
}

let styled = false;
function injectStyle() {
    if (styled || typeof document === 'undefined' || document.getElementById('strata-view-style')) { styled = true; return; }
    styled = true;
    const st = document.createElement('style');
    st.id = 'strata-view-style';
    st.textContent = `
.strata-canvas { display: block; touch-action: none; }
.strata-stars, .strata-ui { position: absolute; inset: 0; pointer-events: none; overflow: hidden; }
.strata-ui { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 10px; letter-spacing: 0.14em; color: #aab8c9; }
.strata-ruler { position: absolute; top: 0; bottom: 0; right: 44px; width: 5px; border-right: 1px solid rgba(213,219,227,0.12);
    background-image: linear-gradient(to bottom, rgba(213,219,227,0.16) 1px, transparent 1px); background-size: 4px 20px; background-repeat: repeat-y; background-position-x: right; }
.strata-label { position: absolute; top: -7px; right: 44px; padding-right: 30px; white-space: nowrap; opacity: 0.72; transition: opacity 0.6s; }
.strata-label::after { content: ''; position: absolute; right: 0; top: 6px; width: 24px; height: 1px; background: rgba(213,219,227,0.5); }
.strata-label.is-zero { color: #d5dbe3; opacity: 0.88; }
.strata-label.is-gone { opacity: 0.12; text-decoration: line-through; }
#phase-deep.is-grow:not(.is-rising) .strata-label, #phase-deep.is-grow .strata-up { visibility: hidden; }
.strata-up { position: absolute; top: 12px; right: 74px; color: #d5dbe3; opacity: 0.85; letter-spacing: 0.2em; white-space: nowrap; }
`;
    document.head.appendChild(st);
}
