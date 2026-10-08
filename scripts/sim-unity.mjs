// Chapter V · UNITY: a headless player (docs/superpowers/specs/2026-10-06-chapter-v-unity.md).
//   node scripts/sim-unity.mjs [--style=balanced|skin|heart|mind] [--quiet] [--table]
// The player turns GROW AS toward the red word, buys the next experiment, grows toward the vault,
// sets the EDGE right (a beat late, like a person), sends seeds designed for each sea.
// One line a minute; then the measures the spec asks for.
import * as U from '../src/phase5/unity.js';

const arg = (n, d) => (process.argv.find((a) => a.startsWith(`--${n}=`)) || `--${n}=${d}`).split('=')[1];
const STYLE = arg('style', 'balanced');
const QUIET = process.argv.includes('--quiet');
const TABLE = process.argv.includes('--table');
const BIAS = { balanced: {}, skin: { skin: 15 }, heart: { heart: 15 }, mind: { nerve: 15 } }[STYLE] || {};
const DT = 0.25, READ_S = 2.5, CLICK_S = 0.5, LIMIT = Number(arg("limit", 90)) * 60;

const s = U.newUnity();
let readUntil = 0, lastClick = 0, lastTurn = 0, modeSeenAt = -1, modeWant = null, lastAct = 0;
let maxGap = 0, gapFrom = 0;
const bought = [];
const fmt = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
const zoomAt = [];
let redMoves = [], lastRed = null, lastRedAt = 0;

function act(what) { bought.push(what); lastAct = s.t; }
function line() {
    const f = U.flows(s);
    const red = f.red ? f.red.word : '-';
    const flowsTxt = `NUT +${U.big(f.nutrientDay)}/d  MASS ${f.areaDay >= 0 ? '+' : ''}${U.big(f.areaDay < 10 ? Math.round(f.areaDay * 100) / 100 : f.areaDay)} km²/d  POW ${Math.round(Math.min(9.99, f.make / Math.max(1e-9, f.use)) * 100)}%  THO ${U.num(s.thought)}/${U.num(f.cap)}${s.insight >= 0.1 ? ` ins ${s.insight.toFixed(1)}` : ''}`;
    const g = Object.entries(s.grow).filter(([, v]) => v > 0).map(([k, v]) => `${k.slice(0, 3)}${v}`).join(' ');
    if (!QUIET) console.log(`${fmt(s.t).padStart(5)}  ${U.SCALES[s.scale].id.padEnd(9)} ${U.areaText(s).padEnd(18)} ${flowsTxt.padEnd(70)} red ${red.padEnd(17)} [${g}]  ${bought.splice(0).join(', ')}`);
}

function decisionPossible(f) {
    if (s.tut.stop) return true;
    if (!s.ex.auto) return true;     // the hand: bite or buy
    if (U.visibleExperiments(s).some((e) => !U.needText(s, e) && e.kind !== 'seed')) return true;
    if (f.red && s.unlocked[f.red.organ]) return true;
    if (f.yellow && s.unlocked[f.yellow.organ]) return true;
    if (!s.ex.edgeknows && f.at >= 0 && U.modeMult(s.mode, f.at) < 1) return true;
    if (s.scale >= 4 && s.ex.seeds && !s.one) return true;
    return false;
}

