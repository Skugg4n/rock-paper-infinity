/**
 * The start screen (B456, docs/superpowers/specs/2026-10-12-start-screen-design.md): the cycle
 * with the hole, the title typed out, CONTINUE or START, NEW GAME, the acts reached as a list,
 * sound and music, the credit. The pure half (the table, the model, the words) is tested; the
 * screen is built from JS on document.body (style-start.css), like the interim, and removed
 * with lift(). main.js shows it first and acts on the choice.
 */
import { PHASE_KEY, PHASE2_CONSTANTS } from './constants.js';
import { DEEP_VERSION_KEY } from './deepVersion.js';
import { reachedSet } from './reached.js';
import { audio } from './audio.js';

// ---------------------------------------------------------------- the table and the words (tested)

/** The acts in order: the checkpoint an act starts again from, the phase it runs in. */
export const ACTS = [
    { id: 'trivial', roman: 'I', name: 'Trivial', checkpoint: 'i-start' },
    { id: 'capital', roman: 'II', name: 'Capital', checkpoint: 'ii-start' },
    { id: 'war', roman: 'III', name: 'War', checkpoint: 'iii-start' },
    { id: 'drone', roman: 'IV', name: 'Deep · Drone', checkpoint: 'iv-dig-start' },
    { id: 'vault', roman: 'IV', name: 'Deep · Vault', checkpoint: 'iv-vault-start' },
    { id: 'unity', roman: 'V', name: 'Unity', checkpoint: 'v-start' },
    { id: 'infinity', roman: 'VI', name: 'Infinity', checkpoint: null },
];

/** The chapter card an act opens with, as the game plays it on the way (phase1, phase2, interim, phase4). */
export const CARD_OF = {
    trivial: { roman: 'I', title: 'TRIVIAL' },
    capital: { roman: 'II', title: 'CAPITAL', slow: true, pause: 1400, hold: 2400 },
    war: { roman: 'III', title: 'WAR', dark: true, slow: true, pause: 1400, hold: 5000 },
    drone: { roman: 'IV', title: 'DEEP', dark: true, slow: true, hold: 5000 },
    vault: { roman: 'IV', title: 'DEEP', dark: true, slow: true, hold: 5000 },
    unity: { roman: 'V', title: 'UNITY', dark: true, hold: 2200 },
};

export const WORDS = {
    title: 'ROCK PAPER INFINITY',
    continue: 'CONTINUE',
    start: 'START',
    newGame: 'New game',
    erase: 'Your game will be erased.',
    startOver: 'Start over',
    keep: 'Keep',
    replaces: (label) => `Starting ${label} again replaces your game.`,
    playAgain: 'Play again',
    by: 'A game by Ola Belin',
    sound: 'Sound',
    music: 'Music',
};

function get(storage, k) { try { return storage?.getItem(k) ?? null; } catch { return null; } }
function defaultStorage() { try { return typeof localStorage !== 'undefined' ? localStorage : null; } catch { return null; } }

/** Where the game is, from the phase and the saves: the act's id and the line under CONTINUE. */
export function whereIs(storage = defaultStorage()) {
    const phase = get(storage, PHASE_KEY);
    if (!phase) return null;
    if (phase === 'INDUSTRY') return { id: 'trivial', label: 'I · Trivial' };
    if (phase === 'CITY' || phase === 'WAR') {
        let c = null;
        try { c = JSON.parse(get(storage, PHASE2_CONSTANTS.SAVE_KEY) || 'null'); } catch { /* ignore */ }
        if (c?.interimPending) return { id: 'war', label: 'The fork' };
        if (c?.war || phase === 'WAR') return { id: 'war', label: 'III · War' };
        return { id: 'capital', label: 'II · Capital' };
    }
    if (phase === 'DEEP') {
        const v = get(storage, DEEP_VERSION_KEY);
        if (v === 'dig') return { id: 'drone', label: 'IV · Deep, the drone' };
        if (v === 'vault') return { id: 'vault', label: 'IV · Deep, the vault' };
        return { id: null, label: 'IV · Deep' };
    }
    if (phase === 'UNITY') return { id: 'unity', label: 'V · Unity' };
    return { id: null, label: '' };
}

