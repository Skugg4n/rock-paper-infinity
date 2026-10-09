/**
 * INTERIM (v1.90.0): the short scene between chapter III and chapter IV. As the Earth fails the
 * path forks: in one reality a drone (the dig, src/phase4d), in the other a vault (src/phase4v).
 * Destiny points at one; the player may accept (Continue) or oppose it with one match of rock
 * paper scissors (v1.91.0: a count of three before the hands show; the winner chooses the path).
 * A departure line, then the IV · DEEP card; at its midpoint the act is written under
 * DEEP_VERSION_KEY and the caller starts chapter IV.
 *
 * The screen is a CRT in the vault's palette, built from JS on document.body (style-interim.css).
 * The pure parts (the script, the pointing, the match rules, the version written) are exported and
 * tested; startInterim() is the DOM. Timings are window.rpiInterim.steps (seconds since the start).
 */
import { audio } from './audio.js';
import { playChapterCard } from './chapterCard.js';
import { DEEP_VERSION_KEY } from './deepVersion.js';

// ---------------------------------------------------------------- pure rules (tested)

/** The two realities and the chapter IV each one is. Never 'colony'. */
export const ACTS = ['drone', 'vault'];
export const VERSION_OF = { drone: 'dig', vault: 'vault' };
export const OTHER = { drone: 'vault', vault: 'drone' };

export const TYPE_MS = 28;      // a letter
export const SPACE_MS = 45;     // a space
export const POINT_MS = 2400;   // Destiny's needle, back and forth until it settles

export const letterDelay = (ch) => (ch === ' ' ? SPACE_MS : TYPE_MS);

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
/**
 * What comes after a round (v1.91.0): a win lets the player choose ('choose'), a loss keeps the
 * pointed act, a draw is null (again).
 */
export function actAfter(pointed, result) {
    if (result === 'win') return 'choose';
    if (result === 'lose') return pointed;
    return null;
}
/** What the round says. */
export const SAY = { draw: 'Again.', win: 'You win.', lose: 'Destiny holds.', accept: 'So be it.' };
/** After a win: the line above the two icons. */
export const CHOOSE_LINE = 'You have beaten Destiny and may choose your path.';
/** The last line before the card, by the act chosen. */
export const DEPART = { vault: 'You go deep into the vault.', drone: 'You go deep, as the drone.' };

/** The match's timing (ms): each digit of the count, the result after the reveal, the rest after it. */
export const COUNT = ['1', '2', '3'];
export const COUNT_MS = 600;
export const RESULT_MS = 500;
export const REST_MS = 2500;
export const ACCEPT_MS = 1200;  // after "So be it." before the departure line
export const DEPART_MS = 2000;  // the departure line holds this long before the card
/** The card into chapter IV. */
export const DEEP_CARD = { roman: 'IV', title: 'DEEP', dark: true, slow: true, silent: true, hold: 5000 };

/**
 * One round, after the hand is picked: the count (a digit, a rest, three times), both hands
 * together, the result 500 ms later, then a rest of 2.5 s before anything else happens.
 */
export function roundSteps(result) {
    const out = [];
    for (const d of COUNT) out.push({ count: d }, { pause: COUNT_MS });
    out.push({ reveal: true }, { pause: RESULT_MS }, { say: SAY[result] }, { pause: REST_MS });
    return out;
}

/** The arrow keys over the two icons: left is the drone, right the vault (no wrap). */
export function moveFocus(at, key) {
    const i = ACTS.indexOf(at);
    if (key === 'ArrowLeft') return ACTS[Math.max(0, i - 1)];
    if (key === 'ArrowRight') return ACTS[Math.min(ACTS.length - 1, i + 1)];
    return at;
}

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
 * @param {Function} [opts.onDecided] - (version) the moment the act is chosen, before the departure line
 * @param {Function} [opts.onDeep] - (version) the IV · DEEP card's midpoint: the version is written, start chapter IV
 * @returns {{ lift: Function, stop: Function, root: HTMLElement }}
 */
