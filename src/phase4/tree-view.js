/**
 * Chapter IV · THE DEEP: the skill tree's panel (deep-tree, step 1). The look is mockup 10's
 * mechanical state (docs/mockups/deep-tree-10.html, tab "early"): a circuit board, square nodes on
 * the mockup's grid, traces at right angles, mono labels, level pips, and ONE fixed info box under
 * the board where a hovered node says what it is. No floating tooltips.
 *
 * Hover life: the trace from the root to the node lights in sequence, the node lifts a pixel, its
 * pips tick once. A click buys one level, a shift-click as many as can be paid. The rules are
 * tree.js's; this file only draws them and hands the clicks back to the phase.
 *
 * The board is built once; after that a refresh only rebuilds the nodes whose look changed (their
 * status, level, orders or price), never per frame.
 *
 * deep-voice (step 2): THE NIGHT LOG down the left edge of the board (mockup 12, tab "the voice"):
 * every line Surface has said, in order, in its warm mono, each tied by a thin dotted thread to the
 * node it opened. A node Surface has opened has its ring filled; the info box quotes the line.
 *
 * deep-night (step 3b): under the lines, the sentence as far as it is known (it is no longer on
 * screen between visits), and a last line that says what the next night waits for.
 *
 * deep-fix: the balances live at the top edge of the panel (ore, stars, and asleep the capacity), so
 * nothing is bought blind, and the info box's effect line carries its before and after numbers
 * (tree.js effectLine, a dry run on a copy), worked out only for the node under the cursor.
 */

import {
    NODES, NODE_BY_ID, BOARD, NODE, ROOT_SIZE, TAGS, BRANCHES, tracePath, chainTo, nodeStatus, nightLog, nightNext,
    effectLine,
} from './tree.js';
import { capacityMax } from './watcher.js';
import { sentenceShown } from './surface.js';
import { short } from './readout.js';

const SVG = 'http://www.w3.org/2000/svg';
const PL = '#d5dbe3', RK = '#0a0d12', BR = '#ffffff', BIO = '#e6b9a1', WARM = '#cfc9bb';
const op = (a) => `rgba(213,219,227,${a})`;
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
/** The board in its own units, with room round it for the labels that hang off the edge nodes. */
const VIEW = { x: -70, y: -20, w: BOARD.w + 100, h: BOARD.h + 40 };
/** deep-voice: once Surface has spoken, the view opens to the left for the night log, and above
 *  and below the board for the threads that run round it. */
const VIEW_LOG = { x: -380, y: -34, w: BOARD.w + 410, h: BOARD.h + 70 };
/** The night log: where its lines start, how wide they may run, the mono's width per point. */
const LOG = { x: -350, y: 18, w: 262, fs: 15, lh: 20, gap: 26, cw: 0.6 };
/** How each night's thread runs from the log to its node: straight across, or round the board's
 *  top or bottom edge (and in from the node's left, or its right). */
const ROUTE = { watchdog: 'top', lossless: 'bottomright', cold: 'bottom', quiet: 'left', longcount: 'bottom', question: 'left' };
/** A line broken into rows of at most `n` characters, at the spaces. */
function wrap(line, n) {
    const rows = [];
    let row = '';
    for (const word of line.split(' ')) {
        if (row && (row + ' ' + word).length > n) { rows.push(row); row = word; } else row = row ? `${row} ${word}` : word;
    }
    if (row) rows.push(row);
    return rows;
}

function text(x, y, s, o = {}) {
    return `<text x="${x}" y="${y}" text-anchor="${o.a || 'start'}" fill="${o.c || PL}" font-size="${o.s || 10}"`
        + `${o.ls ? ` letter-spacing="${o.ls}"` : ''}${o.w ? ` font-weight="${o.w}"` : ''}${o.cls ? ` class="${o.cls}"` : ''}>${esc(s)}</text>`;
}
const poly = (pts) => `M ${pts.map((p) => `${p[0]} ${p[1]}`).join(' L ')}`;

/**
 * @param {HTMLElement} host - the panel (#deep-tree), with an <svg> and the info box inside
 * @param {object} o
 * @param {() => object} o.state - the colony now
 * @param {() => object} o.ctx - tree.js's context (the cryo reason, stars a day, asleep)
 * @param {(id:string, many:boolean) => void} o.onBuy
 */
