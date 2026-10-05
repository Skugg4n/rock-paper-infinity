// Chapter IV, the vault: a headless run of a plausible human player.
//   node scripts/sim-vault.mjs [--quiet]
// Prints one line a minute (and the moments that matter), then the summary the spec asks for.
import * as V from '../src/phase4v/vault.js';
import { popWish } from '../src/phase4v/wishes.js';
const POP = Number((process.argv.find((a) => a.startsWith('--pop=')) || '--pop=0.75').slice(6));
let popped = 0, seen = new Set(), wished = 0;

const DT = 0.25;
const s = V.newVault();
let t = 0, speed = 1;
let bought = [];
const buys = [];          // { t, what }
const events = [];
let lastReq = '';
let turnAt = null, coldAt = null, nightAt = null, endAt = null, firstBuyAt = null;
let lastActAt = 0;

const fmt = (sec) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;
const note = (what) => { bought.push(what); if (bought.length > 14) bought.splice(0, bought.length - 14); buys.push({ t, what }); if (firstBuyAt == null) firstBuyAt = t; };

function slotsWhere(pred) { return s.rooms.map((r, i) => (pred(r, i) ? i : -1)).filter((i) => i >= 0); }
function placeFor(kind) {
    const deep = V.KINDS[kind].deep;
    const empty = slotsWhere((r, i) => V.canPlace(s, kind, i) && r.kind === 'empty' && (!deep || V.levelOf(i) > 0));
    if (empty.length) return { slot: empty[0] };
    const rock = slotsWhere((r, i) => V.canDig(s, i) && (!deep || V.levelOf(i) > 0) && (deep || V.levelOf(i) < 2));
    const anyRock = rock.length ? rock : slotsWhere((r, i) => V.canDig(s, i));
    if (anyRock.length) return { dig: anyRock[0] };
    return null;
}
const digging = () => s.rooms.some((r) => r.job && r.job.op === 'dig');
function tryBuild(kind) {
    const p = placeFor(kind);
    if (!p) return false;
    if (p.slot != null) { if (s.ore >= V.KINDS[kind].price && V.build(s, kind, p.slot)) { note(`${kind}`); return true; } return false; }
    if (digging()) return false;
    if (s.ore >= V.DIG_PRICE && V.dig(s, p.dig)) { note('dig'); return true; }
    return false;
}
function tryUpgrade(kind) {
    const rs = slotsWhere((r) => r.kind === kind && !r.job && !r.flesh && !r.broken && V.upgradePrice(r) != null);
    rs.sort((a, b) => s.rooms[a].lvl - s.rooms[b].lvl);
    for (const i of rs) if (s.ore >= V.upgradePrice(s.rooms[i])) { V.upgrade(s, i); note(`${kind}+`); return true; }
    return false;
}
const count = (k) => s.rooms.filter((r) => r.kind === k).length;

function palaceMove() {
    // repair first
    for (const [i, r] of s.rooms.entries()) if (r.broken && !r.job && s.ore >= V.REPAIR_PRICE) { V.repair(s, i); note('repair'); return true; }
    const p = V.power(s);
    if (p.make - p.use < 6 && tryUpgrade('engine')) return true;
    if (V.awake(s) > V.food(s) && tryUpgrade('hydro')) return true;
    const req = s.request;
    if (req && req.kind) {
        if (req.kind === 'engine') { if (tryUpgrade('engine')) return true; }
        else if (req.lvl && req.lvl > 1) { if (tryUpgrade(req.kind)) return true; }
        else if (tryBuild(req.kind)) return true;
        // saving for it
        if (s.ore < 260) return false;
    }
    if (s.coldOpen) {
        const m = V.mood(s);
        // pods for everybody
        if (V.pods(s) < s.residents && tryBuild('cryo')) return true;
        if (V.pods(s) < s.residents && tryUpgrade('cryo')) return true;
        if (V.canSleepAll(s) && (m < 40 || V.awake(s) <= 60)) { V.sleepAll(s); note('SLEEP ALL'); return true; }
        if (m < 50 && V.freePods(s) > 0 && t - lastActAt > 2) { V.sleepSome(s, 10); note('sleep10'); return true; }
        return false;
    }
    if (count('mine') < 2 && s.day > 15 && tryBuild('mine')) return true;
    if (V.homeless(s) > 0 && count('suites') < 4 && tryBuild('suites')) return true;
    for (const k of V.FUN) if (count(k) === 0 && s.day > 20 && tryBuild(k)) return true;
    if (tryUpgrade('mine')) return true;
    // stale rooms: upgrade the most bored
    const stale = slotsWhere((r) => V.FUN.includes(r.kind) && !r.job && !r.broken && V.novelty(s, r) < 0.6 && V.upgradePrice(r) != null);
    for (const i of stale) if (s.ore >= V.upgradePrice(s.rooms[i])) { V.upgrade(s, i); note(`${s.rooms[i].kind}+`); return true; }
    return false;
}

