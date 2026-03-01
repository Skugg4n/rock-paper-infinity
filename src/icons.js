/* global lucide */

const ICONS = [
  'zap', 'star', 'timer', 'zap-off', 'atom', 'gem', 'file-text', 'scissors',
  'battery-charging', 'repeat-2', 'chevrons-right', 'battery-plus',
  'clover', 'copy', 'menu', 'factory', 'crown', 'minus', 'wallet',
  'swords', 'trophy'
];

const cache = {};

function toPascalCase(name) {
  return name.replace(/(^|-)(\w)/g, (_, __, c) => c.toUpperCase());
}

function buildSvg(iconChildren) {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('xmlns', ns);
  svg.setAttribute('width', '24');
  svg.setAttribute('height', '24');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  for (const [childTag, childAttrs] of iconChildren) {
    const el = document.createElementNS(ns, childTag);
    for (const [key, val] of Object.entries(childAttrs)) el.setAttribute(key, val);
    svg.appendChild(el);
  }
  return svg;
}

export async function preloadIcons() {
  if (typeof lucide === 'undefined' || !lucide.icons) {
    console.error('Lucide CDN not loaded');
    return;
  }
  for (const name of ICONS) {
    const pascalName = toPascalCase(name);
    const iconData = lucide.icons[pascalName];
    if (!iconData) {
      console.warn(`Lucide icon not found: ${name} (${pascalName})`);
      continue;
    }
    cache[name] = buildSvg(iconData);
  }
}

export function getIcon(name, className = '') {
  const svg = cache[name]?.cloneNode(true);
  if (!svg) return document.createElement('span');
  const classes = ['lucide', `lucide-${name}`];
  if (className) classes.push(...className.split(' '));
  svg.setAttribute('class', classes.join(' '));
  return svg;
}

export function replaceIcons(root = document) {
  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }
}