export function startInterim({ under = false, onDecided, onDeep } = {}) {
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
    root.append(text);
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

    /** A short window: the screen follows the newest line (v1.91.0). */
    const follow = () => { if (root.scrollHeight > root.clientHeight) root.scrollTop = root.scrollHeight; };
    function newLine(id, gap) {
        const line = el('div', `in-line${gap ? ' gap' : ''}`);
        const tx = el('span', 'tx');
        line.append(tx, cursor);
        line.dataset.id = id;
        text.appendChild(line);
        lines[id] = { line, tx };
        current = lines[id];
        follow();
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
    async function needle(target, total) {
        const flicks = pointFlicks(target, total, REDUCED());
        let at = 0;
        for (const f of flicks) {
            await wait(f.at - at);
            at = f.at;
            light(f.lit);
        }
    }

    // ----- the end: the departure line, then the IV · DEEP card; at its midpoint the screen goes
    let decided = false;
    async function decide(act, why) {
        if (decided || !alive) return;
        decided = true;
        const version = VERSION_OF[act];
        note(`decided: ${act} (${why}) → ${version}`);
        try { onDecided?.(version); } catch (e) { console.error('interim onDecided', e); }
        light(act);
        newLine('depart', true);
        await type(DEPART[act]);
        note('the departure line');
        await wait(DEPART_MS);
        if (!alive) return;
        leave(act, version);
    }
    function leave(act, version) {
        let down = false;
        const goDown = () => {
            if (down) return;
            down = true;
            writeChoice(act, typeof localStorage !== 'undefined' ? localStorage : null);
            removeScreen();
            note('chapter IV (setPhase)');
            try { onDeep?.(version); } catch (e) { console.error('interim onDeep', e); }
        };
        // under the card: the card (z 1000) covers the screen, which fades as the card's veil comes in
        root.classList.add('is-leaving');
        note('the IV card');
        playChapterCard({ ...DEEP_CARD, onMidpoint: goDown })
            .then(() => { goDown(); done(); }, (e) => { console.error('interim card', e); goDown(); done(); });
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
        follow();
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
    const choiceOpen = () => !!choice && !choice.classList.contains('gone');
    async function accept() {
        if (!choiceOpen()) return;
        closeChoice();
        note('continue');
        await sayLine(SAY.accept);
        await wait(ACCEPT_MS);
        decide(pointed, 'continue');
    }
    function opposeIt() {
        if (!choiceOpen()) return;
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
        follow();
        requestAnimationFrame(() => match?.classList.add('shown'));
        match._you = you.slot; match._them = them.slot; match._hands = hands;
        reset();
    }
    function reset() {
        for (const slot of [match._you, match._them]) { slot.className = 'in-slot'; slot.replaceChildren(el('span', 'in-empty')); }
        match._hands.querySelectorAll('button').forEach(b => { b.disabled = false; b.classList.remove('picked'); });
    }
    /** The count on the say line: a digit, pulsing once, beside the ones before it. */
    function countDigit(d) {
        if (!say) say = newLine('say', true);
        if (d === COUNT[0]) { say.tx.replaceChildren(); say.line.appendChild(cursor); current = say; }
        else say.tx.appendChild(document.createTextNode('  '));
        const s = el('span', 'in-count', d);
        say.tx.appendChild(s);
        if (!REDUCED()) requestAnimationFrame(() => s.classList.add('pulse'));
    }
    let playing = false;
    async function play(hand) {
        if (playing || decided || !match) return;
        playing = true;
        match._hands.querySelectorAll('button').forEach(b => { b.disabled = true; b.classList.toggle('picked', b.dataset.hand === hand); });
        const theirs = destinyHand(rand);
        const result = matchResult(hand, theirs);
        note(`hand picked: ${hand}`);
        for (const s of roundSteps(result)) {
            if (!alive) return;
            if (s.count) { countDigit(s.count); note(`count ${s.count}`); }
            else if (s.pause) await wait(s.pause);
            else if (s.reveal) {
                const state = { you: result === 'win' ? 'winner' : result === 'lose' ? 'loser' : 'draw', them: result === 'lose' ? 'winner' : result === 'win' ? 'loser' : 'draw' };
                match._you.className = `in-slot ${state.you}`; match._you.replaceChildren(icon([HAND_ICONS[hand]]));
                match._them.className = `in-slot ${state.them}`; match._them.replaceChildren(icon([HAND_ICONS[theirs]]));
                note(`reveal: ${hand} against ${theirs}`);
                if (result === 'win') audio.pling();
                if (result === 'lose') audio.knock();
            } else if (s.say) { note(`result: ${result}`); await sayLine(s.say); }
        }
        if (!alive) return;
        const next = actAfter(pointed, result);
        if (next === null) { reset(); playing = false; note('again'); return; }
        if (next === 'choose') { await showChoose(); return; }
        decide(next, 'destiny won');
    }

    // ----- the winner chooses: both icons lit below the line, a focus ring on one, no default pick
    let choose = null;
    let focusAt = ACTS[0];
    async function showChoose() {
        newLine('choose', true);
        await type(CHOOSE_LINE);
        if (!alive) return;
        note('the choose line');
        choose = el('div', 'in-paths');
        for (const act of ACTS) {
            const b = el('button', 'in-path');
            b.type = 'button';
            b.dataset.act = act;
            b.title = act === 'vault' ? 'The vault' : 'The drone';
            b.setAttribute('aria-label', b.title);
            b.appendChild(icon(ACT_ICONS[act]));
            b.addEventListener('click', () => pickPath(act, 'mouse'));
            b.addEventListener('mouseenter', () => focusPath(act));
            choose.appendChild(b);
        }
        text.appendChild(choose);
        follow();
        requestAnimationFrame(() => choose?.classList.add('shown'));
        focusPath(ACTS[0]);
    }
    function focusPath(act) {
        if (!choose || choose.classList.contains('gone')) return;
        focusAt = act;
        choose.querySelectorAll('.in-path').forEach(b => b.classList.toggle('is-focus', b.dataset.act === act));
    }
    function pickPath(act, how) {
        if (!choose || choose.classList.contains('gone') || decided) return;
        choose.classList.add('gone');
        choose.querySelectorAll('.in-path').forEach(b => { b.disabled = true; b.classList.toggle('is-picked', b.dataset.act === act); });
        note(`chosen: the ${act} (${how})`);
        decide(act, `you won, chose with the ${how}`);
    }

    // ----- keys: Enter = Continue, Space = oppose (before main.js's Space = pause);
    // when the winner chooses: the arrows move the ring, Enter picks
    const onKey = (e) => {
        if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
        if (choose && !choose.classList.contains('gone')) {
            if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); e.stopPropagation(); focusPath(moveFocus(focusAt, e.key)); }
            else if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); pickPath(focusAt, 'keyboard'); }
            return;
        }
        if (!choiceOpen()) return;
        if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); accept(); }
        else if (e.code === 'Space') { e.preventDefault(); e.stopPropagation(); opposeIt(); }
    };
    window.addEventListener('keydown', onKey, true);

    /** The screen out of the DOM (the ☰ stays hidden until done(), so it does not show on the card). */
    function removeScreen() {
        alive = false;
        window.removeEventListener('keydown', onKey, true);
        root.remove();
    }
    function done() {
        document.body.classList.remove(BODY_CLASS);
        if (_active === handle) _active = null;
    }
    function stop() { removeScreen(); done(); }

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
    if (typeof window !== 'undefined') {
        window.rpiInterim = { steps, setRng: setInterimRng, get pointed() { return pointed; }, oppose: opposeIt, accept, play, choose: (act) => pickPath(act, 'debug') };
    }
    if (!under) lift();
    return handle;
}
