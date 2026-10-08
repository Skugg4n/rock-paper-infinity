// A person playing V · UNITY from the start (▶ in the city, ▶▶ after) to WE LOOK UP: bites by hand (reads why a bite is refused, buys the
// marked organ), then ▶▶, turns GROW AS toward the red word, sets EDGE, buys what it can. Shots every 30 s of play.
//   node scripts/play-unity.mjs docs/playtests/unity-fas1-scenario.mjs   (env: CP=checkpoint, MS=real ms, UNTIL=scale)
export default async function (h) {
    await h.jump(process.env.CP || 'v-start');
    await h.wait(800);
    // frames a second, measured in the page
    await h.ev(`(() => { window.__fps = { n: 0, t0: performance.now() }; const f = () => { window.__fps.n++; requestAnimationFrame(f); }; requestAnimationFrame(f); return true; })()`);
    const fps = async () => h.ev(`(() => { const f = window.__fps, now = performance.now(); const v = f.n / ((now - f.t0) / 1000); f.n = 0; f.t0 = now; return Math.round(v) + ' fps, body ' + (rpiUnity.view.cost ? rpiUnity.view.cost.body.toFixed(1) : '?') + ' ms'; })()`);
    await h.shot('00-arrival');
    for (let k = 0; k < 30 && !(await h.ev(`!document.querySelector('[data-v="stop-ok"]').hidden`)); k++) await h.wait(200);
    await h.shot('01-start-stop');
    const st0 = await h.state();
    let nextShot = Math.ceil((st0.t + 1) / 30) * 30, n = 2, lastTurn = 0, fast = false, oursShot = false, refused = 0, bites = 0;
    const until = Number(process.env.UNTIL || 2);
    const t0 = Date.now();
    while (Date.now() - t0 < Number(process.env.MS || 480000)) {
        const st = await h.state();
        if (st.t >= nextShot) { console.log('    ', await fps(), '| did:', (globalThis.did || []).splice(0).join(', ')); await h.shot(`${st.scale >= 4 ? 'fas3-' : ''}${String(n++).padStart(2, '0')}-s${st.scale}-t${st.t}`); nextShot += 30; }
        if (await h.ev(`!!document.querySelector('#chapter-card.is-active')`)) { await h.wait(2500); await h.shot(`fas3-${String(n++).padStart(2, '0')}-card`); break; }
        if (st.scale >= until && st.t > (globalThis.landAt ??= st.t) + 30) break;
        if (st.stop) {
            const ok = await h.ev(`!document.querySelector('[data-v="stop-ok"]').hidden`);
            if (st.stop === 'ours' && !oursShot) { oursShot = true; await h.shot(`${String(n++).padStart(2, '0')}-ours`); }
            if (['storm', 'seeds', 'end', 'one'].includes(st.stop) && !(globalThis.stopShots ??= {})[st.stop]) { globalThis.stopShots[st.stop] = 1; await h.shot(`${st.scale >= 4 ? 'fas3-' : ''}${String(n++).padStart(2, '0')}-stop-${st.stop}`); }
            if (st.stop === 'ours') oursShot = false;
            if (st.stop === 'start' && !st.auto) { const cell = await h.ev(`rpiUnity.U.front(rpiUnity.state, 1)[0]`); await h.clickCell(cell); await h.wait(300); continue; }
            if (ok) { await h.wait(900); await h.clickSel('[data-v="stop-ok"]'); }
            await h.wait(300); continue;
        }
        if (await h.ev(`document.getElementById('phase-unity').classList.contains('is-zooming')`)) {
            if (!globalThis.zmid) { globalThis.zmid = 1; await h.wait(1600); await h.shot(`${String(n++).padStart(2, '0')}-zoom`); }
            await h.wait(300); continue;
        }
        if (!st.auto) {
            const cell = await h.ev(`rpiUnity.U.front(rpiUnity.state, 1)[0]`);
            const a0 = await h.ev(`rpiUnity.U.area(rpiUnity.state)`);
            if (cell != null) await h.clickCell(cell);
            const a1 = await h.ev(`rpiUnity.U.area(rpiUnity.state)`);
            if (a1 > a0) bites++; else { refused++; if (refused % 10 === 1) console.log('    refused:', await h.ev(`document.querySelector('[data-v="buys-hint"]').textContent`)); }
            const want = await h.ev(`(() => { const b = [...document.querySelectorAll('[data-buy]')].filter((x) => !x.disabled); const w = b.find((x) => x.classList.contains('want')); return w ? w.dataset.buy : null; })()`);
            if (want) await h.clickSel(`[data-buy="${want}"]`);
        } else if (!fast && st.scale >= 1) { fast = true; await h.clickSel('[data-speed="3"]'); }
        if (st.auto && !globalThis.handSaid) { globalThis.handSaid = 1; console.log(`    hand phase: ${st.t} s, ${bites} bites, ${refused} refused`); }
        // the marked card answers the red word: buy it when it can be paid, and save for it until then
        const card = await h.ev(`(() => { const a = document.querySelector('.v-card.answer'); if (a) return a.classList.contains('off') ? null : a.dataset.ex; const c = document.querySelector('.v-card:not(.off)'); return c ? c.dataset.ex : null; })()`);
        if (card) { await h.clickSel(`[data-ex="${card}"]`); (globalThis.did ??= []).push(card); }
        // the planet: a seed designed for the land, changed by what became of the last one; more points with insight
        if (st.scale >= 4) {
            const r = await h.ev(`(() => { const s = rpiUnity.state, U = rpiUnity.U; if (!s.ex.seeds || s.tut.stop) return null;
                const g = (window.__guess ??= {});
                for (const l of (s.landed || [])) { if (l.seen) continue; l.seen = true; const q = g[l.k]; if (!q) continue; if (l.res === 'sea') q.drift++; else if (l.res === 'salt') q.skin++; else if (l.res === 'stuck') q.mind++; else if (l.res === 'apart') q.roots++; }
                const sea = U.seas(s).find((x) => s.seeds.continents[x.k] !== 'joined' && !U.seedRefusal(s, x.k)); if (!sea) return null;
                const q = (g[sea.k] ??= { drift: 2, skin: 1, mind: 1, roots: 1 });
                U.setDesign(s, { ...q, acid: Math.max(0, U.seedPoints(s) - q.drift - q.skin - q.mind - q.roots) });
                return sea.k; })()`);
            if (await h.ev(`!document.querySelector('[data-v="extra"]').disabled && !document.querySelector('[data-v="extra"]').hidden`)) { await h.clickSel('[data-v="extra"]'); (globalThis.did ??= []).push('+1 point'); }
            if (r && !(await h.ev(`document.querySelector('[data-v="launch"]').disabled`))) { await h.clickSel('[data-v="launch"]'); (globalThis.did ??= []).push(`seed to ${r}`); }
        }
        if (st.auto && Date.now() - lastTurn > 2500) {
            lastTurn = Date.now();
            const turned = await h.ev(`(() => { const s = rpiUnity.state, f = rpiUnity.U.flows(s); const o = f.red && f.red.organ; const inp = o && document.querySelector('[data-grow="' + o + '"]'); if (!inp || inp.disabled) return null; inp.value = String(Math.min(60, Number(inp.value) + 10)); inp.dispatchEvent(new Event('input', { bubbles: true })); inp.dispatchEvent(new Event('change', { bubbles: true })); return o; })()`);
            if (turned) (globalThis.did ??= []).push(`${turned} up`);
            const mode = await h.ev(`(() => { const s = rpiUnity.state, f = rpiUnity.U.flows(s); return f.at >= 0 && !s.ex.edgeknows ? rpiUnity.U.bestMode(f.at) : null; })()`);
            if (mode && mode !== st.mode) { await h.clickSel(`[data-mode="${mode}"]`); (globalThis.did ??= []).push(mode); }
            // the minds: memory up when an experiment will not fit
            await h.ev(`(() => { const s = rpiUnity.state, f = rpiUnity.U.flows(s); const r = document.querySelector('[data-v="mem"]'); if (!r || r.closest('[hidden]')) return; if (f.red && f.red.organ === 'brain') { r.value = String(Math.min(s.minds, s.memory + 20)); r.dispatchEvent(new Event('input', { bubbles: true })); } })()`);
        }
        await h.wait(st.auto ? 400 : 450);
    }
    await h.shot(`${String(n++).padStart(2, '0')}-last`);
}
