# Start Screen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A start screen in front of Rock Paper Infinity: the cycle with the hole, the title typed out, CONTINUE / START, NEW GAME, the acts reached as a list, sound and music, "A game by Ola Belin".

**Architecture:** A pure set of reached acts (`src/reached.js`, key `rpi-reached`, marked by the chapter cards and the interim, migrated from old saves) feeds a pure model (`startModel` in `src/start.js`) that a JS-built screen renders on `document.body` (like the interim). `main.js`'s bootstrap shows the screen first and acts on the choice: Continue = `setPhase(saved)`; New game = clear, `I · TRIVIAL` card, chapter I; an act = a session flag + the act's checkpoint (`jumpTo`, which reloads) and, after the reload, that act's chapter card. Headless scripts and the test menu skip the screen through the same session flag.

**Tech Stack:** Vanilla ES modules, Jest 30 (ESM, jsdom for DOM tests), ESLint 9, Tailwind CDN + plain CSS, Bebas Neue, Lucide (global `lucide`).

**Spec:** `docs/superpowers/specs/2026-10-12-start-screen-design.md`. **Look:** `docs/mockups/start-screen-3.html` (and `?new`).

## Global Constraints

- Branch `start-screen` in worktree `~/Projects/rpi-start` (from origin/main v1.92.8). Commit after every task. Push when the network is back (`git push`; it failed offline on 2026-10-12).
- `node_modules` in the worktree is a symlink to `~/Projects/rock-paper-infinity/node_modules` (already made). Never `npm install` on Drive.
- Run tests with `npm test` (`NODE_OPTIONS='--experimental-vm-modules' jest`), lint with `npm run lint`. Both must pass at every commit.
- Strings are exactly the spec's: `ROCK PAPER INFINITY`, `CONTINUE`, `START`, `New game`, `Your game will be erased.`, `Start over`, `Keep`, `Starting III · War again replaces your game.`, `Play again`, `A game by Ola Belin`, `Sound · on`, `Music · off`. Act names: `Trivial`, `Capital`, `War`, `Deep · Drone`, `Deep · Vault`, `Unity`, `Infinity`. Continue lines: `I · Trivial`, `II · Capital`, `III · War`, `The fork`, `IV · Deep, the drone`, `IV · Deep, the vault`, `IV · Deep`, `V · Unity`. No em-dashes anywhere (`—`).
- Keys: `rpi-reached` (localStorage, JSON array), `rpi-go` and `rpi-card` (sessionStorage flags). All three named in `src/constants.js`.
- Hot-path rules of CLAUDE.md do not apply (no tick); event listeners on the screen die with the screen (`root.remove()`).
- Version at the end: `v1.93.0` in `src/version.js`, `index.html` (`#version-info`), `package.json`, `CHANGELOG.md`.

---

### Task 1: The reached set

**Files:**
- Modify: `src/constants.js` (append)
- Create: `src/reached.js`
- Test: `src/reached.test.js`
- Modify: `src/checkpoints.js:400` (KEEP_KEYS), `src/modules.js`

**Interfaces:**
- Produces: `REACHED_KEY`, `ACT_IDS`, `ACT_OF_ROMAN`, `reachedSet(storage) → Set<string>`, `markReached(id, storage?) → Set`, `migrateReached(storage?) → Set`. `storage` is anything with `getItem/setItem` (localStorage by default; tests pass a fake). Constants `START_SKIP_FLAG = 'rpi-go'`, `START_CARD_FLAG = 'rpi-card'`.

- [ ] **Step 1: Add the keys to `src/constants.js`** (append at the end):

```js
/** The start screen (src/start.js, src/reached.js). */
export const REACHED_KEY = 'rpi-reached';        // localStorage: JSON array of acts reached, ever
export const START_SKIP_FLAG = 'rpi-go';         // sessionStorage: set before a reload that must not show the start screen
export const START_CARD_FLAG = 'rpi-card';       // sessionStorage: an act id; after the reload its chapter card plays first
```

- [ ] **Step 2: Write the failing test `src/reached.test.js`**

```js
/* eslint-env jest */
import { REACHED_KEY, ACT_IDS, ACT_OF_ROMAN, reachedSet, markReached, migrateReached } from './reached.js';
import { PHASE_KEY, PHASE1_CONSTANTS, PHASE2_CONSTANTS } from './constants.js';
import { DEEP_VERSION_KEY } from './deepVersion.js';

const fake = (init = {}) => { const m = { ...init }; return { getItem: (k) => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, removeItem: (k) => { delete m[k]; }, m }; };

describe('the reached set', () => {
    test('empty without the key, broken JSON or unknown ids', () => {
        expect([...reachedSet(fake())]).toEqual([]);
        expect([...reachedSet(fake({ [REACHED_KEY]: '{nope' }))]).toEqual([]);
        expect([...reachedSet(fake({ [REACHED_KEY]: '["capital","moon"]' }))]).toEqual(['capital']);
        expect([...reachedSet(null)]).toEqual([]);
    });
    test('marking is a set, kept in the order of the acts', () => {
        const s = fake();
        markReached('war', s); markReached('trivial', s); markReached('war', s); markReached('nothing', s);
        expect(JSON.parse(s.m[REACHED_KEY])).toEqual(['trivial', 'war']);
        expect(ACT_IDS).toEqual(['trivial', 'capital', 'war', 'drone', 'vault', 'unity', 'infinity']);
        expect(ACT_OF_ROMAN).toEqual({ I: 'trivial', II: 'capital', III: 'war', V: 'unity', VI: 'infinity' });
    });
    test('migration reads the old saves once, and fills in the acts below', () => {
        const s = fake({ [PHASE1_CONSTANTS.SAVE_KEY]: '{}', [PHASE_KEY]: 'INDUSTRY' });
        expect([...migrateReached(s)]).toEqual(['trivial']);
        const city = fake({ [PHASE2_CONSTANTS.SAVE_KEY]: JSON.stringify({ war: false }), [PHASE_KEY]: 'CITY' });
        expect([...migrateReached(city)]).toEqual(['trivial', 'capital']);
        const war = fake({ [PHASE2_CONSTANTS.SAVE_KEY]: JSON.stringify({ war: true }), [PHASE_KEY]: 'CITY' });
        expect([...migrateReached(war)]).toEqual(['trivial', 'capital', 'war']);
        const fork = fake({ [PHASE2_CONSTANTS.SAVE_KEY]: JSON.stringify({ interimPending: true }) });
        expect([...migrateReached(fork)]).toEqual(['trivial', 'capital', 'war']);
        const dig = fake({ 'rpi-deep-dig': '{}', [PHASE_KEY]: 'DEEP', [DEEP_VERSION_KEY]: 'dig' });
        expect([...migrateReached(dig)]).toEqual(['trivial', 'capital', 'war', 'drone']);
        const vault = fake({ [PHASE_KEY]: 'DEEP', [DEEP_VERSION_KEY]: 'vault' });
        expect([...migrateReached(vault)]).toEqual(['trivial', 'capital', 'war', 'vault']);
        const colony = fake({ 'rpi-deep': '{}', [PHASE_KEY]: 'DEEP' });
        expect([...migrateReached(colony)]).toEqual(['trivial', 'capital', 'war']);
        const unity = fake({ 'rpi-unity': '{}', [PHASE_KEY]: 'UNITY' });
        expect([...migrateReached(unity)]).toEqual(['trivial', 'capital', 'war', 'unity']);
    });
    test('migration writes the key, and never runs twice', () => {
        const s = fake({ [PHASE1_CONSTANTS.SAVE_KEY]: '{}' });
        migrateReached(s);
        expect(s.m[REACHED_KEY]).toBe('["trivial"]');
        s.m[PHASE2_CONSTANTS.SAVE_KEY] = '{}';
        expect([...migrateReached(s)]).toEqual(['trivial']);
        const fresh = fake();
        migrateReached(fresh);
        expect(fresh.m[REACHED_KEY]).toBe('[]');
    });
});
```