/** What the screen shows: fresh (START only), what CONTINUE goes to, and the rows. */
export function startModel(storage = defaultStorage()) {
    const reached = reachedSet(storage);
    const here = whereIs(storage);
    const ivSeen = reached.has('drone') || reached.has('vault');
    const acts = [];
    for (const a of ACTS) {
        const seen = reached.has(a.id);
        const isIv = a.id === 'drone' || a.id === 'vault';
        if (!seen && !(isIv && ivSeen)) continue;
        const state = here && here.id === a.id ? 'now' : seen && a.checkpoint ? 'reached' : 'grey';
        acts.push({ id: a.id, roman: a.roman, name: a.name, state });
    }
    return { fresh: !here, continueTo: here ? { phase: get(storage, PHASE_KEY), label: here.label } : null, acts };
}

// ---------------------------------------------------------------- the screen

const BODY_CLASS = 'start-up';
const HANDS = [['Gem', 'rock'], ['Scissors', 'scissors'], ['FileText', 'paper']];   // chapter I's glyphs, in the cycle's order
const TYPE_START_MS = 300;
const TYPE_MS = 70;

function iconSvg(name) {
    const L = typeof window !== 'undefined' ? window.lucide : null;
    const data = L?.icons?.[name];
    if (!data || typeof L.createElement !== 'function') return null;
    return L.createElement(data);
}

function actLabel(act) { return `${act.roman} · ${act.name.replace(' · ', ', the ').replace('Deep, the Drone', 'Deep, the drone').replace('Deep, the Vault', 'Deep, the vault')}`; }

/**
 * Builds the screen on document.body and resolves `choice` with what the player chose.
 * @param {object} [opts]
 * @param {Storage} [opts.storage] - localStorage unless a test says otherwise
 * @param {string} [opts.version] - the version line, bottom right
 * @returns {{ root: HTMLElement, model: object, choice: Promise<object>, lift: Function }}
 */
