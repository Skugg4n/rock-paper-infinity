/**
 * Chapter IV · THE DEEP: the drawer (deep-rebuild, movement I · TEND).
 *
 * Slides in from the right over a quarter of the screen; the colony stays visible and live behind
 * it. It lists only what can be bought NOW (bright, one line each: the name, what it does, the
 * price) and per branch the NEXT thing (dim, with what it needs). A purchase under way shows its
 * ring in its row. At the bottom a quiet link opens the whole tree. The rows are instruments.js's
 * drawerGroups(); a click goes back to the phase, which buys through tree.js as before.
 */

import { signHtml } from './readout.js';

const RING = 2 * Math.PI * 7;

/**
 * @param {HTMLElement} host - the drawer element (index.html #deep-drawer)
 * @param {object} opts
 * @param {(id:string)=>boolean} opts.onBuy
 * @param {()=>void} opts.onWholeTree
 * @param {()=>void} opts.onClose
 */
export function createDrawer(host, { onBuy, onWholeTree, onClose }) {
    host.innerHTML = `
        <div class="deep-drawer-in">
            <div class="deep-drawer-head">
                <span class="dymo is-small">THE DRAWER</span>
                <span class="deep-drawer-wallet deep-mono"></span>
            </div>
            <div class="deep-drawer-list"></div>
            <button class="deep-drawer-tree deep-mono" type="button">the whole tree</button>
        </div>`;
    const list = host.querySelector('.deep-drawer-list');
    const wallet = host.querySelector('.deep-drawer-wallet');
    let open = false;
    let key = '';
    let rows = [];
    host.querySelector('.deep-drawer-tree').addEventListener('click', () => onWholeTree());
    list.addEventListener('click', (e) => {
        const row = e.target.closest('.deep-dr-row');
        if (!row || !row.classList.contains('is-buy')) return;
        if (onBuy(row.dataset.id)) {
            row.classList.remove('is-bought');
            void row.offsetWidth;
            row.classList.add('is-bought');
        }
    });

    function draw(groups) {
        const k = JSON.stringify(groups.map((g) => [g.name, g.rows.map((r) => [r.id, r.status, r.price, r.does, r.need, r.progress >= 0])]));
        if (k !== key) {
            key = k;
            list.textContent = '';
            rows = [];
            for (const g of groups) {
                const sec = document.createElement('section');
                sec.className = 'deep-dr-group';
                sec.innerHTML = `<h3 class="deep-dr-tag deep-mono">${g.name}</h3>`;
                for (const r of g.rows) {
                    const el = document.createElement(r.status === 'buy' ? 'button' : 'div');
                    if (r.status === 'buy') el.type = 'button';
                    el.className = `deep-dr-row is-${r.status}`;
                    el.dataset.id = r.id;
                    // deep-fix2: ore in a price or a need carries the pickaxe (readout.js signHtml)
                    const right = r.status === 'next' ? '' : `<span class="deep-dr-price deep-mono">${signHtml(r.price)}</span>`;
                    const sub = signHtml(r.status === 'next' ? r.need : r.does);
                    el.innerHTML = `<span class="deep-dr-top"><span class="deep-dr-name deep-mono">${signHtml(r.name)}</span>${right}`
                        + '<svg class="deep-dr-ring" viewBox="0 0 18 18" width="16" height="16" aria-hidden="true"><circle class="track" cx="9" cy="9" r="7"></circle>'
                        + `<circle class="arc" cx="9" cy="9" r="7" stroke-dasharray="${RING.toFixed(1)}" stroke-dashoffset="${RING.toFixed(1)}"></circle></svg></span>`
                        + `<span class="deep-dr-sub">${sub}</span>`;
                    sec.appendChild(el);
                    rows.push({ el, r });
                }
                list.appendChild(sec);
            }
        }
        for (const { el, r } of rows) {
            const on = r.progress >= 0;
            el.classList.toggle('has-ring', on);
            if (on) el.querySelector('.arc').setAttribute('stroke-dashoffset', (RING * (1 - r.progress)).toFixed(1));
        }
    }

    return {
        isOpen: () => open,
        open() { open = true; host.hidden = false; void host.offsetWidth; host.classList.add('is-open'); },
        close() {
            if (!open) return;
            open = false;
            host.classList.remove('is-open');
            setTimeout(() => { if (!open) host.hidden = true; }, 260);
            onClose?.();
        },
        /**
         * @param {object[]} groups - instruments.js drawerGroups()
         * @param {string} walletText - "★ 1.1 M   ⛏ 181 k"
         */
        refresh(groups, walletText) {
            if (wallet.dataset.text !== walletText) { wallet.dataset.text = walletText; wallet.innerHTML = signHtml(walletText); }
            // the progress of each row moves every day; rebuild only when the rows change
            const fresh = new Map(groups.flatMap((g) => g.rows.map((r) => [r.id, r])));
            for (const x of rows) { const f = fresh.get(x.r.id); if (f) x.r = f; }
            draw(groups);
        },
        /** What the drawer shows now, for the tests: [{ id, status }]. */
        get rows() { return rows.map(({ r }) => ({ id: r.id, status: r.status, price: r.price, need: r.need })); },
    };
}
