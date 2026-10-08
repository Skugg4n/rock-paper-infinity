// A person playing fas 1: bites by hand, buys what is red, then turns GROW AS toward the red word.
export default async function (h) {
    await h.jump(process.env.CP || 'v-start');
    await h.wait(800);
    await h.shot('00-arrival');
    // read the stop, then do the thing it says (bite)
    for (let k = 0; k < 30 && !(await h.ev(`!document.querySelector('[data-v="stop-ok"]').hidden`)); k++) await h.wait(200);
    await h.shot('01-start-stop');
    let nextShot = 30, n = 2, lastTurn = 0, fast = false;
    const t0 = Date.now();
    while (Date.now() - t0 < Number(process.env.MS || 330000)) {
        const st = await h.state();
        if (st.t >= nextShot) { await h.shot(`${String(n++).padStart(2, '0')}-t${st.t}`); nextShot += 30; }
        if (st.scale >= 1 && st.t > (globalThis.landAt ??= st.t) + 40) break;
        // a stop: read, then OK (or bite, for the first)
        if (st.stop) {
            const ok = await h.ev(`!document.querySelector('[data-v="stop-ok"]').hidden`);
            if (st.stop === 'zoom' && !globalThis.zshot) { globalThis.zshot = 1; await h.shot(`${String(n++).padStart(2, '0')}-ours`); }
            if (ok) { await h.wait(900); await h.clickSel('[data-v="stop-ok"]'); }
            await h.wait(300); continue;
        }
        if (await h.ev(`document.getElementById('phase-unity').classList.contains('is-zooming')`)) {
            if (!globalThis.zmid) { globalThis.zmid = 1; await h.wait(1500); await h.shot(`${String(n++).padStart(2, '0')}-zoom`); }
            await h.wait(300); continue;
        }
        if (!st.auto) {
            // bite the edge, like a hand
            const cell = await h.ev(`rpiUnity.U.front(rpiUnity.state, 1)[0]`);
            if (cell != null) await h.clickCell(cell);
            // buy what is marked (the red one), else the cheapest
            const want = await h.ev(`(() => { const b = [...document.querySelectorAll('[data-buy]')].filter((x) => !x.disabled); const w = b.find((x) => x.classList.contains('want')); return w ? w.dataset.buy : (b[0] && b[0].dataset.buy) || null; })()`);
            if (want) await h.clickSel(`[data-buy="${want}"]`);
        } else if (!fast) { fast = true; await h.clickSel('[data-speed="3"]'); }
        // an experiment that can be paid
        const card = await h.ev(`(() => { const c = document.querySelector('.v-card:not(.off)'); return c ? c.dataset.ex : null; })()`);
        if (card) await h.clickSel(`[data-ex="${card}"]`);
        // GROW AS toward the red word, every few seconds
        if (st.auto && Date.now() - lastTurn > 2500) {
            lastTurn = Date.now();
            await h.ev(`(() => { const s = rpiUnity.state, f = rpiUnity.U.flows(s); const o = f.red && f.red.organ; const inp = o && document.querySelector('[data-grow="' + o + '"]'); if (!inp || inp.disabled) return null; inp.value = String(Math.min(60, Number(inp.value) + 10)); inp.dispatchEvent(new Event('input', { bubbles: true })); inp.dispatchEvent(new Event('change', { bubbles: true })); return o; })()`);
            // the right edge mode
            const mode = await h.ev(`(() => { const s = rpiUnity.state, f = rpiUnity.U.flows(s); return f.at >= 0 && !s.ex.edgeknows ? rpiUnity.U.bestMode(f.at) : null; })()`);
            if (mode && mode !== st.mode) await h.clickSel(`[data-mode="${mode}"]`);
        }
        await h.wait(st.auto ? 400 : 450);
    }
    await h.shot(`${String(n++).padStart(2, '0')}-last`);
}
