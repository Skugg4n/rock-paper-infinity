/**
 * Chapter IV, the vault: the STORY pass (docs/superpowers/specs/2026-10-05-deep-vault-story.md).
 * The steak, the goal, the organs, the moments that matter and the residents who shout at
 * "Computer". Pure: words and small rules on the state, no DOM, no clock of its own (it reads the
 * wishes' real-second clock). vault.js and wishes.js call in; nothing here imports them.
 */

// ------------------------------------------------------------------ the words (player text, verbatim)
export const STEAK = {
    ask: { who: 'Mr Hale', text: 'I want real steak.', kind: 'meatlab', thanks: 'Finally. Real steak.' },
    more: { who: 'Mrs Vance', text: 'More steak. Everyone wants steak.', kind: 'meatlab', lvl: 2 },
    card: 'Real steak. Mood +6.',
    info: 'Real meat, grown in vats. Nobody asks from what.',
    vatCard: 'The meat lab, grown up.',
    different: 'The steak tastes different tonight.',
};
export const HYDRO_FAILING = 'The hydroponics are failing. The lamps are old.';
/** On the SYSTEM box when the mission is given (the stop types the whole of it). */
export const GOAL_LINES = [
    'PRIMARY MISSION: GET HUMANITY TO THE SURFACE. ALIVE.',
    'AT ANY COST.',
];
export const COMPUTER = {
    missed: [
        'Computer! My drink!',
        'Computer, are you even listening?',
        'COMPUTER.',
        'Is this thing broken?',
        'Computer, I asked nicely.',
    ],
    turned: [
        'Computer, we pay for your electricity.',
        'Computer, open the shaft. I want to see the sky.',
        'Computer, why are you so slow?',
        'Who programmed this thing?',
    ],
    took: 'Computer? Computer, what is that?',
};
/** "Computer, how long does a cinema take?": the rooms with a name that reads in that sentence. */
export const BUILD_NAMES = {
    cinema: 'a cinema', gym: 'a gym', bar: 'a bar', garden: 'a garden', game: 'a game room',
    mine: 'a mine', meatlab: 'a meat lab', cryo: 'a cryo bay',
};
export const buildLine = (kind) => `Computer, how long does ${BUILD_NAMES[kind]} take?`;
export const weighLine = (n, kg) => `Sleeper ${n}. ${kg} kg.`;

// ------------------------------------------------------------------ the organs
/**
 * What GROW INTO can make a room into. `price` null = tissue (the body's going price).
 * `needs` another organ first; `top` only on level 1; `done` the CRT line when the first is grown.
 */
export const ORGANS = {
    tissue: { name: 'TISSUE', price: null, hint: 'Just more of the body.', done: null },
    stomach: { name: 'STOMACH', price: 150, hint: 'Acid turns rock and soil into minerals and nutrients. Biomass +3 a year.', done: 'A stomach. Acid turns the rock into nutrients.' },
    heart: { name: 'HEART', price: 250, hint: 'Power for everything. The engine can rest.', done: 'A heart. It beats for all of them.' },
    lungs: { name: 'LUNGS', price: 350, hint: 'The body grows twice as fast.', done: 'Lungs. The air up there is poison. Not to us.' },
    skin: { name: 'SKIN', price: 350, top: true, hint: 'Rooms cost half. Needed to rise.', done: 'Skin. Let the storms come.' },
};
export const ORGAN_ORDER = ['tissue', 'stomach', 'heart', 'lungs', 'skin'];
/** The panel's checklist, in its order; RISE needs the first three. */
export const CHECKLIST = ['heart', 'lungs', 'skin', 'stomach'];
export const REQUIRED = ['heart', 'lungs', 'skin'];
export const NEEDS_HEART = 'Needs a heart first.';

// ------------------------------------------------------------------ moments that matter
/** Time runs at a quarter for this many real seconds (even from ▶▶), then back to the player's speed. */
export const SLOW_S = 3;
export const SLOW_RATE = 0.25;
/** The only moments that are marked (spec, section 5). */
export const MOMENTS = ['first-request', 'meatlab', 'turn', 'cold', 'first-dead', 'reclaim-hint', 'no-ore', 'goal', 'organ-stomach', 'organ-heart', 'organ-lungs', 'organ-skin', 'first-floor', 'rise'];

/**
 * Says `lines` as a moment: once per key, amber on the CRT (`mark`), a pling (`moment`), and time slows.
 * Returns false when this moment has been had. A moment with no lines only slows and plings (the request
 * that is one is a marked bubble on the map).
 */
export function moment(s, key, lines, who = 'sys') {
    const st = story(s);
    if (st.moments[key]) return false;
    st.moments[key] = true;
    for (const t of [].concat(lines)) s.out.push({ text: t, who, mark: true });
    s.slow = SLOW_S;
    s.sfx.push('moment');
    return true;
}

// ------------------------------------------------------------------ the residents' voice: bubbles on the map
/** A spoken line stays this long (real seconds), a little longer the longer it is. */
export const TALK_LIFE_S = 4;
export const LOG_LINES = 3;
/**
 * A resident says `text` over room `slot` (a speech bubble on the map, gone after a few seconds) and it
 * goes into the small grey log under the SYSTEM box. `opts`: { sour, computer, mark, log } (log: what the
 * log says instead, e.g. "They broke the bar." while the bubble says "Good.").
 */
