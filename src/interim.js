/**
 * INTERIM (v1.90.0): the short scene between chapter III and chapter IV. As the Earth fails the
 * path forks: in one reality a drone (the dig, src/phase4d), in the other a vault (src/phase4v).
 * Destiny points at one; the player may accept (Continue) or oppose it with one match of rock
 * paper scissors. The act that comes out of it is written under DEEP_VERSION_KEY and the caller
 * starts chapter IV.
 *
 * The screen is a CRT in the vault's palette, built from JS on document.body (style-interim.css).
 * The pure parts (the script, the pointing, the match rules, the version written) are exported and
 * tested; startInterim() is the DOM. Timings are window.rpiInterim.steps (seconds since the start).
 */
import { audio } from './audio.js';
import { DEEP_VERSION_KEY } from './deepVersion.js';

// ---------------------------------------------------------------- pure rules (tested)

/** The two realities and the chapter IV each one is. Never 'colony'. */
export const ACTS = ['drone', 'vault'];
export const VERSION_OF = { drone: 'dig', vault: 'vault' };
export const OTHER = { drone: 'vault', vault: 'drone' };

export const TYPE_MS = 28;      // a letter
export const SPACE_MS = 45;     // a space
export const POINT_MS = 2400;   // Destiny's needle, back and forth until it settles
export const FADE_MS = 1500;    // the fade to black before chapter IV
export const AFTER_MS = 1200;   // the last line rests this long before the fade

export const letterDelay = (ch) => (ch === ' ' ? SPACE_MS : TYPE_MS);
export const ERASE_MS = 22;     // a letter struck out (the quick backspace after a win)

/**
 * The opening, as steps: `line` starts a new line (its id), `type` writes, `pause` rests (ms),
 * `icon` shows a reality's icon beside the line, `point` is Destiny's needle, `choice` the controls.
 */
export function openingScript(pointed) {
    return [
        { line: 'fork' },
        { type: 'As the Earth fails' }, { pause: 900 },
        { type: ' there is a divergence in the path of destiny' }, { pause: 900 },
        { type: ' and a choice has to be made.' }, { pause: 1400 },
        { line: 'drone', gap: true }, { type: 'In one reality there was a drone.' }, { icon: 'drone' }, { pause: 900 },
        { line: 'vault' }, { type: 'In the other, a vault.' }, { icon: 'vault' }, { pause: 1400 },
        { line: 'point', gap: true }, { type: 'Destiny points to ' }, { point: pointed }, { type: `the ${pointed}.` }, { pause: 1000 },
        { line: 'oppose' }, { type: 'But you may choose to oppose.' }, { choice: true },
    ];
}

/** What the screen says, line by line (the typed text of a script). */
export function scriptLines(script) {
    const lines = [];
    for (const s of script) {
        if (s.line) lines.push('');
        else if (s.type) lines[lines.length - 1] += s.type;
    }
    return lines;
}

/** Where Destiny points: 50/50. */
export const pointAt = (rng = Math.random) => (rng() < 0.5 ? 'drone' : 'vault');

/**
 * The needle's flicks: back and forth, slowing, for about `total` ms, ending on `target`.
 * Each flick is { at (ms from the start), lit }. Reduced motion: one flick, at once.
 */
export function pointFlicks(target, total = POINT_MS, reduced = false) {
    if (reduced) return [{ at: 0, lit: target }];
    const gaps = [];
    let d = 55, sum = 0;
    while (sum + d < total) { gaps.push(d); sum += d; d *= 1.17; }
    gaps.push(total - sum);
    const n = gaps.length;
    const out = [];
    let at = 0;
    for (let i = 0; i < n; i++) {
        out.push({ at: Math.round(at), lit: (n - 1 - i) % 2 === 0 ? target : OTHER[target] });
        at += gaps[i];
    }
    return out;
}

