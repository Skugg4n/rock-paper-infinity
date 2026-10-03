/**
 * Chapter IV · THE DEEP: the instrument panel (deep-rebuild, movement I · TEND).
 *
 * Four round gauges with needles and a red arc, each labelled on dymo tape (ORE, FOOD, POWER,
 * HANDS); one stamped label under them, the only advice; a small "EMPTY 2" when dug chambers stand
 * empty; before the hall, the lamps of cryo (three conditions and the price); and one alarm lamp that lights on a wake with
 * its word. What the needles read is instruments.js's; this file only draws and moves them.
 *
 * The needles move on a damped spring, a frame at a time (`step(dt)`). The panel's lights go out
 * one by one when the colony lies down and come back the same way.
 */

import { GAUGES, RED_K, GREEN_FROM, GREEN_SPAN, ADVICE_PREFIX, ADVICE_HOLD_MS } from './instruments.js';
import { ORE_GLYPH, signHtml } from './readout.js';

const SVG = 'http://www.w3.org/2000/svg';
const CX = 60, CY = 62, R = 46;
const SWEEP = 270;                      // degrees of the dial, from the left stop to the right
/** The angle of a point on the dial, k from 0 to 1, in degrees from straight up. */
export const angleOf = (k) => -SWEEP / 2 + SWEEP * Math.max(-0.03, Math.min(1.03, k));
const polar = (deg, r) => {
    const a = (deg - 90) * Math.PI / 180;
    return [CX + r * Math.cos(a), CY + r * Math.sin(a)];
};
function arc(k0, k1, r) {
    const [x0, y0] = polar(angleOf(k0), r);
    const [x1, y1] = polar(angleOf(k1), r);
    const large = (k1 - k0) * SWEEP > 180 ? 1 : 0;
    return `M ${x0.toFixed(2)} ${y0.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
}
/** The spring the needles ride on: stiff, a little underdamped, so a swing overshoots and settles. */
export const SPRING = { k: 60, damp: 9 };
/** deep-fix2: HANDS rides a slow, critically damped spring: people come into new beds over days, and
 *  the needle eases up with them, never a jump (Ola: "Nice if it rose more slowly"). */
export const SPRING_SLOW = { k: 5, damp: 2 * Math.sqrt(5) };
/** deep-grow: the panel overgrows over this long, in stages (ms): veins, the tapes peel, the names, the fluid. */
export const OVERGROW_MS = 10000;
export const OG_STAGES = [0, 3200, 5200, 6800];
/** One step of a damped spring toward `target`. Pure. */
export function springStep(x, v, target, dt, spring = SPRING) {
    const a = spring.k * (target - x) - spring.damp * v;
    const v2 = v + a * dt;
    return { x: x + v2 * dt, v: v2 };
}

/** A strip of dymo tape: white raised letters on black. */
export function dymo(text = '', cls = '') {
    const el = document.createElement('span');
    el.className = `dymo ${cls}`.trim();
    el.textContent = text;
    return el;
}

function gaugeSvg(id) {
    const svg = document.createElementNS(SVG, 'svg');
    svg.setAttribute('viewBox', '0 0 120 120');
    svg.setAttribute('class', 'deep-gauge-svg');
    let ticks = '';
    for (let i = 0; i <= 20; i++) {
        const k = i / 20;
        const major = i % 5 === 0;
        const [x0, y0] = polar(angleOf(k), R - (major ? 9 : 5));
        const [x1, y1] = polar(angleOf(k), R - 1);
        ticks += `<line x1="${x0.toFixed(2)}" y1="${y0.toFixed(2)}" x2="${x1.toFixed(2)}" y2="${y1.toFixed(2)}" class="${major ? 'tk tk-major' : 'tk'}"/>`;
    }
    svg.innerHTML = `
        <defs>
            <radialGradient id="face-${id}" cx="50%" cy="42%" r="62%">
                <stop offset="0%" stop-color="#1b222c"/><stop offset="100%" stop-color="#0a0e13"/>
            </radialGradient>
            <linearGradient id="glass-${id}" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="#ffffff" stop-opacity="0.16"/><stop offset="55%" stop-color="#ffffff" stop-opacity="0"/>
            </linearGradient>
        </defs>
        <circle cx="${CX}" cy="${CY}" r="${R + 9}" class="bezel"/>
        <circle cx="${CX}" cy="${CY}" r="${R + 4}" class="bezel-in"/>
        <circle cx="${CX}" cy="${CY}" r="${R + 2}" fill="url(#face-${id})" class="face"/>
        <clipPath id="glass-clip-${id}"><circle cx="${CX}" cy="${CY}" r="${R + 1.5}"/></clipPath>
        <g class="fluid" clip-path="url(#glass-clip-${id})"><path class="fluid-body" d=""/><path class="fluid-top" d=""/></g>
        <path d="${arc(0, RED_K, R - 4)}" class="arc-red"/>
        <path d="${arc(GREEN_FROM, GREEN_FROM + GREEN_SPAN + 0.02, R - 4)}" class="arc-green"/>
        ${ticks}
        <g class="needle"><path d="M ${CX - 1.6} ${CY + 9} L ${CX - 0.7} ${CY - R + 6} L ${CX + 0.7} ${CY - R + 6} L ${CX + 1.6} ${CY + 9} Z" class="needle-body"/></g>
        <circle cx="${CX}" cy="${CY}" r="5" class="cap"/>
        <circle cx="${CX}" cy="${CY}" r="1.6" class="cap-dot"/>
        <ellipse cx="${CX}" cy="${CY - 16}" rx="${R - 6}" ry="${R - 22}" fill="url(#glass-${id})" class="glass"/>
        <g class="veins" clip-path="url(#glass-clip-${id})">${veinPaths(id)}</g>`;
    return svg;
}

/* deep-grow: THE PANEL OVERGROWS. A vein crosses each gauge's glass (drawn once, hidden until the
   question is answered), branching, never mirrored: a seeded walk from the bezel inward. */
function veinPaths(id) {
    let seed = [...String(id)].reduce((a, c) => a * 31 + c.charCodeAt(0), 11) >>> 0;
    const r = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    const out = [];
    const walk = (x, y, a, len, w, depth) => {
        let d = `M ${x.toFixed(1)} ${y.toFixed(1)}`;
        const n = 6;
        for (let i = 0; i < n; i++) {
            a += (r() - 0.5) * 0.9;
            const step = len / n;
            const cx = x + Math.cos(a) * step * 0.6 + (r() - 0.5) * 4, cy = y + Math.sin(a) * step * 0.6 + (r() - 0.5) * 4;
            x += Math.cos(a) * step; y += Math.sin(a) * step;
            d += ` Q ${cx.toFixed(1)} ${cy.toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)}`;
            if (depth < 2 && r() < 0.35) walk(x, y, a + (r() < 0.5 ? 0.9 : -0.9), len * 0.45, w * 0.55, depth + 1);
        }
        out.push(`<path class="vein is-d${depth}" d="${d}" style="stroke-width:${w.toFixed(2)}"/>`);
    };
    const a0 = r() * Math.PI * 2;
    walk(CX + Math.cos(a0) * (R + 6), CY + Math.sin(a0) * (R + 6), a0 + Math.PI + (r() - 0.5) * 0.7, R * 2.1, 2.6, 0);
    const a1 = a0 + 2 + r() * 1.5;
    walk(CX + Math.cos(a1) * (R + 6), CY + Math.sin(a1) * (R + 6), a1 + Math.PI + (r() - 0.5) * 0.9, R * 1.3, 1.6, 1);
    return out.join('');
}
/** The fluid in a gauge's glass at level k (0 to 1), its surface a slow wave. */
function fluidPaths(k, t, phase) {
    const top = CY + R + 1.5 - 2 * (R + 1.5) * Math.max(0, Math.min(1, k));
    const x0 = CX - R - 4, x1 = CX + R + 4;
    let wave = `M ${x0} ${top.toFixed(2)}`;
    for (let i = 1; i <= 8; i++) {
        const x = x0 + (x1 - x0) * i / 8;
        const y = top + Math.sin(t * 1.3 + phase + i * 0.9) * 1.4;
        wave += ` L ${x.toFixed(1)} ${y.toFixed(2)}`;
    }
    return { body: `${wave} L ${x1} ${CY + R + 6} L ${x0} ${CY + R + 6} Z`, top: wave };
}

/**
 * Builds the panel's gauges, lamps and labels into the elements of index.html's chapter IV markup.
 * @param {object} els - { gauges, advice, empty, lamps, alarm, alarmWord, root }
 * @returns {object} the panel's handful of calls
 */
export function createPanel(els) {
    const g = {};
    els.gauges.textContent = '';
    for (const { c, label } of GAUGES) {
        const cell = document.createElement('div');
        cell.className = 'deep-gauge deep-light';
        cell.dataset.col = c;
        const svg = gaugeSvg(c);
        cell.appendChild(svg);
        const tape = dymo(label, 'is-gauge');
        // deep-fix2: the word ORE stands beside the pickaxe that every amount of ore carries
        const holder = document.createElement('span');
        holder.className = 'deep-gauge-tapes';
        if (c === 'M') {
            const row = document.createElement('span');
            row.className = 'deep-gauge-label';
            row.innerHTML = ORE_GLYPH;
            row.appendChild(tape);
            holder.appendChild(row);
        } else holder.appendChild(tape);
        // deep-grow: the organ's name, in a warmer hand, waits under the tape until it peels
        const flesh = document.createElement('span');
        flesh.className = 'flesh-tape';
        holder.appendChild(flesh);
        // deep-grow2: a count the gauge carries (FEED: the people), in the counter's own format
        const num = document.createElement('span');
        num.className = 'deep-gauge-num deep-mono';
        num.hidden = true;
        holder.appendChild(num);
        cell.appendChild(holder);
        els.gauges.appendChild(cell);
        g[c] = {
            cell, needle: svg.querySelector('.needle'), x: 0, v: 0, target: 0, red: false, twitch: 0, spring: c === 'H' ? SPRING_SLOW : SPRING,
            flesh, num, fluidBody: svg.querySelector('.fluid-body'), fluidTop: svg.querySelector('.fluid-top'), phase: Math.random() * 6,
        };
    }
    // the three lamps of cryo, built once; their words are fixed
    let lampEls = [];
    function buildLamps(list) {
        els.lamps.textContent = '';
        lampEls = list.map((L) => {
            const cell = document.createElement('div');
            // deep-fix2: the fourth lamp is the price, its tape the stars it costs
            cell.className = `deep-cryo-lamp deep-light${L.price ? ' is-price' : ''}`;
            cell.dataset.lamp = L.key;
            const bulb = document.createElement('span');
            bulb.className = 'deep-bulb';
            cell.appendChild(bulb);
            cell.appendChild(dymo(L.label, 'is-small'));
            els.lamps.appendChild(cell);
            return { key: L.key, label: L.label, cell };
        });
    }
    const advice = { word: '', at: 0, want: '' };
    let alarmOn = false;
    let fleshK = 0;                 // deep-grow: 0 needles, 1 fluid (the gauges overgrown)
    let clock = 0;
    let ogTimers = [];
    let og = 'off';                 // 'off' | 'growing' | 'done'

    return {
        /**
         * @param {object} view
         * @param {Object<string,{k:number, red:boolean}>} view.gauges
         * @param {string} view.advice - the word, without the prefix ('' for none)
         * @param {number} view.empty - chambers dug and empty
         * @param {{key:string,label:string,lit:boolean,ordered:boolean}[]|null} view.lamps - null: none
         */
        update({ gauges, advice: want = '', empty = 0, lamps = null }) {
            for (const { c } of GAUGES) {
                const x = gauges && gauges[c];
                if (!x) continue;
                g[c].target = x.k;
                if (g[c].red !== x.red) { g[c].red = x.red; g[c].cell.classList.toggle('is-red', x.red); }
                const num = x.num || '';
                if (g[c].num.dataset.text !== num) { g[c].num.dataset.text = num; g[c].num.innerHTML = signHtml(num); g[c].num.hidden = !num; }
            }
            // the stamped word changes rarely: it holds ADVICE_HOLD_MS before the next may replace it
            const now = performance.now();
            advice.want = want;
            if (want !== advice.word && (!advice.word || now - advice.at >= ADVICE_HOLD_MS)) {
                advice.word = want;
                advice.at = now;
                const text = want ? `${ADVICE_PREFIX}${want}` : '';
                if (els.advice.textContent !== text) {
                    els.advice.textContent = text;
                    els.advice.classList.remove('is-new');
                    void els.advice.offsetWidth;
                    if (text) els.advice.classList.add('is-new');
                }
                els.advice.hidden = !text;
            }
            const em = empty > 0 ? `EMPTY ${empty}` : '';
            if (els.empty.textContent !== em) els.empty.textContent = em;
            els.empty.hidden = !em;
            // the lamps: only before the hall
            if (lamps) {
                if (lampEls.length !== lamps.length || lampEls.some((l, i) => l.key !== lamps[i].key || l.label !== lamps[i].label)) buildLamps(lamps);
                lamps.forEach((L, i) => {
                    lampEls[i].cell.classList.toggle('is-lit', L.lit);
                    lampEls[i].cell.classList.toggle('is-ordered', !L.lit && L.ordered);
                });
            }
            els.lamps.hidden = !lamps;
        },
        /** The advice as it reads now (tests). */
        get advice() { return advice.word; },
        /** One frame: the needles ride their springs; a twitching needle points somewhere false. */
        step(dt) {
            const d = Math.min(0.05, Math.max(0, dt));
            for (const { c } of GAUGES) {
                const n = g[c];
                const target = n.twitch > 0 ? n.twitchTo : n.target;
                if (n.twitch > 0) n.twitch -= d;
                const s = springStep(n.x, n.v, target, d, n.twitch > 0 ? SPRING : n.spring);
                n.x = s.x; n.v = s.v;
                n.needle.setAttribute('transform', `rotate(${angleOf(n.x).toFixed(2)} ${CX} ${CY})`);
                // deep-grow: overgrown, the needle's reading is a fluid level in the glass
                if (fleshK > 0) {
                    // the level never fills the whole glass: an empty store sits at the bottom, a full one under the cap
                    const f = fluidPaths((0.08 + 0.72 * Math.max(0, Math.min(1, n.x))) * fleshK, clock, n.phase);
                    n.fluidBody.setAttribute('d', f.body);
                    n.fluidTop.setAttribute('d', f.top);
                }
            }
            clock += d;
            if (og === 'growing' && fleshK < 1 && els.root.classList.contains('og-4')) fleshK = Math.min(1, fleshK + d / 2.5);
        },
        /**
         * deep-grow: THE PANEL OVERGROWS over OVERGROW_MS: a vein crosses each gauge's glass, the dymo
         * labels peel and the organ names come in a warmer hand, the needles sink into fluid levels.
         * @param {Object<string,string>} labels - the organ names by column ({ M: 'MASS', ... })
         * @param {{instant?:boolean}} [o] - a reload: overgrown already
         * @returns {Promise<void>} when it is done
         */
        overgrow(labels, { instant = false } = {}) {
            for (const { c } of GAUGES) g[c].flesh.textContent = labels[c] || '';
            for (const t of ogTimers) clearTimeout(t);
            ogTimers = [];
            const root = els.root;
            if (instant) {
                root.classList.add('is-flesh', 'og-1', 'og-2', 'og-3', 'og-4');
                og = 'done';
                fleshK = 1;
                return Promise.resolve();
            }
            og = 'growing';
            root.classList.add('is-overgrowing');
            const at = (ms, fn) => ogTimers.push(setTimeout(fn, ms));
            at(30, () => root.classList.add('og-1'));                   // the veins cross the glass
            at(OG_STAGES[1], () => root.classList.add('og-2'));         // the tapes peel
            at(OG_STAGES[2], () => root.classList.add('og-3'));         // the organ names come
            at(OG_STAGES[3], () => root.classList.add('og-4'));         // the needles sink, the fluid rises
            return new Promise((resolve) => at(OVERGROW_MS, () => {
                root.classList.remove('is-overgrowing');
                root.classList.add('is-flesh');
                og = 'done';
                fleshK = 1;
                resolve();
            }));
        },
        /** The labels the gauges show now (tests): the organ names once they have come. */
        get labels() {
            const flesh = els.root.classList.contains('og-3');
            return GAUGES.map(({ c }) => (flesh ? g[c].flesh.textContent : g[c].cell.querySelector('.dymo').textContent));
        },
        get overgrown() { return og; },
        /** Where a needle points now (0 to 1), for the tests. */
        needle(c) { return g[c] ? g[c].x : null; },
        /** The madness: one needle swings to a wrong value for a moment. */
        twitch() {
            const cs = GAUGES.map((x) => x.c);
            const c = cs[Math.floor(Math.random() * cs.length)];
            g[c].twitch = 0.35 + Math.random() * 0.3;
            g[c].twitchTo = Math.random() < 0.5 ? Math.random() * RED_K : 0.5 + Math.random() * 0.45;
            return c;
        },
        /** Put every needle where it should be at once (a reload, a jump). */
        settle() { for (const { c } of GAUGES) { g[c].x = g[c].target; g[c].v = 0; } },
        /**
         * The alarm lamp: lit with its word, or dark.
         * @param {string} word - '' puts it out
         */
        alarm(word) {
            alarmOn = !!word;
            els.alarm.classList.toggle('is-lit', alarmOn);
            els.alarmWord.textContent = word || '';
            els.alarmWord.hidden = !word;
        },
        get alarmWord() { return alarmOn ? els.alarmWord.textContent : ''; },
        /**
         * The lights go out one by one (or come back), over `ms`.
         * @param {boolean} on
         * @param {number} [ms]
         * @returns {Promise<void>}
         */
        lights(on, ms = 800) {
            const list = [...els.root.querySelectorAll('.deep-light')];
            const order = on ? list : list.slice().reverse();
            const step = list.length ? ms / list.length : 0;
            return new Promise((resolve) => {
                order.forEach((el, i) => setTimeout(() => el.classList.toggle('is-off', !on), Math.round(step * i)));
                setTimeout(resolve, ms + 20);
            });
        },
        /** Lights straight on or off, without the sequence (a reload asleep). */
        lightsNow(on) { for (const el of els.root.querySelectorAll('.deep-light')) el.classList.toggle('is-off', !on); },
    };
}