- [ ] **Step 3: Run it to see it fail**

Run: `cd ~/Projects/rpi-start && npm test -- src/reached.test.js`
Expected: FAIL, "Cannot find module './reached.js'".

- [ ] **Step 4: Create `src/reached.js`**

```js
/**
 * Which acts the player has reached, ever. One save, but the start screen's list never forgets:
 * a set under REACHED_KEY, kept through New game and every checkpoint (KEEP_KEYS). The chapter
 * cards mark I, II, III, V and VI by their numeral; the interim marks the chapter IV chosen
 * (drone or vault). Pure: no DOM; storage is anything with getItem/setItem.
 */
import { REACHED_KEY, PHASE_KEY, PHASE1_CONSTANTS, PHASE2_CONSTANTS } from './constants.js';
import { DEEP_VERSION_KEY } from './deepVersion.js';

export { REACHED_KEY };
export const ACT_IDS = ['trivial', 'capital', 'war', 'drone', 'vault', 'unity', 'infinity'];
/** The numeral on a chapter card → the act it opens. IV is the interim's to mark. */
export const ACT_OF_ROMAN = { I: 'trivial', II: 'capital', III: 'war', V: 'unity', VI: 'infinity' };

function defaultStorage() {
    try { return typeof localStorage !== 'undefined' ? localStorage : null; } catch { return null; }
}
function get(storage, k) { try { return storage?.getItem(k) ?? null; } catch { return null; } }
function write(storage, set) {
    try { storage?.setItem(REACHED_KEY, JSON.stringify(ACT_IDS.filter((a) => set.has(a)))); } catch { /* full or absent */ }
}

/** The acts reached, in the acts' order. */
export function reachedSet(storage = defaultStorage()) {
    try {
        const arr = JSON.parse(get(storage, REACHED_KEY) || '[]');
        return new Set(Array.isArray(arr) ? ACT_IDS.filter((a) => arr.includes(a)) : []);
    } catch { return new Set(); }
}

/** Adds one act. Unknown ids are ignored. */
export function markReached(id, storage = defaultStorage()) {
    const set = reachedSet(storage);
    if (!ACT_IDS.includes(id) || set.has(id)) return set;
    set.add(id);
    write(storage, set);
    return set;
}

/** From the saves an older game left: run once, when there is no REACHED_KEY yet. */
export function migrateReached(storage = defaultStorage()) {
    if (!storage || get(storage, REACHED_KEY) !== null) return reachedSet(storage);
    const set = new Set();
    if (get(storage, PHASE1_CONSTANTS.SAVE_KEY)) set.add('trivial');
    const city = get(storage, PHASE2_CONSTANTS.SAVE_KEY);
    if (city) {
        set.add('capital');
        let c = null;
        try { c = JSON.parse(city); } catch { /* an old save that is not JSON */ }
        if (c && (c.war || c.interimPending || c.interimChosen)) set.add('war');
    }
    if (get(storage, 'rpi-deep-dig')) set.add('drone');
    if (get(storage, 'rpi-deep-vault')) set.add('vault');
    if (get(storage, 'rpi-unity')) set.add('unity');
    const phase = get(storage, PHASE_KEY);
    if (phase === 'DEEP') {
        const v = get(storage, DEEP_VERSION_KEY);
        if (v === 'dig') set.add('drone');
        if (v === 'vault') set.add('vault');
        set.add('war');   // the colony too: you came through the war
    }
    if (phase === 'UNITY') set.add('unity');
    // everything below a reached act was reached on the way
    if (set.has('unity')) { set.add('war'); }
    if (set.has('drone') || set.has('vault') || set.has('war')) { set.add('war'); set.add('capital'); }
    if (set.has('capital')) set.add('trivial');
    write(storage, set);
    return reachedSet(storage);
}
```

- [ ] **Step 5: Keep the key through checkpoints.** In `src/checkpoints.js`, change the KEEP_KEYS line (about line 400):

```js
import { REACHED_KEY } from './reached.js';
// ...
/** deep-tension: the player's own settings survive a jump: the sound (a muted player got the music back),
 *  the debug flag, the chosen view of chapter IV, and the acts reached (the start screen's list). */
export const KEEP_KEYS = ['rpi-audio', 'rpi-debug', 'rpi-deep-view', DEEP_VERSION_KEY, REACHED_KEY];
```

Put the import with the other imports at the top of the file.

- [ ] **Step 6: List the module.** In `src/modules.js` add `'src/reached.js'` right after `'src/perf.js'`.

- [ ] **Step 7: Run tests and lint**

Run: `npm test && npm run lint`
Expected: all green (modules.test passes because the file is on disk and listed; tension.test still finds its three keys).

- [ ] **Step 8: Commit**