/** Rock paper scissors. */
export const HANDS = ['rock', 'paper', 'scissors'];
export const BEATS = { rock: 'scissors', paper: 'rock', scissors: 'paper' };
export const HAND_ICONS = { rock: 'Gem', paper: 'FileText', scissors: 'Scissors' };   // chapter I's glyphs
export const destinyHand = (rng = Math.random) => HANDS[Math.min(2, Math.floor(rng() * 3))];
export function matchResult(you, destiny) {
    if (you === destiny) return 'draw';
    return BEATS[you] === destiny ? 'win' : 'lose';
}
/** The act after a decisive round: a win turns the path, a loss keeps the pointed one; a draw is null (again). */
export function actAfter(pointed, result) {
    if (result === 'win') return OTHER[pointed];
    if (result === 'lose') return pointed;
    return null;
}
/** What the round says. */
export const SAY = { draw: 'Again.', win: 'You win. The path turns.', lose: 'Destiny holds.', accept: 'So be it.' };

/**
 * B453 (v1.90.1): after a win the line "Destiny points to the drone." would still name the act
 * Destiny pointed at. Its act word is struck out (`erase` letters, a quick backspace) and the other
 * typed in its place. `pointed` is the word on the line, `act` the one the path turned to.
 */
export function retypeAct(pointed, act) {
    return { erase: `${pointed}.`.length, type: `${act}.` };
}
/** The line after a retype (what the screen says then). */
export const afterRetype = (line, r) => line.slice(0, line.length - r.erase) + r.type;

/** The body class while the screen is up: the ☰, pause and version label step aside (B452). */
export const BODY_CLASS = 'interim-up';

/** Writes the chosen chapter IV under DEEP_VERSION_KEY; returns the version ('vault' or 'dig'). */
export function writeChoice(act, storage) {
    const version = VERSION_OF[act];
    if (!version) throw new Error(`interim: no act "${act}"`);
    try { storage?.setItem(DEEP_VERSION_KEY, version); } catch { /* the choice still holds for this load */ }
    return version;
}

// ---------------------------------------------------------------- the screen

/** A seeded rng for testing (null = Math.random): window.rpiInterim.setRng(() => 0.1). */
let _rng = null;
export function setInterimRng(fn) { _rng = typeof fn === 'function' ? fn : null; }
const rand = () => (_rng || Math.random)();

let _active = null;

const REDUCED = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const paused = () => typeof window !== 'undefined' && !!window.__rpiPaused;

function icon(names) {
    const L = globalThis.lucide;
    for (const n of names) {
        const data = L?.icons?.[n];
        if (data && typeof L.createElement === 'function') {
            const svg = L.createElement(data);
            svg.setAttribute('width', '100%'); svg.setAttribute('height', '100%');
            svg.setAttribute('aria-hidden', 'true');
            return svg;
        }
    }
    return document.createTextNode('');
}
const ACT_ICONS = { drone: ['Drone', 'Bot'], vault: ['Vault', 'Archive'] };

function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
}

/**
 * Builds the screen and plays it.
 * @param {object} opts
 * @param {boolean} [opts.under=false] - mount under the chapter card (it lifts onto it); call lift() to begin
 * @param {Function} [opts.onDecided] - (version) the moment the act is chosen, before the fade
 * @param {Function} [opts.onGone] - (version) after the fade, the screen removed
 * @returns {{ lift: Function, stop: Function, root: HTMLElement }}
 */
