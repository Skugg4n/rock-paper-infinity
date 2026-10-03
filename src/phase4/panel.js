/**
 * Chapter IV · THE DEEP: the instrument panel (deep-rebuild, movement I · TEND).
 *
 * Four round gauges with needles and a red arc, each labelled on dymo tape (ORE, FOOD, POWER,
 * HANDS); one stamped label under them, the only advice; a small "EMPTY 2" when dug chambers stand
 * empty; before the hall, the three lamps of cryo; and one alarm lamp that lights on a wake with
 * its word. What the needles read is instruments.js's; this file only draws and moves them.
 *
 * The needles move on a damped spring, a frame at a time (`step(dt)`). The panel's lights go out
 * one by one when the colony lies down and come back the same way.
 */

import { GAUGES, RED_K, GREEN_FROM, GREEN_SPAN, ADVICE_PREFIX, ADVICE_HOLD_MS } from './instruments.js';

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
/** One step of a damped spring toward `target`. Pure. */
export function springStep(x, v, target, dt) {
    const a = SPRING.k * (target - x) - SPRING.damp * v;
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
        <path d="${arc(0, RED_K, R - 4)}" class="arc-red"/>
        <path d="${arc(GREEN_FROM, GREEN_FROM + GREEN_SPAN + 0.02, R - 4)}" class="arc-green"/>
        ${ticks}
        <g class="needle"><path d="M ${CX - 1.6} ${CY + 9} L ${CX - 0.7} ${CY - R + 6} L ${CX + 0.7} ${CY - R + 6} L ${CX + 1.6} ${CY + 9} Z" class="needle-body"/></g>
        <circle cx="${CX}" cy="${CY}" r="5" class="cap"/>
        <circle cx="${CX}" cy="${CY}" r="1.6" class="cap-dot"/>
        <ellipse cx="${CX}" cy="${CY - 16}" rx="${R - 6}" ry="${R - 22}" fill="url(#glass-${id})" class="glass"/>`;
    return svg;
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
        cell.appendChild(dymo(label, 'is-gauge'));
        els.gauges.appendChild(cell);
        g[c] = { cell, needle: svg.querySelector('.needle'), x: 0, v: 0, target: 0, red: false, twitch: 0 };
    }
    // the three lamps of cryo, built once; their words are fixed
    let lampEls = [];
    function buildLamps(list) {
        els.lamps.textContent = '';
        lampEls = list.map((L) => {
            const cell = document.createElement('div');
            cell.className = 'deep-cryo-lamp deep-light';
            cell.dataset.lamp = L.key;
            const bulb = document.createElement('span');
            bulb.className = 'deep-bulb';
            cell.appendChild(bulb);
            cell.appendChild(dymo(L.label, 'is-small'));
            els.lamps.appendChild(cell);
            return { key: L.key, cell };
        });
    }
    const advice = { word: '', at: 0, want: '' };
    let alarmOn = false;

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
                if (lampEls.length !== lamps.length || lampEls.some((l, i) => l.key !== lamps[i].key)) buildLamps(lamps);
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
                const s = springStep(n.x, n.v, target, d);
                n.x = s.x; n.v = s.v;
                n.needle.setAttribute('transform', `rotate(${angleOf(n.x).toFixed(2)} ${CX} ${CY})`);
            }
        },
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