```bash
git add src/constants.js src/reached.js src/reached.test.js src/checkpoints.js src/modules.js
git commit -m "feat(start): the acts reached, a set under rpi-reached, migrated from old saves, kept through checkpoints (B456)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: The cards and the interim mark the acts

**Files:**
- Modify: `src/chapterCard.js:1-3, 36-38`
- Modify: `src/interim.js:152-158` (writeChoice)
- Test: `src/chapterCard.test.js` (append), `src/interim.test.js` (append)

**Interfaces:**
- Consumes: `markReached`, `ACT_OF_ROMAN` from Task 1.
- Produces: every `playChapterCard({ roman })` with roman I, II, III, V or VI marks the act (IV never does); `writeChoice('drone' | 'vault', storage)` marks that act in the same storage.

- [ ] **Step 1: Failing test, chapter card.** Append to `src/chapterCard.test.js` (the file's `beforeEach` builds a JSDOM without a URL, so give this test its own storage):

```js
test('a card marks its act as reached: I, II, III, V, VI, never IV', async () => {
    const { markReached: _m, reachedSet } = await import('./reached.js');
    const store = {};
    global.localStorage = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } };
    try {
        for (const roman of ['I', 'II', 'III', 'IV', 'V', 'VI']) {
            const mod = await import('./chapterCard.js');
            if (mod._resetForTesting) mod._resetForTesting();
            const p = mod.playChapterCard({ roman, title: 'X' });
            await jest.runAllTimersAsync();
            await p;
        }
        expect([...reachedSet(global.localStorage)]).toEqual(['trivial', 'capital', 'war', 'unity', 'infinity']);
    } finally {
        delete global.localStorage;
    }
});
```

- [ ] **Step 2: Failing test, interim.** Append inside the `describe('the interim', ...)` in `src/interim.test.js`:

```js
    test('the choice marks the act reached, in the same storage', async () => {
        const { REACHED_KEY } = await import('./reached.js');
        const store = {};
        const storage = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } };
        writeChoice('drone', storage);
        expect(JSON.parse(store[REACHED_KEY])).toEqual(['drone']);
        writeChoice('vault', storage);
        expect(JSON.parse(store[REACHED_KEY])).toEqual(['drone', 'vault']);
    });
```

- [ ] **Step 3: Run both, see them fail**

Run: `npm test -- src/chapterCard.test.js src/interim.test.js`
Expected: the two new tests FAIL (`rpi-reached` never written).

- [ ] **Step 4: Mark in `src/chapterCard.js`.** Add the import under `import { audio } from './audio.js';`:

```js
import { markReached, ACT_OF_ROMAN } from './reached.js';
```

and in `playChapterCard`, right after `if (_cardActive) return Promise.resolve();`:

```js
    // The start screen lists the acts reached, ever (src/reached.js). A card is the moment an
    // act opens; IV's card is the interim's, which marks drone or vault itself.
    if (ACT_OF_ROMAN[roman]) markReached(ACT_OF_ROMAN[roman]);
```

- [ ] **Step 5: Mark in `src/interim.js`.** Import (next to `import { DEEP_VERSION_KEY } from './deepVersion.js';`):

```js
import { markReached } from './reached.js';
```

and in `writeChoice`, before `return version;`:

```js
    markReached(act, storage);   // the start screen lists the act reached (drone or vault)
```

- [ ] **Step 6: Run tests and lint**

Run: `npm test && npm run lint`
Expected: green.

- [ ] **Step 7: Commit**

```bash
git add src/chapterCard.js src/chapterCard.test.js src/interim.js src/interim.test.js
git commit -m "feat(start): the chapter cards and the interim mark the acts reached

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: The start model (pure)

**Files:**
- Create: `src/start.js` (the pure half; Task 4 adds the DOM half to the same file)
- Test: `src/start.test.js`
- Modify: `src/modules.js`

**Interfaces:**
- Consumes: `reachedSet` (Task 1), `PHASE_KEY`, `PHASE2_CONSTANTS`, `DEEP_VERSION_KEY`.
- Produces: `ACTS` (table), `CARD_OF` (the card options per act), `WORDS`, `whereIs(storage) → { id, label } | null`, `startModel(storage) → { fresh, continueTo: { phase, label } | null, acts: [{ id, roman, name, state: 'now' | 'reached' | 'grey' }] }`.

- [ ] **Step 1: Failing test `src/start.test.js`**

```js
/* eslint-env jest */
import { ACTS, CARD_OF, WORDS, whereIs, startModel } from './start.js';
import { REACHED_KEY, PHASE_KEY, PHASE2_CONSTANTS } from './constants.js';
import { DEEP_VERSION_KEY } from './deepVersion.js';

const fake = (init = {}) => { const m = { ...init }; return { getItem: (k) => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, removeItem: (k) => { delete m[k]; }, m }; };
const reached = (...ids) => JSON.stringify(ids);
const rows = (model) => model.acts.map((a) => `${a.roman} ${a.name} ${a.state}`);

describe('where the game is', () => {
    test('nothing without a phase', () => { expect(whereIs(fake())).toBeNull(); });
    test('one line per phase and save', () => {
        expect(whereIs(fake({ [PHASE_KEY]: 'INDUSTRY' }))).toEqual({ id: 'trivial', label: 'I · Trivial' });
        expect(whereIs(fake({ [PHASE_KEY]: 'CITY', [PHASE2_CONSTANTS.SAVE_KEY]: '{"war":false}' }))).toEqual({ id: 'capital', label: 'II · Capital' });
        expect(whereIs(fake({ [PHASE_KEY]: 'CITY', [PHASE2_CONSTANTS.SAVE_KEY]: '{"war":true}' }))).toEqual({ id: 'war', label: 'III · War' });
        expect(whereIs(fake({ [PHASE_KEY]: 'CITY', [PHASE2_CONSTANTS.SAVE_KEY]: '{"war":true,"interimPending":true}' }))).toEqual({ id: 'war', label: 'The fork' });
        expect(whereIs(fake({ [PHASE_KEY]: 'DEEP', [DEEP_VERSION_KEY]: 'dig' }))).toEqual({ id: 'drone', label: 'IV · Deep, the drone' });
        expect(whereIs(fake({ [PHASE_KEY]: 'DEEP', [DEEP_VERSION_KEY]: 'vault' }))).toEqual({ id: 'vault', label: 'IV · Deep, the vault' });
        expect(whereIs(fake({ [PHASE_KEY]: 'DEEP' }))).toEqual({ id: null, label: 'IV · Deep' });
        expect(whereIs(fake({ [PHASE_KEY]: 'UNITY' }))).toEqual({ id: 'unity', label: 'V · Unity' });
    });
});

describe('the start model', () => {
    test('a new player: fresh, nothing to continue, no rows', () => {
        expect(startModel(fake())).toEqual({ fresh: true, continueTo: null, acts: [] });
    });
    test('only the acts reached are listed, the current one marked', () => {
        const m = startModel(fake({ [PHASE_KEY]: 'CITY', [PHASE2_CONSTANTS.SAVE_KEY]: '{"war":false}', [REACHED_KEY]: reached('trivial', 'capital') }));
        expect(m.fresh).toBe(false);
        expect(m.continueTo).toEqual({ phase: 'CITY', label: 'II · Capital' });
        expect(rows(m)).toEqual(['I Trivial reached', 'II Capital now']);
    });
    test('one chapter IV reached shows both, the other grey; both reached, both black', () => {
        const drone = startModel(fake({ [PHASE_KEY]: 'DEEP', [DEEP_VERSION_KEY]: 'dig', [REACHED_KEY]: reached('trivial', 'capital', 'war', 'drone') }));
        expect(rows(drone)).toEqual(['I Trivial reached', 'II Capital reached', 'III War reached', 'IV Deep · Drone now', 'IV Deep · Vault grey']);
        const both = startModel(fake({ [PHASE_KEY]: 'INDUSTRY', [REACHED_KEY]: reached('trivial', 'capital', 'war', 'drone', 'vault') }));
        expect(rows(both)).toEqual(['I Trivial now', 'II Capital reached', 'III War reached', 'IV Deep · Drone reached', 'IV Deep · Vault reached']);
    });
    test('V plays again; VI is the tease, grey, only once reached', () => {
        const m = startModel(fake({ [PHASE_KEY]: 'UNITY', [REACHED_KEY]: reached('trivial', 'capital', 'war', 'vault', 'unity', 'infinity') }));
        expect(rows(m).slice(-2)).toEqual(['V Unity now', 'VI Infinity grey']);
        const noVi = startModel(fake({ [PHASE_KEY]: 'UNITY', [REACHED_KEY]: reached('trivial', 'capital', 'war', 'vault', 'unity') }));
        expect(rows(noVi).at(-1)).toBe('V Unity now');
    });
    test('the table, the cards and the words', () => {
        expect(ACTS.map((a) => a.id)).toEqual(['trivial', 'capital', 'war', 'drone', 'vault', 'unity', 'infinity']);
        expect(ACTS.find((a) => a.id === 'drone').checkpoint).toBe('iv-dig-start');
        expect(ACTS.find((a) => a.id === 'vault').checkpoint).toBe('iv-vault-start');
        expect(ACTS.find((a) => a.id === 'unity').checkpoint).toBe('v-start');
        expect(ACTS.find((a) => a.id === 'infinity').checkpoint).toBeNull();
        expect(CARD_OF.war).toEqual({ roman: 'III', title: 'WAR', dark: true, slow: true, pause: 1400, hold: 5000 });
        expect(CARD_OF.vault).toEqual({ roman: 'IV', title: 'DEEP', dark: true, slow: true, hold: 5000 });
        expect(CARD_OF.infinity).toBeUndefined();
        expect(WORDS.title).toBe('ROCK PAPER INFINITY');
        expect(WORDS.replaces('III · War')).toBe('Starting III · War again replaces your game.');
        expect(JSON.stringify(WORDS)).not.toMatch(/—/);
    });
});
```