export function createTreeView(host, { state, ctx, onBuy }) {
    const svg = host.querySelector('svg.deep-tree-board');
    // deep-fix: the balances at the top edge
    const bal = {
        ore: host.querySelector('.deep-tree-bal .tb-ore'),
        stars: host.querySelector('.deep-tree-bal .tb-stars'),
        cap: host.querySelector('.deep-tree-bal .tb-cap'),
    };
    let effect = { key: '', text: '' };      // the hovered node's effect line, worked out once a change
    const info = {
        box: host.querySelector('.deep-tree-info'),
        name: host.querySelector('.deep-tree-info .ib-name'),
        lvl: host.querySelector('.deep-tree-info .ib-lvl'),
        cost: host.querySelector('.deep-tree-info .ib-cost'),
        eff: host.querySelector('.deep-tree-info .ib-eff'),
        x: host.querySelector('.deep-tree-info .ib-x'),
        q: host.querySelector('.deep-tree-info .ib-q'),
    };
    const ac = new AbortController();
    const signal = ac.signal;
    let built = false;
    let isOpen = false;
    let hoverId = null;
    const els = {};                 // id -> { g, trace, corners, key }
    const tagEls = {};
    let lit = null;
    let last = {};                  // id -> the status the node was last drawn from
    let logG = null, threadG = null;
    let logKey = null;              // what the night log was last drawn from
    let logged = [];                // for the tests: [{ n, line, to, thread }]
    let loggedNext = '';            // for the tests: the log's last line, what the next night waits for

    function build() {
        svg.setAttribute('viewBox', `${VIEW.x} ${VIEW.y} ${VIEW.w} ${VIEW.h}`);
        let h = `<defs><pattern id="deep-tree-dots" width="20" height="20" patternUnits="userSpaceOnUse">`
            + `<rect x="9.5" y="9.5" width="1" height="1" fill="${op(0.10)}"/></pattern></defs>`;
        h += `<rect x="0" y="0" width="${BOARD.w}" height="${BOARD.h}" fill="url(#deep-tree-dots)"/>`;
        h += `<rect x="0.5" y="0.5" width="${BOARD.w - 1}" height="${BOARD.h - 1}" fill="none" stroke="${op(0.16)}"/>`;
        for (const c of [[0, 0, 1, 1], [BOARD.w, 0, -1, 1], [0, BOARD.h, 1, -1], [BOARD.w, BOARD.h, -1, -1]]) {
            h += `<path d="M ${c[0] + c[2] * 22} ${c[1]} L ${c[0]} ${c[1]} L ${c[0]} ${c[1] + c[3] * 22}" fill="none" stroke="${op(0.42)}" stroke-width="1.5"/>`;
            h += `<circle cx="${c[0] + c[2] * 16}" cy="${c[1] + c[3] * 16}" r="5" fill="none" stroke="${op(0.16)}"/>`;
        }
        h += text(30, 30, 'IV · THE DEEP · THE TREE', { s: 8, c: op(0.22), ls: '0.2em' });
        h += '<g class="tt-traces"></g><g class="tt-lit"></g><g class="tt-tags"></g><g class="tt-threads"></g><g class="tt-nodes"></g><g class="tt-log"></g>';
        svg.innerHTML = h;
        logG = svg.querySelector('.tt-log');
        threadG = svg.querySelector('.tt-threads');
        const traces = svg.querySelector('.tt-traces');
        const nodes = svg.querySelector('.tt-nodes');
        const tags = svg.querySelector('.tt-tags');
        lit = svg.querySelector('.tt-lit');
        for (const n of NODES) {
            const e = { key: '' };
            if (n.parent) {
                const pts = tracePath(n.id);
                const path = document.createElementNS(SVG, 'path');
                path.setAttribute('d', poly(pts));
                path.setAttribute('fill', 'none');
                path.dataset.child = n.id;
                traces.appendChild(path);
                e.trace = path;
                e.corners = pts.slice(1, -1).map((p) => {
                    const r = document.createElementNS(SVG, 'rect');
                    r.setAttribute('x', p[0] - 3.5); r.setAttribute('y', p[1] - 3.5);
                    r.setAttribute('width', 7); r.setAttribute('height', 7);
                    r.setAttribute('fill', RK);
                    traces.appendChild(r);
                    return r;
                });
            }
            const g = document.createElementNS(SVG, 'g');
            g.setAttribute('class', `tn${n.kind === 'bio' ? ' is-bio' : ''}`);
            g.dataset.id = n.id;
            nodes.appendChild(g);
            e.g = g;
            els[n.id] = e;
            g.addEventListener('mouseenter', () => enter(n.id), { signal });
            g.addEventListener('mouseleave', () => leave(n.id), { signal });
            g.addEventListener('click', (ev) => { ev.stopPropagation(); onBuy(n.id, !!ev.shiftKey); }, { signal });
        }
        for (const b of BRANCHES) {
            const [x, y, a] = TAGS[b];
            const t = document.createElementNS(SVG, 'text');
            t.setAttribute('x', x); t.setAttribute('y', y); t.setAttribute('text-anchor', a);
            t.setAttribute('font-size', 9); t.setAttribute('letter-spacing', '0.32em');
            t.setAttribute('fill', b === 'BIOLOGICAL' ? BIO : op(0.34));
            t.textContent = b;
            tags.appendChild(t);
            tagEls[b] = t;
        }
        built = true;
    }

    /** The trace into a node, styled by the node's own status (as in the mockup). */
    function traceStyle(st) {
        if (st.level > 0 || st.ordered > 0) return { c: op(0.78), w: 2 };
        if (st.status === 'surface') return { c: op(0.16), w: 1.5, dash: '3 4' };
        if (st.status === 'buyable') return { c: op(0.5), w: 2 };
        return { c: op(0.17), w: 1.5 };
    }

    /** One node's inner drawing, from its status. */
    function nodeSvg(n, st) {
        const big = n.kind === 'root';
        const s = big ? ROOT_SIZE : NODE;
        const x0 = n.x - s / 2, y0 = n.y - s / 2;
        const surface = st.status === 'surface';
        const gift = n.kind === 'surface' && st.opened;     // deep-voice: Surface opened it
        const buyable = st.status === 'buyable';
        const has = st.level > 0;
        const bio = n.kind === 'bio';
        const hot = bio ? BIO : BR;
        let h = '';
        // a hit area as big as the node and its pips, so the hover does not flicker between them
        h += `<rect x="${x0 - 4}" y="${y0 - 4}" width="${s + (n.max > 1 ? 40 : 8)}" height="${s + 8}" fill="transparent"/>`;
        if (surface) {
            h += `<rect x="${x0}" y="${y0}" width="${s}" height="${s}" fill="${RK}" stroke="${op(0.2)}" stroke-width="1" stroke-dasharray="2 3"/>`;
            h += `<circle cx="${x0 + s - 7}" cy="${y0 + 7}" r="3.6" fill="none" stroke="${op(0.5)}" stroke-width="1.1"/>`;
        } else if (has || big) {
            h += `<rect class="plate" x="${x0}" y="${y0}" width="${s}" height="${s}" fill="${bio ? '#d8a48a' : PL}"/>`;
            if (!big) h += `<rect x="${x0 + 4}" y="${y0 + 4}" width="4" height="4" fill="${RK}"/>`;
            if (buyable) h += `<rect x="${x0 - 3.5}" y="${y0 - 3.5}" width="${s + 7}" height="${s + 7}" fill="none" stroke="${hot}" stroke-width="1"/>`;
        } else if (buyable) {
            h += `<rect class="plate" x="${x0 + 0.75}" y="${y0 + 0.75}" width="${s - 1.5}" height="${s - 1.5}" fill="${RK}" stroke="${hot}" stroke-width="1.5"/>`;
            h += `<rect x="${x0 + 4}" y="${y0 + 4}" width="4" height="4" fill="${hot}"/>`;
        } else {
            h += `<rect class="plate" x="${x0 + 0.5}" y="${y0 + 0.5}" width="${s - 1}" height="${s - 1}" fill="${RK}" stroke="${op(0.3)}" stroke-width="1"/>`;
        }
        // an opened gift keeps Surface's ring, filled in its tone
        if (gift) h += `<circle class="gift-ring" cx="${x0 + s - 7}" cy="${y0 + 7}" r="3.6" fill="${WARM}" stroke="${has ? RK : WARM}" stroke-width="1.1"/>`;
        if (big) {
            h += text(n.x, n.y - 2, 'THE', { a: 'middle', c: RK, s: 11, w: 700, ls: '0.16em' });
            h += text(n.x, n.y + 12, 'COLONY', { a: 'middle', c: RK, s: 11, w: 700, ls: '0.16em' });
            return h;
        }
        if (n.max > 1) {
            const cols = Math.ceil(n.max / 5);
            // the pips sit on rock, so a trace under them does not show through
            h += `<rect x="${x0 + s + 2}" y="${y0 - 1}" width="${cols * 7 + 2}" height="${36}" fill="${RK}"/>`;
            for (let i = 0; i < n.max; i++) {
                const px = x0 + s + 4 + Math.floor(i / 5) * 7, py = y0 + 1 + (i % 5) * 7;
                if (i < st.level) h += `<rect class="pip" style="--i:${i}" x="${px}" y="${py}" width="5" height="5" fill="${bio ? BIO : PL}"/>`;
                else if (i < st.level + st.ordered) h += `<rect class="pip is-ordered" style="--i:${i}" x="${px + 0.5}" y="${py + 0.5}" width="4" height="4" fill="none" stroke="${BR}"/>`;
                else h += `<rect class="pip" style="--i:${i}" x="${px + 0.5}" y="${py + 0.5}" width="4" height="4" fill="none" stroke="${op(0.32)}"/>`;
            }
        }
        const label = surface ? op(0.26) : bio ? (has ? BIO : buyable ? BIO : 'rgba(230,185,161,0.42)')
            : has ? op(0.9) : buyable ? BR : op(0.36);
        const lines = n.name.split('\n');
        const all = lines.slice();
        // on the board only the stars; the whole price is in the info box
        const price = st.price && st.price.stars ? `★ ${short(st.price.stars)}` : '';
        if (price) all.push(price);
        const priceC = buyable ? hot : op(0.36);
        const isP = (i) => price && i === all.length - 1;
        if (n.lab === 'l') {
            const top = n.y - (all.length - 1) * 6 + 3.5;
            all.forEach((ln, i) => { h += text(x0 - 9, top + i * 12, ln, { a: 'end', c: isP(i) ? priceC : label, ls: isP(i) ? 0 : '0.06em' }); });
        } else if (n.lab === 't') {
            all.slice().reverse().forEach((ln, i) => { h += text(n.x, y0 - 8 - i * 12, ln, { a: 'middle', c: label, ls: '0.06em' }); });
        } else {
            const top = y0 + s + 14;
            all.forEach((ln, i) => { h += text(n.x, top + i * 12 + (isP(i) ? 1 : 0), ln, { a: 'middle', c: isP(i) ? priceC : label, ls: isP(i) ? 0 : '0.06em' }); });
        }
        return h;
    }

    function refresh() {
        if (!isOpen) return;
        if (!built) build();
        const s = state(), c = ctx();
        last = {};
        const shownBranch = {};
        for (const n of NODES) {
            const st = nodeStatus(s, n.id, c);
            last[n.id] = st;
            const e = els[n.id];
            if (st.visible && n.branch) shownBranch[n.branch] = true;
            const key = `${st.visible}|${st.status}|${st.level}|${st.ordered}|${st.price ? st.price.stars : ''}|${st.opened ? 1 : 0}`;
            if (key !== e.key) {
                e.key = key;
                e.g.style.display = st.visible ? '' : 'none';
                e.g.classList.toggle('is-buyable', st.status === 'buyable');
                e.g.innerHTML = st.visible ? nodeSvg(n, st) : '';
                if (e.trace) {
                    const sty = traceStyle(st);
                    e.trace.style.display = st.visible ? '' : 'none';
                    e.trace.setAttribute('stroke', sty.c);
                    e.trace.setAttribute('stroke-width', sty.w);
                    if (sty.dash) e.trace.setAttribute('stroke-dasharray', sty.dash); else e.trace.removeAttribute('stroke-dasharray');
                    for (const r of e.corners) {
                        r.style.display = st.visible ? '' : 'none';
                        r.setAttribute('stroke', sty.c);
                        r.setAttribute('stroke-width', 1.5);
                    }
                }
            }
        }
        for (const b of BRANCHES) tagEls[b].style.display = shownBranch[b] ? '' : 'none';
        drawBalances(s, c);
        drawLog(s);
        writeInfo(hoverId);
    }

    /** The money while shopping: ore and stars with their day's flow, and asleep the capacity. */
    const rate = (v) => (Number.isFinite(v) && Math.abs(v) >= 0.5 ? ` ${v >= 0 ? '+' : '-'}${short(Math.abs(v))}/d` : '');
    let balText = '';
    function drawBalances(s, c) {
        const set = (el, v) => { if (el && el.textContent !== v) el.textContent = v; };
        const ore = `ORE ${short(s.minerals || 0)}${rate(c.orePerDay)}`;
        const stars = `★ ${short(s.stars || 0)}${rate(c.starsPerDay)}`;
        const w = s.watcher;
        const cap = s.asleep && w ? `CAPACITY ${Math.floor(w.capacity || 0)} / ${capacityMax(w)}` : '';
        set(bal.ore, ore);
        set(bal.stars, stars);
        set(bal.cap, cap);
        if (bal.cap) bal.cap.hidden = !cap;
        balText = [ore, stars, cap].filter(Boolean).join(' · ');
    }

    /** THE NIGHT LOG: drawn again only when a line is added (or a node it ties to shows). */
    function drawLog(s) {
        const lines = nightLog(s);
        const sf = s.watcher && s.watcher.surface;
        const words = sf && sf.words > 0 ? sentenceShown(sf) : '';
        const next = lines.length ? nightNext(s) : null;
        const key = lines.map((l) => `${l.n}:${l.to && last[l.to] ? last[l.to].visible : ''}`).join(',')
            + `|${words}|${next ? next.text : ''}`;
        if (key === logKey) return;
        logKey = key;
        const v = lines.length ? VIEW_LOG : VIEW;
        svg.setAttribute('viewBox', `${v.x} ${v.y} ${v.w} ${v.h}`);
        logged = [];
        loggedNext = '';
        if (!lines.length) { logG.innerHTML = ''; threadG.innerHTML = ''; return; }
        let h = text(LOG.x, LOG.y, 'NIGHT LOG', { s: 9, c: WARM, ls: '0.32em', cls: 'log-head' }).replace('<text ', '<text opacity="0.55" ');
        let th = '';
        let y = LOG.y + 26, nTop = 0, nBottom = 0;
        const per = Math.floor(LOG.w / (LOG.fs * LOG.cw));
        lines.forEach((l, i) => {
            const rows = wrap(l.line, per);
            h += text(LOG.x, y, `NIGHT ${l.n}`, { s: 9, c: WARM, ls: '0.28em' }).replace('<text ', '<text opacity="0.55" ');
            const ty = y + 9 + LOG.fs;
            rows.forEach((r, k) => { h += text(LOG.x, ty + k * LOG.lh, r, { s: LOG.fs, c: WARM, cls: 'log-line' }); });
            const n = l.to ? NODE_BY_ID[l.to] : null;
            let thread = false;
            if (n && last[l.to] && last[l.to].visible) {
                const endX = LOG.x + rows[0].length * LOG.fs * LOG.cw + 8;
                const my = ty - LOG.fs * 0.33;
                const cx = -60 + 6 * i;
                const half = NODE / 2;
                const pts = [[endX, my], [cx, my]];
                const how = ROUTE[l.to] || 'left';
                if (how === 'left') {
                    const yy = l.to === 'question' ? n.y + 10 : n.y;
                    pts.push([cx, yy], [n.x - half, yy]);
                } else if (how === 'top') {
                    const yt = -12 - 5 * nTop++;
                    const vx = n.x - half - 30;
                    pts.push([cx, yt], [vx, yt], [vx, n.y + 8], [n.x - half, n.y + 8]);
                } else {
                    const yb = BOARD.h + 12 + 5 * nBottom++;
                    const right = how === 'bottomright';
                    const vx = right ? n.x + half + 22 : n.x - half - 12;
                    pts.push([cx, yb], [vx, yb], [vx, n.y + 8], [right ? n.x + half : n.x - half, n.y + 8]);
                }
                th += `<path class="log-thread" data-to="${l.to}" d="${poly(pts)}" fill="none" stroke="${WARM}" stroke-width="1.3" stroke-linecap="round" stroke-dasharray="0.1 3.4" opacity="0.8"/>`;
                thread = true;
            }
            logged.push({ n: l.n, line: l.line, to: l.to, thread });
            y = ty + (rows.length - 1) * LOG.lh + LOG.gap;
        });
        // deep-night: the sentence lives here between visits; on screen it is only a win's reward
        if (words) {
            h += text(LOG.x, y, 'THE SENTENCE', { s: 9, c: WARM, ls: '0.28em' }).replace('<text ', '<text opacity="0.55" ');
            const rows = wrap(words, Math.floor(LOG.w / (11 * LOG.cw + 1.4)));
            rows.forEach((r, k) => { h += text(LOG.x, y + 22 + k * 16, r, { s: 11, c: WARM, ls: '0.13em', cls: 'log-words' }); });
            y += 22 + (rows.length - 1) * 16 + LOG.gap;
        }
        // deep-night: and what the next night waits for, so a slow night never reads as a broken one
        if (next) {
            const rows = wrap(next.text, Math.floor(LOG.w / (12 * LOG.cw)));
            rows.forEach((r, k) => { h += text(LOG.x, y + k * 17, r, { s: 12, c: WARM, cls: 'log-next' }).replace('<text ', '<text opacity="0.8" '); });
            loggedNext = next.text;
        }
        logG.innerHTML = h;
        threadG.innerHTML = th;
    }

    /** The info box: name in capitals, level, price, what it does, and why not (or how long). */
    function writeInfo(id) {
        const st = id ? last[id] : null;
        info.box.classList.toggle('is-empty', !st);
        const set = (el, v) => { if (el.textContent !== v) el.textContent = v; };
        if (!st) { for (const k of ['name', 'lvl', 'cost', 'eff', 'x', 'q']) if (info[k]) set(info[k], ''); return; }
        const n = NODE_BY_ID[id];
        set(info.name, st.name);
        const lvl = n.kind === 'root' ? '' : `${Math.min(st.level, st.max)} / ${st.max}${st.ordered ? ` · ${st.ordered} ordered` : ''}`;
        set(info.lvl, lvl);
        let cost = '';
        if (st.status === 'surface') cost = '';
        else if (n.kind === 'root') cost = '';
        else if (st.price) cost = `next ${st.priceText}`;
        else if (st.level >= st.max || st.level + st.ordered >= st.max) cost = st.ordered ? 'on order' : 'bought';
        set(info.cost, cost);
        // deep-fix: the effect line with its numbers, from a dry run on a copy (the hovered node only)
        const s = state();
        const key = `${id}|${Math.floor(s.day || 0)}|${st.level}|${st.ordered}|${s.asleep ? 1 : 0}|${st.opened ? 1 : 0}|${Math.round(s.humans || 0)}`;
        if (effect.key !== key) effect = { key, text: effectLine(s, id) };
        set(info.eff, effect.text || st.does);
        let x = '';
        let cls = '';
        if (st.status === 'surface') { x = st.reason; }        // "Not ours to open."
        else if (st.status === 'buyable') {
            x = st.kind === 'choose' ? st.reason : (n.max > 1 ? 'click: one level · shift-click: as many as can be paid' : 'click to buy');
            cls = 'is-go';
        } else if (st.reason) { x = st.reason; cls = 'is-why'; }
        set(info.x, x);
        info.x.className = `ib-x ${cls}`;
        // deep-voice: a gift quotes the line that opened it
        if (info.q) set(info.q, st.quote ? `\u201c${st.quote}\u201d` : '');
        info.box.classList.toggle('is-bio', n.kind === 'bio');
    }

    function enter(id) {
        hoverId = id;
        const e = els[id];
        e.g.classList.add('hov');
        e.g.classList.remove('tick');
        void e.g.getBoundingClientRect();
        e.g.classList.add('tick');
        writeInfo(id);
        // the path from the root, lit in order
        lit.textContent = '';
        const chain = chainTo(id);
        const step = chain.length ? 300 / chain.length : 0;
        chain.forEach((c, i) => {
            const src = els[c]?.trace;
            if (!src) return;
            const p = src.cloneNode(false);
            delete p.dataset.child;
            p.removeAttribute('stroke-dasharray');
            p.removeAttribute('style');
            p.setAttribute('stroke', NODE_BY_ID[c].kind === 'bio' ? BIO : BR);
            p.setAttribute('stroke-width', '2');
            p.setAttribute('pathLength', '1');
            p.setAttribute('class', 'lit');
            p.style.animationDelay = `${Math.round(i * step)}ms`;
            lit.appendChild(p);
        });
    }
    function leave(id) {
        if (hoverId === id) hoverId = null;
        const e = els[id];
        e.g.classList.remove('hov', 'tick');
        lit.textContent = '';
        writeInfo(null);
    }

    return {
        open() { isOpen = true; host.hidden = false; refresh(); },
        close() {
            isOpen = false;
            host.hidden = true;
            if (hoverId) leave(hoverId);
        },
        isOpen: () => isOpen,
        refresh,
        /** For the tests: the status each node was last drawn from. */
        get drawn() { return last; },
        /** For the tests: the night log as drawn, and whether each line has its thread. */
        get log() { return logged.slice(); },
        /** For the tests: the log's last line, what the next night waits for ('' when there is none). */
        get logNext() { return loggedNext; },
        /** For the tests: the balances at the top edge, as drawn. */
        get balances() { return balText; },
        get hovered() { return hoverId; },
        destroy() { ac.abort(); },
    };
}
