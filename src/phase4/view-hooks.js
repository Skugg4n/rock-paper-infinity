/**
 * Chapter IV · THE DEEP: what the colony view must answer to (deep-rebuild).
 *
 * Ola, 2026-10-03: the 3D colony may be replaced after a mockup round. The panel, the drawer, the
 * lever and the night are HUD and do not care what draws the colony. What lives IN the view goes
 * through this small set of hooks, so another view can implement the same calls later:
 *
 *   emptyAt(x, y)                   the empty chamber under a point of the screen, or -1
 *   openRoomRing(slot, x, y, opts)  the ring of four rooms around the cursor, over an empty chamber
 *   closeRoomRing()
 *   hallucinate(kind, on)           'lamp' | 'figure' | 'breathe' (the scene's), 'twitch' is the HUD's
 *   snapClear()                     every false thing goes, with a short flicker
 *
 * The room ring itself is drawn here, in the DOM, over whatever view is below it. The 3D
 * implementation calls into scene.js.
 */

import { ROOM_ICON } from './scene.js';
import { signHtml } from './readout.js';

const ROOM_ORDER = ['mine', 'farm', 'generator', 'dorm'];
const ROOM_NAME = { mine: 'MINE', farm: 'FARM', generator: 'GENERATOR', dorm: 'DORMITORY' };
/** The ring's radius around the cursor, in pixels. */
export const RING_R = 58;

/**
 * @param {object|null} scene - scene.js's createScene(), or null without WebGL
 * @param {object} opts
 * @param {HTMLElement} opts.ringHost - an element over the view for the ring (index.html #deep-ring)
 * @param {(slot:number)=>boolean} opts.isEmpty - is this chamber dug, empty and unclaimed?
 * @param {()=>void} [opts.onIcons] - draw the ring's glyphs
 * @returns {object}
 */
export function createViewHooks(scene, { ringHost, isEmpty, onIcons }) {
    let ring = null;            // { slot, pick }
    const shown = { lamp: false, figure: false, breathe: false };

    function closeRoomRing() {
        if (!ring) return;
        ring = null;
        ringHost.classList.remove('is-open');
        ringHost.hidden = true;
        ringHost.textContent = '';
    }

    return {
        /** The empty chamber under this point, or -1. */
        emptyAt(x, y) {
            if (!scene) return -1;
            const slot = scene.slotAt(x, y);
            return slot >= 0 && isEmpty(slot) ? slot : -1;
        },
        /**
         * The ring of four rooms around the cursor, with their prices: bright when they can be paid,
         * dim when not (the amount missing shows in the ring's middle on hover).
         * @param {number} slot
         * @param {number} x - client pixels
         * @param {number} y
         * @param {object} o
         * @param {Object<string,{price:string, ok:boolean, need:string}>} o.rooms
         * @param {(type:string)=>void} o.onPick
         */
        openRoomRing(slot, x, y, { rooms, onPick }) {
            closeRoomRing();
            ring = { slot };
            const mx = Math.max(RING_R + 40, Math.min(window.innerWidth - RING_R - 40, x));
            const my = Math.max(RING_R + 40, Math.min(window.innerHeight - RING_R - 50, y));
            ringHost.style.left = `${mx}px`;
            ringHost.style.top = `${my}px`;
            ringHost.innerHTML = '<span class="deep-ring-hub"><span class="dymo is-small deep-ring-say"></span></span>';
            const say = ringHost.querySelector('.deep-ring-say');
            say.hidden = true;
            ROOM_ORDER.forEach((t, i) => {
                const r = rooms[t];
                const a = -Math.PI / 2 + i * Math.PI / 2 - Math.PI / 4;
                const b = document.createElement('button');
                b.type = 'button';
                b.className = `deep-ring-room${r.ok ? ' is-ok' : ''}`;
                b.dataset.room = t;
                b.style.left = `${(RING_R * Math.cos(a)).toFixed(1)}px`;
                b.style.top = `${(RING_R * Math.sin(a)).toFixed(1)}px`;
                b.innerHTML = `<i data-lucide="${ROOM_ICON[t]}" class="w-6 h-6"></i><span class="deep-ring-price deep-mono">${signHtml(r.price)}</span>`;
                b.addEventListener('pointerenter', () => { say.innerHTML = signHtml(r.ok ? ROOM_NAME[t] : r.need); say.hidden = false; });
                b.addEventListener('pointerleave', () => { say.hidden = true; });
                b.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (!r.ok) {
                        b.classList.remove('is-no');
                        void b.offsetWidth;
                        b.classList.add('is-no');
                        return;
                    }
                    closeRoomRing();
                    onPick(t);
                });
                ringHost.appendChild(b);
            });
            ringHost.hidden = false;
            void ringHost.offsetWidth;
            ringHost.classList.add('is-open');
            onIcons?.();
        },
        closeRoomRing,
        get ringSlot() { return ring ? ring.slot : -1; },
        /** Bring a kind of hallucination on or off. 'twitch' is the HUD's own and is ignored here. */
        hallucinate(kind, on) {
            if (!(kind in shown)) return false;
            shown[kind] = !!on;
            return scene ? scene.hallucinate(kind, on) : false;
        },
        /** After the view was rebuilt (a chamber dug, a room landed): draw what shows again. */
        reapply() { if (scene) for (const k of Object.keys(shown)) if (shown[k]) scene.hallucinate(k, true); },
        /** What shows now. */
        get showing() { return { ...shown }; },
        /**
         * The snap: a short flicker, and every false thing goes.
         * @returns {Promise<void>}
         */
        snapClear() {
            const any = Object.values(shown).some(Boolean);
            if (!scene || !any) { for (const k of Object.keys(shown)) shown[k] = false; return Promise.resolve(); }
            const steps = [true, false, true, false];
            return new Promise((resolve) => {
                steps.forEach((on, i) => setTimeout(() => scene.flickerHallucinations(on), i * 60));
                setTimeout(() => {
                    scene.flickerHallucinations(false);
                    for (const k of Object.keys(shown)) { shown[k] = false; scene.hallucinate(k, false); }
                    resolve();
                }, steps.length * 60 + 30);
            });
        },
    };
}