- [ ] **Step 2: See it fail**

Run: `npm test -- src/start.test.js`
Expected: FAIL, module not found.

- [ ] **Step 3: Create `src/start.js` with the pure half**

```js
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
```

(The `audio` import is used by Task 4; ESLint warns on unused imports, so if you run lint between tasks, leave it: the warning is not an error.)

- [ ] **Step 4: List the module.** In `src/modules.js` add `'src/start.js'` right after `'src/save-export.js'`.

- [ ] **Step 5: Run tests and lint**

Run: `npm test && npm run lint`
Expected: green (lint may warn about the unused `audio` until Task 4).

- [ ] **Step 6: Commit**

```bash
git add src/start.js src/start.test.js src/modules.js
git commit -m "feat(start): the start model, where the game is, the rows the player has reached

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: The screen

**Files:**
- Modify: `src/start.js` (append the DOM half)
- Create: `style-start.css`
- Test: `src/start.test.js` (append a `describe` with JSDOM)
- Modify: `src/modules.js`, `src/modules.test.js:18`, `index.html:26`

**Interfaces:**
- Consumes: `startModel`, `WORDS`, `audio.getPrefs() → { sfx, music }`, `audio.setPref(name, on)`.
- Produces: `showStart({ storage?, version }) → { root, model, choice: Promise<{ kind: 'continue' } | { kind: 'new' } | { kind: 'act', id }>, lift() }`. Adds `start-up` to `document.body` while up. Dispatches `rpi-audio-change` on `window` when a toggle is clicked (main.js repaints the ☰ labels).

- [ ] **Step 1: Failing DOM tests.** Append to `src/start.test.js`:

```js
import { JSDOM } from 'jsdom';
import { jest } from '@jest/globals';