function nightMove() {
    if (s.fallen.length) { V.reclaim(s); note('reclaim'); return true; }
    const p = V.power(s);
    const vats = count('vat');
    if (s.reclaimed > 0 && (vats < 2 || (p.short && vats < 4)) && s.ore >= 150 && s.bio >= 70) {
        const i = slotsWhere((r, j) => V.canPlace(s, 'vat', j)).sort((a, b) => b - a)[0];
        if (i != null && V.build(s, 'vat', i)) { note('vat'); return true; }
    }
    const g = slotsWhere((r, i) => V.canGrowInto(s, i));
    if (g.length && s.bio >= V.growPrice(s)) { V.growInto(s, g[0]); note('grow'); return true; }
    if (g.length && s.bio < V.growPrice(s) && V.canTake(s) && !s.rooms.some((r) => r.job && r.job.op === 'grow') && t - lastActAt > 3) { V.takeOne(s); note('take'); return true; }
    if (V.riseReady(s)) { V.rise(s); note('RISE'); return true; }
    return false;
}

let lastMinute = -1;
const rows = [];
while (t < 40 * 60 && !s.risen) {
    // a human acts about twice a second at most
    if (Math.round(t / DT) % 2 === 0) {
        const moved = s.phase === 'night' ? nightMove() : palaceMove();
        if (moved) lastActAt = t;
    }
    // ▶▶ when there is nothing to do for a while
    // the wishes: a human clicks most of them, 1 to 5 s after they show
    for (const b of [...(s.wishes?.list || [])]) {
        if (b.ghost) continue;
        if (!seen.has(b.id)) { seen.add(b.id); wished++; b.simAt = (Math.sin(b.id * 91.7) * 0.5 + 0.5) < POP ? 1 + ((b.id * 37) % 40) / 10 : 99; }
        if (s.wishes.clock - b.born >= b.simAt && popWish(s, b.id)) popped++;
    }
    speed = s.phase === 'night' ? (s.rooms.some((r) => r.job && r.job.op === 'grow') || s.fallen.length || t - lastActAt < 10 ? 1 : 2) : (t - lastActAt > 20 ? 2 : 1);
    V.advance(s, DT, speed);
    for (const o of s.out) {
        if (o.text === lastReq) continue;
        if (/^(SURFACE|CRYO BAY|Woke|Level|POD 41)/.test(o.text)) events.push(`${fmt(t)}  ${o.text}`);
    }
    s.out.length = 0; s.sfx.length = 0;
    if (s.turned && turnAt == null) turnAt = t;
    if (s.coldOpen && coldAt == null) coldAt = t;
    if (s.phase === 'night' && nightAt == null) nightAt = t;
    if (s.ended && endAt == null) endAt = t;
    const minute = Math.floor(t / 60);
    if (minute !== lastMinute) {
        lastMinute = minute;
        const when = s.phase === 'palace' ? `day ${Math.floor(s.day)}` : `year ${V.num(s.year)}`;
        const mb = V.hasVat(s) ? `body ${Math.round(V.bodyShare(s) * 100)}%` : `mood ${V.mood(s)}%`;
        const p = V.power(s);
        rows.push(`| ${minute} | ${s.phase} | ${when} | ${s.residents}/${s.asleep} | ${Math.floor(s.ore)} | ${p.make}/${p.use} | ${mb} | ${Math.floor(s.bio)} | ${bought.join(' ') || '-'} | ${s.request ? s.request.text : '-'} |`);
        bought = [];
    }
    t += DT;
}
// gaps in act I between buys
let maxGap = 0, gapAt = 0;
const actI = buys.filter((b) => b.t < (turnAt ?? 600));
for (let k = 1; k < actI.length; k++) { const g = actI[k].t - actI[k - 1].t; if (g > maxGap) { maxGap = g; gapAt = actI[k - 1].t; } }
console.log('| min | phase | day/year | residents/asleep | ore | power make/use | mood/body | bio | bought | request |');
console.log('|---|---|---|---|---|---|---|---|---|---|');
for (const r of rows) console.log(r);
console.log('');
for (const e of events) console.log(e);
console.log('');
console.log(`wishes ${wished}, popped ${popped}`);
console.log(`first buy ${fmt(firstBuyAt ?? 0)}; longest gap between buys in act I ${Math.round(maxGap)} s (at ${fmt(gapAt)}); turn ${turnAt != null ? fmt(turnAt) : '-'}; cold ${coldAt != null ? fmt(coldAt) : '-'}; night ${nightAt != null ? fmt(nightAt) : '-'}; everyone here ${endAt != null ? fmt(endAt) : '-'}; risen ${s.risen ? fmt(t) : '-'}`);