export function startInterim({ under = false, onDecided, onGone } = {}) {
    if (_active) return _active;
    const t0 = performance.now();
    const steps = [];
    const note = (what) => steps.push(`${((performance.now() - t0) / 1000).toFixed(2)} s ${what}`);
    let alive = true;

    const root = el('div');
    root.id = 'interim';
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-label', 'Interim');
    if (!under) root.classList.add('is-up');
    const text = el('div', 'in-text');
    text.setAttribute('aria-live', 'polite');
    const veil = el('div', 'in-veil');
    root.append(text, veil);
    document.body.appendChild(root);
    document.body.classList.add(BODY_CLASS);

    const cursor = el('span', 'in-cur');
    const lines = {};
    const icons = {};
    let current = null;

    /** Waits `ms` of unpaused time. */
    const wait = (ms) => new Promise((resolve) => {
        let left = ms, last = performance.now();
        const step = () => {
            if (!alive) return;
            const now = performance.now();
            if (!paused()) left -= now - last;
            last = now;
            if (left <= 0) resolve();
            else setTimeout(step, Math.min(left, 40));
        };
        setTimeout(step, Math.min(ms, 40));
    });

    function newLine(id, gap) {
        const line = el('div', `in-line${gap ? ' gap' : ''}`);
        const tx = el('span', 'tx');
        line.append(tx, cursor);
        line.dataset.id = id;
        text.appendChild(line);
        lines[id] = { line, tx };
        current = lines[id];
        return current;
    }
    async function type(str) {
        for (const ch of str) {
            if (!alive) return;
            current.tx.textContent += ch;
            await wait(letterDelay(ch));
        }
    }
    function showIcon(act) {
        const s = el('span', 'in-icon');
        s.dataset.act = act;
        s.appendChild(icon(ACT_ICONS[act]));
        current.line.insertBefore(s, cursor);
        icons[act] = s;
        requestAnimationFrame(() => s.classList.add('shown'));
    }
    function light(act) {
        for (const a of ACTS) {
            icons[a]?.classList.toggle('lit', a === act);
            icons[a]?.classList.toggle('dim', a !== act);
        }
    }
    /** B453: the pointed line's act word, backspaced and retyped; the cursor comes back after. */
    async function retypePointed(act) {
        const p = lines.point;
        if (!p || act === pointed) return;
        const r = retypeAct(pointed, act);
        const back = current;
        p.line.appendChild(cursor); current = p;
        for (let i = 0; i < r.erase; i++) {
            if (!alive) return;
            p.tx.textContent = p.tx.textContent.slice(0, -1);
            await wait(ERASE_MS);
        }
        await wait(180);
        await type(r.type);
        note(`retyped: the ${act}`);
        if (back && back !== p) { back.line.appendChild(cursor); current = back; }
    }
    async function needle(target, total) {
        const flicks = pointFlicks(target, total, REDUCED());
        let at = 0;
        for (const f of flicks) {
            await wait(f.at - at);
            at = f.at;
            light(f.lit);
        }
    }

    // ----- the end
    let decided = false;
    async function decide(act, why) {
        if (decided || !alive) return;
        decided = true;
        const version = writeChoice(act, typeof localStorage !== 'undefined' ? localStorage : null);
        note(`decided: ${act} (${why}) → ${version}`);
        try { onDecided?.(version); } catch (e) { console.error('interim onDecided', e); }
        await wait(AFTER_MS);
        root.classList.add('is-leaving');
        note('fade to black');
        await new Promise((r) => setTimeout(r, REDUCED() ? 200 : FADE_MS));
        stop();
        note('gone');
        try { onGone?.(version); } catch (e) { console.error('interim onGone', e); }
    }

    // ----- the choice
    let pointed = null;
    let choice = null;
    let match = null;
    let say = null;
    async function sayLine(str) {
        if (!say) say = newLine('say', true);
        else { say.tx.textContent = ''; say.line.appendChild(cursor); current = say; }
        await type(str);
    }
    function showChoice() {
        choice = el('div', 'in-choice');
        const oppose = el('button', 'in-oppose');
        oppose.type = 'button';
        oppose.title = 'Oppose';
        oppose.setAttribute('aria-label', 'Oppose');
        for (const h of HANDS) { const i = el('span', 'in-glyph'); i.appendChild(icon([HAND_ICONS[h]])); oppose.appendChild(i); }
        const cont = el('button', 'in-continue', 'Continue');
        cont.type = 'button';
        oppose.addEventListener('click', () => opposeIt());
        cont.addEventListener('click', () => accept());
        choice.append(oppose, cont);
        text.appendChild(choice);
        requestAnimationFrame(() => choice?.classList.add('shown'));
        note('the choice');
    }
    function closeChoice() {
        if (!choice) return;
        const c = choice;
        c.classList.add('gone');
        c.querySelectorAll('button').forEach(b => { b.disabled = true; });
        setTimeout(() => c.remove(), 450);
    }
    async function accept() {
        if (!choice || choice.classList.contains('gone')) return;
        closeChoice();
        note('continue');
        await sayLine(SAY.accept);
        decide(pointed, 'continue');
    }
    function opposeIt() {
        if (!choice || choice.classList.contains('gone')) return;
        closeChoice();
        note('oppose');
        buildMatch();
    }
    function buildMatch() {
        match = el('div', 'in-match');
        const side = (who) => {
            const s = el('div', `in-side ${who}`);
            const label = el('span', 'in-dymo', who === 'you' ? 'YOU' : 'DESTINY');
            const slot = el('div', 'in-slot');
            s.append(label, slot);
            return { s, slot };
        };
        const you = side('you'), them = side('destiny');
        const vs = el('div', 'in-vs');
        const hands = el('div', 'in-hands');
        for (const h of HANDS) {
            const b = el('button', 'in-hand');
            b.type = 'button';
            b.dataset.hand = h;
            b.setAttribute('aria-label', h);
            b.appendChild(icon([HAND_ICONS[h]]));
            b.addEventListener('click', () => play(h));
            hands.appendChild(b);
        }
        const row = el('div', 'in-row');
        row.append(you.s, vs, them.s);
        match.append(row, hands);
        text.appendChild(match);
        requestAnimationFrame(() => match?.classList.add('shown'));
        match._you = you.slot; match._them = them.slot; match._hands = hands;
        reset();
    }
    function reset() {
        for (const slot of [match._you, match._them]) { slot.className = 'in-slot'; slot.replaceChildren(el('span', 'in-empty')); }
        match._hands.querySelectorAll('button').forEach(b => { b.disabled = false; });
    }
    let playing = false;
    async function play(hand) {
        if (playing || decided) return;
        playing = true;
        match._hands.querySelectorAll('button').forEach(b => { b.disabled = true; b.classList.toggle('picked', b.dataset.hand === hand); });
        const theirs = destinyHand(rand);
        const result = matchResult(hand, theirs);
        const state = { you: result === 'win' ? 'winner' : result === 'lose' ? 'loser' : 'draw', them: result === 'lose' ? 'winner' : result === 'win' ? 'loser' : 'draw' };
        match._you.className = `in-slot ${state.you}`; match._you.replaceChildren(icon([HAND_ICONS[hand]]));
        match._them.className = `in-slot ${state.them}`; match._them.replaceChildren(icon([HAND_ICONS[theirs]]));
        note(`round: ${hand} against ${theirs} → ${result}`);
        if (result === 'win') audio.pling();
        if (result === 'lose') audio.knock();
        await sayLine(SAY[result]);
        if (result === 'draw') {
            await wait(900);
            match._hands.querySelectorAll('button').forEach(b => b.classList.remove('picked'));
            reset();
            playing = false;
            return;
        }
        const act = actAfter(pointed, result);
        if (act !== pointed) { await needle(act, 700); await retypePointed(act); }
        decide(act, result === 'win' ? 'you won' : 'destiny won');
    }

    // ----- keys: Enter = Continue, Space = oppose (before main.js's Space = pause)
    const onKey = (e) => {
        if (!choice || choice.classList.contains('gone') || e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
        if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); accept(); }
        else if (e.code === 'Space') { e.preventDefault(); e.stopPropagation(); opposeIt(); }
    };
    window.addEventListener('keydown', onKey, true);

    function stop() {
        alive = false;
        window.removeEventListener('keydown', onKey, true);
        root.remove();
        document.body.classList.remove(BODY_CLASS);
        if (_active === handle) _active = null;
    }

    // ----- the opening
    async function run() {
        note('typing');
        pointed = pointAt(rand);
        for (const s of openingScript(pointed)) {
            if (!alive) return;
            if (s.line) newLine(s.line, s.gap);
            else if (s.type) await type(s.type);
            else if (s.pause) await wait(s.pause);
            else if (s.icon) { showIcon(s.icon); note(`the ${s.icon}`); }
            else if (s.point) { note('the needle'); await needle(s.point, POINT_MS); note(`settles on the ${s.point}`); }
            else if (s.choice) showChoice();
            if (s.line) note(`line ${s.line}`);
        }
    }

    let lifted = false;
    function lift() {
        if (lifted) return;
        lifted = true;
        root.classList.add('is-up');
        run();
    }

    const handle = { lift, stop, root, steps, get pointed() { return pointed; } };
    _active = handle;
    if (typeof window !== 'undefined') window.rpiInterim = { steps, setRng: setInterimRng, get pointed() { return pointed; }, oppose: opposeIt, accept, play };
    if (!under) lift();
    return handle;
}