describe('the screen', () => {
    let dom, showStart, prefs, setPref;
    beforeEach(async () => {
        dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', { url: 'http://localhost/', pretendToBeVisual: true });
        global.window = dom.window; global.document = dom.window.document; global.localStorage = dom.window.localStorage;
        global.CustomEvent = dom.window.CustomEvent; global.KeyboardEvent = dom.window.KeyboardEvent;
        prefs = { sfx: true, music: false };
        setPref = jest.fn((n, on) => { prefs[n] = on; });
        jest.resetModules();
        jest.unstable_mockModule('./audio.js', () => ({ audio: { getPrefs: () => ({ ...prefs }), setPref } }));
        ({ showStart } = await import('./start.js'));
    });
    afterEach(() => { delete global.window; delete global.document; delete global.localStorage; delete global.CustomEvent; delete global.KeyboardEvent; });
    const text = (sel) => [...document.querySelectorAll(sel)].map((e) => e.textContent.trim());

    test('a new player: the title, START, no New game, no rows; START is the choice', async () => {
        const s = showStart({ version: 'v9.9.9' });
        expect(document.body.classList.contains('start-up')).toBe(true);
        expect(document.querySelector('.start-title').textContent).toBe('ROCK PAPER INFINITY');
        expect(document.querySelector('.start-title .start-letter').style.animationDelay).toBe('300ms');
        expect(document.querySelector('[data-start="primary"]').textContent).toBe('START');
        expect(document.querySelector('[data-start="new"]')).toBeNull();
        expect(document.querySelectorAll('.start-acts li').length).toBe(0);
        expect(document.querySelector('.start-version').textContent).toBe('v9.9.9');
        expect(text('[data-pref]')).toEqual(['Sound · on', 'Music · off']);
        document.querySelector('[data-start="primary"]').click();
        expect(await s.choice).toEqual({ kind: 'new' });
        s.lift();
        expect(document.getElementById('start-screen')).toBeNull();
        expect(document.body.classList.contains('start-up')).toBe(false);
    });

    test('a returning player: CONTINUE with the line, New game asks first, the rows', async () => {
        localStorage.setItem('rpi-phase', 'DEEP'); localStorage.setItem('rpi-deep-version', 'dig');
        localStorage.setItem('rpi-reached', JSON.stringify(['trivial', 'capital', 'war', 'drone']));
        const s = showStart({ version: 'v1' });
        expect(document.querySelector('[data-start="primary"]').textContent).toBe('CONTINUE');
        expect(document.querySelector('.start-where').textContent).toBe('IV · Deep, the drone');
        expect(text('.start-acts li')).toEqual(['I Trivial', 'II Capital', 'III War', 'IV Deep · Drone', 'IV Deep · Vault']);
        expect([...document.querySelectorAll('.start-acts li')].map((li) => li.dataset.state)).toEqual(['reached', 'reached', 'reached', 'now', 'grey']);
        document.querySelector('[data-start="new"]').click();
        const confirm = document.querySelector('.start-confirm');
        expect(confirm.hidden).toBe(false);
        expect(confirm.querySelector('.start-confirm-text').textContent).toBe('Your game will be erased.');
        expect(text('.start-confirm button')).toEqual(['Start over', 'Keep']);
        confirm.querySelector('[data-confirm="no"]').click();
        expect(confirm.hidden).toBe(true);
        document.querySelector('[data-start="new"]').click();
        confirm.querySelector('[data-confirm="yes"]').click();
        expect(await s.choice).toEqual({ kind: 'new' });
    });

    test('an act: the current one continues, a reached one asks then starts again, a grey one does nothing', async () => {
        localStorage.setItem('rpi-phase', 'DEEP'); localStorage.setItem('rpi-deep-version', 'dig');
        localStorage.setItem('rpi-reached', JSON.stringify(['trivial', 'capital', 'war', 'drone']));
        let s = showStart({ version: 'v1' });
        document.querySelector('.start-acts li[data-id="vault"]').click();
        expect(document.querySelector('.start-confirm').hidden).toBe(true);
        document.querySelector('.start-acts li[data-id="war"]').click();
        const confirm = document.querySelector('.start-confirm');
        expect(confirm.hidden).toBe(false);
        expect(confirm.querySelector('.start-confirm-text').textContent).toBe('Starting III · War again replaces your game.');
        expect(confirm.querySelector('[data-confirm="yes"]').textContent).toBe('Play again');
        confirm.querySelector('[data-confirm="yes"]').click();
        expect(await s.choice).toEqual({ kind: 'act', id: 'war' });
        s.lift();
        s = showStart({ version: 'v1' });
        document.querySelector('.start-acts li[data-id="drone"]').click();
        expect(await s.choice).toEqual({ kind: 'continue' });
        s.lift();
    });

    test('Enter is the primary word; the toggles set the preference and tell the menu', async () => {
        localStorage.setItem('rpi-phase', 'INDUSTRY'); localStorage.setItem('rpi-reached', '["trivial"]');
        const s = showStart({ version: 'v1' });
        const told = jest.fn(); window.addEventListener('rpi-audio-change', told);
        document.querySelector('[data-pref="music"]').click();
        expect(setPref).toHaveBeenCalledWith('music', true);
        expect(document.querySelector('[data-pref="music"]').textContent).toBe('Music · on');
        expect(told).toHaveBeenCalled();
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        expect(await s.choice).toEqual({ kind: 'continue' });
        s.lift();
    });
});
```

- [ ] **Step 2: See them fail**

Run: `npm test -- src/start.test.js`
Expected: the four new tests FAIL (`showStart` is not a function).

- [ ] **Step 3: Append the DOM half to `src/start.js`**

```js
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
        <div class="start-ring">${HANDS.map(([, k]) => `<div class="start-hand start-hand-${k}"></div>`).join('')}</div>
        <div class="start-hole"></div>
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
    HANDS.forEach(([icon, k]) => { const svg = iconSvg(icon); if (svg) root.querySelector(`.start-hand-${k}`).appendChild(svg); });

    // the title, a letter at a time
    const h1 = root.querySelector('.start-title');
    [...WORDS.title].forEach((ch, i) => {
        const el = document.createElement('span');
        el.className = 'start-letter';
        el.textContent = ch === ' ' ? ' ' : ch;
        el.style.animationDelay = `${TYPE_START_MS + i * TYPE_MS}ms`;
        h1.appendChild(el);
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
        li.innerHTML = `<span class="start-act-n"></span><span class="start-act-t"></span>`;
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
    let onYes = null;
    const ask = (after, text, yesWord, yes) => {
        confirmText.textContent = text;
        confirmYes.textContent = yesWord;
        onYes = yes;
        after.insertAdjacentElement('afterend', confirm);
        confirm.hidden = false;
        confirmYes.focus();
    };
    const closeAsk = () => { confirm.hidden = true; onYes = null; };

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
        if (e.key !== 'Enter' || e.repeat) return;
        const el = document.activeElement;
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
```

Note the act label under the confirm: `actLabel` turns `Deep · Drone` into `IV · Deep, the drone` and the others into `II · Capital`, `III · War`, `V · Unity`. Keep that function; the test for war covers the plain case.

- [ ] **Step 4: Create `style-start.css`** (the mockup's look, scoped):

```css
/* The start screen (B456, src/start.js): chapter I's palette, the cycle with the hole, the title
   typed out, CONTINUE or START, NEW GAME, the acts reached, sound and music, the credit.
   Under the chapter card (1000) so New game's I · TRIVIAL plays over it; above the phases. */
.start-screen {
    position: fixed;
    inset: 0;
    z-index: 900;
    background: #f1f5f9;
    color: #0f172a;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 24px 16px 64px;
    overflow-y: auto;
    user-select: none;
    scrollbar-width: none;
}
.start-screen::-webkit-scrollbar { display: none; }
/* the shell's menu and version line stay out of the way while the screen is up */
body.start-up #menu-wrapper, body.start-up #version-info { display: none !important; }

.start-screen .start-title, .start-screen .start-word, .start-screen .start-act-n, .start-screen .start-act-t {
    font-family: 'Bebas Neue', system-ui, sans-serif;
    letter-spacing: 0.04em;
    font-weight: 400;
}

/* the cycle: rock beats scissors beats paper beats rock, turning round a hole */
.start-cycle { position: relative; width: 220px; height: 220px; margin-bottom: 30px; flex: 0 0 auto; }
.start-cycle::before { content: ''; position: absolute; inset: 22px; border-radius: 50%; border: 1px dashed rgba(15, 23, 42, 0.18); }
.start-ring { position: absolute; inset: 0; animation: start-turn 48s linear infinite; }
.start-hand {
    position: absolute; left: 50%; top: 50%; width: 72px; height: 72px; margin: -36px;
    border-radius: 50%; background: #f8fafc; box-shadow: 0 8px 20px rgba(15, 23, 42, 0.16);
    display: flex; align-items: center; justify-content: center;
    animation: start-unturn 48s linear infinite;
}
.start-hand svg { width: 32px; height: 32px; stroke-width: 1.4; color: #334155; }
.start-hand-rock { translate: 0 -80px; }
.start-hand-scissors { translate: 69px 40px; }
.start-hand-paper { translate: -69px 40px; }
@keyframes start-turn { to { transform: rotate(360deg); } }
@keyframes start-unturn { to { transform: rotate(-360deg); } }
.start-hole {
    position: absolute; left: 50%; top: 50%; width: 22px; height: 22px; margin: -11px; border-radius: 50%;
    background: #000; box-shadow: 0 0 0 10px rgba(0, 0, 0, 0.05), 0 0 0 22px rgba(0, 0, 0, 0.025), inset 0 0 8px #000;
    transition: transform 600ms cubic-bezier(0.2, 0.8, 0.2, 1);
}
.start-cycle:hover .start-hole { transform: scale(2.4); }

/* the title, a letter at a time */
.start-title { margin: 0 0 56px; font-size: clamp(56px, 11vw, 132px); line-height: 0.9; text-align: center; min-height: 0.9em; }
.start-letter { display: inline-block; opacity: 0; animation: start-letter 180ms ease-out forwards; }
@keyframes start-letter { from { opacity: 0; transform: translateY(0.12em); } to { opacity: 1; transform: none; } }

/* CONTINUE or START, the line under it, New game */
.start-main { display: flex; flex-direction: column; align-items: center; }
.start-word {
    background: transparent; color: #0f172a; border: 0; cursor: pointer; padding: 6px 12px; position: relative;
    font-size: 40px; line-height: 1; letter-spacing: 0.08em;
}
.start-word::after {
    content: ''; position: absolute; left: 12px; right: 12px; bottom: 0; height: 2px; background: #0f172a;
    transform: scaleX(0.35); transform-origin: center; transition: transform 300ms;
}
.start-word:hover::after, .start-word:focus-visible::after { transform: scaleX(1); }
.start-where { margin-top: 10px; font-size: 11px; letter-spacing: 0.22em; text-transform: uppercase; color: #64748b; min-height: 1em; }
.start-new { margin-top: 44px; background: transparent; border: 0; cursor: pointer; font-size: 11px; letter-spacing: 0.18em; text-transform: uppercase; color: #94a3b8; }
.start-new:hover, .start-new:focus-visible { color: #0f172a; }

/* the question before erasing or starting an act again */
.start-confirm { margin-top: 14px; display: flex; align-items: center; gap: 14px; font-size: 12px; letter-spacing: 0.08em; color: #0f172a; }
.start-confirm[hidden] { display: none; }
.start-confirm button { background: #0f172a; color: #fff; border: 0; border-radius: 999px; padding: 6px 14px; cursor: pointer; font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase; }
.start-confirm [data-confirm="no"] { background: transparent; color: #64748b; }
.start-confirm [data-confirm="no"]:hover { color: #0f172a; }

/* the acts: one left-aligned block, centred on the page */
.start-acts { list-style: none; margin: 44px auto 0; padding: 0; display: table; }
.start-acts li { display: flex; align-items: baseline; gap: 14px; cursor: pointer; margin-bottom: 10px; color: #0f172a; }
.start-acts .start-act-n { flex: 0 0 40px; text-align: right; font-size: 22px; opacity: 0.55; }
.start-acts .start-act-t { font-size: 22px; letter-spacing: 0.08em; }
.start-acts li:hover .start-act-t, .start-acts li:focus-visible .start-act-t { text-decoration: underline; text-underline-offset: 4px; }
.start-acts li[data-state="now"] .start-act-n { opacity: 1; }
.start-acts li[data-state="grey"] { color: #94a3b8; cursor: default; }
.start-acts li[data-state="grey"]:hover .start-act-t { text-decoration: none; }

/* sound and music, the credit */
.start-foot {
    position: fixed; left: 0; right: 0; bottom: 0; padding: 0 28px 20px;
    display: flex; justify-content: space-between; align-items: flex-end;
    color: #64748b; font-size: 12px; letter-spacing: 0.08em;
}
.start-audio { display: flex; gap: 22px; }
.start-audio button { background: transparent; border: 0; padding: 0; cursor: pointer; color: inherit; font: inherit; letter-spacing: inherit; }
.start-audio button:hover { color: #0f172a; }
.start-by { text-align: right; line-height: 1.6; display: flex; flex-direction: column; }
.start-by b { font-weight: 500; color: #0f172a; }
.start-version { opacity: 0.6; font-family: ui-monospace, Menlo, monospace; font-size: 11px; }

@media (max-width: 479px) {
    .start-cycle { width: 180px; height: 180px; }
    .start-hand { width: 60px; height: 60px; margin: -30px; }
    .start-hand-rock { translate: 0 -64px; }
    .start-hand-scissors { translate: 55px 32px; }
    .start-hand-paper { translate: -55px 32px; }
    .start-title { margin-bottom: 40px; }
    .start-foot { padding: 0 16px 14px; }
}
@media (prefers-reduced-motion: reduce) {
    .start-ring, .start-hand { animation: none; }
    .start-letter { animation: none; opacity: 1; }
}
```

- [ ] **Step 5: Link and list it.** In `index.html` after line 26 (`style-interim.css`) add:

```html
    <link rel="stylesheet" href="style-start.css">
```

In `src/modules.js` add `'style-start.css'` right after `'style-interim.css'`. In `src/modules.test.js` line 18 add `'style-start.css'` to the literal list after `'style-interim.css'`.

- [ ] **Step 6: Run tests and lint**

Run: `npm test && npm run lint`
Expected: green, no warnings from start.js.

- [ ] **Step 7: Commit**

```bash
git add src/start.js src/start.test.js style-start.css index.html src/modules.js src/modules.test.js
git commit -m "feat(start): the screen: the cycle with the hole, the title typed out, CONTINUE or START, New game, the acts, sound and music, the credit

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: The bootstrap shows the screen and acts on the choice

**Files:**
- Modify: `main.js` (imports; the audio menu paint, lines 57-63; `bootstrap()`, lines 201-224)
- Modify: `src/checkpoints.js` (`clearAll` exported as `clearGame`; `jumpTo` and `restore` set the skip flag)
- Modify: `index.html:686` (the ☰ item)
- Test: `src/checkpoints.test.js` (create; small)

**Interfaces:**
- Consumes: `showStart`, `CARD_OF`, `ACTS` (Tasks 3-4), `migrateReached`, `markReached` (Task 1), `START_SKIP_FLAG`, `START_CARD_FLAG`.
- Produces: `clearGame()` exported from `src/checkpoints.js` (what `clearAll` did); `jumpTo`/`restore` write `sessionStorage[START_SKIP_FLAG] = '1'` before reloading.

- [ ] **Step 1: Failing test `src/checkpoints.test.js`** (checkpoints.js imports half the game, so give it a jsdom window first; the import is heavy but works in the other tests, e.g. `src/phase4/tension.test.js`):

```js
/* eslint-env jest */
import { JSDOM } from 'jsdom';

let mod;
beforeAll(async () => {
    const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', { url: 'http://localhost/' });
    global.window = dom.window; global.document = dom.window.document;
    global.localStorage = dom.window.localStorage; global.sessionStorage = dom.window.sessionStorage;
    global.location = dom.window.location;
    mod = await import('./checkpoints.js');
});
afterAll(() => { delete global.window; delete global.document; delete global.localStorage; delete global.sessionStorage; delete global.location; });

test('clearGame drops the game keys and keeps the settings, the reached acts and the slots', () => {
    localStorage.setItem('rpi-save', '{}'); localStorage.setItem('rpi-phase', 'CITY');
    localStorage.setItem('rpi-reached', '["trivial"]'); localStorage.setItem('rpi-audio', '{}'); localStorage.setItem('rpi-slot-1', '{}');
    mod.clearGame();
    expect(localStorage.getItem('rpi-save')).toBeNull();
    expect(localStorage.getItem('rpi-phase')).toBeNull();
    expect(localStorage.getItem('rpi-reached')).toBe('["trivial"]');
    expect(localStorage.getItem('rpi-audio')).toBe('{}');
    expect(localStorage.getItem('rpi-slot-1')).toBe('{}');
});

test('the checkpoints the start screen starts acts from exist', () => {
    for (const id of ['i-start', 'ii-start', 'iii-start', 'iv-dig-start', 'iv-vault-start', 'v-start']) {
        expect(mod.CHECKPOINTS.find((c) => c.id === id)).toBeTruthy();
    }
});
```

- [ ] **Step 2: See it fail**

Run: `npm test -- src/checkpoints.test.js`
Expected: FAIL, `mod.clearGame is not a function`. (If the import itself fails on a missing browser global, add that global in `beforeAll` the way `src/phase4/tension.test.js` does, and keep going.)

- [ ] **Step 3: `src/checkpoints.js`:** rename and export, and set the flag. Change the `clearAll` definition to:

```js
/** Drops every game key; keeps the player's settings (KEEP_KEYS) and the snapshot slots. New game uses it too. */
export function clearGame() {
    try { Object.keys(localStorage).filter(k => k.startsWith('rpi-') && !k.startsWith('rpi-slot-') && !KEEP_KEYS.includes(k)).forEach(k => localStorage.removeItem(k)); } catch { /* ignore */ }
}
const clearAll = clearGame;
```

Add `START_SKIP_FLAG` to the import from `./constants.js`, and in both `restore(i)` and `jumpTo(id)`, right before `location.reload();`:

```js
    try { sessionStorage.setItem(START_SKIP_FLAG, '1'); } catch { /* ignore */ }   // straight into the game after the reload, no start screen
```

- [ ] **Step 4: `index.html`:** before the `reset-btn` line (686) add:

```html
                <button id="start-screen-btn" class="block px-4 py-2 text-sm hover:bg-slate-100 whitespace-nowrap">Start screen</button>
```

- [ ] **Step 5: `main.js`:** the imports. Change the constants import to:

```js
import { PHASE_KEY, DEBUG_KEY, START_SKIP_FLAG, START_CARD_FLAG } from './src/constants.js';
```

(`PHASE1_CONSTANTS`, `PHASE2_CONSTANTS`, `PHASE4_CONSTANTS` were only used by the fresh-player test that goes away.) Add:

```js
import { showStart, CARD_OF, ACTS } from './src/start.js';
import { migrateReached, markReached } from './src/reached.js';
```

and add `jumpTo` is already imported from `./src/checkpoints.js`; add `clearGame` to that import.

- [ ] **Step 6: `main.js`:** the audio menu repaints when the start screen toggles. Replace the `for (const [id, pref, label] of ...)` loop (lines 57-63) with:

```js
// Sound and music on/off in the ☰ menu (src/audio.js keeps and saves the choice).
// The start screen has the same two toggles; it says 'rpi-audio-change' and the menu follows.
const AUDIO_ITEMS = [['sound-toggle', 'sfx', 'Sound'], ['music-toggle', 'music', 'Music']];
function paintAudioMenu() {
  for (const [id, pref, label] of AUDIO_ITEMS) {
    const btn = document.getElementById(id);
    if (btn) btn.textContent = `${label} · ${audio.getPrefs()[pref] ? 'on' : 'off'}`;
  }
}
for (const [id, pref] of AUDIO_ITEMS) {
  document.getElementById(id)?.addEventListener('click', (e) => { e.stopPropagation(); audio.setPref(pref, !audio.getPrefs()[pref]); paintAudioMenu(); });
}
paintAudioMenu();
window.addEventListener('rpi-audio-change', paintAudioMenu);
// ☰ → Start screen: the page again, with the screen in front
document.getElementById('start-screen-btn')?.addEventListener('click', () => window.location.reload());
```

- [ ] **Step 7: `main.js`:** the bootstrap. Replace `async function bootstrap() { ... }` (lines 201-224) with:

```js
function takeFlag(key) {
  try { const v = sessionStorage.getItem(key); if (v !== null) sessionStorage.removeItem(key); return v; } catch { return null; }
}

async function bootstrap() {
  try {
    await preloadIcons();
    replaceIcons();
  } catch (err) {
    console.error('Failed to preload icons', err);
  }

  migrateReached();   // an older game's saves → the acts reached (once)
  const savedPhase = localStorage.getItem(PHASE_KEY) || phases.INDUSTRY;

  // An act started again from the start screen: its checkpoint reloaded the page with this flag;
  // the act's chapter card, then the act.
  const cardFor = takeFlag(START_CARD_FLAG);
  if (cardFor && CARD_OF[cardFor]) {
    await playChapterCard({ ...CARD_OF[cardFor], onMidpoint: () => setPhase(savedPhase).catch((e) => console.error('the act failed to start', e)) });
    return;
  }
  // The test menu, the snapshot slots and the headless scripts reload straight into the game.
  const skip = takeFlag(START_SKIP_FLAG) !== null || /[?&]go(?=&|$)/.test(window.location.search);
  if (skip) { await setPhase(savedPhase); return; }

  const screen = showStart({ version: VERSION });
  const choice = await screen.choice;
  if (choice.kind === 'continue') {
    screen.lift();
    await setPhase(savedPhase);
  } else if (choice.kind === 'new') {
    clearGame();
    markReached('trivial');
    await playChapterCard({ roman: 'I', title: 'TRIVIAL', onMidpoint: () => screen.lift() });
    await setPhase(phases.INDUSTRY);
  } else if (choice.kind === 'act') {
    const act = ACTS.find((a) => a.id === choice.id);
    if (!act?.checkpoint) { screen.lift(); await setPhase(savedPhase); return; }
    try { sessionStorage.setItem(START_CARD_FLAG, act.id); } catch { /* the act starts without its card */ }
    jumpTo(act.checkpoint);   // writes the act's start, sets the skip flag, reloads
  }
}
```

Remove the now-unused `isFreshPlayer` block entirely (it was inside the old bootstrap).

- [ ] **Step 8: Run tests and lint**

Run: `npm test && npm run lint`
Expected: green. (`main.js` is ignored by ESLint; read your edit twice instead.)

- [ ] **Step 9: Open it.** From the worktree: `python3 -m http.server 8132 --bind 127.0.0.1` in the background, then in the browser pane `http://127.0.0.1:8132/`. Check, as a human:
  1. A clean browser profile (or `localStorage.clear()` in the console, reload): the cycle turns, the title types out, **START**, no list. Click START: the `I · TRIVIAL` card, chapter I, the ☰ menu back.
  2. Reload: **CONTINUE** with `I · Trivial`, **New game**, the list `I Trivial`. Enter continues.
  3. In the ☰ menu turn the debug menu on (five clicks on the version label), Jump to `IV vault · arrival`: no start screen after the reload (the flag). Then ☰ → Start screen: the list shows `I Trivial`, `II Capital`, `III War`, `IV Deep · Drone` (grey), `IV Deep · Vault` (now), Continue says `IV · Deep, the vault`.
  4. Click `II Capital`: the question `Starting II · Capital again replaces your game.`, **Play again** → the `II · CAPITAL` card, the city. Keep → nothing.
  5. New game → `Your game will be erased.` → Keep, then Start over → the card, chapter I; reload: the list still has the vault rows (the set survived).
  6. Sound · on → off on the start screen, continue, open ☰: `Sound · off` there too.
  7. `http://127.0.0.1:8132/?go` goes straight in.
  8. Mobile width (`resize_window` mobile): nothing cut off, the list centred.
  Fix what is wrong before committing. Close the tab and stop the server afterwards.

- [ ] **Step 10: Headless scripts still run.** `node scripts/play-dig.mjs --v1928` (needs Chrome at `/Applications/Google Chrome.app`; prints `[...]` lines and no errors). If Chrome is missing, say so in the commit message instead of claiming it ran.

- [ ] **Step 11: Commit**

```bash
git add main.js src/checkpoints.js src/checkpoints.test.js index.html
git commit -m "feat(start): the start screen in front of the game: Continue, New game, an act again from its start; checkpoints skip it; the menu's Start screen item

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 6: Version, changelog, backlog, docs

**Files:**
- Modify: `src/version.js`, `index.html:701`, `package.json:3`, `CHANGELOG.md` (top), `BACKLOG.yaml` (B456), `CLAUDE.md` (file structure), `README.md` if it lists the boot sequence.

- [ ] **Step 1: Bump.** `src/version.js`: `export const VERSION = 'v1.93.0';`. `index.html` line 701: `v1.93.0`. `package.json`: `"version": "1.93.0"`.

- [ ] **Step 2: CHANGELOG.md**, at the top under `# Changelog`:

```markdown
## v1.93.0 - 2026-10-12 (the start screen)

Ola: "a start screen, start or continue, the feeling of rock paper scissors with a hint that it goes deeper." Spec docs/superpowers/specs/2026-10-12-start-screen-design.md, look docs/mockups/start-screen-3.html.
- **The screen** (src/start.js, style-start.css), every time the page opens: rock, scissors and paper turning slowly round a small black hole (it grows under the pointer), ROCK PAPER INFINITY typed out a letter at a time, CONTINUE with where the game is (`IV · Deep, the drone`), NEW GAME, and the acts reached as a list. A new player sees START and nothing else. Sound · on / Music · on bottom left, "A game by Ola Belin" and the version bottom right. Enter is the big word. The first click unlocks the browser's audio, so the first chapter card sounds.
- **The acts reached** (src/reached.js, `rpi-reached`): a set, never a maximum, kept through New game and every checkpoint; the chapter cards mark I, II, III, V, VI, the interim marks drone or vault; an older game's saves are read once. Only reached acts are listed; both chapter IVs appear as soon as one is, the one not chosen grey. VI Infinity appears grey once the VI card has played.
- **An act again:** a click asks (`Starting III · War again replaces your game.` Play again / Keep), then the act's checkpoint and its chapter card. New game asks too (`Your game will be erased.` Start over / Keep).
- ☰ → **Start screen** reloads with the screen in front. The test menu, the snapshot slots and the headless scripts reload straight into the game (`rpi-go`), and `?go` in the URL skips the screen.
```

- [ ] **Step 3: BACKLOG.yaml** B456: make the fields match the file (`added`, `source`, `request`, `status`, `resolved_in`, `notes`):

```yaml
  - id: B456
    added: 2026-10-12
    source: "Ola (chat)"
    request: |
      A start screen every time the page opens: ROCK PAPER INFINITY, rock/scissors/paper turning round a
      small black hole, CONTINUE (where the game is), NEW GAME, the acts reached as a list (I Trivial,
      II Capital, III War, IV Deep Drone, IV Deep Vault, V Unity, VI Infinity); the chapter IV not chosen
      in the interim is grey, no explanation; one save, a separate rpi-reached set. Sound/Music toggles and
      "A game by Ola Belin". A new player sees START only.
    status: done
    resolved_in: v1.93.0
    notes: "Spec docs/superpowers/specs/2026-10-12-start-screen-design.md, look docs/mockups/start-screen-3.html (?new for the new player). src/start.js, src/reached.js, style-start.css."
```

- [ ] **Step 4: CLAUDE.md** file structure: under `src/` add two lines in the list:

```
│   ├── reached.js          # The acts reached, ever (rpi-reached): marked by the chapter cards and the interim, read by the start screen
│   ├── start.js            # The start screen: the model (tested) and the screen built on body; main.js shows it first
```

and `style-start.css` next to `style-interim.css` in the root list. Also update the `main.js` line to: `# Bootstrap: loads icons, shows the start screen, acts on the choice (Continue, New game, an act again)`.

- [ ] **Step 5: Run everything once more**

Run: `npm test && npm run lint`
Expected: green.

- [ ] **Step 6: Commit and push**

```bash
git add src/version.js index.html package.json CHANGELOG.md BACKLOG.yaml CLAUDE.md
git commit -m "v1.93.0: the start screen (B456)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
git fetch origin && git rebase origin/main && npm test && git push -u origin start-screen
```

Then merging to main is the orchestrator's (this session's) job, after Ola's own look: `git push origin start-screen:main` once origin/main has not moved, or rebase again.
