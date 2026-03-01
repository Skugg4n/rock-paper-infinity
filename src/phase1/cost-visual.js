import { getIcon } from '../icons.js';
import { toRoman } from '../../roman.js';

export const tallySVGs = {
    1: `<svg width="8" height="16" viewBox="0 0 8 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4 2V14" stroke="white" stroke-width="2" stroke-linecap="round"/></svg>`,
    2: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4 2V14" stroke="white" stroke-width="2" stroke-linecap="round"/><path d="M12 2V14" stroke="white" stroke-width="2" stroke-linecap="round"/></svg>`,
    3: `<svg width="24" height="16" viewBox="0 0 24 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4 2V14" stroke="white" stroke-width="2" stroke-linecap="round"/><path d="M12 2V14" stroke="white" stroke-width="2" stroke-linecap="round"/><path d="M20 2V14" stroke="white" stroke-width="2" stroke-linecap="round"/></svg>`,
    4: `<svg width="32" height="16" viewBox="0 0 32 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4 2V14" stroke="white" stroke-width="2" stroke-linecap="round"/><path d="M12 2V14" stroke="white" stroke-width="2" stroke-linecap="round"/><path d="M20 2V14" stroke="white" stroke-width="2" stroke-linecap="round"/><path d="M28 2V14" stroke="white" stroke-width="2" stroke-linecap="round"/></svg>`,
    5: `<svg width="34" height="16" viewBox="0 0 34 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4 2V14" stroke="white" stroke-width="2" stroke-linecap="round"/><path d="M12 2V14" stroke="white" stroke-width="2" stroke-linecap="round"/><path d="M20 2V14" stroke="white" stroke-width="2" stroke-linecap="round"/><path d="M28 2V14" stroke="white" stroke-width="2" stroke-linecap="round"/><path d="M2 13L32 3" stroke="white" stroke-width="2" stroke-linecap="round"/></svg>`
};

export function generateCostVisual(cost) {
    let html = `<div class="flex items-center gap-2">${getIcon('star','w-4 h-4 text-white fill-current').outerHTML}<span class="font-bold text-lg">\u00d7</span>`;
    if (cost === 0) return '';
    if (cost >= 10) {
        html += `<span class="font-mono text-lg">${toRoman(cost)}</span>`;
    } else {
        html += `<div class="flex items-center gap-1">`;
        let remaining = cost;
        while (remaining > 0) {
            if (remaining >= 5) {
                html += tallySVGs[5];
                remaining -= 5;
            } else {
                if (tallySVGs[remaining]) html += tallySVGs[remaining];
                remaining = 0;
            }
        }
        html += `</div>`;
    }
    html += `</div>`;
    return html;
}