let nextLine = 60;
while (s.t < LIMIT && !s.ended) {
    const now = s.t;
    // a stop: read it, then OK
    if (s.tut.stop) {
        if (!readUntil) readUntil = now + READ_S;
        if (now >= readUntil) { U.closeStop(s); readUntil = 0; lastAct = s.t; }
        s.t += DT;     // the clock of the person, not the game
        continue;
    }
    if (s.zoom) { zoomAt.push({ t: s.t, from: s.zoom.from }); s.t += 3.5; U.zoomDone(s); continue; }
    const f = U.flows(s);
    // fas 1, the hand
    if (!s.ex.auto) {
        if (now - lastClick >= CLICK_S) {
            lastClick = now;
            const fr = U.front(s, 1);
            if (fr.length && U.bite(s, fr[0]) >= 0) lastAct = now;
        }
        const want = f.p < 0.85 ? 'heart' : s.pool > 3 ? 'stomach' : s.mass.skin < s.mass.stomach * 1.2 ? 'skin' : 'stomach';
        if (U.buyMass(s, want)) act(`${want}+`);
    }
    // experiments: the cheapest that can be paid; the small ones when nothing big is near
    const vis = U.visibleExperiments(s).filter((e) => !U.needText(s, e) && e.kind !== 'seed');
    const big = vis.find((e) => e.kind === 'ex' || e.kind === 'join');
    const nx = f.next;
    const nearBig = nx && !nx.ins && f.eta < 25;
    // a red word whose fix is an experiment: save for that one (a person reads the guide)
    const saving = f.red && f.red.fix && !s.ex[f.red.fix] && U.visibleExperiments(s).some((e) => e.id === f.red.fix);
    const pick = big || (!nearBig && !saving ? vis.find((e) => e.kind === 'multi') : null);
    if (pick && U.buy(s, pick.id)) act(pick.title);
    // GROW AS toward the red word
    if (s.ex.auto && now - lastTurn > 3) {
        lastTurn = now;
        const want = {};
        for (const [k, v] of Object.entries(BIAS)) if (s.unlocked[k]) want[k] = v;
        // a red word whose fix is an experiment: think faster (or remember more) instead
        const target = f.red && f.red.fix && !s.ex[f.red.fix] ? (f.red.organ === 'brain' && s.unlocked.brain ? 'brain' : 'nerve') : f.red && f.red.organ;
        if (target && s.unlocked[target] && s.grow[target] != null && s.grow[target] < 60) {
            // +10 to the red organ, taken from the biggest organ that is not in trouble
            const o = target;
            const ok = (k) => !f.factors.some((x) => x.organ === k && x.value < 0.95);
            const donors = (pred) => Object.keys(s.grow).filter((k) => k !== o && pred(k) && s.grow[k] >= 5).sort((a, b) => s.grow[b] - s.grow[a]);
            const donor = donors(ok)[0] || donors(() => true)[0];
            if (donor) {
                const take = Math.min(10, s.grow[donor]);
                const g = { ...s.grow }; g[donor] -= take; g[o] += take;
                for (const k of Object.keys(g)) s.grow[k] = g[k];
                act(`grow ${o} ${s.grow[o]}`);
            }
        } else if (!f.red) {
            // nothing red: lean back toward a sane spread (and the style's bias)
            for (const [k, v] of Object.entries(want)) if (s.grow[k] < 10 + v) U.setGrow(s, k, s.grow[k] + 5);
        }
    }
    // the edge mode, a beat late
    if (!s.ex.edgeknows && f.at >= 0) {
        const best = U.bestMode(f.at);
        if (best !== s.mode) {
            if (modeWant !== best) { modeWant = best; modeSeenAt = now; }
            if (now - modeSeenAt > 2) { U.setMode(s, best); act(best); }
        }
    }
    // the minds: enough memory for what we want next
    if (s.scale >= 1 || s.ex.parallel) {
        const need = nx && !nx.ins ? nx.price : 0;
        const brain = f.cap - s.memory * U.MEM_K;
        const memWant = Math.min(s.minds, Math.max(STYLE === 'mind' ? s.minds * 0.6 : s.minds * 0.3, Math.ceil((need - brain) / U.MEM_K) + 4));
        if (Math.abs(memWant - s.memory) >= 5) { U.setMemory(s, memWant); act(`memory ${s.memory}`); }
    }
    // direction: the vault when it is seen
    const m = U.mapFor(s.seed, s.scale);
    if (m.vault >= 0 && s.seen[s.scale] && !s.joined[s.scale] && s.target !== m.vault) { U.setTarget(s, m.vault); act('toward the vault'); }
    if (s.joined[s.scale] && s.target >= 0) U.setTarget(s, s.target);
    // seeds: designed for each sea (a person who has read what the last one said)
    if (s.scale >= 4 && s.ex.seeds && !s.one && now - (globalThis.seedAt || 0) > 6) {
        globalThis.seedAt = now;
        const sea = U.seas(s).find((x) => s.seeds.continents[x.k] !== 'joined');
        if (sea) {
            const d = { drift: sea.dist, skin: sea.salt, roots: sea.join, mind: 1 };
            d.acid = Math.max(0, U.SEED_POINTS - d.drift - d.skin - d.roots - d.mind);
            U.setDesign(s, d);
            act(`seed ${sea.k}: ${U.sendSeed(s, sea.k)}`);
        }
    }
    U.advance(s, DT);
    s.out.length = 0; s.sfx.length = 0;
    const f2 = U.flows(s);
    if (decisionPossible(f2)) { if (s.t - gapFrom > maxGap) { maxGap = s.t - gapFrom; globalThis.gapAt = `${fmt(gapFrom)}-${fmt(s.t)} ${U.SCALES[s.scale].id}`; } gapFrom = s.t; }
    // the bottleneck as the player sees it: the red word, else the yellow one, else the lowest factor;
    // in fas 2 it should move at least every 90 s
    const shown = f2.red || f2.yellow || f2.low;
    const r = shown ? shown.organ : null;
    const fas2From = zoomAt.length ? zoomAt[0].t : Infinity;
    if (r !== lastRed && r) {
        const from = Math.max(lastRedAt, fas2From);
        if (s.scale >= 1 && s.scale <= 3 && s.t > from) { redMoves.push(s.t - from); if (s.t - from >= Math.max(...redMoves)) globalThis.redAt = `${fmt(from)}-${fmt(s.t)} ${lastRed}`; }
        lastRed = r; lastRedAt = s.t;
    }
    if (s.t >= nextLine) { line(); nextLine += 60; }
}
line(); if (process.argv.includes("--dbg")) { console.log(JSON.stringify({ex:s.ex, vis:U.visibleExperiments(s).map(e=>[e.id,U.needText(s,e)]), ins:s.insight, stop:s.tut.stop, minds:s.minds, mem:s.memory, seen:s.seen, joined:s.joined})); }
const p1 = zoomAt.find((z) => z.from === 0);
const fas2 = [s.scale >= 4 ? zoomAt.find((z) => z.from === 3) : null].filter(Boolean)[0];
const gaps = redMoves.length ? Math.max(...redMoves) : 0;
const summary = {
    style: STYLE,
    end: s.ended ? fmt(s.t) : `not ended (${U.SCALES[s.scale].id}, ${U.areaText(s)})`,
    city: p1 ? fmt(p1.t) : '-',
    zooms: zoomAt.map((z) => fmt(z.t)).join(' '),
    fas2: p1 && fas2 ? fmt(fas2.t - p1.t) : '-',
    redMovesFas2: redMoves.length,
    longestRedFas2: `${Math.round(gaps)} s`,
    longestNoDecision: `${Math.round(maxGap)} s`,
    gapAt: globalThis.gapAt, redAt: globalThis.redAt,
    minds: s.minds,
    experiments: Object.keys(s.ex).length,
};
console.log(TABLE ? `| ${STYLE} | ${summary.end} | ${summary.city} | ${summary.zooms} | ${summary.redMovesFas2} | ${summary.longestRedFas2} | ${summary.longestNoDecision} |` : summary);