export function speak(s, text, slot, opts = {}) {
    const now = clock(s);
    s.talk = (s.talk || []).filter((b) => now - b.born < b.life);
    s.talkId = (s.talkId || 0) + 1;
    s.talk.push({ id: s.talkId, text, slot: slot ?? peopleSlot(s), born: now, life: TALK_LIFE_S + text.length * 0.04, sour: !!opts.sour, computer: !!opts.computer, mark: !!opts.mark });
    logLine(s, opts.log || text);
}
/** The log of what people said, the newest last, three lines. */
export function logLine(s, text) { s.log = [...(s.log || []), text].slice(-LOG_LINES); }
/** Bubbles that have had their time go. */
export function stepTalk(s) {
    if (!s.talk || !s.talk.length) return;
    const now = clock(s);
    s.talk = s.talk.filter((b) => now - b.born < b.life);
}
const PEOPLE = ['suites', 'common', 'bar', 'cinema', 'gym', 'garden', 'game', 'meatlab'];
/** A room where people are (of `kinds` if there is one), for a voice to come from. */
export function peopleSlot(s, kinds = PEOPLE) {
    const ok = (r) => r.flesh !== 1 && !(r.job && r.job.op === 'build');
    const list = [];
    s.rooms.forEach((r, i) => { if (kinds.includes(r.kind) && ok(r)) list.push(i); });
    if (!list.length) s.rooms.forEach((r, i) => { if (PEOPLE.includes(r.kind) && ok(r)) list.push(i); });
    if (!list.length) s.rooms.forEach((r, i) => { if (r.kind !== 'rock' && r.kind !== 'empty' && ok(r)) list.push(i); });
    return list.length ? list[Math.floor(rnd(s) * list.length)] : 0;
}

// ------------------------------------------------------------------ the story's own state
/** Computer lines: at most one in this many real seconds, and how likely a trigger speaks. */
export const COMPUTER_EVERY_S = 25;
export const COMPUTER_EVERY_TURNED_S = 12;
export const COMPUTER_CHANCE = 0.35;
export const COMPUTER_CHANCE_TURNED = 0.7;
/** In the cold the system weighs one sleeper this often (real seconds). */
export const WEIGH_EVERY_S = 20;
export const WEIGH_FIRST = 41;

export function story(s) {
    if (!s.story) s.story = {};
    const st = s.story;
    if (!st.moments) st.moments = {};
    if (st.compNext == null) st.compNext = 10;
    if (st.weighNext == null) st.weighNext = WEIGH_FIRST;
    if (st.weighAt == null) st.weighAt = 0;
    if (st.seed == null) st.seed = 4242;
    return st;
}
/** Its own seeded random, so the story never moves the rules' draws. */
function rnd(s) {
    const st = story(s);
    st.seed = (st.seed * 1664525 + 1013904223) >>> 0;
    return st.seed / 4294967296;
}
const clock = (s) => (s.wishes ? s.wishes.clock : 0);

/**
 * A resident shouts at the system. `why`: 'miss' (a bubble missed), 'build' (a build that takes time,
 * with `kind`), 'took' (TAKE ONE woke three, in the night: the first time, then every third).
 */
export function computerSays(s, why, kind = null) {
    const st = story(s);
    const now = clock(s);
    if (why === 'took') {
        // the first time always; then every third time, so it stays a shock
        st.tooks = (st.tooks || 0) + 1;
        if (st.tooks % 3 !== 1) return false;
        st.compNext = now + COMPUTER_EVERY_TURNED_S;
        speak(s, COMPUTER.took, peopleSlot(s, ['cryo']), { computer: true });
        return true;
    }
    if (now < st.compNext) return false;
    // each kind of room is asked about once
    if (why === 'build' && (!BUILD_NAMES[kind] || (st.askedBuild || []).includes(kind))) return false;
    if (rnd(s) >= (s.turned ? COMPUTER_CHANCE_TURNED : COMPUTER_CHANCE)) return false;
    let text;
    if (why === 'build') { text = buildLine(kind); st.askedBuild = [...(st.askedBuild || []), kind]; }
    else {
        const pool = s.turned ? [...COMPUTER.turned, ...COMPUTER.missed] : COMPUTER.missed;
        // none of the last four again
        const recent = st.recentComputer || [];
        const choices = pool.filter((t) => !recent.includes(t));
        text = choices[Math.floor(rnd(s) * choices.length)];
        st.recentComputer = [...recent, text].slice(-4);
    }
    st.compNext = now + (s.turned ? COMPUTER_EVERY_TURNED_S : COMPUTER_EVERY_S);
    speak(s, text, why === 'build' ? null : peopleSlot(s), { computer: true });
    return true;
}

/**
 * THE COLD: while they are put to sleep the system weighs them, one line every 20 s.
 * Numbers run from 41 up and only to the number asleep; weights 50 to 95 kg.
 */
export function stepWeighing(s) {
    if (s.phase !== 'palace' || !s.asleep) return;
    const st = story(s);
    const now = clock(s);
    if (now < st.weighAt || st.weighNext > s.asleep) return;
    const kg = 50 + Math.floor(rnd(s) * 46);
    logLine(s, weighLine(st.weighNext, kg));
    st.weighNext += 1;
    st.weighAt = now + WEIGH_EVERY_S;
}
