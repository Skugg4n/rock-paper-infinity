import { PHASE1_CONSTANTS } from '../constants.js';

const { HYPER_SPEED_THRESHOLD } = PHASE1_CONSTANTS;

export async function runCountdownAnimation(board, gameSpeed) {
    const duration = (1.2 / gameSpeed / 3) * 1000;
    let countdownIcons = [];

    if (gameSpeed <= 5) countdownIcons = ["III", "II", "I"];
    else if (gameSpeed <= 6) countdownIcons = ["III", "II"];
    else if (gameSpeed <= 7) countdownIcons = ["III"];
    else if (gameSpeed <= HYPER_SPEED_THRESHOLD) countdownIcons = ["I"];

    if (countdownIcons.length === 0) return;

    const svgMap = {
        "III": `<svg xmlns="http://www.w3.org/2000/svg" width="56" height="56" viewBox="0 0 56 56" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" class="lucide-lg countdown-pop text-slate-400"><line x1="16" y1="14" x2="16" y2="42"></line><line x1="28" y1="14" x2="28" y2="42"></line><line x1="40" y1="14" x2="40" y2="42"></line></svg>`,
        "II": `<svg xmlns="http://www.w3.org/2000/svg" width="56" height="56" viewBox="0 0 56 56" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" class="lucide-lg countdown-pop text-slate-400"><line x1="22" y1="14" x2="22" y2="42"></line><line x1="34" y1="14" x2="34" y2="42"></line></svg>`,
        "I": `<svg xmlns="http://www.w3.org/2000/svg" width="56" height="56" viewBox="0 0 56 56" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" class="lucide-lg countdown-pop text-slate-400"><line x1="28" y1="14" x2="28" y2="42"></line></svg>`
    };

    const container = document.createElement('div');
    container.className = 'countdown-container';

    countdownIcons.forEach((icon, index) => {
        const wrapper = document.createElement('div');
        wrapper.innerHTML = svgMap[icon];
        const svg = wrapper.firstElementChild;
        svg.style.animationDuration = `${duration}ms`;
        svg.style.animationDelay = `${duration * index}ms`;
        svg.classList.add('countdown-frame');
        container.appendChild(svg);
    });

    board.computerEl.replaceChildren(container.cloneNode(true));
    board.playerEl.replaceChildren(container);

    await new Promise(resolve => setTimeout(resolve, duration * countdownIcons.length));
}