export function showStart({ storage = defaultStorage(), version = '' } = {}) {
    const model = startModel(storage);
    const root = document.createElement('div');
    root.id = 'start-screen';
    root.className = 'start-screen';
    root.innerHTML = `
      <div class="start-cycle" aria-hidden="true">
        <div class="start-halo start-halo-light"></div>
        <div class="start-halo start-halo-dark"></div>
        <div class="start-hole"></div>
        <div class="start-ring">${HANDS.map(([, k]) => `<div class="start-hand start-hand-${k}"><div class="start-disc"></div></div>`).join('')}</div>
      </div>
      <h1 class="start-title"></h1>
      <div class="start-main">
        <button type="button" class="start-word" data-start="primary"></button>
        <div class="start-where"></div>
        ${model.fresh ? '' : `<button type="button" class="start-new" data-start="new">${WORDS.newGame}</button>`}
      </div>
      <div class="start-confirm" hidden>
        <span class="start-confirm-text"></span>
        <button type="button" data-confirm="yes"></button>
        <button type="button" data-confirm="no">${WORDS.keep}</button>
      </div>
      <ul class="start-acts"></ul>
      <footer class="start-foot">
        <div class="start-audio">
          <button type="button" data-pref="sfx"></button>
          <button type="button" data-pref="music"></button>
        </div>
        <div class="start-by"><b>${WORDS.by}</b><span class="start-version"></span></div>
      </footer>`;

    // the hands
    HANDS.forEach(([icon, k]) => { const svg = iconSvg(icon); if (svg) root.querySelector(`.start-hand-${k} .start-disc`).appendChild(svg); });

    // the title, a letter at a time
    const h1 = root.querySelector('.start-title');
    // one nowrap wrapper per word so a narrow screen never breaks a word; the space between is plain text
    let wrap = null;
    [...WORDS.title].forEach((ch, i) => {
        if (ch === ' ') { h1.appendChild(document.createTextNode(' ')); wrap = null; return; }
        if (!wrap) { wrap = document.createElement('span'); wrap.className = 'start-word-wrap'; h1.appendChild(wrap); }
        const el = document.createElement('span');
        el.className = 'start-letter';
        el.textContent = ch;
        el.style.animationDelay = `${TYPE_START_MS + i * TYPE_MS}ms`;
        wrap.appendChild(el);
    });

    // the words
    const primary = root.querySelector('[data-start="primary"]');
    primary.textContent = model.fresh ? WORDS.start : WORDS.continue;
    root.querySelector('.start-where').textContent = model.continueTo?.label || '';
    root.querySelector('.start-version').textContent = version;

    // the rows
    const list = root.querySelector('.start-acts');
    for (const a of model.acts) {
        const li = document.createElement('li');
        li.dataset.id = a.id;
        li.dataset.state = a.state;
        li.innerHTML = `<span class="start-act-n"></span> <span class="start-act-t"></span>`;
        li.querySelector('.start-act-n').textContent = a.roman;
        li.querySelector('.start-act-t').textContent = a.name;
        if (a.state !== 'grey') { li.tabIndex = 0; li.setAttribute('role', 'button'); }
        list.appendChild(li);
    }

    // sound and music
    const paintPrefs = () => {
        const p = audio.getPrefs();
        root.querySelector('[data-pref="sfx"]').textContent = `${WORDS.sound} · ${p.sfx ? 'on' : 'off'}`;
        root.querySelector('[data-pref="music"]').textContent = `${WORDS.music} · ${p.music ? 'on' : 'off'}`;
    };
    paintPrefs();

    // the choice
    let resolve;
    const choice = new Promise((r) => { resolve = r; });
    let done = false;
    const choose = (c) => { if (done) return; done = true; resolve(c); };

    const confirm = root.querySelector('.start-confirm');
    const confirmText = confirm.querySelector('.start-confirm-text');
    const confirmYes = confirm.querySelector('[data-confirm="yes"]');
    const confirmNo = confirm.querySelector('[data-confirm="no"]');
    let onYes = null;
    let opener = null;
    let confirmRow = null;   // the li that holds the question when it sits inside the list
    const ask = (after, text, yesWord, yes) => {
        confirmText.textContent = text;
        confirmYes.textContent = yesWord;
        onYes = yes;
        opener = after;
        if (after.tagName === 'LI') {
            if (!confirmRow) {
                confirmRow = document.createElement('li');
                confirmRow.className = 'start-confirm-row';
                confirmRow.setAttribute('role', 'presentation');
            }
            confirmRow.appendChild(confirm);
            after.insertAdjacentElement('afterend', confirmRow);
        } else {
            after.insertAdjacentElement('afterend', confirm);
            confirmRow?.remove();
        }
        confirm.hidden = false;
        confirmNo.focus();   // the safe answer
    };
    const closeAsk = () => {
        const wasOpen = !confirm.hidden;
        confirm.hidden = true;
        onYes = null;
        if (confirmRow?.isConnected) { root.querySelector('.start-acts').insertAdjacentElement('beforebegin', confirm); confirmRow.remove(); }
        if (wasOpen && opener?.isConnected) opener.focus({ preventScroll: true });
        opener = null;
    };

    root.addEventListener('click', (e) => {
        const t = e.target.closest('[data-start], [data-confirm], [data-pref], .start-acts li');
        if (!t) return;
        if (t.dataset.confirm === 'yes') { const f = onYes; closeAsk(); f?.(); return; }
        if (t.dataset.confirm === 'no') { closeAsk(); return; }
        if (t.dataset.pref) {
            const name = t.dataset.pref;
            audio.setPref(name, !audio.getPrefs()[name]);
            paintPrefs();
            window.dispatchEvent(new CustomEvent('rpi-audio-change'));
            return;
        }
        if (t.dataset.start === 'primary') { choose(model.fresh ? { kind: 'new' } : { kind: 'continue' }); return; }
        if (t.dataset.start === 'new') { ask(t, WORDS.erase, WORDS.startOver, () => choose({ kind: 'new' })); return; }
        const id = t.dataset.id;
        const state = t.dataset.state;
        if (!id || state === 'grey') return;
        if (state === 'now') { choose({ kind: 'continue' }); return; }
        const act = ACTS.find((a) => a.id === id);
        if (model.continueTo) ask(t, WORDS.replaces(actLabel(act)), WORDS.playAgain, () => choose({ kind: 'act', id }));
        else choose({ kind: 'act', id });
    });
    const onKey = (e) => {
        if (e.key === 'Escape') { closeAsk(); return; }
        const el = document.activeElement;
        if (e.key === ' ' && el?.matches?.('.start-acts li') && root.contains(el)) { e.preventDefault(); if (!e.repeat) el.click(); return; }
        if (e.key !== 'Enter' || e.repeat) return;
        if (el && root.contains(el) && el !== document.body && el.tagName === 'BUTTON' && el !== primary) return;   // a focused button answers itself
        if (el && el.matches?.('.start-acts li')) { el.click(); return; }
        if (!confirm.hidden) return;
        e.preventDefault();
        primary.click();
    };
    document.addEventListener('keydown', onKey);

    document.body.appendChild(root);
    document.body.classList.add(BODY_CLASS);
    primary.focus({ preventScroll: true });

    function lift() {
        document.removeEventListener('keydown', onKey);
        root.remove();
        document.body.classList.remove(BODY_CLASS);
    }
    return { root, model, choice, lift };
}
